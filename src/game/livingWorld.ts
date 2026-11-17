import * as THREE from 'three';
import { clamp, getMapWorldData, groundHeightAt } from './terrain';
import type {
  AnimalSpecies,
  GameMode,
  HumanArchetype,
  LivingReactionState,
  MapId,
  VehicleState,
} from './types';

export interface AnimalSpeciesSpec {
  id: AnimalSpecies;
  name: string;
  habitat: 'city' | 'forest' | 'mountain' | 'desert' | 'beach' | 'sky';
  locomotion: 'quadruped' | 'hop' | 'bird';
  bodyColor: number;
  secondaryColor: number;
  eyeColor: number;
  scale: number;
  bodyLength: number;
  bodyHeight: number;
  shoulderHeight: number;
  neckLength: number;
  earStyle: 'floppy' | 'pointed' | 'long' | 'rounded' | 'horns' | 'antlers' | 'none';
  tailStyle: 'long' | 'bushy' | 'cotton' | 'short' | 'feathers';
  walkSpeed: number;
  fleeSpeed: number;
  collisionRadius: number;
  reactionSound: 'bark' | 'meow' | 'chirp' | 'growl' | 'squeak';
}

export const ANIMAL_SPECIES_LIST: AnimalSpeciesSpec[] = [
  // Urban Pets (6)
  { id: 'golden_retriever', name: 'Golden Retriever', habitat: 'city', locomotion: 'quadruped', bodyColor: 0xd99b38, secondaryColor: 0xf3d189, eyeColor: 0x1e1b18, scale: 1.0, bodyLength: 0.92, bodyHeight: 0.38, shoulderHeight: 0.56, neckLength: 0.24, earStyle: 'floppy', tailStyle: 'long', walkSpeed: 2.2, fleeSpeed: 9.5, collisionRadius: 0.65, reactionSound: 'bark' },
  { id: 'german_shepherd', name: 'German Shepherd', habitat: 'city', locomotion: 'quadruped', bodyColor: 0x8c592b, secondaryColor: 0x1f1d1b, eyeColor: 0x1e1b18, scale: 1.06, bodyLength: 0.98, bodyHeight: 0.4, shoulderHeight: 0.62, neckLength: 0.26, earStyle: 'pointed', tailStyle: 'long', walkSpeed: 2.5, fleeSpeed: 10.5, collisionRadius: 0.7, reactionSound: 'bark' },
  { id: 'dalmatian', name: 'Dalmatian', habitat: 'city', locomotion: 'quadruped', bodyColor: 0xf8fafc, secondaryColor: 0x18181b, eyeColor: 0x1e1b18, scale: 1.0, bodyLength: 0.92, bodyHeight: 0.36, shoulderHeight: 0.58, neckLength: 0.25, earStyle: 'floppy', tailStyle: 'long', walkSpeed: 2.4, fleeSpeed: 10.0, collisionRadius: 0.65, reactionSound: 'bark' },
  { id: 'french_bulldog', name: 'French Bulldog', habitat: 'city', locomotion: 'quadruped', bodyColor: 0xc29e78, secondaryColor: 0x27272a, eyeColor: 0x1e1b18, scale: 0.78, bodyLength: 0.62, bodyHeight: 0.32, shoulderHeight: 0.38, neckLength: 0.14, earStyle: 'pointed', tailStyle: 'short', walkSpeed: 1.6, fleeSpeed: 7.2, collisionRadius: 0.5, reactionSound: 'bark' },
  { id: 'tabby_cat', name: 'Tabby Street Cat', habitat: 'city', locomotion: 'quadruped', bodyColor: 0xc27038, secondaryColor: 0x7c3b18, eyeColor: 0x84cc16, scale: 0.75, bodyLength: 0.58, bodyHeight: 0.24, shoulderHeight: 0.34, neckLength: 0.16, earStyle: 'pointed', tailStyle: 'long', walkSpeed: 1.8, fleeSpeed: 9.8, collisionRadius: 0.45, reactionSound: 'meow' },
  { id: 'black_cat', name: 'Black Alley Cat', habitat: 'city', locomotion: 'quadruped', bodyColor: 0x18181b, secondaryColor: 0x3f3f46, eyeColor: 0xfacc15, scale: 0.75, bodyLength: 0.58, bodyHeight: 0.24, shoulderHeight: 0.34, neckLength: 0.16, earStyle: 'pointed', tailStyle: 'long', walkSpeed: 1.9, fleeSpeed: 10.2, collisionRadius: 0.45, reactionSound: 'meow' },

  // Birds (6)
  { id: 'pigeon', name: 'City Pigeon', habitat: 'city', locomotion: 'bird', bodyColor: 0x94a3b8, secondaryColor: 0x475569, eyeColor: 0xf97316, scale: 0.8, bodyLength: 0.36, bodyHeight: 0.22, shoulderHeight: 0.22, neckLength: 0.12, earStyle: 'none', tailStyle: 'feathers', walkSpeed: 1.2, fleeSpeed: 14.0, collisionRadius: 0.42, reactionSound: 'chirp' },
  { id: 'seagull', name: 'Vespucci Seagull', habitat: 'beach', locomotion: 'bird', bodyColor: 0xf8fafc, secondaryColor: 0x94a3b8, eyeColor: 0xfacc15, scale: 0.95, bodyLength: 0.44, bodyHeight: 0.24, shoulderHeight: 0.26, neckLength: 0.15, earStyle: 'none', tailStyle: 'feathers', walkSpeed: 1.5, fleeSpeed: 16.0, collisionRadius: 0.48, reactionSound: 'chirp' },
  { id: 'crow', name: 'Canyon Crow', habitat: 'city', locomotion: 'bird', bodyColor: 0x18181b, secondaryColor: 0x27272a, eyeColor: 0xfef08a, scale: 0.9, bodyLength: 0.4, bodyHeight: 0.22, shoulderHeight: 0.24, neckLength: 0.13, earStyle: 'none', tailStyle: 'feathers', walkSpeed: 1.4, fleeSpeed: 15.0, collisionRadius: 0.45, reactionSound: 'chirp' },
  { id: 'bald_eagle', name: 'Bald Eagle', habitat: 'sky', locomotion: 'bird', bodyColor: 0x452719, secondaryColor: 0xf8fafc, eyeColor: 0xfacc15, scale: 1.35, bodyLength: 0.62, bodyHeight: 0.34, shoulderHeight: 0.36, neckLength: 0.2, earStyle: 'none', tailStyle: 'feathers', walkSpeed: 8.5, fleeSpeed: 19.0, collisionRadius: 0.65, reactionSound: 'chirp' },
  { id: 'red_hawk', name: 'Red-Tailed Hawk', habitat: 'sky', locomotion: 'bird', bodyColor: 0x7c3e24, secondaryColor: 0xd97706, eyeColor: 0xfbbf24, scale: 1.2, bodyLength: 0.56, bodyHeight: 0.3, shoulderHeight: 0.32, neckLength: 0.18, earStyle: 'none', tailStyle: 'feathers', walkSpeed: 8.0, fleeSpeed: 18.0, collisionRadius: 0.6, reactionSound: 'chirp' },
  { id: 'mallard_duck', name: 'Lake Mallard Duck', habitat: 'beach', locomotion: 'bird', bodyColor: 0x785b46, secondaryColor: 0x15803d, eyeColor: 0x18181b, scale: 0.92, bodyLength: 0.42, bodyHeight: 0.24, shoulderHeight: 0.2, neckLength: 0.18, earStyle: 'none', tailStyle: 'feathers', walkSpeed: 1.6, fleeSpeed: 13.0, collisionRadius: 0.45, reactionSound: 'chirp' },

  // Small Wildlife (5)
  { id: 'cottontail_rabbit', name: 'Cottontail Rabbit', habitat: 'forest', locomotion: 'hop', bodyColor: 0xa17c5b, secondaryColor: 0xf5f5f4, eyeColor: 0x1e1b18, scale: 0.85, bodyLength: 0.44, bodyHeight: 0.28, shoulderHeight: 0.24, neckLength: 0.1, earStyle: 'long', tailStyle: 'cotton', walkSpeed: 2.8, fleeSpeed: 11.5, collisionRadius: 0.45, reactionSound: 'squeak' },
  { id: 'jackrabbit', name: 'Desert Jackrabbit', habitat: 'desert', locomotion: 'hop', bodyColor: 0xc29b6c, secondaryColor: 0xe7d4b5, eyeColor: 0x1e1b18, scale: 0.95, bodyLength: 0.52, bodyHeight: 0.32, shoulderHeight: 0.3, neckLength: 0.12, earStyle: 'long', tailStyle: 'cotton', walkSpeed: 3.4, fleeSpeed: 13.5, collisionRadius: 0.5, reactionSound: 'squeak' },
  { id: 'red_fox', name: 'Red Fox', habitat: 'forest', locomotion: 'quadruped', bodyColor: 0xd95b26, secondaryColor: 0xfafaf9, eyeColor: 0xf59e0b, scale: 0.95, bodyLength: 0.78, bodyHeight: 0.32, shoulderHeight: 0.46, neckLength: 0.2, earStyle: 'pointed', tailStyle: 'bushy', walkSpeed: 2.8, fleeSpeed: 12.2, collisionRadius: 0.58, reactionSound: 'squeak' },
  { id: 'gray_squirrel', name: 'Gray Squirrel', habitat: 'forest', locomotion: 'hop', bodyColor: 0x71717a, secondaryColor: 0xd4d4d8, eyeColor: 0x18181b, scale: 0.72, bodyLength: 0.34, bodyHeight: 0.2, shoulderHeight: 0.18, neckLength: 0.08, earStyle: 'rounded', tailStyle: 'bushy', walkSpeed: 2.5, fleeSpeed: 10.5, collisionRadius: 0.38, reactionSound: 'squeak' },
  { id: 'raccoon', name: 'City Raccoon', habitat: 'forest', locomotion: 'quadruped', bodyColor: 0x52525b, secondaryColor: 0x18181b, eyeColor: 0x18181b, scale: 0.85, bodyLength: 0.58, bodyHeight: 0.28, shoulderHeight: 0.34, neckLength: 0.14, earStyle: 'rounded', tailStyle: 'bushy', walkSpeed: 2.0, fleeSpeed: 8.8, collisionRadius: 0.52, reactionSound: 'squeak' },

  // Large Wildlife (6)
  { id: 'whitetail_deer', name: 'Whitetail Deer', habitat: 'forest', locomotion: 'quadruped', bodyColor: 0x9a643b, secondaryColor: 0xf5ebd8, eyeColor: 0x1c1917, scale: 1.25, bodyLength: 1.28, bodyHeight: 0.5, shoulderHeight: 0.96, neckLength: 0.46, earStyle: 'pointed', tailStyle: 'cotton', walkSpeed: 2.6, fleeSpeed: 14.5, collisionRadius: 0.82, reactionSound: 'squeak' },
  { id: 'elk_stag', name: 'Mountain Elk Stag', habitat: 'mountain', locomotion: 'quadruped', bodyColor: 0x7a4f30, secondaryColor: 0x452719, eyeColor: 0x1c1917, scale: 1.48, bodyLength: 1.56, bodyHeight: 0.62, shoulderHeight: 1.18, neckLength: 0.54, earStyle: 'antlers', tailStyle: 'short', walkSpeed: 2.4, fleeSpeed: 13.8, collisionRadius: 0.98, reactionSound: 'growl' },
  { id: 'timber_wolf', name: 'Timber Wolf', habitat: 'mountain', locomotion: 'quadruped', bodyColor: 0x64748b, secondaryColor: 0xcbd5e1, eyeColor: 0xfacc15, scale: 1.12, bodyLength: 1.08, bodyHeight: 0.42, shoulderHeight: 0.72, neckLength: 0.28, earStyle: 'pointed', tailStyle: 'bushy', walkSpeed: 3.1, fleeSpeed: 13.5, collisionRadius: 0.72, reactionSound: 'growl' },
  { id: 'grizzly_bear', name: 'Grizzly Bear', habitat: 'mountain', locomotion: 'quadruped', bodyColor: 0x4a2f1d, secondaryColor: 0x2b190e, eyeColor: 0x1c1917, scale: 1.52, bodyLength: 1.62, bodyHeight: 0.84, shoulderHeight: 1.05, neckLength: 0.32, earStyle: 'rounded', tailStyle: 'short', walkSpeed: 2.3, fleeSpeed: 11.2, collisionRadius: 1.05, reactionSound: 'growl' },
  { id: 'mountain_cougar', name: 'Mountain Cougar', habitat: 'desert', locomotion: 'quadruped', bodyColor: 0xb88652, secondaryColor: 0xe6d2b5, eyeColor: 0xfacc15, scale: 1.16, bodyLength: 1.24, bodyHeight: 0.4, shoulderHeight: 0.68, neckLength: 0.28, earStyle: 'rounded', tailStyle: 'long', walkSpeed: 3.0, fleeSpeed: 15.0, collisionRadius: 0.75, reactionSound: 'growl' },
  { id: 'bighorn_ram', name: 'Bighorn Ram', habitat: 'mountain', locomotion: 'quadruped', bodyColor: 0x857363, secondaryColor: 0xd6cfc7, eyeColor: 0x1c1917, scale: 1.22, bodyLength: 1.18, bodyHeight: 0.52, shoulderHeight: 0.82, neckLength: 0.3, earStyle: 'horns', tailStyle: 'short', walkSpeed: 2.2, fleeSpeed: 11.8, collisionRadius: 0.78, reactionSound: 'growl' },
];

