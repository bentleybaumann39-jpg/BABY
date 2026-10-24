// Asset loading with caching. In the single-file build the GLB/JSON payloads are embedded
// in window.__KJ_ASSETS__ as base64 and decoded here instead of fetched.
import { GLTFLoader } from '../../vendor/addons/loaders/GLTFLoader.js';

const cache = new Map();
const loader = new GLTFLoader();
// module builds resolve assets next to the source tree; the bundled single file has no
// import.meta.url (and embeds its assets anyway)
const BASE = (() => { try { return new URL('../../assets/', import.meta.url).href; } catch (e) { return 'assets/'; } })();

function embedded(name) {
  const E = typeof window !== 'undefined' && window.__KJ_ASSETS__;
  return E && E[name] ? E[name] : null;
}

function b64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export async function loadJSON(name) {
  const key = 'json:' + name;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const e = embedded(name + '.json');
    if (e) return JSON.parse(atob(e));
    const r = await fetch(BASE + name + '.json');
    if (!r.ok) throw new Error('missing asset ' + name + '.json');
    return r.json();
  })();
  cache.set(key, p);
  return p;
}

export async function loadGLB(name, onProgress) {
  const key = 'glb:' + name;
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const e = embedded(name + '.glb');
    let buf;
    if (e) buf = b64ToBuffer(e);
    else {
      const r = await fetch(BASE + name + '.glb');
      if (!r.ok) throw new Error('missing asset ' + name + '.glb');
      const total = Number(r.headers.get('content-length')) || 0;
      if (r.body && total && onProgress) {
        const reader = r.body.getReader();
        const chunks = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); got += value.length;
          onProgress(got / total);
        }
        const all = new Uint8Array(got);
        let o = 0;
        for (const c of chunks) { all.set(c, o); o += c.length; }
        buf = all.buffer;
      } else buf = await r.arrayBuffer();
    }
    return new Promise((ok, fail) => loader.parse(buf, BASE, ok, fail));
  })();
  cache.set(key, p);
  return p;
}

export async function loadKaiju(name, onProgress) {
  const [gltf, meta] = await Promise.all([loadGLB(name, onProgress), loadJSON(name)]);
  return { gltf, meta };
}
