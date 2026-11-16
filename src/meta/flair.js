// Profile flair catalog: titles, banners, borders, icons, emotes.
// source: {type:'starter'} | {type:'shop', price:{essence|prisms}} | {type:'achievement', stat, gte, desc}
//         | {type:'ladder', rank} | {type:'level', level} | {type:'mastery', heroId?, level} | {type:'season', tier}
import { HEROES } from './registry.js';

const shop = (essence, prisms) => ({ type: 'shop', price: prisms ? { prisms } : { essence } });
const ach = (stat, gte, desc) => ({ type: 'achievement', stat, gte, desc });

export const TITLES = [
  { id: 't_rookie', name: 'Swell Rookie', rarity: 'common', source: { type: 'starter' } },
  { id: 't_firstwin', name: 'First of Many', rarity: 'common', source: ach('wins', 1, 'Win your first match') },
  { id: 't_veteran', name: 'Veteran of the Vale', rarity: 'rare', source: ach('games', 50, 'Play 50 matches') },
  { id: 't_centurion', name: 'Centurion', rarity: 'legendary', source: ach('wins', 100, 'Win 100 matches') },
  { id: 't_wyrmslayer', name: 'Wyrmslayer', rarity: 'epic', source: ach('wyrms', 10, 'Take 10 Wyrms') },
  { id: 't_colossus', name: 'Colossus Breaker', rarity: 'epic', source: ach('colossus', 5, 'Defeat 5 Colossi') },
  { id: 't_toppler', name: 'Groundbreaker', rarity: 'rare', source: ach('towers', 40, 'Destroy 40 towers') },
  { id: 't_unbroken', name: 'The Unbroken', rarity: 'epic', source: ach('perfectGames', 1, 'Win without dying') },
  { id: 't_rampage', name: 'Rampager', rarity: 'rare', source: ach('bestKills', 10, 'Get 10 kills in one match') },
  { id: 't_angel', name: 'Guardian Angel', rarity: 'rare', source: ach('bestAssists', 15, 'Get 15 assists in one match') },
  { id: 't_harvest', name: 'Grim Harvester', rarity: 'rare', source: ach('bestCs', 120, 'Get 120 last hits in one match') },
  { id: 't_botbane', name: 'Bot Bane', rarity: 'legendary', source: ach('mythicWins', 1, 'Win on Mythic difficulty') },
  { id: 't_seasoned', name: 'Seasoned', rarity: 'common', source: { type: 'level', level: 10 } },
  { id: 't_riftwalker', name: 'Swellborn', rarity: 'epic', source: { type: 'level', level: 25 } },
  { id: 't_silver', name: 'Silver Contender', rarity: 'common', source: { type: 'ladder', rank: 1 } },
  { id: 't_gold', name: 'Gold Vanguard', rarity: 'rare', source: { type: 'ladder', rank: 2 } },
  { id: 't_plat', name: 'Platinum Warden', rarity: 'rare', source: { type: 'ladder', rank: 3 } },
  { id: 't_diamond', name: 'Diamond Ace', rarity: 'epic', source: { type: 'ladder', rank: 4 } },
  { id: 't_master', name: 'Master Tactician', rarity: 'epic', source: { type: 'ladder', rank: 5 } },
  { id: 't_mythic', name: 'Mythic Ascendant', rarity: 'legendary', source: { type: 'ladder', rank: 6 } },
  { id: 't_s1', name: 'Season One Vanguard', rarity: 'legendary', source: { type: 'season', tier: 30 } },
  { id: 't_tide', name: 'Rider of the Swell', rarity: 'rare', source: ach('wins', 25, 'Win 25 matches') },
  { id: 't_quake', name: 'Quakewalker', rarity: 'epic', source: ach('colossus', 15, 'Defeat 15 Colossi') },
  { id: 't_owl', name: 'Night Owl', rarity: 'common', source: shop(600) },
  { id: 't_unshaken', name: 'The Unshaken', rarity: 'rare', source: shop(1200) },
  { id: 't_starborn', name: 'Starborn', rarity: 'epic', source: shop(0, 150) },
  { id: 't_storm', name: 'Stormcaller', rarity: 'epic', source: shop(0, 150) },
  { id: 't_glitch', name: 'Glitch in the Swell', rarity: 'legendary', source: shop(0, 400) },
  { id: 't_void', name: 'Chosen of the Void', rarity: 'legendary', source: { type: 'season', tier: 25 } },
  ...HEROES.map(h => ({ id: 't_m_' + h.id, name: `${h.name}'s Chosen`, rarity: 'epic', source: { type: 'mastery', heroId: h.id, level: 5 } })),
];