export interface HumanArchetypeSpec {
  id: HumanArchetype;
  name: string;
  shirtHex: number;
  pantsHex: number;
  skinHex: number;
  hairHex: number;
  hatHex?: number;
  hatStyle?: 'cap' | 'helmet' | 'visor' | 'none';
  prop?: 'briefcase' | 'backpack' | 'surfboard' | 'badge';
}

export const HUMAN_ARCHETYPES: HumanArchetypeSpec[] = [
  { id: 'business', name: 'Downtown Executive', shirtHex: 0x1e293b, pantsHex: 0x0f172a, skinHex: 0xe0b494, hairHex: 0x271911, prop: 'briefcase' },
  { id: 'jogger', name: 'Vespucci Jogger', shirtHex: 0x06b6d4, pantsHex: 0x18181b, skinHex: 0xc68b65, hairHex: 0x1c1917, hatHex: 0xf43f5e, hatStyle: 'cap' },
  { id: 'beachgoer', name: 'Beachgoer', shirtHex: 0xf97316, pantsHex: 0xfef08a, skinHex: 0xd49e7a, hairHex: 0xb45309, hatStyle: 'none', prop: 'surfboard' },
  { id: 'officer', name: 'LSPD Officer', shirtHex: 0x1d4ed8, pantsHex: 0x0f172a, skinHex: 0xdba888, hairHex: 0x1c1917, hatHex: 0x172554, hatStyle: 'cap', prop: 'badge' },
  { id: 'worker', name: 'La Mesa Builder', shirtHex: 0xf59e0b, pantsHex: 0x334155, skinHex: 0x8d5534, hairHex: 0x18181b, hatHex: 0xfacc15, hatStyle: 'helmet' },
  { id: 'streetwear', name: 'LS Streetwear Teen', shirtHex: 0x9333ea, pantsHex: 0x27272a, skinHex: 0xa36842, hairHex: 0x09090b, hatHex: 0xef4444, hatStyle: 'cap' },
  { id: 'hiker', name: 'Vinewood Hiker', shirtHex: 0x15803d, pantsHex: 0x78563a, skinHex: 0xe4bca0, hairHex: 0x713f12, hatHex: 0xd97706, hatStyle: 'cap', prop: 'backpack' },
  { id: 'tourist', name: 'Vinewood Tourist', shirtHex: 0xe11d48, pantsHex: 0xe2e8f0, skinHex: 0xd8a888, hairHex: 0x523222, prop: 'backpack' },
];

export interface LivingActorRecord {
  id: string;
  label: string;
  category: 'human' | 'animal';
  speciesId?: AnimalSpecies;
  archetypeId?: HumanArchetype;
  homeX: number;
  homeZ: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  wanderAngle: number;
  wanderTimer: number;
  reaction: LivingReactionState;
  reactionTimer: number;
  isDying: boolean;
  respawnTimer: number;
  bloodTrailTimer: number;
  coinReward: number;
  tumbleRoll: number;
  tumblePitch: number;
  hitCount: number;
  walkSpeed: number;
  fleeSpeed: number;
  collisionRadius: number;
  locomotion: 'biped' | 'quadruped' | 'hop' | 'bird';
  soundKind: 'shout' | 'bark' | 'meow' | 'chirp' | 'growl' | 'squeak';
  phaseOffset: number;
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  limbs: THREE.Object3D[]; // [FL/LArm, FR/RArm, RL/LLeg, RR/RLeg]
  tailOrWingL?: THREE.Object3D;
  wingR?: THREE.Object3D;
  cachedFloorY: number;
}

export interface HitReactionEvent {
  actorId: string;
  label: string;
  category: 'human' | 'animal';
  sound: LivingActorRecord['soundKind'];
  speedKmh: number;
  isKill?: boolean;
  coinsAwarded?: number;
}

interface RigSharedMaterials {
  shoeMat: THREE.MeshStandardMaterial;
  badgeMat: THREE.MeshStandardMaterial;
  briefcaseMat: THREE.MeshStandardMaterial;
  backpackMat: THREE.MeshStandardMaterial;
  surfboardMat: THREE.MeshStandardMaterial;
  beakMat: THREE.MeshStandardMaterial;
  antlerMat: THREE.MeshStandardMaterial;
  noseDarkMat: THREE.MeshStandardMaterial;
  nosePinkMat: THREE.MeshStandardMaterial;
  getMatByColor: (colorHex: number, roughness: number) => THREE.MeshStandardMaterial;
}

interface RigSharedGeometries {
  box: THREE.BoxGeometry;
  sphere: THREE.SphereGeometry;
  hemiSphere: THREE.SphereGeometry;
  cylinder: THREE.CylinderGeometry;
  cone: THREE.ConeGeometry;
  capsule: THREE.CapsuleGeometry;
  hornTorus: THREE.TorusGeometry;
}

function createRigSharedGeometries(): RigSharedGeometries {
  return {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 8, 6),
    hemiSphere: new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.56),
    cylinder: new THREE.CylinderGeometry(1, 0.9, 1, 7),
    cone: new THREE.ConeGeometry(1, 1, 5),
    capsule: new THREE.CapsuleGeometry(0.5, 1, 3, 5),
    hornTorus: new THREE.TorusGeometry(1, 0.14, 5, 10, Math.PI * 1.25),
  };
}

function freezeMesh(mesh: THREE.Mesh): THREE.Mesh {
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

function createRigSharedMaterials(): RigSharedMaterials {
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  return {
    shoeMat: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 }),
    badgeMat: new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 }),
    briefcaseMat: new THREE.MeshStandardMaterial({ color: 0x3f2314, roughness: 0.55 }),
    backpackMat: new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.7 }),
    surfboardMat: new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.3 }),
    beakMat: new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 }),
    antlerMat: new THREE.MeshStandardMaterial({ color: 0xe7d8c5, roughness: 0.65 }),
    noseDarkMat: new THREE.MeshStandardMaterial({ color: 0x18181b }),
    nosePinkMat: new THREE.MeshStandardMaterial({ color: 0xfda4af }),
    getMatByColor: (colorHex: number, roughness: number) => {
      const key = `${colorHex}_${roughness.toFixed(2)}`;
      let mat = matCache.get(key);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness });
        matCache.set(key, mat);
      }
      return mat;
    },
  };
}

