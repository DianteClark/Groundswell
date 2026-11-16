// Core match simulation. Deterministic fixed-tick (60Hz, see constants.TICK_RATE).
import * as C from './constants.js';
import { DT, TICK_RATE, ticks } from './constants.js';
import { makeRng } from './rng.js';
import { MAP, Nav, inBrush } from './map.js';
import { dealDamage, heal, addShield, addStatus, hasStatus, canMove, canAttack, canCast, isTargetable, isUnit, spawnProjectile, spawnArea, updateProjectile, updateArea, interruptRecall } from './combat.js';
const VISION_EVERY = ticks(0.1), ECON_EVERY = TICK_RATE;
const BUFFER_WINDOW = 0.25;           // casts pressed this close to becoming possible are buffered
import { createApi } from './blocks.js';
import { HERO_BY_ID } from '../data/heroes/index.js';
import { ITEM_BY_ID } from '../data/items.js';
import { RELIC_BY_ID } from '../data/relics.js';
import { SIGIL_BY_ID } from '../data/sigils.js';
import { BotBrain } from '../ai/bot.js';

const STAT_KEYS = ['maxHp', 'power', 'armor', 'attackRange', 'attackSpeed', 'moveSpeed', 'haste', 'armorPen', 'flatPen', 'lifesteal', 'hpRegen', 'tenacity'];
const blankStats = () => ({ maxHp: 0, power: 0, armor: 0, attackRange: 0, attackSpeed: 0, moveSpeed: 0, haste: 0, armorPen: 0, flatPen: 0, lifesteal: 0, hpRegen: 0, tenacity: 0 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Match {
  constructor(config) {
    this.config = config;
    this.seed = config.seed ?? 12345;
    this.rng = makeRng(this.seed);
    this.time = 0; this.tickCount = 0;
    this.entities = new Map(); this.nextId = 1;
    this.events = []; this.eventLog = [];
    this.cmdQueue = [];
    this.timers = [];
    this.map = MAP; this.nav = new Nav();
    this.api = createApi(this);
    this.heroes = []; this.bots = [];
    this.teamStats = [0, 1].map(() => ({ kills: 0, towers: 0, wyrms: [], soul: null, colossus: 0, mightUntil: 0, gold: 0 }));
    this.teamHooks = [[], []];
    this.over = false; this.winner = null; this.firstBlood = false;
    this.localPlayerId = config.players?.find(p => !p.isBot)?.id ?? null;
    const el = this.rng.pick(C.ELEMENTS);
    this.objectives = {
      wyrm: { alive: false, id: null, respawnAt: C.WYRM_FIRST, element: el, nextElement: el },
      colossus: { alive: false, id: null, respawnAt: C.COLOSSUS_FIRST },
      soul: { 0: 0, 1: 0 },
    };
    this.mapChanges = [];
    this.waveCount = 0; this.nextWave = C.WAVE_FIRST;
    this.finalSwell = false; this.finalSwellWarned = false; this.swellBonus = null;
    this._buildStructures();
    this._buildCamps();
    for (const p of config.players || []) this._addHero(p);
  }

  // ---------------- entity management ----------------
  addEntity(e) {
    e.id = this.nextId++;
    e.prevX = e.x; e.prevY = e.y;
    e.statuses = e.statuses || []; e.shields = e.shields || []; e.shield = e.shield || 0; e.mods = e.mods || [];
    e.facing = e.facing ?? 0; e.anim = e.anim || { state: 'idle', t: 0 };
    e.vis = [true, true]; e.spawnedAt = this.time;
    if (e.alive === undefined) e.alive = true;
    this.entities.set(e.id, e);
    this.emit({ t: 'spawn', id: e.id, kind: e.kind });
    return e;
  }
  remove(e) { if (this.entities.has(e.id)) { this.entities.delete(e.id); e.removed = true; e.alive = false; this.emit({ t: 'remove', id: e.id }); } }
  emit(ev) { this.events.push(ev); }
  schedule(delay, fn) { this.timers.push({ at: this.time + delay, fn, seq: this.nextId++ }); }
  heroOf(pid) { return this.heroes.find(h => h.playerId === pid); }
  issue(pid, cmd) { this.cmdQueue.push({ pid, cmd }); }

  unitsInRadius(x, y, r, filter) {
    const out = [];
    for (const e of this.entities.values()) {
      if (!e.alive) continue;
      const rr = r + (e.radius || 0);
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= rr * rr && (!filter || filter(e))) out.push(e);
    }
    return out;
  }
  findUnitAt(x, y, r, filter) {
    let best = null, bd = Infinity;
    for (const e of this.entities.values()) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y) - (e.radius || 0);
      if (d <= r && d < bd && (!filter || filter(e))) { bd = d; best = e; }
    }
    return best;
  }

  addMod(e, { duration = Infinity, add = {}, mul = {}, tag = null }) { if (tag) this.removeMods(e, tag); const md = { until: this.time + duration, add, mul, tag }; e.mods.push(md); return md; }
  removeMods(e, tag) { e.mods = e.mods.filter(md => md.tag !== tag); }
  addTempHook(e, hooks, duration = Infinity, tag = null) { e.tempHooks = (e.tempHooks || []).filter(h => !tag || h.tag !== tag); e.tempHooks.push({ ...hooks, until: this.time + duration, tag }); }

  hooksOf(e) {
    const hs = [];
    if (e.def?.hooks) hs.push(e.def.hooks);
    if (e.kind === 'hero') {
      const r = RELIC_BY_ID[e.relicId]; if (r?.hooks) hs.push(r.hooks);
      for (const sid of e.sigilIds) { const s = SIGIL_BY_ID[sid]; if (s?.hooks) hs.push(s.hooks); }
      for (const it of e.items) if (it) { const p = this._itemPart(it); if (p?.hooks) hs.push(p.hooks); if (p?.passive?.hooks) hs.push(p.passive.hooks); }
      for (const th of this.teamHooks[e.team]) hs.push(th);
    }
    if (e.hooks) hs.push(e.hooks);
    if (e.tempHooks) for (const th of e.tempHooks) if (th.until > this.time) hs.push(th);
    return hs;
  }
  callHooks(e, name, ...args) {
    if (!e) return;
    const hs = this.hooksOf(e);
    for (const h of hs) if (h[name]) h[name](this.api, e, ...args);
  }

  // ---------------- setup ----------------
  _unit(base) {
    const st = { ...blankStats(), ...base.stats };
    return { ...base, baseStats: st, stats: { ...st }, hp: base.hp ?? st.maxHp, maxHp: st.maxHp, nextAttackAt: 0, windup: null, order: null, path: null };
  }
  _buildStructures() {
    for (const t of MAP.towers) {
      const tw = this.addEntity(this._unit({ kind: 'tower', team: t.team, x: t.x, y: t.y, lane: t.lane, tier: t.tier, radius: C.TOWER.radius,
        stats: { maxHp: t.hp, power: C.TOWER.power, armor: C.TOWER.armor, attackRange: C.TOWER.attackRange, attackSpeed: C.TOWER.attackSpeed }, visual: { model: 'tower' } }));
      tw.navHandle = this.nav.addObstacle(t.x, t.y, 2.2);
      tw.protected = (m) => m._towerProtected(tw);
      tw.hooks = { modifyDamageTaken: (api, self, src, info) => { // backdoor protection
        if (!api.m.unitsInRadius(self.x, self.y, 16, e => e.kind === 'minion' && e.team !== self.team).length) info.amount *= 0.35; } };
    }
    for (const c of MAP.cores) {
      const core = this.addEntity(this._unit({ kind: 'core', team: c.team, x: c.x, y: c.y, radius: 3.5, stats: { maxHp: 4000, armor: 40 }, visual: { model: 'core' } }));
      core.navHandle = this.nav.addObstacle(c.x, c.y, 3.2);
      core.protected = (m) => m._coreProtected(core);
    }
  }
  _towerProtected(t) {
    const mine = [...this.entities.values()].filter(e => e.kind === 'tower' && e.team === t.team && e.alive);
    if (t.tier === 'inner') return mine.some(o => o.lane === t.lane && o.tier === 'outer');
    if (t.tier === 'base') return mine.filter(o => o.tier === 'inner').length === 2;
    return false;
  }
  _coreProtected(c) { return [...this.entities.values()].some(e => e.kind === 'tower' && e.team === c.team && e.tier === 'base' && e.alive); }

  _buildCamps() {
    this.camps = MAP.camps.map(c => ({ ...c, respawnAt: 60, unitId: null }));
  }
  _spawnCamp(c) {
    const s = C.MONSTER[c.type]; const k = 1 + this.time / 60 * 0.06;
    const mon = this.addEntity(this._unit({ kind: 'monster', team: 2, x: c.x, y: c.y, home: { x: c.x, y: c.y }, campId: c.id, monsterType: c.type, radius: s.radius,
      stats: { maxHp: s.maxHp * k, power: s.power * k, armor: s.armor, attackRange: s.attackRange, attackSpeed: s.attackSpeed, moveSpeed: s.moveSpeed }, visual: { model: c.type } }));
    c.unitId = mon.id;
  }
  _spawnObjective(key) {
    const s = C.MONSTER[key]; const pit = MAP.pits[key]; const k = 1 + this.time / 60 * 0.05;
    const o = this.objectives[key];
    const mon = this.addEntity(this._unit({ kind: 'monster', team: 2, x: pit.x, y: pit.y, home: { x: pit.x, y: pit.y }, monsterType: key, radius: s.radius, epic: true,
      element: key === 'wyrm' ? o.nextElement : undefined,
      stats: { maxHp: s.maxHp * k, power: s.power * k, armor: s.armor, attackRange: s.attackRange, attackSpeed: s.attackSpeed, moveSpeed: s.moveSpeed },
      visual: { model: key, element: key === 'wyrm' ? o.nextElement : undefined } }));
    o.alive = true; o.id = mon.id; if (key === 'wyrm') o.element = o.nextElement;
    this.emit({ t: 'announce', text: key === 'wyrm' ? `${C.ELEMENT_INFO[o.element].name} has spawned!` : 'The Colossus awakens!', kind: 'objective' });
  }

  _addHero(p) {
    const def = HERO_BY_ID[p.heroId] || Object.values(HERO_BY_ID)[0];
    const f = MAP.fountains[p.team];
    const idx = this.heroes.filter(h => h.team === p.team).length;
    const lo = p.loadout || {};
    const sig = lo.sigils || {};
    const h = this.addEntity({
      kind: 'hero', playerId: p.id, heroId: def.id, def, team: p.team, name: p.name || def.name, isBot: !!p.isBot, profile: p.profile || null,
      x: f.x + (p.team === 0 ? 3 : -3), y: f.y + (idx - 1) * 3, radius: 1.2,
      level: 1, xp: 0, gold: C.START_GOLD, kills: 0, deaths: 0, assists: 0, cs: 0, streak: 0, damageDealt: 0, damageTaken: 0, healingDone: 0,
      items: [null, null, null], loadout: { items: (lo.items || []).slice(0, 3), relic: lo.relic, sigils: sig },
      relicId: lo.relic || 'blink', sigilIds: [sig.offense, sig.utility].filter(Boolean),
      augments: { 3: null, 6: null, 9: null }, pendingAugment: null, pendingAugments: [],
      abilities: { passive: { name: def.abilities.passive?.name }, q: this._abState(), w: this._abState(), r: this._abState(), relic: this._abState() },
      respawnAt: null, recalling: null, buffs: [], tempHooks: [], data: {},
      visual: { model: def.id, skinId: p.skinId || `${def.id}_default` },
      hp: 1, maxHp: 1, nextAttackAt: 0, windup: null, order: null, path: null, lastCombatAt: -99,
    });
    this._recomputeHeroStats(h); h.hp = h.maxHp;
    this.heroes.push(h);
    if (p.isBot) this.bots.push(new BotBrain(this, h, { difficulty: this.config.difficulty || 2, lane: p.lane, role: p.role, index: idx }));
    this.callHooks(h, 'onSpawn');
    return h;
  }
  _abState() { return { cd: 0, cdMax: 0, ready: true, readyAt: 0, charges: null }; }

  // ---------------- stats ----------------
  _itemPart(it) {
    const def = ITEM_BY_ID[it.id]; if (!def) return null;
    if (it.tier >= 3 && it.branch) return def.branches[it.branch];
    return def.tiers[it.tier - 1];
  }
  _recomputeHeroStats(h) {
    const d = h.def, L = h.level - 1;
    const s = blankStats();
    for (const k of STAT_KEYS) s[k] = (d.base[k] || 0) + (d.growth?.[k] || 0) * L;
    for (const it of h.items) if (it) { const p = this._itemPart(it); if (p?.stats) for (const k in p.stats) s[k] = (s[k] || 0) + p.stats[k]; }
    for (const sid of h.sigilIds) { const sg = SIGIL_BY_ID[sid]; if (sg?.stats) for (const k in sg.stats) s[k] = (s[k] || 0) + sg.stats[k]; }
    // team wyrm buffs
    const ts = this.teamStats[h.team];
    for (const el of ts.wyrms) {
      if (el === 'ember') s.power *= 1.08; else if (el === 'tide') s.hpRegen += 4; else if (el === 'gale') s.moveSpeed *= 1.06; else if (el === 'stone') s.armor *= 1.10;
    }
    if (ts.mightUntil > this.time) s.power *= 1.12;
    this._applyMods(h, s);
    this.callHooks(h, 'computeStats', s);
    s.attackSpeed = Math.min(2.5, Math.max(0.2, s.attackSpeed));
    s.haste = Math.min(60, s.haste);
    s.armorPen = Math.min(0.6, s.armorPen);
    const oldMax = h.maxHp;
    h.stats = s;
    h.maxHp = s.maxHp;
    if (oldMax > 1 && s.maxHp !== oldMax && h.alive) h.hp = Math.max(1, h.hp + (s.maxHp - oldMax) * (s.maxHp > oldMax ? 1 : 0)); // gaining max hp heals by the gain
    if (h.hp > h.maxHp) h.hp = h.maxHp;
  }
  _applyMods(e, s) {
    for (const md of e.mods) { for (const k in md.add) s[k] = (s[k] || 0) + md.add[k]; }
    for (const md of e.mods) { for (const k in md.mul) s[k] = (s[k] || 0) * md.mul[k]; }
    let slow = 0, speed = 0, shred = 0;
    for (const st of e.statuses) {
      if (st.key === 'slow') slow = Math.max(slow, st.amount ?? 0.3);
      else if (st.key === 'speed') speed += st.amount ?? 0.2;
      else if (st.key === 'armorShred') shred += st.amount ?? 10;
    }
    s.moveSpeed *= (1 + speed) * (1 - Math.min(0.9, slow));
    s.armor = Math.max(0, s.armor - shred);
  }
  _recomputeUnitStats(e) {
    const s = { ...e.baseStats };
    if (this.finalSwell && (e.kind === 'tower' || e.kind === 'core')) s.armor *= 0.6;
    if (e.kind === 'minion' && this.teamStats[e.team]?.mightUntil > this.time) { s.power *= 1.5; s.armor += 30; s.moveSpeed *= 1.1; }
    this._applyMods(e, s);
    e.stats = s;
  }

  // ---------------- main tick ----------------
  tick() {
    if (this.over) return;
    this.events = [];
    this.tickCount++; this.time = this.tickCount / TICK_RATE;
    // interpolation snapshot for EVERYTHING that moves (heroes, minions, projectiles, areas, summons)
    for (const e of this.entities.values()) { e.prevX = e.x; e.prevY = e.y; e.prevFacing = e.facing; }
    if (this._localHeroId === undefined) this._localHeroId = this.localPlayerId != null ? (this.heroOf(this.localPlayerId)?.id ?? null) : null;
    // timers
    if (this.timers.length) {
      const due = this.timers.filter(t => t.at <= this.time).sort((a, b) => a.at - b.at || a.seq - b.seq);
      if (due.length) { this.timers = this.timers.filter(t => t.at > this.time); for (const t of due) t.fn(this.api); }
    }
    // bots
    for (const b of this.bots) { try { b.think(); } catch (err) { if (!this._botErr) { this._botErr = true; console.error('bot error', err); } } }
    // commands
    const q = this.cmdQueue; this.cmdQueue = [];
    for (const { pid, cmd } of q) this._applyCommand(pid, cmd);
    this._spawning();
    // entities
    const list = [...this.entities.values()];
    for (const e of list) {
      if (e.removed) continue;
      if (e.kind === 'projectile') { updateProjectile(this, e); continue; }
      if (e.kind === 'area') { updateArea(this, e); continue; }
      this._updateCommon(e);
      if (e.removed) continue;
      if (!e.alive) { if (e.kind === 'hero') this._heroDead(e); else if (e.removeAt && this.time >= e.removeAt) this.remove(e); continue; }
      switch (e.kind) {
        case 'hero': this._updateHero(e); break;
        case 'minion': this._updateMinion(e); break;
        case 'tower': this._updateTower(e); break;
        case 'monster': this._updateMonster(e); break;
        case 'summon': this._updateSummon(e); break;
      }
      if (e.anim) e.anim.t += DT;
    }
    // projectiles spawned this tick have prevX = x
    this._separate();
    if (this.tickCount % VISION_EVERY === 0) this._vision();
    this._economy();
    for (const ev of this.events) this.eventLog.push({ tick: this.tickCount, ev });
    // keep ~1s of history (render/HUD read every frame; a frame can run several ticks)
    if (this.eventLog.length > 1500 || (this.eventLog.length && this.eventLog[0].tick < this.tickCount - TICK_RATE * 2)) {
      const minTick = this.tickCount - TICK_RATE; let i = 0; while (i < this.eventLog.length && this.eventLog[i].tick < minTick) i++;
      if (this.eventLog.length - i > 1500) i = this.eventLog.length - 1500;
      if (i) this.eventLog.splice(0, i);
    }
  }

  _updateCommon(e) {
    if (e.statuses.length) e.statuses = e.statuses.filter(s => s.until > this.time);
    if (e.shields.length) { const n = e.shields.length; e.shields = e.shields.filter(s => s.until > this.time); if (n !== e.shields.length) e.shield = e.shields.reduce((a, s) => a + s.amount, 0); }
    if (e.mods.length) e.mods = e.mods.filter(md => md.until > this.time);
    if (e.tempHooks?.length) e.tempHooks = e.tempHooks.filter(h => h.until > this.time);
    if (!e.alive) return;
    if (e.kind === 'hero') { this._recomputeHeroStats(e); this.callHooks(e, 'onTick', DT); }
    else if (e.baseStats) { this._recomputeUnitStats(e); if (e.hooks?.onTick) e.hooks.onTick(this.api, e, DT); }
    if (e.stats?.hpRegen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.stats.hpRegen * DT);
    if (e.kind === 'summon' && e.expireAt && this.time >= e.expireAt) { e.alive = false; e.removeAt = this.time + 0.6; e.anim = { state: 'dead', t: 0 }; this.emit({ t: 'death', id: e.id }); }
  }

  // ---------------- commands ----------------
  _applyCommand(pid, cmd) {
    const h = this.heroOf(pid); if (!h) return;
    switch (cmd.type) {
      case 'buy': return this._buy(h, cmd.slot, cmd.branch);
      case 'buyBranch': return this._buy(h, cmd.slot, cmd.branch);
      case 'augment': {
        if (h.augments[cmd.level] === null && h.level >= cmd.level && (cmd.choice === 'a' || cmd.choice === 'b')) {
          h.augments[cmd.level] = cmd.choice; h.pendingAugments = h.pendingAugments.filter(l => l !== cmd.level); h.pendingAugment = h.pendingAugments[0] ?? null;
          this.callHooks(h, 'onAugment', cmd.level, cmd.choice); this.emit({ t: 'augment', id: h.id, level: cmd.level, choice: cmd.choice });
        }
        return;
      }
    }
    if (!h.alive) return;
    switch (cmd.type) {
      case 'move': {
        interruptRecall(this, h); this._cancelWindup(h);
        const same = h.order?.type === 'move' && h.path && Math.hypot(h.order.x - cmd.x, h.order.y - cmd.y) < 0.6;
        h.order = { type: 'move', x: cmd.x, y: cmd.y }; if (!same) h.path = null;  // tiny re-clicks keep the current path (no re-path stutter)
        break;
      }
      case 'moveDir': {
        // Joystick. h.joy persists until released; a one-shot attack ('once', mobile attack button) keeps priority
        // and movement resumes along h.joy the instant the attack lands (= auto backswing cancel / orb-walk).
        const l = Math.hypot(cmd.dx, cmd.dy);
        if (l < 0.05) { h.joy = null; if (h.order?.type === 'moveDir') { h.order = null; h.path = null; } }
        else {
          h.joy = { dx: cmd.dx / l, dy: cmd.dy / l };
          if (h.order?.type === 'attack' && h.order.once) break;
          interruptRecall(this, h); this._cancelWindup(h);
          h.order = { type: 'moveDir' }; h.path = null;
        }
        break;
      }
      case 'attack': {
        const t = this.entities.get(cmd.targetId);
        if (t && t.team !== h.team && t.alive) {
          interruptRecall(this, h);
          const o = h.order;
          if (o?.type === 'attack' && o.id === t.id) { if (!cmd.once) o.once = false; break; }   // re-issue on same target: never resets the swing
          if (h.windup && h.windup.targetId !== t.id) this._cancelWindup(h);
          h.order = { type: 'attack', id: t.id, once: !!cmd.once }; h.path = null;
        }
        break;
      }
      case 'attackMove': interruptRecall(this, h); h.order = { type: 'attackMove', x: cmd.x, y: cmd.y }; h.path = null; break;
      case 'stop': h.order = null; h.path = null; h.joy = null; this._cancelWindup(h); h.castBuffer = null; break;
      case 'cast': {
        const r = this._tryCast(h, cmd.slot, cmd.x, cmd.y, cmd.targetId);
        if (r === true || r === 'moving') { h.castBuffer = null; break; }
        const wait = this._castWait(h, cmd.slot);
        if (wait != null && wait <= BUFFER_WINDOW) h.castBuffer = { slot: cmd.slot, x: cmd.x, y: cmd.y, targetId: cmd.targetId, until: this.time + wait + 0.06 };
        break;
      }
      case 'recall': if (!h.recalling && canMove(h)) { h.order = null; h.path = null; this._cancelWindup(h); h.recalling = { until: this.time + (this.teamStats[h.team].mightUntil > this.time ? C.MIGHT_RECALL_TIME : C.RECALL_TIME), start: this.time }; this.emit({ t: 'recall', id: h.id }); } break;
    }
  }
  /** Seconds until `slot` could be cast (null = not soon / impossible). Used for input buffering. */
  _castWait(h, slot) {
    const def = this.abilityDef(h, slot), st = h.abilities[slot];
    if (!def || !st || !def.cast || !h.alive) return null;
    if (slot === 'r' && h.level < C.ULT_LEVEL) return null;
    let w = Math.max(0, st.readyAt - this.time);
    if (h.dash) { const d = h.dash; w = Math.max(w, Math.hypot(d.tx - h.x, d.ty - h.y) / d.speed); }
    if (h.castLockUntil > this.time) w = Math.max(w, h.castLockUntil - this.time);
    if (h.channel?.locksAll) w = Math.max(w, h.channel.until - this.time);
    for (const s of h.statuses) if (s.key === 'stun' || s.key === 'knockup' || (s.key === 'silence' && slot !== 'relic')) w = Math.max(w, s.until - this.time);
    return w;
  }
  _tryBuffer(h) {
    const b = h.castBuffer; if (!b) return;
    if (this.time > b.until || !h.alive) { h.castBuffer = null; return; }
    if (h.dash || h.castLockUntil > this.time || (h.channel?.locksAll)) return;
    const r = this._tryCast(h, b.slot, b.x, b.y, b.targetId);
    if (r) h.castBuffer = null;
  }
  /** Cancel an attack that is still winding up: the swing is refunded (you can attack again immediately). */
  _cancelWindup(e) {
    const w = e.windup; if (!w) return;
    e.windup = null; e.nextAttackAt = Math.min(e.nextAttackAt, w.start);
    if (e.anim?.state === 'attack') e.anim = { state: 'idle', t: 0 };
    this.emit({ t: 'attack_cancel', srcId: e.id });
  }
  /** Attack-timer reset (LoL "AA reset"): the next auto may start right away. */
  resetAttack(e) { if (!e.windup) e.nextAttackAt = Math.min(e.nextAttackAt, this.time); }

  canShop(h) { const f = MAP.fountains[h.team]; return !h.alive || dist(h, f) <= C.FOUNTAIN_RADIUS + 2; }
  nextPurchase(h, slot) {
    const baseId = h.loadout.items[slot]; const cur = h.items[slot];
    const def = ITEM_BY_ID[cur?.id || baseId]; if (!def) return null;
    if (!cur) return { step: 1, cost: def.tiers[0].cost, def };
    if (cur.tier === 1 && def.tiers[1]) return { step: 2, cost: def.tiers[1].cost, def };
    if (cur.tier < 3 && def.branches) return { step: 3, branch: true, costA: def.branches.a.cost, costB: def.branches.b.cost, def };
    return null;
  }
  _buy(h, slot, branch) {
    if (slot < 0 || slot > 2 || !this.canShop(h)) return false;
    const np = this.nextPurchase(h, slot); if (!np) return false;
    if (np.branch) {
      if (branch !== 'a' && branch !== 'b') return false;
      const cost = branch === 'a' ? np.costA : np.costB; if (h.gold < cost) return false;
      h.gold -= cost; h.items[slot] = { id: np.def.id, tier: 3, branch };
    } else {
      if (h.gold < np.cost) return false;
      h.gold -= np.cost; h.items[slot] = { id: np.def.id, tier: np.step, branch: null };
    }
    this._recomputeHeroStats(h);
    this.emit({ t: 'buy', id: h.id, slot, item: h.items[slot] });
    return true;
  }

  abilityDef(h, slot) { return slot === 'relic' ? RELIC_BY_ID[h.relicId] : h.def.abilities[slot]; }
  _tryCast(h, slot, x, y, targetId) {
    const def = this.abilityDef(h, slot); const st = h.abilities[slot];
    if (!def || !st || !def.cast) return false;
    if (slot === 'r' && h.level < C.ULT_LEVEL) return false;
    if (!st.ready || h.dash || h.castLockUntil > this.time) return false;
    if (slot === 'relic' ? (hasStatus(h, 'stun') || hasStatus(h, 'knockup')) : !canCast(h)) return false;
    const range = typeof def.range === 'function' ? def.range(h) : (def.range ?? 8);
    let target = null;
    if (def.targeting === 'unit') {
      const tf = def.targetTeam || 'enemy';
      const ok = (e) => isUnit(e) && isTargetable(e) && e.vis[h.team] && (tf === 'any' || (tf === 'enemy' ? e.team !== h.team : e.team === h.team)) && e.kind !== 'tower' && e.kind !== 'core' && (!def.targetFilter || def.targetFilter(e, h));
      target = targetId != null ? this.entities.get(targetId) : null;
      if (!target || !ok(target)) target = this.findUnitAt(x, y, 3, ok);
      if (!target && tf !== 'enemy' && (def.selfCast !== false)) target = h;
      if (!target) return false;
      if (dist(h, target) - target.radius > range) { interruptRecall(this, h); this._cancelWindup(h); h.order = { type: 'cast', slot, id: target.id, prev: h.order?.type === 'cast' ? h.order.prev : h.order }; h.path = null; return 'moving'; }
      x = target.x; y = target.y;
    }
    let dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
    if (d < 0.01) { dx = Math.cos(h.facing); dy = Math.sin(h.facing); d = 0; }
    const dirX = d ? dx / d : dx, dirY = d ? dy / d : dy;
    const cd = Math.min(d, range);
    const aim = { x: h.x + dirX * cd, y: h.y + dirY * cd, rawX: x, rawY: y, dirX, dirY, dist: cd, target, targetId: target?.id ?? null, range };
    if (def.targeting === 'self') { aim.x = h.x; aim.y = h.y; }
    interruptRecall(this, h);
    const prevFacing = h.facing;
    h.facing = Math.atan2(dirY, dirX);            // face the aim instantly (dashes read h.facing too)
    const wind = h.windup; h.windup = null;
    const res = def.cast(this.api, h, aim);
    if (res === false) { h.windup = wind; h.facing = prevFacing; return false; }
    if (wind) { h.nextAttackAt = Math.min(h.nextAttackAt, wind.start); this.emit({ t: 'attack_cancel', srcId: h.id }); }
    if (!h.dash) h.facing = Math.atan2(dirY, dirX);
    let cdv = typeof def.cd === 'function' ? def.cd(h) : def.cd;
    if (slot !== 'relic') cdv *= (1 - (h.stats.haste || 0) / 100);
    if (typeof res === 'object' && res?.cd != null) cdv = res.cd;
    st.cdMax = cdv; st.readyAt = this.time + cdv; st.ready = cdv <= 0; st.cd = cdv;
    h.anim = { state: 'cast', t: 0, slot };
    if (h.order?.type === 'cast') h.order = h.order.prev && h.order.prev.type !== 'move' ? h.order.prev : null;
    this.emit({ t: 'cast', srcId: h.id, heroId: h.heroId, slot, x: h.x, y: h.y, tx: aim.x, ty: aim.y });
    this.callHooks(h, 'onCast', slot, aim);
    return true;
  }
  /** Reduce an ability's remaining cooldown (seconds) or reset it (amount = Infinity). */
  reduceCooldown(h, slot, amount) { const st = h.abilities[slot]; if (!st) return; st.readyAt = Math.max(this.time, st.readyAt - amount); }

  // ---------------- heroes ----------------
  _heroDead(h) {
    if (this.time >= h.respawnAt) {
      const f = MAP.fountains[h.team];
      h.alive = true; h.hp = h.maxHp; h.x = f.x + (h.team === 0 ? 3 : -3); h.y = f.y; h.prevX = h.x; h.prevY = h.y;
      h.order = null; h.path = null; h.statuses = []; h.anim = { state: 'idle', t: 0 }; h.respawnAt = null;
      this.emit({ t: 'respawn', id: h.id }); this.callHooks(h, 'onRespawn');
    }
    this._tickCooldowns(h);
  }
  _tickCooldowns(h) {
    for (const k of ['q', 'w', 'r', 'relic']) { const st = h.abilities[k]; st.cd = Math.max(0, st.readyAt - this.time); st.ready = st.cd <= 0; }
  }
  _updateHero(h) {
    this._tickCooldowns(h);
    // fountain
    const f = MAP.fountains[h.team];
    if (dist(h, f) <= C.FOUNTAIN_RADIUS) { heal(this, h, h.maxHp * 0.15 * DT); }
    const ef = MAP.fountains[1 - h.team];
    if (dist(h, ef) <= 18) dealDamage(this, null, h, 600 * DT, { type: 'true', noHooks: true });
    if (!h.alive) return;
    if (h.castBuffer) this._tryBuffer(h);
    if (h.dash) { this._dashStep(h); if (!h.dash && h.castBuffer) this._tryBuffer(h); return; }
    if (h.channel) {
      if (this.time >= h.channel.until) { const c = h.channel; h.channel = null; c.onEnd?.(this.api, h); }
      else { c_tick(this, h); if (h.channel?.locksAll) return; }
    }
    if (h.recalling) {
      if (this.time >= h.recalling.until) { h.recalling = null; const p = { x: f.x + (h.team === 0 ? 3 : -3), y: f.y }; h.x = p.x; h.y = p.y; h.prevX = h.x; h.prevY = h.y; this.emit({ t: 'recall_done', id: h.id }); }
      return;
    }
    if (h.windup) { this._resolveWindup(h); }
    const taunt = hasStatus(h, 'taunt');
    if (taunt) { const t = this.entities.get(taunt.sourceId); if (t?.alive) { this._attackTarget(h, t); return; } }
    if (hasStatus(h, 'fear')) return;
    if (!h.order && h.joy && canMove(h)) h.order = { type: 'moveDir' };   // joystick still held: resume
    const o = h.order;
    if (!o) { // idle: auto-acquire within attack range
      this._idleAnim(h);
      if (h.windup) return;
      const t = this._acquire(h, h.stats.attackRange + 0.5, true);
      if (t) this._attackTarget(h, t, true);
      return;
    }
    switch (o.type) {
      case 'move': if (this._followTo(h, o.x, o.y, 0.15)) { h.order = null; this._idleAnim(h); } break;
      case 'moveDir': if (!h.joy) { h.order = null; this._idleAnim(h); break; } this._moveDir(h, h.joy.dx, h.joy.dy); break;
      case 'attack': {
        const t = this.entities.get(o.id);
        if (!t || !t.alive || !t.vis[h.team] || !isTargetable(t)) { h.order = h.joy ? { type: 'moveDir' } : null; if (h.windup && h.windup.targetId === o.id) this._cancelWindup(h); break; }
        this._attackTarget(h, t); break;
      }
      case 'attackMove': {
        const t = this._acquire(h, h.stats.attackRange + 5, false);
        if (t) this._attackTarget(h, t); else if (this._followTo(h, o.x, o.y, 0.5)) h.order = null;
        break;
      }
      case 'cast': {
        const t = this.entities.get(o.id);
        if (!t || !t.alive || !t.vis[h.team]) { h.order = h.joy ? { type: 'moveDir' } : null; break; }
        const def = this.abilityDef(h, o.slot); const range = typeof def.range === 'function' ? def.range(h) : def.range;
        if (dist(h, t) - t.radius <= range) {
          const prev = o.prev; h.order = null;
          const ok = this._tryCast(h, o.slot, t.x, t.y, t.id);
          if (ok === true) h.order = h.joy ? { type: 'moveDir' } : (prev?.type === 'attack' ? { ...prev, once: false } : null);
          else if (ok !== 'moving') h.order = null;
        }
        else this._followTo(h, t.x, t.y, 0, true);
        break;
      }
    }
  }
  _setAnim(e, state) { if (e.anim.state !== state) e.anim = { state, t: 0 }; }
  /** Go idle unless an attack swing / cast pose is still playing (backswing is visible, not cut). */
  _idleAnim(e) {
    const a = e.anim; if (a.state === 'idle') return;
    if (e.windup) return;
    if (a.state === 'attack' && a.t < (a.dur || 0.5) * 0.85) return;
    if (a.state === 'cast' && a.t < 0.35) return;
    e.anim = { state: 'idle', t: 0 };
  }

  _acquire(e, range, idle) {
    // prefer: enemy heroes when attack-moving? LoL picks nearest. Idle heroes don't auto-target champions under enemy tower...
    let best = null, bd = Infinity;
    for (const t of this.entities.values()) {
      if (!t.alive || t.team === e.team || !isUnit(t) || !isTargetable(t) || !t.vis[e.team]) continue;
      if (t.kind === 'monster' && idle && !(t.lastAttackerId != null)) continue;
      if ((t.kind === 'tower' || t.kind === 'core') && t.protected?.(this)) continue;
      const d = dist(e, t) - t.radius;
      if (d <= range && d < bd) { bd = d; best = t; }
    }
    return best;
  }

  _attackTarget(e, t, idle = false) {
    const range = e.stats.attackRange + t.radius + (e.radius || 0) * 0.5;
    const d = dist(e, t);
    if (d <= range) {
      e.path = null;
      e.facing = Math.atan2(t.y - e.y, t.x - e.x);
      if (!e.windup && this.time >= e.nextAttackAt - 1e-6 && canAttack(e)) this._startAttack(e, t);
      else if (!e.windup && e.anim.state === 'run') this._setAnim(e, 'idle');
    } else if (!idle && canMove(e)) {
      if (e.windup) return;   // keep swinging; the hit still lands if the target is within leeway
      this._followTo(e, t.x, t.y, Math.max(0.5, range - 0.35), true);
    }
  }
  /** Attack timing (LoL-style): windup (attack point) → hit → backswing until the period ends. */
  attackTiming(e) {
    const period = 1 / Math.max(0.05, e.stats.attackSpeed);
    let frac, lo = 0.1, hi = 0.4;
    if (e.kind === 'hero') { frac = e.def.windup ?? (e.def.ranged ? 0.2 : 0.24); hi = 0.32; }
    else if (e.kind === 'tower') { frac = 0; lo = hi = 0.15; }
    else if (e.kind === 'minion') frac = 0.28;
    else frac = 0.3;
    return { period, windup: Math.max(lo, Math.min(hi, period * frac)) };
  }
  _startAttack(e, t) {
    const { period, windup } = this.attackTiming(e);
    e.windup = { targetId: t.id, at: this.time + windup, start: this.time };
    e.nextAttackAt = this.time + period;
    e.anim = { state: 'attack', t: 0, dur: period, windup };
    this.emit({ t: 'attack', srcId: e.id, targetId: t.id, windup, period });
  }
  _resolveWindup(e) {
    const w = e.windup; if (this.time < w.at - 1e-6) return;
    e.windup = null;
    const t = this.entities.get(w.targetId);
    if (!t || !t.alive || !canAttack(e)) return;
    if (dist(e, t) > e.stats.attackRange + t.radius + 3) return;
    const ranged = e.kind === 'hero' ? e.def.ranged : (e.kind === 'tower' || e.projectileKey);
    if (ranged) {
      const key = e.kind === 'hero' ? (e.def.projectile || `auto_${e.heroId}`) : e.kind === 'tower' ? 'tower_shot' : e.projectileKey;
      const speed = e.kind === 'hero' ? (e.def.missileSpeed || 55) : e.kind === 'tower' ? 50 : (e.minionType === 'siege' ? 34 : 40);
      const p = spawnProjectile(this, { src: e, targetId: t.id, speed, visual: key, onHit: (m, tgt) => this._autoHit(e, tgt, true) });
      p.isAuto = true;
      if (e.kind === 'hero') this.emit({ t: 'attack_fire', srcId: e.id, targetId: t.id, projId: p.id });
    } else this._autoHit(e, t, false);
    // one-shot attack (mobile tap / joystick held): movement resumes right at the attack point
    const o = e.order;
    if (e.kind === 'hero' && o?.type === 'attack' && o.id === w.targetId && o.once) e.order = e.joy ? { type: 'moveDir' } : { type: 'attack', id: o.id, once: false };
  }
  _autoHit(e, t, ranged) {
    if (!t.alive) return;
    if (e.kind === 'hero') this.emit({ t: 'attack_hit', srcId: e.id, targetId: t.id, ranged: !!ranged });
    if (hasStatus(e, 'blind')) { this.emit({ t: 'miss', srcId: e.id, targetId: t.id }); return; }
    let amt;
    if (e.kind === 'tower') {
      if (t.kind === 'minion') amt = t.maxHp * (t.minionType === 'melee' ? 0.45 : t.minionType === 'caster' ? 0.7 : 0.14);
      else if (t.kind === 'hero') { e.heat = (e.heatTarget === t.id ? Math.min(2, (e.heat || 0) + 0.3) : 0); e.heatTarget = t.id; amt = e.stats.power * (1 + e.heat) * (1 + this.time / 60 * 0.03); }
      else amt = e.stats.power;
      dealDamage(this, e, t, amt, { type: t.kind === 'minion' ? 'true' : 'tower', noHooks: false });
      return;
    }
    amt = e.stats.power * (e.def?.attackRatio ?? 1);
    if (e.kind === 'minion' && t.kind === 'hero') amt *= 0.6;
    const info = { amount: amt, onHit: true, empowered: false };
    if (e.kind === 'hero') { this.callHooks(e, 'modifyAutoAttack', t, info); if (t.kind === 'hero') e.aggroAt = this.time; }
    if (e.kind === 'summon' && t.kind === 'hero') { const ow = this.entities.get(e.ownerId); if (ow) ow.aggroAt = this.time; }
    const dealt = dealDamage(this, e, t, info.amount, { type: 'auto', empowered: info.empowered || undefined });
    if (e.kind === 'hero') { this.callHooks(e, 'onAttackHit', t, { amount: dealt }); }
  }

  // ---------------- movement ----------------
  _dashStep(e) {
    const d = e.dash; const step = d.speed * DT;
    const dx = d.tx - e.x, dy = d.ty - e.y, l = Math.hypot(dx, dy);
    this._setAnim(e, d.forced ? 'stagger' : 'dash');
    if (l <= step) { e.x = d.tx; e.y = d.ty; e.dash = null; d.onStep?.(this.api, e, d); d.onArrive?.(this.api, e); if (e.anim.state === 'dash' || e.anim.state === 'stagger') this._setAnim(e, 'idle'); return; }
    e.x += dx / l * step; e.y += dy / l * step; if (!d.forced) e.facing = Math.atan2(dy, dx);
    d.onStep?.(this.api, e, d);
  }
  /** Move by (dx,dy) with smooth sliding along obstacles. Returns the distance actually moved. */
  _slide(e, dx, dy) {
    const p = this.nav.resolve(e.x + dx, e.y + dy);
    if (!p.ok) return 0;
    const m = Math.hypot(p.x - e.x, p.y - e.y);
    e.x = p.x; e.y = p.y; return m;
  }
  _stepToward(e, tx, ty, speed) {
    const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy);
    if (l < 1e-4) return true;
    const step = Math.min(l, speed * DT);
    const moved = this._slide(e, dx / l * step, dy / l * step);
    e.facing = Math.atan2(dy, dx);
    if (moved > 1e-4) this._setAnim(e, 'run');
    if (moved < step * 0.2) { e.stuckFor = (e.stuckFor || 0) + DT; } else e.stuckFor = 0;
    return l <= speed * DT;
  }
  _moveDir(e, dx, dy) {
    if (!canMove(e)) return;
    if (e.windup) this._cancelWindup(e);
    const step = e.stats.moveSpeed * DT;
    let moved = this._slide(e, dx * step, dy * step);
    if (moved < step * 0.15) { // wedged in a crevice: try angled directions
      for (const a of [0.5, -0.5, 1.0, -1.0]) { const c = Math.cos(a), s = Math.sin(a); moved = this._slide(e, (dx * c - dy * s) * step * 0.7, (dx * s + dy * c) * step * 0.7); if (moved > step * 0.15) break; }
    }
    e.facing = Math.atan2(dy, dx); e.desiredFacing = e.facing;
    this._setAnim(e, 'run');
  }
  /** Path toward (tx,ty). Returns true when within `stop` distance. */
  _followTo(e, tx, ty, stop = 0.3, chase = false) {
    if (!canMove(e)) return false;
    const d = Math.hypot(tx - e.x, ty - e.y);
    if (d <= stop) { e.path = null; return true; }
    const goalMoved = e.pathGoal ? Math.hypot(e.pathGoal.x - tx, e.pathGoal.y - ty) : Infinity;
    let needPath = !e.path || goalMoved > (chase ? Math.max(1.5, d * 0.15) : 0.5) || this.time > e.pathAt + 2 || (e.stuckFor || 0) > 0.4;
    if (!needPath && goalMoved > 0.05 && e.path.length === 1) { e.path[0] = { x: tx, y: ty }; e.pathGoal = { x: tx, y: ty }; } // retarget the straight leg in place (no re-path)
    if (needPath) {
      if (this.nav.lineClear(e.x, e.y, tx, ty)) e.path = [{ x: tx, y: ty }];
      else e.path = this.nav.findPath(e.x, e.y, tx, ty);
      e.pathGoal = { x: tx, y: ty }; e.pathAt = this.time; e.stuckFor = 0;
    }
    if (!e.path || !e.path.length) return true;
    // look-ahead smoothing: cut the corner as soon as the next waypoint is visible
    if (e.path.length > 1 && (this.tickCount + e.id) % 6 === 0 && this.nav.lineClear(e.x, e.y, e.path[1].x, e.path[1].y)) e.path.shift();
    let wp = e.path[0];
    const last = e.path.length === 1;
    const sp = e.stats.moveSpeed;
    if (last) {
      const rem = Math.hypot(wp.x - e.x, wp.y - e.y);
      if (rem <= stop) { e.path = null; return true; }
      // stop exactly at `stop` distance (no overshoot / oscillation)
      if (rem - stop < sp * DT) { const k = (rem - stop) / rem; this._slide(e, (wp.x - e.x) * k, (wp.y - e.y) * k); e.facing = Math.atan2(wp.y - e.y, wp.x - e.x); e.path = null; return true; }
    }
    const reached = this._stepToward(e, wp.x, wp.y, sp);
    if (reached || Math.hypot(wp.x - e.x, wp.y - e.y) < 0.3) { e.path.shift(); if (!e.path.length) { e.path = null; return Math.hypot(tx - e.x, ty - e.y) <= Math.max(stop, 0.5); } }
    return false;
  }

  /**
   * Soft separation. Heroes ghost through allied minions/summons and are never shoved by minions or camps
   * (minions yield to heroes). Pushes are accumulated and rate-limited, so crowds spread smoothly (no jitter).
   */
  _separate() {
    const us = this._sepList || (this._sepList = []); us.length = 0;
    for (const e of this.entities.values()) if (e.alive && (e.kind === 'hero' || e.kind === 'minion' || e.kind === 'monster' || (e.kind === 'summon' && !e.static)) && !e.dash && !e.ghost) { e._px = 0; e._py = 0; us.push(e); }
    const n = us.length;
    for (let i = 0; i < n; i++) {
      const a = us[i];
      for (let j = i + 1; j < n; j++) {
        const b = us[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) continue;
        const ah = a.kind === 'hero', bh = b.kind === 'hero';
        let rr, wa, wb;
        if (ah && bh) { rr = (a.radius + b.radius) * (a.team === b.team ? 0.55 : 0.75); wa = wb = 0.5; }
        else if (ah || bh) {
          const h = ah ? a : b, o = ah ? b : a;
          if (o.team === h.team) continue;                         // ghost through own minions & pets
          if (o.epic) { rr = h.radius * 0.6 + o.radius; ah ? (wa = 1, wb = 0) : (wa = 0, wb = 1); }
          else { rr = h.radius * 0.45 + o.radius * 0.8; ah ? (wa = 0, wb = 1) : (wa = 1, wb = 0); }   // minion yields, hero never shoved
        } else {
          rr = (a.radius + b.radius) * 0.8;
          const sa = a.epic ? 0 : (a.windup || a.x === a.prevX && a.y === a.prevY) ? 0.35 : 1;
          const sb = b.epic ? 0 : (b.windup || b.x === b.prevX && b.y === b.prevY) ? 0.35 : 1;
          if (sa + sb === 0) continue;
          wa = sa / (sa + sb); wb = sb / (sa + sb);
        }
        const d2 = dx * dx + dy * dy; if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);
        let nx, ny; if (d > 1e-4) { nx = dx / d; ny = dy / d; } else { const ang = ((a.id * 7 + b.id * 13) % 16) / 16 * Math.PI * 2; nx = Math.cos(ang); ny = Math.sin(ang); }
        const ov = rr - d;
        a._px -= nx * ov * wa; a._py -= ny * ov * wa; b._px += nx * ov * wb; b._py += ny * ov * wb;
      }
    }
    const maxStep = 5.5 * DT;   // soft: at most 5.5 u/s of separation drift
    for (const e of us) {
      let px = e._px, py = e._py; if (!px && !py) continue;
      const l = Math.hypot(px, py); const k = Math.min(1, maxStep / l) * 0.6; px *= k; py *= k;
      if (e.kind === 'tower' || e.static) continue;
      this._slide(e, px, py);
    }
  }

  // ---------------- minions ----------------
  _spawning() {
    if (this.time >= this.nextWave) { this._spawnWave(); this.nextWave += C.WAVE_INTERVAL; }
    if (!this.finalSwellWarned && this.time >= C.FINAL_SWELL_AT - C.FINAL_SWELL_WARN) {
      this.finalSwellWarned = true;
      this.emit({ t: 'announce', kind: 'finalswell_warn', text: 'The Final Swell rises in 10 seconds…' });
      this.emit({ t: 'mapchange', phase: 'telegraph', kind: 'finalswell', zone: { ...C.FINAL_SWELL_ZONE }, team: 2, at: C.FINAL_SWELL_AT });
    }
    if (!this.finalSwell && this.time >= C.FINAL_SWELL_AT) this._startFinalSwell();
    for (const c of this.camps) if (!c.unitId && c.respawnAt != null && this.time >= c.respawnAt) { c.respawnAt = null; this._spawnCamp(c); }
    for (const key of ['wyrm', 'colossus']) { const o = this.objectives[key]; if (!o.alive && o.respawnAt != null && this.time >= o.respawnAt) { o.respawnAt = null; this._spawnObjective(key); } }
  }
  _spawnWave() {
    this.waveCount++;
    const types = ['melee', 'melee', 'melee', 'caster', 'caster'];
    if (this.waveCount % C.SIEGE_EVERY === 0) types.splice(3, 0, 'siege');
    const k = (1 + (this.time / 60) * 0.04) * (this.finalSwell ? 1.6 : 1);
    for (const team of [0, 1]) for (const lane of ['top', 'bot']) {
      const pts = MAP.laneFor(lane, team);
      types.forEach((ty, i) => {
        this.schedule(i * 0.7, () => {
          if (this.over) return;
          const s = C.MINION[ty];
          const p0 = pts[0];
          this.addEntity(this._unit({ kind: 'minion', minionType: ty, team, lane, wp: 1, x: p0.x + (team === 0 ? 2 : -2), y: p0.y, radius: s.radius,
            projectileKey: s.projectile, stats: { maxHp: s.maxHp * k, power: s.power * k, armor: s.armor, attackRange: s.attackRange, attackSpeed: s.attackSpeed, moveSpeed: s.moveSpeed },
            visual: { model: 'minion_' + ty }, xpValue: s.xp, goldValue: s.gold }));
        });
      });
    }
  }
  /** THE FINAL SWELL (14:00): stronger minions, brittle structures, doubled next Wyrm/Colossus rewards. */
  _startFinalSwell() {
    this.finalSwell = true; this.swellBonus = { wyrm: true, colossus: true };
    for (const e of this.entities.values()) if (e.kind === 'minion' && e.alive) { e.baseStats.maxHp *= 1.6; e.baseStats.power *= 1.6; e.maxHp *= 1.6; e.hp *= 1.6; }
    this.emit({ t: 'finalswell', at: this.time });
    this.emit({ t: 'announce', kind: 'finalswell', text: 'THE FINAL SWELL! Minions surge — structures crumble.' });
  }
  _updateMinion(e) {
    if (e.dash) { this._dashStep(e); return; }
    if (e.windup) this._resolveWindup(e);
    const taunt = hasStatus(e, 'taunt');
    if (taunt) { const t = this.entities.get(taunt.sourceId); if (t?.alive) { this._attackTarget(e, t); return; } }
    if (!e.retargetAt || this.time >= e.retargetAt || !e.target) {
      e.retargetAt = this.time + 0.25;
      const cur = e.target ? this.entities.get(e.target) : null;
      const keep = cur && cur.alive && dist(e, cur) < 13 && !(cur.kind === 'hero' && false);
      // call for help: enemy hero that damaged an allied hero recently
      let t = null;
      const helper = this.findUnitAt(e.x, e.y, 11, h => h.kind === 'hero' && h.team !== e.team && isTargetable(h) && h.vis[e.team] && h.aggroAt && this.time - h.aggroAt < 1.5);
      if (helper) t = helper;
      else if (keep) t = cur;
      else t = this.findUnitAt(e.x, e.y, 11, u => u.team !== e.team && u.team !== 2 && isUnit(u) && isTargetable(u) && u.vis[e.team] && !(u.protected?.(this)) && u.kind !== 'hero')
        || this.findUnitAt(e.x, e.y, 11, u => u.kind === 'hero' && u.team !== e.team && isTargetable(u) && u.vis[e.team]);
      e.target = t?.id ?? null;
    }
    const t = e.target ? this.entities.get(e.target) : null;
    if (t && t.alive) { this._attackTarget(e, t); return; }
    // follow lane
    const pts = MAP.laneFor(e.lane, e.team);
    if (e.wp < pts.length) {
      const wp = pts[e.wp];
      if (Math.hypot(wp.x - e.x, wp.y - e.y) < 2.5) e.wp++;
      if (e.wp < pts.length) { const w = pts[e.wp]; this._followTo(e, w.x, w.y, 1); }
    } else {
      const core = MAP.cores[1 - e.team]; this._followTo(e, core.x, core.y, 4);
    }
  }

  // ---------------- towers ----------------
  _updateTower(t) {
    if (t.windup) this._resolveWindup(t);
    const range = t.stats.attackRange;
    let cur = t.target ? this.entities.get(t.target) : null;
    if (cur && (!cur.alive || !isTargetable(cur) || dist(t, cur) > range + cur.radius || !cur.vis[t.team])) cur = null;
    // priority: enemy hero hitting an allied hero in range
    const agg = this.findUnitAt(t.x, t.y, range, h => h.kind === 'hero' && h.team !== t.team && isTargetable(h) && h.vis[t.team] && h.aggroAt && this.time - h.aggroAt < 1.0 && this._heroHitAllyInRange(h, t));
    if (agg) cur = agg;
    if (!cur) cur = this.findUnitAt(t.x, t.y, range, u => (u.kind === 'minion' || u.kind === 'summon') && u.team !== t.team && u.team !== 2 && isTargetable(u))
      || this.findUnitAt(t.x, t.y, range, u => u.kind === 'hero' && u.team !== t.team && isTargetable(u) && u.vis[t.team]);
    if (!cur || cur.id !== t.target) { t.heat = 0; }
    t.target = cur?.id ?? null;
    if (cur && !t.windup && this.time >= t.nextAttackAt) this._startAttack(t, cur);
  }
  _heroHitAllyInRange(h, tower) {
    // approximate: hero is near an allied (tower team) hero that was damaged recently
    return this.heroes.some(a => a.team === tower.team && a.alive && dist(a, tower) <= tower.stats.attackRange + 2 && a.lastDamagedAt && this.time - a.lastDamagedAt < 1.0 && a.lastAttackerId === h.id);
  }

  // ---------------- monsters ----------------
  _updateMonster(e) {
    if (e.dash) { this._dashStep(e); return; }
    if (e.windup) this._resolveMonsterWindup(e);
    const home = e.home;
    const dHome = dist(e, home);
    if (e.resetting) {
      if (this._followTo(e, home.x, home.y, 0.5)) { e.resetting = false; e.hp = e.maxHp; e.lastAttackerId = null; e.damagers = {}; }
      else e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2 * DT);
      return;
    }
    let t = e.lastAttackerId != null ? this.entities.get(e.lastAttackerId) : null;
    if (t && (t.kind === 'projectile' || t.kind === 'area')) t = this.entities.get(t.ownerId);
    const leash = e.epic ? 16 : 13;
    if (!t || !t.alive || !isTargetable(t) || dist(t, home) > leash + 4 || dHome > leash) {
      if (e.lastAttackerId != null) { e.resetting = true; e.lastAttackerId = null; e.windup = null; }
      else if (dHome > 0.5) this._followTo(e, home.x, home.y, 0.5); else this._setAnim(e, 'idle');
      return;
    }
    this._attackTarget(e, t);
  }
  _resolveMonsterWindup(e) {
    const w = e.windup; if (this.time < w.at) return; e.windup = null;
    const t = this.entities.get(w.targetId); if (!t || !t.alive) return;
    if (e.monsterType === 'wyrm') {
      this.emit({ t: 'vfx', key: 'wyrm_breath', x: e.x, y: e.y, tx: t.x, ty: t.y, element: e.element, radius: 3.5 });
      for (const u of this.unitsInRadius(t.x, t.y, 3.5, u => u.team !== 2 && isUnit(u) && u.kind !== 'tower')) dealDamage(this, e, u, e.stats.power * (u === t ? 1 : 0.6), { type: 'monster' });
    } else if (e.monsterType === 'colossus') {
      this.emit({ t: 'vfx', key: 'colossus_slam', x: t.x, y: t.y, radius: 4.5 });
      for (const u of this.unitsInRadius(t.x, t.y, 4.5, u => u.team !== 2 && isUnit(u) && u.kind !== 'tower')) { dealDamage(this, e, u, e.stats.power * (u === t ? 1 : 0.7), { type: 'monster' }); }
    } else if (dist(e, t) <= e.stats.attackRange + t.radius + 3) dealDamage(this, e, t, e.stats.power, { type: 'monster' });
  }

  // ---------------- summons ----------------
  /** opts: { owner, x, y, model, stats:{maxHp,power,armor,attackRange,attackSpeed,moveSpeed}, radius, duration, think(api, self) (optional; default: follow owner & attack its target), untargetable, ghost, data } */
  spawnSummon(opts) {
    const o = opts.owner;
    const s = this.addEntity(this._unit({ kind: 'summon', team: opts.team ?? o.team, ownerId: o?.id ?? null, x: opts.x ?? o.x, y: opts.y ?? o.y, radius: opts.radius ?? 1,
      stats: { maxHp: 300, power: 20, armor: 10, attackRange: 2, attackSpeed: 1, moveSpeed: 10, ...opts.stats }, visual: { model: opts.model || 'summon', skinId: o?.visual?.skinId },
      expireAt: opts.duration ? this.time + opts.duration : null, think: opts.think, data: opts.data || {}, ghost: !!opts.ghost, static: !!opts.static,
      projectileKey: opts.projectile || null, hooks: opts.hooks }));
    if (opts.untargetable) s.statuses.push({ key: 'untargetable', until: Infinity });
    return s;
  }
  _updateSummon(e) {
    if (e.dash) { this._dashStep(e); return; }
    if (e.windup) this._resolveWindup(e);
    if (e.static) { if (e.think) e.think(this.api, e); return; }
    if (e.think) { e.think(this.api, e); if (e.order === 'custom') return; }
    const owner = this.entities.get(e.ownerId);
    const o = e.order && typeof e.order === 'object' ? e.order : null;
    if (o?.type === 'attack') { const t = this.entities.get(o.id); if (t && t.alive && isTargetable(t)) { this._attackTarget(e, t); return; } e.order = null; }
    // default: attack owner's target or nearby enemies, else follow owner
    let t = null;
    if (owner?.order?.type === 'attack') t = this.entities.get(owner.order.id);
    if (!t || !t.alive) t = this._acquire(e, 7, false);
    if (t && owner && dist(t, owner) < 16) { this._attackTarget(e, t); return; }
    if (owner && owner.alive) { if (dist(e, owner) > 4) this._followTo(e, owner.x, owner.y, 3, true); else this._setAnim(e, 'idle'); }
  }
  addWall(x, y, r, duration) {
    const h = this.nav.addObstacle(x, y, r);
    const w = this.addEntity({ kind: 'summon', team: 2, x, y, radius: r, static: true, visual: { model: 'wall' }, hp: 1, maxHp: 1, stats: blankStats(), baseStats: blankStats(), wall: true });
    w.statuses.push({ key: 'untargetable', until: Infinity });
    // push units out
    for (const u of this.unitsInRadius(x, y, r + 0.5, u => u.kind !== 'projectile' && u.kind !== 'area' && u !== w && !u.wall)) { const f = this.nav.nearestFree(u.x, u.y); u.x = f.x; u.y = f.y; }
    if (duration && duration !== Infinity) this.schedule(duration, () => { this.nav.removeObstacle(h); this.remove(w); });
    return w;
  }

  // ---------------- death & rewards ----------------
  kill(target, src) {
    if (!target.alive) return;
    if (target.hooks?.preventDeath?.(this.api, target, src) || this._preventDeath(target, src)) { target.hp = Math.max(1, target.hp); return; }
    target.alive = false; target.hp = 0; target.windup = null; target.dash = null; target.channel = null; target.recalling = null;
    target.shields = []; target.shield = 0; target.statuses = []; target.path = null; target.order = null;
    target.anim = { state: 'dead', t: 0 };
    let killer = src ? (src.ownerId != null ? this.entities.get(src.ownerId) || src : src) : null;
    // credit a hero if non-hero killed it but a hero damaged recently
    if ((!killer || killer.kind !== 'hero') && target.damagers) {
      let best = null, bt = -1; for (const id in target.damagers) { const h = this.entities.get(+id); if (h?.kind === 'hero' && h.team !== target.team && this.time - target.damagers[id] < C.ASSIST_WINDOW && target.damagers[id] > bt) { bt = target.damagers[id]; best = h; } }
      if (best && (target.kind === 'hero' || target.kind === 'monster')) killer = best;
    }
    const kHero = killer?.kind === 'hero' ? killer : null;
    this.emit({ t: 'death', id: target.id, killerId: killer?.id ?? null, kind: target.kind });
    if (kHero) this.callHooks(kHero, 'onKill', target);
    if (target.kind === 'hero') this._heroKilled(target, kHero, killer);
    else if (target.kind === 'minion') {
      target.removeAt = this.time + 1.2;
      if (kHero && kHero.team !== target.team) { this._gold(kHero, target.goldValue); kHero.cs++; }
      this._shareXp(target, 1 - target.team, target.xpValue);
    } else if (target.kind === 'tower') {
      target.removeAt = this.time + 3; this.nav.removeObstacle(target.navHandle);
      const team = 1 - target.team; this.teamStats[team].towers++;
      for (const h of this.heroes) if (h.team === team) this._gold(h, C.GOLD.tower);
      this.emit({ t: 'objective', key: 'tower', team, lane: target.lane, tier: target.tier });
      this.emit({ t: 'announce', text: `${team === 0 ? 'Blue' : 'Red'} team destroyed a tower`, team, kind: 'tower' });
    } else if (target.kind === 'core') {
      this.over = true; this.winner = 1 - target.team;
      this.emit({ t: 'objective', key: 'core', team: this.winner });
      this.emit({ t: 'match_end', winner: this.winner });
      this.eventLog.push(...this.events.filter(e => e.t === 'match_end').map(ev => ({ tick: this.tickCount, ev })));
    } else if (target.kind === 'monster') this._monsterKilled(target, kHero);
    else target.removeAt = this.time + 0.8;
  }
  _preventDeath(t, src) { let prevented = false; if (t.kind === 'hero') { const info = { prevent: false }; this.callHooks(t, 'beforeDeath', src, info); prevented = info.prevent; } return prevented; }
  _respawnTime(h) { const late = Math.max(0, this.time - 600) / 60; return Math.min(42, 4 + h.level * 2.3 + late * 1.6 + (this.finalSwell ? 3 : 0)); }
  _heroKilled(v, kHero, killer) {
    v.deaths++; v.respawnAt = this.time + this._respawnTime(v);
    this.callHooks(v, 'onDeath', killer);
    const team = 1 - v.team;
    this.teamStats[team].kills++;
    const assists = [];
    if (v.damagers) for (const id in v.damagers) { const h = this.entities.get(+id); if (h?.kind === 'hero' && h.team === team && h !== kHero && this.time - v.damagers[id] < C.ASSIST_WINDOW) assists.push(h); }
    let bounty = C.GOLD.heroKill + (v.streak >= 3 ? Math.min(300, 60 * (v.streak - 2)) : 0) - (v.deathsInRow >= 2 ? Math.min(150, 50 * (v.deathsInRow - 1)) : 0);
    if (!this.firstBlood && kHero) { this.firstBlood = true; bounty += C.GOLD.firstBlood; this.emit({ t: 'announce', text: `First Blood! ${kHero.name} slew ${v.name}`, team, kind: 'firstblood' }); }
    if (kHero) { kHero.kills++; kHero.streak++; kHero.deathsInRow = 0; this._gold(kHero, bounty); }
    for (const a of assists) { a.assists++; this._gold(a, C.GOLD.assist); }
    v.streak = 0; v.deathsInRow = (v.deathsInRow || 0) + 1; v.damagers = {};
    this._shareXp(v, team, (140 + 45 * v.level) * C.ECON);
    const text = kHero ? `${kHero.name} slew ${v.name}` : `${v.name} was executed`;
    this.emit({ t: 'kill', killerId: kHero?.id ?? killer?.id ?? null, victimId: v.id, assistIds: assists.map(a => a.id), text, team });
    if (kHero && kHero.streak >= 3) this.emit({ t: 'announce', text: kHero.streak >= 5 ? `${kHero.name} is UNSTOPPABLE!` : `${kHero.name} is on a rampage!`, team, kind: 'streak' });
  }
  _monsterKilled(mon, kHero) {
    mon.removeAt = this.time + 2;
    const type = mon.monsterType; const s = C.MONSTER[type];
    const team = kHero ? kHero.team : null;
    if (mon.campId) {
      const c = this.camps.find(c => c.id === mon.campId); c.unitId = null; c.respawnAt = this.time + s.respawn;
      if (kHero) {
        this._gold(kHero, s.gold); this._giveXp(kHero, s.xp); kHero.cs += type === 'camp_big' ? 4 : 2;
        if (type === 'camp_big') { this.addMod(kHero, { duration: C.BIG_CAMP_BUFF, mul: { power: 1.1 }, add: { hpRegen: 5 }, tag: 'verdant' }); kHero.buffs = kHero.buffs.filter(b => b.key !== 'verdant'); kHero.buffs.push({ key: 'verdant', until: this.time + C.BIG_CAMP_BUFF }); }
        this.callHooks(kHero, 'onCampKill', mon);
      }
      return;
    }
    if (team === null) { // nobody credited: respawn
      const o = this.objectives[type]; o.alive = false; o.id = null; o.respawnAt = this.time + 30; return;
    }
    const o = this.objectives[type]; o.alive = false; o.id = null; o.respawnAt = this.time + s.respawn;
    const bonus = this.swellBonus?.[type] ? 2 : 1; if (bonus > 1) this.swellBonus[type] = false;
    for (const h of this.heroes) if (h.team === team) this._giveXp(h, s.xp * 0.5 * bonus);
    if (type === 'wyrm') {
      const el = mon.element; const ts = this.teamStats[team];
      ts.wyrms.push(el); this.objectives.soul[team] = ts.wyrms.length;
      for (const h of this.heroes) if (h.team === team) this._gold(h, 100 * C.ECON * bonus);
      this.emit({ t: 'objective', key: 'wyrm', team, element: el });
      this.emit({ t: 'announce', text: `${team === 0 ? 'Blue' : 'Red'} team slew the ${C.ELEMENT_INFO[el].name}!`, team, kind: 'wyrm', element: el });
      if (ts.wyrms.length === 3 && !ts.soul) this._grantSoul(team, el);
      o.nextElement = this.rng.pick(C.ELEMENTS.filter(e => e !== el));
      this._livingMap(team, el);
    } else if (type === 'colossus') {
      const ts = this.teamStats[team]; ts.colossus++; ts.mightUntil = this.time + C.MIGHT_DURATION;
      for (const h of this.heroes) if (h.team === team) { this._gold(h, 250 * C.ECON * bonus); if (h.alive) { h.buffs = h.buffs.filter(b => b.key !== 'might'); h.buffs.push({ key: 'might', until: ts.mightUntil }); } }
      this.emit({ t: 'objective', key: 'colossus', team });
      this.emit({ t: 'announce', text: `${team === 0 ? 'Blue' : 'Red'} team claimed Colossus Might!`, team, kind: 'colossus' });
    }
  }
  _grantSoul(team, el) {
    const ts = this.teamStats[team]; ts.soul = el;
    this.emit({ t: 'announce', text: `${team === 0 ? 'Blue' : 'Red'} team claimed ${el[0].toUpperCase() + el.slice(1)} Soul!`, team, kind: 'soul', element: el });
    const hooks = {};
    if (el === 'ember') hooks.modifyDamageDealt = (api, h, t, info) => { if (info.type === 'ability') info.amount *= 1.08; };
    if (el === 'tide') hooks.onDamageDealt = (api, h, t) => { if (t.kind === 'hero' && (h.data._tideAt || -99) + 4 <= api.time) { h.data._tideAt = api.time; api.heal(h, h.maxHp * 0.06, h); } };
    if (el === 'gale') hooks.computeStats = (api, h, s) => { if (api.time - (h.lastCombatAt || -99) > 3) s.moveSpeed *= 1.25; };
    if (el === 'stone') hooks.onTick = (api, h) => { if ((h.data._stoneAt || -99) + 15 <= api.time) { h.data._stoneAt = api.time; api.shield(h, h.maxHp * 0.12, 6, 'stone_soul'); } };
    this.teamHooks[team].push(hooks);
  }
  // Living map: an objective kill transforms the pit zone for the slaying team (telegraphed 5s)
  _livingMap(team, el) {
    const zone = MAP.zones.wyrm; const kind = { ember: 'ember', tide: 'flood', gale: 'gale', stone: 'stone' }[el];
    const at = this.time + 5;
    this.emit({ t: 'mapchange', phase: 'telegraph', zone, kind, team, at });
    this.schedule(5, () => {
      for (const mc of this.mapChanges) mc.cleanup();
      this.mapChanges = [];
      const area = spawnArea(this, { x: zone.x, y: zone.y, radius: zone.r, duration: 1e9, team, visual: 'zone_' + kind, tickEvery: 0.25,
        onTick: (m, a, units) => {
          for (const u of units) {
            if (u.kind !== 'hero' && u.kind !== 'minion' && u.kind !== 'summon') continue;
            const ally = u.team === team;
            if (kind === 'flood') { if (ally) addStatus(m, u, 'speed', 0.4, { amount: 0.15, tag: 'zone' }); else addStatus(m, u, 'slow', 0.4, { amount: 0.2, tag: 'zone' }); }
            else if (kind === 'gale') { if (ally) addStatus(m, u, 'speed', 0.4, { amount: 0.25, tag: 'zone' }); }
            else if (kind === 'ember') { if (!ally && u.kind === 'hero') dealDamage(m, null, u, (10 + m.time / 60 * 1.5) * 0.25 * 4, { type: 'true', noHooks: true }); }
            else if (kind === 'stone') { if (ally) m.addMod(u, { duration: 0.4, add: { armor: 20 }, tag: 'zone_stone' }); }
          }
        } });
      const walls = [];
      if (kind === 'stone') for (const [dx, dy] of [[-9, -6], [9, -6], [-7, 8], [7, 8]]) walls.push(this.addWall(zone.x + dx, zone.y + dy, 2.2, Infinity));
      this.mapChanges.push({ kind, team, cleanup: () => { this.remove(area); for (const w of walls) { this.nav.dynObs.filter(o => o.x === w.x && o.y === w.y).forEach(o => this.nav.removeObstacle(o)); this.remove(w); } } });
      this.emit({ t: 'mapchange', phase: 'apply', zone, kind, team, at: this.time });
    });
  }
  _gold(h, amt) { h.gold += amt; this.teamStats[h.team].gold += amt; this.emit({ t: 'gold', id: h.id, amount: Math.round(amt) }); }
  _shareXp(src, team, xp) {
    const hs = this.heroes.filter(h => h.team === team && h.alive && dist(h, src) <= C.XP_SHARE_RADIUS);
    if (!hs.length) return;
    const each = xp * (hs.length > 1 ? 1.25 : 1) / hs.length;
    for (const h of hs) this._giveXp(h, each);
  }
  _giveXp(h, xp) {
    if (h.level >= C.MAX_LEVEL) return;
    h.xp += xp;
    while (h.level < C.MAX_LEVEL && h.xp >= C.XP_TABLE[h.level]) {
      h.level++;
      this._recomputeHeroStats(h);
      this.emit({ t: 'levelup', id: h.id, level: h.level });
      if (C.AUGMENT_LEVELS.includes(h.level)) { h.pendingAugments.push(h.level); h.pendingAugment = h.pendingAugments[0]; }
      this.callHooks(h, 'onLevelUp', h.level);
    }
  }
  _economy() {
    if (this.time > C.WAVE_FIRST && this.tickCount % ECON_EVERY === 0) for (const h of this.heroes) this._gold(h, C.PASSIVE_GOLD);
  }

  // ---------------- vision ----------------
  _vision() {
    const viewers = [[], []];
    for (const e of this.entities.values()) {
      if (!e.alive || e.team === 2) continue;
      let r = 0;
      if (e.kind === 'hero') r = 20; else if (e.kind === 'minion') r = 12; else if (e.kind === 'tower') r = 18; else if (e.kind === 'core') r = 20; else if (e.kind === 'summon' && !e.wall) r = e.visionRange ?? 10;
      if (r) viewers[e.team].push({ x: e.x, y: e.y, r, brush: inBrush(e.x, e.y), kind: e.kind });
    }
    for (const t of [0, 1]) viewers[t].push({ x: MAP.fountains[t].x, y: MAP.fountains[t].y, r: 26, brush: -1 });
    for (const e of this.entities.values()) {
      if (e.kind === 'projectile' || e.kind === 'area' || e.kind === 'tower' || e.kind === 'core') { e.vis[0] = e.vis[1] = true; continue; }
      const b = inBrush(e.x, e.y);
      const invis = hasStatus(e, 'invisible');
      const revealed = hasStatus(e, 'revealed');
      for (const t of [0, 1]) {
        if (e.team === t) { e.vis[t] = true; continue; }
        if (revealed) { e.vis[t] = true; continue; }
        let seen = false;
        for (const v of viewers[t]) {
          const d2 = (v.x - e.x) ** 2 + (v.y - e.y) ** 2;
          if (invis) { if (d2 < 2.5 * 2.5 || (v.kind === 'tower' && d2 < 64)) { seen = true; break; } continue; }
          if (d2 > v.r * v.r) continue;
          if (b >= 0 && v.brush !== b && d2 > 9) continue;
          seen = true; break;
        }
        e.vis[t] = seen || (e.kind === 'hero' && e.alive && e.lastHeroHitAt && this.time - e.lastHeroHitAt < 0.5 && false);
      }
    }
  }
}

function c_tick(m, h) { h.channel?.onTick?.(m.api, h); }
