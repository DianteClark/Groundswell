// Boot & game loop. Owner: Lead.
import { Match } from './sim/match.js';
import { DT } from './sim/constants.js';
import { Renderer } from './render/renderer.js';
import { createHeroPreview } from './render/preview.js';
import { App } from './ui/app.js';
import { Hud } from './ui/hud.js';
import { Input } from './ui/input.js';

const root = document.getElementById('app');
let session = null;

function startMatch(config) {
  endSession();
  const match = new Match({ ...config, seed: config.seed ?? ((Date.now() & 0x7fffffff) >>> 0) });
  const local = config.players.find(p => !p.isBot) || config.players[0];
  match.localPlayerId = local.id;

  const layer = document.createElement('div');
  layer.className = 'match-layer';
  layer.style.cssText = 'position:fixed;inset:0;overflow:hidden;background:#05070d;touch-action:none;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  const hudRoot = document.createElement('div');
  hudRoot.className = 'hud-root';
  hudRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  layer.append(canvas, hudRoot);
  document.body.appendChild(layer);

  const renderer = new Renderer(canvas);
  const settings = app.getSettings?.() || {};
  if (settings.quality && renderer.setQuality) renderer.setQuality(settings.quality);
  renderer.setMatch(match, local.id);
  const hud = new Hud(hudRoot, match, renderer, local.id);
  const input = new Input(canvas, match, renderer, local.id, hud);
  const resize = () => renderer.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize); resize();

  let acc = 0, last = performance.now(), raf = 0, ended = false, endAt = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    let fdt = (now - last) / 1000; last = now;
    if (fdt > 0.25) fdt = 0.25;
    if (!match.over) {
      acc += fdt; let n = 0;
      while (acc >= DT && n < 8) { input.update?.(DT); match.tick(); acc -= DT; n++; }
      if (n >= 8) acc = 0;
    } else if (!ended) { ended = true; endAt = now; }
    try { renderer.render(match.over ? 1 : acc / DT, fdt); } catch (e) { reportError(e); }
    try { hud.update(fdt); } catch (e) { reportError(e); }
    if (ended && now - endAt > 3500) { // let the victory moment play, then results
      const m = match; endSession(); app.showResults(m, null);
    }
  };
  raf = requestAnimationFrame(frame);
  session = { match, renderer, hud, input, layer, stop() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); } };
  window.__gs = session; // debug handle
  return session;
}

function endSession() {
  if (!session) return;
  const s = session; session = null;
  s.stop();
  try { s.input.dispose?.(); } catch (e) { }
  try { s.hud.dispose?.(); } catch (e) { }
  try { s.renderer.dispose?.(); } catch (e) { }
  s.layer.remove();
}
function quitMatch() { const m = session?.match; endSession(); if (m && m.time > 30) app.showResults(m, null); else app.showMenu(); }

let errShown = 0;
function reportError(e) { if (errShown++ < 3) console.error(e); }

const app = new App(root, { startMatch, createHeroPreview, quitMatch });
window.__gsQuit = quitMatch;
app.showMenu();
