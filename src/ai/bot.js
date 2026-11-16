// Bot AI. Owner: Agent A.
// Bots act ONLY via m.issue(playerId, cmd) and only see enemies with e.vis[team] (fog-fair).
import { MAP } from '../sim/map.js';
import * as C from '../sim/constants.js';
import { makeRng } from '../sim/rng.js';
import { ITEM_BY_ID } from '../data/items.js';
import { dist, hasSt, laneGeo, laneProject, lanePoint, laneOf, autoDmg, burstEstimate, fightValue, TOWER_RANGE } from './util.js';
import { useAbility, useRelic } from './abilities.js';

// Difficulty profiles: 1 Recruit → 5 Mythic
const DIFF = {
  1: { react: 0.45, aimErr: 2.6, lead: 0.15, lastHit: 0.4, abil: 0.35, kite: 0, dodge: 0, aggro: 0.85, retreatHp: 0.2, combo: false, smartAim: false, smite: 0.35, focus: 0.3, macro: 0.4 },
  2: { react: 0.33, aimErr: 1.7, lead: 0.5, lastHit: 0.62, abil: 0.55, kite: 0.25, dodge: 0.1, aggro: 0.95, retreatHp: 0.25, combo: false, smartAim: false, smite: 0.6, focus: 0.55, macro: 0.6 },
  3: { react: 0.25, aimErr: 1.0, lead: 0.75, lastHit: 0.8, abil: 0.75, kite: 0.6, dodge: 0.3, aggro: 1.0, retreatHp: 0.28, combo: true, smartAim: true, smite: 0.8, focus: 0.75, macro: 0.8 },
  4: { react: 0.18, aimErr: 0.55, lead: 0.92, lastHit: 0.92, abil: 0.9, kite: 0.85, dodge: 0.55, aggro: 1.05, retreatHp: 0.3, combo: true, smartAim: true, smite: 0.92, focus: 0.9, macro: 0.92 },
  5: { react: 0.12, aimErr: 0.2, lead: 1.0, lastHit: 1.0, abil: 1.0, kite: 1.0, dodge: 0.8, aggro: 1.1, retreatHp: 0.3, combo: true, smartAim: true, smite: 1, focus: 1, macro: 1 },
};

// ---------------- team coordination (shared per match/team) ----------------
function teamBrain(m, team) {
  m._botTeams = m._botTeams || {};
  return (m._botTeams[team] = m._botTeams[team] || { call: null, evalAt: 0, team });
}

function evaluateTeam(bb) {
  const m = bb.m, team = bb.h.team, T = teamBrain(m, team);
  if (m.time < T.evalAt) return T;
  T.evalAt = m.time + 1.5;
  const mine = m.heroes.filter(h => h.team === team), theirs = m.heroes.filter(h => h.team !== team);
  const aliveA = mine.filter(h => h.alive).length, aliveE = theirs.filter(h => h.alive).length;
  const lvlA = mine.reduce((a, h) => a + h.level, 0) / mine.length, lvlE = theirs.reduce((a, h) => a + h.level, 0) / Math.max(1, theirs.length);
  const healthyA = mine.filter(h => h.alive && h.hp > h.maxHp * 0.5).length;
  const adv = aliveA - aliveE;
  const call = T.call;
  if (call && m.time > call.until) { if (call.type === 'objective') { T.lastObjFail = T.lastObjFail || {}; T.lastObjFail[call.key] = m.time; } T.call = null; }
  if (T.call?.type === 'objective') { const o = m.objectives[T.call.key]; if (!o.alive) T.call = null; }
  // structures under minion pressure → nearest bot defends; core / base threatened → everyone
  T.defendWave = null;
  let worst = null, wScore = 0;
  for (const st of m.entities.values()) {
    if ((st.kind !== 'tower' && st.kind !== 'core') || st.team !== team || !st.alive) continue;
    if (!st.lastDamagedAt || m.time - st.lastDamagedAt > 3) continue;
    const mins = m.unitsInRadius(st.x, st.y, 16, e => e.kind === 'minion' && e.team !== team).length;
    if (mins < 2) continue;
    const prio = st.kind === 'core' ? 4 : st.tier === 'base' ? 3 : st.tier === 'inner' ? 2 : 1;
    const sc = prio * 10 + mins - st.hp / st.maxHp * 5;
    if (sc > wScore) { wScore = sc; worst = st; }
  }
  if (worst) {
    const prio = worst.kind === 'core' ? 4 : worst.tier === 'base' ? 3 : worst.tier === 'inner' ? 2 : 1;
    T.defendWave = { x: worst.x, y: worst.y, id: worst.id, prio, all: prio >= 3 && worst.hp < worst.maxHp * 0.7 };
  }
  // Defend: enemy heroes seen near one of our towers
  for (const tw of m.entities.values()) {
    if (tw.kind !== 'tower' || tw.team !== team || !tw.alive) continue;
    const foes = theirs.filter(e => e.alive && e.vis[team] && dist(e, tw) < 20);
    if (foes.length >= 2 && tw.lastDamagedAt && m.time - tw.lastDamagedAt < 3 && aliveA >= foes.length) { T.call = { type: 'defend', x: tw.x, y: tw.y, until: m.time + 12, lane: tw.lane }; return T; }
  }
  if (T.call) return T;
  if (bb.D.macro < bb.rng()) return T;
  // Objectives (late game: pushing beats objectives unless the enemy is down two)
  if (!(m.time > 900 && adv < 2)) for (const key of ['colossus', 'wyrm']) {
    const o = m.objectives[key]; if (!o.alive) continue;
    const enemyBaseOpen = [...m.entities.values()].some(e => e.kind === 'tower' && e.team !== team && e.alive && e.tier === 'base' && !e.protected?.(m)) || ![...m.entities.values()].some(e => e.kind === 'tower' && e.team !== team && e.alive && e.tier === 'base');
    if (enemyBaseOpen && adv >= 2) break; // go end instead
    const need = key === 'colossus' ? ((adv >= 2 && lvlA >= 7) || (adv >= 1 && lvlA >= 10) || (m.time > 960 && adv >= 0 && healthyA >= 3)) : ((adv >= 2) || (adv >= 1 && lvlA >= 6) || (adv >= 0 && lvlA >= 7 && lvlA >= lvlE + 0.5 && healthyA >= 3) || (m.time > 600 && healthyA >= 3 && adv >= 0));
    if (need && healthyA >= 2 && (T.lastObjFail?.[key] || -99) + 60 < m.time) { const pit = MAP.pits[key]; T.call = { type: 'objective', key, x: pit.x, y: pit.y, until: m.time + 30, start: m.time }; return T; }
  }
  // Group push
  const late = m.time > 600;
  if ((adv >= 2 && healthyA >= 2 && m.time > 240) || (late && adv >= 0 && healthyA >= 2) || (m.time > 420 && adv >= 1 && healthyA >= 2)) {
    // choose lane whose next enemy tower is weakest
    let best = null, bh = Infinity;
    for (const lane of ['top', 'bot']) {
      const tws = [...m.entities.values()].filter(e => e.kind === 'tower' && e.team !== team && e.alive && (e.lane === lane || e.lane === 'base'));
      const tgt = tws.find(t => t.lane === lane && t.tier === 'outer') || tws.find(t => t.lane === lane) || tws.find(t => t.lane === 'base');
      const score = tgt ? tgt.hp : 0;
      if (score < bh) { bh = score; best = lane; }
    }
    T.call = { type: 'push', lane: best, until: m.time + (late ? 40 : 25) };
  }
  return T;
}

