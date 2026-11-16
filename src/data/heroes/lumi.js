// Lumi — Starweaver (Mage, ranged). Owner: Agent A.
const liveMarks = (api, h) => (h.data.marks || []).map(id => api.entity(id)).filter(e => e && e.alive);

function addMark(api, h, x, y) {
  const p = api.clampToNav(x, y);
  const mk = api.summon({ owner: h, x: p.x, y: p.y, model: 'lumi_mark', static: true, ghost: true, untargetable: true, duration: 6, radius: 0.5, stats: { maxHp: 1 } });
  mk.visionRange = 0;
  mk.invulnerable = true;
  const marks = liveMarks(api, h); marks.push(mk);
  h.data.marks = marks.map(e => e.id);
  api.vfx('lumi_mark', { x: p.x, y: p.y, team: h.team, srcId: h.id, targetId: mk.id });
  if (marks.length >= 3) constellation(api, h, marks.slice(0, 3));
  api.setResource(h, 'Stars', Math.min(3, liveMarks(api, h).length), 3, '#9b8cff');
}

function constellation(api, h, marks) {
  h.data.marks = (h.data.marks || []).filter(id => !marks.some(m => m.id === id));
  const pts = marks.map(m => ({ x: m.x, y: m.y }));
  const cx = (pts[0].x + pts[1].x + pts[2].x) / 3, cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
  api.vfx('lumi_p', { x: cx, y: cy, points: pts, team: h.team, srcId: h.id, duration: 0.5 });
  api.schedule(0.5, () => {
    for (const mk of marks) if (mk.alive) api.m.remove(mk);
    api.vfx('lumi_p_hit', { x: cx, y: cy, points: pts, team: h.team, srcId: h.id });
    const dmg = api.scale(h, 60, 20, 0.5) * (api.aug(h, 9, 'b') ? 1.5 : 1);
    const R = Math.max(...pts.map(p => Math.hypot(p.x - cx, p.y - cy))) + 2;
    const inTri = (x, y) => {
      const s = (a, b) => (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      const d1 = s(pts[0], pts[1]), d2 = s(pts[1], pts[2]), d3 = s(pts[2], pts[0]);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    };
    for (const e of api.enemiesInRadius(h, cx, cy, R)) {
      const onEdge = [0, 1, 2].some(i => api.segDist(e.x, e.y, pts[i].x, pts[i].y, pts[(i + 1) % 3].x, pts[(i + 1) % 3].y) <= 1.4 + e.radius);
      if (onEdge || inTri(e.x, e.y)) api.hit(h, e, dmg, 'lumi_p');
    }
    api.setResource(h, 'Stars', Math.min(3, liveMarks(api, h).length), 3, '#9b8cff');
  });
}

export default {
  id: 'lumi', name: 'Lumi', title: 'Starweaver', role: 'Mage', difficulty: 2,
  color: '#9b8cff', lore: 'A cartographer of the night sky who learned that every star she names can be pulled down.',
  base: { maxHp: 625, power: 56, armor: 22, attackRange: 11, attackSpeed: 0.72, moveSpeed: 9.8, hpRegen: 2.2 },
  growth: { maxHp: 86, power: 4.0, armor: 2.8, attackSpeed: 0.015, hpRegen: 0.18 },
  attackRatio: 1, ranged: true, projectile: 'auto_lumi', missileSpeed: 50,
  abilities: {
    passive: { name: 'Constellation', desc: 'Abilities leave Star Marks (6s). When 3 marks exist they link up and detonate: 60 (+20/lvl, +50% Power) to enemies on the lines or inside the triangle.' },
    q: {
      name: 'Star Bolt', desc: 'Fire a bolt (13m) dealing 80 (+24/lvl, +78% Power) to the first enemy hit and leaving a Star Mark there.',
      cd: 4, range: 13, targeting: 'skillshot', tags: ['poke', 'burst', 'farm'],
      bot: { kind: 'skillshot', speed: 40, radius: 0.95, poke: true },
      cast(api, h, aim) {
        const pierce = api.aug(h, 3, 'a'); let hits = 0;
        api.skillshot({ src: h, dirX: aim.dirX, dirY: aim.dirY, speed: 40, range: 13, radius: 0.95, visual: 'lumi_q', pierce,
          onHit: (t) => {
            hits++;
            api.hit(h, t, api.scale(h, 80, 24, 0.78), 'lumi_q');
            api.vfx('lumi_q_hit', { x: t.x, y: t.y, team: h.team, srcId: h.id, targetId: t.id });
            if (hits === 1 || t.kind === 'hero') addMark(api, h, t.x, t.y);
            if (t.kind === 'hero' && api.aug(h, 3, 'b') && hits === 1) api.reduceCooldown(h, 'q', 2.5);
            return !pierce || hits >= 2;
          } });
      },
    },
    w: {
      name: 'Gravity Well', desc: 'After 0.85s, collapse a well (4.5m) that yanks enemies to its center, dealing 60 (+17/lvl, +45% Power) and slowing 35% for 1.5s. Always leaves a Star Mark. Lumi gains a 40 (+14/lvl, +30% Power) shield and 20% Move Speed for 2s.',
      cd: 11, range: 11, targeting: 'area', tags: ['cc', 'zone'],
      bot: { kind: 'zone', radius: 4.5, delay: 0.85 },
      cast(api, h, aim) {
        const delay = api.aug(h, 6, 'a') ? 0.5 : 0.85;
        api.speed(h, 0.2, 2, 'lumi_w'); api.shield(h, api.scale(h, 40, 14, 0.3), 2.5, 'lumi_w', h);
        api.vfx('lumi_w', { x: aim.x, y: aim.y, radius: 4.5, duration: delay, team: h.team, srcId: h.id });
        api.delayed({ src: h, x: aim.x, y: aim.y, radius: 4.5, delay, visual: 'lumi_w',
          onBlast: (es, a) => {
            api.vfx('lumi_w_hit', { x: a.x, y: a.y, radius: 4.5, team: h.team, srcId: h.id });
            for (const e of es) {
              api.hit(h, e, api.scale(h, 60, 17, 0.45), 'lumi_w');
              api.pull(h, e, a.x, a.y, 22, 0.8);
              if (api.aug(h, 6, 'b')) api.stun(h, e, 0.6); else api.slow(h, e, 0.35, 1.5, 'lumi_w');
            }
            addMark(api, h, a.x, a.y);
          } });
      },
    },
    r: {
      name: 'Collapse', desc: 'Call every Star Mark to a point; after 0.6s it implodes (5.5m) for 170 (+40/lvl, +85% Power), +25% per mark gathered, slowing 50%.',
      cd: 65, range: 13, targeting: 'area', tags: ['burst', 'zone'],
      bot: { kind: 'zone', radius: 5.5, delay: 0.6, minTargets: 1, finisher: true },
      cast(api, h, aim) {
        const marks = liveMarks(api, h); h.data.marks = [];
        const R = 5.5 + (api.aug(h, 9, 'a') ? 2 : 0);
        api.vfx('lumi_r', { x: aim.x, y: aim.y, radius: R, duration: 0.6, team: h.team, srcId: h.id, points: marks.map(m => ({ x: m.x, y: m.y })) });
        for (const mk of marks) { mk.ghost = true; api.dash(mk, aim.x, aim.y, 40, { passWalls: true }); mk.static = false; mk.think = (a, s) => { s.order = 'custom'; }; }
        const mult = 1 + 0.25 * marks.length;
        api.delayed({ src: h, x: aim.x, y: aim.y, radius: R, delay: 0.6, visual: 'lumi_r',
          onBlast: (es, a) => {
            for (const mk of marks) if (mk.alive) api.m.remove(mk);
            api.vfx('lumi_r_hit', { x: a.x, y: a.y, radius: R, team: h.team, srcId: h.id });
            for (const e of es) { api.hit(h, e, api.scale(h, 170, 40, 0.85) * mult, 'lumi_r'); api.slow(h, e, 0.5, 1, 'lumi_r'); }
            api.setResource(h, 'Stars', 0, 3, '#9b8cff');
          } });
      },
    },
  },
  augments: {
    3: { a: { name: 'Twin Star', desc: 'Q: Star Bolt pierces, hitting up to 2 enemies.' }, b: { name: 'Quick Light', desc: 'Q: hitting a champion refunds 50% of the cooldown.' } },
    6: { a: { name: 'Event Horizon', desc: 'W: Gravity Well collapses 0.35s sooner.' }, b: { name: 'Crushing Gravity', desc: 'W: stuns for 0.6s instead of slowing.' } },
    9: { a: { name: 'Supernova', desc: 'R: Collapse radius +2m.' }, b: { name: 'Bright Pattern', desc: 'Passive: constellations deal 50% more damage.' } },
  },
  hooks: {
    onSpawn(api, h) { api.setResource(h, 'Stars', 0, 3, '#9b8cff'); },
  },
  bot: {
    preferredRole: 'lane', comboOrder: ['w', 'q', 'r', 'q'], style: 'mage',
    loadout: { items: ['runestaff', 'swiftboots', 'veilcloak'], relic: 'blink', sigils: { offense: 'arcane_edge', utility: 'swiftness' } },
    branches: { runestaff: 'a', swiftboots: 'b', veilcloak: 'a' },
    augments: { 3: 'b', 6: 'b', 9: 'b' },
  },
};
