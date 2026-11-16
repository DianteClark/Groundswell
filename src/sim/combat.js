// Core combat primitives: stats, damage, healing, shields, statuses, projectiles, areas, dashes.
// Agent A's blocks.js builds a friendly ability API on top of these.
import { DT, ASSIST_WINDOW } from './constants.js';

export const hasStatus = (e, key) => { const s = e.statuses; for (let i = 0; i < s.length; i++) if (s[i].key === key) return s[i]; return null; };
export const isCC = (e) => !!(hasStatus(e, 'stun') || hasStatus(e, 'knockup') || e.dash?.forced);
export const canMove = (e) => !(hasStatus(e, 'stun') || hasStatus(e, 'root') || hasStatus(e, 'knockup') || e.channel?.locksMove);
export const canAttack = (e) => !(hasStatus(e, 'stun') || hasStatus(e, 'knockup') || hasStatus(e, 'disarm'));
export const canCast = (e) => !(hasStatus(e, 'stun') || hasStatus(e, 'knockup') || hasStatus(e, 'silence'));
export const isTargetable = (e) => e.alive && !hasStatus(e, 'untargetable');

/** Add (or refresh) a status. data may include amount (slow/speed fraction), sourceId, etc. */
export function addStatus(m, target, key, duration, data = {}) {
  if (!target.alive) return null;
  if (hasStatus(target, 'unstoppable') && ['stun', 'root', 'slow', 'knockup', 'taunt', 'silence'].includes(key)) return null;
  const until = m.time + duration;
  const st = { key, until, ...data };
  // same key from same source refreshes
  const ex = target.statuses.findIndex(s => s.key === key && s.sourceId === data.sourceId && s.tag === data.tag);
  if (ex >= 0) target.statuses[ex] = st; else target.statuses.push(st);
  if (key === 'stun' || key === 'knockup' || key === 'root' || key === 'silence' || key === 'taunt') interruptRecall(m, target);
  if (key === 'stun' || key === 'knockup') { target.windup = null; if (target.channel && !target.channel.unstoppable) target.channel = null; }
  m.emit({ t: 'status', id: target.id, key, duration });
  return st;
}
export function removeStatus(target, key, tag) { target.statuses = target.statuses.filter(s => !(s.key === key && (tag === undefined || s.tag === tag))); }
export function cleanse(target) { target.statuses = target.statuses.filter(s => !['stun', 'root', 'slow', 'silence', 'taunt', 'blind', 'knockup', 'disarm'].includes(s.key)); }

/** Shields: list of {amount, until, tag}. */
export function addShield(m, target, amount, duration, tag = 'shield') {
  if (!target.alive) return;
  target.shields.push({ amount, until: m.time + duration, tag });
  target.shield = target.shields.reduce((a, s) => a + s.amount, 0);
  m.emit({ t: 'shield', id: target.id, amount });
}

export function heal(m, target, amount, src = null) {
  if (!target.alive || amount <= 0) return 0;
  if (hasStatus(target, 'grievous')) amount *= 0.6;
  const before = target.hp; target.hp = Math.min(target.maxHp, target.hp + amount);
  const done = target.hp - before;
  if (done > 0.5) m.emit({ t: 'heal', targetId: target.id, srcId: src?.id, amount: Math.round(done) });
  return done;
}

export function interruptRecall(m, e) { if (e.recalling) { e.recalling = null; m.emit({ t: 'recall_cancel', id: e.id }); } }

/**
 * Deal damage. opts: { type:'auto'|'ability'|'true'|'tower'|'item'|'monster', ability, noLifesteal, noHooks, vfx }
 * Returns damage actually dealt to hp+shield.
 */
