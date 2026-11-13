import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRaceStandings,
  computeAiVehicleInput,
  createRaceGrid,
  stepRaceProgress,
} from './raceLogic';
import { getMapWorldData } from './terrain';
import type { VehicleInput } from './types';
import { stepVehiclePhysics } from './vehiclePhysics';
import { createInitialWeatherState } from './weather';

test('2P race grid spawns P1, P2, and 4 AI bots in staggered formation', () => {
  const grid = createRaceGrid('race2p', 'valley');
  assert.equal(grid.length, 6);
  assert.equal(grid[0].profile.playerIndex, 0);
  assert.equal(grid[1].profile.playerIndex, 1);
  assert.equal(grid.filter((r) => !r.profile.isHuman).length, 4);

  // Verify no two cars spawn overlapping
  for (let i = 0; i < grid.length; i++) {
    for (let j = i + 1; j < grid.length; j++) {
      const dist = Math.hypot(
        grid[i].vehicle.x - grid[j].vehicle.x,
        grid[i].vehicle.z - grid[j].vehicle.z,
      );
      assert.ok(dist >= 2.8, `Cars ${i} and ${j} spawned too close: ${dist}`);
    }
  }
});

test('AI bot controller steers and accelerates cleanly along circuit', () => {
  const world = getMapWorldData('canyon');
  const grid = createRaceGrid('race2p', 'canyon');
  const weather = createInitialWeatherState('clear');
  const aiRacer = grid[2];
  const aiInput: VehicleInput = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    boost: false,
  };

  for (let i = 0; i < 120; i++) {
    computeAiVehicleInput(aiRacer, grid, world, aiInput);
    stepVehiclePhysics(aiRacer.vehicle, aiInput, null, weather, 1 / 60, 'canyon');
  }

  assert.ok(aiRacer.vehicle.speedKmh > 55, `Expected AI bot to accelerate > 55 km/h, got ${aiRacer.vehicle.speedKmh}`);
});

test('checkpoint and finish line logic advances laps and marks race finished', () => {
  const world = getMapWorldData('valley');
  const grid = createRaceGrid('race2p', 'valley');
  const p1 = grid[0];

  for (let lap = 1; lap <= world.config.totalLaps; lap++) {
    assert.equal(p1.lap, lap);
    for (let cp = 1; cp < world.checkpoints.length; cp++) {
      p1.vehicle.x = world.checkpoints[cp].x;
      p1.vehicle.z = world.checkpoints[cp].z;
      stepRaceProgress(grid, world, lap * 30 + cp);
    }
    // Cross finish line (cp 0)
    p1.vehicle.x = world.checkpoints[0].x;
    p1.vehicle.z = world.checkpoints[0].z;
    stepRaceProgress(grid, world, lap * 40);
  }

  assert.equal(p1.finished, true);
  assert.ok(p1.finishTime !== null);
  const standings = buildRaceStandings(grid);
  assert.equal(standings[0].id, 'p1');
  assert.equal(standings[0].place, 1);
});
