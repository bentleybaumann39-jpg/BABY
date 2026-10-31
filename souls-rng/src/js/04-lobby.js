// =====================================================================
//  LOBBY UI — roll, bag, index, upgrades, pass, stats, friends, settings
// =====================================================================
const HEAD_EMOJI = { round: '🙂', tv: '📺', pumpkin: '🎃', mushroom: '🍄', knight: '🛡️', frog: '🐸', diver: '🤿', fox: '🦊', owl: '🦉', ninja: '🥷', skull: '💀', cat: '🐱', shark: '🦈', samurai: '⚔️', box: '🤖', cyber: '🦾', wolf: '🐺', octo: '🐙', bird: '🦅', dragon: '🐉', void: '🌌', bear: '🐻', helm: '⛑️', astro: '👨‍🚀', eye: '👁️', crystal: '💎', orb: '🔮' };
const BODY_EMOJI = { snow: '☃️', blob: '🫧', rock: '🪨', bone: '💀' };
const charEmoji = C => (C.head === 'none' ? BODY_EMOJI[C.body] : HEAD_EMOJI[C.head]) || '✨';
const rarCol = C => RARITIES[C.tier].c;
function mutBadge(mut) {
  if (!mut) return '';
  const M = MUTATIONS[mut];
  const bg = mut === 'rainbow' ? 'linear-gradient(90deg,#f33,#fd0,#3f6,#0cf,#a3f)' : M.c;
  return `<span class="mut" style="background:${bg};color:#000">${M.n}</span>`;
}
function fullName(cid, mut) { const C = ROSTER_BY_ID[cid]; return (mut ? MUTATIONS[mut].n + ' ' : '') + C.n; }

let _nT = 0;
function notify(title, body, col) {
  const b = $('notif'); $('nTitle').textContent = title; $('nTitle').style.color = col || '#00F0FF'; $('nBody').textContent = body;
  b.style.display = 'block'; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(_nT); _nT = setTimeout(() => b.style.display = 'none', 3800);
}

function updateLobby() {
  $('lbCoins').textContent = fmt(S.coins) + ' 🪙';
  $('lbLuck').textContent = `LUCK ${getLuck().toFixed(2)}x`;
  $('lbPotion').textContent = S.potion > 0 ? `🧪 2x LUCK POTION: ${S.potion} rolls` : '';
  $('lbDisc').textContent = `${discoveredCount()} / ${ROSTER.length}`;
  $('lbBest').textContent = S.stats.best;
  const ba = $('btnAuto');
  if (!S.autoUnlocked) { ba.className = 'btn sec'; ba.textContent = 'UNLOCK AUTO (50k)'; }
  else { ba.className = 'btn ' + (autoRoll ? 'on' : 'sec'); ba.textContent = 'AUTO-ROLL: ' + (autoRoll ? 'ON' : 'OFF'); }
  const bq = $('btnQuick'); bq.className = 'btn ' + (S.quick ? 'on' : 'sec'); bq.textContent = 'QUICK ROLL: ' + (S.quick ? 'ON' : 'OFF');
  $('reqBadge').textContent = S.reqs.length ? `(${S.reqs.length})` : '';
  if (!previewKey) renderLobbyCard(S.eq, false);
}
let previewKey = null;
function renderLobbyCard(key, preview) {
  const { cid, mut, C } = parseKey(key); if (!C) return;
  const st = charStats(cid, mut);
  $('lcName').textContent = fullName(cid, mut); $('lcName').style.color = C.col[2];
  $('lcRar').innerHTML = `<span style="color:${rarCol(C)}">${RARITIES[C.tier].n}</span>${mutBadge(mut)} ${preview ? '<span class="mut" style="background:#fff;color:#000">PREVIEW</span>' : '<span class="mut" style="background:#FFE600;color:#000">EQUIPPED</span>'}`;
  $('lcOdds').textContent = oddsText(totalOdds(cid, mut));
  $('lcStats').innerHTML = `DAMAGE x${st.boost.toFixed(2)} • HEALTH x${st.hpMult.toFixed(2)} • POWER LV ${ROMAN[C.L]}`;
  $('lcPowers').innerHTML = powerLines(C).map(p => `<div class="pw" style="border-left-color:${p.c}"><b style="color:${p.c}">${p.name}</b><div>${p.desc}</div></div>`).join('') +
    `<div class="pw ult"><b style="color:#FF7AF2">💫 ULT: ${ULTS[C.u].n}</b><div>${ULTS[C.u].d}</div></div>`;
  if (typeof Showcase !== 'undefined') Showcase.set(cid, mut);
}
function previewChar(key) { previewKey = key; renderLobbyCard(key, true); }
function clearPreview() { previewKey = null; renderLobbyCard(S.eq, false); }

