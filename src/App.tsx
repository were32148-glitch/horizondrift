import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrivingCanvas, type DrivingControllerHandle } from './components/DrivingCanvas';
import { GameHud } from './components/GameHud';
import { GarageModal } from './components/GarageModal';
import {
  awardCoins,
  getCarSpec,
  loadGarageSave,
  purchaseCar,
  saveGarageSave,
} from './game/cars';
import { MAPS } from './game/maps';
import { getMapWorldData } from './game/terrain';
import type {
  CarId,
  GameMode,
  GamePhase,
  GarageSaveData,
  HudSnapshot,
  MapId,
  RaceStandingSummary,
  WeatherPreset,
} from './game/types';

function makeInitialHud(
  mode: GameMode,
  mapId: MapId,
  garage: GarageSaveData,
): HudSnapshot {
  const world = getMapWorldData(mapId);
  const cfg = MAPS[mapId];
  const defaultWeather = cfg.defaultWeather;
  const cond = defaultWeather === 'auto' ? 'clear' : defaultWeather;
  const totalRacers = mode === 'freestyle' ? 1 : 6;
  const specP1 = getCarSpec(garage.equippedP1);
  const specP2 = getCarSpec(garage.equippedP2);
  const players =
    mode === 'race2p'
      ? [
          {
            name: 'Player 1',
            carName: specP1.name,
            speedKmh: 0,
            rpm: 950,
            gear: 1,
            boostFuel: 100,
            isBoosting: false,
            isDrifting: false,
            totalDriftScore: 0,
            surface: 'asphalt' as const,
            biome: 'Scenic Highway' as const,
            lap: 1,
            totalLaps: cfg.totalLaps,
            place: 1,
            totalRacers,
            finished: false,
            finishTime: null,
            x: world.startPose.x,
            z: world.startPose.z,
            yaw: world.startPose.yaw,
          },
          {
            name: 'Player 2',
            carName: specP2.name,
            speedKmh: 0,
            rpm: 950,
            gear: 1,
            boostFuel: 100,
            isBoosting: false,
            isDrifting: false,
            totalDriftScore: 0,
            surface: 'asphalt' as const,
            biome: 'Scenic Highway' as const,
            lap: 1,
            totalLaps: cfg.totalLaps,
            place: 2,
            totalRacers,
            finished: false,
            finishTime: null,
            x: world.startPose.x,
            z: world.startPose.z,
            yaw: world.startPose.yaw,
          },
        ]
      : [
          {
            name: 'Player 1',
            carName: specP1.name,
            speedKmh: 0,
            rpm: 950,
            gear: 1,
            boostFuel: 100,
            isBoosting: false,
            isDrifting: false,
            totalDriftScore: 0,
            surface: 'asphalt' as const,
            biome: 'Scenic Highway' as const,
            lap: 1,
            totalLaps: cfg.totalLaps,
            place: 1,
            totalRacers,
            finished: false,
            finishTime: null,
            x: world.startPose.x,
            z: world.startPose.z,
            yaw: world.startPose.yaw,
          },
        ];

  return {
    mode,
    mapId,
    mapName: cfg.name,
    weatherCondition: cond,
    weatherPreset: defaultWeather,
    cameraMode: 'chase',
    headlightsOn: false,
    countdownSeconds: mode === 'freestyle' ? 0 : 2.4,
    raceElapsed: 0,
    players,
    aiDots: [],
    standings: [],
    beaconsFound: 0,
    totalBeacons: world.beacons.length,
    discoveredIds: [],
    totalCoins: garage.coins,
    runCoins: 0,
  };
}

