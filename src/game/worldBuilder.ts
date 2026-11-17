import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildLosSantosAndStructures } from './losSantosBuilder';
import { TERRAIN_SIZE } from './maps';
import {
  clamp,
  fbm2D,
  getMapWorldData,
  getTerrainHeightAndFactors,
  getTerrainSample,
  groundHeightAt,
  lerp,
} from './terrain';
import type { ProceduralTexturePack } from './textures';
import type { MapId, SplinePoint, WeatherComputed } from './types';

export interface BeaconVisual {
  id: string;
  x: number;
  z: number;
  radius: number;
  ringMesh: THREE.Mesh;
  beamMesh: THREE.Mesh;
  crystalMesh: THREE.Mesh;
  discovered: boolean;
}

export interface WorldVisualRig {
  group: THREE.Group;
  roadMaterial: THREE.MeshStandardMaterial;
  waterMaterial: THREE.MeshStandardMaterial;
  grassMaterial: THREE.MeshStandardMaterial;
  beacons: BeaconVisual[];
  collectCoin: (index: number) => void;
  resetCoins: () => void;
  setCountdownLights: (phase: 'red' | 'amber' | 'go' | 'off', litCount?: number) => void;
  updateEnvironmentVisuals: (weather: WeatherComputed, elapsed: number) => void;
  markBeaconDiscovered: (id: string) => void;
  resetBeacons: () => void;
  dispose: () => void;
}

