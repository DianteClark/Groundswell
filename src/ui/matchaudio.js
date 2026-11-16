// Positional combat audio + adaptive music intensity for a live match. Reads match.eventLog.
import { sfx, Music } from './audio.js';

const ATTACK = { bram: 'thump', kaela: 'slash', lumi: 'zap', vex: 'gun', nyx: 'slash', pip: 'zap', mire: 'bubble', garrok: 'swing', garrok_wolf: 'bite', garrok_wolf_alpha: 'bite' };
const CAST = {
  bram: { q: 'thump', w: 'earth', r: 'earth' }, kaela: { q: 'fire', w: 'shieldUp', r: 'fire' }, lumi: { q: 'star', w: 'star', r: 'star' },
  vex: { q: 'gun', w: 'whoosh', r: 'gun' }, nyx: { q: 'shadow', w: 'slash', r: 'shadow' }, pip: { q: 'clank', w: 'mech', r: 'mech' },
  mire: { q: 'sludge', w: 'bubble', r: 'sludge' }, garrok: { q: 'swing', w: 'roar', r: 'roar' },
};
const RELIC = { relic: 'blink' };

export class MatchAudio {
  constructor(match, renderer, localPlayerId) {
    this.m = match; this.r = renderer; this.pid = localPlayerId; this.lastTick = match.tickCount; this.combatAt = -99;
    Music.setMode('match');
  }
  get hero() { return this.m.heroOf(this.pid); }
  _pos(id) { const e = this.m.entities.get(id); return e ? { x: e.x, y: e.y } : null; }
  // returns {g, pan} or null if inaudible
  _spatial(x, y, range = 42) {
    const h = this.hero; if (!h || x == null) return { g: 1, pan: 0 };
    const cx = this.r?.camT ? this.r.camT.x : h.x, cy = this.r?.camT ? this.r.camT.z : h.y;
    const d = Math.hypot(x - cx, y - cy); if (d > range) return null;
    const g = Math.max(0.12, 1 - d / range) ** 1.2;
    let pan = (x - cx) / 30; pan = Math.max(-0.8, Math.min(0.8, pan));
    return { g, pan };
  }
  _at(name, x, y, opts = {}, gap = 0.03) {
    const sp = this._spatial(x, y, opts.range); if (!sp) return;
    sfx(name, gap, { ...opts, g: (opts.g ?? 1) * sp.g, pan: sp.pan, key: opts.key });
  }
  update() {
    const m = this.m, log = m.eventLog || [], me = this.hero;
    for (let i = 0; i < log.length; i++) {
      const { tick, ev } = log[i]; if (tick <= this.lastTick) continue;
      this._ev(ev, me);
    }
    if (log.length) this.lastTick = log[log.length - 1].tick;
    // adaptive music
    const fight = m.time - this.combatAt < 4;
    Music.setIntensity(m.finalSwell ? 1 : fight ? 0.85 : me && !me.alive ? 0.25 : 0.38);
  }
  _ev(ev, me) {
    const m = this.m; const mine = (id) => me && id === me.id;
    switch (ev.t) {
      case 'attack': {
        const s = m.entities.get(ev.srcId); if (!s) break;
        if (s.kind === 'tower') { this._at('towerCharge', s.x, s.y, { g: 0.8 }, 0.05); break; }
        if (s.kind === 'hero' || s.kind === 'summon') { const k = ATTACK[s.heroId || s.visual?.model] || 'swing'; this._at(k, s.x, s.y, { g: mine(s.id) ? 1 : 0.6, key: s.id }, 0.05); }
        break;
      }
      case 'damage': {
        const t = m.entities.get(ev.targetId); if (!t) break;
        const involvesMe = mine(ev.srcId) || mine(ev.targetId) || (me && m.entities.get(ev.srcId)?.ownerId === me.id);
        if ((t.kind === 'hero' || involvesMe) && me && (mine(ev.targetId) || mine(ev.srcId) || t.team === me.team)) this.combatAt = m.time;
        const src = m.entities.get(ev.srcId);
        if (src?.kind === 'tower' && t.kind === 'hero') { this._at('towerShot', t.x, t.y, { g: 1 }, 0.05); break; }
        if (t.kind === 'minion' && !involvesMe) break;
        const heavy = ev.heavy || ev.kill || ev.amount > 160;
        this._at(heavy ? 'hitHeavy' : 'hitLight', t.x, t.y, { g: involvesMe ? 1 : 0.45, key: heavy ? 'h' : 'l' }, heavy ? 0.04 : 0.035);
        break;
      }
      case 'cast': {
        const s = m.entities.get(ev.srcId); if (!s) break;
        const name = ev.slot === 'relic' ? 'blink' : CAST[ev.heroId]?.[ev.slot] || 'whoosh';
        this._at(name, s.x, s.y, { g: mine(s.id) ? 1.1 : 0.7 }, 0.02);
        if (ev.slot === 'r') this._at('ult', s.x, s.y, { g: mine(s.id) ? 1 : 0.7 }, 0.1);
        if (me && s.team !== me.team && Math.hypot(s.x - me.x, s.y - me.y) < 18) this.combatAt = m.time;
        break;
      }
      case 'death': {
        const e = m.entities.get(ev.id); if (!e) break;
        if (e.kind === 'minion') this._at('minionDie', e.x, e.y, { g: 0.7 }, 0.05);
        else if (e.kind === 'hero') { if (mine(e.id)) sfx('death', 0.5); else this._at('heroDie', e.x, e.y, { range: 60 }); }
        else if (e.kind === 'tower' || e.kind === 'core') this._at('crumble', e.x, e.y, { range: 90, g: 1.2 });
        else if (e.kind === 'monster' && e.epic) this._at('wyrmRoar', e.x, e.y, { range: 120 });
        break;
      }
      case 'kill': if (me && ev.killerId === me.id) sfx('kill', 0.2); break;
      case 'gold': if (mine(ev.id) && ev.amount >= 10 && ev.amount < 300) sfx('coin', 0.06, { g: 0.8 }); break;
      case 'levelup': if (mine(ev.id)) sfx('levelup', 0.3); break;
      case 'shield': { const e = m.entities.get(ev.id); if (e && e.kind === 'hero') this._at('shieldUp', e.x, e.y, { g: 0.6 }, 0.15); break; }
      case 'heal': { if (ev.amount > 40) { const e = m.entities.get(ev.targetId); if (e) this._at('heal', e.x, e.y, { g: mine(e.id) ? 0.9 : 0.4 }, 0.25); } break; }
      case 'recall': if (mine(ev.id)) sfx('recall', 1); break;
      case 'respawn': if (mine(ev.id)) sfx('respawn', 0.5); break;
      case 'objective': sfx('objective', 0.5); break;
      case 'spawn': { if (ev.kind === 'monster') { const e = m.entities.get(ev.id); if (e?.epic) this._at('wyrmRoar', e.x, e.y, { range: 200, g: 0.5 }); } break; }
      case 'mapchange': if (ev.phase === 'apply' || ev.kind === 'finalswell') sfx('swell', 1); else this._at('earth', ev.zone?.x, ev.zone?.y, { range: 200, g: 0.6 }); break;
      case 'finalswell': sfx('swell', 2); break;
      case 'vfx': if (ev.key === 'wyrm_breath') this._at('fire', ev.x, ev.y, { g: 0.8 }); else if (ev.key === 'colossus_slam') this._at('earth', ev.x, ev.y, { g: 1 }); else if (ev.key && ev.key.startsWith('relic_blink')) this._at('blink', ev.x, ev.y); break;
    }
  }
  dispose() { Music.setMode('menu'); }
}