// ---------------- rolling ----------------
let rolling = false, autoRoll = false, skipRoll = false;
function equip(key) { if (!S.inv[key]) return; S.eq = key; previewKey = null; saveSoon(); updateLobby(); if (typeof refreshPlayerChar === 'function') refreshPlayerChar(); }
function doRoll() {
  AU.init();
  if (rolling) return;
  if (S.coins < 100) { notify('Not enough coins', 'A roll costs 100 coins. Fight in a realm to earn more!', '#FF3D7A'); autoRoll = false; updateLobby(); return; }
  S.coins -= 100; S.stats.rolls++; if (S.potion > 0) S.potion--;
  const res = rollOnce();
  rolling = true;
  if (S.quick) { finishRoll(res, true); return; }
  runRollCutscene(res);
}
function runRollCutscene(res) {
  const C = ROSTER_BY_ID[res.cid], fx = $('rollFx'); fx.classList.add('on'); skipRoll = false;
  $('rfRar').textContent = ''; $('rfOdds').textContent = ''; $('rfPow').innerHTML = ''; $('rfTick').textContent = 'ROLLING';
  const spins = 12 + Math.min(10, C.tier * 2);
  let i = 0;
  const step = () => {
    if (skipRoll) i = spins;
    if (i < spins) {
      const d = ROSTER[Math.min(ROSTER.length - 1, Math.floor(Math.pow(Math.random(), 2.2) * (C.tier >= 6 ? ROSTER.length : 70)))];
      $('rfName').textContent = d.n; $('rfName').style.color = rarCol(d);
      $('rfRar').textContent = RARITIES[d.tier].n; $('rfRar').style.color = rarCol(d);
      $('rfTick').textContent = '>>> ' + '■'.repeat(1 + i % 8) + ' <<<';
      AU.tick(i); i++;
      setTimeout(step, 45 + Math.pow(i / spins, 3) * 260);
    } else finishRoll(res, false);
  };
  step();
}
function finishRoll(res, quick) {
  const C = ROSTER_BY_ID[res.cid], M = MUTATIONS[res.mut], tot = totalOdds(res.cid, res.mut), isNew = !S.disc[res.cid];
  const curTot = (() => { const e = eqInfo(); return totalOdds(e.cid, e.mut); })();
  let sold = 0, equipped = false;
  if (tot > curTot) { invAdd(res.cid, res.mut); S.eq = keyOf(res.cid, res.mut); equipped = true; }
  else if (!isNew && !res.mut && C.tier <= S.autoSell) { sold = sellValue(res.cid, res.mut); S.coins += sold; }
  else invAdd(res.cid, res.mut);
  S.disc[res.cid] = 1;
  S.stats.rarest = Math.max(S.stats.rarest, tot);
  saveSoon();
  const col = rarCol(C);
  AU.reveal(Math.min(11, C.tier + (res.mut ? 1 : 0)));
  if (!sold) { previewKey = equipped ? null : keyOf(res.cid, res.mut); renderLobbyCard(keyOf(res.cid, res.mut), !equipped); }
  if (typeof Showcase !== 'undefined') Showcase.burst(col, 30 + C.tier * 20);
  const tag = (isNew ? ' • NEW!' : '') + (equipped ? ' • EQUIPPED' : '') + (sold ? ` • AUTO-SOLD +${fmt(sold)}` : '');
  if (quick) {
    notify(`${fullName(res.cid, res.mut)}`, `${RARITIES[C.tier].n} • ${oddsText(tot)}${tag}`, col);
    if (C.tier >= 3) flashScreen(col);
    rolling = false; previewKey = null; updateLobby();
    if (autoRoll) setTimeout(doRoll, 260);
    return;
  }
  $('rfTick').textContent = isNew ? '★ NEW DISCOVERY ★' : '★ UNLOCKED ★';
  $('rfName').textContent = fullName(res.cid, res.mut); $('rfName').style.color = res.mut ? M.c : col;
  $('rfRar').innerHTML = `<span style="color:${col}">${RARITIES[C.tier].n}</span>${mutBadge(res.mut)}`;
  $('rfOdds').textContent = oddsText(tot);
  $('rfPow').innerHTML = powerLines(C).map(p => `<span style="color:${p.c}">${p.name}</span>`).join(' • ') + `<br><span style="color:#FF7AF2">ULT: ${ULTS[C.u].n}</span><br><b>${tag.replace(/^ • /, '')}</b>`;
  if (C.tier >= 3 || res.mut) flashScreen(col);
  const hold = quick ? 0 : 900 + C.tier * 260;
  let done = false;
  const close = () => { if (done) return; done = true; $('rollFx').classList.remove('on'); rolling = false; updateLobby(); if (autoRoll) setTimeout(doRoll, 350); };
  setTimeout(close, hold);
  $('rollFx').onclick = () => { if (rolling && !done && $('rfOdds').textContent) close(); else skipRoll = true; };
  updateLobby();
}
function flashScreen(col) { const f = $('rfFlash'); f.style.background = col; f.style.transition = 'none'; f.style.opacity = '0.85'; void f.offsetWidth; f.style.transition = 'opacity .8s'; f.style.opacity = '0'; }
function toggleAuto() {
  AU.init();
  if (!S.autoUnlocked) {
    if (S.coins >= 50000) { S.coins -= 50000; S.autoUnlocked = true; saveSoon(); notify('Auto-Roll unlocked', 'Toggle it on whenever you like.'); }
    else notify('Need 50,000 coins', 'Auto-Roll costs 50,000 coins to unlock.', '#FF3D7A');
    updateLobby(); return;
  }
  autoRoll = !autoRoll; updateLobby(); if (autoRoll && !rolling) doRoll();
}

