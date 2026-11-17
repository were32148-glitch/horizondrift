import { memo, useId, useMemo } from 'react';
import { LOS_SANTOS_ARTERIALS, sampleSpline } from '../game/maps';
import { getMapWorldData } from '../game/terrain';
import type { MapId, PlayerHudInfo, TeamId } from '../game/types';

interface MinimapProps {
  mapId: MapId;
  players: PlayerHudInfo[];
  aiDots: Array<{ x: number; z: number; yaw: number; color: number; team?: TeamId }>;
  discoveredIds: string[];
  size?: number;
}

const VIEW_RADIUS = 640; // meters shown around P1 center in GPS radar

function toRadar(
  x: number,
  z: number,
  cx: number,
  cz: number,
  size: number,
): [number, number] {
  const half = size * 0.5;
  const rx = half + ((x - cx) / VIEW_RADIUS) * half;
  const ry = half + ((z - cz) / VIEW_RADIUS) * half;
  return [rx, ry];
}

function buildWorldPath(pts: Array<{ x: number; z: number }>, closed: boolean): string {
  const d = pts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(0)},${p.z.toFixed(0)}`)
    .join(' ');
  return closed ? `${d} Z` : d;
}

const StaticRoadNetworkLayer = memo(function StaticRoadNetworkLayer({
  mapId,
}: {
  mapId: MapId;
}) {
  const world = useMemo(() => getMapWorldData(mapId), [mapId]);

  const paths = useMemo(() => {
    const arterials = LOS_SANTOS_ARTERIALS.map((pts) =>
      buildWorldPath(sampleSpline(pts, false, 6), false),
    );
    const west = buildWorldPath(world.westPassPoints, false);
    const east = buildWorldPath(world.eastPassPoints, false);
    const trail = buildWorldPath(world.trailPoints, false);
    const circuit = buildWorldPath(world.roadPoints, true);

    const nx = -Math.cos(world.startPose.yaw);
    const nz = Math.sin(world.startPose.yaw);
    const startLine = [
      world.startPose.x - nx * 36,
      world.startPose.z - nz * 36,
      world.startPose.x + nx * 36,
      world.startPose.z + nz * 36,
    ];
    return { arterials, west, east, trail, circuit, startLine };
  }, [world]);

  return (
    <>
      {paths.arterials.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="rgba(148, 163, 184, 0.85)"
          strokeWidth="4.0"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path
        d={paths.west}
        fill="none"
        stroke="rgba(251, 191, 36, 0.88)"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={paths.east}
        fill="none"
        stroke="rgba(251, 191, 36, 0.88)"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={paths.trail}
        fill="none"
        stroke="rgba(180, 132, 84, 0.72)"
        strokeWidth="2.1"
        strokeDasharray="3 2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={paths.circuit}
        fill="none"
        stroke="rgba(241, 245, 249, 0.96)"
        strokeWidth="5.8"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={paths.startLine[0]}
        y1={paths.startLine[1]}
        x2={paths.startLine[2]}
        y2={paths.startLine[3]}
        stroke="#facc15"
        strokeWidth="2.8"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
});

export function Minimap({ mapId, players, aiDots, discoveredIds, size = 148 }: MinimapProps) {
  const clipId = useId();
  const world = useMemo(() => getMapWorldData(mapId), [mapId]);
  const centerX = players[0]?.x ?? world.startPose.x;
  const centerZ = players[0]?.z ?? world.startPose.z;
  const half = size * 0.5;
  const scale = half / VIEW_RADIUS;
  const worldTransform = `translate(${half}, ${half}) scale(${scale.toFixed(5)}) translate(${(-centerX).toFixed(1)}, ${(-centerZ).toFixed(1)})`;

  return (
    <div
      className="relative rounded-full border border-amber-400/50 bg-slate-950/90 p-1.5 shadow-xl"
      style={{ width: size + 14, height: size + 14 }}
      aria-label="Circuit, Mountain Passes & Los Santos GPS minimap"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-hidden rounded-full bg-slate-900/95"
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={half} cy={half} r={half} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          {/* GPS Radar Rings */}
          <circle
            cx={half}
            cy={half}
            r={size * 0.44}
            fill="none"
            stroke="rgba(148,163,184,0.14)"
            strokeWidth="1"
          />
          <circle
            cx={half}
            cy={half}
            r={size * 0.24}
            fill="none"
            stroke="rgba(148,163,184,0.12)"
            strokeWidth="1"
          />

          {/* Zero-recompute Cached World Road Layer translated by GPU/SVG matrix */}
          <g transform={worldTransform}>
            <StaticRoadNetworkLayer mapId={mapId} />
          </g>

          {/* Exploration Beacons */}
          {world.beacons.map((b) => {
            const [bx, by] = toRadar(b.x, b.z, centerX, centerZ, size);
            if (bx < -8 || bx > size + 8 || by < -8 || by > size + 8) return null;
            const found = discoveredIds.includes(b.id);
            return (
              <circle
                key={b.id}
                cx={bx}
                cy={by}
                r={found ? 2.8 : 3.4}
                fill={found ? '#10b981' : '#f59e0b'}
                stroke="#0f172a"
                strokeWidth="1"
              />
            );
          })}

          {/* AI / Remote Dots (clamped to radar edge when far) */}
          {aiDots.map((ai, idx) => {
            const [rawX, rawY] = toRadar(ai.x, ai.z, centerX, centerZ, size);
            const dx = rawX - half;
            const dy = rawY - half;
            const d = Math.hypot(dx, dy);
            const maxR = half - 5;
            const clamped = d > maxR;
            const ax = clamped ? half + (dx / d) * maxR : rawX;
            const ay = clamped ? half + (dy / d) * maxR : rawY;
            const dotColor =
              ai.team === 'red'
                ? '#f43f5e'
                : ai.team === 'blue'
                  ? '#38bdf8'
                  : `#${ai.color.toString(16).padStart(6, '0')}`;
            return (
              <circle
                key={idx}
                cx={ax}
                cy={ay}
                r={clamped ? 2.4 : 3.2}
                fill={dotColor}
                stroke="#ffffff"
                strokeWidth="0.9"
                opacity={clamped ? 0.72 : 1}
              />
            );
          })}

          {/* Human Player Chevrons */}
          {players.map((p, idx) => {
            const [px, py] = toRadar(p.x, p.z, centerX, centerZ, size);
            const headingDeg = 180 - (p.yaw * 180) / Math.PI;
            const fill =
              p.team === 'blue' ? '#38bdf8' : p.team === 'red' ? '#f43f5e' : idx === 0 ? '#f43f5e' : '#38bdf8';
            return (
              <g
                key={`${p.name}-${idx}`}
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
        </g>
      </svg>
      <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-widest text-slate-300">
        N
      </span>
    </div>
  );
}
