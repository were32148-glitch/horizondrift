import * as THREE from 'three';
import type { ProceduralTexturePack } from './textures';
import type { CarSpec, VehicleInput, VehicleState } from './types';

export interface CarPaintOption {
  id: string;
  name: string;
  hex: number;
}

export const CAR_PAINT_OPTIONS: CarPaintOption[] = [
  { id: 'crimson', name: 'Crimson Flare', hex: 0xd92638 },
  { id: 'amber', name: 'Solar Amber', hex: 0xe67e12 },
  { id: 'cobalt', name: 'Midnight Cobalt', hex: 0x1d4ed8 },
  { id: 'emerald', name: 'Alpine Racing Green', hex: 0x0f766e },
  { id: 'glacier', name: 'Glacier White', hex: 0xe2e8f0 },
];

export interface CarVisualRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  contactShadow: THREE.Mesh;
  wheelSuspensions: THREE.Group[];
  wheelSteerPivots: THREE.Group[];
  wheelSpinPivots: THREE.Group[];
  brakeMaterials: THREE.MeshStandardMaterial[];
  reverseMaterial: THREE.MeshStandardMaterial;
  headlightMaterial: THREE.MeshStandardMaterial;
  roofLightMaterial: THREE.MeshStandardMaterial;
  headlightSpotLeft: THREE.SpotLight;
  headlightSpotRight: THREE.SpotLight;
  headlightConeLeft: THREE.Mesh;
  headlightConeRight: THREE.Mesh;
  boostFlameLeft: THREE.Mesh;
  boostFlameRight: THREE.Mesh;
  bodyPaintMaterial: THREE.MeshPhysicalMaterial;
  setPaintColor: (hex: number) => void;
  applyCarSpec: (spec: CarSpec) => void;
  updateFromState: (state: VehicleState, input: VehicleInput, groundY: number, elapsed: number) => void;
  dispose: () => void;
}