// ---------------- modals ----------------
function openModal(id) {
  AU.init(); AU.click();
  if (id === 'mBag') renderBag(); if (id === 'mIndex') renderIndex(); if (id === 'mUpg') renderUpg(); if (id === 'mPass') renderPass();
  if (id === 'mStats') renderStats(); if (id === 'mSettings') renderSettings(); if (id === 'mFriends') renderFriends();
  $(id).classList.add('on');
}
function closeModals() { document.querySelectorAll('.modal.on').forEach(m => m.classList.remove('on')); }

function cardHTML(C, mut, opts = {}) {
  const col = rarCol(C), tot = totalOdds(C.id, mut);
  const sw = `background:linear-gradient(135deg,${C.col[0]},${C.col[1]});box-shadow:inset 0 0 18px ${C.col[2]}`;
  return `<div class="sw" style="${sw}">${opts.locked ? '❔' : charEmoji(C)}</div>
    <div class="cn" style="color:${opts.locked ? '#888' : (mut ? MUTATIONS[mut].c : C.col[2])}">${opts.locked ? '???' : esc(fullName(C.id, mut))}</div>
    <div class="cr" style="color:${col}">${RARITIES[C.tier].n}${mutBadge(mut)}</div>
    <div class="co">${oddsText(tot)}</div>
    ${opts.locked ? '' : `<div class="cp">${C.p.map(p => PASSIVES[p].i + ' ' + PASSIVES[p].n).join('<br>')}<br><span style="color:#FF7AF2">💫 ${ULTS[C.u].n}</span></div>`}`;
}
function renderBag() {
  const g = $('bagGrid'); g.innerHTML = '';
  const sort = $('bagSort').value;
  const keys = Object.keys(S.inv).sort((a, b) => {
    const A = parseKey(a), B = parseKey(b);
    if (sort === 'new') return (S.newest[b] || 0) - (S.newest[a] || 0);
    if (sort === 'name') return A.C.n.localeCompare(B.C.n);
    return totalOdds(B.cid, B.mut) - totalOdds(A.cid, A.mut);
  });
  keys.forEach(k => {
    const { cid, mut, C } = parseKey(k), eq = k === S.eq;
    const d = document.createElement('div'); d.className = 'card' + (eq ? ' eq' : ''); d.style.borderColor = rarCol(C);
    d.innerHTML = cardHTML(C, mut) + `<div class="cnt">x${S.inv[k]}</div><div style="font-size:10px;font-weight:900;color:${eq ? '#FFE600' : '#00F0FF'};margin-top:4px">${eq ? '★ EQUIPPED' : 'CLICK TO EQUIP'}</div>`;
    d.onclick = () => { equip(k); AU.click(); renderBag(); };
    if (!eq || S.inv[k] > 1) {
      const b = document.createElement('button'); b.className = 'btn red sm'; b.style.marginTop = '6px';
      b.textContent = `SELL +${fmt(sellValue(cid, mut))}`;
      b.onclick = e => { e.stopPropagation(); S.coins += sellValue(cid, mut); invRemove(k); AU.coin(); saveSoon(); updateLobby(); renderBag(); };
      d.appendChild(b);
    }
    g.appendChild(d);
  });
}
function sellDupes() {
  let total = 0;
  for (const k of Object.keys(S.inv)) { const n = S.inv[k] - 1; if (n > 0) { const { cid, mut } = parseKey(k); total += n * sellValue(cid, mut); S.inv[k] = 1; } }
  S.coins += total; saveSoon(); updateLobby(); renderBag(); notify('Duplicates sold', `+${fmt(total)} coins`, '#FFE600'); if (total) AU.coin();
}
function equipBest() {
  let best = null, bo = 0;
  for (const k of Object.keys(S.inv)) { const { cid, mut } = parseKey(k); const o = totalOdds(cid, mut); if (o > bo) { bo = o; best = k; } }
  if (best) equip(best); renderBag();
}
let idxTab = -1;
function renderIndex() {
  const tabs = $('idxTabs'); tabs.innerHTML = '';
  const mk = (t, label, col) => { const b = document.createElement('button'); b.className = 'tab' + (idxTab === t ? ' on' : ''); b.innerHTML = label; if (col) b.style.borderColor = col; b.onclick = () => { idxTab = t; renderIndex(); }; tabs.appendChild(b); };
  mk(-1, 'ALL');
  RARITIES.forEach((R, t) => { const tot = ROSTER.filter(c => c.tier === t).length, got = ROSTER.filter(c => c.tier === t && S.disc[c.id]).length; mk(t, `<span style="color:${R.c}">${R.n}</span> ${got}/${tot}`, R.c); });
  $('idxCount').textContent = `DISCOVERED ${discoveredCount()} / ${ROSTER.length}`;
  const g = $('idxGrid'); g.innerHTML = '';
  ROSTER.filter(C => idxTab < 0 || C.tier === idxTab).forEach(C => {
    const known = !!S.disc[C.id];
    const d = document.createElement('div'); d.className = 'card' + (known ? '' : ' locked'); d.style.borderColor = rarCol(C);
    d.innerHTML = cardHTML(C, '', { locked: !known }) + (known ? `<div style="font-size:10px;font-weight:900;color:#00F0FF;margin-top:4px">CLICK TO PREVIEW</div>` : '');
    if (known) d.onclick = () => { closeModals(); previewChar(keyOf(C.id, '')); };
    g.appendChild(d);
  });
}
const UPGRADES = [
  { id: 'luck', n: '🍀 LUCK', d: () => `Roll luck ${(1 + 0.28 * S.luck).toFixed(2)}x → ${(1 + 0.28 * (S.luck + 1)).toFixed(2)}x`, lvl: () => S.luck, cost: () => Math.floor(500 * Math.pow(2.0, S.luck)) },
  { id: 'dmg', n: '💥 DAMAGE', d: () => `Base weapon damage +6 per level`, lvl: () => S.dmg, cost: () => Math.floor(200 * Math.pow(1.22, S.dmg - 1)) },
  { id: 'hp', n: '❤️ HEALTH', d: () => `Max health +25 per level`, lvl: () => S.hp, cost: () => Math.floor(300 * Math.pow(1.22, S.hp - 1)) },
  { id: 'spd', n: '💨 SPEED', d: () => `Move speed +4% per level (max 15)`, lvl: () => S.spd, cost: () => S.spd >= 15 ? Infinity : Math.floor(250 * Math.pow(1.3, S.spd - 1)) },
  { id: 'greed', n: '🪙 GREED', d: () => `+10% coins from realms per level`, lvl: () => S.greed, cost: () => Math.floor(800 * Math.pow(1.6, S.greed)) }
];
function renderUpg() {
  const L = $('upgList'); L.innerHTML = '';
  UPGRADES.forEach(u => {
    const c = u.cost(), d = document.createElement('div'); d.className = 'upg';
    d.innerHTML = `<div><div class="t">${u.n} <span style="color:#00F0FF">Lv ${u.lvl()}</span></div><div class="d">${u.d()}</div></div>`;
    const b = document.createElement('button'); b.className = 'btn gold'; b.textContent = c === Infinity ? 'MAX' : `${fmt(c)} 🪙`; b.disabled = c === Infinity || S.coins < c;
    b.onclick = () => { if (S.coins < c) return; S.coins -= c; S[u.id]++; AU.coin(); saveSoon(); updateLobby(); renderUpg(); };
    d.appendChild(b); L.appendChild(d);
  });
  const d = document.createElement('div'); d.className = 'upg';
  d.innerHTML = `<div><div class="t">🔁 AUTO-ROLL</div><div class="d">Rolls automatically while you watch</div></div>`;
  const b = document.createElement('button'); b.className = 'btn gold'; b.textContent = S.autoUnlocked ? 'OWNED' : '50,000 🪙'; b.disabled = S.autoUnlocked || S.coins < 50000;
  b.onclick = () => { toggleAuto(); renderUpg(); }; d.appendChild(b); L.appendChild(d);
}

