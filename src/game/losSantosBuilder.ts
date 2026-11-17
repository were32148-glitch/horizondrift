import * as THREE from 'three';
import { getTerrainHeightAndFactors, groundHeightAt } from './terrain';
import type { MapWorldData } from './terrain';
import type { ProceduralTexturePack } from './textures';
import type { MapId } from './types';

function createSignCanvasTexture(text: string, bg: string, fg: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = fg;
  ctx.font = '900 72px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildLosSantosAndStructures(
  world: MapWorldData,
  mapId: MapId,
  textures: ProceduralTexturePack,
  isSoftwareGl: boolean,
  roadMaterial: THREE.MeshStandardMaterial,
  buildSplineRibbonGeometry: (
    points: Array<{ x: number; z: number }>,
    closed: boolean,
    width: number,
    yOffset: number,
    uvTileLength: number,
    mapId: MapId,
  ) => THREE.BufferGeometry,
  track: <T extends { dispose: () => void }>(item: T) => T,
): {
  group: THREE.Group;
  updateAnimatedProps: (elapsed: number) => void;
} {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();

  const concreteMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.86,
      metalness: 0.08,
    }),
  );
  const darkConcreteMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.06,
    }),
  );
  const steelMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.42,
      metalness: 0.78,
    }),
  );
  const woodDeckMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x8b6239,
      map: textures.barkMap,
      roughness: 0.88,
    }),
  );
  const barrierRedMat = track(
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 }),
  );
  const barrierWhiteMat = track(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72 }),
  );

  // --- 1. Great Divide Mountain Pass Highways & Dense Wildlands/Los Santos Boulevard Grid ---
  for (const passPts of [world.westPassPoints, world.eastPassPoints]) {
    const pGeo = track(buildSplineRibbonGeometry(passPts, false, 36.0, 0.055, 22, mapId));
    const pMesh = new THREE.Mesh(pGeo, roadMaterial);
    pMesh.receiveShadow = !isSoftwareGl;
    pMesh.matrixAutoUpdate = false;
    pMesh.updateMatrix();
    group.add(pMesh);
  }

  for (const lsRoad of world.losSantosRoads) {
    const first = lsRoad[0];
    const last = lsRoad[lsRoad.length - 1];
    const isNS = Math.abs(last.z - first.z) >= Math.abs(last.x - first.x);
    const cGeo = track(
      buildSplineRibbonGeometry(lsRoad, false, 38.0, isNS ? 0.064 : 0.058, 22, mapId),
    );
    const cMesh = new THREE.Mesh(cGeo, roadMaterial);
    cMesh.receiveShadow = !isSoftwareGl;
    cMesh.matrixAutoUpdate = false;
    cMesh.updateMatrix();
    group.add(cMesh);
  }

  // Sidewalk curb plazas around Downtown core
  const plazaGeo = track(new THREE.BoxGeometry(740, 0.35, 760));
  const plazaMat = track(new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.92 }));
  const dtPlaza = new THREE.Mesh(plazaGeo, plazaMat);
  dtPlaza.position.set(0, 3.28, -1840);
  dtPlaza.receiveShadow = !isSoftwareGl;
  dtPlaza.matrixAutoUpdate = false;
  dtPlaza.updateMatrix();
  group.add(dtPlaza);

  // --- 2. Pacific Ocean Water at Vespucci Beach ---
  const oceanUniforms = { uTime: { value: 0 } };
  const oceanGeo = track(new THREE.PlaneGeometry(1800, 2200, 36, 36));
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x067294,
      roughness: 0.08,
      metalness: 0.35,
      envMapIntensity: 1.35,
      transparent: true,
      opacity: 0.88,
    }),
  );
  oceanMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = oceanUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      transformed.y += sin(transformed.x * 0.06 + uTime * 1.5) * 0.16
                     + cos(transformed.z * 0.08 - uTime * 1.1) * 0.14;
      `,
    );
  };
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.set(-1820, -2.0, -1850);
  oceanMesh.matrixAutoUpdate = false;
  oceanMesh.updateMatrix();
  group.add(oceanMesh);

  // --- 3. Elevated Decks (Olympic Freeway Viaduct + Sloped On-Ramps, Del Perro Pier, Canal Steel Arch Bridges) ---
  for (const d of world.elevatedDecks) {
    if (d.slopeStartY !== undefined && d.slopeEndY !== undefined) {
      // Sloped On-Ramp / Pier Approach
      const rise = d.slopeEndY - d.slopeStartY;
      const run = d.halfL * 2;
      const len = Math.hypot(run, rise);
      const slopeAngle = Math.atan2(rise, run);
      const midY = (d.slopeStartY + d.slopeEndY) * 0.5;
      const deckGeo = track(new THREE.BoxGeometry(d.halfW * 2, d.thickness, len));
      const mat = d.surface === 'wood' ? woodDeckMat : roadMaterial;
      const mesh = new THREE.Mesh(deckGeo, mat);
      mesh.position.set(d.x, midY - d.thickness * 0.5, d.z);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = d.yaw;
      mesh.rotation.x = -slopeAngle;
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = !isSoftwareGl;
      group.add(mesh);

      // Under-ramp concrete support bents
      const bentGeo = track(new THREE.BoxGeometry(d.halfW * 1.4, Math.max(2, midY), 1.8));
      const bent = new THREE.Mesh(bentGeo, darkConcreteMat);
      bent.position.set(d.x, midY * 0.5 - 0.8, d.z);
      bent.rotation.y = d.yaw;
      group.add(bent);
    } else {
      const deckGeo = track(new THREE.BoxGeometry(d.halfW * 2, d.thickness, d.halfL * 2));
      const mat =
        d.surface === 'wood'
          ? woodDeckMat
          : d.surface === 'concrete'
            ? concreteMat
            : roadMaterial;
      const mesh = new THREE.Mesh(deckGeo, mat);
      mesh.position.set(d.x, d.y - d.thickness * 0.5, d.z);
      mesh.rotation.y = d.yaw;
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = !isSoftwareGl;
      group.add(mesh);

      if (d.kind === 'freeway') {
        // Viaduct support Y-pillars spaced along length
        const pillarGeo = track(new THREE.CylinderGeometry(1.15, 1.4, d.y, 10));
        const capGeo = track(new THREE.BoxGeometry(d.halfW * 1.8, 1.3, 2.2));
        for (let offset = -d.halfL + 40; offset <= d.halfL - 40; offset += 75) {
          const px = d.x + Math.sin(d.yaw) * offset;
          const pz = d.z + Math.cos(d.yaw) * offset;
          const pillar = new THREE.Mesh(pillarGeo, concreteMat);
          pillar.position.set(px, d.y * 0.5 - 0.5, pz);
          pillar.castShadow = !isSoftwareGl;
          group.add(pillar);

          const cap = new THREE.Mesh(capGeo, concreteMat);
          cap.position.set(px, d.y - 1.3, pz);
          cap.rotation.y = d.yaw;
          group.add(cap);
        }
      } else if (d.kind === 'pier') {
        // Wooden Pier pilings into ocean
        const pilingGeo = track(new THREE.CylinderGeometry(0.45, 0.5, 9.5, 8));
        for (let offset = -d.halfL + 12; offset <= d.halfL - 12; offset += 24) {
          for (const side of [-d.halfW + 1.8, d.halfW - 1.8]) {
            const px = d.x + Math.sin(d.yaw) * offset + Math.cos(d.yaw) * side;
            const pz = d.z + Math.cos(d.yaw) * offset - Math.sin(d.yaw) * side;
            const pile = new THREE.Mesh(pilingGeo, woodDeckMat);
            pile.position.set(px, d.y - 4.8, pz);
            group.add(pile);
          }
        }
      } else if (d.kind === 'bridge') {
        // Steel Truss Bridge Arches over LS Storm Canal
        const archGeo = track(new THREE.TorusGeometry(24, 0.85, 8, 20, Math.PI));
        for (const side of [-d.halfW - 0.4, d.halfW + 0.4]) {
          const arch = new THREE.Mesh(archGeo, steelMat);
          arch.position.set(d.x + Math.cos(d.yaw) * side, d.y - 0.4, d.z - Math.sin(d.yaw) * side);
          arch.rotation.y = d.yaw + Math.PI / 2;
          group.add(arch);
        }
      }
    }
  }

  // --- 4. Concrete Jersey Barricades, Tire Walls & Shipping Containers (exact 1:1 with colliders!) ---
  const concreteBarriers = world.colliders.filter((c) => c.kind === 'barricade');
  if (concreteBarriers.length > 0) {
    const jGeo = track(new THREE.BoxGeometry(0.95, 1.2, 6.2));
    const instBar = new THREE.InstancedMesh(jGeo, barrierWhiteMat, concreteBarriers.length);
    const col = new THREE.Color();
    concreteBarriers.forEach((b, idx) => {
      const h =
        Math.abs(b.z + 1360) < 25 && Math.abs(b.x) < 570
          ? 12.6
          : Math.abs(b.z + 1820) < 30 && b.x < -975
            ? 4.2
            : groundHeightAt(b.x, b.z, mapId, false);
      dummy.position.set(b.x, h + 0.55, b.z);
      dummy.rotation.set(0, b.yaw, 0);
      dummy.scale.set(1, 1, (b.halfL * 2) / 6.2);
      dummy.updateMatrix();
      instBar.setMatrixAt(idx, dummy.matrix);
      col.setHex(idx % 2 === 0 ? 0xe2e8f0 : 0xef4444);
      instBar.setColorAt(idx, col);
    });
    instBar.instanceMatrix.needsUpdate = true;
    if (instBar.instanceColor) instBar.instanceColor.needsUpdate = true;
    instBar.computeBoundingSphere();
    group.add(instBar);
  }

  const tireWalls = world.colliders.filter((c) => c.kind === 'tirewall');
  if (tireWalls.length > 0) {
    const tireWallMat = track(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.08 }),
    );
    const tGeo = track(new THREE.BoxGeometry(1.5, 1.35, 5.4));
    const instTire = new THREE.InstancedMesh(tGeo, tireWallMat, tireWalls.length);
    const col = new THREE.Color();
    tireWalls.forEach((tw, idx) => {
      const h = groundHeightAt(tw.x, tw.z, mapId, false);
      dummy.position.set(tw.x, h + 0.65, tw.z);
      dummy.rotation.set(0, tw.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      instTire.setMatrixAt(idx, dummy.matrix);
      col.setHex(idx % 2 === 0 ? 0xdc2626 : 0xf8fafc);
      instTire.setColorAt(idx, col);
    });
    instTire.instanceMatrix.needsUpdate = true;
    if (instTire.instanceColor) instTire.instanceColor.needsUpdate = true;
    instTire.computeBoundingSphere();
    group.add(instTire);
  }

  // Stacked Shipping Containers at La Mesa Stunt Park
  const containers = world.colliders.filter((c) => c.kind === 'container');
  const containerColors = [0xdc2626, 0x0284c7, 0xd97706, 0x059669];
  containers.forEach((c, idx) => {
    const h = groundHeightAt(c.x, c.z, mapId, false);
    const cMat = track(
      new THREE.MeshStandardMaterial({
        color: containerColors[idx % containerColors.length],
        roughness: 0.55,
        metalness: 0.45,
      }),
    );
    const cGeo = track(new THREE.BoxGeometry(c.halfW * 2, 3.0, c.halfL * 2));
    const mesh = new THREE.Mesh(cGeo, cMat);
    mesh.position.set(c.x, h + 1.5, c.z);
    mesh.rotation.y = c.yaw;
    mesh.castShadow = !isSoftwareGl;
    group.add(mesh);

    if (c.maxY - c.minY > 5) {
      const upper = new THREE.Mesh(cGeo, barrierRedMat);
      upper.position.set(c.x, h + 4.5, c.z);
      upper.rotation.y = c.yaw + 0.08;
      group.add(upper);
    }
  });

  // --- 5. Downtown Los Santos Skyscrapers & Maze Bank Spire (Shared Material Cache + Rooftop Strobe Beacons) ---
  const glassFacadeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.buildingGlassMap,
      metalness: 0.74,
      roughness: 0.14,
      envMapIntensity: 1.5,
    }),
  );

  const wallMatCache = new Map<number, THREE.MeshStandardMaterial>();
  const getWallMat = (hex: number) => {
    let m = wallMatCache.get(hex);
    if (!m) {
      m = track(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.58, metalness: 0.25 }));
      wallMatCache.set(hex, m);
    }
    return m;
  };
  const glowMatCache = new Map<number, THREE.MeshStandardMaterial>();
  const getGlowMat = (hex: number) => {
    let m = glowMatCache.get(hex);
    if (!m) {
      m = track(
        new THREE.MeshStandardMaterial({
          color: hex,
          emissive: hex,
          emissiveIntensity: 1.4,
          roughness: 0.2,
        }),
      );
      glowMatCache.set(hex, m);
    }
    return m;
  };
  const aviationStrobeMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xff2e43,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    }),
  );
  const strobeGeo = track(new THREE.SphereGeometry(0.9, 8, 6));

  for (const b of world.buildings) {
    const bGroup = new THREE.Group();
    const gy = Math.max(b.baseY, getTerrainHeightAndFactors(b.x, b.z, mapId).height);
    bGroup.position.set(b.x, gy, b.z);
    bGroup.rotation.y = b.yaw;

    const wallMat = getWallMat(b.colorHex);
    const glowMat = getGlowMat(b.accentHex);

    if (b.style === 'mazebank') {
      // Iconic Cylindrical Stepped Maze Bank Spire + Helipad
      const basePodium = new THREE.Mesh(
        track(new THREE.BoxGeometry(b.width, 16, b.depth)),
        wallMat,
      );
      basePodium.position.y = 8;
      bGroup.add(basePodium);

      const lowerShaft = new THREE.Mesh(
        track(new THREE.CylinderGeometry(b.width * 0.42, b.width * 0.45, b.height * 0.65, 20)),
        glassFacadeMat,
      );
      lowerShaft.position.y = b.height * 0.325 + 14;
      lowerShaft.castShadow = !isSoftwareGl;
      bGroup.add(lowerShaft);

      const upperShaft = new THREE.Mesh(
        track(new THREE.CylinderGeometry(b.width * 0.32, b.width * 0.38, b.height * 0.35, 20)),
        wallMat,
      );
      upperShaft.position.y = b.height * 0.8 + 4;
      bGroup.add(upperShaft);

      const crownRing = new THREE.Mesh(
        track(new THREE.TorusGeometry(b.width * 0.33, 1.3, 8, 24)),
        glowMat,
      );
      crownRing.rotation.x = Math.PI / 2;
      crownRing.position.y = b.height - 8;
      bGroup.add(crownRing);

      const helipad = new THREE.Mesh(
        track(new THREE.CylinderGeometry(b.width * 0.3, b.width * 0.3, 1.2, 20)),
        darkConcreteMat,
      );
      helipad.position.y = b.height + 2;
      bGroup.add(helipad);

      const spire = new THREE.Mesh(track(new THREE.CylinderGeometry(0.4, 1.4, 24, 8)), steelMat);
      spire.position.y = b.height + 14;
      bGroup.add(spire);
    } else if (b.style === 'skyscraper' || b.style === 'tower') {
      const core = new THREE.Mesh(
        track(new THREE.BoxGeometry(b.width * 0.92, b.height, b.depth * 0.92)),
        glassFacadeMat,
      );
      core.position.y = b.height * 0.5;
      core.castShadow = !isSoftwareGl;
      bGroup.add(core);

      // Exterior Mullion Frame + Crown Trim
      const frame = new THREE.Mesh(
        track(new THREE.BoxGeometry(b.width, 6, b.depth)),
        wallMat,
      );
      frame.position.y = 3;
      bGroup.add(frame);

      const crown = new THREE.Mesh(
        track(new THREE.BoxGeometry(b.width * 0.84, 5, b.depth * 0.84)),
        wallMat,
      );
      crown.position.y = b.height + 2.5;
      bGroup.add(crown);

      const strip = new THREE.Mesh(
        track(new THREE.BoxGeometry(b.width * 0.88, 1.2, b.depth * 0.88)),
        glowMat,
      );
      strip.position.y = b.height - 2;
      bGroup.add(strip);
    } else if (b.style === 'lifeguard') {
      const stilts = new THREE.Mesh(
        track(new THREE.BoxGeometry(b.width * 0.7, 3.2, b.depth * 0.7)),
        woodDeckMat,
      );
      stilts.position.y = 1.6;
      bGroup.add(stilts);
      const shack = new THREE.Mesh(track(new THREE.BoxGeometry(b.width, 3.2, b.depth)), wallMat);
      shack.position.y = 4.6;
      bGroup.add(shack);
      const roof = new THREE.Mesh(track(new THREE.BoxGeometry(b.width + 1.2, 0.5, b.depth + 1.2)), glowMat);
      roof.position.y = 6.4;
      bGroup.add(roof);
    } else {
      const main = new THREE.Mesh(
        track(new THREE.BoxGeometry(b.width, b.height, b.depth)),
        wallMat,
      );
      main.position.y = b.height * 0.5;
      main.castShadow = !isSoftwareGl;
      bGroup.add(main);

      const band = new THREE.Mesh(
        track(new THREE.BoxGeometry(b.width + 0.5, 1.1, b.depth + 0.5)),
        glowMat,
      );
      band.position.y = b.height - 1.5;
      bGroup.add(band);
    }

    if (b.style === 'mazebank' || b.style === 'skyscraper') {
      const beacon = new THREE.Mesh(strobeGeo, aviationStrobeMat);
      beacon.position.y = b.style === 'mazebank' ? b.height + 26.5 : b.height + 5.8;
      bGroup.add(beacon);
    }

    bGroup.traverse((child) => {
      child.matrixAutoUpdate = false;
      child.updateMatrix();
    });
    group.add(bGroup);
  }

  // --- 6. Giant Iconic "VINEWOOD" Sign in Vinewood Hills ---
  const vwTex = track(createSignCanvasTexture('VINEWOOD', '#0f172a', '#f8fafc'));
  const vwSignY = groundHeightAt(-110, -2890, mapId, false) + 26;
  const vwGroup = new THREE.Group();
  vwGroup.position.set(-110, vwSignY, -2890);

  const vwPanel = new THREE.Mesh(
    track(new THREE.BoxGeometry(240, 48, 4)),
    track(
      new THREE.MeshStandardMaterial({
        map: vwTex,
        emissive: 0xffffff,
        emissiveMap: vwTex,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      }),
    ),
  );
  vwGroup.add(vwPanel);
  for (let px = -105; px <= 105; px += 35) {
    const leg = new THREE.Mesh(track(new THREE.BoxGeometry(2.8, 36, 2.8)), steelMat);
    leg.position.set(px, -28, 0);
    vwGroup.add(leg);
  }
  group.add(vwGroup);

  // --- 7. Del Perro Pier Animated Ferris Wheel (The Pacific Eye) ---
  const ferrisGroup = new THREE.Group();
  ferrisGroup.position.set(-1140, 4.4, -1832);
  for (const sx of [-4, 4]) {
    const legA = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.7, 26, 8)), steelMat);
    legA.position.set(sx, 11, 5);
    legA.rotation.x = 0.25;
    ferrisGroup.add(legA);

    const legB = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.7, 26, 8)), steelMat);
    legB.position.set(sx, 11, -5);
    legB.rotation.x = -0.25;
    ferrisGroup.add(legB);
  }

  const ferrisRotor = new THREE.Group();
  ferrisRotor.position.set(0, 21, 0);
  const wheelMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xfb7185,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    }),
  );
  const wheelRing = new THREE.Mesh(track(new THREE.TorusGeometry(16, 0.45, 8, 32)), wheelMat);
  ferrisRotor.add(wheelRing);

  const gondolaMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.75,
      roughness: 0.3,
    }),
  );
  const spokeGeo = track(new THREE.CylinderGeometry(0.14, 0.14, 32, 6));
  const podGeo = track(new THREE.BoxGeometry(2.2, 2.4, 2.2));
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, steelMat);
    spoke.rotation.z = ang;
    ferrisRotor.add(spoke);

    const pod = new THREE.Mesh(podGeo, gondolaMat);
    pod.position.set(Math.cos(ang) * 16, Math.sin(ang) * 16, 0);
    ferrisRotor.add(pod);
  }
  ferrisGroup.add(ferrisRotor);
  group.add(ferrisGroup);

  // --- 8. Los Santos Highway & Boulevard Streetlights (InstancedMesh, clear of 38m lanes & intersections) ---
  const lampPositions: Array<[number, number, number]> = [];
  for (let z = -1360; z >= -2200; z -= 65) {
    if (
      Math.abs(z + 1460) < 32 ||
      Math.abs(z + 1555) < 32 ||
      Math.abs(z + 1745) < 32 ||
      Math.abs(z + 1840) < 32
    ) {
      continue;
    }
    lampPositions.push([-23.5, groundHeightAt(-23.5, z, mapId, false), z]);
    lampPositions.push([23.5, groundHeightAt(23.5, z, mapId, false), z]);
    lampPositions.push([-943.5, groundHeightAt(-943.5, z, mapId, false), z]);
  }
  if (lampPositions.length > 0) {
    const poleGeo = track(new THREE.CylinderGeometry(0.14, 0.22, 8.5, 6));
    poleGeo.translate(0, 4.25, 0);
    const headGeo = track(new THREE.BoxGeometry(1.4, 0.28, 0.45));
    const headMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xfde047,
        emissiveIntensity: 1.5,
      }),
    );
    const poleInst = new THREE.InstancedMesh(poleGeo, steelMat, lampPositions.length);
    const headInst = new THREE.InstancedMesh(headGeo, headMat, lampPositions.length);
    lampPositions.forEach(([lx, ly, lz], idx) => {
      dummy.position.set(lx, ly, lz);
      dummy.rotation.set(0, lx < 0 ? 0 : Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(lx + (lx < 0 ? 0.65 : -0.65), ly + 8.4, lz);
      dummy.updateMatrix();
      headInst.setMatrixAt(idx, dummy.matrix);
    });
    poleInst.instanceMatrix.needsUpdate = true;
    headInst.instanceMatrix.needsUpdate = true;
    poleInst.computeBoundingSphere();
    headInst.computeBoundingSphere();
    poleInst.matrixAutoUpdate = false;
    headInst.matrixAutoUpdate = false;
    poleInst.updateMatrix();
    headInst.updateMatrix();
    group.add(poleInst);
    group.add(headInst);
  }

  return {
    group,
    updateAnimatedProps: (elapsed: number) => {
      oceanUniforms.uTime.value = elapsed;
      ferrisRotor.rotation.z = elapsed * 0.22;
      const strobePulse = Math.pow(Math.max(0, Math.sin(elapsed * 3.4)), 6);
      aviationStrobeMat.emissiveIntensity = 0.6 + strobePulse * 2.8;
    },
  };
}
