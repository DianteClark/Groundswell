// Feel metrics (headless): input latency, movement jitter, attack cadence / cancel / orb-walk, bot command churn.
// node tools/feel.mjs
import { Match } from '../src/sim/match.js';
import { TICK_RATE, DT } from '../src/sim/constants.js';
import { HERO_BY_ID } from '../src/data/heroes/index.js';

const mk = (heroId = 'vex', foe = 'bram', extra = {}) => {
  const players = [
    { id: 'me', team: 0, heroId, isBot: false, loadout: HERO_BY_ID[heroId].bot.loadout },
    { id: 'foe', team: 1, heroId: foe, isBot: false, loadout: HERO_BY_ID[foe].bot.loadout },
  ];
  const m = new Match({ seed: 7, players, ...extra }); m.localPlayerId = 'me';
  return m;
};
const out = {};
const fmt = (x, d = 3) => Number.isFinite(x) ? x.toFixed(d) : String(x);

// 1) input latency: ticks between issue() and first position change
{
  const m = mk(); const me = m.heroOf('me'); m.tick();
  me.x = 100; me.y = 80; m.tick(); m.tick();
  const x0 = me.x; m.issue('me', { type: 'moveDir', dx: 1, dy: 0 });
  let n = 0; while (me.x === x0 && n < 30) { m.tick(); n++; }
  out.moveDirLatencyTicks = n; out.moveDirLatencyMs = n * DT * 1000;
  m.issue('me', { type: 'moveDir', dx: 0, dy: 0 }); m.tick(); const xs = me.x; m.tick();
  out.stopOvershoot = me.x - xs;
  const y0 = me.y; m.issue('me', { type: 'move', x: me.x, y: me.y + 10 }); n = 0; while (me.y === y0 && n < 30) { m.tick(); n++; }
  out.moveClickLatencyTicks = n;
}

// 2) jitter: joystick along a wall & through an enemy minion wave; per-tick speed CV and heading wobble
function jitter(label, setup, dir, secs = 3) {
  const m = mk('kaela'); const me = m.heroOf('me'); m.tick();
  setup(m, me);
  m.issue('me', { type: 'moveDir', dx: dir[0], dy: dir[1] });
  const steps = []; let px = me.x, py = me.y;
  for (let i = 0; i < secs * TICK_RATE; i++) { m.tick(); steps.push([me.x - px, me.y - py]); px = me.x; py = me.y; }
  const sp = steps.map(s => Math.hypot(...s) / DT).slice(2);
  const mean = sp.reduce((a, b) => a + b, 0) / sp.length;
  const sd = Math.sqrt(sp.reduce((a, b) => a + (b - mean) ** 2, 0) / sp.length);
  let wob = 0, maxTurn = 0;
  for (let i = 3; i < steps.length; i++) { const a = Math.atan2(steps[i][1], steps[i][0]), b = Math.atan2(steps[i - 1][1], steps[i - 1][0]); let d = Math.abs(a - b); if (d > Math.PI) d = 2 * Math.PI - d; if (Math.hypot(...steps[i]) > 1e-3 && Math.hypot(...steps[i - 1]) > 1e-3) { wob += d; maxTurn = Math.max(maxTurn, d); } }
  out['jitter_' + label] = { meanSpeed: fmt(mean, 2), speedCV: fmt(sd / mean), avgTurnDeg: fmt(wob / steps.length * 180 / Math.PI, 2), maxTurnDeg: fmt(maxTurn * 180 / Math.PI, 1), moveSpeed: me.stats.moveSpeed.toFixed(2) };
}
jitter('open', (m, me) => { me.x = 100; me.y = 70; }, [1, 0], 2.5);
// slide along the inner jungle rock at (120,80) r=6: start left of it, push diagonally into it
jitter('wallSlide', (m, me) => { me.x = 108; me.y = 76; }, [0.8, 0.6]);
jitter('mapEdge', (m, me) => { me.x = 100; me.y = 6; }, [0.7, -0.7]);
jitter('throughWave', (m, me) => {
  me.x = 100; me.y = 16;
  for (let i = 0; i < 6; i++) m.addEntity(m._unit({ kind: 'minion', minionType: 'melee', team: 1, lane: 'top', wp: 99, x: 104 + (i % 3) * 1.2, y: 15 + Math.floor(i / 3) * 1.4, radius: 0.8, stats: { maxHp: 400, power: 0, armor: 0, attackRange: 2, attackSpeed: 1, moveSpeed: 0 }, visual: { model: 'minion_melee' } }));
}, [1, 0], 1.5);
jitter('throughAllies', (m, me) => {
  me.x = 100; me.y = 16;
  for (let i = 0; i < 6; i++) m.addEntity(m._unit({ kind: 'minion', minionType: 'melee', team: 0, lane: 'top', wp: 99, x: 104 + (i % 3) * 1.2, y: 15 + Math.floor(i / 3) * 1.4, radius: 0.8, stats: { maxHp: 400, power: 0, armor: 0, attackRange: 2, attackSpeed: 1, moveSpeed: 0 }, visual: { model: 'minion_melee' } }));
}, [1, 0], 1.5);

