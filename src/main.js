// ANECHOIC bootstrap.
import { Game } from './core/Game.js';

const game = new Game();
game.init().catch((e) => {
  console.error(e);
  window.__fatal = String(e?.stack || e);
  const el = document.getElementById('error');
  el.textContent = 'ANECHOIC failed to start.\n\n' + (e?.stack || e) + '\n\nThis game needs a browser with WebGL2 and the Web Audio API. Serve the folder over http (npm start).';
  el.classList.add('show');
});
