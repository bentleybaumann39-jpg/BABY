// In-match DOM HUD: compass, minimap + big map, squad/health, weapon & ammo, kill feed,
// notifications, hit markers, damage indicators, interaction prompts, inventory, scope, death screen.
import * as THREE from 'three';
import { MODE, MAP_HALF, WATER_LEVEL } from '../../../shared/constants.js';
import { WEAPONS, AMMO, ATTACH, HEALS, THROWS, PACK_CAP, ARMOR, magSize, itemName } from '../../../shared/sim/Items.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MATE_COLORS = ['#e8c547', '#5fb3e8', '#9be36b', '#e86b9b'];

export class MapView {
  constructor(map) {
    this.map = map;
    const S = 1024;
    const c = this.base = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = i - MAP_HALF + 0.5, z = j - MAP_HALF + 0.5;
      const h = map.heightAt(x, z);
      const hx = map.heightAt(x + 1.5, z) - h, hz = map.heightAt(x, z + 1.5) - h;
      const sh = Math.max(0.45, Math.min(1.25, 0.95 - hx * 0.45 - hz * 0.3));
      let r = 92 + h * 0.6, gg = 98 + h * 0.5, b = 70 + h * 0.35;
      if (h < WATER_LEVEL) { r = 44; gg = 62; b = 70; }
      const k = (j * S + i) * 4;
      img.data[k] = Math.min(255, r * sh); img.data[k + 1] = Math.min(255, gg * sh); img.data[k + 2] = Math.min(255, b * sh); img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // forests
    g.fillStyle = 'rgba(28,40,24,0.55)';
    for (const t of map.trees) { g.beginPath(); g.arc(t[0] + MAP_HALF, t[2] + MAP_HALF, 2.6, 0, 7); g.fill(); }
    // roads
    g.strokeStyle = 'rgba(176,164,138,0.85)'; g.lineWidth = 4; g.lineJoin = 'round';
    for (const r of map.roads) { g.beginPath(); r.pts.forEach((p, k) => k ? g.lineTo(p[0] + MAP_HALF, p[1] + MAP_HALF) : g.moveTo(p[0] + MAP_HALF, p[1] + MAP_HALF)); g.stroke(); }
    // buildings
    g.fillStyle = 'rgba(52,48,44,0.95)'; g.strokeStyle = 'rgba(20,18,16,0.9)'; g.lineWidth = 1;
    for (const b of map.buildings) { if (b.tpl === 'car' || b.tpl === 'barrels') continue; const [x0, z0, x1, z1] = b.bb; g.fillRect(x0 + MAP_HALF, z0 + MAP_HALF, x1 - x0, z1 - z0); }
    // grid
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1;
    for (let k = 0; k <= 8; k++) { g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, S); g.moveTo(0, k * 128); g.lineTo(S, k * 128); g.stroke(); }
    // labels
    g.font = '600 15px "Barlow Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'center';
    for (const p of map.pois) {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(p.name.toUpperCase(), p.x + MAP_HALF + 1, p.z + MAP_HALF - p.r * 0.55 + 1);
      g.fillStyle = 'rgba(235,228,210,0.95)'; g.fillText(p.name.toUpperCase(), p.x + MAP_HALF, p.z + MAP_HALF - p.r * 0.55);
    }
  }
}

export class HUD {
  constructor(app) {
    this.app = app;
    this.el = $('hud');
    this.inventoryOpen = false; this.mapOpen = false; this.menuOpen = false;
    this.feedEl = $('killfeed'); this.notifyEl = $('notify');
    this.mini = $('minimap'); this.miniG = this.mini.getContext('2d');
    this.big = $('bigmap-canvas'); this.bigG = this.big.getContext('2d');
    this.mapView = null;
    this.hitT = 0; this.dmgArcs = [];
    this.fpsAcc = 0; this.fpsN = 0;
    this.slow = 0;
    this.tags = new Map();
    $('btn-leave-death').onclick = () => app.leaveMatch();
    $('inv-close').onclick = () => this.closePanels();
    this.compassBuilt = false;
    this.buildCompass();
  }

  get blocking() { return this.inventoryOpen || this.mapOpen || this.menuOpen; }

  setMap(map) { this.mapView = new MapView(map); }

  buildCompass() {
    const strip = $('compass-strip');
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    let html = '';
    for (let rep = 0; rep < 3; rep++) for (let d = 0; d < 360; d += 15) {
      const lab = labels[d];
      html += `<span class="tick ${lab ? 'major' : ''}">${lab || d}</span>`;
    }
    strip.innerHTML = html;
  }

