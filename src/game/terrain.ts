import {
  EAST_PASS_CONTROL_POINTS,
  LOS_SANTOS_ARTERIALS,
  MAPS,
  TERRAIN_SIZE,
  WEST_PASS_CONTROL_POINTS,
  WORLD_RADIUS,
  sampleSpline,
} from './maps';
import type {
  BiomeName,
  BoxCollider,
  CoinSpawn,
  ElevatedDeck,
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

export interface BuildingSpec {
  id: string;
  x: number;
  z: number;
  baseY: number;
  width: number;
  depth: number;
  height: number;
  yaw: number;
  style: 'skyscraper' | 'mazebank' | 'tower' | 'commercial' | 'warehouse' | 'mansion' | 'lifeguard';
  colorHex: number;
  accentHex: number;
}

interface PolylineGrid {
  segments: Array<{ ax: number; az: number; bx: number; bz: number }>;
  cellSize: number;
  buckets: Map<number, number[]>;
}

function gridKey(cx: number, cz: number): number {
  return (cx + 2048) * 8192 + (cz + 2048);
}

function buildPolylineGrid(
  polylines: Array<{ pts: SplinePoint[]; closed: boolean }>,
  pad: number,
  cellSize = 36,
): PolylineGrid {
  const segments: Array<{ ax: number; az: number; bx: number; bz: number }> = [];
  const buckets = new Map<number, number[]>();

  for (const poly of polylines) {
    const pts = poly.pts;
    const limit = poly.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < limit; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const segIdx = segments.length;
      segments.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z });
      const minX = Math.floor((Math.min(a.x, b.x) - pad) / cellSize);
      const maxX = Math.floor((Math.max(a.x, b.x) + pad) / cellSize);
      const minZ = Math.floor((Math.min(a.z, b.z) - pad) / cellSize);
      const maxZ = Math.floor((Math.max(a.z, b.z) + pad) / cellSize);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          const key = gridKey(cx, cz);
          let arr = buckets.get(key);
          if (!arr) {
            arr = [];
            buckets.set(key, arr);
          }
          arr.push(segIdx);
        }
      }
    }
  }
  return { segments, cellSize, buckets };
}

function distanceToPolylineGrid(x: number, z: number, grid: PolylineGrid): number {
  const cx = Math.floor(x / grid.cellSize);
  const cz = Math.floor(z / grid.cellSize);
  const indices = grid.buckets.get(gridKey(cx, cz));
  if (!indices || indices.length === 0) return 999;

  const segs = grid.segments;
  let minSq = Infinity;
  for (let k = 0; k < indices.length; k++) {
    const s = segs[indices[k]];
    const abx = s.bx - s.ax;
    const abz = s.bz - s.az;
    const lenSq = abx * abx + abz * abz;
    let t = 0;
    if (lenSq > 1e-6) {
      t = clamp(((x - s.ax) * abx + (z - s.az) * abz) / lenSq, 0, 1);
    }
    const dx = x - (s.ax + abx * t);
    const dz = z - (s.az + abz * t);
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
  westPassPoints: SplinePoint[];
  eastPassPoints: SplinePoint[];
  losSantosRoads: SplinePoint[][];
  roadGrid: PolylineGrid;
  passGrid: PolylineGrid;
  cityRoadGrid: PolylineGrid;
  trailGrid: PolylineGrid;
  startPose: { x: number; z: number; yaw: number };
  checkpoints: CircuitCheckpoint[];
  ramps: StuntRamp[];
  elevatedDecks: ElevatedDeck[];
  buildings: BuildingSpec[];
  colliders: BoxCollider[];
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

function baseNaturalElevation(x: number, z: number, _mapId: MapId): number {
  const distSq = x * x + z * z;
  const innerRim = WORLD_RADIUS - 160;
  if (distSq <= innerRim * innerRim) return 3.5;
  const distFromCenter = Math.sqrt(distSq);
  const worldRimT = smoothstepRange(innerRim, WORLD_RADIUS + 260, distFromCenter);
  // Flat plane surface beside water (flat elevation 3.5m)
  return 3.5 + worldRimT * 12;
}

const _worldCache = new Map<MapId, MapWorldData>();

function addBarricadeRow(
  colliders: BoxCollider[],
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  step: number,
  kind: BoxCollider['kind'],
  baseY: number,
  prefix: string,
) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 1) return;
  const yaw = Math.atan2(dx, dz);
  const count = Math.max(1, Math.floor(len / step));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    colliders.push({
      id: `${prefix}-${i}`,
      x: lerp(x1, x2, t),
      z: lerp(z1, z2, t),
      minY: baseY - 0.5,
      maxY: baseY + (kind === 'tirewall' ? 1.55 : 1.35),
      halfW: kind === 'tirewall' ? 0.9 : 0.55,
      halfL: step * 0.48,
      yaw,
      kind,
    });
  }
}

