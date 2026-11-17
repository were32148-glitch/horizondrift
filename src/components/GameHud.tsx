import {
  Camera,
  CarFront,
  CloudLightning,
  CloudRain,
  Coins,
  Compass,
  Flag,
  Globe,
  Lightbulb,
  MapPin,
  Moon,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Snowflake,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { CAR_PAINT_OPTIONS } from '../game/carModel';
import { FAST_TRAVEL_ZONES, MAP_LIST } from '../game/maps';
import type {
  ActiveWeatherCondition,
  CameraMode,
  FastTravelZone,
  GameMode,
  GamePhase,
  HudSnapshot,
  LobbyState,
  MapId,
  PlayerHudInfo,
  RaceStandingSummary,
  SurfaceType,
  WeatherPreset,
  WeaponId,
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
  reactionToast: string | null;
  lastRaceBonusCoins: number;
  activeLobby: LobbyState | null;
  equippedCharacterName: string;
  equippedWeapon: WeaponId;
  onToggleOnFoot: () => void;
  onAttackWeapon: () => void;
  onUseEnergyDrink: () => void;
  onSelectMode: (mode: GameMode) => void;
  onSelectMap: (mapId: MapId) => void;
  onStart: () => void;
  onOpenGarage: () => void;
  onOpenLobby: () => void;
  onPauseToggle: () => void;
  onReturnTitle: () => void;
  onResetCar: () => void;
  onTeleportZone: (zone: FastTravelZone) => void;
  onRaceAgain: () => void;
  onSelectWeather: (preset: WeatherPreset) => void;
  onCycleCamera: () => void;
  onToggleLights: () => void;
  onToggleMute: () => void;
  onSelectPaint: (hex: number) => void;
}

const SURFACE_LABELS: Record<SurfaceType, { label: string; accent: string }> = {
  asphalt: { label: 'ASPHALT', accent: '#e2e8f0' },
  concrete: { label: 'CITY CONCRETE', accent: '#cbd5e1' },
  wood: { label: 'PIER TIMBER', accent: '#f59e0b' },
  dirt: { label: 'GRAVEL TRAIL', accent: '#d97706' },
  grass: { label: 'GRASSLANDS', accent: '#4ade80' },
  forest: { label: 'FOREST FLOOR', accent: '#22c55e' },
  rock: { label: 'CANYON ROCK', accent: '#f97316' },
  snow: { label: 'ALPINE SNOW', accent: '#bae6fd' },
  sand: { label: 'BEACH SAND', accent: '#fde047' },
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
  const surfInfo = SURFACE_LABELS[player.surface] ?? SURFACE_LABELS.asphalt;
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
        {player.surface !== 'asphalt' && player.surface !== 'concrete' && (
          <div className="bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-amber-300 uppercase">
            OFFROAD DRAG
          </div>
        )}
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
  reactionToast,
  lastRaceBonusCoins,
  activeLobby,
  equippedCharacterName,
  equippedWeapon,
  onToggleOnFoot,
  onAttackWeapon,
  onUseEnergyDrink,
  onSelectMode,
  onSelectMap,
  onStart,
  onOpenGarage,
  onOpenLobby,
  onPauseToggle,
  onReturnTitle,
  onResetCar,
  onTeleportZone,
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
        ? 'Start 2P Split-Screen'
        : mode === 'race1p'
          ? 'Start 1P Grand Prix'
          : mode === 'online_2v2'
            ? activeLobby
              ? 'Enter Online 2v2'
              : 'Open 2v2 Lobby'
            : mode === 'online_ffa'
              ? activeLobby
                ? 'Enter Online FFA'
                : 'Open FFA Lobby'
              : 'Explore Wildlands & Los Santos';

    return (
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8">
        <div className="flex max-w-2xl flex-col gap-4 pt-1">
          {/* Brand Title SVG */}
          <svg
            viewBox="0 0 640 146"
            className="w-full max-w-[500px] drop-shadow-[0_6px_20px_rgba(0,0,0,0.85)]"
            role="img"
            aria-label="Horizon Drift: Wildlands & Los Santos"
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
              y="40"
              fill="#f8fafc"
              fontSize="16"
              fontWeight="800"
              letterSpacing="4"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              30X OPEN WORLD · ONLINE 2V2 · LOS SANTOS
            </text>
            <text
              x="2"
              y="100"
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
            <line x1="4" y1="113" x2="355" y2="113" stroke="#f59e0b" strokeWidth="3.5" />
            <text
              x="4"
              y="138"
              fill="#cbd5e1"
              stroke="#090d16"
              strokeWidth="4"
              paintOrder="stroke fill"
              fontSize="18"
              fontWeight="700"
              letterSpacing="7"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              WILDLANDS &amp; LOS SANTOS
            </text>
          </svg>

          {/* Compact Mode Selector */}
          <div className="pointer-events-auto flex flex-col gap-3">
            <div>
              <div className="mb-1.5 inline-block bg-slate-950/90 px-2 py-0.5 text-[11px] font-bold tracking-widest text-amber-400 uppercase">
                Select Race Mode
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(
                  [
                    { id: 'race2p', label: '2P Split', sub: 'WASD vs Arrows', icon: <Users size={14} /> },
                    { id: 'race1p', label: '1P vs AI', sub: 'Grand Prix', icon: <Flag size={14} /> },
                    { id: 'freestyle', label: 'Freestyle', sub: 'Explore LS', icon: <Compass size={14} /> },
                    { id: 'online_2v2', label: 'Online 2v2', sub: 'Red vs Blue', icon: <Shield size={14} /> },
                    { id: 'online_ffa', label: 'Online FFA', sub: 'Lobby Code', icon: <Globe size={14} /> },
                  ] as const
                ).map((m) => {
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`mode-${m.id}`}
                      onClick={() => onSelectMode(m.id)}
                      className={`flex cursor-pointer flex-col items-start border-2 px-2.5 py-2 text-left transition-colors ${
                        active
                          ? 'border-amber-400 bg-slate-950/95 text-white shadow-lg'
                          : 'border-slate-700/80 bg-slate-950/82 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wide uppercase">
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
              <div className="mb-1.5 inline-block bg-slate-950/90 px-2 py-0.5 text-[11px] font-bold tracking-widest text-amber-400 uppercase">
                Select Region + Northbound Los Santos Expansion (30x Scale)
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
                          : 'border-slate-700/80 bg-slate-950/82 text-slate-300 hover:border-slate-500'
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

            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onStart}
                className="flex cursor-pointer items-center gap-2 border-2 border-amber-400 bg-amber-500 px-5 py-3 text-xs font-black tracking-wider text-slate-950 uppercase shadow-[0_8px_28px_rgba(245,158,11,0.45)] transition-transform duration-150 hover:scale-[1.03] hover:bg-amber-400 active:scale-[0.98] sm:text-sm"
              >
                <Play size={16} fill="currentColor" />
                {startLabel}
              </button>

              <button
                type="button"
                data-testid="open-lobby-btn"
                onClick={onOpenLobby}
                className="flex cursor-pointer items-center gap-2 border-2 border-sky-400/75 bg-slate-950/92 px-4 py-3 text-xs font-black tracking-wider text-sky-300 uppercase shadow-lg transition-colors hover:border-sky-300 hover:bg-slate-900"
              >
                <Globe size={15} />
                <span>{activeLobby ? `Lobby #${activeLobby.code}` : 'Online Lobby'}</span>
              </button>

              <button
                type="button"
                data-testid="open-garage"
                onClick={onOpenGarage}
                className="flex cursor-pointer items-center gap-2 border-2 border-slate-600 bg-slate-950/92 px-4 py-3 text-xs font-black tracking-wider text-white uppercase shadow-lg transition-colors hover:border-amber-400 hover:text-amber-300"
              >
                <CarFront size={15} className="text-amber-400" />
                <span>Garage</span>
                <span
                  data-testid="title-coin-balance"
                  className="ml-1 flex items-center gap-1 border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-black text-amber-300 tabular-nums"
                >
                  <Coins size={12} />
                  {totalCoins}
                </span>
              </button>
            </div>

            <div className="inline-block w-fit bg-slate-950/90 px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-200 uppercase">
              Equipped: <span className="text-amber-300">{equippedCarP1Name}</span>
              {mode === 'race2p' && (
                <>
                  {' '}
                  · P2: <span className="text-sky-300">{equippedCarP2Name}</span>
                </>
              )}
              {mode === 'freestyle' && (
                <>
                  {' '}
                  · Character: <span className="text-emerald-300">{equippedCharacterName}</span> ·
                  Weapon: <span className="text-rose-300">{equippedWeapon}</span>
                </>
              )}
              {activeLobby && (
                <>
                  {' '}
                  · Active Lobby:{' '}
                  <span className="font-mono text-sky-300">
                    #{activeLobby.code} ({activeLobby.members.length} racers)
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Control Hint */}
        <div className="text-center text-[11px] font-bold tracking-widest text-slate-200 uppercase [text-shadow:0_2px_8px_rgba(0,0,0,0.95)]">
          Drive North to Los Santos · P1: WASD + Space + CapsLock (Nitro) · P2: Arrows + Enter + Shift (Nitro) · E Exit Car · F Shoot · Esc Pause
        </div>
      </div>
    );
  }

  const p1 = hud.players[0];
  const p2 = hud.players[1];
  const is2P = hud.mode === 'race2p' && Boolean(p2);
  const isRace = hud.mode !== 'freestyle';
  const isOnFoot = Boolean(hud.isOnFoot);
  const charHp = hud.characterHealth ?? 100;
  const charMaxHp = hud.characterMaxHealth ?? 100;
  const charEnergy = hud.characterEnergy ?? 100;
  const wantedLevel = hud.wantedLevel ?? 0;

  return (
    <>
      {/* 2P Vertical Split-Screen Center Divider */}
      {is2P && (
        <div className="pointer-events-none fixed inset-y-0 left-1/2 z-10 w-[3px] -translate-x-1/2 bg-slate-950 shadow-[0_0_12px_rgba(0,0,0,0.9)]" />
      )}

      {/* Character Death ("WASTED") Banner */}
      {phase === 'playing' && hud.isCharacterDead && (
        <div
          data-testid="wasted-banner"
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-rose-950/60"
        >
          <div className="border-4 border-rose-500 bg-slate-950/95 px-10 py-6 text-center shadow-2xl">
            <div className="font-mono text-5xl font-black tracking-widest text-rose-500 uppercase">
              WASTED
            </div>
            <div className="mt-2 text-xs font-bold tracking-widest text-slate-200 uppercase">
              Neutralized by LSPD Police · Respawning with Full Energy...
            </div>
          </div>
        </div>
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
      <div
        className={`pointer-events-none fixed inset-0 z-10 flex flex-col justify-between ${
          is2P ? 'p-2 sm:p-2.5' : 'p-3 sm:p-4'
        }`}
      >
        {/* Freestyle Action Bar: Exit/Enter Car, Shoot/Attack, Energy Drink, Garage & Wanted/HP Status */}
        {mode === 'freestyle' && phase === 'playing' && (
          <div className="pointer-events-auto fixed bottom-14 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              data-testid="toggle-onfoot-btn"
              onClick={onToggleOnFoot}
              className={`cursor-pointer border-2 px-4 py-2.5 text-xs font-black tracking-wider uppercase shadow-2xl transition-transform hover:scale-105 ${
                isOnFoot
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                  : 'border-amber-400 bg-amber-500 text-slate-950'
              }`}
            >
              {isOnFoot ? 'Enter Car [E]' : 'Exit Car [E]'}
            </button>

            <button
              type="button"
              data-testid="attack-weapon-btn"
              onClick={onAttackWeapon}
              className="cursor-pointer border-2 border-amber-300 bg-amber-500 px-4 py-2.5 text-xs font-black tracking-wider text-slate-950 uppercase shadow-2xl transition-transform hover:scale-105 hover:bg-amber-400"
            >
              Shoot Gold ({equippedWeapon.replace('_', ' ')}) [F / Click]
            </button>
            {isOnFoot && (
              <div
                data-testid="manual-aim-badge"
                className="border border-amber-400/80 bg-slate-950/90 px-2.5 py-2 font-mono text-[10px] font-black tracking-wider text-amber-300 uppercase shadow-lg"
              >
                AIM: MOUSE / A·D
              </div>
            )}

            <button
              type="button"
              data-testid="use-energy-btn"
              onClick={onUseEnergyDrink}
              className="cursor-pointer border-2 border-cyan-400 bg-cyan-600 px-3.5 py-2.5 text-xs font-black tracking-wider text-slate-950 uppercase shadow-2xl transition-transform hover:scale-105 hover:bg-cyan-400"
            >
              Energy Drink (+100% HP) [G]
            </button>

            <button
              type="button"
              data-testid="hud-open-garage-btn"
              onClick={onOpenGarage}
              className="cursor-pointer border-2 border-slate-600 bg-slate-950/95 px-3.5 py-2.5 text-xs font-black tracking-wider text-amber-300 uppercase shadow-2xl hover:border-amber-400"
            >
              Shop / Armory
            </button>

            <div className="flex flex-col gap-1 border border-slate-700 bg-slate-950/95 px-3.5 py-1.5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {wantedLevel > 0 ? 'LSPD PURSUIT' : 'WANTED'}
                </span>
                <span
                  data-testid="wanted-stars"
                  className={`font-mono text-xs tracking-wider ${
                    wantedLevel > 0 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
                  }`}
                >
                  {wantedLevel === 0
                    ? '☆☆☆☆☆'
                    : '★'.repeat(wantedLevel) + '☆'.repeat(5 - wantedLevel)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 text-[9px] font-bold text-slate-400 uppercase">HP</span>
                <div className="h-2 w-20 overflow-hidden bg-slate-800">
                  <div
                    className="h-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.min(100, Math.round((charHp / Math.max(1, charMaxHp)) * 100))}%` }}
                  />
                </div>
                <span data-testid="char-hp-value" className="font-mono text-[10px] text-slate-200">
                  {charHp}/{charMaxHp}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 text-[9px] font-bold text-slate-400 uppercase">NRG</span>
                <div className="h-1.5 w-20 overflow-hidden bg-slate-800">
                  <div
                    className="h-full bg-cyan-400 transition-all"
                    style={{ width: `${charEnergy}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] text-cyan-300">{charEnergy}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Top Row */}
        <div className="flex items-start justify-between gap-3">
          {/* Top-Left: Player 1 Status */}
          <div className="flex flex-col gap-1.5">
            <div
              className={`flex items-center gap-3 border-l-4 ${
                p1?.team === 'blue' ? 'border-sky-400' : 'border-rose-500'
              } bg-slate-950/90 px-3 py-1.5 shadow-lg`}
            >
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-rose-400 uppercase">
                  <span>
                    {is2P
                      ? `P1 · ${p1?.carName ?? equippedCarP1Name}`
                      : p1?.team === 'red' || p1?.team === 'blue'
                        ? `${p1.team.toUpperCase()} SQUAD · ${p1.carName}`
                        : hud.mapName}
                  </span>
                </div>
                <div
                  data-testid="hud-biome"
                  className="flex items-center gap-2 text-xs font-extrabold text-slate-100"
                >
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

            {/* Freestyle Fast-Travel Los Santos District Bar */}
            {hud.mode === 'freestyle' && phase === 'playing' && (
              <div className="pointer-events-auto flex flex-wrap items-center gap-1 bg-slate-950/88 p-1 shadow-lg">
                <span className="flex items-center gap-1 px-1.5 text-[9px] font-black tracking-widest text-amber-400 uppercase">
                  <Navigation size={10} />
                  Jump:
                </span>
                {FAST_TRAVEL_ZONES.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    tabIndex={-1}
                    data-testid={`jump-${z.id}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onTeleportZone(z);
                    }}
                    className="cursor-pointer border border-slate-700/80 bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-200 uppercase hover:border-amber-400 hover:text-amber-300"
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center Toast / Timer, Team Scores & Coin Balance */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hud.mode === 'online_2v2' && hud.teamScores && (
                <div className="flex items-center gap-2 border border-slate-700 bg-slate-950/92 px-3 py-1 font-mono text-xs font-black shadow">
                  <span className="text-rose-400">RED {hud.teamScores.red}</span>
                  <span className="text-slate-600">VS</span>
                  <span className="text-sky-400">BLUE {hud.teamScores.blue}</span>
                </div>
              )}
              {hud.lobbyCode && (
                <div className="border border-sky-400/60 bg-slate-950/92 px-2.5 py-1 font-mono text-xs font-black tracking-widest text-sky-300 shadow">
                  #{hud.lobbyCode}
                </div>
              )}
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

            {p1?.isDrifting && (
              <div className="border border-sky-400/80 bg-slate-950/92 px-3 py-1 font-mono text-xs font-black tracking-wider text-sky-300 uppercase shadow-2xl">
                DRIFTING · {p1.totalDriftScore.toLocaleString()} PTS
              </div>
            )}
            {p1?.airTime !== undefined && p1.airTime > 0.25 && (
              <div className="border border-emerald-400/80 bg-slate-950/92 px-3 py-1 font-mono text-xs font-black tracking-wider text-emerald-300 uppercase shadow-2xl">
                AIRBORNE · {p1.airTime.toFixed(1)}S
              </div>
            )}
            {hud.activePower && (
              <div
                data-testid="active-power-badge"
                className="border border-fuchsia-400 bg-fuchsia-950/95 px-3 py-1 font-mono text-xs font-black tracking-wider text-fuchsia-200 uppercase shadow-2xl"
              >
                MYSTERY POWER: {hud.activePower.replace('_', ' ')} ({hud.activePowerSeconds ?? 0}s)
              </div>
            )}
            {hud.nearHouseName && (
              <div
                data-testid="near-house-badge"
                className="border border-cyan-400/90 bg-cyan-950/95 px-3 py-1 font-mono text-[11px] font-black tracking-wider text-cyan-200 uppercase shadow-2xl"
              >
                HOUSE: {hud.nearHouseName} — Walk Inside Doorway!
              </div>
            )}
            {coinToast && (
              <div className="border border-amber-400 bg-slate-950/95 px-3 py-1 font-mono text-xs font-black tracking-wider text-amber-300 uppercase shadow-2xl">
                {coinToast}
              </div>
            )}
            {reactionToast && (
              <div
                data-testid="reaction-toast"
                className="border border-orange-400/80 bg-slate-950/95 px-3 py-1 text-[11px] font-black tracking-wider text-orange-300 uppercase shadow-2xl"
              >
                {reactionToast}
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
            <TachometerCluster
              player={p1}
              accentClass="border-rose-500"
              testId="speed-readout"
              compact
            />

            <div className="flex flex-col items-center gap-1">
              <div className="hidden md:block">
                <Minimap
                  mapId={hud.mapId}
                  players={hud.players}
                  aiDots={hud.aiDots}
                  discoveredIds={hud.discoveredIds}
                  size={92}
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
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-slate-700 bg-slate-950 p-6 shadow-2xl">
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

            {/* Fast Travel District Jump (Freestyle) */}
            {hud.mode === 'freestyle' && (
              <div className="mt-4">
                <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  Fast Travel Districts
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {FAST_TRAVEL_ZONES.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => {
                        onTeleportZone(z);
                        onPauseToggle();
                      }}
                      className="cursor-pointer border border-slate-800 bg-slate-900 px-2.5 py-2 text-left hover:border-amber-400"
                    >
                      <div className="text-[11px] font-black text-white uppercase">{z.label}</div>
                      <div className="text-[9px] text-slate-400">{z.district}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                    {hud.mode === 'online_2v2' && hud.teamScores
                      ? hud.teamScores.red >= hud.teamScores.blue
                        ? `Red Squad Wins (${hud.teamScores.red} - ${hud.teamScores.blue})`
                        : `Blue Squad Wins (${hud.teamScores.blue} - ${hud.teamScores.red})`
                      : `${finalStandings[0]?.name ?? 'Race'} Wins!`}
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
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 font-mono text-sm font-black text-amber-400">
                      {s.place}.
                    </span>
                    <span
                      className="h-4 w-4 border border-white/30"
                      style={{ backgroundColor: `#${s.paintHex.toString(16).padStart(6, '0')}` }}
                    />
                    {s.team && s.team !== 'ffa' && (
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${
                          s.team === 'red'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {s.team}
                      </span>
                    )}
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
