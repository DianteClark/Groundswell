// Death analysis for one match: node tools/deaths.mjs seed
import { Match } from '../src/sim/match.js';
import { HERO_BY_ID } from '../src/data/heroes/index.js';
const comp = (process.env.COMP || 'kaela,lumi,garrok,vex,mire,nyx').split(',');
const players = comp.map((heroId, i) => ({ id: 'p' + i, team: i < 3 ? 0 : 1, heroId, isBot: true, name: heroId, lane: ['top', 'bot', undefined][i % 3], role: i % 3 === 2 ? 'jungle' : 'lane', loadout: HERO_BY_ID[heroId].bot.loadout }));
const m = new Match({ seed: +(process.argv[2] || 5), players, difficulty: +(process.env.D || 3) });
const hist = new Map();
const dmgBy = new Map();
while (!m.over && m.time < 1500) {
  m.tick();
  for (const ev of m.events) {
    if (ev.t === 'damage') { const t = m.entities.get(ev.targetId); if (t?.kind === 'hero') { const s = m.entities.get(ev.srcId); let o = s; if (s?.ownerId != null) o = m.entities.get(s.ownerId) || s; const k = o ? (o.heroId || o.kind) : 'none'; const L = dmgBy.get(t.id) || []; L.push({ t: m.time, k, a: ev.amount }); dmgBy.set(t.id, L.filter(x => m.time - x.t < 8)); } }
    if (ev.t === 'kill') {
      const v = m.entities.get(ev.victimId); const k = m.entities.get(ev.killerId);
      const tw = [...m.entities.values()].find(e => e.kind === 'tower' && e.alive && e.team !== v.team && Math.hypot(e.x - v.x, e.y - v.y) < 16);
      const src = {}; for (const x of dmgBy.get(v.id) || []) src[x.k] = (src[x.k] || 0) + x.a;
      const bb = m.bots[m.heroes.indexOf(v)];
      console.log(`${(m.time / 60).toFixed(1)}m ${v.heroId}${v.team} L${v.level} killed by ${k?.heroId || k?.kind} @${v.x.toFixed(0)},${v.y.toFixed(0)} ${tw ? 'UNDER-TOWER' : ''} mode=${bb.mode} dmg8s=${JSON.stringify(src)}`);
    }
  }
}
console.log('winner', m.winner, (m.time / 60).toFixed(1));
