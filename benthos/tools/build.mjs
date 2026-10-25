// Builds benthos/Benthos.html: every script inlined into one self-contained file that opens by double-click.
// Usage: node benthos/tools/build.mjs        (write)
//        node benthos/tools/build.mjs --check (fail if the committed file is stale)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const out = html.replace(/<script src="(src\/[\w.-]+\.js)"><\/script>/g, (_, src) => {
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  if (/<\/script/i.test(js)) throw new Error(`${src} contains </script; cannot inline safely`);
  return `<script>/* ${src} */\n${js}</script>`;
});
if (/<script src=/.test(out)) throw new Error('an external script tag was left un-inlined');
// --artifact <file>: the same game as a page fragment for a claude.ai Artifact (the host supplies the
// doctype, head and body skeleton, so those wrappers and the charset/viewport metas are dropped).
const ai = process.argv.indexOf('--artifact');
if (ai > 0) {
  const frag = out.replace(/<!DOCTYPE html>\s*/i, '').replace(/<\/?html[^>]*>\s*/gi, '').replace(/<\/?head>\s*/gi, '').replace(/<\/?body>\s*/gi, '')
    .replace(/<meta charset="UTF-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
  const titleMatch = frag.match(/<title>.*?<\/title>\s*/);
  const final = titleMatch[0] + frag.replace(titleMatch[0], '');
  fs.writeFileSync(process.argv[ai + 1], final);
  console.log(`wrote ${process.argv[ai + 1]} (${(final.length / 1024).toFixed(0)} KB)`);
  process.exit(0);
}
const dest = path.join(root, 'Benthos.html');
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
  if (cur !== out) { console.error('Benthos.html is stale: run node benthos/tools/build.mjs'); process.exit(1); }
  console.log('Benthos.html is up to date');
  process.exit(0);
}
fs.writeFileSync(dest, out);
console.log(`wrote ${path.relative(process.cwd(), dest)} (${(out.length / 1024).toFixed(0)} KB)`);
