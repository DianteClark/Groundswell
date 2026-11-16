// Visual testbed for the renderer. URL params:
//   ?mode=game|lineup|preview  &t=<seconds to fast-forward>  &q=low|med|high  &cam=x,y (free camera)  &hero=<index of local player>
//   &inject=1 (spawn showcase summons/areas/projectiles near the local hero)  &zone=ember|flood|gale|stone (trigger living map)
import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { CombatFx } from './fx/combat.js';
import { createHeroPreview, renderHeroPortrait } from './preview.js';
import { buildHero, poseRig } from './models/heroes.js';
import { MinionInstancer, buildMonster, poseMonster, buildSummon } from './models/units.js';
import { SKINS } from '../data/skins.js';
import { Match } from '../sim/match.js';
import { spawnProjectile, spawnArea, addStatus, addShield } from '../sim/combat.js';

const Q = new URLSearchParams(location.search);
const mode = Q.get('mode') || 'game';
document.body.style.cssText = 'margin:0;background:#111;overflow:hidden;font-family:system-ui;color:#fff';
const errs = []; window.__errs = errs; window.addEventListener('error', (e) => errs.push(String(e.message)));

if (mode === 'lineup') lineup();
else if (mode === 'strip') strip();
else if (mode === 'preview') previews();
else if (mode === 'portraits') portraits();
else game();

