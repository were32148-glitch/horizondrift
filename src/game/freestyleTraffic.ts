import { clamp, getDrivableSurfaceHeight, type MapWorldData } from './terrain';
import type { CarSpec, MapId, VehicleInput, VehicleState } from './types';
import { createVehicleStateAt } from './vehiclePhysics';

export interface TrafficCarVariant {
  carId: CarSpec['id'];
  paintHex: number;
  stripeHex: number;
  rimHex: number;
  bodyStyle: CarSpec['bodyStyle'];
  numberLabel: string;
}

export const FREESTYLE_TRAFFIC_VARIANTS: TrafficCarVariant[] = [
  { carId: 'apex', paintHex: 0xe2e8f0, stripeHex: 0x0f172a, rimHex: 0x94a3b8, bodyStyle: 'gt', numberLabel: 'T1' },
  { carId: 'viper', paintHex: 0x0284c7, stripeHex: 0xfef08a, rimHex: 0xe2e8f0, bodyStyle: 'track', numberLabel: 'T2' },
  { carId: 'baja', paintHex: 0xd97706, stripeHex: 0x1e293b, rimHex: 0x475569, bodyStyle: 'baja', numberLabel: 'T3' },
  { carId: 'phantom', paintHex: 0x1e293b, stripeHex: 0x38bdf8, rimHex: 0xcbd5e1, bodyStyle: 'hyper', numberLabel: 'T4' },
];

export interface FreestyleTrafficOptions {
  initialDelaySeconds?: number;
  minIntervalSeconds?: number;
  maxIntervalSeconds?: number;
  maxSlots?: number;
  minSpacingMeters?: number;
}

export interface TrafficSlot {
  active: boolean;
  vehicle: VehicleState;
  input: VehicleInput;
  variantIndex: number;
  activeElapsed: number;
  splineIndex: number;
  travelDir: 1 | -1;
  cruiseSpeed: number;
  laneOffset: number;
  wreckedTimer: number;
  wasInFrontOfPlayer: boolean;
  lastSampleX: number;
  lastSampleZ: number;
  cachedGroundY: number;
}

export class FreestyleTrafficController {
  public readonly slots: TrafficSlot[] = [];
  public spawnCount = 0;

  private readonly minInterval: number;
  private readonly maxInterval: number;
  private readonly initialDelay: number;
  private readonly minSpacingMeters: number;
  private cooldownTimer: number;

  constructor(
    private readonly mapId: MapId,
    options?: FreestyleTrafficOptions,
  ) {
    // Default ~12s cadence = 5 staggered oncoming bot cars per 1 minute, never together
    this.minInterval = options?.minIntervalSeconds ?? 11.0;
    this.maxInterval = options?.maxIntervalSeconds ?? 13.0;
    this.initialDelay = options?.initialDelaySeconds ?? 2.0;
    this.minSpacingMeters = options?.minSpacingMeters ?? 135;
    this.cooldownTimer = this.initialDelay;

    const slotCount = Math.max(1, options?.maxSlots ?? 2);
    for (let i = 0; i < slotCount; i++) {
      this.slots.push({
        active: false,
        vehicle: createVehicleStateAt(0, 0, 0, mapId),
        input: {
          throttle: 0.55,
          brake: 0,
          steer: 0,
          handbrake: false,
          boost: false,
        },
        variantIndex: i % FREESTYLE_TRAFFIC_VARIANTS.length,
        activeElapsed: 0,
        splineIndex: 0,
        travelDir: -1,
        cruiseSpeed: 17.5,
        laneOffset: 10.5,
        wreckedTimer: 0,
        wasInFrontOfPlayer: false,
        lastSampleX: Infinity,
        lastSampleZ: Infinity,
        cachedGroundY: 0,
      });
    }
  }

