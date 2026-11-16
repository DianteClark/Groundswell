// Ability building-block API passed to hero/relic/item/sigil code as `api`.
// OWNER: Agent A. Keep createApi(m) export and existing names working.
// All helpers are deterministic (use api.rng()).
import { dealDamage, heal, addShield, addStatus, removeStatus, cleanse, spawnProjectile, spawnArea, startDash, teleport, hasStatus, isTargetable, isUnit, canMove } from './combat.js';
import { DT, ticks } from './constants.js';

const STRUCT = (e) => e.kind === 'tower' || e.kind === 'core' || e.wall;

/** Point-to-segment distance squared helper. */
function segDist(px, py, x0, y0, x1, y1) {
  const vx = x1 - x0, vy = y1 - y0; const l2 = vx * vx + vy * vy;
  let t = l2 ? ((px - x0) * vx + (py - y0) * vy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const cx = x0 + vx * t, cy = y0 + vy * t; return Math.hypot(px - cx, py - cy);
}

export function createApi(m) {
  const api = {
    m,
    DT,
    /** ticks(sec): number of sim ticks in `sec` seconds — use for periodic `tickCount % N` checks. */
    ticks,
    get time() { return m.time; },
    rng: () => m.rng(),
    hasStatus, isTargetable, isUnit, canMove, segDist,

    // ---------------- damage / healing ----------------
    damage: (src, target, amount, opts) => dealDamage(m, src, target, amount, opts),
    /** Ability damage with an ability key (e.g. 'lumi_q'). Never hits structures. */
    hit: (src, target, amount, key, extra = {}) => {
      if (!target || STRUCT(target)) return 0;
      return dealDamage(m, src, target, amount, { type: 'ability', ability: key, ...extra });
    },
    /** Heal; src (hero) hooks: modifyHeal(api,src,target,info), onHealAlly(api,src,target,amount). */
    heal: (target, amount, src) => {
      if (!target) return 0;
      const info = { amount };
      if (src && src.kind === 'hero') m.callHooks(src, 'modifyHeal', target, info);
      const done = heal(m, target, info.amount, src);
      if (src && src.kind === 'hero' && done > 0) { src.healingDone = (src.healingDone || 0) + done; if (target !== src && target.kind === 'hero') m.callHooks(src, 'onHealAlly', target, done); }
      return done;
    },
    /** Shield; optional src hero gets modifyHeal (shields count as heals for power-ups) & onHealAlly. */
    shield: (target, amount, duration, tag, src) => {
      if (!target || !target.alive) return;
      const info = { amount };
      if (src && src.kind === 'hero') m.callHooks(src, 'modifyHeal', target, info);
      addShield(m, target, info.amount, duration, tag);
      if (src && src.kind === 'hero' && target !== src && target.kind === 'hero') m.callHooks(src, 'onHealAlly', target, info.amount);
    },
    removeShield: (target, tag) => { target.shields = target.shields.filter(s => s.tag !== tag); target.shield = target.shields.reduce((a, s) => a + s.amount, 0); },

    // ---------------- statuses / CC ----------------
    status: (target, key, duration, data) => addStatus(m, target, key, duration, data),
    removeStatus: (target, key, tag) => removeStatus(target, key, tag),
    cleanse: (t) => cleanse(t),
    /** Silent status refresh (no event) — for per-tick visual states like stacks. */
    setBuff: (e, key, duration, data = {}) => {
      const st = e.statuses.find(s => s.key === key);
      if (st) { st.until = m.time + duration; Object.assign(st, data); return st; }
      const ns = { key, until: m.time + duration, ...data }; e.statuses.push(ns); return ns;
    },
    tenacity: (t) => Math.min(0.6, t.stats?.tenacity || 0),
    /** Generic hard/soft CC with tenacity + onApplyCC hook. key: stun|root|silence|taunt|blind|slow|disarm */
    cc: (src, t, key, duration, data = {}) => {
      if (!t || !t.alive || STRUCT(t)) return null;
      if (t.epic && key !== 'slow') return null;
      const d = key === 'knockup' ? duration : duration * (1 - api.tenacity(t));
      const st = addStatus(m, t, key, d, { sourceId: src?.id, ...data });
      if (st && src) { const o = src.ownerId != null ? m.entities.get(src.ownerId) : src; if (o?.kind === 'hero') m.callHooks(o, 'onApplyCC', t, key, d); }
      return st;
    },
    stun: (src, t, d) => api.cc(src, t, 'stun', d),
    root: (src, t, d) => api.cc(src, t, 'root', d),
    silence: (src, t, d) => api.cc(src, t, 'silence', d),
    blind: (src, t, d) => api.cc(src, t, 'blind', d),
    taunt: (src, t, d, sourceId) => api.cc(src, t, 'taunt', d, sourceId != null ? { sourceId } : {}),
    slow: (src, t, amount, d, tag) => api.cc(src, t, 'slow', d, { amount, tag: tag || (src ? 'slow' + src.id : 'slow') }),
    speed: (t, amount, d, tag) => addStatus(m, t, 'speed', d, { amount, tag: tag || 'speed' }),
    knockup: (src, t, d) => { if (!t || STRUCT(t) || t.epic) return null; return api.cc(src, t, 'knockup', d); },
    /** Forced movement away from (fx,fy). */
    knockback: (src, t, fx, fy, distance, speed = 28) => {
      if (!t || !t.alive || STRUCT(t) || t.epic || t.static || hasStatus(t, 'unstoppable')) return;
      let dx = t.x - fx, dy = t.y - fy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      startDash(m, t, t.x + dx * distance, t.y + dy * distance, speed, { forced: true });
      if (src) { const o = src.ownerId != null ? m.entities.get(src.ownerId) : src; if (o?.kind === 'hero') m.callHooks(o, 'onApplyCC', t, 'knockback', distance / speed); }
    },
    /** Forced movement toward (x,y), stopping `stopAt` short. */
    pull: (src, t, x, y, speed = 24, stopAt = 1) => {
      if (!t || !t.alive || STRUCT(t) || t.epic || t.static || hasStatus(t, 'unstoppable')) return;
      const d = Math.hypot(x - t.x, y - t.y); if (d <= stopAt) return;
      const k = (d - stopAt) / d;
      startDash(m, t, t.x + (x - t.x) * k, t.y + (y - t.y) * k, speed, { forced: true });
    },
    /** Fear: forced slow walk away from source + 'fear' status for visuals. */
    fear: (src, t, duration) => {
      if (!t || !t.alive || STRUCT(t) || t.epic || t.kind === 'monster' || hasStatus(t, 'unstoppable')) return;
      const d = duration * (1 - api.tenacity(t));
      let dx = t.x - src.x, dy = t.y - src.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const sp = 5.5;
      addStatus(m, t, 'fear', d, { sourceId: src.id });
      startDash(m, t, t.x + dx * sp * d, t.y + dy * sp * d, sp, { forced: true });
      const o = src.ownerId != null ? m.entities.get(src.ownerId) : src; if (o?.kind === 'hero') m.callHooks(o, 'onApplyCC', t, 'fear', d);
    },
    /** Move a unit by (dx,dy) directly (soft pull), respecting nav. */
    nudge: (e, dx, dy) => {
      if (!e.alive || STRUCT(e) || e.epic || e.static || e.dash || hasStatus(e, 'unstoppable')) return;
      const nx = e.x + dx, ny = e.y + dy;
      if (!m.nav.blocked(nx, ny)) { e.x = nx; e.y = ny; } else if (!m.nav.blocked(nx, e.y)) e.x = nx; else if (!m.nav.blocked(e.x, ny)) e.y = ny;
    },
    mark: (t, key, duration, data = {}) => addStatus(m, t, key, duration, data),
    marked: (t, key, srcId) => t.statuses.find(s => s.key === key && (srcId == null || s.sourceId === srcId)) || null,

    // ---------------- spawning ----------------
    projectile: (opts) => spawnProjectile(m, opts),
    /** Straight skillshot that ignores structures. opts: {src, x?,y?, dirX, dirY, speed, range, radius, visual, pierce, heroesOnly, onHit(target, proj)->stop?, onEnd(proj)} */
    skillshot: (o) => {
      const src = o.src;
      return spawnProjectile(m, { src, x: o.x ?? src.x, y: o.y ?? src.y, dirX: o.dirX, dirY: o.dirY, speed: o.speed ?? 32, range: o.range ?? 12, radius: o.radius ?? 0.8,
        visual: o.visual, pierce: !!o.pierce, data: o.data, blockedByWalls: !!o.blockedByWalls,
        hitFilter: (e) => !STRUCT(e) && (!o.heroesOnly || e.kind === 'hero') && (!o.noMonsters || e.team !== 2) && (!o.filter || o.filter(e)),
        onHit: (mm, t, p) => o.onHit ? o.onHit(t, p) : true,
        onEnd: (mm, p) => o.onEnd?.(p) });
    },
    /** Homing projectile to a unit. opts: {src, target, speed, visual, onHit(target)} */
    homing: (o) => spawnProjectile(m, { src: o.src, x: o.x, y: o.y, targetId: o.target.id, speed: o.speed ?? 34, visual: o.visual, team: o.team, onHit: (mm, t) => o.onHit?.(t) }),
    area: (opts) => spawnArea(m, opts),
    /** Ground zone. opts:{src, x,y, radius, duration, visual, tickEvery, onTick(units, area), onEnd(area), followId, delay, data} — units are ALL units inside (filter yourself). */
    zone: (o) => spawnArea(m, { src: o.src, team: o.team, x: o.x, y: o.y, radius: o.radius, duration: o.duration, visual: o.visual, tickEvery: o.tickEvery ?? 0.25, delay: o.delay,
      followId: o.followId, data: o.data, onTick: o.onTick ? (mm, a, us) => o.onTick(us, a) : undefined, onEnd: o.onEnd ? (mm, a) => o.onEnd(a) : undefined }),
    /** Telegraphed delayed blast: shows `visual` area for `delay` then calls onBlast(enemies, area). */
    delayed: (o) => spawnArea(m, { src: o.src, x: o.x, y: o.y, radius: o.radius, duration: o.delay, visual: o.visual, tickEvery: 99, data: o.data,
      onEnd: (mm, a) => { if (o.src && o.requireAlive && !o.src.alive) return; o.onBlast(api.enemiesInRadius(o.src, a.x, a.y, a.radius), a); } }),
    dash: (e, x, y, speed, opts) => startDash(m, e, x, y, speed, opts),
    /** Dash that hits enemies along the path once each. opts:{speed, radius, onHit(target)->stop?, onArrive(), passWalls} */
    dashHit: (e, x, y, o = {}) => {
      const hitSet = new Set(); let stopped = false;
      const d = startDash(m, e, x, y, o.speed ?? 30, { passWalls: o.passWalls,
        onStep: (a, self, dd) => {
          if (stopped || !o.onHit) return;
          for (const t of api.enemiesInRadius(self, self.x, self.y, o.radius ?? 1.6)) {
            if (hitSet.has(t.id)) continue; hitSet.add(t.id);
            if (o.onHit(t) === true) { stopped = true; self.dash = null; o.onArrive?.(t); return; }
          }
        },
        onArrive: () => { if (!stopped) o.onArrive?.(null); } });
      return d;
    },
    teleport: (e, x, y) => teleport(m, e, x, y),
    schedule: (delay, fn) => m.schedule(delay, fn),
    mod: (e, opts) => m.addMod(e, opts),           // {duration, add:{power:10}, mul:{moveSpeed:1.2}, tag}
    removeMods: (e, tag) => m.removeMods(e, tag),
    tempHook: (e, hooks, duration, tag) => m.addTempHook(e, hooks, duration, tag),
    vfx: (key, data = {}) => m.emit({ t: 'vfx', key, ...data }),
    announce: (text, team) => m.emit({ t: 'announce', text, team }),
    hasAugment: (hero, level, choice) => !!hero.augments && hero.augments[level] === choice,
    aug: (hero, level, choice) => !!hero.augments && hero.augments[level] === choice,
    summon: (opts) => m.spawnSummon(opts),
    wall: (x, y, r, duration) => m.addWall(x, y, r, duration),

    // ---------------- queries ----------------
    isEnemy: (src, e) => e.alive && e.team !== src.team && isUnit(e) && isTargetable(e) && !STRUCT(e),
    /** Enemy units (heroes, minions, monsters, summons) — excludes towers/cores/walls. */
    enemiesInRadius: (src, x, y, r, filter) => m.unitsInRadius(x, y, r, e => e.team !== src.team && isUnit(e) && isTargetable(e) && !STRUCT(e) && (!filter || filter(e))),
    enemyHeroesInRadius: (src, x, y, r) => m.unitsInRadius(x, y, r, e => e.kind === 'hero' && e.team !== src.team && isTargetable(e)),
    alliesInRadius: (src, x, y, r, filter) => m.unitsInRadius(x, y, r, e => e.team === src.team && isUnit(e) && !STRUCT(e) && (!filter || filter(e))),
    allyHeroesInRadius: (src, x, y, r) => m.unitsInRadius(x, y, r, e => e.kind === 'hero' && e.team === src.team),
    heroesInRadius: (x, y, r, filter) => m.unitsInRadius(x, y, r, e => e.kind === 'hero' && e.alive && (!filter || filter(e))),
    /** Enemies within a rectangle from (x,y) along (dx,dy) of length len, half-width w. */
    enemiesInLine: (src, x, y, dx, dy, len, w, filter) => {
      const x1 = x + dx * len, y1 = y + dy * len;
      return m.unitsInRadius((x + x1) / 2, (y + y1) / 2, len / 2 + w, e => e.team !== src.team && isUnit(e) && isTargetable(e) && !STRUCT(e) && segDist(e.x, e.y, x, y, x1, y1) <= w + e.radius && (!filter || filter(e)));
    },
    /** Enemies in a cone (half-angle radians). */
    enemiesInCone: (src, x, y, dx, dy, range, half, filter) => m.unitsInRadius(x, y, range, e => {
      if (e.team === src.team || !isUnit(e) || !isTargetable(e) || STRUCT(e) || (filter && !filter(e))) return false;
      const ex = e.x - x, ey = e.y - y, l = Math.hypot(ex, ey); if (l < e.radius + 0.5) return true;
      const c = (ex * dx + ey * dy) / l; return Math.acos(Math.max(-1, Math.min(1, c))) <= half + Math.atan2(e.radius, l);
    }),
    /** Bounce from `from` to up to `count` enemies within `range`, calling onHit(t, i). Prefers heroes. */
    chain: (o) => {
      const hitSet = new Set(o.exclude || []);
      let cur = o.from, i = 0;
      const next = () => {
        if (i >= o.count || !cur) return;
        const cands = api.enemiesInRadius(o.src, cur.x, cur.y, o.range, e => !hitSet.has(e.id) && e.vis[o.src.team] && (!o.filter || o.filter(e)));
        if (!cands.length) return;
        cands.sort((a, b) => ((b.kind === 'hero') - (a.kind === 'hero')) || (api.dist(a, cur) - api.dist(b, cur)));
        const t = cands[0]; hitSet.add(t.id); const idx = i++;
        const fromE = cur;
        spawnProjectile(m, { src: o.src, x: fromE.x, y: fromE.y, targetId: t.id, speed: o.speed ?? 40, visual: o.visual,
          onHit: (mm, tt) => { o.onHit(tt, idx); cur = tt; next(); } });
      };
      next();
    },
    dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    level: (hero) => hero.level,
    /** base + perLevel*(level-1) + ratio*power */
    scale: (hero, base, perLevel, ratio = 0) => base + perLevel * (hero.level - 1) + ratio * (hero.stats?.power || 0),
    entity: (id) => m.entities.get(id),
    inCombat: (h, secs = 3) => m.time - (h.lastCombatAt ?? -99) < secs,
    clampToNav: (x, y) => m.nav.nearestFree(x, y),
    pointToward: (h, x, y, maxD) => { const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy) || 1; const k = Math.min(1, maxD / d); return { x: h.x + dx * k, y: h.y + dy * k }; },

    // ---------------- cooldowns / recasts / channels ----------------
    hasteMul: (h) => 1 - (h.stats?.haste || 0) / 100,
    /** Set slot cooldown to `secs` (haste applied unless raw). */
    setCooldown: (h, slot, secs, raw = false) => {
      const st = h.abilities[slot]; if (!st) return;
      const v = raw ? secs : secs * api.hasteMul(h);
      st.readyAt = m.time + v; st.cdMax = Math.max(v, 0.01); st.cd = v; st.ready = v <= 0;
    },
    reduceCooldown: (h, slot, secs) => m.reduceCooldown(h, slot, secs),
    /** Auto-attack timer reset (next auto can start immediately). */
    resetAttack: (h) => m.resetAttack(h),
    recastOpen: (h, slot) => { const r = h.data._recast?.[slot]; return r && r.until > m.time ? r : null; },
    /** Open a recast window. Returns a cast result ({cd}) to return from cast(). fullCd is the base cooldown (haste applied). */
    openRecast: (h, slot, window, fullCd, onExpire) => {
      h.data._recast = h.data._recast || {};
      const r = { until: m.time + window, start: m.time, fullCd };
      h.data._recast[slot] = r; h.abilities[slot].recastUntil = r.until;
      m.schedule(window, () => {
        if (h.data._recast[slot] !== r) return;
        delete h.data._recast[slot]; h.abilities[slot].recastUntil = null;
        api.setCooldown(h, slot, Math.max(0.5, fullCd * api.hasteMul(h) - window), true);
        onExpire?.();
      });
      return { cd: 0.3 };
    },
    /** Close a recast; returns cast result with remaining cooldown. */
    closeRecast: (h, slot) => {
      const r = h.data._recast?.[slot]; if (!r) return undefined;
      delete h.data._recast[slot]; h.abilities[slot].recastUntil = null;
      return { cd: Math.max(0.5, r.fullCd * api.hasteMul(h) - (m.time - r.start)) };
    },
    /** Start a channel. o:{duration, locksAll, locksMove, onTick(), onEnd(), unstoppable} */
    channel: (h, o) => {
      h.channel = { until: m.time + o.duration, start: m.time, locksAll: !!o.locksAll, locksMove: o.locksMove ?? !!o.locksAll, unstoppable: !!o.unstoppable, key: o.key,
        onTick: o.onTick ? (a, hh) => o.onTick(hh) : null, onEnd: o.onEnd ? (a, hh) => o.onEnd(hh) : null };
      h.order = null; h.path = null; h.windup = null;
      return h.channel;
    },
    /** Hero resource readout for UI (Heat, stacks...). */
    setResource: (h, name, value, max, color) => { h.resource = { name, value, max, color }; },
  };
  return api;
}
