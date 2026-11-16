// Minimal in-match HUD. Reads match state; writes only via match.issue().
import { HERO_BY_ID, ITEM_BY_ID, RELIC_BY_ID, itemDisplay, fmtStats } from '../meta/registry.js';
import { MAP } from '../sim/map.js';
import { XP_TABLE, ULT_LEVEL, ELEMENT_INFO, WYRM_FIRST, COLOSSUS_FIRST } from '../sim/constants.js';
import Save from '../meta/save.js';
import { esc, frag, fmt, fmtTime, heroChipHTML } from './dom.js';
import { sfx, setVolume } from './audio.js';
import { installMobileGuards, setMatchMode } from './mobile.js';

const EL_COLOR = { ember: '#ff6a2a', tide: '#3ab6ff', gale: '#8ff0c8', stone: '#d2aa6a' };
const TAG_GLYPH = { engage: '💥', poke: '✴️', escape: '💨', peel: '🛡️', farm: '🌾', burst: '💢', cc: '🌀', heal: '💚', shield: '🔰', zone: '☁️', dash: '💨', mobility: '💨', damage: '✴️' };
const STATUS_GLYPH = { stun: '💫', root: '⛓️', slow: '🐌', silence: '🔇', blind: '🌫️', taunt: '😠', speed: '⚡', invisible: '👻', knockup: '⤴️' };
const BUFF_GLYPH = { verdant: '🌿', might: '💪' };
const SLOTS = ['q', 'w', 'r', 'relic'];
const isTouchDevice = () => typeof window !== 'undefined' && ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints > 0 && 'ontouchstart' in window));

export class Hud {
  constructor(rootEl, match, renderer, localPlayerId, opts = {}) {
    this.m = match; this.r = renderer; this.pid = localPlayerId ?? match.localPlayerId;
    this.touch = opts.touch ?? isTouchDevice();
    installMobileGuards();
    this.onQuit = opts.onQuit || null;   // optional: called when player confirms "Leave match"
    this.hero = match.heroOf ? match.heroOf(this.pid) : match.heroes[0];
    this.team = this.hero?.team ?? 0;
    this.lastTick = -1; this.lastEvTick = -1;
    this.cache = {};
    this.feed = [];
    this.settings = Save.get().settings;
    setVolume((this.settings.master ?? 0.7) * (this.settings.sfx ?? 0.8));
    this.root = frag(`<div class="hud ${this.touch ? 'touch' : 'desk'}" style="--ts:${this.settings.touchSize || 1}">
      <div class="h-top">
        <div class="h-score"><span class="hs-k t0">0</span><div class="hs-mid"><span class="hs-time">0:00</span><div class="hs-obj"><span class="ob wyrm">🐉<b>—</b></span><span class="ob col">🗿<b>—</b></span></div></div><span class="hs-k t1">0</span></div>
        <div class="hs-souls"><span class="souls t0"></span><span class="souls t1"></span></div>
      </div>
      <div class="h-mm"><canvas width="240" height="160"></canvas></div>
      <div class="h-tr"><button class="hb" data-h="score" title="Scoreboard (Tab)">📊</button><button class="hb" data-h="menu" title="Menu">☰</button></div>
      <div class="h-feed"></div>
      <div class="h-banner"></div>
      <div class="h-hint"></div><div class="h-qhint">Buy starting item ›</div>
      <div class="h-recall"><div class="hr-t">Recalling</div><div class="hr-bar"><div></div></div></div>
      <div class="h-dead"><div class="hd-t">SLAIN</div><div class="hd-n">Respawn in <b>0</b></div><div class="hd-s">You can shop while dead</div></div>
      <div class="h-bottom">
        <div class="h-unit">
          <div class="hu-port"><svg viewBox="0 0 40 40" class="xpring"><circle cx="20" cy="20" r="18" class="xr-bg"/><circle cx="20" cy="20" r="18" class="xr-fg"/></svg><span class="hu-face"></span><span class="hu-lvl">1</span></div>
          <div class="hu-bars"><div class="hu-top"><div class="hu-res"><span class="rs-n"></span><span class="rs-pips"></span></div><div class="hu-st"></div></div><div class="hpbar"><div class="hp-sh"></div><div class="hp-f"></div><span class="hp-t"></span></div>
            <div class="hu-row"><span class="gold">🪙 <b>0</b></span><div class="items"></div><button class="qbuy" data-h="qbuy"><span class="qb-ic">+</span><span class="qb-c"></span></button><div class="qbr"></div></div></div>
        </div>
        <div class="h-abs">${SLOTS.map(s => `<button class="ab ab-${s}" data-slot="${s}"><span class="ab-ic"></span><span class="ab-sw"></span><span class="ab-t"></span><span class="ab-k">${s === 'relic' ? (this.touch ? '' : 'D') : s.toUpperCase()}</span><span class="ab-lock">🔒</span></button>`).join('')}
          <button class="ab ab-atk" data-h="attack"><span class="ab-ic">⚔️</span></button>
          <button class="ab sm ab-rec" data-h="recall" title="Recall (B)"><span class="ab-ic">🏠</span></button>
          <button class="ab sm ab-shop" data-h="shop" title="Shop (P)"><span class="ab-ic">🛒</span></button>
          <button class="ab xs ab-prio" data-h="prio" title="Attack priority"><span class="ab-ic">👤</span></button>
        </div>
      </div>
      <div class="h-tip"></div>
      <div class="h-aug"></div>
      <div class="h-shop"></div>
      <div class="h-board"></div>
      <div class="h-menu"><div class="hm-box"><h3>Paused?</h3><p class="muted sm">The match keeps running.</p><button class="btn" data-h="resume">Resume</button><button class="btn danger" data-h="quit">🏳 Surrender / Quit</button><p class="muted sm">Leaving early forfeits the match.</p></div></div>
      <div class="h-end"></div>
      <div class="h-rotate"><div>📱</div><b>Rotate your device</b><span>Groundswell plays in landscape</span></div>
    </div>`);
    rootEl.appendChild(this.root);
    const q = (s) => this.root.querySelector(s);
    this.els = {
      kills0: q('.hs-k.t0'), kills1: q('.hs-k.t1'), time: q('.hs-time'), wyrm: q('.ob.wyrm'), col: q('.ob.col'), souls0: q('.souls.t0'), souls1: q('.souls.t1'),
      mm: q('.h-mm canvas'), feed: q('.h-feed'), banner: q('.h-banner'), hint: q('.h-hint'), recall: q('.h-recall'), dead: q('.h-dead'),
      res: q('.hu-res'), face: q('.hu-face'), lvl: q('.hu-lvl'), xr: q('.xr-fg'), hp: q('.hp-f'), hps: q('.hp-sh'), hpt: q('.hp-t'), st: q('.hu-st'),
      gold: q('.gold b'), items: q('.items'), qbuy: q('.qbuy'), qbr: q('.qbr'),
      abilities: Object.fromEntries(SLOTS.map(s => [s, q('.ab-' + s)])), attack: q('.ab-atk'), recallBtn: q('.ab-rec'), shopBtn: q('.ab-shop'), prio: q('.ab-prio'),
      tip: q('.h-tip'), aug: q('.h-aug'), shop: q('.h-shop'), board: q('.h-board'), menu: q('.h-menu'), end: q('.h-end'),
    };
    const h = this.hero; const def = h?.def || HERO_BY_ID[h?.heroId] || {};
    this.els.face.innerHTML = heroChipHTML(h?.heroId, 52);
    for (const s of SLOTS) {
      const d = this.abilityDef(s);
      this.els.abilities[s].querySelector('.ab-ic').textContent = d ? (d.icon || TAG_GLYPH[(d.tags || [])[0]] || (d.name || s)[0]) : '·';
    }
    this.els.prio.classList.toggle('on', !!this.settings.champPriority);
    this._mmBase = this._drawMinimapBase();
    if (this.touch) {
      this._layoutTouch = this._layoutTouch.bind(this);
      this._layoutTouch();
      window.addEventListener('resize', this._layoutTouch);
      window.visualViewport?.addEventListener('resize', this._layoutTouch);
      setTimeout(this._layoutTouch, 300);
    }
    setMatchMode(true);
    this.root.addEventListener('click', (e) => this._onClick(e));
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    if (!this.touch) {
      for (const s of SLOTS) {
        const b = this.els.abilities[s];
        b.addEventListener('mouseenter', () => { this.showTooltip(s, b); this.r?.showIndicator?.({ slot: s, heroId: h?.heroId, range: this.abilityDef(s)?.range, x: h?.x, y: h?.y }); });
        b.addEventListener('mouseleave', () => { this.hideTooltip(); this.r?.hideIndicator?.(); });
      }
    }
    this.els.mm.addEventListener('pointerdown', (e) => this._mmPointer(e));
    this.els.mm.addEventListener('pointermove', (e) => { if (e.buttons) this._mmPointer(e); });
    this.autoBuy = this.settings.autoBuy ?? this.touch;
    this.castCb = null;     // set by Input: (slot) => void, for clicking ability buttons on desktop
    this._onKey = (e) => {
      if (e.repeat) return;
      if (e.key === 'Tab') { e.preventDefault(); this.toggleScoreboard(e.type === 'keydown'); }
    };
    window.addEventListener('keydown', this._onKey); window.addEventListener('keyup', this._onKey);
    this.update(0);
  }

