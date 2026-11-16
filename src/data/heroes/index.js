// Hero registry. Owner: Agent A. Exports HEROES (array) and HERO_BY_ID.
import bram from './bram.js';
import kaela from './kaela.js';
import lumi from './lumi.js';
import vex from './vex.js';
import nyx from './nyx.js';
import pip from './pip.js';
import mire from './mire.js';
import garrok from './garrok.js';

export const HEROES = [bram, kaela, lumi, vex, nyx, pip, mire, garrok];
for (const h of HEROES) {
  // convenience aliases for UI (schema per SPEC): recommended loadout + per-slot cooldown text
  h.recommended = h.bot?.loadout;
  for (const k of ['q', 'w', 'r']) { const a = h.abilities[k]; if (a) a.slot = k; }
}
export const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
