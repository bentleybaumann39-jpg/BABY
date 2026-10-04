// DOM UI: minimal HUD, document reader, journal, terminal, menus, death and ending screens.
import { DOCS } from '../story/Documents.js';
import { ITEMS } from '../player/Inventory.js';
import { CELL, ZONES } from '../world/MapData.js';
import { drawPicto } from '../world/Decor.js';

const $ = (id) => document.getElementById(id);

export const ENDINGS = {
  quiet_job: {
    title: 'THE QUIET JOB',
    text: `You leave Chamber Zero sealed. You leave the money in the envelope on the reception desk.

The road is black and wet. Twenty minutes out, the car phone rings.
Number withheld.

You let it ring. It rings until you reach the motorway, and then it stops, and the voicemail light comes on.

You never play it. But some nights, in the quiet between cars, you hear it anyway:
"Thank you for coming. Come back. Come. Back."`,
  },
  carrier: {
    title: 'CARRIER',
    text: `You run. Past the red lights, through the gate, into the car. Larkhollow shrinks in the mirror until the trees take it.

At home you play the tape. Sixty seconds of room tone. Chamber Zero, perfectly empty.

The needle doesn't move. The flat doesn't hum. The fridge has stopped. The rain has stopped. Your own heartbeat, which you have never once listened to, is gone.

You stand up. You take a step.

You hear one more.`,
  },
  full_spectrum: {
    title: 'FULL SPECTRUM',
    text: `When the sweep ends, Larkhollow is ringing like a struck bell — every pipe, every speaker, every pane of glass.

Then it settles. And the building hums. Fluorescent tubes buzz. Water drips. Rain ticks on the windows. Ordinary, beautiful noise.

You drive out at dawn with the windows down so you can hear the tyres.

Somewhere in the forest a bird starts singing, and it does not stop.`,
  },
  room_tone: {
    title: 'ROOM TONE',
    text: `Six reels. Six voices, played into the quietest room in the world.

It does not attack. It sits in the chair and it listens, its dish tilted like a child at a radio. With every voice it gets — fuller. Louder. Less.

When the last reel runs out, there is a man in the chair. He is crying, and you can hear it.

"Is the window manned?" says Daniel Keene. "I think I'd like to go home now."

You record sixty seconds of room tone on the way out. The needle moves the whole time.`,
  },
};

const DEATH_LINES = [
  'Your footsteps continued down the corridor for a while.\nThen they stopped too.',
  'It took the sound of your heart first.\nYou didn\'t notice until it was the only thing missing.',
  'Somewhere in Larkhollow, a recorder is still running.\nOn the tape there is nothing at all.',
  'The building is a little quieter now.',
];

export class UI {
  constructor(game) {
    this.game = game;
    this.timers = {};
    this.terminal = null;
    this.journalTab = 'docs';
    this.hud = $('hud');
    this.bindMenus();
  }

  show(id, on = true) { $(id).classList.toggle('show', on); }
  hideAllScreens() { for (const id of ['title', 'pause', 'settings', 'gallery', 'death', 'ending', 'reader', 'terminal', 'journal', 'click-to-play']) this.show(id, false); }

  // ---------------------------------------------------------------- HUD
  setPrompt(html) {
    const el = $('prompt');
    if (this._prompt === html) return;
    this._prompt = html;
    el.innerHTML = html || '';
    el.classList.toggle('show', !!html);
    $('crosshair').classList.toggle('active', !!html);
  }

  flash(id, text, sec, cls = 'show') {
    const el = $(id);
    el.innerHTML = text;
    el.classList.add(cls);
    clearTimeout(this.timers[id]);
    this.timers[id] = setTimeout(() => el.classList.remove(cls), sec * 1000);
  }

  notify(text) { this.flash('notify', text, 3); }
  hint(text, sec = 3) { this.flash('hint', text, sec); }
  caption(text, sec = 2.5) { if (this.game.settings.get('captions')) this.flash('caption', text, sec); }
  subtitle(text, sec = 3, who = null) {
    if (!this.game.settings.get('subtitles') && who) return;
    this.flash('subtitle', (who ? `<span class="who">${who}:</span>` : '') + text, sec);
  }
  objective(text) {
    const el = $('objective');
    el.textContent = text || '';
    el.classList.toggle('show', !!text);
    this.game.story && (this.game.story.flags.objective = text || '');
  }
  setSlats(on) { $('slats').classList.toggle('show', on); $('crosshair').classList.toggle('hidden', on); }
  setFade(v, sec = 0.5) { const f = $('fade'); f.style.transition = `opacity ${sec}s`; f.style.opacity = v; }
  battery(level, show) {
    const b = $('battery');
    b.classList.toggle('show', show);
    b.classList.toggle('low', level < 0.2);
    b.firstElementChild.style.width = Math.max(0, level * 40) + 'px';
  }

