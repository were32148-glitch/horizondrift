import test from 'node:test';
import assert from 'node:assert/strict';
import { getMapWorldData } from './terrain';
import type { VehicleInput } from './types';
import {
  ObstacleGrid,
  createInitialVehicleState,
  createVehicleStateAt,
  resolveCarToCarCollisions,
  stepVehiclePhysics,
} from './vehiclePhysics';
import { createInitialWeatherState } from './weather';

const IDLE_INPUT: VehicleInput = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  boost: false,
};

test('vehicle survives idle ticks across all 4 maps', () => {
  const weather = createInitialWeatherState('clear');
  for (const mapId of ['valley', 'canyon', 'alpine', 'coast'] as const) {
    const state = createInitialVehicleState(mapId);
    for (let i = 0; i < 30; i++) {
      stepVehiclePhysics(state, IDLE_INPUT, null, weather, 1 / 60, mapId);
    }
    assert.equal(state.surface, 'asphalt');
    assert.ok(state.groundedCount >= 3);
    assert.ok(Number.isFinite(state.y));
  }
});

test('throttle accelerates vehicle forward and shifts through gears', () => {
  const state = createInitialVehicleState('valley');
  const weather = createInitialWeatherState('clear');
  for (let i = 0; i < 180; i++) {
    stepVehiclePhysics(
      state,
      { throttle: 1, brake: 0, steer: 0, handbrake: false, boost: false },
      null,
      weather,
      1 / 60,
      'valley',
    );
  }
  assert.ok(state.speedKmh > 90);
  assert.ok(state.gear >= 3);
});

test('car-to-car collision separates overlapping vehicles and triggers impactIntensity', () => {
  const world = getMapWorldData('valley');
  const carA = createVehicleStateAt(world.startPose.x, world.startPose.z, 0, 'valley');
  const carB = createVehicleStateAt(world.startPose.x + 1.0, world.startPose.z, 0, 'valley');
  carA.vx = 12;
  carB.vx = -8;
  resolveCarToCarCollisions([carA, carB]);
  assert.ok(Math.hypot(carB.x - carA.x, carB.z - carA.z) >= 2.5);
  assert.ok(carA.impactIntensity > 0.1);
  assert.ok(carB.impactIntensity > 0.1);
  assert.ok(ObstacleGrid !== undefined);
});
