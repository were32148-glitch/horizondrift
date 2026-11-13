import { MAPS, TERRAIN_SIZE, WORLD_RADIUS, sampleSpline } from './maps';
import type {
  BiomeName,
  CoinSpawn,
  ExplorationBeacon,
  MapConfig,
  MapId,
  SplinePoint,
  StuntRamp,
  SurfaceType,
  TerrainSample,
  WorldObstacle,
} from './types';

export { TERRAIN_SIZE, WORLD_RADIUS };

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function smoothstepRange(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2(ix: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function noise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(x - ix);
  const fz = smoothstep(z - iz);

  const v00 = hash2(ix, iz);
  const v10 = hash2(ix + 1, iz);
  const v01 = hash2(ix, iz + 1);
  const v11 = hash2(ix + 1, iz + 1);

  return lerp(lerp(v00, v10, fx), lerp(v01, v11, fx), fz) * 2 - 1;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2D(x * freq, z * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return value;
}

export function ridgedNoise2D(x: number, z: number, octaves = 3): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2D(x * freq, z * freq));
    value += amp * n * n;
    freq *= 2.1;
    amp *= 0.5;
  }
  return value;
}

export interface CircuitCheckpoint {
  index: number;
  x: number;
  z: number;
  yaw: number;
}

interface PolylineGrid {
  pts: SplinePoint[];
  closed: boolean;
  cellSize: number;
  buckets: Map<number, number[]>;
}

function buildPolylineGrid(
  pts: SplinePoint[],
  closed: boolean,
  pad: number,
  cellSize = 32,
): PolylineGrid {
  const buckets = new Map<number, number[]>();
  const limit = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < limit; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const minX = Math.floor((Math.min(a.x, b.x) - pad) / cellSize);
    const maxX = Math.floor((Math.max(a.x, b.x) + pad) / cellSize);
    const minZ = Math.floor((Math.min(a.z, b.z) - pad) / cellSize);
    const maxZ = Math.floor((Math.max(a.z, b.z) + pad) / cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        const key = ((cx + 512) << 12) | (cz + 512);
        let arr = buckets.get(key);
        if (!arr) {
          arr = [];
          buckets.set(key, arr);
        }
        arr.push(i);
      }
    }
  }
  return { pts, closed, cellSize, buckets };
}

function distanceToPolylineGrid(x: number, z: number, grid: PolylineGrid): number {
  const cx = Math.floor(x / grid.cellSize);
  const cz = Math.floor(z / grid.cellSize);
  const key = ((cx + 512) << 12) | (cz + 512);
  const indices = grid.buckets.get(key);
  if (!indices || indices.length === 0) return 999;

  const pts = grid.pts;
  let minSq = Infinity;
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const lenSq = abx * abx + abz * abz;
    let t = 0;
    if (lenSq > 1e-6) {
      t = clamp(((x - a.x) * abx + (z - a.z) * abz) / lenSq, 0, 1);
    }
    const dx = x - (a.x + abx * t);
    const dz = z - (a.z + abz * t);
    const dSq = dx * dx + dz * dz;
    if (dSq < minSq) minSq = dSq;
  }
  return Math.sqrt(minSq);
}

export interface MapWorldData {
  id: MapId;
  config: MapConfig;
  roadPoints: SplinePoint[];
  trailPoints: SplinePoint[];
  roadGrid: PolylineGrid;
  trailGrid: PolylineGrid;
  startPose: { x: number; z: number; yaw: number };
  checkpoints: CircuitCheckpoint[];
  ramps: StuntRamp[];
  beacons: ExplorationBeacon[];
  coins: CoinSpawn[];
  obstacles: WorldObstacle[];
  windTurbines: Array<{ x: number; z: number }>;
  watchtowers: Array<{ x: number; z: number }>;
}

function distanceToPolyline(
  x: number,
  z: number,
  pts: SplinePoint[],
  closed: boolean,
): { dist: number; segIndex: number } {
  let minSq = Infinity;
  let bestIdx = 0;
  const limit = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < limit; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const lenSq = abx * abx + abz * abz;
    let t = 0;
    if (lenSq > 1e-6) {
      t = clamp(((x - a.x) * abx + (z - a.z) * abz) / lenSq, 0, 1);
    }
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const dx = x - px;
    const dz = z - pz;
    const dSq = dx * dx + dz * dz;
    if (dSq < minSq) {
      minSq = dSq;
      bestIdx = i;
    }
  }
  return { dist: Math.sqrt(minSq), segIndex: bestIdx };
}