function game() {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100vw;height:100vh;display:block'; document.body.appendChild(canvas);
  const H = ['bram', 'kaela', 'lumi', 'vex', 'nyx', 'pip', 'mire', 'garrok'];
  const sel = (Q.get('heroes') || 'bram,kaela,lumi,vex,nyx,garrok').split(',');
  const skinIdx = +(Q.get('skin') || 0);
  const players = sel.map((h, i) => {
    const sk = SKINS.filter((s) => s.heroId === h); const s = sk[(skinIdx + i) % sk.length];
    return { id: 'p' + i, team: i < 3 ? 0 : 1, heroId: h, skinId: s.id, isBot: !Q.get('noai'), name: h, lane: ['top', 'bot', 'top'][i % 3], loadout: { items: ['warblade', 'bulwark', 'swiftboots'], relic: 'blink', sigils: { offense: 'piercing', utility: 'swiftness' } } };
  });
  const m = new Match({ seed: +(Q.get('seed') || 3), difficulty: 2, players });
  const pid = 'p' + (Q.get('hero') || 0); m.localPlayerId = pid;
  const T = +(Q.get('t') || 40);
  for (let i = 0; i < T * 30; i++) m.tick();
  const r = new Renderer(canvas);
  if (Q.get('q')) r.setQuality(Q.get('q'));
  r.resize(innerWidth, innerHeight);
  r.setMatch(m, pid);
  if (!r.combatFx) { // until WORLD's hooks land: wrap _event/render
    r.combatFx = new CombatFx(r); const ev0 = r._event.bind(r); r._event = (ev) => { if (r.combatFx.onEvent(ev)) return; ev0(ev); };
    const vu = r.vfx.update.bind(r.vfx); r.vfx.update = (dt) => { r.combatFx.update(dt); vu(dt); };
  }
  window.addEventListener('resize', () => r.resize(innerWidth, innerHeight));
  if (Q.get('cam')) { const [x, y] = Q.get('cam').split(',').map(Number); r.setCameraFollow(false); r.camFree.set(x, 0, y); r.camT.set(x, 0, y); }
  const me = m.heroOf ? m.heroOf(pid) : m.heroes[0];
  if (Q.get('teleport')) { const [x, y] = Q.get('teleport').split(',').map(Number); me.x = me.prevX = x; me.y = me.prevY = y; }
  if (Q.get('inject')) inject(m, me);
  if (Q.get('zone')) { m._livingMap(0, { ember: 'ember', flood: 'tide', gale: 'gale', stone: 'stone' }[Q.get('zone')] || 'ember'); m.eventLog.push(...m.events.map((ev) => ({ tick: m.tickCount, ev }))); r.lastTick = m.tickCount - 1; }
  if (Q.get('nofog')) r.revealAll = true;
  if (Q.get('nocfx')) r.combatFx = null;
  if (Q.get('nokick')) r.kick = () => {};
  if (Q.get('zoom')) r.camDist = +Q.get('zoom');
  if (Q.get('skip')) globalThis.__cfxSkip = Q.get('skip').split(',');
  if (Q.get('noanim')) window.__noanim = true;
  if (Q.get('show')) { // line heroes up in front of the camera (use with &freeze=1)
    const [cx, cy] = (Q.get('show') === '1' ? '100,72' : Q.get('show')).split(',').map(Number);
    m.heroes.forEach((h, i) => { h.x = h.prevX = cx + (i - (m.heroes.length - 1) / 2) * 4.2; h.y = h.prevY = cy + (i % 2) * 1.5; h.facing = Math.PI / 2 + 0.3; h.alive = true; h.hp = h.maxHp * (0.5 + 0.5 * ((i * 37) % 10) / 10); h.anim = { state: 'idle', t: 0 }; h.level = 3 + i; h.recalling = null; h.statuses = []; });
    for (const e of [...m.entities.values()]) if (e.kind === 'minion' || e.kind === 'projectile') m.entities.delete(e.id);
    r.setCameraFollow(false); r.camFree.set(cx, 0, cy); r.camT.set(cx, 0, cy);
  }
  if (Q.get('demo')) {
    const [dx0, dy0] = (Q.get('at') || '100,72').split(',').map(Number); me.level = 9; me.x = me.prevX = dx0; me.y = me.prevY = dy0;
    const en = m.heroes.filter((h) => h.team !== me.team); en.forEach((e, i) => { e.x = e.prevX = dx0 + 7 + i * 1.5; e.y = e.prevY = dy0 + 1 + i * 2; });
    const al = m.heroes.filter((h) => h.team === me.team && h !== me); al.forEach((e, i) => { e.x = e.prevX = dx0 - 3 - i; e.y = e.prevY = dy0 + 3 + i; });
    const slots = (Q.get('slots') || 'q,w,r').split(','); let si = 0;
    setInterval(() => { const t = en.find((e) => e.alive) || en[0]; if (t) { t.hp = t.maxHp; } const ally = al[0]; const slot = slots[si++ % slots.length]; const tgt = /pip/.test(me.heroId) && slot !== 'q' ? ally : t; me.hp = me.maxHp; for (const k in me.abilities) if (me.abilities[k]) { me.abilities[k].readyAt = 0; } m.issue(pid, { type: 'cast', slot, x: tgt.x, y: tgt.y, targetId: tgt.id }); }, +(Q.get('every') || 1600));
  }
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

// ───────── studio scene with a WORLD-like pipeline (env + ACES + bloom) for model/anim review
async function studio(canvas, bg = '#2a3448') {
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true }); gl.setPixelRatio(Math.min(2, devicePixelRatio)); gl.setSize(innerWidth, innerHeight, false);
  gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
  const { buildEnvironment } = await import('./env/sky.js');
  scene.environment = buildEnvironment(gl).texture; scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight('#cfe4ff', '#5a6b44', 1.1));
  const sun = new THREE.DirectionalLight('#ffe4bf', 2.6); sun.position.set(-18, 30, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: Q.get('ground') || '#5f8a4a', roughness: 0.95 })); ground.receiveShadow = true; scene.add(ground);
  const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
  const { OutputPass } = await import('three/examples/jsm/postprocessing/OutputPass.js');
  const cam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 500);
  const comp = new EffectComposer(gl); comp.addPass(new RenderPass(scene, cam));
  comp.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.4, 1.0)); comp.addPass(new OutputPass());
  return { gl, scene, cam, sun, comp, render: () => comp.render() };
}
// drive the animator for T seconds of game time on a rig (deterministic frames for strips)
function simulate(rig, animAt, T, step = 1 / 60) { for (let t = 0; t <= T + 1e-6; t += step) { const a = animAt(t); poseRig(rig, a.anim, t, a.moving); } }
const HEROES_ALL = ['bram', 'kaela', 'lumi', 'vex', 'nyx', 'pip', 'mire', 'garrok'];
function animFor(spec, period = 1.25) {
  // spec: idle | run | attack | cast:q | dead | dash | stun
  return (t) => {
    if (spec === 'run') return { anim: { state: 'run', t }, moving: true };
    if (spec === 'attack') { const k = t % period; return { anim: { state: 'attack', t: k, dur: period }, moving: false }; }
    if (spec.startsWith('cast')) { const k = t % 1.6; return { anim: { state: k < 0.3 ? 'cast' : 'idle', t: k, slot: spec.split(':')[1] }, moving: false }; }
    if (spec === 'dead') return { anim: { state: 'dead', t }, moving: false };
    if (spec === 'dash') return { anim: { state: 'dash', t }, moving: true };
    return { anim: { state: 'idle', t }, moving: false };
  };
}
async function lineup() {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100vw;height:100vh;display:block'; document.body.appendChild(canvas);
  const S = await studio(canvas);
  const heroes = (Q.get('heroes') || HEROES_ALL.join(',')).split(',');
  const nS = +(Q.get('skins') || 1); const anim = Q.get('anim') || 'idle'; const items = [];
  const variant = (h) => (h === 'pip' && Q.get('pilot') ? 'pilot' : undefined);
  heroes.forEach((h, i) => {
    const sk = SKINS.filter((s) => s.heroId === h);
    sk.slice(0, nS).forEach((s, j) => {
      const rig = buildHero(h, s.id, { variant: variant(h) }); const g = new THREE.Group(); g.add(rig.root);
      const cols = nS > 1 ? nS : Math.min(heroes.length, 8); const idx = nS > 1 ? j : i; const row = nS > 1 ? i : 0;
      g.position.set((idx - (cols - 1) / 2) * (+Q.get('gap') || 4.4), 0, row * 6.5); g.rotation.y = +(Q.get('rot') || 0.35);
      S.scene.add(g); items.push({ rig, g, j, s });
    });
  });
  if (Q.get('wolf')) { const w = buildHero('garrok_wolf', 'garrok_default'); const g = new THREE.Group(); g.add(w.root); g.position.set(0, 0, -5); S.scene.add(g); items.push({ rig: w, g, j: 0 }); }
  const mons = [];
  if (Q.get('monsters')) { const list = Q.get('monsters') === '1' ? ['camp_small', 'camp_big', 'wyrm:ember', 'colossus', 'wyrm:tide'] : Q.get('monsters').split(','); list.forEach((m, i) => { const [mt, el] = m.split(':'); const rig = buildMonster(mt, el); const g = new THREE.Group(); g.add(rig.outer || rig.root); g.position.set((i - (list.length - 1) / 2) * (+Q.get('mgap') || 9), 0, 0); g.rotation.y = 0.5; S.scene.add(g); mons.push(rig); }); }
  const poseMons = (t) => { for (const r of mons) { const an = Q.get('anim') || 'idle'; const per = 1.6; poseMonster(r, an === 'attack' ? { state: 'attack', t: t % per, dur: per } : { state: an, t }, t, an === 'run'); } };
  let MI = null; if (Q.get('minions')) MI = new MinionInstancer(S.scene);
  const pushMinions = (t) => { if (!MI) return; MI.begin(); const types = ['minion_melee', 'minion_caster', 'minion_siege']; for (let tm = 0; tm < 2; tm++) types.forEach((ty, k) => { for (let j = 0; j < 2; j++) { const id = tm * 100 + k * 10 + j; const mv = j === 0; const x = (k - 1) * 4 + j * 2 - 1 + (mv ? (t * 3) % 0.001 : 0); MI.push(ty, { x: x + (mv ? Math.sin(t) * 0 : 0) + (mv ? (t * 4) : 0) * 0, z: 4 + tm * 3, rot: 0.4, team: tm, id, moving: mv, state: mv ? 'run' : 'attack', at: (t * 1.0) % 1.0, ground: 0 }); } }); MI.end(); };
  if (MI) { // fake movement for march phase: shift ids' tracked positions each frame
    const orig = MI.push.bind(MI); MI.push = (ty, o) => { if (o.moving) { const tr = MI.track.get(o.id); if (tr) { tr.x -= 0.15; } } orig(ty, o); };
  }
  const rows = nS > 1 ? heroes.length : 1; const midZ = (rows - 1) * 6.5 / 2;
  const camD = +(Q.get('dist') || (nS > 1 ? 30 + rows * 3 : 24)); const pitch = (+(Q.get('pitch') || 40)) * Math.PI / 180;
  S.cam.position.set(0, Math.sin(pitch) * camD + 1.5, midZ + Math.cos(pitch) * camD); S.cam.lookAt(0, 1.8, midZ);
  const A = animFor(anim);
  let t = 0, last = performance.now(); const freeze = Q.get('freeze');
  if (freeze) { for (const it of items) simulate(it.rig, A, +freeze + it.j * 0.0); for (let f = 0; f < 20; f++) pushMinions(+freeze - 0.3 + f * 0.016); poseMons(+freeze); S.render(); window.__ready = true; return; }
  function loop(now) { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; for (const it of items) { const a = A(t + it.j * 0.2); poseRig(it.rig, a.anim, t + it.j * 0.2, a.moving); } pushMinions(t); poseMons(t); S.render(); }
  requestAnimationFrame(loop); window.__ready = true;
  window.__tris = items.map((it) => it.rig.heroId + ':' + it.rig.tris).join(' ');
}
// one hero, an animation sampled at N times side by side (sequence strip)
async function strip() {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100vw;height:100vh;display:block'; document.body.appendChild(canvas);
  const S = await studio(canvas, '#26303f');
  const h = Q.get('hero') || 'kaela'; const sid = Q.get('skin') || h + '_default'; const anims = (Q.get('anims') || 'attack').split(',');
  const times = (Q.get('times') || '0.05,0.15,0.25,0.32,0.4,0.55,0.75').split(',').map(Number);
  const gap = +(Q.get('gap') || 3.6);
  anims.forEach((an, row) => times.forEach((T, i) => {
    const rig = buildHero(h, sid, { variant: h === 'pip' && !Q.get('duo') ? 'pilot' : undefined }); const g = new THREE.Group(); g.add(rig.root);
    g.position.set((i - (times.length - 1) / 2) * gap, 0, row * 6); g.rotation.y = +(Q.get('rot') || 0.6); S.scene.add(g);
    S.scene.updateMatrixWorld(true);
    simulate(rig, animFor(an, +(Q.get('period') || 1.25)), T);
  }));
  const rows = anims.length; const midZ = (rows - 1) * 3; const D = +(Q.get('dist') || 22);
  S.cam.position.set(0, D * 0.45 + 2, midZ + D); S.cam.lookAt(0, 1.8, midZ);
  S.render(); window.__ready = true;
}