function computeAnimalCoinReward(spec: AnimalSpeciesSpec): number {
  if (spec.collisionRadius >= 0.78) return 25;
  if (spec.collisionRadius >= 0.55) return 15;
  return 10;
}

function buildHumanRig(
  spec: HumanArchetypeSpec,
  shared: RigSharedMaterials,
  geos: RigSharedGeometries,
): {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  limbs: THREE.Object3D[];
} {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = shared.getMatByColor(spec.skinHex, 0.72);
  const shirtMat = shared.getMatByColor(spec.shirtHex, 0.68);
  const pantsMat = shared.getMatByColor(spec.pantsHex, 0.8);
  const hairMat = shared.getMatByColor(spec.hairHex, 0.85);
  const shoeMat = shared.shoeMat;

  const pelvis = new THREE.Mesh(geos.box, pantsMat);
  pelvis.scale.set(0.32, 0.14, 0.2);
  pelvis.position.set(0, 0.88, 0);
  bodyPivot.add(freezeMesh(pelvis));

  const torso = new THREE.Mesh(geos.cylinder, shirtMat);
  torso.scale.set(0.2, 0.54, 0.14);
  torso.position.set(0, 1.2, 0);
  bodyPivot.add(freezeMesh(torso));

  if (spec.prop === 'badge') {
    const chestBadge = new THREE.Mesh(geos.box, shared.badgeMat);
    chestBadge.scale.set(0.08, 0.09, 0.03);
    chestBadge.position.set(0.08, 1.32, 0.14);
    bodyPivot.add(freezeMesh(chestBadge));
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0);
  bodyPivot.add(headGroup);

  const neck = new THREE.Mesh(geos.cylinder, skinMat);
  neck.scale.set(0.068, 0.12, 0.068);
  neck.position.set(0, -0.02, 0);
  headGroup.add(freezeMesh(neck));

  const cranium = new THREE.Mesh(geos.sphere, skinMat);
  cranium.position.set(0, 0.11, 0);
  cranium.scale.set(0.124, 0.146, 0.13);
  headGroup.add(freezeMesh(cranium));

  const nose = new THREE.Mesh(geos.box, skinMat);
  nose.scale.set(0.03, 0.04, 0.04);
  nose.position.set(0, 0.1, 0.13);
  headGroup.add(freezeMesh(nose));

  const hair = new THREE.Mesh(geos.hemiSphere, hairMat);
  hair.scale.setScalar(0.14);
  hair.position.set(0, 0.125, -0.015);
  headGroup.add(freezeMesh(hair));

  if (spec.hatStyle === 'cap' || spec.hatStyle === 'helmet') {
    const hatMat = shared.getMatByColor(spec.hatHex ?? 0x334155, 0.45);
    const crown = new THREE.Mesh(geos.hemiSphere, hatMat);
    crown.scale.setScalar(0.148);
    crown.position.set(0, 0.14, 0);
    headGroup.add(freezeMesh(crown));
    const brim = new THREE.Mesh(geos.box, hatMat);
    brim.scale.set(0.18, 0.025, 0.12);
    brim.position.set(0, 0.16, 0.14);
    headGroup.add(freezeMesh(brim));
  }

  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.25, 1.42, 0);
    const sleeve = new THREE.Mesh(geos.cylinder, shirtMat);
    sleeve.scale.set(0.052, 0.28, 0.052);
    sleeve.position.set(0, -0.14, 0);
    pivot.add(freezeMesh(sleeve));
    const forearm = new THREE.Mesh(geos.cylinder, skinMat);
    forearm.scale.set(0.04, 0.26, 0.04);
    forearm.position.set(0, -0.38, 0.03);
    forearm.rotation.x = -0.22;
    pivot.add(freezeMesh(forearm));
    const hand = new THREE.Mesh(geos.sphere, skinMat);
    hand.scale.setScalar(0.04);
    hand.position.set(0, -0.51, 0.06);
    pivot.add(freezeMesh(hand));
    if (side > 0 && spec.prop === 'briefcase') {
      const bag = new THREE.Mesh(geos.box, shared.briefcaseMat);
      bag.scale.set(0.09, 0.28, 0.36);
      bag.position.set(0.05, -0.64, 0.06);
      pivot.add(freezeMesh(bag));
    }
    bodyPivot.add(pivot);
    return pivot;
  };

  const makeLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11, 0.85, 0);
    const thigh = new THREE.Mesh(geos.cylinder, pantsMat);
    thigh.scale.set(0.072, 0.42, 0.072);
    thigh.position.set(0, -0.21, 0);
    pivot.add(freezeMesh(thigh));
    const calf = new THREE.Mesh(geos.cylinder, pantsMat);
    calf.scale.set(0.052, 0.38, 0.052);
    calf.position.set(0, -0.58, 0);
    pivot.add(freezeMesh(calf));
    const shoe = new THREE.Mesh(geos.box, shoeMat);
    shoe.scale.set(0.095, 0.08, 0.22);
    shoe.position.set(0, -0.8, 0.045);
    pivot.add(freezeMesh(shoe));
    bodyPivot.add(pivot);
    return pivot;
  };

  if (spec.prop === 'backpack') {
    const pack = new THREE.Mesh(geos.box, shared.backpackMat);
    pack.scale.set(0.28, 0.36, 0.16);
    pack.position.set(0, 1.24, -0.17);
    bodyPivot.add(freezeMesh(pack));
  } else if (spec.prop === 'surfboard') {
    const board = new THREE.Mesh(geos.box, shared.surfboardMat);
    board.scale.set(0.42, 1.45, 0.06);
    board.position.set(0.32, 1.12, 0.05);
    board.rotation.x = 0.25;
    bodyPivot.add(freezeMesh(board));
  }

  const lArm = makeArm(1);
  const rArm = makeArm(-1);
  const lLeg = makeLeg(1);
  const rLeg = makeLeg(-1);

  return { root, bodyPivot, headGroup, limbs: [lArm, rArm, lLeg, rLeg] };
}