function buildMapWorldData(mapId: MapId): MapWorldData {
  const config = MAPS[mapId];
  const roadPoints = sampleSpline(config.circuitControlPoints, true, 20);
  const trailPoints = sampleSpline(config.trailControlPoints, false, 14);
  const westPassPoints = sampleSpline(WEST_PASS_CONTROL_POINTS, false, 16);
  const eastPassPoints = sampleSpline(EAST_PASS_CONTROL_POINTS, false, 16);
  const losSantosRoads = LOS_SANTOS_ARTERIALS.map((pts) => sampleSpline(pts, false, 16));

  const p0 = roadPoints[0];
  const p1 = roadPoints[1];
  const startYaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);

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

  // Detailed Stunt Ramps in both Wildlands & Los Santos!
  const ramps: StuntRamp[] = [
    // Wildlands Stunt Ramps
    { id: `${mapId}-ramp-1`, x: 45, z: 95, yaw: 0.45, width: 10.5, length: 19, height: 4.5, style: 'circuit' },
    { id: `${mapId}-ramp-2`, x: -135, z: 80, yaw: -0.85, width: 10.5, length: 19, height: 4.1, style: 'circuit' },
    { id: `${mapId}-ramp-3`, x: 245, z: -40, yaw: 0.15, width: 10.5, length: 20, height: 4.8, style: 'truss' },
    { id: `${mapId}-ramp-4`, x: -10, z: -155, yaw: 1.9, width: 10.5, length: 18, height: 4.2, style: 'circuit' },
    // Mountain Pass Vista Jump
    { id: `${mapId}-ramp-pass`, x: -292, z: -860, yaw: Math.PI, width: 11, length: 22, height: 5.0, style: 'truss' },
    // Downtown Legion Square Mega Ramp
    { id: `${mapId}-ramp-dt1`, x: -55, z: -1780, yaw: Math.PI, width: 12, length: 24, height: 5.8, style: 'truss' },
    // LS River Storm Canal Gap Jump & Bank Launchers
    { id: `${mapId}-ramp-canal1`, x: 580, z: -1620, yaw: Math.PI, width: 12, length: 22, height: 5.5, style: 'concrete' },
    { id: `${mapId}-ramp-canal2`, x: 580, z: -2020, yaw: 0, width: 12, length: 22, height: 5.5, style: 'concrete' },
    // La Mesa Container Yard Twin Stunt Ramps
    { id: `${mapId}-ramp-lamesa1`, x: 780, z: -1660, yaw: Math.PI, width: 11, length: 22, height: 5.6, style: 'container' },
    { id: `${mapId}-ramp-lamesa2`, x: 780, z: -1760, yaw: 0, width: 11, length: 22, height: 5.6, style: 'container' },
    // Vespucci Beach Pier Surf Jump
    { id: `${mapId}-ramp-beach`, x: -965, z: -1660, yaw: -Math.PI * 0.5, width: 10, length: 18, height: 4.4, style: 'truss' },
    // Vinewood Hills Overlook Jump
    { id: `${mapId}-ramp-vw`, x: -120, z: -2480, yaw: 0, width: 11, length: 21, height: 5.4, style: 'truss' },
  ];

  // Solid Elevated Decks (Olympic Freeway Viaduct + Sloped On-Ramps, Del Perro Pier, Canal Steel Bridges, Container Deck)
  const elevatedDecks: ElevatedDeck[] = [
    // Olympic Freeway Elevated Viaduct (East-West spanning x: -640 .. +640 at z = -1360, y = 12.6m)
    {
      id: 'olympic-viaduct-main',
      x: 0,
      z: -1360,
      y: 12.6,
      halfW: 11,
      halfL: 560,
      yaw: Math.PI / 2,
      thickness: 1.4,
      surface: 'asphalt',
      biome: 'Olympic Freeway',
      kind: 'freeway',
    },
    // West Olympic On-Ramp (ground y=3.6 -> deck y=12.6, x: -720 .. -560)
    {
      id: 'olympic-onramp-west',
      x: -640,
      z: -1360,
      y: 8.1,
      halfW: 9.5,
      halfL: 82,
      yaw: Math.PI / 2,
      thickness: 1.2,
      surface: 'asphalt',
      biome: 'Olympic Freeway',
      kind: 'overpass',
      slopeStartY: 3.55,
      slopeEndY: 12.6,
    },
    // East Olympic On-Ramp (ground y=3.6 -> deck y=12.6, x: +560 .. +720)
    {
      id: 'olympic-onramp-east',
      x: 640,
      z: -1360,
      y: 8.1,
      halfW: 9.5,
      halfL: 82,
      yaw: -Math.PI / 2,
      thickness: 1.2,
      surface: 'asphalt',
      biome: 'Olympic Freeway',
      kind: 'overpass',
      slopeStartY: 3.55,
      slopeEndY: 12.6,
    },
    // Del Perro Wooden Pier (Vespucci Beach out over the Pacific Ocean!)
    {
      id: 'del-perro-pier-ramp',
      x: -955,
      z: -1820,
      y: 3.2,
      halfW: 11,
      halfL: 28,
      yaw: -Math.PI / 2,
      thickness: 0.9,
      surface: 'wood',
      biome: 'Del Perro Pier',
      kind: 'pier',
      slopeStartY: 1.1,
      slopeEndY: 4.2,
    },
    {
      id: 'del-perro-pier-deck',
      x: -1095,
      z: -1820,
      y: 4.2,
      halfW: 14,
      halfL: 115,
      yaw: -Math.PI / 2,
      thickness: 1.1,
      surface: 'wood',
      biome: 'Del Perro Pier',
      kind: 'pier',
    },
    // Steel Arch Bridges over the LS Storm Canal (Olympic Blvd & Central Ave)
    {
      id: 'canal-bridge-south',
      x: 580,
      z: -1460,
      y: 4.1,
      halfW: 11,
      halfL: 58,
      yaw: Math.PI / 2,
      thickness: 1.1,
      surface: 'asphalt',
      biome: 'LS Storm Canal',
      kind: 'bridge',
    },
    {
      id: 'canal-bridge-mid',
      x: 580,
      z: -1840,
      y: 4.1,
      halfW: 11,
      halfL: 58,
      yaw: Math.PI / 2,
      thickness: 1.1,
      surface: 'asphalt',
      biome: 'LS Storm Canal',
      kind: 'bridge',
    },
    {
      id: 'canal-bridge-north',
      x: 580,
      z: -2240,
      y: 4.1,
      halfW: 11,
      halfL: 58,
      yaw: Math.PI / 2,
      thickness: 1.1,
      surface: 'asphalt',
      biome: 'LS Storm Canal',
      kind: 'bridge',
    },
    // La Mesa Stunt Park Elevated Container Bridge Deck (connects twin container ramps)
    {
      id: 'lamesa-stunt-bridge',
      x: 780,
      z: -1710,
      y: 6.4,
      halfW: 6.5,
      halfL: 24,
      yaw: 0,
      thickness: 0.9,
      surface: 'concrete',
      biome: 'La Mesa Industrial',
      kind: 'platform',
    },
  ];

  // Los Santos Architectural Buildings (Downtown Skyscrapers, Maze Bank Spire, Mansions, Warehouses, Beach Towers)
  const buildings: BuildingSpec[] = [
    // Iconic Maze Bank Tower (Downtown Core Centerpiece)
    {
      id: 'ls-mazebank',
      x: -75,
      z: -1940,
      baseY: 3.6,
      width: 56,
      depth: 56,
      height: 175,
      yaw: 0,
      style: 'mazebank',
      colorHex: 0xdbeafe,
      accentHex: 0xef4444,
    },
    // Downtown Pillbox Hill Skyscrapers (placed neatly in city blocks between avenues)
    { id: 'ls-dt-1', x: -160, z: -1650, baseY: 3.6, width: 46, depth: 46, height: 118, yaw: 0, style: 'skyscraper', colorHex: 0x334155, accentHex: 0x38bdf8 },
    { id: 'ls-dt-2', x: -290, z: -1660, baseY: 3.6, width: 42, depth: 52, height: 92, yaw: 0, style: 'tower', colorHex: 0x475569, accentHex: 0xf59e0b },
    { id: 'ls-dt-3', x: 155, z: -1645, baseY: 3.6, width: 48, depth: 46, height: 132, yaw: 0, style: 'skyscraper', colorHex: 0x1e293b, accentHex: 0x22d3ee },
    { id: 'ls-dt-4', x: 270, z: -1670, baseY: 3.6, width: 40, depth: 44, height: 84, yaw: 0, style: 'tower', colorHex: 0x64748b, accentHex: 0xfbbf24 },
    { id: 'ls-dt-5', x: 165, z: -2010, baseY: 3.6, width: 52, depth: 48, height: 145, yaw: 0, style: 'skyscraper', colorHex: 0x0f172a, accentHex: 0xf43f5e },
    { id: 'ls-dt-6', x: 275, z: -2030, baseY: 3.6, width: 44, depth: 40, height: 76, yaw: 0, style: 'commercial', colorHex: 0x475569, accentHex: 0x34d399 },
    { id: 'ls-dt-7', x: -245, z: -2040, baseY: 3.6, width: 48, depth: 46, height: 110, yaw: 0, style: 'skyscraper', colorHex: 0x334155, accentHex: 0xa855f7 },
    { id: 'ls-dt-8', x: -135, z: -2135, baseY: 3.6, width: 38, depth: 36, height: 64, yaw: 0, style: 'commercial', colorHex: 0x64748b, accentHex: 0x38bdf8 },
    { id: 'ls-dt-9', x: 135, z: -2140, baseY: 3.6, width: 42, depth: 36, height: 68, yaw: 0, style: 'commercial', colorHex: 0x334155, accentHex: 0xf97316 },
    { id: 'ls-dt-10', x: -580, z: -1640, baseY: 3.6, width: 44, depth: 42, height: 52, yaw: 0, style: 'commercial', colorHex: 0x475569, accentHex: 0xfbbf24 },
    { id: 'ls-dt-11', x: -595, z: -2030, baseY: 3.6, width: 46, depth: 44, height: 58, yaw: 0, style: 'tower', colorHex: 0x64748b, accentHex: 0x14b8a6 },
    // La Mesa Industrial Warehouses
    { id: 'ls-ind-1', x: 760, z: -1960, baseY: 3.6, width: 52, depth: 34, height: 16, yaw: 0, style: 'warehouse', colorHex: 0x475569, accentHex: 0xf97316 },
    { id: 'ls-ind-2', x: 860, z: -1580, baseY: 3.6, width: 48, depth: 32, height: 15, yaw: 0.2, style: 'warehouse', colorHex: 0x334155, accentHex: 0xeab308 },
    { id: 'ls-ind-3', x: 850, z: -2180, baseY: 3.6, width: 54, depth: 36, height: 18, yaw: -0.1, style: 'warehouse', colorHex: 0x3f3f46, accentHex: 0x38bdf8 },
    // Vespucci Beachfront Shops & Lifeguard Towers
    { id: 'ls-ves-1', x: -810, z: -1620, baseY: 3.2, width: 32, depth: 24, height: 14, yaw: 0, style: 'commercial', colorHex: 0xfef3c7, accentHex: 0xf43f5e },
    { id: 'ls-ves-2', x: -810, z: -2040, baseY: 3.2, width: 34, depth: 26, height: 16, yaw: 0, style: 'commercial', colorHex: 0xe0f2fe, accentHex: 0x14b8a6 },
    { id: 'ls-ves-lg1', x: -990, z: -1550, baseY: 0.8, width: 5, depth: 5, height: 6.5, yaw: -0.2, style: 'lifeguard', colorHex: 0xfef9c3, accentHex: 0xef4444 },
    { id: 'ls-ves-lg2', x: -995, z: -2080, baseY: 0.8, width: 5, depth: 5, height: 6.5, yaw: 0.15, style: 'lifeguard', colorHex: 0xfef9c3, accentHex: 0xef4444 },
    // Vinewood Hills Luxury Mansions
    { id: 'ls-vw-1', x: -340, z: -2640, baseY: 22, width: 32, depth: 22, height: 10, yaw: 0.25, style: 'mansion', colorHex: 0xf8fafc, accentHex: 0xf59e0b },
    { id: 'ls-vw-2', x: 240, z: -2650, baseY: 22, width: 34, depth: 24, height: 11, yaw: -0.3, style: 'mansion', colorHex: 0xf1f5f9, accentHex: 0x38bdf8 },
  ];

  // Solid Colliders derived from buildings, barricades, tire walls, and overpass piers
  const colliders: BoxCollider[] = [];
  for (const b of buildings) {
    colliders.push({
      id: `col-${b.id}`,
      x: b.x,
      z: b.z,
      minY: b.baseY - 2,
      maxY: b.baseY + b.height,
      halfW: b.width * 0.5,
      halfL: b.depth * 0.5,
      yaw: b.yaw,
      kind: 'building',
    });
  }

  // Track Start/Finish Pit Wall & Grandstand Solid Colliders
  const fSin = Math.sin(startYaw);
  const fCos = Math.cos(startYaw);
  const rX = -fCos;
  const rZ = fSin;
  const rwHalf = config.roadWidth * 0.5;
  colliders.push({
    id: `${mapId}-pitwall`,
    x: p0.x + rX * -(rwHalf + 1.8) + fSin * -18,
    z: p0.z + rZ * -(rwHalf + 1.8) + fCos * -18,
    minY: -5,
    maxY: 12,
    halfW: 0.8,
    halfL: 34,
    yaw: startYaw,
    kind: 'barricade',
  });
  colliders.push({
    id: `${mapId}-grandstand`,
    x: p0.x + rX * (rwHalf + 10.5) + fSin * -18,
    z: p0.z + rZ * (rwHalf + 10.5) + fCos * -18,
    minY: -5,
    maxY: 16,
    halfW: 5.5,
    halfL: 27,
    yaw: startYaw,
    kind: 'grandstand',
  });

  const roadGrid = buildPolylineGrid([{ pts: roadPoints, closed: true }], config.roadWidth * 0.5 + 30);
  const passGrid = buildPolylineGrid(
    [
      { pts: westPassPoints, closed: false },
      { pts: eastPassPoints, closed: false },
    ],
    48,
  );
  const cityRoadGrid = buildPolylineGrid(
    losSantosRoads.map((pts) => ({ pts, closed: false })),
    48,
  );
  const trailGrid = buildPolylineGrid([{ pts: trailPoints, closed: false }], 14);

  // Circuit Corner Concrete Jersey Barricades & Tire Walls (always leave highway & trail junctions clear)
  for (let i = 0; i < roadPoints.length; i += 2) {
    const prev = roadPoints[(i - 1 + roadPoints.length) % roadPoints.length];
    const curr = roadPoints[i];
    const next = roadPoints[(i + 1) % roadPoints.length];
    const yaw1 = Math.atan2(curr.x - prev.x, curr.z - prev.z);
    const yaw2 = Math.atan2(next.x - curr.x, next.z - curr.z);
    let dYaw = yaw2 - yaw1;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;

    if (Math.abs(dYaw) > 0.085) {
      const side = dYaw > 0 ? 1 : -1;
      const tx = next.x - prev.x;
      const tz = next.z - prev.z;
      const tLen = Math.hypot(tx, tz) || 1;
      const nx = (-tz / tLen) * side;
      const nz = (tx / tLen) * side;
      const bx = curr.x + nx * (rwHalf + 1.5);
      const bz = curr.z + nz * (rwHalf + 1.5);
      const trailStart = config.trailControlPoints[0];
      if (
        distanceToPolylineGrid(bx, bz, passGrid) < 25 ||
        distanceToPolylineGrid(bx, bz, cityRoadGrid) < 25 ||
        distanceToPolylineGrid(bx, bz, trailGrid) < 12 ||
        (trailStart && Math.hypot(bx - trailStart.x, bz - trailStart.z) < 28)
      ) {
        continue;
      }
      colliders.push({
        id: `${mapId}-barrier-${i}`,
        x: bx,
        z: bz,
        minY: -10,
        maxY: 40,
        halfW: 0.65,
        halfL: 3.1,
        yaw: Math.atan2(tx, tz),
        kind: Math.abs(dYaw) > 0.14 ? 'tirewall' : 'barricade',
      });
    }
  }

  // Concrete Jersey Barricades lining Olympic Freeway Viaduct & Del Perro Pier
  addBarricadeRow(colliders, -555, -1371.2, 555, -1371.2, 9.5, 'barricade', 12.6, 'viaduct-s');
  addBarricadeRow(colliders, -555, -1348.8, 555, -1348.8, 9.5, 'barricade', 12.6, 'viaduct-n');
  addBarricadeRow(colliders, -985, -1834.5, -1205, -1834.5, 8.5, 'barricade', 4.2, 'pier-s');
  addBarricadeRow(colliders, -985, -1805.5, -1205, -1805.5, 8.5, 'barricade', 4.2, 'pier-n');

  // La Mesa Stunt Yard Stacked Shipping Containers (solid colliders!)
  const containerDefs = [
    { id: 'c1', x: 745, z: -1710, y: 3.6, w: 3.2, l: 12, h: 3.2, yaw: 0 },
    { id: 'c2', x: 815, z: -1710, y: 3.6, w: 3.2, l: 12, h: 3.2, yaw: 0 },
    { id: 'c3', x: 730, z: -1800, y: 3.6, w: 3.2, l: 12, h: 5.8, yaw: 0.35 },
    { id: 'c4', x: 830, z: -1620, y: 3.6, w: 3.2, l: 12, h: 5.8, yaw: -0.25 },
  ];
  for (const c of containerDefs) {
    colliders.push({
      id: `col-${c.id}`,
      x: c.x,
      z: c.z,
      minY: c.y - 1,
      maxY: c.y + c.h,
      halfW: c.w * 0.5,
      halfL: c.l * 0.5,
      yaw: c.yaw,
      kind: 'container',
    });
  }

  // 10 Exploration Beacons spanning Wildlands, Mountain Passes, and Los Santos Districts
  const beacons: ExplorationBeacon[] = [
    { id: `${mapId}-b1`, name: 'Grand Straight Overlook', biome: config.name, x: 335, z: 160, radius: 16 },
    { id: `${mapId}-b2`, name: 'Valley Basin Shore', biome: config.name, x: -75, z: -45, radius: 16 },
    { id: `${mapId}-b3`, name: 'Wildwood Trailhead', biome: config.name, x: -420, z: -310, radius: 16 },
    { id: `${mapId}-b4`, name: 'West Divide Summit Pass', biome: 'Great Divide Pass', x: -290, z: -830, radius: 18 },
    { id: `${mapId}-b5`, name: 'East Divide Canyon Pass', biome: 'Great Divide Pass', x: 335, z: -855, radius: 18 },
    { id: `${mapId}-b6`, name: 'Maze Bank Spire Plaza', biome: 'Downtown Los Santos', x: 0, z: -1900, radius: 22 },
    { id: `${mapId}-b7`, name: 'Olympic Elevated Freeway', biome: 'Olympic Freeway', x: 0, z: -1360, radius: 20 },
    { id: `${mapId}-b8`, name: 'Del Perro Pier Ferris Wheel', biome: 'Del Perro Pier', x: -1150, z: -1820, radius: 20 },
    { id: `${mapId}-b9`, name: 'Vinewood Sign Crest', biome: 'Vinewood Hills', x: -100, z: -2820, radius: 24 },
    { id: `${mapId}-b10`, name: 'La Mesa LS Storm Canal', biome: 'LS Storm Canal', x: 580, z: -1780, radius: 20 },
  ];

  const windTurbines = [
    { x: -240, z: 350 },
    { x: -195, z: 385 },
    { x: 280, z: 340 },
    { x: 335, z: 315 },
    { x: 470, z: 80 },
    { x: -510, z: -690 },
    { x: -570, z: -760 },
    { x: 560, z: -720 },
  ];

  const watchtowers = [
    { x: -380, z: -165 },
    { x: 235, z: -265 },
    { x: -195, z: 120 },
    { x: -165, z: -920 },
  ];

  const partial: MapWorldData = {
    id: mapId,
    config,
    roadPoints,
    trailPoints,
    westPassPoints,
    eastPassPoints,
    losSantosRoads,
    roadGrid,
    passGrid,
    cityRoadGrid,
    trailGrid,
    startPose: { x: p0.x, z: p0.z, yaw: startYaw },
    checkpoints,
    ramps,
    elevatedDecks,
    buildings,
    colliders,
    beacons,
    coins: [],
    obstacles: [],
    windTurbines,
    watchtowers,
  };
  _worldCache.set(mapId, partial);

  // Generate rich trees & boulders in Wildlands, Mountain Passes, Vinewood Hills, and Palm-lined Vespucci / Downtown
  const obstacles: WorldObstacle[] = [];
  let nextId = 1;
  let seed = mapId === 'valley' ? 918273 : mapId === 'canyon' ? 441122 : mapId === 'alpine' ? 773311 : 558899;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const roadClearanceHalf = config.roadWidth * 0.5 + 6.5;
  const trailClearanceHalf = 6.8;

  const isInsideBuildingOrRamp = (x: number, z: number) => {
    for (const b of beacons) {
      if (Math.hypot(x - b.x, z - b.z) < 16) return true;
    }
    for (const r of ramps) {
      if (Math.hypot(x - r.x, z - r.z) < 20) return true;
    }
    for (const b of buildings) {
      if (Math.abs(x - b.x) < b.width * 0.5 + 6 && Math.abs(z - b.z) < b.depth * 0.5 + 6) {
        return true;
      }
    }
    if (z < -1280 && Math.abs(z + 1360) < 26 && Math.abs(x) < 740) return true;
    if (Math.abs(z + 1820) < 35 && x < -860) return true; // Keep Del Perro Pier entrance clear
    if (Math.hypot(x - 780, z + 1710) < 90) return true;
    return false;
  };

  // 1) Wildlands + Mountain Pass Flora & Boulders (1,150 items)
  for (let i = 0; i < 2400 && obstacles.length < 1150; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = 32 + Math.sqrt(rand()) * 1120;
    const x = Math.cos(angle) * rad;
    const z = Math.sin(angle) * rad - 220;

    if (z < -1180) continue; // Handled by Los Santos District scatter
    if (Math.hypot(x - p0.x, z - p0.z) < 42) continue;
    if (isInsideBuildingOrRamp(x, z)) continue;

    if (distanceToPolylineGrid(x, z, roadGrid) < roadClearanceHalf) continue;
    if (distanceToPolylineGrid(x, z, passGrid) < 25.5) continue;
    if (distanceToPolylineGrid(x, z, cityRoadGrid) < 26.5) continue;
    if (distanceToPolylineGrid(x, z, trailGrid) < trailClearanceHalf) continue;

    const sample = getTerrainSample(x, z, mapId);
    if (sample.waterDepth > 0 || sample.surface === 'water') continue;

    const isBoulderZone =
      mapId === 'canyon' ||
      sample.slope > 0.34 ||
      sample.surface === 'rock' ||
      sample.height > 32 ||
      rand() < 0.24;

    if (!isBoulderZone && sample.slope <= 0.32 && sample.surface !== 'sand') {
      const groveNoise = fbm2D(x * 0.011 + 1.5, z * 0.011 - 2.3, 2);
      if (sample.surface === 'grass' && groveNoise < 0.02 && rand() > 0.28) continue;

      let kind: WorldObstacle['kind'] = 'pine';
      if (mapId === 'alpine' || sample.height > 20) {
        kind = rand() < 0.72 ? 'snowPine' : 'pine';
      } else if (mapId === 'coast') {
        kind = rand() < 0.55 ? 'palm' : 'oak';
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
    } else if (rand() < 0.56) {
      const scale = 0.8 + rand() * 2.2;
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

  // 2) Los Santos Urban Palms, Vinewood Pines/Oaks, and Hillside Boulders (~480 items)
  for (let i = 0; i < 1400 && obstacles.length < 1630; i++) {
    const x = -1120 + rand() * 2240;
    const z = -1240 - rand() * 1720;
    if (isInsideBuildingOrRamp(x, z)) continue;
    if (distanceToPolylineGrid(x, z, passGrid) < 25.5) continue;
    if (distanceToPolylineGrid(x, z, cityRoadGrid) < 26.5) continue;
    // Keep Storm Canal bed clear
    if (Math.abs(x - (580 + Math.sin(z * 0.004) * 38)) < 36 && z > -2500) continue;

    const sample = getTerrainSample(x, z, mapId);
    if (sample.waterDepth > 0 || sample.surface === 'water') continue;

    if (z < -2380) {
      // Vinewood Hills foliage & rocks
      if (sample.slope < 0.34) {
        const kind: WorldObstacle['kind'] = rand() < 0.45 ? 'cypress' : rand() < 0.7 ? 'oak' : 'pine';
        const scale = 0.9 + rand() * 0.55;
        obstacles.push({
          id: nextId++,
          x,
          z,
          y: sample.height,
          radius: 0.95 * scale,
          height: 11 * scale,
          kind,
        });
      } else if (rand() < 0.45) {
        obstacles.push({
          id: nextId++,
          x,
          z,
          y: sample.height,
          radius: 1.9,
          height: 2.8,
          kind: 'boulder',
        });
      }
    } else if (x < -760 || Math.abs(x) < 420) {
      // Vespucci & Downtown California Palm Trees
      const scale = 0.95 + rand() * 0.45;
      obstacles.push({
        id: nextId++,
        x,
        z,
        y: sample.height,
        radius: 0.65,
        height: 13.5 * scale,
        kind: 'palm',
      });
    }
  }

  // 3) Boulevard California Palm rows along Vespucci & Central Alta St
  for (let z = -1380; z >= -2260; z -= 42) {
    for (const px of [-946, -894, -25, 25]) {
      if (distanceToPolylineGrid(px, z, cityRoadGrid) < 23.8 || isInsideBuildingOrRamp(px, z)) continue;
      const py = groundHeightAt(px, z, mapId);
      obstacles.push({
        id: nextId++,
        x: px,
        z,
        y: py,
        radius: 0.6,
        height: 13.5,
        kind: 'palm',
      });
    }
  }

  partial.obstacles = obstacles;

  // Generate 75 Collectible Gold Coins across Wildlands Circuit, Passes, AND Los Santos!
  const coins: CoinSpawn[] = [];
  for (let c = 0; c < 20; c++) {
    const idx = (3 + Math.floor((c / 20) * (roadPoints.length - 6))) % roadPoints.length;
    const pt = roadPoints[idx];
    const nextPt = roadPoints[(idx + 1) % roadPoints.length];
    const tx = nextPt.x - pt.x;
    const tz = nextPt.z - pt.z;
    const tLen = Math.hypot(tx, tz) || 1;
    const nx = -tz / tLen;
    const nz = tx / tLen;
    const laneShift = ((c % 3) - 1) * 3.0;
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
  for (let t = 0; t < 10; t++) {
    const idx = Math.min(trailPoints.length - 1, Math.floor(((t + 0.5) / 10) * trailPoints.length));
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
    const dist = r.length * 0.5 + 7.5;
    const cx = r.x + fwdX * dist;
    const cz = r.z + fwdZ * dist;
    const baseH = groundHeightAt(cx, cz, mapId);
    coins.push({
      id: `${mapId}-coin-j-${rIdx}`,
      x: cx,
      z: cz,
      y: baseH + r.height + 1.35,
      value: 25,
    });
  }
  // Mountain Pass & Los Santos Bonus Coins
  const lsCoinSpots: Array<[number, number, number]> = [
    [-292, -610, 20],
    [-260, -830, 25],
    [360, -760, 25],
    [0, -1360, 30], // On Olympic Freeway deck!
    [-380, -1360, 25],
    [380, -1360, 25],
    [0, -1620, 20],
    [0, -1940, 25],
    [-920, -1820, 20],
    [-1120, -1820, 30], // Del Perro Pier!
    [580, -1680, 25], // LS Storm Canal!
    [580, -1950, 25],
    [-120, -2860, 35], // Vinewood Sign!
  ];
  lsCoinSpots.forEach(([cx, cz, val], idx) => {
    const deckH = getDrivableSurfaceHeight(cx, cz, 20, mapId).height;
    coins.push({
      id: `${mapId}-coin-ls-${idx}`,
      x: cx,
      z: cz,
      y: deckH + 1.15,
      value: val,
    });
  });

  partial.coins = coins;
  return partial;
}

export function getMapWorldData(mapId: MapId = 'valley'): MapWorldData {
  const cached = _worldCache.get(mapId);
  if (cached) return cached;
  return buildMapWorldData(mapId);
}

function rampSurfaceAt(
  x: number,
  z: number,
  ramps: StuntRamp[],
  baseTerrainH: number,
): { offset: number; onRamp: boolean } {
  let maxH = 0;
  let onRamp = false;
  for (let i = 0; i < ramps.length; i++) {
    const r = ramps[i];
    const dx = x - r.x;
    const dz = z - r.z;
    const cos = Math.cos(r.yaw);
    const sin = Math.sin(r.yaw);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const halfW = r.width * 0.5 + 0.15;
    const halfL = r.length * 0.5;
    if (Math.abs(lx) <= halfW && Math.abs(lz) <= halfL) {
      const t = clamp((lz + halfL) / r.length, 0, 1);
      const h = (r.baseYOffset ?? 0) + r.height * Math.pow(t, 1.38);
      if (h >= maxH) {
        maxH = h;
        onRamp = true;
      }
    }
  }
  void baseTerrainH;
  return { offset: maxH, onRamp };
}

function sampleElevatedDeck(
  x: number,
  z: number,
  decks: ElevatedDeck[],
  carY: number | undefined,
): { height: number; surface: SurfaceType; biome: BiomeName } | null {
  let best: { height: number; surface: SurfaceType; biome: BiomeName } | null = null;
  for (let i = 0; i < decks.length; i++) {
    const d = decks[i];
    const dx = x - d.x;
    const dz = z - d.z;
    const cos = Math.cos(d.yaw);
    const sin = Math.sin(d.yaw);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= d.halfW && Math.abs(lz) <= d.halfL) {
      let deckTopY = d.y;
      if (d.slopeStartY !== undefined && d.slopeEndY !== undefined) {
        const t = clamp((lz + d.halfL) / (d.halfL * 2), 0, 1);
        deckTopY = lerp(d.slopeStartY, d.slopeEndY, t);
      }
      // If carY is specified, allow driving under high overpasses if car is clearly below the slab
      if (carY === undefined || carY >= deckTopY - 2.35) {
        if (!best || deckTopY > best.height) {
          best = { height: deckTopY, surface: d.surface, biome: d.biome };
        }
      }
    }
  }
  return best;
}

export function getTerrainHeightAndFactors(
  x: number,
  z: number,
  mapId: MapId = 'valley',
): {
  height: number;
  roadFactor: number;
  trailFactor: number;
  cityRoadFactor: number;
  passFactor: number;
} {
  const data = getMapWorldData(mapId);
  const config = data.config;
  const halfW = config.roadWidth * 0.5;
  const trailHalfW = 4.2;

  const rawH = baseNaturalElevation(x, z, mapId);

  const roadDist = distanceToPolylineGrid(x, z, data.roadGrid);
  const roadBlend = roadDist < halfW + 24.0 ? 1 - smoothstepRange(halfW - 1.0, halfW + 24.0, roadDist) : 0;
  const roadFactor = roadDist < halfW + 0.8 ? 1 - smoothstepRange(halfW - 1.0, halfW + 0.8, roadDist) : 0;

  const passDist = distanceToPolylineGrid(x, z, data.passGrid);
  const passBlend = passDist < 44.0 ? 1 - smoothstepRange(17.5, 44.0, passDist) : 0;
  const passFactor = passDist < 19.2 ? 1 - smoothstepRange(17.0, 19.2, passDist) : 0;

  const cityDist = distanceToPolylineGrid(x, z, data.cityRoadGrid);
  const cityBlend = cityDist < 42.0 ? 1 - smoothstepRange(18.5, 42.0, cityDist) : 0;
  const cityRoadFactor = cityDist < 20.5 ? 1 - smoothstepRange(18.0, 20.5, cityDist) : 0;

  const trailDist = distanceToPolylineGrid(x, z, data.trailGrid);
  const trailBlend = trailDist < trailHalfW + 6.5 ? 1 - smoothstepRange(trailHalfW - 0.8, trailHalfW + 6.5, trailDist) : 0;
  const trailFactor = trailDist < trailHalfW + 1.0 ? 1 - smoothstepRange(trailHalfW - 0.6, trailHalfW + 1.0, trailDist) : 0;

  let h = rawH;

  // Circuit road leveling — gentle raised embankment above flat 3.5m plane so terrain triangles never bury the road
  if (roadBlend > 0.001) {
    const hillWave = fbm2D(x * 0.0022 + 3.1, z * 0.0022 - 1.7, 2) * 0.5 + 0.5;
    const smoothRoadBase =
      mapId === 'alpine' ? 4.6 + hillWave * 9.5 : 3.65 + hillWave * 4.2;
    const bridgeFloor = Math.max(smoothRoadBase, rawH + 0.15, config.waterLevel + 2.2);
    h = lerp(h, bridgeFloor, roadBlend * 0.96);
  }

  // Great Divide Mountain Pass Highway Corridor leveling
  if (passBlend > 0.001) {
    const passSummitCurve = Math.exp(-Math.pow((z + 820) / 340, 2)) * 22.0;
    const passTarget = Math.max(3.65, 3.65 + passSummitCurve + fbm2D(x * 0.0015, z * 0.0015, 2) * 2.0);
    h = lerp(h, passTarget, passBlend * 0.96);
  }

  // Wide Arterial Network leveling (Wildlands Expressways -> Great Divide Pass -> Los Santos -> Vinewood Climb)
  if (cityBlend > 0.001) {
    let targetBase = 3.65;
    if (z <= -1180) {
      const vinewoodClimb = smoothstepRange(-2260, -2740, z);
      targetBase =
        3.55 +
        vinewoodClimb *
          (18.0 + Math.sin(x * 0.003) * 3.5 + smoothstepRange(-2540, -2920, z) * 10.0);
    } else if (z < -480) {
      const passSummitCurve = Math.exp(-Math.pow((z + 820) / 340, 2)) * 22.0;
      targetBase = Math.max(3.65, 3.65 + passSummitCurve + fbm2D(x * 0.0015, z * 0.0015, 2) * 2.0);
    } else {
      targetBase = Math.max(h, 3.65);
    }
    h = lerp(h, targetBase, cityBlend * 0.95);
  }

  if (trailBlend > 0.001 && roadFactor < 0.5 && passFactor < 0.5) {
    const smoothTrailBase = Math.max(rawH, config.waterLevel + 1.1);
    h = lerp(h, smoothTrailBase, trailBlend * 0.45);
  }

  const asphaltBoost = Math.max(roadFactor, passFactor, cityRoadFactor);
  h += asphaltBoost * 0.22 + trailFactor * 0.12;

  return { height: h, roadFactor: asphaltBoost, trailFactor, cityRoadFactor, passFactor };
}

export function groundHeightAt(
  x: number,
  z: number,
  mapId: MapId = 'valley',
  includeRamps = true,
): number {
  const base = getTerrainHeightAndFactors(x, z, mapId).height;
  if (!includeRamps) return base;
  const data = getMapWorldData(mapId);
  const ramp = rampSurfaceAt(x, z, data.ramps, base);
  return base + ramp.offset;
}

export function getDrivableSurfaceHeight(
  x: number,
  z: number,
  carY: number | undefined,
  mapId: MapId = 'valley',
  precomputedBaseH?: number,
): { height: number; deckSurface: SurfaceType | null; deckBiome: BiomeName | null; onRamp: boolean } {
  const data = getMapWorldData(mapId);
  const base = precomputedBaseH ?? getTerrainHeightAndFactors(x, z, mapId).height;
  const ramp = rampSurfaceAt(x, z, data.ramps, base);
  let bestH = base + ramp.offset;
  let deckSurface: SurfaceType | null = ramp.onRamp ? 'concrete' : null;
  let deckBiome: BiomeName | null = null;

  const deck = sampleElevatedDeck(x, z, data.elevatedDecks, carY);
  if (deck && deck.height >= bestH - 0.1) {
    bestH = deck.height;
    deckSurface = deck.surface;
    deckBiome = deck.biome;
  }

  return { height: bestH, deckSurface, deckBiome, onRamp: ramp.onRamp };
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
  const waterLevel = z < -1180 ? -2.0 : config.waterLevel;
  const waterDepth = Math.max(0, waterLevel - height);

  // Los Santos District Biomes (North of Mountain Pass z < -1160)
  if (z < -1140) {
    const canalCenter = 580 + Math.sin(z * 0.004) * 38;
    const inCanal = Math.abs(x - canalCenter) < 38 && z < -1240 && z > -2520;
    if (roadFactor > 0.45) {
      if (z <= -2220) return { surface: 'asphalt', biome: 'Vinewood Hills', waterDepth: 0 };
      if (x < -760) return { surface: 'asphalt', biome: 'Vespucci Beach', waterDepth: 0 };
      if (x > 460) return { surface: 'asphalt', biome: 'La Mesa Industrial', waterDepth: 0 };
      return { surface: 'asphalt', biome: 'Downtown Los Santos', waterDepth: 0 };
    }
    if (inCanal) {
      return { surface: 'concrete', biome: 'LS Storm Canal', waterDepth: 0 };
    }
    if (waterDepth > 0.14) {
      return { surface: 'water', biome: 'Vespucci Beach', waterDepth };
    }
    if (x < -760 && z > -2550) {
      return { surface: 'sand', biome: 'Vespucci Beach', waterDepth: 0 };
    }
    if (z <= -2220) {
      return {
        surface: slope > 0.35 ? 'rock' : 'grass',
        biome: 'Vinewood Hills',
        waterDepth: 0,
      };
    }
    if (x > 450) {
      return { surface: 'concrete', biome: 'La Mesa Industrial', waterDepth: 0 };
    }
    return { surface: 'concrete', biome: 'Downtown Los Santos', waterDepth: 0 };
  }

  // Great Divide Mountain Passes (z between -520 and -1140)
  if (z < -520) {
    if (roadFactor > 0.45) {
      return { surface: 'asphalt', biome: 'Great Divide Pass', waterDepth: 0 };
    }
    if (slope > 0.34 || height > 26) {
      return { surface: height > 52 ? 'snow' : 'rock', biome: 'Great Divide Pass', waterDepth: 0 };
    }
    return { surface: 'forest', biome: 'Great Divide Pass', waterDepth: 0 };
  }

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
  if (height < waterLevel + 1.1 && Math.hypot(x, z) < 550) {
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

export function getFastGroundSample(
  x: number,
  z: number,
  mapId: MapId = 'valley',
  carY?: number,
): { height: number; surface: SurfaceType; biome: BiomeName } {
  const centerFactors = getTerrainHeightAndFactors(x, z, mapId);
  const centerStruct = getDrivableSurfaceHeight(x, z, carY, mapId, centerFactors.height);
  const classified = classifyBiomeAndSurface(
    x,
    z,
    centerStruct.height,
    0,
    centerFactors.roadFactor,
    centerFactors.trailFactor,
    mapId,
  );
  return {
    height: centerStruct.height,
    surface: centerStruct.deckSurface ?? classified.surface,
    biome: centerStruct.deckBiome ?? classified.biome,
  };
}

export function getTerrainSample(
  x: number,
  z: number,
  mapId: MapId = 'valley',
  carY?: number,
): TerrainSample {
  const eps = 0.85;
  const centerFactors = getTerrainHeightAndFactors(x, z, mapId);
  const centerStruct = getDrivableSurfaceHeight(x, z, carY, mapId, centerFactors.height);
  const hL = getDrivableSurfaceHeight(x - eps, z, carY, mapId).height;
  const hR = getDrivableSurfaceHeight(x + eps, z, carY, mapId).height;
  const hD = getDrivableSurfaceHeight(x, z - eps, carY, mapId).height;
  const hU = getDrivableSurfaceHeight(x, z + eps, carY, mapId).height;

  const dx = (hR - hL) / (2 * eps);
  const dz = (hU - hD) / (2 * eps);
  const invLen = 1 / Math.sqrt(dx * dx + 1 + dz * dz);
  const normalX = -dx * invLen;
  const normalY = invLen;
  const normalZ = -dz * invLen;
  const slope = clamp(1 - normalY, 0, 1);

  const classified = classifyBiomeAndSurface(
    x,
    z,
    centerStruct.height,
    slope,
    centerFactors.roadFactor,
    centerFactors.trailFactor,
    mapId,
  );

  return {
    height: centerStruct.height,
    normalX,
    normalY,
    normalZ,
    slope,
    surface: centerStruct.deckSurface ?? classified.surface,
    biome: centerStruct.deckBiome ?? classified.biome,
    roadFactor: centerFactors.roadFactor,
    trailFactor: centerFactors.trailFactor,
    waterDepth: centerStruct.deckSurface ? 0 : classified.waterDepth,
  };
}