// banners: css = background value
export const BANNERS = [
  { id: 'b_dusk', name: 'Duskfall', rarity: 'common', source: { type: 'starter' }, css: 'linear-gradient(135deg,#1d2440 0%,#3a2a5c 60%,#5b3a6e 100%)' },
  { id: 'b_azure', name: 'Azure Tide', rarity: 'common', source: shop(500), css: 'linear-gradient(160deg,#08304f,#0c6a8c 55%,#3fd0e0)' },
  { id: 'b_ember', name: 'Ember Forge', rarity: 'common', source: shop(500), css: 'radial-gradient(120% 90% at 20% 110%,#ffb04a 0%,#c4361b 35%,#2a0e12 80%)' },
  { id: 'b_grove', name: 'Verdant Grove', rarity: 'common', source: { type: 'level', level: 5 }, css: 'linear-gradient(150deg,#0e2a1c,#1e6b3f 60%,#9be36b)' },
  { id: 'b_circuit', name: 'Faultline Circuit', rarity: 'rare', source: shop(1000), css: 'repeating-linear-gradient(90deg,rgba(80,220,255,.12) 0 2px,transparent 2px 22px),repeating-linear-gradient(0deg,rgba(80,220,255,.12) 0 2px,transparent 2px 22px),linear-gradient(135deg,#071420,#0b2e4a)' },
  { id: 'b_frost', name: 'Frost Sigil', rarity: 'rare', source: { type: 'season', tier: 6 }, css: 'radial-gradient(circle at 75% 30%,rgba(255,255,255,.55) 0 2px,transparent 3px),radial-gradient(circle at 30% 70%,rgba(255,255,255,.4) 0 1.5px,transparent 3px),linear-gradient(140deg,#16314f,#4b8cc8 60%,#cfeaff)' },
  { id: 'b_crimson', name: 'Crimson Pact', rarity: 'rare', source: ach('kills', 100, 'Get 100 total kills'), css: 'repeating-linear-gradient(45deg,rgba(0,0,0,.18) 0 8px,transparent 8px 16px),linear-gradient(120deg,#3b0610,#9b1530 60%,#ff4d5e)' },
  { id: 'b_scales', name: 'Wyrmscale', rarity: 'epic', source: ach('wyrms', 5, 'Take 5 Wyrms'), css: 'radial-gradient(circle at 50% 0,rgba(255,255,255,.18) 0 30%,transparent 31%) 0 0/24px 16px,linear-gradient(140deg,#0d3b2e,#1f8a6a 50%,#e7d27a)' },
  { id: 'b_starfield', name: 'Starfield', rarity: 'epic', source: shop(0, 200), anim: 'drift', css: 'radial-gradient(circle,rgba(255,255,255,.9) 0 1px,transparent 1.5px) 0 0/31px 29px,radial-gradient(circle,rgba(190,170,255,.8) 0 1px,transparent 1.5px) 11px 7px/47px 41px,linear-gradient(160deg,#060818,#1a1446 60%,#40206e)' },
  { id: 'b_void', name: 'Void Fissure', rarity: 'epic', source: { type: 'season', tier: 15 }, anim: 'shift', css: 'linear-gradient(115deg,#0a0016,#3a0b7a,#7a3cff,#14002e,#3a0b7a)' },
  { id: 'b_aurora', name: 'Aurora Crown', rarity: 'legendary', source: shop(0, 450), anim: 'shift', css: 'linear-gradient(120deg,#062a3a,#0fb38f,#6a5cff,#d85cff,#0fb38f,#062a3a)' },
  { id: 'b_sunforged', name: 'Sunforged', rarity: 'legendary', source: { type: 'ladder', rank: 6 }, anim: 'shift', css: 'linear-gradient(120deg,#3a1d00,#c27a0a,#ffe08a,#ffb31a,#7a3d00)' },
  { id: 'b_mastery', name: 'Ascendant Laurels', rarity: 'legendary', source: { type: 'mastery', level: 7 }, anim: 'shift', css: 'linear-gradient(120deg,#20123a,#8a5cff,#ffd36a,#8a5cff,#20123a)' },
];

