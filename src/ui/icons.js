// Groundswell icon set — procedural SVG icons for abilities, items, relics, sigils and UI.
// Every icon = framed tile (category/hero tint) + layered glyph with gradient, rim light and glow.
import { ITEMS } from '../data/items.js';
import { RELICS } from '../data/relics.js';
import { SIGILS } from '../data/sigils.js';
import { HEROES } from '../data/heroes/index.js';

// ---------- glyph library (viewBox 0 0 64 64). Each glyph: array of [d, layer] where layer 'm'=main, 'a'=accent, 's'=stroke-only accent
const G = {
  sword: [['M32 6 L37 12 L37 40 L32 46 L27 40 L27 12 Z', 'm'], ['M20 40 H44 V45 H20 Z', 'a'], ['M29.5 45 H34.5 V55 H29.5 Z', 'm'], ['M32 54 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'a']],
  dagger: [['M32 10 L36 16 L36 36 L32 40 L28 36 L28 16 Z', 'm'], ['M22 36 Q32 42 42 36 L42 40 Q32 45 22 40 Z', 'a'], ['M29.5 40 H34.5 V52 H29.5 Z', 'm']],
  twin: [['M18 8 L22 12 L26 40 L22 44 L18 41 Z', 'm'], ['M46 8 L42 12 L38 40 L42 44 L46 41 Z', 'm'], ['M12 40 H30 V44 H12 Z M34 40 H52 V44 H34 Z', 'a'], ['M19 44 H24 V54 H19 Z M40 44 H45 V54 H40 Z', 'm']],
  axe: [['M30 8 H35 V56 H30 Z', 'm'], ['M35 12 Q54 14 54 30 Q46 26 35 30 Z', 'a'], ['M30 14 Q16 16 14 26 Q22 24 30 26 Z', 'a']],
  scythe: [['M36 8 L40 9 L30 56 L26 55 Z', 'm'], ['M38 10 Q14 6 8 26 Q20 16 36 18 Z', 'a']],
  shield: [['M32 6 L52 13 Q52 40 32 58 Q12 40 12 13 Z', 'm'], ['M32 13 L45 18 Q45 38 32 50 Z', 'a']],
  shieldSpikes: [['M32 10 L48 16 Q48 38 32 52 Q16 38 16 16 Z', 'm'], ['M32 2 L35 10 H29 Z M54 12 L48 18 L46 12 Z M10 12 L18 12 L16 18 Z M50 38 L46 42 L44 36 Z M14 38 L20 36 L18 42 Z M32 60 L29 52 H35 Z', 'a']],
  shieldHeart: [['M32 6 L52 13 Q52 40 32 58 Q12 40 12 13 Z', 'm'], ['M32 42 L22 31 Q18 24 24 21 Q29 19 32 25 Q35 19 40 21 Q46 24 42 31 Z', 'a']],
  boot: [['M22 8 H38 V34 L50 40 Q54 42 54 47 V52 H14 V46 L22 42 Z', 'm'], ['M14 48 H54 V54 H14 Z', 'a'], ['M24 16 H36 M24 22 H36', 's']],
  bootWing: [['M24 10 H38 V34 L50 40 Q54 42 54 47 V52 H16 V46 L24 42 Z', 'm'], ['M24 18 Q10 14 6 6 Q16 8 24 12 Z M24 26 Q8 24 4 16 Q16 18 24 20 Z', 'a']],
  bolt: [['M36 4 L14 36 H30 L26 60 L50 26 H34 Z', 'm']],
  cloudBolt: [['M16 34 Q8 34 8 26 Q8 18 17 18 Q20 8 31 9 Q42 9 44 19 Q56 19 56 28 Q56 34 48 34 Z', 'm'], ['M34 30 L24 46 H32 L28 60 L42 40 H34 L38 30 Z', 'a']],
  staff: [['M30 22 H34 V58 H30 Z', 'm'], ['M32 4 m-11 0 a11 11 0 1 0 22 0', 'n'], ['M32 15 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0', 'a'], ['M26 20 L32 26 L38 20', 's']],
  hourglass: [['M16 6 H48 V11 H16 Z M16 53 H48 V58 H16 Z', 'a'], ['M20 11 H44 Q44 24 34 32 Q44 40 44 53 H20 Q20 40 30 32 Q20 24 20 11 Z', 'm'], ['M26 47 H38 L32 40 Z M27 18 H37 L32 26 Z', 'a']],
  tornado: [['M8 10 H56 Q54 16 46 18 H18 Q10 16 8 10 Z', 'm'], ['M14 22 H50 Q48 28 40 30 H22 Q16 28 14 22 Z', 'm'], ['M20 34 H44 Q42 40 36 42 H26 Q22 40 20 34 Z', 'a'], ['M26 46 H38 Q36 52 32 58 Q28 52 26 46 Z', 'a']],
  tree: [['M29 38 H35 V58 H29 Z', 'a'], ['M32 4 L50 26 H40 L54 42 H10 L24 26 H14 Z', 'm']],
  heart: [['M32 56 L10 33 Q3 22 12 14 Q22 7 32 19 Q42 7 52 14 Q61 22 54 33 Z', 'm'], ['M18 20 Q14 24 16 30', 's']],
  heartPlus: [['M32 56 L10 33 Q3 22 12 14 Q22 7 32 19 Q42 7 52 14 Q61 22 54 33 Z', 'm'], ['M29 24 H35 V30 H41 V36 H35 V42 H29 V36 H23 V30 H29 Z', 'a']],
  flower: [['M32 32 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0', 'a'], ['M32 6 Q40 16 32 25 Q24 16 32 6 Z M32 58 Q40 48 32 39 Q24 48 32 58 Z M6 32 Q16 24 25 32 Q16 40 6 32 Z M58 32 Q48 24 39 32 Q48 40 58 32 Z M13 13 Q25 15 27 27 Q15 25 13 13 Z M51 51 Q39 49 37 37 Q49 39 51 51 Z M51 13 Q49 25 37 27 Q39 15 51 13 Z M13 51 Q15 39 27 37 Q25 49 13 51 Z', 'm']],
  bow: [['M18 6 Q46 32 18 58 L22 58 Q52 32 22 6 Z', 'm'], ['M20 6 L20 58', 's'], ['M10 32 H54 L48 27 M54 32 L48 37', 's'], ['M54 32 L46 28 L46 36 Z', 'a']],
  target: [['M32 32 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0 M32 32 m-16 0 a16 16 0 1 1 32 0 a16 16 0 1 1 -32 0', 'm'], ['M32 32 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', 'a']],
  crosshair: [['M32 32 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', 's'], ['M30 4 H34 V20 H30 Z M30 44 H34 V60 H30 Z M4 30 H20 V34 H4 Z M44 30 H60 V34 H44 Z', 'm'], ['M32 32 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'a']],
  banner: [['M14 4 H19 V60 H14 Z', 'a'], ['M19 8 H52 L44 20 L52 32 H19 Z', 'm']],
  monolith: [['M20 58 L22 14 L32 4 L42 14 L44 58 Z', 'm'], ['M28 22 H36 V40 H28 Z', 'a'], ['M14 54 H50 V60 H14 Z', 'a']],
  cloak: [['M32 6 Q44 6 46 18 L56 56 Q44 50 32 58 Q20 50 8 56 L18 18 Q20 6 32 6 Z', 'm'], ['M32 14 Q38 14 38 22 Q38 30 32 30 Q26 30 26 22 Q26 14 32 14 Z', 'n']],
  bubble: [['M32 32 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0', 'm'], ['M20 22 Q24 14 32 14', 's'], ['M44 44 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'a']],
  mirror: [['M32 4 Q48 4 48 24 Q48 42 32 42 Q16 42 16 24 Q16 4 32 4 Z', 'm'], ['M29 42 H35 V58 H29 Z M22 56 H42 V60 H22 Z', 'a'], ['M24 14 Q28 9 34 10', 's']],
  flame: [['M32 4 Q46 18 46 36 Q46 56 32 58 Q18 56 18 36 Q18 26 24 20 Q24 30 30 32 Q26 16 32 4 Z', 'm'], ['M32 30 Q40 38 39 46 Q38 54 32 54 Q26 54 25 47 Q25 40 30 38 Q30 44 33 44 Q32 36 32 30 Z', 'a']],
  sun: [['M32 32 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0', 'm'], ['M30 2 H34 V14 H30 Z M30 50 H34 V62 H30 Z M2 30 H14 V34 H2 Z M50 30 H62 V34 H50 Z M10 13 L13 10 L21 18 L18 21 Z M43 46 L46 43 L54 51 L51 54 Z M51 10 L54 13 L46 21 L43 18 Z M18 43 L21 46 L13 54 L10 51 Z', 'a']],
  ghost: [['M14 58 V28 Q14 8 32 8 Q50 8 50 28 V58 L44 52 L38 58 L32 52 L26 58 L20 52 Z', 'm'], ['M24 26 m-4 0 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0 M40 26 m-4 0 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0', 'n']],
  rock: [['M8 50 L14 26 L28 14 L44 18 L56 34 L54 52 Z', 'm'], ['M28 14 L32 32 L14 26 M32 32 L54 52 M32 32 L44 18', 's']],
  snowflake: [['M30 4 H34 V60 H30 Z', 'm'], ['M30 4 H34 V60 H30 Z', 'm', 60], ['M30 4 H34 V60 H30 Z', 'm', -60], ['M32 32 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0', 'a']],
  mountain: [['M4 56 L24 16 L34 32 L42 22 L60 56 Z', 'm'], ['M24 16 L30 28 L26 26 L22 32 L19 26 Z M42 22 L47 32 L43 30 L40 34 L38 28 Z', 'a']],
  charm: [['M32 32 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0', 'm'], ['M32 32 m-13 0 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0', 'n'], ['M32 32 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0', 'a']],
  urn: [['M20 8 H44 V14 H20 Z', 'a'], ['M22 14 H42 Q54 26 50 44 Q46 58 32 58 Q18 58 14 44 Q10 26 22 14 Z', 'm'], ['M18 34 Q32 40 46 34', 's'], ['M28 2 Q32 -2 36 2 Q30 4 32 8', 's']],
  kite: [['M32 4 L52 26 L32 48 L12 26 Z', 'm'], ['M32 4 L32 48 M12 26 L52 26', 's'], ['M32 48 Q28 54 34 56 Q40 58 36 62', 's']],
  sparkle: [['M32 2 Q35 26 62 32 Q35 38 32 62 Q29 38 2 32 Q29 26 32 2 Z', 'm'], ['M50 8 Q51 13 56 14 Q51 15 50 20 Q49 15 44 14 Q49 13 50 8 Z', 'a']],
  brand: [['M32 4 Q46 18 46 36 Q46 56 32 58 Q18 56 18 36 Q18 26 24 20 Q24 30 30 32 Q26 16 32 4 Z', 'm'], ['M32 32 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', 'n'], ['M28 32 L32 26 L36 32 L32 38 Z', 'a']],
  hexBarrier: [['M32 4 L56 18 V46 L32 60 L8 46 V18 Z', 'm'], ['M32 14 L47 23 V41 L32 50 L17 41 V23 Z', 'n'], ['M32 22 L40 27 V37 L32 42 L24 37 V27 Z', 'a']],
  windHeart: [['M32 54 L12 34 Q6 24 14 17 Q23 11 32 21 Q41 11 50 17 Q58 24 52 34 Z', 'm'], ['M4 28 H22 Q28 28 28 22 M8 38 H26', 's']],
  lantern: [['M26 4 H38 V10 H26 Z', 'a'], ['M20 10 H44 L48 18 V46 L44 54 H20 L16 46 V18 Z', 'm'], ['M32 32 m-7 0 a7 9 0 1 0 14 0 a7 9 0 1 0 -14 0', 'a'], ['M22 56 H42 V60 H22 Z', 'a']],
  steps: [['M14 30 Q12 20 18 18 Q24 18 24 28 Q24 38 18 40 Q12 38 14 30 Z M14 44 m-4 0 a4 3 0 1 0 8 0 a4 3 0 1 0 -8 0', 'm'], ['M42 16 Q40 6 46 4 Q52 4 52 14 Q52 24 46 26 Q40 24 42 16 Z M42 30 m-4 0 a4 3 0 1 0 8 0 a4 3 0 1 0 -8 0', 'a'], ['M30 52 H58 M36 44 H56', 's']],
  crystal: [['M32 2 L50 24 L32 62 L14 24 Z', 'm'], ['M32 2 L38 24 L32 62 L26 24 Z', 'a'], ['M14 24 H50', 's']],
  comet: [['M42 22 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0', 'm'], ['M30 32 L4 60 L22 40 L6 44 L28 28 Z', 'a']],
  trident: [['M30 18 H34 V60 H30 Z', 'm'], ['M14 6 L18 6 L18 20 Q18 26 32 26 Q46 26 46 20 L46 6 L50 6 V22 Q50 32 32 32 Q14 32 14 22 Z', 'm'], ['M32 2 L36 12 H28 Z M16 0 L20 8 H12 Z M48 0 L52 8 H44 Z', 'a']],
  burst: [['M32 2 L38 22 L58 14 L44 30 L62 40 L40 40 L42 62 L30 44 L14 58 L20 38 L2 32 L22 26 L14 8 L30 20 Z', 'm'], ['M32 32 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0', 'a']],
  spiral: [['M32 32 m-3 0 a3 3 0 1 1 6 0 a8 8 0 1 1 -14 0 a13 13 0 1 1 24 2 a18 18 0 1 1 -34 -4 a23 23 0 1 1 44 4', 's']],
  skull: [['M32 4 Q54 4 54 26 Q54 38 46 42 V52 H18 V42 Q10 38 10 26 Q10 4 32 4 Z', 'm'], ['M22 26 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M42 26 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M32 34 L28 40 H36 Z', 'n'], ['M24 46 V54 M32 46 V54 M40 46 V54', 's']],
  scroll: [['M14 10 H46 Q52 10 52 16 V52 Q52 58 46 58 H18 Q12 58 12 52 V16', 'm'], ['M10 10 m-5 0 a5 6 0 1 0 10 0 a5 6 0 1 0 -10 0', 'a'], ['M22 22 H44 M22 30 H44 M22 38 H40 M22 46 H36', 's']],
  fist: [['M14 26 Q14 18 20 18 H44 Q52 18 52 26 V40 Q52 56 36 56 H26 Q14 56 14 44 Z', 'm'], ['M20 18 V30 M28 18 V30 M36 18 V30 M44 18 V30', 's'], ['M8 30 Q8 24 14 24 V40 Q8 38 8 30 Z', 'a']],
  paw: [['M32 34 Q46 34 46 46 Q46 56 32 52 Q18 56 18 46 Q18 34 32 34 Z', 'm'], ['M14 30 m-6 0 a6 7 0 1 0 12 0 a6 7 0 1 0 -12 0 M50 30 m-6 0 a6 7 0 1 0 12 0 a6 7 0 1 0 -12 0 M24 16 m-6 0 a6 7 0 1 0 12 0 a6 7 0 1 0 -12 0 M40 16 m-6 0 a6 7 0 1 0 12 0 a6 7 0 1 0 -12 0', 'a']],
  feather: [['M50 4 Q58 26 36 44 L22 50 L26 36 Q30 12 50 4 Z', 'm'], ['M50 6 L14 60', 's'], ['M40 18 L30 22 M44 24 L32 30 M40 32 L28 36', 's']],
  anchor: [['M30 12 H34 V54 H30 Z', 'm'], ['M32 10 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0', 's'], ['M20 22 H44 V26 H20 Z', 'm'], ['M8 36 Q10 56 32 58 Q54 56 56 36 L50 40 Q48 52 34 52 H30 Q16 52 14 40 Z', 'a']],
  house: [['M32 6 L58 30 H50 V58 H14 V30 H6 Z', 'm'], ['M26 38 H38 V58 H26 Z', 'n'], ['M42 10 H48 V22 L42 16 Z', 'a']],
  spikes: [['M32 32 m-14 0 a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0', 'm'], ['M32 2 L36 18 H28 Z M32 62 L28 46 H36 Z M2 32 L18 28 V36 Z M62 32 L46 36 V28 Z M11 11 L24 21 L21 24 Z M53 53 L40 43 L43 40 Z M53 11 L43 24 L40 21 Z M11 53 L21 40 L24 43 Z', 'a']],
  lifebuoy: [['M32 32 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0 M32 32 m-12 0 a12 12 0 1 1 24 0 a12 12 0 1 1 -24 0', 'm'], ['M28 8 H36 V20 H28 Z M28 44 H36 V56 H28 Z M8 28 H20 V36 H8 Z M44 28 H56 V36 H44 Z', 'a']],
  pine: [['M29 46 H35 V58 H29 Z', 'a'], ['M32 4 L46 22 H38 L50 36 H40 L54 48 H10 L24 36 H14 L26 22 H18 Z', 'm']],
  roots: [['M28 4 H36 V30 Q36 36 44 40 Q54 44 58 56 L52 54 Q48 46 40 44 L36 42 V58 H28 V42 L24 44 Q16 46 12 54 L6 56 Q10 44 20 40 Q28 36 28 30 Z', 'm'], ['M22 16 Q14 14 10 6 M42 16 Q50 14 54 6', 's']],
  slam: [['M32 6 L48 12 Q48 30 32 42 Q16 30 16 12 Z', 'm'], ['M6 54 Q32 44 58 54 M12 60 Q32 52 52 60', 's'], ['M8 40 L16 46 M56 40 L48 46 M32 46 V52', 's']],
  wall: [['M6 22 H30 V34 H6 Z M34 22 H58 V34 H34 Z M18 38 H46 V50 H18 Z M6 38 H14 V50 H6 Z M50 38 H58 V50 H50 Z', 'm'], ['M10 8 Q16 2 22 8 Q26 14 20 18 M44 6 Q50 2 54 10', 's'], ['M6 54 H58 V58 H6 Z', 'a']],
  grove: [['M32 32 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0', 's'], ['M32 10 L46 30 H38 L48 44 H16 L26 30 H18 Z', 'm'], ['M29 44 H35 V54 H29 Z', 'a'], ['M10 32 L18 32 M46 32 L54 32', 's']],
  lunge: [['M40 6 L46 10 L30 44 L24 46 L24 40 Z', 'm'], ['M18 40 L28 50 L26 52 L16 42 Z', 'a'], ['M4 30 H20 M6 38 H18 M8 46 H16', 's'], ['M22 50 L14 58 L18 60 L24 54', 'm']],
  parry: [['M12 8 L16 6 L44 50 L40 54 Z', 'm'], ['M52 8 L48 6 L20 50 L24 54 Z', 'm'], ['M32 22 L36 30 L44 32 L36 34 L32 42 L28 34 L20 32 L28 30 Z', 'a']],
  inferno: [['M32 2 Q50 18 50 38 Q50 60 32 62 Q14 60 14 38 Q14 26 22 18 Q22 30 28 32 Q24 14 32 2 Z', 'm'], ['M20 30 L24 22 L28 30 L32 18 L36 30 L40 22 L44 30 Z', 'a'], ['M32 38 Q40 46 38 52 Q36 58 32 58 Q28 58 26 52 Q24 46 32 38 Z', 'a']],
  constellation: [['M12 46 L28 18 L50 30 L40 52 Z', 's'], ['M12 46 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M28 18 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M50 30 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M40 52 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'm']],
  starBolt: [['M44 6 L48 18 L60 20 L50 28 L54 40 L44 33 L34 40 L37 28 L28 20 L40 18 Z', 'm'], ['M30 32 L4 58 M34 38 L14 60 M24 28 L4 46', 's']],
  gravity: [['M32 32 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'a'], ['M32 32 m-3 0 a3 3 0 1 1 6 0 a9 9 0 1 1 -16 0 a14 14 0 1 1 26 2 a20 20 0 1 1 -38 -4', 's'], ['M54 10 L46 18 M10 54 L18 46 M54 54 L46 46 M10 10 L18 18', 's']],
  collapse: [['M32 18 L36 28 L46 32 L36 36 L32 46 L28 36 L18 32 L28 28 Z', 'm'], ['M6 6 L18 18 M58 6 L46 18 M6 58 L18 46 M58 58 L46 46 M32 2 V12 M32 52 V62 M2 32 H12 M52 32 H62', 's'], ['M8 8 L14 8 L8 14 Z M56 8 L56 14 L50 8 Z M8 56 L8 50 L14 56 Z M56 56 L50 56 L56 50 Z', 'a']],
  bullet: [['M8 28 H40 Q54 28 58 32 Q54 36 40 36 H8 Z', 'm'], ['M4 24 H12 V40 H4 Z', 'a'], ['M22 16 L26 48 M34 16 L38 48', 's']],
  ricochet: [['M4 50 L22 20 L38 44 L56 12', 's'], ['M56 12 L46 14 L54 22 Z', 'm'], ['M22 20 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M38 44 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0', 'a']],
  tumble: [['M32 32 m-16 0 a16 16 0 1 1 32 0', 's'], ['M48 32 L56 22 L40 24 Z', 'm'], ['M32 32 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', 'a'], ['M6 50 H58', 's']],
  deadeye: [['M32 32 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0', 's'], ['M32 32 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0', 's'], ['M30 0 H34 V22 H30 Z M30 42 H34 V64 H30 Z M0 30 H22 V34 H0 Z M42 30 H64 V34 H42 Z', 'm'], ['M32 32 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'a']],
  veil: [['M40 6 Q22 10 20 32 Q22 54 40 58 Q14 60 8 32 Q14 4 40 6 Z', 'm'], ['M38 26 Q46 20 54 26 Q46 32 38 26 Z', 'a'], ['M36 40 H56', 's']],
  shadeDash: [['M48 10 L52 14 L30 40 L26 38 Z', 'm'], ['M24 36 L32 44 L28 48 L20 40 Z', 'a'], ['M36 10 L38 12 L18 36 M24 10 L26 12 L8 32', 's']],
  hollow: [['M44 6 L48 10 L24 40 L20 38 Z', 'm'], ['M16 36 L26 46 L22 50 L12 40 Z', 'a'], ['M44 44 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0', 's'], ['M44 44 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'a']],
  nightfall: [['M4 52 Q32 4 60 52 Z', 'm'], ['M40 18 Q30 22 30 32 Q30 42 40 46 Q24 48 22 32 Q24 16 40 18 Z', 'a'], ['M4 56 H60', 's']],
  mech: [['M14 18 H50 V44 H14 Z', 'm'], ['M22 26 H30 V32 H22 Z M34 26 H42 V32 H34 Z', 'n'], ['M30 6 H34 V18 H30 Z M28 4 H36 V8 H28 Z', 'a'], ['M10 46 H24 V56 H10 Z M40 46 H54 V56 H40 Z', 'a'], ['M22 38 H42', 's']],
  wrench: [['M44 4 Q58 6 58 20 L48 24 L40 16 L44 6 Z M44 6 Q30 8 34 24 L8 50 Q6 56 12 58 Q16 58 18 54 L42 30 Q56 32 58 20', 'm'], ['M12 52 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', 'n']],
  gear: [['M28 2 H36 L38 10 L46 13 L52 8 L58 14 L53 21 L55 28 H62 V36 L55 37 L52 45 L58 51 L51 58 L45 53 L37 56 L36 62 H28 L27 55 L19 52 L13 58 L6 51 L11 45 L8 37 L2 36 V28 L9 27 L12 19 L6 13 L13 6 L19 11 L27 8 Z', 'm'], ['M32 32 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', 'n']],
  overclock: [['M28 6 H36 L37 12 L44 15 L49 11 L55 17 L51 22 L53 28 H58 V36 L53 37 L50 43 L55 48 L49 54 L44 50 L37 53 L36 58 H28 L27 53 L20 50 L15 54 L9 48 L13 43 L11 37 H6 V28 L11 27 L14 21 L9 16 L15 10 L20 14 L27 11 Z', 'm'], ['M35 18 L24 34 H32 L28 48 L40 30 H32 Z', 'a']],
  drop: [['M32 4 Q16 26 16 40 Q16 58 32 58 Q48 58 48 40 Q48 26 32 4 Z', 'm'], ['M24 40 Q24 48 32 50', 's'], ['M44 56 L50 50', 's']],
  dropImpact: [['M14 6 H50 V30 H14 Z', 'm'], ['M22 30 H42 L32 46 Z', 'm'], ['M4 54 Q32 42 60 54 M12 60 Q32 52 52 60', 's'], ['M24 14 H40 V20 H24 Z', 'n']],
  bubbles: [['M8 48 Q32 36 56 48 Q56 60 32 60 Q8 60 8 48 Z', 'm'], ['M22 30 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M42 22 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M30 10 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'a']],
  totem: [['M20 8 H44 V26 H20 Z', 'm'], ['M24 28 H40 V58 H24 Z', 'm'], ['M26 14 H30 V18 H26 Z M34 14 H38 V18 H34 Z M26 21 H38 V23 H26 Z', 'n'], ['M14 4 L20 10 V14 L12 10 Z M50 4 L44 10 V14 L52 10 Z', 'a'], ['M28 36 H36 M28 44 H36', 's']],
  swamp: [['M4 40 Q14 32 24 40 Q34 48 44 40 Q54 32 60 38 V60 H4 Z', 'm'], ['M22 22 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M40 14 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', 'a'], ['M10 50 Q20 44 30 50 M36 52 Q46 46 56 52', 's']],
  leap: [['M8 54 Q24 4 56 24', 's'], ['M56 24 L44 18 L48 30 Z', 'm'], ['M24 44 Q30 30 40 32 L42 38 Q34 38 30 46 Z', 'a'], ['M4 58 H24', 's']],
  roar: [['M10 22 L28 30 L10 42 Z', 'm'], ['M34 22 Q40 32 34 42 M42 16 Q52 32 42 48 M50 10 Q62 32 50 54', 's'], ['M12 26 L16 30 L12 32 Z', 'n']],
  hunt: [['M32 32 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0', 's'], ['M30 2 H34 V14 H30 Z M30 50 H34 V62 H30 Z M2 30 H14 V34 H2 Z M50 30 H62 V34 H50 Z', 'a'], ['M32 36 Q42 36 42 44 Q42 50 32 48 Q22 50 22 44 Q22 36 32 36 Z M22 30 m-4 0 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0 M42 30 m-4 0 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0 M28 22 m-3 0 a3 4 0 1 0 6 0 a3 4 0 1 0 -6 0 M36 22 m-3 0 a3 4 0 1 0 6 0 a3 4 0 1 0 -6 0', 'm']],
  // UI
  home: [['M32 6 L58 30 H50 V58 H14 V30 H6 Z', 'm'], ['M26 38 H38 V58 H26 Z', 'n']],
  anvil: [['M6 14 H52 Q58 14 58 20 Q46 22 42 30 V36 H22 V30 Q10 28 6 14 Z', 'm'], ['M18 36 H46 V44 H18 Z', 'a'], ['M12 46 H52 V54 H12 Z', 'm']],
  gem: [['M16 8 H48 L60 24 L32 58 L4 24 Z', 'm'], ['M4 24 H60 M16 8 L24 24 L32 58 L40 24 L48 8 M24 24 L32 8 L40 24', 's']],
  person: [['M32 30 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0', 'm', 0, -10], ['M8 60 Q8 36 32 36 Q56 36 56 60 Z', 'm']],
  cog: [['M28 2 H36 L38 10 L46 13 L52 8 L58 14 L53 21 L55 28 H62 V36 L55 37 L52 45 L58 51 L51 58 L45 53 L37 56 L36 62 H28 L27 55 L19 52 L13 58 L6 51 L11 45 L8 37 L2 36 V28 L9 27 L12 19 L6 13 L13 6 L19 11 L27 8 Z', 'm'], ['M32 32 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0', 'n']],
  cart: [['M2 10 H12 L20 42 H52 L58 18 H16', 's'], ['M16 18 H58 L52 42 H20 Z', 'm'], ['M24 52 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M48 52 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0', 'a']],
  swords: [['M8 6 L14 4 L44 46 L40 50 Z', 'm'], ['M56 6 L50 4 L20 46 L24 50 Z', 'm'], ['M34 44 L46 32 L50 36 L38 48 Z M30 44 L18 32 L14 36 L26 48 Z', 'a'], ['M40 50 L48 58 L52 54 L44 46 Z M24 50 L16 58 L12 54 L20 46 Z', 'a']],
  chart: [['M8 56 H56', 's'], ['M12 34 H22 V52 H12 Z M27 18 H37 V52 H27 Z M42 26 H52 V52 H42 Z', 'm']],
  menu: [['M10 14 H54 V20 H10 Z M10 29 H54 V35 H10 Z M10 44 H54 V50 H10 Z', 'm']],
  lock: [['M20 28 V20 Q20 8 32 8 Q44 8 44 20 V28', 's'], ['M14 28 H50 V56 H14 Z', 'm'], ['M32 38 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M30 40 H34 V48 H30 Z', 'n']],
  last: [['M8 40 Q8 20 32 20 Q56 20 56 40 V52 H8 Z', 'm'], ['M20 34 H44', 'n'], ['M26 8 L32 2 L38 8 M32 2 V16', 's'], ['M20 44 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M44 44 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', 'n']],
  tower: [['M20 58 L24 22 H40 L44 58 Z', 'm'], ['M18 14 H46 V22 H18 Z M18 8 H24 V14 H18 Z M29 8 H35 V14 H29 Z M40 8 H46 V14 H40 Z', 'a'], ['M28 36 H36 V48 H28 Z', 'n']],
  coin: [['M32 32 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0', 'm'], ['M32 32 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0', 's'], ['M28 22 H36 V42 H28 Z', 'a']],
};

// ---------- palettes
const PAL = {
  offense: ['#ff6a4d', '#ffd36b'], defense: ['#4da3ff', '#bfe3ff'], utility: ['#41d7a7', '#c8ffe9'],
  relic: ['#b583ff', '#ffe08a'], sigil_offense: ['#ff5d7a', '#ffc4cf'], sigil_utility: ['#3fd0ff', '#d4f6ff'],
  ui: ['#c9d6ff', '#ffffff'], gold: ['#ffc94d', '#fff1c2'],
};

const AB = { // hero ability glyphs
  bram: { passive: 'roots', q: 'slam', w: 'wall', r: 'grove' },
  kaela: { passive: 'flame', q: 'lunge', w: 'parry', r: 'inferno' },
  lumi: { passive: 'constellation', q: 'starBolt', w: 'gravity', r: 'collapse' },
  vex: { passive: 'bullet', q: 'ricochet', w: 'tumble', r: 'deadeye' },
  nyx: { passive: 'veil', q: 'shadeDash', w: 'hollow', r: 'nightfall' },
  pip: { passive: 'mech', q: 'wrench', w: 'overclock', r: 'dropImpact' },
  mire: { passive: 'drop', q: 'bubbles', w: 'totem', r: 'swamp' },
  garrok: { passive: 'paw', q: 'leap', w: 'roar', r: 'hunt' },
};
const ITEM_G = {
  warblade: 'sword', bloodedge: 'sword', rendblade: 'dagger', bulwark: 'shield', thornplate: 'shieldSpikes', lifeguard: 'shieldHeart',
  swiftboots: 'boot', stormstriders: 'bootWing', sagesteps: 'boot', runestaff: 'staff', stormcaller: 'cloudBolt', timeweaver: 'hourglass',
  heartwood: 'tree', giantheart: 'heart', everbloom: 'flower', gale_bow: 'bow', stormbow: 'tornado', longstrider: 'target',
  reaper_scythe: 'scythe', executioner: 'axe', harvester: 'scythe', aegis_banner: 'banner', warbanner: 'banner', sentinel_plate: 'monolith',
  veilcloak: 'cloak', nullveil: 'bubble', quicksilver: 'mirror', emberbrand: 'flame', sunfire_edge: 'sun', phantom_edge: 'ghost',
  stoneguard: 'rock', frostguard: 'snowflake', colossus_plate: 'mountain', mendcharm: 'charm', lifebloom: 'urn', windspur: 'kite',
};
const ITEM_TINT = { bloodedge: ['#ff3d5a', '#ffb3be'], rendblade: ['#ff8a3d', '#ffe0b8'], thornplate: ['#3fbf6a', '#c9ffd7'], lifeguard: ['#3fd09a', '#d4ffef'], stormstriders: ['#ffd23f', '#fff6c4'], sagesteps: ['#8f7bff', '#e0dbff'], stormcaller: ['#5aa9ff', '#e4f1ff'], timeweaver: ['#d9b36b', '#fff1d1'], giantheart: ['#ff4d6d', '#ffd0d8'], everbloom: ['#ff7ad9', '#ffe0f6'], stormbow: ['#7cc8ff', '#e5f5ff'], longstrider: ['#ffb84d', '#fff0cf'], executioner: ['#b93a3a', '#ffcfcf'], harvester: ['#c9a227', '#fff3c4'], warbanner: ['#ff6b4a', '#ffe1d8'], sentinel_plate: ['#8aa4c8', '#e6eef9'], nullveil: ['#9b7bff', '#e8e0ff'], quicksilver: ['#b9c6d6', '#ffffff'], sunfire_edge: ['#ffb02e', '#fff2cc'], phantom_edge: ['#7a6cff', '#e6e2ff'], frostguard: ['#7fd9ff', '#ecfbff'], colossus_plate: ['#9a8a7a', '#efe6dc'], lifebloom: ['#5fd38d', '#e2ffec'], windspur: ['#4fe0c6', '#e0fff9'] };
const RELIC_G = { blink: 'sparkle', hunters_brand: 'brand', barrier: 'hexBarrier', second_wind: 'windHeart', lantern: 'lantern', ghost: 'steps', purify: 'crystal', ignite: 'comet' };
const SIGIL_G = { piercing: 'trident', fervor: 'burst', focus: 'spiral', executioner: 'skull', arcane_edge: 'scroll', brawler: 'fist', first_strike: 'crosshair', predator: 'paw', swiftness: 'feather', vitality: 'heartPlus', steadfast: 'anchor', homeward: 'house', thick_skin: 'spikes', lifeline: 'lifebuoy', trailblazer: 'pine', haste_charm: 'hourglass' };

// ---------- lookup tables built from data (def object → icon spec)
const SPEC = new WeakMap();
const BY_KEY = {};
const reg = (def, key, glyph, pal, frame) => { const s = { key, glyph, pal, frame }; if (def && typeof def === 'object') SPEC.set(def, s); BY_KEY[key] = s; return s; };
for (const it of ITEMS) {
  const pal = PAL[it.category] || PAL.offense;
  reg(it, 'item:' + it.id, ITEM_G[it.id] || 'sword', pal, 'item');
  for (const k of ['a', 'b']) { const br = it.branches?.[k]; if (br) reg(br, 'item:' + br.id, ITEM_G[br.id] || ITEM_G[it.id] || 'sword', ITEM_TINT[br.id] || pal, 'mythic'); }
}
for (const r of RELICS) reg(r, 'relic:' + r.id, RELIC_G[r.id] || 'sparkle', PAL.relic, 'relic');
for (const s of SIGILS) reg(s, 'sigil:' + s.id, SIGIL_G[s.id] || 'spiral', s.slot === 'utility' ? PAL.sigil_utility : PAL.sigil_offense, 'sigil');
for (const h of HEROES) {
  const c = h.color || '#8fa3ff';
  for (const sl of ['passive', 'q', 'w', 'r']) { const a = h.abilities?.[sl]; if (a) reg(a, `ab:${h.id}:${sl}`, AB[h.id]?.[sl] || 'burst', [c, '#ffffff'], sl === 'r' ? 'ult' : sl === 'passive' ? 'passive' : 'ability'); }
}
for (const k of ['home', 'anvil', 'gem', 'person', 'cog', 'cart', 'swords', 'chart', 'menu', 'lock', 'last', 'tower', 'coin']) reg(null, 'ui:' + k, k, k === 'coin' ? PAL.gold : PAL.ui, 'none');

let uid = 0;
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b); return `rgb(${r},${g},${b})`; };

function glyphSVG(name, id, light, accent) {
  const parts = G[name] || G.burst;
  return parts.map(([d, layer, rot = 0, dy = 0]) => {
    const tf = rot || dy ? ` transform="${rot ? `rotate(${rot} 32 32)` : ''}${dy ? ` translate(0 ${dy})` : ''}"` : '';
    if (layer === 's') return `<path d="${d}" fill="none" stroke="${accent}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"${tf}/>`;
    if (layer === 'n') return `<path d="${d}" fill="rgba(8,10,24,.78)"${tf}/>`;
    if (layer === 'a') return `<path d="${d}" fill="${accent}"${tf}/>`;
    return `<path d="${d}" fill="url(#gm${id})" stroke="rgba(10,12,30,.55)" stroke-width="1.2" stroke-linejoin="round"${tf}/>`;
  }).join('');
}

/** Raw icon SVG from a spec. size in px. opts.frame overrides; opts.locked greys it. */
export function iconSVG(spec, size = 40, opts = {}) {
  if (!spec) spec = BY_KEY['ui:menu'];
  const id = ++uid;
  const [base, light] = spec.pal;
  const frame = opts.frame || spec.frame;
  const gm = `<linearGradient id="gm${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${shade(light, -0.08)}"/><stop offset="1" stop-color="${shade(base, -0.05)}"/></linearGradient>`;
  let bg = '';
  if (frame !== 'none') {
    const r = frame === 'sigil' || frame === 'passive' ? 32 : frame === 'relic' ? 18 : 12;
    const edge = frame === 'ult' || frame === 'mythic' ? '#ffd76a' : frame === 'relic' ? '#d8b8ff' : shade(base, 0.25);
    bg = `<radialGradient id="bg${id}" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${shade(base, -0.35)}"/><stop offset=".7" stop-color="${shade(base, -0.72)}"/><stop offset="1" stop-color="${shade(base, -0.86)}"/></radialGradient>`
      + `<radialGradient id="gl${id}" cx=".5" cy=".45" r=".5"><stop offset="0" stop-color="${base}" stop-opacity=".55"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></radialGradient>`;
    const shape = frame === 'relic' ? `<path d="M32 1 L63 32 L32 63 L1 32 Z" fill="url(#bg${id})" stroke="${edge}" stroke-width="2"/>`
      : `<rect x="1" y="1" width="62" height="62" rx="${r}" fill="url(#bg${id})" stroke="${edge}" stroke-width="${frame === 'ult' || frame === 'mythic' ? 2.4 : 1.6}"/>`;
    bg = `<defs>${gm}${bg}</defs>${shape}<circle cx="32" cy="30" r="26" fill="url(#gl${id})"/>`
      + `<path d="M6 10 Q32 2 58 10 L58 18 Q32 10 6 18 Z" fill="#fff" opacity=".07"/>`;
  } else bg = `<defs>${gm}</defs>`;
  const inner = frame === 'none' ? glyphSVG(spec.glyph, id, light, shade(light, -0.05)) : `<g transform="translate(9.6 9.6) scale(.7)" filter="drop-shadow(0 1.5px 1.5px rgba(0,0,0,.55))">${glyphSVG(spec.glyph, id, light, shade(base, 0.35))}</g>`;
  return `<svg class="gs-ico${opts.locked ? ' locked' : ''}" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" style="${opts.locked ? 'filter:grayscale(.85) brightness(.7);' : ''}">${bg}${inner}</svg>`;
}

/** Icon for a data definition (ability/item/branch/relic/sigil object) or a key like 'ui:cart'. */
export function ico(defOrKey, size = 40, opts) {
  const spec = typeof defOrKey === 'string' ? BY_KEY[defOrKey] : defOrKey ? SPEC.get(defOrKey) : null;
  if (!spec) return typeof defOrKey === 'object' && defOrKey?.icon ? `<span class="gs-ico-txt">${defOrKey.icon}</span>` : '';
  return iconSVG(spec, size, opts);
}
export const hasIcon = (d) => !!(typeof d === 'string' ? BY_KEY[d] : d && SPEC.get(d));
export const ICON_KEYS = Object.keys(BY_KEY);