// ---------------- beast pass ----------------
const BP_TIERS = [];
for (let i = 1; i <= 100; i++) {
  const xp = i * 140;
  if (i % 10 === 0) { const idx = Math.min(ROSTER.length - 1, Math.floor(8 + i / 100 * 92)); BP_TIERS.push({ lv: i, xp, type: 'char', idx, desc: `${ROSTER[idx].n} (${RARITIES[ROSTER[idx].tier].n})` }); }
  else if (i % 2 === 0) BP_TIERS.push({ lv: i, xp, type: 'coins', val: i * 900, desc: `${fmt(i * 900)} coins` });
  else BP_TIERS.push({ lv: i, xp, type: 'potion', val: 5 + Math.floor(i / 10) * 2, desc: `2x Luck Potion (${5 + Math.floor(i / 10) * 2} rolls)` });
}
function passLevel() { let l = 0; for (const t of BP_TIERS) if (S.bpXp >= t.xp) l = t.lv; return l; }
function claimTier(t, silent) {
  if (S.bpClaimed.includes(t.lv) || S.bpXp < t.xp) return false;
  S.bpClaimed.push(t.lv);
  if (t.type === 'coins') S.coins += t.val;
  else if (t.type === 'potion') S.potion += t.val;
  else { const C = ROSTER[t.idx]; invAdd(C.id, ''); }
  if (!silent) AU.coin();
  return true;
}
function renderPass() {
  const lv = passLevel();
  $('passInfo').textContent = `LEVEL ${lv} • ${fmt(S.bpXp)} XP`;
  const nxt = BP_TIERS.find(t => t.xp > S.bpXp); $('passFill').style.width = nxt ? `${(S.bpXp - (nxt.xp - 140)) / 140 * 100}%` : '100%';
  const L = $('passList'); L.innerHTML = '';
  BP_TIERS.forEach(t => {
    const done = S.bpClaimed.includes(t.lv), can = S.bpXp >= t.xp && !done;
    const d = document.createElement('div'); d.className = 'tier' + (done ? ' done' : '');
    const ic = t.type === 'char' ? charEmoji(ROSTER[t.idx]) : t.type === 'coins' ? '🪙' : '🧪';
    d.innerHTML = `<div><div style="font-weight:900;color:#FFE600">${ic} LEVEL ${t.lv}</div><div style="font-size:12px">${t.desc}</div></div>`;
    const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = done ? 'CLAIMED' : can ? 'CLAIM' : `${fmt(t.xp)} XP`; b.disabled = !can;
    b.onclick = () => { if (claimTier(t)) { saveSoon(); updateLobby(); renderPass(); } };
    d.appendChild(b); L.appendChild(d);
  });
}
function claimAll() { let n = 0; BP_TIERS.forEach(t => { if (claimTier(t, true)) n++; }); if (n) { AU.coin(); notify('Rewards claimed', `${n} tier${n > 1 ? 's' : ''} claimed`); } saveSoon(); updateLobby(); renderPass(); }

