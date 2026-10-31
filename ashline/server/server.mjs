#!/usr/bin/env node
// ASHLINE server: serves the browser client and runs authoritative matches over WebSocket (/ws).
// Usage: node server/server.mjs [--port=8090] [--countdown=30] [--players=30] [--fast] [--test] [--data=server/data]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { WebSocketServer } from 'ws';
import { Lobby } from './Lobby.js';
import { Profiles } from './Profiles.js';
import { MATCH_PLAYERS } from '../shared/constants.js';
import { getWorld } from '../shared/sim/Setup.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..');                 // ashline/
const VENDOR = resolve(ROOT, '..', 'vendor');     // repo-level three.js

export function parseArgs(argv) {
  const get = (k, d) => { const a = argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const fast = argv.includes('--fast');
  return {
    port: Number(get('port', process.env.PORT || 8090)),
    countdown: Number(get('countdown', fast ? 5 : 30)),
    players: Math.max(2, Math.min(60, Number(get('players', MATCH_PLAYERS)))),
    timeScale: Number(get('timescale', fast ? 0.35 : 1)),
    test: argv.includes('--test'),
    data: resolve(get('data', join(ROOT, 'server', 'data'))),
    quiet: argv.includes('--quiet'),
  };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

async function serveFile(res, file) {
  const st = await stat(file).catch(() => null);
  if (!st || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(await readFile(file));
}

export async function startServer(opts) {
  const t0 = Date.now();
  getWorld(); // build map + nav once up front
  const profiles = new Profiles(opts.data);
  const lobby = new Lobby({ profiles, opts });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let p = decodeURIComponent(url.pathname);
      if (p === '/' || p === '/index.html') return serveFile(res, join(ROOT, 'client', 'index.html'));
      if (p === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, online: lobby.sessions.size, matches: lobby.matches.size })); return; }
      if (p.startsWith('/vendor/')) {
        const f = normalize(join(VENDOR, p.slice(8)));
        if (!f.startsWith(VENDOR + sep)) { res.writeHead(403); res.end(); return; }
        return serveFile(res, f);
      }
      if (p === '/ASHLINE.html' || p.startsWith('/client/') || p.startsWith('/shared/')) {
        const f = normalize(join(ROOT, p));
        if (!f.startsWith(ROOT + sep)) { res.writeHead(403); res.end(); return; }
        return serveFile(res, f);
      }
      res.writeHead(404); res.end('Not found');
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
  wss.on('connection', (ws) => lobby.connect(ws));
  await new Promise(ok => server.listen(opts.port, ok));
  const port = server.address().port;
  if (!opts.quiet) {
    console.log(`ASHLINE server ready in ${Date.now() - t0} ms`);
    console.log(`  Play:   http://localhost:${port}/`);
    for (const list of Object.values(networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`  LAN:    http://${n.address}:${port}/`);
    console.log(`  Matches: ${opts.players} players, ${opts.countdown}s queue countdown${opts.test ? ', TEST MODE' : ''}`);
  }
  const close = () => new Promise(ok => { for (const m of lobby.matches) m.stop(); profiles.save(true); wss.close(); server.close(() => ok()); for (const c of wss.clients) c.terminate(); });
  return { server, wss, lobby, port, close };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const srv = await startServer(parseArgs(process.argv.slice(2)));
  const bye = async () => { await srv.close(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}
