// Bram — Ironroot Warden (Tank, melee). Owner: Agent A.
const MAX_BARK = 6;
const barkPer = (h) => 2.5 + 0.4 * (h.level - 1);

function slamHit(api, h, t) {
  api.hit(h, t, api.scale(h, 70, 22, 0.6) + h.maxHp * 0.04, 'bram_q');
  api.stun(h, t, 1.0 + (api.aug(h, 3, 'a') ? 0.4 : 0));
  if (api.aug(h, 3, 'b')) api.knockback(h, t, h.x, h.y, 4, 26);
  api.vfx('bram_q_hit', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id });
}

export default {
  id: 'bram', name: 'Bram', title: 'Ironroot Warden', role: 'Tank', difficulty: 1,
  color: '#7fb069', lore: 'An oak-hearted sentinel who swore to stand where the old forest fell — and has not moved since.',
  base: { maxHp: 740, power: 52, armor: 36, attackRange: 2.6, attackSpeed: 0.72, moveSpeed: 9.7, hpRegen: 3.5 },
  growth: { maxHp: 98, power: 3.2, armor: 3.6, attackSpeed: 0.015, hpRegen: 0.25 },
  attackRatio: 1, ranged: false, projectile: null,
  abilities: {
    passive: { name: 'Rootbound', desc: 'Standing still builds Bark every 0.5s (max 6): each stack grants 2.5 (+0.4/lvl) Armor. Moving sheds Bark quickly. Attacks deal bonus damage equal to 3% of Bram\'s max HP.' },
    q: {
      name: 'Shield Slam', desc: 'Dash 7m. The first enemy hit takes 70 (+22/lvl, +60% Power, +4% max HP) damage and is stunned for 1s. Missing refunds 40% of the cooldown.',
      cd: 9, range: 7, targeting: 'skillshot', tags: ['engage', 'cc'],
      bot: { kind: 'dash', engage: true, radius: 1.8, speed: 32 },
      cast(api, h, aim) {
        const L = 7, tx = h.x + aim.dirX * L, ty = h.y + aim.dirY * L;
        api.vfx('bram_q', { x: h.x, y: h.y, tx, ty, team: h.team, srcId: h.id, duration: 0.3 });
        api.dashHit(h, tx, ty, { speed: 32, radius: 1.9, onHit: (t) => { slamHit(api, h, t); return true; },
          onArrive: (t) => { if (!t) api.reduceCooldown(h, 'q', 9 * 0.4 * api.hasteMul(h)); } });
      },
    },
    w: {
      name: 'Bark Wall', desc: 'Raise a wall of living bark (4s) across the target point, blocking movement. Bram gains a 50 (+18/lvl, +8% max HP) shield for 3s.',
      cd: 16, range: 9, targeting: 'point', tags: ['zone', 'peel', 'shield'],
      bot: { kind: 'wall', peel: true },
      cast(api, h, aim) {
        const dur = 4 + (api.aug(h, 6, 'a') ? 2 : 0);
        const px = -aim.dirY, py = aim.dirX;
        const segs = [];
        for (const k of [-2.6, 0, 2.6]) {
          const w = api.wall(aim.x + px * k, aim.y + py * k, 1.45, dur);
          w.visual.model = 'bram_wall'; w.ownerId = h.id; w.team = 2; segs.push(w);
        }
        api.vfx('bram_w', { x: aim.x, y: aim.y, angle: Math.atan2(py, px), radius: 4, duration: dur, team: h.team, srcId: h.id });
        const amt = api.scale(h, 50, 18, 0) + h.maxHp * 0.08;
        api.shield(h, amt, 3, 'bram_w', h);
        if (api.aug(h, 6, 'b')) for (const a of api.allyHeroesInRadius(h, h.x, h.y, 9)) if (a !== h) api.shield(a, amt * 0.7, 3, 'bram_w', h);
      },
    },
    r: {
      name: 'Grove Heart', desc: 'Awaken a grove (radius 7) that drags enemies toward its heart for 2s, then roots everyone inside for 1.5s and deals 170 (+40/lvl, +80% Power, +5% max HP). Bram gains 30 Armor meanwhile.',
      cd: 90, range: 9, targeting: 'area', tags: ['engage', 'cc', 'zone'],
      bot: { kind: 'zone', radius: 7, delay: 2, minTargets: 1, engage: true },
      cast(api, h, aim) {
        const R = 7 + (api.aug(h, 9, 'a') ? 2 : 0);
        const x = aim.x, y = aim.y;
        api.vfx('bram_r', { x, y, radius: R, duration: 2, team: h.team, srcId: h.id });
        api.mod(h, { duration: 3.5, add: { armor: 30 }, tag: 'bram_r' });
        if (api.aug(h, 9, 'b')) h.data.bark = MAX_BARK;
        api.zone({ src: h, x, y, radius: R, duration: 2, visual: 'bram_r', tickEvery: api.DT,
          onTick: (us) => {
            for (const e of us) {
              if (e.team === h.team || e.team === 2 || !api.isEnemy(h, e)) continue;
              const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
              if (d > 1.2) api.nudge(e, dx / d * 3.6 * api.DT, dy / d * 3.6 * api.DT);
            }
          },
          onEnd: () => {
            api.vfx('bram_r_end', { x, y, radius: R, team: h.team, srcId: h.id });
            for (const e of api.enemiesInRadius(h, x, y, R, e => e.team !== 2)) {
              api.hit(h, e, api.scale(h, 170, 40, 0.8) + h.maxHp * 0.05, 'bram_r');
              api.root(h, e, 1.5 + (api.aug(h, 9, 'b') ? 0.5 : 0));
            }
          } });
      },
    },
  },
  augments: {
    3: { a: { name: 'Heavy Shield', desc: 'Q: Shield Slam stuns 0.4s longer.' }, b: { name: 'Battering Ram', desc: 'Q: Shield Slam also knocks the target back 4m.' } },
    6: { a: { name: 'Old Growth', desc: 'W: Bark Wall lasts 2s longer.' }, b: { name: 'Shelter', desc: 'W: nearby allies also gain 70% of the shield.' } },
    9: { a: { name: 'Deep Roots', desc: 'R: Grove Heart radius +2m.' }, b: { name: 'Heartwood', desc: 'R: instantly grants max Bark and roots 0.5s longer.' } },
  },
  hooks: {
    onTick(api, h, dt) {
      const d = h.data;
      if (d.lx === undefined) { d.lx = h.x; d.ly = h.y; d.bark = 0; d.still = 0; d.moving = 0; }
      const moved = Math.hypot(h.x - d.lx, h.y - d.ly) > 0.02; d.lx = h.x; d.ly = h.y;
      if (moved) { d.still = 0; d.moving += dt; if (d.moving >= 0.25 && d.bark > 0) { d.bark--; d.moving = 0; } }
      else { d.moving = 0; d.still += dt; if (d.still >= 0.5) { d.still = 0; if (d.bark < MAX_BARK) d.bark++; } }
      if (d.bark > 0) api.setBuff(h, 'bark', 0.2, { stacks: d.bark });
      api.setResource(h, 'Bark', d.bark, MAX_BARK, '#7fb069');
    },
    computeStats(api, h, s) { if (h.data.bark) s.armor += h.data.bark * barkPer(h); },
    modifyAutoAttack(api, h, t, info) { info.amount += h.maxHp * 0.03; },
  },
  bot: {
    preferredRole: 'lane', comboOrder: ['r', 'q', 'w'], style: 'tank',
    loadout: { items: ['bulwark', 'heartwood', 'aegis_banner'], relic: 'barrier', sigils: { offense: 'focus', utility: 'steadfast' } },
    branches: { bulwark: 'a', heartwood: 'a', aegis_banner: 'a' },
    augments: { 3: 'a', 6: 'b', 9: 'a' },
  },
};