export function dealDamage(m, src, target, amount, opts = {}) {
  if (!target || !target.alive || amount <= 0) return 0;
  if (hasStatus(target, 'invulnerable') || target.invulnerable) return 0;
  if (target.protected && target.protected(m)) return 0; // towers/core protection
  // resolve owner (projectiles/areas/summons credit their owner)
  const owner = src ? (src.ownerId != null ? (m.entities.get(src.ownerId) || src) : src) : null;
  const info = { amount, type: opts.type || 'ability', ability: opts.ability, src: owner, target, crit: false, empowered: !!opts.empowered, heavy: !!opts.heavy };
  if (!opts.noHooks) {
    if (owner) m.callHooks(owner, 'modifyDamageDealt', target, info);
    m.callHooks(target, 'modifyDamageTaken', owner, info);
  }
  let dmg = info.amount;
  const statSrc = owner?.stats ? owner : null;
  if (info.type !== 'true') {
    const pen = statSrc ? (statSrc.stats.armorPen || 0) : 0;
    const flat = statSrc ? (statSrc.stats.flatPen || 0) : 0;
    const eff = Math.max(0, target.stats.armor * (1 - pen) - flat);
    dmg = dmg * 100 / (100 + eff);
  }
  if (target.damageReduction) dmg *= (1 - target.damageReduction);
  if (m.finalSwell && (target.kind === 'tower' || target.kind === 'core')) dmg *= 1.25;
  dmg = Math.max(0, dmg);
  // shields absorb
  let toHp = dmg;
  if (target.shields.length) {
    for (const s of target.shields) { const a = Math.min(s.amount, toHp); s.amount -= a; toHp -= a; if (toHp <= 0) break; }
    target.shields = target.shields.filter(s => s.amount > 0.01);
    target.shield = target.shields.reduce((a, s) => a + s.amount, 0);
  }
  target.hp -= toHp;
  target.lastDamagedAt = m.time;
  if (owner) {
    target.lastAttackerId = owner.id;
    if (target.kind === 'hero' || target.kind === 'monster') { target.damagers = target.damagers || {}; target.damagers[owner.id] = m.time; }
    if (owner.kind === 'hero') { owner.lastCombatAt = m.time; if (target.kind === 'hero') { owner.damageDealt = (owner.damageDealt || 0) + dmg; owner.aggroAt = m.time; } }
  }
  if (target.kind === 'hero') target.damageTaken = (target.damageTaken || 0) + dmg;
  if (target.kind === 'hero') { target.lastCombatAt = m.time; if (toHp > 0) interruptRecall(m, target); }
  const ev = { t: 'damage', srcId: src?.id, targetId: target.id, amount: Math.round(dmg), type: info.type, ability: info.ability, crit: info.crit };
  const big = target.kind === 'hero' || target.kind === 'monster';
  if (info.crit || info.heavy || opts.execute || (info.type === 'ability' && big && dmg >= target.maxHp * 0.12)) ev.heavy = true;
  if (info.empowered) ev.empowered = true;
  m.emit(ev);
  // lifesteal
  if (owner && owner.kind === 'hero' && owner.alive && !opts.noLifesteal && src.kind !== 'summon' && owner.stats.lifesteal > 0 && target.kind !== 'tower' && target.kind !== 'core') {
    const ls = info.type === 'auto' ? owner.stats.lifesteal : owner.stats.lifesteal * 0.35;
    heal(m, owner, dmg * ls, owner);
  }
  if (owner && !opts.noHooks) m.callHooks(owner, 'onDamageDealt', target, { amount: dmg, type: info.type, ability: info.ability });
  if (!opts.noHooks) m.callHooks(target, 'onDamageTaken', owner, { amount: dmg, type: info.type });
  if (target.hp <= 0) m.kill(target, src);
  if (!target.alive) ev.kill = true;
  if (ev.heavy || ev.kill || ev.empowered) impactFeedback(m, owner, target, ev, dmg);
  return dmg;
}

