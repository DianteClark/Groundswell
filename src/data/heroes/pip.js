// Pip & Bolt — Tinker Duo (Support, ranged). Owner: Agent A.
const boltOf = (api, h) => { const b = api.entity(h.data.boltId); return b && b.alive ? b : null; };
const wardOf = (api, h) => { const w = api.entity(h.data.wardId); return w && w.alive && w.kind === 'hero' && w.team === h.team && api.dist(w, h) < 28 ? w : h; };

function spawnBolt(api, h) {
  const old = boltOf(api, h); if (old) api.m.remove(old);
  const b = api.summon({ owner: h, x: h.x + 1.5, y: h.y, model: 'pip_bolt', radius: 1.1, stats: { maxHp: 1, power: 0, armor: 0, attackRange: 0, attackSpeed: 0.2, moveSpeed: 12.5 },
    untargetable: true, ghost: true,
    think: (a, s) => {
      s.order = 'custom';
      if (!h.alive) return;
      const ward = wardOf(api, h);
      s.stats.moveSpeed = Math.max(12.5, ward.stats.moveSpeed * 1.25);
      if (api.dist(s, ward) > 30) { api.teleport(s, ward.x, ward.y); }
      // stand between ward and the closest visible enemy hero
      let tx = ward.x + (h.team === 0 ? -1.6 : 1.6), ty = ward.y;
      let best = null, bd = 13;
      for (const e of api.m.heroes) if (e.alive && e.team !== h.team && e.vis[h.team]) { const d = api.dist(e, ward); if (d < bd) { bd = d; best = e; } }
      if (best) { const dx = best.x - ward.x, dy = best.y - ward.y, l = Math.hypot(dx, dy) || 1; tx = ward.x + dx / l * 2.4; ty = ward.y + dy / l * 2.4; }
      if (Math.hypot(tx - s.x, ty - s.y) > 0.6) api.m._followTo(s, tx, ty, 0.4); else s.anim.state = 'idle';
      // guard ward
      api.tempHook(ward, { modifyDamageTaken(aa, self, src, info) { if (src && src.team !== self.team) info.amount *= 0.91; } }, 0.25, 'pip_guard');
      api.setBuff(ward, 'pip_guard', 0.25, { sourceId: h.id });
      if ((h.data.boltShieldAt || -99) + 9 <= api.time && ward.lastDamagedAt && api.time - ward.lastDamagedAt < 0.5 && ward.hp < ward.maxHp * 0.92) {
        h.data.boltShieldAt = api.time;
        api.shield(ward, api.scale(h, 40, 14, 0.3), 3, 'pip_p', h);
        api.vfx('pip_p', { x: ward.x, y: ward.y, team: h.team, srcId: s.id, targetId: ward.id });
      }
    } });
  b.invulnerable = true; b.visionRange = 9;
  h.data.boltId = b.id;
  return b;
}

function wrench(api, h, from, t, bouncesLeft) {
  api.homing({ src: h, x: from.x, y: from.y, target: t, speed: 34, visual: 'pip_q', onHit: (tt) => {
    if (tt.team === h.team) {
      api.heal(tt, api.scale(h, 40, 13, 0.3) * (api.aug(h, 3, 'b') ? 1.35 : 1), h);
      api.vfx('pip_q_heal', { x: tt.x, y: tt.y, team: h.team, srcId: h.id, targetId: tt.id });
    } else {
      api.hit(h, tt, api.scale(h, 45, 14, 0.5), 'pip_q');
      api.vfx('pip_q_hit', { x: tt.x, y: tt.y, team: h.team, srcId: h.id, targetId: tt.id });
    }
    if (bouncesLeft <= 0) return;
    let next = null;
    if (tt.team === h.team) {
      let bd = 7.5; for (const e of api.m.heroes) if (e.alive && e.team !== h.team && e.vis[h.team] && api.isTargetable(e)) { const d = api.dist(e, tt); if (d < bd) { bd = d; next = e; } }
    } else {
      let bp = 2; for (const a of api.m.heroes) if (a.alive && a.team === h.team && api.dist(a, tt) < 8) { const p = a.hp / a.maxHp; if (p < bp) { bp = p; next = a; } }
    }
    if (next) wrench(api, h, tt, next, bouncesLeft - 1);
  } });
}

