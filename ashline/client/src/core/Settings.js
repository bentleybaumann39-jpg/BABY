// Persistent client settings with quality presets (localStorage).
export const QUALITY = {
  low: { renderScale: 0.7, maxPixelRatio: 1, msaa: 0, bloom: false, shadowSize: 1024, shadowDist: 45, grass: 0, view: 520, treeShadows: false, label: 'Low' },
  medium: { renderScale: 0.85, maxPixelRatio: 1, msaa: 2, bloom: true, shadowSize: 2048, shadowDist: 60, grass: 0.5, view: 700, treeShadows: false, label: 'Medium' },
  high: { renderScale: 1, maxPixelRatio: 1.5, msaa: 4, bloom: true, shadowSize: 2048, shadowDist: 85, grass: 1, view: 900, treeShadows: true, label: 'High' },
  ultra: { renderScale: 1, maxPixelRatio: 2, msaa: 4, bloom: true, shadowSize: 4096, shadowDist: 110, grass: 1.6, view: 1200, treeShadows: true, label: 'Ultra' },
};

const DEFAULTS = {
  quality: 'high', sens: 1.0, adsSens: 0.8, fov: 85, invertY: false, master: 0.8, sfx: 1.0, music: 0.5,
  crouchToggle: false, adsToggle: false, showFps: false, brightness: 1.0, server: '', name: '',
};
const RULES = {
  quality: v => QUALITY[v] ? v : undefined, sens: v => num(v, 0.05, 5), adsSens: v => num(v, 0.2, 2), fov: v => num(v, 65, 105),
  invertY: v => !!v, master: v => num(v, 0, 1), sfx: v => num(v, 0, 1), music: v => num(v, 0, 1), crouchToggle: v => !!v,
  adsToggle: v => !!v, showFps: v => !!v, brightness: v => num(v, 0.6, 1.6), server: v => String(v).slice(0, 200), name: v => String(v).slice(0, 16),
};
function num(v, a, b) { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : undefined; }

export class Settings {
  constructor() {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem('ashline.settings') || '{}') || {}; } catch {}
    Object.assign(this, DEFAULTS);
    for (const k in RULES) if (raw[k] !== undefined) { const v = RULES[k](raw[k]); if (v !== undefined) this[k] = v; }
    this.listeners = [];
  }
  get q() { return QUALITY[this.quality]; }
  get renderScale() { return this.q.renderScale; }
  get maxPixelRatio() { return this.q.maxPixelRatio; }
  get msaa() { return this.q.msaa; }
  get bloom() { return this.q.bloom; }
  set(k, v) { if (!RULES[k]) return; const c = RULES[k](v); if (c === undefined) return; this[k] = c; this.save(); for (const f of this.listeners) f(k, c); }
  onChange(f) { this.listeners.push(f); }
  save() { const o = {}; for (const k in DEFAULTS) o[k] = this[k]; try { localStorage.setItem('ashline.settings', JSON.stringify(o)); } catch {} }
}