// borders: ring = css background of ring; anim: spin|pulse
export const BORDERS = [
  { id: 'r_plain', name: 'Plain Steel', rarity: 'common', source: { type: 'starter' }, ring: 'linear-gradient(135deg,#8a96ad,#3d465a)' },
  { id: 'r_bronze', name: 'Bronze Band', rarity: 'common', source: { type: 'ladder', rank: 0 }, ring: 'linear-gradient(135deg,#e0a46b,#7a4a22)' },
  { id: 'r_silver', name: 'Silver Band', rarity: 'common', source: { type: 'ladder', rank: 1 }, ring: 'linear-gradient(135deg,#f2f6ff,#7d8aa3)' },
  { id: 'r_gold', name: 'Gold Band', rarity: 'rare', source: { type: 'ladder', rank: 2 }, ring: 'linear-gradient(135deg,#fff1a8,#c48a14)' },
  { id: 'r_diamond', name: 'Diamond Facet', rarity: 'epic', source: { type: 'ladder', rank: 4 }, anim: 'pulse', ring: 'conic-gradient(#bff6ff,#4fb7ff,#e9f9ff,#7d6bff,#bff6ff)' },
  { id: 'r_arcane', name: 'Arcane Loop', rarity: 'epic', source: shop(0, 180), anim: 'spin', ring: 'conic-gradient(#b46cff,#3a1a6e,#b46cff,#ff7bf2,#b46cff)' },
  { id: 'r_tide', name: 'Tidecaller', rarity: 'rare', source: shop(1500), ring: 'linear-gradient(135deg,#7ff0ff,#0b5b8a)' },
  { id: 'r_ember', name: 'Emberwreath', rarity: 'legendary', source: shop(0, 420), anim: 'spin', ring: 'conic-gradient(#ffdf6b,#ff5a1f,#7a0f00,#ff8a2a,#ffdf6b)' },
  { id: 'r_mythic', name: 'Mythic Prism', rarity: 'legendary', source: { type: 'ladder', rank: 6 }, anim: 'spin', ring: 'conic-gradient(#ff5f6d,#ffc371,#47ff9a,#3ab6ff,#b46cff,#ff5f6d)' },
  { id: 'r_season', name: 'Season Laurel', rarity: 'epic', source: { type: 'season', tier: 20 }, anim: 'pulse', ring: 'conic-gradient(#9cffd0,#1aa37a,#9cffd0,#e8ffd0,#9cffd0)' },
  { id: 'r_m4', name: 'Mastery Crest', rarity: 'rare', source: { type: 'mastery', level: 4 }, ring: 'linear-gradient(135deg,#d9b6ff,#5a2fa0)' },
  { id: 'r_m7', name: 'Ascendant Crown', rarity: 'legendary', source: { type: 'mastery', level: 7 }, anim: 'spin', ring: 'conic-gradient(#fff3b0,#ffb800,#fff3b0,#b46cff,#fff3b0)' },
];

export const ICONS = [
  { id: 'i_blade', name: 'Swell Blade', rarity: 'common', source: { type: 'starter' }, glyph: '⚔️', bg: 'radial-gradient(circle at 35% 30%,#4a5a8a,#151a2e)' },
  { id: 'i_shield', name: 'Bulwark', rarity: 'common', source: { type: 'starter' }, glyph: '🛡️', bg: 'radial-gradient(circle at 35% 30%,#3a6a5a,#0f1e1a)' },
  { id: 'i_moon', name: 'Crescent', rarity: 'common', source: shop(400), glyph: '🌙', bg: 'radial-gradient(circle at 35% 30%,#3b3f7a,#0b0c22)' },
  { id: 'i_fox', name: 'Vale Fox', rarity: 'common', source: shop(400), glyph: '🦊', bg: 'radial-gradient(circle at 35% 30%,#a8552a,#2a1208)' },
  { id: 'i_wolf', name: 'Howl', rarity: 'common', source: { type: 'level', level: 3 }, glyph: '🐺', bg: 'radial-gradient(circle at 35% 30%,#5a6680,#141822)' },
  { id: 'i_bolt', name: 'Overcharge', rarity: 'rare', source: shop(900), glyph: '⚡', bg: 'radial-gradient(circle at 35% 30%,#3a7aff,#0a1440)' },
  { id: 'i_mush', name: 'Bogcap', rarity: 'rare', source: { type: 'season', tier: 3 }, glyph: '🍄', bg: 'radial-gradient(circle at 35% 30%,#4a8c5c,#0e2416)' },
  { id: 'i_robot', name: 'Bot Buster', rarity: 'rare', source: ach('wins', 10, 'Win 10 matches'), glyph: '🤖', bg: 'radial-gradient(circle at 35% 30%,#5a6a7a,#12181e)' },
  { id: 'i_skull', name: 'Deathmark', rarity: 'rare', source: ach('kills', 50, 'Get 50 total kills'), glyph: '💀', bg: 'radial-gradient(circle at 35% 30%,#6a2030,#16060a)' },
  { id: 'i_dragon', name: 'Wyrm Sigil', rarity: 'epic', source: ach('wyrms', 3, 'Take 3 Wyrms'), glyph: '🐉', bg: 'radial-gradient(circle at 35% 30%,#1f8a6a,#062018)' },
  { id: 'i_comet', name: 'Comet', rarity: 'epic', source: shop(0, 120), glyph: '☄️', bg: 'radial-gradient(circle at 35% 30%,#ff7a3a,#2a0a1a)' },
  { id: 'i_planet', name: 'Far World', rarity: 'epic', source: { type: 'season', tier: 12 }, glyph: '🪐', bg: 'radial-gradient(circle at 35% 30%,#8a5cff,#120830)' },
  { id: 'i_gem', name: 'Prism Heart', rarity: 'epic', source: { type: 'level', level: 15 }, glyph: '💎', bg: 'radial-gradient(circle at 35% 30%,#3ad0ff,#081a3a)' },
  { id: 'i_crown', name: 'Tremor Crown', rarity: 'legendary', source: shop(0, 380), glyph: '👑', bg: 'radial-gradient(circle at 35% 30%,#ffcf4a,#3a2200)' },
  { id: 'i_phoenix', name: 'Rebirth', rarity: 'legendary', source: { type: 'season', tier: 30 }, glyph: '🔥', bg: 'radial-gradient(circle at 35% 30%,#ffb03a,#5a0a00)' },
  ...HEROES.map(h => ({ id: 'i_h_' + h.id, name: h.name + ' Emblem', rarity: 'rare', heroId: h.id, source: { type: 'mastery', heroId: h.id, level: 2 },
    glyph: (h.name || h.id)[0].toUpperCase(), bg: `radial-gradient(circle at 35% 30%,${h.color || '#888'},#0b0d18)` })),
];

