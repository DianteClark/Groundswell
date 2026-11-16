// Profile save (localStorage, versioned, migrate-safe) + export/import save codes.
import { HEROES, HERO_BY_ID, ITEMS, RELICS, SIGILS, ITEM_BY_ID, RELIC_BY_ID, SIGIL_BY_ID, unlockCost, recommendedLoadout, defaultSkinId, getSkins } from './registry.js';
import { FLAIR_KINDS, DEFAULT_FLAIR, flair as flairById } from './flair.js';

export const SAVE_KEY = 'groundswell_save_v1';
const LEGACY_KEYS = ['riftbound_save_v1'];
export const SAVE_VERSION = 3;
export const STARTER_HEROES = ['bram', 'lumi', 'vex'];

const now = () => Date.now();
const store = (() => { try { const t = '__rb_t'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return localStorage; } catch (e) { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; } })();

function blankStats() {
  return { games: 0, wins: 0, losses: 0, kills: 0, deaths: 0, assists: 0, cs: 0, wyrms: 0, colossus: 0, towers: 0, playtime: 0,
    bestKills: 0, bestAssists: 0, bestCs: 0, perfectGames: 0, mythicWins: 0, winsByDiff: [0, 0, 0, 0, 0, 0], streak: 0, bestStreak: 0, essenceEarned: 0 };
}

export function defaultState() {
  return {
    v: SAVE_VERSION, created: now(), name: 'Summoner' + String(Math.floor(Math.random() * 9000 + 1000)),
    level: 1, xp: 0, essence: 1200, prisms: 60,
    owned: { heroes: [], skins: [], relics: [], sigils: [], items: [], flair: [] },
    equipped: { ...DEFAULT_FLAIR },
    loadouts: {},     // heroId -> { active:0, list:[{name, items:[3], relic, sigils:{offense,utility}}] }
    lastPick: { heroId: null, skin: {} },  // skin[heroId] = skinId
    mastery: {},      // heroId -> { xp, level, games, wins, badges:[] }
    history: [],      // last 20
    stats: blankStats(),
    quests: { day: '', daily: [], week: '', weekly: null, rerolls: 1 },
    firstWin: { day: '' },
    season: { id: 1, xp: 0, claimed: [] },
    ladder: { points: 0, peak: 0 },
    seen: { unlocks: [] },
    settings: { quality: 'auto', master: 0.7, sfx: 0.8, music: 0.5, camera: 'follow', touchSize: 1, edgePan: true, showFps: false, champPriority: true, autoBuy: null },
  };
}

function uniq(a) { return [...new Set((a || []).filter(Boolean))]; }

/** Ensure starter grants exist (also runs for older saves when data adds new starter content). */
function applyStarterGrants(s) {
  const o = s.owned;
  for (const id of STARTER_HEROES) if (HERO_BY_ID[id] && !o.heroes.includes(id)) o.heroes.push(id);
  if (!o.heroes.length && HEROES[0]) o.heroes.push(HEROES[0].id);
  for (const it of ITEMS) if (!unlockCost(it) && !o.items.includes(it.id)) o.items.push(it.id);
  if (o.items.length < 3) for (const it of ITEMS) if (o.items.length < 3 && !o.items.includes(it.id)) o.items.push(it.id);
  const ensure = (list, ownedArr, n, filt) => {
    const pool = list.filter(filt || (() => true));
    for (const x of pool) if (!unlockCost(x) && !ownedArr.includes(x.id)) ownedArr.push(x.id);
    const have = pool.filter(x => ownedArr.includes(x.id)).length;
    if (have < n) [...pool].sort((a, b) => unlockCost(a) - unlockCost(b)).filter(x => !ownedArr.includes(x.id)).slice(0, n - have).forEach(x => ownedArr.push(x.id));
  };
  if (!s._starterRelics) { ensure(RELICS, o.relics, 2); s._starterRelics = true; }
  else for (const x of RELICS) if (!unlockCost(x) && !o.relics.includes(x.id)) o.relics.push(x.id);
  ensure(SIGILS, o.sigils, 2, x => x.slot === 'offense');
  ensure(SIGILS, o.sigils, 2, x => x.slot === 'utility');
  for (const h of HEROES) { const d = defaultSkinId(h.id); if (!o.skins.includes(d)) o.skins.push(d); }
  for (const s2 of getSkins()) if ((s2.rarity === 'default') && !o.skins.includes(s2.id)) o.skins.push(s2.id);
  for (const list of Object.values(FLAIR_KINDS)) for (const f of list) if (f.source?.type === 'starter' && !o.flair.includes(f.id)) o.flair.push(f.id);
}

