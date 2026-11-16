// Simulates the main.js frame loop (accumulator + alpha interpolation) against the real sim with jittery vsync,
// and reports rendered-position smoothness for a joystick-running hero. node tools/loopsim.mjs
import { Match } from '../src/sim/match.js';
import { DT } from '../src/sim/constants.js';
import { HERO_BY_ID } from '../src/data/heroes/index.js';
import { makeRng } from '../src/sim/rng.js';
function run(hz, jitterMs, secs = 4) {
  const players = [{ id: 'me', team: 0, heroId: 'kaela', isBot: false, loadout: HERO_BY_ID.kaela.bot.loadout }];
  const m = new Match({ seed: 1, players }); m.localPlayerId = 'me'; m.tick();
  const h = m.heroOf('me'); h.x = h.prevX = 100; h.y = h.prevY = 70;
  m.issue('me', { type: 'moveDir', dx: 1, dy: 0 });
  const rng = makeRng(5); let now = 0, last = 0, acc = DT * 0.85; let lagSum = 0; const MAX_TICKS = 6;
  const pos = []; const period = 1000 / hz;
  for (let f = 0; f < secs * hz; f++) {
    now = f * period + (rng() * 2 - 1) * jitterMs;      // vsync-ish timestamps with jitter
    let fdt = (now - last) / 1000; last = now; if (!(fdt > 0)) fdt = 0; if (fdt > 0.25) fdt = 0.25;
    const k = Math.round(fdt / DT); if (k >= 1 && Math.abs(fdt - k * DT) < 0.0015) fdt = k * DT;
    acc += fdt; let n = 0;
    while (acc >= DT - 1e-6 && n < MAX_TICKS) { m.tick(); acc -= DT; n++; }
    if (acc < 0) acc = 0;
    const a = Math.min(1, acc / DT);
    pos.push({ t: now, x: h.prevX + (h.x - h.prevX) * a }); lagSum += (1 - a) * DT * 1000;
  }
  // displayed speed per *display* frame (what the eye sees at fixed refresh): dx per nominal period
  const sp = []; for (let i = 5; i < pos.length; i++) sp.push((pos[i].x - pos[i - 1].x) / (period / 1000));
  const mean = sp.reduce((a, b) => a + b, 0) / sp.length, sd = Math.sqrt(sp.reduce((a, b) => a + (b - mean) ** 2, 0) / sp.length);
  return { hz, jitterMs, meanSpeed: mean.toFixed(2), cvPerDisplayFrame: (sd / mean).toFixed(3), backsteps: sp.filter(v => v < 0).length, avgInterpLagMs: (lagSum / pos.length).toFixed(1), stalls: sp.filter(v => v < mean * 0.3).length };
}
for (const [hz, j] of [[60, 0.3], [60, 1.2], [120, 0.3], [30, 1], [50, 1]]) console.log(JSON.stringify(run(hz, j)));
