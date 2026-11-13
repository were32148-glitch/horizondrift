import * as THREE from 'three';

export interface ProceduralTexturePack {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
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

export function createProceduralTextures(maxAnisotropy: number): ProceduralTexturePack {
  const all: THREE.Texture[] = [];

  const register = (tex: THREE.CanvasTexture, isColor: boolean, repeatX = 1, repeatY = 1) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = Math.min(maxAnisotropy, 8);
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    all.push(tex);
    return tex;
  };

  // 1. Asphalt Highway Texture (2-lane race circuit with crisp curbing shoulders & double yellow centerline)
  const [asphaltCanvas, actx] = makeCanvas(512, 512);
  actx.fillStyle = '#1b1f26';
  actx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 22000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 20 + Math.floor(Math.random() * 28);
    actx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    actx.fillRect(x, y, 2, 2);
  }
  // Racing groove rubber marks
  actx.fillStyle = 'rgba(8, 10, 14, 0.38)';
  actx.fillRect(88, 0, 50, 512);
  actx.fillRect(172, 0, 50, 512);
  actx.fillRect(290, 0, 50, 512);
  actx.fillRect(374, 0, 50, 512);
  // Red/White racing apex edge curbs
  for (let y = 0; y < 512; y += 64) {
    actx.fillStyle = (y / 64) % 2 === 0 ? '#dc2626' : '#f8fafc';
    actx.fillRect(0, y, 16, 64);
    actx.fillRect(496, y, 16, 64);
  }
  // Crisp white lane shoulder lines
  actx.fillStyle = '#f1f5f9';
  actx.fillRect(22, 0, 10, 512);
  actx.fillRect(480, 0, 10, 512);
  // Dashed double yellow centerline
  actx.fillStyle = '#facc15';
  for (let y = 0; y < 512; y += 128) {
    actx.fillRect(241, y + 10, 9, 80);
    actx.fillRect(262, y + 10, 9, 80);
  }
  const asphaltMap = register(new THREE.CanvasTexture(asphaltCanvas), true, 1, 1);

  // 2. Asphalt Bump Map
  const [abCanvas, abCtx] = makeCanvas(256, 256);
  abCtx.fillStyle = '#808080';
  abCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const g = 90 + Math.floor(Math.random() * 80);
    abCtx.fillStyle = `rgb(${g},${g},${g})`;
    abCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const asphaltBump = register(new THREE.CanvasTexture(abCanvas), false, 1, 1);

  // 3. Dirt / Gravel Trail Texture
  const [dirtCanvas, dCtx] = makeCanvas(256, 256);
  dCtx.fillStyle = '#624a34';
  dCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 11000; i++) {
    const r = 72 + Math.floor(Math.random() * 48);
    const g = Math.floor(r * 0.76);
    const b = Math.floor(r * 0.54);
    dCtx.fillStyle = `rgb(${r},${g},${b})`;
    dCtx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 2, 2 + Math.random() * 2);
  }
  dCtx.fillStyle = 'rgba(42, 30, 18, 0.36)';
  dCtx.fillRect(54, 0, 40, 256);
  dCtx.fillRect(162, 0, 40, 256);
  const dirtMap = register(new THREE.CanvasTexture(dirtCanvas), true, 1, 1);

  // 4. Terrain Micro Bump
  const [tbCanvas, tbCtx] = makeCanvas(256, 256);
  tbCtx.fillStyle = '#808080';
  tbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 12000; i++) {
    const v = 75 + Math.floor(Math.random() * 110);
    tbCtx.fillStyle = `rgb(${v},${v},${v})`;
    tbCtx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const terrainBump = register(new THREE.CanvasTexture(tbCanvas), false, 96, 96);

  // 5. Tree Bark Texture
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

  // 6. Carbon Fiber Weave
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

  // 7. Off-road GT Tire Tread
  const [tireCanvas, trCtx] = makeCanvas(256, 256);
  trCtx.fillStyle = '#181a1e';
  trCtx.fillRect(0, 0, 256, 256);
  trCtx.fillStyle = '#2d3138';
  for (let y = 0; y < 256; y += 16) {
    trCtx.fillRect(14, y, 52, 9);
    trCtx.fillRect(190, y, 52, 9);
    trCtx.fillRect(88, y + 6, 32, 9);
    trCtx.fillRect(136, y + 6, 32, 9);
  }
  const tireTreadMap = register(new THREE.CanvasTexture(tireCanvas), true, 1, 6);

  // 8. Stunt Ramp Chevron Deck
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

  // 9. Checkered Finish Line Strip
  const [chkCanvas, chkCtx] = makeCanvas(256, 64);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 16; col++) {
      chkCtx.fillStyle = (row + col) % 2 === 0 ? '#f8fafc' : '#0f172a';
      chkCtx.fillRect(col * 16, row * 16, 16, 16);
    }
  }
  const checkerMap = register(new THREE.CanvasTexture(chkCanvas), true, 1, 1);

  // 10. Overhead Start/Finish Gantry Banner
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

  // 11. Roadside Curve Chevron Warning Sign
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

  // 12. Corrugated Steel Guardrail
  const [grCanvas, grCtx] = makeCanvas(128, 64);
  grCtx.fillStyle = '#94a3b8';
  grCtx.fillRect(0, 0, 128, 64);
  grCtx.fillStyle = '#64748b';
  grCtx.fillRect(0, 18, 128, 10);
  grCtx.fillRect(0, 44, 128, 10);
  grCtx.fillStyle = '#ef4444';
  grCtx.fillRect(54, 24, 20, 14);
  const guardrailMap = register(new THREE.CanvasTexture(grCanvas), true, 1, 1);

  // 13. Soft Particle Sprite
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

  // 14. Contact Shadow Disc
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