export class BotBrain {
  constructor(m, hero, opts = {}) {
    this.m = m; this.h = hero; this.hero = hero;
    this.difficulty = Math.max(1, Math.min(5, opts.difficulty || 2));
    this.D = DIFF[this.difficulty];
    this.index = opts.index ?? 0;
    this.rng = makeRng(((m.seed || 1) * 7919 + hero.id * 104729) >>> 0);
    const pref = hero.def.bot?.preferredRole || 'lane';
    this.role = opts.role || (pref === 'jungle' ? 'jungle' : 'lane');
    // a non-jungler in the jungle slot (without a jungle relic) plays as a roamer: duo bot lane, gank, take safe camps
    // Pre-match loadout adaptation (bots only, before the first tick): a jungle-slot bot always brings Hunter's Brand + Predator.
    if (this.role === 'jungle' && hero.isBot && m.tickCount === 0) {
      if (hero.relicId !== 'hunters_brand') { hero.relicId = 'hunters_brand'; hero.loadout.relic = 'hunters_brand'; }
      if (!hero.sigilIds.includes('predator')) { hero.sigilIds = ['predator', ...hero.sigilIds.filter(x => x !== hero.loadout.sigils?.offense)]; hero.loadout.sigils = { ...hero.loadout.sigils, offense: 'predator' }; }
      m._recomputeHeroStats(hero); hero.hp = hero.maxHp;
    }
    if (this.role === 'jungle' && pref !== 'jungle' && hero.relicId !== 'hunters_brand') this.role = 'roam';
    if (this.role === 'support') this.role = 'roam';
    this.lane = opts.lane || (this.role === 'jungle' ? null : this.role === 'roam' ? 'bot' : (this.index % 2 === 0 ? 'top' : 'bot'));
    this.next = m.time + 0.1 + this.index * 0.05 + (hero.team ? 0.025 : 0);
    this.seen = new Map();   // enemy id -> {x,y,t,vx,vy}
    this.lastCmd = null; this.lastCmdAt = -9;
    this.lastCastAt = -9;
    this.mode = 'idle';
    this.gank = null; this.lastStuck = { x: hero.x, y: hero.y, t: 0 };
    this.recalledAt = -99;
    this.campVisits = 0;
  }

  // ---------------- perception ----------------
  vel(t) { const s = this.seen.get(t.id); return s && this.m.time - s.t < 1 ? { x: s.vx, y: s.vy } : { x: 0, y: 0 }; }
  perceive() {
    const m = this.m, h = this.h, team = h.team;
    this.allies = m.heroes.filter(e => e.team === team && e.alive);
    this.visibleEnemies = m.heroes.filter(e => e.team !== team && e.alive && e.vis[team] && !hasSt(e, 'untargetable'));
    for (const e of this.visibleEnemies) {
      const s = this.seen.get(e.id);
      if (s && m.time - s.t > 0.05 && m.time - s.t < 1) { const dt = m.time - s.t; const k = 0.6; s.vx = s.vx * (1 - k) + (e.x - s.x) / dt * k; s.vy = s.vy * (1 - k) + (e.y - s.y) / dt * k; s.x = e.x; s.y = e.y; s.t = m.time; }
      else this.seen.set(e.id, { x: e.x, y: e.y, t: m.time, vx: 0, vy: 0 });
    }
    this.nearUnits = m.unitsInRadius(h.x, h.y, 26, e => e.kind !== 'projectile' && e.kind !== 'area' && !e.wall && (e.team === team || e.vis[team]));
    this.towers = []; for (const e of m.entities.values()) if (e.kind === 'tower' && e.alive) this.towers.push(e);
  }
  enemiesNear(x, y, r) { return this.visibleEnemies.filter(e => Math.hypot(e.x - x, e.y - y) < r); }
  enemyHeroesNear(x, y, r) { return this.enemiesNear(x, y, r); }
  enemyMinionsNear(x, y, r) { return this.nearUnits.filter(e => e.kind === 'minion' && e.team !== this.h.team && e.alive && Math.hypot(e.x - x, e.y - y) < r); }
  alliedMinionsNear(x, y, r) { return this.nearUnits.filter(e => e.kind === 'minion' && e.team === this.h.team && e.alive && Math.hypot(e.x - x, e.y - y) < r); }
  enemyTowerAt(x, y, pad = 1.5) { for (const t of this.towers) if (t.team !== this.h.team && Math.hypot(t.x - x, t.y - y) < TOWER_RANGE + pad) return t; return null; }
  /** Is (x,y) inside an enemy tower's reach without allied minions to tank? */
  towerDanger(x, y) {
    const t = this.enemyTowerAt(x, y); if (!t) return false;
    if (t.target === this.h.id) return true;
    const tanks = this.nearUnits.filter(e => (e.kind === 'minion' || (e.kind === 'summon' && !e.ghost && !hasSt(e, 'untargetable'))) && e.team === this.h.team && e.alive && dist(e, t) < TOWER_RANGE + 1).length;
    return tanks < 2;
  }
  canDive(t) {
    const h = this.h;
    if (this.difficulty < 2) return false;
    const killable = burstEstimate(h, t, this.m) * (1 + this.allies.filter(a => a !== h && dist(a, t) < 12).length * 0.7) > t.hp + (t.shield || 0);
    return killable && h.hp > h.maxHp * 0.55 && this.allies.length >= this.visibleEnemies.length;
  }
  dangerAt(x, y) { let d = 0; for (const e of this.visibleEnemies) { const r = Math.hypot(e.x - x, e.y - y); if (r < 14) d += 14 - r; } if (this.enemyTowerAt(x, y, 0)) d += 10; return d; }
  objectiveSoon() { const o = this.m.objectives; return o.wyrm.alive || o.colossus.alive; }

