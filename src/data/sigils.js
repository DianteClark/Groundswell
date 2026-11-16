// Sigils: one offense + one utility per loadout. Owner: Agent A.
export const SIGILS = [
  // ---------------- offense ----------------
  { id: 'piercing', slot: 'offense', name: 'Piercing', icon: '🔱', desc: '+8% Armor Pen.', stats: { armorPen: 0.08 }, unlock: { cost: 0 } },
  { id: 'fervor', slot: 'offense', name: 'Fervor', icon: '💢', desc: '+0.1 Attack Speed.', stats: { attackSpeed: 0.1 }, unlock: { cost: 0 } },
  { id: 'focus', slot: 'offense', name: 'Focus', icon: '🌀', desc: '+10 Haste.', stats: { haste: 10 }, unlock: { cost: 0 } },
  { id: 'executioner', slot: 'offense', name: 'Executioner', icon: '💀', desc: 'Deal 8% more damage to champions below 35% HP.', unlock: { cost: 350 },
    hooks: { modifyDamageDealt(api, h, t, info) { if (t.kind === 'hero' && t.hp < t.maxHp * 0.35) info.amount *= 1.08; } } },
  { id: 'arcane_edge', slot: 'offense', name: 'Arcane Edge', icon: '📜', desc: 'Abilities deal 6% more damage.', unlock: { cost: 400 },
    hooks: { modifyDamageDealt(api, h, t, info) { if (info.type === 'ability') info.amount *= 1.06; } } },
  { id: 'brawler', slot: 'offense', name: 'Brawler', icon: '🥊', desc: '+5 Power and +4% Lifesteal.', stats: { power: 5, lifesteal: 0.04 }, unlock: { cost: 300 } },
  { id: 'first_strike', slot: 'offense', name: 'First Strike', icon: '🎯', desc: 'Your first hit on a champion every 8s deals 30 (+6/lvl) bonus damage.', unlock: { cost: 500 },
    hooks: { modifyDamageDealt(api, h, t, info) { if (t.kind !== 'hero' || info.type === 'true' || (h.data._fsAt ?? -99) + 8 > api.time) return; h.data._fsAt = api.time; info.amount += 30 + 6 * (h.level - 1); } } },
  { id: 'predator', slot: 'offense', name: 'Predator', icon: '🐾', desc: '+15% damage to monsters; +4 Power.', stats: { power: 4 }, unlock: { cost: 300 },
    hooks: { modifyDamageDealt(api, h, t, info) { if (t.kind === 'monster') info.amount *= 1.15; } } },
  // ---------------- utility ----------------
  { id: 'swiftness', slot: 'utility', name: 'Swiftness', icon: '🪶', desc: '+10% Move Speed out of combat.', unlock: { cost: 0 },
    hooks: { computeStats(api, h, s) { if (!api.inCombat(h, 3)) s.moveSpeed *= 1.1; } } },
  { id: 'vitality', slot: 'utility', name: 'Vitality', icon: '💚', desc: '+70 HP and +1.5 HP Regen.', stats: { maxHp: 70, hpRegen: 1.5 }, unlock: { cost: 0 } },
  { id: 'steadfast', slot: 'utility', name: 'Steadfast', icon: '⚓', desc: '+20% Tenacity (crowd control durations reduced).', unlock: { cost: 0 },
    hooks: { computeStats(api, h, s) { s.tenacity = (s.tenacity || 0) + 0.2; } } },
  { id: 'homeward', slot: 'utility', name: 'Homeward', icon: '🏠', desc: 'Recall is 3s faster and respawn is 15% faster.', unlock: { cost: 350 },
    hooks: {
      onTick(api, h) { if (h.recalling && !h.recalling._hw) { h.recalling._hw = true; h.recalling.until -= 3; } },
      onDeath(api, h) { if (h.respawnAt) h.respawnAt = api.time + (h.respawnAt - api.time) * 0.85; },
    } },
  { id: 'thick_skin', slot: 'utility', name: 'Thick Skin', icon: '🦔', desc: '+8 Armor.', stats: { armor: 8 }, unlock: { cost: 300 } },
  { id: 'lifeline', slot: 'utility', name: 'Lifeline', icon: '🛟', desc: 'Dropping below 30% HP grants a shield of 15% max HP for 3s (60s cd).', unlock: { cost: 500 },
    hooks: { onDamageTaken(api, h) { if (h.alive && h.hp < h.maxHp * 0.3 && (h.data._llAt ?? -99) + 60 <= api.time) { h.data._llAt = api.time; api.shield(h, h.maxHp * 0.15, 3, 'lifeline', h); api.vfx('sigil_lifeline', { x: h.x, y: h.y, targetId: h.id, team: h.team }); } } } },
  { id: 'trailblazer', slot: 'utility', name: 'Trailblazer', icon: '🌲', desc: '+12% Move Speed in the jungle and river.', unlock: { cost: 400 },
    hooks: { computeStats(api, h, s) { if (h.x > 60 && h.x < 180 && h.y > 34 && h.y < 126) s.moveSpeed *= 1.12; } } },
  { id: 'haste_charm', slot: 'utility', name: 'Hourglass', icon: '⌛', desc: '+8 Haste; relic cooldown 15% shorter.', stats: { haste: 8 }, unlock: { cost: 450 },
    hooks: { onCast(api, h, slot) { if (slot === 'relic') { const st = h.abilities.relic; const rem = st.readyAt - api.time; if (rem > 0) api.reduceCooldown(h, 'relic', rem * 0.15); } } } },
];
export const SIGIL_BY_ID = Object.fromEntries(SIGILS.map(s => [s.id, s]));