function buildAnimalRig(
  spec: AnimalSpeciesSpec,
  shared: RigSharedMaterials,
  geos: RigSharedGeometries,
): {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  limbs: THREE.Object3D[];
  tailOrWingL?: THREE.Object3D;
  wingR?: THREE.Object3D;
} {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const primaryMat = shared.getMatByColor(spec.bodyColor, 0.82);
  const secondaryMat = shared.getMatByColor(spec.secondaryColor, 0.78);
  const eyeMat = shared.getMatByColor(spec.eyeColor, 0.2);
  const beakMat = shared.beakMat;

  if (spec.locomotion === 'bird') {
    const legH = 0.14;
    const torso = new THREE.Mesh(geos.sphere, primaryMat);
    torso.scale.set(0.12, 0.125, 0.22);
    torso.position.set(0, legH + 0.11, 0);
    bodyPivot.add(freezeMesh(torso));

    const breast = new THREE.Mesh(geos.sphere, secondaryMat);
    breast.scale.setScalar(0.13);
    breast.position.set(0, legH + 0.1, 0.08);
    bodyPivot.add(freezeMesh(breast));

    const headGroup = new THREE.Group();
    headGroup.position.set(0, legH + 0.22, 0.19);
    const head = new THREE.Mesh(
      geos.sphere,
      spec.id === 'bald_eagle' || spec.id === 'mallard_duck' ? secondaryMat : primaryMat,
    );
    head.scale.setScalar(0.095);
    headGroup.add(freezeMesh(head));

    const beak = new THREE.Mesh(geos.cone, beakMat);
    beak.scale.set(0.036, 0.12, 0.036);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.01, 0.12);
    headGroup.add(freezeMesh(beak));

    for (const ex of [-0.055, 0.055]) {
      const eye = new THREE.Mesh(geos.sphere, eyeMat);
      eye.scale.setScalar(0.018);
      eye.position.set(ex, 0.025, 0.065);
      headGroup.add(freezeMesh(eye));
    }
    bodyPivot.add(headGroup);

    const wingLPivot = new THREE.Group();
    wingLPivot.position.set(0.08, legH + 0.14, 0.02);
    const wingLMesh = new THREE.Mesh(geos.box, primaryMat);
    wingLMesh.scale.set(0.38, 0.028, 0.19);
    wingLMesh.position.set(0.18, 0, -0.02);
    wingLPivot.add(freezeMesh(wingLMesh));
    bodyPivot.add(wingLPivot);

    const wingRPivot = new THREE.Group();
    wingRPivot.position.set(-0.08, legH + 0.14, 0.02);
    const wingRMesh = new THREE.Mesh(geos.box, primaryMat);
    wingRMesh.scale.set(0.38, 0.028, 0.19);
    wingRMesh.position.set(-0.18, 0, -0.02);
    wingRPivot.add(freezeMesh(wingRMesh));
    bodyPivot.add(wingRPivot);

    const tailFan = new THREE.Mesh(geos.box, secondaryMat);
    tailFan.scale.set(0.14, 0.025, 0.18);
    tailFan.position.set(0, legH + 0.12, -0.24);
    tailFan.rotation.x = 0.22;
    bodyPivot.add(freezeMesh(tailFan));

    const makeBirdLeg = (sx: number) => {
      const l = new THREE.Mesh(geos.cylinder, beakMat);
      l.scale.set(0.012, legH, 0.012);
      l.position.set(sx * 0.06, legH * 0.5, 0);
      bodyPivot.add(freezeMesh(l));
      return l;
    };
    const lLeg = makeBirdLeg(1);
    const rLeg = makeBirdLeg(-1);

    root.scale.setScalar(spec.scale);
    return {
      root,
      bodyPivot,
      headGroup,
      limbs: [lLeg, rLeg],
      tailOrWingL: wingLPivot,
      wingR: wingRPivot,
    };
  }

  const L = spec.bodyLength;
  const H = spec.bodyHeight;
  const shY = spec.shoulderHeight;
  const legLen = Math.max(0.12, shY - H * 0.35);

  const chest = new THREE.Mesh(geos.sphere, primaryMat);
  chest.scale.set(H * 0.4, H * 0.47, H * 0.7);
  chest.position.set(0, shY, L * 0.14);
  bodyPivot.add(freezeMesh(chest));

  const belly = new THREE.Mesh(geos.cylinder, primaryMat);
  belly.scale.set(H * 0.41, L * 0.65, H * 0.41);
  belly.rotation.x = Math.PI / 2;
  belly.position.set(0, shY - 0.02, 0);
  bodyPivot.add(freezeMesh(belly));

  const rump = new THREE.Mesh(geos.sphere, primaryMat);
  rump.scale.set(H * 0.36, H * 0.4, H * 0.53);
  rump.position.set(0, shY - 0.02, -L * 0.26);
  bodyPivot.add(freezeMesh(rump));

  if (spec.id === 'dalmatian') {
    for (const [sx, sy, sz] of [
      [0.14, shY + 0.04, 0.1],
      [-0.14, shY + 0.05, -0.14],
      [0.12, shY - 0.02, -0.22],
    ]) {
      const spot = new THREE.Mesh(geos.sphere, secondaryMat);
      spot.scale.setScalar(0.065);
      spot.position.set(sx, sy, sz);
      bodyPivot.add(freezeMesh(spot));
    }
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, shY + spec.neckLength * 0.55, L * 0.42);
  bodyPivot.add(headGroup);

  const neck = new THREE.Mesh(geos.cylinder, primaryMat);
  neck.scale.set(H * 0.33, spec.neckLength, H * 0.33);
  neck.rotation.x = 0.55;
  neck.position.set(0, -spec.neckLength * 0.25, -spec.neckLength * 0.25);
  headGroup.add(freezeMesh(neck));

  const headSize = H * 0.42;
  const skull = new THREE.Mesh(geos.sphere, primaryMat);
  skull.scale.set(headSize * 0.9, headSize * 0.92, headSize * 1.1);
  headGroup.add(freezeMesh(skull));

  const snout = new THREE.Mesh(
    geos.box,
    spec.locomotion === 'hop' ? primaryMat : secondaryMat,
  );
  snout.scale.set(headSize * 0.95, headSize * 0.75, headSize * 1.1);
  snout.position.set(0, -headSize * 0.14, headSize * 0.92);
  headGroup.add(freezeMesh(snout));

  const nose = new THREE.Mesh(
    geos.sphere,
    spec.locomotion === 'hop' ? shared.nosePinkMat : shared.noseDarkMat,
  );
  nose.scale.setScalar(headSize * 0.24);
  nose.position.set(0, -headSize * 0.05, headSize * 1.48);
  headGroup.add(freezeMesh(nose));

  for (const ex of [-1, 1]) {
    const eye = new THREE.Mesh(geos.sphere, eyeMat);
    eye.scale.setScalar(headSize * 0.16);
    eye.position.set(ex * headSize * 0.58, headSize * 0.24, headSize * 0.72);
    headGroup.add(freezeMesh(eye));
  }

  for (const side of [-1, 1]) {
    if (spec.earStyle === 'long') {
      const ear = new THREE.Mesh(geos.capsule, primaryMat);
      ear.scale.set(0.064, 0.12, 0.064);
      ear.position.set(side * headSize * 0.48, headSize * 1.35, -headSize * 0.15);
      ear.rotation.z = side * -0.18;
      ear.rotation.x = -0.15;
      headGroup.add(freezeMesh(ear));
    } else if (spec.earStyle === 'pointed') {
      const ear = new THREE.Mesh(geos.cone, primaryMat);
      ear.scale.set(headSize * 0.34, headSize * 0.85, headSize * 0.34);
      ear.position.set(side * headSize * 0.55, headSize * 0.9, -headSize * 0.1);
      ear.rotation.z = side * -0.22;
      headGroup.add(freezeMesh(ear));
    } else if (spec.earStyle === 'floppy') {
      const ear = new THREE.Mesh(geos.box, secondaryMat);
      ear.scale.set(0.04, headSize * 0.95, headSize * 0.65);
      ear.position.set(side * headSize * 0.92, -headSize * 0.05, -0.02);
      ear.rotation.z = side * 0.28;
      headGroup.add(freezeMesh(ear));
    } else if (spec.earStyle === 'rounded') {
      const ear = new THREE.Mesh(geos.sphere, secondaryMat);
      ear.scale.setScalar(headSize * 0.32);
      ear.position.set(side * headSize * 0.65, headSize * 0.72, -0.02);
      headGroup.add(freezeMesh(ear));
    } else if (spec.earStyle === 'horns') {
      const horn = new THREE.Mesh(geos.hornTorus, secondaryMat);
      horn.scale.setScalar(headSize * 0.8);
      horn.position.set(side * headSize * 0.85, headSize * 0.4, -0.02);
      horn.rotation.y = side * (Math.PI * 0.45);
      headGroup.add(freezeMesh(horn));
    } else if (spec.earStyle === 'antlers') {
      const antlerMat = shared.antlerMat;
      const stem = new THREE.Mesh(geos.cylinder, antlerMat);
      stem.scale.set(0.028, 0.56, 0.028);
      stem.position.set(side * 0.16, headSize * 1.45, -0.05);
      stem.rotation.z = side * -0.42;
      stem.rotation.x = -0.25;
      headGroup.add(freezeMesh(stem));
      const tine = new THREE.Mesh(geos.cylinder, antlerMat);
      tine.scale.set(0.019, 0.3, 0.019);
      tine.position.set(side * 0.24, headSize * 1.65, 0.08);
      tine.rotation.x = 0.5;
      headGroup.add(freezeMesh(tine));
    }
  }

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, shY + 0.04, -L * 0.44);
  if (spec.tailStyle === 'cotton') {
    const puff = new THREE.Mesh(geos.sphere, secondaryMat);
    puff.scale.setScalar(0.075);
    tailPivot.add(freezeMesh(puff));
  } else if (spec.tailStyle === 'bushy') {
    const brush = new THREE.Mesh(geos.capsule, primaryMat);
    brush.scale.set(0.136, L * 0.22, 0.136);
    brush.rotation.x = 1.1;
    brush.position.set(0, 0.06, -L * 0.16);
    tailPivot.add(freezeMesh(brush));
  } else if (spec.tailStyle === 'long') {
    const tail = new THREE.Mesh(geos.cylinder, primaryMat);
    tail.scale.set(0.032, L * 0.36, 0.032);
    tail.rotation.x = 1.05;
    tail.position.set(0, 0.08, -L * 0.18);
    tailPivot.add(freezeMesh(tail));
  } else {
    const stub = new THREE.Mesh(geos.cone, primaryMat);
    stub.scale.set(0.04, 0.14, 0.04);
    stub.rotation.x = -1.2;
    tailPivot.add(freezeMesh(stub));
  }
  bodyPivot.add(tailPivot);

  const makeQuadLeg = (xPos: number, zPos: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xPos, shY - H * 0.15, zPos);
    const legRad = clamp(H * 0.16, 0.03, 0.11);
    const legMesh = new THREE.Mesh(geos.cylinder, primaryMat);
    legMesh.scale.set(legRad, legLen, legRad);
    legMesh.position.set(0, -legLen * 0.5, 0);
    legPivot.add(freezeMesh(legMesh));
    const paw = new THREE.Mesh(geos.box, secondaryMat);
    paw.scale.set(legRad * 2.1, legRad * 1.1, legRad * 2.4);
    paw.position.set(0, -legLen, legRad * 0.35);
    legPivot.add(freezeMesh(paw));
    bodyPivot.add(legPivot);
    return legPivot;
  };

  const legX = H * 0.34;
  const fl = makeQuadLeg(legX, L * 0.25);
  const fr = makeQuadLeg(-legX, L * 0.25);
  const rl = makeQuadLeg(legX, -L * 0.28);
  const rr = makeQuadLeg(-legX, -L * 0.28);

  root.scale.setScalar(spec.scale);
  return { root, bodyPivot, headGroup, limbs: [fl, fr, rl, rr], tailOrWingL: tailPivot };
}

const BLOOD_DROP_COUNT = 160;
const BLOOD_POOL_COUNT = 80;
const _bloodScratch = new THREE.Object3D();

interface BloodDropParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
}

interface BloodPoolDecal {
  active: boolean;
  x: number;
  y: number;
  z: number;
  radius: number;
  targetRadius: number;
  age: number;
  maxAge: number;
}

export class LivingWorldController {
  public readonly group = new THREE.Group();
  public readonly actors: LivingActorRecord[] = [];
  public readonly mode: GameMode;
  private hitTotal = 0;
  private killTotal = 0;
  private tickCount = 0;
  private sharedMaterials = createRigSharedMaterials();
  private sharedGeometries = createRigSharedGeometries();

  private bloodDropGeo: THREE.SphereGeometry;
  private bloodDropMat: THREE.MeshStandardMaterial;
  private bloodDropMesh: THREE.InstancedMesh;
  private bloodDrops: BloodDropParticle[] = [];
  private bloodDropCursor = 0;

  private bloodPoolGeo: THREE.CircleGeometry;
  private bloodPoolMat: THREE.MeshBasicMaterial;
  private bloodPoolMesh: THREE.InstancedMesh;
  private bloodPools: BloodPoolDecal[] = [];
  private bloodPoolCursor = 0;

