// Per-ability smoke test: each hero casts each slot at a nearby enemy; verify events.
import { Match } from '../src/sim/match.js';
import { HEROES } from '../src/data/heroes/index.js';
let fail = 0;
for (const H of HEROES) {
  for (const slot of ['q', 'w', 'r']) {
    for (const aug of ['a', 'b']) {
      const players = [
        { id: 'me', team: 0, heroId: H.id, isBot: false, loadout: { items: ['warblade', 'bulwark', 'swiftboots'], relic: 'blink', sigils: {} } },
        { id: 'ally', team: 0, heroId: 'bram', isBot: false, loadout: { items: [], relic: 'barrier', sigils: {} } },
        { id: 'foe', team: 1, heroId: 'kaela', isBot: false, loadout: { items: [], relic: 'barrier', sigils: {} } },
        { id: 'foe2', team: 1, heroId: 'lumi', isBot: false, loadout: { items: [], relic: 'barrier', sigils: {} } },
      ];
      const m = new Match({ seed: 3, players });
      const me = m.heroOf('me'), ally = m.heroOf('ally'), foe = m.heroOf('foe'), foe2 = m.heroOf('foe2');
      for (const h of m.heroes) { m._giveXp(h, 99999); h.hp = h.maxHp; }
      for (const lv of [3, 6, 9]) m.issue('me', { type: 'augment', level: lv, choice: aug });
      me.x = 120; me.y = 70; ally.x = 118; ally.y = 72; foe.x = 125; foe.y = 70; foe2.x = 126; foe2.y = 72;
      m.tick();
      ally.hp = ally.maxHp * 0.5;
      // pre-cast setup: a few marks / heat etc
      const tgt = slot === 'w' && (H.id === 'pip') || (slot === 'r' && H.id === 'pip') ? ally : foe;
      const evs = [];
      m.issue('me', { type: 'cast', slot, x: tgt.x, y: tgt.y, targetId: tgt.id });
      for (let i = 0; i < 30 * 4; i++) {
        m.tick(); evs.push(...m.events);
        if (i === 10 && ['kaela', 'nyx'].includes(H.id) && slot === 'q') m.issue('me', { type: 'cast', slot, x: foe.x + 3, y: foe.y }); // recast
        if (i === 50 && H.id === 'lumi' && slot === 'r') {} 
      }
      const casted = evs.some(e => e.t === 'cast' && e.srcId === me.id && e.slot === slot);
      const dmg = evs.filter(e => e.t === 'damage' && e.ability && e.ability.startsWith(H.id)).reduce((a, e) => a + e.amount, 0);
      const st = evs.filter(e => e.t === 'status' && e.id !== me.id).map(e => e.key);
      const selfSt = evs.filter(e => e.t === 'status' && e.id === me.id).map(e => e.key);
      const heals = evs.filter(e => e.t === 'heal').reduce((a, e) => a + e.amount, 0);
      const shields = evs.filter(e => e.t === 'shield').reduce((a, e) => a + e.amount, 0);
      const vfx = [...new Set(evs.filter(e => e.t === 'vfx').map(e => e.key))];
      const ok = casted && (dmg > 0 || st.length || heals > 0 || shields > 0 || selfSt.length || me.channel || m.entities.size);
      if (!casted) fail++;
      if (aug === 'a' || !casted) console.log(`${casted ? 'OK ' : 'FAIL'} ${H.id}.${slot}[${aug}] dmg=${dmg} statuses=[${[...new Set(st)]}] self=[${[...new Set(selfSt)]}] heal=${heals} shield=${Math.round(shields)} vfx=[${vfx}] foeHp=${Math.round(foe.hp)}/${Math.round(foe.maxHp)}`);
    }
  }
}
console.log(fail ? `${fail} FAILURES` : 'all abilities cast');