export function migrate(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') { applyStarterGrants(d); return d; }
  const s = { ...d, ...raw };
  s.owned = { ...d.owned, ...(raw.owned || {}) };
  for (const k of Object.keys(d.owned)) s.owned[k] = uniq(s.owned[k]);
  s.equipped = { ...d.equipped, ...(raw.equipped || {}) };
  s.stats = { ...blankStats(), ...(raw.stats || {}) };
  if (!Array.isArray(s.stats.winsByDiff) || s.stats.winsByDiff.length < 6) s.stats.winsByDiff = [0, 0, 0, 0, 0, 0];
  s.settings = { ...d.settings, ...(raw.settings || {}) };
  if (s.settings.quality === 'medium') s.settings.quality = 'med';
  s.quests = { ...d.quests, ...(raw.quests || {}) };
  s.season = { ...d.season, ...(raw.season || {}) };
  s.ladder = { ...d.ladder, ...(raw.ladder || {}) };
  s.firstWin = { ...d.firstWin, ...(raw.firstWin || {}) };
  s.lastPick = { ...d.lastPick, ...(raw.lastPick || {}), skin: { ...(raw.lastPick?.skin || {}) } };
  s.seen = { ...d.seen, ...(raw.seen || {}) };
  s.mastery = raw.mastery && typeof raw.mastery === 'object' ? raw.mastery : {};
  s.loadouts = raw.loadouts && typeof raw.loadouts === 'object' ? raw.loadouts : {};
  s.history = Array.isArray(raw.history) ? raw.history.slice(0, 20) : [];
  for (const k of ['level', 'xp', 'essence', 'prisms']) s[k] = Math.max(k === 'level' ? 1 : 0, Math.floor(Number(s[k]) || 0));
  s.name = String(s.name || d.name).slice(0, 16);
  s.v = SAVE_VERSION;
  applyStarterGrants(s);
  // equipped flair must be owned
  for (const k of Object.keys(DEFAULT_FLAIR)) if (!s.owned.flair.includes(s.equipped[k]) || !flairById(s.equipped[k])) s.equipped[k] = DEFAULT_FLAIR[k];
  return s;
}