function previews() {
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:1fr;gap:8px;padding:8px;height:100vh;box-sizing:border-box';
  document.body.appendChild(wrap);
  const list = [['lumi', 'lumi_celestial'], ['garrok', 'garrok_thunder'], ['pip', 'pip_galactic'], ['nyx', 'nyx_void'], ['bram', 'bram_magmaroot'], ['vex', 'vex_neon'], ['kaela', 'kaela_solar'], ['mire', 'mire_eclipse']];
  for (const [h, s] of list) { const d = document.createElement('div'); d.style.cssText = 'background:radial-gradient(#3a3460,#151225);border-radius:12px;min-height:0'; wrap.appendChild(d); createHeroPreview(d, h, s); }
}

function portraits() {
  const wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:6px;padding:6px'; document.body.appendChild(wrap);
  const t0 = performance.now(); let n = 0;
  for (const s of SKINS) { const img = new Image(); img.src = renderHeroPortrait(s.heroId, s.id, { size: 160, pose: n % 2 ? 'action' : 'idle' }); img.style.cssText = 'width:100%;border-radius:10px'; wrap.appendChild(img); n++; }
  const t1 = performance.now(); renderHeroPortrait('bram', 'bram_default', { size: 160 });
  const info = document.createElement('div'); info.textContent = `${n} portraits in ${(t1 - t0).toFixed(0)}ms (cached re-request ${(performance.now() - t1).toFixed(1)}ms)`; document.body.appendChild(info); console.warn(info.textContent);
}
