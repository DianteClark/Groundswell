// Difficulty check: team0 at difficulty A vs team1 at difficulty B (sides swapped half the time).
// node tools/diffvs.mjs N A B
import { Match } from '../src/sim/match.js';
import { HEROES, HERO_BY_ID } from '../src/data/heroes/index.js';
import { makeRng } from '../src/sim/rng.js';
const N = +(process.argv[2] || 6), A = +(process.argv[3] || 1), B = +(process.argv[4] || 5);
let winsA = 0, durs = [];
for (let g = 0; g < N; g++) {
  const r = makeRng(Math.imul((g >> 1) + 501, 2654435761) >>> 0); r(); r();
  const ids = HEROES.map(h => h.id); const pick = () => ids.splice(Math.floor(r() * ids.length), 1)[0];
  const players = [];
  for (const team of [0, 1]) { const hs = [pick(), pick(), pick()]; const j = hs.findIndex(x => HERO_BY_ID[x].bot.preferredRole === 'jungle'); if (j >= 0 && j !== 2) [hs[j], hs[2]] = [hs[2], hs[j]];
    hs.forEach((heroId, i) => players.push({ id: 'p' + players.length, team, heroId, isBot: true, name: heroId, lane: ['top', 'bot', undefined][i], role: i === 2 ? 'jungle' : 'lane', loadout: HERO_BY_ID[heroId].bot.loadout })); }
  const m = new Match({ seed: 700 + (g >> 1), players, difficulty: 3 });
  const aTeam = g % 2;
  // re-create brains with per-team difficulty (test harness only)
  m.bots.forEach((b, i) => { const BB = b.constructor; m.bots[i] = new BB(m, b.h, { difficulty: b.h.team === aTeam ? A : B, lane: players[i].lane, role: players[i].role, index: i % 3 }); });
  while (!m.over && m.time < 2400) m.tick();
  if (m.winner === aTeam) winsA++; durs.push(m.time / 60);
  console.log(`g${g} [${players.map(p => p.heroId).join(',')}] diff${A} on team${aTeam}: winner team${m.winner} (${m.winner === aTeam ? 'D' + A : 'D' + B}) ${(m.time / 60).toFixed(1)}m K ${m.teamStats[aTeam].kills}-${m.teamStats[1 - aTeam].kills}`);
}
console.log(`D${A} vs D${B}: D${A} won ${winsA}/${N}; avg ${(durs.reduce((a, b) => a + b) / N).toFixed(1)}m`);