  constructor(private mapId: MapId, mode: GameMode = 'race1p') {
    this.mode = mode;

    this.bloodDropGeo = new THREE.SphereGeometry(0.085, 5, 4);
    this.bloodDropMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.22,
      metalness: 0.08,
    });
    this.bloodDropMesh = new THREE.InstancedMesh(
      this.bloodDropGeo,
      this.bloodDropMat,
      BLOOD_DROP_COUNT,
    );
    this.bloodDropMesh.frustumCulled = false;
    this.bloodDropMesh.count = 0;
    this.group.add(this.bloodDropMesh);

    for (let i = 0; i < BLOOD_DROP_COUNT; i++) {
      this.bloodDrops.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
      });
    }

    this.bloodPoolGeo = new THREE.CircleGeometry(1, 10);
    this.bloodPoolGeo.rotateX(-Math.PI / 2);
    this.bloodPoolMat = new THREE.MeshBasicMaterial({
      color: 0x6b0f0f,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.bloodPoolMesh = new THREE.InstancedMesh(
      this.bloodPoolGeo,
      this.bloodPoolMat,
      BLOOD_POOL_COUNT,
    );
    this.bloodPoolMesh.frustumCulled = false;
    this.bloodPoolMesh.count = 0;
    this.group.add(this.bloodPoolMesh);

    for (let i = 0; i < BLOOD_POOL_COUNT; i++) {
      this.bloodPools.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        radius: 0.2,
        targetRadius: 1,
        age: 0,
        maxAge: 18,
      });
    }

    this.populateActors();
  }

  private spawnBloodBurst(
    x: number,
    y: number,
    z: number,
    carVx: number,
    carVz: number,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const idx = this.bloodDropCursor;
      this.bloodDropCursor = (this.bloodDropCursor + 1) % BLOOD_DROP_COUNT;
      const d = this.bloodDrops[idx];
      const angle = (i * 2.39996 + (this.hitTotal + idx) * 0.71) % (Math.PI * 2);
      const speed = 2.8 + ((i * 19 + idx * 7) % 10) * 0.65;
      d.active = true;
      d.x = x + Math.cos(angle) * 0.25;
      d.y = y + 0.15 + (i % 4) * 0.12;
      d.z = z + Math.sin(angle) * 0.25;
      d.vx = Math.cos(angle) * speed + carVx * 0.28;
      d.vz = Math.sin(angle) * speed + carVz * 0.28;
      d.vy = 2.6 + ((i * 13) % 8) * 0.55;
      d.maxLife = 0.8 + ((i * 5) % 5) * 0.12;
      d.life = d.maxLife;
      d.size = 0.75 + ((i * 3) % 5) * 0.24;
    }
  }

  private spawnBloodPool(x: number, y: number, z: number, targetRadius: number): void {
    const idx = this.bloodPoolCursor;
    this.bloodPoolCursor = (this.bloodPoolCursor + 1) % BLOOD_POOL_COUNT;
    const p = this.bloodPools[idx];
    p.active = true;
    p.x = x;
    p.y = y + 0.045;
    p.z = z;
    p.radius = Math.max(0.22, targetRadius * 0.28);
    p.targetRadius = targetRadius;
    p.age = 0;
    p.maxAge = 20;
  }

  private updateBloodEffects(safeDt: number): void {
    let dropActiveCount = 0;
    for (let i = 0; i < BLOOD_DROP_COUNT; i++) {
      const d = this.bloodDrops[i];
      if (!d.active) continue;
      d.life -= safeDt;
      if (d.life <= 0) {
        d.active = false;
        continue;
      }
      d.vy -= 19.5 * safeDt;
      d.x += d.vx * safeDt;
      d.z += d.vz * safeDt;
      d.y += d.vy * safeDt;

      const floor = groundHeightAt(d.x, d.z, this.mapId);
      if (d.y <= floor + 0.04) {
        d.active = false;
        if (d.size > 1.15) {
          this.spawnBloodPool(d.x, floor, d.z, 0.42 + d.size * 0.18);
        }
        continue;
      }

      const lifeFrac = clamp(d.life / d.maxLife, 0, 1);
      _bloodScratch.position.set(d.x, d.y, d.z);
      _bloodScratch.rotation.set(0, 0, 0);
      _bloodScratch.scale.setScalar(d.size * (0.45 + lifeFrac * 0.65));
      _bloodScratch.updateMatrix();
      this.bloodDropMesh.setMatrixAt(dropActiveCount, _bloodScratch.matrix);
      dropActiveCount++;
    }
    this.bloodDropMesh.count = dropActiveCount;
    if (dropActiveCount > 0) {
      this.bloodDropMesh.instanceMatrix.needsUpdate = true;
    }

    let poolActiveCount = 0;
    for (let i = 0; i < BLOOD_POOL_COUNT; i++) {
      const p = this.bloodPools[i];
      if (!p.active) continue;
      p.age += safeDt;
      if (p.age >= p.maxAge) {
        p.active = false;
        continue;
      }
      // Rapid initial spill expansion, gentle fade shrink in final 3 seconds
      const growT = 1 - Math.exp(-5.5 * safeDt);
      p.radius += (p.targetRadius - p.radius) * growT;
      const fadeFrac = p.age > p.maxAge - 3 ? clamp((p.maxAge - p.age) / 3, 0, 1) : 1;

      _bloodScratch.position.set(p.x, p.y, p.z);
      _bloodScratch.rotation.set(0, (i * 1.17) % (Math.PI * 2), 0);
      _bloodScratch.scale.set(p.radius * fadeFrac, 1, p.radius * 0.84 * fadeFrac);
      _bloodScratch.updateMatrix();
      this.bloodPoolMesh.setMatrixAt(poolActiveCount, _bloodScratch.matrix);
      poolActiveCount++;
    }
    this.bloodPoolMesh.count = poolActiveCount;
    if (poolActiveCount > 0) {
      this.bloodPoolMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public spawnExternalBlood(
    x: number,
    y: number,
    z: number,
    vx = 0,
    vz = 0,
    burstCount = 18,
    poolRadius = 1.1,
  ): void {
    this.spawnBloodBurst(x, y, z, vx, vz, burstCount);
    const floor = groundHeightAt(x, z, this.mapId);
    if (poolRadius > 0) {
      this.spawnBloodPool(x, floor, z, poolRadius);
    }
  }

  public attackActorsWithWeapon(
    originX: number,
    originY: number,
    originZ: number,
    aimYaw: number,
    range: number,
    hitHalfWidth: number,
    onHit?: (evt: HitReactionEvent) => void,
    isBlockedByWall?: (tx: number, tz: number) => boolean,
  ): number {
    const dirX = Math.sin(aimYaw);
    const dirZ = Math.cos(aimYaw);
    let kills = 0;

    for (let i = 0; i < this.actors.length; i++) {
      const a = this.actors[i];
      if (a.reaction === 'dead' || a.isDying) continue;

      const dx = a.x - originX;
      const dz = a.z - originZ;
      const dist = Math.hypot(dx, dz);
      if (dist > range + a.collisionRadius) continue;
      if (Math.abs(a.y - originY) > 6.5) continue;

      // Strict manual aim check along the player's aimed bullet ray (no auto-aim cone)
      const forwardProj = dx * dirX + dz * dirZ;
      if (forwardProj < -0.25 || forwardProj > range + a.collisionRadius) continue;
      const perpDist = Math.abs(dx * dirZ - dz * dirX);
      if (perpDist > a.collisionRadius + hitHalfWidth) continue;

      if (isBlockedByWall && isBlockedByWall(a.x, a.z)) continue;

      a.reaction = 'knocked';
      a.isDying = true;
      a.reactionTimer = 0.48;
      a.bloodTrailTimer = 0.06;
      a.hitCount += 1;
      this.hitTotal += 1;
      this.killTotal += 1;
      kills += 1;

      const pushDirX = dist > 0.01 ? dx / dist : dirX;
      const pushDirZ = dist > 0.01 ? dz / dist : dirZ;
      a.vx = pushDirX * 8.5;
      a.vz = pushDirZ * 8.5;
      a.vy = 4.6;
      a.tumblePitch = 0.5;
      a.tumbleRoll = (dx >= 0 ? 1 : -1) * 0.7;

      this.spawnBloodBurst(
        a.x,
        a.y + (a.category === 'human' ? 0.9 : 0.4),
        a.z,
        a.vx,
        a.vz,
        24,
      );
      const floorAtHit = groundHeightAt(a.x, a.z, this.mapId);
      this.spawnBloodPool(a.x, floorAtHit, a.z, 1.15 + a.collisionRadius * 0.7);

      onHit?.({
        actorId: a.id,
        label: a.label,
        category: a.category,
        sound: a.soundKind,
        speedKmh: 50,
        isKill: true,
        coinsAwarded: a.coinReward,
      });
    }

    return kills;
  }

  private populateActors(): void {
    const world = getMapWorldData(this.mapId);
    const pts = world.roadPoints;

    const nearestRoadInfo = (x: number, z: number): { dist: number; nx: number; nz: number } => {
      let bestDist = Infinity;
      let bestIdx = 0;
      for (let i = 0; i < pts.length; i += 2) {
        const d = Math.hypot(x - pts[i].x, z - pts[i].z);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      // Also check Downtown LS North-South avenue (x=0, z in [-2650, -1420]) and East-West avenues (z=-1820, z=-1485)
      if (z <= -1400 && z >= -2650) {
        const dMainAve = Math.abs(x);
        if (dMainAve < bestDist) {
          return { dist: dMainAve, nx: x >= 0 ? 1 : -1, nz: 0 };
        }
      }
      if (x >= -1080 && x <= 780) {
        const dCross1 = Math.abs(z - -1820);
        if (dCross1 < bestDist) {
          return { dist: dCross1, nx: 0, nz: z >= -1820 ? 1 : -1 };
        }
        const dCross2 = Math.abs(z - -1485);
        if (dCross2 < bestDist) {
          return { dist: dCross2, nx: 0, nz: z >= -1485 ? 1 : -1 };
        }
      }
      const p0 = pts[bestIdx];
      const p1 = pts[(bestIdx + 1) % pts.length];
      const tx = p1.x - p0.x;
      const tz = p1.z - p0.z;
      const len = Math.hypot(tx, tz) || 1;
      const rnx = -tz / len;
      const rnz = tx / len;
      const side = (x - p0.x) * rnx + (z - p0.z) * rnz >= 0 ? 1 : -1;
      return { dist: bestDist, nx: rnx * side, nz: rnz * side };
    };

    // Push any ground animal coordinate onto grass well clear of all roads (min 28m from road centerlines)
    const ensureGrassPosition = (x: number, z: number, minGrassDist = 28): [number, number] => {
      let cx = x;
      let cz = z;
      for (let iter = 0; iter < 3; iter++) {
        const info = nearestRoadInfo(cx, cz);
        if (info.dist < minGrassDist) {
          const push = minGrassDist - info.dist + 4;
          cx += info.nx * push;
          cz += info.nz * push;
        }
      }
      return [cx, cz];
    };

    const spawnHuman = (arch: HumanArchetype, x: number, z: number, idx: number, customLabel?: string) => {
      const spec = HUMAN_ARCHETYPES.find((h) => h.id === arch) ?? HUMAN_ARCHETYPES[0];
      const rig = buildHumanRig(spec, this.sharedMaterials, this.sharedGeometries);
      const y = groundHeightAt(x, z, this.mapId);
      rig.root.position.set(x, y, z);
      this.group.add(rig.root);
      this.actors.push({
        id: `human-${idx}`,
        label: customLabel ?? spec.name,
        category: 'human',
        archetypeId: spec.id,
        homeX: x,
        homeZ: z,
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: (idx * 1.4) % (Math.PI * 2),
        wanderAngle: idx % 2 === 0 ? 0 : Math.PI,
        wanderTimer: 2 + (idx % 4),
        reaction: 'calm',
        reactionTimer: 0,
        isDying: false,
        respawnTimer: 0,
        bloodTrailTimer: 0,
        coinReward: spec.id === 'officer' || spec.id === 'business' ? 25 : 20,
        tumbleRoll: 0,
        tumblePitch: 0,
        hitCount: 0,
        walkSpeed: 1.55 + (idx % 3) * 0.3,
        fleeSpeed: 6.8,
        collisionRadius: 0.65,
        locomotion: 'biped',
        soundKind: 'shout',
        phaseOffset: idx * 0.77,
        root: rig.root,
        bodyPivot: rig.bodyPivot,
        headGroup: rig.headGroup,
        limbs: rig.limbs,
        cachedFloorY: y,
      });
    };

    const spawnAnimal = (spec: AnimalSpeciesSpec, rawX: number, rawZ: number, idx: number) => {
      const [x, z] =
        spec.habitat === 'sky' ? [rawX, rawZ] : ensureGrassPosition(rawX, rawZ, 28);
      const rig = buildAnimalRig(spec, this.sharedMaterials, this.sharedGeometries);
      const groundY = groundHeightAt(x, z, this.mapId);
      const startY = spec.habitat === 'sky' ? groundY + 18 : groundY;
      rig.root.position.set(x, startY, z);
      this.group.add(rig.root);
      this.actors.push({
        id: `animal-${spec.id}-${idx}`,
        label: spec.name,
        category: 'animal',
        speciesId: spec.id,
        homeX: x,
        homeZ: z,
        x,
        y: startY,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: (idx * 1.9) % (Math.PI * 2),
        wanderAngle: idx * 1.2,
        wanderTimer: 1.5 + (idx % 5),
        reaction: 'calm',
        reactionTimer: 0,
        isDying: false,
        respawnTimer: 0,
        bloodTrailTimer: 0,
        coinReward: computeAnimalCoinReward(spec),
        tumbleRoll: 0,
        tumblePitch: 0,
        hitCount: 0,
        walkSpeed: spec.walkSpeed,
        fleeSpeed: spec.fleeSpeed,
        collisionRadius: spec.collisionRadius,
        locomotion: spec.locomotion,
        soundKind: spec.reactionSound,
        phaseOffset: idx * 1.13,
        root: rig.root,
        bodyPivot: rig.bodyPivot,
        headGroup: rig.headGroup,
        limbs: rig.limbs,
        tailOrWingL: rig.tailOrWingL,
        wingR: rig.wingR,
        cachedFloorY: groundY,
      });
    };

    // Build painted white Zebra Crossing stripes across Downtown LS & Circuit avenues
    const zebraStripeGeo = new THREE.PlaneGeometry(1.1, 3.6);
    zebraStripeGeo.rotateX(-Math.PI / 2);
    const zebraStripeMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    const zebraCrossingsZ = [-1560, -1660, -1760, -1860, -1960, -2060];
    for (const cz of zebraCrossingsZ) {
      const gy = groundHeightAt(0, cz, this.mapId) + 0.05;
      for (let sx = -11; sx <= 11; sx += 2.2) {
        const stripe = new THREE.Mesh(zebraStripeGeo, zebraStripeMat);
        stripe.position.set(sx, gy, cz);
        this.group.add(freezeMesh(stripe));
      }
    }
    // Also add 2 Zebra Crossings on the main circuit road near the start boulevard
    for (const ptIdx of [6, 18]) {
      if (ptIdx < pts.length) {
        const cp = pts[ptIdx];
        const np = pts[(ptIdx + 1) % pts.length];
        const yaw = Math.atan2(np.x - cp.x, np.z - cp.z);
        const nx = -Math.cos(yaw);
        const nz = Math.sin(yaw);
        const gy = groundHeightAt(cp.x, cp.z, this.mapId) + 0.05;
        for (let s = -12; s <= 12; s += 2.4) {
          const stripe = new THREE.Mesh(zebraStripeGeo, zebraStripeMat);
          stripe.position.set(cp.x + nx * s, gy, cp.z + nz * s);
          stripe.rotation.y = yaw;
          this.group.add(freezeMesh(stripe));
        }
      }
    }

    // 1. Place Pedestrians strictly on Sidepaths (Sidewalks x = ±16..19m) and Zebra Crossing lines
    const humanSpots: Array<[HumanArchetype, number, number]> = [
      // Sidepaths along Downtown LS main avenue
      ['business', -17, -1620], ['business', 17, -1690], ['officer', 17.5, -1815],
      ['streetwear', -17.5, -1870], ['tourist', 18, -1935], ['business', -120, -1803],
      ['officer', -220, -1468], ['streetwear', 210, -1468], ['tourist', -40, -1468],
      // Zebra crossing pedestrians
      ['business', -6, -1560], ['tourist', 5, -1660], ['streetwear', -4, -1760],
      ['jogger', 6, -1860], ['business', -5, -1960], ['tourist', 4, -2060],
      // Vespucci & La Mesa sidepaths
      ['jogger', -895, -1580], ['beachgoer', -965, -1720], ['beachgoer', -975, -1920],
      ['tourist', -1035, -1803], ['streetwear', -1095, -1803], ['jogger', -905, -2060],
      ['worker', 690, -1610], ['worker', 745, -1803], ['worker', 540, -1803],
      ['hiker', -135, -2640], ['tourist', 17, -2420],
    ];
    humanSpots.forEach(([arch, x, z], i) => {
      spawnHuman(arch, x, z, i);
    });

    // 2. Guarantee EVERY SINGLE ONE of the 23 Animal Species appears in grass/off-road habitats (never on roads!)
    const guaranteedAnimalSpawns: Array<[AnimalSpecies, number, number]> = [
      // Urban Pets in Downtown & Vespucci grassy parks (pushed >=28m off road)
      ['golden_retriever', -42, -1640],
      ['german_shepherd', 42, -1860],
      ['dalmatian', -892, -1760],
      ['french_bulldog', -44, -1880],
      ['tabby_cat', 120, -1865],
      ['black_cat', -140, -1535],
      // Birds (City parks, Pier, Lake & Sky)
      ['pigeon', -38, -1790],
      ['seagull', -980, -1860],
      ['crow', 540, -1650],
      ['bald_eagle', -260, -740],
      ['red_hawk', -80, -2520],
      ['mallard_duck', -90, 45],
      // Small Wildlife in grass meadows
      ['cottontail_rabbit', -220, 120],
      ['jackrabbit', 190, -340],
      ['red_fox', -310, -220],
      ['gray_squirrel', -45, -2410],
      ['raccoon', 715, -1740],
      // Large Wildlife in grass & hills
      ['whitetail_deer', -340, -680],
      ['elk_stag', 290, -720],
      ['timber_wolf', -230, -820],
      ['grizzly_bear', 385, -910],
      ['mountain_cougar', -410, -270],
      ['bighorn_ram', -180, -960],
    ];

    guaranteedAnimalSpawns.forEach(([spId, x, z], idx) => {
      const spec = ANIMAL_SPECIES_LIST.find((a) => a.id === spId)!;
      spawnAnimal(spec, x, z, idx);
    });

    // 3. Second flock / herd wave across the Wildlands & Los Santos parks (+28 more in grass)
    const extraSpots: Array<[AnimalSpecies, number, number]> = [
      ['pigeon', 38, -1805], ['pigeon', -38, -1812],
      ['seagull', -1060, -1860], ['seagull', -955, -1980],
      ['golden_retriever', -905, -1865], ['tabby_cat', 56, -1530],
      ['cottontail_rabbit', 140, 130], ['cottontail_rabbit', -160, -95],
      ['whitetail_deer', -265, -490], ['whitetail_deer', 180, -410],
      ['red_fox', 240, 180], ['gray_squirrel', -190, 290],
      ['bald_eagle', 0, -1850], ['red_hawk', 560, -1900],
      ['mallard_duck', -70, -120], ['timber_wolf', 310, -490],
      ['jackrabbit', 340, 35], ['bighorn_ram', 245, -830],
      ['german_shepherd', -210, -1865], ['dalmatian', -42, -2225],
      ['raccoon', 745, -1935], ['crow', 625, -1860],
      ['grizzly_bear', -390, -840], ['mountain_cougar', 410, -630],
      ['elk_stag', -210, -560], ['french_bulldog', -898, -1660],
      ['black_cat', 88, -2225], ['mallard_duck', -990, -1640],
    ];
    extraSpots.forEach(([spId, x, z], idx) => {
      const spec = ANIMAL_SPECIES_LIST.find((a) => a.id === spId)!;
      spawnAnimal(spec, x, z, 100 + idx);
    });

    // 4. In Freestyle mode:
    //    - Animals spawn strictly in GRASS pastures alongside the road (lateralDist = 29..52m, never on roads!)
    //    - Pedestrians spawn on SIDEPATHS (sidewalks), ZEBRA CROSSINGS, and INSIDE Downtown LS Enterable Houses!
    if (this.mode === 'freestyle') {
      const roadPts = world.roadPoints;
      const startPt = roadPts[0] ?? { x: 0, z: 0 };
      const groundSpecies = ANIMAL_SPECIES_LIST.filter((s) => s.habitat !== 'sky');
      const freestyleExtraCount = 86;
      const stride = Math.max(1, Math.floor(roadPts.length / freestyleExtraCount));

      for (let k = 0; k < freestyleExtraCount; k++) {
        const ptIdx = (k * stride + 5) % roadPts.length;
        const p0 = roadPts[ptIdx];
        const p1 = roadPts[(ptIdx + 1) % roadPts.length];
        const tx = p1.x - p0.x;
        const tz = p1.z - p0.z;
        const len = Math.hypot(tx, tz) || 1;
        const nx = -tz / len;
        const nz = tx / len;

        // Place strictly in the grass off-road (29m to 52m from road centerline)
        const side = k % 2 === 0 ? 1 : -1;
        const lateralDist = 29 + ((k * 11) % 23);
        const ax = p0.x + nx * side * lateralDist;
        const az = p0.z + nz * side * lateralDist;

        if (Math.hypot(ax - startPt.x, az - startPt.z) < 28) continue;

        const spec = groundSpecies[(k * 5 + 3) % groundSpecies.length];
        spawnAnimal(spec, ax, az, 300 + k);
      }

      // Pedestrians on Downtown LS sidepaths (x = ±16.5..19.5m) & zebra crossings
      const freestyleHumanExtras: Array<[HumanArchetype, number, number]> = [
        ['business', -17.5, -1540], ['streetwear', 17.5, -1580], ['officer', -17.5, -1660],
        ['tourist', 18, -1730], ['business', -17.5, -1780], ['jogger', 17.5, -1840],
        ['streetwear', -18, -1910], ['tourist', 18, -1980], ['officer', -18, -2060],
        ['business', 17.5, -2140], ['tourist', -80, -1468], ['streetwear', 85, -1468],
        ['worker', 190, -1468], ['jogger', -190, -1468], ['business', -140, -1803],
        ['tourist', 140, -1803], ['streetwear', -260, -1803], ['officer', 260, -1803],
        // Extra zebra crossing walkers
        ['streetwear', -2, -1560], ['business', 3, -1560],
        ['tourist', -3, -1660], ['jogger', 2, -1660],
        ['business', -2, -1760], ['streetwear', 3, -1760],
        ['tourist', -3, -1860], ['beachgoer', 2, -1960],
        // Sidewalk & promenade walkers
        ['beachgoer', -920, -1520], ['jogger', -940, -1620], ['tourist', -950, -1760],
        ['beachgoer', -960, -1860], ['streetwear', -945, -1960], ['jogger', -925, -2020],
        ['worker', 610, -1640], ['worker', 660, -1740], ['worker', 710, -1870],
        // Residents INSIDE the Downtown LS Enterable Houses (so players can walk inside houses and kill them!)
        ['business', -34, -1598], ['tourist', -36, -1602], ['streetwear', -32, -1601],
        ['business', 34, -1638], ['tourist', 36, -1642], ['jogger', 32, -1640],
        ['streetwear', -34, -1718], ['business', -36, -1722], ['tourist', -32, -1720],
        ['business', 34, -1778], ['streetwear', 36, -1782], ['tourist', 32, -1780],
        ['tourist', -34, -1898], ['business', -36, -1902], ['jogger', -32, -1900],
        ['business', 34, -1948], ['tourist', 36, -1952], ['streetwear', 32, -1950],
      ];
      freestyleHumanExtras.forEach(([arch, x, z], i) => {
        spawnHuman(arch, x, z, 100 + i);
      });

      // Circuit sidepath walkers (placed along the pedestrian sidepath at 22m from road centerline)
      const roadHumanCount = 34;
      const humanStride = Math.max(1, Math.floor(roadPts.length / roadHumanCount));
      for (let k = 0; k < roadHumanCount; k++) {
        const ptIdx = (k * humanStride + 2) % roadPts.length;
        const p0 = roadPts[ptIdx];
        const p1 = roadPts[(ptIdx + 1) % roadPts.length];
        const tx = p1.x - p0.x;
        const tz = p1.z - p0.z;
        const len = Math.hypot(tx, tz) || 1;
        const nx = -tz / len;
        const nz = tx / len;

        const side = k % 2 === 0 ? -1 : 1;
        const lateralDist = 21.5 + (k % 3) * 1.2;
        const hx = p0.x + nx * side * lateralDist;
        const hz = p0.z + nz * side * lateralDist;
        if (Math.hypot(hx - startPt.x, hz - startPt.z) < 28) continue;

        const arch = HUMAN_ARCHETYPES[(k * 3 + 1) % HUMAN_ARCHETYPES.length].id;
        spawnHuman(arch, hx, hz, 200 + k);
      }
    }
  }

  public getTotalHits(): number {
    return this.hitTotal;
  }

  public getTotalKills(): number {
    return this.killTotal;
  }

  public getAnimalCount(): number {
    let n = 0;
    for (let i = 0; i < this.actors.length; i++) {
      if (this.actors[i].category === 'animal') n++;
    }
    return n;
  }

  public getHumanCount(): number {
    let n = 0;
    for (let i = 0; i < this.actors.length; i++) {
      if (this.actors[i].category === 'human') n++;
    }
    return n;
  }

  public syncVisibility(vehicles: VehicleState[]): void {
    const maxVisDistSq = 185 * 185;
    for (let i = 0; i < this.actors.length; i++) {
      const a = this.actors[i];
      let nearestDistSq = Infinity;
      for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
        const v = vehicles[vIdx];
        const dx = a.x - v.x;
        const dz = a.z - v.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < nearestDistSq) nearestDistSq = dSq;
      }
      a.root.visible = nearestDistSq < maxVisDistSq;
    }
  }

  public update(
    dt: number,
    elapsed: number,
    vehicles: VehicleState[],
    onHit?: (evt: HitReactionEvent) => void,
  ): void {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
    const maxVisDistSq = 185 * 185;
    this.tickCount = (this.tickCount + 1) & 1023;

    for (let i = 0; i < this.actors.length; i++) {
      const a = this.actors[i];

      let nearestCar: VehicleState | null = null;
      let nearestDistSq = Infinity;
      for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
        const v = vehicles[vIdx];
        const dx = a.x - v.x;
        const dz = a.z - v.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < nearestDistSq) {
          nearestDistSq = dSq;
          nearestCar = v;
        }
      }

      // Respawn tick for dead animals (works even when out of visual range!)
      if (a.reaction === 'dead') {
        a.respawnTimer -= safeDt;
        const farEnoughToRespawn = nearestDistSq > 85 * 85;
        if ((a.respawnTimer <= 0 && farEnoughToRespawn) || a.respawnTimer < -10) {
          a.reaction = 'calm';
          a.isDying = false;
          a.x = a.homeX;
          a.z = a.homeZ;
          a.cachedFloorY = groundHeightAt(a.x, a.z, this.mapId);
          a.y = a.locomotion === 'bird' && (a.speciesId === 'bald_eagle' || a.speciesId === 'red_hawk')
            ? a.cachedFloorY + 18
            : a.cachedFloorY;
          a.bodyPivot.rotation.set(0, 0, 0);
          a.root.position.set(a.x, a.y, a.z);
          a.root.visible = nearestDistSq < maxVisDistSq;
          continue;
        }
        a.root.visible = nearestDistSq < maxVisDistSq;
        continue;
      }

      const inRange = nearestDistSq < maxVisDistSq;
      if (!inRange && a.reaction === 'calm') {
        a.root.visible = false;
        continue;
      }
      a.root.visible = true;

      // 1. Check Car Impact Collision
      if (nearestCar && a.reaction !== 'knocked') {
        const hitRadius = 1.72 + a.collisionRadius;
        const dy = Math.abs(a.y - (nearestCar.y - 0.3));
        if (nearestDistSq < hitRadius * hitRadius && dy < 2.4 && nearestCar.speedKmh > 6) {
          const isFreestyleKill = this.mode === 'freestyle';
          a.reaction = 'knocked';
          a.isDying = isFreestyleKill;
          a.reactionTimer = isFreestyleKill ? 0.72 : 2.6;
          a.bloodTrailTimer = 0.08;
          a.hitCount += 1;
          this.hitTotal += 1;
          if (isFreestyleKill) {
            this.killTotal += 1;
          }

          const dx = a.x - nearestCar.x;
          const dz = a.z - nearestCar.z;
          const len = Math.hypot(dx, dz) || 1;
          const pushPower = clamp(nearestCar.speedKmh * 0.28, 7, 26);
          a.vx = (dx / len) * pushPower + nearestCar.vx * 0.45;
          a.vz = (dz / len) * pushPower + nearestCar.vz * 0.45;
          a.vy =
            a.locomotion === 'bird' && !isFreestyleKill
              ? 12.5
              : clamp(4.2 + nearestCar.speedKmh * 0.075, 4.2, 10.5);
          a.tumblePitch = 0.4;
          a.tumbleRoll = (dx >= 0 ? 1 : -1) * 0.6;

          nearestCar.impactIntensity = Math.max(nearestCar.impactIntensity, 0.25);

          // Spill blood droplets + ground blood pool when an animal or Freestyle person is struck!
          if (a.category === 'animal' || isFreestyleKill) {
            this.spawnBloodBurst(
              a.x,
              a.y + (a.category === 'human' ? 0.85 : 0.38),
              a.z,
              nearestCar.vx,
              nearestCar.vz,
              isFreestyleKill ? 24 : 12,
            );
            const floorAtHit = groundHeightAt(a.x, a.z, this.mapId);
            this.spawnBloodPool(
              a.x,
              floorAtHit,
              a.z,
              0.95 + a.collisionRadius * 0.7,
            );
          }

          onHit?.({
            actorId: a.id,
            label: a.label,
            category: a.category,
            sound: a.soundKind,
            speedKmh: nearestCar.speedKmh,
            isKill: isFreestyleKill,
            coinsAwarded: isFreestyleKill ? a.coinReward : 0,
          });
        } else {
          const fleeRadius = this.mode === 'freestyle' ? 10.5 : a.category === 'animal' ? 10.5 : 18;
          if (nearestDistSq < fleeRadius * fleeRadius && nearestCar.speedKmh > 22 && a.reaction === 'calm') {
            a.reaction = 'fleeing';
            a.reactionTimer = 2.4;
            const dx = a.x - nearestCar.x;
            const dz = a.z - nearestCar.z;
            a.wanderAngle = Math.atan2(dx, dz);
          }
        }
      }

      // 2. State Machine & Movement (cache distant ground height every 4th tick)
      if (a.reaction !== 'calm' || nearestDistSq < 55 * 55 || ((i + this.tickCount) & 3) === 0) {
        a.cachedFloorY = groundHeightAt(a.x, a.z, this.mapId);
      }
      const floorY = a.cachedFloorY;

      if (a.reaction === 'knocked') {
        a.reactionTimer -= safeDt;
        a.vy -= 22 * safeDt;
        a.x += a.vx * safeDt;
        a.z += a.vz * safeDt;
        a.y += a.vy * safeDt;

        const curFloor = groundHeightAt(a.x, a.z, this.mapId);
        if (a.category === 'animal' || a.isDying) {
          a.bloodTrailTimer -= safeDt;
          if (a.bloodTrailTimer <= 0) {
            a.bloodTrailTimer = 0.14;
            this.spawnBloodBurst(a.x, a.y + 0.3, a.z, a.vx * 0.4, a.vz * 0.4, 5);
          }
        }

        if (a.locomotion === 'bird' && !a.isDying) {
          a.vy = Math.max(a.vy, 3.5);
          a.bodyPivot.rotation.set(-0.35, 0, 0);
        } else {
          a.tumblePitch += 8.2 * safeDt;
          a.tumbleRoll += 6.4 * safeDt;
          a.bodyPivot.rotation.set(a.tumblePitch, 0, a.tumbleRoll);
          if (a.y <= curFloor) {
            a.y = curFloor;
            a.vy = Math.abs(a.vy) > 3 ? -a.vy * 0.28 : 0;
            a.vx *= 0.65;
            a.vz *= 0.65;
          }
        }

        if (a.reactionTimer <= 0) {
          if (a.isDying) {
            a.reaction = 'dead';
            a.isDying = false;
            a.respawnTimer = 14;
            a.vx = 0;
            a.vz = 0;
            a.vy = 0;
            a.y = curFloor + 0.08;
            a.bodyPivot.rotation.set(0.12, 0, Math.PI * 0.48);
            this.spawnBloodBurst(a.x, a.y + 0.2, a.z, 0, 0, 12);
            this.spawnBloodPool(a.x, curFloor, a.z, 1.25 + a.collisionRadius * 0.85);
            a.root.position.set(a.x, a.y, a.z);
            a.root.rotation.y = a.yaw;
            continue;
          } else {
            a.reaction = 'recovering';
            a.reactionTimer = 1.6;
            a.vx = 0;
            a.vz = 0;
          }
        }
      } else if (a.reaction === 'recovering') {
        a.reactionTimer -= safeDt;
        a.bodyPivot.rotation.x *= Math.exp(-8 * safeDt);
        a.bodyPivot.rotation.z *= Math.exp(-8 * safeDt);
        if (a.locomotion === 'bird') {
          a.y = Math.max(
            a.y - 3 * safeDt,
            floorY + (a.speciesId === 'bald_eagle' || a.speciesId === 'red_hawk' ? 16 : 0),
          );
        } else {
          a.y = floorY;
        }
        if (a.reactionTimer <= 0) {
          a.reaction = 'calm';
          a.bodyPivot.rotation.set(0, 0, 0);
          a.wanderAngle = Math.atan2(a.homeX - a.x, a.homeZ - a.z);
        }
      } else {
        a.bodyPivot.rotation.x *= Math.exp(-10 * safeDt);
        a.bodyPivot.rotation.z *= Math.exp(-10 * safeDt);

        if (a.reaction === 'fleeing') {
          a.reactionTimer -= safeDt;
          if (a.reactionTimer <= 0) a.reaction = 'calm';
        } else {
          a.wanderTimer -= safeDt;
          const distHome = Math.hypot(a.x - a.homeX, a.z - a.homeZ);
          const maxWanderRadius =
            a.category === 'animal' ? 7.5 : a.label.includes('Resident') ? 2.2 : 8.5;
          if (distHome > maxWanderRadius) {
            a.wanderAngle = Math.atan2(a.homeX - a.x, a.homeZ - a.z);
            a.wanderTimer = 1.8;
          } else if (a.wanderTimer <= 0) {
            a.wanderTimer = 2.5 + ((i * 17) % 4);
            a.wanderAngle += (Math.sin(elapsed * 2.1 + i) > 0 ? 1 : -1) * 0.9;
          }
        }

        const moveSpeed = a.reaction === 'fleeing' ? a.fleeSpeed : a.walkSpeed;
        a.yaw = a.wanderAngle;
        a.x += Math.sin(a.yaw) * moveSpeed * safeDt;
        a.z += Math.cos(a.yaw) * moveSpeed * safeDt;

        if (a.locomotion === 'bird' && (a.speciesId === 'bald_eagle' || a.speciesId === 'red_hawk')) {
          const orbit = elapsed * 0.45 + a.phaseOffset;
          a.x = a.homeX + Math.cos(orbit) * 38;
          a.z = a.homeZ + Math.sin(orbit) * 38;
          a.yaw = -orbit;
          a.y =
            groundHeightAt(a.x, a.z, this.mapId) +
            22 +
            Math.sin(elapsed * 1.3 + a.phaseOffset) * 2.5;
        } else if (a.locomotion === 'bird' && a.reaction === 'fleeing') {
          a.y = Math.min(floorY + 11, a.y + 4.8 * safeDt);
        } else {
          const hopBounce =
            a.locomotion === 'hop'
              ? Math.max(
                  0,
                  Math.sin(elapsed * (a.reaction === 'fleeing' ? 14 : 7.5) + a.phaseOffset),
                ) * 0.32
              : 0;
          a.y = floorY + hopBounce;
        }
      }

      // 3. Limb & Wing Articulation
      const animRate = a.reaction === 'fleeing' ? 14 : a.reaction === 'knocked' ? 18 : 6.2;
      const swing = Math.sin(elapsed * animRate + a.phaseOffset);

      if (a.locomotion === 'biped') {
        const amp = a.reaction === 'fleeing' ? 0.78 : a.reaction === 'knocked' ? 1.1 : 0.42;
        a.limbs[0].rotation.x = -swing * amp;
        a.limbs[1].rotation.x = swing * amp;
        a.limbs[2].rotation.x = swing * amp;
        a.limbs[3].rotation.x = -swing * amp;
        a.headGroup.rotation.y = Math.sin(elapsed * 1.4 + a.phaseOffset) * 0.18;
      } else if (a.locomotion === 'quadruped' || a.locomotion === 'hop') {
        const amp = a.locomotion === 'hop' ? 0.65 : a.reaction === 'fleeing' ? 0.85 : 0.44;
        a.limbs[0].rotation.x = swing * amp;
        a.limbs[1].rotation.x = -swing * amp;
        a.limbs[2].rotation.x = -swing * amp;
        a.limbs[3].rotation.x = swing * amp;
        if (a.tailOrWingL) {
          a.tailOrWingL.rotation.y = Math.sin(elapsed * 8.5 + a.phaseOffset) * 0.42;
        }
      } else if (a.locomotion === 'bird') {
        const isAirborne = a.y > floorY + 0.4;
        const flap = isAirborne ? Math.sin(elapsed * 16 + a.phaseOffset) * 0.85 : 0.08;
        if (a.tailOrWingL) a.tailOrWingL.rotation.z = flap;
        if (a.wingR) a.wingR.rotation.z = -flap;
        a.headGroup.rotation.x = isAirborne
          ? 0
          : Math.max(0, Math.sin(elapsed * 4 + a.phaseOffset)) * 0.25;
      }

      a.root.position.set(a.x, a.y, a.z);
      a.root.rotation.y = a.yaw;
    }

    this.updateBloodEffects(safeDt);
  }

  public dispose(): void {
    const seenGeo = new Set<THREE.BufferGeometry>();
    const seenMat = new Set<THREE.Material>();
    this.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry && !seenGeo.has(mesh.geometry)) {
        seenGeo.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        for (const m of mat) {
          if (!seenMat.has(m)) {
            seenMat.add(m);
            m.dispose();
          }
        }
      } else if (mat && !seenMat.has(mat)) {
        seenMat.add(mat);
        mat.dispose();
      }
    });

    for (const g of Object.values(this.sharedGeometries)) {
      if (!seenGeo.has(g)) g.dispose();
    }
    this.bloodDropGeo.dispose();
    this.bloodDropMat.dispose();
    this.bloodPoolGeo.dispose();
    this.bloodPoolMat.dispose();
  }
}