export function createCarVisualRig(
  textures: ProceduralTexturePack,
  isSoftwareGl: boolean,
  initialPaintHex = CAR_PAINT_OPTIONS[0].hex,
  stripeHex = 0xfacc15,
  numberLabel = '01',
  enableSpotLights = true,
  bodyStyle: CarSpec['bodyStyle'] = 'gt',
  rimHex = 0xd9bc7e,
): CarVisualRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  // --- Materials ---
  const bodyPaintMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: initialPaintHex,
      metalness: 0.72,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.35,
    }),
  );

  const stripeMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: stripeHex,
      metalness: 0.35,
      roughness: 0.25,
      clearcoat: 0.9,
      envMapIntensity: 1.0,
    }),
  );

  const carbonMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.carbonMap,
      roughness: 0.38,
      metalness: 0.42,
    }),
  );

  const matteTrimMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x161a20,
      roughness: 0.78,
      metalness: 0.14,
    }),
  );

  const glassMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x0d1522,
      metalness: 0.15,
      roughness: 0.06,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.65,
    }),
  );

  const mirrorGlassMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.98,
      roughness: 0.05,
    }),
  );

  const rimAlloyMaterial = track(
    new THREE.MeshStandardMaterial({
      color: rimHex,
      metalness: 0.9,
      roughness: 0.2,
    }),
  );

  const titaniumMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.95,
      roughness: 0.15,
    }),
  );

  const caliperMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.5,
      roughness: 0.28,
    }),
  );

  const tireMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.tireTreadMap,
      roughness: 0.88,
      metalness: 0.05,
    }),
  );

  const interiorLeatherMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e222b,
      roughness: 0.85,
      metalness: 0.06,
    }),
  );

  const rollCageMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      metalness: 0.62,
      roughness: 0.24,
    }),
  );

  const dashScreenMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    }),
  );

  const headlightMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.95,
      roughness: 0.1,
    }),
  );

  const roofLightMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xfef08a,
      emissiveIntensity: 0.4,
      roughness: 0.15,
    }),
  );

  const tailBrakeMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xff1e2d,
      emissiveIntensity: 0.8,
      roughness: 0.15,
    }),
  );

  const reverseMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xffffff,
      emissiveIntensity: 0.0,
      roughness: 0.15,
    }),
  );

  const numberTex = textures.createNumberDecal(numberLabel, initialPaintHex);
  const numberMat = track(
    new THREE.MeshStandardMaterial({
      map: numberTex,
      transparent: true,
      roughness: 0.3,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );

  // --- 1. Primary Sculpted Lower Hull (ExtrudeGeometry side profile) ---
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.14, 0.08);
  hullShape.lineTo(-1.82, 0.04);
  hullShape.absarc(-1.36, 0.02, 0.46, Math.PI, 0, true);
  hullShape.lineTo(0.92, 0.02);
  hullShape.absarc(1.36, 0.02, 0.46, Math.PI, 0, true);
  hullShape.lineTo(2.08, 0.06);
  hullShape.lineTo(2.22, 0.18);
  hullShape.lineTo(2.16, 0.43);
  hullShape.quadraticCurveTo(1.55, 0.61, 0.78, 0.67);
  hullShape.lineTo(-0.95, 0.69);
  hullShape.quadraticCurveTo(-1.65, 0.75, -2.12, 0.65);
  hullShape.lineTo(-2.22, 0.34);
  hullShape.closePath();

  const hullGeo = track(
    new THREE.ExtrudeGeometry(hullShape, {
      depth: 1.72,
      bevelEnabled: true,
      bevelThickness: 0.11,
      bevelSize: 0.08,
      bevelSegments: 4,
      curveSegments: 18,
    }),
  );
  hullGeo.translate(0, 0, -0.86);
  hullGeo.rotateY(-Math.PI / 2);
  const hullMesh = new THREE.Mesh(hullGeo, bodyPaintMaterial);
  hullMesh.castShadow = !isSoftwareGl;
  hullMesh.receiveShadow = !isSoftwareGl;
  chassisGroup.add(hullMesh);

  // --- 2. Sculpted Fastback Cabin Greenhouse + Roof Snorkel Scoop + Wipers ---
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-1.6, 0.64);
  cabinShape.quadraticCurveTo(-0.85, 1.19, -0.22, 1.21);
  cabinShape.lineTo(0.28, 1.19);
  cabinShape.quadraticCurveTo(0.68, 0.94, 0.89, 0.64);
  cabinShape.closePath();

  const cabinGeo = track(
    new THREE.ExtrudeGeometry(cabinShape, {
      depth: 1.32,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 3,
      curveSegments: 14,
    }),
  );
  cabinGeo.translate(0, 0, -0.66);
  cabinGeo.rotateY(-Math.PI / 2);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMaterial);
  cabinMesh.castShadow = !isSoftwareGl;
  chassisGroup.add(cabinMesh);

  const roofCapGeo = track(new THREE.BoxGeometry(1.24, 0.06, 0.84));
  const roofCap = new THREE.Mesh(roofCapGeo, bodyPaintMaterial);
  roofCap.position.set(0, 1.22, -0.1);
  chassisGroup.add(roofCap);

  // Carbon Roof Air Scoop
  const roofScoopGeo = track(new THREE.BoxGeometry(0.32, 0.1, 0.56));
  const roofScoop = new THREE.Mesh(roofScoopGeo, carbonMaterial);
  roofScoop.position.set(0, 1.29, -0.18);
  chassisGroup.add(roofScoop);

  // Twin Racing Stripes (Hood, Roof, Rear Deck)
  const hoodStripeGeo = track(new THREE.BoxGeometry(0.16, 0.025, 1.3));
  const roofStripeGeo = track(new THREE.BoxGeometry(0.16, 0.02, 0.86));
  const rearStripeGeo = track(new THREE.BoxGeometry(0.16, 0.025, 0.52));
  for (const sx of [-0.14, 0.14]) {
    const hs = new THREE.Mesh(hoodStripeGeo, stripeMaterial);
    hs.position.set(sx, 0.635, 1.48);
    hs.rotation.x = 0.14;
    chassisGroup.add(hs);

    const rs = new THREE.Mesh(roofStripeGeo, stripeMaterial);
    rs.position.set(sx, 1.255, -0.1);
    chassisGroup.add(rs);

    const bs = new THREE.Mesh(rearStripeGeo, stripeMaterial);
    bs.position.set(sx, 0.725, -1.85);
    bs.rotation.x = -0.06;
    chassisGroup.add(bs);
  }

  // Hood Power Bulge + 4 Carbon Heat-Extractor Louvers
  const hoodBulgeGeo = track(new THREE.BoxGeometry(0.92, 0.08, 1.12));
  const hoodBulge = new THREE.Mesh(hoodBulgeGeo, bodyPaintMaterial);
  hoodBulge.position.set(0, 0.59, 1.38);
  hoodBulge.rotation.x = 0.12;
  chassisGroup.add(hoodBulge);

  const louverGeo = track(new THREE.BoxGeometry(0.46, 0.03, 0.09));
  for (let l = 0; l < 4; l++) {
    const louver = new THREE.Mesh(louverGeo, carbonMaterial);
    louver.position.set(0, 0.655 - l * 0.014, 1.18 + l * 0.14);
    louver.rotation.x = 0.35;
    chassisGroup.add(louver);
  }

  // Hood & Door Racing Number Roundels
  const doorDecalGeo = track(new THREE.PlaneGeometry(0.48, 0.48));
  for (const side of [-1, 1]) {
    const dMesh = new THREE.Mesh(doorDecalGeo, numberMat);
    dMesh.position.set(side * 0.96, 0.44, 0.05);
    dMesh.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    chassisGroup.add(dMesh);
  }
  const hoodDecal = new THREE.Mesh(track(new THREE.PlaneGeometry(0.44, 0.44)), numberMat);
  hoodDecal.position.set(0, 0.66, 1.58);
  hoodDecal.rotation.x = -Math.PI / 2 + 0.14;
  chassisGroup.add(hoodDecal);

  // Twin Windshield Wipers
  const wiperGeo = track(new THREE.BoxGeometry(0.46, 0.02, 0.025));
  for (const wx of [-0.26, 0.24]) {
    const wiper = new THREE.Mesh(wiperGeo, matteTrimMaterial);
    wiper.position.set(wx, 0.72, 0.85);
    wiper.rotation.z = 0.12;
    chassisGroup.add(wiper);
  }

  // --- 3. Detailed Interior Cockpit (Bucket Seats, Harness, Digital Dash, Steering Wheel, Roll Cage) ---
  const cockpitGroup = new THREE.Group();
  const seatBackGeo = track(new THREE.BoxGeometry(0.42, 0.56, 0.12));
  const seatBaseGeo = track(new THREE.BoxGeometry(0.42, 0.1, 0.42));
  const harnessGeo = track(new THREE.BoxGeometry(0.055, 0.44, 0.04));
  for (const sx of [-0.36, 0.36]) {
    const back = new THREE.Mesh(seatBackGeo, interiorLeatherMaterial);
    back.position.set(sx, 0.72, -0.35);
    back.rotation.x = -0.22;
    cockpitGroup.add(back);

    const base = new THREE.Mesh(seatBaseGeo, interiorLeatherMaterial);
    base.position.set(sx, 0.45, -0.15);
    cockpitGroup.add(base);

    for (const hx of [-0.1, 0.1]) {
      const strap = new THREE.Mesh(harnessGeo, stripeMaterial);
      strap.position.set(sx + hx, 0.74, -0.27);
      strap.rotation.x = -0.22;
      cockpitGroup.add(strap);
    }
  }
  const dashGeo = track(new THREE.BoxGeometry(1.22, 0.18, 0.32));
  const dash = new THREE.Mesh(dashGeo, matteTrimMaterial);
  dash.position.set(0, 0.72, 0.52);
  cockpitGroup.add(dash);

  const clusterScreen = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 0.09, 0.04)), dashScreenMaterial);
  clusterScreen.position.set(0.36, 0.79, 0.45);
  cockpitGroup.add(clusterScreen);

  const steeringRimGeo = track(new THREE.TorusGeometry(0.14, 0.022, 8, 18));
  const steeringWheel = new THREE.Mesh(steeringRimGeo, carbonMaterial);
  steeringWheel.position.set(0.36, 0.78, 0.32);
  steeringWheel.rotation.x = -0.35;
  cockpitGroup.add(steeringWheel);

  const barGeo = track(new THREE.CylinderGeometry(0.025, 0.025, 0.68, 8));
  for (const rx of [-0.52, 0.52]) {
    const post = new THREE.Mesh(barGeo, rollCageMaterial);
    post.position.set(rx, 0.88, -0.58);
    post.rotation.x = 0.25;
    cockpitGroup.add(post);
  }
  const crossBarGeo = track(new THREE.CylinderGeometry(0.025, 0.025, 1.04, 8));
  const crossBar = new THREE.Mesh(crossBarGeo, rollCageMaterial);
  crossBar.rotation.z = Math.PI / 2;
  crossBar.position.set(0, 1.12, -0.5);
  cockpitGroup.add(crossBar);
  chassisGroup.add(cockpitGroup);

  // --- 4. Widebody Fender Flares + Front Aero Canards ---
  const archGeo = track(new THREE.TorusGeometry(0.49, 0.07, 8, 18, Math.PI));
  const archPositions: [number, number, number][] = [
    [0.95, 0.03, 1.36],
    [-0.95, 0.03, 1.36],
    [0.95, 0.03, -1.36],
    [-0.95, 0.03, -1.36],
  ];
  for (const [ax, ay, az] of archPositions) {
    const arch = new THREE.Mesh(archGeo, matteTrimMaterial);
    arch.position.set(ax, ay, az);
    arch.rotation.y = Math.PI / 2;
    chassisGroup.add(arch);
  }

  const canardGeo = track(new THREE.BoxGeometry(0.18, 0.025, 0.28));
  for (const cx of [-0.94, 0.94]) {
    const canard = new THREE.Mesh(canardGeo, carbonMaterial);
    canard.position.set(cx, 0.22, 1.98);
    canard.rotation.x = 0.22;
    canard.rotation.z = cx > 0 ? -0.18 : 0.18;
    chassisGroup.add(canard);
  }

  // --- 5. Carbon Aero Package: Front Splitter + Struts, Side Skirts, Rear Diffuser, Swan-Neck GT Wing ---
  const splitterGeo = track(new THREE.BoxGeometry(1.98, 0.045, 0.62));
  const splitter = new THREE.Mesh(splitterGeo, carbonMaterial);
  splitter.position.set(0, 0.035, 2.04);
  chassisGroup.add(splitter);

  const splitterEndGeo = track(new THREE.BoxGeometry(0.035, 0.14, 0.44));
  for (const sx of [-0.99, 0.99]) {
    const end = new THREE.Mesh(splitterEndGeo, carbonMaterial);
    end.position.set(sx, 0.09, 2.02);
    chassisGroup.add(end);
  }

  const skirtGeo = track(new THREE.BoxGeometry(0.16, 0.07, 1.84));
  for (const sx of [-0.94, 0.94]) {
    const skirt = new THREE.Mesh(skirtGeo, carbonMaterial);
    skirt.position.set(sx, 0.04, 0);
    chassisGroup.add(skirt);
  }

  const diffuserGeo = track(new THREE.BoxGeometry(1.68, 0.18, 0.38));
  const diffuser = new THREE.Mesh(diffuserGeo, carbonMaterial);
  diffuser.position.set(0, 0.11, -2.1);
  chassisGroup.add(diffuser);

  const finGeo = track(new THREE.BoxGeometry(0.035, 0.18, 0.34));
  for (const fx of [-0.58, -0.26, 0.26, 0.58]) {
    const fin = new THREE.Mesh(finGeo, matteTrimMaterial);
    fin.position.set(fx, 0.1, -2.16);
    chassisGroup.add(fin);
  }

  // Central F1-Style Rain Light in Diffuser
  const rainLightMesh = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.14, 0.08, 0.05)),
    tailBrakeMaterial,
  );
  rainLightMesh.position.set(0, 0.14, -2.28);
  chassisGroup.add(rainLightMesh);

  // Swan-neck GT Wing (+ upper second aero element for track/hyper/legend)
  const wingBladeGeo = track(new THREE.BoxGeometry(1.94, 0.05, 0.36));
  const wingBlade = new THREE.Mesh(wingBladeGeo, carbonMaterial);
  wingBlade.position.set(0, 1.15, -2.04);
  wingBlade.rotation.x = 0.15;
  wingBlade.castShadow = !isSoftwareGl;
  chassisGroup.add(wingBlade);

  const upperWing = new THREE.Mesh(track(new THREE.BoxGeometry(1.88, 0.04, 0.24)), stripeMaterial);
  upperWing.position.set(0, 1.31, -2.12);
  upperWing.rotation.x = 0.22;
  upperWing.visible = bodyStyle === 'track' || bodyStyle === 'hyper' || bodyStyle === 'legend';
  chassisGroup.add(upperWing);

  // Dorsal aero shark fin for hyper/legend specs
  const dorsalFin = new THREE.Mesh(track(new THREE.BoxGeometry(0.04, 0.22, 0.72)), carbonMaterial);
  dorsalFin.position.set(0, 1.24, -1.18);
  dorsalFin.visible = bodyStyle === 'hyper' || bodyStyle === 'legend';
  chassisGroup.add(dorsalFin);

  // Baja Rally Bullbar & Skid Plate
  const bullbar = new THREE.Mesh(track(new THREE.BoxGeometry(1.42, 0.24, 0.14)), titaniumMaterial);
  bullbar.position.set(0, 0.25, 2.28);
  bullbar.visible = bodyStyle === 'baja';
  chassisGroup.add(bullbar);

  const endplateGeo = track(new THREE.BoxGeometry(0.035, 0.28, 0.44));
  for (const ex of [-0.97, 0.97]) {
    const plate = new THREE.Mesh(endplateGeo, bodyPaintMaterial);
    plate.position.set(ex, 1.14, -2.04);
    chassisGroup.add(plate);
  }
  const pylonGeo = track(new THREE.BoxGeometry(0.04, 0.48, 0.15));
  for (const px of [-0.46, 0.46]) {
    const pylon = new THREE.Mesh(pylonGeo, matteTrimMaterial);
    pylon.position.set(px, 0.9, -1.94);
    pylon.rotation.x = -0.25;
    chassisGroup.add(pylon);
  }

  // --- 6. Expedition Roof Rack & Quad Rally LED Lightbar ---
  const rackRailGeo = track(new THREE.BoxGeometry(0.05, 0.05, 0.95));
  for (const rx of [-0.48, 0.48]) {
    const rail = new THREE.Mesh(rackRailGeo, matteTrimMaterial);
    rail.position.set(rx, 1.28, -0.14);
    chassisGroup.add(rail);
  }
  const lightBarGeo = track(new THREE.BoxGeometry(1.06, 0.08, 0.12));
  const lightBar = new THREE.Mesh(lightBarGeo, matteTrimMaterial);
  lightBar.position.set(0, 1.31, 0.28);
  chassisGroup.add(lightBar);

  const podGeo = track(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 12));
  podGeo.rotateX(Math.PI / 2);
  for (const lx of [-0.36, -0.12, 0.12, 0.36]) {
    const pod = new THREE.Mesh(podGeo, roofLightMaterial);
    pod.position.set(lx, 1.31, 0.34);
    chassisGroup.add(pod);
  }

  // --- 7. Front Grille + Visible Intercooler Radiator + Headlights + Rear Fascia + Quad Exhaust ---
  const grilleGeo = track(new THREE.BoxGeometry(1.18, 0.24, 0.08));
  const grille = new THREE.Mesh(grilleGeo, matteTrimMaterial);
  grille.position.set(0, 0.26, 2.21);
  chassisGroup.add(grille);

  const intercooler = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.86, 0.17, 0.06)),
    titaniumMaterial,
  );
  intercooler.position.set(0, 0.25, 2.22);
  chassisGroup.add(intercooler);

  const headlampGeo = track(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16));
  headlampGeo.rotateX(Math.PI / 2);
  const beamPoolGeo = track(new THREE.PlaneGeometry(3.4, 18));
  beamPoolGeo.rotateX(-Math.PI / 2);
  beamPoolGeo.translate(0, 0, 9.5);
  const coneMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      map: textures.particleSoftMap,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  const makeHeadlightSpot = (xPos: number) => {
    const spot = new THREE.SpotLight(0xf0f9ff, 0, 62, Math.PI / 5, 0.55, 1.4);
    spot.position.set(xPos, 0.44, 2.15);
    const target = new THREE.Object3D();
    target.position.set(xPos * 0.8, 0.0, 16.0);
    chassisGroup.add(target);
    spot.target = target;
    if (enableSpotLights) chassisGroup.add(spot);
    return spot;
  };

  for (const hx of [-0.68, 0.68]) {
    const lamp = new THREE.Mesh(headlampGeo, headlightMaterial);
    lamp.position.set(hx, 0.42, 2.18);
    chassisGroup.add(lamp);
  }
  const headlightSpotLeft = makeHeadlightSpot(0.68);
  const headlightSpotRight = makeHeadlightSpot(-0.68);

  const headlightConeLeft = new THREE.Mesh(beamPoolGeo, coneMat);
  headlightConeLeft.position.set(0.75, -0.26, 2.0);
  headlightConeLeft.visible = false;
  chassisGroup.add(headlightConeLeft);

  const headlightConeRight = new THREE.Mesh(beamPoolGeo, coneMat);
  headlightConeRight.position.set(-0.75, -0.26, 2.0);
  headlightConeRight.visible = false;
  chassisGroup.add(headlightConeRight);

  // Rear Fascia + Quad LED Pods + Plate + Side Intakes
  const rearFascia = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.78, 0.25, 0.07)),
    matteTrimMaterial,
  );
  rearFascia.position.set(0, 0.5, -2.19);
  chassisGroup.add(rearFascia);

  const tailBar = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.66, 0.055, 0.075)),
    tailBrakeMaterial,
  );
  tailBar.position.set(0, 0.57, -2.21);
  chassisGroup.add(tailBar);

  const tailPodGeo = track(new THREE.BoxGeometry(0.24, 0.085, 0.08));
  for (const tx of [-0.68, -0.4, 0.4, 0.68]) {
    const pod = new THREE.Mesh(tailPodGeo, tailBrakeMaterial);
    pod.position.set(tx, 0.52, -2.21);
    chassisGroup.add(pod);
  }

  const plateMesh = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.42, 0.12, 0.04)),
    titaniumMaterial,
  );
  plateMesh.position.set(0, 0.34, -2.21);
  chassisGroup.add(plateMesh);

  const revGeo = track(new THREE.BoxGeometry(0.22, 0.045, 0.06));
  for (const rx of [-0.38, 0.38]) {
    const rev = new THREE.Mesh(revGeo, reverseMaterial);
    rev.position.set(rx, 0.44, -2.22);
    chassisGroup.add(rev);
  }

  const sideIntakeGeo = track(new THREE.BoxGeometry(0.09, 0.26, 0.48));
  for (const sx of [-0.95, 0.95]) {
    const intake = new THREE.Mesh(sideIntakeGeo, carbonMaterial);
    intake.position.set(sx, 0.44, -0.78);
    chassisGroup.add(intake);
  }

  // Aero Side Mirrors + Stalks + Reflective Mirror Faces
  const mirrorHousingGeo = track(new THREE.BoxGeometry(0.19, 0.1, 0.14));
  const mirrorFaceGeo = track(new THREE.PlaneGeometry(0.15, 0.075));
  const stalkGeo = track(new THREE.BoxGeometry(0.14, 0.035, 0.045));
  for (const mx of [-1, 1]) {
    const mirror = new THREE.Mesh(mirrorHousingGeo, carbonMaterial);
    mirror.position.set(mx * 0.99, 0.78, 0.58);
    chassisGroup.add(mirror);

    const glassFace = new THREE.Mesh(mirrorFaceGeo, mirrorGlassMaterial);
    glassFace.position.set(mx * 0.99, 0.78, 0.508);
    glassFace.rotation.y = Math.PI;
    chassisGroup.add(glassFace);

    const stalk = new THREE.Mesh(stalkGeo, matteTrimMaterial);
    stalk.position.set(mx * 0.88, 0.75, 0.58);
    chassisGroup.add(stalk);
  }

  // Quad Titanium Exhausts + Boost Flames
  const pipeGeo = track(new THREE.CylinderGeometry(0.055, 0.065, 0.24, 14));
  pipeGeo.rotateX(Math.PI / 2);
  const flameGeo = track(new THREE.ConeGeometry(0.08, 0.74, 10));
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );

  const boostFlames: THREE.Mesh[] = [];
  for (const px of [-0.5, -0.36, 0.36, 0.5]) {
    const pipe = new THREE.Mesh(pipeGeo, titaniumMaterial);
    pipe.position.set(px, 0.13, -2.23);
    chassisGroup.add(pipe);
  }
  for (const fx of [-0.43, 0.43]) {
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(fx, 0.13, -2.65);
    flame.visible = false;
    chassisGroup.add(flame);
    boostFlames.push(flame);
  }

  // --- 8. 4 Articulated Wheel, Suspension, Brake Rotor, Caliper & Lug Bolt Assemblies ---
  const tirePoints = [
    new THREE.Vector2(0.24, -0.155),
    new THREE.Vector2(0.39, -0.155),
    new THREE.Vector2(0.42, -0.11),
    new THREE.Vector2(0.42, 0.11),
    new THREE.Vector2(0.39, 0.155),
    new THREE.Vector2(0.24, 0.155),
  ];
  const tireGeo = track(new THREE.LatheGeometry(tirePoints, 28));
  tireGeo.rotateZ(Math.PI / 2);

  const rimBarrelGeo = track(new THREE.CylinderGeometry(0.255, 0.255, 0.26, 22, 1, true));
  rimBarrelGeo.rotateZ(Math.PI / 2);
  const hubCapGeo = track(new THREE.CylinderGeometry(0.075, 0.085, 0.28, 12));
  hubCapGeo.rotateZ(Math.PI / 2);
  const spokeGeo = track(new THREE.BoxGeometry(0.04, 0.22, 0.03));
  const lugGeo = track(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6));
  lugGeo.rotateZ(Math.PI / 2);
  const rotorGeo = track(new THREE.CylinderGeometry(0.21, 0.21, 0.035, 18));
  rotorGeo.rotateZ(Math.PI / 2);
  const caliperGeo = track(new THREE.BoxGeometry(0.085, 0.14, 0.1));
  const strutGeo = track(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8));

  const wheelSuspensions: THREE.Group[] = [];
  const wheelSteerPivots: THREE.Group[] = [];
  const wheelSpinPivots: THREE.Group[] = [];

  const wheelMountCoords: [number, number, number, boolean][] = [
    [0.98, 0.0, 1.36, true],
    [-0.98, 0.0, 1.36, false],
    [0.98, 0.0, -1.36, true],
    [-0.98, 0.0, -1.36, false],
  ];

  for (const [wx, wy, wz, isLeft] of wheelMountCoords) {
    const susp = new THREE.Group();
    susp.position.set(wx, wy, wz);
    root.add(susp);

    const strut = new THREE.Mesh(strutGeo, rollCageMaterial);
    strut.position.set(isLeft ? -0.14 : 0.14, 0.2, 0);
    strut.rotation.z = isLeft ? -0.22 : 0.22;
    susp.add(strut);

    const steerPivot = new THREE.Group();
    susp.add(steerPivot);

    const caliper = new THREE.Mesh(caliperGeo, caliperMaterial);
    caliper.position.set(isLeft ? -0.02 : 0.02, 0.11, -0.13);
    steerPivot.add(caliper);

    const spinPivot = new THREE.Group();
    steerPivot.add(spinPivot);

    const tire = new THREE.Mesh(tireGeo, tireMaterial);
    tire.castShadow = !isSoftwareGl;
    spinPivot.add(tire);

    const rimBarrel = new THREE.Mesh(rimBarrelGeo, rimAlloyMaterial);
    spinPivot.add(rimBarrel);

    const hub = new THREE.Mesh(hubCapGeo, titaniumMaterial);
    spinPivot.add(hub);

    const rotor = new THREE.Mesh(rotorGeo, titaniumMaterial);
    spinPivot.add(rotor);

    const faceOffset = isLeft ? 0.11 : -0.11;
    for (let s = 0; s < 10; s++) {
      const angle = (s / 10) * Math.PI * 2;
      const spoke = new THREE.Mesh(spokeGeo, rimAlloyMaterial);
      spoke.position.set(faceOffset, Math.cos(angle) * 0.125, Math.sin(angle) * 0.125);
      spoke.rotation.x = angle;
      spinPivot.add(spoke);
    }
    for (let b = 0; b < 5; b++) {
      const ang = (b / 5) * Math.PI * 2;
      const lug = new THREE.Mesh(lugGeo, caliperMaterial);
      lug.position.set(isLeft ? 0.14 : -0.14, Math.cos(ang) * 0.052, Math.sin(ang) * 0.052);
      spinPivot.add(lug);
    }

    wheelSuspensions.push(susp);
    wheelSteerPivots.push(steerPivot);
    wheelSpinPivots.push(spinPivot);
  }

  // --- 9. Grounded Soft Contact Shadow Disc ---
  const shadowGeo = track(new THREE.PlaneGeometry(3.3, 5.4));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = track(
    new THREE.MeshBasicMaterial({
      map: textures.shadowDiscMap,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  );
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.set(0, 0.03, 0);
  root.add(contactShadow);

  return {
    root,
    chassisGroup,
    contactShadow,
    wheelSuspensions,
    wheelSteerPivots,
    wheelSpinPivots,
    brakeMaterials: [tailBrakeMaterial],
    reverseMaterial,
    headlightMaterial,
    roofLightMaterial,
    headlightSpotLeft,
    headlightSpotRight,
    headlightConeLeft,
    headlightConeRight,
    boostFlameLeft: boostFlames[0],
    boostFlameRight: boostFlames[1],
    bodyPaintMaterial,
    setPaintColor: (hex: number) => {
      bodyPaintMaterial.color.setHex(hex);
    },
    applyCarSpec: (spec: CarSpec) => {
      bodyPaintMaterial.color.setHex(spec.paintHex);
      stripeMaterial.color.setHex(spec.stripeHex);
      rimAlloyMaterial.color.setHex(spec.rimHex);
      upperWing.visible =
        spec.bodyStyle === 'track' || spec.bodyStyle === 'hyper' || spec.bodyStyle === 'legend';
      dorsalFin.visible = spec.bodyStyle === 'hyper' || spec.bodyStyle === 'legend';
      bullbar.visible = spec.bodyStyle === 'baja';
    },
    updateFromState: (state: VehicleState, input: VehicleInput, groundY: number, elapsed: number) => {
      root.position.set(state.x, state.y, state.z);
      root.rotation.order = 'YXZ';
      root.rotation.y = state.yaw;

      chassisGroup.rotation.order = 'YXZ';
      chassisGroup.rotation.x = state.pitch;
      chassisGroup.rotation.z = state.roll;

      let avgComp = 0;
      for (let i = 0; i < 4; i++) {
        avgComp += state.wheels[i].compression;
        const wY = -0.14 + (state.wheels[i].compression - 0.5) * 0.16;
        wheelSuspensions[i].position.y = wY;
        wheelSteerPivots[i].rotation.y = state.wheels[i].steerAngle;
        wheelSpinPivots[i].rotation.x = state.wheels[i].spinAngle;
      }
      avgComp *= 0.25;
      chassisGroup.position.y = 0.08 - (avgComp - 0.5) * 0.12;

      const heightAboveGround = Math.max(0, state.y - groundY - 0.54);
      contactShadow.position.set(0, Math.max(groundY - state.y + 0.04, -2.5), 0);
      contactShadow.rotation.x = -state.pitch * 0.5;
      shadowMat.opacity = Math.max(0.08, 0.54 - heightAboveGround * 0.12);

      const braking = input.brake > 0.1 || input.handbrake;
      tailBrakeMaterial.emissiveIntensity = braking ? 3.2 : 0.78;
      reverseMaterial.emissiveIntensity = state.gear === -1 ? 2.4 : 0.0;

      const lightsOn = state.headlightsOn;
      headlightMaterial.emissiveIntensity = lightsOn ? 3.4 : 0.7;
      roofLightMaterial.emissiveIntensity = lightsOn ? 2.9 : 0.35;
      headlightSpotLeft.intensity = enableSpotLights && lightsOn ? 28 : 0;
      headlightSpotRight.intensity = enableSpotLights && lightsOn ? 28 : 0;
      headlightConeLeft.visible = lightsOn;
      headlightConeRight.visible = lightsOn;

      const showFlame = state.isBoosting;
      boostFlames[0].visible = showFlame;
      boostFlames[1].visible = showFlame;
      if (showFlame) {
        const flicker = 0.85 + Math.sin(elapsed * 55) * 0.25;
        boostFlames[0].scale.set(1, 1, flicker);
        boostFlames[1].scale.set(1, 1, flicker * 0.95);
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
