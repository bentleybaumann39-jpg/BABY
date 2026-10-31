#!/usr/bin/env node
// Renders a top-down PNG of the generated map (terrain shading, water, roads, buildings, trees, loot)
// for layout QA. Usage: node tools/mapdump.mjs [seed] [out.png]
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname } from 'node:path';
import { generateMap } from '../shared/map/MapGen.js';
import { MAP_HALF } from '../shared/constants.js';

const seed = Number(process.argv[2] || 7331);
const out = process.argv[3] || 'tests/shots/map.png';
const t0 = performance.now();
const map = generateMap(seed);
const genMs = performance.now() - t0;
const S = 1024;
const px = new Uint8Array(S * S * 3);
const set = (x, z, r, g, b) => {
  const i = Math.floor(x + MAP_HALF), j = Math.floor(z + MAP_HALF);
  if (i < 0 || j < 0 || i >= S || j >= S) return;
  const k = (j * S + i) * 3; px[k] = r; px[k + 1] = g; px[k + 2] = b;
};
for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
  const x = i - MAP_HALF + 0.5, z = j - MAP_HALF + 0.5;
  const h = map.heightAt(x, z);
  const hx = map.heightAt(x + 1, z) - h, hz = map.heightAt(x, z + 1) - h;
  const shade = Math.max(0.35, Math.min(1.2, 0.85 - hx * 0.35 - hz * 0.25));
  let r = 90 + h * 1.2, g = 110 + h * 0.9, b = 70 + h * 0.5;
  if (h < map.water) { r = 40; g = 70; b = 95; }
  else if (map.roadDist(x, z) < 3) { r = 150; g = 140; b = 120; }
  const k = (j * S + i) * 3;
  px[k] = Math.min(255, r * shade); px[k + 1] = Math.min(255, g * shade); px[k + 2] = Math.min(255, b * shade);
}
const bx = map.boxes;
for (let i = 0; i < map.boxMat.length; i++) {
  const owner = map.boxOwner[i];
  const col = owner === -2 ? [30, 60, 30] : owner === -3 ? [120, 120, 115] : [200, 70, 50];
  for (let x = Math.floor(bx[i * 6]); x <= bx[i * 6 + 3]; x++) for (let z = Math.floor(bx[i * 6 + 2]); z <= bx[i * 6 + 5]; z++) set(x, z, ...col);
}
for (const l of map.lootSpots) set(l.x, l.z, 255, 230, 60);
for (const t of map.terminals) for (let a = -2; a <= 2; a++) for (let c = -2; c <= 2; c++) set(t.x + a, t.z + c, 60, 200, 255);

// PNG encode
const raw = Buffer.alloc((S * 3 + 1) * S);
for (let j = 0; j < S; j++) { raw[j * (S * 3 + 1)] = 0; Buffer.from(px.buffer, j * S * 3, S * 3).copy(raw, j * (S * 3 + 1) + 1); }
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log(`map seed ${seed}: gen ${genMs.toFixed(0)} ms, ${map.buildings.length} buildings, ${map.boxMat.length} boxes, ${map.trees.length} trees, ${map.lootSpots.length} loot spots, ${map.terminals.length} terminals → ${out}`);