function renderStats() {
  const st = S.stats, e = eqInfo();
  const rows = [['Rolls', fmt(st.rolls)], ['Rarest pull', oddsText(st.rarest)], ['Characters discovered', `${discoveredCount()} / ${ROSTER.length}`], ['Bosses defeated', fmt(st.bosses)],
    ['Enemies slain', fmt(st.kills)], ['Best realm', st.best], ['Realms cleared', fmt(st.realms)], ['Deaths', fmt(st.deaths)], ['Trades', fmt(st.trades)], ['Friends', S.friends.length],
    ['Time in realms', `${Math.floor(st.time / 3600)}h ${Math.floor(st.time / 60) % 60}m`], ['Equipped', fullName(e.cid, e.mut)], ['Damage boost', 'x' + charStats(e.cid, e.mut).boost.toFixed(2)], ['Ultimate', ULTS[e.C.u].n]];
  $('statsList').innerHTML = rows.map(r => `<div class="statline"><span>${r[0]}</span><b>${esc(r[1])}</b></div>`).join('');
}

// ---------------- settings ----------------
function renderSettings() {
  const s = S.set, L = $('setList');
  L.innerHTML = `
  <div class="set"><label>Mouse sensitivity <span id="vSens" style="color:#00F0FF">${s.sens.toFixed(2)}</span></label><input type="range" id="sSens" min="0.2" max="3" step="0.05" value="${s.sens}"></div>
  <div class="set"><label>Invert mouse Y</label><button class="btn sm ${s.inv ? 'on' : 'sec'}" id="sInv">${s.inv ? 'ON' : 'OFF'}</button></div>
  <div class="set"><label>Field of view <span id="vFov" style="color:#00F0FF">${s.fov}</span></label><input type="range" id="sFov" min="60" max="100" step="1" value="${s.fov}"></div>
  <div class="set"><label>Graphics quality</label><select id="sQ" style="max-width:160px"><option value="low">Low (fast)</option><option value="medium">Medium</option><option value="high">High (bloom + shadows)</option><option value="ultra">Ultra</option></select></div>
  <div class="set"><label>Volume <span id="vVol" style="color:#00F0FF">${Math.round(s.vol * 100)}%</span></label><input type="range" id="sVol" min="0" max="1" step="0.05" value="${s.vol}"></div>
  <div class="set"><label>Music</label><button class="btn sm ${s.music ? 'on' : 'sec'}" id="sMus">${s.music ? 'ON' : 'OFF'}</button></div>
  <div class="set"><label>Screen shake</label><button class="btn sm ${s.shake ? 'on' : 'sec'}" id="sShake">${s.shake ? 'ON' : 'OFF'}</button></div>
  <div class="set"><label>Damage numbers</label><button class="btn sm ${s.nums ? 'on' : 'sec'}" id="sNums">${s.nums ? 'ON' : 'OFF'}</button></div>
  <div class="set"><label>Show FPS</label><button class="btn sm ${s.fps ? 'on' : 'sec'}" id="sFps">${s.fps ? 'ON' : 'OFF'}</button></div>
  <div style="margin-top:14px;font-size:13px;line-height:1.7;color:#bcd">
   <b style="color:#00F0FF">CONTROLS</b><br>
   Mouse — look around (your cursor is locked to the game while playing)<br>
   Left click — shoot (hold for full-auto) • Right click — aim down sights<br>
   1-5 or mouse wheel — switch guns • R — reload<br>
   WASD — move • SPACE — jump (some characters can double jump) • SHIFT — sprint<br>
   Q or E — ultimate • ESC — pause and free your mouse</div>
  <div style="margin-top:14px"><button class="btn red sm" id="sReset">RESET ALL PROGRESS</button></div>`;
  $('sQ').value = s.quality;
  const tog = (id, key) => $(id).onclick = () => { s[key] = !s[key]; saveSoon(); applySettings(); renderSettings(); };
  tog('sInv', 'inv'); tog('sMus', 'music'); tog('sShake', 'shake'); tog('sNums', 'nums'); tog('sFps', 'fps');
  $('sSens').oninput = e => { s.sens = +e.target.value; $('vSens').textContent = s.sens.toFixed(2); saveSoon(); };
  $('sFov').oninput = e => { s.fov = +e.target.value; $('vFov').textContent = s.fov; saveSoon(); applySettings(); };
  $('sVol').oninput = e => { s.vol = +e.target.value; $('vVol').textContent = Math.round(s.vol * 100) + '%'; saveSoon(); applySettings(); };
  $('sQ').onchange = e => { s.quality = e.target.value; s.autoQ = false; saveSoon(); applySettings(); };
  $('sReset').onclick = () => { if (confirm('Erase ALL progress, characters and coins? This cannot be undone.')) { localStorage.removeItem(SAVE_KEY); ['souls_c', 'souls_inv'].forEach(k => localStorage.removeItem(k)); location.reload(); } };
}
function applySettings() {
  AU.applyVol();
  if (typeof applyQuality === 'function') applyQuality();
  $('htFps').style.display = S.set.fps ? 'block' : 'none';
}