// 3) attack cadence & cancel/orb-walk
{
  const m = mk('vex', 'bram'); const me = m.heroOf('me'), foe = m.heroOf('foe'); m.tick();
  me.x = 100; me.y = 80; foe.x = 108; foe.y = 80; foe.stats.moveSpeed = 0; foe.hp = foe.maxHp = 1e6; foe.baseHp = 1e6;
  m.issue('me', { type: 'attack', targetId: foe.id });
  const atk = [], hit = [];
  for (let i = 0; i < 5 * TICK_RATE; i++) { m.tick(); foe.hp = 1e6; for (const e of m.events) { if (e.t === 'attack' && e.srcId === me.id) atk.push({ ...e, at: m.time }); if (e.t === 'attack_hit' && e.srcId === me.id) hit.push(m.time); } }
  const iv = atk.slice(1).map((a, i) => a.at - atk[i].at);
  out.attack = { count: atk.length, period: fmt(atk[0]?.period), windup: fmt(atk[0]?.windup), intervals: iv.map(x => fmt(x)).join(','), firstHitDelay: fmt(hit[0] - atk[0].at) };
  // orb-walk: attack, then move right after the attack point: measure delay to movement and that next attack is not delayed
  const m2 = mk('vex', 'bram'); const a = m2.heroOf('me'), f = m2.heroOf('foe'); m2.tick();
  a.x = 100; a.y = 80; f.x = 108; f.y = 80; f.hp = 1e6;
  m2.issue('me', { type: 'moveDir', dx: 0, dy: 1 }); m2.tick();
  m2.issue('me', { type: 'attack', targetId: f.id, once: true });
  let fired = -1, movedAfter = -1, y0 = a.y;
  for (let i = 0; i < TICK_RATE; i++) { m2.tick(); for (const e of m2.events) if (e.t === 'attack_fire' && fired < 0) { fired = m2.tickCount; y0 = a.y; } if (fired >= 0 && movedAfter < 0 && a.y > y0 + 1e-6) movedAfter = m2.tickCount; }
  out.orbwalk = { resumeTicksAfterFire: movedAfter - fired, joystickHeldOrder: a.order?.type };
  // cancel in windup refunds the swing
  const m3 = mk('vex', 'bram'); const c = m3.heroOf('me'), g = m3.heroOf('foe'); m3.tick();
  c.x = 100; c.y = 80; g.x = 108; g.y = 80; g.hp = 1e6;
  m3.issue('me', { type: 'attack', targetId: g.id }); m3.tick(); m3.tick();
  const inWind = !!c.windup; m3.issue('me', { type: 'move', x: 100, y: 70 }); m3.tick();
  out.cancel = { wasInWindup: inWind, windupCleared: !c.windup, canAttackNow: m3.time >= c.nextAttackAt };
  // buffer: cast pressed during a dash fires as soon as it ends
  const m4 = mk('kaela', 'bram'); const k = m4.heroOf('me'), b = m4.heroOf('foe'); m4.tick();
  k.x = 100; k.y = 80; b.x = 112; b.y = 80; b.hp = 1e6;
  m4.issue('me', { type: 'cast', slot: 'q', x: 112, y: 80 }); m4.tick(); m4.tick();
  const dashing = !!k.dash; m4.issue('me', { type: 'cast', slot: 'w', x: k.x, y: k.y });
  let wAt = -1; for (let i = 0; i < TICK_RATE; i++) { m4.tick(); if (m4.events.some(e => e.t === 'cast' && e.slot === 'w') && wAt < 0) wAt = i; }
  out.buffer = { pressedDuringDash: dashing, firedAfterTicks: wAt };
}

// 4) bots: command churn & heading reversals (twitch) over 3 minutes
{
  const comp = ['bram', 'vex', 'garrok', 'kaela', 'lumi', 'nyx'];
  const players = comp.map((heroId, i) => ({ id: 'p' + i, team: i < 3 ? 0 : 1, heroId, isBot: true, name: heroId, lane: ['top', 'bot', undefined][i % 3], role: i % 3 === 2 ? 'jungle' : 'lane', loadout: HERO_BY_ID[heroId].bot.loadout }));
  const m = new Match({ seed: 99, players, difficulty: 3 });
  let cmds = 0; const orig = m.issue.bind(m); m.issue = (pid, c) => { cmds++; return orig(pid, c); };
  const last = new Map(); let rev = 0, moves = 0, stopGo = 0; const moving = new Map();
  const T = 180 * TICK_RATE;
  for (let i = 0; i < T; i++) {
    m.tick();
    for (const h of m.heroes) {
      if (!h.alive || h.dash) { last.delete(h.id); continue; }
      const dx = h.x - h.prevX, dy = h.y - h.prevY, l = Math.hypot(dx, dy);
      const mv = l > 1e-3; if (moving.has(h.id) && moving.get(h.id) !== mv) stopGo++; moving.set(h.id, mv);
      if (l < 1e-3) continue; moves++;
      const p = last.get(h.id); if (p && (p[0] * dx + p[1] * dy) / (Math.hypot(...p) * l) < -0.5) rev++;
      last.set(h.id, [dx, dy]);
    }
  }
  out.bots = { cmdsPerBotPerSec: fmt(cmds / 6 / 180, 2), reversalsPerBotPerMin: fmt(rev / 6 / 3, 1), stopGoPerBotPerMin: fmt(stopGo / 6 / 3, 1) };
}
console.log(JSON.stringify(out, null, 1));
