// Merge batch JSON outputs: node tools/merge.mjs a.json b.json ...
import fs from 'fs';
const R = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f)));
const stat = {}; let durs = [], kills = [], tickMs = 0, ticks = 0, un = 0, err = 0, N = 0;
for (const r of R) { N += r.N; durs.push(...r.durs); kills.push(...r.kills); tickMs += r.tickMs; ticks += r.ticks; un += r.unfinished; err += r.errors;
  for (const id in r.stat) { const a = stat[id] = stat[id] || { games: 0, wins: 0, k: 0, d: 0, a: 0, dmg: 0, gold: 0, cs: 0 }; for (const k in a) a[k] += r.stat[id][k]; } }
durs.sort((a, b) => a - b);
console.log(`matches ${N}: dur avg ${(durs.reduce((a, b) => a + b) / N).toFixed(1)}m min ${durs[0].toFixed(1)} med ${durs[N >> 1].toFixed(1)} max ${durs[N - 1].toFixed(1)} | in 13-20m: ${durs.filter(d => d >= 13 && d <= 20).length}/${N} | unfinished ${un} | kills/match ${(kills.reduce((a, b) => a + b) / N).toFixed(1)} | tick ${(tickMs / ticks).toFixed(3)}ms | errors ${err}`);
console.log('hero     games  win%   K/D/A           dmg     cs');
for (const id in stat) { const s = stat[id]; console.log(`${id.padEnd(8)} ${String(s.games).padStart(4)}  ${(100 * s.wins / s.games).toFixed(0).padStart(3)}%   ${(s.k / s.games).toFixed(1)}/${(s.d / s.games).toFixed(1)}/${(s.a / s.games).toFixed(1)}`.padEnd(42) + `${(s.dmg / s.games / 1000).toFixed(1)}k  ${(s.cs / s.games).toFixed(0)}`); }
