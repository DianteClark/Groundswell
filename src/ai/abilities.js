// Bot ability usage: turns ability `bot` hints into cast commands. Owner: Agent A.
import { dist, hasSt } from './util.js';

/** Predict where `t` will be after `secs`, degraded by bot skill. */
export function predict(bb, t, secs) {
  const v = bb.vel(t); const L = bb.D.lead;
  const err = bb.D.aimErr; const r1 = bb.rng() * 2 - 1, r2 = bb.rng() * 2 - 1;
  return { x: t.x + v.x * secs * L + r1 * err, y: t.y + v.y * secs * L + r2 * err };
}

/** Line from h toward p blocked by a non-target enemy unit (minion/monster)? */
export function lineBlocked(bb, from, p, target, width = 1) {
  const dx = p.x - from.x, dy = p.y - from.y, L = Math.hypot(dx, dy) || 1;
  for (const e of bb.nearUnits) {
    if (e === target || e.team === bb.h.team || e.kind === 'hero' || !e.alive) continue;
    if (e.kind !== 'minion' && e.kind !== 'monster' && e.kind !== 'summon') continue;
    if (e.kind === 'summon' && (e.ghost || hasSt(e, 'untargetable'))) continue;
    const t = ((e.x - from.x) * dx + (e.y - from.y) * dy) / (L * L); if (t <= 0 || t >= 1) continue;
    const cx = from.x + dx * t, cy = from.y + dy * t;
    if (Math.hypot(e.x - cx, e.y - cy) < width + e.radius) return true;
  }
  return false;
}

const castAt = (bb, slot, x, y, targetId) => { bb.cmd({ type: 'cast', slot, x, y, targetId }); bb.lastCastAt = bb.m.time; return true; };

/**
 * Try to use an ability. mode: 'fight' | 'poke' | 'escape' | 'farm' | 'peel'.
 * t: primary enemy (hero/monster/minion) or null. Returns true if a command was issued.
 */
