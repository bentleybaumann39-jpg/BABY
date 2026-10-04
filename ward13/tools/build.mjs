// Builds ward13/Ward13.html: the game with three.js r128 inlined, so it runs offline from a single file.
// Usage: node ward13/tools/build.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const three = fs.readFileSync(path.join(root, 'vendor', 'three.min.js'), 'utf8');
const tag = /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js"[^>]*><\/script>/;
if (!tag.test(src)) throw new Error('three.js CDN <script> tag not found in index.html');
if (/<\/script/i.test(three)) throw new Error('three.min.js contains </script; cannot inline safely');
const out = src.replace(tag, () => `<script>/* three.js r128, MIT license, Copyright 2010-2021 Three.js Authors */\n${three}\n</script>`);
const dest = path.join(root, 'Ward13.html');
if (process.argv.includes('--check')) {
  // CI/QA guard: fail if the committed Ward13.html is stale relative to index.html.
  const cur = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
  if (cur !== out) { console.error('Ward13.html is stale: run node ward13/tools/build.mjs'); process.exit(1); }
  console.log('Ward13.html is up to date'); process.exit(0);
}
fs.writeFileSync(dest, out);
console.log(`wrote ${path.relative(process.cwd(), dest)} (${(out.length / 1024).toFixed(0)} KB)`);
