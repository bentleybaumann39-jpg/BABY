// The ashline: a closing safe circle in seven phases. All circles are rolled at match start from the
// match seed so intel terminals can reveal future circles.
import { Rng } from '../rng.js';

export const PHASES = [
  { wait: 100, shrink: 70, r: 380, dmg: 1 },
  { wait: 80, shrink: 55, r: 240, dmg: 2 },
  { wait: 70, shrink: 45, r: 150, dmg: 3 },
  { wait: 60, shrink: 40, r: 90, dmg: 5 },
  { wait: 45, shrink: 35, r: 50, dmg: 7 },
  { wait: 35, shrink: 30, r: 22, dmg: 9 },
  { wait: 25, shrink: 35, r: 0, dmg: 12 },
];

export class Zone {
  constructor(seed, timeScale = 1, landTest = null) {
    const rng = new Rng((seed ^ 0xa5e1) || 1);
    this.timeScale = timeScale;
    this.circles = [{ x: 0, z: 0, r: 760 }];
    for (let i = 0; i < PHASES.length; i++) {
      const prev = this.circles[i];
      const r = PHASES[i].r;
      let x = prev.x, z = prev.z;
      for (let t = 0; t < 20; t++) {
        const a = rng.range(0, Math.PI * 2);
        const m = Math.max(0, (i === 0 ? 300 : prev.r - r)) * Math.sqrt(rng.next());
        x = prev.x + Math.cos(a) * m; z = prev.z + Math.sin(a) * m;
        const lim = 500 - r * 0.5;
        if (Math.abs(x) > lim || Math.abs(z) > lim) continue;
        if (landTest && !landTest(x, z)) continue;
        break;
      }
      this.circles.push({ x, z, r });
    }
    this.phase = 0;          // index into PHASES
    this.state = 'wait';     // 'wait' | 'shrink' | 'done'
    this.timer = PHASES[0].wait * timeScale;
    this.cur = { ...this.circles[0] };
    this.from = { ...this.circles[0] };
    this.next = { ...this.circles[1] };
  }

  get dmg() { return PHASES[Math.min(this.phase, PHASES.length - 1)].dmg; }

  update(dt) {
    if (this.state === 'done') return null;
    this.timer -= dt;
    let ev = null;
    if (this.state === 'wait') {
      if (this.timer <= 0) { this.state = 'shrink'; this.timer = PHASES[this.phase].shrink * this.timeScale; this.from = { ...this.cur }; ev = 'shrink'; }
    } else {
      const total = PHASES[this.phase].shrink * this.timeScale;
      const t = Math.min(1, 1 - this.timer / total);
      this.cur.x = this.from.x + (this.next.x - this.from.x) * t;
      this.cur.z = this.from.z + (this.next.z - this.from.z) * t;
      this.cur.r = this.from.r + (this.next.r - this.from.r) * t;
      if (this.timer <= 0) {
        this.cur = { ...this.next };
        this.phase++;
        if (this.phase >= PHASES.length) { this.state = 'done'; this.phase = PHASES.length - 1; ev = 'final'; }
        else { this.state = 'wait'; this.timer = PHASES[this.phase].wait * this.timeScale; this.next = { ...this.circles[this.phase + 1] }; ev = 'wait'; }
      }
    }
    return ev;
  }

  outside(x, z) { return Math.hypot(x - this.cur.x, z - this.cur.z) > this.cur.r; }
  // Circle that will follow the current target (revealed by intel terminals).
  peek(k = 1) { return this.circles[Math.min(this.circles.length - 1, this.phase + 1 + k)]; }
}
