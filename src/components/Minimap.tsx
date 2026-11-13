import { useMemo } from 'react';
import { WORLD_RADIUS } from '../game/maps';
import { getMapWorldData } from '../game/terrain';
import type { MapId, PlayerHudInfo } from '../game/types';

interface MinimapProps {
  mapId: MapId;
  players: PlayerHudInfo[];
  aiDots: Array<{ x: number; z: number; yaw: number; color: number }>;
  discoveredIds: string[];
  size?: number;
}

const WORLD_SPAN = WORLD_RADIUS * 2.1;

function toMap(x: number, z: number, size: number): [number, number] {
  const mx = ((x + WORLD_SPAN * 0.5) / WORLD_SPAN) * size;
  const my = ((z + WORLD_SPAN * 0.5) / WORLD_SPAN) * size;
  return [mx, my];
}

export function Minimap({ mapId, players, aiDots, discoveredIds, size = 148 }: MinimapProps) {
  const world = useMemo(() => getMapWorldData(mapId), [mapId]);

  const { roadPath, trailPath, startLine } = useMemo(() => {
    const rPts = world.roadPoints.map((p) => toMap(p.x, p.z, size));
    const rD =
      rPts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(' ') +
      ' Z';

    const tPts = world.trailPoints.map((p) => toMap(p.x, p.z, size));
    const tD = tPts
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`)
      .join(' ');

    const [sx, sy] = toMap(world.startPose.x, world.startPose.z, size);
    const nx = -Math.cos(world.startPose.yaw);
    const nz = Math.sin(world.startPose.yaw);
    const sl: [number, number, number, number] = [
      sx - nx * 5,
      sy - nz * 5,
      sx + nx * 5,
      sy + nz * 5,
    ];

    return { roadPath: rD, trailPath: tD, startLine: sl };
  }, [world, size]);

  return (
    <div
      className="relative rounded-full border border-amber-400/40 bg-slate-950/90 p-1.5 shadow-xl"
      style={{ width: size + 14, height: size + 14 }}
      aria-label="Circuit and terrain minimap"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-hidden rounded-full bg-slate-900/95"
      >
        <circle cx={size / 2} cy={size / 2} r={size * 0.45} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
        <circle cx={size / 2} cy={size / 2} r={size * 0.28} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="1" />

        {/* Gravel Offroad Trail */}
        <path
          d={trailPath}
          fill="none"
          stroke="rgba(180, 132, 84, 0.65)"
          strokeWidth="2.2"
          strokeDasharray="3 2"
          strokeLinecap="round"
        />

        {/* Paved Circuit Highway */}
        <path
          d={roadPath}
          fill="none"
          stroke="rgba(226, 232, 240, 0.85)"
          strokeWidth="3.6"
          strokeLinejoin="round"
        />

        {/* Start / Finish Line */}
        <line
          x1={startLine[0]}
          y1={startLine[1]}
          x2={startLine[2]}
          y2={startLine[3]}
          stroke="#facc15"
          strokeWidth="2.8"
        />

        {/* Exploration Beacons */}
        {world.beacons.map((b) => {
          const [bx, by] = toMap(b.x, b.z, size);
          const found = discoveredIds.includes(b.id);
          return (
            <circle
              key={b.id}
              cx={bx}
              cy={by}
              r={found ? 2.8 : 3.2}
              fill={found ? '#10b981' : '#f59e0b'}
              stroke="#0f172a"
              strokeWidth="1"
            />
          );
        })}

        {/* AI Bot Racers */}
        {aiDots.map((ai, idx) => {
          const [ax, ay] = toMap(ai.x, ai.z, size);
          return (
            <circle
              key={idx}
              cx={ax}
              cy={ay}
              r={3.2}
              fill={`#${ai.color.toString(16).padStart(6, '0')}`}
              stroke="#ffffff"
              strokeWidth="0.9"
            />
          );
        })}

        {/* Human Player Chevrons (P1 Crimson, P2 Sky Blue) */}
        {players.map((p, idx) => {
          const [px, py] = toMap(p.x, p.z, size);
          const headingDeg = 180 - (p.yaw * 180) / Math.PI;
          const fill = idx === 0 ? '#f43f5e' : '#38bdf8';
          return (
            <g
              key={p.name}
              transform={`translate(${px.toFixed(1)}, ${py.toFixed(1)}) rotate(${headingDeg.toFixed(1)})`}
            >
              <polygon
                points="0,-6.2 4.6,5.2 0,2.5 -4.6,5.2"
                fill={fill}
                stroke="#ffffff"
                strokeWidth="1.2"
              />
            </g>
          );
        })}
      </svg>
      <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-widest text-slate-400">
        N
      </span>
    </div>
  );
}
