// DOM screens and HUD. Screens are plain divs toggled by show(); the HUD updates at ~20 Hz.
import * as THREE from 'three';
import { KAIJU, UPGRADES, MISSIONS, CITIES, TIMES, FORMS, GENES, GENE_SLOTS, CHAIN, kaijuStats } from '../core/Config.js';
import { missionUnlocked, SETTINGS_DEF } from '../core/Save.js';
import { fmtMoney } from '../game/Play.js';

const $ = (id) => document.getElementById(id);
const TIPS = [
  'Knock out the lower floors and the storeys above will fall. Tall towers topple into their neighbours.',
  'Fires spread from floor to floor and eat away at a building from the inside.',
  'Helicopters keep their distance. Breath weapons and thrown boulders reach them; claws only reach the brave ones.',
  'Running through a block is faster than going around it, but buildings slow you down.',
  'Roar to scatter the crowds and rattle the gunners for a few seconds.',
  'Growth makes everything bigger: reach, health, damage. And it makes you easier to hit.',
  'Dust from a big collapse settles on everything nearby. Look for the grey neighbourhoods.',
  'Destruction fills the mutagen meter. When it is full, press T to surge: bigger, faster and far harder to stop.',
  'A Glacial strain freezes tanks where they stand and drops gunships out of the sky.',
  'Genes can be moved between kaiju for free. Buy each one once, slot it anywhere.',
  'Press T again during a surge to unleash the Cataclysm. It ends the surge, and most of the district.',
  'Rival kaiju enrage when they are losing. Save your surge for that moment.',
  'Keep the destruction going without a pause and the rampage chain climbs the ranks. The best chain pays out.',
];
const ELEMENT = { fire: 'Fire', ice: 'Frost', acid: 'Acid', quake: 'Aftershock', void: 'Rift' };

