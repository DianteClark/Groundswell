// Data registry for meta/UI. Reads game data generically (never hardcode hero/item lists).
import { HEROES, HERO_BY_ID } from '../data/heroes/index.js';
import { ITEMS, ITEM_BY_ID } from '../data/items.js';
import { RELICS, RELIC_BY_ID } from '../data/relics.js';
import { SIGILS, SIGIL_BY_ID } from '../data/sigils.js';
import * as SKIN_MOD from './skins_source.js';

export { HEROES, HERO_BY_ID, ITEMS, ITEM_BY_ID, RELICS, RELIC_BY_ID, SIGILS, SIGIL_BY_ID };

export const ROLE_ICON = {
  tank: '🛡️', fighter: '⚔️', mage: '✨', marksman: '🏹', assassin: '🗡️', support: '💠', controller: '🌀', jungler: '🐾',
};
export const roleIcon = (role) => ROLE_ICON[String(role || '').toLowerCase()] || '◆';

export const RARITY = {
  default: { name: 'Default', color: '#8a96ad', order: 0 },
  common: { name: 'Common', color: '#7f9cc4', order: 1 },
  rare: { name: 'Rare', color: '#4fa3ff', order: 2 },
  epic: { name: 'Epic', color: '#b46cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffc947', order: 4 },
};

// ---------- skins (Agent B's data; may be missing) ----------
let _skinCache = null, _skinSig = '';
export function getSkins() {
  const src = (typeof window !== 'undefined' && Array.isArray(window.__RIFT_SKINS) && window.__RIFT_SKINS.length)
    ? window.__RIFT_SKINS : (Array.isArray(SKIN_MOD.SKINS) ? SKIN_MOD.SKINS : []);
  const sig = src.length + ':' + HEROES.length;
  if (_skinCache && sig === _skinSig) return _skinCache;
  const list = src.filter(s => s && s.id && s.heroId).map(s => ({ rarity: 'common', price: {}, desc: '', colors: {}, ...s }));
  // guarantee a default skin per hero
  for (const h of HEROES) {
    if (!list.some(s => s.heroId === h.id && (s.rarity === 'default' || s.id === h.id + '_default'))) {
      list.unshift({ id: h.id + '_default', heroId: h.id, name: 'Default', rarity: 'default', price: {}, desc: 'The classic look.', colors: { primary: h.color } });
    }
  }
  _skinCache = list; _skinSig = sig;
  return list;
}
export const skinById = (id) => getSkins().find(s => s.id === id) || null;
export const skinsFor = (heroId) => getSkins().filter(s => s.heroId === heroId)
  .sort((a, b) => (RARITY[a.rarity]?.order ?? 1) - (RARITY[b.rarity]?.order ?? 1));
export const defaultSkinId = (heroId) => (skinsFor(heroId).find(s => s.rarity === 'default') || skinsFor(heroId)[0] || { id: heroId + '_default' }).id;
export const skinColor = (skin, hero) => (!skin || skin.rarity === 'default') ? (hero?.color || skin?.colors?.glow || '#888')
  : (skin.colors && (skin.colors.glow || skin.colors.accent || skin.colors.vfx || skin.colors.primary)) || hero?.color || '#888';

// ---------- prices ----------
export function heroPrice(h) {
  if (!h) return { essence: 0 };
  if (h.price) return h.price;
  if (h.unlock && typeof h.unlock.cost === 'number' && h.unlock.cost > 0) return { essence: h.unlock.cost, prisms: Math.round(h.unlock.cost / 8) };
  const d = Math.max(1, Math.min(3, h.difficulty || 2));
  const e = 2000 + (d - 1) * 750;
  return { essence: e, prisms: Math.round(e / 8) };
}
export const unlockCost = (x) => (x && x.unlock && x.unlock.cost) || 0;

