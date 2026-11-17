import test from 'node:test';
import assert from 'node:assert/strict';
import { type HitReactionEvent, LivingWorldController } from './livingWorld';
import { createVehicleStateAt } from './vehiclePhysics';

test('Freestyle increases animal count significantly, spills blood & awards coins once per kill, and respawns cleanly', () => {
  const raceWorld = new LivingWorldController('valley', 'race1p');
  const freeWorld = new LivingWorldController('valley', 'freestyle');

  const raceAnimals = raceWorld.getAnimalCount();
  const freeAnimals = freeWorld.getAnimalCount();
  assert.ok(
    freeAnimals >= raceAnimals + 60,
    `Expected Freestyle animal count (${freeAnimals}) to exceed Race (${raceAnimals}) by >= 60`,
  );

  // Pick a ground animal to hit
  const target = freeWorld.actors.find(
    (a) => a.category === 'animal' && a.locomotion !== 'bird',
  );
  assert.ok(target, 'Expected at least one ground animal in Freestyle');

  const car = createVehicleStateAt(target.x, target.z, 0, 'valley');
  car.y = target.y;
  car.vx = 18;
  car.vz = 0;
  car.speed = 18;
  car.speedKmh = 65;

  const events: HitReactionEvent[] = [];
  freeWorld.update(0.016, 1.0, [car], (evt) => events.push(evt));

  assert.equal(events.length, 1);
  assert.equal(events[0].isKill, true);
  assert.ok((events[0].coinsAwarded ?? 0) >= 10, 'Killing animal should award coins');
  assert.equal(target.reaction, 'knocked');
  assert.equal(freeWorld.getTotalKills(), 1);

  // Advance physics ~0.9s until animal collapses dead into blood pool
  for (let i = 0; i < 60; i++) {
    freeWorld.update(0.02, 1.0 + i * 0.02, [car], (evt) => events.push(evt));
  }
  assert.equal(target.reaction, 'dead');
  assert.equal(events.length, 1, 'Dead/dying animal must not double-award coins');

  // Drive right over the dead carcass again — still no double coin reward
  car.x = target.x;
  car.y = target.y;
  car.z = target.z;
  freeWorld.update(0.02, 3.0, [car], (evt) => events.push(evt));
  assert.equal(events.length, 1, 'Dead carcass cannot be farmed for extra coins');

  // Move car far away and fast-forward respawn timer
  car.x += 220;
  car.z += 220;
  for (let i = 0; i < 320; i++) {
    freeWorld.update(0.05, 4.0 + i * 0.05, [car]);
  }
  assert.equal(target.reaction, 'calm', 'Killed animal should respawn after cooldown when car is away');

  raceWorld.dispose();
  freeWorld.dispose();
});

test('Freestyle increases people count significantly, spills blood & awards coins on hit, and prevents double-farming', () => {
  const raceWorld = new LivingWorldController('valley', 'race1p');
  const freeWorld = new LivingWorldController('valley', 'freestyle');

  const raceHumans = raceWorld.getHumanCount();
  const freeHumans = freeWorld.getHumanCount();
  assert.ok(
    freeHumans >= raceHumans + 50,
    `Expected Freestyle people count (${freeHumans}) to exceed Race (${raceHumans}) by >= 50`,
  );

  const person = freeWorld.actors.find((a) => a.category === 'human');
  assert.ok(person, 'Expected human pedestrian in Freestyle');

  const car = createVehicleStateAt(person.x, person.z, 0, 'valley');
  car.y = person.y;
  car.vx = 16;
  car.vz = 0;
  car.speed = 16;
  car.speedKmh = 58;

  const events: HitReactionEvent[] = [];
  freeWorld.update(0.016, 1.0, [car], (evt) => events.push(evt));

  assert.equal(events.length, 1);
  assert.equal(events[0].category, 'human');
  assert.equal(events[0].isKill, true);
  assert.ok((events[0].coinsAwarded ?? 0) >= 20, 'Killing a person in Freestyle should award coins');
  assert.equal(person.reaction, 'knocked');
  assert.equal(freeWorld.getTotalKills(), 1);

  for (let i = 0; i < 60; i++) {
    freeWorld.update(0.02, 1.0 + i * 0.02, [car], (evt) => events.push(evt));
  }
  assert.equal(person.reaction, 'dead');
  assert.equal(events.length, 1, 'Dead person must not double-award coins');

  car.x = person.x;
  car.y = person.y;
  car.z = person.z;
  freeWorld.update(0.02, 3.0, [car], (evt) => events.push(evt));
  assert.equal(events.length, 1, 'Dead body cannot be farmed for extra coins');

  car.x += 220;
  car.z += 220;
  for (let i = 0; i < 320; i++) {
    freeWorld.update(0.05, 4.0 + i * 0.05, [car]);
  }
  assert.equal(person.reaction, 'calm', 'Killed person should respawn cleanly when player leaves');

  raceWorld.dispose();
  freeWorld.dispose();
});