export default function App() {
  const params = useMemo(
    () => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null),
    [],
  );
  const autoStart = params?.get('autostart') === '1';
  const initialModeParam = params?.get('mode');
  const initialMapParam = params?.get('map');

  const [garage, setGarage] = useState<GarageSaveData>(() => loadGarageSave());
  const [garageOpen, setGarageOpen] = useState(false);

  const [mode, setMode] = useState<GameMode>(
    initialModeParam === 'race1p' || initialModeParam === 'freestyle' || initialModeParam === 'race2p'
      ? initialModeParam
      : 'race2p',
  );
  const [mapId, setMapId] = useState<MapId>(
    initialMapParam === 'valley' ||
      initialMapParam === 'canyon' ||
      initialMapParam === 'alpine' ||
      initialMapParam === 'coast'
      ? initialMapParam
      : 'valley',
  );
  const [phase, setPhase] = useState<GamePhase>(autoStart ? 'playing' : 'title');
  const [hud, setHud] = useState<HudSnapshot>(() => makeInitialHud(mode, mapId, garage));
  const [finalStandings, setFinalStandings] = useState<RaceStandingSummary[]>([]);
  const [muted, setMuted] = useState(false);
  const [paintHex, setPaintHex] = useState<number>(() => getCarSpec(garage.equippedP1).paintHex);
  const [beaconToast, setBeaconToast] = useState<string | null>(null);
  const [coinToast, setCoinToast] = useState<string | null>(null);
  const [lastRaceBonusCoins, setLastRaceBonusCoins] = useState(0);

  const driverRef = useRef<DrivingControllerHandle | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const coinToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (coinToastTimerRef.current !== null) {
        window.clearTimeout(coinToastTimerRef.current);
      }
    };
  }, []);

  const handleSelectMode = useCallback(
    (nextMode: GameMode) => {
      setMode(nextMode);
      setHud(makeInitialHud(nextMode, mapId, garage));
    },
    [mapId, garage],
  );

  const handleSelectMap = useCallback(
    (nextMap: MapId) => {
      setMapId(nextMap);
      setHud(makeInitialHud(mode, nextMap, garage));
    },
    [mode, garage],
  );

  const handleStart = useCallback(() => {
    driverRef.current?.initAudio();
    driverRef.current?.resetRace();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFinalStandings([]);
    setLastRaceBonusCoins(0);
    setPhase('playing');
  }, []);

  const handleRaceAgain = useCallback(() => {
    driverRef.current?.initAudio();
    driverRef.current?.resetRace();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFinalStandings([]);
    setLastRaceBonusCoins(0);
    setPhase('playing');
  }, []);

  const handlePauseToggle = useCallback(() => {
    setPhase((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
  }, []);

  const handlePhaseHotkey = useCallback((action: 'pause' | 'start' | 'mute') => {
    if (action === 'start') {
      setPhase('playing');
    } else if (action === 'pause') {
      setPhase((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
    } else if (action === 'mute') {
      setMuted((prev) => !prev);
    }
  }, []);

  const handleBeaconFound = useCallback((name: string) => {
    setBeaconToast(name);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setBeaconToast(null);
    }, 3200);
  }, []);

  const handleCoinsEarned = useCallback((amount: number, label: string) => {
    setGarage((prev) => {
      const next = awardCoins(prev, amount);
      saveGarageSave(next);
      return next;
    });
    setCoinToast(label);
    if (coinToastTimerRef.current !== null) {
      window.clearTimeout(coinToastTimerRef.current);
    }
    coinToastTimerRef.current = window.setTimeout(() => {
      setCoinToast(null);
    }, 1800);
  }, []);

  const handleRaceFinished = useCallback((standings: RaceStandingSummary[]) => {
    const humanPlaces = standings.filter((s) => s.isHuman).map((s) => s.place);
    const bestPlace = humanPlaces.length > 0 ? Math.min(...humanPlaces) : 6;
    const bonus = bestPlace === 1 ? 150 : bestPlace === 2 ? 100 : bestPlace === 3 ? 60 : 30;
    setLastRaceBonusCoins(bonus);
    setGarage((prev) => {
      const next = awardCoins(prev, bonus);
      saveGarageSave(next);
      return next;
    });
    setFinalStandings(standings);
    setPhase('gameover');
  }, []);

  const handleSelectOrBuyCar = useCallback(
    (carId: CarId, slot: 1 | 2) => {
      setGarage((prev) => {
        const { next } = purchaseCar(prev, carId, slot);
        saveGarageSave(next);
        if (slot === 1) {
          setPaintHex(getCarSpec(next.equippedP1).paintHex);
        }
        return next;
      });
    },
    [],
  );

  const handleSelectWeather = useCallback((preset: WeatherPreset) => {
    driverRef.current?.initAudio();
    driverRef.current?.setWeatherPreset(preset);
    setHud((prev) => ({
      ...prev,
      weatherPreset: preset,
      weatherCondition: preset === 'auto' ? prev.weatherCondition : preset,
    }));
  }, []);

  const handleToggleMute = useCallback(() => {
    driverRef.current?.initAudio();
    const isNowMuted = driverRef.current?.toggleMute() ?? !muted;
    setMuted(isNowMuted);
  }, [muted]);

  const handleSelectPaint = useCallback((hex: number) => {
    setPaintHex(hex);
    driverRef.current?.setPaintColor(hex);
  }, []);

  const specP1 = getCarSpec(garage.equippedP1);
  const specP2 = getCarSpec(garage.equippedP2);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 select-none">
      <DrivingCanvas
        key={`${mode}-${mapId}`}
        ref={driverRef}
        phase={phase}
        mode={mode}
        mapId={mapId}
        carIdP1={garage.equippedP1}
        carIdP2={garage.equippedP2}
        totalCoins={garage.coins}
        onHudUpdate={setHud}
        onPhaseHotkey={handlePhaseHotkey}
        onBeaconFound={handleBeaconFound}
        onCoinsEarned={handleCoinsEarned}
        onRaceFinished={handleRaceFinished}
      />
      <GameHud
        phase={phase}
        mode={mode}
        mapId={mapId}
        hud={hud}
        finalStandings={finalStandings}
        muted={muted}
        paintHex={paintHex}
        totalCoins={garage.coins}
        equippedCarP1Name={specP1.name}
        equippedCarP2Name={specP2.name}
        beaconToast={beaconToast}
        coinToast={coinToast}
        lastRaceBonusCoins={lastRaceBonusCoins}
        onSelectMode={handleSelectMode}
        onSelectMap={handleSelectMap}
        onStart={handleStart}
        onOpenGarage={() => setGarageOpen(true)}
        onPauseToggle={handlePauseToggle}
        onReturnTitle={() => {
          driverRef.current?.resetRace();
          setPhase('title');
        }}
        onResetCar={() => driverRef.current?.resetCar()}
        onRaceAgain={handleRaceAgain}
        onSelectWeather={handleSelectWeather}
        onCycleCamera={() => driverRef.current?.cycleCameraMode()}
        onToggleLights={() => driverRef.current?.toggleHeadlights()}
        onToggleMute={handleToggleMute}
        onSelectPaint={handleSelectPaint}
      />
      {garageOpen && (
        <GarageModal
          garage={garage}
          mode={mode}
          onClose={() => setGarageOpen(false)}
          onSelectOrBuyCar={handleSelectOrBuyCar}
        />
      )}
    </main>
  );
}