function baseNaturalElevation(x: number, z: number, mapId: MapId): number {
  const distFromCenter = Math.hypot(x, z);
  const rimT = smoothstepRange(540, 725, distFromCenter);
  const rimRidges = 52 + ridgedNoise2D(x * 0.008, z * 0.008, 3) * 85;
  const outerRim = rimT * rimRidges;

  if (mapId === 'canyon') {
    const rolling = fbm2D(x * 0.0038 + 11.4, z * 0.0038 - 4.2, 4) * 14;
    const micro = fbm2D(x * 0.018, z * 0.018, 3) * 1.8;
    // Terraced sandstone mesas
    const mesaRaw = Math.max(0, fbm2D(x * 0.0055 - 2.1, z * 0.0055 + 5.7, 3));
    const mesaStepped = Math.floor(mesaRaw * 5) / 5 * 36 + mesaRaw * 16;
    // River gorge cutting diagonally
    const gorgeDist = Math.abs((x * 0.65 - z * 0.76) - Math.sin(z * 0.012) * 75);
    const gorgeCut = (1 - smoothstepRange(18, 85, gorgeDist)) * 12.5;
    return 4.2 + rolling + micro + mesaStepped * (1 - smoothstepRange(200, 420, distFromCenter) * 0.3) - gorgeCut + outerRim;
  }

  if (mapId === 'alpine') {
    const rolling = fbm2D(x * 0.0042 - 3.3, z * 0.0042 + 8.1, 4) * 18;
    const micro = fbm2D(x * 0.02, z * 0.02, 3) * 1.9;
    // Dramatic jagged peaks across northern and eastern half
    const peakMask = 1 - smoothstepRange(60, 450, Math.hypot(x - 110, z + 260));
    const ridges = ridgedNoise2D(x * 0.0065 + 4.4, z * 0.0065 + 2.2, 4) * 68;
    const westPeak = (1 - smoothstepRange(40, 320, Math.hypot(x + 310, z + 180))) * (28 + ridgedNoise2D(x * 0.008, z * 0.008, 3) * 35);
    // Frozen alpine tarn in center-south
    const tarnDist = Math.hypot((x + 35) / 115, (z + 30) / 85);
    const tarnCut = (1 - smoothstepRange(0.3, 1.1, tarnDist)) * 10.5;
    return 5.5 + rolling * (1 - (1 - smoothstepRange(0.3, 1.1, tarnDist)) * 0.75) + micro + peakMask * (26 + ridges) + westPeak - tarnCut + outerRim;
  }

  if (mapId === 'coast') {
    // Island bay with central turquoise sea & outer volcanic cliffs
    const bayDist = Math.hypot((x + 20) / 185, (z + 10) / 155);
    const bayMask = 1 - smoothstepRange(0.35, 1.15, bayDist);
    const islandHills = fbm2D(x * 0.0048 + 6.1, z * 0.0048 - 3.4, 4) * 14;
    const micro = fbm2D(x * 0.022, z * 0.022, 3) * 1.4;
    // Twin coastal headland & volcano peak in northwest
    const volcanoDist = Math.hypot(x + 380, z + 360);
    const volcano = (1 - smoothstepRange(45, 290, volcanoDist)) * (45 + ridgedNoise2D(x * 0.007, z * 0.007, 3) * 38);
    const ringIsland = smoothstepRange(130, 260, distFromCenter) * 6.5;
    return 1.2 + islandHills * (1 - bayMask * 0.8) + micro + ringIsland - bayMask * 9.5 + volcano + outerRim;
  }

  // Default: 'valley' (5x expanded Wildlands Grand Valley)
  const rolling = fbm2D(x * 0.0036 + 3.1, z * 0.0036 - 1.7, 4) * 15.0;
  const micro = fbm2D(x * 0.018 - 5.4, z * 0.018 + 2.9, 3) * 1.6;

  // Crystal Lake basin in central valley
  const lakeDx = (x + 40) / 135;
  const lakeDz = (z + 55) / 100;
  const lakeDist = Math.hypot(lakeDx, lakeDz);
  const lakeFactor = 1 - smoothstepRange(0.32, 1.15, lakeDist);
  const lakeBowl = lakeFactor * 11.2;

  // Towering Alpine Mountain massif in north/northeast
  const mtnMask = 1 - smoothstepRange(50, 340, Math.hypot(x - 180, z + 420));
  const mtnRidges = ridgedNoise2D(x * 0.006 + 7.2, z * 0.006 + 4.1, 3) * 64;
  const alpinePeak = mtnMask * (30 + mtnRidges);

  // Western forest ridge & eastern ridge
  const westMask = 1 - smoothstepRange(60, 260, Math.hypot(x + 420, z + 260));
  const westRidge = westMask * (18 + ridgedNoise2D(x * 0.007, z * 0.007, 2) * 24);
  const eastMask = 1 - smoothstepRange(60, 240, Math.hypot(x - 450, z + 40));
  const eastHill = eastMask * (22 + ridgedNoise2D(x * 0.008 + 2, z * 0.008, 2) * 18);

  const dampedRolling = (rolling + micro) * (1 - lakeFactor * 0.78);
  return 3.5 + dampedRolling - lakeBowl + alpinePeak + westRidge + eastHill + outerRim;
}

