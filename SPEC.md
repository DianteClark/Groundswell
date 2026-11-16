# GROUNDSWELL — Technical Spec (shared contract for all contributors)

Game title: **Groundswell**. A 3v3 browser MOBA. Low-poly stylized 3D (Three.js).
Main grind = vs bots. P2P (WebRTC, lockstep) comes later — so the SIM must be deterministic.

## Build
- Source: ES modules in `src/`. Bundled by esbuild into ONE self-contained `dist/index.html`.
- `npm run build` → `node build.mjs` (bundles `src/main.js` + inlines CSS from `src/style.css`).
- Only dependency: `three` (import from 'three'). No other runtime deps, no network fetches, no external assets (no images/fonts/audio files). Everything procedural. Audio (if any) via WebAudio synthesis.
- Must run on desktop AND mobile (touch) browsers, 60fps target.

## Golden rules
1. **Sim / render separation.** `src/sim/**` and `src/data/**` (gameplay parts) never touch DOM, Three.js, `Date.now`, `performance.now`, or `Math.random`. Use `match.rng()` (seeded). Sim runs at fixed **30 ticks/s** (`DT = 1/30`).
2. Render (`src/render/**`) and UI (`src/ui/**`) only READ sim state, and only WRITE via `match.issue(playerId, cmd)`.
3. Stay in your owned files. If you need a change in someone else's file, write it in `NOTES-<yourname>.md` instead and work around it.

## Ownership
| Area | Owner | Files |
|---|---|---|
| Core sim: match loop, map, nav, minions, towers, objectives, gold/xp, commands, base combat (damage, autos, projectiles, statuses) | Lead | `src/sim/*.js`, `src/main.js`, `build.mjs` |
| Heroes, ability blocks, items, relics, sigils, augments, bot AI | Agent A (Combat) | `src/data/heroes/*.js`, `src/data/items.js`, `src/data/relics.js`, `src/data/sigils.js`, `src/sim/blocks.js`, `src/ai/*.js` |
| Rendering, models, skins, VFX, map look, camera | Agent B (Art) | `src/render/**`, `src/data/skins.js` |
| Menus, Armory, Shop, Profile, save/economy, HUD, input (mouse/kbd/touch), audio | Agent C (Meta/UI) | `src/ui/**`, `src/meta/**`, `src/style.css` |

## Coordinates
Sim is 2D: `x` (0..240), `y` (0..160). Render maps sim (x,y) → three (x, 0, y) (y-up world; sim y becomes world z). 1 unit ≈ 1 meter. Hero radius ≈ 1.2. Hero move speed ≈ 10 u/s.
Team 0 = **Blue** (base on the LEFT, x≈18). Team 1 = **Red** (base on the RIGHT, x≈222). Team 2 = neutral.

## Match API (`src/sim/match.js`)
```js
import { Match } from './sim/match.js';
const m = new Match(config);
// config = { seed, mode:'bots'|'p2p', difficulty:1..5,
//   players:[{ id:'p0', team:0, heroId:'bram', skinId:'bram_default', isBot:false, name:'You',
//              loadout:{ items:['warblade',...3 base item ids], relic:'blink', sigils:{offense:'piercing', utility:'swiftness'} },
//              profile:{ title, banner, border, icon } }, ... 6 total ] }
m.localPlayerId          // set by caller
m.tick()                 // advance one fixed step (DT). Caller runs accumulator.
m.issue(playerId, cmd)   // queue a command (applied at next tick)
m.time                   // seconds elapsed (sim)
m.tickCount
m.entities               // Map<id, Entity>  (all live entities)
m.heroes                 // array of hero entities (alive or dead), index order = players order
m.heroOf(playerId)
m.events                 // array of events emitted during the LAST tick (cleared at start of each tick)
m.map                    // static map data (see Map)
m.objectives             // { wyrm:{alive, respawnAt, element, nextElement}, colossus:{...}, soul:{0:count,1:count} }
m.teamStats[team]        // { kills, towers, wyrms, colossus, gold, buffs:[...] }
m.over / m.winner        // match ended?
m.unitsInRadius(x,y,r, filterFn)
m.findUnitAt(x,y, r, filterFn) // nearest
```

