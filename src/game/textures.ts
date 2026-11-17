import * as THREE from 'three';

export interface ProceduralTexturePack {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  highwayMap: THREE.CanvasTexture;
  buildingGlassMap: THREE.CanvasTexture;
  dirtMap: THREE.CanvasTexture;
  terrainBump: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  carbonMap: THREE.CanvasTexture;
  tireTreadMap: THREE.CanvasTexture;
  rampMap: THREE.CanvasTexture;
  checkerMap: THREE.CanvasTexture;
  finishBannerMap: THREE.CanvasTexture;
  chevronSignMap: THREE.CanvasTexture;
  guardrailMap: THREE.CanvasTexture;
  particleSoftMap: THREE.CanvasTexture;
  shadowDiscMap: THREE.CanvasTexture;
  createNumberDecal: (numStr: string, accentHex: number) => THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function fillAggregateNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  minV: number,
  maxV: number,
  blueBias: number,
) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const v = minV + Math.floor(Math.random() * (maxV - minV));
    const s = Math.random() < 0.72 ? 2 : 3;
    ctx.fillStyle = `rgb(${v},${v + Math.floor(blueBias * 0.4)},${v + blueBias})`;
    ctx.fillRect(x, y, s, s);
  }
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  const all: THREE.Texture[] = [];

  const register = (tex: THREE.CanvasTexture, isColor: boolean, repeatX = 1, repeatY = 1) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = Math.min(maxAnisotropy, 16);
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    all.push(tex);
    return tex;
  };

  // 1. High-Res Circuit Grand Prix Asphalt (1024x1024 — FIA red/white curbs, shoulder rumble strips, multi-lane groove, double-yellow centerline)
  const [asphaltCanvas, actx] = makeCanvas(1024, 1024);
  actx.fillStyle = '#1c2028';
  actx.fillRect(0, 0, 1024, 1024);
  fillAggregateNoise(actx, 1024, 1024, 65000, 18, 52, 6);

  // Subtle asphalt paving seams & tar expansion lines
  actx.strokeStyle = 'rgba(10, 12, 16, 0.42)';
  actx.lineWidth = 3;
  for (const seamY of [256, 768]) {
    actx.beginPath();
    actx.moveTo(40, seamY);
    for (let sx = 80; sx <= 984; sx += 48) {
      actx.lineTo(sx, seamY + (Math.random() - 0.5) * 6);
    }
    actx.stroke();
  }
  actx.fillStyle = 'rgba(8, 10, 14, 0.32)';
  actx.fillRect(510, 0, 4, 1024);

  // Darker tire-rubber racing grooves in each lane
  for (const gx of [175, 330, 645, 800]) {
    const grad = actx.createLinearGradient(gx - 46, 0, gx + 46, 0);
    grad.addColorStop(0, 'rgba(7, 9, 12, 0)');
    grad.addColorStop(0.5, 'rgba(7, 9, 12, 0.46)');
    grad.addColorStop(1, 'rgba(7, 9, 12, 0)');
    actx.fillStyle = grad;
    actx.fillRect(gx - 46, 0, 92, 1024);
  }

  // Alternating Red/White FIA Circuit Curbs on edges + grooved dark apron
  for (let y = 0; y < 1024; y += 128) {
    actx.fillStyle = (y / 128) % 2 === 0 ? '#dc2626' : '#f8fafc';
    actx.fillRect(0, y, 36, 128);
    actx.fillRect(988, y, 36, 128);
  }
  // Curb inner shadow & rumble teeth
  actx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let y = 0; y < 1024; y += 16) {
    actx.fillRect(36, y, 12, 7);
    actx.fillRect(976, y, 12, 7);
  }

  // Crisp solid white circuit boundary lines
  actx.fillStyle = '#ffffff';
  actx.fillRect(52, 0, 18, 1024);
  actx.fillRect(954, 0, 18, 1024);

  // High-contrast dashed lane guides inside wide circuit
  actx.fillStyle = 'rgba(241, 245, 249, 0.78)';
  for (let y = 24; y < 1024; y += 256) {
    actx.fillRect(278, y, 11, 114);
    actx.fillRect(735, y, 11, 114);
  }

  // High-contrast dashed double-yellow centerline
  actx.fillStyle = '#fde047';
  for (let y = 16; y < 1024; y += 256) {
    actx.fillRect(486, y, 15, 164);
    actx.fillRect(523, y, 15, 164);
  }
  const asphaltMap = register(new THREE.CanvasTexture(asphaltCanvas), true, 1, 1);

  // 2. Crisp 512x512 Asphalt Bump Map (aggregate + rumble grooves)
  const [abCanvas, abCtx] = makeCanvas(512, 512);
  abCtx.fillStyle = '#808080';
  abCtx.fillRect(0, 0, 512, 512);
  fillAggregateNoise(abCtx, 512, 512, 26000, 82, 178, 0);
  abCtx.fillStyle = '#555555';
  for (let y = 0; y < 512; y += 16) {
    abCtx.fillRect(14, y, 14, 6);
    abCtx.fillRect(484, y, 14, 6);
  }
  const asphaltBump = register(new THREE.CanvasTexture(abCanvas), false, 1, 1);

  // 3. Dedicated 1024x1024 Highway & Los Santos Urban Boulevard Map (flush shoulders + dashed centerlines for clean intersections)
  const [hwCanvas, hctx] = makeCanvas(1024, 1024);
  hctx.fillStyle = '#20252e';
  hctx.fillRect(0, 0, 1024, 1024);
  fillAggregateNoise(hctx, 1024, 1024, 52000, 24, 58, 7);

  // Subtle asphalt shoulder aprons (no harsh bright blocks slicing across perpendicular intersections)
  hctx.fillStyle = '#2c3340';
  hctx.fillRect(0, 0, 26, 1024);
  hctx.fillRect(998, 0, 26, 1024);

  // Subtle tire-wear tracks in 4 highway lanes
  for (const gx of [170, 380, 644, 854]) {
    const grad = hctx.createLinearGradient(gx - 42, 0, gx + 42, 0);
    grad.addColorStop(0, 'rgba(8, 10, 14, 0)');
    grad.addColorStop(0.5, 'rgba(8, 10, 14, 0.38)');
    grad.addColorStop(1, 'rgba(8, 10, 14, 0)');
    hctx.fillStyle = grad;
    hctx.fillRect(gx - 42, 0, 84, 1024);
  }

  // Outer edge fog lines
  hctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
  hctx.fillRect(34, 0, 12, 1024);
  hctx.fillRect(978, 0, 12, 1024);

  // Dashed white multi-lane dividers
  hctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  for (let y = 24; y < 1024; y += 256) {
    hctx.fillRect(271, y, 12, 124);
    hctx.fillRect(741, y, 12, 124);
  }

  // Dashed double-yellow median stripe (clean flow across intersections)
  hctx.fillStyle = '#fde047';
  for (let y = 16; y < 1024; y += 256) {
    hctx.fillRect(492, y, 12, 172);
    hctx.fillRect(520, y, 12, 172);
  }
  const highwayMap = register(new THREE.CanvasTexture(hwCanvas), true, 1, 1);

  // 4. High-Res 512x512 Los Santos Architectural Glass Curtain-Wall Texture
  const [bgCanvas, bgCtx] = makeCanvas(512, 512);
  bgCtx.fillStyle = '#09121e';
  bgCtx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 24; row++) {
    // Structural floor slab spandrel band
    bgCtx.fillStyle = '#132033';
    bgCtx.fillRect(0, row * 21, 512, 4);
    for (let col = 0; col < 12; col++) {
      const lit = Math.random();
      const x = col * 42 + 6;
      const y = row * 21 + 5;
      if (lit > 0.76) {
        bgCtx.fillStyle = lit > 0.91 ? '#fef08a' : lit > 0.84 ? '#bae6fd' : '#7dd3fc';
      } else if (lit > 0.42) {
        bgCtx.fillStyle = '#1d3b5e';
      } else {
        bgCtx.fillStyle = '#0e1f36';
      }
      bgCtx.fillRect(x, y, 34, 14);
      // Subtle curtain-wall sky sheen reflection highlight
      bgCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      bgCtx.fillRect(x, y, 34, 3);
    }
  }
  const buildingGlassMap = register(new THREE.CanvasTexture(bgCanvas), true, 2, 5);

  // 5. Dirt / Gravel Trail Texture (512x512)
  const [dirtCanvas, dCtx] = makeCanvas(512, 512);
  dCtx.fillStyle = '#684e36';
  dCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24000; i++) {
    const r = 74 + Math.floor(Math.random() * 54);
    const g = Math.floor(r * 0.76);
    const b = Math.floor(r * 0.54);
    dCtx.fillStyle = `rgb(${r},${g},${b})`;
    dCtx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  dCtx.fillStyle = 'rgba(42, 30, 18, 0.34)';
  dCtx.fillRect(108, 0, 80, 512);
  dCtx.fillRect(324, 0, 80, 512);
  const dirtMap = register(new THREE.CanvasTexture(dirtCanvas), true, 1, 1);

  // 6. Terrain Micro Bump (512x512)
  const [tbCanvas, tbCtx] = makeCanvas(512, 512);
  tbCtx.fillStyle = '#808080';
  tbCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 32000; i++) {
    const v = 70 + Math.floor(Math.random() * 120);
    tbCtx.fillStyle = `rgb(${v},${v},${v})`;
    tbCtx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  const terrainBump = register(new THREE.CanvasTexture(tbCanvas), false, 110, 110);

  // 7. Tree Bark Texture
  const [barkCanvas, bkCtx] = makeCanvas(128, 256);
  bkCtx.fillStyle = '#4a3525';
  bkCtx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 360; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 256;
    const h = 14 + Math.random() * 38;
    bkCtx.fillStyle = Math.random() > 0.4 ? '#362518' : '#634935';
    bkCtx.fillRect(x, y, 2 + Math.random() * 3, h);
  }
  const barkMap = register(new THREE.CanvasTexture(barkCanvas), true, 1, 2);

  // 8. Carbon Fiber Weave
  const [carbCanvas, cCtx] = makeCanvas(64, 64);
  cCtx.fillStyle = '#12151b';
  cCtx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      cCtx.fillStyle = ((x + y) / 8) % 2 === 0 ? '#242a35' : '#161920';
      cCtx.fillRect(x, y, 7, 7);
    }
  }
  const carbonMap = register(new THREE.CanvasTexture(carbCanvas), true, 8, 8);

  // 9. Off-road GT Tire Tread
  const [tireCanvas, trCtx] = makeCanvas(256, 256);
  trCtx.fillStyle = '#181a1e';
  trCtx.fillRect(0, 0, 256, 256);
  trCtx.fillStyle = '#333842';
  for (let y = 0; y < 256; y += 16) {
    trCtx.fillRect(14, y, 52, 9);
    trCtx.fillRect(190, y, 52, 9);
    trCtx.fillRect(88, y + 6, 32, 9);
    trCtx.fillRect(136, y + 6, 32, 9);
  }
  const tireTreadMap = register(new THREE.CanvasTexture(tireCanvas), true, 1, 6);

  // 10. Stunt Ramp Chevron Deck
  const [rampCanvas, rmCtx] = makeCanvas(256, 256);
  rmCtx.fillStyle = '#334155';
  rmCtx.fillRect(0, 0, 256, 256);
  rmCtx.fillStyle = '#f59e0b';
  for (let y = 0; y < 256; y += 64) {
    rmCtx.beginPath();
    rmCtx.moveTo(24, y + 48);
    rmCtx.lineTo(128, y + 12);
    rmCtx.lineTo(232, y + 48);
    rmCtx.lineTo(232, y + 62);
    rmCtx.lineTo(128, y + 26);
    rmCtx.lineTo(24, y + 62);
    rmCtx.closePath();
    rmCtx.fill();
  }
  const rampMap = register(new THREE.CanvasTexture(rampCanvas), true, 1, 2);

  // 11. Checkered Finish Line Strip
  const [chkCanvas, chkCtx] = makeCanvas(256, 64);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 16; col++) {
      chkCtx.fillStyle = (row + col) % 2 === 0 ? '#f8fafc' : '#0f172a';
      chkCtx.fillRect(col * 16, row * 16, 16, 16);
    }
  }
  const checkerMap = register(new THREE.CanvasTexture(chkCanvas), true, 1, 1);

  // 12. Overhead Start/Finish Gantry Banner
  const [banCanvas, banCtx] = makeCanvas(512, 128);
  banCtx.fillStyle = '#090d16';
  banCtx.fillRect(0, 0, 512, 128);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      banCtx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111827';
      banCtx.fillRect(c * 18, r * 32, 18, 32);
      banCtx.fillRect(512 - 72 + c * 18, r * 32, 18, 32);
    }
  }
  banCtx.fillStyle = '#f59e0b';
  banCtx.fillRect(72, 0, 368, 10);
  banCtx.fillRect(72, 118, 368, 10);
  banCtx.fillStyle = '#ffffff';
  banCtx.font = '900 44px system-ui, sans-serif';
  banCtx.textAlign = 'center';
  banCtx.textBaseline = 'middle';
  banCtx.fillText('FINISH // GRAND PRIX', 256, 66);
  const finishBannerMap = register(new THREE.CanvasTexture(banCanvas), true, 1, 1);

  // 13. Roadside Curve Chevron Warning Sign
  const [chvCanvas, chvCtx] = makeCanvas(128, 128);
  chvCtx.fillStyle = '#facc15';
  chvCtx.fillRect(0, 0, 128, 128);
  chvCtx.fillStyle = '#111827';
  chvCtx.beginPath();
  chvCtx.moveTo(28, 16);
  chvCtx.lineTo(66, 16);
  chvCtx.lineTo(106, 64);
  chvCtx.lineTo(66, 112);
  chvCtx.lineTo(28, 112);
  chvCtx.lineTo(68, 64);
  chvCtx.closePath();
  chvCtx.fill();
  const chevronSignMap = register(new THREE.CanvasTexture(chvCanvas), true, 1, 1);

  // 14. Corrugated Steel Guardrail
  const [grCanvas, grCtx] = makeCanvas(128, 64);
  grCtx.fillStyle = '#94a3b8';
  grCtx.fillRect(0, 0, 128, 64);
  grCtx.fillStyle = '#64748b';
  grCtx.fillRect(0, 18, 128, 10);
  grCtx.fillRect(0, 44, 128, 10);
  grCtx.fillStyle = '#ef4444';
  grCtx.fillRect(54, 24, 20, 14);
  const guardrailMap = register(new THREE.CanvasTexture(grCanvas), true, 1, 1);

  // 15. Soft Particle Sprite
  const [partCanvas, pCtx] = makeCanvas(64, 64);
  const pGrad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  pGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
  pGrad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  pGrad.addColorStop(1, 'rgba(255,255,255,0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 64, 64);
  const particleSoftMap = new THREE.CanvasTexture(partCanvas);
  particleSoftMap.colorSpace = THREE.SRGBColorSpace;
  all.push(particleSoftMap);

  // 16. Contact Shadow Disc
  const [shadCanvas, sCtx] = makeCanvas(128, 128);
  const sGrad = sCtx.createRadialGradient(64, 64, 14, 64, 64, 62);
  sGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
  sGrad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  sGrad.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 128, 128);
  const shadowDiscMap = new THREE.CanvasTexture(shadCanvas);
  all.push(shadowDiscMap);

  const createNumberDecal = (numStr: string, accentHex: number) => {
    const [nc, nctx] = makeCanvas(128, 128);
    nctx.clearRect(0, 0, 128, 128);
    nctx.fillStyle = '#f8fafc';
    nctx.beginPath();
    nctx.arc(64, 64, 56, 0, Math.PI * 2);
    nctx.fill();
    nctx.lineWidth = 8;
    nctx.strokeStyle = `#${accentHex.toString(16).padStart(6, '0')}`;
    nctx.stroke();
    nctx.fillStyle = '#0f172a';
    nctx.font = '900 58px system-ui, sans-serif';
    nctx.textAlign = 'center';
    nctx.textBaseline = 'middle';
    nctx.fillText(numStr, 64, 67);
    const tex = new THREE.CanvasTexture(nc);
    tex.colorSpace = THREE.SRGBColorSpace;
    all.push(tex);
    return tex;
  };

  return {
    asphaltMap,
    asphaltBump,
    highwayMap,
    buildingGlassMap,
    dirtMap,
    terrainBump,
    barkMap,
    carbonMap,
    tireTreadMap,
    rampMap,
    checkerMap,
    finishBannerMap,
    chevronSignMap,
    guardrailMap,
    particleSoftMap,
    shadowDiscMap,
    createNumberDecal,
    dispose: () => {
      for (const tex of all) tex.dispose();
    },
  };
}
