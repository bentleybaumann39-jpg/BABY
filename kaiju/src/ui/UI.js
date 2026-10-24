// DOM screens and HUD. Screens are plain divs toggled by show(); the HUD updates at ~20 Hz.
import * as THREE from 'three';
import { KAIJU, UPGRADES, MISSIONS, CITIES, TIMES, kaijuStats } from '../core/Config.js';
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
];

export class UI {
  constructor(app) {
    this.app = app;
    this.screen = 'loading';
    this.prev = null;
    this.selMission = 'landfall';
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
    if (id === 'lab') this.renderLab();
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
      c.innerHTML = `<div class="n">${d.name}</div><div class="t">${d.title}</div>${un ? '' : `<div class="lock">${d.cost.toLocaleString()} ◆</div>`}`;
      c.onclick = () => { this.view = id; if (un) app.selectKaiju(id); else app.menu.showKaiju(id); this.renderLab(); app.audio.ui('click'); };
      r.appendChild(c);
    }
    const id = this.view || sel;
    const d = KAIJU[id];
    const lv = P.levels[id] || {};
    const st = kaijuStats(id, lv);
    const un = !!P.unlocked[id];
    const D = $('dossier');
    D.style.setProperty('--kc', d.color);
    document.documentElement.style.setProperty('--accent', d.color);
    const bar = (label, v, max, txt) => `<div class="stat"><span>${label}</span><div class="sb"><i style="width:${Math.min(100, v / max * 100)}%"></i></div><b>${txt}</b></div>`;
    let h = `<div class="dn">${d.name}</div><div class="dt">${d.title}</div><div class="blurb">${d.blurb}</div>`;
    h += bar('HEALTH', st.hp, 3200, Math.round(st.hp));
    h += bar('ARMOUR', st.armor, 0.75, Math.round(st.armor * 100) + '%');
    h += bar('POWER', st.melee, 900, Math.round(st.melee));
    h += bar('SPEED', st.speed, 1.7, Math.round(st.speed * 100) + '%');
    h += bar('HEIGHT', d.height * st.scale, 130, Math.round(d.height * st.scale) + ' m');
    h += `<div class="sect">MOVES</div><div class="movelist">`;
    const keys = { attack1: 'LMB', attack2: 'LMB ×2', heavy: 'RMB', stomp: 'SPACE', special: 'Q / F' };
    for (const [k, m] of Object.entries(d.moves)) h += `<span class="k">${keys[k]}</span><span>${m.name}</span>`;
    h += `<span class="k">E</span><span>Roar</span></div>`;
    if (un) {
      h += `<div class="sect">EVOLUTION</div>`;
      for (const u of UPGRADES) {
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
    for (const b of D.querySelectorAll('[data-up]')) b.onclick = () => { if (app.buyUpgrade(id, b.dataset.up)) this.renderLab(); };
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
    $('h-name').textContent = play.def.name;
    document.documentElement.style.setProperty('--accent', play.def.color);
    const k = { attack: 'LMB', heavy: 'RMB', special: 'Q', stomp: 'SPC', roar: 'E' };
    const mv = play.def.moves;
    $('h-moves').innerHTML = [['special', mv.special.name], ['heavy', mv.heavy.name], ['stomp', mv.stomp.name], ['roar', 'Roar']]
      .map(([n, label]) => `<div class="mv"><span class="key" id="mv-${n}">${k[n]}<i></i></span>${label}</div>`).join('');
    $('h-hint').textContent = 'WASD move · Shift run · LMB attack · RMB heavy · Hold Q special · Space ' + mv.stomp.name.toLowerCase() + ' · Esc pause';
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

  objectiveComplete(play) {
    this.banner('OBJECTIVE COMPLETE', 'Keep going, or retreat to the sea (Esc) to bank your biomass.', 5);
  }

  popup(worldPos, text) {
    if (this.pops.length > 14) return;
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
    $('h-hp-t').textContent = Math.ceil(k.hp) + ' / ' + Math.round(k.maxHp);
    $('h-en').style.width = (k.energy / k.maxEnergy * 100) + '%';
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
    ];
    $('r-stats').innerHTML = cells.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    $('r-reward').textContent = '+' + reward.toLocaleString() + (res.died ? '  (halved: defeated)' : '');
    this.lastRun = { missionId: play.mission.id, kaijuId: play.cfg.kaijuId, opts: { city: play.cfg.city, time: play.cfg.time } };
    this.show('results');
  }
}
