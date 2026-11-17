import * as THREE from 'three';
import { getCharacterSpec, getWeaponSpec } from './cars';
import type { HitReactionEvent, LivingWorldController } from './livingWorld';
import { clamp, getMapWorldData, groundHeightAt } from './terrain';
import type { CharacterId, MapId, VehicleState, WeaponId } from './types';

export type MysteryPowerType =
  | 'SUPER SPEED'
  | 'INVINCIBLE SHIELD'
  | 'DOUBLE DAMAGE'
  | 'MEGA COINS +100'
  | 'CLEAR POLICE';

const MYSTERY_POWERS: MysteryPowerType[] = [
  'SUPER SPEED',
  'INVINCIBLE SHIELD',
  'DOUBLE DAMAGE',
  'MEGA COINS +100',
  'CLEAR POLICE',
];

export const GOLD_BULLET_HEX = 0xffd700;

export interface MysteryBoxItem {
  id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
  respawnTimer: number;
  mesh: THREE.Group;
}

export interface EnergyDrinkItem {
  id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
  respawnTimer: number;
  mesh: THREE.Group;
}

export interface LocalBox2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface EnterableHouse {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  doorFacingYaw: number;
  width: number;
  depth: number;
  doorHalfWidth: number;
  wallBoxes: LocalBox2D[];
  furnitureBoxes: LocalBox2D[];
  hasSofa: boolean;
  hasTv: boolean;
  hasBed: boolean;
}

export interface GoldBulletProjectile {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  traveled: number;
  maxRange: number;
  mesh: THREE.Mesh;
}

export interface PoliceOfficerUnit {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  active: boolean;
  attackCooldown: number;
  root: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
}

export interface PoliceCruiserUnit {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  hp: number;
  active: boolean;
  root: THREE.Group;
  redSirenMat: THREE.MeshStandardMaterial;
  blueSirenMat: THREE.MeshStandardMaterial;
}

export interface FreestyleActionEvent {
  title: string;
  coinsAwarded: number;
  powerActivated?: MysteryPowerType;
  isPlayerDeath?: boolean;
}

export interface OnFootInput {
  forward: number; // -1..1
  turn: number; // -1..1
  strafe?: number; // -1..1
  sprint: boolean;
  attack: boolean;
  aimWorldX?: number | null;
  aimWorldZ?: number | null;
}

function worldToHouseLocal(
  wx: number,
  wz: number,
  house: EnterableHouse,
): { lx: number; lz: number } {
  const dx = wx - house.x;
  const dz = wz - house.z;
  const c = Math.cos(house.doorFacingYaw);
  const s = Math.sin(house.doorFacingYaw);
  return {
    lx: dx * c - dz * s,
    lz: dx * s + dz * c,
  };
}

function houseLocalToWorld(
  lx: number,
  lz: number,
  house: EnterableHouse,
): { wx: number; wz: number } {
  const c = Math.cos(house.doorFacingYaw);
  const s = Math.sin(house.doorFacingYaw);
  return {
    wx: house.x + lx * c + lz * s,
    wz: house.z - lx * s + lz * c,
  };
}

function pushCircleOutOfBox(
  lx: number,
  lz: number,
  radius: number,
  box: LocalBox2D,
): { lx: number; lz: number; hit: boolean } {
  const closestX = clamp(lx, box.minX, box.maxX);
  const closestZ = clamp(lz, box.minZ, box.maxZ);
  const dx = lx - closestX;
  const dz = lz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return { lx, lz, hit: false };
  }

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    const push = radius - dist;
    return {
      lx: lx + (dx / dist) * push,
      lz: lz + (dz / dist) * push,
      hit: true,
    };
  }

  // Center is inside the box; push out along shallowest axis
  const dLeft = Math.abs(lx - box.minX);
  const dRight = Math.abs(box.maxX - lx);
  const dBack = Math.abs(lz - box.minZ);
  const dFront = Math.abs(box.maxZ - lz);
  const minPen = Math.min(dLeft, dRight, dBack, dFront);

  if (minPen === dLeft) return { lx: box.minX - radius, lz, hit: true };
  if (minPen === dRight) return { lx: box.maxX + radius, lz, hit: true };
  if (minPen === dBack) return { lx, lz: box.minZ - radius, hit: true };
  return { lx, lz: box.maxZ + radius, hit: true };
}

