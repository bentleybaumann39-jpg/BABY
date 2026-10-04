// Visual QA: boot in test mode, drive the game via window.__game, capture screenshots.
// node tests/scenes.mjs <outdir> [sceneName ...]
import { chromium } from 'playwright';
import { startServer } from '../tools/serve.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] || 'shots';
const only = process.argv.slice(3);
mkdirSync(out, { recursive: true });

const SCENES = {
  exterior: `g.player.place(37.3,55.6,0.15); g.player.toggleFlashlight(false);`,
  frontdoor: `g.player.place(41,49.5,0); g.player.flashOn=true;`,
  lobby: `g.player.place(43.5,44.5,0.35); g.player.flashOn=false;`,
  lobbyDesk: `g.player.place(40,40.5,1.4); g.player.pitch=-0.15;`,
  corridor: `g.player.place(12,34,-1.5708); g.player.flashOn=false;`,
  lounge: `g.player.place(26.5,44.5,0.9); g.player.flashOn=true;`,
  restroom: `g.player.place(9.5,40.5,1.5708); g.player.flashOn=true;`,
  dorm: `g.player.place(37.5,31,0); g.player.flashOn=true;`,
  dormRoom: `g.player.place(34,21,1.2); g.player.flashOn=true; g.player.pitch=-0.2;`,
  office: `g.player.place(12,21,-1.1); g.player.flashOn=true;`,
  basementStairs: `g.player.place(8.5,12.6,0); g.player.flashOn=true; g.player.pitch=-0.3;`,
  tunnel: `g.player.place(10,2,-1.5708); g.player.flashOn=true;`,
  electrical: `g.player.place(3.7,7.2,Math.PI); g.player.flashOn=true;`,
  boiler: `g.player.place(17,10.9,0); g.player.flashOn=true;`,
  storage: `g.player.place(33,6,Math.PI*0.75); g.player.flashOn=true;`,
  research: `g.power.on.bird=true; g.player.place(52,34.5,-1.5708); g.player.flashOn=false;`,
  control: `g.power.on.bird=true; g.player.place(64.5,30.5,0.5); g.player.flashOn=false;`,
  live: `g.power.on.bird=true; g.player.place(60.2,18.5,-1.5708); g.player.flashOn=false;`,
  hall: `g.power.on.bird=true; g.player.place(72,31,-0.6); g.player.flashOn=true; g.player.pitch=0.25;`,
  archive: `g.power.on.bird=true; g.player.place(62.5,37.6,0.2); g.player.flashOn=true;`,
  ante: `g.power.on.bird=true; g.player.place(62,8,-1.5708); g.player.flashOn=false;`,
  chamber: `g.power.on.bird=true; g.doors.get('vault').locked=false; g.doors.open(g.doors.get('vault'),69,7.5); g.doors.get('vault').angle=g.doors.get('vault').target; g.doors.get('vault').pivot.rotation.y=g.doors.get('vault').angle; g.player.place(73.5,7.5,-1.5708); g.player.flashOn=true;`,
  entity: `g.power.on.bird=true; g.player.place(52,34.5,-1.5708); g.player.flashOn=true; g.ai.debugShow(58,34.5,-Math.PI/2,{x:52,y:1.6,z:34.5});`,
  entityClose: `g.player.place(30,34.5,-1.5708); g.player.flashOn=true; g.ai.debugShow(33.2,34.3,-Math.PI/2,{x:30,y:1.6,z:34.5}); g.player.pitch=0.25;`,
  recorder: `g.player.place(25,34,-1.5708); g.input.simMouse(2,true);`,
  mapjournal: `g.inventory.add('floorplan'); g.ui.journalTab='map'; g.ui.openJournal(); g.setMode('journal');`,
};

const port = 8000 + Math.floor(Math.random() * 900);
const server = await startServer(port, true);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(`http://localhost:${port}/index.html?test&seed=${process.env.SEED || 7}&quality=${process.env.Q || 'medium'}`);
await page.waitForFunction(() => window.__ready === true || window.__fatal, null, { timeout: 240000 });
await page.evaluate(() => { const g = window.__game; g.ui.setFade(0, 0.01); g.story.timers = []; g.fixedDt = 1/30; });
for (const [name, code] of Object.entries(SCENES)) {
  if (only.length && !only.includes(name)) continue;
  await page.evaluate((c) => { const g = window.__game; g.ui.hideAllScreens(); g.setMode('play'); g.input.simMouse(2, false); g.ai.reset(); g.player.pitch = 0; eval(c); }, code);
  await page.waitForTimeout(Number(process.env.WAIT || 2500));
  await page.screenshot({ path: `${out}/${name}.png` });
  const info = await page.evaluate(() => { const g = window.__game; return { fps: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, zone: g.map.zoneAt(g.player.pos.x, g.player.pos.z)?.name, fatal: window.__fatal || null }; });
  console.log(name, JSON.stringify(info));
}
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
server.close();