let state = null;
const listeners = new Set();
export function load() {
  let raw = null;
  try { raw = JSON.parse(store.getItem(SAVE_KEY) || 'null'); } catch (e) { raw = null; }
  if (!raw) for (const k of LEGACY_KEYS) { try { raw = JSON.parse(store.getItem(k) || 'null'); } catch (e) { raw = null; } if (raw) break; }
  state = migrate(raw);
  persist();
  return state;
}
export function get() { return state || load(); }
export function persist() {
  try { store.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
  for (const fn of listeners) { try { fn(state); } catch (e) { console.error(e); } }
}
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function reset() { state = migrate(null); persist(); return state; }

// ---------- ownership ----------
const KIND_KEY = { hero: 'heroes', skin: 'skins', relic: 'relics', sigil: 'sigils', item: 'items', flair: 'flair' };
export function owns(kind, id) { return get().owned[KIND_KEY[kind] || kind]?.includes(id) || false; }
export function grant(kind, id) { const arr = get().owned[KIND_KEY[kind] || kind]; if (arr && !arr.includes(id)) { arr.push(id); return true; } return false; }
export function canAfford(price) {
  const s = get();
  return (!price?.essence || s.essence >= price.essence) && (!price?.prisms || s.prisms >= price.prisms);
}
/** price = {essence} or {prisms}; pay with the given currency */
export function purchase(kind, id, currency, amount) {
  const s = get();
  if (owns(kind, id)) return false;
  if ((s[currency] || 0) < amount) return false;
  s[currency] -= amount;
  grant(kind, id);
  persist();
  return true;
}

// ---------- loadouts ----------
export function sanitizeLoadout(l, heroId) {
  const s = get(); const rec = recommendedLoadout(HERO_BY_ID[heroId]);
  const out = { name: String(l?.name || 'Loadout').slice(0, 20), items: [], relic: null, sigils: { offense: null, utility: null } };
  const items = Array.isArray(l?.items) ? l.items : [];
  for (let i = 0; i < 3; i++) {
    let id = items[i];
    if (!ITEM_BY_ID[id] || !s.owned.items.includes(id) || out.items.includes(id)) id = [...rec.items, ...s.owned.items].find(x => ITEM_BY_ID[x] && s.owned.items.includes(x) && !out.items.includes(x));
    out.items.push(id || null);
  }
  out.items = out.items.filter(Boolean);
  out.relic = RELIC_BY_ID[l?.relic] && s.owned.relics.includes(l.relic) ? l.relic : (s.owned.relics.includes(rec.relic) ? rec.relic : s.owned.relics.find(r => RELIC_BY_ID[r]) || null);
  for (const slot of ['offense', 'utility']) {
    const v = l?.sigils?.[slot];
    out.sigils[slot] = (SIGIL_BY_ID[v]?.slot === slot && s.owned.sigils.includes(v)) ? v
      : (s.owned.sigils.includes(rec.sigils[slot]) ? rec.sigils[slot] : s.owned.sigils.find(x => SIGIL_BY_ID[x]?.slot === slot) || null);
  }
  return out;
}
export function heroLoadouts(heroId) {
  const s = get();
  let L = s.loadouts[heroId];
  if (!L || !Array.isArray(L.list) || !L.list.length) {
    L = s.loadouts[heroId] = { active: 0, list: [sanitizeLoadout({ name: 'Recommended', ...recommendedLoadout(HERO_BY_ID[heroId]) }, heroId)] };
  }
  L.active = Math.max(0, Math.min(L.list.length - 1, L.active | 0));
  return L;
}
export function activeLoadout(heroId) { const L = heroLoadouts(heroId); return sanitizeLoadout(L.list[L.active], heroId); }

// ---------- mastery ----------
export function masteryOf(heroId) {
  const s = get();
  return s.mastery[heroId] || (s.mastery[heroId] = { xp: 0, level: 1, games: 0, wins: 0 });
}

// ---------- save codes ----------
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); }
function b64enc(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64dec(b) { return decodeURIComponent(escape(atob(b))); }
export function exportCode() {
  const json = JSON.stringify(get());
  return 'GS1.' + b64enc(json) + '.' + fnv(json);
}
export function importCode(code) {
  try {
    const parts = String(code || '').trim().replace(/\s+/g, '').split('.');
    if (parts.length !== 3 || (parts[0] !== 'GS1' && parts[0] !== 'RB1')) return { ok: false, error: 'Not a Groundswell save code.' };
    const json = b64dec(parts[1]);
    if (fnv(json) !== parts[2]) return { ok: false, error: 'Checksum mismatch — code is damaged or edited.' };
    state = migrate(JSON.parse(json));
    persist();
    return { ok: true };
  } catch (e) { return { ok: false, error: 'Could not read save code.' }; }
}

export const Save = { load, get, persist, onChange, reset, owns, grant, canAfford, purchase, heroLoadouts, activeLoadout, sanitizeLoadout, masteryOf, exportCode, importCode };
export default Save;
