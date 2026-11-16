// Kaela — Ember Duelist (Fighter, melee). Owner: Agent A.
const MAX_HEAT = 100;
const hot = (api, h) => (h.data.overUntil || 0) > api.time || (h.data.infernoUntil || 0) > api.time;
const addHeat = (api, h, n) => {
  const d = h.data; if (hot(api, h)) return;
  d.heat = Math.min(MAX_HEAT, (d.heat || 0) + n);
  if (d.heat >= MAX_HEAT) { d.overUntil = api.time + 4; api.vfx('kaela_p', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id, duration: 4 }); }
};

function lunge(api, h, aim, second) {
  const L = Math.max(3.5, Math.min(6, aim.dist + 1));
  const tx = h.x + aim.dirX * L, ty = h.y + aim.dirY * L;
  const isHot = hot(api, h);
  let dmg = api.scale(h, 50, 15, 0.6) * (isHot ? 1.4 : 1) * (second && api.aug(h, 3, 'a') ? 1.4 : 1);
  api.vfx(second ? 'kaela_q2' : 'kaela_q', { x: h.x, y: h.y, tx, ty, team: h.team, srcId: h.id, hot: isHot });
  api.dashHit(h, tx, ty, { speed: 34, radius: 1.8, onHit: (t) => {
    api.hit(h, t, dmg, 'kaela_q');
    if (isHot) api.slow(h, t, 0.3, 1, 'kaela_q');
  } });
  addHeat(api, h, 15);
}