  // ---------------------------------------------------------------- reader
  openReader(id) {
    const d = DOCS[id];
    if (!d) return;
    const p = $('paper');
    p.className = 'paper ' + (d.style || 'typed');
    let text = d.text;
    if (text.includes('{VALVES}')) {
      const names = ['flat side right', 'flat side down', 'flat side left', 'flat side up'];
      text = text.replace('{VALVES}', this.game.story.valveSolution.map((v, k) => `   valve ${k + 1}: ◐ (${names[v]})`).join('\n'));
    }
    p.innerHTML = `<b>${d.title}</b>\n\n` + text;
    if (d.picto) {
      const c = document.createElement('canvas'); c.width = 520; c.height = 70;
      const g = c.getContext('2d');
      ['bird', 'cup', 'bed', 'bulb', 'flame', 'speaker', 'bell', 'drop'].forEach((n, k) => drawPicto(g, n, 32 + k * 64, 35, 46, '#7a1d14', 0.09));
      p.appendChild(document.createElement('br'));
      p.appendChild(c);
    }
    this.show('reader');
    this.game.inventory.unread.delete(id);
  }

  // ---------------------------------------------------------------- terminal
  openTerminal(def) {
    this.terminal = { def, sel: 0, open: -1 };
    this.renderTerminal();
    this.show('terminal');
    this.game.setMode('terminal');
    this.game.audio.play('click', { gain: 0.4 });
  }
  renderTerminal() {
    const t = this.terminal;
    let s = `${t.def.title}\n${'='.repeat(t.def.title.length)}\n\n`;
    if (t.open >= 0) {
      const [name, body] = t.def.entries[t.open];
      s += `> ${name}\n\n${body}\n\n[BACKSPACE] return`;
    } else {
      t.def.entries.forEach(([name], k) => { s += (k === t.sel ? `<span class="sel">> ${name}</span>` : `  ${name}`) + '\n'; });
      s += '\n_';
    }
    $('crt-text').innerHTML = s;
  }
  terminalKey(code) {
    const t = this.terminal;
    if (!t) return;
    if (code === 'ArrowUp' || code === 'KeyW') t.sel = (t.sel + t.def.entries.length - 1) % t.def.entries.length;
    else if (code === 'ArrowDown' || code === 'KeyS') t.sel = (t.sel + 1) % t.def.entries.length;
    else if (code === 'Enter' || code === 'KeyE' || code === 'Space') { if (t.open < 0) t.open = t.sel; }
    else if (code === 'Backspace') t.open = -1;
    else return;
    this.game.audio.play('click', { gain: 0.25 });
    this.renderTerminal();
  }

