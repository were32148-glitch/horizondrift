import assert from 'node:assert/strict';
import test from 'node:test';
import {
  awardCoins,
  getCarSpec,
  getCharacterSpec,
  getWeaponSpec,
  loadGarageSave,
  purchaseCar,
  purchaseCharacter,
  purchaseWeapon,
} from './cars';
import { FreestyleActionController, GOLD_BULLET_HEX } from './freestyleAction';
import { type HitReactionEvent, LivingWorldController } from './livingWorld';
import { getMapWorldData } from './terrain';
import { createVehicleStateAt } from './vehiclePhysics';

test('Shop: can purchase Police Car (LSPD Interceptor), Special Characters, and Weapons using coins', () => {
  let save = loadGarageSave();
  save = awardCoins(save, 5000);

  const policeSpec = getCarSpec('police_cruiser');
  assert.equal(policeSpec.id, 'police_cruiser');
  assert.equal(policeSpec.price, 300);

  const carRes = purchaseCar(save, 'police_cruiser', 1);
  assert.equal(carRes.purchased, true);
  assert.equal(carRes.next.equippedP1, 'police_cruiser');
  assert.ok(carRes.next.ownedCars.includes('police_cruiser'));
  save = carRes.next;

  const charSpec = getCharacterSpec('special_ops');
  assert.equal(charSpec.armorBonus, 100);
  const charRes = purchaseCharacter(save, 'special_ops');
  assert.equal(charRes.purchased, true);
  assert.equal(charRes.next.equippedCharacter, 'special_ops');
  assert.ok(charRes.next.unlockedCharacters.includes('special_ops'));
  save = charRes.next;

  const weapSpec = getWeaponSpec('assault_rifle');
  assert.ok(weapSpec.damage >= 50);
  const weapRes = purchaseWeapon(save, 'assault_rifle');
  assert.equal(weapRes.purchased, true);
  assert.equal(weapRes.next.equippedWeapon, 'assault_rifle');
  assert.ok(weapRes.next.unlockedWeapons.includes('assault_rifle'));
});

test('FreestyleActionController: only some police come, energy drink restores 100%, and character dies on 0 HP', () => {
  const ctrl = new FreestyleActionController('valley', 'default', 'pistol');
  const car = createVehicleStateAt(0, 0, 0, 'valley');

  assert.equal(ctrl.isOnFoot, false);
  const exited = ctrl.toggleOnFoot(car);
  assert.equal(exited, true);
  assert.equal(ctrl.isOnFoot, true);

  // At 1-2 stars, only 1 police officer and 1 cruiser come
  ctrl.reportCrime(1);
  assert.equal(ctrl.wantedLevel, 1);
  assert.equal(ctrl.policeOfficers.filter((o) => o.active).length, 1);
  assert.equal(ctrl.policeCruisers.filter((c) => c.active).length, 1);

  // Even at 5 stars, at most 2 police officers and 1 cruiser exist
  ctrl.policeReinforceCooldown = 0;
  ctrl.reportCrime(4);
  assert.equal(ctrl.wantedLevel, 5);
  assert.ok(ctrl.policeOfficers.filter((o) => o.active).length <= 2);
  assert.equal(ctrl.policeCruisers.filter((c) => c.active).length, 1);

  // Apply police damage -> character health drops
  let banner = '';
  ctrl.applyPlayerDamage(60, null, (evt) => {
    banner = evt.title;
  });
  assert.equal(ctrl.health, 40);
  assert.equal(ctrl.isDead, false);

  // Drink Energy Drink -> restores full 100% HP and Energy
  const usedDrink = ctrl.useEnergyDrink();
  assert.equal(usedDrink, true);
  assert.equal(ctrl.health, ctrl.maxHealth);
  assert.equal(ctrl.energy, 100);

  // Fatal police damage -> character dies (WASTED)
  ctrl.applyPlayerDamage(250, null, (evt) => {
    banner = evt.title;
  });
  assert.equal(ctrl.health, 0);
  assert.equal(ctrl.isDead, true);
  assert.ok(banner.includes('WASTED'));

  // Step past 2.8s respawn timer -> character respawns with full health
  for (let i = 0; i < 65; i++) {
    ctrl.update(
      0.05,
      i * 0.05,
      car,
      { forward: 0, turn: 0, sprint: false, attack: false },
      null,
    );
  }
  assert.equal(ctrl.isDead, false);
  assert.equal(ctrl.health, ctrl.maxHealth);

  ctrl.dispose();
});

