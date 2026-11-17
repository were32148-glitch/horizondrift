import type { CarId, CharacterId, CarSpec, GarageSaveData, WeaponId } from './types';

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
  {
    id: 'police_cruiser',
    name: 'LSPD Interceptor',
    category: 'Law Enforcement',
    description: 'Heavy pursuit cruiser equipped with emergency lights and reinforced push bumper.',
    price: 300,
    paintHex: 0x1d4ed8,
    stripeHex: 0xf8fafc,
    rimHex: 0x94a3b8,
    bodyStyle: 'track',
    speedMul: 1.08,
    accelMul: 1.1,
    gripMul: 1.12,
    offroadMul: 1.0,
    boostMul: 1.15,
    stats: { speed: 85, accel: 84, handling: 88, offroad: 75 },
  },
];

export interface CharacterSpec {
  id: CharacterId;
  name: string;
  description: string;
  price: number;
  armorBonus: number;
  shirtHex: number;
  pantsHex: number;
  accentHex: number;
}

export const CHARACTER_ROSTER: CharacterSpec[] = [
  { id: 'default', name: 'Civilian Drifter', description: 'Standard driver outfit.', price: 0, armorBonus: 0, shirtHex: 0x0284c7, pantsHex: 0x1e293b, accentHex: 0x38bdf8 },
  { id: 'detective', name: 'LSPD Detective', description: 'Undercover tactical gear with improved pistol handling.', price: 200, armorBonus: 25, shirtHex: 0x1e3a8a, pantsHex: 0x0f172a, accentHex: 0xfacc15 },
  { id: 'street_boss', name: 'Los Santos Kingpin', description: 'Elite custom armor and intimidation bonus.', price: 450, armorBonus: 50, shirtHex: 0x7e22ce, pantsHex: 0x111827, accentHex: 0xf43f5e },
  { id: 'special_ops', name: 'SWAT Special Ops', description: 'Heavy ballistic body armor and maximum protection.', price: 800, armorBonus: 100, shirtHex: 0x065f46, pantsHex: 0x09090b, accentHex: 0x10b981 },
];

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  damage: number;
  fireRate: number;
  range: number;
  CooldownSec: number;
  price: number;
}

export const WEAPON_ROSTER: WeaponSpec[] = [
  { id: 'fists', name: 'Combat Fists', damage: 25, fireRate: 2.0, range: 3.6, CooldownSec: 0.42, price: 0 },
  { id: 'pistol', name: '9mm Pistol', damage: 42, fireRate: 4.0, range: 28, CooldownSec: 0.28, price: 100 },
  { id: 'shotgun', name: 'Pump Shotgun', damage: 90, fireRate: 1.2, range: 18, CooldownSec: 0.65, price: 250 },
  { id: 'assault_rifle', name: 'Carbine Rifle', damage: 55, fireRate: 10.0, range: 40, CooldownSec: 0.14, price: 500 },
  { id: 'minigun', name: 'Heavy Minigun', damage: 115, fireRate: 25.0, range: 48, CooldownSec: 0.08, price: 1200 },
];

export function getCarSpec(id: CarId): CarSpec {
  return CAR_ROSTER.find((c) => c.id === id) ?? CAR_ROSTER[0];
}

export function getCharacterSpec(id: CharacterId): CharacterSpec {
  return CHARACTER_ROSTER.find((c) => c.id === id) ?? CHARACTER_ROSTER[0];
}

export function getWeaponSpec(id: WeaponId): WeaponSpec {
  return WEAPON_ROSTER.find((w) => w.id === id) ?? WEAPON_ROSTER[0];
}

export function createDefaultGarageSave(): GarageSaveData {
  return {
    coins: 120,
    ownedCars: ['apex'],
    equippedP1: 'apex',
    equippedP2: 'apex',
    equippedCharacter: 'default',
    unlockedCharacters: ['default'],
    equippedWeapon: 'fists',
    unlockedWeapons: ['fists'],
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

    const validChars = new Set<CharacterId>(CHARACTER_ROSTER.map((c) => c.id));
    const unlockedChars = (
      Array.isArray(parsed.unlockedCharacters)
        ? parsed.unlockedCharacters.filter((id): id is CharacterId => validChars.has(id))
        : ['default']
    ) as CharacterId[];
    if (!unlockedChars.includes('default')) unlockedChars.unshift('default');
    const equippedCharacter =
      parsed.equippedCharacter && unlockedChars.includes(parsed.equippedCharacter)
        ? parsed.equippedCharacter
        : 'default';

    const validWeapons = new Set<WeaponId>(WEAPON_ROSTER.map((w) => w.id));
    const unlockedWeapons = (
      Array.isArray(parsed.unlockedWeapons)
        ? parsed.unlockedWeapons.filter((id): id is WeaponId => validWeapons.has(id))
        : ['fists']
    ) as WeaponId[];
    if (!unlockedWeapons.includes('fists')) unlockedWeapons.unshift('fists');
    const equippedWeapon =
      parsed.equippedWeapon && unlockedWeapons.includes(parsed.equippedWeapon)
        ? parsed.equippedWeapon
        : 'fists';

    const coins =
      typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) && parsed.coins >= 0
        ? Math.floor(parsed.coins)
        : def.coins;
    return {
      coins,
      ownedCars: owned,
      equippedP1,
      equippedP2,
      equippedCharacter,
      unlockedCharacters: unlockedChars,
      equippedWeapon,
      unlockedWeapons,
    };
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
    ...save,
    coins: save.coins - spec.price,
    ownedCars: [...save.ownedCars, carId],
    equippedP1: equipForPlayer === 1 ? carId : save.equippedP1,
    equippedP2: equipForPlayer === 2 ? carId : save.equippedP2,
  };
  return { next, purchased: true };
}

export function purchaseCharacter(
  save: GarageSaveData,
  charId: CharacterId,
): { next: GarageSaveData; purchased: boolean } {
  const spec = getCharacterSpec(charId);
  if (save.unlockedCharacters.includes(charId)) {
    return {
      next: { ...save, equippedCharacter: charId },
      purchased: false,
    };
  }
  if (save.coins < spec.price) {
    return { next: save, purchased: false };
  }
  return {
    next: {
      ...save,
      coins: save.coins - spec.price,
      unlockedCharacters: [...save.unlockedCharacters, charId],
      equippedCharacter: charId,
    },
    purchased: true,
  };
}

export function purchaseWeapon(
  save: GarageSaveData,
  weaponId: WeaponId,
): { next: GarageSaveData; purchased: boolean } {
  const spec = getWeaponSpec(weaponId);
  if (save.unlockedWeapons.includes(weaponId)) {
    return {
      next: { ...save, equippedWeapon: weaponId },
      purchased: false,
    };
  }
  if (save.coins < spec.price) {
    return { next: save, purchased: false };
  }
  return {
    next: {
      ...save,
      coins: save.coins - spec.price,
      unlockedWeapons: [...save.unlockedWeapons, weaponId],
      equippedWeapon: weaponId,
    },
    purchased: true,
  };
}

export function awardCoins(save: GarageSaveData, delta: number): GarageSaveData {
  if (!Number.isFinite(delta) || delta <= 0) return save;
  return {
    ...save,
    coins: save.coins + Math.floor(delta),
  };
}
