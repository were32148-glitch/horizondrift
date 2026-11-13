import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ProceduralAudioEngine } from '../game/audio';
import { createCarVisualRig, type CarVisualRig } from '../game/carModel';
import { getCarSpec } from '../game/cars';
import {
  buildRaceStandings,
  computeAiVehicleInput,
  createRaceGrid,
  stepRaceProgress,
} from '../game/raceLogic';
import {
  clamp,
  getMapWorldData,
  groundHeightAt,
  lerp,
} from '../game/terrain';
import { createProceduralTextures } from '../game/textures';
import type {
  CameraMode,
  CarId,
  GameMode,
  GamePhase,
  HudSnapshot,
  MapId,
  PlayerHudInfo,
  RacerRuntime,
  RaceStandingSummary,
  VehicleInput,
  VehicleState,
  WeatherPreset,
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
  setWeatherPreset: (preset: WeatherPreset) => void;
  cycleWeather: () => void;
  setCameraMode: (mode: CameraMode) => void;
  cycleCameraMode: () => void;
  toggleHeadlights: () => void;
  setPaintColor: (hex: number) => void;
  toggleMute: () => boolean;
  initAudio: () => void;
}

interface DrivingCanvasProps {
  phase: GamePhase;
  mode: GameMode;
  mapId: MapId;
  carIdP1: CarId;
  carIdP2: CarId;
  totalCoins: number;
  onHudUpdate: (hud: HudSnapshot) => void;
  onPhaseHotkey: (action: 'pause' | 'start' | 'mute') => void;
  onBeaconFound: (name: string) => void;
  onCoinsEarned: (amount: number, label: string) => void;
  onRaceFinished: (standings: RaceStandingSummary[]) => void;
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

export const DrivingCanvas = forwardRef<DrivingControllerHandle, DrivingCanvasProps>(
  function DrivingCanvas(
    {
      phase,
      mode,
      mapId,
      carIdP1,
      carIdP2,
      totalCoins,
      onHudUpdate,
      onPhaseHotkey,
      onBeaconFound,
      onCoinsEarned,
      onRaceFinished,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const phaseRef = useRef<GamePhase>(phase);
    const prevPhaseRef = useRef<GamePhase>(phase);
    const totalCoinsRef = useRef<number>(totalCoins);
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
    });

    phaseRef.current = phase;
    totalCoinsRef.current = totalCoins;
    callbacksRef.current = {
      onHudUpdate,
      onPhaseHotkey,
      onBeaconFound,
      onCoinsEarned,
      onRaceFinished,
    };

    const audioRef = useRef<ProceduralAudioEngine | null>(null);
    const worldRigRef = useRef<WorldVisualRig | null>(null);
    const carRigsRef = useRef<CarVisualRig[]>([]);
    const snapRaceCamerasRef = useRef<(() => void) | null>(null);
    const worldData = getMapWorldData(mapId);

    const simStateRef = useRef({
      racers: createRaceGrid(mode, mapId),
      weather: createInitialWeatherState(worldData.config.defaultWeather),
      cameraMode: 'chase' as CameraMode,
      discovered: new Set<string>(),
      collectedCoins: new Set<number>(),
      runCoins: 0,
      manualHeadlights: null as boolean | null,
      paintHex: getCarSpec(carIdP1).paintHex,
      countdownSeconds: mode === 'freestyle' ? 0 : 2.4,
      raceElapsed: 0,
      raceFinishedSent: false,
    });

    // Live-update car specs when user equips a car in the Garage
    useEffect(() => {
      const s1 = getCarSpec(carIdP1);
      const s2 = getCarSpec(carIdP2);
      carSpecsRef.current = { p1: s1, p2: s2 };
      simStateRef.current.paintHex = s1.paintHex;
      if (simStateRef.current.racers[0]) {
        simStateRef.current.racers[0].profile.paintHex = s1.paintHex;
        simStateRef.current.racers[0].profile.stripeHex = s1.stripeHex;
      }
      carRigsRef.current[0]?.applyCarSpec(s1);
      if (mode === 'race2p' && simStateRef.current.racers[1] && carRigsRef.current[1]) {
        simStateRef.current.racers[1].profile.paintHex = s2.paintHex;
        simStateRef.current.racers[1].profile.stripeHex = s2.stripeHex;
        carRigsRef.current[1].applyCarSpec(s2);
      }
    }, [carIdP1, carIdP2, mode]);

    const resetRaceState = () => {
      const freshRacers = createRaceGrid(mode, mapId);
      const s1 = carSpecsRef.current.p1;
      const s2 = carSpecsRef.current.p2;
      freshRacers[0].profile.paintHex = simStateRef.current.paintHex;
      freshRacers[0].profile.stripeHex = s1.stripeHex;
      if (carRigsRef.current[0]) {
        carRigsRef.current[0].applyCarSpec(s1);
        carRigsRef.current[0].setPaintColor(simStateRef.current.paintHex);
      }
      if (mode === 'race2p' && freshRacers[1]) {
        freshRacers[1].profile.paintHex = s2.paintHex;
        freshRacers[1].profile.stripeHex = s2.stripeHex;
        carRigsRef.current[1]?.applyCarSpec(s2);
      }
      simStateRef.current.racers = freshRacers;
      simStateRef.current.collectedCoins.clear();
      simStateRef.current.runCoins = 0;
      worldRigRef.current?.resetCoins();
      simStateRef.current.countdownSeconds = mode === 'freestyle' ? 0 : 2.4;
      simStateRef.current.raceElapsed = 0;
      simStateRef.current.raceFinishedSent = false;
      snapRaceCamerasRef.current?.();
    };

    // When entering playing from title or gameover, ensure countdown resets cleanly
    if (prevPhaseRef.current !== phase) {
      if (phase === 'playing' && (prevPhaseRef.current === 'title' || prevPhaseRef.current === 'gameover')) {
        resetRaceState();
      }
      prevPhaseRef.current = phase;
    }

    useImperativeHandle(ref, () => ({
      resetCar: () => {
        if (mode === 'freestyle') {
          resetRaceState();
        } else {
          // Reset human player(s) back onto nearest road spline point
          const pts = worldData.roadPoints;
          for (const r of simStateRef.current.racers) {
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
            r.vehicle.y = groundHeightAt(r.vehicle.x, r.vehicle.z, mapId) + 0.5;
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
      setWeatherPreset: (preset: WeatherPreset) => {
        simStateRef.current.weather.preset = preset;
      },
      cycleWeather: () => {
        const cur = simStateRef.current.weather.preset;
        const idx = WEATHER_ORDER.indexOf(cur);
        simStateRef.current.weather.preset = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
      },
      setCameraMode: (cMode: CameraMode) => {
        simStateRef.current.cameraMode = cMode;
      },
      cycleCameraMode: () => {
        const cur = simStateRef.current.cameraMode;
        const idx = CAMERA_ORDER.indexOf(cur);
        simStateRef.current.cameraMode = CAMERA_ORDER[(idx + 1) % CAMERA_ORDER.length];
      },
      toggleHeadlights: () => {
        const cur =
          simStateRef.current.manualHeadlights !== null
            ? simStateRef.current.manualHeadlights
            : simStateRef.current.racers[0].vehicle.headlightsOn;
        simStateRef.current.manualHeadlights = !cur;
      },
      setPaintColor: (hex: number) => {
        simStateRef.current.paintHex = hex;
        if (simStateRef.current.racers[0]) {
          simStateRef.current.racers[0].profile.paintHex = hex;
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
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
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
      scene.fog = new THREE.FogExp2(0xb8d4ec, 0.0018);

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;
      pmremGenerator.dispose();

      const cameraP1 = new THREE.PerspectiveCamera(66, initW / initH, 0.25, 1650);
      const cameraP2 = new THREE.PerspectiveCamera(66, initW / initH, 0.25, 1650);

      const hemiLight = new THREE.HemisphereLight(0x87c2f8, 0x4e5638, 0.85);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight(0xffe8c2, 2.35);
      sunLight.castShadow = !isSoftwareGl;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 200;
      const d = 62;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
      scene.add(sunLight);
      scene.add(sunLight.target);

      const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());
      const activeWorld = getMapWorldData(mapId);
      const obstacleGrid = new ObstacleGrid(activeWorld.obstacles);

      const worldRig = createWorldVisualRig(mapId, textures, isSoftwareGl);
      scene.add(worldRig.group);
      worldRigRef.current = worldRig;

      const carRigs: CarVisualRig[] = [];
      const initialRacers = simStateRef.current.racers;
      for (let i = 0; i < initialRacers.length; i++) {
        const p = initialRacers[i].profile;
        const spec =
          p.playerIndex === 0
            ? carSpecsRef.current.p1
            : p.playerIndex === 1
              ? carSpecsRef.current.p2
              : null;
        const paint = i === 0 ? simStateRef.current.paintHex : spec ? spec.paintHex : p.paintHex;
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
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)
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
          const cur = simStateRef.current.cameraMode;
          const idx = CAMERA_ORDER.indexOf(cur);
          simStateRef.current.cameraMode = CAMERA_ORDER[(idx + 1) % CAMERA_ORDER.length];
        } else if (code === 'KeyV') {
          const cur = simStateRef.current.weather.preset;
          const idx = WEATHER_ORDER.indexOf(cur);
          simStateRef.current.weather.preset = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
        } else if (code === 'KeyL') {
          const cur =
            simStateRef.current.manualHeadlights !== null
              ? simStateRef.current.manualHeadlights
              : simStateRef.current.racers[0].vehicle.headlightsOn;
          simStateRef.current.manualHeadlights = !cur;
        } else if (code === 'KeyM') {
          audioEngine.toggleMute();
          callbacksRef.current.onPhaseHotkey('mute');
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        keysDown.delete(e.code);
      };

      const handleVisibility = () => {
        if (document.hidden) clearInputs();
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', clearInputs);
      document.addEventListener('visibilitychange', handleVisibility);

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

      const camLookP1 = new THREE.Vector3();
      const camLookP2 = new THREE.Vector3();

      const snapChaseCameras = () => {
        const v1 = simStateRef.current.racers[0].vehicle;
        const s1 = Math.sin(v1.yaw);
        const c1 = Math.cos(v1.yaw);
        cameraP1.position.set(v1.x - s1 * 7.6, v1.y + 2.85, v1.z - c1 * 7.6);
        camLookP1.set(v1.x + s1 * 4.5, v1.y + 1.05, v1.z + c1 * 4.5);
        cameraP1.fov = 64;
        cameraP1.updateProjectionMatrix();
        cameraP1.lookAt(camLookP1);

        if (simStateRef.current.racers[1]) {
          const v2 = simStateRef.current.racers[1].vehicle;
          const s2 = Math.sin(v2.yaw);
          const c2 = Math.cos(v2.yaw);
          cameraP2.position.set(v2.x - s2 * 7.6, v2.y + 2.85, v2.z - c2 * 7.6);
          camLookP2.set(v2.x + s2 * 4.5, v2.y + 1.05, v2.z + c2 * 4.5);
          cameraP2.fov = 64;
          cameraP2.updateProjectionMatrix();
          cameraP2.lookAt(camLookP2);
        }
      };
      snapRaceCamerasRef.current = snapChaseCameras;

      // Snap initial camera poses cleanly
      {
        const v1 = simStateRef.current.racers[0].vehicle;
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

        if (cMode === 'hood') {
          _camDesired.set(v.x + sinY * 0.55, v.y + 1.38, v.z + cosY * 0.55);
          _camLookTarget.set(v.x + sinY * 18, v.y + 0.85 - v.pitch * 12, v.z + cosY * 18);
          cam.position.lerp(_camDesired, 1 - Math.exp(-26 * dt));
          lookVec.lerp(_camLookTarget, 1 - Math.exp(-24 * dt));
        } else {
          const isDriftCam = cMode === 'drift';
          const speedFrac = clamp(Math.abs(v.speed) / 48, 0, 1);
          const followDist = isDriftCam ? 8.2 + speedFrac * 1.4 : 7.6 + speedFrac * 1.8;
          const followHeight = isDriftCam ? 3.1 : 2.85;

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
          _camLookTarget.set(v.x + sinY * 4.5, v.y + 1.05, v.z + cosY * 4.5);

          cam.position.lerp(_camDesired, 1 - Math.exp(-8.8 * dt));
          lookVec.lerp(_camLookTarget, 1 - Math.exp(-12.5 * dt));
        }

        const camGround = groundHeightAt(cam.position.x, cam.position.z, mapId);
        if (cam.position.y < camGround + 1.15) {
          cam.position.y = camGround + 1.15;
        }

        const targetFov = 64 + clamp(v.speedKmh / 220, 0, 1) * 14 + (v.isBoosting ? 6 : 0);
        if (Math.abs(cam.fov - targetFov) > 0.05) {
          cam.fov = lerp(cam.fov, targetFov, 1 - Math.exp(-6 * dt));
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
            frameId = window.setTimeout(poll, 4);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 12);
          }
        };
        frameId = window.setTimeout(poll, 4);
      }

      const tick = () => {
        if (disposed) return;
        const now = performance.now();
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
        elapsed += dt;

        const sim = simStateRef.current;
        const curPhase = phaseRef.current;
        const racers = sim.racers;

        if (curPhase !== 'paused') {
          stepWeatherState(sim.weather, dt, Math.random());
        }

        // Countdown & Race Physics
        if (curPhase === 'playing') {
          const isRace = mode !== 'freestyle';
          const countdownDt = Math.min(Math.max(rawDt, 0.001), 0.4);
          if (isRace && sim.countdownSeconds > 0) {
            sim.countdownSeconds = Math.max(0, sim.countdownSeconds - countdownDt);
            const lit = clamp(Math.ceil((2.4 - sim.countdownSeconds) * 2.1), 1, 5);
            worldRig.setCountdownLights('red', lit);
            for (let i = 0; i < racerInputs.length; i++) zeroInput(racerInputs[i]);
          } else {
            if (isRace) {
              sim.raceElapsed += dt;
              if (sim.raceElapsed < 1.8) {
                worldRig.setCountdownLights('go');
              } else {
                worldRig.setCountdownLights('off');
              }
            } else {
              worldRig.setCountdownLights('off');
            }

            // Compute inputs for each racer
            for (let i = 0; i < racers.length; i++) {
              const r = racers[i];
              const inp = racerInputs[i];
              if (r.profile.playerIndex === 0) {
                const allowArrowsAlso = mode !== 'race2p';
                const up = keysDown.has('KeyW') || (allowArrowsAlso && keysDown.has('ArrowUp'));
                const down = keysDown.has('KeyS') || (allowArrowsAlso && keysDown.has('ArrowDown'));
                const left = keysDown.has('KeyA') || (allowArrowsAlso && keysDown.has('ArrowLeft'));
                const right = keysDown.has('KeyD') || (allowArrowsAlso && keysDown.has('ArrowRight'));
                inp.throttle = up ? 1 : 0;
                inp.brake = down ? 1 : 0;
                inp.steer = (left ? 1 : 0) - (right ? 1 : 0);
                inp.handbrake = keysDown.has('Space');
                inp.boost =
                  keysDown.has('ShiftLeft') || (allowArrowsAlso && keysDown.has('ShiftRight'));
              } else if (r.profile.playerIndex === 1) {
                inp.throttle = keysDown.has('ArrowUp') ? 1 : 0;
                inp.brake = keysDown.has('ArrowDown') ? 1 : 0;
                inp.steer = (keysDown.has('ArrowLeft') ? 1 : 0) - (keysDown.has('ArrowRight') ? 1 : 0);
                inp.handbrake =
                  keysDown.has('Enter') ||
                  keysDown.has('ControlRight') ||
                  keysDown.has('Slash');
                inp.boost = keysDown.has('ShiftRight');
              } else {
                computeAiVehicleInput(r, racers, activeWorld, inp);
              }
            }

            // Step physics for all racers
            allVehiclesScratch.length = 0;
            for (let i = 0; i < racers.length; i++) {
              const pIdx = racers[i].profile.playerIndex;
              const spec =
                pIdx === 0
                  ? carSpecsRef.current.p1
                  : pIdx === 1
                    ? carSpecsRef.current.p2
                    : undefined;
              stepVehiclePhysics(
                racers[i].vehicle,
                racerInputs[i],
                obstacleGrid,
                sim.weather,
                dt,
                mapId,
                spec,
              );
              allVehiclesScratch.push(racers[i].vehicle);
            }

            resolveCarToCarCollisions(allVehiclesScratch);

            if (isRace) {
              stepRaceProgress(racers, activeWorld, sim.raceElapsed);
              const humanRacers = racers.filter((r) => r.profile.isHuman);
              if (
                !sim.raceFinishedSent &&
                humanRacers.length > 0 &&
                humanRacers.every((r) => r.finished)
              ) {
                sim.raceFinishedSent = true;
                callbacksRef.current.onRaceFinished(buildRaceStandings(racers));
              }
            }

            // Gold Coin Pickup checks for human cars
            for (let ci = 0; ci < activeWorld.coins.length; ci++) {
              if (sim.collectedCoins.has(ci)) continue;
              const coin = activeWorld.coins[ci];
              for (const r of racers) {
                if (!r.profile.isHuman) continue;
                const dx = r.vehicle.x - coin.x;
                const dz = r.vehicle.z - coin.z;
                const dy = r.vehicle.y - coin.y;
                if (dx * dx + dz * dz <= 4.3 * 4.3 && Math.abs(dy) <= 3.6) {
                  sim.collectedCoins.add(ci);
                  sim.runCoins += coin.value;
                  worldRig.collectCoin(ci);
                  audioEngine.playCoinChime();
                  callbacksRef.current.onCoinsEarned(coin.value, `+${coin.value} COINS`);
                  break;
                }
              }
            }

            // Exploration Beacons check for human cars
            for (const b of activeWorld.beacons) {
              if (sim.discovered.has(b.id)) continue;
              for (const r of racers) {
                if (!r.profile.isHuman) continue;
                if (Math.hypot(r.vehicle.x - b.x, r.vehicle.z - b.z) <= b.radius) {
                  sim.discovered.add(b.id);
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
        const autoLights = sim.weather.isDark || sim.weather.rainIntensity > 0.3;
        allVehiclesScratch.length = 0;
        for (let i = 0; i < racers.length; i++) {
          const v = racers[i].vehicle;
          v.headlightsOn = sim.manualHeadlights !== null ? sim.manualHeadlights : autoLights;
          const gy = groundHeightAt(v.x, v.z, mapId);
          carRigs[i].updateFromState(v, racerInputs[i], gy, elapsed);
          allVehiclesScratch.push(v);
        }

        // Lighting & Fog sync
        const p1 = racers[0].vehicle;
        const sunElev = sim.weather.sunElevation;
        const sunAzim = sim.weather.sunAzimuth;
        const sunR = Math.cos(sunElev);
        _sunPos.set(
          Math.sin(sunAzim) * sunR * 120,
          Math.sin(sunElev) * 120,
          Math.cos(sunAzim) * sunR * 120,
        );
        sunLight.position.set(p1.x + _sunPos.x, Math.max(18, p1.y + _sunPos.y), p1.z + _sunPos.z);
        sunLight.target.position.set(p1.x, p1.y, p1.z);
        sunLight.target.updateMatrixWorld();

        const flashBoost = sim.weather.lightningFlash * 3.2;
        sunLight.color.setHex(sim.weather.sunColorHex);
        sunLight.intensity = sim.weather.sunIntensity + flashBoost;

        hemiLight.color.setHex(sim.weather.hemiSkyHex);
        hemiLight.groundColor.setHex(sim.weather.hemiGroundHex);
        hemiLight.intensity = sim.weather.hemiIntensity + sim.weather.lightningFlash * 0.9;

        const fog = scene.fog as THREE.FogExp2;
        fog.color.setHex(sim.weather.fogColorHex);
        fog.density = sim.weather.fogDensity * 0.72;

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
          updateFollowCamera(cameraP1, camLookP1, racers[0].vehicle, sim.cameraMode, dt);
          updateFollowCamera(cameraP2, camLookP2, racers[1].vehicle, sim.cameraMode, dt);
        } else {
          const asp = viewW / Math.max(1, viewH);
          if (Math.abs(cameraP1.aspect - asp) > 0.01) {
            cameraP1.aspect = asp;
            cameraP1.updateProjectionMatrix();
          }
          updateFollowCamera(cameraP1, camLookP1, p1, sim.cameraMode, dt);
        }

        worldRig.updateEnvironmentVisuals(sim.weather, elapsed);
        weatherRig.update(dt, elapsed, cameraP1.position, sim.weather, allVehiclesScratch);
        audioEngine.update(p1, sim.weather, curPhase === 'playing');

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
        if (now - lastHudPush > 80) {
          lastHudPush = now;
          const totalRacers = racers.length;
          const players: PlayerHudInfo[] = racers
            .filter((r: RacerRuntime) => r.profile.isHuman)
            .map((r: RacerRuntime) => ({
              name: r.profile.name,
              carName:
                r.profile.playerIndex === 0
                  ? carSpecsRef.current.p1.name
                  : carSpecsRef.current.p2.name,
              speedKmh: r.vehicle.speedKmh,
              rpm: Math.round(r.vehicle.rpm),
              gear: r.vehicle.gear,
              boostFuel: Math.round(r.vehicle.boostFuel),
              isBoosting: r.vehicle.isBoosting,
              isDrifting: r.vehicle.isDrifting,
              totalDriftScore: Math.round(r.vehicle.totalDriftScore),
              surface: r.vehicle.surface,
              biome: r.vehicle.biome,
              lap: r.lap,
              totalLaps: activeWorld.config.totalLaps,
              place: r.place,
              totalRacers,
              finished: r.finished,
              finishTime: r.finishTime,
              x: r.vehicle.x,
              z: r.vehicle.z,
              yaw: r.vehicle.yaw,
            }));

          const aiDots = racers
            .filter((r: RacerRuntime) => !r.profile.isHuman)
            .map((r: RacerRuntime) => ({
              x: r.vehicle.x,
              z: r.vehicle.z,
              yaw: r.vehicle.yaw,
              color: r.profile.paintHex,
            }));

          callbacksRef.current.onHudUpdate({
            mode,
            mapId,
            mapName: activeWorld.config.name,
            weatherCondition: sim.weather.condition,
            weatherPreset: sim.weather.preset,
            cameraMode: sim.cameraMode,
            headlightsOn: p1.headlightsOn,
            countdownSeconds: sim.countdownSeconds,
            raceElapsed: sim.raceElapsed,
            players,
            aiDots,
            standings: buildRaceStandings(racers),
            beaconsFound: sim.discovered.size,
            totalBeacons: activeWorld.beacons.length,
            discoveredIds: Array.from(sim.discovered),
            totalCoins: totalCoinsRef.current,
            runCoins: sim.runCoins,
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
        audioEngine.dispose();
        weatherRig.dispose();
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