test('Enterable Houses: furnished with Sofa, TV & Bed, and block wall entry while allowing doorway entry', () => {
  const ctrl = new FreestyleActionController('valley', 'default', 'pistol');
  assert.ok(ctrl.houses.length >= 7);

  for (const h of ctrl.houses) {
    assert.equal(h.hasSofa, true, `House ${h.name} should have a sofa`);
    assert.equal(h.hasTv, true, `House ${h.name} should have a TV`);
    assert.equal(h.hasBed, true, `House ${h.name} should have a bed`);
    assert.equal(h.wallBoxes.length, 5, 'House should have 5 solid wall colliders');
    assert.ok(h.furnitureBoxes.length >= 4, 'House should have furniture colliders');
  }

  // Pick Downtown LS House #101 at (-34, -1600) with doorFacingYaw = +PI/2 (+X in world is +Z local doorway)
  const house = ctrl.houses.find((h) => h.name.includes('#101'))!;
  assert.ok(house);

  // 1. Try walking through the BACK wall (world x = house.x - 6 -> house.x - 3.5) -> MUST BE BLOCKED!
  const backAttempt = ctrl.resolveCharacterHouseCollision(
    house.x - 6.0,
    house.z,
    house.x - 3.5,
    house.z,
    0.4,
  );
  assert.ok(
    backAttempt.x <= house.x - 5.2,
    `Expected back wall to block entry, got x=${backAttempt.x.toFixed(2)} vs wall at ${(house.x - 5).toFixed(2)}`,
  );

  // 2. Try walking through the SIDE wall (world z = house.z - 6 -> house.z - 3.5) -> MUST BE BLOCKED!
  const sideAttempt = ctrl.resolveCharacterHouseCollision(
    house.x,
    house.z - 6.0,
    house.x,
    house.z - 3.5,
    0.4,
  );
  assert.ok(
    sideAttempt.z <= house.z - 5.2,
    `Expected side wall to block entry, got z=${sideAttempt.z.toFixed(2)} vs wall at ${(house.z - 5).toFixed(2)}`,
  );

  // 3. Walk through the OPEN FRONT DOORWAY (world x = house.x + 6 -> house.x + 2.5, z = house.z) -> MUST ENTER!
  const doorEntry = ctrl.resolveCharacterHouseCollision(
    house.x + 6.0,
    house.z,
    house.x + 2.5,
    house.z,
    0.4,
  );
  assert.ok(
    Math.abs(doorEntry.x - (house.x + 2.5)) < 0.05,
    `Expected open front doorway to allow entry to x=${house.x + 2.5}, got x=${doorEntry.x.toFixed(2)}`,
  );

  ctrl.dispose();
});

test('Manual Aiming & Gold Bullets: shooting does not auto-aim and fires Gold (0xffd700) bullets along manual aim ray', () => {
  assert.equal(GOLD_BULLET_HEX, 0xffd700);
  const ctrl = new FreestyleActionController('valley', 'default', 'pistol');
  const living = new LivingWorldController('valley', 'freestyle');

  const target = living.actors.find((a) => a.category === 'human' && a.reaction === 'calm')!;
  assert.ok(target);

  // Place player 8m south of target, outside any house walls
  ctrl.isOnFoot = true;
  ctrl.charX = target.x;
  ctrl.charY = target.y;
  ctrl.charZ = target.z - 8;

  // 1. Aim 90 degrees away from target (no auto-aim!) -> must MISS
  ctrl.setManualAimTarget(ctrl.charX + 20, ctrl.charZ);
  const missedHits = ctrl.triggerWeaponAttack(living);
  assert.equal(missedHits, 0, 'Shooting while aimed away from target must not auto-hit');
  assert.equal(target.reaction, 'calm');

  // Verify a Gold Bullet projectile was spawned with gold color 0xffd700
  const activeBullet = ctrl.goldBullets.find((b) => b.active);
  assert.ok(activeBullet, 'Expected an active 3D gold bullet projectile');
  const mat = activeBullet.mesh.material as unknown as { color: { getHex: () => number } };
  assert.equal(mat.color.getHex(), 0xffd700);

  // 2. Now manually aim directly at the target and shoot -> must HIT!
  ctrl.setManualAimTarget(target.x, target.z);
  const dummyCar = createVehicleStateAt(0, 0, 0, 'valley');
  for (let i = 0; i < 8; i++) {
    ctrl.update(
      0.05,
      i * 0.05,
      dummyCar,
      { forward: 0, turn: 0, sprint: false, attack: false },
      living,
    );
  }
  const aimedHits = ctrl.triggerWeaponAttack(living);
  assert.ok(aimedHits >= 1, 'Shooting when manually aimed at target should hit');

  ctrl.dispose();
  living.dispose();
});

test('LivingWorldController: ground animals stay in grass off the road, and weapons kill actors with coins + wanted stars', () => {
  const living = new LivingWorldController('valley', 'freestyle');
  const world = getMapWorldData('valley');

  const groundAnimals = living.actors.filter(
    (a) => a.category === 'animal' && a.locomotion !== 'bird',
  );
  assert.ok(groundAnimals.length >= 25);
  for (const animal of groundAnimals) {
    let minRoadDist = Infinity;
    for (const pt of world.roadPoints) {
      const d = Math.hypot(animal.x - pt.x, animal.z - pt.z);
      if (d < minRoadDist) minRoadDist = d;
    }
    assert.ok(
      minRoadDist >= 22,
      `Expected animal ${animal.speciesId} at (${animal.x.toFixed(1)}, ${animal.z.toFixed(1)}) to be in grass off road, got minRoadDist=${minRoadDist.toFixed(1)}`,
    );
  }

  const target = living.actors.find((a) => a.category === 'human' && a.reaction === 'calm')!;
  assert.ok(target);
  const originX = target.x;
  const originZ = target.z - 5;
  const aimYaw = 0; // +Z directly toward target

  const hits: HitReactionEvent[] = [];
  const kills = living.attackActorsWithWeapon(
    originX,
    target.y,
    originZ,
    aimYaw,
    30,
    0.75,
    (evt) => hits.push(evt),
  );
  assert.ok(kills >= 1);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].isKill, true);
  assert.ok((hits[0].coinsAwarded ?? 0) >= 20);

  living.dispose();
});
