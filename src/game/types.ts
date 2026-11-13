export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type MapId = 'valley' | 'canyon' | 'alpine' | 'coast';

export type GameMode = 'race2p' | 'race1p' | 'freestyle';

export type SurfaceType =
  | 'asphalt'
  | 'dirt'
  | 'grass'
  | 'forest'
  | 'rock'
  | 'snow'
  | 'sand'
  | 'water';

export type BiomeName =
  | 'Scenic Highway'
  | 'Emerald Grasslands'
  | 'Whispering Forest'
  | 'Alpine Highlands'
  | 'Snowy Summit'
  | 'Crystal Lakefront'
  | 'Redrock Canyon'
  | 'Desert Mesa'
  | 'Glacier Ridge'
  | 'Coastal Bay';

export type WeatherPreset =
  | 'clear'
  | 'overcast'
  | 'rain'
  | 'blizzard'
  | 'night'
  | 'auto';

export type ActiveWeatherCondition =
  | 'clear'
  | 'overcast'
  | 'rain'
  | 'blizzard'
  | 'night';

export type CameraMode = 'chase' | 'drift' | 'hood';

export interface SplinePoint {
  x: number;
  z: number;
}

export interface MapThemeColors {
  grassA: number;
  grassB: number;
  forest: number;
  rock: number;
  snow: number;
  sand: number;
  water: number;
  shoulder: number;
}

export interface MapConfig {
  id: MapId;
  name: string;
  subtitle: string;
  tagline: string;
  defaultWeather: WeatherPreset;
  totalLaps: number;
  roadWidth: number;
  waterLevel: number;
  worldRadius: number;
  terrainSize: number;
  colors: MapThemeColors;
  circuitControlPoints: SplinePoint[];
  trailControlPoints: SplinePoint[];
  previewAccent: string;
}

export interface TerrainSample {
  height: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  slope: number;
  surface: SurfaceType;
  biome: BiomeName;
  roadFactor: number;
  trailFactor: number;
  waterDepth: number;
}

export interface WorldObstacle {
  id: number;
  x: number;
  z: number;
  y: number;
  radius: number;
  height: number;
  kind: 'pine' | 'snowPine' | 'oak' | 'cypress' | 'rock' | 'boulder';
}

export interface StuntRamp {
  id: string;
  x: number;
  z: number;
  yaw: number;
  width: number;
  length: number;
  height: number;
}

export interface ExplorationBeacon {
  id: string;
  name: string;
  biome: string;
  x: number;
  z: number;
  radius: number;
}

export interface VehicleInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (right) .. +1 (left)
  handbrake: boolean;
  boost: boolean;
}

export interface WheelTelemetry {
  compression: number; // 0..1
  grounded: boolean;
  slip: number;
  steerAngle: number;
  spinAngle: number;
  surface: SurfaceType;
}

export interface VehicleState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number; // radians, 0 = +Z forward
  pitch: number;
  roll: number;
  angularVelY: number;
  pitchVel: number;
  rollVel: number;
  steerAngle: number;
  speed: number; // m/s signed
  speedKmh: number;
  rpm: number; // 900 .. 8400
  gear: number; // -1 = R, 0 = N, 1..6
  boostFuel: number; // 0..100
  isBoosting: boolean;
  isDrifting: boolean;
  driftScore: number;
  totalDriftScore: number;
  airTime: number;
  groundedCount: number;
  surface: SurfaceType;
  biome: BiomeName;
  wheels: [WheelTelemetry, WheelTelemetry, WheelTelemetry, WheelTelemetry];
  impactIntensity: number;
  landedIntensity: number;
  headlightsOn: boolean;
}

export interface RacerProfile {
  id: string;
  name: string;
  numberLabel: string;
  paintHex: number;
  stripeHex: number;
  isHuman: boolean;
  playerIndex: 0 | 1 | null; // 0 = P1, 1 = P2, null = AI
  aiSkill: number; // 0.75..1.05
  aiLaneOffset: number; // -3.5..+3.5
}

export interface RacerRuntime {
  profile: RacerProfile;
  vehicle: VehicleState;
  lap: number; // 1..totalLaps
  nextCheckpoint: number; // index into circuit checkpoints
  finished: boolean;
  finishTime: number | null;
  bestLapTime: number | null;
  lapStartTime: number;
  progressScore: number; // monotonic race progress for live rankings
  place: number; // 1..N
}

export interface WeatherComputed {
  preset: WeatherPreset;
  condition: ActiveWeatherCondition;
  cycleTime: number;
  sunElevation: number;
  sunAzimuth: number;
  sunIntensity: number;
  sunColorHex: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  fogColorHex: number;
  fogDensity: number;
  skyTopHex: number;
  skyHorizonHex: number;
  rainIntensity: number;
  snowIntensity: number;
  windStrength: number;
  windAngle: number;
  wetness: number;
  gripMultiplier: number;
  lightningFlash: number;
  isDark: boolean;
}

export type CarId = 'apex' | 'baja' | 'viper' | 'phantom' | 'titan';

export interface CarSpec {
  id: CarId;
  name: string;
  category: string;
  description: string;
  price: number;
  paintHex: number;
  stripeHex: number;
  rimHex: number;
  bodyStyle: 'gt' | 'baja' | 'track' | 'hyper' | 'legend';
  speedMul: number;
  accelMul: number;
  gripMul: number;
  offroadMul: number;
  boostMul: number;
  stats: {
    speed: number; // 1..100
    accel: number;
    handling: number;
    offroad: number;
  };
}

export interface CoinSpawn {
  id: string;
  x: number;
  z: number;
  y: number;
  value: number;
}

export interface GarageSaveData {
  coins: number;
  ownedCars: CarId[];
  equippedP1: CarId;
  equippedP2: CarId;
}

export interface PlayerHudInfo {
  name: string;
  carName: string;
  speedKmh: number;
  rpm: number;
  gear: number;
  boostFuel: number;
  isBoosting: boolean;
  isDrifting: boolean;
  totalDriftScore: number;
  surface: SurfaceType;
  biome: BiomeName;
  lap: number;
  totalLaps: number;
  place: number;
  totalRacers: number;
  finished: boolean;
  finishTime: number | null;
  x: number;
  z: number;
  yaw: number;
}

export interface RaceStandingSummary {
  id: string;
  name: string;
  numberLabel: string;
  paintHex: number;
  isHuman: boolean;
  place: number;
  lap: number;
  finished: boolean;
  finishTime: number | null;
}

export interface HudSnapshot {
  mode: GameMode;
  mapId: MapId;
  mapName: string;
  weatherCondition: ActiveWeatherCondition;
  weatherPreset: WeatherPreset;
  cameraMode: CameraMode;
  headlightsOn: boolean;
  countdownSeconds: number; // >0 means 3..2..1 countdown, <=0 racing
  raceElapsed: number;
  players: PlayerHudInfo[];
  aiDots: Array<{ x: number; z: number; yaw: number; color: number }>;
  standings: RaceStandingSummary[];
  beaconsFound: number;
  totalBeacons: number;
  discoveredIds: string[];
  totalCoins: number;
  runCoins: number;
}