const _worldCache = new Map<MapId, MapWorldData>();

function buildMapWorldData(mapId: MapId): MapWorldData {
  const config = MAPS[mapId];
  const roadPoints = sampleSpline(config.circuitControlPoints, true, 20);
  const trailPoints = sampleSpline(config.trailControlPoints, false, 14);

  // Start pose on roadPoints[0] facing roadPoints[1]
  const p0 = roadPoints[0];
  const p1 = roadPoints[1];
  const startYaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);

  // 10 evenly spaced checkpoints around circuit
  const cpCount = 10;
  const checkpoints: CircuitCheckpoint[] = [];
  for (let c = 0; c < cpCount; c++) {
    const idx = Math.floor((c / cpCount) * roadPoints.length);
    const pt = roadPoints[idx];
    const nextPt = roadPoints[(idx + 1) % roadPoints.length];
    checkpoints.push({
      index: c,
      x: pt.x,
      z: pt.z,
      yaw: Math.atan2(nextPt.x - pt.x, nextPt.z - pt.z),
    });
  }

  // 4 Stunt ramps placed off-road in open spaces
  const ramps: StuntRamp[] = [
    { id: `${mapId}-ramp-1`, x: 45, z: 95, yaw: 0.45, width: 10, length: 18, height: 4.2 },
    { id: `${mapId}-ramp-2`, x: -135, z: 80, yaw: -0.85, width: 10, length: 18, height: 3.8 },
    { id: `${mapId}-ramp-3`, x: 245, z: -40, yaw: 0.15, width: 10, length: 19, height: 4.5 },
    { id: `${mapId}-ramp-4`, x: -10, z: -155, yaw: 1.9, width: 10, length: 17, height: 3.9 },
  ];

  // 6 Exploration beacons
  const beacons: ExplorationBeacon[] = [
    { id: `${mapId}-b1`, name: 'Grand Straight Overlook', biome: config.name, x: 335, z: 160, radius: 16 },
    { id: `${mapId}-b2`, name: 'Valley Basin Shore', biome: config.name, x: -75, z: -45, radius: 16 },
    { id: `${mapId}-b3`, name: 'Southern Plains', biome: config.name, x: -140, z: 320, radius: 16 },
    { id: `${mapId}-b4`, name: 'Wildwood Trailhead', biome: config.name, x: -420, z: -310, radius: 16 },
    { id: `${mapId}-b5`, name: 'Highland Crest', biome: config.name, x: 165, z: -415, radius: 18 },
    { id: `${mapId}-b6`, name: 'Eastern Ridge Vista', biome: config.name, x: 440, z: -45, radius: 16 },
  ];

  const windTurbines = [
    { x: -240, z: 350 },
    { x: -195, z: 385 },
    { x: 280, z: 340 },
    { x: 335, z: 315 },
    { x: 470, z: 80 },
  ];

  const watchtowers = [
    { x: -380, z: -165 },
    { x: 235, z: -265 },
    { x: -195, z: 120 },
  ];

  const roadGrid = buildPolylineGrid(roadPoints, true, config.roadWidth * 0.5 + 14);
  const trailGrid = buildPolylineGrid(trailPoints, false, 12);

  // Temporary partial object for sampling heights during obstacle & coin placement
  const partial: MapWorldData = {
    id: mapId,
    config,
    roadPoints,
    trailPoints,
    roadGrid,
    trailGrid,
    startPose: { x: p0.x, z: p0.z, yaw: startYaw },
    checkpoints,
    ramps,
    beacons,
    coins: [],
    obstacles: [],
    windTurbines,
    watchtowers,
  };
  _worldCache.set(mapId, partial);

  // Generate 1,100+ rich deterministic obstacles avoiding road, trail, start grid, water, ramps, and beacons
  const obstacles: WorldObstacle[] = [];
  let nextId = 1;
  let seed = mapId === 'valley' ? 918273 : mapId === 'canyon' ? 441122 : mapId === 'alpine' ? 773311 : 558899;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const roadClearanceHalf = config.roadWidth * 0.5 + 3.8;
  const trailClearanceHalf = 6.2;

  for (let i = 0; i < 1900 && obstacles.length < 1100; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = 32 + Math.sqrt(rand()) * (WORLD_RADIUS - 35);
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad;

    // Keep starting grid clear
    if (Math.hypot(x - p0.x, z - p0.z) < 42) continue;

    let blocked = false;
    for (const r of ramps) {
      if (Math.hypot(x - r.x, z - r.z) < 22) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const b of beacons) {
      if (Math.hypot(x - b.x, z - b.z) < 16) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const roadDist = distanceToPolyline(x, z, roadPoints, true).dist;
    if (roadDist < roadClearanceHalf) continue;
    const trailDist = distanceToPolyline(x, z, trailPoints, false).dist;
    if (trailDist < trailClearanceHalf) continue;

    const sample = getTerrainSample(x, z, mapId);
    if (sample.waterDepth > 0 || sample.surface === 'water') continue;

    // Place trees or rocks depending on map & elevation
    const isBoulderZone =
      mapId === 'canyon' ||
      sample.slope > 0.34 ||
      sample.surface === 'rock' ||
      sample.height > 32 ||
      rand() < 0.24;

    if (!isBoulderZone && sample.slope <= 0.32 && sample.surface !== 'sand') {
      const groveNoise = fbm2D(x * 0.011 + 1.5, z * 0.011 - 2.3, 2);
      if (sample.surface === 'grass' && groveNoise < 0.04 && rand() > 0.26) continue;

      let kind: WorldObstacle['kind'] = 'pine';
      if (mapId === 'alpine' || sample.height > 20) {
        kind = rand() < 0.72 ? 'snowPine' : 'pine';
      } else if (mapId === 'coast') {
        kind = rand() < 0.55 ? 'cypress' : 'oak';
      } else {
        kind = sample.biome === 'Whispering Forest' || rand() < 0.62 ? 'pine' : 'oak';
      }

      const scale = 0.85 + rand() * 0.65;
      obstacles.push({
        id: nextId++,
        x,
        z,
        y: sample.height,
        radius: (kind === 'oak' ? 1.15 : 0.9) * scale,
        height: (kind === 'oak' ? 9.5 : 12.0) * scale,
        kind,
      });
    } else if (rand() < 0.58) {
      const scale = 0.8 + rand() * 2.1;
      obstacles.push({
        id: nextId++,
        x,
        z,
        y: sample.height,
        radius: 1.35 * scale,
        height: 2.2 * scale,
        kind: scale > 1.75 ? 'boulder' : 'rock',
      });
    }
  }

  partial.obstacles = obstacles;

  // Generate 45 collectible Gold Coins across circuit, trails, and stunt ramps
  const coins: CoinSpawn[] = [];
  for (let c = 0; c < 22; c++) {
    const idx = (3 + Math.floor((c / 22) * (roadPoints.length - 6))) % roadPoints.length;
    const pt = roadPoints[idx];
    const nextPt = roadPoints[(idx + 1) % roadPoints.length];
    const tx = nextPt.x - pt.x;
    const tz = nextPt.z - pt.z;
    const tLen = Math.hypot(tx, tz) || 1;
    const nx = -tz / tLen;
    const nz = tx / tLen;
    const laneShift = (c % 3 - 1) * 3.0;
    const cx = pt.x + nx * laneShift;
    const cz = pt.z + nz * laneShift;
    coins.push({
      id: `${mapId}-coin-r-${c}`,
      x: cx,
      z: cz,
      y: groundHeightAt(cx, cz, mapId) + 1.05,
      value: 10,
    });
  }
  for (let t = 0; t < 11; t++) {
    const idx = Math.min(trailPoints.length - 1, Math.floor(((t + 0.5) / 11) * trailPoints.length));
    const pt = trailPoints[idx];
    coins.push({
      id: `${mapId}-coin-t-${t}`,
      x: pt.x,
      z: pt.z,
      y: groundHeightAt(pt.x, pt.z, mapId) + 1.05,
      value: 15,
    });
  }
  for (let rIdx = 0; rIdx < ramps.length; rIdx++) {
    const r = ramps[rIdx];
    const fwdX = Math.sin(r.yaw);
    const fwdZ = Math.cos(r.yaw);
    for (let j = 0; j < 3; j++) {
      const dist = r.length * 0.5 + 4 + j * 5.5;
      const cx = r.x + fwdX * dist;
      const cz = r.z + fwdZ * dist;
      const baseH = groundHeightAt(cx, cz, mapId);
      coins.push({
        id: `${mapId}-coin-j-${rIdx}-${j}`,
        x: cx,
        z: cz,
        y: baseH + r.height + 1.4 - j * 0.25,
        value: 25,
      });
    }
  }
  partial.coins = coins;

  return partial;
}

