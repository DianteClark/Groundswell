// Economy: match rewards, quests, season track, account levels, hero mastery, bot ladder.
import { HEROES, HERO_BY_ID, getSkins, RARITY } from './registry.js';
import { FLAIR_KINDS, flair as flairById } from './flair.js';
import Save from './save.js';

// ---------- deterministic helpers ----------
export function dayKey(d = new Date()) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
export function weekKey(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); }
export function hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
export function seeded(seed) { let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function msToMidnight() { const n = new Date(); const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return m - n; }
export function fmtCountdown(ms) { const h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; }

// ---------- difficulty ----------
export const DIFFICULTIES = [
  { id: 1, name: 'Recruit', mult: 1.0, color: '#7fc8a9', desc: 'Bots learn the ropes. Perfect for trying new heroes.' },
  { id: 2, name: 'Adept', mult: 1.2, color: '#5fb3ff', desc: 'Bots trade, farm, and take objectives.' },
  { id: 3, name: 'Veteran', mult: 1.45, color: '#b46cff', desc: 'Bots combo abilities and punish mistakes.' },
  { id: 4, name: 'Elite', mult: 1.75, color: '#ff8a3d', desc: 'Coordinated ganks and smart rotations.' },
  { id: 5, name: 'Mythic', mult: 2.1, color: '#ff4d6d', desc: 'Near-perfect mechanics. Bring your best.' },
];
export const diffInfo = (d) => DIFFICULTIES[Math.max(1, Math.min(5, d | 0 || 1)) - 1];

// ---------- account levels ----------
export const xpToNext = (level) => 400 + 120 * (level - 1);
export function levelRewards(level) {
  const prisms = level % 5 === 0 ? 60 : 20;
  const fl = [];
  for (const list of Object.values(FLAIR_KINDS)) for (const f of list) if (f.source?.type === 'level' && f.source.level === level) fl.push(f.id);
  return { prisms, flair: fl };
}

// ---------- mastery ----------
export const MASTERY_XP = [0, 400, 1100, 2200, 3700, 5600, 8000]; // cumulative xp needed for level 1..7
export const MASTERY_NAMES = ['Initiate', 'Apprentice', 'Adept', 'Expert', 'Master', 'Grandmaster', 'Ascendant'];
export const MASTERY_COLORS = ['#7d8aa3', '#8fb4d9', '#5fd0a0', '#4fa3ff', '#b46cff', '#ff7bd5', '#ffc947'];
export function masteryLevelFor(xp) { let l = 1; for (let i = 0; i < MASTERY_XP.length; i++) if (xp >= MASTERY_XP[i]) l = i + 1; return l; }
export function masteryProgress(m) {
  const lvl = masteryLevelFor(m.xp); if (lvl >= 7) return { level: 7, pct: 1, cur: m.xp, next: null };
  const a = MASTERY_XP[lvl - 1], b = MASTERY_XP[lvl];
  return { level: lvl, pct: (m.xp - a) / (b - a), cur: m.xp - a, next: b - a };
}

// ---------- bot ladder ----------
export const RANKS = [
  { name: 'Bronze', color: '#d08a4f', icon: '🥉', minDiff: 1 },
  { name: 'Silver', color: '#c6d2e6', icon: '🥈', minDiff: 2 },
  { name: 'Gold', color: '#ffcf4a', icon: '🥇', minDiff: 3 },
  { name: 'Platinum', color: '#54e0c0', icon: '💠', minDiff: 3 },
  { name: 'Diamond', color: '#7cc7ff', icon: '💎', minDiff: 4 },
  { name: 'Master', color: '#c47bff', icon: '🔮', minDiff: 5 },
  { name: 'Mythic', color: '#ff5f7a', icon: '🔥', minDiff: 5 },
];
export function rankInfo(points) {
  const p = Math.max(0, points | 0);
  const idx = Math.min(6, Math.floor(p / 300));
  if (idx === 6) return { idx, rank: RANKS[6], div: '', lp: p - 1800, label: 'Mythic', pct: 1 };
  const within = p - idx * 300; const div = 3 - Math.floor(within / 100);
  return { idx, rank: RANKS[idx], div: ['I', 'II', 'III'][div - 1], lp: within % 100, label: `${RANKS[idx].name} ${['I', 'II', 'III'][div - 1]}`, pct: (within % 100) / 100 };
}
export function ladderDelta(points, won, diff) {
  const r = rankInfo(points).rank;
  const gap = diff - r.minDiff;
  if (won) return gap >= 0 ? 28 + 6 * gap : Math.max(4, 28 + 10 * gap);
  return -Math.max(4, Math.min(22, 14 - 4 * gap));
}

// ---------- quests ----------
const ROLES = () => [...new Set(HEROES.map(h => h.role).filter(Boolean))];
const DAILY_TEMPLATES = [
  { k: 'win', n: 2, text: 'Win {n} games', stat: 'win' },
  { k: 'play', n: 3, text: 'Play {n} games', stat: 'play' },
  { k: 'takedowns', n: 15, text: 'Score {n} takedowns', stat: 'takedowns' },
  { k: 'wyrm', n: 1, text: 'Take a Wyrm', stat: 'wyrms' },
  { k: 'colossus', n: 1, text: 'Defeat the Colossus', stat: 'colossus' },
  { k: 'towers', n: 4, text: 'Destroy {n} towers', stat: 'towers' },
  { k: 'cs_role', n: 50, text: 'Get {n} last hits with a {role}', stat: 'cs', role: true },
  { k: 'win_role', n: 1, text: 'Win a game as a {role}', stat: 'win', role: true },
  { k: 'win_diff', n: 1, text: 'Win on Veteran or harder', stat: 'win', minDiff: 3 },
  { k: 'assists', n: 12, text: 'Get {n} assists', stat: 'assists' },
];
const WEEKLY_TEMPLATES = [
  { k: 'w_win', n: 8, text: 'Win {n} games this week', stat: 'win' },
  { k: 'w_wyrm', n: 5, text: 'Take {n} Wyrms this week', stat: 'wyrms' },
  { k: 'w_kda', n: 80, text: 'Score {n} takedowns this week', stat: 'takedowns' },
  { k: 'w_towers', n: 20, text: 'Destroy {n} towers this week', stat: 'towers' },
];
function makeQuest(t, rnd, idx, weekly) {
  const roles = ROLES();
  const role = t.role ? roles[Math.floor(rnd() * roles.length)] : null;
  const text = t.text.replace('{n}', t.n).replace('{role}', role || '');
  const reward = weekly ? { essence: 800, prisms: 100, seasonXp: 800 } : { essence: [150, 200, 250][idx] || 150, prisms: idx === 2 ? 15 : 0, seasonXp: 200 };
  return { id: t.k + (role ? '_' + role : ''), text, stat: t.stat, role, minDiff: t.minDiff || 0, n: t.n, p: 0, done: false, reward };
}
export function refreshQuests(s = Save.get()) {
  const dk = dayKey(), wk = weekKey();
  let changed = false;
  if (s.quests.day !== dk) {
    const rnd = seeded('daily:' + dk);
    const pool = [...DAILY_TEMPLATES]; const picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    s.quests.day = dk; s.quests.daily = picks.map((t, i) => makeQuest(t, rnd, i, false)); s.quests.rerolls = 1; changed = true;
  }
  if (s.quests.week !== wk) {
    const rnd = seeded('weekly:' + wk);
    s.quests.week = wk; s.quests.weekly = makeQuest(WEEKLY_TEMPLATES[Math.floor(rnd() * WEEKLY_TEMPLATES.length)], rnd, 0, true); changed = true;
  }
  if (changed) Save.persist();
  return s.quests;
}
export function rerollQuest(i) {
  const s = Save.get(); const q = s.quests.daily[i];
  if (!q || q.done || s.quests.rerolls <= 0) return false;
  const rnd = seeded('reroll:' + dayKey() + ':' + i + ':' + q.id);
  const pool = DAILY_TEMPLATES.filter(t => !s.quests.daily.some(d => d.id.startsWith(t.k)));
  if (!pool.length) return false;
  s.quests.daily[i] = makeQuest(pool[Math.floor(rnd() * pool.length)], rnd, i, false);
  s.quests.rerolls--; Save.persist(); return true;
}
function questGain(q, sum) {
  if (q.role && sum.role !== q.role) return 0;
  if (q.minDiff && sum.difficulty < q.minDiff) return 0;
  switch (q.stat) {
    case 'win': return sum.won ? 1 : 0;
    case 'play': return 1;
    case 'takedowns': return sum.kills + sum.assists;
    case 'assists': return sum.assists;
    case 'cs': return sum.cs;
    case 'wyrms': return sum.wyrms;
    case 'colossus': return sum.colossus;
    case 'towers': return sum.towers;
    default: return 0;
  }
}

// ---------- season track ----------
export const SEASON = { id: 1, name: 'Season 1 · First Swell', tiers: 30, xpPerTier: 500 };
export function seasonReward(tier) {
  const fl = [];
  for (const list of Object.values(FLAIR_KINDS)) for (const f of list) if (f.source?.type === 'season' && f.source.tier === tier) fl.push(f.id);
  if (fl.length) return { type: 'flair', id: fl[0], extra: fl.slice(1) };
  if (tier === 10 || tier === 20) return { type: 'skin', rarity: 'epic', fallbackPrisms: 150 };
  if (tier === 30) return { type: 'skin', rarity: 'legendary', fallbackPrisms: 300 };
  if (tier % 5 === 0) return { type: 'prisms', amount: 50 };
  if (tier % 2 === 0) return { type: 'prisms', amount: 15 };
  return { type: 'essence', amount: 200 + tier * 10 };
}
export function seasonTier(xp) { return Math.min(SEASON.tiers, Math.floor(xp / SEASON.xpPerTier)); }

// ---------- reward grant helpers ----------
function grantFlair(id, unlocks) { if (flairById(id) && Save.grant('flair', id)) unlocks.push({ kind: 'flair', id, name: flairById(id).name, sub: flairById(id).kind, rarity: flairById(id).rarity }); }
function grantSeasonReward(tier, s, unlocks, out) {
  const r = seasonReward(tier);
  if (r.type === 'flair') { grantFlair(r.id, unlocks); (r.extra || []).forEach(x => grantFlair(x, unlocks)); out.push({ tier, label: flairById(r.id)?.name || r.id }); }
  else if (r.type === 'skin') {
    const pool = getSkins().filter(k => k.rarity === r.rarity && !s.owned.skins.includes(k.id) && s.owned.heroes.includes(k.heroId));
    const pool2 = pool.length ? pool : getSkins().filter(k => k.rarity === r.rarity && !s.owned.skins.includes(k.id));
    if (pool2.length) { const k = pool2[Math.floor(seeded('season' + tier + s.created)() * pool2.length)]; Save.grant('skin', k.id); unlocks.push({ kind: 'skin', id: k.id, name: k.name, sub: (HERO_BY_ID[k.heroId]?.name || '') + ' skin', rarity: k.rarity }); out.push({ tier, label: k.name }); }
    else { s.prisms += r.fallbackPrisms; out.push({ tier, label: `${r.fallbackPrisms} Prisms` }); }
  } else if (r.type === 'prisms') { s.prisms += r.amount; out.push({ tier, label: `${r.amount} Prisms` }); }
  else { s.essence += r.amount; out.push({ tier, label: `${r.amount} Essence` }); }
}

/** Evaluate achievements / ladder / mastery flair sources against current state. */
export function checkFlairUnlocks(s = Save.get(), unlocks = []) {
  const li = rankInfo(s.ladder.peak).idx;
  const maxM = Math.max(1, ...Object.values(s.mastery).map(m => m.level || 1));
  for (const list of Object.values(FLAIR_KINDS)) for (const f of list) {
    if (s.owned.flair.includes(f.id)) continue;
    const src = f.source || {};
    let ok = false;
    if (src.type === 'achievement') ok = (s.stats[src.stat] || 0) >= src.gte;
    else if (src.type === 'ladder') ok = li >= src.rank;
    else if (src.type === 'level') ok = s.level >= src.level;
    else if (src.type === 'mastery') ok = src.heroId ? ((s.mastery[src.heroId]?.level || 1) >= src.level) : maxM >= src.level;
    else if (src.type === 'season') ok = (s.season.claimed || []).includes(src.tier);
    if (ok) grantFlair(f.id, unlocks);
  }
  return unlocks;
}

// ---------- match summary ----------
export function summarizeMatch(match, config) {
  const cfg = config || match?.config || {};
  const players = cfg.players || [];
  const pid = match?.localPlayerId || players.find(p => !p.isBot)?.id || players[0]?.id;
  let idx = players.findIndex(p => p.id === pid); if (idx < 0) idx = 0;
  const heroes = match?.heroes || [];
  const hero = (match?.heroOf && match.heroOf(pid)) || heroes[idx] || {};
  const team = hero.team ?? players[idx]?.team ?? 0;
  const ts = match?.teamStats?.[team] || {};
  const heroId = hero.heroId || players[idx]?.heroId;
  const finished = !!match?.over;
  return {
    finished, won: finished && match.winner === team, team, heroId, role: HERO_BY_ID[heroId]?.role || '',
    difficulty: cfg.difficulty || 1, mode: cfg.mode || 'bots',
    kills: hero.kills | 0, deaths: hero.deaths | 0, assists: hero.assists | 0, cs: hero.cs | 0, gold: Math.round(hero.goldEarned ?? hero.gold ?? 0), level: hero.level || 1,
    wyrms: Array.isArray(ts.wyrms) ? ts.wyrms.length : (ts.wyrms | 0), colossus: Array.isArray(ts.colossus) ? ts.colossus.length : (ts.colossus | 0), towers: Array.isArray(ts.towers) ? ts.towers.length : (ts.towers | 0), teamKills: ts.kills | 0,
    enemyKills: match?.teamStats?.[1 - team]?.kills | 0, duration: match?.time || 0,
  };
}

/** Compute & apply rewards to the save. Returns a rich result for the results screen. */
export function grantMatchRewards(match, config) {
  const s = Save.get();
  refreshQuests(s);
  const sum = summarizeMatch(match, config);
  const d = diffInfo(sum.difficulty);
  const minutes = sum.duration / 60;
  const durMult = Math.max(0.3, Math.min(1.25, minutes / 10));
  const quitMult = sum.finished ? 1 : 0.5;
  const lines = [];
  const base = Math.round((sum.won ? 160 : 90) * durMult * quitMult);
  lines.push({ label: sum.won ? 'Victory' : (sum.finished ? 'Match played' : 'Left early'), value: base });
  const perf = Math.round((sum.kills * 8 + sum.assists * 4 + sum.cs * 0.5) * quitMult);
  if (perf) lines.push({ label: 'Performance', value: perf });
  const obj = Math.round((sum.wyrms * 15 + sum.colossus * 30 + sum.towers * 10) * quitMult);
  if (obj) lines.push({ label: 'Objectives', value: obj });
  const sub = base + perf + obj;
  const diffBonus = Math.round(sub * (d.mult - 1));
  if (diffBonus) lines.push({ label: `${d.name} bonus ×${d.mult}`, value: diffBonus });
  let essence = sub + diffBonus, prisms = 0;
  const dk = dayKey();
  const firstWin = sum.won && s.firstWin.day !== dk;
  if (firstWin) { s.firstWin.day = dk; prisms += 50; essence += 200; lines.push({ label: 'First Win of the Day', value: 200, prisms: 50 }); }

  // stats + history
  const st = s.stats;
  st.games++; if (sum.won) { st.wins++; st.streak = Math.max(1, st.streak + 1); st.winsByDiff[sum.difficulty]++; if (sum.difficulty >= 5) st.mythicWins++; if (sum.deaths === 0) st.perfectGames++; }
  else { st.losses++; st.streak = Math.min(-1, st.streak - 1); }
  st.bestStreak = Math.max(st.bestStreak, st.streak);
  st.kills += sum.kills; st.deaths += sum.deaths; st.assists += sum.assists; st.cs += sum.cs;
  st.wyrms += sum.wyrms; st.colossus += sum.colossus; st.towers += sum.towers; st.playtime += sum.duration;
  st.bestKills = Math.max(st.bestKills, sum.kills); st.bestAssists = Math.max(st.bestAssists, sum.assists); st.bestCs = Math.max(st.bestCs, sum.cs);
  s.history.unshift({ t: Date.now(), heroId: sum.heroId, won: sum.won, finished: sum.finished, k: sum.kills, d: sum.deaths, a: sum.assists, cs: sum.cs, dur: Math.round(sum.duration), diff: sum.difficulty, mode: sum.mode });
  s.history = s.history.slice(0, 20);

  // quests
  const quests = [];
  for (const q of [...s.quests.daily, s.quests.weekly].filter(Boolean)) {
    if (q.done) continue;
    const before = q.p; const g = questGain(q, sum);
    if (!g) continue;
    q.p = Math.min(q.n, q.p + g);
    const completed = q.p >= q.n;
    if (completed) { q.done = true; essence += q.reward.essence || 0; prisms += q.reward.prisms || 0; }
    quests.push({ text: q.text, before, after: q.p, n: q.n, completed, reward: q.reward });
  }
  const questSeasonXp = quests.filter(q => q.completed).reduce((a, q) => a + (q.reward.seasonXp || 0), 0);

  // currencies
  s.essence += essence; s.prisms += prisms; st.essenceEarned += essence;

  const unlocks = [];
  // account xp
  const accountXp = Math.round(((sum.won ? 120 : 70) + sum.kills * 3 + sum.assists * 2) * (1 + (sum.difficulty - 1) * 0.12) * durMult * quitMult);
  const levelBefore = s.level, xpBefore = s.xp;
  s.xp += accountXp;
  const levelUps = [];
  while (s.xp >= xpToNext(s.level) && s.level < 200) {
    s.xp -= xpToNext(s.level); s.level++;
    const r = levelRewards(s.level); s.prisms += r.prisms; prisms += r.prisms;
    r.flair.forEach(id => grantFlair(id, unlocks));
    levelUps.push({ level: s.level, prisms: r.prisms });
  }

  // mastery
  const m = Save.masteryOf(sum.heroId);
  const mBefore = { xp: m.xp, level: m.level };
  const mxp = Math.round(((sum.won ? 220 : 110) + (sum.kills + sum.assists) * 6) * (1 + (sum.difficulty - 1) * 0.1) * quitMult);
  m.xp += mxp; m.games = (m.games || 0) + 1; if (sum.won) m.wins = (m.wins || 0) + 1;
  m.level = masteryLevelFor(m.xp);

  // season
  const sxp = Math.round((sum.won ? 150 : 90) * durMult * quitMult) + questSeasonXp;
  const tBefore = seasonTier(s.season.xp);
  s.season.xp = Math.min(SEASON.tiers * SEASON.xpPerTier, s.season.xp + sxp);
  const tAfter = seasonTier(s.season.xp);
  const seasonGained = [];
  for (let t = 1; t <= tAfter; t++) if (!s.season.claimed.includes(t)) { s.season.claimed.push(t); const pB = s.prisms, eB = s.essence; grantSeasonReward(t, s, unlocks, seasonGained); prisms += s.prisms - pB; essence += s.essence - eB; }

  // ladder (bots only)
  let ladder = null;
  if (sum.mode === 'bots') {
    const before = s.ladder.points;
    const delta = sum.finished || !sum.won ? ladderDelta(before, sum.won, sum.difficulty) : 0;
    s.ladder.points = Math.max(0, before + delta); s.ladder.peak = Math.max(s.ladder.peak, s.ladder.points);
    const rb = rankInfo(before), ra = rankInfo(s.ladder.points);
    ladder = { before, after: s.ladder.points, delta: s.ladder.points - before, rankBefore: rb, rankAfter: ra, promoted: ra.label !== rb.label && s.ladder.points > before, demoted: ra.label !== rb.label && s.ladder.points < before };
  }

  checkFlairUnlocks(s, unlocks);
  Save.persist();
  return {
    summary: sum, lines, essence, prisms, firstWin,
    account: { xpGained: accountXp, levelBefore, xpBefore, levelAfter: s.level, xpAfter: s.xp, levelUps },
    mastery: { heroId: sum.heroId, xpGained: mxp, before: mBefore, after: { xp: m.xp, level: m.level }, levelUp: m.level > mBefore.level },
    season: { xpGained: sxp, tierBefore: tBefore, tierAfter: tAfter, rewards: seasonGained },
    quests, ladder, unlocks,
  };
}

export { RARITY };
