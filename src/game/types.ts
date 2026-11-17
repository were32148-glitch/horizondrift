export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type MapId = 'valley' | 'canyon' | 'alpine' | 'coast';

export type GameMode =
  | 'race2p'
  | 'race1p'
  | 'freestyle'
  | 'online_2v2'
  | 'online_ffa';

export type TeamId = 'red' | 'blue' | 'ffa';

export type SurfaceType =
  | 'asphalt'
  | 'dirt'
  | 'grass'
  | 'forest'
  | 'rock'
  | 'snow'
  | 'sand'
  | 'water'
  | 'concrete'
  | 'wood';

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
  | 'Coastal Bay'
  | 'Great Divide Pass'
  | 'Downtown Los Santos'
  | 'Olympic Freeway'
  | 'Vinewood Hills'
  | 'Vespucci Beach'
  | 'Del Perro Pier'
  | 'LS Storm Canal'
  | 'La Mesa Industrial';

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
  kind: 'pine' | 'snowPine' | 'oak' | 'cypress' | 'palm' | 'rock' | 'boulder' | 'pillar' | 'lamp';
}

export interface BoxCollider {
  id: string;
  x: number;
  z: number;
  minY: number;
  maxY: number;
  halfW: number;
  halfL: number;
  yaw: number;
  kind: 'building' | 'barricade' | 'tirewall' | 'container' | 'grandstand' | 'wall';
}

export interface ElevatedDeck {
  id: string;
  x: number;
  z: number;
  y: number;
  halfW: number;
  halfL: number;
  yaw: number;
  thickness: number;
  surface: SurfaceType;
  biome: BiomeName;
  kind: 'freeway' | 'overpass' | 'pier' | 'bridge' | 'platform';
  slopeStartY?: number;
  slopeEndY?: number;
}

export interface StuntRamp {
  id: string;
  x: number;
  z: number;
  yaw: number;
  width: number;
  length: number;
  height: number;
  baseYOffset?: number;
  style?: 'circuit' | 'truss' | 'concrete' | 'container';
}

export interface ExplorationBeacon {
  id: string;
  name: string;
  biome: string;
  x: number;
  z: number;
  radius: number;
}

export type HumanArchetype =
  | 'business'
  | 'jogger'
  | 'beachgoer'
  | 'officer'
  | 'worker'
  | 'streetwear'
  | 'hiker'
  | 'tourist';

export type AnimalSpecies =
  // Urban Pets (6)
  | 'golden_retriever'
  | 'german_shepherd'
  | 'dalmatian'
  | 'french_bulldog'
  | 'tabby_cat'
  | 'black_cat'
  // Birds (6)
  | 'pigeon'
  | 'seagull'
  | 'crow'
  | 'bald_eagle'
  | 'red_hawk'
  | 'mallard_duck'
  // Small Wildlife (5)
  | 'cottontail_rabbit'
  | 'jackrabbit'
  | 'red_fox'
  | 'gray_squirrel'
  | 'raccoon'
  // Large Wildlife (6)
  | 'whitetail_deer'
  | 'elk_stag'
  | 'timber_wolf'
  | 'grizzly_bear'
  | 'mountain_cougar'
  | 'bighorn_ram';

export type LivingActorKind =
  | { category: 'human'; archetype: HumanArchetype }
  | { category: 'animal'; species: AnimalSpecies };

export type LivingReactionState = 'calm' | 'fleeing' | 'knocked' | 'recovering' | 'dead';

export interface LivingActorTelemetry {
  id: string;
  label: string;
  category: 'human' | 'animal';
  reaction: LivingReactionState;
  hitCount: number;
}

export interface FastTravelZone {
  id: string;
  label: string;
  district: string;
  x: number;
  z: number;
  yaw: number;
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
  isRemote?: boolean;
  team?: TeamId;
  carId?: CarId;
  playerIndex: 0 | 1 | null; // 0 = P1, 1 = P2, null = AI or Remote
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

export type CarId = 'apex' | 'baja' | 'viper' | 'phantom' | 'titan' | 'police_cruiser';

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
    speed: number;
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

export type CharacterId = 'default' | 'detective' | 'street_boss' | 'special_ops';
export type WeaponId = 'fists' | 'pistol' | 'shotgun' | 'assault_rifle' | 'minigun';

export interface GarageSaveData {
  coins: number;
  ownedCars: CarId[];
  equippedP1: CarId;
  equippedP2: CarId;
  equippedCharacter: CharacterId;
  unlockedCharacters: CharacterId[];
  equippedWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
}

export interface PlayerHudInfo {
  name: string;
  carName: string;
  team?: TeamId;
  speedKmh: number;
  rpm: number;
  gear: number;
  boostFuel: number;
  isBoosting: boolean;
  isDrifting: boolean;
  totalDriftScore: number;
  airTime?: number;
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
  team?: TeamId;
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
  aiDots: Array<{ x: number; z: number; yaw: number; color: number; team?: TeamId }>;
  standings: RaceStandingSummary[];
  beaconsFound: number;
  totalBeacons: number;
  discoveredIds: string[];
  totalCoins: number;
  runCoins: number;
  lobbyCode?: string | null;
  teamScores?: { red: number; blue: number };
  reactionBanner?: string | null;
  isOnFoot?: boolean;
  characterHealth?: number;
  characterMaxHealth?: number;
  characterEnergy?: number;
  wantedLevel?: number;
  activePower?: string | null;
  activePowerSeconds?: number;
  isCharacterDead?: boolean;
  nearHouseName?: string | null;
}

// --- Online Multiplayer & Cloud Lobbies ---

export type LobbyMode = 'online_2v2' | 'online_ffa';

export interface LobbyMember {
  clientId: string;
  uid?: string | null;
  name: string;
  carId: CarId;
  team: TeamId;
  ready: boolean;
  isHost: boolean;
}

export interface LobbyState {
  code: string;
  mode: LobbyMode;
  mapId: MapId;
  weatherPreset: WeatherPreset;
  status: 'waiting' | 'racing' | 'finished';
  hostClientId: string;
  maxPlayers: number;
  fillWithBots: boolean;
  winnerLabel?: string | null;
  members: LobbyMember[];
}

export interface RemotePlayerSnapshot {
  clientId: string;
  name: string;
  carId: CarId;
  team: TeamId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  roll: number;
  steerAngle: number;
  speedKmh: number;
  isBoosting: boolean;
  lap: number;
  place: number;
  finished: boolean;
  finishTime: number | null;
  progressScore: number;
}