/** Feel events for render/audio: camera kick ('impact') and, when the LOCAL hero is involved, a tiny 'hitstop'. */
function impactFeedback(m, owner, target, ev, dmg) {
  const heroKill = ev.kill && target.kind === 'hero';
  const local = m._localHeroId;
  const localInvolved = local != null && (owner?.id === local || target.id === local);
  if (!ev.heavy && !heroKill && ev.empowered) {
    if (target.kind === 'hero' || target.kind === 'monster') m.emit({ t: 'impact', x: target.x, y: target.y, strength: 0.4, kind: 'empowered', srcId: owner?.id ?? null, targetId: target.id });
    if (!ev.kill) return;
  }
  if (!ev.heavy && !heroKill) {
    // plain kills: only the local player's last hits get a light kick
    if (ev.kill && localInvolved && owner?.id === local && (target.kind === 'minion' || target.kind === 'monster')) m.emit({ t: 'impact', x: target.x, y: target.y, strength: 0.2, kind: 'lasthit', srcId: owner.id, targetId: target.id });
    return;
  }
  const strength = heroKill ? 1 : Math.min(0.85, 0.35 + dmg / Math.max(1, target.maxHp));
  m.emit({ t: 'impact', x: target.x, y: target.y, strength: Math.round(strength * 100) / 100, kind: heroKill ? 'kill' : ev.crit ? 'crit' : ev.empowered ? 'empowered' : 'heavy', srcId: owner?.id ?? null, targetId: target.id });
  if (localInvolved && (heroKill || target.kind === 'hero' || target.epic) && (m._hitstopAt ?? -1) + 0.15 <= m.time) {
    m._hitstopAt = m.time;
    m.emit({ t: 'hitstop', duration: heroKill ? 0.09 : target.kind === 'hero' ? 0.06 : 0.04, srcId: owner?.id ?? null, targetId: target.id });
  }
}

/** Projectile. opts: { src, x, y, dirX, dirY | targetId (homing), speed, range, radius, team, visual:'key', pierce:false,
 *  hitFilter(e)->bool, onHit(m, target, proj)->(true to stop), onEnd(m, proj), hitsUnits:true, data } */
export function spawnProjectile(m, opts) {
  const p = m.addEntity({
    kind: 'projectile', team: opts.team ?? opts.src?.team, x: opts.x ?? opts.src.x, y: opts.y ?? opts.src.y,
    radius: opts.radius ?? 0.6, speed: opts.speed ?? 30, range: opts.range ?? 20, traveled: 0,
    dirX: opts.dirX ?? 1, dirY: opts.dirY ?? 0, targetId: opts.targetId ?? null, pierce: !!opts.pierce, hit: new Set(),
    srcId: opts.src?.id, ownerId: opts.src ? (opts.src.ownerId ?? opts.src.id) : null,
    visual: { model: opts.visual || 'orb' }, onHit: opts.onHit, onEnd: opts.onEnd, hitFilter: opts.hitFilter, data: opts.data || {},
    hitsUnits: opts.hitsUnits !== false, blockedByWalls: !!opts.blockedByWalls, alive: true, hp: 1, maxHp: 1,
  });
  const len = Math.hypot(p.dirX, p.dirY) || 1; p.dirX /= len; p.dirY /= len;
  p.facing = Math.atan2(p.dirY, p.dirX);
  return p;
}

export function updateProjectile(m, p) {
  const src = m.entities.get(p.srcId);
  if (p.targetId != null) {
    const t = m.entities.get(p.targetId);
    if (!t || !t.alive) { m.remove(p); return; }
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
    const step = p.speed * DT;
    if (d <= step + t.radius * 0.5) { p.x = t.x; p.y = t.y; if (p.onHit) p.onHit(m, t, p); m.remove(p); return; }
    p.dirX = dx / d; p.dirY = dy / d; p.facing = Math.atan2(dy, dx);
    p.x += p.dirX * step; p.y += p.dirY * step; return;
  }
  const step = Math.min(p.speed * DT, Math.max(0, p.range - p.traveled));
  const x0 = p.x, y0 = p.y;
  p.x += p.dirX * step; p.y += p.dirY * step; p.traveled += step;
  if (p.blockedByWalls && m.nav.blocked(p.x, p.y)) { p.onEnd?.(m, p); m.remove(p); return; }
  if (p.hitsUnits) {
    // swept test over this tick's segment, nearest-first (no tunnelling, deterministic order)
    const cands = m.unitsInRadius((x0 + p.x) / 2, (y0 + p.y) / 2, p.radius + step / 2 + 3, e => e.team !== p.team && isTargetable(e) && e.kind !== 'projectile' && e.kind !== 'area' && !p.hit.has(e.id) && (!p.hitFilter || p.hitFilter(e)));
    const along = (e) => (e.x - x0) * p.dirX + (e.y - y0) * p.dirY;
    if (cands.length > 1) cands.sort((a, b) => along(a) - along(b) || a.id - b.id);
    for (const e of cands) {
      const t = Math.max(0, Math.min(step, along(e)));
      if (Math.hypot(e.x - (x0 + p.dirX * t), e.y - (y0 + p.dirY * t)) <= p.radius + e.radius) {
        p.hit.add(e.id);
        const stop = p.onHit ? p.onHit(m, e, p) : true;
        if (!p.pierce || stop === true) { if (!p.pierce || stop === true) { m.remove(p); return; } }
      }
    }
  }
  if (p.traveled >= p.range) { p.onEnd?.(m, p); m.remove(p); }
}