## Entities (plain objects)
Common fields:
```
id (int), kind: 'hero'|'minion'|'tower'|'core'|'monster'|'projectile'|'area'|'summon'
team: 0|1|2, x, y, prevX, prevY (for render interpolation), radius, facing (radians, sim angle atan2(dy,dx))
alive (bool), hp, maxHp, shield (sum of active shields)
stats: { maxHp, power, armor, attackRange, attackSpeed (attacks/sec), moveSpeed, haste (ability cooldown reduction %, 0..60),
         armorPen (fraction 0..1), lifesteal (fraction), hpRegen (per sec) }
statuses: [{ key, until, ...data }]  — keys: 'stun','root','slow'(amount),'silence','invisible','untargetable','taunt'(sourceId),
          'speed'(amount),'blind' etc. Render may show icons/vfx by key.
visual: { model, skinId?, tint? }   — render uses this to pick a model. See "Visual keys".
anim: { state:'idle'|'run'|'attack'|'cast'|'dead', t (seconds since state start), slot? }   — render-friendly.
```
Hero extra fields:
```
playerId, heroId, name, isBot, level (1..12), xp, gold, kills, deaths, assists, cs,
abilities: { passive:{...}, q:{cd, cdMax, ready}, w:{...}, r:{... unlocked when level>=5}, relic:{...} }
items: [ {id, tier(1..3), branch:null|'a'|'b'} x up to 3 ]
augments: { 3:null|'a'|'b', 6:..., 9:... }    pendingAugment: null | 3 | 6 | 9
respawnAt, recalling:{until}|null, buffs:[{key, until?}]
```

## Commands (`match.issue(pid, cmd)`)
```
{type:'move', x, y}                 // path to point
{type:'moveDir', dx, dy}            // joystick (unit vector, or 0,0 to stop); persists until changed
{type:'attack', targetId}
{type:'attackMove', x, y}
{type:'stop'}
{type:'cast', slot:'q'|'w'|'r'|'relic', x, y, targetId?}   // x,y = aim point in sim coords
{type:'buy', slot:0..2}             // buy/upgrade next step of item in that slot following loadout (must be at fountain or dead)
{type:'buyBranch', slot, branch:'a'|'b'}   // upgrade with explicit branch
{type:'augment', level:3|6|9, choice:'a'|'b'}
{type:'recall'}
```

## Events (`match.events`, per tick)
```
{t:'spawn', id}            {t:'death', id, killerId, assists:[ids]}
{t:'damage', srcId, targetId, amount, crit?, ability?}   {t:'heal', targetId, amount}
{t:'attack', srcId, targetId}         // auto-attack started (windup)
{t:'cast', srcId, slot, heroId, x, y, tx, ty}
{t:'vfx', key, x, y, tx?, ty?, radius?, duration?, team, srcId?, targetId?, angle?}  // generic one-shot effect
{t:'levelup', id, level}   {t:'gold', id, amount}
{t:'objective', key:'wyrm'|'colossus'|'tower'|'core', team, element?}
{t:'announce', text, team?}   // kill feed / big banners ("First Blood", "Wyrm slain")
{t:'mapchange', zone, kind, team, at}   // living map: telegraph & apply
{t:'match_end', winner}
```

## Visual keys (render contract)
- hero: `visual.model = heroId` + `visual.skinId`.
- minion: `'minion_melee'|'minion_caster'|'minion_siege'`, team color.
- tower: `'tower'`, core: `'core'`.
- monster: `'camp_small'|'camp_big'|'wyrm'|'colossus'`; wyrm has `element`.
- projectile: `visual.model = vfx key` like `'lumi_q'`, `'tower_shot'`, `'caster_shot'`, `'auto_<heroId>'`. Render must have a sensible FALLBACK for unknown keys (glowing orb in team color).
- area (ground zone): `visual.model = vfx key` e.g. `'mire_w'`, with `radius` & optional `duration`. Fallback: ring decal.
- summon: e.g. `'garrok_wolf'`, `'bram_wall'`, `'lumi_mark'`, `'mire_totem'`.

VFX keys follow `<heroId>_<slot>` (slot: p,q,w,r) plus suffixes (`_hit`, `_end`). Unknown → generic fallback by event type. Agent A lists all keys used in `src/data/heroes/VFX_KEYS.md`.

## Heroes (8, data-driven) — passive / Q / W / R(ult at lvl5)
No mana. Cooldowns only. Single damage type. `power` scales both autos and abilities.
Auto-attack damage = `stats.power * hero.attackRatio` (default 1.0) before armor.
Damage formula: `eff = max(0, armor*(1-armorPen))`, `dmg = raw * 100/(100+eff)`.
Ability "ranks": abilities scale with hero level automatically (base + perLevel*level) — no skill points.
Augments at levels 3/6/9: choose one of two one-line mods (per hero, each targets an ability).