export const EMOTES = [
  { id: 'e_gg', name: 'GG', rarity: 'common', source: { type: 'starter' }, glyph: '🤝', text: 'GG!' },
  { id: 'e_salute', name: 'Salute', rarity: 'common', source: { type: 'starter' }, glyph: '🫡', text: 'o7' },
  { id: 'e_fire', name: 'On Fire', rarity: 'common', source: shop(300), glyph: '🔥', text: 'Too hot!' },
  { id: 'e_lol', name: 'Laugh', rarity: 'common', source: shop(300), glyph: '😂', text: 'LOL' },
  { id: 'e_cool', name: 'Shades', rarity: 'rare', source: { type: 'season', tier: 9 }, glyph: '😎', text: 'Easy.' },
  { id: 'e_skull', name: 'Respects', rarity: 'rare', source: shop(800), glyph: '💀', text: 'F' },
  { id: 'e_crown', name: 'Royalty', rarity: 'epic', source: shop(0, 100), glyph: '👑', text: 'Kneel.' },
  { id: 'e_dragon', name: 'Wyrm Roar', rarity: 'legendary', source: { type: 'season', tier: 27 }, glyph: '🐲', text: 'RAWR' },
];

export const FLAIR_KINDS = { title: TITLES, banner: BANNERS, border: BORDERS, icon: ICONS, emote: EMOTES };
export const FLAIR_LABEL = { title: 'Titles', banner: 'Banners', border: 'Borders', icon: 'Icons', emote: 'Emotes' };
const ALL = {};
for (const [k, list] of Object.entries(FLAIR_KINDS)) for (const f of list) { f.kind = k; ALL[f.id] = f; }
export const FLAIR_BY_ID = ALL;
export const flair = (id) => ALL[id] || null;
export const DEFAULT_FLAIR = { title: 't_rookie', banner: 'b_dusk', border: 'r_plain', icon: 'i_blade', emote: 'e_gg' };

export function sourceText(f) {
  const s = f?.source || {};
  switch (s.type) {
    case 'starter': return 'Starter';
    case 'shop': return 'Shop';
    case 'achievement': return s.desc || 'Achievement';
    case 'ladder': return `Reach ${['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Mythic'][s.rank] || 'rank'} in Bot Ladder`;
    case 'level': return `Reach account level ${s.level}`;
    case 'mastery': return s.heroId ? `Mastery ${s.level} with ${(HEROES.find(h => h.id === s.heroId) || {}).name || s.heroId}` : `Mastery ${s.level} with any hero`;
    case 'season': return `Season track tier ${s.tier}`;
    default: return '';
  }
}