// ---------- items helpers ----------
export function itemTierCount(item) { return (item?.tiers?.length || 0); }
/** steps: tier indices 0..n-1, then branch. Returns info about next purchase for a slot. */
export function nextItemStep(itemId, cur) {
  const it = ITEM_BY_ID[itemId];
  if (!it) return null;
  const nT = it.tiers?.length || 0;
  const tier = cur && cur.id === itemId ? (cur.tier || 0) : 0;
  if (cur && cur.branch) return { done: true, item: it };
  if (tier < nT) return { kind: 'tier', tier: tier + 1, cost: it.tiers[tier].cost || 0, item: it, icon: it.icon, name: it.name };
  if (it.branches && (it.branches.a || it.branches.b)) {
    return { kind: 'branch', item: it, a: it.branches.a, b: it.branches.b, cost: Math.min(it.branches.a?.cost ?? 1e9, it.branches.b?.cost ?? 1e9) };
  }
  return { done: true, item: it };
}
export function itemDisplay(cur) {
  if (!cur) return null;
  const it = ITEM_BY_ID[cur.id];
  if (!it) return { icon: '?', name: cur.id, src: null };
  if (cur.branch && it.branches?.[cur.branch]) return { icon: it.branches[cur.branch].icon || it.icon, name: it.branches[cur.branch].name, tier: 3, final: true, src: it.branches[cur.branch] };
  return { icon: it.icon, name: it.name + (cur.tier > 1 ? ' ' + 'I'.repeat(cur.tier) : ''), tier: cur.tier || 1, src: it };
}
export function fmtStats(stats) {
  if (!stats) return '';
  const N = { power: 'Power', maxHp: 'Max HP', armor: 'Armor', attackSpeed: 'Atk Speed', moveSpeed: 'Move Spd', haste: 'Haste', armorPen: 'Armor Pen', lifesteal: 'Lifesteal', hpRegen: 'HP Regen', attackRange: 'Range' };
  return Object.entries(stats).map(([k, v]) => {
    const pct = (k === 'armorPen' || k === 'lifesteal') || (k === 'attackSpeed' && v < 1);
    const val = pct ? Math.round(v * 100) + '%' : (Math.round(v * 10) / 10);
    return `+${val} ${N[k] || k}`;
  }).join(' · ');
}

/** Heuristic recommended loadout for a hero (used for defaults and bots). */
export function recommendedLoadout(hero) {
  const rec = hero?.recommended || hero?.bot?.loadout || hero?.loadout;
  const role = String(hero?.role || '').toLowerCase();
  const pref = { tank: ['defense', 'utility', 'defense'], support: ['utility', 'defense', 'utility'], controller: ['utility', 'offense', 'defense'],
    fighter: ['offense', 'defense', 'utility'], jungler: ['offense', 'defense', 'utility'], mage: ['offense', 'utility', 'offense'],
    marksman: ['offense', 'utility', 'offense'], assassin: ['offense', 'utility', 'offense'] }[role] || ['offense', 'defense', 'utility'];
  let items = (rec?.items || []).filter(id => ITEM_BY_ID[id]).slice(0, 3);
  for (const cat of pref) {
    if (items.length >= 3) break;
    const c = ITEMS.find(i => i.category === cat && !items.includes(i.id) && !unlockCost(i)) || ITEMS.find(i => i.category === cat && !items.includes(i.id));
    if (c) items.push(c.id);
  }
  for (const i of ITEMS) { if (items.length >= 3) break; if (!items.includes(i.id)) items.push(i.id); }
  const jungle = (hero?.bot?.preferredRole === 'jungle') || role === 'jungler';
  let relic = rec?.relic && RELIC_BY_ID[rec.relic] ? rec.relic : null;
  if (!relic) relic = (jungle && (RELICS.find(r => /hunt|smite|brand|jungle/i.test(r.id + r.name))?.id)) || (RELICS.find(r => !/hunt|smite|brand/i.test(r.id + r.name)) || RELICS[0])?.id || null;
  const sig = (slot) => (rec?.sigils?.[slot] && SIGIL_BY_ID[rec.sigils[slot]] ? rec.sigils[slot] : (SIGILS.find(s => s.slot === slot)?.id || null));
  return { items, relic, sigils: { offense: sig('offense'), utility: sig('utility') } };
}
