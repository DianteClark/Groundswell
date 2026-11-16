// Input: desktop mouse/keyboard + mobile Wild-Rift-style touch controls. Writes only via match.issue().
import Save from '../meta/save.js';
import { ULT_LEVEL, TICK_RATE } from '../sim/constants.js';
import { frag } from './dom.js';
import { ico } from './icons.js';

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
    this.joy = null; this.aim = null; this.atkHold = null; this.lockId = null;
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
  canCast(slot) { const h = this.hero; if (!h?.alive) return false; if (slot === 'r' && (h.level || 1) < ULT_LEVEL) return false; const a = h.abilities?.[slot]; return !a || (a.cd || 0) <= 0.25; }

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
    this.ghostEl = frag('<div class="joy-ghost"></div>');
    this.cancelEl = frag('<div class="aim-cancel">✕<small>Cancel</small></div>');
    root.appendChild(this.joyEl); root.appendChild(this.ghostEl); root.appendChild(this.cancelEl);
    const on = this._on;
    // joystick: touches starting on the left half of the canvas
    on(this.cv, 'pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      if (e.clientX < innerWidth * 0.5 && !this.joy) {
        e.preventDefault();
        this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
        try { this.cv.setPointerCapture?.(e.pointerId); } catch (_) { /* */ }
        this._joyDraw(); this.r?.setCameraFollow?.(true); this.camLocked = true;
      } else if (!this.joy || e.pointerId !== this.joy.id) {
        // tap on world (right side): tap an enemy = lock + attack it; tap ground = move there
        const w = this.world(e.clientX, e.clientY); if (!w) return;
        const t = this.m.findUnitAt?.(w.x, w.y, 2.6, u => this.enemyFilter(u));
        if (t) { this.setLock(t.id); this.issue({ type: 'attack', targetId: t.id, once: !!this.joy }); this.r?.showClickMarker?.(t.x, t.y, 'attack'); }
        else { this.setLock(null); this.issue({ type: 'move', x: w.x, y: w.y }); this.r?.showClickMarker?.(w.x, w.y, 'move'); }
      }
    }, { passive: false });
    on(this.cv, 'pointermove', e => { if (this.joy && e.pointerId === this.joy.id) { this.joy.dx = e.clientX - this.joy.ox; this.joy.dy = e.clientY - this.joy.oy; this._joyDraw(); this._joySample(); } });
    const endJoy = e => { if (this.joy && e.pointerId === this.joy.id) { this.joy = null; this._joyDraw(); this.issue({ type: 'moveDir', dx: 0, dy: 0 }); this.lastDir = { dx: 0, dy: 0, t: 0 }; } };
    on(this.cv, 'pointerup', endJoy); on(this.cv, 'pointercancel', endJoy);
    if (!hud) return;
    // ability buttons: tap = smart cast (aim-assisted), drag = aim (with cancel zone), long-press = tooltip
    for (const [slot, btn] of Object.entries(hud.els.abilities)) {
      on(btn, 'pointerdown', e => {
        e.preventDefault(); try { btn.setPointerCapture?.(e.pointerId); } catch (_) { /* */ }
        const rc = btn.getBoundingClientRect();
        this.aim = { slot, id: e.pointerId, cx: rc.left + rc.width / 2, cy: rc.top + rc.height / 2, sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, drag: false, t0: performance.now(), btn, cancel: false };
        btn.classList.add('press');
        // self-cast abilities fire on touch-down (no aim needed → zero extra latency)
        if (this.abilityDef(slot)?.targeting === 'self' && this.canCast(slot)) { this.aim.fired = true; this.smartCast(slot); }
        clearTimeout(this._lp); this._lp = setTimeout(() => { if (this.aim && !this.aim.drag && !this.aim.fired) { this.aim.tip = true; hud.showTooltip(slot, btn); } }, 450);
      }, { passive: false });
      on(btn, 'pointermove', e => {
        const a = this.aim; if (!a || a.id !== e.pointerId || a.fired) return;
        a.dx = e.clientX - a.sx; a.dy = e.clientY - a.sy;
        if (!a.drag && Math.hypot(a.dx, a.dy) > 14) { a.drag = true; hud.hideTooltip(); this.cancelEl.classList.add('on'); }
        if (a.drag) {
          const cr = this.cancelEl.getBoundingClientRect();
          a.cancel = e.clientX > cr.left - 14 && e.clientX < cr.right + 14 && e.clientY > cr.top - 14 && e.clientY < cr.bottom + 14;
          this.cancelEl.classList.toggle('hot', a.cancel);
          const p = this._aimPoint(a);
          this.r?.showIndicator?.({ slot, heroId: this.hero.heroId, x: this.hero.x, y: this.hero.y, tx: p.x, ty: p.y, range: this.abilityRange(slot), targeting: this.abilityDef(slot)?.targeting, cancel: a.cancel, targetId: p.targetId });
        }
      });
      const up = e => {
        const a = this.aim; if (!a || a.id !== e.pointerId) return;
        clearTimeout(this._lp); btn.classList.remove('press'); this.cancelEl.classList.remove('on', 'hot'); this.r?.hideIndicator?.();
        this.aim = null;
        if (a.fired) return;
        if (a.tip) { hud.hideTooltip(); if (!a.drag) return; }
        if (e.type === 'pointercancel' || a.cancel) return;
        if (!this.canCast(slot)) { if (slot === 'r' && (this.hero.level || 1) < ULT_LEVEL) hud.flashHint(`Ultimate unlocks at level ${ULT_LEVEL}`); return; }
        if (a.drag) { const p = this._aimPoint(a); this.issue({ type: 'cast', slot, x: p.x, y: p.y, targetId: p.targetId }); }
        else this.smartCast(slot);
      };
      on(btn, 'pointerup', up); on(btn, 'pointercancel', up);
    }
    // attack buttons: main (smart), last-hit (minions/monsters), structure. Tap = one attack; hold = keep attacking
    // (with the joystick held, the hero walks between swings = automatic kiting).
    this.lhBtn = frag(`<button id="gs-btn-lasthit" class="ab sm ab-lh" aria-label="Last hit"><span class="ab-ic">${ico('ui:last', 40) || '🗡️'}</span></button>`);
    this.twBtn = frag(`<button id="gs-btn-tower" class="ab sm ab-tw" aria-label="Attack structure"><span class="ab-ic">${ico('ui:tower', 40) || '🏰'}</span></button>`);
    const host = hud.els.attack?.parentElement || root; host.appendChild(this.lhBtn); host.appendChild(this.twBtn);
    const bindAtk = (btn, mode) => {
      on(btn, 'pointerdown', e => {
        e.preventDefault(); try { btn.setPointerCapture?.(e.pointerId); } catch (_) { /* */ }
        btn.classList.add('press'); this.atkHold = { id: e.pointerId, mode, btn, t: 0 };
        const t = this.autoAttack(mode); if (!t && mode !== 'smart') hud.flashHint?.(mode === 'minion' ? 'No minion in range' : 'No structure in range');
      }, { passive: false });
      const upFn = e => { if (this.atkHold && this.atkHold.id === e.pointerId) { this.atkHold = null; btn.classList.remove('press'); } };
      on(btn, 'pointerup', upFn); on(btn, 'pointercancel', upFn);
    };
    bindAtk(hud.els.attack, 'smart'); bindAtk(this.lhBtn, 'minion'); bindAtk(this.twBtn, 'structure');
    on(hud.els.recallBtn, 'pointerdown', e => { e.preventDefault(); this.issue({ type: 'recall' }); });
    on(hud.els.shopBtn, 'pointerdown', e => { e.preventDefault(); hud.toggleShop(); });
    this._layoutExtra = this._layoutExtra.bind(this);
    on(window, 'resize', () => setTimeout(this._layoutExtra, 60));
    this._layoutExtra(); setTimeout(this._layoutExtra, 350);
  }
  /** Default placement of the last-hit / structure buttons around the attack button (Lead may restyle via #ids). */
  _layoutExtra() {
    const L = this.hud?.layout; if (!L || !this.lhBtn) return;
    if (this.hud.placeExtraButtons?.(this.lhBtn, this.twBtn)) return;   // HUD-owned layout wins when available
    const { a, A, R, cx, cy } = L; const s = Math.round(a * 0.58);
    const put = (el, x, y) => Object.assign(el.style, { position: 'absolute', left: Math.round(x - s / 2) + 'px', top: Math.round(y - s / 2) + 'px', width: s + 'px', height: s + 'px', right: 'auto', bottom: 'auto', pointerEvents: 'auto', zIndex: 3 });
    for (const el of [this.lhBtn, this.twBtn]) { el.style.setProperty('--s', s + 'px'); el.style.setProperty('--abs', s + 'px'); }
    // last-hit: tucked into the notch between Q and the attack button (bottom); structure: above the R button
    put(this.lhBtn, cx - A * 0.55, cy + A * 0.29);
    put(this.twBtn, cx + R * 0.035, cy - R - a / 2 - Math.round(a * 0.1) - s / 2);
  }
  _joySample() {
    if (!this.joy) return;
    const l = Math.hypot(this.joy.dx, this.joy.dy);
    if (l > 8) {
      const w = this.screenDirToWorld(this.joy.dx, this.joy.dy);
      const dot = w.x * this.lastDir.dx + w.y * this.lastDir.dy;
      if (dot < 0.997 || this.lastDir.t > 1) { this.issue({ type: 'moveDir', dx: w.x, dy: w.y }); this.lastDir = { dx: w.x, dy: w.y, t: 0 }; }
    } else if (this.lastDir.dx || this.lastDir.dy) { this.issue({ type: 'moveDir', dx: 0, dy: 0 }); this.lastDir = { dx: 0, dy: 0, t: 0 }; }
  }
  _joyDraw() {
    const el = this.joyEl; const j = this.joy; const R = (this.hud?.layout?.jb || 130) * 0.42;
    if (!j) { el.classList.remove('on'); return; }
    el.classList.add('on');
    const l = Math.hypot(j.dx, j.dy); const k = l > R ? R / l : 1;
    el.style.setProperty('--jx', j.ox + 'px'); el.style.setProperty('--jy', j.oy + 'px');
    el.style.setProperty('--kx', (j.dx * k) + 'px'); el.style.setProperty('--ky', (j.dy * k) + 'px');
  }
  _aimPoint(a) {
    const h = this.hero; const range = this.abilityRange(a.slot); const d = this.abilityDef(a.slot);
    const maxDrag = (this.hud?.layout?.a || 62) * 1.5;
    const len = Math.hypot(a.dx, a.dy); const frac = Math.min(1, len / maxDrag);
    const dir = this.screenDirToWorld(a.dx, a.dy);
    const tg = d?.targeting;
    const dist = tg === 'skillshot' ? range : Math.max(1, range * frac);
    const p = { x: h.x + dir.x * dist, y: h.y + dir.y * dist };
    if (tg === 'unit') {
      const team = d?.targetTeam || 'enemy';
      const t = this.m.findUnitAt?.(p.x, p.y, 4, u => team === 'enemy' ? (this.enemyFilter(u) && u.kind !== 'tower' && u.kind !== 'core') : (ALIVE(u) && u.kind === 'hero' && (team === 'any' || u.team === this.team)));
      if (t) { p.x = t.x; p.y = t.y; p.targetId = t.id; }
    } else if (tg === 'skillshot') {
      // gentle magnetism: a champion within ~7° of the drag direction gets the shot (with lead)
      let best = null, bd = 0.12;
      for (const e of this.enemyHeroes(range + 1)) { const vx = e.x - h.x, vy = e.y - h.y, l = Math.hypot(vx, vy) || 1; const ang = Math.acos(Math.max(-1, Math.min(1, (vx * dir.x + vy * dir.y) / l))); if (ang < bd) { bd = ang; best = e; } }
      if (best) { const q = this.lead(best, this.hitTime(a.slot, best)); const vx = q.x - h.x, vy = q.y - h.y, l = Math.hypot(vx, vy) || 1; p.x = h.x + vx / l * dist; p.y = h.y + vy / l * dist; p.targetId = best.id; }
    }
    return p;
  }
  // ---------- targeting helpers ----------
  setLock(id) { if (this.lockId === id) return; this.lockId = id; this.r?.setTargetLock?.(id); }
  lockTarget() {
    if (this.lockId == null) return null;
    const t = this.m.entities.get(this.lockId);
    if (!t || !this.enemyFilter(t) || Math.hypot(t.x - this.hero.x, t.y - this.hero.y) > 26) { this.setLock(null); return null; }
    return t;
  }
  enemyHeroes(range) { const h = this.hero; return (this.m.heroes || []).filter(e => e.team !== this.team && this.enemyFilter(e) && Math.hypot(e.x - h.x, e.y - h.y) - (e.radius || 0) <= range); }
  /** Predicted position after `secs` (uses the last sim tick's velocity; dashes ignored; capped lead). */
  lead(t, secs) {
    if (t.dash || t.prevX == null) return { x: t.x, y: t.y };
    const k = 1 / TICK_RATE;
    let vx = (t.x - t.prevX) / k, vy = (t.y - t.prevY) / k; const sp = Math.hypot(vx, vy);
    if (sp > 16) { vx *= 16 / sp; vy *= 16 / sp; }
    const L = Math.min(3, sp * secs * 0.8); if (sp < 0.5) return { x: t.x, y: t.y };
    return { x: t.x + vx / sp * L, y: t.y + vy / sp * L };
  }
  hitTime(slot, t) {
    const d = this.abilityDef(slot); const b = d?.bot || {}; const dist = Math.hypot(t.x - this.hero.x, t.y - this.hero.y);
    if (d?.targeting === 'skillshot') return dist / (b.speed || 38) + (b.delay || 0);
    if (d?.targeting === 'area' || d?.targeting === 'point') return (b.delay ?? 0.3);
    return 0;
  }
  autoDmg(t) {
    const h = this.hero; const raw = (h.stats?.power || 0) * (h.def?.attackRatio ?? 1);
    const eff = Math.max(0, (t.stats?.armor || 0) * (1 - (h.stats?.armorPen || 0)) - (h.stats?.flatPen || 0));
    return raw * 100 / (100 + eff);
  }
  /** Wild-Rift style target pick. mode: 'smart' | 'minion' | 'structure'. */
  pickTarget(mode = 'smart') {
    const h = this.hero; if (!h?.alive) return null;
    const R = (h.stats?.attackRange || 3) + (h.radius || 1) * 0.5;
    const all = this.m.unitsInRadius ? this.m.unitsInRadius(h.x, h.y, R + 9, u => this.enemyFilter(u)) : [];
    const gap = (u) => Math.hypot(u.x - h.x, u.y - h.y) - (u.radius || 0) - R;
    const isStruct = (u) => u.kind === 'tower' || u.kind === 'core';
    const farm = (u) => u.kind === 'minion' || u.kind === 'monster' || (u.kind === 'summon' && !u.wall);
    const killable = (u) => u.hp <= this.autoDmg(u) * (h.def?.ranged ? 1.05 : 1.0);
    const best = (list, score) => { let b = null, bs = Infinity; for (const u of list) { const s = score(u); if (s < bs) { bs = s; b = u; } } return b; };
    if (mode === 'structure') return best(all.filter(u => isStruct(u) && !u.protected?.(this.m) && gap(u) <= 9), gap);
    if (mode === 'minion') {
      const near = all.filter(u => farm(u) && gap(u) <= 1.5);
      return best(near.filter(killable), u => u.hp) || best(near, u => u.hp) || best(all.filter(u => farm(u) && gap(u) <= 7), gap);
    }
    const lock = this.lockTarget(); if (lock && gap(lock) <= 8) return lock;
    const heroes = all.filter(u => u.kind === 'hero' && gap(u) <= 1.5);
    const champ = best(heroes, u => u.hp / Math.max(1, u.maxHp) * 4 + gap(u) * 0.3);
    const farmIn = all.filter(u => farm(u) && gap(u) <= 1.0);
    const kill = best(farmIn.filter(killable), u => u.hp);
    const nearest = best(all.filter(u => !isStruct(u) && gap(u) <= 1.5), gap);
    const struct = best(all.filter(u => isStruct(u) && !u.protected?.(this.m) && gap(u) <= 1.0), gap);
    const champFirst = this.settings.champPriority !== false;
    return (champFirst ? (champ || kill) : (kill || nearest || champ)) || nearest || struct
      || best(all.filter(u => u.kind === 'hero' && gap(u) <= 6), gap) || best(all.filter(u => !isStruct(u) && gap(u) <= 6), gap);
  }
  smartCast(slot) {
    const h = this.hero; const d = this.abilityDef(slot); const range = this.abilityRange(slot); const tg = d?.targeting;
    if (tg === 'self') { this.issue({ type: 'cast', slot, x: h.x, y: h.y }); return; }
    const joyDir = this.joy && Math.hypot(this.joy.dx, this.joy.dy) > 10 ? this.screenDirToWorld(this.joy.dx, this.joy.dy) : null;
    const team = d?.targetTeam || 'enemy';
    if (tg === 'unit' && team !== 'enemy') { // ally / any targeted (heals, buffs): most hurt ally champion in range, else self
      const allies = (this.m.heroes || []).filter(a => a.alive && a.team === this.team && a !== h && Math.hypot(a.x - h.x, a.y - h.y) <= range + 1 && (!d.targetFilter || d.targetFilter(a, h)));
      let ally = null, bp = team === 'any' ? 0.75 : 2; for (const a of allies) { const p = a.hp / a.maxHp; if (p < bp) { bp = p; ally = a; } }
      if (team === 'any' && !ally) { const t = this.lockTarget() || this.enemyHeroes(range + 1)[0]; if (t) { this.issue({ type: 'cast', slot, x: t.x, y: t.y, targetId: t.id }); return; } if (h.hp < h.maxHp * 0.9) ally = h; }
      const t = ally || h; this.issue({ type: 'cast', slot, x: t.x, y: t.y, targetId: t.id }); return;
    }
    const reach = range + (tg === 'unit' ? 1.5 : tg === 'area' ? 2.5 : 1.5);
    const heroes = this.enemyHeroes(reach);
    let t = null; const lock = this.lockTarget();
    if (lock && lock.kind === 'hero' && heroes.includes(lock)) t = lock;
    else if (heroes.length) {
      // prefer the champion the joystick points at, then low HP / near
      let bs = Infinity;
      for (const e of heroes) {
        const dx = e.x - h.x, dy = e.y - h.y, l = Math.hypot(dx, dy) || 1;
        let s = l / range + e.hp / e.maxHp * 0.8;
        if (joyDir) s += (1 - (dx * joyDir.x + dy * joyDir.y) / l) * 0.8;
        if (s < bs) { bs = s; t = e; }
      }
    }
    const dashy = d?.bot?.kind === 'dash' || d?.bot?.kind === 'leap';
    if (!t && !dashy && tg !== 'point') t = (lock && lock.kind !== 'tower' && lock.kind !== 'core' ? lock : null) || this.nearestEnemy(range + 1, false, true);
    if (t) {
      const p = tg === 'unit' ? { x: t.x, y: t.y } : this.lead(t, this.hitTime(slot, t));
      this.issue({ type: 'cast', slot, x: p.x, y: p.y, targetId: t.id }); return;
    }
    if (tg === 'unit') { this.hud?.flashHint?.('No target in range'); return; }
    let ang = h.facing || 0; if (joyDir) ang = Math.atan2(joyDir.y, joyDir.x);
    const dist = tg === 'skillshot' || dashy ? range : range * 0.7;
    this.issue({ type: 'cast', slot, x: h.x + Math.cos(ang) * dist, y: h.y + Math.sin(ang) * dist });
  }
  nearestEnemy(range, heroesOnly, noStructures) {
    const h = this.hero;
    const all = this.m.unitsInRadius ? this.m.unitsInRadius(h.x, h.y, range, u => this.enemyFilter(u)) : [];
    let best = null, bd = 1e9;
    for (const u of all) { if (heroesOnly && u.kind !== 'hero') continue; if (noStructures && (u.kind === 'tower' || u.kind === 'core')) continue; const d = Math.hypot(u.x - h.x, u.y - h.y) - (u.radius || 0); if (d < bd) { bd = d; best = u; } }
    return best;
  }
  /** Attack button press: one swing at the best target ('once' → joystick movement resumes at the attack point). */
  autoAttack(mode = 'smart') {
    const h = this.hero; if (!h?.alive) return null;
    const t = this.pickTarget(mode);
    if (t) { this.issue({ type: 'attack', targetId: t.id, once: true }); this._lastAtkId = t.id; }
    return t;
  }

  // ---------- per frame ----------
  update(dt) {
    const h = this.hero; if (!h) return;
    if (this.joy) { this.lastDir.t += dt; this._joySample(); }
    // held attack: queue the next swing just before the attack timer is up (between swings the joystick moves you)
    if (this.atkHold && h.alive) {
      const o = h.order, m = this.m;
      const attacking = o?.type === 'attack' && !o.once && !this.joy;
      const ready = !h.windup && m.time >= (h.nextAttackAt || 0) - 0.05;
      if (ready && (!attacking || (this.atkHold.t += dt) > 0.25)) {
        this.atkHold.t = 0;
        const t = this.pickTarget(this.atkHold.mode);
        if (t && !(o?.type === 'attack' && o.id === t.id)) this.issue({ type: 'attack', targetId: t.id, once: true });
      }
    }
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
    this._h = []; this.joyEl?.remove(); this.ghostEl?.remove(); this.cancelEl?.remove(); this.lhBtn?.remove(); this.twBtn?.remove(); clearTimeout(this._lp); this.r?.setTargetLock?.(null);
    if (this.hud) this.hud.castCb = null;
  }
}
export default Input;
