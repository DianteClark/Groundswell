export const TICK_RATE = 60;
/** Ticks in `sec` seconds (>=1). Use for every periodic `tickCount % N` check. */
export const ticks = (sec) => Math.max(1, Math.round(sec * TICK_RATE));
export const DT = 1 / TICK_RATE;
export const MAP_W = 240, MAP_H = 160;
export const MAX_LEVEL = 12;
export const ULT_LEVEL = 5;
export const AUGMENT_LEVELS = [3, 6, 9];
// cumulative xp required to reach level index+1
export const XP_TABLE = [0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580];
export const START_GOLD = 500;
export const PASSIVE_GOLD = 2.9;            // per second after first wave (3.0: +15%)
export const ECON = 1.15;                   // 3.0 pacing: gold/xp multiplier on kills & objectives
export const FOUNTAIN_RADIUS = 13;
export const RECALL_TIME = 8;
export const MIGHT_RECALL_TIME = 4;
export const XP_SHARE_RADIUS = 26;
export const ASSIST_WINDOW = 10;

export const GOLD = { heroKill: 345, assist: 138, firstBlood: 115, tower: 175, melee: 24, caster: 17, siege: 58 };

export const MINION = {
  melee: { maxHp: 420, power: 13, armor: 8, attackRange: 2.2, attackSpeed: 1.0, moveSpeed: 7.5, radius: 0.8, xp: 67, gold: GOLD.melee },
  caster: { maxHp: 280, power: 22, armor: 0, attackRange: 10, attackSpeed: 0.75, moveSpeed: 7.5, radius: 0.7, xp: 35, gold: GOLD.caster, projectile: 'caster_shot' },
  siege: { maxHp: 850, power: 42, armor: 20, attackRange: 12, attackSpeed: 0.5, moveSpeed: 7, radius: 1.2, xp: 106, gold: GOLD.siege, projectile: 'siege_shot' },
};
export const WAVE_FIRST = 15, WAVE_INTERVAL = 25;

export const TOWER = { power: 155, armor: 40, attackRange: 14.5, attackSpeed: 0.85, radius: 2.4 };

export const MONSTER = {
  camp_small: { maxHp: 760, power: 23, armor: 15, attackRange: 2.5, attackSpeed: 0.8, moveSpeed: 9, radius: 1.4, gold: 75, xp: 144, respawn: 90 },
  camp_big: { maxHp: 1360, power: 34, armor: 22, attackRange: 3, attackSpeed: 0.7, moveSpeed: 9, radius: 2.0, gold: 126, xp: 242, respawn: 120 },
  wyrm: { maxHp: 3600, power: 75, armor: 35, attackRange: 9, attackSpeed: 0.6, moveSpeed: 8, radius: 3.6, gold: 0, xp: 345, respawn: 180 },
  colossus: { maxHp: 9000, power: 125, armor: 60, attackRange: 6, attackSpeed: 0.5, moveSpeed: 7, radius: 4.5, gold: 0, xp: 690, respawn: 240 },
};
export const WYRM_FIRST = 180, COLOSSUS_FIRST = 480;
export const FINAL_SWELL_AT = 840, FINAL_SWELL_WARN = 10;   // 14:00, 10s telegraph
export const FINAL_SWELL_ZONE = { x: 120, y: 80, r: 200 };
export const SIEGE_EVERY = 2;               // siege minion every Nth wave
export const ELEMENTS = ['ember', 'tide', 'gale', 'stone'];
export const ELEMENT_INFO = {
  ember: { name: 'Ember Wyrm', buff: '+8% Power', soul: 'Ember Soul: abilities scorch for 8% bonus damage' },
  tide: { name: 'Tide Wyrm', buff: '+4 HP regen/s', soul: 'Tide Soul: heal 6% max HP after dealing champion damage (4s cd)' },
  gale: { name: 'Gale Wyrm', buff: '+6% Move Speed', soul: 'Gale Soul: +25% move speed out of combat' },
  stone: { name: 'Stone Wyrm', buff: '+10% Armor', soul: 'Stone Soul: gain a shield of 12% max HP every 15s' },
};
export const MIGHT_DURATION = 90;
export const BIG_CAMP_BUFF = 75;
