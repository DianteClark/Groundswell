// Input: desktop mouse/keyboard + mobile Wild-Rift-style touch controls. Writes only via match.issue().
import Save from '../meta/save.js';
import { ULT_LEVEL } from '../sim/constants.js';
import { frag } from './dom.js';

const ALIVE = (u) => u && u.alive && !u.removed;
const TARGETABLE = (u) => !(u.statuses || []).some(s => s.key === 'untargetable' || s.key === 'invisible');

export class Input {
  constructor(canvas, match, renderer, localPlayerId, hud) {
    this.cv = canvas; this.m = match; this.r = renderer; this.pid = localPlayerId ?? match.localPlayerId; this.hud = hud;
    this.hero = match.heroOf ? match.heroOf(this.pid) : match.heroes[0];
    this.team = this.hero?.team ?? 0;
    this.touch = hud?.touch ?? ((window.matchMedia && matchMedia('(pointer: coarse)').matches));
    this.settings = Save.get().settings;
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, in: false };
    this.keys = new Set();
    this.attackMode = false; this.rmb = false; this.rmbT = 0;
    this.camLocked = this.settings.camera !== 'free';
    this.r?.setCameraFollow?.(this.camLocked);
    this.joy = null; this.aim = null; this.atkHold = null;
    this.lastDir = { dx: 0, dy: 0, t: 0 };
    this._h = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); this._h.push([el, ev, fn, opt]); };
    this._on = on;
    if (hud) hud.castCb = (slot) => this.castAtCursor(slot);
    // desktop
    on(canvas, 'contextmenu', e => e.preventDefault());
    on(canvas, 'mousedown', e => this._mouseDown(e));
    on(window, 'mouseup', e => { if (e.button === 2) this.rmb = false; });
    on(window, 'mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.in = true; });
    on(document, 'mouseleave', () => { this.mouse.in = false; });
    on(window, 'keydown', e => this._key(e, true));
    on(window, 'keyup', e => this._key(e, false));
    on(window, 'blur', () => { this.keys.clear(); this.rmb = false; });
    if (this.touch) this._setupTouch();
  }

  // ---------- coordinate helpers ----------
  _rel(cx, cy) { const rc = this.cv.getBoundingClientRect(); return { x: cx - rc.left, y: cy - rc.top }; }
  world(cx, cy) { const p = this._rel(cx, cy); const w = this.r?.screenToWorld?.(p.x, p.y); return w && isFinite(w.x) ? w : null; }
  heroScreen() {
    const h = this.hero; const s = this.r?.worldToScreen?.(h.x, h.y); if (!s) return null;
    const rc = this.cv.getBoundingClientRect(); return { x: s.sx + rc.left, y: s.sy + rc.top };
  }
  /** Convert a screen-space direction (dx,dy px) at the hero into a normalized world direction. */
  screenDirToWorld(dx, dy) {
    const h = this.hero; const hs = this.heroScreen();
    const len = Math.hypot(dx, dy) || 1; const k = 80 / len;
    if (hs) { const w = this.world(hs.x + dx * k, hs.y + dy * k); if (w) { const vx = w.x - h.x, vy = w.y - h.y; const l = Math.hypot(vx, vy); if (l > 1e-4) return { x: vx / l, y: vy / l }; } }
    return { x: dx / len, y: dy / len };
  }
  issue(cmd) { this.m.issue(this.pid, cmd); }
  enemyFilter(u) { return ALIVE(u) && u.team !== this.team && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'monster' || u.kind === 'tower' || u.kind === 'core' || u.kind === 'summon') && TARGETABLE(u) && (!u.vis || u.vis[this.team]); }
  abilityDef(slot) { return this.hud?.abilityDef ? this.hud.abilityDef(slot) : null; }
  abilityRange(slot) { const d = this.abilityDef(slot); const r = typeof d?.range === 'function' ? d.range(this.hero) : d?.range; return r || 8; }
  canCast(slot) { const h = this.hero; if (!h?.alive) return false; if (slot === 'r' && (h.level || 1) < ULT_LEVEL) return false; const a = h.abilities?.[slot]; return !a || (a.cd || 0) <= 0; }

  // ---------- desktop ----------
  _mouseDown(e) {
    if (this.touch && e.sourceCapabilities?.firesTouchEvents) return;
    const w = this.world(e.clientX, e.clientY); if (!w) return;
    if (e.button === 2) {
      this.rmb = true; this.rmbT = 0;
      if (this.attackMode) { this.attackMode = false; this.cv.classList.remove('cur-atk'); }
      this._rightClick(w, true);
    } else if (e.button === 0 && this.attackMode) {
      this.attackMode = false; this.cv.classList.remove('cur-atk');
      const t = this.m.findUnitAt?.(w.x, w.y, 2.5, u => this.enemyFilter(u));
      if (t) this.issue({ type: 'attack', targetId: t.id }); else this.issue({ type: 'attackMove', x: w.x, y: w.y });
      this.r?.showClickMarker?.(w.x, w.y, 'attack');
    }
  }
  _rightClick(w, marker) {
    const t = this.m.findUnitAt?.(w.x, w.y, 2.2, u => this.enemyFilter(u));
    if (t) { this.issue({ type: 'attack', targetId: t.id }); if (marker) this.r?.showClickMarker?.(t.x, t.y, 'attack'); }
    else { this.issue({ type: 'move', x: w.x, y: w.y }); if (marker) this.r?.showClickMarker?.(w.x, w.y, 'move'); }
  }
  castAtCursor(slot) {
    if (!this.canCast(slot)) { if (slot === 'r' && (this.hero.level || 1) < ULT_LEVEL) this.hud?.flashHint?.(`Ultimate unlocks at level ${ULT_LEVEL}`); return; }
    const w = this.world(this.mouse.x, this.mouse.y) || { x: this.hero.x + Math.cos(this.hero.facing || 0) * 5, y: this.hero.y + Math.sin(this.hero.facing || 0) * 5 };
    const d = this.abilityDef(slot);
    let targetId;
    if (d?.targeting === 'unit') {
      const t = this.m.findUnitAt?.(w.x, w.y, 3, u => ALIVE(u) && u.id !== this.hero.id && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'monster' || u.kind === 'summon') && (!u.vis || u.vis[this.team]));
      targetId = t?.id;
    }
    this.issue({ type: 'cast', slot, x: w.x, y: w.y, targetId });
  }
  _key(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (!down) { this.keys.delete(k); if (k === ' ') this.r?.setCameraFollow?.(this.camLocked); return; }
    if (e.repeat && k !== ' ') return;
    this.keys.add(k);
    if (e.ctrlKey || e.metaKey) return;
    switch (k) {
      case 'q': case 'w': case 'r': this.castAtCursor(k); break;
      case 'd': case 'f': this.castAtCursor('relic'); break;
      case 'a': this.attackMode = true; this.cv.classList.add('cur-atk'); break;
      case 'b': this.issue({ type: 'recall' }); break;
      case 's': this.issue({ type: 'stop' }); break;
      case 'y': this.camLocked = !this.camLocked; this.r?.setCameraFollow?.(this.camLocked); this.hud?.flashHint?.(this.camLocked ? 'Camera locked' : 'Camera unlocked'); break;
      case ' ': e.preventDefault(); this.r?.setCameraFollow?.(true); break;
      case 'p': this.hud?.toggleShop?.(); break;
      case 'escape': this.attackMode = false; this.cv.classList.remove('cur-atk'); this.hud?.toggleShop?.(false); this.hud?.toggleScoreboard?.(false); break;
      case 'arrowleft': case 'arrowright': case 'arrowup': case 'arrowdown': e.preventDefault(); break;
    }
  }

  // ---------- touch ----------
  _setupTouch() {
    const hud = this.hud; const root = hud?.root || document.body;
    this.joyEl = frag('<div class="joy"><div class="joy-base"></div><div class="joy-knob"></div></div>');
    this.cancelEl = frag('<div class="aim-cancel">✕<small>Cancel</small></div>');
    root.appendChild(this.joyEl); root.appendChild(this.cancelEl);
    const on = this._on;
    // joystick: touches starting on the left 45% of the canvas
    on(this.cv, 'pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      if (e.clientX < innerWidth * 0.45 && !this.joy) {
        e.preventDefault();
        this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
        try { this.cv.setPointerCapture?.(e.pointerId); } catch (_) { /* */ }
        this._joyDraw(); this.r?.setCameraFollow?.(true); this.camLocked = true;
      } else if (!this.joy || e.pointerId !== this.joy.id) {
        // tap on world (right side): attack tapped enemy, else move there
        const w = this.world(e.clientX, e.clientY); if (w) this._rightClick(w, true);
      }
    }, { passive: false });
    on(this.cv, 'pointermove', e => { if (this.joy && e.pointerId === this.joy.id) { this.joy.dx = e.clientX - this.joy.ox; this.joy.dy = e.clientY - this.joy.oy; this._joyDraw(); } });
    const endJoy = e => { if (this.joy && e.pointerId === this.joy.id) { this.joy = null; this._joyDraw(); this.issue({ type: 'moveDir', dx: 0, dy: 0 }); this.lastDir = { dx: 0, dy: 0, t: 0 }; } };
    on(this.cv, 'pointerup', endJoy); on(this.cv, 'pointercancel', endJoy);
    if (!hud) return;
    // ability buttons: tap = smart cast, drag = aim, long-press = tooltip
    for (const [slot, btn] of Object.entries(hud.els.abilities)) {
      on(btn, 'pointerdown', e => {
        e.preventDefault(); try { btn.setPointerCapture?.(e.pointerId); } catch (_) { /* */ }
        const rc = btn.getBoundingClientRect();
        this.aim = { slot, id: e.pointerId, cx: rc.left + rc.width / 2, cy: rc.top + rc.height / 2, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, drag: false, t0: performance.now(), btn, cancel: false };
        btn.classList.add('press');
        clearTimeout(this._lp); this._lp = setTimeout(() => { if (this.aim && !this.aim.drag) { this.aim.tip = true; hud.showTooltip(slot, btn); } }, 450);
      }, { passive: false });
      on(btn, 'pointermove', e => {
        const a = this.aim; if (!a || a.id !== e.pointerId) return;
        a.dx = e.clientX - a.sx; a.dy = e.clientY - a.sy;
        if (!a.drag && Math.hypot(a.dx, a.dy) > 14) { a.drag = true; hud.hideTooltip(); this.cancelEl.classList.add('on'); }
        if (a.drag) {
          const cr = this.cancelEl.getBoundingClientRect();
          a.cancel = e.clientX > cr.left - 10 && e.clientX < cr.right + 10 && e.clientY > cr.top - 10 && e.clientY < cr.bottom + 10;
          this.cancelEl.classList.toggle('hot', a.cancel);
          const p = this._aimPoint(a);
          this.r?.showIndicator?.({ slot, heroId: this.hero.heroId, x: this.hero.x, y: this.hero.y, tx: p.x, ty: p.y, range: this.abilityRange(slot), targeting: this.abilityDef(slot)?.targeting, cancel: a.cancel });
        }
      });
      const up = e => {
        const a = this.aim; if (!a || a.id !== e.pointerId) return;
        clearTimeout(this._lp); btn.classList.remove('press'); this.cancelEl.classList.remove('on', 'hot'); this.r?.hideIndicator?.();
        this.aim = null;
        if (a.tip) { hud.hideTooltip(); if (!a.drag) return; }
        if (e.type === 'pointercancel' || a.cancel) return;
        if (!this.canCast(slot)) { if (slot === 'r' && (this.hero.level || 1) < ULT_LEVEL) hud.flashHint(`Ultimate unlocks at level ${ULT_LEVEL}`); return; }
        if (a.drag) { const p = this._aimPoint(a); this.issue({ type: 'cast', slot, x: p.x, y: p.y, targetId: p.targetId }); }
        else this.smartCast(slot);
      };
      on(btn, 'pointerup', up); on(btn, 'pointercancel', up);
    }
    // attack: tap/hold
    const atk = hud.els.attack;
    on(atk, 'pointerdown', e => { e.preventDefault(); try { atk.setPointerCapture?.(e.pointerId); } catch (_) { /* */ } atk.classList.add('press'); this.atkHold = { id: e.pointerId, t: 0 }; this.autoAttack(); }, { passive: false });
    const atkUp = e => { if (this.atkHold && this.atkHold.id === e.pointerId) { this.atkHold = null; atk.classList.remove('press'); } };
    on(atk, 'pointerup', atkUp); on(atk, 'pointercancel', atkUp);
    on(hud.els.recallBtn, 'pointerdown', e => { e.preventDefault(); this.issue({ type: 'recall' }); });
    on(hud.els.shopBtn, 'pointerdown', e => { e.preventDefault(); hud.toggleShop(); });
  }
  _joyDraw() {
    const el = this.joyEl; const j = this.joy; const R = 60 * (this.settings.touchSize || 1);
    if (!j) { el.classList.remove('on'); return; }
    el.classList.add('on');
    const l = Math.hypot(j.dx, j.dy); const k = l > R ? R / l : 1;
    el.style.setProperty('--jx', j.ox + 'px'); el.style.setProperty('--jy', j.oy + 'px');
    el.style.setProperty('--kx', (j.dx * k) + 'px'); el.style.setProperty('--ky', (j.dy * k) + 'px');
  }
  _aimPoint(a) {
    const h = this.hero; const range = this.abilityRange(a.slot); const d = this.abilityDef(a.slot);
    const maxDrag = 90 * (this.settings.touchSize || 1);
    const len = Math.hypot(a.dx, a.dy); const frac = Math.min(1, len / maxDrag);
    const dir = this.screenDirToWorld(a.dx, a.dy);
    const tg = d?.targeting;
    const dist = tg === 'skillshot' ? range : Math.max(1, range * frac);
    const p = { x: h.x + dir.x * dist, y: h.y + dir.y * dist };
    if (tg === 'unit') { const t = this.m.findUnitAt?.(p.x, p.y, 4, u => this.enemyFilter(u) && u.kind !== 'tower' && u.kind !== 'core'); if (t) { p.x = t.x; p.y = t.y; p.targetId = t.id; } }
    return p;
  }
  nearestEnemy(range, heroesOnly) {
    const h = this.hero;
    const all = this.m.unitsInRadius ? this.m.unitsInRadius(h.x, h.y, range, u => this.enemyFilter(u)) : [];
    let best = null, bd = 1e9;
    for (const u of all) { if (heroesOnly && u.kind !== 'hero') continue; const d = Math.hypot(u.x - h.x, u.y - h.y) - (u.radius || 0); if (d < bd) { bd = d; best = u; } }
    return best;
  }
  smartCast(slot) {
    const h = this.hero; const d = this.abilityDef(slot); const range = this.abilityRange(slot);
    if (d?.targeting === 'self') { this.issue({ type: 'cast', slot, x: h.x, y: h.y }); return; }
    const t = this.nearestEnemy(range + 1.5, true) || (d?.targeting === 'unit' || /hunt|smite/i.test(d?.id || '') ? this.nearestEnemy(range + 1, false) : null);
    if (t) { this.issue({ type: 'cast', slot, x: t.x, y: t.y, targetId: t.id }); return; }
    if (d?.targeting === 'unit') { this.hud?.flashHint?.('No target in range'); return; }
    let ang = h.facing || 0;
    if (this.joy && Math.hypot(this.joy.dx, this.joy.dy) > 10) { const w = this.screenDirToWorld(this.joy.dx, this.joy.dy); ang = Math.atan2(w.y, w.x); }
    const dist = d?.targeting === 'skillshot' ? range : range * 0.7;
    this.issue({ type: 'cast', slot, x: h.x + Math.cos(ang) * dist, y: h.y + Math.sin(ang) * dist });
  }
  autoAttack() {
    const h = this.hero; if (!h?.alive) return;
    const rng = (h.stats?.attackRange || 3) + 2.5;
    const champ = this.settings.champPriority;
    let t = champ ? (this.nearestEnemy(rng, true) || this.nearestEnemy(rng, false)) : this.nearestEnemy(rng, false);
    if (!t) t = this.nearestEnemy(rng + 5, false);
    if (t) this.issue({ type: 'attack', targetId: t.id });
    else this.issue({ type: 'attackMove', x: h.x + Math.cos(h.facing || 0) * 3, y: h.y + Math.sin(h.facing || 0) * 3 });
  }

  // ---------- per frame ----------
  update(dt) {
    const h = this.hero; if (!h) return;
    // joystick → moveDir (throttled; resend on direction change)
    if (this.joy) {
      const l = Math.hypot(this.joy.dx, this.joy.dy);
      this.lastDir.t += dt;
      if (l > 8) {
        const w = this.screenDirToWorld(this.joy.dx, this.joy.dy);
        const dot = w.x * this.lastDir.dx + w.y * this.lastDir.dy;
        if (dot < 0.996 || this.lastDir.t > 0.5) { this.issue({ type: 'moveDir', dx: w.x, dy: w.y }); this.lastDir = { dx: w.x, dy: w.y, t: 0 }; }
      } else if (this.lastDir.dx || this.lastDir.dy) { this.issue({ type: 'moveDir', dx: 0, dy: 0 }); this.lastDir = { dx: 0, dy: 0, t: 0 }; }
    }
    if (this.atkHold) { this.atkHold.t += dt; if (this.atkHold.t > 0.3) { this.atkHold.t = 0; this.autoAttack(); } }
    // held right mouse → keep moving toward cursor
    if (this.rmb) { this.rmbT += dt; if (this.rmbT > 0.15) { this.rmbT = 0; const w = this.world(this.mouse.x, this.mouse.y); if (w) this.issue({ type: 'move', x: w.x, y: w.y }); } }
    // camera pan (arrows / edge) when not locked
    if (!this.touch && this.r?.panCamera && !this.keys.has(' ')) {
      let px = 0, py = 0; const sp = 60 * dt;
      if (this.keys.has('arrowleft')) px -= sp; if (this.keys.has('arrowright')) px += sp; if (this.keys.has('arrowup')) py -= sp; if (this.keys.has('arrowdown')) py += sp;
      if (this.settings.edgePan !== false && !this.camLocked && this.mouse.in && document.hasFocus?.()) {
        const E = 6; if (this.mouse.x <= E) px -= sp; if (this.mouse.x >= innerWidth - E) px += sp; if (this.mouse.y <= E) py -= sp; if (this.mouse.y >= innerHeight - E) py += sp;
      }
      if (px || py) { if (this.camLocked) { this.camLocked = false; this.r.setCameraFollow?.(false); } this.r.panCamera(px, py); }
    }
  }
  dispose() {
    for (const [el, ev, fn, opt] of this._h) el.removeEventListener(ev, fn, opt);
    this._h = []; this.joyEl?.remove(); this.cancelEl?.remove(); clearTimeout(this._lp);
    if (this.hud) this.hud.castCb = null;
  }
}
export default Input;
