// Canvas-textured decor: signs, pictograms, portraits, photos, chalk marks, rugs, stains, vents.
import * as THREE from 'three';

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Ruth's pictograms. Drawn as simple strokes into a square of size s centred at (cx,cy).
export function drawPicto(g, name, cx, cy, s, color = '#1b1b1b', lw = 0.07) {
  g.save();
  g.translate(cx, cy);
  g.scale(s, s);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  switch (name) {
    case 'bird':
      g.moveTo(-0.38, 0.05); g.quadraticCurveTo(-0.1, -0.3, 0.05, 0.0); g.quadraticCurveTo(0.2, -0.3, 0.4, -0.1);
      g.moveTo(0.05, 0.0); g.lineTo(0.0, 0.25); g.moveTo(-0.12, 0.25); g.lineTo(0.12, 0.25);
      break;
    case 'cup':
      g.moveTo(-0.25, -0.15); g.lineTo(-0.2, 0.3); g.lineTo(0.2, 0.3); g.lineTo(0.25, -0.15); g.closePath();
      g.moveTo(0.25, -0.05); g.arc(0.3, 0.07, 0.1, -Math.PI / 2, Math.PI / 2);
      g.moveTo(-0.08, -0.38); g.quadraticCurveTo(-0.15, -0.28, -0.05, -0.22); g.moveTo(0.08, -0.38); g.quadraticCurveTo(0.0, -0.28, 0.1, -0.22);
      break;
    case 'bed':
      g.moveTo(-0.4, 0.3); g.lineTo(-0.4, -0.25); g.moveTo(-0.4, 0.1); g.lineTo(0.4, 0.1); g.lineTo(0.4, 0.3);
      g.moveTo(-0.3, -0.02); g.arc(-0.22, -0.02, 0.08, 0, Math.PI * 2);
      g.moveTo(-0.1, 0.1); g.lineTo(-0.1, -0.05); g.lineTo(0.4, -0.05); g.lineTo(0.4, 0.1);
      break;
    case 'bulb':
      g.arc(0, -0.1, 0.22, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(0.1, 0.22); g.lineTo(-0.1, 0.22); g.closePath();
      g.moveTo(-0.1, 0.3); g.lineTo(0.1, 0.3); g.moveTo(-0.07, 0.37); g.lineTo(0.07, 0.37);
      break;
    case 'flame':
      g.moveTo(0, -0.4); g.quadraticCurveTo(0.35, -0.05, 0.2, 0.25); g.quadraticCurveTo(0, 0.42, -0.2, 0.25); g.quadraticCurveTo(-0.35, -0.05, 0, -0.4);
      g.moveTo(0, 0.0); g.quadraticCurveTo(0.12, 0.15, 0, 0.27); g.quadraticCurveTo(-0.12, 0.15, 0, 0.0);
      break;
    case 'speaker':
      g.moveTo(-0.35, -0.12); g.lineTo(-0.15, -0.12); g.lineTo(0.08, -0.32); g.lineTo(0.08, 0.32); g.lineTo(-0.15, 0.12); g.lineTo(-0.35, 0.12); g.closePath();
      g.moveTo(0.2, -0.15); g.quadraticCurveTo(0.3, 0, 0.2, 0.15); g.moveTo(0.3, -0.27); g.quadraticCurveTo(0.45, 0, 0.3, 0.27);
      break;
    case 'bell':
      g.moveTo(-0.3, 0.2); g.quadraticCurveTo(-0.25, -0.35, 0, -0.35); g.quadraticCurveTo(0.25, -0.35, 0.3, 0.2); g.closePath();
      g.moveTo(-0.06, 0.28); g.arc(0, 0.28, 0.06, Math.PI, 0, true);
      g.moveTo(-0.38, -0.3); g.lineTo(-0.45, -0.38); g.moveTo(0.38, -0.3); g.lineTo(0.45, -0.38);
      break;
    case 'drop':
      g.moveTo(0, -0.38); g.quadraticCurveTo(0.3, 0.0, 0.25, 0.15); g.arc(0, 0.15, 0.25, 0, Math.PI); g.quadraticCurveTo(-0.3, 0.0, 0, -0.38);
      break;
    case 'half':   // valve chalk: half-moons (orientation via rotation)
      g.arc(0, 0, 0.3, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill(); g.beginPath(); g.arc(0, 0, 0.3, 0, Math.PI * 2);
      break;
    default:
      g.arc(0, 0, 0.3, 0, Math.PI * 2);
  }
  g.stroke();
  g.restore();
}

export const PICTOS = ['bird', 'cup', 'bed', 'bulb', 'flame', 'speaker', 'bell', 'drop'];

function paperBg(g, w, h, col = '#d8cfb6') {
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(80,60,30,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, Math.random() * 30, Math.random() * 30); }
}

export function makeDecor(map, mats, story) {
  const group = new THREE.Group();
  const byId = new Map();
  const planeMesh = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const decal = (tex, opts = {}) => {
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: opts.roughness ?? 0.8, transparent: !!opts.transparent, depthWrite: !opts.transparent, polygonOffset: true, polygonOffsetFactor: -2, metalness: opts.metalness ?? 0 });
    const lit = mats.prop('paper');
    m.onBeforeCompile = lit.onBeforeCompile; m.customProgramCacheKey = lit.customProgramCacheKey;
    return m;
  };
  for (const p of map.props) {
    const floor = map.floorAt(p.x, p.z);
    const a = ((p.r || 0) * Math.PI) / 180;
    let obj = null;
    const y = floor + (p.y ?? 0);
    switch (p.t) {
      case 'pictoPlate': {
        const tex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#c9c1aa'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a3428'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8); drawPicto(g, p.picto, 64, 64, 100, '#7a1d14', 0.08); });
        obj = planeMesh(0.28, 0.28, decal(tex));
        break;
      }
      case 'signPlate': {
        const tex = canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#1d2621'; g.fillRect(0, 0, w, h); g.fillStyle = '#d4cdb8'; g.font = 'bold 36px Courier New, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.text || '', w / 2, h / 2 + 2, w - 20); });
        obj = planeMesh(p.text && p.text.length > 20 ? 1.9 : 1.0, 0.2, decal(tex, { roughness: 0.4 }));
        break;
      }
      case 'portrait': {
        const tex = story.portraitTexture();
        obj = new THREE.Group();
        obj.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.05), mats.prop('darkWood')));
        const pic = planeMesh(0.74, 0.94, decal(tex, { roughness: 0.35 }));
        pic.position.z = 0.03;
        obj.add(pic);
        obj.userData.pic = pic;
        break;
      }
      case 'photoFrame': {
        const tex = story.staffPhotoTexture();
        obj = new THREE.Group();
        obj.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.8, 0.04), mats.prop('darkWood')));
        const pic = planeMesh(1.0, 0.66, decal(tex, { roughness: 0.3 })); pic.position.z = 0.025; obj.add(pic);
        break;
      }
      case 'directory': {
        const tex = story.directoryTexture();
        obj = new THREE.Group();
        obj.add(new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.05, 0.04), mats.prop('darkWood')));
        const pic = planeMesh(1.35, 0.95, decal(tex, { roughness: 0.4 })); pic.position.z = 0.025; obj.add(pic);
        break;
      }
      case 'keyCabinet': {
        const tex = canvasTex(256, 290, (g, w, h) => {
          g.fillStyle = '#5b4632'; g.fillRect(0, 0, w, h);
          const labels = [['bird', 'RESEARCH'], ['cup', 'ADMIN'], ['bed', 'RESIDENT.'], ['bulb', 'MAINT.'], ['flame', 'BOILER'], ['speaker', 'BROADCAST'], ['bell', 'ALARM'], ['drop', 'CISTERN']];
          labels.forEach(([pic, lab], k) => {
            const cx = 40 + (k % 2) * 128, cy = 40 + Math.floor(k / 2) * 66;
            g.fillStyle = '#d6cdb5'; g.fillRect(cx - 30, cy - 26, 112, 50);
            drawPicto(g, pic, cx - 8, cy - 2, 38, '#7a1d14', 0.09);
            g.fillStyle = '#2a2318'; g.font = '13px Courier New'; g.fillText(lab, cx + 14, cy + 4);
            g.fillStyle = '#9a8a5a'; g.beginPath(); g.arc(cx + 60, cy + 15, 4, 0, 7); g.fill();
            if (pic !== 'bulb') { g.fillStyle = '#b0a070'; g.fillRect(cx + 57, cy + 18, 6, 18); }
          });
        });
        obj = new THREE.Group();
        obj.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.1), mats.prop('darkWood')));
        const pic = planeMesh(0.62, 0.72, decal(tex)); pic.position.z = 0.052; obj.add(pic);
        break;
      }
      case 'chalkMarks': {
        const tex = story.chalkTexture(p.id);
        obj = planeMesh(p.w ?? 1.4, 1.0, decal(tex, { transparent: true, roughness: 1 }));
        break;
      }
      case 'chalkboard': {
        const tex = story.boardTexture(p.id, !!p.papers);
        obj = new THREE.Group();
        obj.add(new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.25, 0.05), mats.prop('darkWood')));
        const pic = planeMesh(2.1, 1.1, decal(tex, { roughness: 0.9 })); pic.position.z = 0.03; obj.add(pic);
        break;
      }
      case 'vent': {
        const tex = canvasTex(128, 96, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a5a58'; for (let k = 0; k < 8; k++) g.fillRect(6, 8 + k * 11, w - 12, 5); g.strokeStyle = '#6a6a66'; g.lineWidth = 6; g.strokeRect(0, 0, w, h); });
        obj = planeMesh(0.6, 0.4, decal(tex, { metalness: 0.5, roughness: 0.6 }));
        break;
      }
      case 'wallPhone': {
        obj = new THREE.Group();
        obj.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.08), mats.prop('beigePlastic')));
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.05), mats.prop('beigePlastic')); h.position.set(-0.07, 0, 0.07); obj.add(h);
        break;
      }
      case 'rug': {
        const tex = canvasTex(256, 192, (g, w, h) => { g.fillStyle = '#4b2018'; g.fillRect(0, 0, w, h); g.strokeStyle = '#7d5a32'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68); for (let k = 0; k < 2000; k++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
        obj = planeMesh(p.w ?? 3, p.d ?? 2, decal(tex, { roughness: 1 }));
        obj.rotation.x = -Math.PI / 2;
        break;
      }
      case 'stain': case 'puddle': {
        const tex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); const c = p.t === 'stain' ? '40,6,4' : '8,10,10'; gr.addColorStop(0, `rgba(${c},0.85)`); gr.addColorStop(0.6, `rgba(${c},0.5)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); for (let k = 0; k < 12; k++) { const aa = k / 12 * 6.28; const r = 40 + Math.random() * 22; g.lineTo(64 + Math.cos(aa) * r, 64 + Math.sin(aa) * r); } g.fill(); });
        const m = decal(tex, { transparent: true, roughness: p.t === 'puddle' ? 0.02 : 0.3, metalness: p.t === 'puddle' ? 0.4 : 0 });
        obj = planeMesh(p.w ?? 1.4, p.d ?? 1.0, m);
        obj.rotation.x = -Math.PI / 2;
        break;
      }
      case 'paperPile': {
        obj = new THREE.Group();
        for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), mats.prop('paper')); s.rotation.set(-Math.PI / 2, 0, Math.random() * 6); s.position.set((Math.random() - 0.5) * 0.6, 0.004 + k * 0.001, (Math.random() - 0.5) * 0.5); obj.add(s); }
        break;
      }
      case 'mirror': {
        obj = new THREE.Group();
        const frame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.0, 0.03), mats.prop('steelDark'));
        obj.add(frame);
        obj.userData.mirrorSize = [2.6, 0.9];
        break;
      }
      case 'sweepPanel': {
        obj = new THREE.Group();
        obj.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 0.16), mats.prop('steelDark')));
        const tex = canvasTex(256, 220, (g, w, h) => { g.fillStyle = '#26292a'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9c2ad'; g.font = 'bold 18px Courier New'; g.fillText('FULL SPECTRUM SWEEP', 18, 30); g.font = '13px Courier New'; ['BOILER WHISTLES', 'PA AMPLIFIERS', 'CHAMBER ZERO OPEN'].forEach((s, k) => { g.fillText(s, 50, 72 + k * 34); g.strokeStyle = '#888'; g.strokeRect(22, 60 + k * 34, 16, 16); }); g.fillStyle = '#7a1d14'; g.fillRect(170, 170, 60, 34); g.fillStyle = '#ddd'; g.fillText('ENGAGE', 172, 192); });
        const pic = planeMesh(1.0, 0.86, decal(tex, { roughness: 0.5 })); pic.position.z = 0.085; obj.add(pic);
        obj.userData.face = pic;
        break;
      }
      case 'boothPanel': {
        obj = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.06), mats.prop('greyPlastic'));
        break;
      }
      case 'alarmBell': {
        obj = new THREE.Group();
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.prop('paintRed'));
        bell.rotation.x = Math.PI / 2; bell.position.z = 0.06; obj.add(bell);
        break;
      }
      case 'gateSign': {
        const tex = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#1e2420'; g.fillRect(0, 0, w, h); g.strokeStyle = '#9d957f'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#d4cdb8'; g.textAlign = 'center'; g.font = 'bold 34px Georgia'; g.fillText('LARKHOLLOW', w / 2, 80); g.font = '22px Georgia'; g.fillText('ACOUSTICAL RESEARCH LABORATORY', w / 2, 120); g.font = '16px Courier New'; g.fillText('PROPERTY CLOSED · NO TRESPASSING', w / 2, 190); });
        obj = planeMesh(2.4, 1.2, decal(tex, { roughness: 0.6 }));
        obj.position.y = 1.5;
        const grp = new THREE.Group(); grp.add(obj); obj = grp;
        break;
      }
      default: continue;
    }
    if (!obj) continue;
    const wrap = new THREE.Group();
    wrap.position.set(p.x, y + (p.t === 'rug' || p.t === 'stain' || p.t === 'puddle' || p.t === 'paperPile' ? 0.006 : 0), p.z);
    wrap.rotation.y = a;
    wrap.add(obj);
    wrap.userData.prop = p;
    obj.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } });
    group.add(wrap);
    if (p.id) byId.set(p.id, wrap);
  }
  return { group, byId };
}