  // ---------------- commands ----------------
  cmd(c) { this.m.issue(this.h.playerId, c); this.lastCmd = c; this.lastCmdAt = this.m.time; }
  moveTo(x, y, force = false) {
    const h = this.h, o = h.order;
    if (this.nearEnemyFountain(x, y, 1)) { const f = MAP.fountains[1 - h.team]; const dx = x - f.x, dy = y - f.y, l = Math.hypot(dx, dy) || 1; x = f.x + dx / l * 22; y = f.y + dy / l * 22; if (l < 1) { x = f.x + (h.team ? 22 : -22); } const q = this.m.nav.nearestFree(x, y); x = q.x; y = q.y; }
    const dNew = Math.hypot(h.x - x, h.y - y);
    if (!force) {
      // commit to movement decisions: ignore tiny re-targets, short reversals and idle micro-steps (no twitching)
      if (o?.type === 'move') {
        if (Math.hypot(o.x - x, o.y - y) < 1.5) return;
        const cx = o.x - h.x, cy = o.y - h.y, nx = x - h.x, ny = y - h.y;
        const cl = Math.hypot(cx, cy) || 1, nl = dNew || 1;
        if ((cx * nx + cy * ny) / (cl * nl) < -0.17 && this.m.time - (this.lastMoveAt || -9) < 0.9) return;   // no flip-flopping
      } else if (!o && dNew < 1.6) return;
      if (h.windup) return; // don't cancel an attack in progress
    }
    if (dNew < 0.5 && !o) return;
    this.lastMoveAt = this.m.time;
    this.cmd({ type: 'move', x, y });
  }
  attack(t) {
    if (!t.vis[this.h.team]) { this.moveTo(t.x, t.y); return; }
    if (t.kind !== 'core' && this.nearEnemyFountain(t.x, t.y, 2)) { this.moveTo(t.x, t.y); return; }
    const o = this.h.order; if (o?.type === 'attack' && o.id === t.id) return; this.cmd({ type: 'attack', targetId: t.id });
  }
  fountain() { return MAP.fountains[this.h.team]; }
  awayFrom(t, L = 4, side = 0) {
    const h = this.h; let dx = h.x - t.x, dy = h.y - t.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const f = this.fountain(); let fx = f.x - h.x, fy = f.y - h.y; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    let ax = dx * 0.65 + fx * 0.35, ay = dy * 0.65 + fy * 0.35;
    if (side) { const s = (this.rng() < 0.5 ? 1 : -1) * side; const rx = ax - ay * s, ry = ay + ax * s; ax = rx; ay = ry; }
    const al = Math.hypot(ax, ay) || 1;
    const p = this.m.nav.nearestFree(h.x + ax / al * L, h.y + ay / al * L); return p;
  }
  retreatPoint() {
    const h = this.h, f = this.fountain();
    // nearest allied tower that is "behind" us, else fountain
    let best = null, bd = Infinity;
    for (const t of this.towers) if (t.team === h.team) { const dT = dist(t, f), dH = dist(h, f); if (dT < dH - 4) { const d = dist(h, t); if (d < bd) { bd = d; best = t; } } }
    const tgt = best && bd > 6 ? best : f;
    const dx = tgt.x - h.x, dy = tgt.y - h.y, l = Math.hypot(dx, dy) || 1;
    // step direction biased away from closest enemy
    return { x: h.x + dx / l * Math.min(10, l), y: h.y + dy / l * Math.min(10, l), far: tgt };
  }

  // ---------------- main loop ----------------
  think() {
    const m = this.m, h = this.h;
    if (m.time < this.next) return;
    this.next = m.time + this.D.react * (0.8 + this.rng() * 0.4);
    if (h.pendingAugment) this.pickAugment();
    if (!h.alive) { this.shop(); this.gank = null; return; }
    this.perceive();
    const T = evaluateTeam(this);
    if (m.canShop(h)) { this.shop(); if (h.hp < h.maxHp * 0.85 && dist(h, this.fountain()) < 6 && !this.visibleEnemies.some(e => dist(e, h) < 20)) { this.moveTo(this.fountain().x + (h.team ? -2 : 2), this.fountain().y); return; } }
    if (h.channel) return;
    if (h.recalling) {
      if (this.visibleEnemies.some(e => dist(e, h) < 13)) { const p = this.retreatPoint(); this.cmd({ type: 'move', x: p.x, y: p.y }); }
      return;
    }
    if (this.dodge()) return;

    const hpF = h.hp / h.maxHp;
    const nearE = this.enemiesNear(h.x, h.y, 16);
    const nearA = this.allies.filter(a => dist(a, h) < 16);
    const tw = this.enemyTowerAt(h.x, h.y, 0.5);
    const towerOnMe = (tw && tw.target === h.id) || this.nearEnemyFountain(h.x, h.y, 0.5);

    // ---- retreat ----
    const outnumbered = nearE.length >= nearA.length + 2 || (nearE.length > nearA.length && hpF < 0.5);
    if (hpF < this.D.retreatHp || (outnumbered && hpF < 0.7) || (towerOnMe && !this.committedKill(nearE))) {
      if (this.retreat(nearE, towerOnMe)) return;
    }

    // ---- fight ----
    const tgt = this.pickTarget(T);
    if (tgt) { this.fight(tgt); return; }
    {
      const la = this.heroAttacker(1.5);
      if (la && la.vis[h.team] && dist(la, h) < la.stats.attackRange + 7) {
        if (this.retreat(nearE, towerOnMe)) return;
      }
    }
    if (this.backOff()) return;

    // ---- recall to shop / heal ----
    if (this.wantRecall(hpF)) { this.cmd({ type: 'recall' }); this.recalledAt = m.time; return; }

    // ---- macro ----
    if (T.defendWave && this.defendWave(T.defendWave, hpF)) return;
    if (T.call && this.followCall(T.call, hpF)) return;
    if (this.role === 'jungle') this.jungle(); else if (this.role === 'roam') this.roam(); else this.laning();
    this.unstick();
  }