// ---------------- friends & trade (local) ----------------
function renderFriends() {
  $('myCode').textContent = S.fcode;
  const fb = $('friendsBox');
  fb.innerHTML = S.friends.length ? '' : '<div style="color:#889;font-size:13px">No friends yet. Share your code!</div>';
  S.friends.forEach((f, i) => {
    const d = document.createElement('div'); d.className = 'tier';
    d.innerHTML = `<div><div style="font-weight:900;color:#00F0FF">${esc(f.name || f.code)}</div><div style="font-size:11px;color:#9ab;font-family:monospace">${esc(f.code)}</div></div>`;
    const b = document.createElement('button'); b.className = 'btn red sm'; b.textContent = 'REMOVE'; b.onclick = () => { S.friends.splice(i, 1); saveSoon(); renderFriends(); };
    d.appendChild(b); fb.appendChild(d);
  });
  const rb = $('reqBox');
  rb.innerHTML = S.reqs.length ? '' : '<div style="color:#889;font-size:13px">No pending requests.</div>';
  S.reqs.forEach((r, i) => {
    const d = document.createElement('div'); d.className = 'tier';
    d.innerHTML = `<div><div style="font-weight:900;color:#FFE600">${esc(r.name || r.code)}</div><div style="font-size:11px;color:#9ab;font-family:monospace">${esc(r.code)}</div></div>`;
    const w = document.createElement('div');
    const a = document.createElement('button'); a.className = 'btn sm'; a.textContent = 'ACCEPT'; a.style.marginRight = '4px';
    a.onclick = () => { if (!S.friends.some(f => f.code.toLowerCase() === r.code.toLowerCase())) S.friends.push({ code: r.code, name: r.name }); S.reqs.splice(i, 1); S.outreqs = S.outreqs.filter(o => o.code.toLowerCase() !== r.code.toLowerCase()); saveSoon(); renderFriends(); updateLobby(); notify('Friend added', r.name || r.code); AU.coin(); };
    const x = document.createElement('button'); x.className = 'btn red sm'; x.textContent = 'DECLINE'; x.onclick = () => { S.reqs.splice(i, 1); saveSoon(); renderFriends(); updateLobby(); };
    w.appendChild(a); w.appendChild(x); d.appendChild(w); rb.appendChild(d);
  });
  const sel = $('tradeSel'); sel.innerHTML = '';
  Object.keys(S.inv).sort((a, b) => { const A = parseKey(a), B = parseKey(b); return totalOdds(B.cid, B.mut) - totalOdds(A.cid, A.mut); }).forEach(k => {
    if (k === S.eq && S.inv[k] <= 1) return;
    const { cid, mut } = parseKey(k); const o = document.createElement('option'); o.value = k; o.textContent = `${fullName(cid, mut)} (${oddsText(totalOdds(cid, mut))}) x${S.inv[k]}`; sel.appendChild(o);
  });
  if (!sel.options.length) { const o = document.createElement('option'); o.textContent = 'No spare characters'; o.disabled = true; o.value = ''; sel.appendChild(o); }
}
function showFTab(id) { ['fList', 'fTrade', 'fReq'].forEach(t => $(t).classList.toggle('hidden', t !== id)); document.querySelectorAll('[data-ftab]').forEach(b => b.classList.toggle('on', b.dataset.ftab === id)); }
function sendFriend() {
  const code = $('friendIn').value.trim().toLowerCase();
  if (!code) return notify('Empty', 'Enter a friend code');
  if (code === S.fcode.toLowerCase()) return notify('Invalid', 'You cannot add yourself');
  if (S.friends.some(f => f.code.toLowerCase() === code)) return notify('Already friends', 'They are already on your list');
  if (S.outreqs.some(r => r.code.toLowerCase() === code)) return notify('Pending', 'Request already sent');
  const name = 'Player_' + code.slice(0, 6);
  S.outreqs.push({ code, name, ts: Date.now() }); S.reqs.push({ code, name, ts: Date.now() });
  saveSoon(); renderFriends(); updateLobby(); $('friendIn').value = '';
  notify('Request sent', `Sent to ${code}. Check REQUESTS to accept.`);
}
function makeTrade() {
  const k = $('tradeSel').value; if (!k || !S.inv[k]) return notify('No character', 'Pick a spare character to send');
  const { cid, mut } = parseKey(k);
  if (!confirm(`Send ${fullName(cid, mut)}? One copy will leave your bag.`)) return;
  invRemove(k);
  const payload = { v: 2, from: S.fcode, c: cid, m: mut, ts: Date.now(), n: Math.random().toString(36).slice(2, 8) };
  $('tradeOut').textContent = 'TRADE-' + btoa(JSON.stringify(payload));
  saveSoon(); renderFriends(); notify('Trade code ready', 'Send this code to a friend');
}
function redeemTrade() {
  const raw = $('tradeIn').value.trim(); if (!raw.startsWith('TRADE-')) return notify('Invalid', 'Codes start with TRADE-', '#FF3D7A');
  try {
    const p = JSON.parse(atob(raw.slice(6)));
    if (!p.from) throw 0;
    if (p.from === S.fcode) return notify('Invalid', 'That is your own trade code', '#FF3D7A');
    const sig = String(hashStr(raw));
    if (S.redeemed.includes(sig)) return notify('Already redeemed', 'That code was already used', '#FF3D7A');
    let cid, mut = '';
    if (p.v === 2) { cid = p.c; mut = p.m || ''; } else if (p.item) cid = closestByOdds(p.item.odds || 2).id;
    if (!ROSTER_BY_ID[cid] || !(mut in MUTATIONS)) throw 0;
    invAdd(cid, mut); S.redeemed.push(sig); S.stats.trades++; saveSoon(); updateLobby(); renderFriends();
    $('tradeIn').value = ''; notify('Trade received!', fullName(cid, mut), rarCol(ROSTER_BY_ID[cid])); AU.coin();
  } catch (e) { notify('Bad code', 'Could not read that trade code', '#FF3D7A'); }
}