export function useAbility(bb, slot, mode, t) {
  const h = bb.h, m = bb.m; const def = h.def.abilities[slot]; const st = h.abilities[slot];
  if (!def || !st || !st.ready) return false;
  if (slot === 'r' && h.level < 5) return false;
  if (h.castLockUntil > m.time || h.dash || h.channel) return false;
  const hint = def.bot || {}; const range = typeof def.range === 'function' ? def.range(h) : def.range;
  const recast = h.data._recast?.[slot] && h.data._recast[slot].until > m.time;
  const d = t ? dist(h, t) : Infinity;
  const isHero = t?.kind === 'hero';
  const D = bb.D;

  // ---- recasts ----
  if (recast) {
    if (hint.recast === 'chase') {
      if (mode === 'escape') { const p = bb.retreatPoint(); return castAt(bb, slot, p.x, p.y); }
      if (t && d < 8) { const p = predict(bb, t, 0.15); return castAt(bb, slot, p.x, p.y); }
      if (m.time > h.data._recast[slot].until - 0.4) { const p = t || bb.retreatPoint(); return castAt(bb, slot, p.x, p.y); }
      return false;
    }
    if (hint.recast === 'return') {
      const img = m.entities.get(h.data.imgId);
      const back = img && (mode === 'escape' || h.hp < h.maxHp * 0.4 || (t && !t.alive) || (t && isHero && t.hp < t.maxHp * 0.15 ? false : m.time > h.data._recast[slot].until - 0.5 && bb.dangerAt(h.x, h.y) > bb.dangerAt(img.x, img.y)));
      if (back) return castAt(bb, slot, img.x, img.y);
      return false;
    }
    return false;
  }

  switch (hint.kind) {
    case 'skillshot': {
      if (!t) return false;
      if (mode === 'farm') {
        if (!hint.farm || t.kind === 'hero') return false;
        return castAt(bb, slot, t.x, t.y);
      }
      if (!isHero && mode !== 'fight') return false;
      if (d > range * 0.95) return false;
      const p = predict(bb, t, d / (hint.speed || 30));
      if (D.smartAim && def.bot.kind === 'skillshot' && h.heroId !== 'vex' && lineBlocked(bb, h, p, t, hint.radius || 0.8)) return false;
      return castAt(bb, slot, p.x, p.y);
    }
    case 'snipe': {
      if (!t || !isHero || mode === 'farm' || mode === 'escape') return false;
      if (d > range * 0.9 || d < 4) return false;
      if (bb.enemiesNear(h.x, h.y, 9).length) return false;
      const est = (220 + 55 * (h.level - 1) + 1.3 * h.stats.power + (t.maxHp - t.hp) * 0.3) * 100 / (100 + t.stats.armor);
      if (!(t.hp + (t.shield || 0) < est * 1.05 || (t.hp < t.maxHp * 0.5 && mode === 'fight'))) return false;
      const p = predict(bb, t, (hint.delay || 1) + d / (hint.speed || 80));
      return castAt(bb, slot, p.x, p.y);
    }
    case 'dash': {
      if (mode === 'escape') { if (!hint.escape) return false; const p = bb.retreatPoint(); return castAt(bb, slot, p.x, p.y); }
      if (mode === 'farm') return false;
      if (!t) return false;
      if (hint.kite) { // Vex tumble: reposition sideways/back while fighting, or chase a fleeing low target
        if (mode !== 'fight' || !isHero) return false;
        const myR = h.stats.attackRange;
        if (d < myR * 0.5 && bb.D.kite > 0.3) { const p = bb.awayFrom(t, 5); return castAt(bb, slot, p.x, p.y); }
        if (d > myR && d < myR + 5 && t.hp < t.maxHp * 0.3) return castAt(bb, slot, t.x, t.y);
        if (h.windup == null && m.time < h.nextAttackAt - 0.3 && d < myR * 0.9) { const side = bb.awayFrom(t, 4, 0.9); return castAt(bb, slot, side.x, side.y); }
        return false;
      }
      if (mode !== 'fight' || !isHero) return false;
      if (bb.towerDanger(t.x, t.y) && !bb.canDive(t)) return false;
      if (d > range + 1.5) return false;
      const p = predict(bb, t, d / 32);
      return castAt(bb, slot, p.x, p.y);
    }
    case 'leap': {
      if (mode === 'escape') { const p = bb.retreatPoint(); return castAt(bb, slot, p.x, p.y); }
      if (!t) return false;
      if (mode === 'farm') { if (t.kind === 'monster' && d < range) return castAt(bb, slot, t.x, t.y); return false; }
      if (mode !== 'fight' || d > range + 1) return false;
      if (bb.towerDanger(t.x, t.y) && !bb.canDive(t)) return false;
      const p = predict(bb, t, 0.3); return castAt(bb, slot, p.x, p.y);
    }
    case 'wall': {
      if (!t || !isHero) return false;
      if (mode === 'escape' || mode === 'peel') {
        if (d > 7) return false; // wall between us
        const mx = (h.x + t.x) / 2, my = (h.y + t.y) / 2; return castAt(bb, slot, mx, my);
      }
      if (mode === 'fight' && t.hp < t.maxHp * 0.6 && d < range) { // cut off its escape: wall behind target
        const f = bb.m.map.fountains[t.team]; const dx = f.x - t.x, dy = f.y - t.y, l = Math.hypot(dx, dy) || 1;
        return castAt(bb, slot, t.x + dx / l * 3, t.y + dy / l * 3);
      }
      return false;
    }
    case 'zone': {
      if (!t) return false;
      if (mode === 'farm') { if (!hint.farm) return false; if (bb.enemyMinionsNear(t.x, t.y, hint.radius || 3).length < 3 && t.kind !== 'monster') return false; return castAt(bb, slot, t.x, t.y); }
      if (!isHero || mode === 'escape') { if (mode === 'escape' && slot !== 'r' && t && isHero && d < range) { const p = predict(bb, t, hint.delay || 0.3); return castAt(bb, slot, p.x, p.y); } return false; }
      if (mode === 'poke' && !hint.poke) return false;
      if (d > range + (hint.radius || 3) * 0.6) return false;
      const p = predict(bb, t, (hint.delay || 0.3) + 0.1);
      const need = hint.minTargets || 1;
      if (need > 1) { const n = bb.enemyHeroesNear(p.x, p.y, (hint.radius || 4) * 0.9).length; if (n < Math.min(need, bb.visibleEnemies.length)) return false; }
      if (hint.finisher && slot === 'r' && t.hp > t.maxHp * 0.7 && bb.enemyHeroesNear(p.x, p.y, hint.radius || 4).length < 2) return false;
      if (hint.engage && slot === 'r' && bb.towerDanger(t.x, t.y) && !bb.canDive(t)) return false;
      return castAt(bb, slot, p.x, p.y);
    }
    case 'target': {
      if (!t || (mode !== 'fight' && mode !== 'poke')) return false;
      if (def.targetFilter && !def.targetFilter(t, h)) return false;
      if (mode === 'poke' && hint.engage) return false;
      if (d > range + (hint.engage ? 6 : 1.5)) return false;
      if (hint.engage && bb.towerDanger(t.x, t.y) && !bb.canDive(t)) return false;
      return castAt(bb, slot, t.x, t.y, t.id);
    }
    case 'parry': {
      if (!t) return false;
      if (mode === 'farm') return false;
      const recentlyHit = h.lastDamagedAt && m.time - h.lastDamagedAt < 0.4;
      if (d < (hint.radius || 4) && (recentlyHit || mode === 'escape' || bb.rng() < 0.3)) return castAt(bb, slot, h.x, h.y);
      return false;
    }
    case 'selfBuff': {
      if (mode !== 'fight' || !t || !isHero || d > (hint.radius || 6)) return false;
      if (t.hp < t.maxHp * 0.2 && bb.visibleEnemies.length < 2) return false;
      return castAt(bb, slot, h.x, h.y);
    }
    case 'selfAoE': {
      if (!t) return false;
      if (mode === 'farm') { if (slot !== 'r' && t.kind === 'monster' && d < (hint.radius || 5)) return castAt(bb, slot, h.x, h.y); return false; }
      if (!isHero) return false;
      const n = bb.enemyHeroesNear(h.x, h.y, (hint.radius || 5) * 0.85).length;
      if (!n) return false;
      if (mode === 'escape' || mode === 'peel') { if (hint.peel || hint.escape) return castAt(bb, slot, h.x, h.y); return false; }
      if (mode !== 'fight') return false;
      return castAt(bb, slot, h.x, h.y);
    }
    case 'heal': {
      // ally (incl. self) below 70% → heal; else poke enemy
      let best = null, bp = 0.7;
      for (const a of bb.allies) if (a.alive && dist(a, h) < range + 1) { const p = a.hp / a.maxHp; if (p < bp) { bp = p; best = a; } }
      if (best && (best !== h || bb.enemyHeroesNear(h.x, h.y, 14).length || h.hp < h.maxHp * 0.5)) return castAt(bb, slot, best.x, best.y, best.id);
      if (t && isHero && d < range && mode !== 'escape') return castAt(bb, slot, t.x, t.y, t.id);
      return false;
    }
    case 'allyBuff': {
      if (mode === 'escape') return castAt(bb, slot, h.x, h.y, h.id);
      if (mode !== 'fight' || !t) return false;
      let best = h, bv = 0;
      for (const a of bb.allies) if (a.alive && dist(a, h) < range + 1 && dist(a, t) < 14) { const v = a.stats.power * a.stats.attackSpeed * (a === h ? 0.6 : 1); if (v > bv) { bv = v; best = a; } }
      return castAt(bb, slot, best.x, best.y, best.id);
    }
    case 'allyEngage': {
      if (mode === 'farm') return false;
      let best = null, bs = 0;
      for (const a of bb.allies) {
        if (!a.alive || dist(a, h) > range) continue;
        const n = bb.enemyHeroesNear(a.x, a.y, (hint.radius || 4) * 0.9).length;
        const s = n * 2 + (a.hp < a.maxHp * 0.4 && n ? 2 : 0) + (a === h ? -0.5 : 0);
        if (n && s > bs) { bs = s; best = a; }
      }
      if (!best) return false;
      if (mode !== 'fight' && !(mode === 'peel' || mode === 'escape')) return false;
      return castAt(bb, slot, best.x, best.y, best.id);
    }
  }
  return false;
}

