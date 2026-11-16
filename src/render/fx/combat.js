// CombatFx (HEROES lead): event-driven combat feel on top of the renderer.
//   const cfx = new CombatFx(renderer);  in _event(ev): if (cfx.onEvent(ev)) return;  per frame: cfx.update(dt)
// Owns: attack/cast animation timing (attack {windup, period}), hit flash + flinch + heavy squash,
// impact sparks / debris, damage numbers (local-relevant, stacked, heavy/crit bigger), last-hit coin pop,
// kill bursts, melee swing arcs. Degrades gracefully when the new event fields are absent.
import * as THREE from 'three';
import { playAction, flinch, rigState } from '../anim/animator.js';
import { teamColor } from '../util.js';

const PI = Math.PI;
const COL = { dmg: '#ffffff', crit: '#ffb02e', heavy: '#ffcf3a', taken: '#ff4a4a', heal: '#5dff86', gold: '#ffd23a', ability: '#ffffff' };

export class CombatFx {
  constructor(R) { this.R = R; this.lastKill = null; this.time = 0; this.hitT = new Map(); }

  _view(id) { return this.R.views?.get(id); }
  _pos(e) { return this.R._ipos ? this.R._ipos(e) : { x: e.x, z: e.y }; }
  _colors(id) { return this.R._colorsFor?.(id) || { vfx: '#ffffff', vfx2: '#ffffff', fx: 'sparks', local: false }; }
  _near(x, z) { return this.R._evVisible ? this.R._evVisible(x, z) : true; }
  _vis(e) { return this.R._visible ? this.R._visible(e) : true; }
  _isLocal(id) { return this.R._isLocalId ? this.R._isLocalId(id) : false; }

  onEvent(ev) {
    if (globalThis.__cfxSkip && globalThis.__cfxSkip.includes(ev.t)) return false;
    try {
      switch (ev.t) {
        case 'attack': return this._attack(ev);
        case 'attack_hit': this._attackHit(ev); return true;
        case 'damage': return this._damage(ev);
        case 'cast': this._cast(ev); return false;
        case 'gold': return this._gold(ev);
        case 'death': this._death(ev); return false;
        case 'kill': this._kill(ev); return false;
        case 'impact': this._impact(ev); return false;
        default: return false;
      }
    } catch (err) { console.warn('CombatFx', err); return false; }
  }

  update(dt) {
    this.time += dt;
    const R = this.R; if (!R.views) return;
    for (const v of R.views.values()) {
      if (v.rig?.def && v.e) rigState(v.rig).ent = v.e;
      // legendary skins: ambient signature particles + soft ground glow (local hero louder)
      if (v.kind === 'hero' && v.skin?.rarity === 'legendary' && v.e?.alive && v.group?.visible && (v.opacity ?? 1) > 0.5) {
        const rate = v.isLocal ? 9 : 4; if (Math.random() < dt * rate) { const p = v.group.position; const a = Math.random() * PI * 2, r = 0.5 + Math.random() * 0.9; const c = v.colors || {}; R.vfx.trail(p.x + Math.cos(a) * r, p.y + 0.4 + Math.random() * (v.height || 3) * 0.7, p.z + Math.sin(a) * r, c.vfx2 || '#fff', { style: v.skin.fx || 'stars', vy: 0.9, life: 0.9, size: 0.45, color1: c.vfx }); }
      }
      if (v.heavyT > 0) { v.heavyT = Math.max(0, v.heavyT - dt * 4); const u = v.rig?.mat?.userData?.u; if (u) u.flashColor.value.setRGB(1, 1 - v.heavyT * 0.25, 1 - v.heavyT * 0.6); }
    }
  }

