// Building templates. Each template builds a Shape in local coordinates (origin at footprint centre,
// floor top at y = 0, front door facing +z). Shapes are made of axis-aligned boxes used for BOTH
// collision and rendering, plus render-only decoration (window/door openings, pitched roofs, masts).
//
// Nav-grid convention: building origins are integer metres and door centres sit on half-integers,
// with doors at least 1.2 m wide, so a 1 m navigation cell always fits through a doorway.

export const MAT = {
  concrete: 0, brick: 1, plaster: 2, wood: 3, metal: 4, roof: 5, rust: 6, bark: 7, rock: 8,
  sandbag: 9, crate: 10, floor: 11, tile: 12, asphalt: 13, plank: 14,
};
export const MAT_NAMES = Object.keys(MAT);
// Surface for footsteps / impacts.
export const MAT_SURFACE = ['concrete', 'concrete', 'concrete', 'wood', 'metal', 'concrete', 'metal', 'wood', 'rock',
  'dirt', 'wood', 'wood', 'concrete', 'concrete', 'wood'];

const DOOR = (c, w = 1.2, t = 2.2) => ({ c, w, b: 0, t });
const WIN = (c, w = 1.2, b = 1.0, t = 2.0) => ({ c, w, b, t });

class Shape {
  constructor() { this.boxes = []; this.deco = []; this.loot = []; this.terms = []; this.prop = false; }
  box(x0, y0, z0, x1, y1, z1, m) {
    this.boxes.push([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), m]);
  }
  // Wall along an axis. axis 'x': runs along x at z = at. axis 'z': runs along z at x = at.
  wall(axis, at, from, to, y0, h, t, m, ops = []) {
    ops = ops.slice().sort((a, b) => a.c - b.c);
    let cur = from;
    const seg = (a, b, ya, yb) => {
      if (b - a < 0.01 || yb - ya < 0.01) return;
      if (axis === 'x') this.box(a, ya, at - t / 2, b, yb, at + t / 2, m);
      else this.box(at - t / 2, ya, a, at + t / 2, yb, b, m);
    };
    for (const o of ops) {
      const a = o.c - o.w / 2, b = o.c + o.w / 2;
      seg(cur, a, y0, y0 + h);
      if (o.b > 0) seg(a, b, y0, y0 + o.b);
      if (o.t < h) seg(a, b, y0 + o.t, y0 + h);
      const kind = o.b > 0 ? 'window' : 'door';
      if (axis === 'x') this.deco.push({ k: kind, box: [a, y0 + o.b, at - t / 2, b, y0 + o.t, at + t / 2], m });
      else this.deco.push({ k: kind, box: [at - t / 2, y0 + o.b, a, at + t / 2, y0 + o.t, b], m });
      cur = b;
    }
    seg(cur, to, y0, y0 + h);
  }
  // Straight stair flight. Steps are solid blocks from y0 up to each step height.
  // (x, z) is the low end's near corner, dir is 'x+','x-','z+','z-'; width across.
  stairs(x, z, dir, width, n, rise, run, y0, m) {
    for (let i = 0; i < n; i++) {
      const a = i * run, b = (i + 1) * run, top = y0 + (i + 1) * rise;
      if (dir === 'x+') this.box(x + a, y0, z, x + b, top, z + width, m);
      else if (dir === 'x-') this.box(x - b, y0, z, x - a, top, z + width, m);
      else if (dir === 'z+') this.box(x, y0, z + a, x + width, top, z + b, m);
      else this.box(x, y0, z - b, x + width, top, z - a, m);
    }
  }
  roof(x0, z0, x1, z1, y, h, ridge, m = MAT.roof) { this.deco.push({ k: 'roof', box: [x0, y, z0, x1, y + h, z1], ridge, m }); }
  mast(x, z, h) { this.deco.push({ k: 'mast', box: [x - 0.15, 0, z - 0.15, x + 0.15, h, z + 0.15] }); this.box(x - 0.15, 0, z - 0.15, x + 0.15, h, z + 0.15, MAT.metal); }
  cyl(x, z, r, h, m) { this.deco.push({ k: 'cyl', box: [x - r, 0, z - r, x + r, h, z + r], m }); }
  sign(box, text) { this.deco.push({ k: 'sign', box, text }); }
  l(x, y, z) { this.loot.push([x, y, z]); }
  term(x, y, z) { this.terms.push([x, y, z]); }
  foundation(x0, z0, x1, z1) { this.box(x0, -3, z0, x1, 0, z1, MAT.concrete); }
}