  startMatch(mv) {
    this.mv = mv;
    this.el.classList.add('show');
    this.setDead(false);
    $('banner').className = ''; $('banner').textContent = '';
    this.feedEl.innerHTML = ''; this.notifyEl.innerHTML = '';
    this.closePanels();
  }
  endMatch() { this.el.classList.remove('show'); this.closePanels(); this.mv = null; for (const t of this.tags.values()) t.remove(); this.tags.clear(); $('scope').classList.remove('show'); }

  setDead(d) { $('death').classList.toggle('show', d); }

  notify(text, secs = 3) {
    const d = document.createElement('div'); d.className = 'note'; d.textContent = text;
    this.notifyEl.appendChild(d);
    while (this.notifyEl.children.length > 3) this.notifyEl.firstChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 500); }, secs * 1000);
  }
  toast(text) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = text;
    $('toasts').appendChild(d);
    while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
    setTimeout(() => d.remove(), 2200);
  }
  banner(text, cls) { const b = $('banner'); b.textContent = text; b.className = 'show ' + cls; }
  feed(a, v, w, kind, aMine, vMine, dist) {
    const d = document.createElement('div');
    d.className = 'feed' + (aMine ? ' mine' : '') + (vMine ? ' lost' : '');
    const wn = WEAPONS[w] ? WEAPONS[w].name : w === 'frag' ? 'Frag' : w === 'zone' ? 'Ash' : w === 'fall' ? 'Fall' : w === 'bleed' ? 'Bled out' : '';
    d.innerHTML = `<b>${esc(a)}</b> <i>${kind === 'knocked' ? 'knocked' : kind === 'headshot' ? '⌖' : '✕'} ${esc(wn)}${dist > 60 ? ` ${dist}m` : ''}</i> <b>${esc(v)}</b>`;
    this.feedEl.prepend(d);
    while (this.feedEl.children.length > 6) this.feedEl.lastChild.remove();
    setTimeout(() => d.classList.add('fade'), 7000);
  }
  hitmarker(head, kill) {
    const h = $('hitmarker');
    h.className = 'show' + (head ? ' head' : '') + (kill ? ' kill' : '');
    clearTimeout(this.hmT); this.hmT = setTimeout(() => { h.className = ''; }, kill ? 450 : 160);
  }
  damageFrom(rel) {
    const a = document.createElement('div'); a.className = 'dmgarc';
    a.style.transform = `translate(-50%,-50%) rotate(${-rel}rad)`;
    $('dmgdirs').appendChild(a);
    setTimeout(() => a.remove(), 1200);
  }

  toggleInventory() { const o = !this.inventoryOpen; this.closePanels(); this.inventoryOpen = o; $('inventory').classList.toggle('show', o); if (o) { this.app.input.unlock(); this.renderInventory(); } else this.app.input.lock(); }
  toggleMap() { const o = !this.mapOpen; this.closePanels(); this.mapOpen = o; $('bigmap').classList.toggle('show', o); if (!o) this.app.input.lock(); }
  closePanels() {
    const was = this.inventoryOpen || this.mapOpen;
    this.inventoryOpen = false; this.mapOpen = false;
    $('inventory').classList.remove('show'); $('bigmap').classList.remove('show');
    if (was && this.mv) this.app.input.lock();
  }

  setInventory(inv) { this.inv = inv; if (this.inventoryOpen) this.renderInventory(); }

  renderInventory() {
    const mv = this.mv, inv = this.inv;
    if (!mv || !inv) return;
    const cmd = (c) => mv.cmd(c);
    // ground
    const near = mv.nearbyItems();
    const g = $('inv-ground');
    g.innerHTML = near.length ? '' : '<div class="empty">Nothing within reach</div>';
    for (const e of near) {
      const b = document.createElement('button'); b.className = 'row';
      b.innerHTML = `<span>${esc(itemName(e.it))}</span><em>take</em>`;
      b.onclick = () => { cmd({ c: 'pickup', id: e.id }); setTimeout(() => this.renderInventory(), 150); };
      g.appendChild(b);
    }
    // equipment
    const eq = $('inv-equip');
    const slotNames = ['Primary 1', 'Primary 2', 'Sidearm'];
    let html = '';
    inv.w.forEach((w, s) => {
      if (!w) { html += `<div class="wslot empty"><h4>${slotNames[s]}</h4><span>empty</span></div>`; return; }
      const def = WEAPONS[w.id];
      const atts = def.atts.map(t => `<button class="att ${w.att[t] ? 'on' : ''}" data-s="${s}" data-t="${t}" title="${w.att[t] ? 'Detach ' + ATTACH[w.att[t]].name : t}">${w.att[t] ? esc(ATTACH[w.att[t]].name) : t}</button>`).join('');
      html += `<div class="wslot ${inv.slot === s ? 'active' : ''}"><h4>${slotNames[s]} · ${esc(def.name)}</h4><span>${w.mag}/${magSize(w)} · ${AMMO[def.ammo].name}${w.semi ? ' · semi' : ''}</span><div class="atts">${atts}</div><button class="drop" data-k="weapon" data-s="${s}">drop</button></div>`;
    });
    const armor = (k) => inv[k] ? `<div class="gear"><b>${k === 'helmet' ? 'Helmet' : 'Vest'} Lv.${inv[k].tier}</b><div class="bar"><i style="width:${Math.round(100 * inv[k].dur / ARMOR[k][inv[k].tier].dur)}%"></i></div><button class="drop" data-k="${k}">drop</button></div>` : `<div class="gear empty"><b>${k === 'helmet' ? 'Helmet' : 'Vest'}</b> none</div>`;
    html += armor('helmet') + armor('vest') + `<div class="gear"><b>Backpack</b> ${inv.pack ? 'Lv.' + inv.pack : 'none'}</div>`;
    eq.innerHTML = html;
    eq.querySelectorAll('.att.on').forEach(b => b.onclick = () => { cmd({ c: 'detach', s: +b.dataset.s, t: b.dataset.t }); });
    // bag
    const bag = $('inv-bag');
    let bh = `<div class="weight"><span>Load ${inv.wt} / ${inv.cap}</span><div class="bar"><i style="width:${Math.min(100, 100 * inv.wt / inv.cap)}%"></i></div></div>`;
    for (const k in inv.ammo) if (inv.ammo[k]) bh += `<div class="row"><span>${AMMO[k].name}</span><b>${inv.ammo[k]}</b><button class="drop" data-k="ammo" data-id="${k}" data-n="${Math.min(30, inv.ammo[k])}">drop 30</button></div>`;
    for (const k in inv.heal) if (inv.heal[k]) bh += `<div class="row"><span>${HEALS[k].name}</span><b>${inv.heal[k]}</b><button class="use" data-id="${k}">use</button><button class="drop" data-k="heal" data-id="${k}" data-n="1">drop</button></div>`;
    for (const k in inv.thr) if (inv.thr[k]) bh += `<div class="row"><span>${THROWS[k].name}</span><b>${inv.thr[k]}</b><button class="drop" data-k="throw" data-id="${k}" data-n="1">drop</button></div>`;
    inv.atts.forEach((a, i) => {
      const fits = inv.w.map((w, s) => w && WEAPONS[w.id].atts.includes(ATTACH[a].type) && (ATTACH[a].type !== 'optic' || WEAPONS[w.id].optics.includes(a)) ? s : -1).filter(s => s >= 0);
      bh += `<div class="row"><span>${ATTACH[a].name}</span>${fits.map(s => `<button class="use" data-att="${i}" data-s="${s}">fit ${['P1', 'P2', 'S'][s]}</button>`).join('')}<button class="drop" data-k="att" data-i="${i}">drop</button></div>`;
    });
    bag.innerHTML = bh;
    const root = $('inventory');
    root.querySelectorAll('button.drop').forEach(b => b.onclick = () => { const d = b.dataset; cmd({ c: 'drop', k: d.k, s: +d.s, id: d.id, n: +d.n, i: +d.i }); });
    root.querySelectorAll('button.use[data-id]').forEach(b => b.onclick = () => cmd({ c: 'use', id: b.dataset.id }));
    root.querySelectorAll('button.use[data-att]').forEach(b => b.onclick = () => cmd({ c: 'attach', i: +b.dataset.att, s: +b.dataset.s }));
  }

  update(dt, mv) {
    const st = mv.status, inv = this.inv;
    // fps
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { $('fps').textContent = this.app.settings.showFps ? `${Math.round(this.fpsN / this.fpsAcc)} fps · ${Math.round(this.app.ping || 0)} ms` : ''; this.fpsAcc = 0; this.fpsN = 0; }
    // compass
    const deg = ((-mv.yaw * 180 / Math.PI) % 360 + 360) % 360;
    $('compass-strip').style.transform = `translateX(${-(deg + 360) * (52 / 15) + 260}px)`;
    $('compass-deg').textContent = Math.round(deg);
    // health
    const hp = st.alive ? (mv.pred.mode === MODE.KNOCKED ? st.bleed : st.hp) : 0;
    $('hp-fill').style.width = hp + '%';
    $('hp-fill').className = mv.pred.mode === MODE.KNOCKED ? 'knocked' : hp < 30 ? 'low' : '';
    $('boost-fill').style.width = st.boost + '%';
    if (inv) {
      $('helmet-ico').className = 'ico' + (inv.helmet ? ' t' + inv.helmet.tier : '');
      $('vest-ico').className = 'ico' + (inv.vest ? ' t' + inv.vest.tier : '');
      $('pack-ico').className = 'ico' + (inv.pack ? ' t' + inv.pack : '');
    }
    // weapon panel
    if (inv) {
      const w = st.slot < 3 ? inv.w[st.slot] : null;
      if (w) {
        const def = WEAPONS[w.id];
        $('w-name').textContent = def.name + (w.att && w.att.optic ? ' · ' + ATTACH[w.att.optic].name : '');
        $('w-mag').textContent = mv.predMag;
        $('w-res').textContent = inv.ammo[def.ammo];
        $('w-mode').textContent = def.burst ? (w.semi ? 'SEMI' : 'BURST') : def.auto ? (w.semi ? 'SEMI' : 'AUTO') : def.cls === 'sniper' ? 'BOLT' : def.cls === 'shotgun' ? 'PUMP' : 'SEMI';
      } else if (st.slot === 3) {
        $('w-name').textContent = THROWS[inv.thrSel].name; $('w-mag').textContent = inv.thr[inv.thrSel]; $('w-res').textContent = inv.thr.frag + inv.thr.smoke; $('w-mode').textContent = 'G: swap';
      } else { $('w-name').textContent = 'Unarmed'; $('w-mag').textContent = '–'; $('w-res').textContent = '–'; $('w-mode').textContent = ''; }
      const slots = $('w-slots').children;
      for (let s = 0; s < 4; s++) {
        const has = s < 3 ? !!inv.w[s] : inv.thr.frag + inv.thr.smoke > 0;
        slots[s].className = (st.slot === s ? 'on ' : '') + (has ? 'has' : '');
        slots[s].querySelector('em').textContent = s < 3 ? (inv.w[s] ? WEAPONS[inv.w[s].id].name : '') : (inv.thr.frag + inv.thr.smoke ? `${inv.thr.frag}F ${inv.thr.smoke}S` : '');
      }
      $('h-band').textContent = inv.heal.bandage; $('h-kit').textContent = inv.heal.kit; $('h-stim').textContent = inv.heal.stim;
    }
    // crosshair
    const ch = $('crosshair');
    const fpOk = st.alive && mv.pred.mode === MODE.GROUND && mv.adsT < 0.5;
    ch.style.display = fpOk ? '' : 'none';
    if (fpOk && inv) {
      const w = st.slot < 3 ? inv.w[st.slot] : null;
      const def = w ? WEAPONS[w.id] : null;
      const sp = def ? def.hip + Math.min(1, Math.hypot(mv.pred.vx, mv.pred.vz) / 5) * 1.6 + mv.fire.bloom : 2;
      const px = Math.max(4, Math.tan(sp * Math.PI / 360) * (window.innerHeight / 2) / Math.tan(this.app.renderer.camera.fov * Math.PI / 360));
      ch.style.setProperty('--gap', px + 'px');
    }
    // scope
    $('scope').classList.toggle('show', !!mv.scoped);
    // prompt
    const it = mv.interaction();
    const pr = $('prompt');
    if (it) {
      pr.style.display = '';
      $('prompt-text').textContent = it.text;
      const ring = $('prompt-ring');
      if (it.p !== null && it.p !== undefined) { ring.style.display = ''; ring.style.setProperty('--p', it.p); } else ring.style.display = 'none';
    } else pr.style.display = 'none';
    // counters
    $('alive').textContent = mv.alive;
    $('kills').textContent = mv.kills;
    const z = mv.zone;
    const tm = Math.max(0, Math.ceil(z.timer));
    $('zone-timer').textContent = z.state === 2 ? 'FINAL' : `${z.state === 1 ? 'CLOSING' : 'ASH IN'} ${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}`;
    $('zone-timer').className = z.state === 1 ? 'closing' : '';
    const dz = Math.hypot(mv.pred.x - z.nx, mv.pred.z - z.nz) - z.nr;
    $('zone-dist').textContent = dz > 0 ? `${Math.round(dz)} m to safety` : 'Inside next front';
    // squad
    this.slow -= dt;
    if (this.slow <= 0) { this.slow = 0.2; this.renderSquad(mv); if (this.inventoryOpen) this.renderInventory(); }
    // death / spectate
    if (!st.alive) {
      const t = st.spec >= 0 ? mv.name(st.spec) : null;
      $('spectating').textContent = t ? `Spectating ${t} · LMB / RMB to switch` : '';
    }
    this.drawMini(mv);
    if (this.mapOpen) this.drawBig(mv);
    this.drawTags(mv);
  }

  renderSquad(mv) {
    const el = $('squad');
    const mates = [...mv.roster.values()].filter(r => r.squad === mv.squad && r.id !== mv.me);
    let html = '';
    mates.forEach((m, i) => {
      const r = mv.remotes.get(m.id);
      const s = r && r.cur;
      const down = s && s.mode === MODE.KNOCKED, dead = !s || s.mode === MODE.DEAD;
      const hp = s && s.hp !== 255 ? s.hp : 0;
      html += `<div class="mate ${down ? 'down' : ''} ${dead ? 'dead' : ''}"><i style="background:${MATE_COLORS[(i + 1) % 4]}"></i><span>${esc(m.name)}${m.bot ? ' <small>BOT</small>' : ''}</span><div class="bar"><b style="width:${dead ? 0 : hp}%"></b></div></div>`;
    });
    el.innerHTML = html;
  }

  worldToMap(x, z, cx, cz, scale, size) { return [size / 2 + (x - cx) * scale, size / 2 + (z - cz) * scale]; }

  drawOverlays(g, mv, tx, tz, sc, size, big) {
    const P = (x, z) => [(x - tx) * sc + size / 2, (z - tz) * sc + size / 2];
    const z = mv.zone;
    // ash outside current circle
    g.save();
    g.fillStyle = 'rgba(70,40,25,0.42)';
    g.beginPath(); g.rect(0, 0, size, size);
    const [ccx, ccz] = P(z.cx, z.cz); g.arc(ccx, ccz, Math.max(0, z.cr * sc), 0, Math.PI * 2, true); g.fill('evenodd');
    g.strokeStyle = 'rgba(255,120,60,0.95)'; g.lineWidth = big ? 2.5 : 1.5;
    g.beginPath(); g.arc(ccx, ccz, Math.max(0, z.cr * sc), 0, Math.PI * 2); g.stroke();
    const [nx, nz] = P(z.nx, z.nz);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.setLineDash([6, 4]);
    g.beginPath(); g.arc(nx, nz, Math.max(0, z.nr * sc), 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // intel
    if (mv.intel && performance.now() - mv.intel.t < 30000) {
      if (mv.intel.c) { const [ix, iz] = P(mv.intel.c.x, mv.intel.c.z); g.strokeStyle = 'rgba(110,220,255,0.9)'; g.setLineDash([2, 4]); g.beginPath(); g.arc(ix, iz, mv.intel.c.r * sc, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
      if (performance.now() - mv.intel.t < 12000) { g.fillStyle = 'rgba(255,60,40,0.9)'; for (const [ex, ez] of mv.intel.en) { const [a, b] = P(ex, ez); g.beginPath(); g.arc(a, b, big ? 5 : 3, 0, 7); g.fill(); } }
    }
    // plane path
    if (mv.planeInfo && mv.planePos && mv.planePos.active) {
      const pi = mv.planeInfo;
      const [a1, b1] = P(pi.sx, pi.sz), [a2, b2] = P(pi.sx + pi.dx * pi.len, pi.sz + pi.dz * pi.len);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); g.setLineDash([]);
      const [px, pz] = P(mv.planePos.x, mv.planePos.z); g.fillStyle = '#fff'; g.beginPath(); g.arc(px, pz, big ? 5 : 3.5, 0, 7); g.fill();
    }
    // terminals
    for (const t of mv.terminals) { const [a, b] = P(t.x, t.z); g.fillStyle = (t.hacked === undefined || t.hacked < 0) ? 'rgba(90,230,150,0.95)' : 'rgba(120,120,120,0.8)'; g.fillRect(a - 3, b - 3, 6, 6); }
    // pings
    const now = performance.now();
    mv.pings = mv.pings.filter(p => now - p.t < 15000);
    for (const p of mv.pings) { const [a, b] = P(p.x, p.z); g.fillStyle = p.k === 'enemy' ? '#ff5040' : '#ffd24a'; g.beginPath(); g.moveTo(a, b - 7); g.lineTo(a + 5, b); g.lineTo(a, b + 7); g.lineTo(a - 5, b); g.closePath(); g.fill(); }
    // teammates
    let ci = 1;
    for (const r of mv.roster.values()) {
      if (r.squad !== mv.squad || r.id === mv.me) continue;
      const rm = mv.remotes.get(r.id);
      if (rm && rm.cur && rm.cur.mode !== MODE.DEAD) { const [a, b] = P(rm.cur.x, rm.cur.z); g.fillStyle = MATE_COLORS[ci % 4]; g.beginPath(); g.arc(a, b, big ? 5 : 3.5, 0, 7); g.fill(); }
      ci++;
    }
    // me
    const st = mv.status;
    const me = st.alive ? mv.pred : null;
    if (me) {
      const [a, b] = P(me.x, me.z);
      g.save(); g.translate(a, b); g.rotate(-mv.yaw);
      g.fillStyle = MATE_COLORS[0]; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    g.restore();
  }

  drawMini(mv) {
    if (!this.mapView) return;
    const g = this.miniG, size = this.mini.width;
    const me = mv.status.alive ? mv.pred : (mv.remotes.get(mv.status.spec) || {}).cur || mv.pred;
    const range = mv.pred.mode === MODE.PLANE || mv.pred.mode === MODE.FREEFALL ? 420 : 170;
    const sc = size / (range * 2);
    g.fillStyle = '#111'; g.fillRect(0, 0, size, size);
    g.drawImage(this.mapView.base, me.x + MAP_HALF - range, me.z + MAP_HALF - range, range * 2, range * 2, 0, 0, size, size);
    this.drawOverlays(g, mv, me.x, me.z, sc, size, false);
  }

  drawBig(mv) {
    const c = this.big;
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.86 | 0;
    if (c.width !== size) { c.width = c.height = size; }
    const g = this.bigG;
    g.drawImage(this.mapView.base, 0, 0, size, size);
    this.drawOverlays(g, mv, 0, 0, size / (MAP_HALF * 2), size, true);
  }

  // Teammate name tags and ping markers projected onto the screen.
  drawTags(mv) {
    const cam = this.app.renderer.camera;
    const v = new THREE.Vector3();
    const used = new Set();
    const W = window.innerWidth, H = window.innerHeight;
    const put = (key, x, y, z, html, cls) => {
      v.set(x, y, z).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
      let el = this.tags.get(key);
      if (!el) { el = document.createElement('div'); $('tags').appendChild(el); this.tags.set(key, el); }
      el.className = 'tag ' + cls; el.innerHTML = html;
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%, -100%)`;
      used.add(key);
    };
    let ci = 1;
    for (const r of mv.roster.values()) {
      if (r.squad !== mv.squad || r.id === mv.me) continue;
      const rm = mv.remotes.get(r.id);
      if (rm && rm.cur && rm.cur.mode !== MODE.DEAD && rm.cur.mode !== MODE.PLANE) {
        const d = Math.hypot(rm.cur.x - mv.camPos.x, rm.cur.z - mv.camPos.z);
        put('m' + r.id, rm.cur.x, rm.cur.y + (rm.cur.mode === MODE.KNOCKED ? 1 : 2.1), rm.cur.z, `<span style="color:${MATE_COLORS[ci % 4]}">${esc(r.name)}</span>${rm.cur.mode === MODE.KNOCKED ? ' <b>DOWN</b>' : ''}${d > 25 ? ` <small>${Math.round(d)}m</small>` : ''}`, 'mate');
      }
      ci++;
    }
    for (const p of mv.pings) {
      const d = Math.hypot(p.x - mv.camPos.x, p.z - mv.camPos.z);
      put('p' + p.tick + '_' + p.p, p.x, p.y + 0.5, p.z, `<i class="${p.k}"></i><small>${Math.round(d)}m</small>`, 'ping');
    }
    for (const [k, el] of this.tags) if (!used.has(k)) { el.remove(); this.tags.delete(k); }
  }
}