  /** Not fighting, but an enemy champion can hit us: step out of its reach. */
  backOff() {
    const h = this.h, m = this.m;
    let worst = null, over = 0;
    for (const e of this.visibleEnemies) {
      const reach = e.stats.attackRange + (e.def.ranged ? 1.5 : 3.5) + h.radius;
      const o = reach - dist(e, h);
      if (o > over) { over = o; worst = e; }
    }
    if (!worst) return false;
    const hitByHero = !!this.heroAttacker(1.2);
    if (!hitByHero && !(worst.def.ranged === false && over > 2) && h.hp > h.maxHp * 0.6) return false;
    if (this.rng() > 0.35 + this.D.macro * 0.65) return false;
    const p = this.awayFrom(worst, Math.min(6, over + 1.5));
    this.cmd({ type: 'move', x: p.x, y: p.y });
    return true;
  }
  /** Most recent enemy champion that damaged us within `secs` (uses the public damage log on the hero). */
  heroAttacker(secs = 1.5) {
    const h = this.h, m = this.m; let best = null, bt = -1;
    if (!h.damagers) return null;
    for (const id in h.damagers) { const t = h.damagers[id]; if (m.time - t > secs || t <= bt) continue; const e = m.entities.get(+id); if (e?.kind === 'hero' && e.team !== h.team && e.alive) { bt = t; best = e; } }
    return best;
  }
  nearEnemyFountain(x, y, pad = 0) { const f = MAP.fountains[1 - this.h.team]; return Math.hypot(f.x - x, f.y - y) < 20 + pad; }
  committedKill(nearE) { return nearE.some(e => e.hp < burstEstimate(this.h, e, this.m) * 0.7) && this.h.hp > this.h.maxHp * 0.4; }

  retreat(nearE, towerOnMe) {
    const h = this.h, m = this.m;
    const closest = nearE.reduce((b, e) => (!b || dist(e, h) < dist(b, h) ? e : b), null);
    // defensive tools
    if (closest && dist(closest, h) < 10) {
      if (useRelic(this, 'escape', closest)) return true;
      for (const s of ['w', 'q', 'r']) if (this.rng() < this.D.abil && useAbility(this, s, 'escape', closest)) return true;
      if (this.rng() < this.D.abil * 0.6) for (const s of ['w', 'q', 'r']) if (useAbility(this, s, 'peel', closest)) return true;
    }
    if (!closest && !towerOnMe && h.hp < h.maxHp * 0.55 && dist(h, this.fountain()) > 30 && this.safeToRecall()) { this.cmd({ type: 'recall' }); this.recalledAt = m.time; return true; }
    const p = this.retreatPoint();
    this.moveTo(p.far.x, p.far.y, !(h.order?.type === 'move' && Math.hypot(h.order.x - p.far.x, h.order.y - p.far.y) < 2));
    return true;
  }

  safeToRecall() {
    const h = this.h, m = this.m;
    if (h.lastDamagedAt && m.time - h.lastDamagedAt < 2) return false;
    if (this.visibleEnemies.some(e => dist(e, h) < 22)) return false;
    return !this.nearUnits.some(e => e.team !== h.team && e.alive && (e.kind === 'minion' || e.kind === 'monster' || e.kind === 'summon') && dist(e, h) < 12 && !e.ghost);
  }
  wantRecall(hpF) {
    const h = this.h, m = this.m;
    if (dist(h, this.fountain()) < 40) return false;
    if (!this.safeToRecall()) return false;
    if (m.time - this.recalledAt < 20) return false;
    if (hpF < 0.35) return true;
    const next = this.cheapestNext();
    if (next == null) return false;
    const rich = h.gold >= next + 350 && (h.gold >= 1050 || hpF < 0.6);
    if (rich) { // don't recall while a big wave is about to crash on our tower
      return true;
    }
    return hpF < 0.5 && h.gold >= next;
  }
  cheapestNext() {
    const h = this.h, m = this.m; let c = null;
    for (let s = 0; s < 3; s++) { const np = m.nextPurchase(h, s); if (!np) continue; const cost = np.branch ? Math.min(np.costA, np.costB) : np.cost; if (c == null || cost < c) c = cost; }
    return c;
  }

  // ---------------- shopping / augments ----------------
  shop() {
    const h = this.h, m = this.m; if (!m.canShop(h)) return;
    let gold = h.gold; const tiers = h.items.map(i => i ? i.tier : 0);
    for (let guard = 0; guard < 9; guard++) {
      let bought = false;
      for (let s = 0; s < 3; s++) {
        const baseId = h.loadout.items[s]; const def = ITEM_BY_ID[baseId]; if (!def) continue;
        const tier = tiers[s]; if (tier >= 3) continue;
        // finish earlier slots before starting later ones (but allow cheap tier-1 starts)
        if (s > 0 && tiers[s - 1] < 3 && tier >= 1 && tiers.slice(0, s).some(t => t < 3)) continue;
        const branch = h.def.bot?.branches?.[baseId] || 'a';
        const cost = tier === 0 ? def.tiers[0].cost : tier === 1 ? def.tiers[1].cost : def.branches[branch].cost;
        if (gold < cost) { if (tiers.slice(0, s + 1).some(t => t < 3)) break; continue; }
        gold -= cost; tiers[s]++;
        this.cmd(tier === 2 ? { type: 'buyBranch', slot: s, branch } : { type: 'buy', slot: s });
        bought = true; break;
      }
      if (!bought) break;
    }
  }
  pickAugment() {
    const h = this.h, lv = h.pendingAugment; if (!lv) return;
    let c = h.def.bot?.augments?.[lv];
    if (!c || this.rng() > this.D.focus) c = this.rng() < 0.5 ? 'a' : 'b';
    this.cmd({ type: 'augment', level: lv, choice: c });
  }

