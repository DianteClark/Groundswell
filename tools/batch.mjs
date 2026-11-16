// Headless bot-vs-bot batch: node tools/batch.mjs [matches=40] [difficulty=3] [seed0=1]
import { Match } from '../src/sim/match.js';
import { HEROES, HERO_BY_ID } from '../src/data/heroes/index.js';
import { makeRng } from '../src/sim/rng.js';
const N = +(process.argv[2] || 40), DIFF = +(process.argv[3] || 3), S0 = +(process.argv[4] || 1);
const ids = HEROES.map(h => h.id);
const stat = Object.fromEntries([...ids, 'ROLE_lane', 'ROLE_jungle', 'ROLE_roam', 'TEAM_withJungler'].map(id => [id, { games: 0, wins: 0, k: 0, d: 0, a: 0, dmg: 0, gold: 0, cs: 0 }]));
let durs = [], tickMs = 0, ticks = 0, unfinished = 0, errors = 0, kills = [];
const origErr = console.error; console.error = (...a) => { errors++; origErr(...a); };
for (let g = 0; g < N; g++) {
  const r = makeRng(Math.imul(S0 * 1000 + g + 1, 2654435761) >>> 0); r(); r();
  const pool = [...ids]; const pick = () => pool.splice(Math.floor(r() * pool.length), 1)[0];
  const players = [];
  for (const team of [0, 1]) {
    const hs = [pick(), pick(), pick()];
    // jungle slot: prefer a jungle hero
    const jIdx = hs.findIndex(x => HERO_BY_ID[x].bot.preferredRole === 'jungle');
    if (jIdx >= 0 && jIdx !== 2 && !process.env.GLANE) [hs[jIdx], hs[2]] = [hs[2], hs[jIdx]];
    if (process.env.GLANE && jIdx === 2) [hs[0], hs[2]] = [hs[2], hs[0]];
    hs.forEach((heroId, i) => players.push({ id: 'p' + players.length, team, heroId, isBot: true, name: heroId, lane: ['top', 'bot', undefined][i], role: i === 2 ? 'jungle' : 'lane', loadout: (i === 2 && process.env.JBRAND) ? { ...HERO_BY_ID[heroId].bot.loadout, relic: 'hunters_brand', sigils: { ...HERO_BY_ID[heroId].bot.loadout.sigils, offense: 'predator' } } : HERO_BY_ID[heroId].bot.loadout }));
  }
  const m = new Match({ seed: 100 + g + S0 * 1000, players, difficulty: DIFF });
  const t0 = performance.now(); let n = 0;
  while (!m.over && m.time < 40 * 60) { m.tick(); n++; }
  tickMs += performance.now() - t0; ticks += n;
  if (!m.over) unfinished++;
  durs.push(m.time / 60);
  kills.push(m.teamStats[0].kills + m.teamStats[1].kills);
  for (const h of m.heroes) { const rk = 'ROLE_' + m.bots[m.heroes.indexOf(h)].role; for (const key of [h.heroId, rk, ...(m.heroes.some(x => x.team === h.team && m.bots[m.heroes.indexOf(x)].role === 'jungle') && !m.heroes.some(x => x.team !== h.team && m.bots[m.heroes.indexOf(x)].role === 'jungle') ? ['TEAM_withJungler'] : [])]) { const s = stat[key]; s.games++; if (m.winner === h.team) s.wins++; s.k += h.kills; s.d += h.deaths; s.a += h.assists; s.dmg += h.damageDealt; s.gold += h.gold; s.cs += h.cs; } }
  if (process.env.V) console.log(`g${g} ${(m.time / 60).toFixed(1)}m win=${m.winner} K ${m.teamStats[0].kills}-${m.teamStats[1].kills} T ${m.teamStats[0].towers}-${m.teamStats[1].towers} ` + m.heroes.map(h => `${h.heroId}${h.team}:${h.kills}/${h.deaths}/${h.assists} L${h.level} cs${h.cs} ${h.items.map(i => i ? i.tier : 0).join('')}`).join(' '));
}
if (process.env.OUT) { (await import('fs')).writeFileSync(process.env.OUT, JSON.stringify({ N, stat, durs, kills, tickMs, ticks, unfinished, errors })); }
durs.sort((a, b) => a - b);
console.log(`matches ${N} diff ${DIFF}: dur avg ${(durs.reduce((a, b) => a + b) / N).toFixed(1)}m  min ${durs[0].toFixed(1)} med ${durs[N >> 1].toFixed(1)} max ${durs[N - 1].toFixed(1)}  unfinished ${unfinished}  avg kills ${(kills.reduce((a, b) => a + b) / N).toFixed(1)}  tick ${(tickMs / ticks).toFixed(3)}ms  errors ${errors}`);
for (const id in stat) { const s = stat[id]; if (!s.games) continue; console.log(`${id.padEnd(7)} games ${String(s.games).padStart(3)} win ${(100 * s.wins / s.games).toFixed(0).padStart(3)}%  KDA ${(s.k / s.games).toFixed(1)}/${(s.d / s.games).toFixed(1)}/${(s.a / s.games).toFixed(1)}  dmg ${(s.dmg / s.games / 1000).toFixed(1)}k cs ${(s.cs / s.games).toFixed(0)}`); }