  // ---------------------------------------------------------------- journal
  openJournal() {
    this.show('journal');
    this.renderJournal();
  }
  renderJournal() {
    const g = this.game;
    const list = $('journal-list'), view = $('journal-view');
    list.innerHTML = ''; view.innerHTML = '';
    for (const b of document.querySelectorAll('#journal-tabs button')) b.classList.toggle('on', b.dataset.tab === this.journalTab);
    const tab = this.journalTab;
    if (tab === 'docs' || tab === 'tapes') {
      const ids = g.inventory.docs.filter((id) => (DOCS[id]?.kind === 'tape') === (tab === 'tapes'));
      if (tab === 'tapes' && !ids.includes('voicemail')) ids.unshift('voicemail');
      if (tab === 'docs' && !ids.includes('job_sheet')) ids.unshift('job_sheet');
      if (!ids.length) view.innerHTML = '<p style="color:#666">Nothing yet.</p>';
      ids.forEach((id, k) => {
        const li = document.createElement('li');
        li.textContent = DOCS[id].title;
        if (g.inventory.unread.has(id)) li.classList.add('new');
        li.onclick = () => this.showDocInJournal(id, li);
        list.appendChild(li);
        if (k === ids.length - 1) this.showDocInJournal(id, li);
      });
    } else if (tab === 'items') {
      for (const [id, n] of g.inventory.items) {
        const it = ITEMS[id]; if (!it) continue;
        const row = document.createElement('div'); row.className = 'item-row';
        row.innerHTML = `<span class="n">${it.name}${n > 1 ? ' ×' + n : ''}</span><span class="d">${it.desc}</span>`;
        view.appendChild(row);
      }
      const tape = g.inventory.tape;
      const row = document.createElement('div'); row.className = 'item-row';
      row.innerHTML = `<span class="n">Cassette</span><span class="d">${tape ? 'Recorded: ' + tape.label : 'Blank.'}</span>`;
      view.appendChild(row);
      const bat = document.createElement('div'); bat.className = 'item-row';
      bat.innerHTML = `<span class="n">Flashlight charge</span><span class="d">${Math.round(g.player.battery * 100)}%</span>`;
      view.appendChild(bat);
      const reels = document.createElement('div'); reels.className = 'item-row';
      reels.innerHTML = `<span class="n">Subject reels</span><span class="d">${g.inventory.reelCount()} / 6</span>`;
      view.appendChild(reels);
    } else if (tab === 'map') {
      if (!g.inventory.has('floorplan')) { view.innerHTML = '<p style="color:#777">You have no floor plan. There was a directory board in the lobby.</p>'; return; }
      view.appendChild(this.drawFloorPlan());
    }
  }
  showDocInJournal(id, li) {
    for (const x of document.querySelectorAll('#journal-list li')) x.classList.remove('on');
    li?.classList.add('on'); li?.classList.remove('new');
    const d = DOCS[id];
    const view = $('journal-view');
    view.innerHTML = '';
    const p = document.createElement('div');
    p.className = 'paper ' + (d.style || 'typed');
    p.innerHTML = `<b>${d.title}</b>\n\n` + d.text.replace('{VALVES}', '(see the boiler room wall)');
    view.appendChild(p);
    if (d.kind === 'tape') {
      const b = document.createElement('button');
      b.textContent = '▶ play';
      b.style.cssText = 'margin-top:1rem;background:none;border:1px solid #555;color:#bbb;font-family:inherit;padding:0.4rem 1rem;cursor:pointer';
      b.onclick = () => this.game.audio.play(d.voice || 'voiceTape', { gain: 0.7, bus: this.game.audio.voice });
      view.appendChild(b);
    }
    this.game.inventory.unread.delete(id);
  }

  drawFloorPlan() {
    const g = this.game, m = g.map;
    const s = 9;
    const c = document.createElement('canvas');
    c.width = m.W * s + 20; c.height = (m.H - 18) * s + 20;
    const x = c.getContext('2d');
    x.fillStyle = '#d4caae'; x.fillRect(0, 0, c.width, c.height);
    x.translate(10, 10);
    for (let z = 0; z < m.H - 18; z++) for (let xx = 0; xx < m.W; xx++) {
      const i = m.idx(xx, z), t = m.type[i];
      if (t === CELL.SOLID) continue;
      const zc = String.fromCharCode(m.zone[i]);
      const basement = (ZONES[zc]?.floor ?? 0) < -1 || zc === 'u';
      x.fillStyle = t === CELL.DOOR ? '#b9ad8d' : t === CELL.WINDOW ? '#9fb0b0' : basement ? '#b7a98a' : '#e9e1cb';
      x.fillRect(xx * s, z * s, s, s);
    }
    x.fillStyle = '#3a3226'; x.font = '10px Courier New'; x.textAlign = 'center';
    const named = new Set();
    for (const zn of m.zones) {
      if (['o', 'p'].includes(zn.ch) || named.has(zn.name)) continue;
      named.add(zn.name);
      const label = zn.name.replace('Dormitory ', 'Dorm ').replace('Listening Booth ', 'B');
      if (zn.ch === 'y' && !g.doors.get('secret').secretOpen) continue;
      x.fillText(label, ((zn.x0 + zn.x1 + 1) / 2) * s, ((zn.z0 + zn.z1 + 1) / 2) * s + 3);
    }
    x.fillStyle = '#7a1d14'; x.font = 'italic 11px Georgia';
    x.textAlign = 'left';
    x.fillText('BASEMENT LEVEL (shaded) — reached by the west stair', 4, 8 * s);
    if (g.settings.get('mapMarker')) {
      const p = g.player.pos;
      x.fillStyle = '#7a1d14';
      x.beginPath(); x.arc(p.x * s, p.z * s, 4, 0, 7); x.fill();
      x.strokeStyle = '#7a1d14'; x.beginPath(); x.moveTo(p.x * s, p.z * s); x.lineTo((p.x - Math.sin(g.player.yaw) * 1.6) * s, (p.z - Math.cos(g.player.yaw) * 1.6) * s); x.stroke();
    }
    return c;
  }