  // ---------------- dodging ----------------
  dodge() {
    const h = this.h, m = this.m;
    if (this.D.dodge <= 0 || (this.dodgeAt && m.time - this.dodgeAt < 0.6) || !h.alive || h.channel) return false;
    for (const p of m.entities.values()) {
      if (p.kind !== 'projectile' || p.team === h.team || p.targetId != null || !p.hitsUnits) continue;
      const rx = h.x - p.x, ry = h.y - p.y; const along = rx * p.dirX + ry * p.dirY;
      if (along < 0 || along > 14) continue;
      const perp = rx * p.dirY - ry * p.dirX;
      if (Math.abs(perp) > p.radius + h.radius + 0.4) continue;
      if (this.rng() > this.D.dodge) { this.dodgeAt = m.time; return false; }
      const s = perp >= 0 ? 1 : -1;
      const x = h.x + p.dirY * s * 3.2, y = h.y - p.dirX * s * 3.2;
      const f = m.nav.nearestFree(x, y);
      this.dodgeAt = m.time; this.cmd({ type: 'move', x: f.x, y: f.y });
      return true;
    }
    return false;
  }

  // ---------------- fighting ----------------
  pickTarget(T) {
    const h = this.h; if (!this.visibleEnemies.length) return null;
    const range = h.stats.attackRange;
    const engage = range + (h.def.ranged ? 5 : 8);
    let best = null, bs = -Infinity;
    for (const e of this.visibleEnemies) {
      const d = dist(h, e);
      const allyFighting = this.allies.some(a => a !== h && dist(a, e) < 10);
      const helpRange = this.role === 'jungle' || this.gank ? 30 : 22;
      if (d > engage && !(allyFighting && d < helpRange) && !(this.gank && this.gank.targetId === e.id && d < 30)) continue;
      if (hasSt(e, 'invisible')) continue;
      if (this.nearEnemyFountain(e.x, e.y, 3)) continue;
      // under-tower rule: only if we can dive, or we can hit it without entering tower range
      if (this.towerDanger(e.x, e.y) && !this.canDive(e) && (d > range || this.towerDanger(h.x, h.y))) continue;
      const killable = burstEstimate(h, e, this.m) > e.hp + (e.shield || 0);
      const s = -d * 0.6 - (e.hp / e.maxHp) * 25 * this.D.focus + (killable ? 30 : 0) + (allyFighting ? 6 : 0) + (e.def.role === 'Marksman' || e.def.role === 'Mage' ? 4 * this.D.focus : 0);
      if (s > bs) { bs = s; best = e; }
    }
    if (!best) return null;
    if (!this.shouldFight(best)) {
      // laning poke instead of all-in
      this.pokeTarget = best; return null;
    }
    this.pokeTarget = null;
    return best;
  }
  /** Lanchester-style side strength around a point: heroes + minions + towers. */
  sideStrength(team, x, y, r) {
    const m = this.m; let ehp = 0, dps = 0;
    const heroes = team === this.h.team ? this.allies : this.visibleEnemies;
    for (const a of heroes) if (Math.hypot(a.x - x, a.y - y) < r || a === this.h) { const v = fightValue(a); ehp += v.ehp; dps += v.dps; }
    for (const u of this.nearUnits) {
      if (u.team !== team || !u.alive || Math.hypot(u.x - x, u.y - y) > 11) continue;
      if (u.kind === 'minion') dps += u.stats.power * 0.6 * u.stats.attackSpeed * 0.8;
      else if (u.kind === 'summon' && !u.ghost && u.stats.power > 0) { dps += u.stats.power * u.stats.attackSpeed; ehp += u.hp * 0.5; }
    }
    for (const tw of this.towers) if (tw.team === team && Math.hypot(tw.x - x, tw.y - y) < TOWER_RANGE + 1) dps += tw.stats.power * tw.stats.attackSpeed * (1 + m.time / 600);
    return { ehp, dps };
  }
  shouldFight(t) {
    const h = this.h, m = this.m;
    const cx = (h.x + t.x) / 2, cy = (h.y + t.y) / 2;
    const ours = this.sideStrength(h.team, cx, cy, 16), theirs = this.sideStrength(t.team, cx, cy, 16);
    const missing = m.heroes.filter(e => e.team !== h.team && e.alive && !e.vis[h.team]).length;
    const caution = 1 + missing * 0.1 * this.D.macro;
    const ratio = (ours.ehp * ours.dps) / Math.max(1, theirs.ehp * theirs.dps * caution);
    const killable = burstEstimate(h, t, m) * (1 + this.allies.filter(a => a !== h && dist(a, t) < 12).length * 0.6) > t.hp + (t.shield || 0);
    const engaged = this.fightId === t.id && m.time - this.fightAt < 2;
    const attackedBy = h.damagers?.[t.id] && m.time - h.damagers[t.id] < 1.5;
    const thr = engaged ? 0.8 : attackedBy ? 0.75 : 1.35;
    const ok = ratio * this.D.aggro > thr || (killable && h.hp > h.maxHp * 0.3 && ratio > 0.6);
    if (ok) { this.fightId = t.id; this.fightAt = m.time; }
    return ok;
  }
  fight(t) {
    const h = this.h, m = this.m;
    this.mode = 'fight';
    const d = dist(h, t);
    // abilities
    if (m.time - this.lastCastAt > 0.15 && this.rng() < this.D.abil + 0.15) {
      if (useRelic(this, 'fight', t)) return;
      const order = this.D.combo ? (h.def.bot?.comboOrder || ['q', 'w', 'r']) : ['q', 'w', 'r'].sort(() => this.rng() - 0.5);
      const seenSlot = new Set();
      for (const s of order) { if (seenSlot.has(s)) continue; seenSlot.add(s); if (useAbility(this, s, 'fight', t)) return; }
    }
    // ranged kiting
    const ranged = h.def.ranged; const myR = h.stats.attackRange;
    if (ranged && this.rng() < this.D.kite && !h.windup && m.time < h.nextAttackAt - 0.12 && d < myR - 1) {
      const threat = !t.def.ranged && d < 6 || d < myR * 0.55;
      if (threat) { const p = this.awayFrom(t, 3); this.cmd({ type: 'move', x: p.x, y: p.y }); return; }
    }
    // don't chase forever into fog / tower
    if (d > myR + 2 && this.towerDanger(t.x, t.y) && !this.canDive(t)) { this.laning(); return; }
    this.attack(t);
  }

