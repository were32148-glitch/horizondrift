import { clamp, getMapWorldData, type MapWorldData } from './terrain';
import type {
  GameMode,
  MapId,
  RacerProfile,
  RacerRuntime,
  RaceStandingSummary,
  VehicleInput,
} from './types';
import { createVehicleStateAt } from './vehiclePhysics';

export const RACER_PROFILES: RacerProfile[] = [
  {
    id: 'p1',
    name: 'Player 1',
    numberLabel: '01',
    paintHex: 0xd92638,
    stripeHex: 0xfacc15,
    isHuman: true,
    playerIndex: 0,
    aiSkill: 1.0,
    aiLaneOffset: 0,
  },
  {
    id: 'p2',
    name: 'Player 2',
    numberLabel: '02',
    paintHex: 0x2563eb,
    stripeHex: 0x38bdf8,
    isHuman: true,
    playerIndex: 1,
    aiSkill: 1.0,
    aiLaneOffset: 0,
  },
  {
    id: 'ai-1',
    name: 'Viper RX',
    numberLabel: '07',
    paintHex: 0x0284c7,
    stripeHex: 0xfef08a,
    isHuman: false,
    playerIndex: null,
    aiSkill: 0.96,
    aiLaneOffset: -3.2,
  },
  {
    id: 'ai-2',
    name: 'Emerald GT',
    numberLabel: '14',
    paintHex: 0x059669,
    stripeHex: 0xe2e8f0,
    isHuman: false,
    playerIndex: null,
    aiSkill: 0.91,
    aiLaneOffset: 3.1,
  },
  {
    id: 'ai-3',
    name: 'Phantom Evo',
    numberLabel: '23',
    paintHex: 0x7c3aed,
    stripeHex: 0x22d3ee,
    isHuman: false,
    playerIndex: null,
    aiSkill: 0.87,
    aiLaneOffset: -1.6,
  },
  {
    id: 'ai-4',
    name: 'Glacier RS',
    numberLabel: '88',
    paintHex: 0xe2e8f0,
    stripeHex: 0xef4444,
    isHuman: false,
    playerIndex: null,
    aiSkill: 0.83,
    aiLaneOffset: 1.8,
  },
];

export function createRaceGrid(mode: GameMode, mapId: MapId): RacerRuntime[] {
  const world = getMapWorldData(mapId);
  const pts = world.roadPoints;
  const count = pts.length;

  let activeProfiles: RacerProfile[];
  if (mode === 'freestyle') {
    activeProfiles = [RACER_PROFILES[0]];
  } else if (mode === 'race1p') {
    activeProfiles = [RACER_PROFILES[0], ...RACER_PROFILES.slice(2)];
  } else {
    activeProfiles = [...RACER_PROFILES];
  }

  const racers: RacerRuntime[] = [];

  for (let i = 0; i < activeProfiles.length; i++) {
    const profile = activeProfiles[i];
    if (mode === 'freestyle') {
      const v = createVehicleStateAt(world.startPose.x, world.startPose.z, world.startPose.yaw, mapId);
      racers.push({
        profile,
        vehicle: v,
        lap: 1,
        nextCheckpoint: 1,
        finished: false,
        finishTime: null,
        bestLapTime: null,
        lapStartTime: 0,
        progressScore: 0,
        place: 1,
      });
      continue;
    }

    // Staggered 2-wide starting grid behind the Finish Line (pts[0])
    const row = Math.floor(i / 2);
    const col = i % 2 === 0 ? -1 : 1;
    // Step backward along spline from start line
    const backIdx = (count - 1 - row * 2 + count) % count;
    const prevIdx = (backIdx - 1 + count) % count;
    const nextIdx = (backIdx + 1) % count;
    const basePt = pts[backIdx];
    const nextPt = pts[nextIdx];
    const prevPt = pts[prevIdx];

    const tx = nextPt.x - prevPt.x;
    const tz = nextPt.z - prevPt.z;
    const len = Math.hypot(tx, tz) || 1;
    const dirX = tx / len;
    const dirZ = tz / len;
    const rightX = -dirZ;
    const rightZ = dirX;

    const lateral = col * 4.2;
    const gx = basePt.x + rightX * lateral;
    const gz = basePt.z + rightZ * lateral;
    const yaw = Math.atan2(dirX, dirZ);

    racers.push({
      profile,
      vehicle: createVehicleStateAt(gx, gz, yaw, mapId),
      lap: 1,
      nextCheckpoint: 1,
      finished: false,
      finishTime: null,
      bestLapTime: null,
      lapStartTime: 0,
      progressScore: -i * 0.01,
      place: i + 1,
    });
  }

  return racers;
}

