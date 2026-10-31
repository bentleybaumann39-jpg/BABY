// Out-of-match screens: play (online server / practice), party lobby, locker, stats, settings,
// results and the in-match pause overlay.
import { MODES } from '../../../shared/constants.js';
import { CATALOG, levelInfo, xpToNext, MAX_LEVEL } from '../../../shared/progression.js';
import { QUALITY } from '../core/Settings.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Menu {
  constructor(app) {
    this.app = app;
    this.tab = 'play';
    this.lockerKind = 'camo';
    document.querySelectorAll('#menu-tabs button').forEach(b => b.onclick = () => { this.app.audio.play('ui', 0.4); this.show(b.dataset.tab); });
    $('btn-online').onclick = () => app.goOnline($('server-url').value.trim());
    $('btn-practice').onclick = () => app.goPractice();
    $('btn-disconnect').onclick = () => app.disconnect();
    $('name-input').onchange = () => { const n = $('name-input').value.trim().slice(0, 16); app.settings.set('name', n); if (app.conn) app.conn.send({ t: 'name', name: n }); };
    $('btn-join').onclick = () => { const c = $('join-code').value.trim().toUpperCase(); if (c && app.conn) app.conn.send({ t: 'party.join', code: c }); };
    $('btn-leave-party').onclick = () => app.conn && app.conn.send({ t: 'party.leave' });
    $('btn-fill').onclick = () => app.conn && this.party && app.conn.send({ t: 'party.fill', fill: !this.party.fill });
    document.querySelectorAll('#mode-buttons button').forEach(b => b.onclick = () => app.conn && app.conn.send({ t: 'party.mode', mode: b.dataset.mode }));
    $('btn-play').onclick = () => { if (!app.conn) return; app.audio.init(); app.conn.send({ t: this.party && this.party.queued ? 'unqueue' : 'queue' }); };
    $('results-continue').onclick = () => app.leaveMatch();
    $('pause-resume').onclick = () => { this.hidePause(); app.input.lock(); };
    $('pause-settings').onclick = () => { $('pause-settings-panel').classList.toggle('show'); };
    $('pause-leave').onclick = () => { this.hidePause(); app.leaveMatch(); };
    this.buildSettings($('settings-form'));
    this.buildSettings($('pause-settings-panel'));
    $('name-input').value = app.settings.name || '';
    $('server-url').value = app.settings.server || app.defaultServer() || '';
  }

  show(tab) {
    this.tab = tab;
    document.querySelectorAll('#menu-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('.menu-tab').forEach(s => s.classList.toggle('show', s.id === 'tab-' + tab));
    if (tab === 'locker') this.renderLocker();
    if (tab === 'stats') this.renderStats();
    this.app.menuCamera(tab);
  }

  open() { $('menu').classList.add('show'); $('menu').scrollTop = 0; this.show(this.tab); this.renderProfile(); this.renderConn(); }
  close() { $('menu').classList.remove('show'); }

  renderConn() {
    const app = this.app, c = app.conn;
    $('conn-panel').classList.toggle('connected', !!c);
    $('conn-status').textContent = !c ? 'Not connected' : c.kind === 'local' ? 'Practice mode · offline vs bots' : `Online · ${app.serverLabel}`;
    $('party-panel').style.display = c ? '' : 'none';
    $('join-row').style.display = c && c.kind === 'ws' ? '' : 'none';
  }

  setError(m) { const e = $('conn-error'); e.textContent = m || ''; e.style.display = m ? '' : 'none'; }

  renderProfile() {
    const p = this.app.profile;
    if (!p) { $('profile-chip').style.display = 'none'; return; }
    $('profile-chip').style.display = '';
    const li = levelInfo(p.xp);
    $('pc-name').textContent = p.name;
    $('pc-level').textContent = li.level;
    $('pc-title').textContent = (CATALOG.title.find(t => t.id === (p.cos || {}).title) || CATALOG.title[0]).name;
    $('pc-xp').style.width = li.need ? (100 * li.into / li.need) + '%' : '100%';
    $('pc-xptext').textContent = li.need ? `${li.into} / ${li.need} XP` : 'MAX LEVEL';
    if (document.activeElement !== $('name-input')) $('name-input').value = p.name;
  }

  renderParty(party, myId) {
    this.party = party;
    const lead = party.leader === myId;
    $('party-code').textContent = party.code;
    $('party-code-row').style.display = this.app.conn && this.app.conn.kind === 'ws' ? '' : 'none';
    $('party-members').innerHTML = party.members.map(m => `<div class="member ${m.id === party.leader ? 'leader' : ''}"><b>${esc(m.name)}</b><span>Lv ${m.level}</span>${m.inMatch ? '<em>in match</em>' : ''}</div>`).join('') +
      Array.from({ length: Math.max(0, MODES[party.mode].squad - party.members.length) }, () => `<div class="member open"><span>${party.fill ? 'Open slot — filled by players or bots' : 'Open slot — filled by a bot'}</span></div>`).join('');
    document.querySelectorAll('#mode-buttons button').forEach(b => { b.classList.toggle('on', b.dataset.mode === party.mode); b.disabled = !lead || party.queued; });
    $('btn-fill').textContent = `Fill squad: ${party.fill ? 'ON' : 'OFF'}`;
    $('btn-fill').disabled = !lead || party.queued || (this.app.conn && this.app.conn.kind === 'local');
    const play = $('btn-play');
    play.disabled = !lead;
    play.textContent = party.queued ? 'CANCEL' : lead ? (this.app.conn.kind === 'local' ? 'DEPLOY (PRACTICE)' : 'DEPLOY') : 'WAITING FOR LEADER';
    play.classList.toggle('queued', !!party.queued);
    $('queue-info').textContent = party.queued ? `Matchmaking · ${party.queueHumans} player${party.queueHumans === 1 ? '' : 's'} queued · drop in ${party.countdown}s` : '';
  }

  renderLocker() {
    const p = this.app.profile; if (!p) return;
    const lvl = levelInfo(p.xp).level;
    const kinds = { camo: 'Camo', helmet: 'Helmet', finish: 'Weapon finish', title: 'Title' };
    $('locker-kinds').innerHTML = Object.entries(kinds).map(([k, n]) => `<button data-k="${k}" class="${k === this.lockerKind ? 'on' : ''}">${n}</button>`).join('');
    $('locker-kinds').querySelectorAll('button').forEach(b => b.onclick = () => { this.lockerKind = b.dataset.k; this.renderLocker(); });
    const list = CATALOG[this.lockerKind];
    const cur = (p.cos || {})[this.lockerKind];
    $('locker-grid').innerHTML = list.map(it => {
      const locked = it.level > lvl;
      const sw = it.c ? (Array.isArray(it.c) ? `<i class="sw" style="background:linear-gradient(135deg,${it.c[0]} 0 30%,${it.c[1]} 30% 55%,${it.c[2]} 55% 80%,${it.c[3]} 80%)"></i>` : `<i class="sw" style="background:${it.c}"></i>`) : '';
      return `<button class="item ${it.id === cur ? 'on' : ''} ${locked ? 'locked' : ''}" data-id="${it.id}" ${locked ? 'disabled' : ''}>${sw}<b>${esc(it.name)}</b><span>${locked ? 'Unlocks at Lv ' + it.level : it.id === cur ? 'Equipped' : 'Equip'}</span></button>`;
    }).join('');
    $('locker-grid').querySelectorAll('button.item:not(.locked)').forEach(b => b.onclick = () => {
      const cos = { ...(p.cos || {}), [this.lockerKind]: b.dataset.id };
      p.cos = cos;
      if (this.app.conn) this.app.conn.send({ t: 'cos', cos }); else this.app.saveOfflineCos(cos);
      this.app.audio.play('ui', 0.5);
      this.renderLocker(); this.renderProfile();
      this.app.refreshPreview();
    });
    $('locker-note').textContent = this.app.conn ? '' : 'Connect online or start practice to save your loadout to that profile.';
  }

  renderStats() {
    const p = this.app.profile; if (!p) { $('stats-grid').innerHTML = '<p>Connect to see your stats.</p>'; $('history').innerHTML = ''; return; }
    const s = p.stats;
    const kd = (s.kills / Math.max(1, s.deaths)).toFixed(2);
    const cards = [['Matches', s.matches], ['Wins', s.wins], ['Top 10', s.top10], ['Kills', s.kills], ['K/D', kd], ['Damage', s.damage], ['Revives', s.revives], ['Headshots', s.headshots], ['Longest kill', s.longest + ' m'], ['Time alive', Math.round(s.timePlayed / 60) + ' min']];
    $('stats-grid').innerHTML = cards.map(([k, v]) => `<div class="card"><span>${k}</span><b>${v}</b></div>`).join('');
    $('history').innerHTML = p.history.length ? `<table><tr><th>When</th><th>Mode</th><th>Place</th><th>Kills</th><th>Damage</th><th>XP</th></tr>${p.history.map(h => `<tr><td>${new Date(h.at).toLocaleString()}</td><td>${h.mode}</td><td>#${h.place}</td><td>${h.kills}</td><td>${h.dmg}</td><td>+${h.xp}</td></tr>`).join('')}</table>` : '<p class="dim">No matches yet. Deploy!</p>';
  }

  buildSettings(root) {
    const S = this.app.settings;
    const rows = [
      ['quality', 'Graphics quality', 'select', Object.entries(QUALITY).map(([k, v]) => [k, v.label])],
      ['fov', 'Field of view', 'range', [65, 105, 1]],
      ['sens', 'Mouse sensitivity', 'range', [0.1, 4, 0.05]],
      ['adsSens', 'Aim sensitivity', 'range', [0.2, 2, 0.05]],
      ['invertY', 'Invert Y', 'check'],
      ['adsToggle', 'Toggle aim (instead of hold)', 'check'],
      ['crouchToggle', 'Toggle crouch', 'check'],
      ['brightness', 'Brightness', 'range', [0.6, 1.6, 0.05]],
      ['master', 'Master volume', 'range', [0, 1, 0.05]],
      ['sfx', 'Effects volume', 'range', [0, 1, 0.05]],
      ['music', 'Ambience volume', 'range', [0, 1, 0.05]],
      ['showFps', 'Show FPS / ping', 'check'],
    ];
    root.innerHTML = rows.map(([k, label, type, opt]) => {
      if (type === 'select') return `<label><span>${label}</span><select data-k="${k}">${opt.map(([v, n]) => `<option value="${v}" ${S[k] === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
      if (type === 'check') return `<label class="chk"><span>${label}</span><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}></label>`;
      return `<label><span>${label} <output>${S[k]}</output></span><input type="range" data-k="${k}" min="${opt[0]}" max="${opt[1]}" step="${opt[2]}" value="${S[k]}"></label>`;
    }).join('');
    root.querySelectorAll('[data-k]').forEach(inp => {
      const k = inp.dataset.k;
      const ev = inp.type === 'range' ? 'input' : 'change';
      inp.addEventListener(ev, () => {
        const v = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? Number(inp.value) : inp.value;
        S.set(k, v);
        const out = inp.parentElement.querySelector('output'); if (out) out.textContent = v;
        document.querySelectorAll(`[data-k="${k}"]`).forEach(o => { if (o !== inp) { if (o.type === 'checkbox') o.checked = v; else o.value = v; const ou = o.parentElement.querySelector('output'); if (ou) ou.textContent = v; } });
      });
    });
  }

  showResults(m) {
    const r = m.you, xp = m.xp;
    $('results').classList.add('show');
    document.getElementById('hud').classList.remove('show');
    $('res-place').textContent = r.place === 1 ? 'LAST SQUAD STANDING' : `#${r.place}`;
    $('res-place').className = r.place === 1 ? 'win' : '';
    $('res-sub').textContent = r.place === 1 ? 'You outlasted the ash.' : `Winners: ${m.winners.join(', ')}`;
    const mm = Math.floor(r.survived / 60), ss = Math.round(r.survived % 60);
    $('res-stats').innerHTML = [['Kills', r.kills], ['Assists', r.assists], ['Damage', Math.round(r.dmg)], ['Revives', r.revives], ['Survived', `${mm}:${String(ss).padStart(2, '0')}`], ['Longest kill', r.longest + ' m']].map(([k, v]) => `<div class="card"><span>${k}</span><b>${v}</b></div>`).join('');
    const rows = $('res-xp');
    rows.innerHTML = '';
    xp.rows.forEach((row, i) => setTimeout(() => { const d = document.createElement('div'); d.className = 'xprow'; d.innerHTML = `<span>${esc(row.label)}</span><b>+${row.xp}</b>`; rows.appendChild(d); this.app.audio.play('ui', 0.3); }, 250 + i * 220));
    setTimeout(() => {
      const d = document.createElement('div'); d.className = 'xprow total'; d.innerHTML = `<span>Total</span><b>+${xp.xp} XP</b>`; rows.appendChild(d);
      const a = xp.after;
      $('res-level').textContent = `Level ${a.level}${a.level > xp.before.level ? '  ▲ LEVEL UP' : ''}`;
      $('res-levelbar').style.width = a.need ? (100 * a.into / a.need) + '%' : '100%';
      $('res-unlocks').innerHTML = xp.unlocks.length ? 'Unlocked: ' + xp.unlocks.map(u => `<b>${esc(u.name)}</b> <small>${u.kind}</small>`).join(', ') : '';
      if (a.level > xp.before.level) this.app.audio.play('killconfirm', 0.8);
    }, 300 + xp.rows.length * 220);
    void xpToNext; void MAX_LEVEL;
  }
  hideResults() { $('results').classList.remove('show'); }

  showPause() { $('pause').classList.add('show'); this.app.hud.menuOpen = true; }
  hidePause() { $('pause').classList.remove('show'); $('pause-settings-panel').classList.remove('show'); this.app.hud.menuOpen = false; }
}