  // ───────────────────────── attacks
  _attack(ev) {
    const R = this.R; const v = this._view(ev.srcId); const s = R._ent?.(ev.srcId); const t = R._ent?.(ev.targetId);
    if (v) v.atk = (v.atk || 0) + 1;
    if (v?.rig && (s?.kind === 'hero' || v.wolf)) {
      const period = ev.period ?? s?.anim?.dur ?? (s?.stats?.attackSpeed ? 1 / s.stats.attackSpeed : 1);
      const windup = ev.windup ?? (s?.windup?.at != null ? Math.max(0.03, s.windup.at - (R.match?.time ?? 0)) : undefined);
      playAction(v.rig, 'attack', { period, windup });
    }
    if (!s || !t || !this._vis(s)) return true;
    const p = this._pos(s); if (!this._near(p.x, p.z)) return true;
    if (s.kind === 'tower') { R.vfx.flash(p.x, 6.4, p.z, { color: teamColor(s.team), size: 5, dur: 0.3 }); R.vfx.star(p.x, 6.4, p.z, { color: '#ffffff', size: 2.5, dur: 0.15 }); }
    else if (s.kind === 'hero' && !s.def?.ranged) {
      // melee swing arc timed to the strike (windup) — follows the attacker
      const c = this._colors(ev.srcId); const wind = ev.windup ?? Math.max(0.08, Math.min(0.4, 0.3 / (s.stats?.attackSpeed || 1)));
      const flip = (v?.atk || 0) % 2 === 1;
      R._later?.(Math.max(0, wind - 0.06), () => {
        const sp = this._pos(s); const tp = this._pos(t); const ang = Math.atan2(tp.z - sp.z, tp.x - sp.x);
        const big = s.heroId === 'bram' || s.heroId === 'garrok';
        R.vfx.slash(sp.x + Math.cos(ang) * 0.4, 1.4 + (big ? 0.4 : 0), sp.z + Math.sin(ang) * 0.4, ang, { color: c.vfx, r: (big ? 2.6 : 2.2) + (s.radius || 1) * 0.3, flip, dur: 0.2, tilt: flip ? -0.35 : 0.35, alpha: c.local ? 1 : 0.75 });
      });
    }
    return true;
  }
  _attackHit(ev) {
    const R = this.R; const s = R._ent?.(ev.srcId), t = R._ent?.(ev.targetId); if (!t) return;
    const p = this._pos(t); if (!this._near(p.x, p.z) || !this._vis(t)) return;
    const sp = s ? this._pos(s) : null; const dir = sp ? Math.atan2(p.z - sp.z, p.x - sp.x) : null;
    const c = this._colors(ev.srcId); const tv = this._view(ev.targetId);
    R.vfx.impact(p.x, Math.min(1.8, (tv?.height ?? 2) * 0.5), p.z, { color: c.vfx, color2: c.vfx2, dir, strength: ev.heavy ? 2 : 1 });
    this.hitT.set(ev.targetId, this.time);
  }

  // ───────────────────────── damage
  _damage(ev) {
    const R = this.R; const t = R._ent?.(ev.targetId); if (!t) return true;
    const v = this._view(ev.targetId); const s = ev.srcId != null ? R._ent?.(ev.srcId) : null;
    const heavy = !!(ev.heavy || ev.crit || ev.empowered);
    if (v) {
      v.flash = Math.max(v.flash || 0, heavy ? 1 : 0.8);
      if (v.rig?.def) { const tp = this._pos(t); const sp = s ? this._pos(s) : null; flinch(v.rig, heavy || (ev.amount > (t.maxHp || 1000) * 0.12), sp ? Math.atan2(tp.z - sp.z, tp.x - sp.x) : null); }
      if (heavy) v.heavyT = 1;
    }
    const fromLocal = this._isLocal(ev.srcId), toLocal = this._isLocal(ev.targetId);
    const p = this._pos(t); const h = (v?.height ?? 2) + 0.5;
    const amt = Math.round(ev.amount || 0);
    if (amt >= 1 && (fromLocal || toLocal) && this._vis(t)) {
      if (fromLocal) {
        const kind = ev.crit ? 'crit' : heavy ? 'heavy' : ev.ability ? 'ability' : 'dmg';
        const c = ev.ability ? this._abilityTint(ev.srcId) : COL[kind];
        R.vfx.text(String(amt) + (ev.crit ? '!' : ''), p.x, h, p.z, { kind, color: c, key: ev.targetId, scale: kind === 'dmg' ? 0.82 : 0.95 });
      } else R.vfx.text('-' + amt, p.x + 0.9, h - 0.5, p.z, { kind: 'taken', color: COL.taken, scale: 0.7, key: 'me' });
    }
    // impact sparks (skip if an explicit attack_hit already did it this frame)
    if (this._near(p.x, p.z) && this._vis(t) && this.time - (this.hitT.get(ev.targetId) ?? -1) > 0.03 && ev.type !== 'true') {
      const c = s ? this._colors(ev.srcId) : { vfx: '#ffffff', vfx2: '#ffffff' };
      const sp = s ? this._pos(s) : null; const dir = sp ? Math.atan2(p.z - sp.z, p.x - sp.x) : null;
      const isAuto = ev.type === 'auto' || (!ev.ability && ev.type !== 'tower');
      const str = heavy ? 2 : isAuto ? 1 : 0.8;
      if (t.kind === 'minion' && !fromLocal) { if (Math.random() < 0.5) R.vfx.impact(p.x, 1.0, p.z, { color: c.vfx, color2: c.vfx2, dir, strength: 0.6 }); }
      else R.vfx.impact(p.x, Math.min(1.9, (v?.height ?? 2) * 0.5), p.z, { color: c.vfx, color2: c.vfx2, dir, strength: str });
    }
    return true;
  }
  _abilityTint(srcId) { const c = this._colors(srcId); const col = new THREE.Color(c.vfx2 || '#ffffff').lerp(new THREE.Color(1, 1, 1), 0.35); return '#' + col.getHexString(); }

