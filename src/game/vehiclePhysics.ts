import {
  WORLD_RADIUS,
  clamp,
  getMapWorldData,
  getTerrainSample,
  groundHeightAt,
  lerp,
} from './terrain';
import type {
  CarSpec,
  MapId,
  SurfaceType,
  VehicleInput,
  VehicleState,
  WeatherComputed,
  WheelTelemetry,
  WorldObstacle,
} from './types';

export interface SurfacePhysicsProps {
  grip: number;
  rollingDrag: number;
  offroadDamping: number;
  maxSteerGrip: number;
}

export const SURFACE_PARAMS: Record<SurfaceType, SurfacePhysicsProps> = {
  asphalt: { grip: 1.0, rollingDrag: 0.012, offroadDamping: 0.0, maxSteerGrip: 1.0 },
  dirt: { grip: 0.8, rollingDrag: 0.024, offroadDamping: 0.14, maxSteerGrip: 0.85 },
  grass: { grip: 0.74, rollingDrag: 0.032, offroadDamping: 0.24, maxSteerGrip: 0.78 },
  forest: { grip: 0.7, rollingDrag: 0.038, offroadDamping: 0.3, maxSteerGrip: 0.75 },
  rock: { grip: 0.84, rollingDrag: 0.026, offroadDamping: 0.12, maxSteerGrip: 0.86 },
  snow: { grip: 0.56, rollingDrag: 0.035, offroadDamping: 0.28, maxSteerGrip: 0.6 },
  sand: { grip: 0.64, rollingDrag: 0.048, offroadDamping: 0.38, maxSteerGrip: 0.68 },
  water: { grip: 0.52, rollingDrag: 0.085, offroadDamping: 0.85, maxSteerGrip: 0.55 },
};

const CAR_HALF_WIDTH = 0.98;
const CAR_HALF_LENGTH = 1.85;
const WHEEL_REST_OFFSET = 0.56;
const GRAVITY = 24.0;
const CHASSIS_RADIUS = 1.72;

const GEAR_MAX_SPEEDS = [0, 14, 24, 34, 46, 58, 72];

export class ObstacleGrid {
  private cellSize = 24;
  private buckets = new Map<string, WorldObstacle[]>();

  constructor(obstacles: WorldObstacle[]) {
    for (const obs of obstacles) {
      const cx = Math.floor(obs.x / this.cellSize);
      const cz = Math.floor(obs.z / this.cellSize);
      const key = `${cx},${cz}`;
      let arr = this.buckets.get(key);
      if (!arr) {
        arr = [];
        this.buckets.set(key, arr);
      }
      arr.push(obs);
    }
  }

  queryNear(x: number, z: number, out: WorldObstacle[]): WorldObstacle[] {
    out.length = 0;
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const arr = this.buckets.get(`${cx + dx},${cz + dz}`);
        if (arr) {
          for (let i = 0; i < arr.length; i++) {
            out.push(arr[i]);
          }
        }
      }
    }
    return out;
  }
}

function makeEmptyWheel(): WheelTelemetry {
  return {
    compression: 0.5,
    grounded: true,
    slip: 0,
    steerAngle: 0,
    spinAngle: 0,
    surface: 'asphalt',
  };
}

export function createVehicleStateAt(
  x: number,
  z: number,
  yaw: number,
  mapId: MapId = 'valley',
): VehicleState {
  const spawnY = groundHeightAt(x, z, mapId) + WHEEL_REST_OFFSET;
  return {
    x,
    y: spawnY,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    pitch: 0,
    roll: 0,
    angularVelY: 0,
    pitchVel: 0,
    rollVel: 0,
    steerAngle: 0,
    speed: 0,
    speedKmh: 0,
    rpm: 950,
    gear: 1,
    boostFuel: 100,
    isBoosting: false,
    isDrifting: false,
    driftScore: 0,
    totalDriftScore: 0,
    airTime: 0,
    groundedCount: 4,
    surface: 'asphalt',
    biome: 'Scenic Highway',
    wheels: [makeEmptyWheel(), makeEmptyWheel(), makeEmptyWheel(), makeEmptyWheel()],
    impactIntensity: 0,
    landedIntensity: 0,
    headlightsOn: false,
  };
}