  // ---------------------------------------------------------------- menus
  bindMenus() {
    const g = this.game;
    document.body.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      g.audio?.start();
      g.menuAction(b.dataset.act, b.closest('.screen')?.id);
    });
    document.querySelectorAll('#journal-tabs button').forEach((b) => b.addEventListener('click', () => { this.journalTab = b.dataset.tab; this.renderJournal(); }));
    $('click-to-play').addEventListener('click', () => { g.audio?.start(); g.input.requestLock(); this.show('click-to-play', false); });
  }

  buildSettings() {
    const s = this.game.settings;
    const f = $('settings-form');
    f.innerHTML = '';
    const row = (label, el) => { const l = document.createElement('label'); l.textContent = label; f.appendChild(l); f.appendChild(el); };
    const sel = document.createElement('select');
    for (const q of ['low', 'medium', 'high']) { const o = document.createElement('option'); o.value = q; o.textContent = q; if (s.get('quality') === q) o.selected = true; sel.appendChild(o); }
    sel.onchange = () => { s.set('quality', sel.value); this.hint('Quality applies after restart (reload the page).', 3); };
    row('Quality', sel);
    const range = (key, min, max, step) => { const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = s.get(key); r.oninput = () => s.set(key, parseFloat(r.value)); return r; };
    const check = (key) => { const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!s.get(key); c.onchange = () => s.set(key, c.checked); return c; };
    row('Mouse sensitivity', range('sensitivity', 0.2, 3, 0.05));
    row('Invert Y', check('invertY'));
    row('Field of view', range('fov', 60, 95, 1));
    row('Brightness', range('brightness', 0.7, 1.8, 0.02));
    row('Master volume', range('masterVolume', 0, 1, 0.01));
    row('Effects volume', range('sfxVolume', 0, 1, 0.01));
    row('Ambience volume', range('ambienceVolume', 0, 1, 0.01));
    row('Music volume', range('musicVolume', 0, 1, 0.01));
    row('Head bob', range('headBob', 0, 1, 0.05));
    row('Subtitles', check('subtitles'));
    row('Sound captions', check('captions'));
    row('Map marker', check('mapMarker'));
  }

  buildGallery(kind) {
    const body = $('gallery-body');
    if (kind === 'credits') {
      $('gallery-title').textContent = 'CREDITS';
      body.innerHTML = `<p><b>ANECHOIC</b> — design, code, writing, sound and art generated procedurally.</p>
<p>Every texture, model and sound in this game is synthesised at load time. There are no asset files.</p>
<p>Rendering: three.js (MIT). Audio: Web Audio API.</p>
<p>Play with headphones, in the dark, with the volume a little higher than comfortable.</p>`;
      return;
    }
    $('gallery-title').textContent = 'ENDINGS';
    const meta = this.game.meta;
    body.innerHTML = Object.entries(ENDINGS).map(([id, e]) => {
      const got = meta.endings.includes(id);
      return `<div class="end ${got ? '' : 'locked'}"><b>${got ? e.title : '— — —'}</b><br>${got ? e.text.split('\n')[0] : 'Not yet reached.'}</div>`;
    }).join('') + `<p style="margin-top:1rem">Subject reels found (best run): ${meta.bestReels} / 6</p>`;
  }

  showDeath() {
    const t = $('death-text');
    t.textContent = DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)];
    t.classList.remove('show'); $('death-menu').classList.remove('show');
    this.show('death');
    setTimeout(() => { t.classList.add('show'); $('death-menu').classList.add('show'); }, 1200);
  }

  showEnding(id, stats) {
    const e = ENDINGS[id];
    $('ending-title').textContent = e.title;
    $('ending-text').textContent = e.text;
    $('ending-stats').innerHTML = stats;
    this.show('ending');
  }
}