  // ───────────────────────── casts / gold / kills
  _cast(ev) {
    const v = this._view(ev.srcId); if (!v?.rig) return;
    rigState(v.rig).castSlot = ev.slot;
    playAction(v.rig, 'cast', { slot: ev.slot });
  }
  _death(ev) {
    if (ev.killerId != null && this._isLocal(ev.killerId)) { const e = this.R._ent?.(ev.id); if (e) { const p = this._pos(e); this.lastKill = { x: p.x, z: p.z, t: this.time, kind: e.kind }; } }
    const e = this.R._ent?.(ev.id); if (!e) return;
    if (e.kind === 'minion' && this._near(e.x, e.y)) { const p = this._pos(e); this.R.vfx.debris(p.x, 0.8, p.z, teamColor(e.team), 5, { size: 0.9 }); }
  }
  _gold(ev) {
    if (!this._isLocal(ev.id) || !(ev.amount >= 10)) return true;
    const h = this.R._ent?.(ev.id); if (!h) return true;
    const lk = this.lastKill && this.time - this.lastKill.t < 0.35 ? this.lastKill : null;
    const p = lk ? { x: lk.x, z: lk.z } : this._pos(h);
    this.R.vfx.coinPop(p.x, 1.4, p.z, Math.min(9, 2 + ev.amount / 12));
    this.R.vfx.text('+' + Math.round(ev.amount), p.x, (lk ? 2.4 : 3.2), p.z, { kind: 'gold', color: COL.gold, scale: 0.8, dur: 1.0, vx: 0 });
    return true;
  }
  _kill(ev) {
    const R = this.R; const vctm = R._ent?.(ev.victimId); if (!vctm) return; const p = this._pos(vctm);
    if (!this._near(p.x, p.z)) return;
    const k = R._ent?.(ev.killerId); const kc = k ? this._colors(ev.killerId) : null; const col = kc?.vfx || teamColor(k?.team ?? 2);
    R.vfx.killBurst(p.x, p.z, col, kc?.vfx2 || '#ffffff', this._isLocal(ev.killerId) ? 1.2 : 0.9);
  }
  _impact(ev) { const R = this.R; if (!this._near(ev.x, ev.y)) return; const s = ev.strength ?? 1; R.vfx.crack(ev.x, ev.y, { r: 1.5 + s * 1.2 }); R.vfx.debris(ev.x, 0.3, ev.y, '#8a7a68', 5 * s); R.vfx.burst(ev.x, 0.3, ev.y, '#c8bca8', 6 * s, { style: 'dust', radius: s }); }
}