function initLobbyUI() {
  const sel = $('selAutoSell'); sel.innerHTML = '<option value="-1">Off</option>' + RARITIES.slice(0, 5).map((r, i) => `<option value="${i}">${r.n}</option>`).join('');
  sel.value = S.autoSell; sel.onchange = e => { S.autoSell = +e.target.value; saveSoon(); };
  $('btnRoll').onclick = () => { if (autoRoll) { autoRoll = false; updateLobby(); } clearPreview(); doRoll(); };
  $('btnAuto').onclick = toggleAuto;
  $('btnQuick').onclick = () => { S.quick = !S.quick; saveSoon(); updateLobby(); };
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openModal(b.dataset.open));
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModals);
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('mousedown', e => { if (e.target === m) closeModals(); }));
  document.querySelectorAll('[data-ftab]').forEach(b => b.onclick = () => showFTab(b.dataset.ftab));
  $('bagSort').onchange = renderBag; $('btnEqBest').onclick = equipBest; $('btnSellDupes').onclick = sellDupes;
  $('btnClaimAll').onclick = claimAll;
  $('btnCopyCode').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(S.fcode) : Promise.reject()).then(() => notify('Copied', 'Friend code copied')).catch(() => notify('Your code', S.fcode)); };
  $('btnAddFriend').onclick = sendFriend; $('btnMakeTrade').onclick = makeTrade; $('btnRedeem').onclick = redeemTrade;
  updateLobby();
}
