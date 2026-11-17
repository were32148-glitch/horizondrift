import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ProceduralAudioEngine } from '../game/audio';
import { createCarVisualRig, type CarVisualRig } from '../game/carModel';
import { getCarSpec } from '../game/cars';
import {
  FreestyleActionController,
  type FreestyleActionEvent,
} from '../game/freestyleAction';
import {
  FREESTYLE_TRAFFIC_VARIANTS,
  FreestyleTrafficController,
} from '../game/freestyleTraffic';
import { type HitReactionEvent, LivingWorldController } from '../game/livingWorld';
import {
  buildRaceStandings,
  computeAiVehicleInput,
  computeTeamScores,
  createRaceGrid,
  stepRaceProgress,
} from '../game/raceLogic';
import {
  clamp,
  getDrivableSurfaceHeight,
  getMapWorldData,
  lerp,
} from '../game/terrain';
import { createProceduralTextures } from '../game/textures';
import type {
  CameraMode,
  CarId,
  CharacterId,
  GameMode,
  GamePhase,
  HudSnapshot,
  LobbyState,
  MapId,
  PlayerHudInfo,
  RacerRuntime,
  RaceStandingSummary,
  RemotePlayerSnapshot,
  VehicleInput,
  VehicleState,
  WeatherPreset,
  WeaponId,
} from '../game/types';
import {
  ObstacleGrid,
  resolveCarToCarCollisions,
  stepVehiclePhysics,
} from '../game/vehiclePhysics';
import { createInitialWeatherState, stepWeatherState } from '../game/weather';
import { createWeatherAndParticleRig } from '../game/weatherAndParticles';
import { createWorldVisualRig, type WorldVisualRig } from '../game/worldBuilder';

export interface DrivingControllerHandle {
  resetCar: () => void;
  resetRace: () => void;
  teleportToZone: (x: number, z: number, yaw: number) => void;
  setWeatherPreset: (preset: WeatherPreset) => void;
  cycleWeather: () => void;
  setCameraMode: (mode: CameraMode) => void;
  cycleCameraMode: () => void;
  toggleHeadlights: () => void;
  setPaintColor: (hex: number) => void;
  toggleMute: () => boolean;
  initAudio: () => void;
  toggleOnFoot: () => void;
  triggerAttack: () => void;
  useEnergyDrink: () => void;
}

interface DrivingCanvasProps {
  phase: GamePhase;
  mode: GameMode;
  mapId: MapId;
  carIdP1: CarId;
  carIdP2: CarId;
  totalCoins: number;
  lobbyState: LobbyState | null;
  localClientId: string | null;
  remoteSnapshots: RemotePlayerSnapshot[];
  equippedCharacter: CharacterId;
  equippedWeapon: WeaponId;
  onHudUpdate: (hud: HudSnapshot) => void;
  onPhaseHotkey: (action: 'pause' | 'start' | 'mute') => void;
  onBeaconFound: (name: string) => void;
  onCoinsEarned: (amount: number, label: string) => void;
  onRaceFinished: (standings: RaceStandingSummary[]) => void;
  onSendSnapshot?: (snapshot: RemotePlayerSnapshot) => void;
  onReactionEvent?: (evt: HitReactionEvent) => void;
  onActionBanner?: (msg: string) => void;
}

const CAMERA_ORDER: CameraMode[] = ['chase', 'drift', 'hood'];
const WEATHER_ORDER: WeatherPreset[] = ['clear', 'overcast', 'rain', 'blizzard', 'night', 'auto'];

const _camDesired = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _sunPos = new THREE.Vector3();