export function getMapWorldData(mapId: MapId = 'valley'): MapWorldData {
  const cached = _worldCache.get(mapId);
  if (cached) return cached;
  return buildMapWorldData(mapId);
}

function rampOffsetAt(x: number, z: number, ramps: StuntRamp[]): number {
  let maxRamp = 0;
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    const dx = x - r.x;
    const dz = z - r.z;
    const cos = Math.cos(-r.yaw);
    const sin = Math.sin(-r.yaw);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const halfW = r.width * 0.5;
    const halfL = r.length * 0.5;
    if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfL) {
      const t = (lz + halfL) / r.length;
      const h = r.height * Math.pow(t, 1.45);
      if (h > maxRamp) maxRamp = h;
    }
  }
  return maxRamp;
}

export function getTerrainHeightAndFactors(
  x: number,
  z: number,
  mapId: MapId = 'valley',
): {
  height: number;
  roadFactor: number;
  trailFactor: number;
} {
  const data = getMapWorldData(mapId);
  const config = data.config;
  const halfW = config.roadWidth * 0.5;
  const trailHalfW = 4.2;

  const rawH = baseNaturalElevation(x, z, mapId);

  const roadDist = distanceToPolylineGrid(x, z, data.roadGrid);
  const roadBlend = 1 - smoothstepRange(halfW - 1.5, halfW + 11.0, roadDist);
  const roadFactor = 1 - smoothstepRange(halfW - 1.0, halfW + 0.8, roadDist);

  const trailDist = distanceToPolylineGrid(x, z, data.trailGrid);
  const trailBlend = 1 - smoothstepRange(trailHalfW - 0.8, trailHalfW + 6.5, trailDist);
  const trailFactor = 1 - smoothstepRange(trailHalfW - 0.6, trailHalfW + 1.0, trailDist);

  let h = rawH;
  if (roadBlend > 0.001) {
    const smoothRoadBase =
      (mapId === 'alpine' ? 5.2 : 3.2) +
      fbm2D(x * 0.0022 + 3.1, z * 0.0022 - 1.7, 2) * (mapId === 'alpine' ? 11.5 : 7.5);
    const bridgeFloor = Math.max(smoothRoadBase, config.waterLevel + 2.2);
    h = lerp(h, bridgeFloor, roadBlend * 0.94);
  }

  if (trailBlend > 0.001 && roadFactor < 0.5) {
    const smoothTrailBase = Math.max(rawH, config.waterLevel + 1.1);
    h = lerp(h, smoothTrailBase, trailBlend * 0.45);
  }

  h += roadFactor * 0.22 + trailFactor * 0.12;
  h += rampOffsetAt(x, z, data.ramps);

  return { height: h, roadFactor, trailFactor };
}

