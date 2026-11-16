// Mire — Bog Witch (Controller, ranged). Owner: Agent A.
const ownZones = (api, h) => (h.data.zones || []).map(id => api.entity(id)).filter(a => a && !a.removed);
const inSwamp = (api, h, x, y) => ownZones(api, h).some(a => a.data.swamp && Math.hypot(a.x - x, a.y - y) <= a.radius);
const track = (h, a) => { h.data.zones = (h.data.zones || []).filter(Boolean); h.data.zones.push(a.id); };

export default {
  id: 'mire', name: 'Mire', title: 'Bog Witch', role: 'Controller', difficulty: 2,
  color: '#4a8c5c', lore: 'The marsh remembers every footprint. Mire makes sure it never forgets yours.',
  base: { maxHp: 530, power: 48, armor: 20, attackRange: 10.5, attackSpeed: 0.68, moveSpeed: 9.8, hpRegen: 2.0 },
  growth: { maxHp: 78, power: 3.6, armor: 2.6, attackSpeed: 0.015, hpRegen: 0.18 },
  attackRatio: 1, ranged: true, projectile: 'auto_mire', missileSpeed: 46,
  abilities: {
    passive: { name: 'Bog Blood', desc: 'While standing in her own pools, near her totem, or in her swamp, Mire heals 1.2% max HP per second (2.5% in the swamp).' },
    q: {
      name: 'Sludge Pool', desc: 'Lob sludge (11m): 40 (+12/lvl, +38% Power) on impact, leaving a 3.6m pool for 4s that slows 35% and deals 7.5 (+2.2/lvl, +5% Power) every 0.5s. Swamp: bigger, slows 50%.',
      cd: 7, range: 11, targeting: 'area', tags: ['poke', 'zone', 'cc', 'farm'],
      bot: { kind: 'zone', radius: 3.6, delay: 0.35, poke: true, farm: true },
      cast(api, h, aim) {
        const sw = inSwamp(api, h, aim.x, aim.y);
        const R = 3.6 * (api.aug(h, 3, 'b') ? 1.25 : 1) + (sw ? 1.2 : 0);
        const dur = 4 + (api.aug(h, 3, 'a') ? 2 : 0);
        const slow = sw ? 0.5 : 0.35;
        api.vfx('mire_q', { x: h.x, y: h.y, tx: aim.x, ty: aim.y, radius: R, duration: 0.35, team: h.team, srcId: h.id });
        api.schedule(0.35, () => {
          for (const e of api.enemiesInRadius(h, aim.x, aim.y, R)) { api.hit(h, e, api.scale(h, 40, 12, 0.38), 'mire_q'); }
          const a = api.zone({ src: h, x: aim.x, y: aim.y, radius: R, duration: dur, visual: 'mire_q', tickEvery: 0.5, data: { mire: true },
            onTick: (us) => { for (const e of us) if (api.isEnemy(h, e)) { api.slow(h, e, slow, 0.6, 'mire_q'); api.hit(h, e, api.scale(h, 7.5, 2.2, 0.05), 'mire_q'); } } });
          track(h, a);
        });
      },
    },
    w: {
      name: 'Hex Totem', desc: 'Plant a totem (8s, 150 +30/lvl HP) that zaps the nearest enemy (champions first) every 1s for 17 (+5/lvl, +18% Power). Every 3rd zap on a champion roots it for 1s. Swamp: zaps twice as fast.',
      cd: 14, range: 9, targeting: 'point', tags: ['zone', 'cc', 'poke'],
      bot: { kind: 'zone', radius: 8, delay: 0.5 },
      cast(api, h, aim) {
        const old = api.entity(h.data.totemId); if (old?.alive) { old.alive = false; api.m.remove(old); }
        const big = api.aug(h, 6, 'b');
        const p = api.clampToNav(aim.x, aim.y);
        const t = api.summon({ owner: h, x: p.x, y: p.y, model: 'mire_totem', static: true, radius: 0.9, duration: 8 + (big ? 5 : 0),
          stats: { maxHp: (150 + 30 * (h.level - 1)) * (big ? 2 : 1), armor: 20, power: 0, attackRange: 8, attackSpeed: 1, moveSpeed: 0 },
          think: (a, s) => {
            if (api.time < (s.data.nextZap || 0)) return;
            let tgt = null, bd = 8.5;
            for (const e of api.m.heroes) if (e.alive && e.team !== h.team && e.vis[h.team] && api.isTargetable(e)) { const d = api.dist(e, s); if (d < bd) { bd = d; tgt = e; } }
            if (!tgt) tgt = api.m.findUnitAt(s.x, s.y, 8, e => api.isEnemy(h, e) && e.vis[h.team]);
            if (!tgt) return;
            s.data.nextZap = api.time + (inSwamp(api, h, s.x, s.y) ? 0.5 : 1.0);
            s.facing = Math.atan2(tgt.y - s.y, tgt.x - s.x); s.anim = { state: 'attack', t: 0 };
            api.homing({ src: s, target: tgt, speed: 40, visual: 'mire_w_zap', onHit: (tt) => {
              api.hit(s, tt, api.scale(h, 17, 5, 0.18), 'mire_w');
              if (tt.kind === 'hero') {
                const z = s.data.zaps = s.data.zaps || {}; z[tt.id] = (z[tt.id] || 0) + 1;
                if (z[tt.id] >= (api.aug(h, 6, 'a') ? 2 : 3)) { z[tt.id] = 0; api.root(h, tt, 1); api.vfx('mire_w_root', { x: tt.x, y: tt.y, team: h.team, srcId: h.id, targetId: tt.id }); }
              }
            } });
          } });
        t.visionRange = 9; h.data.totemId = t.id;
        api.vfx('mire_w', { x: p.x, y: p.y, team: h.team, srcId: h.id, targetId: t.id });
      },
    },
    r: {
      name: 'Swamp Rising', desc: 'Flood a 13m area into swamp for 10s: enemies inside are slowed 25%, Mire heals faster there, Sludge Pools grow and Hex Totems zap twice as fast.',
      cd: 90, range: 12, targeting: 'area', tags: ['zone', 'cc'],
      bot: { kind: 'zone', radius: 11, delay: 0, minTargets: 2, teamfight: true },
      cast(api, h, aim) {
        const R = 13, dur = 10 + (api.aug(h, 9, 'a') ? 4 : 0);
        const x = aim.x, y = aim.y;
        api.vfx('mire_r', { x, y, radius: R, duration: dur, team: h.team, srcId: h.id, kind: 'swamp', phase: 'apply', zone: { x, y, r: R }, at: api.time });
        const a = api.zone({ src: h, x, y, radius: R, duration: dur, visual: 'mire_r', tickEvery: 0.25, data: { mire: true, swamp: true },
          onTick: (us) => {
            for (const e of us) {
              if (!api.isEnemy(h, e) || e.team === 2) continue;
              api.slow(h, e, 0.25, 0.4, 'mire_r');
              if (api.aug(h, 9, 'b') && e.kind === 'hero') api.hit(h, e, e.maxHp * 0.02 * 0.25, 'mire_r');
            }
          },
          onEnd: () => api.vfx('mire_r_end', { x, y, radius: R, team: h.team, srcId: h.id, kind: 'swamp', phase: 'end' }) });
        track(h, a);
      },
    },
  },
  augments: {
    3: { a: { name: 'Lingering Muck', desc: 'Q: Sludge Pools last 2s longer.' }, b: { name: 'Spreading Rot', desc: 'Q: Sludge Pools are 25% larger.' } },
    6: { a: { name: 'Quick Hex', desc: 'W: Hex Totem roots on every 2nd zap.' }, b: { name: 'Old Idol', desc: 'W: totem lasts 5s longer and has double HP.' } },
    9: { a: { name: 'High Tide', desc: 'R: Swamp Rising lasts 4s longer.' }, b: { name: 'Drowning Mire', desc: 'R: enemy champions in the swamp lose 2% max HP per second.' } },
  },
  hooks: {
    onTick(api, h, dt) {
      const d = h.data; d.zones = (d.zones || []).filter(id => { const a = api.entity(id); return a && !a.removed; });
      let rate = 0;
      for (const a of ownZones(api, h)) if (Math.hypot(a.x - h.x, a.y - h.y) <= a.radius) rate = Math.max(rate, a.data.swamp ? 0.025 : 0.012);
      const tot = api.entity(d.totemId); if (tot?.alive && api.dist(tot, h) <= 4) rate = Math.max(rate, 0.012);
      if (rate > 0) {
        api.setBuff(h, 'bog_blood', 0.2);
        d.healAcc = (d.healAcc || 0) + h.maxHp * rate * dt;
        if (d.healAcc > 15) { api.heal(h, d.healAcc, h); d.healAcc = 0; }
      }
    },
  },
  bot: {
    preferredRole: 'support', comboOrder: ['q', 'w', 'r'], style: 'mage',
    loadout: { items: ['runestaff', 'heartwood', 'veilcloak'], relic: 'ignite', sigils: { offense: 'arcane_edge', utility: 'vitality' } },
    branches: { runestaff: 'b', heartwood: 'b', veilcloak: 'a' },
    augments: { 3: 'b', 6: 'a', 9: 'b' },
  },
};