export function computeAiVehicleInput(
  racer: RacerRuntime,
  allRacers: RacerRuntime[],
  world: MapWorldData,
  out: VehicleInput,
): VehicleInput {
  const v = racer.vehicle;
  const pts = world.roadPoints;
  const n = pts.length;

  // Find closest spline point to AI car
  let closestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < n; i++) {
    const dx = pts[i].x - v.x;
    const dz = pts[i].z - v.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      closestIdx = i;
    }
  }

  // Dynamic lookahead based on speed
  const lookSteps = Math.max(3, Math.min(8, Math.round(3 + Math.abs(v.speed) * 0.1)));
  const targetIdx = (closestIdx + lookSteps) % n;
  const nextIdx = (targetIdx + 1) % n;
  const farIdx = (closestIdx + lookSteps + 6) % n;

  const tPt = pts[targetIdx];
  const nPt = pts[nextIdx];
  const fPt = pts[farIdx];

  // Road tangent & lateral racing offset
  let tx = nPt.x - tPt.x;
  let tz = nPt.z - tPt.z;
  const tLen = Math.hypot(tx, tz) || 1;
  tx /= tLen;
  tz /= tLen;
  const rightX = -tz;
  const rightZ = tx;

  // Gentle car avoidance offset if another car is directly ahead
  let avoidShift = 0;
  const fwdX = Math.sin(v.yaw);
  const fwdZ = Math.cos(v.yaw);
  for (let i = 0; i < allRacers.length; i++) {
    const other = allRacers[i];
    if (other.profile.id === racer.profile.id) continue;
    const dx = other.vehicle.x - v.x;
    const dz = other.vehicle.z - v.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.1 && dist < 14) {
      const ahead = dx * fwdX + dz * fwdZ;
      if (ahead > 1.5) {
        const side = dx * rightX + dz * rightZ;
        avoidShift += side > 0 ? -3.2 : 3.2;
      }
    }
  }

  const laneShift = clamp(racer.profile.aiLaneOffset + avoidShift, -4.6, 4.6);
  const aimX = tPt.x + rightX * laneShift;
  const aimZ = tPt.z + rightZ * laneShift;

  const toTargetX = aimX - v.x;
  const toTargetZ = aimZ - v.z;
  const targetYaw = Math.atan2(toTargetX, toTargetZ);

  let angleErr = targetYaw - v.yaw;
  while (angleErr > Math.PI) angleErr -= Math.PI * 2;
  while (angleErr < -Math.PI) angleErr += Math.PI * 2;

  // Vehicle physics steer: +1 is left (increases yaw), -1 is right (decreases yaw)
  out.steer = clamp(angleErr * 2.1, -1, 1);

  // Corner curvature check for realistic braking
  const farYaw = Math.atan2(fPt.x - tPt.x, fPt.z - tPt.z);
  let curveAngle = farYaw - targetYaw;
  while (curveAngle > Math.PI) curveAngle -= Math.PI * 2;
  while (curveAngle < -Math.PI) curveAngle += Math.PI * 2;
  const sharpness = Math.abs(curveAngle);

  const desiredSpeed =
    (sharpness > 0.65 ? 24 : sharpness > 0.35 ? 36 : 56) * racer.profile.aiSkill;

  if (racer.finished) {
    out.throttle = 0.25;
    out.brake = Math.abs(v.speed) > 12 ? 0.5 : 0;
    out.handbrake = false;
    out.boost = false;
    return out;
  }

  if (v.speed > desiredSpeed + 4) {
    out.throttle = 0;
    out.brake = 0.65;
  } else {
    out.throttle = clamp(0.65 + (desiredSpeed - v.speed) * 0.08, 0.35, 1.0);
    out.brake = 0;
  }

  out.handbrake = Math.abs(angleErr) > 0.72 && v.speed > 18;
  out.boost =
    sharpness < 0.22 &&
    Math.abs(angleErr) < 0.16 &&
    v.boostFuel > 35 &&
    v.speed > 18 &&
    racer.profile.aiSkill > 0.86;

  return out;
}

export function stepRaceProgress(
  racers: RacerRuntime[],
  world: MapWorldData,
  raceElapsed: number,
): void {
  const cps = world.checkpoints;
  const cpCount = cps.length;
  const totalLaps = world.config.totalLaps;
  const triggerRadius = world.config.roadWidth * 1.15;

  for (let i = 0; i < racers.length; i++) {
    const r = racers[i];
    if (r.finished) continue;

    const targetCp = cps[r.nextCheckpoint];
    const dist = Math.hypot(r.vehicle.x - targetCp.x, r.vehicle.z - targetCp.z);
    if (dist <= triggerRadius) {
      if (r.nextCheckpoint === 0) {
        // Crossed Start/Finish Line after completing all checkpoints
        const lapTime = raceElapsed - r.lapStartTime;
        if (lapTime > 2 && (r.bestLapTime === null || lapTime < r.bestLapTime)) {
          r.bestLapTime = lapTime;
        }
        r.lapStartTime = raceElapsed;

        if (r.lap >= totalLaps) {
          r.finished = true;
          r.finishTime = raceElapsed;
          r.progressScore = totalLaps * cpCount + 100 - raceElapsed * 0.001;
        } else {
          r.lap += 1;
          r.nextCheckpoint = 1;
        }
      } else {
        r.nextCheckpoint = (r.nextCheckpoint + 1) % cpCount;
      }
    }

    if (!r.finished) {
      // Completed checkpoints in current lap (0..cpCount-1)
      const completedInLap =
        r.nextCheckpoint === 0 ? cpCount - 1 : r.nextCheckpoint - 1;
      const nextCpObj = cps[r.nextCheckpoint];
      const distToNext = Math.hypot(r.vehicle.x - nextCpObj.x, r.vehicle.z - nextCpObj.z);
      const frac = 1 / (1 + distToNext * 0.01);
      r.progressScore = (r.lap - 1) * cpCount + completedInLap + frac;
    }
  }

  // Sort standings (finished fastest first, otherwise highest progressScore)
  const sorted = [...racers].sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTime ?? 9999) - (b.finishTime ?? 9999);
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progressScore - a.progressScore;
  });

  for (let rank = 0; rank < sorted.length; rank++) {
    sorted[rank].place = rank + 1;
  }
}

export function buildRaceStandings(racers: RacerRuntime[]): RaceStandingSummary[] {
  return [...racers]
    .sort((a, b) => a.place - b.place)
    .map((r) => ({
      id: r.profile.id,
      name: r.profile.name,
      numberLabel: r.profile.numberLabel,
      paintHex: r.profile.paintHex,
      isHuman: r.profile.isHuman,
      place: r.place,
      lap: r.lap,
      finished: r.finished,
      finishTime: r.finishTime,
    }));
}
