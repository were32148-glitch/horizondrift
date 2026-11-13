import {
  Camera,
  CarFront,
  CloudLightning,
  CloudRain,
  Coins,
  Compass,
  Flag,
  Lightbulb,
  MapPin,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Snowflake,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { CAR_PAINT_OPTIONS } from '../game/carModel';
import { MAP_LIST } from '../game/maps';
import type {
  ActiveWeatherCondition,
  CameraMode,
  GameMode,
  GamePhase,
  HudSnapshot,
  MapId,
  PlayerHudInfo,
  RaceStandingSummary,
  SurfaceType,
  WeatherPreset,
} from '../game/types';
import { WEATHER_LABELS } from '../game/weather';
import { Minimap } from './Minimap';

interface GameHudProps {
  phase: GamePhase;
  mode: GameMode;
  mapId: MapId;
  hud: HudSnapshot;
  finalStandings: RaceStandingSummary[];
  muted: boolean;
  paintHex: number;
  totalCoins: number;
  equippedCarP1Name: string;
  equippedCarP2Name: string;
  beaconToast: string | null;
  coinToast: string | null;
  lastRaceBonusCoins: number;
  onSelectMode: (mode: GameMode) => void;
  onSelectMap: (mapId: MapId) => void;
  onStart: () => void;
  onOpenGarage: () => void;
  onPauseToggle: () => void;
  onReturnTitle: () => void;
  onResetCar: () => void;
  onRaceAgain: () => void;
  onSelectWeather: (preset: WeatherPreset) => void;
  onCycleCamera: () => void;
  onToggleLights: () => void;
  onToggleMute: () => void;
  onSelectPaint: (hex: number) => void;
}

const SURFACE_LABELS: Record<SurfaceType, { label: string; accent: string }> = {
  asphalt: { label: 'ASPHALT', accent: '#e2e8f0' },
  dirt: { label: 'GRAVEL TRAIL', accent: '#d97706' },
  grass: { label: 'GRASSLANDS', accent: '#4ade80' },
  forest: { label: 'FOREST FLOOR', accent: '#22c55e' },
  rock: { label: 'CANYON ROCK', accent: '#f97316' },
  snow: { label: 'ALPINE SNOW', accent: '#bae6fd' },
  sand: { label: 'SHORE SAND', accent: '#fde047' },
  water: { label: 'WATER', accent: '#38bdf8' },
};

const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: 'CHASE',
  drift: 'DRIFT',
  hood: 'HOOD',
};