// ---------------------------------------------------------------------------------------------
// Templates. W x D footprint; bbox used for terrain pads and tree exclusion.
// ---------------------------------------------------------------------------------------------
export const TEMPLATES = {
  house: { w: 8, d: 7, build(s, v = 0) {
    const H = 2.8, t = 0.3, m = v % 2 ? MAT.brick : MAT.plaster;
    s.foundation(-4, -3.5, 4, 3.5);
    s.wall('x', 3.5, -4, 4, 0, H, t, m, [DOOR(0.5), WIN(-2.3), WIN(2.6)]);
    s.wall('x', -3.5, -4, 4, 0, H, t, m, [WIN(-2), WIN(2)]);
    s.wall('z', -4, -3.35, 3.35, 0, H, t, m, [WIN(0)]);
    s.wall('z', 4, -3.35, 3.35, 0, H, t, m, [WIN(-1)]);
    s.wall('z', -1, -3.35, 3.35, 0, H, 0.16, MAT.plaster, [DOOR(-0.5)]);
    s.box(-4, H, -3.5, 4, H + 0.2, 3.5, MAT.concrete);
    s.roof(-4.4, -3.9, 4.4, 3.9, H + 0.2, 1.9, 'x');
    s.box(2.2, 0, -3.3, 3.7, 0.8, -2.5, MAT.wood);      // counter
    s.box(-3.8, 0, -3.3, -2.6, 1.9, -2.8, MAT.wood);    // cabinet
    s.box(-3.8, 0, 1.4, -1.9, 0.55, 3.3, MAT.wood);     // bed
    s.l(2.5, 0, -1.2); s.l(-2.5, 0, -1.0); s.l(1.0, 0, 2.2); s.l(-2.8, 0.55, 2.4);
  } },

  house2: { w: 10, d: 8, build(s, v = 0) {
    const H = 3.2, t = 0.3, m = v % 2 ? MAT.plaster : MAT.brick;
    s.foundation(-5, -4, 5, 4);
    // ground floor
    s.wall('x', 4, -5, 5, 0, H, t, m, [DOOR(0.5), WIN(-3), WIN(3)]);
    s.wall('x', -4, -5, 5, 0, H, t, m, [WIN(3)]);
    s.wall('z', -5, -3.85, 3.85, 0, H, t, m, [WIN(1.5)]);
    s.wall('z', 5, -3.85, 3.85, 0, H, t, m, [WIN(-1), WIN(2)]);
    s.stairs(-4.6, -3.8, 'x+', 1.2, 13, H / 13, 0.3, 0, MAT.wood);
    // upper slab with stairwell hole x[-5,-0.7] z[-4,-2.45]
    s.box(-5, H - 0.2, -2.45, 5, H, 4, MAT.concrete);
    s.box(-0.7, H - 0.2, -4, 5, H, -2.45, MAT.concrete);
    // upper floor
    s.wall('x', 4, -5, 5, H, H, t, m, [WIN(-3), WIN(0.5), WIN(3)]);
    s.wall('x', -4, -5, 5, H, H, t, m, [WIN(1), WIN(3.5)]);
    s.wall('z', -5, -3.85, 3.85, H, H, t, m, [WIN(1.5)]);
    s.wall('z', 5, -3.85, 3.85, H, H, t, m, [WIN(0)]);
    s.box(-4.85, H, -2.5, -1.9, H + 1.0, -2.4, MAT.wood); // railing
    s.wall('z', 1, -2.4, 3.85, H, H, 0.16, MAT.plaster, [DOOR(0.5)]);
    // roof + parapet
    s.box(-5, 2 * H, -4, 5, 2 * H + 0.25, 4, MAT.concrete);
    s.box(-5, 2 * H + 0.25, 3.8, 5, 2 * H + 0.9, 4, m); s.box(-5, 2 * H + 0.25, -4, 5, 2 * H + 0.9, -3.8, m);
    s.box(-5, 2 * H + 0.25, -3.8, -4.8, 2 * H + 0.9, 3.8, m); s.box(4.8, 2 * H + 0.25, -3.8, 5, 2 * H + 0.9, 3.8, m);
    s.box(2.4, 0, -3.8, 4.8, 0.9, -3.0, MAT.wood);
    s.box(2.6, H, 1.8, 4.8, H + 0.55, 3.8, MAT.wood); // bed upstairs
    s.l(3, 0, -1.5); s.l(-2.5, 0, 1.8); s.l(0.5, 0, 2.5); s.l(3, H, -1.5); s.l(-2.5, H, 1.5); s.l(3.5, H + 0.55, 2.8);
  } },

  barn: { w: 12, d: 16, build(s) {
    const H = 5, t = 0.25, m = MAT.plank;
    s.foundation(-6, -8, 6, 8);
    s.wall('x', 8, -6, 6, 0, H, t, m, [DOOR(0.5, 3.2, 3.8)]);
    s.wall('x', -8, -6, 6, 0, H, t, m, [DOOR(0.5, 3.2, 3.8)]);
    s.wall('z', -6, -7.85, 7.85, 0, H, t, m, [WIN(-4, 1.2, 2.6, 3.6), WIN(3, 1.2, 2.6, 3.6)]);
    s.wall('z', 6, -7.85, 7.85, 0, H, t, m, [WIN(-3, 1.2, 2.6, 3.6), WIN(4, 1.2, 2.6, 3.6)]);
    s.box(-6, H, -8, 6, H + 0.2, 8, MAT.wood);
    s.roof(-6.5, -8.4, 6.5, 8.4, H + 0.2, 3.6, 'z');
    // stalls + hay
    s.box(-5.85, 0, -2, -3, 1.3, -1.85, MAT.wood); s.box(-5.85, 0, 2, -3, 1.3, 2.15, MAT.wood);
    s.box(3, 0, -2, 5.85, 1.3, -1.85, MAT.wood); s.box(3, 0, 2, 5.85, 1.3, 2.15, MAT.wood);
    s.box(-5.6, 0, -7.6, -3.4, 1.1, -5.6, MAT.crate); s.box(3.6, 0, 5.4, 5.6, 2.2, 7.6, MAT.crate);
    s.l(-4.5, 0, 0); s.l(4.5, 0, -4.5); s.l(4.5, 0, 0); s.l(-4.5, 0, 5); s.l(-4.5, 1.1, -6.6);
  } },

  warehouse: { w: 16, d: 24, build(s) {
    const H = 7, t = 0.3, m = MAT.metal;
    s.foundation(-8, -12, 8, 12);
    s.wall('x', 12, -8, 8, 0, H, t, m, [DOOR(0.5, 4.2, 4.6)]);
    s.wall('x', -12, -8, 8, 0, H, t, m, [DOOR(0.5, 4.2, 4.6)]);
    s.wall('z', 8, -11.85, 11.85, 0, H, t, m, [DOOR(-5.5), WIN(3, 2.4, 4.5, 5.8)]);
    s.wall('z', -8, -11.85, 11.85, 0, H, t, m, [DOOR(5.5), WIN(-3, 2.4, 4.5, 5.8)]);
    s.box(-8, H, -12, 8, H + 0.3, 12, MAT.rust);
    // shelving and crates
    s.box(-7.4, 0, -9, -6.2, 3.6, -2, MAT.metal); s.box(6.2, 0, 1, 7.4, 3.6, 8, MAT.metal);
    s.box(-3.2, 0, -6, -1.2, 2.0, -4, MAT.crate); s.box(-3.0, 2.0, -5.8, -1.4, 3.2, -4.2, MAT.crate);
    s.box(2.0, 0, 3.5, 4.0, 1.4, 5.5, MAT.crate); s.box(1.2, 0, -9.5, 3.2, 2.0, -7.5, MAT.crate);
    s.box(-4.5, 0, 6, -2.5, 1.2, 8.5, MAT.crate);
    s.l(-5, 0, -5); s.l(5, 0, 4.5); s.l(0, 0, 0); s.l(-4, 0, 9.5); s.l(4.5, 0, -9.5); s.l(-2.2, 3.2, -5); s.l(-6.8, 3.6, -5.5);
  } },

  barracks: { w: 8, d: 20, build(s) {
    const H = 3, t = 0.3, m = MAT.concrete;
    s.foundation(-4, -10, 4, 10);
    s.wall('x', 10, -4, 4, 0, H, t, m, [DOOR(0.5)]);
    s.wall('x', -10, -4, 4, 0, H, t, m, [DOOR(0.5)]);
    const w = [WIN(-7.5), WIN(-4), WIN(0), WIN(4), WIN(7.5)];
    s.wall('z', -4, -9.85, 9.85, 0, H, t, m, w);
    s.wall('z', 4, -9.85, 9.85, 0, H, t, m, w);
    s.box(-4, H, -10, 4, H + 0.25, 10, MAT.concrete);
    for (const z of [-7.5, -4, 0, 4, 7.5]) { s.box(-3.8, 0, z - 1, -2.9, 0.6, z + 1, MAT.metal); s.box(2.9, 0, z - 1, 3.8, 0.6, z + 1, MAT.metal); }
    s.box(-0.6, 0, -2, 0.4, 0.8, 2, MAT.wood); // table along centre (leave aisle at x=0.5..)
    s.l(-3.3, 0.6, -7.5); s.l(3.3, 0.6, 4); s.l(1.5, 0, -6); s.l(1.5, 0, 6); s.l(-2, 0, 8);
  } },

  tower: { w: 4, d: 4, bbox: [-2.4, -2.4, 2.4, 7.6], build(s) {
    const P = 4.5;
    for (const [x, z] of [[-2, -2], [1.7, -2], [-2, 1.7], [1.7, 1.7]]) s.box(x, -1, z, x + 0.3, P + 2.6, z + 0.3, MAT.wood);
    s.box(-2, P - 0.2, -2, 2, P, 2, MAT.plank);
    s.box(-2, P, -2, 2, P + 1.0, -1.9, MAT.plank); s.box(-2, P, -1.9, -1.9, P + 1.0, 2, MAT.plank);
    s.box(1.9, P, -1.9, 2, P + 1.0, 2, MAT.plank); s.box(-1.9, P, 1.9, 0.8, P + 1.0, 2, MAT.plank);
    s.box(-2.2, P + 2.6, -2.2, 2.2, P + 2.8, 2.2, MAT.rust);
    s.stairs(0.8, 7.4, 'z-', 1.2, 18, 0.25, 0.3, 0, MAT.wood);
    s.l(-0.8, P, -0.8);
  } },

  church: { w: 10, d: 18, bbox: [-5, -13, 5, 9], build(s) {
    const H = 7, t = 0.4, m = MAT.brick;
    s.foundation(-5, -9, 5, 9);
    s.wall('x', 9, -5, 5, 0, H, t, m, [DOOR(0.5, 2.2, 3.0), WIN(-3, 1.0, 3.5, 5.5), WIN(3.5, 1.0, 3.5, 5.5)]);
    s.wall('x', -9, -5, 5, 0, H, t, m, [DOOR(3.5)]);
    const w = [WIN(-6, 1.2, 2.0, 5.0), WIN(-2, 1.2, 2.0, 5.0), WIN(2, 1.2, 2.0, 5.0), WIN(6, 1.2, 2.0, 5.0)];
    s.wall('z', -5, -8.8, 8.8, 0, H, t, m, w);
    s.wall('z', 5, -8.8, 8.8, 0, H, t, m, w);
    s.box(-5, H, -9, 5, H + 0.25, 9, MAT.wood);
    s.roof(-5.5, -9.4, 5.5, 9.4, H + 0.25, 4.2, 'z');
    s.box(-2, -1, -13, 2, 15, -9, MAT.brick); // bell tower (solid)
    s.roof(-2.3, -13.3, 2.3, -8.7, 15, 5, 'p');
    for (let z = -5; z <= 6; z += 2.2) { s.box(-4.6, 0, z, -0.8, 0.5, z + 0.5, MAT.wood); s.box(1.8, 0, z, 4.6, 0.5, z + 0.5, MAT.wood); }
    s.box(-1.8, 0, -8.6, 1.8, 1.0, -7.4, MAT.concrete); // altar
    s.l(-3, 0, -7.5); s.l(3, 0, -7.5); s.l(-3, 0.5, 2.6); s.l(3.2, 0.5, -2.2); s.l(0.5, 0, 7.5);
  } },

  radiohut: { w: 6, d: 4, bbox: [-3, -2, 6, 2], build(s) {
    const H = 2.8, t = 0.3, m = MAT.concrete;
    s.foundation(-3, -2, 3, 2);
    s.wall('x', 2, -3, 3, 0, H, t, m, [DOOR(0.5), WIN(-1.8)]);
    s.wall('x', -2, -3, 3, 0, H, t, m, [WIN(1.5)]);
    s.wall('z', -3, -1.85, 1.85, 0, H, t, m, []);
    s.wall('z', 3, -1.85, 1.85, 0, H, t, m, [WIN(0)]);
    s.box(-3, H, -2, 3, H + 0.2, 2, MAT.concrete);
    s.box(-2.85, 0, -1.85, -1.2, 0.9, -1.1, MAT.metal); // console
    s.term(-2.0, 0, -1.2);
    s.box(1.2, 0, -1.85, 2.85, 0.8, -1.0, MAT.wood);
    s.mast(4.8, 0, 22);
    s.l(1.8, 0, 0.4); s.l(-1.5, 0, 0.8);
  } },

  shed: { w: 4, d: 3, build(s) {
    const H = 2.4, t = 0.2, m = MAT.plank;
    s.foundation(-2, -1.5, 2, 1.5);
    s.wall('x', 1.5, -2, 2, 0, H, t, m, [DOOR(0.5)]);
    s.wall('x', -1.5, -2, 2, 0, H, t, m, []);
    s.wall('z', -2, -1.4, 1.4, 0, H, t, m, [WIN(0, 0.8, 1.1, 1.8)]);
    s.wall('z', 2, -1.4, 1.4, 0, H, t, m, []);
    s.box(-2.1, H, -1.6, 2.1, H + 0.15, 1.6, MAT.rust);
    s.box(1.0, 0, -1.35, 1.85, 1.0, -0.4, MAT.crate);
    s.l(-1.0, 0, 0);
  } },

  cabin: { w: 6, d: 5, build(s) {
    const H = 2.6, t = 0.25, m = MAT.plank;
    s.foundation(-3, -2.5, 3, 2.5);
    s.wall('x', 2.5, -3, 3, 0, H, t, m, [DOOR(0.5), WIN(-1.8)]);
    s.wall('x', -2.5, -3, 3, 0, H, t, m, [WIN(1)]);
    s.wall('z', -3, -2.35, 2.35, 0, H, t, m, [WIN(0)]);
    s.wall('z', 3, -2.35, 2.35, 0, H, t, m, []);
    s.box(-3, H, -2.5, 3, H + 0.15, 2.5, MAT.wood);
    s.roof(-3.4, -2.9, 3.4, 2.9, H + 0.15, 1.6, 'x');
    s.box(1.4, 0, -2.3, 2.8, 0.75, -1.2, MAT.wood);
    s.box(-2.8, 0, -2.3, -1.2, 0.5, -0.3, MAT.wood);
    s.l(-1.5, 0, 1.2); s.l(2, 0, 0.5);
  } },

  silo: { w: 4, d: 4, build(s) {
    s.foundation(-2, -2, 2, 2);
    s.box(-1.8, 0, -1.8, 1.8, 11, 1.8, MAT.rust);
    s.cyl(0, 0, 2.05, 11.5, MAT.rust);
  } },

  // ---- props (no terrain pad, sit on the ground) ----
  car: { w: 2, d: 4.4, prop: true, build(s) {
    s.box(-0.9, 0, -2.2, 0.9, 0.95, 2.2, MAT.rust); s.box(-0.8, 0.95, -1.1, 0.8, 1.45, 0.9, MAT.rust);
    s.deco.push({ k: 'car', box: [-0.9, 0, -2.2, 0.9, 1.45, 2.2] });
  } },
  container: { w: 2.4, d: 6, prop: true, build(s, v = 0) {
    s.box(-1.2, 0, -3, 1.2, 2.6, 3, v % 2 ? MAT.rust : MAT.metal);
    s.deco.push({ k: 'container', box: [-1.2, 0, -3, 1.2, 2.6, 3], v });
  } },
  railcar: { w: 3, d: 13, prop: true, build(s) {
    s.box(-1.5, 0.9, -6.5, 1.5, 4.2, 6.5, MAT.rust);
    s.box(-1.2, 0, -5.5, 1.2, 0.9, -3.5, MAT.metal); s.box(-1.2, 0, 3.5, 1.2, 0.9, 5.5, MAT.metal);
    s.deco.push({ k: 'railcar', box: [-1.5, 0, -6.5, 1.5, 4.2, 6.5] });
  } },
  crates: { w: 2.4, d: 2.4, prop: true, build(s) {
    s.box(-1.2, 0, -1.2, 0, 1.2, 0, MAT.crate); s.box(0, 0, -1.2, 1.2, 1.2, 0, MAT.crate);
    s.box(-1.2, 0, 0, 0, 1.2, 1.2, MAT.crate); s.box(-1.0, 1.2, -1.0, 0.2, 2.4, 0.2, MAT.crate);
    s.l(0.6, 0, 0.6);
  } },
  sandbags: { w: 4, d: 0.8, prop: true, build(s) {
    s.box(-2, 0, -0.4, 2, 1.0, 0.4, MAT.sandbag);
  } },
  barrels: { w: 1.6, d: 1.6, prop: true, build(s) {
    s.box(-0.8, 0, -0.8, 0, 0.95, 0, MAT.rust); s.box(0, 0, -0.8, 0.8, 0.95, 0, MAT.rust); s.box(-0.8, 0, 0, 0, 0.95, 0.8, MAT.rust);
    s.deco.push({ k: 'barrels', box: [-0.8, 0, -0.8, 0.8, 0.95, 0.8] });
  } },
  fortwall: { w: 12, d: 0.5, prop: true, build(s) {
    s.box(-6, -0.6, -0.25, 6, 2.6, 0.25, MAT.concrete);
  } },
};