function buildSplineRibbonGeometry(
  points: SplinePoint[],
  closed: boolean,
  width: number,
  yOffset: number,
  uvTileLength: number,
  mapId: MapId,
): THREE.BufferGeometry {
  const count = points.length;
  const steps = closed ? count + 1 : count;
  // 4 vertices per cross-section: [0]=left shoulder skirt (-0.42m), [1]=left road edge, [2]=right road edge, [3]=right shoulder skirt (-0.42m)
  const vertCount = steps * 4;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  let accumDist = 0;
  const halfW = width * 0.5;
  const skirtHalfW = halfW + 1.8;

  for (let i = 0; i < steps; i++) {
    const idx = i % count;
    const prev = points[(idx - 1 + count) % count];
    const curr = points[idx];
    const next = points[(idx + 1) % count];

    if (i > 0) {
      const pPrev = points[(i - 1) % count];
      accumDist += Math.hypot(curr.x - pPrev.x, curr.z - pPrev.z);
    }

    let tx: number;
    let tz: number;
    if (!closed && i === 0) {
      tx = next.x - curr.x;
      tz = next.z - curr.z;
    } else if (!closed && i === count - 1) {
      tx = curr.x - prev.x;
      tz = curr.z - prev.z;
    } else {
      tx = next.x - prev.x;
      tz = next.z - prev.z;
    }
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;

    // Perpendicular vector in XZ
    const nx = -tz;
    const nz = tx;

    const lx = curr.x + nx * halfW;
    const lz = curr.z + nz * halfW;
    const rx = curr.x - nx * halfW;
    const rz = curr.z - nz * halfW;

    const slx = curr.x + nx * skirtHalfW;
    const slz = curr.z + nz * skirtHalfW;
    const srx = curr.x - nx * skirtHalfW;
    const srz = curr.z - nz * skirtHalfW;

    const leftH = groundHeightAt(lx, lz, mapId, false);
    const rightH = groundHeightAt(rx, rz, mapId, false);
    const ly = leftH + yOffset;
    const ry = rightH + yOffset;

    const vBase = i * 4;
    // Left skirt (anchored cleanly into ground)
    positions[vBase * 3] = slx;
    positions[vBase * 3 + 1] = groundHeightAt(slx, slz, mapId, false) - 0.42;
    positions[vBase * 3 + 2] = slz;

    // Left deck edge
    positions[(vBase + 1) * 3] = lx;
    positions[(vBase + 1) * 3 + 1] = ly;
    positions[(vBase + 1) * 3 + 2] = lz;

    // Right deck edge
    positions[(vBase + 2) * 3] = rx;
    positions[(vBase + 2) * 3 + 1] = ry;
    positions[(vBase + 2) * 3 + 2] = rz;

    // Right skirt (anchored cleanly into ground)
    positions[(vBase + 3) * 3] = srx;
    positions[(vBase + 3) * 3 + 1] = groundHeightAt(srx, srz, mapId, false) - 0.42;
    positions[(vBase + 3) * 3 + 2] = srz;

    const vCoord = accumDist / uvTileLength;
    uvs[vBase * 2] = 0;
    uvs[vBase * 2 + 1] = vCoord;
    uvs[(vBase + 1) * 2] = 0;
    uvs[(vBase + 1) * 2 + 1] = vCoord;
    uvs[(vBase + 2) * 2] = 1;
    uvs[(vBase + 2) * 2 + 1] = vCoord;
    uvs[(vBase + 3) * 2] = 1;
    uvs[(vBase + 3) * 2 + 1] = vCoord;

    if (i < steps - 1) {
      for (let strip = 0; strip < 3; strip++) {
        const a = vBase + strip;
        const b = vBase + strip + 1;
        const c = vBase + 4 + strip;
        const d = vBase + 4 + strip + 1;
        // Right-handed +Y upward normals
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createGrassTuftGeometry(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const angles = [0, 1.05, 2.1];
  for (const ang of angles) {
    const plane = new THREE.PlaneGeometry(0.28, 0.52, 1, 2);
    plane.translate(0, 0.26, 0);
    const pos = plane.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0.36) {
        pos.setX(i, pos.getX(i) * 0.14);
        pos.setZ(i, pos.getZ(i) + 0.06);
      } else if (y > 0.16) {
        pos.setX(i, pos.getX(i) * 0.65);
      }
    }
    plane.rotateY(ang);
    blades.push(plane);
  }
  const merged = mergeGeometries(blades);
  blades.forEach((b) => b.dispose());
  merged.computeVertexNormals();
  return merged;
}

export function createWorldVisualRig(
  mapId: MapId,
  textures: ProceduralTexturePack,
  isSoftwareGl: boolean,
): WorldVisualRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const world = getMapWorldData(mapId);
  const config = world.config;
  const roadHalfW = config.roadWidth * 0.5;
  const trailHalfW = 4.2;
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();

  // --- 1. Sculpted Multi-Biome Terrain Mesh (256x256 GPU / 192x192 SoftwareGL over 6800m) ---
  const segs = isSoftwareGl ? 192 : 256;
  const terrainGeo = track(new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs));
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cTmp = new THREE.Color();

  const colGrassA = new THREE.Color(config.colors.grassA);
  const colGrassB = new THREE.Color(config.colors.grassB);
  const colForest = new THREE.Color(config.colors.forest);
  const colRock = new THREE.Color(config.colors.rock);
  const colSnow = new THREE.Color(config.colors.snow);
  const colSand = new THREE.Color(config.colors.sand);
  const colRoadShoulder = new THREE.Color(config.colors.shoulder);
  const colConcrete = new THREE.Color(0x525b66);

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const sample = getTerrainSample(x, z, mapId);
    // Depress terrain cleanly beneath paved & dirt roads so coarse triangles never poke through road ribbons
    const visualY = sample.height - sample.roadFactor * 0.44 - sample.trailFactor * 0.24;
    posAttr.setY(i, visualY);

    const microVar = fbm2D(x * 0.032, z * 0.032, 2) * 0.5 + 0.5;
    if (sample.surface === 'concrete') {
      cTmp.copy(colConcrete).offsetHSL(0, 0, (microVar - 0.5) * 0.05);
    } else if (sample.surface === 'snow') {
      cTmp.copy(colSnow).lerp(colRock, clamp(sample.slope * 1.4, 0, 0.35));
    } else if (sample.surface === 'rock') {
      cTmp.copy(colRock).offsetHSL(0, 0, (microVar - 0.5) * 0.08);
    } else if (sample.surface === 'sand' || sample.surface === 'water') {
      cTmp.copy(colSand).lerp(colRock, clamp(sample.waterDepth * 0.2, 0, 0.45));
    } else if (sample.surface === 'forest') {
      cTmp.copy(colForest).lerp(colGrassA, microVar * 0.35);
    } else if (sample.surface === 'asphalt' || sample.roadFactor > 0.15) {
      cTmp.copy(colRoadShoulder);
    } else {
      cTmp.copy(colGrassA).lerp(colGrassB, microVar);
      if (sample.slope > 0.24) {
        cTmp.lerp(colRock, clamp((sample.slope - 0.24) * 2.1, 0, 0.85));
      }
      if (sample.height > 25) {
        cTmp.lerp(colSnow, clamp((sample.height - 25) / 8, 0, 0.9));
      }
    }

    colors[i * 3] = cTmp.r;
    colors[i * 3 + 1] = cTmp.g;
    colors[i * 3 + 2] = cTmp.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = track(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      bumpMap: textures.terrainBump,
      bumpScale: 0.36,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.24,
    }),
  );
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = !isSoftwareGl;
  terrainMesh.matrixAutoUpdate = false;
  terrainMesh.updateMatrix();
  group.add(terrainMesh);

  // --- 2. Paved 6-Lane Grand Prix Circuit Ribbon + Distinct Highway Material + Forest Gravel Trail ---
  const roadGeo = track(
    buildSplineRibbonGeometry(world.roadPoints, true, config.roadWidth, 0.07, 22, mapId),
  );
  const roadMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.asphaltMap,
      bumpMap: textures.asphaltBump,
      bumpScale: 0.14,
      roughness: 0.72,
      metalness: 0.06,
      envMapIntensity: 0.36,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const roadMesh = new THREE.Mesh(roadGeo, roadMaterial);
  roadMesh.receiveShadow = !isSoftwareGl;
  roadMesh.matrixAutoUpdate = false;
  roadMesh.updateMatrix();
  group.add(roadMesh);

  const highwayMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.highwayMap,
      bumpMap: textures.asphaltBump,
      bumpScale: 0.12,
      roughness: 0.74,
      metalness: 0.06,
      envMapIntensity: 0.34,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const trailGeo = track(
    buildSplineRibbonGeometry(world.trailPoints, false, trailHalfW * 2, 0.02, 10, mapId),
  );
  const trailMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.dirtMap,
      bumpMap: textures.terrainBump,
      bumpScale: 0.16,
      roughness: 0.94,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const trailMesh = new THREE.Mesh(trailGeo, trailMat);
  trailMesh.receiveShadow = !isSoftwareGl;
  trailMesh.matrixAutoUpdate = false;
  trailMesh.updateMatrix();
  group.add(trailMesh);

  // --- 2b. Los Santos Metropolis, Mountain Passes, Elevated Freeway, Pier & Barricades ---
  const lsStructures = buildLosSantosAndStructures(
    world,
    mapId,
    textures,
    isSoftwareGl,
    highwayMaterial,
    buildSplineRibbonGeometry,
    track,
  );
  group.add(lsStructures.group);

  // --- 3. Start / Finish Line Complex (Checkered Tarmac, Grid Boxes, Overhead Truss Gantry, 5 Countdown Lights, Pit Garages, Grandstands) ---
  const startPose = world.startPose;
  const startY = groundHeightAt(startPose.x, startPose.z, mapId) + 0.05;
  const startGroup = new THREE.Group();
  startGroup.position.set(startPose.x, startY, startPose.z);
  startGroup.rotation.y = startPose.yaw;
  group.add(startGroup);

  const steelMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.42,
      metalness: 0.78,
    }),
  );
  const darkMetalMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.55,
      metalness: 0.5,
    }),
  );
  const whiteLineMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );

  // Checkered Finish Strip across road
  const finishStripGeo = track(new THREE.PlaneGeometry(config.roadWidth - 0.6, 3.6));
  finishStripGeo.rotateX(-Math.PI / 2);
  const finishStripMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.checkerMap,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  const finishStrip = new THREE.Mesh(finishStripGeo, finishStripMat);
  finishStrip.position.set(0, 0.04, 0);
  startGroup.add(finishStrip);

  // Staggered 6-Car Starting Grid Boxes behind Start/Finish line
  const gridFrontGeo = track(new THREE.PlaneGeometry(2.5, 0.32));
  gridFrontGeo.rotateX(-Math.PI / 2);
  const gridSideGeo = track(new THREE.PlaneGeometry(0.28, 3.4));
  gridSideGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2 === 0 ? -1 : 1;
    const gx = col * 2.85;
    const gz = -8.5 - row * 11.5;

    const frontBar = new THREE.Mesh(gridFrontGeo, whiteLineMat);
    frontBar.position.set(gx, 0.04, gz + 1.6);
    startGroup.add(frontBar);

    for (const sx of [-1.1, 1.1]) {
      const sideBar = new THREE.Mesh(gridSideGeo, whiteLineMat);
      sideBar.position.set(gx + sx, 0.04, gz);
      startGroup.add(sideBar);
    }
  }

  // Overhead Start/Finish Steel Truss Gantry
  const gantrySpan = config.roadWidth + 3.2;
  const towerGeo = track(new THREE.BoxGeometry(0.95, 9.2, 0.95));
  for (const sx of [-gantrySpan * 0.5, gantrySpan * 0.5]) {
    const tower = new THREE.Mesh(towerGeo, steelMat);
    tower.position.set(sx, 4.4, 0);
    tower.castShadow = !isSoftwareGl;
    startGroup.add(tower);

    const footing = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.7, 1.2, 1.7)),
      darkMetalMat,
    );
    footing.position.set(sx, 0.3, 0);
    startGroup.add(footing);
  }
  const trussBeam = new THREE.Mesh(
    track(new THREE.BoxGeometry(gantrySpan + 1.2, 1.1, 1.2)),
    steelMat,
  );
  trussBeam.position.set(0, 8.6, 0);
  trussBeam.castShadow = !isSoftwareGl;
  startGroup.add(trussBeam);

  // Dual-sided FINISH // GRAND PRIX illuminated header banner
  const bannerGeo = track(new THREE.PlaneGeometry(gantrySpan - 2.0, 2.3));
  const bannerMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.finishBannerMap,
      emissive: 0xffffff,
      emissiveMap: textures.finishBannerMap,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    }),
  );
  for (const dir of [1, -1]) {
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 7.6, dir * 0.66);
    if (dir < 0) banner.rotation.y = Math.PI;
    startGroup.add(banner);
  }

  // 5 Countdown Starting Light Pods under the Gantry
  const lightPodHousing = new THREE.Mesh(
    track(new THREE.BoxGeometry(4.6, 0.85, 0.55)),
    darkMetalMat,
  );
  lightPodHousing.position.set(0, 5.95, 0);
  startGroup.add(lightPodHousing);

  const countdownLightMats: THREE.MeshStandardMaterial[] = [];
  const podLampGeo = track(new THREE.CylinderGeometry(0.24, 0.24, 0.62, 14));
  podLampGeo.rotateX(Math.PI / 2);
  for (let l = 0; l < 5; l++) {
    const lMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.2,
      }),
    );
    countdownLightMats.push(lMat);
    const podLamp = new THREE.Mesh(podLampGeo, lMat);
    podLamp.position.set((l - 2) * 0.85, 5.95, 0);
    startGroup.add(podLamp);
  }

  // Pit Garages on right flank & Tiered Spectator Grandstands on left flank
  const pitWall = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.1, 1.2, 68)),
    whiteLineMat,
  );
  pitWall.position.set(-(roadHalfW + 1.8), 0.4, -18);
  startGroup.add(pitWall);

  const garageRoofGeo = track(new THREE.BoxGeometry(9.5, 0.5, 48));
  const garageBodyGeo = track(new THREE.BoxGeometry(8.5, 4.4, 46));
  const garageBodyMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.25 }),
  );
  const accentAmberMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    }),
  );

  const garageGroup = new THREE.Group();
  garageGroup.position.set(-(roadHalfW + 8.5), 0, -22);
  const gBody = new THREE.Mesh(garageBodyGeo, garageBodyMat);
  gBody.position.y = 2.0;
  gBody.castShadow = !isSoftwareGl;
  garageGroup.add(gBody);
  const gRoof = new THREE.Mesh(garageRoofGeo, steelMat);
  gRoof.position.y = 4.4;
  garageGroup.add(gRoof);
  const gTrim = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.25, 0.35, 46.2)),
    accentAmberMat,
  );
  gTrim.position.set(4.3, 4.15, 0);
  garageGroup.add(gTrim);
  for (let bay = -18; bay <= 18; bay += 9) {
    const door = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 3.1, 6.2)),
      darkMetalMat,
    );
    door.position.set(4.25, 1.5, bay);
    garageGroup.add(door);
  }
  startGroup.add(garageGroup);

  // Spectator Grandstands on opposite side
  const standGroup = new THREE.Group();
  standGroup.position.set(roadHalfW + 8.5, 0, -18);
  const standStepMat = track(
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.78 }),
  );
  const canopyMat = track(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 }),
  );
  for (let tier = 0; tier < 5; tier++) {
    const step = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.1, 0.85, 52)),
      standStepMat,
    );
    step.position.set(tier * 1.6, 0.6 + tier * 0.9, 0);
    step.castShadow = !isSoftwareGl;
    standGroup.add(step);
  }
  const canopy = new THREE.Mesh(track(new THREE.BoxGeometry(9.6, 0.35, 54)), canopyMat);
  canopy.position.set(3.4, 7.6, 0);
  canopy.rotation.z = -0.14;
  standGroup.add(canopy);
  for (const pz of [-22, 0, 22]) {
    const pillar = new THREE.Mesh(track(new THREE.BoxGeometry(0.35, 7.4, 0.35)), steelMat);
    pillar.position.set(7.2, 3.7, pz);
    standGroup.add(pillar);
  }
  startGroup.add(standGroup);

  // --- 4. Highway Guardrails, Curve Chevron Warning Signs & Streetlamps (InstancedMesh) ---
  const guardrailGeo = track(new THREE.BoxGeometry(0.24, 0.62, 5.4));
  const guardrailMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.guardrailMap,
      roughness: 0.45,
      metalness: 0.65,
    }),
  );
  const postGeo = track(new THREE.CylinderGeometry(0.08, 0.09, 1.05, 8));
  postGeo.translate(0, 0.52, 0);
  const postMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, metalness: 0.25 }),
  );

  const railTransforms: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  const postPositions: Array<[number, number, number]> = [];
  const signTransforms: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  const pts = world.roadPoints;

  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const next2 = pts[(i + 2) % pts.length];

    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const tx = dx / len;
    const tz = dz / len;
    const nx = -tz;
    const nz = tx;
    const segYaw = Math.atan2(tx, tz);

    // Delineator posts every 3rd sample (skip highway/trail intersections)
    if (i % 3 === 0) {
      for (const side of [-1, 1]) {
        const px = curr.x + nx * (roadHalfW + 1.0) * side;
        const pz = curr.z + nz * (roadHalfW + 1.0) * side;
        const fac = getTerrainHeightAndFactors(px, pz, mapId);
        if (fac.cityRoadFactor > 0.1 || fac.passFactor > 0.1 || fac.trailFactor > 0.25) continue;
        postPositions.push([px, fac.height, pz]);
      }
    }

    // Check curvature for guardrails & warning chevron signs
    const yaw1 = Math.atan2(curr.x - prev.x, curr.z - prev.z);
    const yaw2 = Math.atan2(next2.x - curr.x, next2.z - curr.z);
    let dYaw = yaw2 - yaw1;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;

    const roadH = groundHeightAt(curr.x, curr.z, mapId);
    const isBridgeOrCurve = roadH < config.waterLevel + 3.0 || Math.abs(dYaw) > 0.08;
    if (isBridgeOrCurve && i % 2 === 0) {
      for (const side of [-1, 1]) {
        const rx = curr.x + nx * (roadHalfW + 0.75) * side;
        const rz = curr.z + nz * (roadHalfW + 0.75) * side;
        const fac = getTerrainHeightAndFactors(rx, rz, mapId);
        if (fac.cityRoadFactor > 0.1 || fac.passFactor > 0.1 || fac.trailFactor > 0.25) continue;
        const ry = Math.max(fac.height, roadH) + 0.52;
        railTransforms.push({ x: rx, y: ry, z: rz, yaw: segYaw });
      }
    }

    if (Math.abs(dYaw) > 0.14 && i % 4 === 0) {
      const outside = dYaw > 0 ? 1 : -1;
      const sx = curr.x + nx * (roadHalfW + 2.2) * outside;
      const sz = curr.z + nz * (roadHalfW + 2.2) * outside;
      const fac = getTerrainHeightAndFactors(sx, sz, mapId);
      if (fac.cityRoadFactor > 0.1 || fac.passFactor > 0.1) continue;
      signTransforms.push({
        x: sx,
        y: fac.height + 1.8,
        z: sz,
        yaw: segYaw + (outside > 0 ? -Math.PI * 0.25 : Math.PI * 0.25),
      });
    }
  }

  if (railTransforms.length > 0) {
    const railInst = new THREE.InstancedMesh(guardrailGeo, guardrailMat, railTransforms.length);
    railTransforms.forEach((rt, idx) => {
      dummy.position.set(rt.x, rt.y, rt.z);
      dummy.rotation.set(0, rt.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      railInst.setMatrixAt(idx, dummy.matrix);
    });
    railInst.instanceMatrix.needsUpdate = true;
    railInst.computeBoundingSphere();
    group.add(railInst);
  }

  if (postPositions.length > 0) {
    const postsInst = new THREE.InstancedMesh(postGeo, postMat, postPositions.length);
    postPositions.forEach(([px, py, pz], idx) => {
      dummy.position.set(px, py, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      postsInst.setMatrixAt(idx, dummy.matrix);
    });
    postsInst.instanceMatrix.needsUpdate = true;
    postsInst.computeBoundingSphere();
    group.add(postsInst);
  }

  if (signTransforms.length > 0) {
    const signBoardGeo = track(new THREE.BoxGeometry(1.6, 1.6, 0.12));
    const signBoardMat = track(
      new THREE.MeshStandardMaterial({
        map: textures.chevronSignMap,
        roughness: 0.4,
        metalness: 0.15,
      }),
    );
    const signPoleGeo = track(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6));
    const signInst = new THREE.InstancedMesh(signBoardGeo, signBoardMat, signTransforms.length);
    const signPoleInst = new THREE.InstancedMesh(signPoleGeo, steelMat, signTransforms.length);
    signTransforms.forEach((st, idx) => {
      dummy.position.set(st.x, st.y, st.z);
      dummy.rotation.set(0, st.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      signInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(st.x, st.y - 1.1, st.z);
      dummy.updateMatrix();
      signPoleInst.setMatrixAt(idx, dummy.matrix);
    });
    signInst.instanceMatrix.needsUpdate = true;
    signPoleInst.instanceMatrix.needsUpdate = true;
    signInst.computeBoundingSphere();
    signPoleInst.computeBoundingSphere();
    group.add(signInst);
    group.add(signPoleInst);
  }

  // --- 4b. Reflective Centerline & Lane-Edge Cat-Eye Road Studs & Circuit Floodlights ---
  const studPositions: Array<[number, number, number]> = [];
  const circuitLampPos: Array<{ x: number; y: number; z: number; yaw: number }> = [];
  for (let i = 0; i < pts.length; i += 2) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const dx = next.x - curr.x;
    const dz = next.z - curr.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    for (const laneOffset of [0, -roadHalfW * 0.45, roadHalfW * 0.45]) {
      const sx = curr.x + nx * laneOffset;
      const sz = curr.z + nz * laneOffset;
      const sy = groundHeightAt(sx, sz, mapId, false) + 0.065;
      studPositions.push([sx, sy, sz]);
    }
    if (i % 8 === 0) {
      const lx = curr.x + nx * (roadHalfW + 2.1);
      const lz = curr.z + nz * (roadHalfW + 2.1);
      const fac = getTerrainHeightAndFactors(lx, lz, mapId);
      if (fac.cityRoadFactor < 0.1 && fac.passFactor < 0.1) {
        circuitLampPos.push({ x: lx, y: fac.height, z: lz, yaw: Math.atan2(-nx, -nz) });
      }
    }
  }
  if (studPositions.length > 0) {
    const studGeo = track(new THREE.BoxGeometry(0.28, 0.06, 0.28));
    const studMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      }),
    );
    const studInst = new THREE.InstancedMesh(studGeo, studMat, studPositions.length);
    studPositions.forEach(([sx, sy, sz], idx) => {
      dummy.position.set(sx, sy, sz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      studInst.setMatrixAt(idx, dummy.matrix);
    });
    studInst.instanceMatrix.needsUpdate = true;
    studInst.computeBoundingSphere();
    group.add(studInst);
  }
  if (circuitLampPos.length > 0) {
    const cPoleGeo = track(new THREE.CylinderGeometry(0.14, 0.22, 9.2, 7));
    cPoleGeo.translate(0, 4.6, 0);
    const cHeadGeo = track(new THREE.BoxGeometry(0.55, 0.28, 1.5));
    const cHeadMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        emissive: 0xfef3c7,
        emissiveIntensity: 1.65,
        roughness: 0.2,
      }),
    );
    const cPoleInst = new THREE.InstancedMesh(cPoleGeo, steelMat, circuitLampPos.length);
    const cHeadInst = new THREE.InstancedMesh(cHeadGeo, cHeadMat, circuitLampPos.length);
    circuitLampPos.forEach((lp, idx) => {
      dummy.position.set(lp.x, lp.y - 0.1, lp.z);
      dummy.rotation.set(0, lp.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      cPoleInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(
        lp.x + Math.sin(lp.yaw) * 0.75,
        lp.y + 9.0,
        lp.z + Math.cos(lp.yaw) * 0.75,
      );
      dummy.updateMatrix();
      cHeadInst.setMatrixAt(idx, dummy.matrix);
    });
    cPoleInst.instanceMatrix.needsUpdate = true;
    cHeadInst.instanceMatrix.needsUpdate = true;
    cPoleInst.computeBoundingSphere();
    cHeadInst.computeBoundingSphere();
    group.add(cPoleInst);
    group.add(cHeadInst);
  }

  // --- 5. Giant Animated Wind Turbines & Forest Watchtowers ---
  const turbineRotors: THREE.Group[] = [];
  const turbineTowerGeo = track(new THREE.CylinderGeometry(0.42, 0.95, 28, 10));
  turbineTowerGeo.translate(0, 14, 0);
  const turbineNacelleGeo = track(new THREE.BoxGeometry(1.4, 1.4, 3.2));
  const turbineBladeGeo = track(new THREE.BoxGeometry(0.45, 9.8, 0.12));
  turbineBladeGeo.translate(0, 4.9, 0);
  const turbineMat = track(
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.2 }),
  );
  for (const wt of world.windTurbines) {
    const wy = groundHeightAt(wt.x, wt.z, mapId);
    const tGroup = new THREE.Group();
    tGroup.position.set(wt.x, wy - 0.3, wt.z);
    tGroup.rotation.y = (wt.x * 0.02) % (Math.PI * 2);

    const tower = new THREE.Mesh(turbineTowerGeo, turbineMat);
    tower.castShadow = !isSoftwareGl;
    tGroup.add(tower);

    const nacelle = new THREE.Mesh(turbineNacelleGeo, turbineMat);
    nacelle.position.set(0, 28, 0.6);
    tGroup.add(nacelle);

    const rotor = new THREE.Group();
    rotor.position.set(0, 28, 2.25);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(turbineBladeGeo, turbineMat);
      blade.rotation.z = (b * Math.PI * 2) / 3;
      rotor.add(blade);
    }
    tGroup.add(rotor);
    turbineRotors.push(rotor);
    group.add(tGroup);
  }

  // Wooden Watchtowers
  const wtTimberMat = track(
    new THREE.MeshStandardMaterial({ color: 0x6b4c35, map: textures.barkMap, roughness: 0.85 }),
  );
  const wtRoofMat = track(new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 }));
  for (const tower of world.watchtowers) {
    const ty = groundHeightAt(tower.x, tower.z, mapId);
    const wtGroup = new THREE.Group();
    wtGroup.position.set(tower.x, ty - 0.2, tower.z);
    for (const lx of [-1.4, 1.4]) {
      for (const lz of [-1.4, 1.4]) {
        const leg = new THREE.Mesh(track(new THREE.CylinderGeometry(0.14, 0.2, 10.5, 6)), wtTimberMat);
        leg.position.set(lx, 5.2, lz);
        wtGroup.add(leg);
      }
    }
    const deck = new THREE.Mesh(track(new THREE.BoxGeometry(4.2, 0.4, 4.2)), wtTimberMat);
    deck.position.y = 8.4;
    wtGroup.add(deck);
    const cabin = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 2.3, 3.2)), wtTimberMat);
    cabin.position.y = 9.75;
    wtGroup.add(cabin);
    const roof = new THREE.Mesh(track(new THREE.ConeGeometry(2.8, 1.9, 4)), wtRoofMat);
    roof.position.y = 11.8;
    roof.rotation.y = Math.PI / 4;
    wtGroup.add(roof);
    group.add(wtGroup);
  }

  // --- 6. Lake / Bay / River Reflective Water Plane ---
  const waterUniforms = { uTime: { value: 0 } };
  const waterGeo = track(new THREE.PlaneGeometry(540, 480, 40, 40));
  waterGeo.rotateX(-Math.PI / 2);
  const waterMaterial = track(
    new THREE.MeshStandardMaterial({
      color: config.colors.water,
      roughness: 0.08,
      metalness: 0.35,
      envMapIntensity: 1.35,
      transparent: true,
      opacity: 0.86,
    }),
  );
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      transformed.y += sin(transformed.x * 0.18 + uTime * 1.8) * 0.11
                     + cos(transformed.z * 0.24 - uTime * 1.4) * 0.09
                     + sin((transformed.x + transformed.z) * 0.35 + uTime * 2.3) * 0.04;
      `,
    );
  };
  const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
  waterMesh.position.set(-25, config.waterLevel, -30);
  group.add(waterMesh);

  // --- 7. Multi-Part Trees (Pine, SnowPine, Oak, Cypress, Palm) & Boulders (InstancedMesh) ---
  const pines = world.obstacles.filter((o) => o.kind === 'pine' || o.kind === 'snowPine');
  const oaks = world.obstacles.filter((o) => o.kind === 'oak');
  const cypresses = world.obstacles.filter((o) => o.kind === 'cypress');
  const palms = world.obstacles.filter((o) => o.kind === 'palm');
  const rocks = world.obstacles.filter((o) => o.kind === 'rock' || o.kind === 'boulder');

  const barkMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.barkMap,
      roughness: 0.94,
      envMapIntensity: 0.2,
    }),
  );
  const pineLeafMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      envMapIntensity: 0.22,
    }),
  );
  const oakLeafMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      envMapIntensity: 0.24,
      flatShading: true,
    }),
  );
  const rockMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.04,
      envMapIntensity: 0.25,
      flatShading: true,
    }),
  );

  if (pines.length > 0) {
    const trunkGeo = track(new THREE.CylinderGeometry(0.18, 0.38, 4.2, 7));
    trunkGeo.translate(0, 2.1, 0);
    const tier1Geo = track(new THREE.ConeGeometry(2.35, 4.1, 8));
    tier1Geo.translate(0, 4.4, 0);
    const tier2Geo = track(new THREE.ConeGeometry(1.78, 3.6, 8));
    tier2Geo.translate(0, 6.4, 0);
    const tier3Geo = track(new THREE.ConeGeometry(1.12, 2.9, 8));
    tier3Geo.translate(0, 8.3, 0);

    const instTrunk = new THREE.InstancedMesh(trunkGeo, barkMat, pines.length);
    const instT1 = new THREE.InstancedMesh(tier1Geo, pineLeafMat, pines.length);
    const instT2 = new THREE.InstancedMesh(tier2Geo, pineLeafMat, pines.length);
    const instT3 = new THREE.InstancedMesh(tier3Geo, pineLeafMat, pines.length);

    const pColor = new THREE.Color();
    pines.forEach((p, idx) => {
      const s = p.height / 10.5;
      dummy.position.set(p.x, p.y - 0.15, p.z);
      dummy.rotation.set(
        ((p.id % 7) - 3) * 0.015,
        (p.id * 1.37) % (Math.PI * 2),
        ((p.id % 5) - 2) * 0.015,
      );
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      instTrunk.setMatrixAt(idx, dummy.matrix);
      instT1.setMatrixAt(idx, dummy.matrix);
      instT2.setMatrixAt(idx, dummy.matrix);
      instT3.setMatrixAt(idx, dummy.matrix);

      const tint = (p.id % 11) / 11;
      if (p.kind === 'snowPine') {
        pColor.setHSL(0.38, 0.25, 0.2 + tint * 0.06);
        instT1.setColorAt(idx, pColor);
        instT2.setColorAt(idx, pColor.clone().lerp(colSnow, 0.45));
        instT3.setColorAt(idx, pColor.clone().lerp(colSnow, 0.85));
      } else {
        pColor.setHSL(0.35 + tint * 0.06, 0.48 + tint * 0.12, 0.15 + tint * 0.08);
        instT1.setColorAt(idx, pColor);
        pColor.offsetHSL(0, 0, 0.025);
        instT2.setColorAt(idx, pColor);
        pColor.offsetHSL(0, 0, 0.035);
        instT3.setColorAt(idx, pColor);
      }
    });

    [instTrunk, instT1, instT2, instT3].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      group.add(m);
    });
  }

  if (oaks.length > 0) {
    const oTrunkGeo = track(new THREE.CylinderGeometry(0.24, 0.48, 3.6, 8));
    oTrunkGeo.translate(0, 1.8, 0);
    const warpCrown = (geo: THREE.BufferGeometry) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i);
        const vy = p.getY(i);
        const vz = p.getZ(i);
        const f = 0.86 + 0.24 * Math.sin(vx * 2.3 + vy * 3.1 + vz * 1.9);
        p.setXYZ(i, vx * f, vy * f * 0.88, vz * f);
      }
      geo.computeVertexNormals();
      return geo;
    };
    const crownAGeo = track(warpCrown(new THREE.IcosahedronGeometry(2.1, 1)));
    crownAGeo.translate(0, 4.9, 0);
    const crownBGeo = track(warpCrown(new THREE.IcosahedronGeometry(1.55, 1)));
    crownBGeo.translate(1.1, 4.4, 0.6);
    const crownCGeo = track(warpCrown(new THREE.IcosahedronGeometry(1.45, 1)));
    crownCGeo.translate(-1.05, 4.5, -0.55);

    const instOakTrunk = new THREE.InstancedMesh(oTrunkGeo, barkMat, oaks.length);
    const instCA = new THREE.InstancedMesh(crownAGeo, oakLeafMat, oaks.length);
    const instCB = new THREE.InstancedMesh(crownBGeo, oakLeafMat, oaks.length);
    const instCC = new THREE.InstancedMesh(crownCGeo, oakLeafMat, oaks.length);

    const oColor = new THREE.Color();
    oaks.forEach((o, idx) => {
      const s = o.height / 8.2;
      dummy.position.set(o.x, o.y - 0.15, o.z);
      dummy.rotation.set(0, (o.id * 2.13) % (Math.PI * 2), 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      instOakTrunk.setMatrixAt(idx, dummy.matrix);
      instCA.setMatrixAt(idx, dummy.matrix);
      instCB.setMatrixAt(idx, dummy.matrix);
      instCC.setMatrixAt(idx, dummy.matrix);

      const tint = (o.id % 13) / 13;
      oColor.setHSL(0.24 + tint * 0.08, 0.5, 0.2 + tint * 0.08);
      instCA.setColorAt(idx, oColor);
      instCB.setColorAt(idx, oColor.clone().offsetHSL(-0.02, 0, 0.025));
      instCC.setColorAt(idx, oColor.clone().offsetHSL(0.02, 0, -0.02));
    });

    [instOakTrunk, instCA, instCB, instCC].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      group.add(m);
    });
  }

  if (cypresses.length > 0) {
    const cTrunkGeo = track(new THREE.CylinderGeometry(0.16, 0.34, 3.4, 7));
    cTrunkGeo.translate(0, 1.7, 0);
    const cBodyGeo = track(new THREE.CylinderGeometry(0.55, 1.45, 9.5, 8));
    cBodyGeo.translate(0, 6.4, 0);
    const instCTrunk = new THREE.InstancedMesh(cTrunkGeo, barkMat, cypresses.length);
    const instCBody = new THREE.InstancedMesh(cBodyGeo, pineLeafMat, cypresses.length);
    const cCol = new THREE.Color();
    cypresses.forEach((c, idx) => {
      const s = c.height / 11;
      dummy.position.set(c.x, c.y - 0.15, c.z);
      dummy.rotation.set(0, c.id * 1.1, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      instCTrunk.setMatrixAt(idx, dummy.matrix);
      instCBody.setMatrixAt(idx, dummy.matrix);
      cCol.setHSL(0.32, 0.52, 0.18 + ((c.id % 7) / 7) * 0.07);
      instCBody.setColorAt(idx, cCol);
    });
    [instCTrunk, instCBody].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      group.add(m);
    });
  }

  if (rocks.length > 0) {
    const rockGeo = track(new THREE.DodecahedronGeometry(1.0, 1));
    const rPos = rockGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const warp = 0.84 + 0.26 * Math.sin(vx * 3.1 + vy * 2.7 + vz * 4.3);
      rPos.setXYZ(i, vx * warp, vy * warp * 0.74, vz * warp);
    }
    rockGeo.computeVertexNormals();

    const instRocks = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
    instRocks.receiveShadow = !isSoftwareGl;

    const rColor = new THREE.Color();
    rocks.forEach((rk, idx) => {
      dummy.position.set(rk.x, rk.y + rk.height * 0.18, rk.z);
      dummy.rotation.set((rk.id % 5) * 0.4, rk.id * 1.1, (rk.id % 3) * 0.3);
      dummy.scale.set(rk.radius * 1.15, rk.height * 0.68, rk.radius * 0.95);
      dummy.updateMatrix();
      instRocks.setMatrixAt(idx, dummy.matrix);

      if (mapId === 'canyon') {
        const shade = 0.72 + ((rk.id % 9) / 9) * 0.25;
        rColor.copy(colRock).multiplyScalar(shade);
      } else {
        const shade = 0.38 + ((rk.id % 9) / 9) * 0.22;
        rColor.setRGB(shade, shade * 1.01, shade * 1.04);
      }
      instRocks.setColorAt(idx, rColor);
    });
    instRocks.instanceMatrix.needsUpdate = true;
    if (instRocks.instanceColor) instRocks.instanceColor.needsUpdate = true;
    instRocks.computeBoundingSphere();
    group.add(instRocks);
  }

  if (palms.length > 0) {
    const pTrunkGeo = track(new THREE.CylinderGeometry(0.18, 0.34, 10.5, 7));
    pTrunkGeo.translate(0, 5.25, 0);
    const frondParts: THREE.BufferGeometry[] = [];
    for (let f = 0; f < 6; f++) {
      const ang = (f / 6) * Math.PI * 2;
      const frond = new THREE.ConeGeometry(0.82, 4.4, 4);
      frond.scale(1.15, 1.0, 0.22);
      frond.rotateX(Math.PI * 0.62);
      frond.translate(0, 0.2, 2.0);
      frond.rotateY(ang);
      frond.translate(0, 10.4, 0);
      frondParts.push(frond);
    }
    const pCrownGeo = track(mergeGeometries(frondParts));
    frondParts.forEach((f) => f.dispose());

    const pInstTrunk = new THREE.InstancedMesh(pTrunkGeo, barkMat, palms.length);
    const pInstCrown = new THREE.InstancedMesh(pCrownGeo, oakLeafMat, palms.length);
    const palmColor = new THREE.Color();
    palms.forEach((pm, idx) => {
      const s = pm.height / 11.5;
      dummy.position.set(pm.x, pm.y - 0.15, pm.z);
      dummy.rotation.set(((pm.id % 5) - 2) * 0.03, (pm.id * 1.1) % (Math.PI * 2), 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      pInstTrunk.setMatrixAt(idx, dummy.matrix);
      pInstCrown.setMatrixAt(idx, dummy.matrix);
      palmColor.setHSL(0.28 + ((pm.id % 5) / 5) * 0.04, 0.56, 0.25);
      pInstCrown.setColorAt(idx, palmColor);
    });
    [pInstTrunk, pInstCrown].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      group.add(m);
    });
  }

  // --- 8. Wind-Swaying Grassland / Scrub Tufts (InstancedMesh + Wind Shader) ---
  const grassUniforms = { uTime: { value: 0 }, uWind: { value: 0.2 } };
  const grassGeo = track(createGrassTuftGeometry());
  const grassMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.16,
      side: THREE.DoubleSide,
    }),
  );
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = grassUniforms.uTime;
    shader.uniforms.uWind = grassUniforms.uWind;
    shader.vertexShader = `uniform float uTime;\nuniform float uWind;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float sway = sin(uTime * (2.2 + uWind * 3.0) + position.x * 1.5 + position.z * 1.5)
                 * (0.06 + uWind * 0.22) * max(0.0, position.y);
      transformed.x += sway;
      `,
    );
  };

  const grassCoords: { x: number; y: number; z: number; s: number; rot: number; col: number }[] = [];
  let gSeed = 445566;
  const gRand = () => {
    gSeed = (Math.imul(gSeed, 1664525) + 1013904223) >>> 0;
    return gSeed / 4294967296;
  };
  for (let i = 0; i < 2000 && grassCoords.length < 900; i++) {
    const gx = (gRand() - 0.5) * 980;
    const gz = (gRand() - 0.5) * 980;
    const sample = getTerrainSample(gx, gz, mapId);
    if (
      (sample.surface === 'grass' || sample.surface === 'forest' || (mapId === 'canyon' && sample.surface === 'sand')) &&
      sample.roadFactor < 0.02 &&
      sample.trailFactor < 0.04 &&
      sample.slope < 0.3 &&
      sample.height > config.waterLevel + 0.5
    ) {
      grassCoords.push({
        x: gx,
        y: sample.height - 0.05,
        z: gz,
        s: 0.95 + gRand() * 0.95,
        rot: gRand() * Math.PI * 2,
        col: gRand(),
      });
    }
  }
  const instGrass = new THREE.InstancedMesh(grassGeo, grassMaterial, Math.max(1, grassCoords.length));
  const gCol = new THREE.Color();
  grassCoords.forEach((g, idx) => {
    dummy.position.set(g.x, g.y, g.z);
    dummy.rotation.set(0, g.rot, 0);
    dummy.scale.set(g.s, g.s, g.s);
    dummy.updateMatrix();
    instGrass.setMatrixAt(idx, dummy.matrix);
    gCol.copy(colGrassA).lerp(colGrassB, g.col);
    instGrass.setColorAt(idx, gCol);
  });
  instGrass.instanceMatrix.needsUpdate = true;
  if (instGrass.instanceColor) instGrass.instanceColor.needsUpdate = true;
  instGrass.computeBoundingSphere();
  group.add(instGrass);

  // --- 9. Stunt Ramps ---
  const rampDeckMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.rampMap,
      roughness: 0.58,
      metalness: 0.25,
    }),
  );
  const rampSteelMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.45,
      metalness: 0.72,
    }),
  );
  for (const r of world.ramps) {
    const rGroup = new THREE.Group();
    const baseY = groundHeightAt(r.x, r.z, mapId, false) + (r.baseYOffset ?? 0);
    rGroup.position.set(r.x, baseY, r.z);
    rGroup.rotation.y = r.yaw;

    const rShape = new THREE.Shape();
    rShape.moveTo(-r.length * 0.5, -0.35);
    rShape.lineTo(r.length * 0.5, -0.35);
    rShape.lineTo(r.length * 0.5, r.height);
    rShape.quadraticCurveTo(0, r.height * 0.35, -r.length * 0.5, 0.04);
    rShape.closePath();

    const wedgeGeo = track(
      new THREE.ExtrudeGeometry(rShape, {
        depth: r.width,
        bevelEnabled: false,
        curveSegments: 12,
      }),
    );
    wedgeGeo.translate(0, 0, -r.width * 0.5);
    wedgeGeo.rotateY(-Math.PI / 2);
    const wedge = new THREE.Mesh(wedgeGeo, rampDeckMat);
    wedge.castShadow = !isSoftwareGl;
    wedge.receiveShadow = !isSoftwareGl;
    rGroup.add(wedge);

    const railGeo = track(new THREE.BoxGeometry(0.22, 0.36, r.length));
    const ledEdgeMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
      }),
    );
    for (const sx of [-r.width * 0.5, r.width * 0.5]) {
      const rail = new THREE.Mesh(railGeo, rampSteelMat);
      rail.position.set(sx, r.height * 0.48, 0);
      rail.rotation.x = -Math.atan2(r.height, r.length);
      rGroup.add(rail);

      const led = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.14, r.length)), ledEdgeMat);
      led.position.set(sx, r.height * 0.58, 0);
      led.rotation.x = -Math.atan2(r.height, r.length);
      rGroup.add(led);
    }

    // Steel lip support columns at takeoff edge
    const colGeo = track(new THREE.CylinderGeometry(0.22, 0.28, r.height + 0.5, 8));
    for (const sx of [-r.width * 0.42, 0, r.width * 0.42]) {
      const col = new THREE.Mesh(colGeo, rampSteelMat);
      col.position.set(sx, r.height * 0.46, r.length * 0.44);
      rGroup.add(col);
    }

    group.add(rGroup);
  }

  // --- 10. Scenic Exploration Beacons ---
  const beacons: BeaconVisual[] = [];
  const plinthGeo = track(new THREE.CylinderGeometry(2.6, 3.1, 0.45, 16));
  const ringGeo = track(new THREE.TorusGeometry(4.2, 0.14, 8, 32));
  ringGeo.rotateX(Math.PI / 2);
  const crystalGeo = track(new THREE.OctahedronGeometry(0.95, 0));
  const beamGeo = track(new THREE.CylinderGeometry(0.32, 0.95, 48, 16, 1, true));
  beamGeo.translate(0, 24, 0);

  const plinthMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.72,
      metalness: 0.35,
    }),
  );

  for (const b of world.beacons) {
    const by = groundHeightAt(b.x, b.z, mapId);
    const bGroup = new THREE.Group();
    bGroup.position.set(b.x, by, b.z);

    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.15;
    bGroup.add(plinth);

    const ringMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
        roughness: 0.25,
      }),
    );
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.16;
    bGroup.add(ringMesh);

    const crystalMesh = new THREE.Mesh(crystalGeo, ringMat);
    crystalMesh.position.y = 2.8;
    bGroup.add(crystalMesh);

    const beamMat = track(
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    bGroup.add(beamMesh);

    group.add(bGroup);
    beacons.push({
      id: b.id,
      x: b.x,
      z: b.z,
      radius: b.radius,
      ringMesh,
      beamMesh,
      crystalMesh,
      discovered: false,
    });
  }

  // --- 11. Collectible Spinning Gold Coins (InstancedMesh) ---
  const coinGeo = track(new THREE.CylinderGeometry(0.95, 0.95, 0.22, 18));
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.72,
      metalness: 0.88,
      roughness: 0.18,
    }),
  );
  const coinRingGeo = track(new THREE.TorusGeometry(0.62, 0.08, 6, 16));
  const coinRingMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.95,
      metalness: 0.85,
      roughness: 0.15,
    }),
  );

  const coinCount = Math.max(1, world.coins.length);
  const coinInst = new THREE.InstancedMesh(coinGeo, coinMat, coinCount);
  const coinRimInst = new THREE.InstancedMesh(coinRingGeo, coinRingMat, coinCount);
  const coinCollected = new Uint8Array(coinCount);
  for (let i = 0; i < world.coins.length; i++) {
    const c = world.coins[i];
    dummy.position.set(c.x, c.y, c.z);
    dummy.rotation.set(0, i * 0.5, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    coinInst.setMatrixAt(i, dummy.matrix);
    coinRimInst.setMatrixAt(i, dummy.matrix);
  }
  coinInst.instanceMatrix.needsUpdate = true;
  coinRimInst.instanceMatrix.needsUpdate = true;
  coinInst.computeBoundingSphere();
  coinRimInst.computeBoundingSphere();
  group.add(coinInst);
  group.add(coinRimInst);

  let lastCoinAnimTime = -1;

  return {
    group,
    roadMaterial,
    waterMaterial,
    grassMaterial,
    beacons,
    collectCoin: (index: number) => {
      if (index < 0 || index >= world.coins.length || coinCollected[index]) return;
      coinCollected[index] = 1;
      dummy.position.set(0, -500, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      coinInst.setMatrixAt(index, dummy.matrix);
      coinRimInst.setMatrixAt(index, dummy.matrix);
      coinInst.instanceMatrix.needsUpdate = true;
      coinRimInst.instanceMatrix.needsUpdate = true;
    },
    resetCoins: () => {
      coinCollected.fill(0);
      for (let i = 0; i < world.coins.length; i++) {
        const c = world.coins[i];
        dummy.position.set(c.x, c.y, c.z);
        dummy.rotation.set(0, i * 0.5, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        coinInst.setMatrixAt(i, dummy.matrix);
        coinRimInst.setMatrixAt(i, dummy.matrix);
      }
      coinInst.instanceMatrix.needsUpdate = true;
      coinRimInst.instanceMatrix.needsUpdate = true;
    },
    setCountdownLights: (phase, litCount = 5) => {
      for (let i = 0; i < countdownLightMats.length; i++) {
        const m = countdownLightMats[i];
        if (phase === 'off') {
          m.color.setHex(0x334155);
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 0;
        } else if (phase === 'go') {
          m.color.setHex(0x22c55e);
          m.emissive.setHex(0x22c55e);
          m.emissiveIntensity = 3.2;
        } else if (phase === 'amber') {
          m.color.setHex(0xf59e0b);
          m.emissive.setHex(0xf59e0b);
          m.emissiveIntensity = 2.6;
        } else {
          const lit = i < litCount;
          m.color.setHex(lit ? 0xef4444 : 0x334155);
          m.emissive.setHex(lit ? 0xef4444 : 0x000000);
          m.emissiveIntensity = lit ? 3.2 : 0;
        }
      }
    },
    updateEnvironmentVisuals: (weather: WeatherComputed, elapsed: number) => {
      waterUniforms.uTime.value = elapsed;
      grassUniforms.uTime.value = elapsed;
      grassUniforms.uWind.value = weather.windStrength;

      roadMaterial.roughness = lerp(0.72, 0.16, weather.wetness);
      roadMaterial.envMapIntensity = lerp(0.36, 1.05, weather.wetness);
      highwayMaterial.roughness = lerp(0.74, 0.16, weather.wetness);
      highwayMaterial.envMapIntensity = lerp(0.34, 1.05, weather.wetness);

      for (const b of beacons) {
        b.crystalMesh.rotation.y = elapsed * 1.4;
        b.crystalMesh.position.y = 2.8 + Math.sin(elapsed * 2.2) * 0.35;
      }

      if (elapsed - lastCoinAnimTime >= 0.05) {
        lastCoinAnimTime = elapsed;
        let coinsDirty = false;
        for (let i = 0; i < world.coins.length; i++) {
          if (coinCollected[i]) continue;
          coinsDirty = true;
          const c = world.coins[i];
          dummy.position.set(c.x, c.y + Math.sin(elapsed * 3.0 + i) * 0.22, c.z);
          dummy.rotation.set(0, elapsed * 2.4 + i * 0.5, 0);
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          coinInst.setMatrixAt(i, dummy.matrix);
          coinRimInst.setMatrixAt(i, dummy.matrix);
        }
        if (coinsDirty) {
          coinInst.instanceMatrix.needsUpdate = true;
          coinRimInst.instanceMatrix.needsUpdate = true;
        }
      }

      const bladeSpeed = 1.2 + weather.windStrength * 2.6;
      for (let i = 0; i < turbineRotors.length; i++) {
        turbineRotors[i].rotation.z = elapsed * bladeSpeed + i * 0.7;
      }
      lsStructures.updateAnimatedProps(elapsed);
    },
    markBeaconDiscovered: (id: string) => {
      const b = beacons.find((item) => item.id === id);
      if (!b || b.discovered) return;
      b.discovered = true;
      const rMat = b.ringMesh.material as THREE.MeshStandardMaterial;
      rMat.color.setHex(0x10b981);
      rMat.emissive.setHex(0x10b981);
      const bmMat = b.beamMesh.material as THREE.MeshBasicMaterial;
      bmMat.color.setHex(0x34d399);
      bmMat.opacity = 0.08;
    },
    resetBeacons: () => {
      for (const b of beacons) {
        b.discovered = false;
        const rMat = b.ringMesh.material as THREE.MeshStandardMaterial;
        rMat.color.setHex(0xf59e0b);
        rMat.emissive.setHex(0xf59e0b);
        const bmMat = b.beamMesh.material as THREE.MeshBasicMaterial;
        bmMat.color.setHex(0xfbbf24);
        bmMat.opacity = 0.16;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
