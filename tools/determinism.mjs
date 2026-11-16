// Same seed twice → identical state hash.
import { Match } from '../src/sim/match.js';
import { HERO_BY_ID } from '../src/data/heroes/index.js';
const run = () => {
  const comp = ['bram', 'pip', 'garrok', 'nyx', 'mire', 'lumi'];
  const players = comp.map((heroId, i) => ({ id: 'p' + i, team: i < 3 ? 0 : 1, heroId, isBot: true, name: heroId, lane: ['top', 'bot', undefined][i % 3], role: i % 3 === 2 ? 'jungle' : 'lane', loadout: HERO_BY_ID[heroId].bot.loadout }));
  const m = new Match({ seed: 4242, players, difficulty: 4 });
  for (let i = 0; i < 30 * 60 * 8 && !m.over; i++) m.tick();
  let hsh = 0; for (const e of m.entities.values()) hsh = (hsh * 31 + Math.round(e.x * 100) + Math.round((e.hp || 0) * 10)) | 0;
  return `${m.tickCount} ${hsh} ${m.heroes.map(h => h.kills + '/' + h.deaths + ':' + Math.round(h.gold)).join(' ')}`;
};
const a = run(), b = run();
console.log(a); console.log(a === b ? 'DETERMINISTIC ✓' : 'MISMATCH ✗\n' + b);
