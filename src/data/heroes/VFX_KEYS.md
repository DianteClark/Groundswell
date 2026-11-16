# VFX / visual keys used by heroes, relics, items, sigils (Agent A)

All one-shot effects are `{t:'vfx', key, x, y, tx?, ty?, radius?, duration?, team, srcId?, targetId?, angle?, ...extra}` events.
Unknown keys should fall back to a generic effect. "line" = draw from (x,y) to (tx,ty). "ring" = circle of `radius` at (x,y).
"attached" = follow `targetId` for `duration`.

## Bram (`#7fb069`)
| key | kind | notes |
|---|---|---|
| `bram_q` | line (dash trail) | shield-charge from (x,y) → (tx,ty), ~0.3s |
| `bram_q_hit` | impact on `targetId` | stun slam |
| `bram_w` | wall raise | center (x,y), `angle` = wall orientation, `radius` 4 (half-length), `duration` |
| `bram_r` | ring telegraph | grove (radius 7/9) pulling inward for `duration` 2s; also an **area** with `visual.model='bram_r'` |
| `bram_r_end` | ring burst | root snap at end |
| summon `bram_wall` | static summon (wall segment) | 3 segments, radius 1.45, untargetable, team 2 |
| status `bark` (`stacks` 1..6) | aura on hero | armor stacks while standing still |

## Kaela (`#ff6b35`)
| key | kind | notes |
|---|---|---|
| `kaela_q`, `kaela_q2` | line (flame lunge) | `hot:true` when empowered |
| `kaela_w` | attached shield, `duration` | parry stance |
| `kaela_w_hit` | ring burst radius 4.5 | `hot` flag → stun version |
| `kaela_r` | attached transform, `duration` 8–11s | + area `kaela_r_aura` (radius 4, follows her) |
| `kaela_p` | attached, `duration` 4 | Overheat begins |
| statuses | `overheat`, `parry`, `inferno` | |

## Lumi (`#9b8cff`)
| key | kind | notes |
|---|---|---|
| projectile `lumi_q` | skillshot bolt | |
| `lumi_q_hit` | impact | |
| `lumi_mark` | star appears (summon `lumi_mark`, 6s, untargetable) | |
| `lumi_p` | constellation telegraph | `points:[{x,y}×3]` triangle, `duration` 0.5 |
| `lumi_p_hit` | constellation detonation | `points` |
| `lumi_w` | ring telegraph | radius 4.5, `duration` = delay (also area `lumi_w`) |
| `lumi_w_hit` | implosion | |
| `lumi_r` | ring telegraph + `points` (marks flying in) | area `lumi_r` |
| `lumi_r_hit` | big implosion | |
| projectile `auto_lumi` | auto attack | |

## Vex (`#e0c341`)
| key | kind | notes |
|---|---|---|
| projectile `vex_q` | skillshot + bouncing homing shots (same key) | |
| `vex_w` | line (roll) | |
| `vex_w_hit` | empowered shot impact | |
| `vex_p` | line (piercing round) | every 4th shot |
| `vex_r_charge` | line telegraph (laser sight), `duration` = channel | |
| `vex_r` | line (muzzle + tracer) | projectile `vex_r` (fast, 45m) |
| `vex_r_hit` | impact | |
| projectile `auto_vex` | auto | |
| statuses | `vex_loaded` (W buff), `vex_ready` (next shot pierces) | |

## Nyx (`#7a3cff`)
| key | kind | notes |
|---|---|---|
| `nyx_q` | line (shadow dash) | leaves summon `nyx_afterimage` (static ghost, 3.5s) |
| `nyx_q_swap` | line (swap back) | |
| `nyx_w`, `nyx_w_iso` | impact on target | `_iso` = isolated bonus version (bigger) |
| `nyx_p` | attached small flare | passive primed |
| `nyx_p_hit` | impact | primed hit consumed |
| `nyx_r` | dome ring radius 7.5, `duration` 4–5.5 | also area `nyx_r` |
| statuses | `shadow_primed`, `invisible` (on Nyx), `blind` (enemies) | |

## Pip & Bolt (`#3cc6e0`)
| key | kind | notes |
|---|---|---|
| summon `pip_bolt` | persistent mech | invulnerable/untargetable, follows ward |
| projectile `pip_q` | wrench (homing, bounces) | |
| `pip_q` | throw (line) | |
| `pip_q_hit`, `pip_q_heal` | impact / heal sparkle | |
| `pip_p` | Bolt shield pulse on `targetId` | |
| `pip_w` | tether `srcId`→`targetId`, `duration` | status `overclock` on ally |
| `pip_r` | ring telegraph on ally, `duration` 0.8 | Bolt launched (status `airborne` on Bolt) |
| `pip_r_hit` | crash ring radius 4.5 | |
| status `pip_guard` | on guarded ally | |
| projectile `auto_pip` | auto | |

## Mire (`#4a8c5c`)
| key | kind | notes |
|---|---|---|
| `mire_q` | lob arc (x,y)→(tx,ty), `duration` 0.35 | then area `mire_q` (pool) |
| `mire_w` | totem spawn | summon `mire_totem` (targetable, static) |
| projectile `mire_w_zap` | totem zap | |
| `mire_w_root` | root on `targetId` | |
| `mire_r` | **map change** (swamp): `{x,y,radius:13,duration,kind:'swamp',phase:'apply',zone:{x,y,r},at}` | also area `mire_r` |
| `mire_r_end` | `{kind:'swamp', phase:'end'}` | swamp recedes |
| status `bog_blood` | healing in own zones | |
| projectile `auto_mire` | auto | |

## Garrok (`#b5651d`)
| key | kind | notes |
|---|---|---|
| summon `garrok_wolf` / `garrok_wolf_alpha` | companion / temporary R wolf | |
| `garrok_wolf_spawn` | spawn puff | |
| `garrok_q` | leap arc (x,y)→(tx,ty) | |
| `garrok_q_hit` | landing ring radius 3.2 | |
| `garrok_w` | roar ring radius 6 | status `fear` on enemies |
| `garrok_r` | mark on `targetId`, `duration` 8 | status `alpha_mark` + `revealed` |
| `garrok_p` | Bond gained | |

## Relics / items / sigils
`relic_blink` (line), `relic_brand` (impact on target), `relic_barrier` (attached), `relic_heal`, `relic_ghost` (attached),
`relic_purify`, `relic_ignite` (attached burn, status `burning`+`grievous`), `relic_lantern` (summon `relic_lantern`, invisible ward),
`item_stormbow`, `item_nullveil`, `sigil_lifeline`. Statuses: `armorShred` (stacks), `nullveil`, `ghosted`, `unstoppable`.

## Generic statuses Agent A applies
`stun`, `root`, `slow`(amount), `speed`(amount), `silence`, `blind`, `taunt`(sourceId), `knockup`, `fear`, `revealed`, `invisible`,
`unstoppable`, `grievous`, `armorShred`(amount).

## Hero resource readout (for HUD)
`hero.resource = { name, value, max, color }` — Bram "Bark", Kaela "Heat", Lumi "Stars", Vex "Shots", Nyx "Veil", Pip "Guarding", Garrok "Bond".
Recast windows: `hero.abilities[slot].recastUntil` (sim time) is set while a recast is available (Kaela Q, Nyx Q).