function segmentIntersectsBox2D(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  box: LocalBox2D,
): boolean {
  let tmin = 0;
  let tmax = 1;
  const dx = x1 - x0;
  const dz = z1 - z0;

  if (Math.abs(dx) < 1e-8) {
    if (x0 < box.minX || x0 > box.maxX) return false;
  } else {
    const invD = 1 / dx;
    let t1 = (box.minX - x0) * invD;
    let t2 = (box.maxX - x0) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (Math.abs(dz) < 1e-8) {
    if (z0 < box.minZ || z0 > box.maxZ) return false;
  } else {
    const invD = 1 / dz;
    let t1 = (box.minZ - z0) * invD;
    let t2 = (box.maxZ - z0) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}

export class FreestyleActionController {
  public readonly group = new THREE.Group();
  public isOnFoot = false;
  public charX = 0;
  public charY = 0;
  public charZ = 0;
  public charYaw = Math.PI;
  public charSpeed = 0;

  public equippedCharacter: CharacterId = 'default';
  public equippedWeapon: WeaponId = 'fists';

  public maxHealth = 100;
  public health = 100;
  public energy = 100;
  public isDead = false;
  public deathTimer = 0;

  public wantedLevel = 0;
  public wantedDecayTimer = 0;
  public policeReinforceCooldown = 0;

  public activePower: MysteryPowerType | null = null;
  public activePowerTimer = 0;
  public nearHouseName: string | null = null;

  public readonly mysteryBoxes: MysteryBoxItem[] = [];
  public readonly energyDrinks: EnergyDrinkItem[] = [];
  public readonly houses: EnterableHouse[] = [];
  public readonly policeOfficers: PoliceOfficerUnit[] = [];
  public readonly policeCruisers: PoliceCruiserUnit[] = [];
  public readonly goldBullets: GoldBulletProjectile[] = [];

  private playerRoot = new THREE.Group();
  private playerBody = new THREE.Group();
  private playerTorsoMesh!: THREE.Mesh;
  private playerPantsMesh!: THREE.Mesh;
  private playerHatMesh!: THREE.Mesh;
  private playerLeftArm!: THREE.Group;
  private playerRightArm!: THREE.Group;
  private playerLeftLeg!: THREE.Group;
  private playerRightLeg!: THREE.Group;
  private weaponMeshGroup = new THREE.Group();
  private playerMuzzleFlash!: THREE.Mesh;
  private aimSightGroup = new THREE.Group();
  private bulletTracerLine!: THREE.Line;
  private bulletTracerTimer = 0;
  private weaponCooldown = 0;
  private powerIndexCursor = 0;
  private bulletCursor = 0;

  private policeTracerLine!: THREE.Line;
  private policeTracerTimer = 0;

  constructor(
    private mapId: MapId,
    initialCharacter: CharacterId = 'default',
    initialWeapon: WeaponId = 'fists',
  ) {
    this.buildPlayerCharacterRig();
    this.buildGoldBulletPool();
    this.setCharacterAndWeapon(initialCharacter, initialWeapon);
    this.buildEnterableHouses();
    this.buildMysteryBoxesOnRoads();
    this.buildEnergyDrinks();
    this.buildPolicePool();
  }

  public setCharacterAndWeapon(characterId: CharacterId, weaponId: WeaponId): void {
    this.equippedCharacter = characterId;
    this.equippedWeapon = weaponId;
    const charSpec = getCharacterSpec(characterId);
    const prevMax = this.maxHealth;
    this.maxHealth = 100 + charSpec.armorBonus;
    if (this.health >= prevMax || this.health > this.maxHealth) {
      this.health = this.maxHealth;
    }

    if (this.playerTorsoMesh) {
      (this.playerTorsoMesh.material as THREE.MeshStandardMaterial).color.setHex(charSpec.shirtHex);
      (this.playerPantsMesh.material as THREE.MeshStandardMaterial).color.setHex(charSpec.pantsHex);
      (this.playerHatMesh.material as THREE.MeshStandardMaterial).color.setHex(charSpec.accentHex);
      this.playerHatMesh.visible = characterId !== 'default';
    }
    this.rebuildWeaponMesh(weaponId);
  }

  public setManualAimTarget(worldX: number, worldZ: number): void {
    if (!this.isOnFoot || this.isDead) return;
    const dx = worldX - this.charX;
    const dz = worldZ - this.charZ;
    if (dx * dx + dz * dz > 0.04) {
      this.charYaw = Math.atan2(dx, dz);
      this.playerRoot.rotation.y = this.charYaw;
    }
  }

  private buildPlayerCharacterRig(): void {
    this.playerRoot.visible = false;
    this.playerRoot.add(this.playerBody);

    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.55 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0b494, roughness: 0.65 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35 });

    this.playerTorsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), torsoMat);
    this.playerTorsoMesh.position.set(0, 1.18, 0);
    this.playerBody.add(this.playerTorsoMesh);

    this.playerPantsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.24), pantsMat);
    this.playerPantsMesh.position.set(0, 0.82, 0);
    this.playerBody.add(this.playerPantsMesh);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skinMat);
    head.position.set(0, 1.66, 0);
    this.playerBody.add(head);

    this.playerHatMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.12, 10), hatMat);
    this.playerHatMesh.position.set(0, 1.79, 0);
    this.playerBody.add(this.playerHatMesh);

    const makeLimb = (x: number, y: number, w: number, h: number, mat: THREE.Material) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      m.position.set(0, -h * 0.5, 0);
      g.add(m);
      this.playerBody.add(g);
      return g;
    };

    this.playerLeftArm = makeLimb(0.3, 1.44, 0.13, 0.56, torsoMat);
    this.playerRightArm = makeLimb(-0.3, 1.44, 0.13, 0.56, torsoMat);
    this.playerLeftLeg = makeLimb(0.13, 0.75, 0.16, 0.75, pantsMat);
    this.playerRightLeg = makeLimb(-0.13, 0.75, 0.16, 0.75, pantsMat);

    this.weaponMeshGroup.position.set(0, -0.5, 0.18);
    this.playerRightArm.add(this.weaponMeshGroup);

    // Gold Muzzle Flash (0xffd700)
    this.playerMuzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 8, 8),
      new THREE.MeshBasicMaterial({ color: GOLD_BULLET_HEX }),
    );
    this.playerMuzzleFlash.position.set(0, -0.5, 0.68);
    this.playerMuzzleFlash.visible = false;
    this.playerRightArm.add(this.playerMuzzleFlash);

    // Manual Aiming Sight Line & Reticle (shows player's manual aim direction in 3D)
    const aimDotMat = new THREE.MeshBasicMaterial({
      color: GOLD_BULLET_HEX,
      transparent: true,
      opacity: 0.75,
    });
    for (let d = 3; d <= 15; d += 3) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), aimDotMat);
      dot.position.set(0, 1.15, d);
      this.aimSightGroup.add(dot);
    }
    const aimRingGeo = new THREE.RingGeometry(0.32, 0.44, 16);
    aimRingGeo.rotateX(-Math.PI / 2);
    const aimRing = new THREE.Mesh(aimRingGeo, aimDotMat);
    aimRing.position.set(0, 0.08, 12);
    this.aimSightGroup.add(aimRing);
    this.playerRoot.add(this.aimSightGroup);

    this.group.add(this.playerRoot);

    // Gold Player Bullet Tracer Line (0xffd700)
    const tracerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
    ]);
    this.bulletTracerLine = new THREE.Line(
      tracerGeo,
      new THREE.LineBasicMaterial({ color: GOLD_BULLET_HEX }),
    );
    this.bulletTracerLine.visible = false;
    this.bulletTracerLine.frustumCulled = false;
    this.group.add(this.bulletTracerLine);

    const policeTracerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
    ]);
    this.policeTracerLine = new THREE.Line(
      policeTracerGeo,
      new THREE.LineBasicMaterial({ color: 0xf87171 }),
    );
    this.policeTracerLine.visible = false;
    this.policeTracerLine.frustumCulled = false;
    this.group.add(this.policeTracerLine);
  }

  private buildGoldBulletPool(): void {
    const bulletGeo = new THREE.SphereGeometry(0.11, 8, 8);
    bulletGeo.scale(1, 1, 2.8);
    const bulletMat = new THREE.MeshStandardMaterial({
      color: GOLD_BULLET_HEX,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.4,
      metalness: 0.95,
      roughness: 0.1,
    });

    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      mesh.visible = false;
      this.group.add(mesh);
      this.goldBullets.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        yaw: 0,
        traveled: 0,
        maxRange: 30,
        mesh,
      });
    }
  }

  private spawnGoldBulletProjectile(
    originX: number,
    originY: number,
    originZ: number,
    yaw: number,
    maxRange: number,
  ): void {
    const b = this.goldBullets[this.bulletCursor % this.goldBullets.length];
    this.bulletCursor += 1;
    const speed = 92;
    const dirX = Math.sin(yaw);
    const dirZ = Math.cos(yaw);
    b.active = true;
    b.x = originX + dirX * 0.65;
    b.y = originY;
    b.z = originZ + dirZ * 0.65;
    b.vx = dirX * speed;
    b.vz = dirZ * speed;
    b.yaw = yaw;
    b.traveled = 0;
    b.maxRange = maxRange;
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.rotation.y = yaw;
    b.mesh.visible = true;
  }

  private rebuildWeaponMesh(weaponId: WeaponId): void {
    while (this.weaponMeshGroup.children.length > 0) {
      this.weaponMeshGroup.remove(this.weaponMeshGroup.children[0]);
    }
    this.aimSightGroup.visible = weaponId !== 'fists';
    if (weaponId === 'fists') return;

    const gunMat = new THREE.MeshStandardMaterial({
      color: weaponId === 'minigun' ? 0x38bdf8 : weaponId === 'assault_rifle' ? 0xf59e0b : 0x1e293b,
      metalness: 0.75,
      roughness: 0.28,
    });
    const barrelLen =
      weaponId === 'pistol'
        ? 0.32
        : weaponId === 'shotgun'
          ? 0.68
          : weaponId === 'assault_rifle'
            ? 0.76
            : 0.92;
    const barrelWidth = weaponId === 'minigun' ? 0.18 : 0.08;
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(barrelWidth, barrelWidth, barrelLen),
      gunMat,
    );
    barrel.position.set(0, 0, barrelLen * 0.45);
    this.weaponMeshGroup.add(barrel);
  }

  public toggleOnFoot(car: VehicleState): boolean {
    if (this.isDead) return this.isOnFoot;
    if (!this.isOnFoot) {
      this.isOnFoot = true;
      const sideX = -Math.cos(car.yaw) * 2.8;
      const sideZ = Math.sin(car.yaw) * 2.8;
      const resolved = this.resolveCharacterHouseCollision(
        car.x,
        car.z,
        car.x + sideX,
        car.z + sideZ,
        0.4,
      );
      this.charX = resolved.x;
      this.charZ = resolved.z;
      this.charY = groundHeightAt(this.charX, this.charZ, this.mapId);
      this.charYaw = car.yaw;
      this.charSpeed = 0;

      // Stop car smoothly so it stays parked where the player exited
      car.vx = 0;
      car.vz = 0;
      car.speed = 0;
      car.speedKmh = 0;
      car.angularVelY = 0;

      this.playerRoot.visible = true;
      this.playerRoot.position.set(this.charX, this.charY, this.charZ);
      this.playerRoot.rotation.y = this.charYaw;
    } else {
      this.isOnFoot = false;
      this.playerRoot.visible = false;
      car.x = this.charX + Math.cos(this.charYaw) * 1.6;
      car.z = this.charZ - Math.sin(this.charYaw) * 1.6;
      this.resolveCarHouseCollision(car);
      car.y = groundHeightAt(car.x, car.z, this.mapId) + 0.82;
      car.yaw = this.charYaw;
    }
    return this.isOnFoot;
  }

  public useEnergyDrink(): boolean {
    if (this.isDead) return false;
    this.energy = 100;
    this.health = this.maxHealth;
    return true;
  }

  public reportCrime(starsToAdd = 1): void {
    if (this.activePower === 'CLEAR POLICE') return;
    const prevWanted = this.wantedLevel;
    this.wantedLevel = clamp(this.wantedLevel + starsToAdd, 1, 5);
    this.wantedDecayTimer = 36;
    // Deploy a small police squad on initial crime or when reinforcement cooldown has elapsed
    if (prevWanted === 0 || this.policeReinforceCooldown <= 0) {
      this.ensurePoliceDeployed();
    }
  }

  private ensurePoliceDeployed(): void {
    // Only some police should come: 1 officer at 1-2 stars, max 2 officers at 3-5 stars, and max 1 cruiser
    const officerTarget = this.wantedLevel >= 3 ? 2 : 1;
    const px = this.isOnFoot ? this.charX : this.lastFocusX;
    const pz = this.isOnFoot ? this.charZ : this.lastFocusZ;
    const pyaw = this.isOnFoot ? this.charYaw : this.lastFocusYaw;

    for (let i = 0; i < officerTarget; i++) {
      const officer = this.policeOfficers[i];
      if (officer && !officer.active) {
        const angle = pyaw + (i === 0 ? 0.35 : -0.45);
        const dist = 20 + i * 6;
        const spawnX = px + Math.sin(angle) * dist;
        const spawnZ = pz + Math.cos(angle) * dist;
        const resolved = this.resolveCharacterHouseCollision(px, pz, spawnX, spawnZ, 0.45);
        officer.x = resolved.x;
        officer.z = resolved.z;
        officer.y = groundHeightAt(officer.x, officer.z, this.mapId);
        officer.yaw = Math.atan2(px - officer.x, pz - officer.z);
        officer.hp = officer.maxHp;
        officer.active = true;
        officer.attackCooldown = 1.0;
        officer.root.visible = true;
        officer.root.position.set(officer.x, officer.y, officer.z);
      }
    }

    const cruiser = this.policeCruisers[0];
    if (cruiser && !cruiser.active) {
      const angle = pyaw + 0.25;
      const dist = 30;
      cruiser.x = px + Math.sin(angle) * dist;
      cruiser.z = pz + Math.cos(angle) * dist;
      cruiser.y = groundHeightAt(cruiser.x, cruiser.z, this.mapId);
      cruiser.yaw = Math.atan2(px - cruiser.x, pz - cruiser.z);
      cruiser.hp = 150;
      cruiser.active = true;
      cruiser.root.visible = true;
      cruiser.root.position.set(cruiser.x, cruiser.y, cruiser.z);
    }

    this.policeReinforceCooldown = 28;
  }

  public isSegmentBlockedByHouseWall(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
  ): boolean {
    for (const h of this.houses) {
      if (Math.hypot(x0 - h.x, z0 - h.z) > 35 && Math.hypot(x1 - h.x, z1 - h.z) > 35) {
        continue;
      }
      const p0 = worldToHouseLocal(x0, z0, h);
      const p1 = worldToHouseLocal(x1, z1, h);
      for (const wall of h.wallBoxes) {
        if (segmentIntersectsBox2D(p0.lx, p0.lz, p1.lx, p1.lz, wall)) {
          return true;
        }
      }
    }
    return false;
  }

  public resolveCharacterHouseCollision(
    prevX: number,
    prevZ: number,
    nextX: number,
    nextZ: number,
    radius = 0.4,
  ): { x: number; z: number } {
    let curX = prevX;
    let curZ = prevZ;
    const steps = 4;
    const stepX = (nextX - prevX) / steps;
    const stepZ = (nextZ - prevZ) / steps;

    for (let s = 0; s < steps; s++) {
      curX += stepX;
      curZ += stepZ;

      for (const h of this.houses) {
        const dx = curX - h.x;
        const dz = curZ - h.z;
        if (dx * dx + dz * dz > 144) continue;

        let { lx, lz } = worldToHouseLocal(curX, curZ, h);

        // Push out of all 5 solid house wall segments (Back, Left, Right, Front-Left, Front-Right)
        // Only the open front doorway gap (-doorHalfWidth .. +doorHalfWidth at lz = +depth/2) is passable
        for (const wall of h.wallBoxes) {
          const res = pushCircleOutOfBox(lx, lz, radius, wall);
          lx = res.lx;
          lz = res.lz;
        }

        // Push out of interior furniture (sofa, TV stand, bed, bookshelf/fridge)
        for (const furn of h.furnitureBoxes) {
          const res = pushCircleOutOfBox(lx, lz, radius * 0.85, furn);
          lx = res.lx;
          lz = res.lz;
        }

        const worldPos = houseLocalToWorld(lx, lz, h);
        curX = worldPos.wx;
        curZ = worldPos.wz;
      }
    }

    return { x: curX, z: curZ };
  }

  public resolveCarHouseCollision(car: VehicleState): void {
    const carRadius = 1.85;
    for (const h of this.houses) {
      const dx = car.x - h.x;
      const dz = car.z - h.z;
      if (dx * dx + dz * dz > 225) continue;

      const { lx, lz } = worldToHouseLocal(car.x, car.z, h);
      const halfW = h.width * 0.5 + 0.25;
      const halfD = h.depth * 0.5 + 0.25;
      const res = pushCircleOutOfBox(lx, lz, carRadius, {
        minX: -halfW,
        maxX: halfW,
        minZ: -halfD,
        maxZ: halfD,
      });
      if (res.hit) {
        const w = houseLocalToWorld(res.lx, res.lz, h);
        car.x = w.wx;
        car.z = w.wz;
        car.vx *= 0.25;
        car.vz *= 0.25;
        car.speed *= 0.25;
        car.speedKmh = Math.abs(car.speed) * 3.6;
      }
    }
  }

  public triggerWeaponAttack(
    livingWorld: LivingWorldController | null,
    onActorHit?: (evt: HitReactionEvent) => void,
    onActionEvent?: (evt: FreestyleActionEvent) => void,
  ): number {
    if (this.isDead || this.weaponCooldown > 0) return 0;
    const weapon = getWeaponSpec(this.equippedWeapon);
    const dmgMultiplier = this.activePower === 'DOUBLE DAMAGE' ? 2 : 1;
    const effectiveRange = weapon.range * (this.activePower === 'DOUBLE DAMAGE' ? 1.25 : 1);
    const effectiveDamage = weapon.damage * dmgMultiplier;

    this.weaponCooldown =
      this.activePower === 'DOUBLE DAMAGE'
        ? Math.max(0.06, weapon.CooldownSec * 0.6)
        : weapon.CooldownSec;

    const originX = this.charX;
    const originY = this.charY + 1.25;
    const originZ = this.charZ;
    // Manual aiming: bullets travel strictly along the player's aimed yaw (this.charYaw)
    const dirX = Math.sin(this.charYaw);
    const dirZ = Math.cos(this.charYaw);

    this.playerRightArm.rotation.x = -Math.PI * 0.46;
    if (weapon.id !== 'fists') {
      this.playerMuzzleFlash.visible = true;
      const endX = originX + dirX * effectiveRange;
      const endZ = originZ + dirZ * effectiveRange;
      const endY = groundHeightAt(endX, endZ, this.mapId) + 1.15;
      const posAttr = this.bulletTracerLine.geometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      posAttr.setXYZ(0, originX + dirX * 0.6, originY, originZ + dirZ * 0.6);
      posAttr.setXYZ(1, endX, endY, endZ);
      posAttr.needsUpdate = true;
      this.bulletTracerLine.visible = true;
      this.bulletTracerTimer = 0.11;

      // Spawn physical 3D Gold Bullet projectile along the aimed ray
      this.spawnGoldBulletProjectile(originX, originY, originZ, this.charYaw, effectiveRange);
    }

    let totalHits = 0;
    const hitHalfWidth = weapon.id === 'fists' ? 0.95 : weapon.id === 'shotgun' ? 1.05 : 0.65;

    // 1. Check manual-aimed hits on pursuing Police Officers
    for (const officer of this.policeOfficers) {
      if (!officer.active) continue;
      const dx = officer.x - originX;
      const dz = officer.z - originZ;
      const forwardProj = dx * dirX + dz * dirZ;
      if (forwardProj < -0.2 || forwardProj > effectiveRange + 0.7) continue;
      const perpDist = Math.abs(dx * dirZ - dz * dirX);
      if (perpDist > 0.55 + hitHalfWidth) continue;
      if (this.isSegmentBlockedByHouseWall(originX, originZ, officer.x, officer.z)) continue;

      officer.hp -= effectiveDamage;
      totalHits += 1;
      livingWorld?.spawnExternalBlood(
        officer.x,
        officer.y + 0.95,
        officer.z,
        dirX * 6,
        dirZ * 6,
        20,
        1.1,
      );

      if (officer.hp <= 0) {
        officer.active = false;
        officer.root.visible = false;
        livingWorld?.spawnExternalBlood(
          officer.x,
          officer.y + 0.6,
          officer.z,
          dirX * 8,
          dirZ * 8,
          28,
          1.45,
        );
        onActionEvent?.({
          title: `LSPD OFFICER DOWN (${weapon.name})`,
          coinsAwarded: 35,
        });
      }
    }

    // 2. Check manual-aimed hits on Police Cruisers
    for (const cruiser of this.policeCruisers) {
      if (!cruiser.active) continue;
      const dx = cruiser.x - originX;
      const dz = cruiser.z - originZ;
      const forwardProj = dx * dirX + dz * dirZ;
      if (forwardProj < -0.5 || forwardProj > effectiveRange + 2.2) continue;
      const perpDist = Math.abs(dx * dirZ - dz * dirX);
      if (perpDist > 1.85 + hitHalfWidth) continue;
      if (this.isSegmentBlockedByHouseWall(originX, originZ, cruiser.x, cruiser.z)) continue;

      cruiser.hp -= effectiveDamage;
      totalHits += 1;
      if (cruiser.hp <= 0) {
        cruiser.active = false;
        cruiser.root.visible = false;
        onActionEvent?.({
          title: 'LSPD CRUISER WRECKED!',
          coinsAwarded: 60,
        });
      }
    }

    // 3. Check manual-aimed hits on LivingWorld people (including inside Downtown LS houses) & animals
    if (livingWorld) {
      const worldKills = livingWorld.attackActorsWithWeapon(
        originX,
        this.charY,
        originZ,
        this.charYaw,
        effectiveRange,
        hitHalfWidth,
        (evt) => {
          this.reportCrime(1);
          onActorHit?.(evt);
        },
        (tx, tz) => this.isSegmentBlockedByHouseWall(originX, originZ, tx, tz),
      );
      totalHits += worldKills;
    }

    return totalHits;
  }

  private buildEnterableHouses(): void {
    // 6 Enterable Houses in Downtown LS + 1 Starter Enterable House near the launch boulevard
    const world = getMapWorldData(this.mapId);
    const startPt = world.roadPoints[3] ?? { x: 0, z: -60 };
    const houseConfigs: Array<{
      name: string;
      x: number;
      z: number;
      doorYaw: number;
      color: number;
    }> = [
      {
        name: 'Vinewood Starter Villa #1',
        x: startPt.x + 28,
        z: startPt.z - 20,
        doorYaw: -Math.PI / 2,
        color: 0xf59e0b,
      },
      { name: 'Downtown LS House #101', x: -34, z: -1600, doorYaw: Math.PI / 2, color: 0x38bdf8 },
      { name: 'Downtown LS House #102', x: 34, z: -1640, doorYaw: -Math.PI / 2, color: 0xf43f5e },
      { name: 'Downtown LS House #103', x: -34, z: -1720, doorYaw: Math.PI / 2, color: 0xa855f7 },
      { name: 'Downtown LS House #104', x: 34, z: -1780, doorYaw: -Math.PI / 2, color: 0x10b981 },
      { name: 'Downtown LS House #105', x: -34, z: -1900, doorYaw: Math.PI / 2, color: 0xeab308 },
      { name: 'Downtown LS House #106', x: 34, z: -1950, doorYaw: -Math.PI / 2, color: 0x06b6d4 },
    ];

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3f2305, roughness: 0.55 });
    const tvBezelMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      metalness: 0.6,
      roughness: 0.25,
    });
    const tvScreenMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 1.5,
      roughness: 0.15,
    });
    const sofaLeatherMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 });
    const fridgeMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.75,
      roughness: 0.25,
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 2.0,
    });

    houseConfigs.forEach((cfg, idx) => {
      const y = groundHeightAt(cfg.x, cfg.z, this.mapId);
      const houseGroup = new THREE.Group();
      houseGroup.position.set(cfg.x, y, cfg.z);
      houseGroup.rotation.y = cfg.doorYaw;

      const W = 10;
      const D = 10;
      const H = 4.2;
      const doorHalfWidth = 1.6;
      const wallThick = 0.36;

      // Walkable interior floor
      const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), floorMat);
      floor.position.set(0, 0.06, 0);
      houseGroup.add(floor);

      // Back wall (-Z)
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallThick), wallMat);
      backWall.position.set(0, H * 0.5, -D * 0.5);
      houseGroup.add(backWall);

      // Left & Right side walls
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, H, D), wallMat);
      leftWall.position.set(-W * 0.5, H * 0.5, 0);
      houseGroup.add(leftWall);

      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, H, D), wallMat);
      rightWall.position.set(W * 0.5, H * 0.5, 0);
      houseGroup.add(rightWall);

      // Front wall (+Z) with open walk-in doorway (3.2m wide x 3.1m high)
      const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(3.4, H, wallThick), wallMat);
      frontLeft.position.set(-3.3, H * 0.5, D * 0.5);
      houseGroup.add(frontLeft);

      const frontRight = new THREE.Mesh(new THREE.BoxGeometry(3.4, H, wallThick), wallMat);
      frontRight.position.set(3.3, H * 0.5, D * 0.5);
      houseGroup.add(frontRight);

      const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, wallThick), wallMat);
      lintel.position.set(0, H - 0.55, D * 0.5);
      houseGroup.add(lintel);

      // Glowing neon doorframe arch marking the only entrance door
      const accentMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: cfg.color,
        emissiveIntensity: 1.8,
      });
      const doorArch = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 0.45), accentMat);
      doorArch.position.set(0, 3.15, D * 0.5);
      houseGroup.add(doorArch);

      // Hinged open wooden door panel beside the doorway
      const openDoorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, 1.35), darkWoodMat);
      openDoorPanel.position.set(-1.55, 1.55, D * 0.5 - 0.68);
      openDoorPanel.rotation.y = 0.25;
      houseGroup.add(openDoorPanel);

      // Roof slab & warm ceiling lamp
      const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.8, 0.35, D + 0.8), roofMat);
      roof.position.set(0, H + 0.17, 0);
      houseGroup.add(roof);

      const ceilingLamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), lampMat);
      ceilingLamp.position.set(0, H - 0.2, -0.3);
      houseGroup.add(ceilingLamp);

      // --- INTERIOR FURNITURE: SOFA, TV, COFFEE TABLE, RUG, BED, BOOKSHELF & FRIDGE ---

      // 1. Plush Living Room Sofa (left side lx = -3.1, lz = -0.2, facing +X toward the TV)
      const sofaGroup = new THREE.Group();
      sofaGroup.position.set(-3.1, 0.12, -0.2);

      const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.36, 2.7), sofaLeatherMat);
      sofaBase.position.set(0, 0.18, 0);
      sofaGroup.add(sofaBase);

      const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 2.7), sofaLeatherMat);
      sofaBack.position.set(-0.42, 0.46, 0);
      sofaGroup.add(sofaBack);

      const sofaArmL = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.58, 0.26), sofaLeatherMat);
      sofaArmL.position.set(0, 0.32, -1.24);
      sofaGroup.add(sofaArmL);

      const sofaArmR = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.58, 0.26), sofaLeatherMat);
      sofaArmR.position.set(0, 0.32, 1.24);
      sofaGroup.add(sofaArmR);

      // Throw pillows on sofa
      const pillowMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.5 });
      const pillow1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.45), pillowMat);
      pillow1.position.set(-0.22, 0.52, -0.75);
      pillow1.rotation.z = -0.25;
      sofaGroup.add(pillow1);

      const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.45), pillowMat);
      pillow2.position.set(-0.22, 0.52, 0.75);
      pillow2.rotation.z = -0.25;
      sofaGroup.add(pillow2);

      houseGroup.add(sofaGroup);

      // 2. Widescreen Flat-Panel TV, Entertainment Stand & Stereo Speakers (right wall lx = +4.25, lz = -0.2)
      const tvGroup = new THREE.Group();
      tvGroup.position.set(4.25, 0.12, -0.2);

      const tvConsole = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.56, 2.5), darkWoodMat);
      tvConsole.position.set(0, 0.28, 0);
      tvGroup.add(tvConsole);

      const tvStandNeck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.45), tvBezelMat);
      tvStandNeck.position.set(0, 0.65, 0);
      tvGroup.add(tvStandNeck);

      const tvPanelBezel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.18, 2.2), tvBezelMat);
      tvPanelBezel.position.set(0, 1.32, 0);
      tvGroup.add(tvPanelBezel);

      const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.02, 2.02), tvScreenMat);
      tvScreen.position.set(-0.02, 1.32, 0);
      tvGroup.add(tvScreen);

      const tvTickerBar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 1.85), accentMat);
      tvTickerBar.position.set(-0.03, 0.96, 0);
      tvGroup.add(tvTickerBar);

      const speakerL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.08, 0.34), tvBezelMat);
      speakerL.position.set(0, 0.54, -1.55);
      tvGroup.add(speakerL);

      const speakerR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.08, 0.34), tvBezelMat);
      speakerR.position.set(0, 0.54, 1.55);
      tvGroup.add(speakerR);

      houseGroup.add(tvGroup);

      // 3. Living Room Rug & Coffee Table (between sofa and TV)
      const rug = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 0.03, 2.8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }),
      );
      rug.position.set(0.4, 0.13, -0.2);
      houseGroup.add(rug);

      const coffeeTable = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 1.45), darkWoodMat);
      coffeeTable.position.set(1.25, 0.33, -0.2);
      houseGroup.add(coffeeTable);

      // 4. Bedroom Corner Bed (back-left corner lx = -3.1, lz = -3.45)
      const bedGroup = new THREE.Group();
      bedGroup.position.set(-3.1, 0.12, -3.45);

      const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.32, 2.3), darkWoodMat);
      bedFrame.position.set(0, 0.16, 0);
      bedGroup.add(bedFrame);

      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.24, 2.15), mattressMat);
      mattress.position.set(0, 0.4, 0);
      bedGroup.add(mattress);

      const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.97, 0.26, 1.35), pillowMat);
      duvet.position.set(0, 0.41, 0.38);
      bedGroup.add(duvet);

      const headboard = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.05, 0.2), darkWoodMat);
      headboard.position.set(0, 0.52, -1.08);
      bedGroup.add(headboard);

      houseGroup.add(bedGroup);

      // 5. Bookshelf & Refrigerator (back-right corner lx = +2.8, lz = -4.2)
      const bookshelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.1, 0.48), darkWoodMat);
      bookshelf.position.set(2.1, 1.17, -4.4);
      houseGroup.add(bookshelf);

      const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.05, 0.85), fridgeMat);
      fridge.position.set(3.8, 1.14, -4.2);
      houseGroup.add(fridge);

      this.group.add(houseGroup);

      const halfW = W * 0.5;
      const halfD = D * 0.5;
      const wt = 0.26;

      // 5 Solid Exterior Wall Colliders: Back, Left, Right, Front-Left, Front-Right
      // Only the front doorway gap (-doorHalfWidth .. +doorHalfWidth at lz = +halfD) is open!
      const wallBoxes: LocalBox2D[] = [
        // Back wall (-Z)
        { minX: -halfW - wt, maxX: halfW + wt, minZ: -halfD - wt, maxZ: -halfD + wt },
        // Left wall (-X)
        { minX: -halfW - wt, maxX: -halfW + wt, minZ: -halfD - wt, maxZ: halfD + wt },
        // Right wall (+X)
        { minX: halfW - wt, maxX: halfW + wt, minZ: -halfD - wt, maxZ: halfD + wt },
        // Front-Left wall (+Z, left of doorway)
        { minX: -halfW - wt, maxX: -doorHalfWidth, minZ: halfD - wt, maxZ: halfD + wt },
        // Front-Right wall (+Z, right of doorway)
        { minX: doorHalfWidth, maxX: halfW + wt, minZ: halfD - wt, maxZ: halfD + wt },
      ];

      const furnitureBoxes: LocalBox2D[] = [
        // Sofa collider
        { minX: -3.65, maxX: -2.55, minZ: -1.55, maxZ: 1.15 },
        // TV & console collider
        { minX: 3.9, maxX: 4.65, minZ: -1.8, maxZ: 1.4 },
        // Bed collider
        { minX: -4.15, maxX: -2.05, minZ: -4.65, maxZ: -2.3 },
        // Bookshelf & Fridge collider
        { minX: 1.25, maxX: 4.35, minZ: -4.75, maxZ: -3.75 },
      ];

      this.houses.push({
        id: `house-${idx}`,
        name: cfg.name,
        x: cfg.x,
        y,
        z: cfg.z,
        doorFacingYaw: cfg.doorYaw,
        width: W,
        depth: D,
        doorHalfWidth,
        wallBoxes,
        furnitureBoxes,
        hasSofa: true,
        hasTv: true,
        hasBed: true,
      });
    });
  }

  private buildMysteryBoxesOnRoads(): void {
    const world = getMapWorldData(this.mapId);
    const pts = world.roadPoints;
    const coords: Array<[number, number]> = [];

    for (let i = 0; i < 10; i++) {
      const idx = (i * Math.max(1, Math.floor(pts.length / 10)) + 2) % pts.length;
      coords.push([pts[idx].x, pts[idx].z]);
    }
    const lsRoadZ = [-1520, -1610, -1700, -1790, -1880, -1970, -2080, -2200];
    for (const z of lsRoadZ) {
      coords.push([0, z]);
    }

    const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 1.4,
      metalness: 0.45,
      roughness: 0.25,
    });
    const ringGeo = new THREE.TorusGeometry(1.15, 0.08, 8, 20);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });

    coords.forEach(([x, z], idx) => {
      const y = groundHeightAt(x, z, this.mapId);
      const g = new THREE.Group();
      g.position.set(x, y + 1.1, z);

      const cube = new THREE.Mesh(boxGeo, boxMat);
      g.add(cube);

      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(0, -0.85, 0);
      g.add(ring);

      this.group.add(g);
      this.mysteryBoxes.push({
        id: `mystery-${idx}`,
        x,
        y: y + 1.1,
        z,
        active: true,
        respawnTimer: 0,
        mesh: g,
      });
    });
  }

  private buildEnergyDrinks(): void {
    const world = getMapWorldData(this.mapId);
    const pts = world.roadPoints;
    const coords: Array<[number, number]> = [];

    for (let i = 0; i < 8; i++) {
      const idx = (i * Math.max(1, Math.floor(pts.length / 8)) + 4) % pts.length;
      coords.push([pts[idx].x + 6, pts[idx].z]);
    }
    const lsDrinks: Array<[number, number]> = [
      [-17, -1595],
      [17, -1635],
      [-17, -1715],
      [17, -1775],
      [-17, -1895],
      [17, -1945],
      [-16, -1530],
      [16, -1830],
    ];
    coords.push(...lsDrinks);

    const canGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.95, 12);
    const canMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 1.6,
      metalness: 0.6,
      roughness: 0.2,
    });

    coords.forEach(([x, z], idx) => {
      const y = groundHeightAt(x, z, this.mapId);
      const g = new THREE.Group();
      g.position.set(x, y + 0.75, z);
      const can = new THREE.Mesh(canGeo, canMat);
      g.add(can);
      this.group.add(g);

      this.energyDrinks.push({
        id: `energy-${idx}`,
        x,
        y: y + 0.75,
        z,
        active: true,
        respawnTimer: 0,
        mesh: g,
      });
    });
  }

  private buildPolicePool(): void {
    const uniformMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.65 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xdba888, roughness: 0.65 });
    const badgeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Build max 2 LSPD Police Officers ("only some police should come")
    for (let i = 0; i < 2; i++) {
      const root = new THREE.Group();
      root.visible = false;

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.25), uniformMat);
      torso.position.set(0, 1.16, 0);
      root.add(torso);

      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.03), badgeMat);
      badge.position.set(0.1, 1.3, 0.14);
      root.add(badge);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), skinMat);
      head.position.set(0, 1.62, 0);
      root.add(head);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 8), uniformMat);
      cap.position.set(0, 1.74, 0);
      root.add(cap);

      const makeLimb = (lx: number, ly: number, w: number, h: number, m: THREE.Material) => {
        const g = new THREE.Group();
        g.position.set(lx, ly, 0);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m);
        mesh.position.set(0, -h * 0.5, 0);
        g.add(mesh);
        root.add(g);
        return g;
      };

      const leftArm = makeLimb(0.28, 1.4, 0.12, 0.52, uniformMat);
      const rightArm = makeLimb(-0.28, 1.4, 0.12, 0.52, uniformMat);
      const leftLeg = makeLimb(0.12, 0.75, 0.15, 0.75, pantsMat);
      const rightLeg = makeLimb(-0.12, 0.75, 0.15, 0.75, pantsMat);

      const batonOrGun = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 0.42),
        new THREE.MeshStandardMaterial({ color: 0x09090b }),
      );
      batonOrGun.position.set(0, -0.48, 0.18);
      rightArm.add(batonOrGun);

      const muzzleFlash = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      );
      muzzleFlash.position.set(0, -0.48, 0.45);
      muzzleFlash.visible = false;
      rightArm.add(muzzleFlash);

      this.group.add(root);
      this.policeOfficers.push({
        id: `lspd-officer-${i}`,
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        hp: 75,
        maxHp: 75,
        active: false,
        attackCooldown: 1.2,
        root,
        leftArm,
        rightArm,
        leftLeg,
        rightLeg,
        muzzleFlash,
      });
    }

    // Build 1 LSPD Interceptor Police Cruiser
    const root = new THREE.Group();
    root.visible = false;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.68, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.25 }),
    );
    body.position.set(0, 0.55, 0);
    root.add(body);

    const doors = new THREE.Mesh(
      new THREE.BoxGeometry(2.04, 0.58, 1.9),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
    );
    doors.position.set(0, 0.56, 0);
    root.add(doors);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.52, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 }),
    );
    cabin.position.set(0, 1.1, -0.15);
    root.add(cabin);

    const redSirenMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xff1e2d,
      emissiveIntensity: 4.0,
    });
    const blueSirenMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 4.0,
    });
    const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.24), redSirenMat);
    redBar.position.set(0.32, 1.42, 0);
    root.add(redBar);

    const blueBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.24), blueSirenMat);
    blueBar.position.set(-0.32, 1.42, 0);
    root.add(blueBar);

    this.group.add(root);
    this.policeCruisers.push({
      id: 'lspd-cruiser-0',
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      speed: 0,
      hp: 150,
      active: false,
      root,
      redSirenMat,
      blueSirenMat,
    });
  }

  private lastFocusX = 0;
  private lastFocusZ = 0;
  private lastFocusYaw = Math.PI;

  public update(
    dt: number,
    elapsed: number,
    car: VehicleState,
    onFootInput: OnFootInput,
    livingWorld: LivingWorldController | null,
    onActorHit?: (evt: HitReactionEvent) => void,
    onActionEvent?: (evt: FreestyleActionEvent) => void,
  ): void {
    const safeDt = clamp(dt, 0.001, 0.05);
    this.weaponCooldown = Math.max(0, this.weaponCooldown - safeDt);
    this.policeReinforceCooldown = Math.max(0, this.policeReinforceCooldown - safeDt);

    if (this.bulletTracerTimer > 0) {
      this.bulletTracerTimer -= safeDt;
      if (this.bulletTracerTimer <= 0) {
        this.bulletTracerLine.visible = false;
        this.playerMuzzleFlash.visible = false;
      }
    }
    if (this.policeTracerTimer > 0) {
      this.policeTracerTimer -= safeDt;
      if (this.policeTracerTimer <= 0) {
        this.policeTracerLine.visible = false;
        for (const off of this.policeOfficers) off.muzzleFlash.visible = false;
      }
    }

    // Step 3D Gold Bullet Projectiles in flight
    for (const b of this.goldBullets) {
      if (!b.active) continue;
      const prevX = b.x;
      const prevZ = b.z;
      const stepDist = Math.hypot(b.vx, b.vz) * safeDt;
      b.x += b.vx * safeDt;
      b.z += b.vz * safeDt;
      b.traveled += stepDist;
      if (
        b.traveled >= b.maxRange ||
        this.isSegmentBlockedByHouseWall(prevX, prevZ, b.x, b.z)
      ) {
        b.active = false;
        b.mesh.visible = false;
      } else {
        b.mesh.position.set(b.x, b.y, b.z);
      }
    }

    if (this.activePowerTimer > 0) {
      this.activePowerTimer -= safeDt;
      if (this.activePowerTimer <= 0) {
        this.activePower = null;
      }
    }

    // Handle Character Death & Respawn
    if (this.isDead) {
      this.deathTimer -= safeDt;
      this.playerBody.rotation.x = -Math.PI * 0.46;
      this.playerBody.position.y = 0.15;
      if (this.deathTimer <= 0) {
        this.isDead = false;
        this.health = this.maxHealth;
        this.energy = 100;
        this.wantedLevel = 0;
        this.dismissAllPolice();
        this.playerBody.rotation.set(0, 0, 0);
        this.playerBody.position.set(0, 0, 0);
      }
      return;
    }

    // Prevent cars from driving through house walls
    this.resolveCarHouseCollision(car);

    // 1. Update On-Foot Character Movement, Manual Aiming & Solid House Wall Collisions
    if (this.isOnFoot) {
      const speedMult = this.activePower === 'SUPER SPEED' ? 1.55 : 1.0;
      const sprinting = onFootInput.sprint && this.energy > 5;
      const baseWalkSpeed = (sprinting ? 11.5 : 6.8) * speedMult;

      // Manual aiming via keyboard turn OR mouse world pointer
      if (Math.abs(onFootInput.turn) > 0.01) {
        this.charYaw -= onFootInput.turn * 2.8 * safeDt;
      } else if (
        onFootInput.aimWorldX !== undefined &&
        onFootInput.aimWorldX !== null &&
        onFootInput.aimWorldZ !== undefined &&
        onFootInput.aimWorldZ !== null
      ) {
        const adx = onFootInput.aimWorldX - this.charX;
        const adz = onFootInput.aimWorldZ - this.charZ;
        if (adx * adx + adz * adz > 0.09) {
          this.charYaw = Math.atan2(adx, adz);
        }
      }

      const moveInput = clamp(onFootInput.forward, -1, 1);
      const strafeInput = clamp(onFootInput.strafe ?? 0, -1, 1);
      this.charSpeed = Math.hypot(moveInput, strafeInput) * baseWalkSpeed;

      if (Math.abs(moveInput) > 0.01 || Math.abs(strafeInput) > 0.01) {
        const fwdX = Math.sin(this.charYaw) * moveInput * baseWalkSpeed * safeDt;
        const fwdZ = Math.cos(this.charYaw) * moveInput * baseWalkSpeed * safeDt;
        const rightX = -Math.cos(this.charYaw) * strafeInput * baseWalkSpeed * safeDt;
        const rightZ = Math.sin(this.charYaw) * strafeInput * baseWalkSpeed * safeDt;

        const nextX = this.charX + fwdX + rightX;
        const nextZ = this.charZ + fwdZ + rightZ;

        // Enforce solid house walls (character can only enter/exit houses through the open door!)
        const resolved = this.resolveCharacterHouseCollision(
          this.charX,
          this.charZ,
          nextX,
          nextZ,
          0.4,
        );
        this.charX = resolved.x;
        this.charZ = resolved.z;

        if (sprinting) {
          this.energy = Math.max(0, this.energy - 10 * safeDt);
        } else {
          this.energy = Math.min(100, this.energy + 4 * safeDt);
        }
      } else {
        this.energy = Math.min(100, this.energy + 8 * safeDt);
      }

      this.charY = groundHeightAt(this.charX, this.charZ, this.mapId);
      this.playerRoot.position.set(this.charX, this.charY, this.charZ);
      this.playerRoot.rotation.y = this.charYaw;

      const walkSwing =
        Math.abs(this.charSpeed) > 0.2 ? Math.sin(elapsed * 12) * 0.65 : 0;
      this.playerLeftLeg.rotation.x = walkSwing;
      this.playerRightLeg.rotation.x = -walkSwing;
      this.playerLeftArm.rotation.x = -walkSwing * 0.7;
      if (this.weaponCooldown <= 0) {
        this.playerRightArm.rotation.x =
          this.equippedWeapon === 'fists' ? walkSwing * 0.7 : -0.55;
      }

      if (onFootInput.attack && this.weaponCooldown <= 0) {
        this.triggerWeaponAttack(livingWorld, onActorHit, onActionEvent);
      }
    } else {
      this.energy = Math.min(100, this.energy + 6 * safeDt);
    }

    const focusX = this.isOnFoot ? this.charX : car.x;
    const focusY = this.isOnFoot ? this.charY : car.y;
    const focusZ = this.isOnFoot ? this.charZ : car.z;
    this.lastFocusX = focusX;
    this.lastFocusZ = focusZ;
    this.lastFocusYaw = this.isOnFoot ? this.charYaw : car.yaw;

    // 2. Check proximity to Enterable Downtown LS Houses
    let closestHouse: string | null = null;
    for (const h of this.houses) {
      const dist = Math.hypot(focusX - h.x, focusZ - h.z);
      if (dist < 14) {
        closestHouse = h.name;
        break;
      }
    }
    this.nearHouseName = closestHouse;

    // 3. Update Mystery Boxes on Roads
    for (const box of this.mysteryBoxes) {
      if (!box.active) {
        box.respawnTimer -= safeDt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
        }
        continue;
      }
      box.mesh.rotation.y = elapsed * 2.2;
      box.mesh.position.y = box.y + Math.sin(elapsed * 3.5) * 0.22;

      const d = Math.hypot(focusX - box.x, focusZ - box.z);
      if (d < 3.4) {
        box.active = false;
        box.respawnTimer = 18;
        box.mesh.visible = false;
        const pwr = MYSTERY_POWERS[this.powerIndexCursor % MYSTERY_POWERS.length];
        this.powerIndexCursor += 1;
        this.activePower = pwr;
        this.activePowerTimer = 15;

        let bonusCoins = 25;
        if (pwr === 'MEGA COINS +100') {
          bonusCoins = 100;
        } else if (pwr === 'CLEAR POLICE') {
          this.wantedLevel = 0;
          this.dismissAllPolice();
        }
        onActionEvent?.({
          title: `MYSTERY BOX: ${pwr}!`,
          coinsAwarded: bonusCoins,
          powerActivated: pwr,
        });
      }
    }

    // 4. Update Energy Drink Pickups
    for (const drink of this.energyDrinks) {
      if (!drink.active) {
        drink.respawnTimer -= safeDt;
        if (drink.respawnTimer <= 0) {
          drink.active = true;
          drink.mesh.visible = true;
        }
        continue;
      }
      drink.mesh.rotation.y = elapsed * 2.8;
      const d = Math.hypot(focusX - drink.x, focusZ - drink.z);
      if (d < 2.8) {
        drink.active = false;
        drink.respawnTimer = 15;
        drink.mesh.visible = false;
        this.useEnergyDrink();
        onActionEvent?.({
          title: 'ENERGY DRINK — 100% FULL HP & ENERGY!',
          coinsAwarded: 10,
        });
      }
    }

    // 5. Update Wanted Level & Small Police Patrol AI
    if (this.wantedLevel > 0) {
      this.wantedDecayTimer -= safeDt;
      if (this.wantedDecayTimer <= 0) {
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
        this.wantedDecayTimer = 25;
        if (this.wantedLevel === 0) {
          this.dismissAllPolice();
        }
      } else if (
        this.policeReinforceCooldown <= 0 &&
        !this.policeOfficers.some((o) => o.active)
      ) {
        this.ensurePoliceDeployed();
      }

      // Update LSPD Cruiser
      const sirenFlash = Math.sin(elapsed * 18) > 0;
      for (const cruiser of this.policeCruisers) {
        if (!cruiser.active) continue;
        cruiser.redSirenMat.emissiveIntensity = sirenFlash ? 4.8 : 0.4;
        cruiser.blueSirenMat.emissiveIntensity = sirenFlash ? 0.4 : 4.8;

        const dx = focusX - cruiser.x;
        const dz = focusZ - cruiser.z;
        const dist = Math.hypot(dx, dz);
        cruiser.yaw = Math.atan2(dx, dz);
        const stopDist = this.isOnFoot ? 11.5 : 5.2;
        if (dist > stopDist) {
          const cSpeed = clamp(dist * 1.15, 9, 24);
          cruiser.x += Math.sin(cruiser.yaw) * cSpeed * safeDt;
          cruiser.z += Math.cos(cruiser.yaw) * cSpeed * safeDt;
        }
        cruiser.y = groundHeightAt(cruiser.x, cruiser.z, this.mapId);
        cruiser.root.position.set(cruiser.x, cruiser.y, cruiser.z);
        cruiser.root.rotation.y = cruiser.yaw;
      }

      // Update Armed LSPD Police Officers chasing, beating & shooting the player
      for (const officer of this.policeOfficers) {
        if (!officer.active) continue;
        const dx = focusX - officer.x;
        const dz = focusZ - officer.z;
        const dist = Math.hypot(dx, dz);

        // Check if player runs over the police officer with their car
        if (!this.isOnFoot && dist < 2.3 && car.speedKmh > 18) {
          officer.active = false;
          officer.root.visible = false;
          livingWorld?.spawnExternalBlood(
            officer.x,
            officer.y + 0.8,
            officer.z,
            car.vx,
            car.vz,
            26,
            1.35,
          );
          onActionEvent?.({
            title: 'RAMMED LSPD OFFICER!',
            coinsAwarded: 35,
          });
          continue;
        }

        officer.yaw = Math.atan2(dx, dz);
        if (dist > 2.0) {
          const walkSpd = 4.8;
          const nextOx = officer.x + Math.sin(officer.yaw) * walkSpd * safeDt;
          const nextOz = officer.z + Math.cos(officer.yaw) * walkSpd * safeDt;
          // Police officers also must respect solid house walls and use doors!
          const res = this.resolveCharacterHouseCollision(
            officer.x,
            officer.z,
            nextOx,
            nextOz,
            0.4,
          );
          officer.x = res.x;
          officer.z = res.z;
          const sw = Math.sin(elapsed * 11) * 0.55;
          officer.leftLeg.rotation.x = sw;
          officer.rightLeg.rotation.x = -sw;
          officer.leftArm.rotation.x = -sw * 0.5;
        }
        officer.y = groundHeightAt(officer.x, officer.z, this.mapId);
        officer.root.position.set(officer.x, officer.y, officer.z);
        officer.root.rotation.y = officer.yaw;
        officer.rightArm.rotation.x = -0.65;

        officer.attackCooldown -= safeDt;
        if (
          officer.attackCooldown <= 0 &&
          dist < 18 &&
          !this.isSegmentBlockedByHouseWall(officer.x, officer.z, focusX, focusZ)
        ) {
          const isMeleeBeat = dist < 2.6;
          officer.attackCooldown = isMeleeBeat ? 1.05 : 1.55;

          if (!isMeleeBeat) {
            officer.muzzleFlash.visible = true;
            const posAttr = this.policeTracerLine.geometry.getAttribute(
              'position',
            ) as THREE.BufferAttribute;
            posAttr.setXYZ(0, officer.x, officer.y + 1.25, officer.z);
            posAttr.setXYZ(1, focusX, focusY + 1.0, focusZ);
            posAttr.needsUpdate = true;
            this.policeTracerLine.visible = true;
            this.policeTracerTimer = 0.08;
          } else {
            officer.rightArm.rotation.x = -1.45;
          }

          if (this.activePower !== 'INVINCIBLE SHIELD') {
            const rawDamage = isMeleeBeat ? 12 : 9;
            const damage = this.isOnFoot ? rawDamage : Math.ceil(rawDamage * 0.4);
            this.applyPlayerDamage(damage, livingWorld, onActionEvent);
          }
        }
      }
    }
  }

  public applyPlayerDamage(
    damage: number,
    livingWorld: LivingWorldController | null,
    onActionEvent?: (evt: FreestyleActionEvent) => void,
  ): void {
    if (this.isDead || this.activePower === 'INVINCIBLE SHIELD') return;
    this.health = Math.max(0, this.health - damage);
    const px = this.isOnFoot ? this.charX : this.lastFocusX;
    const py = this.isOnFoot ? this.charY : groundHeightAt(px, this.lastFocusZ, this.mapId);
    const pz = this.isOnFoot ? this.charZ : this.lastFocusZ;

    livingWorld?.spawnExternalBlood(px, py + 0.9, pz, 0, 0, 14, 0.85);

    if (this.health <= 0) {
      this.isDead = true;
      this.deathTimer = 2.8;
      livingWorld?.spawnExternalBlood(px, py + 0.5, pz, 0, 0, 32, 1.65);
      onActionEvent?.({
        title: 'WASTED — KILLED BY LSPD POLICE!',
        coinsAwarded: 0,
        isPlayerDeath: true,
      });
    }
  }

  public dismissAllPolice(): void {
    for (const off of this.policeOfficers) {
      off.active = false;
      off.root.visible = false;
    }
    for (const c of this.policeCruisers) {
      c.active = false;
      c.root.visible = false;
    }
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (Array.isArray(m.material)) {
        m.material.forEach((mat) => mat.dispose());
      } else if (m.material) {
        m.material.dispose();
      }
    });
  }
}