  public get active(): boolean {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].active) return true;
    }
    return false;
  }

  public get vehicle(): VehicleState {
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].active) return this.slots[i].vehicle;
    }
    return this.slots[0].vehicle;
  }

  public getCooldownRemaining(): number {
    return Math.max(0, this.cooldownTimer);
  }

  public reset(): void {
    this.cooldownTimer = this.initialDelay;
    for (const s of this.slots) {
      s.active = false;
      s.activeElapsed = 0;
      s.wreckedTimer = 0;
      s.wasInFrontOfPlayer = false;
      s.vehicle.vx = 0;
      s.vehicle.vz = 0;
      s.vehicle.speed = 0;
      s.vehicle.speedKmh = 0;
    }
  }

  private nextInterval(): number {
    const frac = ((this.spawnCount * 0.61803398875) % 1 + 1) % 1;
    return this.minInterval + (this.maxInterval - this.minInterval) * frac;
  }

  public spawnOppositeCar(player: VehicleState, world: MapWorldData): boolean {
    const slot = this.slots.find((s) => !s.active);
    if (!slot) return false;

    const pts = world.roadPoints;
    const count = pts.length;
    if (count < 16) return false;

    // 1. Find nearest road spline point to player
    let closestIdx = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < count; i++) {
      const dx = pts[i].x - player.x;
      const dz = pts[i].z - player.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        closestIdx = i;
      }
    }

    // 2. Determine player's forward direction along the road spline (+1 or -1)
    const curPt = pts[closestIdx];
    const nextPt = pts[(closestIdx + 1) % count];
    const segDx = nextPt.x - curPt.x;
    const segDz = nextPt.z - curPt.z;
    const playerFwdX = Math.sin(player.yaw);
    const playerFwdZ = Math.cos(player.yaw);
    const forwardDot = playerFwdX * segDx + playerFwdZ * segDz;
    const playerDir: 1 | -1 = forwardDot >= 0 ? 1 : -1;

    // 3. Place oncoming car ~250-290m AHEAD of player, traveling OPPOSITE (-playerDir)
    const stepSpacing = Math.max(4, Math.hypot(segDx, segDz));
    const lookaheadSteps = Math.round(clamp(265 / stepSpacing, 18, Math.floor(count * 0.25)));
    const spawnIdx = ((closestIdx + playerDir * lookaheadSteps) % count + count) % count;

    const travelDir: 1 | -1 = playerDir === 1 ? -1 : 1;
    const p0 = pts[spawnIdx];
    const p1 = pts[((spawnIdx + travelDir) % count + count) % count];
    const tx = p1.x - p0.x;
    const tz = p1.z - p0.z;
    const len = Math.hypot(tx, tz) || 1;
    const ux = tx / len;
    const uz = tz / len;
    const yaw = Math.atan2(ux, uz);

    // Right-hand side normal of bot travel direction places it in the oncoming lane
    const rx = -Math.cos(yaw);
    const rz = Math.sin(yaw);
    const roadHalf = Math.max(12, world.config.roadWidth * 0.5);
    const laneOffset = clamp(roadHalf * 0.42, 7.5, 11.5);

    const sx = p0.x + rx * laneOffset;
    const sz = p0.z + rz * laneOffset;

    // Ensure sequential oncoming cars never spawn bunched together!
    const minSpaceSq = this.minSpacingMeters * this.minSpacingMeters;
    for (let i = 0; i < this.slots.length; i++) {
      const other = this.slots[i];
      if (!other.active) continue;
      const dSq = (other.vehicle.x - sx) ** 2 + (other.vehicle.z - sz) ** 2;
      if (dSq < minSpaceSq) {
        return false;
      }
    }

    const groundY = getDrivableSurfaceHeight(sx, sz, player.y + 4, this.mapId).height;

    slot.variantIndex = this.spawnCount % FREESTYLE_TRAFFIC_VARIANTS.length;
    this.spawnCount += 1;
    slot.travelDir = travelDir;
    slot.splineIndex = spawnIdx;
    slot.laneOffset = laneOffset;
    slot.cruiseSpeed = 17.0 + (this.spawnCount % 3) * 1.4; // ~61-71 km/h steady cruising speed
    slot.active = true;
    slot.activeElapsed = 0;
    slot.wreckedTimer = 0;
    slot.wasInFrontOfPlayer = false;
    slot.lastSampleX = sx;
    slot.lastSampleZ = sz;
    slot.cachedGroundY = groundY;

    slot.vehicle = createVehicleStateAt(sx, sz, yaw, this.mapId);
    slot.vehicle.y = groundY + 0.82;
    slot.vehicle.vx = ux * slot.cruiseSpeed;
    slot.vehicle.vz = uz * slot.cruiseSpeed;
    slot.vehicle.speed = slot.cruiseSpeed;
    slot.vehicle.speedKmh = Math.round(slot.cruiseSpeed * 3.6);
    slot.vehicle.gear = 3;
    slot.vehicle.rpm = 3400;
    return true;
  }

  public update(dt: number, player: VehicleState, world: MapWorldData): void {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.05);

    // Independent staggered timer so ~5 cars/min spawn sequentially without clumping
    this.cooldownTimer -= safeDt;
    if (this.cooldownTimer <= 0) {
      if (this.spawnOppositeCar(player, world)) {
        this.cooldownTimer = this.nextInterval();
      } else {
        // Postpone slightly until spacing / slot opens so cars never appear together
        this.cooldownTimer = 1.5;
      }
    }

    const pts = world.roadPoints;
    const count = pts.length;

    for (let sIdx = 0; sIdx < this.slots.length; sIdx++) {
      const slot = this.slots[sIdx];
      if (!slot.active) continue;

      slot.activeElapsed += safeDt;
      const v = slot.vehicle;

      // Trigger post-collision skid/coast if hit hard by player
      if (v.impactIntensity > 0.22 && slot.wreckedTimer <= 0) {
        slot.wreckedTimer = 2.6;
      }
      v.impactIntensity = Math.max(0, v.impactIntensity - safeDt * 1.4);

      if (slot.wreckedTimer > 0) {
        slot.wreckedTimer -= safeDt;
        const drag = Math.exp(-1.8 * safeDt);
        v.vx *= drag;
        v.vz *= drag;
        v.x += v.vx * safeDt;
        v.z += v.vz * safeDt;
        v.speed = Math.hypot(v.vx, v.vz);
        v.speedKmh = Math.round(v.speed * 3.6);
        slot.input.throttle = 0;
        slot.input.brake = 1;
      } else if (count >= 4) {
        const nextIdx = ((slot.splineIndex + slot.travelDir) % count + count) % count;
        const lookIdx = ((slot.splineIndex + slot.travelDir * 2) % count + count) % count;

        const curPt = pts[slot.splineIndex];
        const nextPt = pts[nextIdx];
        const lookPt = pts[lookIdx];

        const rawTx = lookPt.x - curPt.x;
        const rawTz = lookPt.z - curPt.z;
        const tLen = Math.hypot(rawTx, rawTz) || 1;
        const ux = rawTx / tLen;
        const uz = rawTz / tLen;
        const tangentYaw = Math.atan2(ux, uz);
        const rx = -Math.cos(tangentYaw);
        const rz = Math.sin(tangentYaw);

        const targetX = nextPt.x + rx * slot.laneOffset;
        const targetZ = nextPt.z + rz * slot.laneOffset;

        const toTargetX = targetX - v.x;
        const toTargetZ = targetZ - v.z;
        const distToTarget = Math.hypot(toTargetX, toTargetZ);

        if (distToTarget < 12) {
          slot.splineIndex = nextIdx;
        }

        const desiredYaw = Math.atan2(toTargetX, toTargetZ);
        let yawDiff = desiredYaw - v.yaw;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        v.yaw += clamp(yawDiff, -2.5 * safeDt, 2.5 * safeDt);
        v.steerAngle = clamp(yawDiff * 0.45, -0.35, 0.35);

        const fwdX = Math.sin(v.yaw);
        const fwdZ = Math.cos(v.yaw);
        v.speed = v.speed + (slot.cruiseSpeed - v.speed) * (1 - Math.exp(-4 * safeDt));
        v.vx = fwdX * v.speed;
        v.vz = fwdZ * v.speed;
        v.x += v.vx * safeDt;
        v.z += v.vz * safeDt;
        v.speedKmh = Math.round(v.speed * 3.6);
        v.gear = 3;
        v.rpm = 3300;
        slot.input.throttle = 0.55;
        slot.input.brake = 0;
        slot.input.steer = clamp(yawDiff * 1.4, -1, 1);
      }

      // Lightly sample ground only when moved >= 1.5m
      const movedSq = (v.x - slot.lastSampleX) ** 2 + (v.z - slot.lastSampleZ) ** 2;
      if (movedSq > 2.25) {
        slot.lastSampleX = v.x;
        slot.lastSampleZ = v.z;
        slot.cachedGroundY = getDrivableSurfaceHeight(v.x, v.z, v.y + 3, this.mapId).height;
      }
      const targetY = slot.cachedGroundY + 0.82;
      v.y += (targetY - v.y) * (1 - Math.exp(-16 * safeDt));

      const wheelSpin = (v.speed * safeDt) / 0.72;
      for (let i = 0; i < 4; i++) {
        v.wheels[i].spinAngle += wheelSpin;
        if (i < 2) v.wheels[i].steerAngle = v.steerAngle;
      }

      // Despawn cleanly once passed well behind player or exceeded distance/duration
      const dx = v.x - player.x;
      const dz = v.z - player.z;
      const distSq = dx * dx + dz * dz;
      const playerFwdDot = dx * Math.sin(player.yaw) + dz * Math.cos(player.yaw);
      if (playerFwdDot > 15) {
        slot.wasInFrontOfPlayer = true;
      }

      const passedFarBehind = slot.wasInFrontOfPlayer && playerFwdDot < -120 && distSq > 130 * 130;
      if (distSq > 360 * 360 || passedFarBehind || slot.activeElapsed > 36) {
        slot.active = false;
        slot.activeElapsed = 0;
        slot.wreckedTimer = 0;
      }
    }
  }
}
