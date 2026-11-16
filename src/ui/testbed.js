// UI testbed: menus with fake startMatch, real Match + 2D fake renderer for HUD/Input, results with real stats.
// Usage: dist/ui-testbed.html#home | #play | #armory | #shop | #profile | #settings | #loading | #results | #hud  (+ ?touch=1)
import { App } from './app.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Match } from '../sim/match.js';
import Save from '../meta/save.js';

const hash = location.hash.slice(1) || 'home';
const params = new URLSearchParams(location.search);
const forceTouch = params.has('touch') ? params.get('touch') === '1' : undefined;
const root = document.getElementById('app');

class FakeRenderer {
  constructor(canvas) { this.canvas = canvas; this.scale = 7; this.follow = true; this.cx = 30; this.cy = 80; this.match = null; }
  setMatch(m, pid) { this.match = m; this.pid = pid; }
  resize() { this.canvas.width = innerWidth; this.canvas.height = innerHeight; }
  setCameraFollow(b) { this.follow = b; }
  panCamera(dx, dy) { this.cx += dx / this.scale * 10; this.cy += dy / this.scale * 10; }
  focusOn(x, y) { this.cx = x; this.cy = y; }
  screenToWorld(sx, sy) { return { x: this.cx + (sx - this.canvas.clientWidth / 2) / this.scale, y: this.cy + (sy - this.canvas.clientHeight / 2) / this.scale }; }
  worldToScreen(x, y) { return { sx: (x - this.cx) * this.scale + this.canvas.clientWidth / 2, sy: (y - this.cy) * this.scale + this.canvas.clientHeight / 2, visible: true }; }
  render() {
    const m = this.match; const g = this.canvas.getContext('2d'); const W = this.canvas.width, H = this.canvas.height;
    const me = m.heroOf(this.pid); if (this.follow && me) { this.cx = me.x; this.cy = me.y; }
    g.fillStyle = '#1a2a1c'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.04)';
    for (let x = 0; x <= 240; x += 10) { const a = this.worldToScreen(x, 0), b = this.worldToScreen(x, 160); g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(b.sx, b.sy); g.stroke(); }
    for (const e of m.entities.values()) {
      if (!e.alive) continue; const s = this.worldToScreen(e.x, e.y);
      g.fillStyle = e.team === 0 ? '#4fa8ff' : e.team === 1 ? '#ff4d6d' : '#ffd36a';
      if (e.kind === 'hero') g.fillStyle = e.def?.color || '#fff';
      g.beginPath(); g.arc(s.sx, s.sy, (e.radius || 0.6) * this.scale, 0, 7); g.fill();
      if (e.kind === 'hero') { g.strokeStyle = e.team === 0 ? '#4fa8ff' : '#ff4d6d'; g.lineWidth = 3; g.stroke(); }
    }
  }
}

function makeConfig(app) { return app.buildConfig('bram', 'bram_default', 2); }

function startHud(cfg, opts = {}) {
  const canvas = document.createElement('canvas'); canvas.className = 'game';
  Object.assign(canvas.style, { position: 'fixed', inset: 0, width: '100%', height: '100%' });
  document.body.appendChild(canvas);
  const m = new Match(cfg); m.localPlayerId = 'p0';
  const r = new FakeRenderer(canvas); r.setMatch(m, 'p0'); r.resize(); addEventListener('resize', () => r.resize());
  const hudRoot = document.createElement('div'); document.body.appendChild(hudRoot);
  for (let i = 0; i < (opts.warm || 0); i++) m.tick();
  if (opts.setup) opts.setup(m);
  const hud = new Hud(hudRoot, m, r, 'p0', { touch: forceTouch, onQuit: opts.onQuit });
  const input = new Input(canvas, m, r, 'p0', hud);
  let last = performance.now(), acc = 0;
  const loop = (t) => {
    const dt = Math.min(0.1, (t - last) / 1000); last = t; acc += dt;
    while (acc >= 1 / 30) { if (!m.over) m.tick(); acc -= 1 / 30; }
    input.update(dt); hud.update(dt); r.render();
    if (!m.over || !opts.stopOnEnd) requestAnimationFrame(loop); else opts.onEnd?.(m);
  };
  requestAnimationFrame(loop);
  window.__tb = { m, hud, input, r };
  return { m, hud, input, r, canvas, hudRoot };
}

const app = new App(root, {
  startMatch(cfg) {
    window.__gsQuit = () => finish();
    const ctx = startHud(cfg, { stopOnEnd: true, onEnd: () => setTimeout(finish, 2500) });
    let done = false;
    function finish() { if (done) return; done = true; ctx.m.over = ctx.m.over || false; ctx.hud.dispose(); ctx.input.dispose(); ctx.canvas.remove(); ctx.hudRoot.remove(); app.showResults(ctx.m, null); }
  },
});
window.__app = app;

if (hash === 'play') app.act_play();
else if (['armory', 'shop', 'profile', 'settings'].includes(hash)) app.go(hash);
else if (hash.startsWith('armory-')) { app.ui.armory.tab = hash.split('-')[1]; app.go('armory'); }
else if (hash.startsWith('shop-')) { app.ui.shop.tab = hash.split('-')[1]; app.go('shop'); }
else if (hash.startsWith('profile-')) { app.ui.profile.tab = hash.split('-')[1]; app.go('profile'); }
else if (hash === 'loading') { app.launch(makeConfig(app)); }
else if (hash === 'results') {
  const cfg = makeConfig(app); app.lastConfig = cfg;
  const m = new Match(cfg); m.localPlayerId = 'p0';
  for (let i = 0; i < 30 * 60 * 4; i++) m.tick();
  const me = m.heroOf('p0'); me.kills = 7; me.deaths = 2; me.assists = 9; me.cs = 88;
  m.time = Math.max(m.time, 720); m.over = true; m.winner = 0;
  const s = Save.get(); s.xp = Math.max(s.xp, 600); s.season.xp = Math.max(s.season.xp, 420); Save.persist();
  app.showResults(m, null);
} else if (hash === 'hud') {
  app.hide();
  const cfg = makeConfig(app);
  startHud(cfg, {
    warm: 30 * 200,
    setup(m) { const h = m.heroOf('p0'); h.gold = 1450; h.level = Math.max(h.level, 6); h.pendingAugment = params.has('aug') ? 3 : null; h.abilities.q.cd = 3.2; h.abilities.q.cdMax = 6; h.abilities.w.cd = 0; },
  });
}
