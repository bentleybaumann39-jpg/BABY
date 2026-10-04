// Player settings with quality presets, persisted to localStorage.
const KEY = 'anechoic.settings.v1';

export const QUALITY = {
  low: { renderScale: 0.6, maxPixelRatio: 1, msaa: 0, shadows: false, shadowSize: 512, bloom: false, lightPool: 6, dust: false, rain: 400, mirror: false },
  medium: { renderScale: 0.8, maxPixelRatio: 1, msaa: 0, shadows: true, shadowSize: 1024, bloom: true, lightPool: 8, dust: true, rain: 900, mirror: true },
  high: { renderScale: 1.0, maxPixelRatio: 1.5, msaa: 4, shadows: true, shadowSize: 2048, bloom: true, lightPool: 10, dust: true, rain: 1600, mirror: true },
};

const DEFAULTS = {
  quality: 'medium',
  sensitivity: 1.0,
  invertY: false,
  fov: 72,
  brightness: 1.0,
  masterVolume: 0.9,
  sfxVolume: 1.0,
  ambienceVolume: 1.0,
  musicVolume: 0.8,
  subtitles: true,
  captions: true,   // descriptive captions for important sounds (accessibility)
  headBob: 1.0,
  mapMarker: true,
  motionBlur: false,
};

export class Settings {
  constructor() {
    this.data = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch { /* storage unavailable */ }
    if (!QUALITY[this.data.quality]) this.data.quality = 'medium';
    this.listeners = [];
  }

  get q() { return QUALITY[this.data.quality]; }
  get renderScale() { return this.q.renderScale; }
  get maxPixelRatio() { return this.q.maxPixelRatio; }
  get msaa() { return this.q.msaa; }
  get bloom() { return this.q.bloom; }
  get brightness() { return this.data.brightness; }

  get(k) { return this.data[k]; }

  set(k, v) {
    this.data[k] = v;
    this.save();
    for (const fn of this.listeners) fn(k, v);
  }

  onChange(fn) { this.listeners.push(fn); }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
}
