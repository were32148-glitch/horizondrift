import type { FastTravelZone, MapConfig, MapId, SplinePoint } from './types';

export const WORLD_RADIUS = 3200;
export const TERRAIN_SIZE = 6800;

export const MAPS: Record<MapId, MapConfig> = {
  valley: {
    id: 'valley',
    name: 'Wildlands & Los Santos',
    subtitle: 'Grand Valley · Mountain Passes · Los Santos City',
    tagline:
      'Race the 3.2km valley circuit or cross the Great Divide Mountain Passes into Downtown Los Santos, Vinewood Hills, and Vespucci Beach.',
    defaultWeather: 'clear',
    totalLaps: 3,
    roadWidth: 60.0,
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
    name: 'Redrock Canyon & LS Pass',
    subtitle: 'Sandstone Cliffs · Route 68 · Los Santos',
    tagline:
      'High-speed red sandstone desert highway weaving past mesas and northbound mountain tunnels into Los Santos.',
    defaultWeather: 'clear',
    totalLaps: 3,
    roadWidth: 60.0,
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
    name: 'Glacier Pass & Vinewood',
    subtitle: 'Snow Peaks · Ice Switchbacks · Los Santos',
    tagline:
      'Technical high-altitude mountain pass dropping straight from snowy glaciers onto the Vinewood & Los Santos basin.',
    defaultWeather: 'blizzard',
    totalLaps: 3,
    roadWidth: 60.0,
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
    name: 'Emerald Bay & Vespucci',
    subtitle: 'Pacific Causeways · Del Perro · Los Santos',
    tagline:
      'Coastal island speedway linking emerald coves to the Pacific Highway toward Vespucci Beach and Del Perro Pier.',
    defaultWeather: 'clear',
    totalLaps: 3,
    roadWidth: 60.0,
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

// Shared Highway Corridors Connecting Wildlands -> Mountains -> Los Santos Metropolis
export const WEST_PASS_CONTROL_POINTS: SplinePoint[] = [
  { x: -185, z: -255 },
  { x: -235, z: -420 },
  { x: -310, z: -610 },
  { x: -260, z: -830 },
  { x: -345, z: -1060 },
  { x: -380, z: -1290 },
  { x: -420, z: -1540 },
  { x: -420, z: -1860 },
  { x: -420, z: -2220 },
  { x: -520, z: -2520 },
];

export const EAST_PASS_CONTROL_POINTS: SplinePoint[] = [
  { x: 175, z: -250 },
  { x: 265, z: -430 },
  { x: 375, z: -640 },
  { x: 315, z: -870 },
  { x: 405, z: -1090 },
  { x: 380, z: -1310 },
  { x: 380, z: -1580 },
  { x: 380, z: -1940 },
  { x: 380, z: -2260 },
  { x: 520, z: -2520 },
];

// Dense Highway & Boulevard Network Across Wildlands, Great Divide & Los Santos
export const LOS_SANTOS_ARTERIALS: SplinePoint[][] = [
  // Wildlands Central North-South Superhighway (Circuit -> Central Pass -> Downtown Alta St)
  [
    { x: 115, z: 245 },
    { x: 115, z: 60 },
    { x: 115, z: -180 },
    { x: 105, z: -420 },
    { x: 45, z: -740 },
    { x: 0, z: -1040 },
    { x: 0, z: -1320 },
  ],
  // Wildlands West-Center N-S Expressway
  [
    { x: -65, z: 235 },
    { x: -65, z: 25 },
    { x: -65, z: -275 },
    { x: -185, z: -410 },
  ],
  // Wildlands South-Mid East-West Boulevard
  [
    { x: -360, z: 25 },
    { x: -120, z: 25 },
    { x: 115, z: 25 },
    { x: 375, z: 25 },
  ],
  // Wildlands North-Mid East-West Boulevard
  [
    { x: -340, z: -105 },
    { x: -120, z: -105 },
    { x: 115, z: -105 },
    { x: 350, z: -105 },
  ],
  // Wildlands North Interchange Highway (linking West, Central & East Passes)
  [
    { x: -400, z: -410 },
    { x: -160, z: -410 },
    { x: 115, z: -410 },
    { x: 400, z: -410 },
  ],
  // Great Divide Mid Cross-Highway
  [
    { x: -340, z: -740 },
    { x: -120, z: -740 },
    { x: 45, z: -740 },
    { x: 380, z: -740 },
  ],
  // Great Divide North Cross-Highway
  [
    { x: -400, z: -1060 },
    { x: -150, z: -1060 },
    { x: 120, z: -1060 },
    { x: 420, z: -1060 },
  ],
  // Olympic Approach Boulevard (Los Santos South Perimeter)
  [
    { x: -920, z: -1300 },
    { x: -420, z: -1300 },
    { x: 0, z: -1300 },
    { x: 470, z: -1300 },
    { x: 900, z: -1300 },
  ],
  // East-West Olympic Boulevard (ground level below freeway + connecting Vespucci <-> Downtown <-> La Mesa)
  [
    { x: -960, z: -1460 },
    { x: -640, z: -1460 },
    { x: -200, z: -1460 },
    { x: 200, z: -1460 },
    { x: 640, z: -1460 },
    { x: 1020, z: -1460 },
  ],
  // Pillbox South Avenue
  [
    { x: -920, z: -1555 },
    { x: -500, z: -1555 },
    { x: 0, z: -1555 },
    { x: 420, z: -1555 },
  ],
  // Pillbox Mid Avenue
  [
    { x: -920, z: -1745 },
    { x: -500, z: -1745 },
    { x: 0, z: -1745 },
    { x: 420, z: -1745 },
  ],
  // Del Perro / Legion Square Central Avenue
  [
    { x: -960, z: -1840 },
    { x: -620, z: -1840 },
    { x: 0, z: -1840 },
    { x: 380, z: -1840 },
    { x: 960, z: -1840 },
  ],
  // Vinewood Boulevard (East-West Foothills Strip)
  [
    { x: -880, z: -2240 },
    { x: -420, z: -2240 },
    { x: 0, z: -2240 },
    { x: 380, z: -2240 },
    { x: 880, z: -2240 },
  ],
  // Foothills Ring Boulevard
  [
    { x: -920, z: -2360 },
    { x: -420, z: -2360 },
    { x: 0, z: -2360 },
    { x: 470, z: -2360 },
    { x: 860, z: -2360 },
  ],
  // Central Maze Bank / Alta Street (North-South through Downtown)
  [
    { x: 0, z: -1300 },
    { x: 0, z: -1650 },
    { x: 0, z: -1980 },
    { x: 0, z: -2340 },
    { x: -120, z: -2640 },
    { x: -480, z: -2820 },
  ],
  // Canal Riverfront Boulevard (Downtown East)
  [
    { x: 470, z: -1300 },
    { x: 470, z: -1650 },
    { x: 470, z: -2020 },
    { x: 470, z: -2360 },
  ],
  // Pillbox West Expressway
  [
    { x: -500, z: -1300 },
    { x: -500, z: -1650 },
    { x: -500, z: -2020 },
    { x: -500, z: -2360 },
  ],
  // Vespucci-Downtown Connector Avenue
  [
    { x: -715, z: -1300 },
    { x: -715, z: -1650 },
    { x: -715, z: -2020 },
    { x: -715, z: -2360 },
  ],
  // Vespucci Ocean Coast Highway (North-South boardwalk road)
  [
    { x: -920, z: -1300 },
    { x: -920, z: -1650 },
    { x: -920, z: -2020 },
    { x: -880, z: -2380 },
    { x: -580, z: -2720 },
  ],
  // La Mesa / LS Canal East Industrial Loop
  [
    { x: 860, z: -1350 },
    { x: 980, z: -1680 },
    { x: 980, z: -2060 },
    { x: 820, z: -2360 },
  ],
  // Vinewood Crest Drive
  [
    { x: -760, z: -2550 },
    { x: -380, z: -2550 },
    { x: 0, z: -2550 },
    { x: 380, z: -2550 },
    { x: 760, z: -2550 },
  ],
  // Vinewood Summit Connector
  [
    { x: 95, z: -2240 },
    { x: 95, z: -2550 },
    { x: 95, z: -2840 },
  ],
  // Vinewood Hills Winding Mulholland Switchback
  [
    { x: -720, z: -2520 },
    { x: -460, z: -2760 },
    { x: -120, z: -2860 },
    { x: 260, z: -2820 },
    { x: 640, z: -2620 },
  ],
];

export const FAST_TRAVEL_ZONES: FastTravelZone[] = [
  {
    id: 'wildlands',
    label: 'Wildlands Grid',
    district: 'Circuit Start / Finish',
    x: 0,
    z: 220,
    yaw: Math.PI * 0.5,
  },
  {
    id: 'pass',
    label: 'Divide Pass',
    district: 'Mountain Highway',
    x: -292,
    z: -740,
    yaw: Math.PI,
  },
  {
    id: 'downtown',
    label: 'Downtown LS',
    district: 'Maze Bank & Legion Sq',
    x: 0,
    z: -1620,
    yaw: Math.PI,
  },
  {
    id: 'vespucci',
    label: 'Vespucci Beach',
    district: 'Del Perro Pier & Ferris Wheel',
    x: -920,
    z: -1820,
    yaw: -Math.PI * 0.5,
  },
  {
    id: 'vinewood',
    label: 'Vinewood Hills',
    district: 'Hollywood Sign Vista',
    x: 0,
    z: -2240,
    yaw: Math.PI,
  },
  {
    id: 'lamesa',
    label: 'LS Storm Canal',
    district: 'La Mesa Stunt Yard',
    x: 580,
    z: -1780,
    yaw: Math.PI,
  },
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