1. bram — Ironroot Warden (tank)  2. kaela — Ember Duelist (fighter)  3. lumi — Starweaver (mage)
4. vex — Longshot (marksman)  5. nyx — Shadowstep (assassin)  6. pip — Pip & Bolt (support)
7. mire — Bog Witch (controller)  8. garrok — Beastcaller (jungler)

### Hero def schema (`src/data/heroes/<id>.js`, default export)
```js
export default {
  id:'bram', name:'Bram', title:'Ironroot Warden', role:'Tank', difficulty:1..3,
  color:'#7fb069', lore:'one-liner',
  base:{ maxHp, power, armor, attackRange, attackSpeed, moveSpeed, hpRegen },
  growth:{ maxHp, power, armor, attackSpeed, hpRegen },   // per level
  attackRatio:1, ranged:false, projectile:null|'auto_vex',
  abilities:{
    passive:{ name, desc },
    q:{ name, desc, cd, range, targeting:'skillshot'|'point'|'unit'|'self'|'area', tags:['engage','poke','escape','peel','farm','burst','cc','heal','shield','zone'], cast(api, hero, aim) },
    w:{...}, r:{...},
  },
  augments:{ 3:{a:{name,desc}, b:{...}}, 6:{...}, 9:{...} },
  hooks:{ onTick?, onAttackHit?, onDamageDealt?, onDamageTaken?, onKill?, onCast? },
  bot:{ preferredRole:'lane'|'jungle'|'support', comboOrder:['w','q','r'] },
}
```
`src/data/heroes/index.js` exports `HEROES` (array) and `HERO_BY_ID`.

### Items / relics / sigils schemas
```js
// src/data/items.js — exports ITEMS (array), ITEM_BY_ID
{ id:'warblade', name, icon:'⚔', category:'offense'|'defense'|'utility',
  tiers:[ {cost, stats:{power:12}, desc},                   // tier1 (base)
          {cost, stats:{...}, desc},                         // tier2
        ],
  branches:{ a:{ id:'bloodedge', name, icon, cost, stats, desc, passive?:{...} },
             b:{ id:'rendblade', name, icon, cost, stats, desc, passive?:{...} } },
  unlock:{ cost:0 } }   // unlock price in meta currency (0 = starter)
// path per slot: tier1 → tier2 → branch (a|b). 3 purchases per slot.

// src/data/relics.js — exports RELICS, RELIC_BY_ID
{ id:'blink', name, icon, cd, desc /*spell*/, bonusDesc /*built-in bonus*/, targeting, cast(api, hero, aim), hooks?, unlock:{cost} }

// src/data/sigils.js — exports SIGILS, SIGIL_BY_ID
{ id:'piercing', slot:'offense'|'utility', name, icon, desc, stats?:{armorPen:0.08}, hooks?, unlock:{cost} }
```

## Skins (`src/data/skins.js`, Agent B) — exports SKINS, SKIN_BY_ID
`{ id:'bram_default', heroId:'bram', name:'Default', rarity:'default'|'common'|'epic'|'legendary', price:{essence?:n, prisms?:n}, desc, colors:{...} }`
Render looks up the recipe by skin id.

## Meta / economy (Agent C)
Currencies: **Essence** (earned every match), **Prisms** (rare: quests, account level-ups, first win of day).
Unlockables: heroes, skins, relics, sigils, items(advanced), profile flair (titles, banners, borders, icons, emotes).
Save: localStorage key `groundswell_save_v1`, plus export/import save code (base64 JSON w/ checksum).
P2P later: players only use what they've earned.

## main.js flow
`boot → meta UI (menu) → onStartMatch(config) → create Match + Renderer + HUD + Input → loop → match_end → results screen (meta grants rewards) → menu`.
Interfaces:
```js
// render (Agent B): src/render/renderer.js
export class Renderer { constructor(canvas); setMatch(match, localPlayerId); render(alpha, frameDt); resize(w,h);
  screenToWorld(sx, sy) -> {x,y} (sim coords on ground); worldToScreen(x,y) -> {sx,sy,visible};
  setCameraFollow(bool); panCamera(dx,dy); dispose(); }
// Optional: renderer.menuScene(canvas) for animated hero preview in menus: export function createHeroPreview(container, heroId, skinId) -> {setHero(heroId, skinId), dispose()}

// UI (Agent C): src/ui/app.js
export class App { constructor(rootEl, { startMatch(config), createHeroPreview }); showMenu(); showResults(match, rewards) }
// src/ui/hud.js
export class Hud { constructor(rootEl, match, renderer, localPlayerId); update(frameDt); dispose(); }
// src/ui/input.js
export class Input { constructor(canvas, match, renderer, localPlayerId, hud); update(frameDt); dispose(); }
```