export function createInitialVehicleState(mapId: MapId = 'valley'): VehicleState {
  const world = getMapWorldData(mapId);
  return createVehicleStateAt(world.startPose.x, world.startPose.z, world.startPose.yaw, mapId);
}

const _nearbyObstacles: WorldObstacle[] = [];

const WHEEL_LOCAL_COORDS: readonly [number, number][] = [
  [CAR_HALF_WIDTH, CAR_HALF_LENGTH * 0.78],
  [-CAR_HALF_WIDTH, CAR_HALF_LENGTH * 0.78],
  [CAR_HALF_WIDTH, -CAR_HALF_LENGTH * 0.78],
  [-CAR_HALF_WIDTH, -CAR_HALF_LENGTH * 0.78],
];

export function stepVehiclePhysics(
  state: VehicleState,
  input: VehicleInput,
  obstacleGrid: ObstacleGrid | null,
  weather: Pick<WeatherComputed, 'gripMultiplier' | 'windStrength' | 'windAngle'>,
  rawDt: number,
  mapId: MapId = 'valley',
  carSpec?: CarSpec,
): VehicleState {
  const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);
  state.impactIntensity = 0;
  state.landedIntensity = 0;

  const sinYaw = Math.sin(state.yaw);
  const cosYaw = Math.cos(state.yaw);

  const fwdX = sinYaw;
  const fwdZ = cosYaw;
  const leftX = cosYaw;
  const leftZ = -sinYaw;

  const centerSample = getTerrainSample(state.x, state.z, mapId);
  state.surface = centerSample.surface;
  state.biome = centerSample.biome;

  let groundedCount = 0;
  let avgWheelGroundY = 0;
  let flGround = 0;
  let frGround = 0;
  let rlGround = 0;
  let rrGround = 0;

  for (let i = 0; i < 4; i++) {
    const [lx, lz] = WHEEL_LOCAL_COORDS[i];
    const wx = state.x + leftX * lx + fwdX * lz;
    const wz = state.z + leftZ * lx + fwdZ * lz;
    const wSample = getTerrainSample(wx, wz, mapId);
    const wheelHubY = state.y - WHEEL_REST_OFFSET * 0.35;
    const clearance = wheelHubY - wSample.height;
    const suspensionTravel = 0.58;
    const isGrounded = clearance <= suspensionTravel;

    if (isGrounded) groundedCount++;
    const comp = clamp(1 - clearance / suspensionTravel, 0, 1);

    state.wheels[i].compression = lerp(
      state.wheels[i].compression,
      comp,
      1 - Math.exp(-22 * dt),
    );
    state.wheels[i].grounded = isGrounded;
    state.wheels[i].surface = wSample.surface;

    avgWheelGroundY += wSample.height;
    if (i === 0) flGround = wSample.height;
    else if (i === 1) frGround = wSample.height;
    else if (i === 2) rlGround = wSample.height;
    else rrGround = wSample.height;
  }

  avgWheelGroundY *= 0.25;
  const prevGrounded = state.groundedCount;
  state.groundedCount = groundedCount;

  const forwardVel = state.vx * fwdX + state.vz * fwdZ;
  const lateralVel = state.vx * leftX + state.vz * leftZ;
  const absForward = Math.abs(forwardVel);

  const maxSteer = 0.54;
  const speedSteerScale = clamp(1 - absForward / 76, 0.34, 1.0);
  const targetSteer = input.steer * maxSteer * speedSteerScale;
  state.steerAngle = lerp(state.steerAngle, targetSteer, 1 - Math.exp(-13 * dt));

  state.wheels[0].steerAngle = state.steerAngle;
  state.wheels[1].steerAngle = state.steerAngle;
  state.wheels[2].steerAngle = 0;
  state.wheels[3].steerAngle = 0;

  const wantsBoost = input.boost && input.throttle > 0.1 && state.boostFuel > 2;
  state.isBoosting = wantsBoost;
  if (wantsBoost) {
    state.boostFuel = Math.max(0, state.boostFuel - 25 * dt);
  } else {
    const regenRate = state.isDrifting ? 18 : 7.5;
    state.boostFuel = Math.min(100, state.boostFuel + regenRate * dt);
  }

  const speedMul = carSpec ? carSpec.speedMul : 1.0;
  const accelMul = carSpec ? carSpec.accelMul : 1.0;
  const gripMul = carSpec ? carSpec.gripMul : 1.0;
  const offroadMul = carSpec ? carSpec.offroadMul : 1.0;
  const boostMul = carSpec ? carSpec.boostMul : 1.0;

  const isOffroadSurf = centerSample.surface !== 'asphalt';
  const surfProps = SURFACE_PARAMS[centerSample.surface];
  const effectiveGrip =
    surfProps.grip * weather.gripMultiplier * gripMul * (isOffroadSurf ? offroadMul : 1.0);

  let longAccel = 0;
  const isMovingForward = forwardVel > 1.0;
  const isMovingBackward = forwardVel < -1.0;

  if (groundedCount > 0) {
    const topSpeedBase = 62 * speedMul;
    const speedRatio = clamp(absForward / topSpeedBase, 0, 1);
    const engineTorque = 38.0 * accelMul * (1 - 0.5 * speedRatio * speedRatio);
    const boostAdd = wantsBoost ? 25.0 * boostMul : 0;

    if (input.throttle > 0) {
      if (isMovingBackward) {
        longAccel += input.throttle * 48.0;
      } else {
        longAccel += input.throttle * (engineTorque + boostAdd) * (0.45 + 0.55 * effectiveGrip);
      }
    }

    if (input.brake > 0) {
      if (isMovingForward) {
        longAccel -= input.brake * 54.0 * (0.5 + 0.5 * effectiveGrip);
      } else {
        const revRatio = clamp(absForward / 18, 0, 1);
        longAccel -= input.brake * 24.0 * (1 - revRatio * 0.85);
      }
    }

    if (input.handbrake) {
      longAccel -= Math.sign(forwardVel) * 16.0;
    }

    const effectiveOffroadDamp = isOffroadSurf
      ? surfProps.offroadDamping / Math.max(0.7, offroadMul)
      : surfProps.offroadDamping;
    longAccel -= forwardVel * (surfProps.rollingDrag * 12 + effectiveOffroadDamp);
  }

  const aeroDrag = (0.0044 / (speedMul * speedMul)) * forwardVel * absForward + 0.13 * forwardVel;
  longAccel -= aeroDrag;

  const slopePushX = centerSample.normalX * GRAVITY;
  const slopePushZ = centerSample.normalZ * GRAVITY;
  const fwdSlopeAccel = slopePushX * fwdX + slopePushZ * fwdZ;
  const latSlopeAccel = slopePushX * leftX + slopePushZ * leftZ;

  const slopeFactor = groundedCount > 0 ? 0.55 : 0;
  longAccel += fwdSlopeAccel * slopeFactor;

  let newForwardVel = forwardVel + longAccel * dt;
  let newLateralVel = lateralVel + latSlopeAccel * slopeFactor * dt;

  if (groundedCount > 0) {
    const baseLatDamp = input.handbrake ? 2.1 : 8.8;
    const latFriction = baseLatDamp * effectiveGrip * surfProps.maxSteerGrip;
    newLateralVel *= Math.exp(-latFriction * dt);

    const speedTurnFactor = clamp(absForward / 7.5, 0, 1);
    const reverseSign = forwardVel >= -0.3 ? 1 : -1;
    const driftTurnBoost = input.handbrake ? 1.48 : 1.0;
    const targetYawRate =
      state.steerAngle *
      (4.2 * speedTurnFactor * reverseSign * driftTurnBoost) *
      (0.55 + 0.45 * effectiveGrip);

    state.angularVelY = lerp(
      state.angularVelY,
      targetYawRate,
      1 - Math.exp(-(input.handbrake ? 8.5 : 14.0) * dt),
    );
  } else {
    state.angularVelY *= Math.exp(-1.2 * dt);
  }

  state.yaw += state.angularVelY * dt;

  const nSin = Math.sin(state.yaw);
  const nCos = Math.cos(state.yaw);
  state.vx = nSin * newForwardVel + nCos * newLateralVel;
  state.vz = nCos * newForwardVel - nSin * newLateralVel;

  if (weather.windStrength > 0.25) {
    const windForce = (weather.windStrength - 0.25) * 1.4;
    state.vx += Math.cos(weather.windAngle) * windForce * dt;
    state.vz += Math.sin(weather.windAngle) * windForce * dt;
  }

  state.x += state.vx * dt;
  state.z += state.vz * dt;

  const distR = Math.hypot(state.x, state.z);
  if (distR > WORLD_RADIUS) {
    const nx = state.x / distR;
    const nz = state.z / distR;
    state.x = nx * WORLD_RADIUS;
    state.z = nz * WORLD_RADIUS;
    const outward = state.vx * nx + state.vz * nz;
    if (outward > 0) {
      state.vx -= outward * nx * 1.35;
      state.vz -= outward * nz * 1.35;
      state.impactIntensity = Math.max(state.impactIntensity, clamp(outward / 28, 0.15, 0.85));
    }
  }

  if (obstacleGrid) {
    const nearby = obstacleGrid.queryNear(state.x, state.z, _nearbyObstacles);
    for (let i = 0; i < nearby.length; i++) {
      const obs = nearby[i];
      const dx = state.x - obs.x;
      const dz = state.z - obs.z;
      const minDist = CHASSIS_RADIUS + obs.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = minDist - dist;
        state.x += nx * overlap;
        state.z += nz * overlap;

        const vn = state.vx * nx + state.vz * nz;
        if (vn < 0) {
          const impact = clamp(-vn / 28, 0.12, 1.0);
          state.impactIntensity = Math.max(state.impactIntensity, impact);
          state.vx -= (1 + 0.38) * vn * nx;
          state.vz -= (1 + 0.38) * vn * nz;
          state.vx *= 0.82;
          state.vz *= 0.82;
          state.angularVelY += (nx * state.vz - nz * state.vx) * 0.08;
        }
      }
    }
  }

  const targetGroundY = avgWheelGroundY + WHEEL_REST_OFFSET;
  const prevAirTime = state.airTime;

  if (state.y > targetGroundY + 0.28) {
    state.vy -= GRAVITY * dt;
    state.y += state.vy * dt;
    state.airTime += dt;
    if (state.y <= targetGroundY) {
      const fallSpeed = -state.vy;
      state.y = targetGroundY;
      state.vy = 0;
      if (prevAirTime > 0.22) {
        state.landedIntensity = clamp(fallSpeed / 16, 0.2, 1.0);
        for (let i = 0; i < 4; i++) {
          state.wheels[i].compression = clamp(0.65 + state.landedIntensity * 0.35, 0, 1);
        }
      }
      state.airTime = 0;
    }
  } else {
    const heightError = targetGroundY - state.y;
    const springK = 165;
    const damperC = 22;
    const vertAccel = heightError * springK - state.vy * damperC;
    state.vy += vertAccel * dt;
    state.y += state.vy * dt;
    const minFloor = centerSample.height + 0.44;
    if (state.y < minFloor) {
      state.y = minFloor;
      if (state.vy < 0) state.vy = 0;
    }
    state.airTime = 0;
    if (prevGrounded === 0 && prevAirTime > 0.22) {
      state.landedIntensity = clamp(Math.abs(state.vy) / 14 + 0.25, 0.25, 1.0);
    }
  }

  const frontAvg = (flGround + frGround) * 0.5;
  const rearAvg = (rlGround + rrGround) * 0.5;
  const leftAvg = (flGround + rlGround) * 0.5;
  const rightAvg = (frGround + rrGround) * 0.5;

  const terrainPitch = Math.atan2(rearAvg - frontAvg, CAR_HALF_LENGTH * 1.56);
  const terrainRoll = Math.atan2(leftAvg - rightAvg, CAR_HALF_WIDTH * 2);

  const dynamicPitch =
    groundedCount > 0 ? clamp(-longAccel * 0.0022, -0.09, 0.09) : clamp(-state.vy * 0.015, -0.22, 0.22);
  const dynamicRoll =
    groundedCount > 0 ? clamp(state.angularVelY * newForwardVel * 0.0032, -0.14, 0.14) : 0;

  state.pitch = lerp(state.pitch, terrainPitch + dynamicPitch, 1 - Math.exp(-11 * dt));
  state.roll = lerp(state.roll, terrainRoll + dynamicRoll, 1 - Math.exp(-11 * dt));

  const wheelRadius = 0.42;
  const wheelAngularSpin = (newForwardVel / wheelRadius) * dt;
  const slipAngle = Math.atan2(Math.abs(newLateralVel), Math.max(Math.abs(newForwardVel), 1.5));

  for (let i = 0; i < 4; i++) {
    state.wheels[i].spinAngle += wheelAngularSpin;
    state.wheels[i].slip =
      groundedCount > 0
        ? clamp(slipAngle / 0.85 + (input.handbrake && i >= 2 ? 0.45 : 0), 0, 1)
        : 0;
  }

  state.speed = newForwardVel;
  const totalSpeed = Math.hypot(state.vx, state.vz);
  state.speedKmh = Math.round(totalSpeed * 3.6);

  if (newForwardVel < -1.2 && input.brake > 0.1) {
    state.gear = -1;
  } else if (totalSpeed < 0.8 && input.throttle < 0.05) {
    state.gear = 0;
  } else {
    let g = 1;
    for (let i = 1; i < GEAR_MAX_SPEEDS.length; i++) {
      if (absForward > GEAR_MAX_SPEEDS[i]) {
        g = Math.min(6, i + 1);
      }
    }
    state.gear = g;
  }

  const gearLow = state.gear > 1 ? GEAR_MAX_SPEEDS[state.gear - 1] * 0.72 : 0;
  const gearHigh = state.gear >= 1 ? GEAR_MAX_SPEEDS[state.gear] : 18;
  const gearFrac = clamp((absForward - gearLow) / Math.max(gearHigh - gearLow, 1), 0, 1);
  const targetRpm =
    state.gear === 0
      ? 950 + input.throttle * 4200
      : 1600 + gearFrac * 6100 + (wantsBoost ? 650 : 0);
  state.rpm = lerp(state.rpm, clamp(targetRpm, 900, 8400), 1 - Math.exp(-10 * dt));

  const driftingNow =
    groundedCount >= 2 &&
    totalSpeed > 9.5 &&
    (slipAngle > 0.22 || (input.handbrake && absForward > 7));

  if (driftingNow) {
    state.isDrifting = true;
    const pts = (slipAngle * totalSpeed * 4.2 + (wantsBoost ? 15 : 0)) * dt;
    state.driftScore += pts;
    state.totalDriftScore += pts;
  } else {
    state.isDrifting = false;
    state.driftScore = Math.max(0, state.driftScore - 40 * dt);
  }

  return state;
}

export function resolveCarToCarCollisions(vehicles: VehicleState[]): void {
  const minDist = 2.65;
  const minDistSq = minDist * minDist;
  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const a = vehicles[i];
      const b = vehicles[j];
      if (Math.abs(a.y - b.y) > 2.6) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq && dSq > 1e-6) {
        const dist = Math.sqrt(dSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = (minDist - dist) * 0.5;
        a.x -= nx * overlap;
        a.z -= nz * overlap;
        b.x += nx * overlap;
        b.z += nz * overlap;

        const rvx = b.vx - a.vx;
        const rvz = b.vz - a.vz;
        const velAlongNormal = rvx * nx + rvz * nz;
        if (velAlongNormal < 0) {
          const impulse = -(1 + 0.45) * velAlongNormal * 0.5;
          a.vx -= impulse * nx;
          a.vz -= impulse * nz;
          b.vx += impulse * nx;
          b.vz += impulse * nz;
          const hit = clamp(-velAlongNormal / 26, 0.12, 0.9);
          a.impactIntensity = Math.max(a.impactIntensity, hit);
          b.impactIntensity = Math.max(b.impactIntensity, hit);
        }
      }
    }
  }
}
