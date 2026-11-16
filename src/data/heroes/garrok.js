// Garrok — Beastcaller (Jungler, melee). Owner: Agent A.
const MAX_BOND = 20;
const wolfOf = (api, h) => { const w = api.entity(h.data.wolfId); return w && w.alive ? w : null; };
const huntedBy = (api, h, t) => !!t.statuses?.some(s => s.key === 'alpha_mark' && s.sourceId === h.id);

function wolfStats(h, temp) {
  const L = h.level - 1, b = temp ? 0 : (h.data.bond || 0);
  return { maxHp: 220 + 35 * L + 20 * b, power: 10 + 1.5 * L + 1.25 * b, armor: 12 + 1.5 * L, attackRange: 2.2, attackSpeed: 0.85, moveSpeed: Math.max(10.5, h.stats.moveSpeed * 1.05), hpRegen: 2 };
}

function spawnWolf(api, h, temp = false) {
  const w = api.summon({ owner: h, x: h.x + (h.team === 0 ? -1.5 : 1.5), y: h.y + 1, model: temp ? 'garrok_wolf_alpha' : 'garrok_wolf', radius: 1.0, stats: wolfStats(h, temp), duration: temp ? 8 : 0,
    think: (a, s) => {
      if (!h.alive) return;
      if (api.dist(s, h) > 24 && !s.dash) { const p = api.clampToNav(h.x - 1, h.y + 1); api.teleport(s, p.x, p.y); s.order = null; }
      const hunt = api.entity(h.data.huntId);
      if (hunt && hunt.alive && huntedBy(api, h, hunt) && hunt.vis[h.team] && api.dist(hunt, h) < 20) s.order = { type: 'attack', id: hunt.id };
      else if (s.order?.type === 'attack' && s.order.id === h.data.huntId) s.order = null;
      if (h.recalling && !s.order) { if (api.dist(s, h) > 2.5) api.m._followTo(s, h.x, h.y, 2); s.order = 'custom'; return; }
      if (s.order === 'custom') s.order = null;
    } });
  w.visionRange = 8; w.data.temp = temp;
  w.hooks = { modifyDamageTaken(a, self, src, info) { if (src && (src.kind === 'tower' || src.kind === 'hero')) info.amount *= src.kind === 'tower' ? 1.6 : 1.15; } };
  if (!temp) { h.data.wolfId = w.id; h.data.wolfRespawnAt = null; }
  api.vfx('garrok_wolf_spawn', { x: w.x, y: w.y, team: h.team, srcId: h.id, targetId: w.id });
  return w;
}

