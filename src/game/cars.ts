import type { CarId, CarSpec, GarageSaveData } from './types';

export const GARAGE_STORAGE_KEY = 'horizon_drift_garage_v1';

export const CAR_ROSTER: CarSpec[] = [
  {
    id: 'apex',
    name: 'Apex GT-R',
    category: 'All-Terrain GT',
    description: 'Balanced twin-turbo rally coupe built for tarmac sweepers and forest trails.',
    price: 0,
    paintHex: 0xd92638,
    stripeHex: 0xfacc15,
    rimHex: 0xd9bc7e,
    bodyStyle: 'gt',
    speedMul: 1.0,
    accelMul: 1.0,
    gripMul: 1.0,
    offroadMul: 1.0,
    boostMul: 1.0,
    stats: { speed: 74, accel: 72, handling: 76, offroad: 75 },
  },
  {
    id: 'baja',
    name: 'Dune Baja RS',
    category: 'Rally Raid 4x4',
    description: 'Reinforced off-road trophy coupe with heavy gravel, sand, and snow traction.',
    price: 120,
    paintHex: 0xea580c,
    stripeHex: 0xf8fafc,
    rimHex: 0x334155,
    bodyStyle: 'baja',
    speedMul: 1.03,
    accelMul: 1.08,
    gripMul: 1.06,
    offroadMul: 1.28,
    boostMul: 1.12,
    stats: { speed: 78, accel: 80, handling: 82, offroad: 98 },
  },
  {
    id: 'viper',
    name: 'Viper Venom V8',
    category: 'Circuit Track Spec',
    description: 'High-downforce track weapon with razor-sharp cornering and blistering top speed.',
    price: 250,
    paintHex: 0x059669,
    stripeHex: 0x34d399,
    rimHex: 0xe2e8f0,
    bodyStyle: 'track',
    speedMul: 1.1,
    accelMul: 1.12,
    gripMul: 1.16,
    offroadMul: 0.96,
    boostMul: 1.18,
    stats: { speed: 88, accel: 86, handling: 90, offroad: 68 },
  },
  {
    id: 'phantom',
    name: 'Phantom Aero X',
    category: 'Cyber Hypercar',
    description: 'Carbon-weave prototype with twin-plane aero wing and supercharged nitro output.',
    price: 420,
    paintHex: 0x1e293b,
    stripeHex: 0x22d3ee,
    rimHex: 0x38bdf8,
    bodyStyle: 'hyper',
    speedMul: 1.16,
    accelMul: 1.2,
    gripMul: 1.2,
    offroadMul: 1.08,
    boostMul: 1.3,
    stats: { speed: 94, accel: 94, handling: 93, offroad: 82 },
  },
  {
    id: 'titan',
    name: 'Titan Apex 911',
    category: 'Championship Legend',
    description: 'Gold-forged Grand Prix champion with peak top speed, grip, and endurance boost.',
    price: 650,
    paintHex: 0x7c3aed,
    stripeHex: 0xfbbf24,
    rimHex: 0xfbbf24,
    bodyStyle: 'legend',
    speedMul: 1.22,
    accelMul: 1.25,
    gripMul: 1.25,
    offroadMul: 1.16,
    boostMul: 1.38,
    stats: { speed: 99, accel: 98, handling: 98, offroad: 90 },
  },
];

export function getCarSpec(id: CarId): CarSpec {
  return CAR_ROSTER.find((c) => c.id === id) ?? CAR_ROSTER[0];
}

export function createDefaultGarageSave(): GarageSaveData {
  return {
    coins: 120,
    ownedCars: ['apex'],
    equippedP1: 'apex',
    equippedP2: 'apex',
  };
}

export function loadGarageSave(): GarageSaveData {
  const def = createDefaultGarageSave();
  if (typeof window === 'undefined' || !window.localStorage) return def;
  try {
    const raw = window.localStorage.getItem(GARAGE_STORAGE_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw) as Partial<GarageSaveData>;
    const validIds = new Set<CarId>(CAR_ROSTER.map((c) => c.id));
    const owned = Array.isArray(parsed.ownedCars)
      ? parsed.ownedCars.filter((id): id is CarId => validIds.has(id))
      : [];
    if (!owned.includes('apex')) owned.unshift('apex');
    const equippedP1 =
      parsed.equippedP1 && owned.includes(parsed.equippedP1) ? parsed.equippedP1 : 'apex';
    const equippedP2 =
      parsed.equippedP2 && owned.includes(parsed.equippedP2) ? parsed.equippedP2 : 'apex';
    const coins =
      typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) && parsed.coins >= 0
        ? Math.floor(parsed.coins)
        : def.coins;
    return { coins, ownedCars: owned, equippedP1, equippedP2 };
  } catch {
    return def;
  }
}

export function saveGarageSave(data: GarageSaveData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function purchaseCar(
  save: GarageSaveData,
  carId: CarId,
  equipForPlayer: 1 | 2 = 1,
): { next: GarageSaveData; purchased: boolean } {
  const spec = getCarSpec(carId);
  if (save.ownedCars.includes(carId)) {
    const next: GarageSaveData = {
      ...save,
      equippedP1: equipForPlayer === 1 ? carId : save.equippedP1,
      equippedP2: equipForPlayer === 2 ? carId : save.equippedP2,
    };
    return { next, purchased: false };
  }
  if (save.coins < spec.price) {
    return { next: save, purchased: false };
  }
  const next: GarageSaveData = {
    coins: save.coins - spec.price,
    ownedCars: [...save.ownedCars, carId],
    equippedP1: equipForPlayer === 1 ? carId : save.equippedP1,
    equippedP2: equipForPlayer === 2 ? carId : save.equippedP2,
  };
  return { next, purchased: true };
}

export function awardCoins(save: GarageSaveData, delta: number): GarageSaveData {
  if (!Number.isFinite(delta) || delta <= 0) return save;
  return {
    ...save,
    coins: save.coins + Math.floor(delta),
  };
}
