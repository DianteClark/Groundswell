// Groundswell renderer: reads sim state, draws the diorama. Interface per SPEC.md.
import * as THREE from 'three';
import { MapView } from './map.js';
import { buildHero, poseRig } from './models/heroes.js';
import { MinionInstancer, buildTower, buildCore, buildMonster, poseMonster, buildSummon, buildRubble, ELEMENT_COLORS } from './models/units.js';
import { G } from './models/builder.js';
import { Vfx, makeBubbleMat } from './vfx.js';
import { Bars } from './bars.js';
import { ZoneFx, TelegraphFx, ZONE_COLORS } from './zones.js';
import { buildProjectile, buildArea, runeTexture } from './projectiles.js';
import { handleAbilityFx } from './abilityfx.js';
import { teamColor, ringTexture, thinRingTexture, glowTexture, makeGlowMat, makeToonMat, clamp, lerp, ease, disposeTree } from './util.js';
import { getSkin } from '../data/skins.js';

const PI = Math.PI;
const PITCH = 55 * PI / 180;
const LOCAL_HP = 0x59d65a, ALLY_HP = 0x4a9dff, ENEMY_HP = 0xff4d5a, NEUTRAL_HP = 0xe8b040;
const has = (e, k) => !!e.statuses && e.statuses.some((s) => s.key === k);
const angLerp = (a, b, t) => { let d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * t; };
const RECALL_STYLES = {
  default: { a: null, b: '#ffffff', p: 'stars' }, petals: { a: '#ff8acb', b: '#fff0f8', p: 'petals' }, eruption: { a: '#ff6a1a', b: '#ffe08a', p: 'embers' },
  flamepillar: { a: '#3fb6ff', b: '#e6f8ff', p: 'bluefire' }, sunburst: { a: '#ffd23a', b: '#ffffff', p: 'sunfire' }, nebula: { a: '#ff5fc8', b: '#6ff7ea', p: 'nebula' },
  galaxy: { a: '#ffe28a', b: '#9ad0ff', p: 'constellation' }, glitch: { a: '#00e8ff', b: '#ff38e0', p: 'pixels' }, dragonfire: { a: '#ff5a1f', b: '#ffd27a', p: 'embers' },
  moonrise: { a: '#8fd8ff', b: '#ffffff', p: 'moonmotes' }, voidrift: { a: '#ff3fd0', b: '#7a3cff', p: 'void' }, snowglobe: { a: '#8ff0ff', b: '#ffffff', p: 'snow' },
  rocket: { a: '#ff6ad5', b: '#7af0ff', p: 'sparks' }, tidepool: { a: '#4fe8d8', b: '#ffb0c8', p: 'bubbles' }, bats: { a: '#a05aff', b: '#ffd06a', p: 'bats' },
  spirits: { a: '#4affc8', b: '#e0fff8', p: 'wisps' }, thunder: { a: '#7fd0ff', b: '#fff27a', p: 'lightning' },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    this.mobile = coarse || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: !this.mobile || this.dpr < 2, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.gl.shadowMap.enabled = true; this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.setClearColor(0x1a2a3a);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#223a4e');
    this.scene.fog = new THREE.Fog('#223a4e', 95, 190);
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 400);
    this.hemi = new THREE.HemisphereLight('#dff0ff', '#4a5a3a', 1.9); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d8', 2.6); this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.camDist = 44; this.follow = true; this.panOff = new THREE.Vector2(); this.camT = new THREE.Vector3(120, 0, 80); this.camFree = new THREE.Vector3(120, 0, 80);
    this.w = canvas.clientWidth || 800; this.h = canvas.clientHeight || 600;
    this.time = 0; this.views = new Map(); this.rubble = []; this.telegraphs = []; this.colorCache = new Map();
    this.perf = { acc: 0, n: 0, scale: 1, t: 0 };
    this.vfx = new Vfx(this.scene, this.mobile ? 'med' : 'high');
    this.bars = new Bars(this.scene);
    this.minions = new MinionInstancer(this.scene);
    this._ray = new THREE.Raycaster(); this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.setQuality(this.mobile ? 'med' : 'high');
    this.resize(this.w, this.h);
  }

  // ───────────────────────── public API ─────────────────────────
  setQuality(q) {
    this.quality = q;
    this.gl.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const ms = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== ms) { this.sun.shadow.mapSize.set(ms, ms); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.gl.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.scene.traverse((o) => { if (o.material) { const ms2 = Array.isArray(o.material) ? o.material : [o.material]; ms2.forEach((m) => { m.needsUpdate = true; }); } });
    this.vfx.setQuality(q); this.mapView?.setQuality?.(q);
    if (this.mapView) this.mapView.decor.visible = q !== 'low';
    this._applyPixelRatio();
  }
  _basePR() { return this.quality === 'low' ? Math.min(this.dpr, 1) : this.quality === 'med' ? Math.min(this.dpr, 1.5) : Math.min(this.dpr, 2); }
  _applyPixelRatio() {
    const pr = Math.max(0.5, this._basePR() * this.perf.scale);
    if (Math.abs(this.gl.getPixelRatio() - pr) > 0.01) { this.gl.setPixelRatio(pr); this.gl.setSize(this.w, this.h, false); }
    this._pointScale();
  }
  _pointScale() { const v = new THREE.Vector2(); this.gl.getDrawingBufferSize(v); this.vfx.setPointScale(v.y / (2 * Math.tan(this.camera.fov * PI / 360))); }
  resize(w, h) {
    this.w = Math.max(1, w | 0); this.h = Math.max(1, h | 0);
    this.gl.setPixelRatio(Math.max(0.5, this._basePR() * this.perf.scale));
    this.gl.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.fov = this.camera.aspect < 1 ? 46 : 38;
    this.camera.updateProjectionMatrix(); this._pointScale();
  }
  focusOn(x, y) { this.follow = false; this.camFree.set(x, 0, y); this.camT.set(x, 0, y); }
  showClickMarker(x, y, kind = 'move') {
    const col = kind === 'attack' ? '#ff4a4a' : '#7dffb0';
    this.vfx.ring(x, y, { color: col, r0: 1.3, r1: 0.25, dur: 0.35, easeIn: true });
    this.vfx.ring(x, y, { color: '#ffffff', r0: 0.9, r1: 0.1, dur: 0.25, easeIn: true, alpha: 0.6 });
    this.vfx.flash(x, 0.4, y, { color: col, size: 1.6, dur: 0.25, alpha: 0.7 });
  }
  /** Ability aiming overlay. o: {slot, heroId, targeting|kind, range, radius, width, x, y, tx, ty, dirX, dirY, cancel} */
  showIndicator(o) { this.ind = { ...o }; this._indGroup(); this.indG.visible = true; }
  hideIndicator() { this.ind = null; if (this.indG) this.indG.visible = false; }
  _indGroup() {
    if (this.indG) return this.indG;
    const g = new THREE.Group(); g.renderOrder = 50;
    const mk = (tex, order) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false })); m.renderOrder = order; g.add(m); return m; };
    this.indRange = mk(thinRingTexture(), 50); this.indCircle = mk(ringTexture(), 51); this.indFill = mk(glowTexture(), 50);
    // skillshot rectangle with chevrons
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const c2 = cv.getContext('2d');
    const gr = c2.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0.45)'); c2.fillStyle = gr; c2.fillRect(0, 0, 64, 256);
    c2.fillStyle = 'rgba(255,255,255,0.9)'; c2.fillRect(0, 0, 4, 256); c2.fillRect(60, 0, 4, 256);
    c2.strokeStyle = 'rgba(255,255,255,0.8)'; c2.lineWidth = 5; for (let y = 20; y < 256; y += 48) { c2.beginPath(); c2.moveTo(12, y + 16); c2.lineTo(32, y); c2.lineTo(52, y + 16); c2.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const rg = new THREE.PlaneGeometry(1, 1); rg.rotateX(-PI / 2); rg.translate(0, 0, -0.5); // extends along -Z; we rotate so -Z points at aim
    this.indRect = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false })); this.indRect.renderOrder = 51; g.add(this.indRect);
    this.scene.add(g); this.indG = g; return g;
  }
  _updIndicator() {
    const o = this.ind; if (!o || !this.indG) return;
    const lh = this._localHero(); const hp = lh ? this._ipos(lh) : { x: o.x ?? 0, z: o.y ?? 0 };
    const targeting = o.kind || o.targeting || (o.tx != null ? 'point' : 'range');
    const range = o.range || 8; const key = (o.heroId || lh?.heroId || '') + '_' + o.slot;
    const radius = o.radius ?? AIM_RADIUS[key] ?? 3; const width = o.width ?? AIM_WIDTH[key] ?? 1.6;
    let dx, dz;
    if (o.tx != null) { dx = o.tx - hp.x; dz = o.ty - hp.z; } else if (o.dirX != null) { dx = o.dirX * range; dz = o.dirY * range; } else { dx = 0; dz = 0; }
    const d = Math.hypot(dx, dz) || 1e-6; const ang = Math.atan2(dz, dx);
    const col = o.cancel ? '#ff4a4a' : '#8fdcff';
    for (const m of [this.indRange, this.indCircle, this.indFill, this.indRect]) { m.material.color.set(col); m.visible = false; }
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 6);
    this.indRange.visible = true; this.indRange.position.set(hp.x, 0.15, hp.z); this.indRange.scale.set(range, 1, range); this.indRange.material.opacity = 0.55;
    if (targeting === 'skillshot') {
      this.indRect.visible = true; this.indRect.position.set(hp.x, 0.16, hp.z); this.indRect.scale.set(width, 1, range); this.indRect.rotation.y = -ang - PI / 2; this.indRect.material.opacity = 0.75 * pulse;
    } else if (targeting === 'point' || targeting === 'area' || targeting === 'unit') {
      const k = Math.min(1, range / d); const ax = hp.x + dx * k, az = hp.z + dz * k;
      const rr = targeting === 'unit' ? 1.6 : targeting === 'point' ? Math.min(radius, 2.2) : radius;
      this.indCircle.visible = true; this.indCircle.position.set(ax, 0.17, az); this.indCircle.scale.set(rr, 1, rr); this.indCircle.material.opacity = 0.9 * pulse;
      this.indFill.visible = true; this.indFill.position.set(ax, 0.16, az); this.indFill.scale.set(rr, 1, rr); this.indFill.material.opacity = 0.3;
      if (o.tx != null) { this.indRect.visible = true; this.indRect.position.set(hp.x, 0.15, hp.z); this.indRect.scale.set(0.35, 1, Math.min(d, range)); this.indRect.rotation.y = -ang - PI / 2; this.indRect.material.opacity = 0.4; }
    } else if (targeting === 'self') {
      this.indCircle.visible = true; this.indCircle.position.set(hp.x, 0.17, hp.z); this.indCircle.scale.set(radius, 1, radius); this.indCircle.material.opacity = 0.9 * pulse;
      this.indFill.visible = true; this.indFill.position.set(hp.x, 0.16, hp.z); this.indFill.scale.set(radius, 1, radius); this.indFill.material.opacity = 0.25;
    }
  }
  setCameraFollow(b) { this.follow = !!b; if (b) this.panOff.set(0, 0); else this.camFree.copy(this.camT); }
  panCamera(dx, dy) {
    if (this.follow) { this.panOff.x = clamp(this.panOff.x + dx, -30, 30); this.panOff.y = clamp(this.panOff.y + dy, -30, 30); }
    else { const W = this.match?.map?.width || 240, H = this.match?.map?.height || 160; this.camFree.x = clamp(this.camFree.x + dx, 0, W); this.camFree.z = clamp(this.camFree.z + dy, 0, H); }
  }
  screenToWorld(sx, sy) {
    const v = new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1);
    this._ray.setFromCamera(v, this.camera); const p = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(this._plane, p)) return { x: this.camT.x, y: this.camT.z };
    return { x: p.x, y: p.z };
  }
  worldToScreen(x, y, h = 0) {
    const p = new THREE.Vector3(x, h, y).project(this.camera);
    return { sx: (p.x + 1) / 2 * this.w, sy: (1 - p.y) / 2 * this.h, visible: p.z < 1 && Math.abs(p.x) <= 1.05 && Math.abs(p.y) <= 1.05 };
  }

  setMatch(match, localPlayerId) {
    this._clearMatch();
    this.match = match; this.localPlayerId = localPlayerId ?? match?.localPlayerId;
    if (!match) return;
    this.mapView = new MapView(match.map || {}, this.quality); this.scene.add(this.mapView.group);
    this.mapView.decor.visible = this.quality !== 'low';
    const lh = this._localHero(); this.localTeam = lh?.team ?? 0;
    this.lastTick = match.tickCount ?? 0;
    if (lh) { this.camT.set(lh.x, 0, lh.y); this.camFree.copy(this.camT); }
    // pre-existing map changes (zones are areas -> handled by sync)
  }
  _clearMatch() {
    for (const v of this.views.values()) this._disposeView(v); this.views.clear();
    for (const r of this.rubble) { this.scene.remove(r); disposeTree(r); } this.rubble = [];
    for (const t of this.telegraphs) t.dispose(); this.telegraphs = [];
    if (this.mapView) { this.scene.remove(this.mapView.group); this.mapView.dispose(); this.mapView = null; }
    this.vfx.clear(); this.colorCache.clear();
  }
  dispose() {
    this._clearMatch(); if (this.indG) { this.scene.remove(this.indG); disposeTree(this.indG); } this.vfx.dispose(); this.bars.dispose(); this.minions.dispose();
    this.gl.dispose(); this.gl.forceContextLoss?.();
  }

  _localHero() {
    const m = this.match; if (!m) return null;
    if (this._lh && this._lh.playerId === this.localPlayerId) return this._lh;
    this._lh = (m.heroOf && m.heroOf(this.localPlayerId)) || (m.heroes || []).find((h) => h.playerId === this.localPlayerId) || null;
    return this._lh;
  }

  // ───────────────────────── colors / skins ─────────────────────────
  _colorsFor(id) {
    if (id == null) return null;
    if (this.colorCache.has(id)) return this.colorCache.get(id);
    const m = this.match; let e = m?.entities?.get(id);
    if (!e) e = (m?.heroes || []).find((h) => h.id === id);
    if (!e) return null;
    if (e.kind !== 'hero' && e.ownerId != null && e.ownerId !== id) { const r = this._colorsFor(e.ownerId); if (r) { this.colorCache.set(id, r); return r; } }
    let res;
    if (e.kind === 'hero') {
      const skin = getSkin(e.heroId, e.visual?.skinId);
      const c = skin?.colors || {};
      res = { vfx: c.vfx || teamColor(e.team), vfx2: c.vfx2 || '#ffffff', fx: skin?.fx || 'sparks', recall: skin?.recall || 'default', trail: skin?.trail, team: e.team, local: e.playerId === this.localPlayerId, hero: e, ranged: !!e.def?.ranged };
    } else {
      const tc = new THREE.Color(teamColor(e.team));
      res = { vfx: '#' + tc.getHexString(), vfx2: '#' + tc.clone().lerp(new THREE.Color(1, 1, 1), 0.6).getHexString(), fx: 'sparks', team: e.team, local: false };
    }
    this.colorCache.set(id, res); return res;
  }
  _int(c) { return c?.local ? 1 : 0.55; }

  // ───────────────────────── main loop ─────────────────────────
  render(alpha = 1, frameDt = 1 / 60) {
    const dt = clamp(frameDt || 0, 0, 0.1); this.time += dt; this.alpha = clamp(alpha, 0, 1);
    const m = this.match;
    if (m) {
      this._events();
      this._sync(dt);
      for (let i = this.telegraphs.length - 1; i >= 0; i--) { const t = this.telegraphs[i]; t.update(dt, this.time, m.time ?? 0, this.vfx); if (t.done) { t.dispose(); this.telegraphs.splice(i, 1); } }
      this.mapView?.update(this.time, dt, m, this.vfx);
    }
    this._camera(dt);
    this._updIndicator();
    this.vfx.update(dt);
    this._perf(dt);
    this.gl.render(this.scene, this.camera);
  }

  _perf(dt) {
    const P = this.perf; P.acc += dt; P.n++; P.t += dt;
    if (P.t < 2) return;
    const avg = P.acc / P.n; P.acc = 0; P.n = 0; P.t = 0;
    if (avg > 1 / 45 && P.scale > 0.6) { P.scale = Math.max(0.6, P.scale - 0.12); this._applyPixelRatio(); }
    else if (avg < 1 / 57 && P.scale < 1) { P.scale = Math.min(1, P.scale + 0.06); this._applyPixelRatio(); }
  }

  _camera(dt) {
    const lh = this._localHero();
    let tx, tz;
    if (this.follow && lh) { const p = this._ipos(lh); tx = p.x + this.panOff.x; tz = p.z + this.panOff.y; }
    else { tx = this.camFree.x; tz = this.camFree.z; }
    const W = this.match?.map?.width || 240, H = this.match?.map?.height || 160;
    tx = clamp(tx, -4, W + 4); tz = clamp(tz, 0, H + 6);
    const k = 1 - Math.exp(-dt * 9);
    this.camT.x = lerp(this.camT.x, tx, k); this.camT.z = lerp(this.camT.z, tz, k);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);
    const sh = (this.shake || 0) * 0.6;
    const D = this.camDist * clamp(0.75 / this.camera.aspect, 1, 1.6);
    this.camera.position.set(this.camT.x + (Math.random() - 0.5) * sh, D * Math.sin(PITCH), this.camT.z + D * Math.cos(PITCH) + (Math.random() - 0.5) * sh);
    this.camera.lookAt(this.camT.x, 0, this.camT.z);
    // light follows view center (texel-snapped)
    const cx = this.camT.x, cz = this.camT.z - 4, snap = 96 / this.sun.shadow.mapSize.x;
    const sx = Math.round(cx / snap) * snap, sz = Math.round(cz / snap) * snap;
    this.sun.position.set(sx - 30, 70, sz + 38); this.sun.target.position.set(sx, 0, sz); this.sun.target.updateMatrixWorld();
  }

  _ipos(e) {
    const a = this.alpha ?? 1; let px = e.prevX ?? e.x, py = e.prevY ?? e.y;
    if (Math.abs(e.x - px) + Math.abs(e.y - py) > 6) { px = e.x; py = e.y; }
    return { x: px + (e.x - px) * a, z: py + (e.y - py) * a };
  }
  _visible(e) {
    if (this.revealAll) return true;
    if (!e.vis) return !(has(e, 'invisible') && e.team !== this.localTeam);
    if (e.team === this.localTeam) return true;
    return e.vis[this.localTeam] !== false;
  }

  // ───────────────────────── events ─────────────────────────
  _events() {
    const m = this.match; const log = m.eventLog;
    if (log && log.length) {
      let i = log.length; while (i > 0 && log[i - 1].tick > this.lastTick) i--;
      const lastT = log[log.length - 1].tick;
      for (let j = i; j < log.length; j++) { try { this._event(log[j].ev); } catch (err) { console.warn('vfx event error', err); } }
      if (lastT > this.lastTick) this.lastTick = lastT;
    } else if (!log && m.events && m.tickCount !== this.lastTick) {
      this.lastTick = m.tickCount;
      for (const ev of m.events) { try { this._event(ev); } catch (err) { console.warn('vfx event error', err); } }
    }
  }
  _ent(id) { if (id == null) return null; const m = this.match; return m.entities.get(id) || (m.heroes || []).find((h) => h.id === id) || this.views.get(id)?.e || null; }
  _isLocalId(id) { const e = this._ent(id); if (!e) return false; if (e.kind === 'hero') return e.playerId === this.localPlayerId; const o = e.ownerId != null ? this._ent(e.ownerId) : null; return !!o && o.kind === 'hero' && o.playerId === this.localPlayerId; }
  _evVisible(x, y) { // cull events far from camera
    return Math.abs(x - this.camT.x) < 60 && Math.abs(y - this.camT.z) < 50;
  }
  _event(ev) {
    const V = this.vfx;
    switch (ev.t) {
      case 'damage': {
        const t = this._ent(ev.targetId); if (!t) return;
        const v = this.views.get(ev.targetId); if (v) { v.flash = 1; }
        const fromLocal = this._isLocalId(ev.srcId), toLocal = this._isLocalId(ev.targetId);
        const p = this._ipos(t); const h = (v?.height ?? 2) + 0.4;
        if (fromLocal && ev.amount >= 1) V.text(String(Math.round(ev.amount)), p.x, h, p.z, { color: ev.crit ? '#ffb02e' : '#ffffff', big: !!ev.crit, scale: ev.crit ? 1.1 : 0.8 });
        else if (toLocal && ev.amount >= 1) V.text(String(Math.round(ev.amount)), p.x + 0.8, h - 0.4, p.z, { color: '#ff5a5a', scale: 0.7, dur: 0.8 });
        const src = this._colorsFor(ev.srcId);
        if (src && this._evVisible(p.x, p.z) && this._visible(t)) V.burst(p.x, Math.min(h - 0.6, 1.6), p.z, src.vfx, ev.ability ? 6 : 3, { style: 'sparks', intensity: this._int(src) + (fromLocal ? 0.3 : 0), size: 0.8, color1: src.vfx2 });
        break;
      }
      case 'heal': {
        const t = this._ent(ev.targetId); if (!t) return; const p = this._ipos(t);
        if ((this._isLocalId(ev.targetId) || this._isLocalId(ev.srcId)) && ev.amount >= 8) V.text('+' + Math.round(ev.amount), p.x - 0.8, 3.2, p.z, { color: '#6dff8a', scale: 0.75, dur: 0.9 });
        if (ev.amount >= 20 && this._evVisible(p.x, p.z) && this._visible(t)) V.burst(p.x, 0.5, p.z, '#7dff9a', 4, { style: 'embers', radius: 0.8, intensity: 0.7 });
        break;
      }
      case 'attack': {
        const s = this._ent(ev.srcId), t = this._ent(ev.targetId); const v = this.views.get(ev.srcId); if (v) v.atk = (v.atk || 0) + 1;
        if (!s || !t || !this._visible(s) || !this._evVisible(s.x, s.y)) return;
        const c = this._colorsFor(ev.srcId);
        if (s.kind === 'hero' && !s.def?.ranged) {
          const ang = Math.atan2(t.y - s.y, t.x - s.x); const p = this._ipos(s);
          this._later(0.12, () => { V.slash(p.x + Math.cos(ang) * 1.0, 1.3, p.z + Math.sin(ang) * 1.0, ang, { color: c.vfx, r: 2.0 + (s.radius || 1) * 0.5, flip: v && v.atk % 2, alpha: 0.6 + 0.4 * this._int(c) }); });
        } else if (s.kind === 'tower') { const p = this._ipos(s); V.flash(p.x, 6.4, p.z, { color: teamColor(s.team), size: 5, dur: 0.3 }); }
        break;
      }
      case 'cast': {
        const s = this._ent(ev.srcId); if (!s || !this._visible(s)) return; const c = this._colorsFor(ev.srcId); const p = this._ipos(s);
        if (!this._evVisible(p.x, p.z)) return; const I = this._int(c);
        V.ring(p.x, p.z, { color: c.vfx, r0: 0.5, r1: 3.2, dur: 0.4, alpha: 0.5 + 0.5 * I });
        V.flash(p.x, 1.6, p.z, { color: c.vfx, size: 3.5, dur: 0.3, alpha: 0.6 * I + 0.3 });
        V.burst(p.x, 1.4, p.z, c.vfx, ev.slot === 'r' ? 26 : 12, { style: c.fx, intensity: I, color1: c.vfx2, radius: 0.6 });
        if (ev.slot === 'r') { V.pillar(p.x, p.z, { color: c.vfx, r: 1.8, h: 7, dur: 0.6, alpha: 0.5 * I + 0.3 }); V.ring(p.x, p.z, { color: c.vfx2, r0: 1, r1: 6, dur: 0.6 }); }
        if (ev.slot === 'relic' && ev.tx != null) { V.flash(ev.tx, 1.2, ev.ty, { color: c.vfx2, size: 3, dur: 0.35 }); V.burst(ev.tx, 1, ev.ty, c.vfx, 10, { style: c.fx, intensity: I }); }
        break;
      }
      case 'vfx': this._vfxEvent(ev); break;
      case 'levelup': {
        const h = this._ent(ev.id); if (!h || !this._visible(h)) return; const p = this._ipos(h); const loc = this._isLocalId(ev.id);
        V.pillar(p.x, p.z, { color: '#ffd84a', r: 1.4, h: 7, dur: 0.8, alpha: loc ? 0.8 : 0.4 });
        V.ring(p.x, p.z, { color: '#ffe9a0', r0: 0.5, r1: 4.5, dur: 0.6 });
        V.burst(p.x, 0.5, p.z, '#ffe27a', loc ? 26 : 12, { style: 'stars', up: 3, radius: 1.2, color1: '#fff6c8' });
        if (loc) V.text('LEVEL UP', p.x, 4.6, p.z, { color: '#ffe27a', big: true, dur: 1.4, scale: 0.9 });
        break;
      }
      case 'gold': {
        if (!this._isLocalId(ev.id) || !(ev.amount >= 10)) return; const h = this._ent(ev.id); if (!h) return;
        // only show bounties/last-hits (passive income is tiny & frequent)
        const p = this._ipos(h); V.text('+' + Math.round(ev.amount), p.x + 1.6, 1.8, p.z, { color: '#ffd23a', scale: 0.85, dur: 1.1 });
        V.burst(p.x + 0.8, 2.8, p.z, '#ffd23a', 4, { style: 'sparks', size: 0.6, intensity: 1 });
        break;
      }
      case 'death': this._deathFx(ev); break;
      case 'kill': {
        const vctm = this._ent(ev.victimId); if (!vctm) return; const p = this._ipos(vctm);
        const k = this._ent(ev.killerId); const col = teamColor(k?.team ?? ev.team ?? 2);
        V.pillar(p.x, p.z, { color: col, r: 2.2, h: 14, dur: 1.0 }); V.ring(p.x, p.z, { color: col, r0: 1, r1: 8, dur: 0.8 });
        if (this._isLocalId(ev.killerId)) { this.shake = 0.6; V.ring(p.x, p.z, { color: '#ffd23a', r0: 1, r1: 10, dur: 1.0 }); }
        break;
      }
      case 'objective': {
        const col = teamColor(ev.team ?? 2); const pits = this.match.map?.pits || {};
        let pos = ev.key === 'wyrm' ? pits.wyrm : ev.key === 'colossus' ? pits.colossus : null;
        if (ev.key === 'core') { const core = [...this.views.values()].find((v) => v.kind === 'core' && v.e.team !== ev.team); if (core) pos = { x: core.e.x, y: core.e.y }; }
        if (!pos) return;
        const ec = ev.element ? ELEMENT_COLORS[ev.element] : col;
        V.pillar(pos.x, pos.y, { color: col, r: 4, h: 28, dur: 1.6 }); V.pillar(pos.x, pos.y, { color: ec, r: 2.4, h: 20, dur: 1.2 });
        V.ring(pos.x, pos.y, { color: col, r0: 2, r1: 22, dur: 1.2 }); V.ring(pos.x, pos.y, { color: ec, r0: 1, r1: 14, dur: 0.9 });
        V.burst(pos.x, 1, pos.y, ec, 60, { style: 'stars', up: 4, speed: 2, radius: 4, color1: col });
        if (this._evVisible(pos.x, pos.y)) this.shake = 1;
        if (ev.key === 'core') { V.burst(pos.x, 4, pos.y, col, 140, { style: 'sparks', speed: 4, up: 4, size: 2, life: 2 }); this.shake = 2; }
        break;
      }
      case 'mapchange': {
        const z = ev.zone; if (!z) return;
        const phase = ev.phase || (ev.at != null && ev.at > (this.match.time ?? 0) ? 'telegraph' : 'apply');
        if (this._evVisible(z.x, z.y)) this.shake = Math.max(this.shake || 0, phase === 'telegraph' ? 0.25 : 1.1);
        if (phase === 'telegraph') { const t = new TelegraphFx(ev.kind, z.x, z.y, z.r, ev.at ?? (this.match.time + 5), ev.team ?? 2); this.scene.add(t.group); this.telegraphs.push(t); }
        else {
          for (const t of this.telegraphs) t.done = true;
          const col = ZONE_COLORS[ev.kind] || '#ffffff';
          V.ring(z.x, z.y, { color: col, r0: 2, r1: z.r * 1.2, dur: 1.0 }); V.burst(z.x, 0.5, z.y, col, 60, { style: ev.kind === 'ember' ? 'embers' : ev.kind === 'flood' ? 'bubbles' : 'dust', radius: z.r, up: 2 });
          if (!this.match.entities || ![...this.match.entities.values()].some((e) => e.kind === 'area' && /^zone_/.test(e.visual?.model || ''))) this._ensureZone(ev);
        }
        break;
      }
      case 'respawn': { const h = this._ent(ev.id); if (!h) return; const p = { x: h.x, z: h.y }; const c = this._colorsFor(ev.id); V.pillar(p.x, p.z, { color: c?.vfx || '#ffffff', r: 1.6, h: 10, dur: 0.8 }); V.burst(p.x, 0.5, p.z, c?.vfx || '#fff', 20, { style: c?.fx || 'stars', up: 3, radius: 1 }); break; }
      case 'recall_done': { const h = this._ent(ev.id); if (!h) return; const c = this._colorsFor(ev.id); const st = RECALL_STYLES[c?.recall] || RECALL_STYLES.default; const a = st.a || c?.vfx || teamColor(h.team);
        V.pillar(h.x, h.y, { color: a, r: 2, h: 14, dur: 0.9 }); V.ring(h.x, h.y, { color: st.b, r0: 0.5, r1: 5, dur: 0.6 }); V.burst(h.x, 0.6, h.y, a, 30, { style: st.p, up: 3, radius: 1.5, color1: st.b });
        const v = this.views.get(ev.id); if (v?.recallFx) { const o = v.recallFx.origin; if (o) { V.pillar(o.x, o.z, { color: a, r: 1.6, h: 16, dur: 0.6 }); V.flash(o.x, 2, o.z, { color: st.b, size: 7, dur: 0.4 }); } }
        break; }
      case 'recall_cancel': { const h = this._ent(ev.id); if (!h) return; V.burst(h.x, 1, h.y, '#aaaaaa', 8, { style: 'dust' }); break; }
      case 'shield': { const id = ev.targetId ?? ev.id; const h = this._ent(id); if (!h || !this._visible(h)) return; const c = this._colorsFor(ev.srcId ?? id); const p = this._ipos(h); V.bubble(p.x, 1.4, p.z, { color: c?.vfx || '#ffffff', r: (h.radius || 1.2) * 1.6, dur: 0.35 }); break; }
      case 'miss': { if (!this._isLocalId(ev.srcId) && !this._isLocalId(ev.targetId)) return; const t = this._ent(ev.targetId); if (!t) return; const p = this._ipos(t); V.text('Miss', p.x, 3, p.z, { color: '#c8c8d8', scale: 0.7, dur: 0.8 }); break; }
      case 'spawn': {
        const e = this._ent(ev.id); if (!e || e.kind !== 'summon') return; if (!this._evVisible(e.x, e.y) || !this._visible(e)) return; const c = this._colorsFor(ev.id);
        V.ring(e.x, e.y, { color: c?.vfx || '#fff', r0: 0.5, r1: 3, dur: 0.4 }); V.burst(e.x, 0.5, e.y, c?.vfx || '#fff', e.wall ? 6 : 12, { style: e.wall ? 'dust' : c?.fx || 'sparks', radius: e.radius || 1 }); break;
      }
      case 'status': {
        if (ev.key === 'stun' || ev.key === 'root') { const e = this._ent(ev.id ?? ev.targetId); if (!e || !this._visible(e)) return; const p = this._ipos(e); V.ring(p.x, p.z, { color: ev.key === 'stun' ? '#ffe066' : '#7adc4a', r0: 0.5, r1: 2.2, dur: 0.3 }); }
        break;
      }
      default: break;
    }
  }
  _later(delay, fn) { this.vfx._run(new THREE.Object3D(), delay, (e, k) => { if (k >= 1 && !e.fired) { e.fired = true; fn(); } }); }

  _vfxEvent(ev) {
    const V = this.vfx; const key = ev.key || '';
    if (!this._evVisible(ev.x ?? this.camT.x, ev.y ?? this.camT.z)) return;
    if (key === 'wyrm_breath' || key.startsWith('wyrm')) {
      const col = ELEMENT_COLORS[ev.element] || ELEMENT_COLORS.none; const ang = Math.atan2((ev.ty ?? ev.y) - ev.y, (ev.tx ?? ev.x) - ev.x);
      const len = Math.hypot((ev.tx ?? ev.x) - ev.x, (ev.ty ?? ev.y) - ev.y);
      V.cone(ev.x, ev.y, ang, { color: col, r: len + 2, dur: 0.6 });
      for (let i = 0; i < 26 * V.density; i++) { const t = Math.random(); const sp = (Math.random() - 0.5) * 0.6; V.add.emit({ x: ev.x, y: 3, z: ev.y, vx: Math.cos(ang + sp) * len * 1.8 * (0.6 + t), vy: -2, vz: Math.sin(ang + sp) * len * 1.8 * (0.6 + t), life: 0.55, size: 1.6, size1: 2.8, color: col, color1: '#ffffff', alpha: 0.8, drag: 2.5 }); }
      if (ev.tx != null) { V.ring(ev.tx, ev.ty, { color: col, r0: 0.5, r1: ev.radius || 3.5, dur: 0.5 }); V.burst(ev.tx, 0.5, ev.ty, col, 20, { style: ev.element === 'stone' ? 'dust' : ev.element === 'tide' ? 'bubbles' : 'embers', radius: ev.radius || 3 }); }
      return;
    }
    if (key === 'colossus_slam') {
      const r = ev.radius || 4.5; V.ring(ev.x, ev.y, { color: '#c07aff', r0: 1, r1: r * 1.4, dur: 0.6 }); V.ring(ev.x, ev.y, { color: '#ffffff', r0: 0.5, r1: r, dur: 0.4 });
      V.burst(ev.x, 0.3, ev.y, '#8a7a6a', 26, { style: 'dust', radius: r, up: 2 }); V.burst(ev.x, 0.5, ev.y, '#c07aff', 20, { style: 'sparks', radius: r * 0.5, up: 3 }); this.shake = Math.max(this.shake || 0, 0.7); return;
    }
    const c = this._colorsFor(ev.srcId) || { vfx: teamColor(ev.team ?? 2), vfx2: '#ffffff', fx: 'sparks', local: false };
    const I = this._int(c);
    if (handleAbilityFx(this, ev, c, I)) return;
    // multi-point (e.g. constellation): connect the dots
    if (Array.isArray(ev.points) && ev.points.length > 1) {
      const pts = ev.points; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if (i === pts.length - 1 && pts.length < 3) break; V.beam(a.x, 1.0, a.y, b.x, 1.0, b.y, { color: c.vfx, width: key.endsWith('_hit') ? 0.4 : 0.15, dur: key.endsWith('_hit') ? 0.35 : (ev.duration || 0.5) }); V.flash(a.x, 1.0, a.y, { color: c.vfx2, size: 2, dur: 0.4 }); }
      if (key.endsWith('_hit')) V.burst(ev.x, 1, ev.y, c.vfx, 20, { style: c.fx, radius: 3, intensity: I, color1: c.vfx2 });
      return;
    }
    // teleports / swaps: flash both ends, no beam
    if (/blink|swap|flash|teleport/.test(key) && ev.tx != null) {
      for (const [px, py] of [[ev.x, ev.y], [ev.tx, ev.ty]]) { V.flash(px, 1.3, py, { color: c.vfx, size: 4, dur: 0.35 }); V.ring(px, py, { color: c.vfx2, r0: 0.4, r1: 2.6, dur: 0.35 }); V.burst(px, 1, py, c.vfx, 12, { style: c.fx, intensity: I + 0.2, color1: c.vfx2 }); }
      return;
    }
    // aim / charge lines (laser sight)
    if (/charge|aim/.test(key) && ev.tx != null) { V.beam(ev.x, 1.4, ev.y, ev.tx, 1.4, ev.ty, { color: c.vfx, width: 0.06, dur: Math.max(0.3, ev.duration || 0.6), alpha: 0.9 }); V.flash(ev.x, 1.6, ev.y, { color: c.vfx, size: 2.5, dur: ev.duration || 0.6 }); return; }
    // persistent aura on a unit (buffs, marks, channels)
    if (ev.targetId != null && ev.duration && !key.endsWith('_hit') && ev.tx == null) {
      const tid = ev.targetId; const dur = Math.min(6, ev.duration); const rr = (this._ent(tid)?.radius || 1.2) * 1.8; const ring = V._get('ring'); if (ring.material.map !== ringTexture()) { ring.material.map = ringTexture(); ring.material.needsUpdate = true; } ring.material.color.set(c.vfx);
      V._run(ring, dur, (e, k) => { const t = this._ent(tid); if (!t || t.alive === false) { e.t = e.dur; return; } const p = this._ipos(t); ring.position.set(p.x, 0.12, p.z); const pulse = 1 + 0.08 * Math.sin(this.time * 8); ring.scale.set(rr * 2 * pulse, 1, rr * 2 * pulse); ring.material.opacity = (k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1) * (0.5 + 0.4 * I);
        if (Math.random() < 0.35) V.trail(p.x + (Math.random() - 0.5) * rr, 0.3 + Math.random() * 1.5, p.z + (Math.random() - 0.5) * rr, c.vfx, { style: c.fx, vy: 1.2, life: 0.6, size: 0.5, color1: c.vfx2 }); });
      V.flash(ev.x, 1.4, ev.y, { color: c.vfx, size: 3, dur: 0.3 });
      return;
    }
    // delayed ground strike: telegraph circle that fills over the duration
    if (ev.radius && ev.duration && ev.tx == null && !key.endsWith('_hit') && !key.endsWith('_end')) {
      const R = ev.radius, dur = Math.min(4, ev.duration);
      V.ring(ev.x, ev.y, { color: c.vfx, r0: R, r1: R, dur, hold: true, alpha: 0.85 });
      V.ring(ev.x, ev.y, { color: c.vfx2, r0: 0.2, r1: R, dur, easeIn: true, alpha: 0.6 });
      V.disc(ev.x, ev.y, { color: c.vfx, r: R, dur, alpha: 0.25 });
      return;
    }
    if (key.endsWith('_hit')) { V.flash(ev.x, 1.2, ev.y, { color: c.vfx, size: 3, dur: 0.2 }); V.burst(ev.x, 1.2, ev.y, c.vfx, 10, { style: c.fx, intensity: I + 0.2, color1: c.vfx2 }); if (ev.radius) V.ring(ev.x, ev.y, { color: c.vfx, r0: 0.3, r1: ev.radius, dur: 0.35 }); return; }
    if (ev.tx != null && ev.ty != null) {
      const dx = ev.tx - ev.x, dy = ev.ty - ev.y, len = Math.hypot(dx, dy);
      const big = /_r$/.test(key);
      V.beam(ev.x, 1.3, ev.y, ev.tx, 1.3, ev.ty, { color: c.vfx, width: big ? 1.1 : ev.radius ? Math.min(1.2, ev.radius * 0.4) : 0.35, dur: ev.duration ? Math.min(0.6, ev.duration) : 0.25, alpha: 0.6 + 0.4 * I });
      V.beam(ev.x, 1.3, ev.y, ev.tx, 1.3, ev.ty, { color: c.vfx2, width: 0.1, dur: 0.18 });
      const n = Math.min(30, Math.round(len * 1.5));
      for (let i = 0; i < n; i++) { const t = i / n; V.burst(ev.x + dx * t, 1.2, ev.y + dy * t, c.vfx, 0.6, { style: c.fx, intensity: I, color1: c.vfx2, speed: 0.4 }); }
      V.flash(ev.tx, 1.2, ev.ty, { color: c.vfx, size: 2.5, dur: 0.25 });
      return;
    }
    if (ev.radius) {
      V.ring(ev.x, ev.y, { color: c.vfx, r0: ev.radius * 0.2, r1: ev.radius, dur: 0.45, alpha: 0.6 + 0.4 * I });
      V.disc(ev.x, ev.y, { color: c.vfx, r: ev.radius, dur: 0.45, alpha: 0.5 });
      V.burst(ev.x, 0.6, ev.y, c.vfx, 10 + ev.radius * 4, { style: c.fx, radius: ev.radius * 0.8, intensity: I, color1: c.vfx2 });
      return;
    }
    V.flash(ev.x, 1.4, ev.y, { color: c.vfx, size: 3, dur: 0.3 }); V.burst(ev.x, 1.2, ev.y, c.vfx, 12, { style: c.fx, intensity: I, color1: c.vfx2 });
  }

  _deathFx(ev) {
    const V = this.vfx; const e = this._ent(ev.id); if (!e) return; const v = this.views.get(ev.id);
    const p = this._ipos(e); if (!this._evVisible(p.x, p.z)) return;
    const tc = teamColor(e.team);
    if (e.kind === 'hero') {
      V.burst(p.x, 1.2, p.z, tc, 30, { style: 'wisps', up: 3, radius: 0.8 }); V.ring(p.x, p.z, { color: tc, r0: 0.5, r1: 5, dur: 0.6 });
      V.flash(p.x, 1.5, p.z, { color: '#ffffff', size: 5, dur: 0.3 });
      for (let i = 0; i < 3; i++) V.add.emit({ x: p.x, y: 1.5, z: p.z, vy: 3 + i, life: 1.8, size: 1.2, size1: 0.3, color: tc, color1: '#ffffff', alpha: 0.9, drag: 0.5, swirl: [p.x, p.z, 3] });
    } else if (e.kind === 'minion') { V.burst(p.x, 0.6, p.z, '#cfc6b4', 6, { style: 'dust', size: 0.8 }); V.burst(p.x, 1, p.z, tc, 6, { style: 'sparks', size: 0.6 }); }
    else if (e.kind === 'monster') { V.burst(p.x, 1, p.z, '#cfc6b4', 14, { style: 'dust', radius: e.radius || 1 }); V.burst(p.x, 1.5, p.z, '#ffd23a', 14, { style: 'stars', up: 3 }); }
    else if (e.kind === 'tower' || e.kind === 'core') { V.burst(p.x, 3, p.z, '#b8b0a2', 50, { style: 'dust', radius: 3, up: 3, size: 1.8 }); V.burst(p.x, 6, p.z, tc, 40, { style: 'sparks', speed: 2, up: 3, size: 1.4 }); V.ring(p.x, p.z, { color: tc, r0: 2, r1: 14, dur: 0.9 }); this.shake = Math.max(this.shake || 0, 1.2); }
    else if (e.kind === 'summon') { V.burst(p.x, 0.8, p.z, e.wall ? '#a8a29a' : (this._colorsFor(ev.id)?.vfx || tc), 10, { style: e.wall ? 'dust' : 'sparks', radius: e.radius || 1 }); }
  }
  _ensureZone(ev) { /* zone visuals are driven by 'area' entities with visual.model zone_*; fallback when absent */
    const z = ev.zone; const key = 'mapzone'; const old = this.views.get(key); if (old) this._disposeView(old);
    const fx = new ZoneFx(ev.kind, z.x, z.y, z.r, ev.team ?? 2); fx.attach(this.scene);
    this.views.set(key, { kind: 'zonefallback', zone: fx, e: { id: key }, persistent: true });
  }

  // ───────────────────────── entity sync ─────────────────────────
  _sync(dt) {
    const m = this.match; const seen = this._seen || (this._seen = new Set()); seen.clear();
    this.minions.begin(); this.bars.begin(this.camera);
    const lh = this._localHero();
    const handle = (e) => { if (seen.has(e.id)) return; seen.add(e.id); let v = this.views.get(e.id); if (!v) { v = this._makeView(e); if (!v) return; this.views.set(e.id, v); } v.e = e; this._updateView(v, e, dt, lh); };
    for (const e of m.entities.values()) handle(e);
    if (m.heroes) for (const h of m.heroes) handle(h);
    for (const [id, v] of this.views) {
      if (seen.has(id) || v.persistent) { if (v.kind === 'zonefallback') v.zone.update(dt, this.time, this.vfx); continue; }
      if (v.kind === 'tower' || v.kind === 'core') { this._toRubble(v); this._disposeView(v); this.views.delete(id); continue; }
      // removed entity: short fade for non-minions
      v.gone = (v.gone || 0) + dt;
      if (v.kind === 'minion' || v.kind === 'projectile' || v.gone > 0.4 || !v.group) { this._disposeView(v); this.views.delete(id); }
      else { v.group.scale.multiplyScalar(0.85); }
    }
    this.minions.end(); this.bars.end();
  }

  _makeView(e) {
    const model = e.visual?.model || '';
    switch (e.kind) {
      case 'hero': return this._makeHero(e);
      case 'minion': return { kind: 'minion', type: model || 'minion_' + (e.minionType || 'melee'), rot: PI / 2 - (e.facing || 0), flash: 0, lag: e.hp, height: model === 'minion_siege' ? 2.0 : 1.9 };
      case 'tower': { const rig = buildTower(e.team); const g = new THREE.Group(); g.add(rig.root); this.scene.add(g); return { kind: 'tower', group: g, rig, height: 8.6, flash: 0, lag: e.hp }; }
      case 'core': { const rig = buildCore(e.team); const g = new THREE.Group(); g.add(rig.root); this.scene.add(g); return { kind: 'core', group: g, rig, height: 11, flash: 0, lag: e.hp }; }
      case 'monster': {
        const mt = e.monsterType || model; const el = e.element ?? e.visual?.element;
        const rig = buildMonster(mt, el); const g = new THREE.Group(); g.add(rig.outer || rig.root); this.scene.add(g);
        const ring = this._ringDecal(mt === 'wyrm' ? ELEMENT_COLORS[el] || '#e8b040' : '#e8b040', (e.radius || 1.4) * 1.3, 0.35); g.add(ring);
        return { kind: 'monster', group: g, rig, height: rig.def.height, flash: 0, lag: e.hp, rot: PI / 2 - (e.facing || 0), ring, epic: mt === 'wyrm' || mt === 'colossus', element: el };
      }
      case 'projectile': {
        const c = this._colorsFor(e.ownerId ?? e.srcId) || { vfx: teamColor(e.team), vfx2: '#ffffff', fx: 'sparks' };
        const isTeam = model === 'tower_shot' || model === 'caster_shot' || model === 'siege_shot';
        const col = isTeam ? teamColor(e.team) : model.startsWith('wyrm') ? (ELEMENT_COLORS[this._ent(e.srcId)?.element] || '#ff6a2a') : c.vfx;
        const P = buildProjectile(model, col, isTeam ? '#ffffff' : c.vfx2);
        this.scene.add(P.group);
        const src = this._ent(e.srcId); const h0 = src?.kind === 'tower' ? 6.4 : src?.kind === 'monster' ? 3 : src?.kind === 'minion' ? 1.4 : 1.6;
        const tr = P.trail; if (!isTeam && c.fx && P.style !== 'bolt') tr.style = tr.style || c.fx;
        return { kind: 'projectile', group: P.group, P, color: col, color2: isTeam ? '#ffffff' : c.vfx2, y: h0, born: this.time, I: isTeam ? 0.7 : this._int(c) };
      }
      case 'area': {
        if (model === 'mire_r' || /swamp/.test(model)) { const fx = new ZoneFx('swamp', e.x, e.y, e.radius || 13, e.team ?? 2); fx.attach(this.scene); return { kind: 'zone', zone: fx }; }
        if (/^zone_/.test(model)) { const kind = model.slice(5); const fx = new ZoneFx(kind, e.x, e.y, e.radius || 18, e.team ?? 2); fx.attach(this.scene); const fb = this.views.get('mapzone'); if (fb) { this._disposeView(fb); this.views.delete('mapzone'); } return { kind: 'zone', zone: fx }; }
        const c = this._colorsFor(e.ownerId ?? e.srcId) || { vfx: teamColor(e.team), vfx2: '#ffffff', fx: 'sparks' };
        const A = buildArea(model, e.radius || 3, c.vfx, c.vfx2); this.scene.add(A.group);
        const subtle = /aura/.test(model);
        if (subtle) { A.fill.visible = false; A.rune.visible = false; }
        let dome = null;
        if (model === 'nyx_r' || /dome/.test(model)) { dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 12, 0, PI * 2, 0, PI / 2), makeBubbleMat(c.vfx)); dome.renderOrder = 16; this.scene.add(dome); const dark = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#0a0612', transparent: true, opacity: 0.45, depthWrite: false })); dark.position.y = 0.1; dark.renderOrder = 4; A.group.add(dark); }
        return { kind: 'area', group: A.group, A, c, born: this.time, I: this._int(c), subtle, dome };
      }
      case 'summon': {
        if ((e.wall || model === 'wall') && model !== 'bram_wall') { const g = this._buildWall(e); this.scene.add(g); return { kind: 'wall', group: g, born: this.time, height: 3 }; }
        const owner = e.ownerId != null ? this._ent(e.ownerId) : null; const sk = owner?.kind === 'hero' ? getSkin(owner.heroId, owner.visual?.skinId) : null;
        if (model === 'pip_bolt' || /_mech$/.test(model)) {
          const rig = buildHero('pip', owner?.visual?.skinId || e.visual?.skinId || 'pip_default', { variant: 'mech' }); const g = new THREE.Group(); g.add(rig.root); this.scene.add(g); rig.root.scale.setScalar(1.05);
          const ring = this._ringDecal(teamColor(e.team), 1.7, 0.6); g.add(ring);
          return { kind: 'summon', group: g, rig, height: 2.6, flash: 0, lag: e.hp, rot: PI / 2 - (e.facing || 0), ring, born: this.time, wolf: true, bolt: true };
        }
        if (/afterimage|clone|decoy/.test(model) && owner?.kind === 'hero') {
          const rig = buildHero(owner.heroId, owner.visual?.skinId); const g = new THREE.Group(); g.add(rig.root); this.scene.add(g); rig.root.scale.setScalar(1.08);
          for (const mm of [rig.mat, rig.glowMat]) { mm.transparent = true; mm.opacity = 0.45; mm.depthWrite = false; } rig.mat.userData.u.rimStrength.value = 1.6; rig.mat.userData.u.rimColor.value.set(sk?.colors?.vfx || '#ffffff');
          return { kind: 'summon', group: g, rig, height: rig.def.height, flash: 0, lag: e.hp, rot: PI / 2 - (e.facing || 0), born: this.time, wolf: true, ghost: true };
        }
        const rig = buildSummon(model, e.team, sk?.colors, e.visual?.skinId || owner?.visual?.skinId); const g = new THREE.Group(); g.add(rig.root); this.scene.add(g);
        const ring = e.wall ? null : this._ringDecal(teamColor(e.team), (e.radius || 1) * 1.4, 0.5); if (ring) g.add(ring);
        if (model === 'bram_wall') rig.root.scale.setScalar((e.radius || 1.45) / 1.45);
        return { kind: 'summon', group: g, rig, height: rig.def?.height || 2, flash: 0, lag: e.hp, rot: PI / 2 - (e.facing || 0), ring, born: this.time, wolf: !!rig.isWolf };
      }
      default: return null;
    }
  }
  _ringDecal(color, r, opacity = 0.8) {
    const geo = this._ringGeo || (this._ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-PI / 2)); geo.userData.shared = true;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: ringTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.scale.set(r, 1, r); m.position.y = 0.06; m.renderOrder = 7; return m;
  }
  _buildWall(e) {
    const g = new THREE.Group(); const r = e.radius || 1.5;
    const geo = G.dodec(1); const mat = makeToonMat({ vertexColors: false, color: '#9a9488', rimStrength: 0.25 });
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(geo, mat); const a = i * 1.9; const s = r * (i ? 0.55 : 0.9); m.position.set(Math.cos(a) * r * 0.4 * (i ? 1 : 0), s * 0.8, Math.sin(a) * r * 0.4 * (i ? 1 : 0)); m.scale.set(s, s * 1.8, s); m.rotation.set(i, i * 2, 0); m.castShadow = true; g.add(m); }
    g.position.set(e.x, 0, e.y); return g;
  }
  _makeHero(e) {
    const hid = e.heroId || e.visual?.model; const rig = buildHero(hid, e.visual?.skinId, { variant: hid === 'pip' ? 'pilot' : undefined });
    const g = new THREE.Group(); g.add(rig.root); this.scene.add(g);
    const isLocal = e.playerId === this.localPlayerId;
    const ring = this._ringDecal(teamColor(e.team), (e.radius || 1.2) * 1.55, isLocal ? 1 : 0.75); g.add(ring);
    let ring2 = null; if (isLocal) { ring2 = this._ringDecal('#ffffff', (e.radius || 1.2) * 1.25, 0.35); g.add(ring2); }
    rig.root.scale.multiplyScalar(1.08);
    return { kind: 'hero', group: g, rig, ring, ring2, rot: PI / 2 - (e.facing || 0), flash: 0, lag: e.hp, height: rig.def.height * 1.08, isLocal, opacity: 1, atk: 0, st: {}, skin: rig.skin, colors: rig.colors };
  }

  _setOpacity(v, o) {
    if (v.opacity === o) return; v.opacity = o;
    for (const m of [v.rig.mat, v.rig.glowMat]) { m.transparent = o < 0.999; m.opacity = o; m.depthWrite = o > 0.5; }
  }

  _updateView(v, e, dt, lh) {
    const vis = this._visible(e);
    const p = this._ipos(e);
    const moving = Math.abs(e.x - (e.prevX ?? e.x)) + Math.abs(e.y - (e.prevY ?? e.y)) > 0.004;
    if (v.flash > 0) v.flash = Math.max(0, v.flash - dt * 7);
    if (v.lag != null) { v.lag = e.hp > v.lag ? e.hp : lerp(v.lag, e.hp, 1 - Math.exp(-dt * (this.time - (v.lagT || 0) > 0.4 ? 5 : 0.5))); if (e.hp < v.lastHp) v.lagT = this.time; v.lastHp = e.hp; }
    const facing = e.facing ?? 0;
    switch (v.kind) {
      case 'hero': return this._updHero(v, e, dt, p, moving, vis);
      case 'minion': {
        if (!vis) return;
        v.rot = angLerp(v.rot, PI / 2 - facing, 1 - Math.exp(-dt * 12));
        const st = e.anim?.state, at = e.anim?.t || 0; let lift = 0, tilt = 0, tiltX = 0, scale = 1, ox = 0, oz = 0;
        if (!e.alive || st === 'dead') { const k = clamp(at / 0.8, 0, 1); lift = -k * 1.2; tilt = k * 0.9; scale = 1 - k * 0.3; }
        else {
          if (moving) { const ph = this.time * 13 + e.id; tilt = Math.sin(ph) * 0.09; lift = Math.abs(Math.cos(ph)) * 0.12; }
          if (st === 'attack') { const k = clamp(at / 0.35, 0, 1), s = Math.sin(k * PI); tiltX = s * 0.35; ox = Math.sin(v.rot) * s * 0.4; oz = Math.cos(v.rot) * s * 0.4; }
        }
        this.minions.push(v.type, { x: p.x + ox, z: p.z + oz, rot: v.rot, lift, tilt, tiltX, scale: scale * (v.type === 'minion_siege' ? 1.1 : 1), flash: v.flash, team: e.team });
        if (e.alive && e.hp < e.maxHp) this.bars.bar({ x: p.x, y: v.height + 0.35, z: p.z, w: 1.6, h: 0.2, hp: e.hp, max: e.maxHp, lag: v.lag, shieldAmt: e.shield, color: e.team === this.localTeam ? ALLY_HP : ENEMY_HP });
        return;
      }
      case 'tower': case 'core': {
        v.group.position.set(e.x, 0, e.y); const b = v.rig.bones;
        if (!e.alive) { this._toRubble(v, true); return; }
        b.crystal.rotation.y = this.time * 0.8; b.crystal.position.y = b.crystal.userData.rest.p.y + Math.sin(this.time * 1.5) * 0.25;
        if (b.ring) { b.ring.rotation.y = -this.time * 0.6; b.ring.rotation.x = Math.sin(this.time * 0.7) * 0.2; }
        v.rig.mat.userData.u.flash.value = v.flash * 0.25;
        this.bars.bar({ x: e.x, y: v.height, z: e.y, w: v.kind === 'core' ? 7 : 4.6, h: 0.42, hp: e.hp, max: e.maxHp, lag: v.lag, shieldAmt: e.shield, color: e.team === this.localTeam ? ALLY_HP : ENEMY_HP });
        return;
      }
      case 'monster': case 'summon': {
        v.group.visible = vis; if (!vis) return;
        v.group.position.set(p.x, 0, p.z);
        v.rot = angLerp(v.rot, PI / 2 - facing, 1 - Math.exp(-dt * 8)); v.group.rotation.y = v.rot;
        const anim = this._anim(e, v);
        if (v.wolf) poseRig(v.rig, anim, this.time, moving);
        if (v.bolt) { const air = has(e, 'airborne') || (e.buffs || []).some((b) => b.key === 'airborne'); v.air = lerp(v.air || 0, air ? 1 : 0, 1 - Math.exp(-dt * 10)); v.rig.root.position.y = v.air * 6; v.rig.root.rotation.x = v.air * 0.6; if (air && Math.random() < dt * 30) this.vfx.trail(p.x, v.air * 6 + 0.5, p.z, '#ffb84a', { style: 'embers', vy: -2, life: 0.4, size: 0.9 }); } else if (v.kind === 'monster') poseMonster(v.rig, anim, this.time, moving);
        else { const sp = v.rig.def?.spin; if (sp) { v.rig.bones[sp].rotation.y = this.time * 2; v.rig.bones[sp].position.y = 1.4 + Math.sin(this.time * 2) * 0.2; } const k = clamp((this.time - v.born) / 0.35, 0, 1); v.rig.root.scale.setScalar(ease(k)); if (!e.alive) v.rig.root.scale.multiplyScalar(Math.max(0.01, 1 - (e.anim?.t || 0) * 2)); }
        v.rig.mat.userData.u.flash.value = v.flash * 0.6;
        if (v.ring) v.ring.visible = e.alive;
        if (e.alive && e.maxHp > 1) { const epic = v.epic; this.bars.bar({ x: p.x, y: v.height + 0.6, z: p.z, w: epic ? 5 : v.kind === 'summon' ? 1.8 : 2.6, h: epic ? 0.38 : 0.24, hp: e.hp, max: e.maxHp, lag: v.lag, shieldAmt: e.shield, color: e.team === 2 ? NEUTRAL_HP : e.team === this.localTeam ? ALLY_HP : ENEMY_HP }); }
        if (v.kind === 'monster' && v.element && e.alive && Math.random() < dt * 6) this.vfx.trail(p.x + (Math.random() - 0.5) * 3, 2 + Math.random() * 3, p.z + (Math.random() - 0.5) * 3, ELEMENT_COLORS[v.element], { vy: 1, life: 0.8, size: 0.6, style: 'embers' });
        return;
      }
      case 'wall': { const k = ease((this.time - v.born) / 0.3); v.group.scale.set(1, Math.max(0.01, k), 1); if (!e.alive) v.group.scale.y = Math.max(0.01, 1 - (e.anim?.t || 0) * 2); return; }
      case 'projectile': {
        const P = v.P; v.group.position.set(p.x, 0, p.z);
        const age = this.time - v.born; const hy = lerp(v.y, 1.3, clamp(age / 0.35, 0, 1));
        v.group.position.y = hy; v.group.rotation.y = PI / 2 - facing;
        if (P.spinRate) P.spin.rotation[P.spinAxis] += dt * P.spinRate;
        P.glow.material.opacity = 0.75 + 0.25 * Math.sin(this.time * 30);
        const tr = P.trail; const n = Math.max(1, Math.round(dt * 60 * (0.6 + 0.6 * v.I)));
        for (let i = 0; i < n; i++) this.vfx.trail(p.x, hy, p.z, v.color, { size: tr.size, life: tr.life, style: tr.style, color1: v.color2, vy: 0.2, spread: 0.6 });
        return;
      }
      case 'area': {
        v.group.position.set(p.x, 0, p.z); const A = v.A;
        const r = e.radius || 3; const kIn = ease((this.time - v.born) / 0.25);
        v.group.scale.set(r * kIn, 1, r * kIn);
        const remain = e.endAt != null && this.match.time != null ? e.endAt - this.match.time : 1;
        const out = remain < 0.3 ? Math.max(0, remain / 0.3) : 1;
        A.ring.material.opacity = (v.subtle ? 0.35 : 0.5 + 0.2 * Math.sin(this.time * 5)) * out; A.fill.material.opacity = 0.18 * out; A.rune.material.opacity = 0.45 * out; A.rune.rotation.y = this.time * 0.6;
        if (v.dome) { v.dome.position.set(p.x, 0, p.z); v.dome.scale.set(r * kIn, r * 0.65 * kIn, r * kIn); v.dome.material.uniforms.uAlpha.value = 0.9 * out; v.dome.material.uniforms.uTime.value = this.time; }
        if (A.murk) A.murk.material.opacity = 0.7 * out;
        if (!v.subtle && Math.random() < dt * (6 + r * 3) * (0.5 + v.I)) { const a = Math.random() * PI * 2, rr = Math.sqrt(Math.random()) * r; this.vfx.trail(p.x + Math.cos(a) * rr, 0.2, p.z + Math.sin(a) * rr, v.c.vfx, { vy: 1.6, life: 0.9, size: 0.55, style: v.c.fx, color1: v.c.vfx2 }); }
        return;
      }
      case 'zone': { v.zone.group.position.set(e.x, 0, e.y); v.zone.root.position.set(e.x, 0, e.y); v.zone.x = e.x; v.zone.z = e.y; v.zone.update(dt, this.time, this.vfx, 1); return; }
    }
  }

  _anim(e, v) {
    const a = e.anim || { state: 'idle', t: 0 };
    let st = a.state; if (st === 'dash') st = 'run'; else if (st === 'stagger') st = 'idle';
    if (!e.alive && st !== 'dead') st = 'dead';
    return { state: st, t: a.t || 0, slot: v.atk || 0, dur: a.dur };
  }

  _updHero(v, e, dt, p, moving, vis) {
    const g = v.group; const lh = this._localHero();
    const invis = has(e, 'invisible');
    const ally = e.team === this.localTeam;
    let op = 1;
    if (!vis) { g.visible = false; return; }
    g.visible = true;
    if (invis) op = ally ? 0.38 : 0.5;
    if (!e.alive) { const dt0 = e.anim?.state === 'dead' ? e.anim.t : 2; op = Math.min(op, clamp(1 - (dt0 - 2.0) / 1.0, 0, 1)); if (op <= 0.01) { g.visible = false; this._statusFx(v, e, p, dt, false); return; } }
    this._setOpacity(v, op);
    g.position.set(p.x, 0, p.z);
    const fac = PI / 2 - (e.facing ?? 0);
    v.rot = angLerp(v.rot, fac, 1 - Math.exp(-dt * 16)); g.rotation.y = v.rot;
    const anim = this._anim(e, v);
    poseRig(v.rig, anim, this.time + e.id * 0.37, moving && e.alive);
    if (e.anim?.state === 'dash') { v.rig.bones.root.rotation.x = 0.35; }
    if (e.anim?.state === 'stagger') { v.rig.bones.root.rotation.x = -0.25; }
    v.rig.mat.userData.u.flash.value = v.flash * 0.55;
    v.ring.visible = e.alive; v.ring.material.opacity = (v.isLocal ? 0.95 : 0.7) * op;
    if (v.ring2) { v.ring2.visible = e.alive; v.ring2.scale.setScalar((e.radius || 1.2) * (1.2 + 0.1 * Math.sin(this.time * 4))); v.ring2.scale.y = 1; }
    // movement trail for legendary skins / speed status
    const c = this._colorsFor(e.id);
    if (e.alive && moving && (c?.trail || has(e, 'speed')) && Math.random() < dt * (v.isLocal ? 30 : 12)) this.vfx.trail(p.x, 0.4 + Math.random() * 1.2, p.z, c.vfx, { style: c.trail || 'wisps', size: 0.5, life: 0.6, color1: c.vfx2, vy: 0.6 });
    if (e.alive) {
      const bh = v.height + 0.8;
      this.bars.bar({ x: p.x, y: bh, z: p.z, w: 3.2, h: 0.42, hp: e.hp, max: e.maxHp, lag: v.lag, shieldAmt: e.shield, color: v.isLocal ? LOCAL_HP : ally ? ALLY_HP : ENEMY_HP, hero: true, level: e.level ?? 1, id: e.id });
    }
    this._statusFx(v, e, p, dt, e.alive);
  }

  _statusFx(v, e, p, dt, alive) {
    const S = v.st; const g = v.group;
    const want = { stun: alive && (has(e, 'stun') || has(e, 'taunt')), slow: alive && has(e, 'slow'), root: alive && has(e, 'root'), shield: alive && (e.shield || 0) > 1, recall: alive && !!e.recalling, silence: alive && has(e, 'silence') };
    // stun stars
    if (want.stun && !S.stun) { const grp = new THREE.Group(); const geo = this._starGeo || (this._starGeo = G.star(0.45, 0.18, 0.12)); geo.userData.shared = true; const mat = makeGlowMat('#ffe066'); for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(geo, mat); s.position.set(Math.cos(i * 2.1) * 0.9, 0, Math.sin(i * 2.1) * 0.9); grp.add(s); } const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd84a', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.set(2.6, 1.2, 1); grp.add(sp); g.add(grp); S.stun = grp; }
    if (S.stun) { S.stun.visible = want.stun; if (want.stun) { S.stun.position.y = v.height + 0.2; S.stun.rotation.y = this.time * 5; S.stun.children.forEach((s) => { if (s.isMesh) s.rotation.y = -this.time * 5; }); } }
    if (want.slow && !S.slow) { S.slow = this._ringDecal('#8fe8ff', 1.8, 0.9); g.add(S.slow); }
    if (S.slow) { S.slow.visible = want.slow; if (want.slow) { S.slow.rotation.y = this.time; if (Math.random() < dt * 8) this.vfx.trail(p.x + (Math.random() - 0.5) * 2, 0.3, p.z + (Math.random() - 0.5) * 2, '#cff6ff', { style: 'snow', vy: 0.6, life: 0.7, size: 0.4 }); } }
    if (want.root && !S.root) { const m = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 4, 10), makeToonMat({ vertexColors: false, color: '#5a8a3a', rimStrength: 0.3 })); m.rotation.x = PI / 2; m.position.y = 0.25; g.add(m); S.root = m; }
    if (S.root) { S.root.visible = want.root; if (want.root) S.root.rotation.z = this.time * 0.5; }
    if (want.silence && !S.sil) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 3, 12), makeGlowMat('#c07aff')); g.add(m); S.sil = m; }
    if (S.sil) { S.sil.visible = want.silence; if (want.silence) { S.sil.position.y = v.height + 0.1; S.sil.rotation.x = this.time * 3; } }
    if (want.shield && !S.bubble) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), makeBubbleMat(v.colors?.vfx2 || '#ffffff')); m.renderOrder = 16; g.add(m); S.bubble = m; }
    if (S.bubble) { S.bubble.visible = want.shield; if (want.shield) { const r = (e.radius || 1.2) * 1.5; S.bubble.scale.set(r, v.height * 0.55, r); S.bubble.position.y = v.height * 0.45; S.bubble.material.uniforms.uTime.value = this.time; S.bubble.material.uniforms.uAlpha.value = clamp(0.45 + e.shield / Math.max(1, e.maxHp) * 2, 0.45, 1) * (v.opacity ?? 1); } }
    // recall channel
    if (want.recall && !S.recall) {
      const c = this._colorsFor(e.id); const st = RECALL_STYLES[c?.recall] || RECALL_STYLES.default; const a = st.a || c?.vfx || teamColor(e.team);
      const grp = new THREE.Group(); const rune = this._ringDecal(a, 2.6, 0.9); rune.material.map = runeTexture(); grp.add(rune); const ring = this._ringDecal(st.b, 2.8, 0.8); grp.add(ring);
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 16, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: glowTexture() })); grp.add(pil);
      g.add(grp); S.recall = { grp, rune, ring, pil, a, b: st.b, p: st.p }; v.recallFx = S.recall;
    }
    if (S.recall) {
      S.recall.grp.visible = want.recall;
      if (want.recall) {
        S.recall.origin = { x: p.x, z: p.z };
        const r = e.recalling; const now = this.match.time ?? 0; const st0 = r.start ?? (r.until - 8); const k = clamp((now - st0) / Math.max(0.1, r.until - st0), 0, 1);
        S.recall.rune.rotation.y = this.time * (1 + k * 3); S.recall.ring.scale.setScalar(2.8 * (1 - k * 0.6)); S.recall.ring.scale.y = 1;
        S.recall.pil.scale.set(1, 1 + k * 9, 1); S.recall.pil.material.opacity = 0.15 + k * 0.35;
        const I = v.isLocal ? 1 : 0.5;
        if (Math.random() < dt * 40 * I) { const a = Math.random() * PI * 2; this.vfx.add.emit({ x: p.x + Math.cos(a) * 2.2, y: 0.2, z: p.z + Math.sin(a) * 2.2, vy: 2 + k * 6, life: 0.9, size: 0.6, size1: 0.1, color: S.recall.a, color1: S.recall.b, alpha: 1, drag: 0.5, swirl: [p.x, p.z, 2 + k * 4], shape: (FX_SHAPE[S.recall.p] ?? 2) }); }
      }
    }
  }

  _toRubble(v, keepView) {
    if (v.rubbled) return; v.rubbled = true;
    const pos = v.group.position.clone();
    const r = buildRubble(v.kind === 'core' ? 2.4 : 1.4); r.position.copy(pos); this.scene.add(r); this.rubble.push(r);
    v.group.visible = false;
  }
  _disposeView(v) {
    if (v.zone) v.zone.dispose();
    if (v.dome) { this.scene.remove(v.dome); v.dome.geometry.dispose(); v.dome.material.dispose(); }
    if (v.group) { this.scene.remove(v.group); v.group.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); } }); }
  }
}

// aim helper sizes for indicators (ability defs don't carry radius/width)
const AIM_RADIUS = { bram_r: 7, bram_w: 2, kaela_w: 4.5, kaela_r: 4, lumi_w: 4.5, lumi_r: 8, mire_q: 3.5, mire_w: 2, mire_r: 13, nyx_r: 7.5, garrok_w: 6, garrok_q: 3.2, pip_r: 4.5, pip_w: 2, vex_w: 1.5 };
const AIM_WIDTH = { vex_r: 2.2, vex_q: 1.4, lumi_q: 1.6, kaela_q: 2.2, nyx_q: 1.8, bram_q: 2.4, garrok_q: 2.4, pip_q: 1.4, mire_q: 1.6 };
const FX_SHAPE = { stars: 2, constellation: 2, sunfire: 2, snow: 2, moonmotes: 2, lightning: 2, sparks: 2, pixels: 1, bats: 1, petals: 1, leaves: 1, void: 3, bubbles: 3 };