export default {
  id: 'kaela', name: 'Kaela', title: 'Ember Duelist', role: 'Fighter', difficulty: 2,
  color: '#ff6b35', lore: 'A blade-dancer who learned to fight inside a forge fire — and never quite stepped out.',
  base: { maxHp: 640, power: 58, armor: 28, attackRange: 2.6, attackSpeed: 0.8, moveSpeed: 10.1, hpRegen: 2.8 },
  growth: { maxHp: 88, power: 4.3, armor: 3, attackSpeed: 0.022, hpRegen: 0.2 },
  attackRatio: 1, ranged: false, projectile: null,
  abilities: {
    passive: { name: 'Heat', desc: 'Attacks (+14) and abilities (+15) build Heat. At 100 Heat she Overheats for 4s: abilities are empowered, but she burns for 2% max HP/s.' },
    q: {
      name: 'Searing Lunge', desc: 'Dash up to 6m, dealing 50 (+15/lvl, +60% Power) to enemies passed. Recast within 3s to lunge again. Hot: +40% damage and 30% slow.',
      cd: 8, range: 6, targeting: 'skillshot', tags: ['engage', 'escape', 'burst'],
      bot: { kind: 'dash', engage: true, escape: true, radius: 1.8, recast: 'chase' },
      cast(api, h, aim) {
        if (api.recastOpen(h, 'q')) { lunge(api, h, aim, true); return api.closeRecast(h, 'q'); }
        lunge(api, h, aim, false);
        return api.openRecast(h, 'q', 3, 8);
      },
    },
    w: {
      name: 'Flare Parry', desc: 'For 0.8s, block all incoming damage. Then flare out (4.5m) for 50 (+16/lvl, +60% Power) +30% of damage blocked, slowing 40%. Hot: stuns 0.75s instead.',
      cd: 12, range: 0, targeting: 'self', tags: ['shield', 'peel', 'cc'],
      bot: { kind: 'parry', radius: 4.5 },
      cast(api, h) {
        const dur = 0.8 + (api.aug(h, 6, 'a') ? 0.4 : 0);
        h.data.blocked = 0;
        api.setBuff(h, 'parry', dur);
        api.vfx('kaela_w', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id, duration: dur });
        api.tempHook(h, { modifyDamageTaken(a, self, src, info) { if (src && src.team !== self.team && info.type !== 'true') { self.data.blocked += info.amount; info.amount = 0; } } }, dur, 'kaela_parry');
        api.schedule(dur, () => {
          if (!h.alive) return;
          const isHot = hot(api, h); const blk = Math.min(h.data.blocked, h.maxHp * 0.5);
          api.vfx('kaela_w_hit', { x: h.x, y: h.y, radius: 4.5, team: h.team, srcId: h.id, hot: isHot });
          for (const e of api.enemiesInRadius(h, h.x, h.y, 4.5)) {
            api.hit(h, e, api.scale(h, 50, 16, 0.6) + blk * 0.3, 'kaela_w');
            if (isHot) api.stun(h, e, 0.75); else api.slow(h, e, 0.4, 1.25, 'kaela_w');
          }
          if (api.aug(h, 6, 'b') && blk > 0) api.heal(h, blk * 0.4, h);
          addHeat(api, h, 15);
        });
      },
    },
    r: {
      name: 'Inferno Form', desc: 'Become living flame for 8s: +15 (+3/lvl) Power, +0.3 Attack Speed, +15 Armor, +1.5 Move Speed, permanently Hot (no burn), and scorch nearby enemies for 20 (+6/lvl, +20% Power) per second.',
      cd: 80, range: 0, targeting: 'self', tags: ['engage', 'burst'],
      bot: { kind: 'selfBuff', radius: 8 },
      cast(api, h) {
        const dur = 8 + (api.aug(h, 9, 'a') ? 3 : 0);
        h.data.infernoUntil = api.time + dur; h.data.heat = MAX_HEAT;
        api.mod(h, { duration: dur, add: { power: 15 + 3 * (h.level - 1), attackSpeed: 0.3, armor: 15, moveSpeed: 1.5 }, tag: 'kaela_r' });
        api.status(h, 'inferno', dur);
        if (api.aug(h, 9, 'b')) api.heal(h, h.maxHp * 0.2, h);
        api.vfx('kaela_r', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id, duration: dur, radius: 4 });
        api.zone({ src: h, x: h.x, y: h.y, radius: 4, duration: dur, followId: h.id, visual: 'kaela_r_aura', tickEvery: 0.5,
          onTick: () => { if (!h.alive) return; for (const e of api.enemiesInRadius(h, h.x, h.y, 4)) api.hit(h, e, api.scale(h, 20, 6, 0.2) * 0.5, 'kaela_r'); } });
      },
    },
  },
  augments: {
    3: { a: { name: 'Follow-Through', desc: 'Q: the second lunge deals 40% more damage.' }, b: { name: 'Bloodrush', desc: 'Q: Searing Lunge resets when you kill a champion.' } },
    6: { a: { name: 'Patient Blade', desc: 'W: Flare Parry lasts 0.4s longer.' }, b: { name: 'Cauterize', desc: 'W: heal for 40% of damage blocked.' } },
    9: { a: { name: 'Everburn', desc: 'R: Inferno Form lasts 3s longer.' }, b: { name: 'Rekindle', desc: 'R: casting Inferno Form heals 20% max HP.' } },
  },
  hooks: {
    onTick(api, h, dt) {
      const d = h.data; if (d.heat === undefined) d.heat = 0;
      if ((d.overUntil || 0) > api.time) {
        if ((d.infernoUntil || 0) <= api.time) { // burn (non-lethal)
          const b = h.maxHp * 0.02 * dt; if (h.hp - b > 1) h.hp -= b;
        }
        api.setBuff(h, 'overheat', 0.2);
      } else if (d.overUntil && (d.infernoUntil || 0) <= api.time) { d.overUntil = 0; d.heat = 0; }
      if ((d.infernoUntil || 0) > api.time) d.heat = MAX_HEAT;
      else if (d.infernoUntil) { d.infernoUntil = 0; d.heat = 40; }
      else if (!api.inCombat(h, 4) && d.heat > 0 && !(d.overUntil > api.time)) d.heat = Math.max(0, d.heat - 10 * dt);
      api.setResource(h, 'Heat', Math.round(d.heat), MAX_HEAT, hot(api, h) ? '#ff3b1f' : '#ff9a4a');
    },
    onAttackHit(api, h) { addHeat(api, h, 14); },
    modifyAutoAttack(api, h, t, info) { if (hot(api, h)) info.amount *= 1.1; },
    onKill(api, h, t) { if (t.kind === 'hero' && api.aug(h, 3, 'b')) { api.reduceCooldown(h, 'q', 999); const r = h.data._recast?.q; if (r) { delete h.data._recast.q; h.abilities.q.recastUntil = null; } } },
    onDeath(api, h) { h.data.heat = 0; h.data.overUntil = 0; h.data.infernoUntil = 0; },
  },
  bot: {
    preferredRole: 'lane', comboOrder: ['r', 'q', 'w', 'q'], style: 'bruiser',
    loadout: { items: ['warblade', 'bulwark', 'emberbrand'], relic: 'blink', sigils: { offense: 'fervor', utility: 'steadfast' } },
    branches: { warblade: 'a', bulwark: 'b', emberbrand: 'a' },
    augments: { 3: 'a', 6: 'b', 9: 'a' },
  },
};