  // ---------------- macro: calls ----------------
  followCall(call, hpF) {
    const h = this.h, m = this.m;
    if (hpF < 0.45) return false;
    if (call.type === 'objective') {
      const o = m.objectives[call.key]; const mon = o.alive ? m.entities.get(o.id) : null; if (!mon) return false;
      const near = this.allies.filter(a => dist(a, mon) < 20).length;
      const d = dist(h, mon);
      if (d > 14 || (near < 2 && this.visibleEnemies.length > 0)) { this.moveTo(mon.x + (h.team ? 6 : -6), mon.y + (this.index - 1) * 3); return true; }
      if (useRelic(this, 'farm', mon)) return true;
      for (const s of ['q', 'w']) if (this.rng() < this.D.abil && useAbility(this, s, 'farm', mon)) return true;
      this.attack(mon); return true;
    }
    if (call.type === 'defend') {
      if (dist(h, call) > 10) { this.moveTo(call.x, call.y); return true; }
      return false; // at the tower → normal behaviour (fight picks targets)
    }
    if (call.type === 'push') {
      if (this.role === 'jungle' && m.time < 540 && this.campAvailable()) return false;
      if (this.role === 'jungle' || this.lane !== call.lane) {
        // join the push lane's wave
        const geo = laneGeo(call.lane, h.team);
        const front = this.waveFront(call.lane);
        const s = front ? front.s - 3 : laneProject(geo, h.x, h.y).s;
        const p = lanePoint(geo, s);
        if (dist(h, p) > 12) { this.moveTo(p.x, p.y); return true; }
        this.laning(call.lane, true); return true;
      }
      this.laning(this.lane, true); return true;
    }
    return false;
  }

  defendWave(w, hpF) {
    const h = this.h, m = this.m;
    if (hpF < 0.3) return false;
    if (!w.all) { // only the closest available ally goes
      let best = null, bd = Infinity;
      for (const b of m.bots) { if (b.h.team !== h.team || !b.h.alive || b.h.hp < b.h.maxHp * 0.3) continue; const d = dist(b.h, w) + (b.mode === 'fight' ? 40 : 0); if (d < bd) { bd = d; best = b; } }
      // humans near the structure count as defenders
      if (m.heroes.some(x => x.team === h.team && !x.isBot && x.alive && dist(x, w) < 18)) return false;
      if (best !== this) return false;
    }
    if (dist(h, w) > 14) { this.moveTo(w.x, w.y); return true; }
    const mins = this.enemyMinionsNear(w.x, w.y, 18);
    if (!mins.length) return false;
    if (m.time - this.lastCastAt > 0.8 && mins.length >= 3) for (const s of ['q', 'w']) if (useAbility(this, s, 'farm', mins[0])) return true;
    let low = mins[0]; for (const e of mins) if (e.hp < low.hp) low = e;
    this.attack(low); return true;
  }

