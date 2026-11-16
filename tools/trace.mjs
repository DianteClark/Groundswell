// Trace one bot: node tools/trace.mjs heroIdx seconds [every]
import { TICK_RATE } from '../src/sim/constants.js';
import { Match } from '../src/sim/match.js';
import { HERO_BY_ID } from '../src/data/heroes/index.js';
const comp = (process.env.COMP || 'kaela,lumi,garrok,vex,mire,nyx').split(',');
const players = comp.map((heroId, i) => ({ id: 'p' + i, team: i < 3 ? 0 : 1, heroId, isBot: true, name: heroId, lane: ['top', 'bot', undefined][i % 3], role: i % 3 === 2 ? 'jungle' : 'lane', loadout: HERO_BY_ID[heroId].bot.loadout }));
const m = new Match({ seed: +(process.env.SEED || 5), players, difficulty: +(process.env.D || 3) });
const idx = +(process.argv[2] || 2), secs = +(process.argv[3] || 120), every = +(process.argv[4] || 3);
const h = m.heroes[idx]; const bb = m.bots[idx];
while (m.time < secs && !m.over) {
  m.tick();
  for (const ev of m.events) if ((ev.t === 'death' && ev.id === h.id) || (ev.t === 'kill' && ev.killerId === h.id)) console.log('   ', m.time.toFixed(1), ev.t, ev.text || '');
  if (m.tickCount % (TICK_RATE * every) === 0) {
    const o = h.order; const tgt = o?.id ? m.entities.get(o.id) : null;
    console.log(`${m.time.toFixed(0).padStart(4)} ${h.heroId} L${h.level} hp${Math.round(h.hp)}/${Math.round(h.maxHp)} g${Math.round(h.gold)} @${h.x.toFixed(0)},${h.y.toFixed(0)} mode=${bb.mode} order=${o?.type}${tgt ? ':' + (tgt.heroId || tgt.monsterType || tgt.kind) + '@' + tgt.x.toFixed(0) + ',' + tgt.y.toFixed(0) + ' hp' + Math.round(tgt.hp) : o?.x ? ':' + o.x.toFixed(0) + ',' + o.y.toFixed(0) : ''} cs${h.cs} K${h.kills}/${h.deaths} rec=${!!h.recalling} call=${JSON.stringify(m._botTeams?.[h.team]?.call?.type || null)} items=${h.items.map(i => i ? i.tier : 0).join('')}`);
  }
}
