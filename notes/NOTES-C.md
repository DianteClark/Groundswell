# NOTES from Agent C (Meta/UI)

## Integration (already matches src/main.js)
- `new App(root, { startMatch, createHeroPreview, quitMatch, onSettings? })`. App shows a ~2.6s loading screen, hides itself, then calls `startMatch(config)`.
  Config players have `lane`/`role` set, plus extra `level`, `mastery`, `difficulty` (ignored by sim).
- `app.getSettings()` → `{ quality:'low'|'med'|'high', master, sfx, music, camera:'follow'|'free', touchSize, edgePan, showFps, champPriority, qualitySetting }`.
- `app.showResults(match, null)` computes and saves rewards from `match` (+ the config App launched).
- `new Hud(hudRoot, match, renderer, pid, opts?)` (opts: `{touch?:bool}` override). HUD menu "Surrender / Quit" calls `window.__gsQuit()`.
- `new Input(canvas, match, renderer, pid, hud)`. `update(dt)` is safe to call per tick or per frame.

## Requests
- Lead: `quitMatch` currently returns to menu with no results. Suggest `const m = match; endSession(); app.showResults(m, null);` instead — results then show "MATCH LEFT" with 50% loss rewards (stats/quests still count). Optional.
- Agent B (optional, all guarded with `?.`): `renderer.showIndicator({slot, heroId, x, y, tx?, ty?, range, targeting, cancel?})` / `renderer.hideIndicator()` for range/aim indicators (desktop hover on ability buttons, mobile drag-aim);
  `renderer.showClickMarker(x, y, 'move'|'attack')`; `renderer.focusOn(x, y)` for minimap camera jumps (currently falls back to setCameraFollow(false)+panCamera delta).
- Skins: meta reads `src/data/skins.js` via `src/meta/skins_source.js`; skin price falls back by rarity if `price` is empty.

## Polish round (v0.2)
- HUD reads `hero.resource {name,value,max,color}` (pips if max ≤ 12, else a bar) and `abilities[slot].recastUntil` (gold pulsing glow).
- Auto-buy: setting `autoBuy` (null = ON for touch). HUD buys the next non-branch step while `canShop` and affordable; toggle in the shop panel + Settings. Without auto-buy: "Buy starting item" hint + pulsing quick-buy at fountain.
- Jungle bots get `hunters_brand` + `predator`; junglers without Hunter's Brand see an "Equip" hint on Play setup.
- `opts.renderHeroPortrait(heroId, skinId, {size, pose:'hero'|'idle', bg:'transparent'})` is used everywhere hero art appears (cached per hero/skin/size); falls back to crest placeholder.
- Agent B: current `src/render/models/heroes.js` crashes the main bundle at load: `HERO_RECIPES = { ..., pip, ... }` → "pip is not defined".
