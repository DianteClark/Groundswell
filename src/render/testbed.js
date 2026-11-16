// Visual testbed for the renderer. URL params:
//   ?mode=game|lineup|preview  &t=<seconds to fast-forward>  &q=low|med|high  &cam=x,y (free camera)  &hero=<index of local player>
//   &inject=1 (spawn showcase summons/areas/projectiles near the local hero)  &zone=ember|flood|gale|stone (trigger living map)
import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { createHeroPreview } from './preview.js';
import { buildHero, poseRig } from './models/heroes.js';
import { SKINS } from '../data/skins.js';
import { Match } from '../sim/match.js';
import { spawnProjectile, spawnArea, addStatus, addShield } from '../sim/combat.js';

const Q = new URLSearchParams(location.search);
const mode = Q.get('mode') || 'game';
document.body.style.cssText = 'margin:0;background:#111;overflow:hidden;font-family:system-ui;color:#fff';
const errs = []; window.__errs = errs; window.addEventListener('error', (e) => errs.push(String(e.message)));

if (mode === 'lineup') lineup();
else if (mode === 'preview') previews();
else game();

function game() {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100vw;height:100vh;display:block'; document.body.appendChild(canvas);
  const H = ['bram', 'kaela', 'lumi', 'vex', 'nyx', 'pip', 'mire', 'garrok'];
  const sel = (Q.get('heroes') || 'bram,kaela,lumi,vex,nyx,garrok').split(',');
  const skinIdx = +(Q.get('skin') || 0);
  const players = sel.map((h, i) => {
    const sk = SKINS.filter((s) => s.heroId === h); const s = sk[(skinIdx + i) % sk.length];
    return { id: 'p' + i, team: i < 3 ? 0 : 1, heroId: h, skinId: s.id, isBot: true, name: h, lane: ['top', 'bot', 'top'][i % 3], loadout: { items: ['warblade', 'bulwark', 'swiftboots'], relic: 'blink', sigils: { offense: 'piercing', utility: 'swiftness' } } };
  });
  const m = new Match({ seed: +(Q.get('seed') || 3), difficulty: 2, players });
  const pid = 'p' + (Q.get('hero') || 0); m.localPlayerId = pid;
  const T = +(Q.get('t') || 40);
  for (let i = 0; i < T * 30; i++) m.tick();
  const r = new Renderer(canvas);
  if (Q.get('q')) r.setQuality(Q.get('q'));
  r.resize(innerWidth, innerHeight);
  r.setMatch(m, pid);
  window.addEventListener('resize', () => r.resize(innerWidth, innerHeight));
  if (Q.get('cam')) { const [x, y] = Q.get('cam').split(',').map(Number); r.setCameraFollow(false); r.camFree.set(x, 0, y); r.camT.set(x, 0, y); }
  const me = m.heroOf ? m.heroOf(pid) : m.heroes[0];
  if (Q.get('teleport')) { const [x, y] = Q.get('teleport').split(',').map(Number); me.x = me.prevX = x; me.y = me.prevY = y; }
  if (Q.get('inject')) inject(m, me);
  if (Q.get('zone')) { m._livingMap(0, { ember: 'ember', flood: 'tide', gale: 'gale', stone: 'stone' }[Q.get('zone')] || 'ember'); m.eventLog.push(...m.events.map((ev) => ({ tick: m.tickCount, ev }))); r.lastTick = m.tickCount - 1; }
  if (Q.get('nofog')) r.revealAll = true;
  let acc = 0, last = performance.now(); const speed = +(Q.get('speed') || 1); const freeze = Q.get('freeze');
  let frames = 0, fpsT = 0;
  const hud = document.createElement('div'); hud.style.cssText = 'position:fixed;left:8px;top:6px;font:12px monospace;opacity:.7'; document.body.appendChild(hud);
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!freeze) { acc += dt * speed; while (acc >= 1 / 30) { acc -= 1 / 30; m.tick(); if (Q.get('inject') && m.tickCount % 90 === 0) inject(m, me, true); } }
    r.render(freeze ? 1 : acc * 30, dt);
    frames++; fpsT += dt; if (fpsT > 1) { hud.textContent = `fps ${(frames / fpsT).toFixed(0)}  t=${m.time.toFixed(0)}  draw=${r.gl.info.render.calls} tris=${r.gl.info.render.triangles}`; frames = 0; fpsT = 0; }
  }
  requestAnimationFrame(loop);
  window.__r = r; window.__m = m;
}

