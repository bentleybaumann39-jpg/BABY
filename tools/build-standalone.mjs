#!/usr/bin/env node
// Bundles the whole game into one self-contained HTML file that opens by double-click (file://).
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, write: false, alias: { three: './vendor/three.module.js' }, target: 'es2020' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('css/style.css', 'utf8');
let html = readFileSync('index.html', 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, `<style>${css}</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/<script type="module" src="src\/main.js"><\/script>/, () => `<script>${js}</script>`);
writeFileSync('ANECHOIC.html', html);
console.log('wrote ANECHOIC.html', (html.length / 1e6).toFixed(2), 'MB');