export default {
  id: 'garrok', name: 'Garrok', title: 'Beastcaller', role: 'Jungler', difficulty: 2,
  color: '#b5651d', lore: 'Raised by the dire-pack of the Hollow Wilds, Garrok still hunts with his oldest brother at his side.',
  base: { maxHp: 600, power: 53, armor: 27, attackRange: 2.6, attackSpeed: 0.78, moveSpeed: 10.1, hpRegen: 3 },
  growth: { maxHp: 85, power: 3.8, armor: 3, attackSpeed: 0.02, hpRegen: 0.25 },
  attackRatio: 1, ranged: false, projectile: null, windup: 0.24,
  abilities: {
    passive: { name: 'Pack Bond', desc: 'Garrok fights with his wolf. Each camp cleared adds Bond (+2 for big camps, max 20), permanently strengthening the wolf. Both deal +10% damage to monsters. The wolf revives after 25s.' },
    q: {
      name: 'Pack Leap Landing resets your attack timer.', desc: 'Garrok and his wolf leap to a point (8m), dealing 55 (+16/lvl, +55% Power) around Garrok and slowing 30% for 1s. The wolf\'s landing adds 40% damage.',
      cd: 9, range: 8, targeting: 'point', tags: ['engage', 'farm', 'escape'],
      bot: { kind: 'leap', engage: true, escape: true, farm: true, radius: 3.2 },
      cast(api, h, aim) {
        const tx = aim.x, ty = aim.y;
        api.vfx('garrok_q', { x: h.x, y: h.y, tx, ty, radius: 3.2, team: h.team, srcId: h.id });
        api.dash(h, tx, ty, 32, { passWalls: true, onArrive: () => {
          api.resetAttack(h);
          api.vfx('garrok_q_hit', { x: h.x, y: h.y, radius: 3.2, team: h.team, srcId: h.id });
          for (const e of api.enemiesInRadius(h, h.x, h.y, 3.2)) {
            const dealt = api.hit(h, e, api.scale(h, 55, 16, 0.55), 'garrok_q');
            api.slow(h, e, 0.3, 1, 'garrok_q');
            if (api.aug(h, 3, 'b') && e.kind === 'monster') api.heal(h, dealt * 0.5, h);
          }
        } });
        const w = wolfOf(api, h);
        if (w) {
          const ox = tx - aim.dirX * 1.2 + aim.dirY * 1.2, oy = ty - aim.dirY * 1.2 - aim.dirX * 1.2;
          api.dash(w, ox, oy, 34, { passWalls: true, onArrive: () => {
            for (const e of api.enemiesInRadius(h, w.x, w.y, 2.6)) { api.hit(w, e, api.scale(h, 60, 18, 0.6) * 0.4, 'garrok_q'); if (api.aug(h, 3, 'a')) api.stun(h, e, 0.5); }
          } });
        }
      },
    },
    w: {
      name: 'Feral Roar', desc: 'Roar (6m): enemy champions and minions flee in fear for 1s; monsters are slowed. Garrok and his wolf gain +0.3 Attack Speed and +15 Armor for 4s.',
      cd: 14, range: 0, targeting: 'self', tags: ['cc', 'peel', 'buff'],
      bot: { kind: 'selfAoE', radius: 5.5, peel: true },
      cast(api, h) {
        const dur = 1 + (api.aug(h, 6, 'a') ? 0.4 : 0);
        api.vfx('garrok_w', { x: h.x, y: h.y, radius: 6, team: h.team, srcId: h.id });
        for (const e of api.enemiesInRadius(h, h.x, h.y, 6)) {
          if (e.kind === 'monster') api.slow(h, e, 0.3, 2, 'garrok_w'); else api.fear(h, e, dur);
        }
        const buff = { duration: 4, add: { attackSpeed: 0.3, armor: 15 }, tag: 'garrok_w' };
        api.mod(h, buff);
        const w = wolfOf(api, h); if (w) api.mod(w, { ...buff });
        if (api.aug(h, 6, 'b')) { api.heal(h, h.maxHp * 0.1, h); if (w) api.heal(w, w.maxHp * 0.1, h); }
      },
    },
    r: {
      name: 'Alpha Hunt', desc: 'Mark an enemy champion for 8s: it is revealed, Garrok gains 25% Move Speed, and he and all his beasts deal +20% damage to it. If it dies while marked, refund half the cooldown.',
      cd: 80, range: 22, targeting: 'unit', tags: ['engage', 'burst'],
      targetFilter: (e) => e.kind === 'hero',
      bot: { kind: 'target', engage: true },
      cast(api, h, aim) {
        const t = aim.target; if (!t) return false;
        h.data.huntId = t.id; h.data.huntUntil = api.time + 8;
        api.status(t, 'alpha_mark', 8, { sourceId: h.id });
        api.status(t, 'revealed', 8, { sourceId: h.id });
        api.speed(h, 0.25, 8, 'garrok_r');
        api.vfx('garrok_r', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id, duration: 8 });
        if (api.aug(h, 9, 'a')) spawnWolf(api, h, true);
      },
    },
  },
  augments: {
    3: { a: { name: 'Pounce', desc: 'Q: the wolf\'s landing stuns for 0.5s.' }, b: { name: 'Feast', desc: 'Q: heal for 50% of Pack Leap damage dealt to monsters.' } },
    6: { a: { name: 'Dread Howl', desc: 'W: fear lasts 0.4s longer.' }, b: { name: 'Pack Mend', desc: 'W: Roar heals Garrok and his wolf for 10% max HP.' } },
    9: { a: { name: 'Call the Pack', desc: 'R: Alpha Hunt summons a second wolf for its duration.' }, b: { name: 'Apex', desc: 'R: Alpha Hunt bonus damage becomes +35%.' } },
  },
  hooks: {
    onSpawn(api, h) { h.data.bond = 0; spawnWolf(api, h); },
    onRespawn(api, h) { if (!wolfOf(api, h)) spawnWolf(api, h); },
    onDeath(api, h) { const w = wolfOf(api, h); if (w) { w.alive = false; api.m.remove(w); } h.data.wolfRespawnAt = null; },
    onTick(api, h) {
      const d = h.data; d._now = api.time;
      const w = wolfOf(api, h);
      if (!w) { if (d.wolfRespawnAt == null) d.wolfRespawnAt = api.time + 25; else if (api.time >= d.wolfRespawnAt && h.alive) spawnWolf(api, h); }
      else if (api.m.tickCount % api.ticks(0.5) === 0) {
        const st = wolfStats(h, w.data.temp); const oldMax = w.baseStats.maxHp;
        Object.assign(w.baseStats, st); w.maxHp = st.maxHp; if (st.maxHp > oldMax) w.hp += st.maxHp - oldMax;
      }
      api.setResource(h, 'Bond', d.bond || 0, MAX_BOND, '#b5651d');
    },
    onCampKill(api, h, mon) {
      h.data.bond = Math.min(MAX_BOND, (h.data.bond || 0) + (mon.monsterType === 'camp_big' ? 2 : 1));
      api.vfx('garrok_p', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id });
    },
    modifyDamageDealt(api, h, t, info) {
      if (t.kind === 'monster') info.amount *= 1.1;
      if ((h.data.huntUntil || 0) > api.time && huntedBy(api, h, t)) info.amount *= api.aug(h, 9, 'b') ? 1.35 : 1.2;
    },
    onKill(api, h, t) { if (t.kind === 'hero' && t.id === h.data.huntId && (h.data.huntUntil || 0) > api.time) { api.reduceCooldown(h, 'r', 40); h.data.huntUntil = 0; } },
  },
  bot: {
    preferredRole: 'jungle', comboOrder: ['r', 'q', 'w'], style: 'bruiser',
    loadout: { items: ['warblade', 'heartwood', 'emberbrand'], relic: 'hunters_brand', sigils: { offense: 'predator', utility: 'trailblazer' } },
    branches: { warblade: 'a', heartwood: 'a', emberbrand: 'a' },
    augments: { 3: 'b', 6: 'a', 9: 'b' },
  },
};