function inject(m, me, periodic) {
  const enemies = m.heroes.filter((h) => h.team !== me.team);
  const ally = m.heroes.find((h) => h.team === me.team && h !== me) || me;
  const x = me.x, y = me.y;
  const lumi = m.heroes.find((h) => h.heroId === 'lumi') || me;
  const vex = m.heroes.find((h) => h.heroId === 'vex') || me;
  const kaela = m.heroes.find((h) => h.heroId === 'kaela') || me;
  const nyx = m.heroes.find((h) => h.heroId === 'nyx') || me;
  const garrok = m.heroes.find((h) => h.heroId === 'garrok') || me;
  const bram = m.heroes.find((h) => h.heroId === 'bram') || me;
  for (const [src, key, ang] of [[lumi, 'lumi_q', 0], [vex, 'vex_q', 0.8], [kaela, 'kaela_q', 1.6], [nyx, 'nyx_q', 2.4], [garrok, 'garrok_q', 3.2], [bram, 'bram_q', 4.0], [me, 'pip_q', 4.8], [me, 'mire_q', 5.6]])
    spawnProjectile(m, { src, x: x + Math.cos(ang) * 3, y: y + Math.sin(ang) * 3, dirX: Math.cos(ang), dirY: Math.sin(ang), speed: 9, range: 14, visual: key, hitsUnits: false });
  if (periodic) return;
  spawnArea(m, { src: me, x: x + 9, y: y + 5, radius: 4.5, duration: 600, visual: 'mire_w' });
  spawnArea(m, { src: lumi, x: x - 9, y: y + 6, radius: 3.5, duration: 600, visual: 'lumi_r' });
  m.spawnSummon({ owner: garrok, x: x + 4, y: y - 5, model: 'garrok_wolf', duration: 600 });
  m.spawnSummon({ owner: me, x: x - 5, y: y - 5, model: 'mire_totem', static: true, duration: 600 });
  m.spawnSummon({ owner: lumi, x: x + 1, y: y + 8, model: 'lumi_mark', static: true, duration: 600 });
  m.spawnSummon({ owner: bram, x: x - 2, y: y - 9, model: 'bram_wall', static: true, duration: 600 });
  m.addWall(x + 12, y - 6, 2.2, 600);
  const place = (h, dx, dy) => { if (!h || h === me) return; h.x = h.prevX = x + dx; h.y = h.prevY = y + dy; h.alive = true; h.hp = h.hp || h.maxHp; };
  if (Q.get('gather')) { place(enemies[0], 5, 2); place(enemies[1], -6, 3); place(ally, -3, -3); }
  if (enemies[0]) addStatus(m, enemies[0], 'stun', 600);
  if (enemies[1]) addStatus(m, enemies[1], 'slow', 600, { amount: 0.3 });
  addShield(m, ally, 300, 600);
  if (ally !== me) ally.recalling = { start: m.time, until: m.time + 600 };
}

function lineup() {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100vw;height:100vh;display:block'; document.body.appendChild(canvas);
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true }); gl.setSize(innerWidth, innerHeight, false); gl.setPixelRatio(1);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a3448');
  scene.add(new THREE.HemisphereLight('#dff0ff', '#4a5a3a', 1.9)); const sun = new THREE.DirectionalLight('#fff0d8', 2.6); sun.position.set(-10, 20, 15); scene.add(sun);
  const heroes = (Q.get('heroes') || 'bram,kaela,lumi,vex,nyx,pip,mire,garrok').split(',');
  const rigs = [];
  const nS = 4;
  heroes.forEach((h, i) => {
    const sk = SKINS.filter((s) => s.heroId === h);
    sk.slice(0, nS).forEach((s, j) => { const rig = buildHero(h, s.id); const inner = new THREE.Group(); inner.add(rig.root); inner.position.set((j - (nS - 1) / 2) * 4.2, 0, 0); const g = new THREE.Group(); g.add(inner); g.userData.i = i; g.userData.j = j; scene.add(g); rigs.push({ rig, g, i, j }); });
  });
  const cols = heroes.length > 4 ? 2 : 1, perCol = Math.ceil(heroes.length / cols);
  rigs.forEach(({ g, i }) => { const c = Math.floor(i / perCol), r = i % perCol; g.position.set((c - (cols - 1) / 2) * 19, 0, r * 6.5); });
  const wolf = buildHero('garrok_wolf', 'garrok_default'); const wg = new THREE.Group(); wg.add(wolf.root); wg.position.set(cols > 1 ? 19 / 2 + 9.5 : 9, 0, ((heroes.indexOf('garrok') % perCol) * 6.5) + 1.5); if (heroes.includes('garrok')) scene.add(wg);
  const cam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 500);
  const midZ = (perCol - 1) * 6.5 / 2; cam.position.set(0, 14 + perCol * 2.5, midZ + 22 + perCol * 4); cam.lookAt(0, 1.5, midZ + 1);
  const anim = Q.get('anim') || 'idle';
  let t = 0, last = performance.now();
  function loop(now) { requestAnimationFrame(loop); const dt = (now - last) / 1000; last = now; t += dt; for (const { rig, j } of rigs) poseRig(rig, { state: anim, t: (t * 0.9 + j * 0.2) % 1.2 }, t + j, anim === 'run'); poseRig(wolf, { state: 'idle', t }, t, false); gl.render(scene, cam); }
  requestAnimationFrame(loop);
}

function previews() {
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;gap:8px;padding:8px;height:100vh;box-sizing:border-box';
  document.body.appendChild(wrap);
  const list = [['lumi', 'lumi_celestial'], ['garrok', 'garrok_thunder'], ['pip', 'pip_galactic'], ['nyx', 'nyx_void'], ['bram', 'bram_magmaroot'], ['vex', 'vex_neon'], ['kaela', 'kaela_solar'], ['mire', 'mire_eclipse']];
  for (const [h, s] of list) { const d = document.createElement('div'); d.style.cssText = 'background:radial-gradient(#3a3460,#151225);border-radius:12px;min-height:0'; wrap.appendChild(d); createHeroPreview(d, h, s); }
}
