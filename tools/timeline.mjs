// Structure timeline over N matches: node tools/timeline.mjs N diff
import { TICK_RATE } from '../src/sim/constants.js';
import { Match } from '../src/sim/match.js';
import { HEROES, HERO_BY_ID } from '../src/data/heroes/index.js';
import { makeRng } from '../src/sim/rng.js';
const N = +(process.argv[2] || 6), DIFF = +(process.argv[3] || 3);
const ids = HEROES.map(h => h.id); const acc = {}; const add = (k, v) => { (acc[k] = acc[k] || []).push(v); };
for (let g = 0; g < N; g++) {
  const r = makeRng(Math.imul(g + 77, 2654435761) >>> 0); r(); r();
  const pool = [...ids]; const pick = () => pool.splice(Math.floor(r() * pool.length), 1)[0];
  const players = [];
  for (const team of [0, 1]) { const hs = [pick(), pick(), pick()]; const j = hs.findIndex(x => HERO_BY_ID[x].bot.preferredRole === 'jungle'); if (j >= 0 && j !== 2) [hs[j], hs[2]] = [hs[2], hs[j]];
    hs.forEach((heroId, i) => players.push({ id: 'p' + players.length, team, heroId, isBot: true, name: heroId, lane: ['top', 'bot', undefined][i], role: i === 2 ? 'jungle' : 'lane', loadout: HERO_BY_ID[heroId].bot.loadout })); }
  const m = new Match({ seed: 900 + g, players, difficulty: DIFF });
  const seen = {}; let deadTime = 0, objTime = 0;
  while (!m.over && m.time < 2400) { m.tick();
    if (m.tickCount % TICK_RATE === 0) { for (const h of m.heroes) if (!h.alive) deadTime++; for (const t of [0, 1]) if (m._botTeams?.[t]?.call?.type === 'objective') objTime++; }
    for (const e of m.events) if (e.t === 'objective') { const k = e.key === 'tower' ? 'tower_' + e.tier : e.key; if (!seen[k]) { seen[k] = 1; add(k, m.time / 60); } } }
  add('end', m.time / 60); add('dead%', deadTime / (m.time * 6) * 100); add('objcall%', objTime / (m.time * 2) * 100);
  add('wyrms', m.teamStats[0].wyrms.length + m.teamStats[1].wyrms.length); add('colossus', m.teamStats[0].colossus + m.teamStats[1].colossus);
}
for (const k in acc) console.log(k.padEnd(12), (acc[k].reduce((a, b) => a + b) / acc[k].length).toFixed(1), `n=${acc[k].length}`);
