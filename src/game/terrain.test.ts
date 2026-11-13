import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_LIST } from './maps';
import {
  TERRAIN_SIZE,
  WORLD_RADIUS,
  getMapWorldData,
  getTerrainSample,
  groundHeightAt,
} from './terrain';

test('world scale is 5x larger than initial 265m radius and all 4 maps build cleanly', () => {
  assert.ok(WORLD_RADIUS >= 600, `Expected WORLD_RADIUS >= 600, got ${WORLD_RADIUS}`);
  assert.ok(TERRAIN_SIZE >= 1400, `Expected TERRAIN_SIZE >= 1400, got ${TERRAIN_SIZE}`);
  assert.equal(MAP_LIST.length, 4);

  for (const mapCfg of MAP_LIST) {
    const world = getMapWorldData(mapCfg.id);
    assert.ok(world.roadPoints.length >= 160);
    assert.equal(world.checkpoints.length, 10);
    assert.ok(world.obstacles.length >= 500, `Map ${mapCfg.id} obstacles: ${world.obstacles.length}`);

    const spawnSample = getTerrainSample(world.startPose.x, world.startPose.z, mapCfg.id);
    assert.equal(spawnSample.surface, 'asphalt');
    assert.ok(spawnSample.roadFactor > 0.75);
    assert.equal(spawnSample.waterDepth, 0);
  }
});

test('generated obstacles never block starting grid, road, or exploration beacons', () => {
  for (const mapCfg of MAP_LIST) {
    const world = getMapWorldData(mapCfg.id);
    for (const obs of world.obstacles) {
      const distStart = Math.hypot(obs.x - world.startPose.x, obs.z - world.startPose.z);
      assert.ok(distStart >= 35, `Obstacle too close to start grid on ${mapCfg.id}`);
      const sample = getTerrainSample(obs.x, obs.z, mapCfg.id);
      assert.ok(sample.roadFactor <= 0.1, `Obstacle on road in ${mapCfg.id}`);
      for (const b of world.beacons) {
        assert.ok(Math.hypot(obs.x - b.x, obs.z - b.z) >= 12);
      }
    }
    assert.ok(Number.isFinite(groundHeightAt(0, 0, mapCfg.id)));
  }
});