// Rotate a local (x, z) by r * 90 degrees.
export function rot(x, z, r) {
  switch (r & 3) {
    case 0: return [x, z];
    case 1: return [-z, x];
    case 2: return [-x, -z];
    default: return [z, -x];
  }
}
function rotBox(b, r, ox, oy, oz) {
  const [ax, az] = rot(b[0], b[2], r), [bx, bz] = rot(b[3], b[5], r);
  return [Math.min(ax, bx) + ox, b[1] + oy, Math.min(az, bz) + oz, Math.max(ax, bx) + ox, b[4] + oy, Math.max(az, bz) + oz];
}

export function templateBBox(name, r) {
  const t = TEMPLATES[name];
  const bb = t.bbox || [-t.w / 2, -t.d / 2, t.w / 2, t.d / 2];
  const b = rotBox([bb[0], 0, bb[1], bb[2], 0, bb[3]], r, 0, 0, 0);
  return [b[0], b[2], b[3], b[5]];
}

// Build a template and transform it into world space.
export function instantiate(name, x, z, r, y, variant = 0) {
  const t = TEMPLATES[name];
  const s = new Shape();
  t.build(s, variant);
  const out = { tpl: name, x, z, r, y, prop: !!t.prop, boxes: [], deco: [], loot: [], terms: [] };
  for (const b of s.boxes) { const w = rotBox(b, r, x, y, z); w.push(b[6]); out.boxes.push(w); }
  for (const d of s.deco) {
    const nd = { ...d, box: rotBox(d.box, r, x, y, z) };
    if (d.ridge === 'x' || d.ridge === 'z') nd.ridge = (r & 1) ? (d.ridge === 'x' ? 'z' : 'x') : d.ridge;
    out.deco.push(nd);
  }
  for (const l of s.loot) { const [lx, lz] = rot(l[0], l[2], r); out.loot.push([lx + x, l[1] + y, lz + z]); }
  for (const l of s.terms) { const [lx, lz] = rot(l[0], l[2], r); out.terms.push([lx + x, l[1] + y, lz + z]); }
  return out;
}
