// Skins (Agent B). Schema per SPEC: { id, heroId, name, rarity, price, desc, colors }
// Extra render fields: parts (model part variants), fx (ability particle style), recall (recall effect style), trail.
// colors.vfx / colors.vfx2 tint that hero's ability VFX.

const C = { essence: 1500 }, E = { prisms: 400 }, L = { prisms: 1000 };
const s = (heroId, key, name, rarity, price, desc, colors, parts = {}, extra = {}) => ({
  id: `${heroId}_${key}`, heroId, name, rarity, price, desc, colors, parts,
  fx: extra.fx || 'sparks', recall: extra.recall || 'default', trail: extra.trail || null,
});

export const SKINS = [
  // ── BRAM — Ironroot Warden ─────────────────────────────────────────
  s('bram', 'default', 'Ironroot Warden', 'default', {}, 'An ancient guardian of the deepwood.',
    { primary: '#6b4a2b', secondary: '#8a6238', accent: '#6fbf3f', metal: '#7d8a90', skin: '#4d3520', glow: '#b8ff6a', vfx: '#8cff5a', vfx2: '#e2ffb0' },
    { shield: 'stone', crown: 'leaves' }, { fx: 'leaves' }),
  s('bram', 'frostbark', 'Frostbark Bram', 'common', C, 'Bark hardened by a thousand winters.',
    { primary: '#7c8fa3', secondary: '#a8bccd', accent: '#d8f3ff', metal: '#9fd3f0', skin: '#56677a', glow: '#8ff0ff', vfx: '#7fe3ff', vfx2: '#ffffff' },
    { shield: 'crystal', crown: 'icicles' }, { fx: 'snow' }),
  s('bram', 'blossom', 'Blossom Warden Bram', 'epic', E, 'Spring wakes, and so does he. Petals follow every step.',
    { primary: '#5a3b2a', secondary: '#7a4f36', accent: '#ff9ad5', metal: '#e8d6c0', skin: '#3f2a1c', glow: '#ffc4ea', vfx: '#ff8acb', vfx2: '#fff0f8' },
    { shield: 'flower', crown: 'blossom' }, { fx: 'petals', recall: 'petals' }),
  s('bram', 'magmaroot', 'Magmaroot Bram', 'legendary', L, 'Roots that drank from the world\'s molten heart. The ground cracks where he walks.',
    { primary: '#2a2226', secondary: '#3d3035', accent: '#ff6a1a', metal: '#4a3b3a', skin: '#1c1618', glow: '#ffb02e', vfx: '#ff6a1a', vfx2: '#ffe08a' },
    { shield: 'magma', crown: 'horns' }, { fx: 'embers', recall: 'eruption', trail: 'embers' }),

  // ── KAELA — Ember Duelist ──────────────────────────────────────────
  s('kaela', 'default', 'Ember Duelist', 'default', {}, 'Twin blades, one temper.',
    { primary: '#b8322a', secondary: '#2d2a33', skin: '#e8b48c', hair: '#ff7a2a', metal: '#d9d9e0', glow: '#ff8a2a', vfx: '#ff7a1f', vfx2: '#ffd36b' },
    { blades: 'sabre', hair: 'pony' }, { fx: 'embers' }),
  s('kaela', 'jade', 'Jade Duelist Kaela', 'common', C, 'Trained in the temple of green flame.',
    { primary: '#2f8a5c', secondary: '#1d2b26', skin: '#e8b48c', hair: '#1b1b1b', metal: '#e0e6d8', glow: '#5cff9d', vfx: '#45f08c', vfx2: '#d6ffe6' },
    { blades: 'sabre', hair: 'bun' }, { fx: 'sparks' }),
  s('kaela', 'azure', 'Azureflame Kaela', 'epic', E, 'She stole fire from a frozen star.',
    { primary: '#1d3d8f', secondary: '#e8ecf5', skin: '#f0c4a0', hair: '#bfe6ff', metal: '#cfe8ff', glow: '#4fc3ff', vfx: '#3fb6ff', vfx2: '#e6f8ff' },
    { blades: 'katana', hair: 'pony' }, { fx: 'bluefire', recall: 'flamepillar' }),
  s('kaela', 'solar', 'Solar Empress Kaela', 'legendary', L, 'Crowned by the dawn. Every strike is a sunrise.',
    { primary: '#f2e6c8', secondary: '#d4a52a', skin: '#c98d62', hair: '#fff2b0', metal: '#ffd75a', glow: '#fff07a', vfx: '#ffd23a', vfx2: '#ffffff' },
    { blades: 'sun', hair: 'crown' }, { fx: 'sunfire', recall: 'sunburst', trail: 'sunfire' }),

  // ── LUMI — Starweaver ──────────────────────────────────────────────
  s('lumi', 'default', 'Starweaver', 'default', {}, 'She stitches starlight into spells.',
    { primary: '#5b3fb5', secondary: '#2a1f5c', skin: '#f2d0b8', hair: '#f6e7ff', metal: '#d9b45a', glow: '#ffe27a', vfx: '#b48cff', vfx2: '#ffe9a8' },
    { staff: 'star', hat: 'hood' }, { fx: 'stars' }),
  s('lumi', 'moonpetal', 'Moonpetal Lumi', 'common', C, 'Woven from moonlight and quiet gardens.',
    { primary: '#9fb6d9', secondary: '#e7eef8', skin: '#f2d6c4', hair: '#c9d8ff', metal: '#e8e8f0', glow: '#cfe6ff', vfx: '#a8cfff', vfx2: '#ffffff' },
    { staff: 'moon', hat: 'tiara' }, { fx: 'stars' }),
  s('lumi', 'nebula', 'Nebula Lumi', 'epic', E, 'A pocket galaxy, just for her.',
    { primary: '#c2357f', secondary: '#1d1b45', skin: '#e9c0a8', hair: '#5ef0e2', metal: '#38e0d0', glow: '#ff7ad9', vfx: '#ff5fc8', vfx2: '#6ff7ea' },
    { staff: 'tristar', hat: 'hood' }, { fx: 'nebula', recall: 'nebula' }),
  s('lumi', 'celestial', 'Celestial Lumi', 'legendary', L, 'The night sky bends to her will; constellations answer her call.',
    { primary: '#f4f0ff', secondary: '#1a1f4d', skin: '#f6e2d2', hair: '#fff6d6', metal: '#ffd86a', glow: '#ffffff', vfx: '#ffe28a', vfx2: '#9ad0ff' },
    { staff: 'galaxy', hat: 'halo' }, { fx: 'constellation', recall: 'galaxy', trail: 'stars' }),

  // ── VEX — Longshot ─────────────────────────────────────────────────
  s('vex', 'default', 'Longshot', 'default', {}, 'Never misses. Never explains.',
    { primary: '#6b4a32', secondary: '#2e9c9c', skin: '#d9a07a', hair: '#3a2416', metal: '#5a5f66', wood: '#8a5a32', glow: '#ffd04a', vfx: '#ffcf40', vfx2: '#fff3c0' },
    { hat: 'tricorn', rifle: 'long' }, { fx: 'sparks' }),
  s('vex', 'desert', 'Dune Ranger Vex', 'common', C, 'Sand in the barrel, sun in the eyes. Still hits.',
    { primary: '#c79a5b', secondary: '#b5422e', skin: '#b5754f', hair: '#2a1a10', metal: '#8a7a66', wood: '#6b4223', glow: '#ff9b40', vfx: '#ffa040', vfx2: '#ffe6b8' },
    { hat: 'wide', rifle: 'long' }, { fx: 'sparks' }),
  s('vex', 'neon', 'Neon Circuit Vex', 'epic', E, 'Downloaded from the grid. Targets uploaded.',
    { primary: '#16141f', secondary: '#ff2fd6', skin: '#e0b090', hair: '#00f0ff', metal: '#22202e', wood: '#2c2a3a', glow: '#00f0ff', vfx: '#00e8ff', vfx2: '#ff38e0' },
    { hat: 'visor', rifle: 'neon' }, { fx: 'pixels', recall: 'glitch', trail: 'pixels' }),
  s('vex', 'dragon', 'Dragonslayer Vex', 'legendary', L, 'Her rifle is carved from the jaw of the last red wyrm.',
    { primary: '#3a1414', secondary: '#d9a33a', skin: '#d9a07a', hair: '#e8e0d0', metal: '#2a2020', wood: '#e8dcc0', glow: '#ff4a1a', vfx: '#ff5a1f', vfx2: '#ffd27a' },
    { hat: 'dragon', rifle: 'dragon' }, { fx: 'embers', recall: 'dragonfire', trail: 'embers' }),

  // ── NYX — Shadowstep ───────────────────────────────────────────────
  s('nyx', 'default', 'Shadowstep', 'default', {}, 'You only see her once.',
    { primary: '#2a2238', secondary: '#4e3a7a', skin: '#bfa8d8', metal: '#c8c0e0', glow: '#b06bff', vfx: '#9b5cff', vfx2: '#e0c8ff' },
    { hood: 'hood', blades: 'dagger' }, { fx: 'wisps' }),
  s('nyx', 'crimson', 'Crimson Veil Nyx', 'common', C, 'The red veil is the last thing they remember.',
    { primary: '#3a1218', secondary: '#9c1f2e', skin: '#d8b0a8', metal: '#e0c8c8', glow: '#ff3a4a', vfx: '#ff3048', vfx2: '#ffc0c8' },
    { hood: 'hood', blades: 'dagger' }, { fx: 'wisps' }),
  s('nyx', 'moonblade', 'Moonblade Nyx', 'epic', E, 'Silver crescents under a silent moon.',
    { primary: '#1c2440', secondary: '#9fb4e0', skin: '#c8d4ec', metal: '#eef4ff', glow: '#9fe0ff', vfx: '#8fd8ff', vfx2: '#ffffff' },
    { hood: 'moon', blades: 'crescent' }, { fx: 'moonmotes', recall: 'moonrise' }),
  s('nyx', 'void', 'Void Empress Nyx', 'legendary', L, 'Between one heartbeat and the next lies her kingdom.',
    { primary: '#0c0812', secondary: '#ff2fa8', skin: '#6a4a8a', metal: '#1a1024', glow: '#ff3fd0', vfx: '#ff3fd0', vfx2: '#7a3cff' },
    { hood: 'horns', blades: 'void' }, { fx: 'void', recall: 'voidrift', trail: 'void' }),

  // ── PIP & BOLT — Tinker Duo ───────────────────────────────────────
  s('pip', 'default', 'Pip & Bolt', 'default', {}, 'One brain, one wrench, one very big robot.',
    { primary: '#2f7fb5', skin: '#f2c8a0', hair: '#ff8a3a', mech: '#f2c230', mech2: '#3a3f4a', metal: '#9aa4ae', glow: '#5cf2ff', vfx: '#4fe8ff', vfx2: '#fff3a0' },
    { hat: 'goggles', mech: 'boxy' }, { fx: 'sparks' }),
  s('pip', 'rustbucket', 'Rustbucket Pip', 'common', C, 'Held together by tape and optimism.',
    { primary: '#6b5a3a', skin: '#f2c8a0', hair: '#c94a2a', mech: '#b5602e', mech2: '#4a3a30', metal: '#8a7060', glow: '#ffb84a', vfx: '#ffae3a', vfx2: '#fff0c8' },
    { hat: 'beanie', mech: 'rusty' }, { fx: 'sparks' }),
  s('pip', 'arctic', 'Arctic Expedition Pip', 'epic', E, 'Charting the frozen north, one snowball at a time.',
    { primary: '#e05a3a', skin: '#f6d2b8', hair: '#fff2e0', mech: '#f2f6fa', mech2: '#3a6a9a', metal: '#b8d8f0', glow: '#9ff0ff', vfx: '#8ff0ff', vfx2: '#ffffff' },
    { hat: 'beanie', mech: 'sleek' }, { fx: 'snow', recall: 'snowglobe' }),
  s('pip', 'galactic', 'Galactic Pip & B0LT-X', 'legendary', L, 'Space cadet first class. Bolt has been upgraded with real rockets.',
    { primary: '#f2f2f8', skin: '#f2c8a0', hair: '#ff6ad5', mech: '#2a2f4a', mech2: '#c0c8e0', metal: '#e0e8ff', glow: '#ff6ad5', vfx: '#ff6ad5', vfx2: '#7af0ff' },
    { hat: 'helmet', mech: 'sleek' }, { fx: 'nebula', recall: 'rocket', trail: 'sparks' }),

  // ── MIRE — Bog Witch ───────────────────────────────────────────────
  s('mire', 'default', 'Bog Witch', 'default', {}, 'Old as the swamp and twice as patient.',
    { primary: '#3d5a3a', secondary: '#7a9a3a', skin: '#9ab07a', wood: '#5a3e28', glow: '#ffb23a', vfx: '#8fdc4a', vfx2: '#d8ff9a' },
    { lantern: 'lantern', hat: 'witch' }, { fx: 'bubbles' }),
  s('mire', 'pumpkin', 'Hollow Harvest Mire', 'common', C, 'Every patch has one pumpkin that stares back.',
    { primary: '#3a2a4a', secondary: '#ff7a1a', skin: '#b0c090', wood: '#3a2618', glow: '#ff8a1a', vfx: '#ff8a1a', vfx2: '#ffe0a0' },
    { lantern: 'pumpkin', hat: 'witch' }, { fx: 'embers' }),
  s('mire', 'coral', 'Coral Tide Mire', 'epic', E, 'The reef witch sings to the tides.',
    { primary: '#2a6a8a', secondary: '#ff7a9a', skin: '#8ad0c8', wood: '#e0a080', glow: '#7affe8', vfx: '#4fe8d8', vfx2: '#ffb0c8' },
    { lantern: 'shell', hat: 'coral' }, { fx: 'bubbles', recall: 'tidepool' }),
  s('mire', 'eclipse', 'Eclipse Coven Mire', 'legendary', L, 'When the moon goes dark, the coven gathers.',
    { primary: '#1a1226', secondary: '#7a3cff', skin: '#8a7aa0', wood: '#2a1a30', glow: '#d8b0ff', vfx: '#a05aff', vfx2: '#ffd06a' },
    { lantern: 'moon', hat: 'eclipse' }, { fx: 'bats', recall: 'bats', trail: 'wisps' }),

  // ── GARROK — Beastcaller ───────────────────────────────────────────
  s('garrok', 'default', 'Beastcaller', 'default', {}, 'The forest hunts with him.',
    { primary: '#6b4a2a', fur: '#a07a4a', skin: '#c08a60', antler: '#e8dcc0', metal: '#a0a8b0', glow: '#ffcf5a', vfx: '#ffb84a', vfx2: '#fff0c0', wolf: '#7a6a5a' },
    { helm: 'antler', spear: 'spear' }, { fx: 'sparks' }),
  s('garrok', 'snowpelt', 'Snowpelt Garrok', 'common', C, 'Tracks don\'t last long in the tundra. Neither does prey.',
    { primary: '#4a5a6a', fur: '#f0f0f0', skin: '#e0b090', antler: '#cfe6f6', metal: '#c8e8ff', glow: '#9fe8ff', vfx: '#9fe8ff', vfx2: '#ffffff', wolf: '#e8eef4' },
    { helm: 'snow', spear: 'ice' }, { fx: 'snow' }),
  s('garrok', 'spirit', 'Spirit Hunt Garrok', 'epic', E, 'He runs with the ghosts of the old pack.',
    { primary: '#1e3a3a', fur: '#3a6a6a', skin: '#8ab0a8', antler: '#7affe0', metal: '#7affe0', glow: '#5affd0', vfx: '#4affc8', vfx2: '#e0fff8', wolf: '#5affd0' },
    { helm: 'spirit', spear: 'spirit' }, { fx: 'wisps', recall: 'spirits' }),
  s('garrok', 'thunder', 'Primal Thunder Garrok', 'legendary', L, 'The storm is his drum; the wolf is the lightning.',
    { primary: '#1a2340', fur: '#3a4a7a', skin: '#a08070', antler: '#ffe24a', metal: '#ffe24a', glow: '#8fd8ff', vfx: '#7fd0ff', vfx2: '#fff27a', wolf: '#2a3a6a' },
    { helm: 'thunder', spear: 'thunder' }, { fx: 'lightning', recall: 'thunder', trail: 'sparks' }),
];

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((k) => [k.id, k]));
export const skinsForHero = (heroId) => SKINS.filter((k) => k.heroId === heroId);
export function getSkin(heroId, skinId) {
  return SKIN_BY_ID[skinId] || SKIN_BY_ID[`${heroId}_default`] || null;
}
