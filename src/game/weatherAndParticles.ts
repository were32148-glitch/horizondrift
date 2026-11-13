import * as THREE from 'three';
import type { ProceduralTexturePack } from './textures';
import type { SurfaceType, VehicleState, WeatherComputed } from './types';

export interface WeatherAndParticleRig {
  update: (
    dt: number,
    elapsed: number,
    cameraPos: THREE.Vector3,
    weather: WeatherComputed,
    vehicles: VehicleState[],
  ) => void;
  syncCamera: (cameraPos: THREE.Vector3) => void;
  dispose: () => void;
}

const RAIN_COUNT = 1400;
const SNOW_COUNT = 1100;
const DUST_POOL_SIZE = 180;

interface DustParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
  startScale: number;
  endScale: number;
  r: number;
  g: number;
  b: number;
}

const _dummy = new THREE.Object3D();
const _tmpColor = new THREE.Color();

export function createWeatherAndParticleRig(
  scene: THREE.Scene,
  textures: ProceduralTexturePack,
): WeatherAndParticleRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // --- 1. Procedural Gradient + Sun + Starry Sky Dome ---
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x2e72c6) },
    uHorizonColor: { value: new THREE.Color(0xc0dcf2) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.4, -0.7).normalize() },
    uSunIntensity: { value: 1.0 },
    uNightFactor: { value: 0.0 },
    uFlash: { value: 0.0 },
    uTime: { value: 0.0 },
  };

  const skyGeo = track(new THREE.SphereGeometry(960, 28, 18));
  const skyMat = track(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform float uSunIntensity;
        uniform float uNightFactor;
        uniform float uFlash;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.55));

          // Sun / Moon disc & atmospheric scattering halo
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float halo = pow(sunDot, 12.0) * 0.35 * uSunIntensity;
          float disc = smoothstep(0.996, 0.9992, sunDot) * 1.4 * uSunIntensity;
          col += vec3(1.0, 0.92, 0.78) * (halo + disc);

          // Procedural stars at night
          if (uNightFactor > 0.05 && h > 0.08) {
            vec3 starCell = floor(dir * 190.0);
            float s = hash(starCell);
            if (s > 0.992) {
              float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + s * 100.0);
              col += vec3(0.85, 0.92, 1.0) * twinkle * uNightFactor * smoothstep(0.08, 0.3, h);
            }
          }

          // Lightning sky illumination
          col += vec3(0.7, 0.82, 1.0) * uFlash * 0.65;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);

  // --- 2. Pooled Rain Streaks (LineSegments) ---
  const rainPositions = new Float32Array(RAIN_COUNT * 2 * 3);
  const rainVelocities = new Float32Array(RAIN_COUNT);
  const rainOffsets = new Float32Array(RAIN_COUNT * 3);
  const rainBox = 42;
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainOffsets[i * 3] = (Math.random() - 0.5) * rainBox;
    rainOffsets[i * 3 + 1] = Math.random() * 24;
    rainOffsets[i * 3 + 2] = (Math.random() - 0.5) * rainBox;
    rainVelocities[i] = 26 + Math.random() * 10;
  }
  const rainGeo = track(new THREE.BufferGeometry());
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = track(
    new THREE.LineBasicMaterial({
      color: 0xcbe4ff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    }),
  );
  const rainMesh = new THREE.LineSegments(rainGeo, rainMat);
  rainMesh.frustumCulled = false;
  rainMesh.visible = false;
  scene.add(rainMesh);

  // --- 3. Pooled Snowflakes (Points) ---
  const snowPositions = new Float32Array(SNOW_COUNT * 3);
  const snowOffsets = new Float32Array(SNOW_COUNT * 3);
  const snowSeeds = new Float32Array(SNOW_COUNT);
  const snowBox = 48;
  for (let i = 0; i < SNOW_COUNT; i++) {
    snowOffsets[i * 3] = (Math.random() - 0.5) * snowBox;
    snowOffsets[i * 3 + 1] = Math.random() * 22;
    snowOffsets[i * 3 + 2] = (Math.random() - 0.5) * snowBox;
    snowSeeds[i] = Math.random() * Math.PI * 2;
  }
  const snowGeo = track(new THREE.BufferGeometry());
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snowMat = track(
    new THREE.PointsMaterial({
      color: 0xf8fafc,
      map: textures.particleSoftMap,
      size: 0.36,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    }),
  );
  const snowPoints = new THREE.Points(snowGeo, snowMat);
  snowPoints.frustumCulled = false;
  snowPoints.visible = false;
  scene.add(snowPoints);

  // --- 4. Zero-GC Pooled Tire Smoke / Dust / Snow / Water Splash System (InstancedMesh) ---
  const dustGeo = track(new THREE.IcosahedronGeometry(0.45, 1));
  const dustMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  );
  const dustInst = new THREE.InstancedMesh(dustGeo, dustMat, DUST_POOL_SIZE);
  dustInst.frustumCulled = false;
  scene.add(dustInst);

  const dustPool: DustParticle[] = [];
  for (let i = 0; i < DUST_POOL_SIZE; i++) {
    dustPool.push({
      active: false,
      x: 0,
      y: -500,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      maxAge: 0.7,
      startScale: 0.4,
      endScale: 1.6,
      r: 0.8,
      g: 0.8,
      b: 0.8,
    });
    _dummy.position.set(0, -500, 0);
    _dummy.scale.setScalar(0.001);
    _dummy.updateMatrix();
    dustInst.setMatrixAt(i, _dummy.matrix);
    dustInst.setColorAt(i, _tmpColor.setRGB(1, 1, 1));
  }
  dustInst.instanceMatrix.needsUpdate = true;
  if (dustInst.instanceColor) dustInst.instanceColor.needsUpdate = true;

  let dustCursor = 0;
  let emitAccum = 0;

  const spawnDust = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    surface: SurfaceType,
    scaleMul = 1,
  ) => {
    const p = dustPool[dustCursor];
    dustCursor = (dustCursor + 1) % DUST_POOL_SIZE;
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.age = 0;
    p.maxAge = 0.45 + Math.random() * 0.35;
    p.startScale = 0.32 * scaleMul;
    p.endScale = 1.55 * scaleMul;

    if (surface === 'asphalt') {
      p.r = 0.86;
      p.g = 0.88;
      p.b = 0.92;
    } else if (surface === 'water') {
      p.r = 0.72;
      p.g = 0.92;
      p.b = 1.0;
    } else if (surface === 'snow') {
      p.r = 0.96;
      p.g = 0.98;
      p.b = 1.0;
    } else if (surface === 'sand') {
      p.r = 0.82;
      p.g = 0.73;
      p.b = 0.54;
    } else {
      p.r = 0.58;
      p.g = 0.48;
      p.b = 0.36;
    }
  };

  return {
    syncCamera: (cameraPos) => {
      skyDome.position.copy(cameraPos);
    },
    update: (dt, elapsed, cameraPos, weather, vehicles) => {
      // 1. Update Sky Dome
      skyDome.position.copy(cameraPos);
      skyUniforms.uTopColor.value.setHex(weather.skyTopHex);
      skyUniforms.uHorizonColor.value.setHex(weather.skyHorizonHex);
      const sunY = Math.sin(weather.sunElevation);
      const sunR = Math.cos(weather.sunElevation);
      skyUniforms.uSunDir.value
        .set(Math.sin(weather.sunAzimuth) * sunR, sunY, Math.cos(weather.sunAzimuth) * sunR)
        .normalize();
      skyUniforms.uSunIntensity.value = weather.condition === 'night' ? 0.4 : weather.sunIntensity * 0.55;
      skyUniforms.uNightFactor.value = weather.condition === 'night' ? 1.0 : 0.0;
      skyUniforms.uFlash.value = weather.lightningFlash;
      skyUniforms.uTime.value = elapsed;

      // 2. Rain
      if (weather.rainIntensity > 0.04) {
        rainMesh.visible = true;
        rainMat.opacity = weather.rainIntensity * 0.48;
        const windX = Math.cos(weather.windAngle) * weather.windStrength * 5.5;
        const windZ = Math.sin(weather.windAngle) * weather.windStrength * 5.5;
        const pos = rainGeo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < RAIN_COUNT; i++) {
          let ox = rainOffsets[i * 3] + windX * dt;
          let oy = rainOffsets[i * 3 + 1] - rainVelocities[i] * dt;
          let oz = rainOffsets[i * 3 + 2] + windZ * dt;

          if (oy < -2) oy += 24;
          if (ox > rainBox * 0.5) ox -= rainBox;
          else if (ox < -rainBox * 0.5) ox += rainBox;
          if (oz > rainBox * 0.5) oz -= rainBox;
          else if (oz < -rainBox * 0.5) oz += rainBox;

          rainOffsets[i * 3] = ox;
          rainOffsets[i * 3 + 1] = oy;
          rainOffsets[i * 3 + 2] = oz;

          const wx = cameraPos.x + ox;
          const wy = cameraPos.y - 4 + oy;
          const wz = cameraPos.z + oz;

          pos.setXYZ(i * 2, wx, wy, wz);
          pos.setXYZ(i * 2 + 1, wx - windX * 0.032, wy + 0.85, wz - windZ * 0.032);
        }
        pos.needsUpdate = true;
      } else {
        rainMesh.visible = false;
      }

      // 3. Snow
      if (weather.snowIntensity > 0.04) {
        snowPoints.visible = true;
        snowMat.opacity = weather.snowIntensity * 0.82;
        const windX = Math.cos(weather.windAngle) * weather.windStrength * 6.5;
        const windZ = Math.sin(weather.windAngle) * weather.windStrength * 6.5;
        const pos = snowGeo.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < SNOW_COUNT; i++) {
          const seed = snowSeeds[i];
          let ox = snowOffsets[i * 3] + (windX + Math.sin(elapsed * 1.8 + seed) * 1.4) * dt;
          let oy = snowOffsets[i * 3 + 1] - (3.6 + weather.windStrength * 1.8) * dt;
          let oz = snowOffsets[i * 3 + 2] + (windZ + Math.cos(elapsed * 1.5 + seed) * 1.4) * dt;

          if (oy < -3) oy += 22;
          if (ox > snowBox * 0.5) ox -= snowBox;
          else if (ox < -snowBox * 0.5) ox += snowBox;
          if (oz > snowBox * 0.5) oz -= snowBox;
          else if (oz < -snowBox * 0.5) oz += snowBox;

          snowOffsets[i * 3] = ox;
          snowOffsets[i * 3 + 1] = oy;
          snowOffsets[i * 3 + 2] = oz;

          pos.setXYZ(i, cameraPos.x + ox, cameraPos.y - 4 + oy, cameraPos.z + oz);
        }
        pos.needsUpdate = true;
      } else {
        snowPoints.visible = false;
      }

      // 4. Emit Tire Dust / Drift Smoke / Water Spray / Landing Burst across all cars
      let totalEmit = 0;
      for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
        const vehicle = vehicles[vIdx];
        const speedAbs = Math.abs(vehicle.speed);
        const isOffroad = vehicle.surface !== 'asphalt';
        const emitRate =
          vehicle.groundedCount > 0 && (vehicle.isDrifting || (isOffroad && speedAbs > 6))
            ? vehicle.isDrifting
              ? 36
              : 18
            : 0;
        totalEmit += emitRate;
      }

      emitAccum += totalEmit * dt;
      let emitIter = 0;
      while (emitAccum >= 1 && emitIter < 12) {
        emitAccum -= 1;
        emitIter++;
        for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
          const vehicle = vehicles[vIdx];
          const speedAbs = Math.abs(vehicle.speed);
          const isOffroad = vehicle.surface !== 'asphalt';
          if (vehicle.groundedCount <= 0 || (!vehicle.isDrifting && (!isOffroad || speedAbs <= 6))) {
            continue;
          }
          const sinY = Math.sin(vehicle.yaw);
          const cosY = Math.cos(vehicle.yaw);
          for (const side of [-0.96, 0.96]) {
            const wx = vehicle.x + cosY * side - sinY * 1.38;
            const wz = vehicle.z - sinY * side - cosY * 1.38;
            spawnDust(
              wx + (Math.random() - 0.5) * 0.25,
              vehicle.y - 0.12,
              wz + (Math.random() - 0.5) * 0.25,
              -vehicle.vx * 0.15 + (Math.random() - 0.5) * 1.6,
              1.2 + Math.random() * 1.6,
              -vehicle.vz * 0.15 + (Math.random() - 0.5) * 1.6,
              vehicle.surface,
              vehicle.isDrifting ? 1.2 : 0.85,
            );
          }
        }
      }
      if (emitAccum > 6) emitAccum = 0;

      for (let vIdx = 0; vIdx < vehicles.length; vIdx++) {
        const vehicle = vehicles[vIdx];
        if (vehicle.landedIntensity > 0.22) {
          for (let k = 0; k < 10; k++) {
            const ang = (k / 10) * Math.PI * 2;
            spawnDust(
              vehicle.x + Math.cos(ang) * 1.4,
              vehicle.y - 0.1,
              vehicle.z + Math.sin(ang) * 1.4,
              Math.cos(ang) * 4.5,
              1.8 + Math.random() * 2.0,
              Math.sin(ang) * 4.5,
              vehicle.surface,
              1.35,
            );
          }
        }
      }

      // Step dust pool in-place (zero GC)
      let anyDustDirty = false;
      for (let i = 0; i < DUST_POOL_SIZE; i++) {
        const p = dustPool[i];
        if (!p.active) continue;
        anyDustDirty = true;
        p.age += dt;
        if (p.age >= p.maxAge) {
          p.active = false;
          _dummy.position.set(0, -500, 0);
          _dummy.scale.setScalar(0.001);
          _dummy.updateMatrix();
          dustInst.setMatrixAt(i, _dummy.matrix);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 1.2 * dt;
        const lifeT = p.age / p.maxAge;
        const scale = (p.startScale + (p.endScale - p.startScale) * lifeT) * (1 - lifeT * 0.55);

        _dummy.position.set(p.x, p.y, p.z);
        _dummy.rotation.set(lifeT * 2, lifeT, 0);
        _dummy.scale.setScalar(Math.max(0.01, scale));
        _dummy.updateMatrix();
        dustInst.setMatrixAt(i, _dummy.matrix);
        dustInst.setColorAt(i, _tmpColor.setRGB(p.r, p.g, p.b));
      }
      if (anyDustDirty) {
        dustInst.instanceMatrix.needsUpdate = true;
        if (dustInst.instanceColor) dustInst.instanceColor.needsUpdate = true;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
