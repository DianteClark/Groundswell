# NOTES-B (Art / Render) — Groundswell

## Renderer usage
- `new Renderer(canvas)`; `resize(w,h)` takes CSS pixels; renderer sets the drawing buffer itself (`setSize(w,h,false)` – canvas CSS size is left to the page, make it fill the viewport).
- `screenToWorld(sx,sy)` / `worldToScreen(x,y[,h])`: `sx,sy` are CSS pixels **relative to the canvas top-left** (Input's `_rel` already does this).
- `setQuality('low'|'med'|'high')` any time. Adaptive pixel-ratio scaling runs automatically (0.6–1.0 of the quality's base ratio).
- `panCamera(dx,dy)` is in sim units. While following, it adds an offset (±30) that resets on `setCameraFollow(true)`; when not following it moves the free camera.
- `renderer.revealAll = true` disables fog-of-war hiding (spectator/debug).
- Fog of war: enemies with `e.vis[localTeam] === false` are hidden (also their bars). Invisible allies render at 38% opacity.

## What I read from the sim
`match.entities`, `match.heroes`, `match.eventLog` (falls back to `match.events`), `match.map` (lanes, obstacles, brush, river{x0,x1,y0,y1|polygon}, bases, fountains, pits, camps), `match.objectives.wyrm.{alive,element,nextElement}`, `match.objectives.colossus.alive`, `match.time`.
Entity fields: x,y,prevX,prevY,facing,kind,team,alive,hp,maxHp,shield,radius,statuses,anim{state,t},visual{model,skinId,element},vis,
ownerId/srcId (projectiles/areas/summons -> owner's skin colors), endAt (areas fade out), recalling{start,until}, wall, monsterType, element, level, playerId, heroId.

## Requests
- Agent A: VFX events are handled generically by shape: `tx/ty` → beam (`*_r` = thick ult beam, `*charge*|*aim*` = thin laser sight, `*blink*|*swap*` = flash at both ends);
  `radius+duration` → filling ground telegraph; `targetId+duration` → aura that follows the unit; `points:[...]` → connected constellation lines; `*_hit` → impact burst.
  Projectile looks are chosen by hero prefix (vex=bolt, lumi=star, pip=zap, mire=bubble, kaela=fire crescent, nyx=spinning dagger, garrok=spear, bram=rock). Summons: garrok_wolf, mire_totem, lumi_mark, bram_wall, pip_*, *_afterimage (ghost copy of owner), relic_lantern/*ward*, wall; anything else = crystal obelisk.
- Lead: zone areas `zone_flood|ember|gale|stone|swamp` + `mapchange` telegraph/apply are fully rendered (ground "swell" heave + erupting shards on apply).

## v0.2 additions
- `renderHeroPortrait(heroId, skinId, {size=256, pose:'idle'|'action', bg=true, framing:'bust'|'full'}) -> dataURL` (preview.js). Cached by key, shared WebGL context, ~10–30 ms each uncached. `renderHeroPortraitAsync(...)` -> Promise, runs on an idle callback; use it for big grids (shop/loading).
- Renderer hooks: `showIndicator({slot, heroId, targeting|kind, range, radius?, width?, x, y, tx?, ty?, dirX?, dirY?, cancel?})`, `hideIndicator()`, `showClickMarker(x, y, 'move'|'attack')`, `focusOn(x, y)` (snaps the camera there and turns follow off).
  The indicator follows the local hero every frame. Default radius/width per ability come from a table in renderer.js (AIM_RADIUS / AIM_WIDTH), because ability defs don't carry them. Pass `radius`/`width` to override.
- In-game Pip renders as the gnome on foot. Bolt is the `pip_bolt` summon (mech, skin-coloured, lifted while `airborne`). Menus/previews/portraits still show the duo.
- Every key in VFX_KEYS.md has a hand-made effect (src/render/abilityfx.js). Unknown keys still use the generic fallbacks.
