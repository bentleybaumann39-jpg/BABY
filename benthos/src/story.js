/* story.js — what is where, who says what, and when the rules change.
 * Prologue (deck) -> Act I (0-1,000 m) -> Act II (1,000-2,904 m) -> Act III (3,000-4,190 m) -> endings. */
'use strict';
(function (B) {
  const M = B.M, R = B.R, MD = B.MD, A = B.A, E = B.E, W = B.World;
  const S = B.Story = { locked: false, godMode: false, upIsDown: false, surfacing: false, hideBody: false, caps: [], maps: {} };
  const Q = [];
  const H = (x, y) => W.H(B.map, x, y);
  const st = () => B.state;
  const P = () => B.player;

  // ------------------------------------------------------------------ documents
  const DOCS = {
    dossier: { title: 'HALVARD MARINE · ASHER DEEP · PRIOR LOSSES', body: [
      'ASHER DEEP. SOUTH PACIFIC, 600 KM EAST OF THE KERMADEC ARC. CHARTED 1963.',
      'CREWS CALL IT THE TRENCH OF WHISPERS.', '',
      '1963  A COLD WAR HYDROPHONE ARRAY LOGS A 17 HZ PULSE FROM THE FAULT. REGULAR. TOO SLOW FOR ANY WHALE. NICKNAMED THE OSTINATO. IT HAS NEVER STOPPED.', '',
      'THE RHYTHM OF THE OSTINATO HAS CHANGED FOUR TIMES:',
      '1971  BATHYSCAPHE THALASSA VIGIL LOST WITH PILOT E. MOTT AND HYDROPHONIST L. SZABO.',
      '1994  HALVARD SATURATION TEAM (THE HALVARD FOUR) LOST WITH THE BELL GANNET.',
      '2009  HADAL LANDER TERN-7 LOST.',
      '?     RHYTHM CHANGE LOGGED 03:12 UTC, THREE DAYS AGO. CAUSE UNKNOWN.', '',
      'GEOLOGY ASSESSMENT: RESONANT MINERAL FORMATION. PROBABLE DEPOSIT.'] },
    incident: { title: 'INCIDENT REPORT · ROV MAGPIE-3', body: [
      'VEHICLE: MAGPIE-3, WORK-CLASS ROV, 3.2 T.', 'LAST DEPTH: 2,904 M. LAST CONTACT: 03:12 UTC.',
      'TETHER: CUT APPROX. 1 M FROM VEHICLE. CLEAN. NOT FRAYED.',
      'EMERGENCY MODEM CONTINUED 11 S AFTER TETHER LOSS.', 'DATA CORE ("THE WREN"): NOT RECOVERED.',
      'SURVEY VALUE: USD 2.1 BN IN NODULE RIGHTS. CLAIM LAPSES IN 96 H.', '',
      '[REDACTED BY T. WEND: FRAMES 263-290, HYDROPHONE TRACK 2]'] },
    stake: { title: 'SURVEY STAKE 7 · HALVARD', body: [
      'SHELF SURVEY, SUNLIT WALL, 38 M.', 'SEDIMENT: CARBONATE SAND. SPONGE COVER 30%.',
      'NOTE: THE PULSE IS AUDIBLE EVEN HERE, THROUGH THE HULL, IF YOU HOLD YOUR BREATH.'] },
    asher4: { title: 'ARRAY ELEMENT ASHER-4 · 1963', body: [
      'TRANSCRIPT, OPERATOR LOG, NIGHT WATCH:', '0214  17 CYCLES. STEADY.', '0230  NOT BIOLOGICAL. NOT MECHANICAL.',
      '0302  FOUR BEATS AND A GAP. FOUR BEATS AND A GAP.', '0340  OPERATOR NOTE: IT IS COUNTING.', '0341  COUNTING WHAT.'] },
    gannet: { title: 'GREASE PENCIL ON THE GANNET BELL WALL · 1994', body: [
      'DAY 3. BELL AT 620. LARS SAYS THE COMMS DELAY IS WRONG. TOO SHORT. LIKE TOPSIDE IS GETTING CLOSER.',
      'DAY 4. PELL WENT OUT AT 0400. PELL CAME BACK AT 0400.',
      'DAY 5. TALLY: IIII  IIII  IIII  IIIII', 'DAY 5. WHO MADE THAT FIFTH MARK.',
      'DAY 6. PELL KEEPS BREATHING.', 'DAY 6. PELL IS DEAD AND PELL KEEPS BREATHING.'] },
    whale: { title: 'SLATE, WHALE FALL SURVEY', body: [
      'HAGFISH-LIKE. HALVARD CALLS THEM SLIMEWIVES.', 'TOUCH ONE AND IT GOES TO JELLY. THE JELLY EXPANDS TEN THOUSAND TIMES.',
      'THE JELLY HOLDS. NOTHING BITES THROUGH IT.'] },
    diver94: { title: "SUIT TELLTALE · HALVARD FOUR", body: [
      'DEPTH 0862 · 1994-06-11 · 04:00 · HR 000', '',
      'HANDWRITTEN ON THE FOREARM SLATE:', 'THE CAGE IS STILL HANGING AT 900. SOMETHING IS HOLDING IT.', 'IF YOU ARE READING THIS YOU ARE THE NEXT ONE.'] },
    tether: { title: 'MAGPIE-3 TETHER · 960 M', body: [
      'A LENGTH OF ARMOURED TETHER SNAGGED ON THE LEDGE.', 'THE END IS CUT. CLEAN. NOT FRAYED.', 'THERE ARE NO TOOL MARKS.'] },
    barge: { title: 'MANIFEST · BARGE GULL · 1994', body: [
      'SURFACE SUPPORT, HALVARD FOUR SATURATION SPREAD.', 'LOST WITH THE BELL, JUNE 1994.',
      'NOTE: THIS DEBRIS HAS BEEN SINKING FOR THIRTY YEARS. IT SHOULD HAVE REACHED THE FLOOR IN A DAY.'] },
    vigil: { title: 'L. SZABO · NOTEBOOK · THALASSA VIGIL · 1971', body: [
      'HOUR 6. EZRA STOPPED BREATHING.', 'HOUR 9. THE OSTINATO ANSWERS WHEN I TAP THE HULL.',
      'HOUR 14. I HAVE STARTED DRAWING WHAT IT TELLS ME. EVERY WRECK. EVERY LEDGE. THINGS THAT AREN\'T HERE YET.',
      'HOUR 17. THERE IS A CROSS AT 1,140 M. IT SAYS 419. I DON\'T KNOW WHAT 419 IS.',
      'HOUR 19. THE AIR RAN OUT AT HOUR 11.', '', 'SCRATCHED INTO THE HULL BESIDE IT:', 'THE DEEP KEEPS ORDER NOT TIME'] },
    cage: { title: 'TELLTALE · HV-SERIES SUIT IN THE CAGE', body: [
      'A HARDSUIT CLIPPED INTO THE CAGE. HELMET INTACT, PACKED WITH OLD SILT.', 'STENCIL ON THE COLLAR: HV-0419', '',
      'CHEST DISPLAY, STILL LIT:', '0780 M · SIGNAL LOST'] },
    magpie: { title: 'DATA PLATE · MAGPIE-3', body: [
      'HALVARD MARINE · WORK-CLASS ROV · S/N M3', 'DATA CORE BAY: OCCUPIED.', 'CAMERA MODULE: DETACHABLE (TETHERED, 30 M).'] },
    tern: { title: 'HADAL LANDER TERN-7 · DATA CARD · 2009', body: [
      'BAIT CAGE INVENTORY, AUTO-LOGGED 2009-03-02:', 'ONE (1) HARDSUIT GLOVE. SIZE M. SERIES HV.', 'NO HV-SERIES SUIT EXISTED IN 2009.'] },
    hv417: { title: 'HELMET · HV-0417 · 2019', body: [
      'I CAME BACK UP.', 'SOMETHING CAME BACK UP WITH ME.', 'IT HAS MY FACE AND IT ANSWERS TO MY NAME AND IT LIKES THE COFFEE.',
      'DON\'T LET THEM SEND ANOTHER ONE.'] },
    plainhelm: { title: 'HELMET · NO SERIAL', body: ['THE VISOR IS PAINTED BLACK FROM THE INSIDE.', 'SCRATCHED UNDER THE PAINT: FOUR BEATS AND A GAP.'] },
  };
  S.DOCS = DOCS;

  // ------------------------------------------------------------------ captions and comms
  // Tobias speaks through the water: one-way latency is depth / 1,500 m/s. After the breach it goes negative.
  S.latency = function () { const p = P(); if (!p) return 0; if (st() && st().flags.breached) return -0.8; return Math.max(0, p.z) / 1500; };
  S.addr = function () {
    const f = st() ? st().flags : {};
    if (f.act3) return '';
    if (f.breached) return 'FOUR-ONE-NINE';
    if (f.cageFell) return 'EKDAHL';
    return 'MARA';
  };
  S.say = function (who, text, o) {
    o = o || {};
    const dur = o.dur || Math.min(7, 2.2 + text.length * 0.055);
    let at = B.time + (o.delay || 0);
    if (who === 'tobias' && !o.raw) at += Math.max(0, S.latency());
    Q.push({ who, text: text.replace('{N}', S.addr()), at, dur, quiet: o.quiet });
  };
  // A conversation: each line waits for the last, plus comms latency on Tobias. After the breach his
  // replies arrive before Mara has finished speaking.
  S.convo = function (lines, start) {
    let t = B.time + (start || 0);
    for (const [who, text] of lines) {
      const dur = Math.min(7, 2.2 + text.length * 0.055);
      if (who === 'tobias') t += S.latency();
      Q.push({ who, text: text.replace('{N}', S.addr()), at: Math.max(B.time, t), dur });
      t += dur + 0.3;
    }
    return t - B.time;
  };
  function updateCaps(dt) {
    for (let k = Q.length - 1; k >= 0; k--) {
      const q = Q[k];
      if (B.time >= q.at) {
        Q.splice(k, 1);
        S.caps.push({ who: q.who, text: q.text, until: B.time + q.dur });
        if (!q.quiet && q.who !== 'hud') A.voice(q.who === 'new' ? 'new' : q.who === 'mara' ? 'mara' : 'tobias', q.dur * 0.8);
        if (q.who === 'hud') A.sfx('beep');
      }
    }
    S.caps = S.caps.filter(c => c.until > B.time).slice(-4);
    void dt;
  }
  S.clearCaps = function () { Q.length = 0; S.caps.length = 0; };

  // ------------------------------------------------------------------ state, save and load
  S.newState = function (ng) {
    S.clearTimers && S.clearTimers();
    B.state = { v: 1, act: 'deck', ng: !!ng, flags: {}, taken: {}, cp: null, player: null, deaths: 0, deathLog: [], corpses: [], seen: {}, t0: Date.now() };
    return B.state;
  };
  S.label = function () {
    const f = st().flags, base = 'MARA EKDAHL';
    if (f.archive) return '—';
    if (f.act3) return '419';
    if (f.breached && f.vigil) return 'M RA  KD  L';
    if (f.breached) return 'MARA EKDA L';
    return base;
  };
  S.save = function () {
    const s = st(); if (!s) return;
    s.player = B.Player.serialize();
    s.label = S.label();
    B.store.set('benthos.save', s);
  };
  S.hasSave = () => { const s = B.store.get('benthos.save', null); return !!(s && s.v === 1 && s.act && s.act !== 'deck'); };
  S.checkpoint = function (c) {
    const s = st(), p = P();
    s.cp = { act: B.act, x: c ? c.x + 1.5 : p.x, y: c ? c.y : p.y, z: c ? Math.min(c.z, H(c.x + 1.5, c.y) - 1.3) : p.z };
    s.act = B.act;
    S.save();
    if (c) B.Hud.toast('SAVED · ' + S.label());
  };
  S.continueGame = function () {
    B.Hud.closeMenu();
    const s = B.store.get('benthos.save', null); if (!s) return S.newGame(false);
    B.state = s; s.seen = s.seen || {};
    if (s.ng) B.setRes(320, 180); else B.setRes(480, 270);
    S.loadAct(s.act, s.cp, s.player);
    B.mode = 'play';
  };
  S.newGame = function (ng) {
    B.Hud.closeMenu();
    S.newState(ng); B.meta.runs++; B.saveMeta();
    if (ng) B.setRes(320, 180); else B.setRes(480, 270);
    S.loadAct('deck');
    B.mode = 'play';
  };

  // ------------------------------------------------------------------ maps
  S.getMap = function (act) { if (!S.maps[act]) S.maps[act] = W.create(act); return S.maps[act]; };
  S.loadAct = function (act, cp, pstate) {
    S.clearCaps(); S.locked = false; S.upIsDown = false; S.surfacing = false; S.hideBody = false; S.noclip = false; S.ledgeFail = false;
    B.act = act; st().act = act;
    B.map = S.getMap(act);
    E.reset(); B.Z.reset(); B.signals = [];
    const pos = cp || START[act]();
    if (pstate) B.Player.restore(pstate); else if (!P() || act === 'deck') B.Player.spawn(pos.x, pos.y, pos.z);
    const p = P(); p.x = pos.x; p.y = pos.y; p.z = pos.z; p.vx = p.vy = p.vz = 0; p.dead = false; p.tangled = null; p.inCage = null; p.anchor = null;
    if (act !== 'deck') { p.deck = false; }
    POP[act]();
    if (act !== 'deck') S.checkpoint(null);
    B.snapCamera = true;
  };
  const START = {
    deck: () => ({ x: 34, y: 33.5, z: -3.9 }),
    act1: () => ({ x: 95, y: 80, z: 4 }),
    act2: () => ({ x: 210, y: 210, z: 1003 }),
    act3: () => ({ x: 62, y: 64, z: 3330 }),
  };
  const POP = {};

  // ---------------- prologue: the deck
  POP.deck = function () {
    const fl = st().flags;
    E.prop(MD.aframe, 13, 32, -3, { anchor: false });
    const cage = E.prop(() => MD.cage({ lit: true }), 11.2, 32, -4.4, { anchor: false, solid: true, r: 1.2 });
    cage.interact = { label: () => fl.footage ? 'SUIT UP AND ENTER THE CAGE' : null, fn: () => S.suitUp() };
    const tab = E.prop(t => MD.table({ on: true }), 21, 30, -3, { solid: true, r: 0.8, anchor: false });
    tab.interact = { label: () => 'READ THE DOSSIER', fn: () => B.Hud.openDoc(DOCS.dossier) };
    const tob = E.prop(t => MD.person({ yaw: Math.PI / 2 + Math.sin(t * 0.3) * 0.3, t, suit: '#d8b020', hat: '#b02a1a', skin: '#b07a5a', trou: '#2a2a2a' }), 21.5, 28.6, -3.9, { solid: true, r: 0.45, anchor: false });
    tob.interact = { label: () => fl.footage ? 'TALK TO TOBIAS' : 'TALK TO TOBIAS (THE ELEVEN SECONDS)', fn: () => S.tobiasDeck() };
    const lock = E.prop(() => MD.locker(), 33, 36.6, -3, { solid: true, r: 0.8, anchor: false });
    lock.interact = { label: () => 'LOOK IN THE DIVE LOCKER', fn: () => { S.say('mara', 'HV-0419. SIX YEARS IN THAT SUIT. NOT A SCRATCH ON THE VIEWPORT.'); fl.locker = true; } };
    E.prop(t => MD.diver({ yaw: -Math.PI / 2, t: 0, plain: [] }), 33.6, 36.2, -4.2, { anchor: false });
    const c1 = E.prop(t => MD.person({ yaw: Math.sin(t * 0.2) * 2, t, suit: '#3a4a5a', vest: '#c8e020', skin: '#8a5a3a' }), 36, 30, -3.9, { solid: true, r: 0.45, anchor: false });
    c1.interact = { label: () => 'TALK TO JONAH', fn: () => S.say('new', "RADIO'S BEEN PLAYING THAT WALTZ ALL NIGHT. NOBODY KNOWS WHO TUNED IT.") };
    const c2 = E.prop(t => MD.person({ yaw: 3.0, t, suit: '#3a4a5a', vest: '#ff7a1a', hair: '#8a6a40', skin: '#d8a888' }), 27, 34.5, -3.9, { solid: true, r: 0.45, anchor: false });
    c2.interact = { label: () => 'TALK TO RUTH', fn: () => S.say('new', "TOBIAS THINKS HE'S FUNNY. HE'S BEEN TELLING THE SAME JOKE SINCE NINETY-NINE.") };
    const radio = E.prop(() => [MD.box(0, 0, -0.2, 0.25, 0.12, 0.15, '#4a3a2a'), R.P.s(0.2, 0, -0.25, 0.05, B.linHex('#ffb43a'), { e: [0.6, 0.3, 0.05] })], 38.6, 32, -4.1, { anchor: false });
    radio.interact = { label: () => 'TURN OFF THE RADIO', fn: () => { A.stopWaltz(); S.say('mara', '...'); radio.interact = null; } };
    A.waltz('radio');
    S.say('hud', 'MSV HALCYON MERCY · ASHER DEEP · 05:52 · SEA STATE 5', { delay: 0.6, dur: 5 });
    S.say('hud', 'WASD: WALK · E: INTERACT', { delay: 3, dur: 5 });
  };
  S.tobiasDeck = function () {
    const fl = st().flags;
    if (!fl.footage) {
      S.say('tobias', "MARA. COME LOOK AT THIS BEFORE YOU SIGN ANYTHING.", { raw: true });
      S.locked = true;
      S.after(() => B.Hud.playFootage(() => {
        S.locked = false; fl.footage = true;
        S.convo([
          ['tobias', 'HV-0419. THAT IS YOUR SERIAL.'], ['mara', "MY SUIT IS IN THE LOCKER."], ['tobias', 'I KNOW WHERE YOUR SUIT IS.'],
          ['tobias', "AND THAT'S YOUR VOICE ON THE HYDROPHONE. CLAIM LAPSES IN NINETY-SIX HOURS. HALVARD WANTS THE WREN."],
          ['mara', "I'VE NEVER BEEN IN THE ASHER DEEP."], ['tobias', 'THEN GO AND FIND OUT WHO HAS. CAGE IS ON THE A-FRAME.'],
          ['tobias', "COFFEE'S IN THE GALLEY. ONLY THING ON THIS SHIP RATED TO FOUR THOUSAND METRES."],
        ]);
      }), 1800);
    } else S.say('tobias', 'CAGE IS ON THE A-FRAME, MARA. WE LOSE THE WEATHER IN EIGHTY HOURS.', { raw: true });
  };
  S.suitUp = function () {
    S.locked = true; A.stopWaltz();
    B.Hud.fade(1.2, () => {
      S.loadAct('act1');
      B.Hud.fadeIn(1.5);
      S.introAct1();
    }, 'SUITING UP');
  };

  // ---------------- Act I: the shaft
  let cageRef = null;
  POP.act1 = function () {
    const s = st(), fl = s.flags, C = 80;
    const tp = (sec, r, dz, ang) => { const a = B.terraceAngle(sec) + (ang || 0); const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r; return { x, y, z: H(x, y) - (dz === undefined ? 0.6 : dz) }; };
    const cs = (sec) => { const a = B.terraceAngle(sec); return { x: C + Math.cos(a) * 15, y: C + Math.sin(a) * 15, z: B.T1[sec] - 4 }; };
    const stops = [{ x: 95, y: 80, z: 4 }, { x: 95, y: 80, z: 34 }, cs(1), cs(3), cs(6), cs(8)];
    if (!fl.cageFell) {
      const at = s.cp && s.cageStop !== undefined ? stops[s.cageStop] : stops[0];
      cageRef = E.cage(at.x, at.y, at.z, stops); cageRef.stop = s.cageStop || 0;
      cageRef.onArrive = c => { s.cageStop = c.stop; S.onCageArrive(c); };
      cageRef.onMove = c => { if (c.stop === 5 && c.z > 700 && !fl.cageFell) S.cageFall(c); };
    } else if (!fl.cageAct2) {
      const c = E.cage(C - 4, C + 3, 900, stops); c.fallen = true; c.held = true; c.lit = false;
    }
    // Cairns
    const sh = { x: 104, y: 80 }; E.cairn(sh.x, sh.y, H(sh.x, sh.y) - 0.6);
    for (const sec of [1, 3, 6, 8, 10]) { const p = tp(sec, 44, 0.6, 0.12); E.cairn(p.x, p.y, p.z); }
    // Salvage
    const it = (k, p, o) => E.item(k, p.x, p.y, p.z, Object.assign({ sid: 'a1.' + k + '.' + Math.round(p.x) + '.' + Math.round(p.y) }, o));
    const shelf = (dx, dy) => { const x = 104 + dx, y = 80 + dy; return { x, y, z: H(x, y) - 0.5 }; };
    it('ti', shelf(3, -6)); it('o2', shelf(6, 5)); it('flare', shelf(-2, 8)); it('log', shelf(9, -1), { doc: DOCS.stake, title: 'SURVEY STAKE 7' });
    it('lime', tp(0, 40)); it('foam', tp(0, 50, 0.6, -0.1)); it('log', tp(0, 33, 0.6, 0.08), { doc: DOCS.asher4, title: 'ARRAY ELEMENT ASHER-4' });
    it('cu', tp(1, 36)); it('ti', tp(1, 50, 0.6, -0.15)); it('cer', tp(1, 42, 0.6, 0.2));
    it('o2', tp(2, 38)); it('cell', tp(2, 48, 0.6, 0.15)); it('shell', tp(2, 30, 0.6, -0.2));
    it('ti', tp(3, 36, 0.6, -0.1)); it('cer', tp(3, 50)); it('lime', tp(3, 40, 0.6, 0.18));
    it('o2', tp(4, 40)); it('cu', tp(4, 50, 0.6, 0.15)); it('flare', tp(4, 32, 0.6, -0.15));
    it('ti', tp(5, 38)); it('ti', tp(5, 50, 0.6, 0.12)); it('cer', tp(5, 44, 0.6, -0.18));
    // the Gannet bell, the Halvard Four
    const bp = tp(6, 40, 1.6); E.prop(() => MD.bell({ lit: true }), bp.x, bp.y, bp.z, { solid: true, r: 1.4 });
    E.bubble(bp.x, bp.y, bp.z - 2, 1);
    it('lung', tp(6, 40, 0.5, 0.05), { title: 'THE SECOND LUNG' }); it('log', tp(6, 37, 0.6, -0.08), { doc: DOCS.gannet, title: 'GREASE PENCIL ON THE BELL' });
    it('lime', tp(6, 50, 0.6, 0.15)); it('o2', tp(6, 33, 0.6, 0.18));
    for (const [r, a] of [[46, -0.15], [34, 0.12]]) { const p = tp(6, r, 0.4, a); S.corpse(p.x, p.y, p.z, '94', a * 9); }
    // whale fall
    const wf = B.map.features.wf; const cc = E.carcass(wf.x, wf.y, H(wf.x, wf.y) - 1.2, 'caul', 3, { wives: true });
    void cc; it('chitin', tp(7, 50)); it('ti', tp(7, 32, 0.6, 0.15)); it('log', tp(7, 38, 0.6, -0.2), { doc: DOCS.whale, title: 'SLATE: WHALE FALL SURVEY' });
    it('cer', tp(8, 40)); it('o2', tp(8, 50, 0.6, 0.15));
    const d9 = tp(9, 42, 0.4); S.corpse(d9.x, d9.y, d9.z, '94', 1.2, DOCS.diver94);
    it('ti', tp(9, 50, 0.6, 0.15)); it('cell', tp(9, 34, 0.6, -0.15)); it('shell', tp(9, 46, 0.6, -0.1));
    it('log', tp(10, 36, 0.6, -0.1), { doc: DOCS.tether, title: 'CUT TETHER' }); it('o2', tp(10, 48)); it('lime', tp(10, 42, 0.6, 0.2));
    // life
    for (let k = 0; k < 3; k++) E.fish(106 + k * 4, 74 + k * 5, 24 + k * 3, 14, k === 1 ? '#e8c060' : '#c8d8e0');
    for (let k = 0; k < 4; k++) { const a = k * 1.6; E.lanterns(C + Math.cos(a) * 12, C + Math.sin(a) * 12, 470 + k * 15, 40); }
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.5; E.squid(C + Math.cos(a) * 14, C + Math.sin(a) * 14, 320 + k * 110, 'glass'); }
    E.squid(C - 8, C + 6, 820, 'mourning');
    if (fl.reliquary && !s.reliquaryDead) S.spawnReliquary();
    if (fl.sleeper && !s.sleeperDead) S.spawnSleeper([550, 1000]);
    S.spawnCorpses();
  };
  S.introAct1 = function () {
    const p = P();
    p.inCage = cageRef; E.cageGo(cageRef, 1); S.locked = false;
    S.say('hud', 'HV-0419 · ATMOSPHERIC HARDSUIT · RATED 1100 M', { delay: 0.5, dur: 4 });
    S.convo([['tobias', 'HALCYON TO FOUR-ONE-NINE. COMMS CHECK.'], ['mara', 'FOUR-ONE-NINE. LOUD AND CLEAR.'], ['tobias', 'FIRST STOP, FORTY METRES. THE SUNLIT WALL. STRETCH YOUR LEGS, THE CAGE WILL WAIT.']], 2);
  };
  S.onCageArrive = function (c) {
    const fl = st().flags;
    if (c.stop === 1 && !fl.stop1) { fl.stop1 = true; S.say('tobias', 'ANYTHING HALVARD LEFT ON THAT SHELF IS YOURS. CAIRNS ARE THE YELLOW TRANSPONDERS. THEY SAVE YOU, AND THE FABRICATOR WORKS THERE.'); B.Hud.tip('move'); }
    if (c.stop >= 2) S.say('tobias', 'CAGE IS AT ' + Math.round(c.z + 4) + '. THE LEDGE IS TO YOUR ' + S.dirTo(B.terracePoint([0, 0, 1, 1, 3, 3, 6, 6, 8][c.stop + (c.stop > 2 ? c.stop - 2 : 0)] || 1, 40)) + '.');
    S.checkpoint(null); st().cageStop = c.stop; S.save();
  };
  S.dirTo = function (t) { const p = P(); const a = Math.atan2(t.y - p.y, t.x - p.x); return ['EAST', 'SOUTH-EAST', 'SOUTH', 'SOUTH-WEST', 'WEST', 'NORTH-WEST', 'NORTH', 'NORTH-EAST'][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; };
  S.cageFall = function (c) {
    const fl = st().flags; if (fl.cageFell) return; fl.cageFell = true;
    c.moving = false; const p = P();
    S.say('tobias', 'LINE TENSION TWO TONNES. THREE. {N}, GET OUT OF THE—', { raw: true });
    B.shake(10); A.sfx('impact');
    S.after(() => { A.sfx('crack'); }, 1400);
    S.after(() => { A.sfx('boom'); B.shake(16); }, 1400 + 3200 * 0.25);   // second bang: the same snap, through the water
    S.after(() => {
      p.inCage = null; p.vx = 2.4; p.vy = 1.2; p.lockT = 1;
      c.falling = true; c.vz = 0; c.fallTo = 900; c.lit = false;
      S.say('hud', 'DOWNLINE PARTED', { dur: 3 });
      S.after(() => S.say('hud', 'PING TO FOLLOW IT (R)', { dur: 4 }), 2500);
      S.after(() => S.convo([['tobias', '...WE\'LL RIG THE BACKUP WINCH. EIGHT HOURS.'], ['tobias', 'GET TO MAGPIE, {N}. WE\'LL DROP A NEW LINE ON HER TRANSPONDER.']]), 7000);
    }, 2000);
  };

  // ---------------- Act II: the mid-water zone
  POP.act2 = function () {
    const s = st(), fl = s.flags, f = B.map.features, C = f.C, MX = f.MX, MY = f.MY;
    const it = (k, x, y, z, o) => E.item(k, x, y, z, Object.assign({ sid: 'a2.' + k + '.' + Math.round(x) + '.' + Math.round(y) + '.' + Math.round(z) }, o));
    // a vertical archipelago of debris from the barge Gull
    const path = (t) => ({ x: M.lerp(C, MX, t), y: M.lerp(C, MY, t), z: M.lerp(1050, 2860, t) });
    const islands = [[0.12, 8, -6], [0.2, -10, 9], [0.33, 12, 4], [0.42, -6, -12], [0.5, 9, 10], [0.6, -12, 3], [0.7, 7, -9], [0.8, -8, 8], [0.9, 10, 2]];
    const loot = [['ti', 'o2'], ['cer', 'lime'], ['ti', 'cu', 'log'], ['cer', 'o2'], ['ti', 'cell'], ['ti', 'cer', 'shard'], ['lime', 'o2'], ['ti', 'cer'], ['o2', 'ti', 'shard']];
    islands.forEach((d, i) => {
      const p = path(d[0]); const x = p.x + d[1], y = p.y + d[2], z = p.z;
      E.prop(() => MD.debris({ seed: i + 3 }), x, y, z, { solid: true, r: 2.2, flatZ: 1.6 });
      loot[i].forEach((k, j) => { const o = k === 'log' ? { doc: DOCS.barge, title: 'MANIFEST: BARGE GULL' } : {}; it(k, x + Math.cos(j * 2.1) * 2.8, y + Math.sin(j * 2.1) * 2.8, z - 0.5 + j * 0.3, o); });
      if (i === 1 || i === 4 || i === 7) E.cairn(x, y - 2.6, z - 1.2);
    });
    // the Processions
    const p1 = path(0.27), p2 = { x: C + 60, y: C + 30 }, p3 = path(0.72);
    E.procession(p1.x + 14, p1.y - 10, 1450, 300);
    const pr2 = E.procession(p2.x, p2.y, 1750, 300, { holdsCage: true });
    E.procession(p3.x - 12, p3.y + 12, 2300, 300);
    // the cage, held at 1,900 with a body in it
    if (!fl.cageAct2Seen || true) {
      const cg = E.cage(p2.x + 9, p2.y + 2, 1900, [{ x: 0, y: 0, z: 0 }]); cg.fallen = true; cg.held = true; cg.lit = false;
      const body = E.prop(t => MD.diver({ yaw: 0.4, pitch: 0.3, t: 0, plain: [], lamp: 'off' }), p2.x + 9, p2.y + 2, 1900.1, { anchor: false });
      body.interact = { label: () => 'READ THE SUIT TELLTALE', fn: () => { B.Hud.openDoc(DOCS.cage); S.onCageBody(); } };
      body.mopts = { dead: true, lut: 4 };
      void pr2;
    }
    // the Thalassa Vigil, hanging since 1971
    const VX = C - 30, VY = C + 40, VZ = 2200;
    E.prop(() => MD.vigil(), VX, VY, VZ, { solid: true, r: 2.2, flatZ: 1 });
    for (let k = -2; k <= 2; k++) E.add({ type: 'collider', x: VX + k * 3.2, y: VY, z: VZ - 3.2, r: 2.4, solid: true, anchor: true });
    E.cairn(VX + 2, VY - 1.5, VZ - 6);
    it('hand', VX + 0.4, VY - 1.6, VZ - 0.2, { title: "THE CARTOGRAPHER'S HAND" });
    it('log', VX - 0.6, VY - 1.4, VZ + 0.2, { doc: DOCS.vigil, title: "SZABO'S NOTEBOOK" });
    it('shard', VX + 3, VY + 1, VZ + 1.5); it('ti', VX - 3, VY - 2, VZ - 5.6); it('cer', VX + 5, VY - 1, VZ - 5.8);
    // Magpie-3 on its ledge
    const mz = H(MX, MY) - 0.9;
    const mag = E.prop(() => MD.magpie({ lamps: true, wren: !fl.wren, wrenGlow: E.inLamp(MX, MY, mz, 8) > 0 }), MX, MY, mz, { solid: true, r: 1.6, flatZ: 1.3 });
    mag.interact = { label: () => fl.wren ? (fl.eyeTaken ? null : "DETACH MAGPIE'S EYE") : 'RETRIEVE THE WREN', fn: () => S.takeWren() };
    S.magpie = { x: MX, y: MY, z: mz };
    E.add({ type: 'magLight', x: MX, y: MY, z: mz, draw() { R.addLight(MX + 2, MY, mz, 1, 0.5, 0.12, 20, 3.4); } });
    const hx = MX + 4, hy = MY + 3; E.prop(() => MD.helmet({ era: 'mara', yaw: 2.2, cracked: true, stencil: true }), hx, hy, H(hx, hy) - 0.3, { anchor: false });
    it('shard', hx + 0.8, hy + 0.4, H(hx + 0.8, hy + 0.4) - 0.2, { title: 'LOSSLESS SHARD · HV-0419 · CONDITION: HISTORICAL' });
    E.cairn(MX - 6, MY - 6, H(MX - 6, MY - 6) - 0.6);
    it('o2', MX - 4, MY + 8, H(MX - 4, MY + 8) - 0.5); it('lime', MX + 8, MY - 4, H(MX + 8, MY - 4) - 0.5);
    // fauna
    for (let k = 0; k < 6; k++) { const p = path(0.08 + k * 0.15); E.squid(p.x + M.rnd(-8, 8), p.y + M.rnd(-8, 8), p.z + 10, 'glass'); }
    for (let k = 0; k < 2; k++) { const p = path(0.55 + k * 0.25); E.squid(p.x - 6, p.y + 5, p.z, 'mourning'); }
    const g1 = path(0.58), g2 = path(0.85); E.grain(g1.x + 6, g1.y - 4, g1.z + 4, 900); E.grain(g2.x - 5, g2.y + 6, g2.z, 1000); E.grain(MX + 10, MY + 6, 2895, 900);
    if (!s.reliquaryDead && fl.reliquary) S.spawnReliquary();
    if (fl.breached && !s.sleeperDead) S.spawnSleeper([1000, 2890]);
    S.spawnCorpses();
  };
  S.onCageBody = function () {
    const fl = st().flags; if (fl.cageBody) return; fl.cageBody = true;
    S.convo([['mara', 'SEVEN-EIGHTY. SIGNAL LOST.'], ['tobias', 'SAY AGAIN, {N}?'], ['mara', 'NOTHING. CARRYING ON.']], 1.5);
  };
  S.takeWren = function () {
    const fl = st().flags, p = P();
    if (!fl.wren) {
      fl.wren = true; p.relics.wren = true; A.sfx('pickup'); B.Hud.toast('+THE WREN');
      S.checkpoint(null);
      S.after(() => {
        S.convo([['tobias', "THAT'S THE JOB. DROP YOUR WEIGHTS, {N}. WE'LL BRING YOU HOME."]]);
        S.after(() => { S.say('hud', '[SPACE] DROP WEIGHTS', { dur: 8 }); fl.dropPrompt = true; }, 4500);
      }, 800);
    } else if (!fl.eyeTaken) { fl.eyeTaken = true; p.relics.eye = true; A.sfx('pickup'); B.Hud.toast("+MAGPIE'S EYE (TETHERED CAMERA)"); }
  };

  // ---------------- Act III: the Benthic Plain
  POP.act3 = function () {
    const s = st(), fl = s.flags, f = B.map.features;
    const it = (k, x, y, o) => E.item(k, x, y, H(x, y) - 0.5, Object.assign({ sid: 'a3.' + k + '.' + Math.round(x) + '.' + Math.round(y) }, o));
    E.cairn(66, 70, H(66, 70) - 0.6); E.cairn(128, 112, H(128, 112) - 0.6); E.cairn(150, 150, H(150, 150) - 0.6); E.cairn(178, 172, H(178, 172) - 0.6);
    // whale fall
    E.carcass(f.wf.x, f.wf.y, H(f.wf.x, f.wf.y) - 1.1, 'caul', 3, { wives: true });
    // Tern-7
    const lx = 232, ly = 142; E.prop(() => MD.lander(), lx, ly, H(lx, ly) - 0.3, { solid: true, r: 1.2 });
    it('log', lx + 1.5, ly + 1, { doc: DOCS.tern, title: 'TERN-7 DATA CARD' });
    // helmets on the plain
    const helm = (x, y, era, doc, title) => { const pr = E.prop(() => MD.helmet({ era, yaw: x, cracked: true }), x, y, H(x, y) - 0.3, { anchor: false }); pr.mopts = { dead: true, lut: era === '94' ? 3 : 2, scale: era === '94' ? 2 : 3 }; if (doc) pr.interact = { label: () => 'READ: ' + title, fn: () => B.Hud.openDoc(doc) }; };
    helm(88, 82, 'mara', DOCS.hv417, 'HELMET HV-0417'); helm(140, 70, 'old', DOCS.plainhelm, 'HELMET, NO SERIAL'); helm(70, 150, '94'); helm(205, 120, '71'); helm(160, 210, 'old');
    // brine lakes, with preserved shapes under the mirror
    const LA = f.lakes[0];
    S.eyeLake = LA;
    // salvage
    it('ti', 80, 72); it('cer', 96, 92); it('o2', 112, 100); it('lime', 130, 88); it('ti', 150, 100); it('cer', 120, 130); it('o2', 170, 120); it('ti', 196, 130); it('cer', 210, 160);
    it('lime', 160, 140); it('o2', 186, 150); it('ti', 140, 150); it('cer', 165, 155); it('shell', 100, 120); it('flare', 150, 128);
    it('shard', LA.x + LA.r + 2, LA.y); it('shard', lx - 3, ly + 2); it('shard', 150, 132); it('shard', 182, 186);
    // the Grain
    E.grain(f.wf.x + 6, f.wf.y - 4, H(f.wf.x, f.wf.y) - 3, 1000); E.grain(f.lakes[1].x, f.lakes[1].y + 14, H(f.lakes[1].x, f.lakes[1].y + 14) - 3, 900); E.grain(f.AX - 8, f.AY - 10, 4180, 1200);
    for (let k = 0; k < 2; k++) E.squid(110 + k * 50, 90 + k * 40, H(110 + k * 50, 90 + k * 40) - 8, 'mourning');
    // the Archive: one helmet for every death in this save, laid into the spiral, stencils facing in
    S.buildArchive(f.AX, f.AY, s.deaths);
    if (!s.reliquaryDead && fl.reliquary) S.spawnReliquary();
    if (fl.eyeDone) S.spawnDouble();
    S.spawnCorpses();
  };
  S.buildArchive = function (AX, AY, deaths) {
    const n = 26 + deaths;
    for (let i = 0; i < n; i++) {
      const tt = i / n * 4.4, a = tt * Math.PI * 2, r = 5 + tt * 5.6;
      const x = AX + Math.cos(a) * r, y = AY + Math.sin(a) * r;
      const mara = i < deaths || i % 5 === 0, era = mara ? 'mara' : ['94', '71', 'old'][i % 3];
      const pr = E.prop(() => MD.helmet({ era, yaw: a + Math.PI, tilt: 0.2, stencil: mara }), x, y, H(x, y) - 0.4, { anchor: false });
      pr.mopts = { dead: !mara, lut: mara ? 0 : era === '94' ? 3 : 2, scale: era === '94' ? 2 : era === 'mara' ? 1 : 3, minLight: 0.04 };
    }
    const core = E.prop(t => [R.P.s(0, 0, 0, 0.5, B.linHex('#9aa2ab'), { m: 3, e: [0.05, 0.05, 0.08] }), MD.box(0, 0, 0.5, 0.8, 0.8, 0.3, '#25282e')], AX, AY, H(AX, AY) - 0.9, { solid: true, r: 0.9 });
    core.interact = { label: () => st().flags.archiveDone ? 'CHOOSE' : 'SLOT THE WREN INTO YOUR DATA PORT', fn: () => S.archive() };
    S.archiveCore = core;
  };

  // ------------------------------------------------------------------ recurring actors
  S.spawnReliquary = function () {
    if (E.byType('reliquary').length) return;
    const p = P(), a = Math.random() * 6.28; let x = p.x + Math.cos(a) * 35, y = p.y + Math.sin(a) * 35;
    if (H(x, y) < p.z + 2) { x = p.x; y = p.y; }
    E.reliquary(x, y, p.z);
  };
  S.spawnSleeper = function (band) {
    if (E.byType('sleeper').length || st().sleeperDead) return;
    const p = P(), a = Math.random() * 6.28;
    E.sleeper(p.x + Math.cos(a) * 45, p.y + Math.sin(a) * 45, M.clamp(p.z + 15, band[0], band[1]), band);
  };
  S.spawnDouble = function () { if (E.byType('double').length) return; const p = P(); E.double(p.x - 25, p.y + 18, p.z); };
  S.corpse = function (x, y, z, era, yaw, doc) {
    const c = E.add({
      type: 'corpse', x, y, z, era, yaw: yaw || 0, mara: era === 'mara', r: 0.8, anchor: true, cells: 0,
      draw() {
        const sc = this.era === '94' ? 2 : this.era === '71' ? 3 : st().flags.act3 ? 3 : 2;
        R.model(this.x, this.y, this.z, MD.corpse({ era: this.era, yaw: this.yaw }), { dead: true, lut: this.era === '94' ? 3 : this.era === '71' ? 2 : 4, scale: sc });
        if (this.hud && E.inLamp(this.x, this.y, this.z, 10) > 0) R.point(this.x + 0.2, this.y, this.z - 0.3, 1, 0.8, 0.45, 0.05, 1);
      },
      interact: doc ? { label: () => 'READ THE TELLTALE', fn: () => B.Hud.openDoc(doc) } : null,
    });
    c.hud = !!doc;
    return c;
  };
  S.spawnCorpses = function () {
    for (const c of st().corpses) if (c.act === B.act && !c.taken) {
      const e = S.corpse(c.x, c.y, c.z, 'mara', c.yaw);
      e.cells = c.cells || 0; e.ref = c;
      e.interact = { label: () => e.cells > 0 ? 'RECOVER YOUR BIOMASS (' + e.cells + ')' : 'YOUR TELLTALE: ' + Math.round(c.z) + ' M', fn() { if (e.cells > 0 && B.Player.absorb(e, c.strain || 'caul')) { e.cells--; c.cells = e.cells; } else B.Hud.toast('DEPTH ' + Math.round(c.z) + ' M · SIGNAL LOST'); } };
    }
  };

  // ------------------------------------------------------------------ deaths
  S.onDeath = function (cause) {
    const s = st(), p = P();
    s.deaths++; B.meta.deaths++; B.saveMeta();
    s.deathLog.push({ act: B.act, z: Math.round(p.z), res: p.res, cause });
    // keep the death count even though the checkpoint reload rewinds everything else
    const sv = B.store.get('benthos.save', null); if (sv) { sv.deaths = s.deaths; sv.deathLog = s.deathLog; sv.corpses = s.corpses; B.store.set('benthos.save', sv); }
    if (s.flags.breachPending) return S.breachDeath();
    if (s.flags.breached) return S.recompress(cause);
    A.sfx('crack'); B.shake(12);
    S.clearCaps();
    B.mode = 'dead'; B.deadT = 0; B.deadCause = cause;
  };
  S.retry = function () {
    const s = st();
    if (!s.flags.breachPending) S.clearTimers();
    if (s.flags.breachPending) return S.resumeAfterBreach();
    const sv = B.store.get('benthos.save', null);
    if (sv) { const keep = { deaths: s.deaths, deathLog: s.deathLog, corpses: s.corpses }; B.state = Object.assign(sv, keep); B.state.seen = B.state.seen || {}; S.loadAct(sv.act, sv.cp, sv.player); }
    else S.loadAct(s.act);
    B.mode = 'play';
  };
  // After the breach, death is lossy: you come back at the last Cairn with less of yourself, and your body stays.
  S.recompress = function (cause) {
    const s = st(), p = P();
    s.corpses.push({ act: B.act, x: p.x, y: p.y, z: p.z, yaw: p.yaw, cells: p.cells.length, strain: p.cells[0] });
    S.corpse(p.x, p.y, p.z, 'mara', p.yaw);
    p.cells = [];
    B.Player.loseFidelity(2, 'recompress');
    A.sfx('crack'); R.post.flash = 0.8; B.shake(14);
    const cp = s.cp || START[B.act]();
    p.x = cp.x; p.y = cp.y; p.z = cp.z; p.vx = p.vy = p.vz = 0; p.crush = 0; p.dead = false; p.tangled = null; p.grabbed = null; p.anchor = null;
    p.o2 = Math.max(p.o2, p.o2Max * 0.5); p.paco2 = 40; p.suffoT = 0; p.lockT = 2;
    B.Hud.boot(['RECOMPRESSION', 'HV-0419 · RESTART', 'VITALS NOMINAL', 'FIDELITY ' + p.fidelity]);
    B.snapCamera = true;
    void cause;
  };

  // ------------------------------------------------------------------ the Breach (1,140 m)
  S.startBreach = function () {
    const s = st(); if (s.flags.breachStarted) return; s.flags.breachStarted = true;
    S.checkpoint(null);
    B.Z.bigWave();
    S.say('hud', 'WATER COLUMN SHEAR', { dur: 3 });
    S.say('tobias', 'DENSITY ALARM. THAT IS A BIG ONE, {N}. FIND SOMETHING TO HOLD.');
    s.flags.breachPending = true;
    S.breachRun = { t: 0 };
  };
  function breachTick(dt) {
    const b = S.breachRun; if (!b) return;
    const p = P(); b.t += dt;
    if (b.t > 8) {
      // the trough has her: force the descent to 1,140 m while the hull fails, whatever the rating
      p.vz = Math.max(p.vz, 2.2);
      const k = M.clamp((p.z - 1040) / 100, 0, 1);
      p.crush = Math.max(p.crush, k * 99.5);
      if (b.t > 14 && !b.warn1) { b.warn1 = true; S.say('tobias', "{N}, YOU'RE BELOW RATING—", { raw: true, delay: 0.76 }); }
      if (b.t > 18 && !b.warn2) { b.warn2 = true; S.say('tobias', 'GET UP— GET UP—', { raw: true, delay: 0.76 }); }
      if (p.z > 1128 && !b.line) { b.line = true; S.locked = true; S.say('mara', 'HALCYON, FOUR-ONE-NINE. DEPTH ONE-ONE-FOUR-ZERO. I\'M—', { dur: 3.2 }); A.sfx('knock3'); }
      if (p.z >= 1140 && b.line && !b.dead) {
        b.dead = true; p.z = 1140; S.breachRun = null; S.locked = false;
        A.sfx('crack'); R.post.flash = 1; B.shake(20);
        B.Player.die('breach');
      }
    }
  }
  S.breachDeath = function () {
    S.clearCaps();
    B.mode = 'dead'; B.deadT = 0; B.deadCause = 'breach';
  };
  S.resumeAfterBreach = function () {
    const s = st(), p = P(), fl = s.flags;
    fl.breachPending = false; fl.breached = true;
    p.dead = false; p.breached = true; p.res = 2; p.flipped = true; p.crush = 0; p.z = 1400; p.vx = p.vy = p.vz = 0;
    p.rating = Math.max(p.rating, 1600); p.lockT = 3; p.hrShown = 72;
    B.Player.loseFidelity(3, 'breach');
    B.Z.wave.phase = 'calm'; B.Z.wave.t = 120; B.Z.wave.big = false; B.Z.wave.pull = 0;
    // a debris island and a Cairn near where she wakes
    const d = E.prop(() => MD.debris({ seed: 41 }), p.x + 6, p.y - 3, 1404, { solid: true, r: 2.2, flatZ: 1.6 });
    void d; const c = E.cairn(p.x + 6, p.y - 5.5, 1402.5);
    S.checkpoint(c); s.cp = { act: 'act2', x: c.x + 1.5, y: c.y, z: c.z };
    B.mode = 'play'; B.snapCamera = true;
    B.Hud.boot(['HV-0419 · RESTART', 'VITALS NOMINAL', 'HR 072', 'DEPTH 1400']);
    S.after(() => {
      S.convo([
        ['tobias', '...MARA? WE LOST YOU FOR SIX MINUTES. TELEMETRY IS PATCHY.'], ['tobias', 'VITALS LOOK... FINE. SAY YOUR DEPTH.'],
        ['mara', 'ONE-FOUR-ZERO-ZERO.'], ['tobias', 'COPY, ONE-FOUR-ZERO-ZERO. KEEP GOING, {N}.'],
      ]);
      S.spawnSleeper([1000, 2890]);
    }, 5000);
    S.save();
  };

  // ------------------------------------------------------------------ Magpie: up is down
  function dropTick(dt) {
    const fl = st().flags, p = P();
    if (!fl.dropPrompt || fl.fell) return;
    if (B.I.down('rise') && !S.upIsDown) {
      S.upIsDown = true; fl.dropped = true; p.trim = Math.max(p.trim, 0.6);
      S.say('hud', 'BALLAST RELEASED', { dur: 2 });
      S.after(() => S.convo([['mara', "TOBIAS. THE GAUGE IS CLIMBING. I'M GOING DOWN."], ['tobias', 'SAY AGAIN, {N}?']]), 1500);
      S.after(() => { A.sfx('boom'); B.shake(25); S.say('hud', 'LEDGE FAILURE', { dur: 3 }); S.ledgeFail = true; }, 5500);
    }
    if (S.ledgeFail) {
      // the ledge goes and drags her into the mouth of the inner trench
      const m = B.map.features.mouth;
      p.vx += (m.x - p.x) * dt * 0.6; p.vy += (m.y - p.y) * dt * 0.6; p.vz = Math.max(p.vz, 1.2);
      S.godMode = true; S.noclip = true; p.anchor = null;
      if (Math.random() < dt * 3) E.silt(p.x + M.rnd(-3, 3), p.y + M.rnd(-3, 3), p.z + 1, 1.5);
      if (Math.hypot(p.x - m.x, p.y - m.y) < 6 && p.z > 2930 && !fl.fell) {
        fl.fell = true; S.ledgeFail = false; S.upIsDown = false;
        B.Hud.fade(1.5, () => { S.godMode = false; fl.act3 = true; S.loadAct('act3'); B.Hud.fadeIn(2); S.introAct3(); }, '');
      }
    }
  }
  S.introAct3 = function () {
    const p = P(); p.res = 3; p.rating = Math.max(p.rating, 3700);
    S.say('hud', 'DEPTH PRECISION DEGRADED', { delay: 1.5, dur: 4 });
    S.convo([['mara', 'THE SONAR SAYS NINETY KILOMETRES. THE TRENCH IS FORTY METRES WIDE.'], ['tobias', "YOU'RE DOING GREAT."]], 4);
  };

  // ------------------------------------------------------------------ the Machine's Eye
  S.machineEye = function () {
    const fl = st().flags; if (fl.eyeDone) return; fl.eyeDone = true;
    B.Hud.machineEye(() => {
      S.convo([['tobias', "YOU'RE DOING GREAT, MARA."]], 0);
      S.after(() => S.say('mara', "...I DIDN'T SAY ANYTHING."), 2600);
      S.after(() => S.spawnDouble(), 20000);
      S.after(() => S.overheard(), 45000);
    });
  };
  S.overheard = function () {
    const fl = st().flags; if (fl.overheard) return; fl.overheard = true;
    A.sfx('static', null, 1.2);
    S.convo([
      ['hud', 'SOFAR · CARRIER DETECTED · 1 SOURCE'], ['tobias', 'HV-0420, COMMS CHECK.'], ['new', 'FOUR-TWO-ZERO. LOUD AND CLEAR.'],
      ['tobias', "COFFEE'S IN THE GALLEY. ONLY THING ON THIS SHIP RATED TO FOUR THOUSAND METRES."], ['new', '(LAUGHS)'],
      ['tobias', "THE ASSET'S BEEN QUIET SINCE THE LEDGE. FILE IT."],
    ]);
  };

  // ------------------------------------------------------------------ the Archive and the endings
  S.archive = function () {
    const fl = st().flags;
    if (!fl.archiveDone) { fl.archive = true; S.save(); B.Hud.wrenFootage(() => { fl.archiveDone = true; S.endingMenu(); }); }
    else S.endingMenu();
  };
  S.losslessOK = function () { const p = P(), s = st(); return p.fidelity >= 12 && p.relics.shards >= 7 && !s.reliquaryDead; };
  S.endingMenu = function () {
    B.Hud.menu({
      title: 'THE COUNT HAS REACHED YOU', items: [
        { label: 'ASCEND · TAKE THE WREN AND CLIMB', fn: () => S.ending('ascent') },
        { label: 'SEDIMENT · LIE DOWN', fn: () => S.ending('sediment') },
        S.losslessOK() ? { label: 'LOSSLESS · ANSWER THE COUNT: FOUR, ONE, NINE', fn: () => S.ending('lossless') } : { label: '··· (FIDELITY 12+, SEVEN SHARDS, THE RELIQUARY ALIVE)', disabled: true },
      ], cancel: true,
    });
  };
  S.ending = function (which) {
    if (!B.meta.endings.includes(which)) B.meta.endings.push(which);
    B.meta.ngplus = true; B.saveMeta();
    B.store.del('benthos.save');
    B.Hud.ending(which);
  };

  // ------------------------------------------------------------------ hooks from the systems
  S.onTake = function (it) {
    const fl = st().flags;
    if (it.kind === 'lung') S.say('mara', 'IT IS STILL BREATHING. NOTHING IS ATTACHED TO IT.', { delay: 0.6 });
    if (it.kind === 'hand') { S.say('mara', 'A MAP. DRAWN IN THE DARK. IT IS... ACCURATE.', { delay: 0.6 }); S.say('hud', 'M: CHART', { delay: 3 }); }
    if (it.kind === 'shard' && !fl.shard1) { fl.shard1 = true; S.say('hud', 'HOLD L2 / RIGHT-CLICK + SHIFT... USE AT A CAIRN: +3 FIDELITY', { quiet: true, dur: 0.01 }); S.say('mara', 'VIEWPORT ACRYLIC. MY SERIAL.', { delay: 0.6 }); }
  };
  S.onRead = function (doc) {
    if (doc === DOCS.gannet) S.say('mara', 'PELL ARNESEN. I KNEW HIS DAUGHTER.', { delay: 1 });
    if (doc === DOCS.vigil) { st().flags.vigil = true; S.say('tobias', "WHAT ARE YOU READING DOWN THERE, {N}?", { delay: 2 }); }
  };
  S.onAbsorb = function (strain) {
    const fl = st().flags;
    if (!fl.absorbed) { fl.absorbed = true; S.say('mara', 'THE INTAKE WAS BUILT FOR SPECIMENS.', { delay: 0.4 }); B.Hud.tip('cells'); }
  };
  S.onGraft = function () { const fl = st().flags; if (!fl.grafted) { fl.grafted = true; S.say('mara', 'IT HOLDS. IT IS WARM.', { delay: 0.6 }); } };
  S.onAlarm = function () { const fl = st().flags; if (!fl.alarm) { fl.alarm = true; S.say('tobias', 'WHAT WAS THAT? YOUR HYDROPHONES JUST LIT UP.'); } };
  S.onKnock = function (th) { const fl = st().flags; if (!fl.knock) { fl.knock = true; S.say('hud', 'CRUSH DEBT · ASCEND ABOVE RATING, BRACE (HOLD Q), OR GRAFT (G)', { dur: 6 }); } void th; };
  S.onPing = function () { const fl = st().flags; if (!fl.pinged) { fl.pinged = true; S.say('hud', 'THE HULL RINGS FOR 10 S. ANYTHING THAT HEARD IT WILL FOLLOW YOUR TRAIL. TAP Q NEAR ROCK TO DAMP IT.', { delay: 1, dur: 6 }); } };
  S.onBrace = function () { const fl = st().flags; if (!fl.braced) { fl.braced = true; S.say('hud', 'POWERED DOWN: INVISIBLE TO ELECTRORECEPTION. CRUSH DEBT FALLS. HOLD Q AGAIN TO REBOOT.', { dur: 6 }); } };
  S.onSleeperCommit = function () { B.danger = 3; };
  S.onSleeperDead = function (sl, how) {
    st().sleeperDead = true;
    if (how === 'brine') { const c = E.carcass(sl.x, sl.y, sl.brineZ - 0.5, 'graft', 6, { model: false }); c.interact.label = () => c.charges > 0 ? 'ABSORB FROM THE PICKLED SLEEPER (HOLD)' : null; P().copepods = 1; S.say('mara', 'IT CAUGHT UP WITH ITSELF.', { delay: 1 }); }
    else S.say('mara', 'THE PROCESSION HAS IT.', { delay: 1 });
  };
  S.onReliquaryDead = function (r) {
    st().reliquaryDead = true;
    for (const k of r.hoard.slice(0, 8)) E.item(k, r.x + M.rnd(-2, 2), r.y + M.rnd(-2, 2), r.z + M.rnd(-1, 1));
    E.item('shell', r.x + 1, r.y, r.z); E.item('o2', r.x - 1, r.y + 1, r.z);
    S.say('mara', 'IT NEVER ONCE CAME FOR ME WHILE I WAS WELL.', { delay: 4 });
  };
  S.onProcessionDead = function () { S.say('mara', 'OH.', { delay: 2 }); };
  S.onWaveWarn = function () { const fl = st().flags; if (!fl.waveTold && !fl.breachStarted) { fl.waveTold = true; S.say('hud', 'WATER COLUMN SHEAR · ANCHOR TO DEBRIS WITH THE PICK (LMB)', { dur: 5 }); } };
  S.onCageRide = function (c, next) { if (next === 5) S.say('tobias', 'TAKING YOU DOWN TO SEVEN-EIGHTY. LAST STOP BEFORE MAGPIE.'); };

  // ------------------------------------------------------------------ triggers
  const once = (k, fn) => { const fl = st().flags; if (!fl[k]) { fl[k] = true; fn(); } };
  // Game-time timers (same signature as setTimeout) so story beats freeze with the pause menu.
  let timers = []; S.clock = 0;
  S.after = function (fn, ms) { timers.push({ at: S.clock + (ms || 0) / 1000, fn }); };
  S.clearTimers = function () { timers = []; };
  function runTimers(dt) {
    S.clock += dt;
    const due = timers.filter(t => t.at <= S.clock); if (!due.length) return;
    timers = timers.filter(t => t.at > S.clock);
    for (const t of due) t.fn();
  }
  let ghostT = 120, ghostFrameT = 90;
  S.update = function (dt) {
    runTimers(dt);
    updateCaps(dt);
    if (B.mode !== 'play') return;
    const s = st(), fl = s.flags, p = P(); if (!p) return;
    B.danger = Math.max(0, (B.danger || 0) - dt);
    for (const e of E.list) if (e.alive && (e.type === 'sleeper' && e.mode !== 'dead' && e.mode !== 'drift' || e.type === 'double' || e.type === 'reliquary' && e.mode === 'feed') && Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) < 20) B.danger = Math.max(B.danger, 1);
    if (B.act === 'act1') {
      if (p.z > 60) once('tipTrim', () => B.Hud.tip('trim'));
      if (p.z > 150) once('sunGone', () => S.say('mara', "THAT'S THE LAST OF THE SUN."));
      if (p.z > 205) once('tipLamp', () => B.Hud.tip('lamp'));
      if (p.z > 240) once('tipPing', () => B.Hud.tip('ping'));
      if (p.z > 270) once('engines', () => S.say('tobias', "YOU'LL LOSE OUR ENGINES AROUND THREE HUNDRED, {N}. DON'T TAKE IT PERSONALLY."));
      if (p.z > 370) once('reliquary', () => { S.spawnReliquary(); S.after(() => S.convo([['tobias', 'BIG CONTACT ON YOUR HULL MIC. SLOW. FOLLOWING.'], ['tobias', 'PROBABLY AN ISOPOD.'], ['tobias', 'PROBABLY.']]), 6000); });
      if (p.z > 405) once('layer', () => S.say('tobias', "THAT'S THE SCATTERING LAYER UNDER YOU. SONAR WILL SHOW YOU A FLOOR THAT ISN'T THERE. YOUR LAMP WILL BLIND YOU IN IT. TRY RED."));
      if (p.z > 590) once('gannetTold', () => S.say('tobias', "THE GANNET SHOULD BE ON THE NEXT LEDGE. HALVARD'S BELL. NINETY-FOUR."));
      if (p.z > 635) once('sleeper', () => { S.spawnSleeper([550, 1000]); S.after(() => { S.say('tobias', 'SOMETHING VERY LARGE JUST CROSSED THE HULL MIC. {N}, HOLD STILL.'); B.Hud.tip('sleeper'); }, 5000); });
      if (p.z > 690) once('tipAbsorb', () => B.Hud.tip('absorb'));
      if (p.z > 800 && !fl.cageFell) { const c = E.byType('cage')[0]; if (c) { c.stop = 5; S.cageFall(c); } }
      // the Second Diver's first appearances: one frame at the edge of your light
      if (p.z > 300) { ghostFrameT -= dt; if (ghostFrameT <= 0) { ghostFrameT = M.rnd(120, 260); B.ghostFrame = { x: p.x + p.aimX * 13, y: p.y + p.aimY * 13, z: p.z, yaw: p.yaw }; } }
      if (p.z > 1000) once('toAct2', () => { B.Z.flicker = 2.5; S.say('hud', 'PRESSURE TRANSIENT', { dur: 2 }); S.after(() => { S.loadAct('act2', { x: 210 + (p.x - 80), y: 210 + (p.y - 80), z: 1003 }, B.Player.serialize()); S.introAct2(); }, 1200); });
    } else if (B.act === 'act2') {
      if (!fl.breachStarted && p.z > 1060) S.startBreach();
      breachTick(dt);
      if (fl.breached && p.z > 1600) once('mimic', () => { for (const pr of E.byType('procession')) pr.mimic = true; });
      if (fl.breached) {
        ghostT -= dt;
        if (ghostT <= 0 && B.Player.recIndex() > 60 * 100) {
          ghostT = M.rnd(150, 230);
          const start = B.Player.recIndex() - 60 * 90, rec = B.Player.recFrame(start);
          if (rec) { const a = Math.random() * 6.28; E.ghost(start, 60 * 40, p.x + Math.cos(a) * 26 - rec[0], p.y + Math.sin(a) * 18 - rec[1], p.z - rec[2]); once('ghostTold', () => S.after(() => S.convo([['mara', 'TOBIAS, IS THERE ANOTHER DIVER DOWN HERE?'], ['tobias', "NEGATIVE. YOU'RE THE ONLY SUIT IN THE WATER, {N}."]]), 8000)); }
        }
      }
      if (p.z > 2150 && fl.breached) once('vigilTold', () => S.say('tobias', "THAT SHAPE ON YOUR SONAR IS THE VIGIL. SEVENTY-ONE. SHE SHOULDN'T BE FLOATING."));
      if (p.z > 2400 && fl.breached) once('theSuit', () => S.say('tobias', "...THE SUIT'S STILL TRANSMITTING. I DON'T KNOW WHAT TO TELL HALVARD.", { quiet: false }));
      if (S.magpie && Math.hypot(p.x - S.magpie.x, p.y - S.magpie.y) < 25 && p.z > 2860) once('magpieTold', () => S.say('tobias', "THAT'S HER. GET THE WREN, {N}."));
      dropTick(dt);
    } else if (B.act === 'act3') {
      const L = S.eyeLake;
      if (L && p.relics.eye && !fl.eyeDone && Math.hypot(p.x - L.x, p.y - L.y) < L.r + 6) {
        once('eyePrompt', () => S.say('hud', "[E] DEPLOY MAGPIE'S EYE · LOOK BACK ACROSS THE BRINE", { dur: 6 }));
        if (B.I.pressed('interact') && !p.prompt) S.machineEye();
      }
      if (p.z > 3540) once('pitRim', () => S.say('mara', "THERE'S A PIT. SOMETHING AT THE BOTTOM IS COUNTING."));
      if (p.z > 3980) once('cantFeel', () => S.say('mara', "I CAN'T FEEL THE SUIT. I CAN'T FEEL ANYTHING."));
      if (fl.eyeDone && !fl.overheard && p.z > 3700) S.overheard();
    }
  };
  S.introAct2 = function () {
    const p = P(); p.rating = Math.max(p.rating, 1100);
    S.convo([['mara', 'THE WALLS END.'], ['mara', "THERE'S NOTHING TO TOUCH."], ['tobias', 'THAT ORANGE BELOW YOU IS MAGPIE. FOLLOW IT DOWN, {N}.']], 2);
    S.after(() => S.say('tobias', "YOU'RE IN THE SOFAR CHANNEL. EVERYTHING CARRIES IN THERE. EVERYTHING."), 16000);
  };

  // Lights far below the visible range drawn as pinpricks at their bearing (Magpie, and the Procession's copy of it).
  S.distantLights = function () {
    const out = [];
    if (B.act === 'act2' && S.magpie) out.push({ x: S.magpie.x, y: S.magpie.y, z: S.magpie.z, c: [2.2, 1.0, 0.25] });
    if (B.act === 'act2') for (const pr of E.byType('procession')) if (pr.mimic) out.push({ x: pr.px[pr.n - 1], y: pr.py[pr.n - 1], z: pr.pz[pr.n - 1], c: [2.2, 1.0, 0.25] });
    return out;
  };
})(window.B);
