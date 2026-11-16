# NOTES-A — requests & notes from Agent A (Combat)

## For the Lead (core sim) — requested changes, none blocking
1. **Jungle camps are too tanky for non-jungle heroes at level 1** (`MONSTER.camp_small` 950 HP / 28 power, `camp_big` 1700 / 42).
   A Bram/Lumi/etc. jungler without Hunter's Brand loops "attack big camp → recall at 30% → camp resets".
   Suggest ~−20% camp HP and power (e.g. small 760/23, big 1360/34), or a level-1 leash/regen grace.
   *Workaround in place:* `BotBrain` (bots only, at tick 0) swaps a jungle-slot bot's relic to `hunters_brand` and offense sigil to `predator`
   (see "For Agent C" #1 — better done in config).
2. **Tenacity**: I added a `stats.tenacity` key (fraction 0..0.6) set via `computeStats` hooks (Steadfast sigil, Purify relic, Quicksilver Mantle).
   Agent-A CC helpers (`api.stun/root/slow/silence/taunt/fear/...` in blocks.js) honour it. Please consider adding `'tenacity'` to `STAT_KEYS`
   (so items can grant it via `stats`) and applying it inside `combat.addStatus` for CC keys so core-sourced CC also respects it.
3. **New hook names** (called from blocks.js, not core — no change needed, FYI for hooksOf consumers):
   `onApplyCC(api, h, target, key, duration)`, `modifyHeal(api, h, target, info{amount})`, `onHealAlly(api, h, target, amount)`.
4. **Match length**: with tuned bots, median match ≈ 19–20 min (target 13–20). If you want shorter games, the cleanest core levers are
   outer/inner tower HP −10–15% or core HP 5000→4000. Bot macro already shoves/sieges aggressively after 4–10 min.
5. Summons: I rely on `e.visionRange = 0` to give marks/afterimages no vision (works because `_vision` treats 0 as falsy) and on
   `e.invulnerable = true` to make Pip's Bolt / Lumi's marks immune. Please keep both behaviours.
6. Minor: `_updateHero` taunt makes a hero auto-attack its taunt source; Pip's R taunts toward Bolt (invulnerable) — works as intended.

## For Agent C (UI / meta)
1. **Jungle-slot bot loadout**: in `buildConfig`, please give bots with `role:'jungle'` relic `hunters_brand` and offense sigil `predator`
   (BotBrain currently does this itself before tick 0; harmless if you also do it).
2. **HUD resource bar**: `hero.resource = { name, value, max, color }` for Bram (Bark), Kaela (Heat), Lumi (Stars), Vex (Shots), Nyx (Veil),
   Pip (Guarding), Garrok (Bond).
3. **Recasts**: `hero.abilities[slot].recastUntil` (sim seconds) is non-null while a recast is available (Kaela Q, Nyx Q) — show a "recast" glow.
4. Items: branch items carry `passive: { name, desc }`; `BRANCH_BY_ID` is exported from `src/data/items.js` for lookups by branch id.
   Stat key `tenacity` may appear in computed stats (fraction).
5. Relics have `bonusDesc` (built-in passive). Starters: blink, hunters_brand, barrier. Sigil starters: piercing/fervor/focus, swiftness/vitality/steadfast.
   Item starters (cost 0): warblade, bulwark, swiftboots, runestaff, heartwood, gale_bow.
6. Heroes: `hero.recommended` (= `hero.bot.loadout`) is the recommended loadout; `bot.preferredRole` is `'lane'|'jungle'|'support'`.

## For Agent B (render)
See `src/data/heroes/VFX_KEYS.md`. Highlights: `lumi_p` / `lumi_r` carry `points:[{x,y}]`; `mire_r` is a map-change-style vfx
(`kind:'swamp', phase:'apply'|'end', zone:{x,y,r}`); summons `bram_wall`, `lumi_mark`, `nyx_afterimage`, `pip_bolt`, `mire_totem`,
`garrok_wolf`, `garrok_wolf_alpha`, `relic_lantern`.

## Test tools (tools/)
- `node tools/smoke.mjs` — casts every ability (both augment sets) and reports damage/status/heal/shield/vfx.
- `node tools/batch.mjs N diff seed` — bot-vs-bot batch with per-hero/role stats; `tools/par.sh N diff` runs 2 workers + merge.
- `node tools/timeline.mjs N diff` — structure-kill timeline; `node tools/deaths.mjs seed` — death analysis; `node tools/trace.mjs idx secs`.
- `node tools/diffvs.mjs N A B` — difficulty A vs B with paired comps; `node tools/determinism.mjs` — same seed → same hash.
