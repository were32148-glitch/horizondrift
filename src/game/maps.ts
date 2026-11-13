import type { MapConfig, MapId, SplinePoint } from './types';

export const WORLD_RADIUS = 620;
export const TERRAIN_SIZE = 1480;

export const MAPS: Record<MapId, MapConfig> = {
  valley: {
    id: 'valley',
    name: 'Wildlands Grand Valley',
    subtitle: 'Meadows · Crystal Lake · Alpine Peak',
    tagline: 'Sweeping 3.2km valley circuit crossing suspension lake bridges and forest foothills.',
    defaultWeather: 'clear',
    totalLaps: 3,
    roadWidth: 16.0,
    waterLevel: -2.4,
    worldRadius: WORLD_RADIUS,
    terrainSize: TERRAIN_SIZE,
    previewAccent: '#22c55e',
    colors: {
      grassA: 0x2c5e24,
      grassB: 0x427c2e,
      forest: 0x1c3a18,
      rock: 0x565d67,
      snow: 0xe6eef6,
      sand: 0xc2aa7c,
      water: 0x0c6b8e,
      shoulder: 0x3b3831,
    },
    circuitControlPoints: [
      { x: 0, z: 220 },
      { x: 175, z: 245 },
      { x: 335, z: 160 },
      { x: 370, z: -25 },
      { x: 265, z: -200 },
      { x: 95, z: -290 },
      { x: -135, z: -260 },
      { x: -315, z: -145 },
      { x: -355, z: 45 },
      { x: -235, z: 195 },
    ],
    trailControlPoints: [
      { x: -315, z: -145 },
      { x: -435, z: -215 },
      { x: -460, z: -365 },
      { x: -305, z: -455 },
      { x: -120, z: -425 },
      { x: 55, z: -380 },
      { x: 225, z: -435 },
      { x: 390, z: -325 },
      { x: 370, z: -145 },
    ],
  },
  canyon: {
    id: 'canyon',
    name: 'Redrock Canyon & Mesa',
    subtitle: 'Sandstone Cliffs · River Gorge · Rally Sweepers',
    tagline: 'High-speed red sandstone desert highway weaving past mesas and canyon river bridges.',
    defaultWeather: 'clear',
    totalLaps: 3,
    roadWidth: 16.5,
    waterLevel: -4.2,
    worldRadius: WORLD_RADIUS,
    terrainSize: TERRAIN_SIZE,
    previewAccent: '#f97316',
    colors: {
      grassA: 0x8f6b3e,
      grassB: 0xa67c46,
      forest: 0x6e4b2a,
      rock: 0x9b4b2f,
      snow: 0xd99b66,
      sand: 0xd4a96a,
      water: 0x166e7d,
      shoulder: 0x66402a,
    },
    circuitControlPoints: [
      { x: 0, z: 230 },
      { x: 210, z: 215 },
      { x: 380, z: 85 },
      { x: 330, z: -120 },
      { x: 185, z: -245 },
      { x: 25, z: -185 },
      { x: -145, z: -295 },
      { x: -355, z: -205 },
      { x: -385, z: -10 },
      { x: -240, z: 185 },
    ],
    trailControlPoints: [
      { x: 185, z: -245 },
      { x: 280, z: -395 },
      { x: 110, z: -480 },
      { x: -95, z: -445 },
      { x: -285, z: -410 },
      { x: -450, z: -265 },
      { x: -465, z: 85 },
      { x: -310, z: 285 },
    ],
  },
  alpine: {
    id: 'alpine',
    name: 'Glacier Alpine Pass',
    subtitle: 'Snow Peaks · Frozen Basin · Switchback Circuit',
    tagline: 'Technical high-altitude mountain pass wrapped in evergreens, ice lakes, and snowstorms.',
    defaultWeather: 'blizzard',
    totalLaps: 3,
    roadWidth: 15.5,
    waterLevel: -2.6,
    worldRadius: WORLD_RADIUS,
    terrainSize: TERRAIN_SIZE,
    previewAccent: '#38bdf8',
    colors: {
      grassA: 0x3b5842,
      grassB: 0x688078,
      forest: 0x1d3629,
      rock: 0x4b5563,
      snow: 0xf1f5f9,
      sand: 0x94a3b8,
      water: 0x38bdf8,
      shoulder: 0x475569,
    },
    circuitControlPoints: [
      { x: 0, z: 210 },
      { x: 165, z: 260 },
      { x: 340, z: 195 },
      { x: 405, z: 10 },
      { x: 315, z: -195 },
      { x: 135, z: -325 },
      { x: -85, z: -315 },
      { x: -285, z: -225 },
      { x: -390, z: -35 },
      { x: -265, z: 160 },
    ],
    trailControlPoints: [
      { x: 135, z: -325 },
      { x: 205, z: -455 },
      { x: 30, z: -505 },
      { x: -175, z: -465 },
      { x: -365, z: -355 },
      { x: -475, z: -135 },
    ],
  },
  coast: {
    id: 'coast',
    name: 'Coastal Emerald Bay',
    subtitle: 'Ocean Causeways · Beaches · Volcano Ridge',
    tagline: 'Scenic coastal speedway linking emerald islands, sandy coves, and a volcanic summit.',
    defaultWeather: 'clear',
    totalLaps: 3,
    roadWidth: 16.5,
    waterLevel: -1.4,
    worldRadius: WORLD_RADIUS,
    terrainSize: TERRAIN_SIZE,
    previewAccent: '#14b8a6',
    colors: {
      grassA: 0x26683a,
      grassB: 0x3b8447,
      forest: 0x174528,
      rock: 0x474f59,
      snow: 0xb6c2cf,
      sand: 0xe6cf9a,
      water: 0x0882a6,
      shoulder: 0x7c745c,
    },
    circuitControlPoints: [
      { x: 0, z: 235 },
      { x: 205, z: 230 },
      { x: 350, z: 95 },
      { x: 310, z: -105 },
      { x: 140, z: -265 },
      { x: -55, z: -285 },
      { x: -245, z: -215 },
      { x: -365, z: -45 },
      { x: -315, z: 155 },
      { x: -165, z: 230 },
    ],
    trailControlPoints: [
      { x: -245, z: -215 },
      { x: -355, z: -335 },
      { x: -190, z: -445 },
      { x: 35, z: -435 },
      { x: 245, z: -385 },
      { x: 405, z: -205 },
    ],
  },
};

export const MAP_LIST: MapConfig[] = [
  MAPS.valley,
  MAPS.canyon,
  MAPS.alpine,
  MAPS.coast,
];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

export function sampleSpline(
  pts: SplinePoint[],
  closed: boolean,
  samplesPerSeg: number,
): SplinePoint[] {
  const out: SplinePoint[] = [];
  const count = pts.length;
  const segs = closed ? count : count - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = pts[(i - 1 + count) % count];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % count];
    const p3 = pts[(i + 2) % count];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      out.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, t),
      });
    }
  }
  if (!closed) {
    out.push(pts[pts.length - 1]);
  }
  return out;
}