  // ---------------- laning ----------------
  waveFront(lane) {
    const h = this.h, geo = laneGeo(lane, h.team);
    let best = null;
    for (const e of this.m.entities.values()) {
      if (e.kind !== 'minion' || e.team !== h.team || !e.alive || e.lane !== lane) continue;
      const pr = laneProject(geo, e.x, e.y); if (!best || pr.s > best.s) best = { s: pr.s, e };
    }
    return best;
  }
  laning(lane = this.lane, pushing = false, support = false) {
    const h = this.h, m = this.m; lane = lane || 'top';
    this.mode = 'lane';
    const geo = laneGeo(lane, h.team);
    const me = laneProject(geo, h.x, h.y);
    const myR = h.stats.attackRange;
    // lane opponents dead (public scoreboard info) or far away → push the advantage
    if (!pushing && m.time > 150) {
      const foes = m.heroes.filter(e => e.team !== h.team);
      const laneFoes = foes.filter(e => e.alive && (!e.vis[h.team] ? false : laneOf(e.x, e.y) === lane));
      const deadFoes = foes.filter(e => !e.alive).length;
      if ((deadFoes >= 1 && !laneFoes.length) || (laneFoes.length && laneFoes.every(e => e.hp < e.maxHp * 0.35) && h.hp > h.maxHp * 0.6)) pushing = true;
      // mid game: shove uncontested waves, or contested ones when clearly stronger
      else if (m.time > 240 && h.hp > h.maxHp * 0.5) {
        const near = this.enemiesNear(h.x, h.y, 22);
        if (!near.length) pushing = true;
        else { const a = this.sideStrength(h.team, h.x, h.y, 18), b = this.sideStrength(1 - h.team, h.x, h.y, 18); if (a.ehp * a.dps > 1.4 * b.ehp * b.dps) pushing = true; }
      }
    }
    // far from lane → walk there
    const front = this.waveFront(lane);
    const myTowers = this.towers.filter(t => t.team === h.team && (t.lane === lane || t.lane === 'base')).map(t => ({ t, s: laneProject(geo, t.x, t.y).s }));
    const outer = myTowers.reduce((b, x) => (!b || x.s > b.s ? x : b), null);
    let holdS;
    if (front) holdS = front.s - (h.def.ranged ? Math.min(7, myR * 0.55) : 3.5);
    else holdS = (outer ? outer.s : 20) - 2;
    // pull back if enemy wave is pushing into our side & no allied minions
    let hold = lanePoint(geo, holdS);
    const unsafe = (p) => pushing ? this.towerDanger(p.x, p.y) : !!this.enemyTowerAt(p.x, p.y, 1);
    for (let k = 0; k < 15 && unsafe(hold); k++) { holdS -= 2; hold = lanePoint(geo, holdS); }
    if (me.d > 14 || Math.abs(me.s - holdS) > 30) { this.moveTo(hold.x, hold.y); return; }

    // poke enemy laner
    if (this.pokeTarget && this.poke(this.pokeTarget)) return;

    // siege: allied minions tank the tower and defenders aren't stronger
    const et = this.towers.find(t => t.team !== h.team && dist(t, h) < 26 && !t.protected?.(m));
    let siegeOK = false;
    if (et && et.target !== h.id) {
      const tanks = this.alliedMinionsNear(et.x, et.y, TOWER_RANGE + 0.5).length;
      const defenders = this.enemiesNear(et.x, et.y, 18).length;
      const attackers = this.allies.filter(a => dist(a, et) < 22).length;
      siegeOK = tanks >= 2 && (defenders === 0 || (pushing && (attackers > defenders || (attackers === defenders && tanks >= 3 && h.hp > h.maxHp * 0.6))));
      if (et.target != null && m.entities.get(et.target)?.kind === 'hero' && et.target !== h.id) siegeOK = siegeOK && tanks >= 2;
    }
    // last hit / push
    const cands = this.enemyMinionsNear(h.x, h.y, myR + 6);
    if (cands.length) {
      const myD = (e) => autoDmg(h, e) * (h.data.shots === 3 ? 1.15 : 1);
      let lh = null, lhScore = Infinity, soon = null;
      const wind = Math.max(0.08, Math.min(0.4, 0.3 / h.stats.attackSpeed));
      for (const e of cands) {
        if (this.towerDanger(e.x, e.y) && !(pushing && !this.enemiesNear(e.x, e.y, 14).length)) continue;
        if (!pushing && this.enemyTowerAt(e.x, e.y, 1 - myR) && this.enemiesNear(e.x, e.y, 16).length) continue;
        const travel = h.def.ranged ? Math.max(0, dist(h, e) - 1) / 38 : 0;
        const tHit = wind + travel + Math.max(0, h.nextAttackAt - m.time) + Math.max(0, dist(h, e) - myR - e.radius) / h.stats.moveSpeed;
        const inc = this.incoming(e, tHit);
        const hpAt = e.hp - inc;
        if (hpAt <= myD(e) * (0.95 + (1 - this.D.lastHit) * 0.6) && hpAt > 0) { if (hpAt < lhScore) { lhScore = hpAt; lh = e; } }
        else if (e.hp - this.incoming(e, tHit + 1.2) <= myD(e) * 1.6) soon = e;
      }
      const shareCs = support && this.allies.some(a => a !== h && dist(a, h) < 16 && a.cs !== undefined && (this.m.bots.find(b => b.h === a)?.role ?? 'lane') === 'lane');
      if (lh && !shareCs && this.rng() < 0.4 + this.D.lastHit * 0.6) { this.attack(lh); return; }
      if (siegeOK && (pushing || !this.visibleEnemies.length) && dist(h, et) < myR + 8) { this.attack(et); return; }
      if (shareCs) { if (dist(h, hold) > 3) this.moveTo(hold.x, hold.y); return; }
      // farm abilities on clumped waves
      if (m.time - this.lastCastAt > 1 && this.rng() < this.D.abil * 0.25 && !this.visibleEnemies.some(e => dist(e, h) < 16)) {
        const c = cands[0]; for (const s of ['q', 'w']) if (useAbility(this, s, 'farm', c)) return;
      }
      if (soon && !pushing) { // wait for the last hit
        if (h.order?.type === 'attack') this.cmd({ type: 'stop' });
        if (dist(h, soon) > myR) this.moveTo(soon.x + (hold.x - soon.x) * 0.3, soon.y + (hold.y - soon.y) * 0.3);
        return;
      }
      const laner = this.visibleEnemies.some(e => dist(e, h) < 20);
      if (pushing || !laner || this.rng() < 0.6) {
        // push: attack lowest hp minion not under tower
        let low = null; for (const e of cands) if (!this.towerDanger(e.x, e.y) && dist(e, h) < myR + 4 && (!low || e.hp < low.hp)) low = e;
        if (low) { this.attack(low); return; }
      }
    }
    if (siegeOK) { this.attack(et); return; }
    const core = [...m.entities.values()].find(e => e.kind === 'core' && e.team !== h.team && e.alive && dist(e, h) < 24 && !e.protected?.(m));
    if (core && !this.towerDanger(core.x, core.y)) { this.attack(core); return; }
    // hold position near the wave (hysteresis: start walking at 3.2, keep re-targeting while already walking)
    const walking = h.order?.type === 'move';
    if (dist(h, hold) > (walking ? 1.2 : 3.2)) {
      // lead the hold point along the lane when it is ahead of us, so we walk with the wave instead of stop-go
      const ahead = laneProject(geo, hold.x, hold.y).s > me.s + 1;
      const p = ahead ? lanePoint(geo, holdS + 2) : hold;
      this.moveTo(p.x, p.y);
    }
  }
  /** Predicted damage a minion takes from our minions/towers within `secs`. */
  incoming(e, secs) {
    let dmg = 0;
    for (const u of this.nearUnits) {
      if (u.team !== this.h.team || !u.alive || u.target !== e.id) continue;
      if (u.kind === 'minion') { const per = u.stats.power * 100 / (100 + e.stats.armor); const hits = Math.floor(secs * u.stats.attackSpeed + (u.windup ? 1 : 0.35)); dmg += per * hits; }
      else if (u.kind === 'tower') { const per = e.maxHp * (e.minionType === 'melee' ? 0.45 : e.minionType === 'caster' ? 0.7 : 0.14); dmg += per * Math.floor(secs * u.stats.attackSpeed + (u.windup ? 1 : 0.3)); }
    }
    return dmg;
  }
  poke(t) {
    const h = this.h, m = this.m; const d = dist(h, t);
    if (this.towerDanger(t.x, t.y) || this.towerDanger(h.x, h.y)) return false;
    if (h.hp < h.maxHp * 0.45) return false;
    if (m.time - this.lastCastAt > 0.8 && this.rng() < this.D.abil * 0.5) {
      for (const s of ['q', 'w']) if (useAbility(this, s, 'poke', t)) return true;
    }
    // auto harass for ranged when few enemy minions around to punish
    if (h.def.ranged && d < h.stats.attackRange + 0.5 && this.enemyMinionsNear(h.x, h.y, 8).length < 3 && m.time >= h.nextAttackAt && this.rng() < 0.3 + this.D.focus * 0.3) { this.attack(t); return true; }
    if (!h.def.ranged && d < 4 && this.rng() < 0.4) { this.attack(t); return true; }
    return false;
  }

