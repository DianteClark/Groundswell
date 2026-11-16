// Items. Owner: Agent A. Schema per SPEC.md.
// Each base item: tier1 → tier2 → branch a|b. Tier stats are TOTALS (not cumulative across tiers).
// Branch items carry a unique passive: { name, desc, hooks }.
const lowHp = (t, f) => t.hp < t.maxHp * f;

export const ITEMS = [
  // ---------------- starters ----------------
  { id: 'warblade', name: 'Warblade', icon: '⚔', category: 'offense', unlock: { cost: 0 },
    tiers: [{ cost: 450, stats: { power: 12 }, desc: '+12 Power' }, { cost: 750, stats: { power: 24, armorPen: 0.05 }, desc: '+24 Power, +5% Armor Pen' }],
    branches: {
      a: { id: 'bloodedge', name: 'Bloodedge', icon: '🩸', cost: 1100, stats: { power: 38, lifesteal: 0.12 }, desc: '+38 Power, +12% Lifesteal',
        passive: { name: 'Bloodthirst', desc: 'Lifesteal is doubled while below 40% HP.', hooks: {
          computeStats(api, h, s) { if (lowHp(h, 0.4)) s.lifesteal += 0.12; } } } },
      b: { id: 'rendblade', name: 'Rendblade', icon: '🗡', cost: 1100, stats: { power: 36, armorPen: 0.12 }, desc: '+36 Power, +12% Armor Pen',
        passive: { name: 'Rend', desc: 'Attacks shred 4 Armor for 3s (stacks 5×).', hooks: {
          onAttackHit(api, h, t) { if (t.kind !== 'hero' && t.kind !== 'monster') return; const st = api.marked(t, 'armorShred', h.id); const n = Math.min(5, (st?.stacks || 0) + 1); api.status(t, 'armorShred', 3, { sourceId: h.id, amount: 4 * n, stacks: n }); } } } },
    } },
  { id: 'bulwark', name: 'Bulwark', icon: '🛡', category: 'defense', unlock: { cost: 0 },
    tiers: [{ cost: 450, stats: { armor: 12, maxHp: 90 }, desc: '+12 Armor, +90 HP' }, { cost: 750, stats: { armor: 24, maxHp: 180 }, desc: '+24 Armor, +180 HP' }],
    branches: {
      a: { id: 'thornplate', name: 'Thornplate', icon: '🌵', cost: 1100, stats: { armor: 45, maxHp: 260 }, desc: '+45 Armor, +260 HP',
        passive: { name: 'Thorns', desc: 'Champions who attack you take 10 + 15% of the damage back.', hooks: {
          onDamageTaken(api, h, src, info) { if (src && src.kind === 'hero' && info.type === 'auto' && src.team !== h.team) api.damage(h, src, 10 + info.amount * 0.15, { type: 'item', ability: 'thornplate', noHooks: true }); } } } },
      b: { id: 'lifeguard', name: 'Lifeguard', icon: '💚', cost: 1100, stats: { armor: 28, maxHp: 450, hpRegen: 6 }, desc: '+28 Armor, +450 HP, +6 HP Regen',
        passive: { name: 'Second Breath', desc: 'Out of combat for 5s: triple HP regen.', hooks: {
          computeStats(api, h, s) { if (!api.inCombat(h, 5)) s.hpRegen *= 3; } } } },
    } },
  { id: 'swiftboots', name: 'Swift Boots', icon: '👢', category: 'utility', unlock: { cost: 0 },
    tiers: [{ cost: 350, stats: { moveSpeed: 0.8 }, desc: '+0.8 Move Speed' }, { cost: 600, stats: { moveSpeed: 1.2, attackSpeed: 0.1 }, desc: '+1.2 Move Speed, +0.1 Attack Speed' }],
    branches: {
      a: { id: 'stormstriders', name: 'Stormstriders', icon: '⚡', cost: 1000, stats: { moveSpeed: 1.6, attackSpeed: 0.25 }, desc: '+1.6 Move Speed, +0.25 Attack Speed',
        passive: { name: 'Static Rush', desc: 'Hitting a champion grants 15% Move Speed for 1.5s.', hooks: {
          onAttackHit(api, h, t) { if (t.kind === 'hero') api.speed(h, 0.15, 1.5, 'stormstriders'); } } } },
      b: { id: 'sagesteps', name: 'Sage Steps', icon: '📿', cost: 1000, stats: { moveSpeed: 1.6, haste: 15 }, desc: '+1.6 Move Speed, +15 Haste',
        passive: { name: 'Flow', desc: 'Ability damage to a champion grants 20% Move Speed for 1s.', hooks: {
          onDamageDealt(api, h, t, info) { if (t.kind === 'hero' && info.type === 'ability') api.speed(h, 0.2, 1, 'sagesteps'); } } } },
    } },
  { id: 'runestaff', name: 'Runestaff', icon: '🔮', category: 'offense', unlock: { cost: 0 },
    tiers: [{ cost: 450, stats: { power: 10, haste: 5 }, desc: '+10 Power, +5 Haste' }, { cost: 750, stats: { power: 20, haste: 10 }, desc: '+20 Power, +10 Haste' }],
    branches: {
      a: { id: 'stormcaller', name: 'Stormcaller', icon: '🌩', cost: 1100, stats: { power: 34, haste: 15 }, desc: '+34 Power, +15 Haste',
        passive: { name: 'Overcharge', desc: 'Ability hits on champions deal 8% bonus damage.', hooks: {
          modifyDamageDealt(api, h, t, info) { if (info.type === 'ability' && t.kind === 'hero') info.amount *= 1.08; } } } },
      b: { id: 'timeweaver', name: 'Timeweaver', icon: '⏳', cost: 1100, stats: { power: 26, haste: 25 }, desc: '+26 Power, +25 Haste',
        passive: { name: 'Rewind', desc: 'Champion takedowns reduce Q and W cooldowns by 3s.', hooks: {
          onKill(api, h, t) { if (t.kind === 'hero') { api.reduceCooldown(h, 'q', 3); api.reduceCooldown(h, 'w', 3); } } } } },
    } },
  { id: 'heartwood', name: 'Heartwood', icon: '🌳', category: 'defense', unlock: { cost: 0 },
    tiers: [{ cost: 400, stats: { maxHp: 160 }, desc: '+160 HP' }, { cost: 700, stats: { maxHp: 320, hpRegen: 3 }, desc: '+320 HP, +3 HP Regen' }],
    branches: {
      a: { id: 'giantheart', name: 'Giant\'s Heart', icon: '❤', cost: 1100, stats: { maxHp: 600, hpRegen: 4 }, desc: '+600 HP, +4 HP Regen',
        passive: { name: 'Mighty', desc: 'Gain Power equal to 1.5% of your max HP.', hooks: {
          computeStats(api, h, s) { s.power += s.maxHp * 0.015; } } } },
      b: { id: 'everbloom', name: 'Everbloom', icon: '🌸', cost: 1100, stats: { maxHp: 420, hpRegen: 8 }, desc: '+420 HP, +8 HP Regen',
        passive: { name: 'Bloom', desc: 'Below 40% HP, regenerate an extra 1.5% max HP per second.', hooks: {
          computeStats(api, h, s) { if (lowHp(h, 0.4)) s.hpRegen += h.maxHp * 0.015; } } } },
    } },
  { id: 'gale_bow', name: 'Gale Bow', icon: '🏹', category: 'offense', unlock: { cost: 0 },
    tiers: [{ cost: 450, stats: { attackSpeed: 0.15 }, desc: '+0.15 Attack Speed' }, { cost: 750, stats: { attackSpeed: 0.25, power: 8 }, desc: '+0.25 Attack Speed, +8 Power' }],
    branches: {
      a: { id: 'stormbow', name: 'Stormbow', icon: '🌪', cost: 1100, stats: { attackSpeed: 0.38, power: 14 }, desc: '+0.38 Attack Speed, +14 Power',
        passive: { name: 'Thunderclap', desc: 'Every 3rd attack deals 25 (+4/lvl) bonus damage.', hooks: {
          modifyAutoAttack(api, h, t, info) { h.data._storm = (h.data._storm || 0) + 1; if (h.data._storm >= 3) { h.data._storm = 0; info.amount += 25 + 4 * (h.level - 1); api.vfx('item_stormbow', { x: t.x, y: t.y, targetId: t.id, team: h.team }); } } } } },
      b: { id: 'longstrider', name: 'Longstrider', icon: '🎯', cost: 1100, stats: { attackSpeed: 0.32, power: 12, moveSpeed: 0.5 }, desc: '+0.32 Attack Speed, +12 Power, +0.5 Move Speed',
        passive: { name: 'Far Sight', desc: 'Ranged champions gain +1.5 attack range.', hooks: {
          computeStats(api, h, s) { if (h.def.ranged) s.attackRange += 1.5; } } } },
    } },
  // ---------------- unlockables ----------------
  { id: 'reaper_scythe', name: 'Reaper\'s Scythe', icon: '🌙', category: 'offense', unlock: { cost: 400 },
    tiers: [{ cost: 450, stats: { power: 14 }, desc: '+14 Power' }, { cost: 750, stats: { power: 26, armorPen: 0.06 }, desc: '+26 Power, +6% Armor Pen' }],
    branches: {
      a: { id: 'executioner', name: 'Executioner', icon: '🪓', cost: 1100, stats: { power: 40, armorPen: 0.1 }, desc: '+40 Power, +10% Armor Pen',
        passive: { name: 'Cull', desc: 'Deal 15% more damage to champions below 35% HP.', hooks: {
          modifyDamageDealt(api, h, t, info) { if (t.kind === 'hero' && lowHp(t, 0.35)) info.amount *= 1.15; } } } },
      b: { id: 'harvester', name: 'Harvester', icon: '🌾', cost: 1100, stats: { power: 38, lifesteal: 0.06 }, desc: '+38 Power, +6% Lifesteal',
        passive: { name: 'Reap', desc: 'Champion takedowns restore 15% max HP.', hooks: {
          onKill(api, h, t) { if (t.kind === 'hero') api.heal(h, h.maxHp * 0.15, h); } } } },
    } },
  { id: 'aegis_banner', name: 'Aegis Banner', icon: '🚩', category: 'defense', unlock: { cost: 500 },
    tiers: [{ cost: 450, stats: { armor: 10, haste: 5, maxHp: 60 }, desc: '+10 Armor, +5 Haste, +60 HP' }, { cost: 750, stats: { armor: 20, haste: 10, maxHp: 140 }, desc: '+20 Armor, +10 Haste, +140 HP' }],
    branches: {
      a: { id: 'warbanner', name: 'Warbanner', icon: '🏳', cost: 1100, stats: { armor: 32, maxHp: 220, haste: 15 }, desc: '+32 Armor, +220 HP, +15 Haste',
        passive: { name: 'Rally', desc: 'Allied champions within 10m gain +10 Armor.', hooks: {
          onTick(api, h) { if (api.m.tickCount % 10 !== 0) return; for (const a of api.allyHeroesInRadius(h, h.x, h.y, 10)) if (a !== h) api.mod(a, { duration: 0.5, add: { armor: 10 }, tag: 'warbanner' }); } } } },
      b: { id: 'sentinel_plate', name: 'Sentinel Plate', icon: '🗿', cost: 1100, stats: { armor: 30, maxHp: 260, haste: 15 }, desc: '+30 Armor, +260 HP, +15 Haste',
        passive: { name: 'Vigil', desc: 'Crowd-controlling a champion grants a 60 (+12/lvl) shield (6s cd).', hooks: {
          onApplyCC(api, h, t) { if (t.kind !== 'hero' || (h.data._sentAt || -99) + 6 > api.time) return; h.data._sentAt = api.time; api.shield(h, 60 + 12 * (h.level - 1), 3, 'sentinel', h); } } } },
    } },
  { id: 'veilcloak', name: 'Veilcloak', icon: '🧥', category: 'defense', unlock: { cost: 600 },
    tiers: [{ cost: 450, stats: { maxHp: 120, armor: 8 }, desc: '+120 HP, +8 Armor' }, { cost: 750, stats: { maxHp: 220, armor: 16 }, desc: '+220 HP, +16 Armor' }],
    branches: {
      a: { id: 'nullveil', name: 'Nullveil', icon: '🫧', cost: 1100, stats: { maxHp: 300, armor: 24 }, desc: '+300 HP, +24 Armor',
        passive: { name: 'Spellbreak', desc: 'Blocks the next enemy champion ability hit (30s cd).', hooks: {
          modifyDamageTaken(api, h, src, info) { if (info.type !== 'ability' || !src || src.kind !== 'hero' || (h.data._nullAt || -99) + 30 > api.time) return; h.data._nullAt = api.time; info.amount = 0; api.vfx('item_nullveil', { x: h.x, y: h.y, targetId: h.id, team: h.team }); },
          onTick(api, h) { if ((h.data._nullAt || -99) + 30 <= api.time) api.setBuff(h, 'nullveil', 0.2); } } } },
      b: { id: 'quicksilver', name: 'Quicksilver Mantle', icon: '🪞', cost: 1100, stats: { maxHp: 280, armor: 22, moveSpeed: 0.5 }, desc: '+280 HP, +22 Armor, +0.5 Move Speed',
        passive: { name: 'Slippery', desc: '+25% Tenacity (crowd control durations reduced).', hooks: {
          computeStats(api, h, s) { s.tenacity = (s.tenacity || 0) + 0.25; } } } },
    } },
  { id: 'emberbrand', name: 'Emberbrand', icon: '🔥', category: 'offense', unlock: { cost: 700 },
    tiers: [{ cost: 450, stats: { power: 8, attackSpeed: 0.1 }, desc: '+8 Power, +0.1 Attack Speed' }, { cost: 750, stats: { power: 16, attackSpeed: 0.18 }, desc: '+16 Power, +0.18 Attack Speed' }],
    branches: {
      a: { id: 'sunfire_edge', name: 'Sunfire Edge', icon: '☀', cost: 1100, stats: { power: 28, attackSpeed: 0.25 }, desc: '+28 Power, +0.25 Attack Speed',
        passive: { name: 'Sear', desc: 'Attacks deal bonus damage equal to 2.5% of the target\'s max HP (max 80 vs monsters).', hooks: {
          modifyAutoAttack(api, h, t, info) { const b = t.maxHp * 0.025; info.amount += t.kind === 'monster' ? Math.min(80, b) : b; } } } },
      b: { id: 'phantom_edge', name: 'Phantom Edge', icon: '👻', cost: 1100, stats: { power: 22, attackSpeed: 0.32, moveSpeed: 0.6 }, desc: '+22 Power, +0.32 Attack Speed, +0.6 Move Speed',
        passive: { name: 'Fleetfoot', desc: 'Attacks grant 6% Move Speed for 1.5s (stacks 3×).', hooks: {
          onAttackHit(api, h) { const d = h.data; d._ph = (api.time - (d._phAt || -9) < 1.5) ? Math.min(3, (d._ph || 0) + 1) : 1; d._phAt = api.time; api.speed(h, 0.06 * d._ph, 1.5, 'phantom_edge'); } } } },
    } },
  { id: 'stoneguard', name: 'Stoneguard', icon: '🪨', category: 'defense', unlock: { cost: 800 },
    tiers: [{ cost: 450, stats: { armor: 16, maxHp: 50 }, desc: '+16 Armor, +50 HP' }, { cost: 750, stats: { armor: 30, maxHp: 120 }, desc: '+30 Armor, +120 HP' }],
    branches: {
      a: { id: 'frostguard', name: 'Frostguard', icon: '❄', cost: 1100, stats: { armor: 48, maxHp: 200 }, desc: '+48 Armor, +200 HP',
        passive: { name: 'Numbing Cold', desc: 'Champions that attack you have 15% less Attack Speed for 2s.', hooks: {
          onDamageTaken(api, h, src, info) { if (src && src.kind === 'hero' && info.type === 'auto') api.mod(src, { duration: 2, mul: { attackSpeed: 0.85 }, tag: 'frostguard' }); } } } },
      b: { id: 'colossus_plate', name: 'Colossus Plate', icon: '🗻', cost: 1100, stats: { armor: 38, maxHp: 340 }, desc: '+38 Armor, +340 HP',
        passive: { name: 'Unyielding', desc: 'Take 8% less damage from champions.', hooks: {
          modifyDamageTaken(api, h, src, info) { if (src && src.kind === 'hero') info.amount *= 0.92; } } } },
    } },
  { id: 'mendcharm', name: 'Mendcharm', icon: '🧿', category: 'utility', unlock: { cost: 900 },
    tiers: [{ cost: 400, stats: { power: 8, haste: 5, hpRegen: 1.5 }, desc: '+8 Power, +5 Haste, +1.5 HP Regen' }, { cost: 700, stats: { power: 14, haste: 10, hpRegen: 2.5, maxHp: 100 }, desc: '+14 Power, +10 Haste, +2.5 Regen, +100 HP' }],
    branches: {
      a: { id: 'lifebloom', name: 'Lifebloom Censer', icon: '🏺', cost: 1100, stats: { power: 20, haste: 20, maxHp: 150 }, desc: '+20 Power, +20 Haste, +150 HP',
        passive: { name: 'Blessing', desc: 'Your heals and shields are 20% stronger.', hooks: {
          modifyHeal(api, h, t, info) { info.amount *= 1.2; } } } },
      b: { id: 'windspur', name: 'Windspur', icon: '🪁', cost: 1100, stats: { power: 18, haste: 20, moveSpeed: 0.6, maxHp: 120 }, desc: '+18 Power, +20 Haste, +0.6 Move Speed, +120 HP',
        passive: { name: 'Tailwind', desc: 'Healing or shielding an ally grants them 20% Move Speed and 0.15 Attack Speed for 2s.', hooks: {
          onHealAlly(api, h, t) { api.speed(t, 0.2, 2, 'windspur'); api.mod(t, { duration: 2, add: { attackSpeed: 0.15 }, tag: 'windspur' }); } } } },
    } },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
// also index branch ids → base item (for UI lookups)
export const BRANCH_BY_ID = {};
for (const it of ITEMS) for (const k of ['a', 'b']) BRANCH_BY_ID[it.branches[k].id] = { item: it, branch: k, def: it.branches[k] };