/** Relic usage. */
export function useRelic(bb, mode, t) {
  const h = bb.h, m = bb.m; const st = h.abilities.relic; if (!st?.ready) return false;
  const r = m.abilityDef(h, 'relic'); if (!r) return false;
  const kind = r.bot?.kind; const d = t ? dist(h, t) : Infinity;
  const lowHp = h.hp < h.maxHp * 0.28;
  const threatened = bb.enemyHeroesNear(h.x, h.y, 9).length > 0 || (h.lastDamagedAt && m.time - h.lastDamagedAt < 1 && h.lastAttackerId != null && m.entities.get(h.lastAttackerId)?.kind === 'hero');
  switch (kind) {
    case 'blink':
      if (mode === 'escape' && lowHp && threatened) { const p = bb.retreatPoint(); return castAt(bb, 'relic', p.x, p.y); }
      if (mode === 'fight' && t?.kind === 'hero' && bb.D.combo && t.hp < t.maxHp * 0.2 && d > h.stats.attackRange + 1 && d < 7 + h.stats.attackRange && h.hp > h.maxHp * 0.5 && !bb.towerDanger(t.x, t.y)) return castAt(bb, 'relic', t.x, t.y);
      return false;
    case 'defensive':
      if (lowHp && threatened) return castAt(bb, 'relic', h.x, h.y);
      return false;
    case 'mobility':
      if ((mode === 'escape' && threatened && h.hp < h.maxHp * 0.4) || (mode === 'fight' && t?.kind === 'hero' && t.hp < t.maxHp * 0.25 && d > h.stats.attackRange + 3)) return castAt(bb, 'relic', h.x, h.y);
      return false;
    case 'cleanse':
      if ((hasSt(h, 'stun') || hasSt(h, 'root') || hasSt(h, 'taunt') || hasSt(h, 'fear') || hasSt(h, 'knockup')) && threatened && h.hp < h.maxHp * 0.65) return castAt(bb, 'relic', h.x, h.y);
      return false;
    case 'ignite':
      if (t?.kind === 'hero' && d < 7 && (t.hp < t.maxHp * 0.3 || (mode === 'fight' && t.hp < t.maxHp * 0.45 && bb.rng() < 0.3))) return castAt(bb, 'relic', t.x, t.y, t.id);
      return false;
    case 'smite': {
      if (t?.kind === 'monster' && d < 7) {
        const dmg = 450 + 40 * (h.level - 1);
        if (t.hp <= dmg && (t.epic || h.hp < h.maxHp * 0.7 || bb.rng() < bb.D.smite)) return castAt(bb, 'relic', t.x, t.y, t.id);
        return false;
      }
      if (t?.kind === 'hero' && mode === 'fight' && d < 6 && t.hp < t.maxHp * 0.35 && !bb.objectiveSoon()) return castAt(bb, 'relic', t.x, t.y, t.id);
      return false;
    }
    case 'ward':
      if (mode === 'roam' && bb.wardSpot) return castAt(bb, 'relic', bb.wardSpot.x, bb.wardSpot.y);
      return false;
  }
  return false;
}
