// Boot & game loop. Owner: Lead.
import { Match } from './sim/match.js';
import { DT } from './sim/constants.js';
import { Renderer } from './render/renderer.js';
import { createHeroPreview, renderHeroPortrait, renderHeroPortraitAsync } from './render/preview.js';
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

  // Fixed-step sim (60Hz) + render interpolation. Input is sampled ONCE PER FRAME before ticking, so a touch that
  // arrives during frame N is applied by the very next tick. Frame deltas within 1.5ms of a whole number of ticks are
  // snapped (vsync jitter would otherwise alternate 0/2 ticks per frame); `alpha` = fraction of the next tick elapsed.
  // acc starts near a full tick: with snapped frame deltas it stays there, so alpha≈0.85 → the picture is only ~2.5ms behind the sim.
  let acc = DT * 0.85, last = performance.now(), raf = 0, ended = false, endAt = 0;
  const MAX_TICKS = 6;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    let fdt = (now - last) / 1000; last = now;
    if (!(fdt > 0)) fdt = 0;
    if (fdt > 0.25) fdt = 0.25;
    const k = Math.round(fdt / DT); if (k >= 1 && Math.abs(fdt - k * DT) < 0.0015) fdt = k * DT;
    try { input.update?.(fdt); } catch (e) { reportError(e); }
    if (!match.over) {
      acc += fdt; let n = 0;
      while (acc >= DT - 1e-6 && n < MAX_TICKS) { match.tick(); acc -= DT; n++; }
      if (n >= MAX_TICKS && acc > DT) acc = DT * 0.5;   // spiral guard: drop backlog, keep smooth
      if (acc < 0) acc = 0;
      match.alpha = Math.min(1, acc / DT);
    } else if (!ended) { ended = true; endAt = now; }
    try { renderer.render(match.over ? 1 : match.alpha, fdt); } catch (e) { reportError(e); }
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

const app = new App(root, { startMatch, createHeroPreview, renderHeroPortrait, renderHeroPortraitAsync, quitMatch });
window.__gsQuit = quitMatch;
app.showMenu();
