import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { DrivingCanvas, type DrivingControllerHandle } from './components/DrivingCanvas';
import { GameHud } from './components/GameHud';
import { GarageModal } from './components/GarageModal';
import { LobbyModal } from './components/LobbyModal';
import {
  awardCoins,
  getCarSpec,
  loadGarageSave,
  purchaseCar,
  purchaseCharacter,
  purchaseWeapon,
  saveGarageSave,
} from './game/cars';
import { subscribeAuth, syncUserProfileToCloud } from './game/firebase';
import type { HitReactionEvent } from './game/livingWorld';
import { LobbySocketClient } from './game/lobbyClient';
import { MAPS } from './game/maps';
import { getMapWorldData } from './game/terrain';
import type {
  CarId,
  CharacterId,
  FastTravelZone,
  GameMode,
  GamePhase,
  GarageSaveData,
  HudSnapshot,
  LobbyMode,
  LobbyState,
  MapId,
  RaceStandingSummary,
  RemotePlayerSnapshot,
  TeamId,
  WeatherPreset,
  WeaponId,
} from './game/types';

function makeInitialHud(
  mode: GameMode,
  mapId: MapId,
  garage: GarageSaveData,
  lobbyCode?: string | null,
): HudSnapshot {
  const world = getMapWorldData(mapId);
  const cfg = MAPS[mapId];
  const defaultWeather = cfg.defaultWeather;
  const cond = defaultWeather === 'auto' ? 'clear' : defaultWeather;
  const totalRacers = mode === 'freestyle' ? 1 : mode === 'online_2v2' ? 4 : 6;
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
    lobbyCode: lobbyCode ?? null,
    teamScores: mode === 'online_2v2' ? { red: 0, blue: 0 } : undefined,
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
  const initialLobbyParam = params?.get('lobby');

  const [garage, setGarage] = useState<GarageSaveData>(() => loadGarageSave());
  const [garageOpen, setGarageOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(Boolean(initialLobbyParam));

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [activeLobby, setActiveLobby] = useState<LobbyState | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [remoteSnapshots, setRemoteSnapshots] = useState<RemotePlayerSnapshot[]>([]);
  const [matchKey, setMatchKey] = useState(0);

  const [mode, setMode] = useState<GameMode>(
    initialModeParam === 'race1p' ||
      initialModeParam === 'freestyle' ||
      initialModeParam === 'race2p' ||
      initialModeParam === 'online_2v2' ||
      initialModeParam === 'online_ffa'
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
  const [reactionToast, setReactionToast] = useState<string | null>(null);
  const [lastRaceBonusCoins, setLastRaceBonusCoins] = useState(0);
  const [isOnFoot, setIsOnFoot] = useState(false);
  const [characterHealth, setCharacterHealth] = useState(100);
  const [wantedLevel, setWantedLevel] = useState(0);

  const driverRef = useRef<DrivingControllerHandle | null>(null);
  const socketClientRef = useRef<LobbySocketClient | null>(null);
  const authUserRef = useRef<User | null>(null);
  const activeLobbyRef = useRef<LobbyState | null>(null);
  const garageRef = useRef<GarageSaveData>(garage);
  const toastTimerRef = useRef<number | null>(null);
  const coinToastTimerRef = useRef<number | null>(null);
  const reactionTimerRef = useRef<number | null>(null);
  const syncedCreatedCodeRef = useRef<string | null>(null);

  authUserRef.current = authUser;
  activeLobbyRef.current = activeLobby;
  garageRef.current = garage;

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  // Firebase Auth listener + Cloud Garage Sync
  useEffect(() => {
    const unsub = subscribeAuth((u) => {
      setAuthUser(u);
      if (u) {
        void syncUserProfileToCloud(u, garageRef.current)
          .then((merged) => {
            saveGarageSave(merged);
            setGarage(merged);
          })
          .catch(() => undefined);
      }
    });
    return () => unsub();
  }, []);

  // WebSocket Multiplayer Lobby Client lifecycle
  useEffect(() => {
    const client = new LobbySocketClient({
      onConnected: (cid) => {
        setClientId(cid);
        if (initialLobbyParam && !activeLobbyRef.current) {
          client.joinLobby({
            code: initialLobbyParam,
            name: authUserRef.current?.displayName?.split(' ')[0] || 'Racer',
            user: authUserRef.current,
            carId: garageRef.current.equippedP1,
          });
        }
      },
      onLobbyState: (lobby) => {
        setLobbyError(null);
        setActiveLobby(lobby);
        if (lobby) {
          setMode(lobby.mode);
          setMapId(lobby.mapId);
          const me = lobby.members.find((m) => m.clientId === client.getClientId());
          if (me) {
            void client.syncJoinedCloudLobby(
              lobby,
              authUserRef.current,
              me.carId,
              me.team,
            );
          }
          if (
            lobby.hostClientId === client.getClientId() &&
            lobby.members.length === 1 &&
            syncedCreatedCodeRef.current !== lobby.code
          ) {
            syncedCreatedCodeRef.current = lobby.code;
            void client.syncCreatedCloudLobby(lobby, authUserRef.current);
          }
        } else {
          syncedCreatedCodeRef.current = null;
        }
      },
      onMatchStarted: (lobby) => {
        setLobbyError(null);
        setActiveLobby(lobby);
        setMode(lobby.mode);
        setMapId(lobby.mapId);
        setRemoteSnapshots([]);
        setLobbyOpen(false);
        setFinalStandings([]);
        setLastRaceBonusCoins(0);
        setMatchKey((k) => k + 1);
        setPhase('playing');
      },
      onSnapshots: (snaps) => {
        setRemoteSnapshots(snaps);
      },
      onError: (msg) => {
        setLobbyError(msg);
      },
    });
    client.connect();
    socketClientRef.current = client;

    return () => {
      client.disconnect();
      socketClientRef.current = null;
    };
  }, [initialLobbyParam]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      if (coinToastTimerRef.current !== null) window.clearTimeout(coinToastTimerRef.current);
      if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current);
    };
  }, []);

  const handleSelectMode = useCallback(
    (nextMode: GameMode) => {
      setMode(nextMode);
      setHud(makeInitialHud(nextMode, mapId, garage, activeLobbyRef.current?.code));
    },
    [mapId, garage],
  );

  const handleSelectMap = useCallback(
    (nextMap: MapId) => {
      setMapId(nextMap);
      setHud(makeInitialHud(mode, nextMap, garage, activeLobbyRef.current?.code));
    },
    [mode, garage],
  );

  const handleStart = useCallback(() => {
    if ((mode === 'online_2v2' || mode === 'online_ffa') && !activeLobbyRef.current) {
      setLobbyOpen(true);
      return;
    }
    driverRef.current?.initAudio();
    driverRef.current?.resetRace();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFinalStandings([]);
    setLastRaceBonusCoins(0);
    setPhase('playing');
  }, [mode]);

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

  const handlePhaseHotkey = useCallback(
    (action: 'pause' | 'start' | 'mute') => {
      if (action === 'start') {
        handleStart();
      } else if (action === 'pause') {
        setPhase((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
      } else if (action === 'mute') {
        setMuted((prev) => !prev);
      }
    },
    [handleStart],
  );

  const handleBeaconFound = useCallback((name: string) => {
    setBeaconToast(name);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setBeaconToast(null), 3200);
  }, []);

  const handleCoinsEarned = useCallback((amount: number, label: string) => {
    setGarage((prev) => {
      const next = awardCoins(prev, amount);
      saveGarageSave(next);
      if (authUserRef.current) {
        void syncUserProfileToCloud(authUserRef.current, next).catch(() => undefined);
      }
      return next;
    });
    setCoinToast(label);
    if (coinToastTimerRef.current !== null) window.clearTimeout(coinToastTimerRef.current);
    coinToastTimerRef.current = window.setTimeout(() => setCoinToast(null), 1800);
  }, []);

  const handleReactionEvent = useCallback((evt: HitReactionEvent) => {
    if (evt.isKill) {
      setReactionToast(`Hunted ${evt.label}! +${evt.coinsAwarded ?? 0} Coins`);
    } else {
      const verb =
        evt.category === 'human'
          ? 'Dodged / Bumped'
          : evt.sound === 'chirp'
            ? 'Flushed'
            : 'Startled';
      setReactionToast(`${verb} ${evt.label}!`);
    }
    if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = window.setTimeout(() => setReactionToast(null), 1800);
  }, []);

  const handleRaceFinished = useCallback((standings: RaceStandingSummary[]) => {
    const humanPlaces = standings.filter((s) => s.isHuman).map((s) => s.place);
    const bestPlace = humanPlaces.length > 0 ? Math.min(...humanPlaces) : 6;
    const bonus = bestPlace === 1 ? 150 : bestPlace === 2 ? 100 : bestPlace === 3 ? 60 : 30;
    setLastRaceBonusCoins(bonus);
    setGarage((prev) => {
      const next = awardCoins(prev, bonus);
      saveGarageSave(next);
      if (authUserRef.current) {
        void syncUserProfileToCloud(authUserRef.current, next).catch(() => undefined);
      }
      return next;
    });
    if (activeLobbyRef.current && socketClientRef.current) {
      socketClientRef.current.finishRace(
        activeLobbyRef.current.code,
        standings[0]?.name ?? 'Winner',
        authUserRef.current,
      );
    }
    setFinalStandings(standings);
    setPhase('gameover');
  }, []);

  const handleToggleOnFoot = useCallback(() => {
    setIsOnFoot((prev) => !prev);
    driverRef.current?.toggleOnFoot?.();
  }, []);

  const handleSelectOrBuyCharacter = useCallback((charId: CharacterId) => {
    setGarage((prev) => {
      const { next } = purchaseCharacter(prev, charId);
      saveGarageSave(next);
      if (authUserRef.current) {
        void syncUserProfileToCloud(authUserRef.current, next).catch(() => undefined);
      }
      return next;
    });
  }, []);

  const handleSelectOrBuyWeapon = useCallback((weaponId: WeaponId) => {
    setGarage((prev) => {
      const { next } = purchaseWeapon(prev, weaponId);
      saveGarageSave(next);
      if (authUserRef.current) {
        void syncUserProfileToCloud(authUserRef.current, next).catch(() => undefined);
      }
      return next;
    });
  }, []);

  const handleSelectOrBuyCar = useCallback(
    (carId: CarId, slot: 1 | 2) => {
      setGarage((prev) => {
        const { next } = purchaseCar(prev, carId, slot);
        saveGarageSave(next);
        if (slot === 1) {
          setPaintHex(getCarSpec(next.equippedP1).paintHex);
          if (activeLobbyRef.current && socketClientRef.current) {
            socketClientRef.current.updateMember(activeLobbyRef.current.code, { carId });
          }
        }
        if (authUserRef.current) {
          void syncUserProfileToCloud(authUserRef.current, next).catch(() => undefined);
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

  const handleTeleportZone = useCallback((zone: FastTravelZone) => {
    driverRef.current?.initAudio();
    driverRef.current?.teleportToZone(zone.x, zone.z, zone.yaw);
    setBeaconToast(`Arrived: ${zone.label} (${zone.district})`);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setBeaconToast(null), 2600);
  }, []);

  const handleSendSnapshot = useCallback((snapshot: RemotePlayerSnapshot) => {
    const code = activeLobbyRef.current?.code;
    if (code && socketClientRef.current) {
      socketClientRef.current.sendSnapshot(code, snapshot);
    }
  }, []);

  const handleCreateLobby = useCallback(
    (opts: {
      name: string;
      mode: LobbyMode;
      mapId: MapId;
      weatherPreset: WeatherPreset;
      fillWithBots: boolean;
    }) => {
      setLobbyError(null);
      socketClientRef.current?.createLobby({
        ...opts,
        user: authUser,
        carId: garage.equippedP1,
      });
    },
    [authUser, garage.equippedP1],
  );

  const handleJoinLobby = useCallback(
    (code: string, name: string) => {
      setLobbyError(null);
      socketClientRef.current?.joinLobby({
        code,
        name,
        user: authUser,
        carId: garage.equippedP1,
      });
    },
    [authUser, garage.equippedP1],
  );

  const handleUpdateMember = useCallback(
    (patch: { team?: TeamId; ready?: boolean; name?: string }) => {
      if (!activeLobby) return;
      socketClientRef.current?.updateMember(activeLobby.code, patch);
    },
    [activeLobby],
  );

  const handleUpdateLobby = useCallback(
    (patch: {
      mapId?: MapId;
      weatherPreset?: WeatherPreset;
      mode?: LobbyMode;
      fillWithBots?: boolean;
    }) => {
      if (!activeLobby) return;
      socketClientRef.current?.updateLobby(activeLobby.code, patch);
    },
    [activeLobby],
  );

  const handleStartOnlineMatch = useCallback(() => {
    if (!activeLobby) return;
    driverRef.current?.initAudio();
    socketClientRef.current?.startMatch(activeLobby.code, authUser);
  }, [activeLobby, authUser]);

  const handleLeaveLobby = useCallback(() => {
    socketClientRef.current?.leaveLobby(activeLobby?.code ?? null, authUser);
    setActiveLobby(null);
  }, [activeLobby, authUser]);

  const specP1 = getCarSpec(garage.equippedP1);
  const specP2 = getCarSpec(garage.equippedP2);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 select-none">
      <DrivingCanvas
        key={`${mode}-${mapId}-${matchKey}`}
        ref={driverRef}
        phase={phase}
        mode={mode}
        mapId={mapId}
        carIdP1={garage.equippedP1}
        carIdP2={garage.equippedP2}
        totalCoins={garage.coins}
        lobbyState={activeLobby}
        localClientId={clientId}
        remoteSnapshots={remoteSnapshots}
        isOnFoot={isOnFoot}
        onToggleOnFoot={handleToggleOnFoot}
        characterHealth={characterHealth}
        wantedLevel={wantedLevel}
        equippedCharacter={garage.equippedCharacter}
        equippedWeapon={garage.equippedWeapon}
        onHudUpdate={setHud}
        onPhaseHotkey={handlePhaseHotkey}
        onBeaconFound={handleBeaconFound}
        onCoinsEarned={handleCoinsEarned}
        onRaceFinished={handleRaceFinished}
        onSendSnapshot={handleSendSnapshot}
        onReactionEvent={handleReactionEvent}
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
        reactionToast={reactionToast}
        lastRaceBonusCoins={lastRaceBonusCoins}
        activeLobby={activeLobby}
        isOnFoot={isOnFoot}
        onToggleOnFoot={handleToggleOnFoot}
        characterHealth={characterHealth}
        wantedLevel={wantedLevel}
        equippedWeapon={garage.equippedWeapon}
        onSelectMode={handleSelectMode}
        onSelectMap={handleSelectMap}
        onStart={handleStart}
        onOpenGarage={() => setGarageOpen(true)}
        onOpenLobby={() => setLobbyOpen(true)}
        onPauseToggle={handlePauseToggle}
        onReturnTitle={() => {
          driverRef.current?.resetRace();
          setPhase('title');
        }}
        onResetCar={() => driverRef.current?.resetCar()}
        onTeleportZone={handleTeleportZone}
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
          onSelectOrBuyCharacter={handleSelectOrBuyCharacter}
          onSelectOrBuyWeapon={handleSelectOrBuyWeapon}
        />
      )}
      {lobbyOpen && (
        <LobbyModal
          user={authUser}
          clientId={clientId}
          activeLobby={activeLobby}
          lobbyError={lobbyError}
          equippedCar={garage.equippedP1}
          defaultMapId={mapId}
          onClose={() => setLobbyOpen(false)}
          onCreateLobby={handleCreateLobby}
          onJoinLobby={handleJoinLobby}
          onUpdateMember={handleUpdateMember}
          onUpdateLobby={handleUpdateLobby}
          onStartMatch={handleStartOnlineMatch}
          onLeaveLobby={handleLeaveLobby}
        />
      )}
    </main>
  );
}