export function groundHeightAt(x: number, z: number, mapId: MapId = 'valley'): number {
  return getTerrainHeightAndFactors(x, z, mapId).height;
}

export function classifyBiomeAndSurface(
  x: number,
  z: number,
  height: number,
  slope: number,
  roadFactor: number,
  trailFactor: number,
  mapId: MapId,
): { surface: SurfaceType; biome: BiomeName; waterDepth: number } {
  const config = MAPS[mapId];
  const waterDepth = Math.max(0, config.waterLevel - height);

  if (roadFactor > 0.45) {
    return { surface: 'asphalt', biome: 'Scenic Highway', waterDepth: 0 };
  }
  if (waterDepth > 0.14) {
    return {
      surface: 'water',
      biome: mapId === 'coast' ? 'Coastal Bay' : 'Crystal Lakefront',
      waterDepth,
    };
  }
  if (height < config.waterLevel + 1.1) {
    return {
      surface: 'sand',
      biome: mapId === 'coast' ? 'Coastal Bay' : 'Crystal Lakefront',
      waterDepth: 0,
    };
  }
  if (trailFactor > 0.45) {
    return {
      surface: 'dirt',
      biome: mapId === 'canyon' ? 'Redrock Canyon' : 'Whispering Forest',
      waterDepth: 0,
    };
  }

  if (mapId === 'canyon') {
    if (slope > 0.28 || height > 18) {
      return { surface: 'rock', biome: 'Redrock Canyon', waterDepth: 0 };
    }
    return { surface: 'sand', biome: 'Desert Mesa', waterDepth: 0 };
  }

  if (mapId === 'alpine') {
    if (slope > 0.36) {
      return { surface: 'rock', biome: 'Glacier Ridge', waterDepth: 0 };
    }
    if (height > 8.5) {
      return { surface: 'snow', biome: 'Snowy Summit', waterDepth: 0 };
    }
    return { surface: 'forest', biome: 'Glacier Ridge', waterDepth: 0 };
  }

  if (height > 29.0) {
    return {
      surface: slope > 0.42 ? 'rock' : mapId === 'coast' ? 'rock' : 'snow',
      biome: mapId === 'coast' ? 'Alpine Highlands' : 'Snowy Summit',
      waterDepth: 0,
    };
  }
  if (height > 17.5 || slope > 0.42) {
    return {
      surface: slope > 0.32 ? 'rock' : 'grass',
      biome: 'Alpine Highlands',
      waterDepth: 0,
    };
  }

  const forestSignal = fbm2D(x * 0.0055 - 4.2, z * 0.0055 + 6.7, 2);
  const inForestQuadrant = (x < -120 && z < 90) || (z < -160 && x < 280);
  if (inForestQuadrant && forestSignal > -0.18) {
    return { surface: 'forest', biome: 'Whispering Forest', waterDepth: 0 };
  }

  return {
    surface: 'grass',
    biome: mapId === 'coast' ? 'Coastal Bay' : 'Emerald Grasslands',
    waterDepth: 0,
  };
}

export function getTerrainSample(
  x: number,
  z: number,
  mapId: MapId = 'valley',
): TerrainSample {
  const eps = 0.85;
  const center = getTerrainHeightAndFactors(x, z, mapId);
  const hL = groundHeightAt(x - eps, z, mapId);
  const hR = groundHeightAt(x + eps, z, mapId);
  const hD = groundHeightAt(x, z - eps, mapId);
  const hU = groundHeightAt(x, z + eps, mapId);

  const dx = (hR - hL) / (2 * eps);
  const dz = (hU - hD) / (2 * eps);
  const invLen = 1 / Math.sqrt(dx * dx + 1 + dz * dz);
  const normalX = -dx * invLen;
  const normalY = invLen;
  const normalZ = -dz * invLen;
  const slope = clamp(1 - normalY, 0, 1);

  const { surface, biome, waterDepth } = classifyBiomeAndSurface(
    x,
    z,
    center.height,
    slope,
    center.roadFactor,
    center.trailFactor,
    mapId,
  );

  return {
    height: center.height,
    normalX,
    normalY,
    normalZ,
    slope,
    surface,
    biome,
    roadFactor: center.roadFactor,
    trailFactor: center.trailFactor,
    waterDepth,
  };
}
