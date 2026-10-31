// Builds the single-file game: souls-rng/SoulsRNG.html
// Usage: node souls-rng/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shell = readFileSync(join(here, 'src', 'shell.html'), 'utf8');
const jsDir = join(here, 'src', 'js');
const files = readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
const js = files.map(f => `// ---- ${f} ----\n` + readFileSync(join(jsDir, f), 'utf8')).join('\n');
if (js.includes('</script')) throw new Error('JS contains a closing script tag');
const out = shell.replace('<!--@@GAME@@-->', () => `<script>\n${js}\n</script>`);
writeFileSync(join(here, 'SoulsRNG.html'), out);
console.log(`Built SoulsRNG.html from ${files.length} modules (${(out.length / 1024).toFixed(0)} KB)`);
