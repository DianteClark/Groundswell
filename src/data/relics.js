// Relics (summoner-spell-like actives + built-in passive bonus). Owner: Agent A.
// cd is NOT reduced by Haste.
import { inBrush } from '../sim/map.js';
export const RELICS = [
  { id: 'blink', name: 'Blink', icon: '✨', cd: 150, range: 7, targeting: 'point', unlock: { cost: 0 },
    desc: 'Teleport up to 7m.', bonusDesc: 'Your next attack within 3s after blinking deals +30% damage.',
    bot: { kind: 'blink' },
    cast(api, h, aim) {
      const p = api.clampToNav(aim.x, aim.y);
      api.vfx('relic_blink', { x: h.x, y: h.y, tx: p.x, ty: p.y, team: h.team, srcId: h.id });
      api.teleport(h, p.x, p.y); h.data._blinkAt = api.time;
    },
    hooks: { modifyAutoAttack(api, h, t, info) { if (api.time - (h.data._blinkAt ?? -99) < 3) { h.data._blinkAt = -99; info.amount *= 1.3; info.empowered = true; } } } },

  { id: 'hunters_brand', name: 'Hunter\'s Brand', icon: '🔥', cd: 40, range: 6, targeting: 'unit', unlock: { cost: 0 },
    targetFilter: (e) => e.kind === 'monster' || e.kind === 'hero' || e.kind === 'minion',
    desc: 'Brand a monster or minion for 450 (+40/lvl) true damage and heal 80 (+10/lvl) — or brand a champion for 60 (+10/lvl) true damage, revealing and slowing it 20% for 3s.',
    bonusDesc: 'Deal +25% damage to monsters and heal 40 (+5/lvl) whenever you kill one.',
    bot: { kind: 'smite' },
    cast(api, h, aim) {
      const t = aim.target; if (!t) return false;
      api.vfx('relic_brand', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id });
      if (t.kind === 'hero') {
        api.damage(h, t, 60 + 10 * (h.level - 1), { type: 'true', ability: 'relic_brand' });
        api.status(t, 'revealed', 3, { sourceId: h.id }); api.slow(h, t, 0.2, 3, 'brand');
      } else {
        api.damage(h, t, 450 + 40 * (h.level - 1), { type: 'true', ability: 'relic_brand' });
        api.heal(h, 80 + 10 * (h.level - 1), h);
      }
    },
    hooks: {
      modifyDamageDealt(api, h, t, info) { if (t.kind === 'monster') info.amount *= 1.25; },
      onKill(api, h, t) { if (t.kind === 'monster') api.heal(h, 40 + 5 * (h.level - 1), h); },
    } },

  { id: 'barrier', name: 'Barrier', icon: '🔰', cd: 110, range: 0, targeting: 'self', unlock: { cost: 0 },
    desc: 'Gain a 120 (+30/lvl) shield for 2.5s.', bonusDesc: '+5 Armor.',
    bot: { kind: 'defensive' },
    cast(api, h) { api.shield(h, 120 + 30 * (h.level - 1), 2.5, 'relic_barrier', h); api.vfx('relic_barrier', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id, duration: 2.5 }); },
    hooks: { computeStats(api, h, s) { s.armor += 5; } } },

  { id: 'second_wind', name: 'Second Wind', icon: '💗', cd: 120, range: 0, targeting: 'self', unlock: { cost: 350 },
    desc: 'Heal 90 (+25/lvl) and gain 25% Move Speed for 1s.', bonusDesc: '+1.5 HP Regen.',
    bot: { kind: 'defensive' },
    cast(api, h) { api.heal(h, 90 + 25 * (h.level - 1), h); api.speed(h, 0.25, 1, 'second_wind'); api.vfx('relic_heal', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id }); },
    hooks: { computeStats(api, h, s) { s.hpRegen += 1.5; } } },

  { id: 'lantern', name: 'Seer\'s Lantern', icon: '🏮', cd: 60, range: 10, targeting: 'point', unlock: { cost: 400 },
    desc: 'Place a hidden lantern for 90s that grants vision in a 12m radius. Enemies must stand next to it to see and destroy it.',
    bonusDesc: '+0.4 Move Speed in brush and river.',
    bot: { kind: 'ward' },
    cast(api, h, aim) {
      const p = api.clampToNav(aim.x, aim.y);
      const w = api.summon({ owner: h, x: p.x, y: p.y, model: 'relic_lantern', static: true, radius: 0.6, duration: 90, stats: { maxHp: 3, armor: 0, power: 0, attackRange: 0, attackSpeed: 0.1, moveSpeed: 0 } });
      w.visionRange = 12; w.statuses.push({ key: 'invisible', until: Infinity }); w.ward = true;
      api.vfx('relic_lantern', { x: p.x, y: p.y, team: h.team, srcId: h.id, targetId: w.id });
      w.hooks = { modifyDamageTaken(a, self, src, info) { info.amount = 1; } };
    },
    hooks: { computeStats(api, h, s) { const inRiver = h.x > 110 && h.x < 130; if (inRiver || inBrush(h.x, h.y) >= 0) s.moveSpeed += 0.4; } } },

  { id: 'ghost', name: 'Phantom Stride', icon: '👣', cd: 120, range: 0, targeting: 'self', unlock: { cost: 450 },
    desc: 'Gain 35% Move Speed for 4s and pass through units.', bonusDesc: '+0.3 Move Speed.',
    bot: { kind: 'mobility' },
    cast(api, h) {
      api.speed(h, 0.35, 4, 'relic_ghost'); h.ghost = true; api.status(h, 'ghosted', 4);
      api.vfx('relic_ghost', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id, duration: 4 });
      api.schedule(4, () => { h.ghost = false; });
    },
    hooks: { computeStats(api, h, s) { s.moveSpeed += 0.3; } } },

  { id: 'purify', name: 'Purify', icon: '💠', cd: 110, range: 0, targeting: 'self', unlock: { cost: 600 },
    desc: 'Remove all crowd control and become Unstoppable for 1s.', bonusDesc: '+10% Tenacity.',
    bot: { kind: 'cleanse' },
    cast(api, h) {
      api.cleanse(h); if (h.dash?.forced) h.dash = null;
      api.status(h, 'unstoppable', 1);
      api.vfx('relic_purify', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id });
    },
    hooks: { computeStats(api, h, s) { s.tenacity = (s.tenacity || 0) + 0.1; } } },

  { id: 'ignite', name: 'Scorch', icon: '☄', cd: 120, range: 7, targeting: 'unit', unlock: { cost: 500 },
    targetFilter: (e) => e.kind === 'hero',
    desc: 'Set an enemy champion ablaze: 70 (+18/lvl) true damage over 4s and Grievous Wounds (healing −40%).', bonusDesc: '+4% damage to champions below 50% HP.',
    bot: { kind: 'ignite' },
    cast(api, h, aim) {
      const t = aim.target; if (!t || t.kind !== 'hero') return false;
      const total = 70 + 18 * (h.level - 1);
      api.status(t, 'grievous', 4, { sourceId: h.id }); api.status(t, 'burning', 4, { sourceId: h.id });
      api.vfx('relic_ignite', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id, duration: 4 });
      for (let i = 1; i <= 4; i++) api.schedule(i, () => { if (t.alive) api.damage(h, t, total / 4, { type: 'true', ability: 'relic_ignite', noLifesteal: true }); });
    },
    hooks: { modifyDamageDealt(api, h, t, info) { if (t.kind === 'hero' && t.hp < t.maxHp * 0.5) info.amount *= 1.04; } } },
];
export const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));
