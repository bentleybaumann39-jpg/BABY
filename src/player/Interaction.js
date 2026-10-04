// Focus raycast + prompts for interactables.
import * as THREE from 'three';

export class Interaction {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.ray = new THREE.Raycaster();
    this.ray.far = 2.3;
    this.focus = null;
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.root = new THREE.Group();
    this.root.name = 'interactables';
    game.scene.add(this.root);
  }

  // def: { id, obj?, at?: {x,y,z,w,h,d}, prompt(): string|null, use(), enabled?(): bool, range? }
  add(def) {
    if (!def.obj && def.at) {
      const a = def.at;
      const m = new THREE.Mesh(new THREE.BoxGeometry(a.w ?? 0.3, a.h ?? 0.3, a.d ?? 0.3), this.hitMat);
      m.position.set(a.x, a.y, a.z);
      if (a.ry) m.rotation.y = a.ry;
      this.root.add(m);
      def.obj = m;
      def.ownMesh = true;
    }
    def.obj.updateMatrixWorld(true);
    this.list.push(def);
    return def;
  }

  remove(def) {
    const i = this.list.indexOf(def);
    if (i >= 0) this.list.splice(i, 1);
    if (def.ownMesh) this.root.remove(def.obj);
    if (this.focus === def) this.focus = null;
  }

  update() {
    const g = this.game;
    const p = g.player;
    this.focus = null;
    let text = null;
    if (!p.alive || p.frozen) { g.ui.setPrompt(null); return; }
    if (p.hiding) { g.ui.setPrompt('<b>E</b>Leave hiding place'); return; }
    const cam = g.camera;
    this.ray.setFromCamera({ x: 0, y: 0 }, cam);
    let best = null, bestD = Infinity;
    const cands = [];
    for (const d of this.list) {
      if (d.enabled && !d.enabled()) continue;
      const o = d.obj;
      if (!o.parent) continue;
      // cheap distance reject
      const wp = o.getWorldPosition(this._v || (this._v = new THREE.Vector3()));
      if (wp.distanceTo(cam.position) > 3.5) continue;
      cands.push(d);
    }
    for (const d of cands) {
      const hits = this.ray.intersectObject(d.obj, true);
      if (hits.length && hits[0].distance < (d.range ?? 2.2) && hits[0].distance < bestD) {
        // Not through walls
        const h = hits[0].point;
        if (!g.grid.los(cam.position.x, cam.position.z, h.x - (h.x - cam.position.x) * 0.02, h.z - (h.z - cam.position.z) * 0.02, 'sight') && Math.hypot(h.x - cam.position.x, h.z - cam.position.z) > 0.7) continue;
        best = d; bestD = hits[0].distance;
      }
    }
    if (best) {
      text = best.prompt ? best.prompt() : 'Interact';
      if (text) this.focus = best;
    }
    g.ui.setPrompt(text ? `<b>E</b>${text}` : null);
    if (this.focus && g.input.hit('interact')) {
      try { this.focus.use(); } catch (e) { console.error('interaction failed', e); }
    }
  }
}
