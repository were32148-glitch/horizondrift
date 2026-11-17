import test from 'node:test';
import assert from 'node:assert/strict';
import { FreestyleTrafficController } from './freestyleTraffic';
import { createRaceGrid } from './raceLogic';
import { getMapWorldData } from './terrain';

test('FreestyleTrafficController spawns ~5 staggered opposite-direction bot cars per minute, never together', () => {
  const world = getMapWorldData('valley');
  const grid = createRaceGrid('freestyle', 'valley');
  assert.equal(grid.length, 1, 'Freestyle grid should remain single local player (non-racing)');

  const player = grid[0].vehicle;
  const traffic = new FreestyleTrafficController('valley');

  assert.equal(traffic.active, false);

  // Step 1.5s: should still be waiting for 2.0s initial delay
  for (let i = 0; i < 30; i++) {
    traffic.update(0.05, player, world);
  }
  assert.equal(traffic.active, false);

  // Step 1.0s more: first opposite-side car should spawn ahead
  for (let i = 0; i < 20; i++) {
    traffic.update(0.05, player, world);
  }
  assert.equal(traffic.active, true);
  assert.equal(traffic.spawnCount, 1);

  // Verify it drives in opposite heading vs player along road
  const playerFwdX = Math.sin(player.yaw);
  const playerFwdZ = Math.cos(player.yaw);
  const botFwdX = Math.sin(traffic.vehicle.yaw);
  const botFwdZ = Math.cos(traffic.vehicle.yaw);
  const headingDot = playerFwdX * botFwdX + playerFwdZ * botFwdZ;
  assert.ok(headingDot < -0.2, `Expected opposite heading dot < -0.2, got ${headingDot}`);
  assert.ok(traffic.vehicle.speedKmh > 40, 'Oncoming bot should cruise cleanly');

  // Simulate 60 seconds total (~5 cars per minute) while cruising forward along road
  // and verify active oncoming cars never clump within 130m of each other
  let minObservedSpacing = Infinity;
  for (let step = 0; step < 1200; step++) {
    player.x += playerFwdX * 12 * 0.05;
    player.z += playerFwdZ * 12 * 0.05;
    traffic.update(0.05, player, world);
    const activeSlots = traffic.slots.filter((s) => s.active);
    for (let a = 0; a < activeSlots.length; a++) {
      for (let b = a + 1; b < activeSlots.length; b++) {
        const d = Math.hypot(
          activeSlots[a].vehicle.x - activeSlots[b].vehicle.x,
          activeSlots[a].vehicle.z - activeSlots[b].vehicle.z,
        );
        if (d < minObservedSpacing) minObservedSpacing = d;
      }
    }
  }

  assert.ok(
    traffic.spawnCount >= 4 && traffic.spawnCount <= 6,
    `Expected ~5 staggered oncoming cars in 1 minute (4-6), got ${traffic.spawnCount}`,
  );
  assert.ok(
    minObservedSpacing >= 100,
    `Expected oncoming cars never spawned together (min spacing >= 100m), got ${minObservedSpacing}`,
  );
  const cd = traffic.getCooldownRemaining();
  assert.ok(cd >= 0 && cd <= 13.5, `Expected staggered interval <= 13.5s, got ${cd}`);
});