  abilityDef(slot) {
    const h = this.hero; if (!h) return null;
    if (this.m.abilityDef) { try { return this.m.abilityDef(h, slot); } catch (e) { /* */ } }
    return slot === 'relic' ? RELIC_BY_ID[h.relicId] : (h.def || HERO_BY_ID[h.heroId])?.abilities?.[slot];
  }
  isUiEvent(target) { return !!(target && target.closest && target.closest('.hud button,.h-mm,.h-aug,.h-shop,.h-board,.h-menu,.h-end')); }
  issue(cmd) { this.m.issue(this.pid, cmd); }

  _onClick(e) {
    const b = e.target.closest('[data-h],[data-slot],[data-buy],[data-aug]');
    if (!b) return;
    const h = this.hero;
    if (b.dataset.slot && !this.touch) { this.castCb?.(b.dataset.slot); return; }
    if (b.dataset.aug) { const [lvl, ch] = b.dataset.aug.split(':'); this.issue({ type: 'augment', level: +lvl, choice: ch }); sfx('levelup'); this.els.aug.classList.remove('on'); this.cache.aug = null; return; }
    if (b.dataset.buy) { const [slot, br] = b.dataset.buy.split(':'); this.tryBuy(+slot, br || null); return; }
    switch (b.dataset.h) {
      case 'score': this.toggleScoreboard(); break;
      case 'menu': this.els.menu.classList.toggle('on'); break;
      case 'resume': this.els.menu.classList.remove('on'); break;
      case 'quit': this.els.menu.classList.remove('on'); if (typeof window.__gsQuit === 'function') window.__gsQuit(); else if (this.onQuit) this.onQuit(); break;
      case 'qbuy': { const n = this.nextBuy(); if (n && !n.branch) this.tryBuy(n.slot); else if (n?.branch) this.flashHint('Choose a branch →'); break; }
      case 'shop': this.toggleShop(); break;
      case 'recall': if (!this.touch) { this.issue({ type: 'recall' }); } break;
      case 'autobuy': this.autoBuy = !this.autoBuy; this.settings.autoBuy = this.autoBuy; Save.persist(); this.cache.shopSig = ''; this.flashHint(this.autoBuy ? 'Auto-buy on: items bought at fountain' : 'Auto-buy off'); break;
      case 'prio': this.settings.champPriority = !this.settings.champPriority; Save.persist(); b.classList.toggle('on', this.settings.champPriority); this.flashHint(this.settings.champPriority ? 'Attack prioritizes champions' : 'Attack prioritizes nearest'); break;
    }
  }
  canShop() { const h = this.hero; if (!h) return false; if (this.m.canShop) return this.m.canShop(h); const f = MAP.fountains[h.team]; return !h.alive || Math.hypot(h.x - f.x, h.y - f.y) < 15; }
  nextFor(slot) {
    const h = this.hero; if (!h) return null;
    if (this.m.nextPurchase) return this.m.nextPurchase(h, slot);
    return null;
  }
  nextBuy() {
    for (let i = 0; i < 3; i++) { const n = this.nextFor(i); if (n) return { ...n, slot: i }; }
    return null;
  }
  tryBuy(slot, branch) {
    const h = this.hero; const n = this.nextFor(slot); if (!n) return;
    if (!this.canShop()) { sfx('error'); this.flashHint('Shop at your fountain or while dead — press B to recall'); return; }
    const cost = n.branch ? (branch === 'b' ? n.costB : n.costA) : n.cost;
    if (h.gold < cost) { sfx('error'); this.flashHint(`Need ${Math.ceil(cost - h.gold)} more gold`); return; }
    if (n.branch) this.issue({ type: 'buyBranch', slot, branch }); else this.issue({ type: 'buy', slot });
    sfx('purchase');
  }
  flashHint(t) { const e = this.els.hint; e.textContent = t; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
  toggleScoreboard(force) { const on = force ?? !this.els.board.classList.contains('on'); this.els.board.classList.toggle('on', on); if (on) this._renderBoard(); }
  toggleShop(force) { const on = force ?? !this.els.shop.classList.contains('on'); this.els.shop.classList.toggle('on', on); this.cache.shopSig = ''; }
  showTooltip(slot, anchor) {
    const d = this.abilityDef(slot); if (!d) return;
    const h = this.hero; const st = h?.abilities?.[slot];
    const rng = typeof d.range === 'function' ? d.range(h) : d.range;
    const lock = slot === 'r' && (h?.level || 1) < ULT_LEVEL;
    this.els.tip.innerHTML = `<b>${esc(d.name || slot)}</b><span class="tt-m">${slot === 'relic' ? 'Relic' : slot.toUpperCase()}${st?.cdMax || d.cd ? ' · ' + Math.round(typeof d.cd === 'number' ? d.cd : st.cdMax) + 's' : ''}${rng ? ' · range ' + Math.round(rng) : ''}</span><p>${esc(d.desc || '')}</p>${d.bonusDesc ? `<p class="tt-b">${esc(d.bonusDesc)}</p>` : ''}${lock ? `<p class="tt-l">Unlocks at level ${ULT_LEVEL}</p>` : ''}`;
    const r = anchor.getBoundingClientRect(); const rr = this.root.getBoundingClientRect();
    this.els.tip.classList.add('on');
    const tw = this.els.tip.offsetWidth, th = this.els.tip.offsetHeight;
    this.els.tip.style.left = Math.max(6, Math.min(rr.width - tw - 6, r.left - rr.left + r.width / 2 - tw / 2)) + 'px';
    this.els.tip.style.top = Math.max(6, r.top - rr.top - th - 10) + 'px';
  }
  hideTooltip() { this.els.tip.classList.remove('on'); }

  // ---------------- per-frame ----------------
  update(frameDt) {
    const m = this.m; const h = this.hero; if (!h) return;
    const E = this.els; const c = this.cache;
    this._events();
    // top bar
    const ts = m.teamStats || {};
    this._set('k0', ts[0]?.kills | 0, v => E.kills0.textContent = v);
    this._set('k1', ts[1]?.kills | 0, v => E.kills1.textContent = v);
    this._set('time', Math.floor(m.time), v => E.time.textContent = fmtTime(v));
    const ob = m.objectives || {};
    const objTxt = (o, first) => { if (!o) return '—'; if (o.alive) return 'UP'; const at = o.respawnAt ?? (m.time < first ? first : null); return at != null ? fmtTime(at - m.time) : '—'; };
    this._set('wy', objTxt(ob.wyrm, WYRM_FIRST) + '|' + (ob.wyrm?.alive ? ob.wyrm.element : ob.wyrm?.nextElement), () => {
      const el = ob.wyrm?.alive ? ob.wyrm.element : ob.wyrm?.nextElement;
      E.wyrm.querySelector('b').textContent = objTxt(ob.wyrm, WYRM_FIRST); E.wyrm.style.setProperty('--ec', EL_COLOR[el] || '#aaa'); E.wyrm.classList.toggle('up', !!ob.wyrm?.alive);
      E.wyrm.title = el ? (ELEMENT_INFO[el]?.name || el) + ' — ' + (ELEMENT_INFO[el]?.buff || '') : 'Wyrm';
    });
    this._set('co', objTxt(ob.colossus, COLOSSUS_FIRST), v => { E.col.querySelector('b').textContent = v; E.col.classList.toggle('up', !!ob.colossus?.alive); });
    for (const t of [0, 1]) {
      const w = Array.isArray(ts[t]?.wyrms) ? ts[t].wyrms : [];
      this._set('souls' + t, w.join(',') + (ts[t]?.soul || ''), () => { E['souls' + t].innerHTML = w.map(el => `<i style="--ec:${EL_COLOR[el] || '#aaa'}" title="${esc(ELEMENT_INFO[el]?.name || el)}"></i>`).join('') + (ts[t]?.soul ? '<em>SOUL</em>' : ''); });
    }
    // unit frame
    const lvl = h.level || 1;
    this._set('lvl', lvl, v => E.lvl.textContent = v);
    const a = XP_TABLE[lvl - 1] ?? 0, b = XP_TABLE[lvl]; const xpPct = b ? Math.max(0, Math.min(1, ((h.xp || 0) - a) / (b - a))) : 1;
    this._set('xp', Math.round(xpPct * 100), v => { E.xr.style.strokeDashoffset = String(113.1 * (1 - v / 100)); });
    const maxHp = h.maxHp || h.stats?.maxHp || 1; const hpPct = Math.max(0, h.hp / maxHp); const shPct = Math.min(1, (h.shield || 0) / maxHp);
    this._set('hp', Math.round(h.hp) + '/' + Math.round(maxHp) + '/' + Math.round(h.shield || 0), () => {
      E.hp.style.width = (hpPct * 100).toFixed(1) + '%'; E.hps.style.width = Math.min(100, (hpPct + shPct) * 100).toFixed(1) + '%';
      E.hpt.textContent = `${Math.max(0, Math.round(h.hp))} / ${Math.round(maxHp)}`; E.hp.classList.toggle('low', hpPct < 0.3);
    });
    const now = m.time;
    const rs = h.resource;
    this._set('res', rs ? `${rs.name}|${Math.round(rs.value)}|${rs.max}|${rs.color}` : '', () => {
      const el = E.res; if (!rs || !rs.max) { el.classList.remove('on'); return; }
      el.classList.add('on'); el.style.setProperty('--rc', rs.color || '#9fd8ff');
      el.querySelector('.rs-n').textContent = `${rs.name} ${Math.round(rs.value)}`;
      const pips = el.querySelector('.rs-pips');
      if (rs.max <= 12) pips.innerHTML = Array.from({ length: rs.max }, (_, i) => `<i class="${i < Math.round(rs.value) ? 'on' : ''}"></i>`).join('');
      else pips.innerHTML = `<b class="rs-bar"><i style="width:${Math.max(0, Math.min(100, rs.value / rs.max * 100)).toFixed(1)}%"></i></b>`;
      el.classList.toggle('full', rs.value >= rs.max);
    });
    const st = [...(h.buffs || []).filter(x => !x.until || x.until > now).map(x => BUFF_GLYPH[x.key] || ''), ...(h.statuses || []).map(x => STATUS_GLYPH[x.key] || '')].filter(Boolean).join('');
    this._set('st', st, v => E.st.textContent = v);
    const gold = Math.floor(h.gold || 0);
    this._set('gold', gold, v => E.gold.textContent = fmt(v));
    // items
    const isig = (h.items || []).map(x => x ? x.id + x.tier + (x.branch || '') : '-').join('|');
    this._set('items', isig, () => {
      E.items.innerHTML = [0, 1, 2].map(i => { const it = h.items?.[i]; const d = itemDisplay(it); const base = ITEM_BY_ID[h.loadout?.items?.[i]];
        const pas = it?.branch ? ITEM_BY_ID[it.id]?.branches?.[it.branch]?.passive : null;
        return `<span class="it ${it ? 't' + d.tier : 'empty'}" title="${esc(d?.name || base?.name || '')}${pas ? ' — ' + esc(pas.name) + ': ' + esc(pas.desc) : ''}">${esc(d?.icon || base?.icon || '')}${it && !d.final ? `<i>${d.tier}</i>` : ''}</span>`; }).join('');
    });
    // quick buy
    const shopOk = this.canShop();
    const nb = this.nextBuy();
    const qsig = nb ? `${nb.slot}:${nb.step}:${nb.branch ? 'b' : ''}:${gold >= (nb.branch ? Math.min(nb.costA, nb.costB) : nb.cost)}:${shopOk}` : 'none';
    this._set('qb', qsig, () => {
      if (!nb) { E.qbuy.className = 'qbuy done'; E.qbuy.querySelector('.qb-ic').textContent = '✔'; E.qbuy.querySelector('.qb-c').textContent = 'Full'; E.qbr.innerHTML = ''; return; }
      const def = nb.def || ITEM_BY_ID[h.loadout?.items?.[nb.slot]];
      const cost = nb.branch ? Math.min(nb.costA, nb.costB) : nb.cost;
      const afford = gold >= cost;
      E.qbuy.className = `qbuy ${afford ? 'afford' : ''} ${shopOk ? 'shop' : 'away'} ${nb.branch ? 'branch' : ''}`;
      E.qbuy.querySelector('.qb-ic').textContent = def?.icon || '+';
      E.qbuy.querySelector('.qb-c').textContent = nb.branch ? 'Pick' : fmt(cost);
      E.qbuy.title = nb.branch ? `${def?.name}: choose a branch` : `Buy ${def?.name} ${nb.step === 1 ? '' : 'T' + nb.step} (${cost}g)${shopOk ? '' : ' — at fountain'}`;
      E.qbr.innerHTML = nb.branch ? ['a', 'b'].map(k => { const br = def?.branches?.[k]; const cst = k === 'a' ? nb.costA : nb.costB; return `<button class="qbb ${gold >= cst ? 'afford' : ''}" data-buy="${nb.slot}:${k}" title="${esc(br?.name || k)} — ${esc(br?.desc || fmtStats(br?.stats))}${br?.passive ? ' · ' + esc(br.passive.name) + ': ' + esc(br.passive.desc) : ''}"><span>${esc(br?.icon || k)}</span><small>${fmt(cst)}</small></button>`; }).join('') : '';
    });
    const empty = !(h.items || []).some(Boolean);
    const startHint = !!(nb && !nb.branch && empty && shopOk && h.alive && gold >= nb.cost && !this.autoBuy);
    this._set('qhint', startHint, v => { this.root.querySelector('.h-qhint').classList.toggle('on', v); E.qbuy.classList.toggle('start', v); });
    if (this.autoBuy && nb && !nb.branch && shopOk && gold >= nb.cost) {
      c.abT = (c.abT || 0) + frameDt;
      if (c.abT > 0.4) { c.abT = 0; this.issue({ type: 'buy', slot: nb.slot }); sfx('purchase', 0.3); }
    } else c.abT = 0.3;
    if (E.shop.classList.contains('on')) this._renderShop(gold, shopOk);
    // abilities
    for (const s of SLOTS) {
      const ab = h.abilities?.[s]; const btn = E.abilities[s]; if (!ab) continue;
      const locked = s === 'r' && lvl < ULT_LEVEL;
      const cdMax = ab.cdMax || 1; const cd = Math.max(0, ab.cd || 0);
      const recast = ab.recastUntil != null && ab.recastUntil > now;
      const key = `${recast}|${locked}|${cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : 0}|${Math.round(cd / cdMax * 60)}|${ab.charges ?? ''}`;
      if (c['ab' + s] !== key) {
        c['ab' + s] = key;
        btn.classList.toggle('locked', locked);
        btn.classList.toggle('recast', recast);
        btn.classList.toggle('cd', cd > 0 && !locked && !recast);
        btn.style.setProperty('--p', locked ? 1 : (cd > 0 ? cd / cdMax : 0));
        if (recast) btn.style.setProperty('--p', 0);
        btn.querySelector('.ab-t').textContent = recast ? '' : !locked && cd > 0 ? (cd < 1 ? cd.toFixed(1) : Math.ceil(cd)) : '';
        if (cd <= 0 && c['abwas' + s]) { btn.classList.remove('ready'); void btn.offsetWidth; btn.classList.add('ready'); }
        c['abwas' + s] = cd > 0;
      }
    }
    // recall
    const rc = h.recalling;
    if (rc) { E.recall.classList.add('on'); const tot = (rc.until - (rc.start ?? (rc.until - 8))); E.recall.querySelector('.hr-bar div').style.width = (100 * (1 - (rc.until - now) / tot)).toFixed(1) + '%'; }
    else E.recall.classList.remove('on');
    // death
    const dead = !h.alive;
    this._set('dead', dead, v => { E.dead.classList.toggle('on', v); this.root.classList.toggle('is-dead', v); });
    if (dead && h.respawnAt != null) this._set('resp', Math.ceil(h.respawnAt - now), v => E.dead.querySelector('b').textContent = Math.max(0, v));
    // augments
    const pa = h.pendingAugment;
    if (pa && c.aug !== pa) {
      c.aug = pa; const aug = (h.def || HERO_BY_ID[h.heroId])?.augments?.[pa] || {};
      E.aug.innerHTML = `<div class="ag-h">Level ${pa} Augment</div><div class="ag-row">${['a', 'b'].map(k => `<button class="ag-c" data-aug="${pa}:${k}"><b>${esc(aug[k]?.name || k.toUpperCase())}</b><span>${esc(aug[k]?.desc || '')}</span></button>`).join('')}</div>`;
      E.aug.classList.add('on'); sfx('reward');
    } else if (!pa && c.aug) { c.aug = null; E.aug.classList.remove('on'); }
    // scoreboard live
    if (E.board.classList.contains('on')) { c.bt = (c.bt || 0) + frameDt; if (c.bt > 0.5) { c.bt = 0; this._renderBoard(); } }
    // minimap @ ~15fps
    c.mmT = (c.mmT || 0) + frameDt; if (c.mmT > 0.066 || frameDt === 0) { c.mmT = 0; this._drawMinimap(); }
    // end
    if (m.over && !c.ended) this._end(m.winner);
  }
  _set(k, v, fn) { if (this.cache[k] !== v) { this.cache[k] = v; fn(v); } }

  // ---------------- events ----------------
  _events() {
    const m = this.m;
    let list;
    if (Array.isArray(m.eventLog)) {
      list = [];
      for (let i = m.eventLog.length - 1; i >= 0; i--) { const e = m.eventLog[i]; if (e.tick <= this.lastEvTick) break; list.push(e); }
      list.reverse();
      if (list.length) this.lastEvTick = list[list.length - 1].tick;
      list = list.map(e => e.ev);
    } else {
      if (m.tickCount === this.lastTick) return; this.lastTick = m.tickCount; list = m.events || [];
    }
    for (const ev of list) this._ev(ev);
  }
  _ev(ev) {
    const h = this.hero; const me = h?.id;
    switch (ev.t) {
      case 'kill': {
        const k = this.m.entities.get(ev.killerId) || this.m.heroes.find(x => x.id === ev.killerId); const v = this.m.heroes.find(x => x.id === ev.victimId);
        if (!v) break;
        this._feed(`${k?.kind === 'hero' ? heroChipHTML(k.heroId, 22) + `<span>${esc(k.name)}</span>` : `<span class="fx">${k ? esc(k.kind === 'tower' ? 'Tower' : k.kind === 'monster' ? 'Monster' : 'Minions') : 'Executed'}</span>`}<i class="kx">⚔</i>${heroChipHTML(v.heroId, 22)}<span>${esc(v.name)}</span>`, ev.team ?? (k?.team), (k?.id === me ? 'mine' : '') + (v.id === me ? ' died' : ''));
        if (k?.id === me) sfx('kill'); else if (v.id === me) sfx('death');
        break;
      }
      case 'announce': {
        const big = ['firstblood', 'streak', 'wyrm', 'colossus', 'soul', 'objective'].includes(ev.kind) || !ev.kind;
        if (ev.kind === 'tower' || !big) this._feed(`<span class="fx">${esc(ev.text)}</span>`, ev.team);
        else this._banner(ev.text, ev.team, ev.kind, ev.element);
        break;
      }
      case 'levelup': if (ev.id === me) { sfx('levelup'); this.els.lvl.classList.remove('pop'); void this.els.lvl.offsetWidth; this.els.lvl.classList.add('pop'); if (ev.level === ULT_LEVEL) this.flashHint('Ultimate unlocked!'); } break;
      case 'cast': if (ev.srcId === me) sfx('whoosh', 0.08); break;
      case 'damage': if (ev.targetId === me && ev.amount > 20) sfx('hit', 0.18); break;
      case 'buy': if (ev.id === me) { this.cache.shopSig = ''; } break;
      case 'match_end': this._end(ev.winner); break;
    }
  }
  _feed(html, team, cls = '') {
    const row = frag(`<div class="kf ${team === this.team ? 'ally' : team === 1 - this.team ? 'enemy' : ''} ${cls}">${html}</div>`);
    this.els.feed.prepend(row);
    while (this.els.feed.children.length > 5) this.els.feed.lastChild.remove();
    setTimeout(() => row.classList.add('out'), 6000); setTimeout(() => row.remove(), 6500);
  }
  _banner(text, team, kind, element) {
    const b = this.els.banner;
    const col = element ? EL_COLOR[element] : team === this.team ? '#5fb3ff' : team === 1 - this.team ? '#ff5f6d' : '#ffd36a';
    b.innerHTML = `<div class="bn-in" style="--bc:${col}"><span class="bn-k">${esc({ firstblood: 'FIRST BLOOD', streak: 'RAMPAGE', wyrm: 'WYRM SLAIN', colossus: 'COLOSSUS', soul: 'SOUL CLAIMED', objective: 'OBJECTIVE' }[kind] || '')}</span><b>${esc(text)}</b></div>`;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    sfx(kind === 'objective' || kind === 'wyrm' || kind === 'colossus' || kind === 'soul' ? 'objective' : 'kill');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), 3200);
  }
  _end(winner) {
    if (this.cache.ended) return; this.cache.ended = true;
    const won = winner === this.team;
    this.els.end.innerHTML = `<div class="he-in ${won ? 'win' : 'loss'}"><h1>${won ? 'VICTORY' : 'DEFEAT'}</h1></div>`;
    this.els.end.classList.add('on');
    sfx(won ? 'victory' : 'defeat');
  }

  // ---------------- shop panel / scoreboard ----------------
  _renderShop(gold, shopOk) {
    const h = this.hero;
    const sig = (h.items || []).map(x => x ? x.id + x.tier + x.branch : '-').join() + '|' + Math.floor(gold / 25) + '|' + shopOk;
    if (this.cache.shopSig === sig) return; this.cache.shopSig = sig;
    const rows = [0, 1, 2].map(i => {
      const cur = h.items?.[i]; const n = this.nextFor(i); const d = itemDisplay(cur); const base = ITEM_BY_ID[h.loadout?.items?.[i]];
      let act = '';
      if (!n) act = '<span class="sp-done">✔ Complete</span>';
      else if (n.branch) act = ['a', 'b'].map(k => { const br = n.def?.branches?.[k]; const cst = k === 'a' ? n.costA : n.costB; return `<button class="sp-b ${gold >= cst ? 'afford' : ''}" data-buy="${i}:${k}"><span>${esc(br?.icon || '')}</span><b>${esc(br?.name || k)}</b><small>${esc(br?.desc || fmtStats(br?.stats))}${br?.passive ? `<br><span class="sp-pas">${esc(br.passive.name)}: ${esc(br.passive.desc)}</span>` : ''}</small><em>${fmt(cst)}g</em></button>`; }).join('');
      else { const t = n.def?.tiers?.[n.step - 1]; act = `<button class="sp-b ${gold >= n.cost ? 'afford' : ''}" data-buy="${i}"><span>${esc(n.def?.icon || '')}</span><b>${esc(n.def?.name || '')} · T${n.step}</b><small>${esc(t?.desc || fmtStats(t?.stats))}</small><em>${fmt(n.cost)}g</em></button>`; }
      return `<div class="sp-row"><span class="it ${cur ? 't' + d.tier : 'empty'}">${esc(d?.icon || base?.icon || '')}</span><div class="sp-acts">${act}</div></div>`;
    }).join('');
    this.els.shop.innerHTML = `<div class="sp-box"><div class="sp-h"><b>Shop</b><button class="sp-auto ${this.autoBuy ? 'on' : ''}" data-h="autobuy">Auto-buy ${this.autoBuy ? 'ON' : 'OFF'}</button><span class="gold">🪙 ${fmt(gold)}</span><button class="hb" data-h="shop">✕</button></div>${shopOk ? '' : '<div class="sp-warn">Return to your fountain (or wait until respawn) to buy.</div>'}${rows}</div>`;
  }
  _renderBoard() {
    const m = this.m;
    const team = (t) => m.heroes.filter(h => h.team === t).map(h => `<tr class="${h.id === this.hero.id ? 'me' : ''} ${h.alive ? '' : 'dead'}"><td>${heroChipHTML(h.heroId, 26)}<span>${esc(h.name)}</span><small>${h.level}</small></td><td>${h.kills}/${h.deaths}/${h.assists}</td><td>${h.cs}</td><td class="its">${(h.items || []).map(it => `<span>${esc(itemDisplay(it)?.icon || '·')}</span>`).join('')}</td></tr>`).join('');
    const ts = m.teamStats || {};
    this.els.board.innerHTML = `<div class="sb-box"><table><thead><tr><th class="t0">Blue · ${ts[0]?.kills | 0}</th><th>KDA</th><th>CS</th><th>Items</th></tr></thead><tbody>${team(0)}</tbody><thead><tr><th class="t1">Red · ${ts[1]?.kills | 0}</th><th></th><th></th><th></th></tr></thead><tbody>${team(1)}</tbody></table></div>`;
  }

  // ---------------- minimap ----------------
  _drawMinimapBase() {
    const W = MAP.width || 240, H = MAP.height || 160, S = 2;
    const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
    const g = cv.getContext('2d'); g.scale(S, S);
    const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, '#16301f'); grd.addColorStop(1, '#1d2a1a'); g.fillStyle = grd; g.fillRect(0, 0, W, H);
    if (MAP.river?.polygon) { g.fillStyle = 'rgba(60,140,200,.45)'; g.beginPath(); MAP.river.polygon.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fill(); }
    g.fillStyle = '#0b130d';
    for (const o of MAP.obstacles || []) { if (o.type === 'circle') { g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill(); } else if (o.w) g.fillRect(o.x, o.y, o.w, o.h); }
    g.fillStyle = 'rgba(70,140,60,.55)'; for (const b of MAP.brush || []) { g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(210,190,140,.45)'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const l of MAP.lanes || []) { const pts = l.points || l; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); }
    for (const b of MAP.bases || []) { g.fillStyle = b.team === 0 ? 'rgba(60,140,255,.25)' : 'rgba(255,70,80,.25)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill(); }
    if (MAP.pits) for (const k of ['wyrm', 'colossus']) { const p = MAP.pits[k]; if (p) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.stroke(); } }
    return cv;
  }
  _drawMinimap() {
    const cv = this.els.mm; const W = MAP.width || 240, H = MAP.height || 160;
    const dpr = Math.min(2, window.devicePixelRatio || 1); const cw = cv.clientWidth || 200, ch = cv.clientHeight || 133;
    if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const g = cv.getContext('2d'); const sx = cv.width / W, sy = cv.height / H;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this._mmBase, 0, 0, cv.width, cv.height);
    g.setTransform(sx, 0, 0, sy, 0, 0);
    const myT = this.team; const tc = (t) => t === myT ? '#4fa8ff' : t === 1 - myT ? '#ff4d5e' : '#ffd36a';
    const visible = (e) => e.team === myT || !e.vis || e.vis[myT];
    const heroes = [];
    for (const e of this.m.entities.values()) {
      if (!e.alive || e.removed) continue;
      if (e.kind === 'tower' || e.kind === 'core') { g.fillStyle = tc(e.team); g.strokeStyle = '#000'; g.lineWidth = 0.8; const r = e.kind === 'core' ? 4.5 : 3; g.beginPath(); g.rect(e.x - r, e.y - r, r * 2, r * 2); g.fill(); g.stroke(); }
      else if (e.kind === 'minion') { if (visible(e)) { g.fillStyle = tc(e.team); g.fillRect(e.x - 1.1, e.y - 1.1, 2.2, 2.2); } }
      else if (e.kind === 'monster') {
        if (e.monsterType === 'wyrm' || e.monsterType === 'colossus') { g.fillStyle = e.monsterType === 'wyrm' ? (EL_COLOR[e.element] || '#ff8a3d') : '#c9a0ff'; g.beginPath(); g.arc(e.x, e.y, 4.5, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke(); }
        else { g.fillStyle = 'rgba(255,210,110,.85)'; g.beginPath(); g.arc(e.x, e.y, 2, 0, 7); g.fill(); }
      } else if (e.kind === 'hero') heroes.push(e);
    }
    for (const e of heroes) {
      if (!visible(e)) continue;
      const me = e.id === this.hero.id;
      g.fillStyle = (e.def || HERO_BY_ID[e.heroId])?.color || '#888';
      g.beginPath(); g.arc(e.x, e.y, me ? 5 : 4.2, 0, 7); g.fill();
      g.lineWidth = me ? 1.6 : 1.3; g.strokeStyle = me ? '#fff' : tc(e.team); g.stroke();
    }
    // camera viewport
    const r = this.r;
    if (r?.screenToWorld) {
      try {
        const cvs = r.canvas || document.querySelector('canvas.game, canvas');
        const w = cvs?.clientWidth || innerWidth, hgt = cvs?.clientHeight || innerHeight;
        const pts = [[0, 0], [w, 0], [w, hgt], [0, hgt]].map(([x, y]) => r.screenToWorld(x, y)).filter(p => p && isFinite(p.x));
        if (pts.length === 4) { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke(); }
      } catch (e) { /* */ }
    }
  }
  _mmPointer(e) {
    e.preventDefault(); e.stopPropagation();
    const rc = this.els.mm.getBoundingClientRect();
    const x = (e.clientX - rc.left) / rc.width * (MAP.width || 240), y = (e.clientY - rc.top) / rc.height * (MAP.height || 160);
    if (e.button === 2 && !this.touch) { this.issue({ type: 'move', x, y }); return; }
    this.lookAt(x, y);
  }
  /** Move camera to a world point (uses renderer.focusOn/setCameraTarget if present, else panCamera delta). */
  lookAt(x, y) {
    const r = this.r; if (!r) return;
    if (r.focusOn) { r.setCameraFollow?.(false); r.focusOn(x, y); return; }
    if (r.setCameraTarget) { r.setCameraFollow?.(false); r.setCameraTarget(x, y); return; }
    if (r.screenToWorld && r.panCamera) {
      r.setCameraFollow?.(false);
      const cvs = r.canvas || document.querySelector('canvas'); const w = cvs?.clientWidth || innerWidth, h = cvs?.clientHeight || innerHeight;
      const c = r.screenToWorld(w / 2, h / 2); if (c) r.panCamera(x - c.x, y - c.y);
    }
  }

  /** Size & place touch controls from the real viewport + safe areas (thumb-friendly on SE … Pro Max). */
  safeInsets() {
    const pr = this._probe || (this._probe = Object.assign(document.createElement('div'), { style: 'position:fixed;visibility:hidden;pointer-events:none;padding:var(--sat) var(--sar) var(--sab) var(--sal)' }));
    if (!pr.isConnected) this.root.appendChild(pr);
    const cs = getComputedStyle(pr);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }
  _layoutTouch() {
    const W = window.innerWidth, H = window.innerHeight; if (!W || !H) return;
    const si = this.safeInsets(); const ts = Save.get().settings.touchSize || 1;
    const short = Math.min(W, H), wide = Math.max(W, H);
    const a = Math.round(Math.max(50, Math.min(76, short * 0.168)) * ts);   // ability button
    const A = Math.round(a * 1.42);                                          // attack button
    const gap = Math.round(a * 0.16);
    const x0 = W - si.r - 12, y0 = H - Math.max(si.b, 4) - 10;
    const cx = x0 - A / 2, cy = y0 - A / 2;
    const R = A / 2 + a / 2 + gap, R2 = R + a * 0.95 + gap;
    const place = (el, ang, rad, size) => {
      if (!el) return; const t = ang * Math.PI / 180;
      const x = cx + rad * Math.cos(t), y = cy - rad * Math.sin(t);
      Object.assign(el.style, { left: Math.round(x - size / 2) + 'px', top: Math.round(y - size / 2) + 'px', width: size + 'px', height: size + 'px', right: 'auto', bottom: 'auto' });
      el.style.setProperty('--s', size + 'px'); el.style.setProperty('--abs', size + 'px');
    };
    const E = this.els;
    place(E.attack, 0, 0, A);
    place(E.abilities.q, 178, R, a);
    place(E.abilities.w, 133, R, a);
    place(E.abilities.r, 88, R, a);
    place(E.abilities.relic, 180, R + a * 0.5 + gap + a * 0.41, Math.round(a * 0.82));
    place(E.recallBtn, 156, R2, Math.round(a * 0.72));
    place(E.shopBtn, 127, R2 + a * 0.08, Math.round(a * 0.72));
    place(E.prio, 62, A / 2 + a * 0.12, Math.round(Math.max(34, a * 0.52)));
    // left column: minimap + status card
    const mw = Math.round(Math.max(118, Math.min(176, short * 0.4)));
    const st = this.root.style;
    st.setProperty('--mm-x', (si.l + 8) + 'px'); st.setProperty('--mm-y', (si.t + 6) + 'px'); st.setProperty('--mm-w', mw + 'px');
    st.setProperty('--card-y', (si.t + 6 + Math.round(mw * 2 / 3) + 6) + 'px');
    st.setProperty('--hp-w', Math.round(Math.max(120, Math.min(170, wide * 0.17))) + 'px');
    // joystick
    const jb = Math.round(a * 2.1);
    st.setProperty('--jb', jb + 'px');
    st.setProperty('--jgx', Math.round(si.l + 22 + jb / 2) + 'px'); st.setProperty('--jgy', Math.round(y0 - jb / 2 - 4) + 'px');
    // aim-cancel: above the ability cluster, away from thumbs
    st.setProperty('--cx', Math.round(cx - R * 0.4) + 'px'); st.setProperty('--cy', Math.round(Math.max(si.t + 60, cy - R2 - a * 1.4)) + 'px');
    this.layout = { a, A, R, R2, cx, cy, jb, si, W, H };
  }

  dispose() {
    setMatchMode(false);
    if (this.touch) { window.removeEventListener('resize', this._layoutTouch); window.visualViewport?.removeEventListener('resize', this._layoutTouch); }
    window.removeEventListener('keydown', this._onKey); window.removeEventListener('keyup', this._onKey);
    clearTimeout(this._bt); this.root.remove();
  }
}
export default Hud;