/** Ground area. opts: { src, x, y, radius, duration, team, visual, tickEvery, onTick(m, area, unitsInside), onEnter, onEnd(m, area), followId, data, delay } */
export function spawnArea(m, opts) {
  return m.addEntity({
    kind: 'area', team: opts.team ?? opts.src?.team, x: opts.x, y: opts.y, radius: opts.radius ?? 4,
    srcId: opts.src?.id, ownerId: opts.src ? (opts.src.ownerId ?? opts.src.id) : null,
    duration: opts.duration ?? 2, endAt: m.time + (opts.duration ?? 2), tickEvery: opts.tickEvery ?? 0.5, nextTick: m.time + (opts.delay ?? 0),
    visual: { model: opts.visual || 'ring' }, onTick: opts.onTick, onEnd: opts.onEnd, followId: opts.followId ?? null,
    data: opts.data || {}, alive: true, hp: 1, maxHp: 1, inside: new Set(), onEnter: opts.onEnter,
  });
}

export function updateArea(m, a) {
  if (a.followId != null) { const f = m.entities.get(a.followId); if (f && f.alive) { a.x = f.x; a.y = f.y; } }
  if (a.onEnter) {
    const now = m.unitsInRadius(a.x, a.y, a.radius, e => isUnit(e));
    for (const e of now) if (!a.inside.has(e.id)) { a.inside.add(e.id); a.onEnter(m, a, e); }
  }
  if (a.onTick && m.time >= a.nextTick) {
    a.nextTick = m.time + a.tickEvery;
    a.onTick(m, a, m.unitsInRadius(a.x, a.y, a.radius, e => isUnit(e)));
  }
  if (m.time >= a.endAt) { a.onEnd?.(m, a); m.remove(a); }
}

export const isUnit = (e) => e.alive && (e.kind === 'hero' || e.kind === 'minion' || e.kind === 'monster' || e.kind === 'summon' || e.kind === 'tower' || e.kind === 'core');

/** Dash / knockback: moves entity to (tx,ty) at speed; forced=true for knockbacks (counts as CC). onArrive(m,e). Stops at walls unless passWalls. */
export function startDash(m, e, tx, ty, speed, opts = {}) {
  if (!opts.passWalls) {
    // clip to first blocked point
    const d = Math.hypot(tx - e.x, ty - e.y); const n = Math.ceil(d / 0.5);
    let lx = e.x, ly = e.y;
    for (let i = 1; i <= n; i++) { const t = i / n; const x = e.x + (tx - e.x) * t, y = e.y + (ty - e.y) * t; if (m.nav.blocked(x, y)) break; lx = x; ly = y; }
    tx = lx; ty = ly;
  } else {
    const f = m.nav.nearestFree(tx, ty); tx = f.x; ty = f.y;
  }
  e.dash = { tx, ty, speed, forced: !!opts.forced, onArrive: opts.onArrive, onStep: opts.onStep, passWalls: !!opts.passWalls, hit: new Set() };
  e.path = null;
  if (opts.forced) { interruptRecall(m, e); e.windup = null; }
  return e.dash;
}

/** Instant reposition (blink). */
export function teleport(m, e, x, y) {
  const f = m.nav.nearestFree(x, y); e.x = f.x; e.y = f.y; e.prevX = e.x; e.prevY = e.y; e.path = null; e.dash = null;
}