export class UI {
  constructor(app) {
    this.app = app;
    this.screen = 'loading';
    this.prev = null;
    this.selMission = 'landfall';
    this.tab = 'evo';     // dossier tab: evo, forms, genes
    this.preview = null;  // { id, form } previewed on the stage in the Mutation tab
    this.sandbox = { city: 'harbor', time: 'golden' };
    this.hudT = 0;
    this.pops = [];
    this.bannerT = 0;
    this.toastT = 0;
    $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.app.audio && this.app.audio.ui('click');
      this.act(b.dataset.act, b);
    });
    $('deploy').addEventListener('click', () => this.deploy());
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && ['settings', 'howto', 'credits'].includes(this.screen)) this.act('back');
    });
    this.app.canvas.addEventListener('click', () => { if (this.screen === 'hud' && !this.app.paused) this.app.input.lock(); });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.screen === 'hud' && this.app.state === 'play' && !this.app.paused && this.app.play && this.app.play.state === 'play') {
        this.app.pause(true);
      }
    });
  }

  show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('show');
    const el = $(id);
    if (el) el.classList.add('show');
    if (id !== this.screen) this.prev = this.screen;
    this.screen = id;
    if (id === 'lab') { this.preview = null; this.renderLab(); }
    if (id === 'settings') this.renderSettings();
  }

  act(a) {
    const app = this.app;
    switch (a) {
      case 'lab': app.audio.resume(); if (app.state === 'results') app.toMenu(); else { app.state = 'lab'; this.show('lab'); } break;
      case 'title': app.state = 'title'; this.show('title'); break;
      case 'settings': this.back = this.screen; this.show('settings'); break;
      case 'howto': this.back = this.screen; this.show('howto'); break;
      case 'credits': this.back = this.screen; this.show('credits'); break;
      case 'back': this.show(this.back || 'title'); break;
      case 'resume': app.pause(false); break;
      case 'retreat': app.retreat(); break;
      case 'quit': if (app.play) { app.play.state = 'done'; } app.paused = false; app.toMenu(); break;
      case 'retry': if (this.lastRun) app.startMission(this.lastRun.missionId, this.lastRun.kaijuId, this.lastRun.opts); break;
      case 'reload': location.reload(); break;
    }
  }

  loading(f, text) {
    if (this.screen !== 'loading') this.show('loading');
    $('load-fill').style.width = Math.round(f * 100) + '%';
    if (text) $('load-text').textContent = text;
  }

  error(msg) {
    $('err-text').textContent = msg;
    this.show('error');
  }

  // ------------------------------------------------------------------ lab

  renderLab() {
    const app = this.app, P = app.profile;
    $('bio').textContent = P.biomass.toLocaleString();
    const sel = P.selected;
    // roster
    const r = $('roster');
    r.innerHTML = '';
    for (const [id, d] of Object.entries(KAIJU)) {
      const c = document.createElement('div');
      const un = !!P.unlocked[id];
      c.className = 'kcard' + (id === (this.view || sel) ? ' sel' : '') + (un ? '' : ' locked');
      c.style.setProperty('--kc', d.color);
      const fm = un && P.mut[id] && P.mut[id].form !== 'prime' ? FORMS[P.mut[id].form] : null;
      c.innerHTML = `<div class="n">${d.name}</div><div class="t">${d.title}</div>${fm ? `<div class="strain" style="--sc:${fm.swatch[1]}">${fm.name.toUpperCase()}</div>` : ''}${un ? '' : `<div class="lock">${d.cost.toLocaleString()} ◆</div>`}`;
      c.onclick = () => { this.view = id; this.preview = null; if (un) app.selectKaiju(id); else app.menu.showKaiju(id); this.renderLab(); app.audio.ui('click'); };
      r.appendChild(c);
    }
    const id = this.view || sel;
    const d = KAIJU[id];
    const lv = P.levels[id] || {};
    const un = !!P.unlocked[id];
    const MU = P.mut[id] || { forms: ['prime'], form: 'prime', genes: [] };
    // the Mutation tab previews a strain: the stage and the stat bars show it before you buy
    const pf = this.tab === 'forms' && this.preview && this.preview.id === id ? this.preview.form : MU.form;
    const st = kaijuStats(id, lv, { form: pf, genes: MU.genes });
    const F = FORMS[pf];
    const D = $('dossier');
    D.style.setProperty('--kc', d.color);
    document.documentElement.style.setProperty('--accent', d.color);
    const bar = (label, v, max, txt) => `<div class="stat"><span>${label}</span><div class="sb"><i style="width:${Math.min(100, v / max * 100)}%"></i></div><b>${txt}</b></div>`;
    let h = `<div class="dn">${d.name}</div><div class="dt">${d.title}${pf !== 'prime' ? ` · <span class="dstrain" style="--sc:${F.swatch[1]}">${F.name} strain</span>` : ''}</div><div class="blurb">${d.blurb}</div>`;
    h += bar('HEALTH', st.hp, 3200, Math.round(st.hp));
    h += bar('ARMOUR', st.armor, 0.75, Math.round(st.armor * 100) + '%');
    h += bar('POWER', st.melee, 900, Math.round(st.melee));
    h += bar('SPEED', st.speed, 1.7, Math.round(st.speed * 100) + '%');
    h += bar('HEIGHT', d.height * st.scale, 130, Math.round(d.height * st.scale) + ' m');
    h += `<div class="sect">MOVES</div><div class="movelist">`;
    const keys = { attack1: 'LMB', attack2: 'LMB ×2', heavy: 'RMB', stomp: 'SPACE', special: 'Q / F' };
    for (const [k, m] of Object.entries(d.moves)) h += `<span class="k">${keys[k]}</span><span>${m.name}</span>`;
    h += `<span class="k">E</span><span>Roar</span><span class="k">T</span><span>Mutation Surge</span></div>`;
    if (un) {
      h += `<div class="tabs">${[['evo', 'EVOLUTION'], ['forms', 'MUTATION'], ['genes', 'GENES']].map(([t, l]) => `<button data-tab="${t}" class="${this.tab === t ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      if (this.tab === 'forms') h += this._formsTab(id, MU, pf);
      else if (this.tab === 'genes') h += this._genesTab(id, MU);
      else for (const u of UPGRADES) {
        const l = lv[u.id] || 0;
        const cost = l < u.max ? u.cost[l] : null;
        const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
        h += `<div class="up"><div class="un">${u.name}</div><button data-up="${u.id}" ${cost === null || P.biomass < cost ? 'disabled' : ''}>${cost === null ? 'MAX' : cost.toLocaleString() + ' ◆'}</button><div class="ud">${u.desc}</div><div class="pips">${pips}</div></div>`;
      }
    } else {
      h += `<button class="unlock" id="unlock" ${P.biomass < d.cost ? 'disabled' : ''}>AWAKEN ${d.name} · ${d.cost.toLocaleString()} ◆</button>`;
      if (P.biomass < d.cost) h += `<p class="note">Earn biomass by completing rampages to awaken this titan.</p>`;
    }
    D.innerHTML = h;
    if (this._dossierFor !== id) { D.scrollTop = 0; this._dossierFor = id; } // a new kaiju opens at the top
    for (const b of D.querySelectorAll('[data-up]')) b.onclick = () => { if (app.buyUpgrade(id, b.dataset.up)) this.renderLab(); };
    for (const b of D.querySelectorAll('[data-tab]')) b.onclick = () => {
      this.tab = b.dataset.tab;
      // leaving the Mutation tab puts the equipped strain back on the stage
      if (this.preview) { this.preview = null; app.menu.showKaiju(id, false); }
      this.renderLab();
      app.audio.ui('click');
    };
    for (const c of D.querySelectorAll('[data-form]')) c.onclick = () => {
      this.preview = { id, form: c.dataset.form };
      app.menu.showKaiju(id, false, c.dataset.form);
      this.renderLab();
      app.audio.ui('click');
    };
    const mb = $('mutate');
    if (mb) mb.onclick = () => { if (app.mutate(id, pf)) this.renderLab(); };
    for (const b of D.querySelectorAll('[data-gene]')) b.onclick = () => {
      const g = b.dataset.gene;
      if (P.genes.includes(g) ? app.toggleGene(id, g) : app.buyGene(g)) this.renderLab();
    };
    const ub = $('unlock');
    if (ub) ub.onclick = () => { if (app.unlockKaiju(id)) { this.view = id; this.renderLab(); } };
    // missions
    const M = $('missions');
    M.innerHTML = '';
    for (const m of MISSIONS) {
      const ok = missionUnlocked(P, m);
      const rec = P.missions[m.id];
      const c = document.createElement('div');
      c.className = 'mcard' + (m.id === this.selMission ? ' sel' : '') + (ok ? '' : ' locked');
      c.innerHTML = `<div class="mn">${m.name.toUpperCase()}</div><div class="mm">${m.sandbox ? 'Any city · any hour' : CITIES[m.city] + ' · ' + TIMES[m.time]}</div><div class="mb" title="${ok ? m.brief : ''}">${ok ? m.brief : 'Complete the previous rampage to unlock.'}</div><div class="mr">${rec && rec.done ? '<span class="done">✔ COMPLETE</span>' : m.reward ? '+' + m.reward.toLocaleString() + ' ◆ bonus' : 'Endless'}</div>`;
      if (ok) c.onclick = () => { this.selMission = m.id; this.renderLab(); app.audio.ui('click'); };
      M.appendChild(c);
    }
    const sm = MISSIONS.find((m) => m.id === this.selMission);
    const so = $('sandbox-opts');
    if (sm && sm.sandbox) {
      so.innerHTML = `<select id="sb-city">${Object.entries(CITIES).map(([k, v]) => `<option value="${k}" ${k === this.sandbox.city ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select id="sb-time">${Object.entries(TIMES).map(([k, v]) => `<option value="${k}" ${k === this.sandbox.time ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
      $('sb-city').onchange = (e) => { this.sandbox.city = e.target.value; };
      $('sb-time').onchange = (e) => { this.sandbox.time = e.target.value; };
    } else so.innerHTML = '';
    const dep = $('deploy');
    dep.disabled = !un;
    dep.textContent = un ? 'DEPLOY' : 'LOCKED';
  }

  _formsTab(id, M, pf) {
    const P = this.app.profile;
    let h = '<div class="forms">';
    for (const [fid, f] of Object.entries(FORMS)) {
      const sw = f.swatch || [KAIJU[id].color, KAIJU[id].color];
      const own = M.forms.includes(fid);
      h += `<div class="fcard${fid === pf ? ' sel' : ''}${fid === M.form ? ' active' : ''}" data-form="${fid}" style="--f1:${fid === 'prime' ? '#20262c' : sw[0]};--f2:${sw[1]}">
        <i class="sw"></i><div class="fn">${f.name.toUpperCase()}</div><div class="fe">${fid === M.form ? 'ACTIVE' : own ? 'GROWN' : f.cost.toLocaleString() + ' ◆'}</div></div>`;
    }
    h += '</div>';
    const F = FORMS[pf];
    const own = M.forms.includes(pf);
    h += `<div class="fdesc"><b>${F.name.toUpperCase()}${F.element ? ` <span>· ${ELEMENT[F.element]} blows</span>` : ''}</b><p>${F.desc}</p><ul>${F.perks.map((x) => `<li>${x}</li>`).join('')}</ul></div>`;
    if (pf === M.form) h += `<button class="unlock" disabled>ACTIVE STRAIN</button>`;
    else if (own) h += `<button class="unlock" id="mutate">${pf === 'prime' ? 'REVERT TO PRIME' : 'EQUIP ' + F.name.toUpperCase() + ' STRAIN'}</button>`;
    else h += `<button class="unlock" id="mutate" ${P.biomass < F.cost ? 'disabled' : ''}>MUTATE · ${F.cost.toLocaleString()} ◆</button>`;
    h += `<p class="note">Click a strain to see it on the stage. Each kaiju grows its own strains; once grown, switching is free.</p>`;
    return h;
  }

  _genesTab(id, M) {
    const P = this.app.profile;
    let h = `<div class="slots">${Array.from({ length: GENE_SLOTS }, (_, i) => {
      const g = M.genes[i];
      return g ? `<div class="slot on" data-gene="${g}" title="Remove">${GENES[g].name}<i>×</i></div>` : '<div class="slot">EMPTY SLOT</div>';
    }).join('')}</div>`;
    for (const [gid, g] of Object.entries(GENES)) {
      const own = P.genes.includes(gid), on = M.genes.includes(gid);
      const full = M.genes.length >= GENE_SLOTS;
      const btn = !own ? `<button data-gene="${gid}" ${P.biomass < g.cost ? 'disabled' : ''}>${g.cost.toLocaleString()} ◆</button>`
        : on ? `<button data-gene="${gid}" class="rm">REMOVE</button>` : `<button data-gene="${gid}" class="slotb" ${full ? 'disabled' : ''}>${full ? 'SLOTS FULL' : 'SLOT'}</button>`;
      h += `<div class="up gene${on ? ' on' : ''}"><div class="un">${g.name}</div>${btn}<div class="ud">${g.desc}</div></div>`;
    }
    h += `<p class="note">Genes are bought once and can be slotted into any kaiju, ${GENE_SLOTS} at a time.</p>`;
    return h;
  }

  deploy() {
    const app = this.app;
    const id = this.view || app.profile.selected;
    if (!app.profile.unlocked[id]) return;
    const m = MISSIONS.find((x) => x.id === this.selMission);
    const opts = m.sandbox ? { city: this.sandbox.city, time: this.sandbox.time } : {};
    this.lastRun = { missionId: m.id, kaijuId: id, opts };
    app.startMission(m.id, id, opts);
  }

  // ------------------------------------------------------------------ settings

  renderSettings() {
    const s = this.app.settings;
    const F = $('settings-form');
    const rows = [
      ['quality', 'Graphics quality', 'select', ['low', 'medium', 'high', 'ultra']],
      ['sensitivity', 'Look sensitivity', 'range', [0.2, 3, 0.05]],
      ['invertY', 'Invert look', 'check'],
      ['fov', 'Field of view', 'range', [40, 80, 1]],
      ['master', 'Master volume', 'range', [0, 1, 0.05]],
      ['music', 'Music volume', 'range', [0, 1, 0.05]],
      ['sfx', 'Effects volume', 'range', [0, 1, 0.05]],
      ['shake', 'Camera shake', 'range', [0, 1.5, 0.05]],
      ['reducedMotion', 'Reduced motion and flashes', 'check'],
      ['cinematics', 'Cinematic camera moments', 'check'],
      ['showFps', 'Show frame rate', 'check'],
    ];
    F.innerHTML = '';
    for (const [k, label, type, opt] of rows) {
      const l = document.createElement('label'); l.textContent = label; F.appendChild(l);
      const wrap = document.createElement('div');
      let input;
      if (type === 'select') {
        input = document.createElement('select');
        for (const o of opt) { const e = document.createElement('option'); e.value = o; e.textContent = o[0].toUpperCase() + o.slice(1); if (s[k] === o) e.selected = true; input.appendChild(e); }
        input.onchange = () => { s[k] = input.value; this.app.saveSettings(); if (k === 'quality') this.app.renderer.setQuality(s.quality); };
      } else if (type === 'range') {
        input = document.createElement('input'); input.type = 'range'; [input.min, input.max, input.step] = opt; input.value = s[k];
        const dp = +opt[2] >= 1 ? 0 : 2;
        const val = document.createElement('span'); val.className = 'val'; val.textContent = (+s[k]).toFixed(dp);
        input.oninput = () => { s[k] = +input.value; val.textContent = (+input.value).toFixed(dp); this.app.saveSettings(); };
        wrap.appendChild(input); wrap.appendChild(val); F.appendChild(wrap); continue;
      } else {
        input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!s[k];
        input.onchange = () => { s[k] = input.checked; this.app.saveSettings(); };
      }
      wrap.appendChild(input);
      F.appendChild(wrap);
    }
    const rl = document.createElement('label'); rl.textContent = 'Reset to defaults'; F.appendChild(rl);
    const rb = document.createElement('div'); const b = document.createElement('button'); b.className = 'ghost'; b.textContent = 'Reset';
    b.onclick = () => { Object.assign(s, SETTINGS_DEF); this.app.saveSettings(); this.renderSettings(); };
    rb.appendChild(b); F.appendChild(rb);
  }

  // ------------------------------------------------------------------ HUD

  // identity and move list: set as soon as the mission loads, so the intro shows the right kaiju
  hudSetup(play) {
    $('h-name').innerHTML = play.def.name + (play.form.tint ? ` <small>${play.form.name.toUpperCase()}</small>` : '');
    document.documentElement.style.setProperty('--accent', play.def.color);
    const c = play.def.moves.special.color;
    document.documentElement.style.setProperty('--mut', `rgb(${c.map((x) => Math.round(Math.min(1, x) * 255)).join(',')})`);
    const k = { attack: 'LMB', heavy: 'RMB', special: 'Q', stomp: 'SPC', roar: 'E', surge: 'T' };
    const mv = play.def.moves;
    $('h-moves').innerHTML = [['special', mv.special.name], ['heavy', mv.heavy.name], ['stomp', mv.stomp.name], ['roar', 'Roar'], ['surge', 'Surge']]
      .map(([n, label]) => `<div class="mv"><span class="key" id="mv-${n}">${k[n]}<i></i></span>${label}</div>`).join('');
    $('h-hint').textContent = 'WASD move · Shift run · LMB attack · RMB heavy · Hold Q special · Space ' + mv.stomp.name.toLowerCase() + ' · T surge · Esc pause';
  }

  missionStart(play) {
    this.hudSetup(play);
    this.banner(play.mission.name.toUpperCase(), play.mission.brief, 5);
    $('h-hint').style.opacity = '';
    setTimeout(() => { $('h-hint').style.opacity = 0; }, 14000);
  }

  banner(title, sub = '', dur = 3) {
    const b = $('h-banner');
    b.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    b.classList.add('on');
    this.bannerT = dur;
  }

  toast(t) {
    const e = $('h-toast');
    e.textContent = t;
    e.classList.add('on');
    this.toastT = 1.6;
  }

  // A rampage chain rank: big, brief, centre screen.
  rank(name, r) {
    const e = $('h-rank');
    e.textContent = name;
    e.className = 'rank';
    void e.offsetWidth; // restart the animation
    e.className = 'rank on r' + r;
  }

  objectiveComplete(play) {
    this.banner('OBJECTIVE COMPLETE', 'Keep going, or retreat to the sea (Esc) to bank your biomass.', 5);
  }

  popup(worldPos, text) {
    if (this.pops.length > 8) return;
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    $('popups').appendChild(el);
    this.pops.push({ el, p: worldPos.clone(), t: 0 });
  }

  hud(play) {
    this.hudT -= 1;
    const k = play.kaiju;
    const v = new THREE.Vector3();
    // popups follow their world position every frame
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const P = this.pops[i];
      P.t += 1 / 60;
      v.copy(P.p); v.y += P.t * 30;
      v.project(play.camera);
      if (v.z > 1 || P.t > 2.2) { P.el.remove(); this.pops.splice(i, 1); continue; }
      P.el.style.left = (v.x * 0.5 + 0.5) * innerWidth + 'px';
      P.el.style.top = (-v.y * 0.5 + 0.5) * innerHeight + 'px';
      P.el.style.opacity = Math.min(1, (2.2 - P.t) * 2);
    }
    if (this.hudT > 0) return;
    this.hudT = 3;
    $('h-hp').style.width = (k.hp / k.maxHp * 100) + '%';
    $('h-hp-t').textContent = Math.min(Math.ceil(k.hp), Math.round(k.maxHp)) + ' / ' + Math.round(k.maxHp);
    $('h-en').style.width = (k.energy / k.maxEnergy * 100) + '%';
    const S = play.surge;
    $('h-mu').style.width = (S.meter * 100) + '%';
    const mu = $('h-mu').parentNode;
    mu.classList.toggle('ready', S.meter >= 1 && !S.on);
    mu.classList.toggle('on', S.on);
    $('h-mu-t').textContent = S.on ? 'SURGE' : S.meter >= 1 ? 'SURGE READY · T' : 'MUTAGEN';
    const su = $('mv-surge');
    if (su) { su.querySelector('i').style.height = Math.round(S.meter * 100) + '%'; su.classList.toggle('ready', S.meter >= 1 && !S.on); }
    $('h-money').textContent = '$' + fmtMoney(play.score.damage);
    $('h-sub').textContent = `${play.score.buildings} buildings · ${play.score.towers} towers · ${play.score.kills} military`;
    const t = Math.floor(play.time);
    $('h-time').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    const th = Math.round(play.threat);
    $('h-threat').innerHTML = '★'.repeat(th) + `<span class="off">${'★'.repeat(5 - th)}</span>`;
    const goals = play.mission.goals;
    $('h-obj').innerHTML = goals.map((g) => `<div class="obj ${g.progress >= 1 ? 'done' : ''}">${g.progress >= 1 ? '✔ ' : ''}${g.label}<span class="pb"><i style="width:${Math.round((g.progress || 0) * 100)}%"></i></span></div>`).join('')
      || '<div class="obj">FREE RAMPAGE</div>';
    $('h-cross').classList.toggle('on', k.special.on || this.app.input.special);
    // rival health
    const R = play.rival, bossEl = $('h-boss');
    const showBoss = !!(R && R.k && R.state !== 'loading');
    bossEl.classList.toggle('on', showBoss);
    if (showBoss) {
      const c = R.def.moves.special.color;
      bossEl.style.setProperty('--rc', `rgb(${c.map((x) => Math.round(Math.min(1, x) * 255)).join(',')})`);
      $('h-boss-n').innerHTML = `${R.name}<small>${R.strain.toUpperCase()} STRAIN${R.enraged ? ' · ENRAGED' : ''}</small>`;
      $('h-boss-hp').style.width = Math.max(0, R.k.hp / R.k.maxHp * 100) + '%';
      bossEl.classList.toggle('enraged', R.enraged);
    }
    // rampage chain
    const C = play.chain, ch = $('h-chain');
    ch.classList.toggle('on', C.v > 0);
    if (C.v > 0) {
      $('h-chain-v').textContent = '$' + fmtMoney(C.v);
      $('h-chain-r').textContent = C.rank >= 0 ? CHAIN.ranks[C.rank][1] : '';
      $('h-chain-t').style.width = Math.max(0, C.t / CHAIN.window * 100) + '%';
    }
    const fd = $('h-feed');
    fd.innerHTML = play.feed.filter((f) => play.time - f.t < 6).map((f) => `<div style="opacity:${Math.max(0, 1 - (play.time - f.t - 4) / 2)}">${f.text}</div>`).join('');
    const sp = $('mv-special');
    if (sp) sp.querySelector('i').style.height = Math.min(100, k.energy / Math.max(1, play.def.moves.special.cost) * 100 * 0.35) + '%';
    $('h-fps').textContent = this.app.settings.showFps ? Math.round(this.app.fps) + ' fps' : '';
  }

  frame(dt) {
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('h-banner').classList.remove('on'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('h-toast').classList.remove('on'); }
  }

  // ------------------------------------------------------------------ results

  results(play, res, reward) {
    for (const p of this.pops) p.el.remove();
    this.pops = [];
    $('r-label').textContent = res.died ? 'DEFEATED' : res.retreat ? 'RETREATED TO THE SEA' : 'RAMPAGE OVER';
    $('r-title').textContent = res.complete ? play.mission.name.toUpperCase() + ' · COMPLETE' : play.mission.name.toUpperCase();
    const s = play.score;
    const t = Math.floor(play.time);
    const cells = [
      ['DAMAGE', '$' + fmtMoney(s.damage)], ['BUILDINGS', s.buildings], ['SKYSCRAPERS', s.towers],
      ['CITY DESTROYED', (play.world.buildings.destroyedFraction * 100).toFixed(1) + '%'], ['MILITARY', s.kills], ['TIME', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')],
      ['RIVALS SLAIN', s.rivals || 0], ['BEST CHAIN', '$' + fmtMoney(play.chain.best) + (play.chain.bestRank >= 0 ? `<small>${CHAIN.ranks[play.chain.bestRank][1]}</small>` : '')],
    ];
    $('r-stats').innerHTML = cells.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    $('r-reward').textContent = '+' + reward.toLocaleString() + (res.died ? '  (halved: defeated)' : '');
    this.lastRun = { missionId: play.mission.id, kaijuId: play.cfg.kaijuId, opts: { city: play.cfg.city, time: play.cfg.time } };
    this.show('results');
  }
}
