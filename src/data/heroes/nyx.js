// Nyx — Shadowstep (Assassin, melee). Owner: Agent A.
const isolated = (api, h, t) => !api.m.unitsInRadius(t.x, t.y, 6, e => e !== t && e.team === t.team && (e.kind === 'hero' || e.kind === 'minion' || e.kind === 'summon') && e.alive && !e.wall).length;

export default {
  id: 'nyx', name: 'Nyx', title: 'Shadowstep', role: 'Assassin', difficulty: 3,
  color: '#7a3cff', lore: 'Nobody hires Nyx. People simply wake up to find the job already done.',
  base: { maxHp: 610, power: 67, armor: 24, attackRange: 2.4, attackSpeed: 0.85, moveSpeed: 10.4, hpRegen: 2.4 },
  growth: { maxHp: 84, power: 4.6, armor: 3, attackSpeed: 0.02, hpRegen: 0.2 },
  attackRatio: 1, ranged: false, projectile: null, windup: 0.2,
  abilities: {
    passive: { name: 'Shadow Veil', desc: 'After 3s out of combat — or 1.5s unseen by enemies — her next hit deals +40 (+14/lvl, +45% Power) and slows 30%.' },
    q: {
      name: 'Shade Dash Resets your attack timer.', desc: 'Dash 6.5m, dealing 55 (+18/lvl, +65% Power) to enemies passed, leaving an afterimage. Recast within 3.5s to swap back to it.',
      cd: 9, range: 6.5, targeting: 'skillshot', tags: ['engage', 'escape'],
      bot: { kind: 'dash', engage: true, escape: true, radius: 1.6, recast: 'return' },
      cast(api, h, aim) {
        if (api.recastOpen(h, 'q')) {
          const img = api.entity(h.data.imgId);
          if (img && img.alive) {
            api.vfx('nyx_q_swap', { x: h.x, y: h.y, tx: img.x, ty: img.y, team: h.team, srcId: h.id });
            api.teleport(h, img.x, img.y); api.m.remove(img);
            if (api.aug(h, 3, 'a')) api.heal(h, h.maxHp * 0.08, h);
          }
          return api.closeRecast(h, 'q');
        }
        const L = 6.5 + (api.aug(h, 3, 'b') ? 2 : 0);
        const img = api.summon({ owner: h, x: h.x, y: h.y, model: 'nyx_afterimage', static: true, ghost: true, untargetable: true, duration: 3.5, radius: 0.8, stats: { maxHp: 1 } });
        img.visionRange = 0; img.invulnerable = true; img.facing = h.facing; h.data.imgId = img.id;
        const tx = h.x + aim.dirX * L, ty = h.y + aim.dirY * L;
        api.vfx('nyx_q', { x: h.x, y: h.y, tx, ty, team: h.team, srcId: h.id });
        api.dashHit(h, tx, ty, { speed: 38, radius: 1.8, onArrive: () => api.resetAttack(h), onHit: (t) => { api.hit(h, t, api.scale(h, 55, 18, 0.65), 'nyx_q'); } });
        return api.openRecast(h, 'q', 3.5, 9, () => { const i = api.entity(h.data.imgId); if (i?.alive) api.m.remove(i); });
      },
    },
    w: {
      name: 'Hollow Strike Resets your attack timer.', desc: 'Strike an adjacent enemy for 88 (+27/lvl, +95% Power). +40% damage if no allies of the target stand within 6m.',
      cd: 7, range: 3.5, targeting: 'unit', tags: ['burst'],
      bot: { kind: 'target', finisher: true },
      cast(api, h, aim) {
        const t = aim.target; if (!t) return false;
        const iso = isolated(api, h, t);
        const mult = iso ? (api.aug(h, 6, 'a') ? 1.8 : 1.4) : 1;
        api.vfx(iso ? 'nyx_w_iso' : 'nyx_w', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id });
        api.hit(h, t, api.scale(h, 88, 27, 0.95) * mult, 'nyx_w', iso ? { heavy: true } : {});
        api.resetAttack(h);
        if (!t.alive && api.aug(h, 6, 'b')) return { cd: 0.5 };
      },
    },
    r: {
      name: 'Nightfall', desc: 'Drop a 7.5m dome of night for 4s. Enemies inside are Blinded (attacks miss); inside it Nyx is invisible and 20% faster. Resets Hollow Strike.',
      cd: 85, range: 0, targeting: 'self', tags: ['engage', 'burst', 'escape'],
      bot: { kind: 'selfAoE', radius: 7, engage: true },
      cast(api, h) {
        const dur = 4 + (api.aug(h, 9, 'a') ? 1.5 : 0); const R = 7.5; const x = h.x, y = h.y;
        api.reduceCooldown(h, 'w', 999);
        api.vfx('nyx_r', { x, y, radius: R, duration: dur, team: h.team, srcId: h.id });
        api.zone({ src: h, x, y, radius: R, duration: dur, visual: 'nyx_r', tickEvery: 0.2,
          onTick: (us) => {
            for (const e of us) {
              if (e === h) { api.status(h, 'invisible', 0.3, { tag: 'nyx_r' }); api.speed(h, 0.2, 0.3, 'nyx_r'); continue; }
              if (e.kind === 'hero' && e.team !== h.team) { api.blind(h, e, 0.3); if (api.aug(h, 9, 'b')) api.slow(h, e, 0.3, 0.3, 'nyx_r'); }
            }
          } });
      },
    },
  },
  augments: {
    3: { a: { name: 'Fade Back', desc: 'Q: swapping back heals 8% max HP.' }, b: { name: 'Long Shadow', desc: 'Q: Shade Dash travels 2m farther.' } },
    6: { a: { name: 'Lonely Prey', desc: 'W: isolation bonus becomes +80%.' }, b: { name: 'Hungry Blade', desc: 'W: Hollow Strike resets if it kills.' } },
    9: { a: { name: 'Long Night', desc: 'R: Nightfall lasts 1.5s longer.' }, b: { name: 'Heavy Dark', desc: 'R: enemies inside are also slowed 30%.' } },
  },
  hooks: {
    onTick(api, h) {
      const d = h.data;
      const seen = h.vis[1 - h.team];
      if (seen) d.seenAt = api.time;
      const unseen = api.time - (d.seenAt ?? 0) >= 1.5;
      if (!d.primed && (api.time - (h.lastCombatAt ?? -99) >= 3 || unseen)) { d.primed = true; api.vfx('nyx_p', { x: h.x, y: h.y, team: h.team, srcId: h.id, targetId: h.id }); }
      if (d.primed) api.setBuff(h, 'shadow_primed', 0.2);
      api.setResource(h, 'Veil', d.primed ? 1 : 0, 1, '#7a3cff');
    },
    modifyDamageDealt(api, h, t, info) {
      if (!h.data.primed || info.type === 'true' || t.kind === 'tower' || t.kind === 'core') return;
      if (info.type !== 'auto' && info.type !== 'ability') return;
      h.data.primed = false; h.data.seenAt = api.time;
      info.amount += api.scale(h, 40, 14, 0.45); info.empowered = true;
      api.slow(h, t, 0.3, 1, 'nyx_p');
      api.vfx('nyx_p_hit', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id });
    },
  },
  bot: {
    preferredRole: 'lane', comboOrder: ['q', 'w', 'r', 'w', 'q'], style: 'assassin',
    loadout: { items: ['warblade', 'reaper_scythe', 'veilcloak'], relic: 'ignite', sigils: { offense: 'executioner', utility: 'swiftness' } },
    branches: { warblade: 'b', reaper_scythe: 'a', veilcloak: 'b' },
    augments: { 3: 'a', 6: 'a', 9: 'a' },
  },
};
