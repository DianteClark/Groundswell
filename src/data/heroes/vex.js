// Vex — Longshot (Marksman, ranged). Owner: Agent A.
export default {
  id: 'vex', name: 'Vex', title: 'Longshot', role: 'Marksman', difficulty: 2,
  color: '#e0c341', lore: 'A bounty hunter who counts every bullet — and never needs the fourth.',
  base: { maxHp: 540, power: 54, armor: 20, attackRange: 12.5, attackSpeed: 0.78, moveSpeed: 9.9, hpRegen: 2.2 },
  growth: { maxHp: 76, power: 3.9, armor: 2.6, attackSpeed: 0.03, hpRegen: 0.18 },
  attackRatio: 1, ranged: true, projectile: 'auto_vex',
  abilities: {
    passive: { name: 'Piercing Round', desc: 'Every 4th attack deals +15% damage and pierces in a line, hitting all enemies behind the target for 90% damage.' },
    q: {
      name: 'Ricochet', desc: 'Fire a shot (12m) dealing 50 (+16/lvl, +70% Power) that ricochets to 2 more nearby enemies for 65% damage, favouring champions.',
      cd: 7.5, range: 12, targeting: 'skillshot', tags: ['poke', 'farm'],
      bot: { kind: 'skillshot', speed: 42, radius: 0.7, poke: true, farm: true },
      cast(api, h, aim) {
        const dmg = api.scale(h, 50, 16, 0.7);
        const bounces = api.aug(h, 3, 'a') ? 4 : 2;
        const onBounceHit = (t, mult) => { api.hit(h, t, dmg * mult, 'vex_q'); if (t.kind === 'hero' && api.aug(h, 3, 'b')) api.slow(h, t, 0.25, 1, 'vex_q'); };
        api.skillshot({ src: h, dirX: aim.dirX, dirY: aim.dirY, speed: 42, range: 12, radius: 0.7, visual: 'vex_q',
          onHit: (t) => {
            onBounceHit(t, 1);
            api.chain({ src: h, from: t, exclude: [t.id], count: bounces, range: 7, speed: 45, visual: 'vex_q', onHit: (tt) => onBounceHit(tt, 0.65) });
            return true;
          } });
      },
    },
    w: {
      name: 'Tumble', desc: 'Roll 5m and reload: your next attack within 4s deals +25 (+10/lvl, +35% Power) bonus damage.',
      cd: 8, range: 5, targeting: 'point', tags: ['escape', 'burst'],
      bot: { kind: 'dash', escape: true, kite: true },
      cast(api, h, aim) {
        const L = Math.max(3, Math.min(5, aim.dist || 5));
        const tx = h.x + aim.dirX * L, ty = h.y + aim.dirY * L;
        api.vfx('vex_w', { x: h.x, y: h.y, tx, ty, team: h.team, srcId: h.id });
        api.dash(h, tx, ty, 32, { onArrive: () => { h.nextAttackAt = Math.min(h.nextAttackAt, api.time); } });
        h.data.tumbleUntil = api.time + 4.3;
        api.setBuff(h, 'vex_loaded', 4.3);
        if (api.aug(h, 6, 'b')) api.speed(h, 0.3, 1.5, 'vex_w');
      },
    },
    r: {
      name: 'Deadeye', desc: 'Channel 1.2s, then fire a 45m round that passes through minions and hits the first champion for 220 (+55/lvl, +130% Power) plus 30% of its missing HP.',
      cd: 70, range: 45, targeting: 'skillshot', tags: ['burst', 'execute', 'poke'],
      bot: { kind: 'snipe', speed: 90, radius: 1.1, delay: 1.2, finisher: true },
      cast(api, h, aim) {
        const ch = api.aug(h, 9, 'a') ? 0.7 : 1.2;
        const dx = aim.dirX, dy = aim.dirY;
        api.vfx('vex_r_charge', { x: h.x, y: h.y, tx: h.x + dx * 45, ty: h.y + dy * 45, duration: ch, team: h.team, srcId: h.id });
        api.channel(h, { duration: ch, locksAll: true, key: 'vex_r',
          onEnd: () => {
            const pierce = api.aug(h, 9, 'b');
            api.vfx('vex_r', { x: h.x, y: h.y, tx: h.x + dx * 45, ty: h.y + dy * 45, team: h.team, srcId: h.id });
            api.skillshot({ src: h, dirX: dx, dirY: dy, speed: 90, range: 45, radius: 1.1, visual: 'vex_r', heroesOnly: true, pierce,
              onHit: (t) => {
                api.hit(h, t, api.scale(h, 220, 55, 1.3) + (t.maxHp - t.hp) * 0.3, 'vex_r');
                api.vfx('vex_r_hit', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id });
                return !pierce;
              } });
          } });
      },
    },
  },
  augments: {
    3: { a: { name: 'Trick Shot', desc: 'Q: Ricochet bounces 2 more times.' }, b: { name: 'Hobbling Shot', desc: 'Q: bounces that hit champions slow 25%.' } },
    6: { a: { name: 'Gunslinger', desc: 'W: Piercing Round hitting a champion cuts Tumble\'s cooldown by 2s.' }, b: { name: 'Light Feet', desc: 'W: Tumble grants 30% Move Speed for 1.5s.' } },
    9: { a: { name: 'Quickdraw', desc: 'R: Deadeye charges 0.5s faster.' }, b: { name: 'Overpenetration', desc: 'R: Deadeye pierces through every champion in its path.' } },
  },
  hooks: {
    onSpawn(api, h) { h.data.shots = 0; api.setResource(h, 'Shots', 0, 4, '#e0c341'); },
    modifyAutoAttack(api, h, t, info) {
      const d = h.data;
      if ((d.tumbleUntil || 0) > api.time) { d.tumbleUntil = 0; api.removeStatus(h, 'vex_loaded'); info.amount += api.scale(h, 25, 10, 0.35); api.vfx('vex_w_hit', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id }); }
      d.shots = (d.shots || 0) + 1;
      if (d.shots >= 4) {
        d.shots = 0; info.amount *= 1.15;
        let dx = t.x - h.x, dy = t.y - h.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const dmg = info.amount * 0.9;
        api.vfx('vex_p', { x: h.x, y: h.y, tx: t.x + dx * 8, ty: t.y + dy * 8, team: h.team, srcId: h.id });
        for (const e of api.enemiesInLine(h, t.x, t.y, dx, dy, 8, 1.0, e => e !== t)) api.damage(h, e, dmg, { type: 'auto', ability: 'vex_p' });
        if (t.kind === 'hero' && api.aug(h, 6, 'a')) api.reduceCooldown(h, 'w', 2);
      }
      api.setResource(h, 'Shots', d.shots, 4, '#e0c341');
      if (d.shots === 3) api.setBuff(h, 'vex_ready', 30); else api.removeStatus(h, 'vex_ready');
    },
  },
  bot: {
    preferredRole: 'lane', comboOrder: ['q', 'w', 'r'], style: 'adc',
    loadout: { items: ['gale_bow', 'warblade', 'swiftboots'], relic: 'blink', sigils: { offense: 'fervor', utility: 'swiftness' } },
    branches: { gale_bow: 'a', warblade: 'b', swiftboots: 'a' },
    augments: { 3: 'a', 6: 'b', 9: 'a' },
  },
};