export default {
  id: 'pip', name: 'Pip & Bolt', title: 'Tinker Duo', role: 'Support', difficulty: 2,
  color: '#3cc6e0', lore: 'Pip built Bolt to carry his tools. Bolt decided, on its own, to carry Pip\'s friends too.',
  base: { maxHp: 560, power: 46, armor: 22, attackRange: 10.5, attackSpeed: 0.7, moveSpeed: 9.9, hpRegen: 2.6 },
  growth: { maxHp: 80, power: 3.1, armor: 2.8, attackSpeed: 0.015, hpRegen: 0.22 },
  attackRatio: 1, ranged: true, projectile: 'auto_pip',
  abilities: {
    passive: { name: 'Bolt', desc: 'Bolt the mech guards Pip\'s tethered ally: it body-blocks, reduces their damage taken by 9%, and every 9s shields them for 40 (+14/lvl, +30% Power) when hit.' },
    q: {
      name: 'Wrench Toss', desc: 'Throw a wrench at a unit: allies heal 40 (+13/lvl, +30% Power), enemies take 45 (+14/lvl, +50% Power). It then bounces once to the other side (enemy ↔ ally).',
      cd: 6, range: 10, targeting: 'unit', targetTeam: 'any', tags: ['heal', 'poke'],
      bot: { kind: 'heal', poke: true },
      cast(api, h, aim) {
        const t = aim.target; if (!t) return false;
        api.vfx('pip_q', { x: h.x, y: h.y, tx: t.x, ty: t.y, team: h.team, srcId: h.id, targetId: t.id });
        wrench(api, h, h, t, api.aug(h, 3, 'a') ? 2 : 1);
      },
    },
    w: {
      name: 'Overclock', desc: 'Tether an ally (or yourself) for 5s: +20% Move Speed and +0.25 (+0.02/lvl) Attack Speed. Bolt moves to guard them.',
      cd: 12, range: 10, targeting: 'unit', targetTeam: 'ally', tags: ['buff', 'engage'],
      targetFilter: (e) => e.kind === 'hero',
      bot: { kind: 'allyBuff' },
      cast(api, h, aim) {
        const t = aim.target || h;
        const dur = 5 + (api.aug(h, 6, 'b') ? 3 : 0);
        h.data.wardId = t.id;
        api.speed(t, 0.2, dur, 'pip_w');
        api.mod(t, { duration: dur, add: { attackSpeed: 0.25 + 0.02 * (h.level - 1), ...(api.aug(h, 6, 'a') ? { armor: 20 } : {}) }, tag: 'pip_w' });
        api.status(t, 'overclock', dur, { sourceId: h.id });
        api.vfx('pip_w', { x: h.x, y: h.y, tx: t.x, ty: t.y, team: h.team, srcId: h.id, targetId: t.id, duration: dur });
      },
    },
    r: {
      name: 'Bolt Drop', desc: 'Launch Bolt onto an ally (22m). After 0.8s it crashes down: enemies within 4.5m take 110 (+30/lvl, +60% Power), are knocked up, then taunted to Bolt for 1.2s. The ally gains a 90 (+30/lvl, +40% Power) shield.',
      cd: 85, range: 22, targeting: 'unit', targetTeam: 'ally', tags: ['engage', 'cc', 'shield'],
      targetFilter: (e) => e.kind === 'hero',
      bot: { kind: 'allyEngage', radius: 4.5, delay: 0.8 },
      cast(api, h, aim) {
        const t = aim.target || h;
        h.data.wardId = t.id;
        api.vfx('pip_r', { x: t.x, y: t.y, radius: 4.5, duration: 0.8, team: h.team, srcId: h.id, targetId: t.id });
        const b = boltOf(api, h); if (b) api.setBuff(b, 'airborne', 0.8);
        api.schedule(0.8, () => {
          const x = t.alive ? t.x : aim.x, y = t.alive ? t.y : aim.y;
          let bolt = boltOf(api, h); if (!bolt && h.alive) bolt = spawnBolt(api, h);
          if (bolt) { api.teleport(bolt, x + 1, y); }
          api.vfx('pip_r_hit', { x, y, radius: 4.5, team: h.team, srcId: h.id });
          for (const e of api.enemiesInRadius(h, x, y, 4.5)) {
            api.hit(h, e, api.scale(h, 110, 30, 0.6), 'pip_r');
            api.knockup(h, e, 0.6);
            if (bolt) api.taunt(h, e, 1.2 + (api.aug(h, 9, 'a') ? 0.6 : 0) + 0.6, bolt.id);
          }
          if (t.alive) api.shield(t, api.scale(h, 90, 30, 0.4) * (api.aug(h, 9, 'b') ? 2 : 1), 4, 'pip_r', h);
        });
      },
    },
  },
  augments: {
    3: { a: { name: 'Double Bounce', desc: 'Q: Wrench Toss bounces one extra time.' }, b: { name: 'Fine Tuning', desc: 'Q: Wrench heals 35% more.' } },
    6: { a: { name: 'Plating', desc: 'W: Overclock also grants 20 Armor.' }, b: { name: 'Long Charge', desc: 'W: Overclock lasts 3s longer.' } },
    9: { a: { name: 'Loud Landing', desc: 'R: taunt lasts 0.6s longer.' }, b: { name: 'Crash Pads', desc: 'R: Bolt Drop\'s ally shield is doubled.' } },
  },
  hooks: {
    onSpawn(api, h) { h.data.wardId = h.id; spawnBolt(api, h); },
    onRespawn(api, h) { h.data.wardId = h.id; spawnBolt(api, h); },
    onDeath(api, h) { const b = boltOf(api, h); if (b) api.m.remove(b); },
    onTick(api, h) { if (!boltOf(api, h) && h.alive && (api.m.tickCount % 30 === 0)) spawnBolt(api, h); const w = wardOf(api, h); api.setResource(h, 'Guarding', w === h ? 0 : 1, 1, '#3cc6e0'); },
  },
  bot: {
    preferredRole: 'support', comboOrder: ['w', 'q', 'r'], style: 'support',
    loadout: { items: ['mendcharm', 'aegis_banner', 'swiftboots'], relic: 'barrier', sigils: { offense: 'focus', utility: 'vitality' } },
    branches: { mendcharm: 'a', aegis_banner: 'a', swiftboots: 'b' },
    augments: { 3: 'a', 6: 'b', 9: 'b' },
  },
};
