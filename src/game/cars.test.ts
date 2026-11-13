import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAR_ROSTER,
  awardCoins,
  createDefaultGarageSave,
  getCarSpec,
  purchaseCar,
} from './cars';
import { getMapWorldData, groundHeightAt } from './terrain';
import { createVehicleStateAt, stepVehiclePhysics } from './vehiclePhysics';

test('garage purchaseCar deducts coins, unlocks car, and equips without double-charging', () => {
  const initial = createDefaultGarageSave();
  assert.equal(initial.coins, 120);
  assert.deepEqual(initial.ownedCars, ['apex']);

  // Cannot afford Viper (250 coins)
  const denied = purchaseCar(initial, 'viper', 1);
  assert.equal(denied.purchased, false);
  assert.equal(denied.next.coins, 120);
  assert.deepEqual(denied.next.ownedCars, ['apex']);

  // Can afford Dune Baja RS (120 coins)
  const bought = purchaseCar(initial, 'baja', 1);
  assert.equal(bought.purchased, true);
  assert.equal(bought.next.coins, 0);
  assert.ok(bought.next.ownedCars.includes('baja'));
  assert.equal(bought.next.equippedP1, 'baja');
  assert.equal(bought.next.equippedP2, 'apex');

  // Re-equipping Baja for P2 does not charge again
  const equipP2 = purchaseCar(bought.next, 'baja', 2);
  assert.equal(equipP2.purchased, false);
  assert.equal(equipP2.next.coins, 0);
  assert.equal(equipP2.next.equippedP2, 'baja');
});

test('awardCoins adds positive amounts and ignores invalid deltas', () => {
  const base = createDefaultGarageSave();
  const afterCoin = awardCoins(base, 25);
  assert.equal(afterCoin.coins, 145);
  assert.equal(awardCoins(afterCoin, 0).coins, 145);
  assert.equal(awardCoins(afterCoin, -10).coins, 145);
  assert.equal(awardCoins(afterCoin, Number.NaN).coins, 145);
});

test('car tires sit flush at exact WHEEL_REST_OFFSET (0.56m) above asphalt on all 4 maps', () => {
  const maps = ['valley', 'canyon', 'alpine', 'coast'] as const;
  for (const mapId of maps) {
    const world = getMapWorldData(mapId);
    assert.equal(world.coins.length, 45, `${mapId} should spawn 45 coins`);
    const samplePt = world.roadPoints[3];
    const roadH = groundHeightAt(samplePt.x, samplePt.z, mapId);
    const vehicle = createVehicleStateAt(samplePt.x, samplePt.z, 0, mapId);
    assert.ok(
      Math.abs(vehicle.y - roadH - 0.56) < 0.001,
      `${mapId} vehicle.y - groundHeight should match 0.56m tire offset`,
    );

    // Run 30 physics steps at rest to verify car stays flush on top of asphalt without sinking
    for (let i = 0; i < 30; i++) {
      stepVehiclePhysics(
        vehicle,
        { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false },
        null,
        { gripMultiplier: 1, windStrength: 0.1, windAngle: 0 },
        1 / 60,
        mapId,
        getCarSpec(CAR_ROSTER[0].id),
      );
    }
    const settledRoadH = groundHeightAt(vehicle.x, vehicle.z, mapId);
    assert.ok(
      vehicle.y - settledRoadH >= 0.52 && vehicle.y - settledRoadH <= 0.62,
      `${mapId} settled ride height above asphalt should remain flush (${vehicle.y - settledRoadH})`,
    );
  }
});