  // ---------------- jungle ----------------
  jungle() {
    const h = this.h, m = this.m;
    this.mode = 'jungle';
    if (this.siegeLane && m.time < this.siegeLane.until && h.hp > h.maxHp * 0.45) {
      const front = this.waveFront(this.siegeLane.lane);
      if (front) { this.laning(this.siegeLane.lane, true); return; }
    }
    // gank opportunity
    if (this.gank && (m.time > this.gank.until)) this.gank = null;
    if (!this.gank && h.level >= 3 && this.rng() < this.D.macro) this.considerGank();
    if (this.gank) {
      const t = m.entities.get(this.gank.targetId);
      if (t && !t.alive) { const lane = laneOf(this.gank.x, this.gank.y); if (lane) this.siegeLane = { lane, until: m.time + 30 }; this.gank = null; }
      else if (t && t.alive && t.vis[h.team]) { this.moveTo(t.x, t.y); return; }
      else if (dist(h, this.gank) > 6) { this.moveTo(this.gank.x, this.gank.y); return; }
      else this.gank = null;
    }
    // current monster engaged?
    const engaged = this.nearUnits.filter(e => e.kind === 'monster' && e.alive && !e.epic && dist(e, h) < 14 && (e.lastAttackerId != null));
    let tgt = engaged[0];
    if (!tgt) {
      // choose camp
      let best = null, bs = Infinity;
      for (const c of m.camps) {
        const mon = c.unitId ? m.entities.get(c.unitId) : null;
        const alive = mon && mon.alive;
        const wait = alive ? 0 : (c.respawnAt != null ? Math.max(0, c.respawnAt - m.time) : Infinity);
        if (wait > (m.time < 60 ? 60 : 25)) continue;
        const enemySide = c.side !== h.team;
        if (enemySide && (h.level < 4 || this.visibleEnemies.some(e => dist(e, c) < 20))) continue;
        const s = dist(h, c) / h.stats.moveSpeed + wait * 1.2 + (enemySide ? 8 : 0) + (c.type === 'camp_big' ? -3 : 0);
        if (s < bs) { bs = s; best = { c, mon: alive ? mon : null }; }
      }
      if (!best) {
        // nothing to clear: help the weaker lane
        if (!this.jLane || m.time > this.jLaneUntil) { this.jLane = this.rng() < 0.5 ? 'top' : 'bot'; this.jLaneUntil = m.time + 20; }
        this.laning(this.jLane); return;
      }
      if (!best.mon) { if (dist(h, best.c) > 4) this.moveTo(best.c.x + (h.team ? 3 : -3), best.c.y); return; }
      tgt = best.mon;
    }
    if (h.hp < h.maxHp * 0.3 && tgt.hp > tgt.maxHp * 0.3) { if (this.safeToRecall()) { this.cmd({ type: 'recall' }); this.recalledAt = m.time; } else { const f = this.fountain(); this.moveTo(f.x, f.y); } return; }
    if (useRelic(this, 'farm', tgt)) return;
    if (m.time - this.lastCastAt > 0.4 && this.rng() < this.D.abil) for (const s of ['q', 'w']) if (useAbility(this, s, 'farm', tgt)) return;
    this.attack(tgt);
  }
  roam() {
    const h = this.h, m = this.m;
    this.mode = 'roam';
    if (this.gank && m.time > this.gank.until) this.gank = null;
    if (!this.gank && h.level >= 3 && m.time > (this.nextGankEval || 0)) { this.nextGankEval = m.time + 6; if (this.rng() < this.D.macro) this.considerGank(); }
    if (this.gank) {
      const t = m.entities.get(this.gank.targetId);
      if (t && t.alive && t.vis[h.team]) { this.moveTo(t.x, t.y); return; }
      if (dist(h, this.gank) > 6) { this.moveTo(this.gank.x, this.gank.y); return; }
      this.gank = null;
    }
    // opportunistic camps when healthy and no enemies around
    if (h.level >= 3 && h.hp > h.maxHp * 0.6 && !this.enemiesNear(h.x, h.y, 25).length) {
      let camp = null, cd = 48;
      for (const c of m.camps) { if (c.side !== h.team || !c.unitId || !m.entities.get(c.unitId)?.alive) continue; const d = dist(h, c); if (d < cd) { cd = d; camp = c; } }
      const mon = camp && m.entities.get(camp.unitId);
      const engaged = this.nearUnits.find(e => e.kind === 'monster' && !e.epic && e.alive && e.lastAttackerId != null && dist(e, h) < 14);
      const tgt = engaged || mon;
      if (tgt && (engaged || h.hp > h.maxHp * 0.7)) {
        if (m.time - this.lastCastAt > 0.4 && this.rng() < this.D.abil) for (const s of ['q', 'w']) if (useAbility(this, s, 'farm', tgt)) return;
        if (useRelic(this, 'farm', tgt)) return;
        this.attack(tgt); return;
      }
    }
    this.laning(this.lane, false, true);
  }
  campAvailable() { return this.m.camps.some(c => { const mon = c.unitId ? this.m.entities.get(c.unitId) : null; return (mon && mon.alive && c.side === this.h.team) || (c.respawnAt != null && c.respawnAt - this.m.time < 15); }); }
  considerGank() {
    const h = this.h, m = this.m;
    let best = null, bs = 0;
    for (const e of this.visibleEnemies) {
      const lane = laneOf(e.x, e.y); if (!lane) continue;
      const geo = laneGeo(lane, h.team); const pr = laneProject(geo, e.x, e.y);
      const overext = pr.s < geo.total * 0.5 ? 1 : 0;   // on our half
      const allyThere = this.allies.some(a => a !== h && dist(a, e) < 18);
      if (this.towerDanger(e.x, e.y)) continue;
      const s = (1 - e.hp / e.maxHp) * 2 + overext + (allyThere ? 1.5 : 0) - dist(h, e) / 60;
      if (s > bs && s > 1.4) { bs = s; best = e; }
    }
    if (best) this.gank = { targetId: best.id, x: best.x, y: best.y, until: m.time + 18 };
  }

  unstick() {
    const h = this.h, m = this.m, s = this.lastStuck;
    if (Math.hypot(h.x - s.x, h.y - s.y) > 1) { s.x = h.x; s.y = h.y; s.t = m.time; return; }
    if (h.order && (h.order.type === 'move') && m.time - s.t > 2.5) {
      const a = this.rng() * Math.PI * 2; const p = m.nav.nearestFree(h.x + Math.cos(a) * 4, h.y + Math.sin(a) * 4);
      this.cmd({ type: 'move', x: p.x, y: p.y }); s.t = m.time;
    }
  }
}
