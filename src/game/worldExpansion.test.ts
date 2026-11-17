import assert from 'node:assert/strict';
import test from 'node:test';
import { ANIMAL_SPECIES_LIST, HUMAN_ARCHETYPES } from './livingWorld.ts';
import { WORLD_RADIUS, TERRAIN_SIZE } from './maps.ts';
import {
  getDrivableSurfaceHeight,
  getMapWorldData,
  getTerrainSample,
  groundHeightAt,
} from './terrain.ts';
import { createVehicleStateAt, stepVehiclePhysics } from './vehiclePhysics.ts';
import { createInitialWeatherState, stepWeatherState } from './weather.ts';

test('World expands to 30x scale with connected Mountain Passes and Los Santos districts', () => {
  assert.equal(WORLD_RADIUS, 3200);
  assert.equal(TERRAIN_SIZE, 6800);

  const world = getMapWorldData('valley');
  assert.ok(world.westPassPoints.length > 20, 'West Divide Pass spline sampled');
  assert.ok(world.eastPassPoints.length > 20, 'East Divide Pass spline sampled');
  assert.ok(world.buildings.length >= 20, 'Los Santos skyline has >= 20 detailed buildings');
  assert.ok(world.elevatedDecks.length >= 6, 'Includes Olympic Freeway, ramps, pier & canal bridges');
  assert.ok(world.ramps.length >= 10, 'Includes stunt ramps across Wildlands & Los Santos');
  assert.ok(world.coins.length >= 50, 'Includes coin pickups across Wildlands & Los Santos');

  // Verify drivable terrain & biome transitions north of Wildlands
  const passSample = getTerrainSample(-260, -830, 'valley');
  assert.equal(passSample.biome, 'Great Divide Pass');
  assert.ok(passSample.surface === 'asphalt' || passSample.surface === 'dirt');
  assert.ok(Number.isFinite(passSample.height));

  const downtownSample = getTerrainSample(0, -1840, 'valley');
  assert.equal(downtownSample.biome, 'Downtown Los Santos');
  assert.equal(downtownSample.surface, 'asphalt');

  const vinewoodSample = getTerrainSample(-80, -2640, 'valley');
  assert.equal(vinewoodSample.biome, 'Vinewood Hills');

  const vespucciSample = getTerrainSample(-970, -1960, 'valley');
  assert.equal(vespucciSample.biome, 'Vespucci Beach');

  const pierSample = getTerrainSample(-1100, -1820, 'valley', 5.0);
  assert.equal(pierSample.biome, 'Del Perro Pier');
  assert.equal(pierSample.surface, 'wood');
});

test('Elevated Olympic Freeway lets cars drive BOTH on top of deck AND underneath on ground', () => {
  // Olympic Viaduct is at x=0, z=-1360, height y=12.6m
  const onDeck = getTerrainSample(0, -1360, 'valley', 13.0);
  assert.ok(Math.abs(onDeck.height - 12.6) < 0.1, `Expected deck ~12.6m, got ${onDeck.height}`);
  assert.equal(onDeck.biome, 'Olympic Freeway');

  const underneath = getTerrainSample(0, -1360, 'valley', 4.0);
  assert.ok(underneath.height < 6.0, `Expected ground <6m below viaduct, got ${underneath.height}`);
});

test('Stunt ramps elevate drivable surface progressively along ramp length', () => {
  const world = getMapWorldData('valley');
  const ramp = world.ramps[0];
  const fwdX = Math.sin(ramp.yaw);
  const fwdZ = Math.cos(ramp.yaw);

  const entryRes = getDrivableSurfaceHeight(
    ramp.x - fwdX * (ramp.length * 0.4),
    ramp.z - fwdZ * (ramp.length * 0.4),
    groundHeightAt(ramp.x, ramp.z, 'valley') + 1,
    'valley',
  );
  const lipRes = getDrivableSurfaceHeight(
    ramp.x + fwdX * (ramp.length * 0.42),
    ramp.z + fwdZ * (ramp.length * 0.42),
    groundHeightAt(ramp.x, ramp.z, 'valley') + ramp.height,
    'valley',
  );
  assert.ok(lipRes.onRamp && lipRes.height > entryRes.height + 2.0, `Ramp should rise cleanly (${entryRes.height.toFixed(2)} -> ${lipRes.height.toFixed(2)})`);
});

test('Solid building & barricade colliders block cars from driving through Maze Bank Tower', () => {
  // Maze Bank Tower center is (-75, -1940), width 56 x 56 (half = 28)
  const car = createVehicleStateAt(-75, -1905, Math.PI, 'valley'); // just south of Maze Bank, facing North into it
  car.vx = 0;
  car.vz = -28; // driving fast straight into south wall
  car.speed = 28;
  const weather = stepWeatherState(createInitialWeatherState('clear'), 0.016, 0.5);
  const input = { throttle: 1, brake: 0, steer: 0, handbrake: false, boost: false };

  for (let i = 0; i < 40; i++) {
    stepVehiclePhysics(car, input, null, weather, 0.02, 'valley');
  }

  // Car must remain strictly outside the 56x56 footprint (-103.. -47 in X, -1968 .. -1912 in Z)
  const insideX = car.x > -102 && car.x < -48;
  const insideZ = car.z > -1967 && car.z < -1913;
  assert.equal(insideX && insideZ, false, `Car penetrated inside Maze Bank Tower (${car.x.toFixed(1)}, ${car.z.toFixed(1)})`);
});

test('Living world includes >= 20 distinct animal species and 8 diverse human archetypes', () => {
  assert.ok(
    ANIMAL_SPECIES_LIST.length >= 20,
    `Expected >= 20 animal species, got ${ANIMAL_SPECIES_LIST.length}`,
  );
  const uniqueAnimals = new Set(ANIMAL_SPECIES_LIST.map((a) => a.id));
  assert.equal(uniqueAnimals.size, ANIMAL_SPECIES_LIST.length);

  assert.equal(HUMAN_ARCHETYPES.length, 8);
  const uniqueHumans = new Set(HUMAN_ARCHETYPES.map((h) => h.id));
  assert.equal(uniqueHumans.size, HUMAN_ARCHETYPES.length);
});