function zeroInput(out: VehicleInput) {
  out.throttle = 0;
  out.brake = 0;
  out.steer = 0;
  out.handbrake = false;
  out.boost = false;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export const DrivingCanvas = forwardRef<DrivingControllerHandle, DrivingCanvasProps>(
  function DrivingCanvas(
    {
      phase,
      mode,
      mapId,
      carIdP1,
      carIdP2,
      totalCoins,
      lobbyState,
      localClientId,
      remoteSnapshots,
      equippedCharacter,
      equippedWeapon,
      onHudUpdate,
      onPhaseHotkey,
      onBeaconFound,
      onCoinsEarned,
      onRaceFinished,
      onSendSnapshot,
      onReactionEvent,
      onActionBanner,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const phaseRef = useRef<GamePhase>(phase);
    const totalCoinsRef = useRef<number>(totalCoins);
    const lobbyRef = useRef<LobbyState | null>(lobbyState);
    const localClientIdRef = useRef<string | null>(localClientId);
    const remoteSnapshotsRef = useRef<RemotePlayerSnapshot[]>(remoteSnapshots);
    const equippedCharacterRef = useRef<CharacterId>(equippedCharacter);
    const equippedWeaponRef = useRef<WeaponId>(equippedWeapon);
    const carSpecsRef = useRef({
      p1: getCarSpec(carIdP1),
      p2: getCarSpec(carIdP2),
    });
    const callbacksRef = useRef({
      onHudUpdate,
      onPhaseHotkey,
      onBeaconFound,
      onCoinsEarned,
      onRaceFinished,
      onSendSnapshot,
      onReactionEvent,
      onActionBanner,
    });

    phaseRef.current = phase;
    totalCoinsRef.current = totalCoins;
    lobbyRef.current = lobbyState;
    localClientIdRef.current = localClientId;
    remoteSnapshotsRef.current = remoteSnapshots;
    equippedCharacterRef.current = equippedCharacter;
    equippedWeaponRef.current = equippedWeapon;
    callbacksRef.current = {
      onHudUpdate,
      onPhaseHotkey,
      onBeaconFound,
      onCoinsEarned,
      onRaceFinished,
      onSendSnapshot,
      onReactionEvent,
      onActionBanner,
    };

    const audioRef = useRef<ProceduralAudioEngine | null>(null);
    const worldRigRef = useRef<WorldVisualRig | null>(null);
    const carRigsRef = useRef<CarVisualRig[]>([]);
    const freestyleTrafficRef = useRef<FreestyleTrafficController | null>(null);
    const freestyleActionRef = useRef<FreestyleActionController | null>(null);
    const livingWorldRef = useRef<LivingWorldController | null>(null);
    const snapRaceCamerasRef = useRef<(() => void) | null>(null);
    const worldData = useMemo(() => getMapWorldData(mapId), [mapId]);

    const simStateRef = useRef<{
      racers: RacerRuntime[];
      weather: ReturnType<typeof createInitialWeatherState>;
      cameraMode: CameraMode;
      discovered: Set<string>;
      collectedCoins: Set<number>;
      runCoins: number;
      manualHeadlights: boolean | null;
      paintHex: number;
      countdownSeconds: number;
      raceElapsed: number;
      raceFinishedSent: boolean;
    } | null>(null);

    if (!simStateRef.current) {
      simStateRef.current = {
        racers: createRaceGrid(mode, mapId, lobbyState, localClientId),
        weather: createInitialWeatherState(
          lobbyState?.weatherPreset ?? worldData.config.defaultWeather,
        ),
        cameraMode: 'chase' as CameraMode,
        discovered: new Set<string>(),
        collectedCoins: new Set<number>(),
        runCoins: 0,
        manualHeadlights: null as boolean | null,
        paintHex: getCarSpec(carIdP1).paintHex,
        countdownSeconds: mode === 'freestyle' ? 0 : 2.4,
        raceElapsed: 0,
        raceFinishedSent: false,
      };
    }

    const sim = simStateRef.current;

    // Live-update character and weapon when changed in Garage
    useEffect(() => {
      freestyleActionRef.current?.setCharacterAndWeapon(equippedCharacter, equippedWeapon);
    }, [equippedCharacter, equippedWeapon]);

    // Live-update car specs when user equips a car in the Garage
    useEffect(() => {
      const simCur = simStateRef.current;
      if (!simCur) return;
      const s1 = getCarSpec(carIdP1);
      const s2 = getCarSpec(carIdP2);
      carSpecsRef.current = { p1: s1, p2: s2 };
      simCur.paintHex = s1.paintHex;
      if (simCur.racers[0]) {
        if (mode !== 'online_2v2') {
          simCur.racers[0].profile.paintHex = s1.paintHex;
        }
        simCur.racers[0].profile.stripeHex = s1.stripeHex;
        simCur.racers[0].profile.carId = s1.id;
      }
      carRigsRef.current[0]?.applyCarSpec(s1);
      if (mode === 'online_2v2' && simCur.racers[0]) {
        const tc = simCur.racers[0].profile.team === 'blue' ? 0x0284c7 : 0xe11d48;
        carRigsRef.current[0]?.setPaintColor(tc);
        carRigsRef.current[0]?.setTeamBadge(simCur.racers[0].profile.team);
      }
      if (mode === 'race2p' && simCur.racers[1] && carRigsRef.current[1]) {
        simCur.racers[1].profile.paintHex = s2.paintHex;
        simCur.racers[1].profile.stripeHex = s2.stripeHex;
        carRigsRef.current[1].applyCarSpec(s2);
      }
    }, [carIdP1, carIdP2, mode]);

    const handleActionEventInternal = (evt: FreestyleActionEvent) => {
      if (evt.coinsAwarded > 0 && simStateRef.current) {
        simStateRef.current.runCoins += evt.coinsAwarded;
        audioRef.current?.playCoinChime();
        callbacksRef.current.onCoinsEarned(
          evt.coinsAwarded,
          `+${evt.coinsAwarded} COINS · ${evt.title}`,
        );
      }
      callbacksRef.current.onActionBanner?.(evt.title);
    };

    const resetRaceState = () => {
      const simCur = simStateRef.current;
      if (!simCur) return;
      const freshRacers = createRaceGrid(
        mode,
        mapId,
        lobbyRef.current,
        localClientIdRef.current,
      );
      const s1 = carSpecsRef.current.p1;
      const s2 = carSpecsRef.current.p2;
      if (mode !== 'online_2v2') {
        freshRacers[0].profile.paintHex = simCur.paintHex;
      }
      freshRacers[0].profile.stripeHex = s1.stripeHex;
      freshRacers[0].profile.carId = s1.id;

      if (carRigsRef.current[0]) {
        carRigsRef.current[0].applyCarSpec(s1);
        carRigsRef.current[0].setPaintColor(freshRacers[0].profile.paintHex);
        carRigsRef.current[0].setTeamBadge(freshRacers[0].profile.team);
      }
      if (mode === 'race2p' && freshRacers[1]) {
        freshRacers[1].profile.paintHex = s2.paintHex;
        freshRacers[1].profile.stripeHex = s2.stripeHex;
        carRigsRef.current[1]?.applyCarSpec(s2);
      }
      simCur.racers = freshRacers;
      simCur.collectedCoins.clear();
      simCur.runCoins = 0;
      worldRigRef.current?.resetCoins();
      freestyleTrafficRef.current?.reset();
      if (freestyleActionRef.current) {
        freestyleActionRef.current.isOnFoot = false;
        freestyleActionRef.current.wantedLevel = 0;
        freestyleActionRef.current.health = freestyleActionRef.current.maxHealth;
        freestyleActionRef.current.energy = 100;
        freestyleActionRef.current.isDead = false;
        freestyleActionRef.current.dismissAllPolice();
      }
      simCur.countdownSeconds = mode === 'freestyle' ? 0 : 2.4;
      simCur.raceElapsed = 0;
      simCur.raceFinishedSent = false;
      snapRaceCamerasRef.current?.();
    };

    useImperativeHandle(ref, () => ({
      resetCar: () => {
        if (mode === 'freestyle') {
          resetRaceState();
        } else {
          const pts = worldData.roadPoints;
          for (const r of sim.racers) {
            if (!r.profile.isHuman) continue;
            let bestIdx = 0;
            let bestD = Infinity;
            for (let i = 0; i < pts.length; i++) {
              const d = Math.hypot(pts[i].x - r.vehicle.x, pts[i].z - r.vehicle.z);
              if (d < bestD) {
                bestD = d;
                bestIdx = i;
              }
            }
            const pt = pts[bestIdx];
            const nextPt = pts[(bestIdx + 1) % pts.length];
            const yaw = Math.atan2(nextPt.x - pt.x, nextPt.z - pt.z);
            const side = r.profile.playerIndex === 1 ? 2.4 : -2.4;
            const nx = -Math.cos(yaw);
            const nz = Math.sin(yaw);
            r.vehicle.x = pt.x + nx * side;
            r.vehicle.z = pt.z + nz * side;
            r.vehicle.y = getDrivableSurfaceHeight(r.vehicle.x, r.vehicle.z, r.vehicle.y, mapId).height + 0.82;
            r.vehicle.vx = 0;
            r.vehicle.vy = 0;
            r.vehicle.vz = 0;
            r.vehicle.speed = 0;
            r.vehicle.yaw = yaw;
          }
        }
      },
      resetRace: () => {
        resetRaceState();
      },
      teleportToZone: (x: number, z: number, yaw: number) => {
        const r = sim.racers[0];
        if (!r) return;
        const groundY = getDrivableSurfaceHeight(x, z, 20, mapId).height;
        r.vehicle.x = x;
        r.vehicle.z = z;
        r.vehicle.y = groundY + 0.82;
        r.vehicle.vx = 0;
        r.vehicle.vy = 0;
        r.vehicle.vz = 0;
        r.vehicle.speed = 0;
        r.vehicle.speedKmh = 0;
        r.vehicle.yaw = yaw;
        r.vehicle.pitch = 0;
        r.vehicle.roll = 0;
        if (freestyleActionRef.current?.isOnFoot) {
          freestyleActionRef.current.charX = x - Math.cos(yaw) * 2.8;
          freestyleActionRef.current.charZ = z + Math.sin(yaw) * 2.8;
          freestyleActionRef.current.charY = groundY;
          freestyleActionRef.current.charYaw = yaw;
        }
        snapRaceCamerasRef.current?.();
      },
      setWeatherPreset: (preset: WeatherPreset) => {
        sim.weather.preset = preset;
      },
      cycleWeather: () => {
        const cur = sim.weather.preset;
        const idx = WEATHER_ORDER.indexOf(cur);
        sim.weather.preset = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
      },
      setCameraMode: (cMode: CameraMode) => {
        sim.cameraMode = cMode;
      },
      cycleCameraMode: () => {
        const cur = sim.cameraMode;
        const idx = CAMERA_ORDER.indexOf(cur);
        sim.cameraMode = CAMERA_ORDER[(idx + 1) % CAMERA_ORDER.length];
      },
      toggleHeadlights: () => {
        const cur =
          sim.manualHeadlights !== null
            ? sim.manualHeadlights
            : sim.racers[0].vehicle.headlightsOn;
        sim.manualHeadlights = !cur;
      },
      setPaintColor: (hex: number) => {
        sim.paintHex = hex;
        if (sim.racers[0]) {
          sim.racers[0].profile.paintHex = hex;
        }
        carRigsRef.current[0]?.setPaintColor(hex);
      },
      toggleMute: () => {
        if (!audioRef.current) return false;
        return audioRef.current.toggleMute();
      },
      initAudio: () => {
        audioRef.current?.initOnGesture();
      },
      toggleOnFoot: () => {
        const fa = freestyleActionRef.current;
        const r = sim.racers[0];
        if (!fa || !r) return;
        const nowOnFoot = fa.toggleOnFoot(r.vehicle);
        callbacksRef.current.onActionBanner?.(
          nowOnFoot ? 'ON FOOT — WASD MOVE · SPACE/F ATTACK' : 'ENTERED VEHICLE',
        );
      },
      triggerAttack: () => {
        const fa = freestyleActionRef.current;
        if (!fa) return;
        if (!fa.isOnFoot && sim.racers[0]) {
          fa.toggleOnFoot(sim.racers[0].vehicle);
        }
        fa.triggerWeaponAttack(
          livingWorldRef.current,
          (evt) => {
            audioRef.current?.playReactionSound(evt.sound);
            if (evt.coinsAwarded && evt.coinsAwarded > 0 && simStateRef.current) {
              simStateRef.current.runCoins += evt.coinsAwarded;
              audioRef.current?.playCoinChime();
              callbacksRef.current.onCoinsEarned(
                evt.coinsAwarded,
                `+${evt.coinsAwarded} COINS · ${evt.label.toUpperCase()}`,
              );
            }
            callbacksRef.current.onReactionEvent?.(evt);
          },
          handleActionEventInternal,
        );
      },
      useEnergyDrink: () => {
        const fa = freestyleActionRef.current;
        if (!fa) return;
        if (fa.useEnergyDrink()) {
          audioRef.current?.playBeaconChime();
          callbacksRef.current.onActionBanner?.('ENERGY DRINK USED — 100% FULL HP & ENERGY!');
        }
      },
    }));

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = (() => {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      const maxDpr = mode === 'race2p' ? 1.2 : 1.35;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, maxDpr));
      const initW = container.clientWidth || window.innerWidth;
      const initH = container.clientHeight || window.innerHeight;
      renderer.setSize(initW, initH);
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0xb8d4ec, 0.00085);

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;
      pmremGenerator.dispose();

      // Balanced far clip (1350m) keeps skydome (960m) & horizon landmarks visible while cutting overdraw
      const cameraP1 = new THREE.PerspectiveCamera(66, initW / initH, 0.25, 1350);
      const cameraP2 = new THREE.PerspectiveCamera(66, initW / initH, 0.25, 1350);

      const hemiLight = new THREE.HemisphereLight(0x87c2f8, 0x4e5638, 0.88);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight(0xffe8c2, 2.45);
      sunLight.castShadow = !isSoftwareGl;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.radius = 2.0;
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 175;
      const d = 62;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0004;
      sunLight.shadow.normalBias = 0.03;
      scene.add(sunLight);
      scene.add(sunLight.target);

      const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
      scene.add(rimLight);
      scene.add(rimLight.target);

      const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());
      const activeWorld = getMapWorldData(mapId);
      const obstacleGrid = new ObstacleGrid(activeWorld.obstacles);

      const worldRig = createWorldVisualRig(mapId, textures, isSoftwareGl);
      scene.add(worldRig.group);
      worldRigRef.current = worldRig;

      const livingWorld = new LivingWorldController(mapId, mode);
      scene.add(livingWorld.group);
      livingWorldRef.current = livingWorld;

      const freestyleAction =
        mode === 'freestyle'
          ? new FreestyleActionController(
              mapId,
              equippedCharacterRef.current,
              equippedWeaponRef.current,
            )
          : null;
      if (freestyleAction) {
        scene.add(freestyleAction.group);
      }
      freestyleActionRef.current = freestyleAction;

      const freestyleTraffic =
        mode === 'freestyle'
          ? new FreestyleTrafficController(mapId)
          : null;
      freestyleTrafficRef.current = freestyleTraffic;

      const trafficRigs: CarVisualRig[] = [];
      const lastTrafficVariants: number[] = [];
      if (freestyleTraffic) {
        for (let si = 0; si < freestyleTraffic.slots.length; si++) {
          const vSpec = FREESTYLE_TRAFFIC_VARIANTS[si % FREESTYLE_TRAFFIC_VARIANTS.length];
          const rig = createCarVisualRig(
            textures,
            isSoftwareGl,
            vSpec.paintHex,
            vSpec.stripeHex,
            vSpec.numberLabel,
            false,
            vSpec.bodyStyle,
            vSpec.rimHex,
          );
          rig.root.visible = false;
          scene.add(rig.root);
          trafficRigs.push(rig);
          lastTrafficVariants.push(-1);
        }
      }

      const carRigs: CarVisualRig[] = [];
      const simInit = simStateRef.current!;
      const initialRacers = simInit.racers;
      for (let i = 0; i < initialRacers.length; i++) {
        const p = initialRacers[i].profile;
        const spec =
          p.playerIndex === 0
            ? carSpecsRef.current.p1
            : p.playerIndex === 1
              ? carSpecsRef.current.p2
              : p.carId
                ? getCarSpec(p.carId)
                : null;
        const paint =
          mode === 'online_2v2'
            ? p.paintHex
            : i === 0
              ? simInit.paintHex
              : spec
                ? spec.paintHex
                : p.paintHex;
        const stripe = spec ? spec.stripeHex : p.stripeHex;
        const rig = createCarVisualRig(
          textures,
          isSoftwareGl,
          paint,
          stripe,
          p.numberLabel,
          p.isHuman,
          spec ? spec.bodyStyle : 'gt',
          spec ? spec.rimHex : 0xd9bc7e,
        );
        if (spec) rig.applyCarSpec(spec);
        rig.setTeamBadge(p.team);
        scene.add(rig.root);
        carRigs.push(rig);
      }
      carRigsRef.current = carRigs;

      const weatherRig = createWeatherAndParticleRig(scene, textures);
      const audioEngine = new ProceduralAudioEngine();
      audioRef.current = audioEngine;

      if (!isSoftwareGl) {
        renderer.compile(scene, cameraP1);
      }

      // Input handling
      const keysDown = new Set<string>();
      const clearInputs = () => keysDown.clear();

      const handleKeyDown = (e: KeyboardEvent) => {
        const code = e.code;
        if (
          phaseRef.current === 'playing' &&
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'CapsLock'].includes(code)
        ) {
          e.preventDefault();
        }
        if (e.repeat) return;
        keysDown.add(code);

        if (phaseRef.current === 'title') {
          if (code === 'Enter' || code === 'Space') {
            e.preventDefault();
            audioEngine.initOnGesture();
            callbacksRef.current.onPhaseHotkey('start');
          }
          return;
        }

        if (code === 'Escape' || code === 'KeyP') {
          e.preventDefault();
          callbacksRef.current.onPhaseHotkey('pause');
          return;
        }

        if (phaseRef.current !== 'playing') return;

        audioEngine.initOnGesture();

        if (code === 'KeyC') {
          const curSim = simStateRef.current!;
          const cur = curSim.cameraMode;
          const idx = CAMERA_ORDER.indexOf(cur);
          curSim.cameraMode = CAMERA_ORDER[(idx + 1) % CAMERA_ORDER.length];
        } else if (code === 'KeyV') {
          const curSim = simStateRef.current!;
          const cur = curSim.weather.preset;
          const idx = WEATHER_ORDER.indexOf(cur);
          curSim.weather.preset = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
        } else if (code === 'KeyL') {
          const curSim = simStateRef.current!;
          const cur =
            curSim.manualHeadlights !== null
              ? curSim.manualHeadlights
              : curSim.racers[0].vehicle.headlightsOn;
          curSim.manualHeadlights = !cur;
        } else if (code === 'KeyM') {
          audioEngine.toggleMute();
          callbacksRef.current.onPhaseHotkey('mute');
        } else if (code === 'KeyE' && freestyleAction) {
          const curSim = simStateRef.current!;
          if (curSim.racers[0]) {
            const nowOnFoot = freestyleAction.toggleOnFoot(curSim.racers[0].vehicle);
            callbacksRef.current.onActionBanner?.(
              nowOnFoot ? 'ON FOOT — WASD MOVE · SPACE/F ATTACK' : 'ENTERED VEHICLE',
            );
          }
        } else if (code === 'KeyF' && freestyleAction) {
          if (!freestyleAction.isOnFoot && simStateRef.current?.racers[0]) {
            freestyleAction.toggleOnFoot(simStateRef.current.racers[0].vehicle);
          }
          freestyleAction.triggerWeaponAttack(
            livingWorld,
            (evt) => {
              audioEngine.playReactionSound(evt.sound);
              if (evt.coinsAwarded && evt.coinsAwarded > 0 && simStateRef.current) {
                simStateRef.current.runCoins += evt.coinsAwarded;
                audioEngine.playCoinChime();
                callbacksRef.current.onCoinsEarned(
                  evt.coinsAwarded,
                  `+${evt.coinsAwarded} COINS · ${evt.label.toUpperCase()}`,
                );
              }
              callbacksRef.current.onReactionEvent?.(evt);
            },
            handleActionEventInternal,
          );
        } else if (code === 'KeyG' && freestyleAction) {
          if (freestyleAction.useEnergyDrink()) {
            audioEngine.playBeaconChime();
            callbacksRef.current.onActionBanner?.('ENERGY DRINK USED — 100% FULL HP & ENERGY!');
          }
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        keysDown.delete(e.code);
      };

      const handleVisibility = () => {
        if (document.hidden) clearInputs();
      };

      // Manual aiming pointer tracking for On-Foot mode
      const pointerNdc = new THREE.Vector2();
      const aimRaycaster = new THREE.Raycaster();
      const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const aimHitPoint = new THREE.Vector3();
      let aimWorldX: number | null = null;
      let aimWorldZ: number | null = null;
      let pointerMovedRecently = 0;

      const updateAimFromPointer = (clientX: number, clientY: number) => {
        if (!freestyleAction || !freestyleAction.isOnFoot || phaseRef.current !== 'playing') return;
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        aimPlane.constant = -(freestyleAction.charY + 1.15);
        aimRaycaster.setFromCamera(pointerNdc, cameraP1);
        if (aimRaycaster.ray.intersectPlane(aimPlane, aimHitPoint)) {
          aimWorldX = aimHitPoint.x;
          aimWorldZ = aimHitPoint.z;
          pointerMovedRecently = 0.25;
          freestyleAction.setManualAimTarget(aimWorldX, aimWorldZ);
        }
      };

      const handlePointerMove = (e: PointerEvent) => {
        updateAimFromPointer(e.clientX, e.clientY);
      };

      const handlePointerDown = (e: PointerEvent) => {
        if (e.button !== 0 || !freestyleAction || !freestyleAction.isOnFoot || phaseRef.current !== 'playing') {
          return;
        }
        audioEngine.initOnGesture();
        updateAimFromPointer(e.clientX, e.clientY);
        freestyleAction.triggerWeaponAttack(
          livingWorld,
          (evt) => {
            audioEngine.playReactionSound(evt.sound);
            if (evt.coinsAwarded && evt.coinsAwarded > 0 && simStateRef.current) {
              simStateRef.current.runCoins += evt.coinsAwarded;
              audioEngine.playCoinChime();
              callbacksRef.current.onCoinsEarned(
                evt.coinsAwarded,
                `+${evt.coinsAwarded} COINS · ${evt.label.toUpperCase()}`,
              );
            }
            callbacksRef.current.onReactionEvent?.(evt);
          },
          handleActionEventInternal,
        );
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', clearInputs);
      document.addEventListener('visibilitychange', handleVisibility);
      renderer.domElement.addEventListener('pointermove', handlePointerMove);
      renderer.domElement.addEventListener('pointerdown', handlePointerDown);

      let viewW = initW;
      let viewH = initH;
      const updateSize = () => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        if (w <= 0 || h <= 0) return;
        viewW = w;
        viewH = h;
        renderer.setSize(w, h);
      };
      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(container);

      let frameId = 0;
      let disposed = false;
      let lastTime = performance.now();
      let elapsed = 0;
      let lastHudPush = 0;
      let lastNetPush = 0;

      const camLookP1 = new THREE.Vector3();
      const camLookP2 = new THREE.Vector3();

      const snapChaseCameras = () => {
        const racersList = simStateRef.current!.racers;
        const isSplit = mode === 'race2p' && racersList.length >= 2;
        const snapHeight = isSplit ? 4.2 : 2.85;
        const snapDist = isSplit ? 8.3 : 7.6;
        const snapLookAhead = isSplit ? 8.5 : 4.5;
        const snapLookY = isSplit ? 0.55 : 1.05;
        const snapFov = isSplit ? 76 : 64;

        if (isSplit) {
          const halfW = Math.floor(viewW / 2);
          cameraP1.aspect = halfW / Math.max(1, viewH);
          cameraP2.aspect = (viewW - halfW) / Math.max(1, viewH);
        }

        const v1 = racersList[0].vehicle;
        const s1 = Math.sin(v1.yaw);
        const c1 = Math.cos(v1.yaw);
        cameraP1.position.set(v1.x - s1 * snapDist, v1.y + snapHeight, v1.z - c1 * snapDist);
        camLookP1.set(v1.x + s1 * snapLookAhead, v1.y + snapLookY, v1.z + c1 * snapLookAhead);
        cameraP1.fov = snapFov;
        cameraP1.updateProjectionMatrix();
        cameraP1.lookAt(camLookP1);

        if (racersList[1]) {
          const v2 = racersList[1].vehicle;
          const s2 = Math.sin(v2.yaw);
          const c2 = Math.cos(v2.yaw);
          cameraP2.position.set(v2.x - s2 * snapDist, v2.y + snapHeight, v2.z - c2 * snapDist);
          camLookP2.set(v2.x + s2 * snapLookAhead, v2.y + snapLookY, v2.z + c2 * snapLookAhead);
          cameraP2.fov = snapFov;
          cameraP2.updateProjectionMatrix();
          cameraP2.lookAt(camLookP2);
        }
      };
      snapRaceCamerasRef.current = snapChaseCameras;

      // Snap initial camera poses cleanly
      {
        const v1 = simStateRef.current!.racers[0].vehicle;
        const s1 = Math.sin(v1.yaw);
        const c1 = Math.cos(v1.yaw);
        if (phaseRef.current === 'title') {
          const orbitAngle = v1.yaw - 0.95;
          cameraP1.position.set(v1.x + Math.sin(orbitAngle) * 8.4, v1.y + 2.6, v1.z + Math.cos(orbitAngle) * 8.4);
          camLookP1.set(v1.x - c1 * 1.9, v1.y + 0.7, v1.z + s1 * 1.9);
          cameraP1.fov = 52;
          cameraP1.updateProjectionMatrix();
          cameraP1.lookAt(camLookP1);
        } else {
          snapChaseCameras();
        }
      }

      const racerInputs: VehicleInput[] = initialRacers.map(() => ({
        throttle: 0,
        brake: 0,
        steer: 0,
        handbrake: false,
        boost: false,
      }));
      const allVehiclesScratch: VehicleState[] = [];

      function updateFollowCamera(
        cam: THREE.PerspectiveCamera,
        lookVec: THREE.Vector3,
        v: VehicleState,
        cMode: CameraMode,
        dt: number,
      ) {
        const sinY = Math.sin(v.yaw);
        const cosY = Math.cos(v.yaw);
        const isSplitView = cam.aspect < 1.15;

        if (cMode === 'hood') {
          _camDesired.set(v.x + sinY * 0.55, v.y + (isSplitView ? 1.55 : 1.38), v.z + cosY * 0.55);
          _camLookTarget.set(v.x + sinY * 18, v.y + (isSplitView ? 0.65 : 0.85) - v.pitch * 12, v.z + cosY * 18);
          cam.position.lerp(_camDesired, 1 - Math.exp(-26 * dt));
          lookVec.lerp(_camLookTarget, 1 - Math.exp(-24 * dt));
        } else {
          const isDriftCam = cMode === 'drift';
          const speedFrac = clamp(Math.abs(v.speed) / 48, 0, 1);
          const followDist = isSplitView
            ? isDriftCam
              ? 8.8 + speedFrac * 1.4
              : 8.3 + speedFrac * 1.6
            : isDriftCam
              ? 8.2 + speedFrac * 1.4
              : 7.6 + speedFrac * 1.8;
          const followHeight = isSplitView
            ? isDriftCam
              ? 4.4
              : 4.2
            : isDriftCam
              ? 3.1
              : 2.85;

          let camYaw = v.yaw;
          if (isDriftCam && Math.hypot(v.vx, v.vz) > 5) {
            const velYaw = Math.atan2(v.vx, v.vz);
            let diff = velYaw - v.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            camYaw = v.yaw + clamp(diff, -0.55, 0.55) * 0.55;
          }

          const cSin = Math.sin(camYaw);
          const cCos = Math.cos(camYaw);
          _camDesired.set(
            v.x - cSin * followDist,
            v.y + followHeight,
            v.z - cCos * followDist,
          );
          const lookAhead = isSplitView ? 8.5 : 4.5;
          const lookY = isSplitView ? 0.55 : 1.05;
          _camLookTarget.set(v.x + sinY * lookAhead, v.y + lookY, v.z + cosY * lookAhead);

          cam.position.lerp(_camDesired, 1 - Math.exp(-14.5 * dt));
          lookVec.lerp(_camLookTarget, 1 - Math.exp(-18.5 * dt));
        }

        const camGround = getDrivableSurfaceHeight(cam.position.x, cam.position.z, v.y + 4, mapId).height;
        if (cam.position.y < camGround + 1.15) {
          cam.position.y = camGround + 1.15;
        }

        if (v.isBoosting && v.speedKmh > 65) {
          const shake = Math.min(0.035, (v.speedKmh - 65) * 0.00028);
          cam.position.x += (Math.random() - 0.5) * shake;
          cam.position.y += (Math.random() - 0.5) * shake * 0.7;
        }

        const baseFov = isSplitView ? 76 : 64;
        const speedFov = isSplitView ? 10 : 14;
        const targetFov = baseFov + clamp(v.speedKmh / 220, 0, 1) * speedFov + (v.isBoosting ? 5 : 0);
        if (Math.abs(cam.fov - targetFov) > 0.05) {
          cam.fov = lerp(cam.fov, targetFov, 1 - Math.exp(-8 * dt));
          cam.updateProjectionMatrix();
        }
        cam.lookAt(lookVec);
      }

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 2);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 2);
          }
        };
        frameId = window.setTimeout(poll, 2);
      }

      const tick = () => {
        if (disposed) return;
        const now = performance.now();
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
        elapsed += dt;

        const simCur = simStateRef.current!;
        const curPhase = phaseRef.current;
        const racers = simCur.racers;

        if (curPhase !== 'paused') {
          stepWeatherState(simCur.weather, dt, Math.random());
        }

        // Countdown & Race Physics
        if (curPhase === 'playing') {
          const isRace = mode !== 'freestyle';
          const countdownDt = Math.min(Math.max(rawDt, 0.001), 0.4);
          if (isRace && simCur.countdownSeconds > 0) {
            simCur.countdownSeconds = Math.max(0, simCur.countdownSeconds - countdownDt);
            const lit = clamp(Math.ceil((2.4 - simCur.countdownSeconds) * 2.1), 1, 5);
            worldRig.setCountdownLights('red', lit);
            for (let i = 0; i < racerInputs.length; i++) zeroInput(racerInputs[i]);
          } else {
            if (isRace) {
              simCur.raceElapsed += dt;
              if (simCur.raceElapsed < 1.8) {
                worldRig.setCountdownLights('go');
              } else {
                worldRig.setCountdownLights('off');
              }
            } else {
              worldRig.setCountdownLights('off');
            }

            // Compute inputs for each local/AI racer
            for (let i = 0; i < racers.length; i++) {
              const r = racers[i];
              const inp = racerInputs[i];
              if (r.profile.isRemote) {
                zeroInput(inp);
                continue;
              }
              if (r.profile.playerIndex === 0) {
                if (freestyleAction?.isOnFoot) {
                  // Parked vehicle while player character is walking on foot
                  zeroInput(inp);
                  inp.handbrake = true;
                } else {
                  const allowArrowsAlso = mode !== 'race2p';
                  const up = keysDown.has('KeyW') || (allowArrowsAlso && keysDown.has('ArrowUp'));
                  const down = keysDown.has('KeyS') || (allowArrowsAlso && keysDown.has('ArrowDown'));
                  const left = keysDown.has('KeyA') || (allowArrowsAlso && keysDown.has('ArrowLeft'));
                  const right = keysDown.has('KeyD') || (allowArrowsAlso && keysDown.has('ArrowRight'));
                  inp.throttle = up ? 1 : 0;
                  inp.brake = down ? 1 : 0;
                  inp.steer = (left ? 1 : 0) - (right ? 1 : 0);
                  inp.handbrake = keysDown.has('Space');
                  // Player 1 Nitro control is CapsLock (plus Mystery Box SUPER SPEED power)
                  inp.boost =
                    keysDown.has('CapsLock') ||
                    freestyleAction?.activePower === 'SUPER SPEED';
                }
              } else if (r.profile.playerIndex === 1) {
                inp.throttle = keysDown.has('ArrowUp') ? 1 : 0;
                inp.brake = keysDown.has('ArrowDown') ? 1 : 0;
                inp.steer = (keysDown.has('ArrowLeft') ? 1 : 0) - (keysDown.has('ArrowRight') ? 1 : 0);
                inp.handbrake =
                  keysDown.has('Enter') ||
                  keysDown.has('ControlRight') ||
                  keysDown.has('Slash');
                // Player 2 Nitro control is Shift
                inp.boost = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');
              } else {
                computeAiVehicleInput(r, racers, activeWorld, inp);
              }
            }

            // Step physics for local & AI racers, or sync remote snapshots
            allVehiclesScratch.length = 0;
            const snaps = remoteSnapshotsRef.current;
            const snapAlpha = 1 - Math.exp(-16 * dt);

            for (let i = 0; i < racers.length; i++) {
              const r = racers[i];
              if (r.profile.isRemote) {
                const match = snaps.find((s) => s.clientId === r.profile.id);
                if (match) {
                  r.vehicle.x = lerp(r.vehicle.x, match.x, snapAlpha);
                  r.vehicle.y = lerp(r.vehicle.y, match.y, snapAlpha);
                  r.vehicle.z = lerp(r.vehicle.z, match.z, snapAlpha);
                  r.vehicle.vx = match.vx;
                  r.vehicle.vy = match.vy;
                  r.vehicle.vz = match.vz;
                  r.vehicle.yaw = lerpAngle(r.vehicle.yaw, match.yaw, snapAlpha);
                  r.vehicle.pitch = lerp(r.vehicle.pitch, match.pitch, snapAlpha);
                  r.vehicle.roll = lerp(r.vehicle.roll, match.roll, snapAlpha);
                  r.vehicle.steerAngle = match.steerAngle;
                  r.vehicle.speedKmh = match.speedKmh;
                  r.vehicle.speed = match.speedKmh / 3.6;
                  r.vehicle.isBoosting = match.isBoosting;
                  r.lap = match.lap;
                  r.finished = match.finished;
                  r.finishTime = match.finishTime;
                  r.progressScore = match.progressScore;
                  for (let w = 0; w < 4; w++) {
                    r.vehicle.wheels[w].spinAngle += (r.vehicle.speed * dt) / 0.72;
                    if (w < 2) r.vehicle.wheels[w].steerAngle = match.steerAngle;
                  }
                }
                allVehiclesScratch.push(r.vehicle);
                continue;
              }

              const pIdx = r.profile.playerIndex;
              const spec =
                pIdx === 0
                  ? carSpecsRef.current.p1
                  : pIdx === 1
                    ? carSpecsRef.current.p2
                    : r.profile.carId
                      ? getCarSpec(r.profile.carId)
                      : undefined;
              stepVehiclePhysics(
                r.vehicle,
                racerInputs[i],
                obstacleGrid,
                simCur.weather,
                dt,
                mapId,
                spec,
              );
              allVehiclesScratch.push(r.vehicle);
            }

            if (freestyleTraffic && racers[0]) {
              freestyleTraffic.update(dt, racers[0].vehicle, activeWorld);
              for (let si = 0; si < freestyleTraffic.slots.length; si++) {
                const slot = freestyleTraffic.slots[si];
                if (slot.active) {
                  allVehiclesScratch.push(slot.vehicle);
                }
              }
            }

            resolveCarToCarCollisions(allVehiclesScratch);

            // Step Freestyle On-Foot Character, Manual Aiming, Gold Bullets, Police Pursuit, Mystery Boxes & Energy Drinks
            if (freestyleAction && racers[0]) {
              if (pointerMovedRecently > 0) {
                pointerMovedRecently = Math.max(0, pointerMovedRecently - dt);
              }
              const up = keysDown.has('KeyW') || keysDown.has('ArrowUp');
              const down = keysDown.has('KeyS') || keysDown.has('ArrowDown');
              const left = keysDown.has('KeyA') || keysDown.has('ArrowLeft') || keysDown.has('KeyQ');
              const right = keysDown.has('KeyD') || keysDown.has('ArrowRight') || keysDown.has('KeyR');
              const turnVal = (left ? 1 : 0) - (right ? 1 : 0);
              if (turnVal !== 0) {
                aimWorldX = null;
                aimWorldZ = null;
              }
              freestyleAction.update(
                dt,
                elapsed,
                racers[0].vehicle,
                {
                  forward: (up ? 1 : 0) - (down ? 1 : 0),
                  turn: turnVal,
                  sprint: keysDown.has('CapsLock') || keysDown.has('ShiftLeft'),
                  attack: keysDown.has('Space') || keysDown.has('KeyF'),
                  aimWorldX: pointerMovedRecently > 0 ? aimWorldX : null,
                  aimWorldZ: pointerMovedRecently > 0 ? aimWorldZ : null,
                },
                livingWorld,
                (evt) => {
                  audioEngine.playReactionSound(evt.sound);
                  if (evt.coinsAwarded && evt.coinsAwarded > 0) {
                    simCur.runCoins += evt.coinsAwarded;
                    audioEngine.playCoinChime();
                    callbacksRef.current.onCoinsEarned(
                      evt.coinsAwarded,
                      `+${evt.coinsAwarded} COINS · ${evt.label.toUpperCase()}`,
                    );
                  }
                  callbacksRef.current.onReactionEvent?.(evt);
                },
                handleActionEventInternal,
              );
            }

            // Step Humans & 23 Animal Species AI + Reactions
            livingWorld.update(dt, elapsed, allVehiclesScratch, (evt) => {
              audioEngine.playReactionSound(evt.sound);
              if (evt.isKill) {
                freestyleAction?.reportCrime(1);
              }
              if (evt.coinsAwarded && evt.coinsAwarded > 0) {
                simCur.runCoins += evt.coinsAwarded;
                audioEngine.playCoinChime();
                callbacksRef.current.onCoinsEarned(
                  evt.coinsAwarded,
                  `+${evt.coinsAwarded} COINS · ${evt.label.toUpperCase()}`,
                );
              }
              callbacksRef.current.onReactionEvent?.(evt);
            });

            if (isRace) {
              stepRaceProgress(racers, activeWorld, simCur.raceElapsed);
              const humanRacers = racers.filter((r) => r.profile.isHuman && !r.profile.isRemote);
              if (
                !simCur.raceFinishedSent &&
                humanRacers.length > 0 &&
                humanRacers.every((r) => r.finished)
              ) {
                simCur.raceFinishedSent = true;
                callbacksRef.current.onRaceFinished(buildRaceStandings(racers));
              }
            }

            // Broadcast local player snapshot for Online 2v2 / FFA at ~20Hz
            if (
              (mode === 'online_2v2' || mode === 'online_ffa') &&
              lobbyRef.current &&
              now - lastNetPush > 50
            ) {
              lastNetPush = now;
              const p0 = racers[0];
              if (p0) {
                callbacksRef.current.onSendSnapshot?.({
                  clientId: localClientIdRef.current ?? p0.profile.id,
                  name: p0.profile.name,
                  carId: carSpecsRef.current.p1.id,
                  team: p0.profile.team ?? 'ffa',
                  x: p0.vehicle.x,
                  y: p0.vehicle.y,
                  z: p0.vehicle.z,
                  vx: p0.vehicle.vx,
                  vy: p0.vehicle.vy,
                  vz: p0.vehicle.vz,
                  yaw: p0.vehicle.yaw,
                  pitch: p0.vehicle.pitch,
                  roll: p0.vehicle.roll,
                  steerAngle: p0.vehicle.steerAngle,
                  speedKmh: p0.vehicle.speedKmh,
                  isBoosting: p0.vehicle.isBoosting,
                  lap: p0.lap,
                  place: p0.place,
                  finished: p0.finished,
                  finishTime: p0.finishTime,
                  progressScore: p0.progressScore,
                });
              }
            }

            // Gold Coin Pickup checks for local human cars & on-foot character
            for (let ci = 0; ci < activeWorld.coins.length; ci++) {
              if (simCur.collectedCoins.has(ci)) continue;
              const coin = activeWorld.coins[ci];
              for (const r of racers) {
                if (!r.profile.isHuman || r.profile.isRemote) continue;
                const px = freestyleAction?.isOnFoot ? freestyleAction.charX : r.vehicle.x;
                const py = freestyleAction?.isOnFoot ? freestyleAction.charY + 0.8 : r.vehicle.y;
                const pz = freestyleAction?.isOnFoot ? freestyleAction.charZ : r.vehicle.z;
                const dx = px - coin.x;
                const dz = pz - coin.z;
                const dy = py - coin.y;
                if (dx * dx + dz * dz <= 4.3 * 4.3 && Math.abs(dy) <= 3.6) {
                  simCur.collectedCoins.add(ci);
                  simCur.runCoins += coin.value;
                  worldRig.collectCoin(ci);
                  audioEngine.playCoinChime();
                  callbacksRef.current.onCoinsEarned(coin.value, `+${coin.value} COINS`);
                  break;
                }
              }
            }

            // Exploration Beacons check for local human cars & on-foot character
            for (const b of activeWorld.beacons) {
              if (simCur.discovered.has(b.id)) continue;
              for (const r of racers) {
                if (!r.profile.isHuman || r.profile.isRemote) continue;
                const px = freestyleAction?.isOnFoot ? freestyleAction.charX : r.vehicle.x;
                const pz = freestyleAction?.isOnFoot ? freestyleAction.charZ : r.vehicle.z;
                if (Math.hypot(px - b.x, pz - b.z) <= b.radius) {
                  simCur.discovered.add(b.id);
                  worldRig.markBeaconDiscovered(b.id);
                  audioEngine.playBeaconChime();
                  callbacksRef.current.onBeaconFound(b.name);
                  break;
                }
              }
            }
          }
        } else {
          for (let i = 0; i < racerInputs.length; i++) zeroInput(racerInputs[i]);
          if (curPhase === 'title') worldRig.setCountdownLights('amber');
        }

        // Sync visual car rigs & headlights
        const autoLights = simCur.weather.isDark || simCur.weather.rainIntensity > 0.3;
        allVehiclesScratch.length = 0;
        const p1 = racers[0].vehicle;
        for (let i = 0; i < racers.length; i++) {
          const v = racers[i].vehicle;
          v.headlightsOn = simCur.manualHeadlights !== null ? simCur.manualHeadlights : autoLights;
          const nearPlayer = i === 0 || Math.hypot(v.x - p1.x, v.z - p1.z) < 260;
          const gy = nearPlayer ? getDrivableSurfaceHeight(v.x, v.z, v.y, mapId).height : v.y - 0.82;
          carRigs[i].updateFromState(v, racerInputs[i], gy, elapsed);
          allVehiclesScratch.push(v);
        }
        if (freestyleTraffic) {
          for (let si = 0; si < freestyleTraffic.slots.length; si++) {
            const slot = freestyleTraffic.slots[si];
            const rig = trafficRigs[si];
            if (!rig) continue;
            rig.root.visible = slot.active;
            if (slot.active) {
              if (slot.variantIndex !== lastTrafficVariants[si]) {
                lastTrafficVariants[si] = slot.variantIndex;
                const vSpec = FREESTYLE_TRAFFIC_VARIANTS[slot.variantIndex];
                rig.applyCarSpec(getCarSpec(vSpec.carId));
                rig.setPaintColor(vSpec.paintHex);
              }
              const tv = slot.vehicle;
              tv.headlightsOn = simCur.manualHeadlights !== null ? simCur.manualHeadlights : autoLights;
              rig.updateFromState(tv, slot.input, tv.y - 0.82, elapsed);
              allVehiclesScratch.push(tv);
            }
          }
        }
        if (curPhase !== 'playing' || (mode !== 'freestyle' && simCur.countdownSeconds > 0)) {
          livingWorld.syncVisibility(allVehiclesScratch);
        }

        // Lighting & Fog sync
        const focusX = freestyleAction?.isOnFoot ? freestyleAction.charX : p1.x;
        const focusY = freestyleAction?.isOnFoot ? freestyleAction.charY : p1.y;
        const focusZ = freestyleAction?.isOnFoot ? freestyleAction.charZ : p1.z;
        const sunElev = simCur.weather.sunElevation;
        const sunAzim = simCur.weather.sunAzimuth;
        const sunR = Math.cos(sunElev);
        _sunPos.set(
          Math.sin(sunAzim) * sunR * 120,
          Math.sin(sunElev) * 120,
          Math.cos(sunAzim) * sunR * 120,
        );
        sunLight.position.set(focusX + _sunPos.x, Math.max(18, focusY + _sunPos.y), focusZ + _sunPos.z);
        sunLight.target.position.set(focusX, focusY, focusZ);
        sunLight.target.updateMatrixWorld();

        rimLight.position.set(focusX - _sunPos.x * 0.6, focusY + 32, focusZ - _sunPos.z * 0.6);
        rimLight.target.position.set(focusX, focusY, focusZ);
        rimLight.target.updateMatrixWorld();
        rimLight.intensity = simCur.weather.isDark ? 0.28 : 0.55;

        const flashBoost = simCur.weather.lightningFlash * 3.2;
        sunLight.color.setHex(simCur.weather.sunColorHex);
        sunLight.intensity = simCur.weather.sunIntensity + flashBoost;

        hemiLight.color.setHex(simCur.weather.hemiSkyHex);
        hemiLight.groundColor.setHex(simCur.weather.hemiGroundHex);
        hemiLight.intensity = simCur.weather.hemiIntensity + simCur.weather.lightningFlash * 0.9;

        const fog = scene.fog as THREE.FogExp2;
        fog.color.setHex(simCur.weather.fogColorHex);
        fog.density = simCur.weather.fogDensity * 0.45;

        // Cameras & Viewport Rendering
        const splitScreen = mode === 'race2p' && curPhase !== 'title' && racers.length >= 2;

        if (curPhase === 'title') {
          const orbitAngle = elapsed * 0.18 + p1.yaw - 0.95;
          const dist = 8.4;
          _camDesired.set(
            p1.x + Math.sin(orbitAngle) * dist,
            p1.y + 2.6 + Math.sin(elapsed * 0.4) * 0.18,
            p1.z + Math.cos(orbitAngle) * dist,
          );
          _camLookTarget.set(
            p1.x - Math.cos(p1.yaw) * 1.9,
            p1.y + 0.7,
            p1.z + Math.sin(p1.yaw) * 1.9,
          );
          cameraP1.position.lerp(_camDesired, 1 - Math.exp(-3.5 * dt));
          camLookP1.lerp(_camLookTarget, 1 - Math.exp(-4.5 * dt));
          cameraP1.fov = lerp(cameraP1.fov, 52, 1 - Math.exp(-5 * dt));
          cameraP1.aspect = viewW / Math.max(1, viewH);
          cameraP1.updateProjectionMatrix();
          cameraP1.lookAt(camLookP1);
        } else if (splitScreen) {
          const halfW = Math.floor(viewW / 2);
          const rightW = viewW - halfW;
          const aspL = halfW / Math.max(1, viewH);
          const aspR = rightW / Math.max(1, viewH);
          if (Math.abs(cameraP1.aspect - aspL) > 0.01) {
            cameraP1.aspect = aspL;
            cameraP1.updateProjectionMatrix();
          }
          if (Math.abs(cameraP2.aspect - aspR) > 0.01) {
            cameraP2.aspect = aspR;
            cameraP2.updateProjectionMatrix();
          }
          updateFollowCamera(cameraP1, camLookP1, racers[0].vehicle, simCur.cameraMode, dt);
          updateFollowCamera(cameraP2, camLookP2, racers[1].vehicle, simCur.cameraMode, dt);
        } else if (freestyleAction?.isOnFoot) {
          const asp = viewW / Math.max(1, viewH);
          if (Math.abs(cameraP1.aspect - asp) > 0.01) {
            cameraP1.aspect = asp;
            cameraP1.updateProjectionMatrix();
          }
          const cSin = Math.sin(freestyleAction.charYaw);
          const cCos = Math.cos(freestyleAction.charYaw);
          _camDesired.set(
            freestyleAction.charX - cSin * 5.2,
            freestyleAction.charY + 2.55,
            freestyleAction.charZ - cCos * 5.2,
          );
          _camLookTarget.set(
            freestyleAction.charX + cSin * 4.5,
            freestyleAction.charY + 1.35,
            freestyleAction.charZ + cCos * 4.5,
          );
          cameraP1.position.lerp(_camDesired, 1 - Math.exp(-16 * dt));
          camLookP1.lerp(_camLookTarget, 1 - Math.exp(-20 * dt));
          cameraP1.fov = lerp(cameraP1.fov, 64, 1 - Math.exp(-8 * dt));
          cameraP1.updateProjectionMatrix();
          cameraP1.lookAt(camLookP1);
        } else {
          const asp = viewW / Math.max(1, viewH);
          if (Math.abs(cameraP1.aspect - asp) > 0.01) {
            cameraP1.aspect = asp;
            cameraP1.updateProjectionMatrix();
          }
          updateFollowCamera(cameraP1, camLookP1, p1, simCur.cameraMode, dt);
        }

        worldRig.updateEnvironmentVisuals(simCur.weather, elapsed);
        weatherRig.update(dt, elapsed, cameraP1.position, simCur.weather, allVehiclesScratch);
        audioEngine.update(p1, simCur.weather, curPhase === 'playing');

        if (splitScreen) {
          const halfW = Math.floor(viewW / 2);
          const rightW = viewW - halfW;
          renderer.setScissorTest(true);

          // Left half: Player 1 (WASD)
          renderer.setViewport(0, 0, halfW, viewH);
          renderer.setScissor(0, 0, halfW, viewH);
          weatherRig.syncCamera(cameraP1.position);
          renderer.render(scene, cameraP1);

          // Right half: Player 2 (Arrows)
          renderer.setViewport(halfW, 0, rightW, viewH);
          renderer.setScissor(halfW, 0, rightW, viewH);
          weatherRig.syncCamera(cameraP2.position);
          renderer.render(scene, cameraP2);

          renderer.setScissorTest(false);
        } else {
          renderer.setScissorTest(false);
          renderer.setViewport(0, 0, viewW, viewH);
          renderer.render(scene, cameraP1);
        }

        // Throttled HUD update
        if (now - lastHudPush > 95) {
          lastHudPush = now;
          const totalRacers = racers.length;
          const players: PlayerHudInfo[] = [];
          const aiDots: HudSnapshot['aiDots'] = [];
          for (let i = 0; i < totalRacers; i++) {
            const r = racers[i];
            if (r.profile.isHuman) {
              const onFootP1 = i === 0 && freestyleAction?.isOnFoot;
              players.push({
                name: r.profile.name,
                carName:
                  r.profile.playerIndex === 0
                    ? carSpecsRef.current.p1.name
                    : carSpecsRef.current.p2.name,
                team: r.profile.team,
                speedKmh: onFootP1
                  ? Math.round(Math.abs(freestyleAction!.charSpeed) * 3.6)
                  : r.vehicle.speedKmh,
                rpm: Math.round(r.vehicle.rpm),
                gear: r.vehicle.gear,
                boostFuel: Math.round(r.vehicle.boostFuel),
                isBoosting: r.vehicle.isBoosting,
                isDrifting: r.vehicle.isDrifting,
                totalDriftScore: Math.round(r.vehicle.totalDriftScore),
                airTime: Math.round(r.vehicle.airTime * 10) / 10,
                surface: r.vehicle.surface,
                biome: r.vehicle.biome,
                lap: r.lap,
                totalLaps: activeWorld.config.totalLaps,
                place: r.place,
                totalRacers,
                finished: r.finished,
                finishTime: r.finishTime,
                x: onFootP1 ? freestyleAction!.charX : r.vehicle.x,
                z: onFootP1 ? freestyleAction!.charZ : r.vehicle.z,
                yaw: onFootP1 ? freestyleAction!.charYaw : r.vehicle.yaw,
              });
            } else {
              aiDots.push({
                x: r.vehicle.x,
                z: r.vehicle.z,
                yaw: r.vehicle.yaw,
                color: r.profile.paintHex,
                team: r.profile.team,
              });
            }
          }
          if (freestyleTraffic) {
            for (let si = 0; si < freestyleTraffic.slots.length; si++) {
              const slot = freestyleTraffic.slots[si];
              if (!slot.active) continue;
              const vSpec = FREESTYLE_TRAFFIC_VARIANTS[slot.variantIndex];
              aiDots.push({
                x: slot.vehicle.x,
                z: slot.vehicle.z,
                yaw: slot.vehicle.yaw,
                color: vSpec.paintHex,
              });
            }
          }
          if (freestyleAction) {
            for (const c of freestyleAction.policeCruisers) {
              if (!c.active) continue;
              aiDots.push({
                x: c.x,
                z: c.z,
                yaw: c.yaw,
                color: 0x3b82f6,
              });
            }
          }

          callbacksRef.current.onHudUpdate({
            mode,
            mapId,
            mapName: activeWorld.config.name,
            weatherCondition: simCur.weather.condition,
            weatherPreset: simCur.weather.preset,
            cameraMode: simCur.cameraMode,
            headlightsOn: p1.headlightsOn,
            countdownSeconds: simCur.countdownSeconds,
            raceElapsed: simCur.raceElapsed,
            players,
            aiDots,
            standings: mode === 'freestyle' ? [] : buildRaceStandings(racers),
            beaconsFound: simCur.discovered.size,
            totalBeacons: activeWorld.beacons.length,
            discoveredIds: Array.from(simCur.discovered),
            totalCoins: totalCoinsRef.current,
            runCoins: simCur.runCoins,
            lobbyCode: lobbyRef.current?.code ?? null,
            teamScores: mode === 'online_2v2' ? computeTeamScores(racers) : undefined,
            isOnFoot: freestyleAction?.isOnFoot ?? false,
            characterHealth: freestyleAction ? Math.round(freestyleAction.health) : 100,
            characterMaxHealth: freestyleAction ? Math.round(freestyleAction.maxHealth) : 100,
            characterEnergy: freestyleAction ? Math.round(freestyleAction.energy) : 100,
            wantedLevel: freestyleAction?.wantedLevel ?? 0,
            activePower: freestyleAction?.activePower ?? null,
            activePowerSeconds: freestyleAction ? Math.ceil(freestyleAction.activePowerTimer) : 0,
            isCharacterDead: freestyleAction?.isDead ?? false,
            nearHouseName: freestyleAction?.nearHouseName ?? null,
          });
        }

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      };

      tick();

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('blur', clearInputs);
        document.removeEventListener('visibilitychange', handleVisibility);
        renderer.domElement.removeEventListener('pointermove', handlePointerMove);
        renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
        audioEngine.dispose();
        weatherRig.dispose();
        livingWorld.dispose();
        livingWorldRef.current = null;
        freestyleAction?.dispose();
        freestyleActionRef.current = null;
        trafficRigs.forEach((rig) => rig.dispose());
        freestyleTrafficRef.current = null;
        carRigs.forEach((c) => c.dispose());
        worldRig.dispose();
        textures.dispose();
        envTexture.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    }, [mapId, mode]);

    return (
      <div
        ref={mountRef}
        data-testid="game-viewport"
        className="fixed inset-0 overflow-hidden bg-slate-950"
      />
    );
  },
);