function formatTime(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function WeatherIcon({ condition, size = 15 }: { condition: ActiveWeatherCondition; size?: number }) {
  switch (condition) {
    case 'clear':
      return <Sun size={size} className="text-amber-300" />;
    case 'overcast':
      return <Wind size={size} className="text-slate-300" />;
    case 'rain':
      return <CloudRain size={size} className="text-sky-300" />;
    case 'blizzard':
      return <Snowflake size={size} className="text-cyan-200" />;
    case 'night':
      return <Moon size={size} className="text-indigo-300" />;
  }
}

function TachometerCluster({
  player,
  accentClass,
  testId,
  compact = false,
}: {
  player: PlayerHudInfo;
  accentClass: string;
  testId: string;
  compact?: boolean;
}) {
  const rpmNorm = Math.min(1, Math.max(0, (player.rpm - 850) / 7400));
  const arcRadius = 46;
  const arcCircum = 2 * Math.PI * arcRadius;
  const sweepFrac = 0.62;
  const maxDash = arcCircum * sweepFrac;
  const activeDash = maxDash * rpmNorm;
  const surfInfo = SURFACE_LABELS[player.surface];
  const gearText = player.gear === -1 ? 'R' : player.gear === 0 ? 'N' : String(player.gear);

  return (
    <div
      className={`flex items-end gap-2.5 border-b-4 ${accentClass} bg-slate-950/90 ${
        compact ? 'px-3 py-2' : 'px-4 py-2.5'
      } shadow-2xl`}
    >
      <div className="flex flex-col items-end gap-1 pb-1">
        <div
          className="text-[10px] font-black tracking-widest uppercase"
          style={{ color: surfInfo.accent }}
        >
          {surfInfo.label}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold tracking-wider text-slate-400">NITRO</span>
          <div className="h-2 w-16 overflow-hidden bg-slate-800">
            <div
              className={`h-full transition-all duration-75 ${
                player.isBoosting ? 'bg-sky-400' : 'bg-amber-400'
              }`}
              style={{ width: `${player.boostFuel}%` }}
            />
          </div>
        </div>
        <div className="font-mono text-[10px] font-bold text-slate-400 tabular-nums">
          {player.rpm} RPM
        </div>
      </div>

      <div
        className={`relative flex items-center justify-center ${
          compact ? 'h-[86px] w-[92px]' : 'h-[104px] w-[110px]'
        }`}
      >
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-[202deg]">
          <circle
            cx="60"
            cy="60"
            r={arcRadius}
            fill="none"
            stroke="#1e293b"
            strokeWidth="8.5"
            strokeDasharray={`${maxDash} ${arcCircum}`}
            strokeLinecap="round"
          />
          <circle
            cx="60"
            cy="60"
            r={arcRadius}
            fill="none"
            stroke={rpmNorm > 0.85 ? '#ef4444' : player.isBoosting ? '#38bdf8' : '#f59e0b'}
            strokeWidth="8.5"
            strokeDasharray={`${activeDash} ${arcCircum}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          <div
            data-testid={testId}
            className={`font-mono leading-none font-black text-white tabular-nums ${
              compact ? 'text-2xl' : 'text-3xl'
            }`}
          >
            {player.speedKmh}
          </div>
          <div className="mt-0.5 text-[8px] font-bold tracking-widest text-slate-400 uppercase">
            KM/H
          </div>
          <div className="mt-0.5 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-black text-amber-400">
            {gearText}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GameHud({
  phase,
  mode,
  mapId,
  hud,
  finalStandings,
  muted,
  paintHex,
  totalCoins,
  equippedCarP1Name,
  equippedCarP2Name,
  beaconToast,
  coinToast,
  lastRaceBonusCoins,
  onSelectMode,
  onSelectMap,
  onStart,
  onOpenGarage,
  onPauseToggle,
  onReturnTitle,
  onResetCar,
  onRaceAgain,
  onSelectWeather,
  onCycleCamera,
  onToggleLights,
  onToggleMute,
  onSelectPaint,
}: GameHudProps) {
  if (phase === 'title') {
    const startLabel =
      mode === 'race2p'
        ? 'Start 2P Split-Screen Race'
        : mode === 'race1p'
          ? 'Start Grand Prix Race'
          : 'Start Freestyle Drive';

    return (
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10">
        <div className="flex max-w-xl flex-col gap-5 pt-2">
          {/* Brand Title SVG */}
          <svg
            viewBox="0 0 540 148"
            className="w-full max-w-[460px] drop-shadow-[0_6px_20px_rgba(0,0,0,0.85)]"
            role="img"
            aria-label="Horizon Drift: Wildlands"
          >
            <defs>
              <linearGradient id="hd-title-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="70%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
            <polygon points="4,16 20,16 12,44 0,44" fill="#ef4444" />
            <polygon points="24,16 34,16 26,44 16,44" fill="#38bdf8" />
            <text
              x="44"
              y="41"
              fill="#f8fafc"
              fontSize="18"
              fontWeight="800"
              letterSpacing="6"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              2P SPLIT-SCREEN · OPEN WORLD GP
            </text>
            <text
              x="2"
              y="102"
              fill="url(#hd-title-grad)"
              stroke="#090d16"
              strokeWidth="6"
              paintOrder="stroke fill"
              fontSize="58"
              fontWeight="900"
              fontStyle="italic"
              letterSpacing="-1"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              HORIZON DRIFT
            </text>
            <line x1="4" y1="115" x2="310" y2="115" stroke="#f59e0b" strokeWidth="3.5" />
            <text
              x="4"
              y="141"
              fill="#cbd5e1"
              stroke="#090d16"
              strokeWidth="4"
              paintOrder="stroke fill"
              fontSize="20"
              fontWeight="700"
              letterSpacing="10"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              WILDLANDS GP
            </text>
          </svg>

          {/* Compact Mode Selector */}
          <div className="pointer-events-auto flex flex-col gap-3">
            <div>
              <div className="mb-1.5 text-[11px] font-bold tracking-widest text-amber-400 uppercase [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">
                Select Race Mode
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'race2p', label: '2P Split-Screen', sub: 'WASD vs Arrows + AI', icon: <Users size={15} /> },
                    { id: 'race1p', label: '1P vs AI Bots', sub: '3-Lap Grand Prix', icon: <Flag size={15} /> },
                    { id: 'freestyle', label: 'Freestyle', sub: 'Open World Explore', icon: <Compass size={15} /> },
                  ] as const
                ).map((m) => {
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`mode-${m.id}`}
                      onClick={() => onSelectMode(m.id)}
                      className={`flex cursor-pointer flex-col items-start border-2 px-3 py-2 text-left transition-colors ${
                        active
                          ? 'border-amber-400 bg-slate-950/95 text-white shadow-lg'
                          : 'border-slate-700/80 bg-slate-950/80 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black tracking-wide uppercase">
                        <span className={active ? 'text-amber-400' : 'text-slate-400'}>{m.icon}</span>
                        <span>{m.label}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] font-medium text-slate-400">{m.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4-Map Selector */}
            <div>
              <div className="mb-1.5 text-[11px] font-bold tracking-widest text-amber-400 uppercase [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">
                Select Circuit & World Map (5x Scale)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MAP_LIST.map((m) => {
                  const active = mapId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`map-${m.id}`}
                      onClick={() => onSelectMap(m.id)}
                      className={`flex cursor-pointer items-center gap-2.5 border-2 px-3 py-2 text-left transition-colors ${
                        active
                          ? 'border-amber-400 bg-slate-950/95 text-white shadow-lg'
                          : 'border-slate-700/80 bg-slate-950/80 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span
                        className="h-7 w-1.5 shrink-0"
                        style={{ backgroundColor: m.previewAccent }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black tracking-wide uppercase">
                          {m.name}
                        </div>
                        <div className="truncate text-[10px] text-slate-400">{m.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className="flex cursor-pointer items-center gap-2.5 border-2 border-amber-400 bg-amber-500 px-6 py-3 text-sm font-black tracking-wider text-slate-950 uppercase shadow-[0_8px_28px_rgba(245,158,11,0.45)] transition-transform duration-150 hover:scale-[1.03] hover:bg-amber-400 active:scale-[0.98]"
              >
                <Play size={17} fill="currentColor" />
                {startLabel}
              </button>

              <button
                type="button"
                data-testid="open-garage"
                onClick={onOpenGarage}
                className="flex cursor-pointer items-center gap-2 border-2 border-slate-600 bg-slate-950/92 px-4 py-3 text-xs font-black tracking-wider text-white uppercase shadow-lg transition-colors hover:border-amber-400 hover:text-amber-300"
              >
                <CarFront size={16} className="text-amber-400" />
                <span>Garage & Shop</span>
                <span
                  data-testid="title-coin-balance"
                  className="ml-1 flex items-center gap-1 border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-black text-amber-300 tabular-nums"
                >
                  <Coins size={12} />
                  {totalCoins}
                </span>
              </button>
            </div>

            <div className="text-[11px] font-bold tracking-wider text-slate-300 uppercase [text-shadow:0_2px_6px_rgba(0,0,0,0.95)]">
              Equipped: <span className="text-amber-300">{equippedCarP1Name}</span>
              {mode === 'race2p' && (
                <>
                  {' '}
                  · P2: <span className="text-sky-300">{equippedCarP2Name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Control Hint */}
        <div className="text-center text-[11px] font-bold tracking-widest text-slate-200 uppercase [text-shadow:0_2px_8px_rgba(0,0,0,0.95)]">
          P1: WASD + Space (Brake) + L-Shift (Nitro) &nbsp;|&nbsp; P2: Arrow Keys + Enter (Brake) + R-Shift (Nitro) &nbsp;|&nbsp; C Cam · V Weather · Esc Pause
        </div>
      </div>
    );
  }

  const p1 = hud.players[0];
  const p2 = hud.players[1];
  const is2P = hud.mode === 'race2p' && Boolean(p2);
  const isRace = hud.mode !== 'freestyle';

  return (
    <>
      {/* 2P Vertical Split-Screen Center Divider */}
      {is2P && (
        <div className="pointer-events-none fixed inset-y-0 left-1/2 z-10 w-[3px] -translate-x-1/2 bg-slate-950 shadow-[0_0_12px_rgba(0,0,0,0.9)]" />
      )}

      {/* Starting Countdown Banner */}
      {phase === 'playing' && isRace && (hud.countdownSeconds > 0 || hud.raceElapsed < 1.3) && (
        <div className="pointer-events-none fixed inset-x-0 top-[34%] z-20 flex justify-center">
          <div className="border-2 border-amber-400 bg-slate-950/92 px-7 py-2.5 text-center shadow-2xl">
            {hud.countdownSeconds > 0 ? (
              <>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Get Ready · {hud.mapName}
                </div>
                <div
                  data-testid="countdown-value"
                  className="font-mono text-4xl font-black text-rose-500 tabular-nums"
                >
                  {Math.ceil(hud.countdownSeconds)}
                </div>
              </>
            ) : (
              <div className="font-mono text-4xl font-black tracking-widest text-emerald-400 uppercase">
                GO!
              </div>
            )}
          </div>
        </div>
      )}

      {/* HUD Overlay */}
      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-3">
          {/* Top-Left: Player 1 Status */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3 border-l-4 border-rose-500 bg-slate-950/90 px-3 py-1.5 shadow-lg">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-rose-400 uppercase">
                  <span>{is2P ? `P1 · ${p1?.carName ?? equippedCarP1Name}` : hud.mapName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-100">
                  <WeatherIcon condition={hud.weatherCondition} size={13} />
                  <span>{p1 ? p1.biome : hud.mapName}</span>
                </div>
              </div>
              {isRace && p1 ? (
                <div className="flex items-center gap-3 border-l border-slate-800 pl-3 font-mono tabular-nums">
                  <div>
                    <div className="text-[9px] font-bold text-slate-400">POS</div>
                    <div className="text-sm font-black text-amber-400">
                      {p1.place}/{p1.totalRacers}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400">LAP</div>
                    <div className="text-sm font-black text-white">
                      {p1.lap}/{p1.totalLaps}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-l border-slate-800 pl-3 text-right font-mono tabular-nums">
                  <div className="text-[9px] font-bold text-slate-400">BEACONS</div>
                  <div className="text-sm font-black text-emerald-400">
                    {hud.beaconsFound}/{hud.totalBeacons}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Toast / Timer & Coin Balance */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              {isRace && (
                <div className="border border-slate-700/80 bg-slate-950/90 px-3 py-1 font-mono text-xs font-black text-slate-200 shadow tabular-nums">
                  RACE {formatTime(hud.raceElapsed)}
                </div>
              )}
              <div
                data-testid="hud-coin-balance"
                className="flex items-center gap-1.5 border border-amber-400/70 bg-slate-950/90 px-3 py-1 font-mono text-xs font-black text-amber-300 shadow tabular-nums"
              >
                <Coins size={13} className="text-amber-400" />
                <span>{totalCoins}</span>
              </div>
            </div>
            {coinToast && (
              <div className="border border-amber-400 bg-slate-950/95 px-3 py-1 font-mono text-xs font-black tracking-wider text-amber-300 uppercase shadow-2xl">
                {coinToast}
              </div>
            )}
            {beaconToast && (
              <div className="border border-emerald-400/60 bg-slate-950/92 px-4 py-1.5 text-center shadow-2xl">
                <div className="text-[9px] font-bold tracking-widest text-emerald-400 uppercase">
                  Landmark Discovered
                </div>
                <div className="text-xs font-black tracking-wide text-white uppercase">
                  {beaconToast}
                </div>
              </div>
            )}
          </div>

          {/* Top-Right: Player 2 Status (if 2P) + Utility Controls */}
          <div className="flex items-start gap-2.5">
            {is2P && p2 && (
              <div className="flex items-center gap-3 border-r-4 border-sky-400 bg-slate-950/90 px-3 py-1.5 shadow-lg">
                <div className="flex items-center gap-3 border-r border-slate-800 pr-3 font-mono tabular-nums">
                  <div>
                    <div className="text-[9px] font-bold text-slate-400">LAP</div>
                    <div className="text-sm font-black text-white">
                      {p2.lap}/{p2.totalLaps}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-slate-400">POS</div>
                    <div className="text-sm font-black text-sky-400">
                      {p2.place}/{p2.totalRacers}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black tracking-widest text-sky-400 uppercase">
                    P2 · {p2.carName}
                  </div>
                  <div className="text-xs font-extrabold text-slate-100">{p2.biome}</div>
                </div>
              </div>
            )}

            <div className="pointer-events-auto flex items-center gap-1">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCycleCamera();
                }}
                aria-label={`Cycle camera mode (${CAMERA_LABELS[hud.cameraMode]})`}
                title="Camera View [C]"
                className="flex h-8 cursor-pointer items-center gap-1 border border-slate-700/80 bg-slate-950/90 px-2 text-[10px] font-bold tracking-wider text-slate-200 hover:border-amber-400 hover:text-amber-300"
              >
                <Camera size={13} />
                <span className="hidden lg:inline">{CAMERA_LABELS[hud.cameraMode]}</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleLights();
                }}
                aria-label="Toggle headlights"
                title="Headlights [L]"
                className={`flex h-8 w-8 cursor-pointer items-center justify-center border ${
                  hud.headlightsOn
                    ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                    : 'border-slate-700/80 bg-slate-950/90 text-slate-300 hover:border-amber-400'
                }`}
              >
                <Lightbulb size={14} />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onResetCar();
                }}
                aria-label="Reset car to track"
                title="Reset Car"
                className="flex h-8 w-8 cursor-pointer items-center justify-center border border-slate-700/80 bg-slate-950/90 text-slate-200 hover:border-amber-400 hover:text-amber-300"
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleMute();
                }}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                title="Mute [M]"
                className="flex h-8 w-8 cursor-pointer items-center justify-center border border-slate-700/80 bg-slate-950/90 text-slate-200 hover:border-amber-400 hover:text-amber-300"
              >
                {muted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} />}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPauseToggle();
                }}
                aria-label="Pause game"
                title="Pause [Esc]"
                className="flex h-8 w-8 cursor-pointer items-center justify-center border border-slate-700/80 bg-slate-950/90 text-slate-200 hover:border-amber-400 hover:text-amber-300"
              >
                <Pause size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        {is2P && p1 && p2 ? (
          <div className="flex items-end justify-between gap-2">
            {/* P1 Bottom-Left Speedometer */}
            <TachometerCluster
              player={p1}
              accentClass="border-rose-500"
              testId="speed-readout"
              compact
            />

            {/* Center Minimap + Weather Bar */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="hidden md:block">
                <Minimap
                  mapId={hud.mapId}
                  players={hud.players}
                  aiDots={hud.aiDots}
                  discoveredIds={hud.discoveredIds}
                  size={112}
                />
              </div>
              <div className="pointer-events-auto flex items-center gap-0.5 border border-slate-700/80 bg-slate-950/90 p-1 shadow-xl">
                {(
                  [
                    { id: 'clear', icon: <Sun size={12} /> },
                    { id: 'overcast', icon: <Wind size={12} /> },
                    { id: 'rain', icon: <CloudLightning size={12} /> },
                    { id: 'blizzard', icon: <Snowflake size={12} /> },
                    { id: 'night', icon: <Moon size={12} /> },
                    { id: 'auto', icon: <Compass size={12} /> },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectWeather(w.id);
                    }}
                    title={WEATHER_LABELS[w.id]}
                    className={`flex h-6 w-6 cursor-pointer items-center justify-center transition-colors ${
                      hud.weatherPreset === w.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {w.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* P2 Bottom-Right Speedometer */}
            <TachometerCluster
              player={p2}
              accentClass="border-sky-400"
              testId="speed-readout-p2"
              compact
            />
          </div>
        ) : (
          <div className="flex items-end justify-between gap-3">
            <div className="hidden sm:block">
              <Minimap
                mapId={hud.mapId}
                players={hud.players}
                aiDots={hud.aiDots}
                discoveredIds={hud.discoveredIds}
              />
            </div>

            <div className="pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-1 border border-slate-700/80 bg-slate-950/90 p-1 shadow-xl">
              {(
                [
                  { id: 'clear', label: 'Clear', icon: <Sun size={13} /> },
                  { id: 'overcast', label: 'Mist', icon: <Wind size={13} /> },
                  { id: 'rain', label: 'Storm', icon: <CloudLightning size={13} /> },
                  { id: 'blizzard', label: 'Snow', icon: <Snowflake size={13} /> },
                  { id: 'night', label: 'Night', icon: <Moon size={13} /> },
                  { id: 'auto', label: 'Auto', icon: <Compass size={13} /> },
                ] as const
              ).map((w) => {
                const active = hud.weatherPreset === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectWeather(w.id);
                    }}
                    className={`flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold tracking-wider uppercase transition-colors ${
                      active
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {w.icon}
                    <span className="hidden md:inline">{w.label}</span>
                  </button>
                );
              })}
            </div>

            {p1 && (
              <TachometerCluster
                player={p1}
                accentClass="border-amber-400"
                testId="speed-readout"
              />
            )}
          </div>
        )}
      </div>

      {/* Pause Modal */}
      {phase === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game Paused"
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4"
        >
          <div className="w-full max-w-md border border-slate-700 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-amber-400 uppercase">
                  <MapPin size={12} />
                  {hud.mapName}
                </div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                  Race Paused
                </h2>
              </div>
              <div className="text-right font-mono text-xs text-slate-400 tabular-nums">
                {isRace && <div>TIME {formatTime(hud.raceElapsed)}</div>}
                <div>BEACONS {hud.beaconsFound}/{hud.totalBeacons}</div>
              </div>
            </div>

            {/* P1 Paint Selector */}
            <div className="mt-5">
              <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                Player 1 Finish
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                {CAR_PAINT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-label={`Paint ${opt.name}`}
                    onClick={() => onSelectPaint(opt.hex)}
                    className={`h-8 w-8 cursor-pointer border-2 transition-transform hover:scale-110 ${
                      paintHex === opt.hex ? 'scale-110 border-white' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: `#${opt.hex.toString(16).padStart(6, '0')}` }}
                  />
                ))}
              </div>
            </div>

            {/* Weather Selector */}
            <div className="mt-5">
              <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                Dynamic Weather
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['clear', 'overcast', 'rain', 'blizzard', 'night', 'auto'] as WeatherPreset[]).map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => onSelectWeather(preset)}
                      className={`cursor-pointer border px-2 py-2 text-xs font-bold uppercase ${
                        hud.weatherPreset === preset
                          ? 'border-amber-400 bg-amber-500 text-slate-950'
                          : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      {WEATHER_LABELS[preset]}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onPauseToggle}
                className="w-full cursor-pointer bg-amber-500 py-3 text-sm font-black tracking-wider text-slate-950 uppercase hover:bg-amber-400"
              >
                Resume
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onRaceAgain();
                    onPauseToggle();
                  }}
                  className="cursor-pointer border border-slate-700 bg-slate-900 py-2.5 text-xs font-bold tracking-wider text-slate-200 uppercase hover:border-slate-500"
                >
                  Restart
                </button>
                <button
                  type="button"
                  onClick={onOpenGarage}
                  className="cursor-pointer border border-amber-400/60 bg-slate-900 py-2.5 text-xs font-bold tracking-wider text-amber-300 uppercase hover:border-amber-400"
                >
                  Garage
                </button>
                <button
                  type="button"
                  onClick={onReturnTitle}
                  className="cursor-pointer border border-slate-700 bg-slate-900 py-2.5 text-xs font-bold tracking-wider text-slate-200 uppercase hover:border-slate-500"
                >
                  Title / Maps
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Race Finish / Podium Results Modal */}
      {phase === 'gameover' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Race Finished"
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4"
        >
          <div className="w-full max-w-lg border-2 border-amber-400 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Trophy size={28} className="text-amber-400" />
                <div>
                  <div className="text-[11px] font-bold tracking-widest text-amber-400 uppercase">
                    Checkered Flag · {hud.mapName}
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                    {finalStandings[0]?.name ?? 'Race'} Wins!
                  </h2>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              {finalStandings.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between border px-3 py-2 text-xs ${
                    s.isHuman
                      ? 'border-amber-400/60 bg-slate-900 text-white'
                      : 'border-slate-800 bg-slate-950 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 font-mono text-sm font-black text-amber-400">
                      {s.place}.
                    </span>
                    <span
                      className="h-4 w-4 border border-white/30"
                      style={{ backgroundColor: `#${s.paintHex.toString(16).padStart(6, '0')}` }}
                    />
                    <span className="font-mono text-[11px] font-bold text-slate-400">
                      #{s.numberLabel}
                    </span>
                    <span className="font-extrabold uppercase">{s.name}</span>
                  </div>
                  <div className="font-mono font-bold tabular-nums">
                    {s.finished ? formatTime(s.finishTime) : `LAP ${s.lap}`}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border border-amber-400/60 bg-amber-500/10 px-4 py-2.5 font-mono text-xs font-black text-amber-300 uppercase">
              <div className="flex items-center gap-2">
                <Coins size={15} className="text-amber-400" />
                <span>Podium Bonus: +{lastRaceBonusCoins} Coins</span>
              </div>
              <span>Bank: {totalCoins} Coins</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onRaceAgain}
                className="cursor-pointer bg-amber-500 py-3 text-xs font-black tracking-wider text-slate-950 uppercase hover:bg-amber-400"
              >
                Race Again
              </button>
              <button
                type="button"
                onClick={onOpenGarage}
                className="cursor-pointer border border-amber-400/70 bg-slate-900 py-3 text-xs font-black tracking-wider text-amber-300 uppercase hover:bg-slate-800"
              >
                Car Shop
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="cursor-pointer border border-slate-700 bg-slate-900 py-3 text-xs font-bold tracking-wider text-slate-200 uppercase hover:border-slate-500"
              >
                Change Map
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
