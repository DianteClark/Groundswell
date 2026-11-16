// Groundswell meta UI: menus, play setup, loading screen, results.
import Save from '../meta/save.js';
import { ico } from './icons.js';
import { HEROES, HERO_BY_ID, RELIC_BY_ID, SIGIL_BY_ID, ITEM_BY_ID, skinsFor, skinById, defaultSkinId, roleIcon, recommendedLoadout } from '../meta/registry.js';
import { TITLES, BANNERS, BORDERS, ICONS, flair } from '../meta/flair.js';
import { refreshQuests, DIFFICULTIES, diffInfo, rankInfo, xpToNext, seasonTier, SEASON, seasonReward, msToMidnight, fmtCountdown, dayKey, grantMatchRewards, masteryProgress, MASTERY_NAMES, MASTERY_COLORS, seeded, checkFlairUnlocks, rerollQuest } from '../meta/economy.js';
import { esc, frag, fmt, fmtTime, avatarHTML, bannerStyle, bannerClass, titleHTML, heroArtHTML, heroChipHTML, toast, modal, countUp, profileCardHTML, ESS, PRI, rarityColor, setPortraitRenderer } from './dom.js';
import { sfx, setVolume, setMusicVolume } from './audio.js';
import { MetaScreens } from './screens.js';
import { installMobileGuards, isIOS, isStandalone } from './mobile.js';

const NAV = [
  { id: 'home', label: 'Home', icon: 'ui:home' },
  { id: 'armory', label: 'Armory', icon: 'ui:anvil' },
  { id: 'shop', label: 'Shop', icon: 'ui:gem' },
  { id: 'profile', label: 'Profile', icon: 'ui:person' },
  { id: 'settings', label: 'Settings', icon: 'ui:cog' },
];
const BOT_NAMES = ['Kestrel', 'Vornir', 'Sable', 'Thistle', 'Grimbolt', 'Aurex', 'Moth', 'Quill', 'Rook', 'Ember', 'Nettle', 'Cinder', 'Halcyon', 'Juno', 'Brisk', 'Wisp', 'Talon', 'Orrin', 'Pike', 'Lark', 'Zephyr', 'Corvin', 'Mabel', 'Fenn'];

export class App {
  constructor(rootEl, opts = {}) {
    this.root = rootEl || document.body;
    this.opts = opts;
    setPortraitRenderer(opts.renderHeroPortrait);
    installMobileGuards();
    this._installRotate();
    this.s = Save.load();
    refreshQuests(this.s);
    checkFlairUnlocks(this.s); Save.persist();
    setVolume((this.s.settings.master ?? 0.7) * (this.s.settings.sfx ?? 0.8)); setMusicVolume((this.s.settings.master ?? 0.7) * (this.s.settings.music ?? 0.5));
    this.screen = 'home';
    this.ui = { play: { mode: 'bots', difficulty: Math.min(this.s.lastDifficulty || 1, 5), role: 'All', heroId: null }, armory: { heroId: null, tab: 'loadouts' }, shop: { tab: 'featured' }, profile: { tab: 'customize', kind: 'title' } };
    this.preview = null; this.previewHost = null; this.previewKey = '';
    this.el = frag(`<div class="rb-app">
      <div class="rb-bg"><div class="rb-bg-grid"></div><div class="rb-bg-orb o1"></div><div class="rb-bg-orb o2"></div><div class="rb-bg-motes"></div></div>
      <header class="rb-top"></header>
      <main class="rb-main"></main>
      <nav class="rb-nav"></nav>
    </div>`);
    this.root.appendChild(this.el);
    this.main = this.el.querySelector('.rb-main');
    this.el.addEventListener('click', (e) => this._onClick(e));
    this.el.addEventListener('input', (e) => this._onInput(e));
    this.el.addEventListener('change', (e) => this._onInput(e));
    this.el.addEventListener('pointerover', (e) => { const b = e.target.closest('.btn,.tile,.navb'); if (b && b !== this._hov && e.pointerType === 'mouse') { this._hov = b; sfx('hover', 0.05); } });
    this.unsub = Save.onChange(() => this.renderTop());
    this.showMenu();
  }

  get settings() { return this.s.settings; }
  _installRotate() {
    if (!document.querySelector('.gs-rotate')) {
      document.body.appendChild(frag(`<div class="gs-rotate"><div class="gr-logo"><span class="logo-mark">◆</span><span class="logo-t">GROUND<b>SWELL</b></span></div>
        <div class="gr-phone"><div class="gr-screen"></div></div><b class="gr-t">Rotate your phone</b><span class="gr-s">Groundswell is played in landscape</span></div>`));
    }
    const lock = () => { try { const p = screen.orientation?.lock?.('landscape'); if (p && p.catch) p.catch(() => {}); } catch (e) { /* unsupported (iOS) */ } };
    window.addEventListener('pointerdown', lock, { once: true, capture: true });
  }
  /** Settings for main.js / renderer. quality resolved to 'low'|'med'|'high'. */
  getSettings() {
    const st = Save.get().settings;
    let q = st.quality;
    if (q === 'medium') q = 'med';
    if (q !== 'low' && q !== 'med' && q !== 'high') {
      const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
      q = touch ? 'med' : 'high';
    }
    return { ...st, quality: q, qualitySetting: st.quality };
  }

  // ---------------- core ----------------
  showMenu(screen = 'home') {
    this.s = Save.get();
    refreshQuests(this.s);
    this.el.style.display = '';
    this.el.classList.remove('in-match');
    this.go(screen);
  }
  hide() { this.el.style.display = 'none'; this.disposePreview(); }
  go(screen, sub) {
    if (sub) Object.assign(this.ui[screen] || (this.ui[screen] = {}), sub);
    if (this.screen !== screen) this.main.scrollTop = 0;
    this.screen = screen;
    this.el.dataset.screen = screen;
    this.render();
  }
  renderTop() {
    const s = Save.get();
    const top = this.el.querySelector('.rb-top');
    const prevE = this._lastE, prevP = this._lastP;
    top.innerHTML = `
      <button class="logo" data-go="home"><span class="logo-mark">◆</span><span class="logo-t">GROUND<b>SWELL</b></span></button>
      <div class="top-nav">${NAV.map(n => `<button class="navb ${this.screen === n.id ? 'on' : ''}" data-go="${n.id}">${n.label}</button>`).join('')}</div>
      <div class="top-r">
        <div class="curpill" title="Essence — earned every match">${ESS}<b class="ess-v">${fmt(s.essence)}</b></div>
        <div class="curpill" title="Prisms — quests, level-ups, first win">${PRI}<b class="pri-v">${fmt(s.prisms)}</b></div>
        <button class="top-av" data-go="profile">${avatarHTML(s.equipped, 38)}<span class="lvl-pill sm">${s.level}</span></button>
      </div>`;
    if (prevE != null && prevE !== s.essence) top.querySelector('.ess-v').parentElement.classList.add('bump');
    if (prevP != null && prevP !== s.prisms) top.querySelector('.pri-v').parentElement.classList.add('bump');
    this._lastE = s.essence; this._lastP = s.prisms;
    const nav = this.el.querySelector('.rb-nav');
    nav.innerHTML = NAV.map(n => `<button class="navb ${this.screen === n.id || (n.id === 'home' && this.screen === 'play') ? 'on' : ''}" data-go="${n.id}"><span class="navi">${ico(n.icon, 22)}</span><span>${n.label}</span></button>`).join('');
  }
  render() {
    this.s = Save.get();
    const keep = {};
    this.main.querySelectorAll('[data-scroll]').forEach(e => { keep[e.dataset.scroll] = [e.scrollLeft, e.scrollTop]; });
    const mainTop = this.main.scrollTop;
    this.renderTop();
    const fn = this['screen_' + this.screen];
    let html = '';
    try { html = fn ? fn.call(this) : ''; } catch (e) { console.error(e); html = `<div class="panel">Error rendering ${esc(this.screen)}: ${esc(e.message)}</div>`; }
    // park preview host so innerHTML doesn't destroy it
    if (this.previewHost && this.previewHost.parentElement) this.previewHost.remove();
    this.main.innerHTML = `<div class="scr scr-${this.screen}">${html}</div>`;
    this.main.scrollTop = mainTop;
    this.main.querySelectorAll('[data-scroll]').forEach(e => { const k = keep[e.dataset.scroll]; if (k) { e.scrollLeft = k[0]; e.scrollTop = k[1]; } });
    const slot = this.main.querySelector('.preview-slot');
    if (slot) this.mountPreview(slot, slot.dataset.hero, slot.dataset.skin); else this.disposePreview();
    const after = this['after_' + this.screen]; if (after) after.call(this);
  }

  mountPreview(slot, heroId, skinId) {
    const make = this.opts.createHeroPreview;
    if (!make) { slot.innerHTML = heroArtHTML(heroId, skinId, 'big'); return; }
    if (!this.previewHost) { this.previewHost = document.createElement('div'); this.previewHost.className = 'preview-host'; }
    slot.appendChild(this.previewHost);
    try {
      if (!this.preview) { this.preview = make(this.previewHost, heroId, skinId); this.previewKey = heroId + '|' + skinId; }
      else if (this.previewKey !== heroId + '|' + skinId) { this.preview.setHero(heroId, skinId); this.previewKey = heroId + '|' + skinId; }
    } catch (e) { console.warn('hero preview failed', e); this.disposePreview(); slot.innerHTML = heroArtHTML(heroId, skinId, 'big'); }
  }
  disposePreview() {
    if (this.preview) { try { this.preview.dispose(); } catch (e) { /* */ } }
    this.preview = null; this.previewKey = '';
    if (this.previewHost) { this.previewHost.remove(); this.previewHost = null; }
  }

  _onClick(e) {
    const g = e.target.closest('[data-go]');
    if (g && this.el.contains(g)) { sfx('tab'); this.go(g.dataset.go); return; }
    const a = e.target.closest('[data-act]');
    if (a && !a.disabled) {
      const fn = this['act_' + a.dataset.act];
      if (fn) { e.preventDefault(); if (!a.classList.contains('nosfx')) sfx('click'); fn.call(this, a.dataset, a, e); }
    }
  }
  _onInput(e) {
    const a = e.target.closest('[data-inp]');
    if (a) { const fn = this['inp_' + a.dataset.inp]; if (fn) fn.call(this, a, e); }
  }

  // ---------------- helpers ----------------
  profile() { const s = this.s; return { name: s.name, level: s.level, ...s.equipped }; }
  owned(kind, id) { return Save.owns(kind, id); }
  pickSkin(heroId) { const sk = this.s.lastPick.skin[heroId]; return sk && Save.owns('skin', sk) ? sk : defaultSkinId(heroId); }
  diffUnlocked(d) { return d <= 2 || (this.s.stats.winsByDiff[d - 1] || 0) > 0; }

  // ---------------- HOME ----------------
  screen_home() {
    const s = this.s; const q = s.quests; const li = rankInfo(s.ladder.points);
    const fwDone = s.firstWin.day === dayKey();
    const heroId = (s.lastPick.heroId && HERO_BY_ID[s.lastPick.heroId] && Save.owns('hero', s.lastPick.heroId)) ? s.lastPick.heroId : s.owned.heroes[0];
    const h = HERO_BY_ID[heroId] || HEROES[0];
    const mp = masteryProgress(Save.masteryOf(h.id));
    const tier = seasonTier(s.season.xp); const tierPct = tier >= SEASON.tiers ? 1 : (s.season.xp % SEASON.xpPerTier) / SEASON.xpPerTier;
    const xpPct = s.xp / xpToNext(s.level);
    const tip = isIOS() && !isStandalone() && !localStorage.getItem('gs_a2hs_tip');
    return `
    <div class="home-grid">
      <section class="home-left">
        <div class="showcase" data-act="play">
          <div class="preview-slot sc-prev" data-hero="${h.id}" data-skin="${this.pickSkin(h.id)}"></div>
          <div class="sc-info">
            <div class="sc-name">${esc(h.name)}</div><div class="sc-title">${esc(h.title || '')}</div>
            <div class="mbadge" style="--mc:${MASTERY_COLORS[mp.level - 1]}">M${mp.level} · ${MASTERY_NAMES[mp.level - 1]}</div>
          </div>
        </div>
        <button class="btn play-btn" data-act="play"><span class="pb-shine"></span><span class="pb-t">PLAY</span><span class="pb-s">vs Bots · ${diffInfo(this.ui.play.difficulty).name}</span></button>
        <div class="fw ${fwDone ? 'done' : ''}">${fwDone ? `✔ First win claimed · resets in ${fmtCountdown(msToMidnight())}` : `<b>First Win</b> bonus ready: ${PRI}50 ${ESS}200`}</div>
      </section>
      <section class="home-side" data-scroll="home-side">
        ${tip ? `<div class="a2hs"><span class="a2-ic">📲</span><div><b>Play full-screen</b><small>Tap <span class="a2-share">⬆︎</span> Share, then <b>Add to Home Screen</b>.</small></div><button class="a2-x" data-act="a2hsClose" aria-label="Dismiss">✕</button></div>` : ''}
        ${profileCardHTML({ ...this.profile(), sub: `<span class="rankchip" style="--rc:${li.rank.color}">${li.rank.icon} ${li.label}</span>` }, { cls: 'big', av: 64 })}
        <div class="xpbar" title="Account XP"><div class="xpfill" style="width:${(xpPct * 100).toFixed(1)}%"></div><span>Level ${s.level} · ${fmt(s.xp)} / ${fmt(xpToNext(s.level))} XP</span></div>
        <div class="panel quests">
          <div class="ph"><h3>Daily Quests</h3><span class="muted">Resets in ${fmtCountdown(msToMidnight())}</span></div>
          ${q.daily.map((x, i) => this.questHTML(x, i)).join('')}
          ${q.weekly ? `<div class="ph sm"><h4>Weekly</h4></div>${this.questHTML(q.weekly, -1)}` : ''}
        </div>
        <div class="panel season tile" data-act="seasonTrack">
          <div class="ph"><h3>${esc(SEASON.name)}</h3><span class="muted">Tier ${tier}/${SEASON.tiers}</span></div>
          <div class="st-row" data-scroll="st">${Array.from({ length: 6 }, (_, i) => { const t = Math.min(SEASON.tiers, tier + i + (tier >= SEASON.tiers ? 0 : 1)); return this.seasonNodeHTML(t, t <= tier); }).join('')}</div>
          <div class="bar"><div style="width:${(tierPct * 100).toFixed(1)}%"></div></div>
          <div class="muted sm">${tier >= SEASON.tiers ? 'Track complete!' : `${fmt(s.season.xp % SEASON.xpPerTier)} / ${SEASON.xpPerTier} to tier ${tier + 1}`} · tap to view all</div>
        </div>
      </section>
    </div>`;
  }
  act_a2hsClose() { localStorage.setItem('gs_a2hs_tip', '1'); this.render(); }
  questHTML(q, i) {
    const pct = Math.min(1, q.p / q.n);
    const rw = [q.reward.essence ? `${ESS}${q.reward.essence}` : '', q.reward.prisms ? `${PRI}${q.reward.prisms}` : ''].join(' ');
    return `<div class="quest ${q.done ? 'done' : ''} ${i < 0 ? 'weekly' : ''}">
      <div class="q-top"><span class="q-t">${q.done ? '✔ ' : ''}${esc(q.text)}</span><span class="q-r">${rw}</span></div>
      <div class="q-bar"><div style="width:${pct * 100}%"></div><span>${q.p}/${q.n}</span></div>
      ${i >= 0 && !q.done && this.s.quests.rerolls > 0 ? `<button class="q-rr" data-act="reroll" data-i="${i}" title="Reroll quest (1/day)">↻</button>` : ''}
    </div>`;
  }
  seasonNodeHTML(t, got) {
    const r = seasonReward(t);
    let ic = '', lbl = '', rar = 'common';
    if (r.type === 'flair') { const f = flair(r.id); rar = f.rarity; lbl = f.name; ic = f.kind === 'icon' || f.kind === 'emote' ? esc(f.glyph) : f.kind === 'banner' ? `<i class="mini-banner" style="${bannerStyle(f.id)}"></i>` : f.kind === 'border' ? `<i class="mini-ring" style="--ring:${f.ring}"></i>` : '🏷️'; }
    else if (r.type === 'skin') { rar = r.rarity; lbl = `${r.rarity === 'legendary' ? 'Legendary' : 'Epic'} Skin`; ic = '🎭'; }
    else if (r.type === 'prisms') { rar = 'rare'; lbl = `${r.amount} Prisms`; ic = PRI; }
    else { lbl = `${r.amount} Essence`; ic = ESS; }
    return `<div class="snode r-${rar} ${got ? 'got' : ''}" style="--rc:${rarityColor(rar)}"><div class="sn-t">${t}</div><div class="sn-ic">${ic}</div><div class="sn-l">${esc(lbl)}</div></div>`;
  }
  act_seasonTrack() {
    const tier = seasonTier(this.s.season.xp);
    modal(`<h2>${esc(SEASON.name)}</h2><p class="muted">Earn Season XP from every match and quest. All rewards are free.</p>
      <div class="st-grid">${Array.from({ length: SEASON.tiers }, (_, i) => this.seasonNodeHTML(i + 1, i + 1 <= tier)).join('')}</div>`, { cls: 'wide' });
  }
  act_reroll(d) { if (rerollQuest(+d.i)) { toast('Quest rerolled'); this.render(); } }

  // ---------------- PLAY SETUP ----------------
  act_play() { const p = this.ui.play; if (!p.heroId || !Save.owns('hero', p.heroId)) p.heroId = (this.s.lastPick.heroId && Save.owns('hero', this.s.lastPick.heroId)) ? this.s.lastPick.heroId : this.s.owned.heroes[0]; this.go('play'); }
  screen_play() {
    const p = this.ui.play; const s = this.s;
    const roles = ['All', ...new Set(HEROES.map(h => h.role).filter(Boolean))];
    const h = HERO_BY_ID[p.heroId] || HERO_BY_ID[s.owned.heroes[0]];
    p.heroId = h.id;
    const skins = skinsFor(h.id); const skinId = this.pickSkin(h.id);
    const L = Save.heroLoadouts(h.id); const lo = Save.activeLoadout(h.id);
    const list = HEROES.filter(x => p.role === 'All' || x.role === p.role);
    const sk = skinById(skinId);
    const d = diffInfo(p.difficulty);
    return `
    <div class="play">
      <section class="pl-left">
        <div class="sel-prev"><div class="preview-slot" data-hero="${h.id}" data-skin="${skinId}"></div>
          <div class="sel-name"><span class="role-t">${roleIcon(h.role)} ${esc(h.role || '')}</span><h2>${esc(h.name)}</h2><div class="muted">${esc(h.title || '')}${sk && sk.rarity !== 'default' ? ` · <span style="color:${rarityColor(sk.rarity)}">${esc(sk.name)}</span>` : ''}</div></div></div>
        <div class="skins" data-scroll="skins">${skins.map(k => { const own = Save.owns('skin', k.id); return `<button class="skinb ${k.id === skinId ? 'on' : ''} ${own ? '' : 'locked'}" style="--rc:${rarityColor(k.rarity)}" data-act="pickSkin" data-k="${k.id}" title="${esc(k.name)}">${heroArtHTML(h.id, k.id, 'xs')}<span>${esc(k.rarity === 'default' ? 'Default' : k.name)}</span>${own ? '' : '<i class="lock">🔒</i>'}</button>`; }).join('')}</div>
      </section>
      <section class="pl-right">
        <div class="pl-head">
          <button class="btn ghost back" data-go="home" aria-label="Back">‹</button>
          <div class="chips" data-scroll="roles">${roles.map(r => `<button class="chip ${p.role === r ? 'on' : ''}" data-act="role" data-r="${esc(r)}">${r === 'All' ? 'All' : roleIcon(r) + ' ' + esc(r)}</button>`).join('')}</div>
          <button class="chip soon" data-act="mode" data-m="p2p">👥 <em>soon</em></button>
        </div>
        <div class="hgrid" data-scroll="hgrid">${list.map(x => { const own = Save.owns('hero', x.id); return `<button class="hcard ${x.id === h.id ? 'on' : ''} ${own ? '' : 'locked'}" style="--hc:${x.color}" data-act="pickHero" data-h="${x.id}">
          ${heroArtHTML(x.id, this.pickSkin(x.id), 'sm')}<span class="hc-n">${esc(x.name)}</span>${own ? '' : '<span class="lock">🔒</span>'}</button>`; }).join('')}</div>
        ${this.jungleHint(h, lo)}
        <div class="pl-bar">
          <button class="plb diffb" style="--dc:${d.color}" data-act="diffPick"><small>vs Bots</small><b>${'★'.repeat(d.id)} ${esc(d.name)}</b></button>
          <button class="plb lob" data-act="loPickPlay"><small>Loadout · ${esc(L.list[L.active]?.name || '')}</small>${this.loadoutSummaryHTML(lo)}</button>
          <button class="btn primary lockin" data-act="lockIn">LOCK IN</button>
        </div>
      </section>
    </div>`;
  }
  act_diffPick() {
    const p = this.ui.play;
    const md = modal(`<h2>Difficulty</h2><div class="diffs">${DIFFICULTIES.map(d => { const un = this.diffUnlocked(d.id); return `<button class="diff ${p.difficulty === d.id ? 'on' : ''} ${un ? '' : 'locked'}" style="--dc:${d.color}" data-d="${d.id}">
      <span class="d-n">${'★'.repeat(d.id)}</span><b>${d.name}</b><span class="d-m">${un ? `×${d.mult} rewards` : `🔒 Win on ${DIFFICULTIES[d.id - 2].name}`}</span></button>`; }).join('')}</div><p class="muted sm center">${esc(diffInfo(p.difficulty).desc)}</p>`, { cls: 'wide' });
    md.el.querySelectorAll('.diff').forEach(b => b.addEventListener('click', () => { const n = +b.dataset.d; if (!this.diffUnlocked(n)) { sfx('error'); toast(`🔒 Win a match on ${DIFFICULTIES[n - 2].name} to unlock ${DIFFICULTIES[n - 1].name}`); return; } sfx('click'); this.act_diff({ d: n }); md.close(); }));
  }
  act_loPickPlay() {
    const id = this.ui.play.heroId; const L = Save.heroLoadouts(id);
    const md = modal(`<h2>Loadout</h2><div class="pick-list">${L.list.map((l, i) => { const lo = Save.sanitizeLoadout(l, id); return `<button class="pick-row ${i === L.active ? 'on' : ''}" data-i="${i}"><span class="pr-t"><b>${esc(l.name)}</b></span>${this.loadoutSummaryHTML(lo)}</button>`; }).join('')}</div><div class="buy-btns"><button class="btn" data-edit>Edit in Armory ›</button></div>`, { cls: 'wide' });
    md.el.querySelectorAll('.pick-row').forEach(b => b.addEventListener('click', () => { L.active = +b.dataset.i; Save.persist(); sfx('click'); md.close(); this.render(); }));
    md.el.querySelector('[data-edit]').addEventListener('click', () => { md.close(); this.act_editLoadout(); });
  }
  isJungler(h) { return h?.bot?.preferredRole === 'jungle' || /jungl/i.test(h?.role || ''); }
  jungleHint(h, lo) {
    if (!this.isJungler(h) || lo.relic === 'hunters_brand' || !RELIC_BY_ID.hunters_brand) return '';
    const r = RELIC_BY_ID.hunters_brand;
    return `<div class="notice jg">${ico(r, 26) || esc(r.icon || '🔥')} <span><b>Jungler:</b> take <b>${esc(r.name)}</b> to clear camps &amp; secure Wyrms.</span><button class="btn sm primary" data-act="takeBrand">Equip</button></div>`;
  }
  act_takeBrand() {
    const id = this.ui.play.heroId; const L = Save.heroLoadouts(id);
    if (!Save.owns('relic', 'hunters_brand')) { this.openBuy('relic', 'hunters_brand'); return; }
    L.list[L.active] = Save.sanitizeLoadout({ ...L.list[L.active], relic: 'hunters_brand' }, id); Save.persist(); toast("Hunter's Brand equipped"); this.render();
  }
  loadoutSummaryHTML(lo) {
    const r = RELIC_BY_ID[lo.relic]; const so = SIGIL_BY_ID[lo.sigils.offense]; const su = SIGIL_BY_ID[lo.sigils.utility];
    return `<div class="losum">${lo.items.map(id => { const it = ITEM_BY_ID[id]; return `<span class="ls-i cat-${it?.category}" title="${esc(it?.name)}">${ico(it, 30) || esc(it?.icon || '?')}</span>`; }).join('')}
      <span class="ls-sep"></span><span class="ls-i relic" title="${esc(r?.name || '')}">${ico(r, 30) || esc(r?.icon || '—')}</span>
      <span class="ls-i sig" title="${esc(so?.name || '')}">${ico(so, 30) || esc(so?.icon || '—')}</span><span class="ls-i sig" title="${esc(su?.name || '')}">${ico(su, 30) || esc(su?.icon || '—')}</span></div>`;
  }
  act_mode(d) { if (d.m === 'p2p') { toast('👥 Play with Friend is coming soon — peer-to-peer matches are on the way!'); return; } this.ui.play.mode = d.m; this.render(); }
  act_diff(d) { const n = +d.d; if (!this.diffUnlocked(n)) { sfx('error'); toast(`🔒 Win a match on ${DIFFICULTIES[n - 2].name} to unlock ${DIFFICULTIES[n - 1].name}`); return; } this.ui.play.difficulty = n; this.s.lastDifficulty = n; Save.persist(); this.render(); }
  act_role(d) { this.ui.play.role = d.r; this.render(); }
  act_pickHero(d) {
    if (!Save.owns('hero', d.h)) { this.buyDialog('hero', d.h); return; }
    this.ui.play.heroId = d.h; this.s.lastPick.heroId = d.h; Save.persist(); this.render();
  }
  act_pickSkin(d) {
    const k = skinById(d.k); if (!k) return;
    if (!Save.owns('skin', k.id)) { this.buyDialog('skin', k.id); return; }
    this.s.lastPick.skin[k.heroId] = k.id; Save.persist(); this.render();
  }
  act_pickLoadout(d) { const L = Save.heroLoadouts(this.ui.play.heroId); L.active = +d.i; Save.persist(); this.render(); }
  act_editLoadout() { this.ui.armory.heroId = this.ui.play.heroId; this.ui.armory.tab = 'loadouts'; this.go('armory'); }

  act_lockIn() {
    const p = this.ui.play; const cfg = this.buildConfig(p.heroId, this.pickSkin(p.heroId), p.difficulty);
    this.launch(cfg);
  }

  /** Build SPEC match config: 6 players, index 0 = local human on team 0. */
  buildConfig(heroId, skinId, difficulty) {
    const seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
    const rnd = seeded(seed);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const roleOf = (h) => h?.bot?.preferredRole || (/jungl/i.test(h?.role) ? 'jungle' : /support|controller/i.test(h?.role) ? 'support' : 'lane');
    const used = new Set([heroId]);
    const chooseFor = (role) => {
      const c = HEROES.filter(h => !used.has(h.id) && roleOf(h) === role);
      const pool = c.length ? c : HEROES.filter(h => !used.has(h.id));
      const h = pool.length ? pick(pool) : pick(HEROES);
      used.add(h.id); return h;
    };
    // team of 3: top laner, bot laner, jungler/roamer. Map hero preference onto slots.
    const SLOTS = [{ lane: 'top', role: 'lane' }, { lane: 'bot', role: 'lane' }, { lane: null, role: 'jungle' }];
    const mine = roleOf(HERO_BY_ID[heroId]);
    const mySlot = mine === 'jungle' ? 2 : mine === 'support' ? 1 : 0;
    const allySlots = SLOTS.filter((_, i) => i !== mySlot);
    const wantRole = (slot) => slot.role === 'jungle' ? 'jungle' : (slot.lane === 'bot' ? (rnd() < 0.5 ? 'support' : 'lane') : 'lane');
    const ally = allySlots.map(sl => ({ h: chooseFor(wantRole(sl)), sl }));
    const enemy = SLOTS.map(sl => ({ h: chooseFor(wantRole(sl)), sl }));
    const names = [...BOT_NAMES]; const takeName = () => names.splice(Math.floor(rnd() * names.length), 1)[0] || 'Bot';
    const fancy = (list) => { const pool = list.filter(f => f.source.type !== 'mastery' || rnd() < 0.3); const wt = Math.min(0.85, 0.15 + difficulty * 0.14); const good = pool.filter(f => f.rarity === 'epic' || f.rarity === 'legendary'); return (rnd() < wt && good.length ? pick(good) : pick(pool)).id; };
    const bot = ({ h, sl }, team, i) => {
      const skins = skinsFor(h.id);
      const sk = (rnd() < 0.55 && skins.length > 1) ? pick(skins.filter(x => x.rarity !== 'default')) : skins[0];
      return { id: 'p' + i, team, heroId: h.id, skinId: sk?.id || defaultSkinId(h.id), isBot: true, name: takeName(), difficulty, lane: sl.lane || undefined, role: sl.role,
        loadout: sl.role === 'jungle' ? { ...recommendedLoadout(h), relic: RELIC_BY_ID.hunters_brand ? 'hunters_brand' : recommendedLoadout(h).relic, sigils: { ...recommendedLoadout(h).sigils, offense: SIGIL_BY_ID.predator ? 'predator' : recommendedLoadout(h).sigils.offense } } : recommendedLoadout(h), profile: { title: fancy(TITLES), banner: fancy(BANNERS), border: fancy(BORDERS), icon: fancy(ICONS) }, level: 1 + Math.floor(rnd() * 20 * difficulty / 2) };
    };
    const me = { id: 'p0', team: 0, heroId, skinId, isBot: false, name: this.s.name, lane: SLOTS[mySlot].lane || undefined, role: SLOTS[mySlot].role, loadout: Save.activeLoadout(heroId),
      profile: { ...this.s.equipped }, level: this.s.level, mastery: Save.masteryOf(heroId).level };
    const players = [me, bot(ally[0], 0, 1), bot(ally[1], 0, 2), bot(enemy[0], 1, 3), bot(enemy[1], 1, 4), bot(enemy[2], 1, 5)];
    return { seed, mode: 'bots', difficulty, players };
  }

  /** Show the loading screen and then hand off to opts.startMatch(config). */
  launch(cfg) {
    this.lastConfig = cfg;
    this.disposePreview();
    const card = (p) => {
      const h = HERO_BY_ID[p.heroId] || {}; const sk = skinById(p.skinId);
      return `<div class="lcard ${p.isBot ? '' : 'me'} t${p.team}">
        <div class="lc-ban ${bannerClass(p.profile?.banner)}" style="${bannerStyle(p.profile?.banner)}"></div>
        <div class="lc-art">${heroArtHTML(p.heroId, p.skinId, 'lc')}</div>
        <div class="lc-body">
          <div class="lc-hero">${esc(h.name || p.heroId)}</div>
          <div class="lc-skin" style="color:${rarityColor(sk?.rarity || 'default')}">${esc(sk && sk.rarity !== 'default' ? sk.name : (h.title || ''))}</div>
          <div class="lc-pl">${avatarHTML(p.profile || {}, 34)}<div><div class="lc-name">${esc(p.name)}${p.isBot ? ' <em>BOT</em>' : ''}</div>${titleHTML(p.profile?.title)}</div></div>
        </div></div>`;
    };
    const tips = ['Last-hit minions for bonus gold — CS adds up fast.', 'Wyrms grant team-wide elemental buffs. Stack 3 for the Soul.', 'Your ultimate unlocks at level 5.', 'Shop at the fountain or while dead.', 'The ground swells… watch for map shifts near objectives.', 'Objectives build momentum — chain them to snowball.', 'Augments at levels 3, 6 and 9 shape your playstyle.', 'Recall (B) to heal and buy safely.', 'The Colossus pushes lanes — take it to break a stalemate.'];
    const d = diffInfo(cfg.difficulty);
    const ld = frag(`<div class="loading">
      <div class="ld-bg"></div>
      <div class="ld-head"><div class="ld-mode">VS BOTS · <span style="color:${d.color}">${d.name.toUpperCase()}</span></div><div class="ld-map">THE HEAVING VALE</div></div>
      <div class="ld-team t0">${cfg.players.filter(p => p.team === 0).map(card).join('')}</div>
      <div class="ld-vs"><span>VS</span></div>
      <div class="ld-team t1">${cfg.players.filter(p => p.team === 1).map(card).join('')}</div>
      <div class="ld-foot"><div class="ld-tip">💡 ${esc(tips[Math.floor(Math.random() * tips.length)])}</div><div class="ld-bar"><div></div></div></div>
    </div>`);
    document.body.appendChild(ld);
    sfx('whoosh');
    const bar = ld.querySelector('.ld-bar div');
    requestAnimationFrame(() => { bar.style.width = '85%'; });
    setTimeout(() => {
      this.hide();
      this.el.classList.add('in-match');
      try { this.opts.startMatch && this.opts.startMatch(cfg); } catch (e) { console.error('startMatch failed', e); this.showMenu(); }
      bar.style.transition = 'width .3s'; bar.style.width = '100%';
      setTimeout(() => { ld.classList.add('out'); setTimeout(() => ld.remove(), 600); }, 450);
    }, 2600);
  }

  // ---------------- RESULTS ----------------
  showResults(match, rewards) {
    this.s = Save.get();
    const cfg = this.lastConfig || match?.config || {};
    let res = rewards && rewards.summary ? rewards : null;
    if (!res) { try { res = grantMatchRewards(match, cfg); } catch (e) { console.error('reward calc failed', e); res = null; } }
    this.lastResult = res; this.lastMatch = match;
    this.el.style.display = ''; this.el.classList.remove('in-match');
    this.screen = 'results';
    this.el.dataset.screen = 'results';
    this.renderTop();
    this.main.scrollTop = 0;
    this.main.innerHTML = `<div class="scr scr-results">${this.resultsHTML(match, cfg, res)}</div>`;
    this.animateResults(res);
  }
  resultsHTML(m, cfg, res) {
    const sum = res?.summary || {}; const won = sum.won;
    const players = cfg.players || [];
    const rows = (team) => (m?.heroes || []).map((h, i) => ({ h, p: players[i] || {} })).filter(x => (x.h.team ?? x.p.team) === team).map(({ h, p }) => {
      const items = (h.items || []).map(it => { const d = it && ITEM_BY_ID[it.id]; const src = it?.branch && d?.branches?.[it.branch] ? d.branches[it.branch] : d; return `<span class="ri">${ico(src, 26) || esc(src?.icon || '')}</span>`; }).join('');
      return `<tr class="${p.isBot ? '' : 'me'}"><td class="rt-h">${heroChipHTML(h.heroId || p.heroId, 34, '', p.skinId || h.visual?.skinId)}<div><b>${esc(p.name || h.name || '')}</b><small>${esc(HERO_BY_ID[h.heroId || p.heroId]?.name || '')} · Lv ${h.level || 1}</small></div></td>
        <td class="kda">${h.kills | 0}/${h.deaths | 0}/${h.assists | 0}</td><td>${h.cs | 0}</td><td class="gold">${fmt(h.goldEarned ?? h.gold ?? 0)}</td><td class="its">${items}</td></tr>`;
    }).join('');
    const myTeam = sum.team ?? 0;
    const tbl = (team) => `<table class="rtab t${team}"><thead><tr><th>${team === myTeam ? 'Your Team' : 'Enemies'} · ${m?.teamStats?.[team]?.kills | 0} kills</th><th>K/D/A</th><th>CS</th><th>Gold</th><th>Items</th></tr></thead><tbody>${rows(team)}</tbody></table>`;
    const title = !sum.finished ? 'MATCH LEFT' : won ? 'VICTORY' : 'DEFEAT';
    const R = res || { lines: [], quests: [], essence: 0, prisms: 0 };
    return `
    <div class="res-banner ${won ? 'win' : 'loss'}"><div class="rb-rays"></div><h1 data-t="${title}">${title}</h1>
      <div class="res-sub">${esc(diffInfo(sum.difficulty).name)} · ${fmtTime(sum.duration || 0)} · ${esc(HERO_BY_ID[sum.heroId]?.name || '')}</div></div>
    <div class="res-grid">
      <section class="panel res-stats">${tbl(myTeam)}${tbl(1 - myTeam)}</section>
      <section class="panel res-rew">
        <div class="rw-cur"><div class="rw-big">${ESS}<b class="cu" data-to="${R.essence}">0</b><span>Essence</span></div>${R.prisms ? `<div class="rw-big pri">${PRI}<b class="cu" data-to="${R.prisms}">0</b><span>Prisms</span></div>` : ''}</div>
        <div class="rw-lines">${R.lines.map((l, i) => `<div class="rwl" style="--d:${i * 0.12}s"><span>${esc(l.label)}</span><b>+${fmt(l.value)}${l.prisms ? ` · ${PRI}${l.prisms}` : ''}</b></div>`).join('')}</div>
        ${R.account ? this.progBar('acct', `Account Level <b class="lvn">${R.account.levelBefore}</b>`, `+${R.account.xpGained} XP`) : ''}
        ${R.mastery ? this.progBar('mast', `${esc(HERO_BY_ID[R.mastery.heroId]?.name || '')} Mastery <b class="mlv">M${R.mastery.before.level}</b>`, `+${R.mastery.xpGained}`) : ''}
        ${R.season ? this.progBar('seas', `Season Tier <b class="stv">${R.season.tierBefore}</b>`, `+${R.season.xpGained}`) : ''}
        ${R.ladder ? `<div class="ladder-res ${R.ladder.delta >= 0 ? 'up' : 'down'}"><span class="rankchip" style="--rc:${R.ladder.rankAfter.rank.color}">${R.ladder.rankAfter.rank.icon} ${R.ladder.rankAfter.label}</span><b>${R.ladder.delta >= 0 ? '+' : ''}${R.ladder.delta} LP</b>${R.ladder.promoted ? '<em>PROMOTED!</em>' : R.ladder.demoted ? '<em class="dn">Demoted</em>' : ''}</div>` : ''}
        ${R.quests.length ? `<div class="lbl">Quest Progress</div>${R.quests.map(q => `<div class="quest ${q.completed ? 'done flash' : ''}"><div class="q-top"><span class="q-t">${q.completed ? '✔ ' : ''}${esc(q.text)}</span><span class="q-r">${q.completed ? 'COMPLETE' : ''}</span></div><div class="q-bar"><div class="qa" data-from="${q.before / q.n}" data-to="${q.after / q.n}" style="width:${q.before / q.n * 100}%"></div><span>${q.after}/${q.n}</span></div></div>`).join('')}` : ''}
        <div class="res-btns"><button class="btn ghost" data-act="again">Play Again</button><button class="btn primary" data-act="continue">Continue</button></div>
      </section>
    </div>`;
  }
  progBar(k, label, gain) { return `<div class="pb pb-${k}"><div class="pb-l"><span>${label}</span><em>${gain}</em></div><div class="bar"><div class="pbf"></div></div></div>`; }
  animateResults(R) {
    const won = R?.summary?.won;
    sfx(won ? 'victory' : 'defeat');
    if (!R) return;
    const root = this.main;
    setTimeout(() => { root.querySelectorAll('.cu').forEach(el => countUp(el, +el.dataset.to, 1400, 0, () => sfx('tick', 0.07))); }, 700);
    const animBar = (sel, segs, onSeg) => {
      const f = root.querySelector(sel + ' .pbf'); if (!f) return;
      let i = 0;
      const next = () => {
        if (i >= segs.length) return;
        const [a, b] = segs[i]; f.style.transition = 'none'; f.style.width = a * 100 + '%'; void f.offsetWidth;
        f.style.transition = 'width .9s cubic-bezier(.2,.8,.2,1)'; f.style.width = b * 100 + '%';
        const idx = i; i++;
        setTimeout(() => { onSeg && onSeg(idx); next(); }, 950);
      };
      next();
    };
    setTimeout(() => {
      // account xp segments (with level-ups)
      const A = R.account; const segs = []; let lvl = A.levelBefore, x = A.xpBefore, gain = A.xpGained;
      while (gain > 0 && segs.length < 10) { const need = xpToNext(lvl) - x; if (gain >= need) { segs.push([x / xpToNext(lvl), 1]); gain -= need; lvl++; x = 0; } else { segs.push([x / xpToNext(lvl), (x + gain) / xpToNext(lvl)]); gain = 0; } }
      if (!segs.length) segs.push([A.xpAfter / xpToNext(A.levelAfter), A.xpAfter / xpToNext(A.levelAfter)]);
      let shownLvl = A.levelBefore;
      animBar('.pb-acct', segs, (i) => { if (segs[i][1] >= 1) { shownLvl++; const e = root.querySelector('.lvn'); if (e) { e.textContent = shownLvl; e.classList.add('pop'); } sfx('levelup'); this.floatBadge(root.querySelector('.pb-acct'), `LEVEL ${shownLvl}!`); } });
      const M = R.mastery; const mpB = masteryProgress(M.before), mpA = masteryProgress(M.after);
      animBar('.pb-mast', M.levelUp ? [[mpB.pct, 1], [0, mpA.pct]] : [[mpB.pct, mpA.pct]], (i) => { if (M.levelUp && i === 0) { const e = root.querySelector('.mlv'); if (e) { e.textContent = 'M' + M.after.level; e.classList.add('pop'); } sfx('levelup'); this.floatBadge(root.querySelector('.pb-mast'), `MASTERY ${M.after.level}!`); } });
      const S = R.season; const pct = (xpTotal) => (xpTotal % SEASON.xpPerTier) / SEASON.xpPerTier;
      const sAfter = this.s.season.xp; const sBefore = Math.max(0, sAfter - S.xpGained);
      const sseg = S.tierAfter > S.tierBefore ? [[pct(sBefore), 1], [0, S.tierAfter >= SEASON.tiers ? 1 : pct(sAfter)]] : [[pct(sBefore), S.tierAfter >= SEASON.tiers ? 1 : pct(sAfter)]];
      animBar('.pb-seas', sseg, (i) => { if (S.tierAfter > S.tierBefore && i === 0) { const e = root.querySelector('.stv'); if (e) { e.textContent = S.tierAfter; e.classList.add('pop'); } sfx('reward'); this.floatBadge(root.querySelector('.pb-seas'), `TIER ${S.tierAfter}!`); } });
      root.querySelectorAll('.qa').forEach(q => { q.style.transition = 'width 1.2s cubic-bezier(.2,.8,.2,1)'; q.style.width = (+q.dataset.to * 100) + '%'; });
    }, 1200);
    // unlock popups queue
    const queue = [...(R.unlocks || [])];
    if (R.ladder?.promoted) queue.unshift({ kind: 'rank', name: R.ladder.rankAfter.label, rank: R.ladder.rankAfter.rank, rarity: 'epic' });
    if (R.firstWin) queue.unshift({ kind: 'firstwin', name: 'First Win of the Day', rarity: 'rare' });
    setTimeout(() => this.popQueue(queue), 3300);
  }
  floatBadge(host, text) { if (!host) return; const b = frag(`<div class="floatb">${esc(text)}</div>`); host.appendChild(b); setTimeout(() => b.remove(), 1600); }
  popQueue(queue) {
    if (!queue.length || this.screen !== 'results') return;
    const u = queue.shift();
    let art = '', kindLabel = 'UNLOCKED';
    if (u.kind === 'flair') {
      const f = flair(u.id); kindLabel = `NEW ${f.kind.toUpperCase()}`;
      art = f.kind === 'banner' ? `<div class="pop-banner ${bannerClass(f.id)}" style="${bannerStyle(f.id)}"></div>` : f.kind === 'border' ? avatarHTML({ ...this.s.equipped, border: f.id }, 120) : f.kind === 'icon' ? avatarHTML({ ...this.s.equipped, icon: f.id }, 120) : f.kind === 'emote' ? `<div class="pop-glyph">${esc(f.glyph)}</div>` : `<div class="pop-title">${titleHTML(f.id)}</div>`;
    } else if (u.kind === 'skin') { const k = skinById(u.id); kindLabel = 'NEW SKIN'; art = heroArtHTML(k?.heroId, u.id, 'big'); }
    else if (u.kind === 'rank') { kindLabel = 'RANK UP'; art = `<div class="pop-glyph" style="filter:drop-shadow(0 0 30px ${u.rank.color})">${u.rank.icon}</div>`; }
    else if (u.kind === 'firstwin') { kindLabel = 'BONUS'; art = `<div class="pop-glyph">${PRI}</div><div class="muted">+50 Prisms · +200 Essence</div>`; }
    const col = rarityColor(u.rarity);
    sfx('reward');
    const md = modal(`<div class="unlock-pop" style="--rc:${col}"><div class="up-rays"></div><div class="up-k">${kindLabel}</div><div class="up-art">${art}</div><div class="up-n">${esc(u.name)}</div><div class="up-r" style="color:${col}">${esc(u.sub || u.rarity || '')}</div>
      ${u.kind === 'flair' ? `<button class="btn primary" data-act-equip="${u.id}">Equip</button>` : ''}<button class="btn ghost" data-close>Awesome!</button></div>`, { cls: 'pop', onClose: () => setTimeout(() => this.popQueue(queue), 250) });
    const eq = md.el.querySelector('[data-act-equip]');
    if (eq) eq.addEventListener('click', () => { const f = flair(u.id); this.s.equipped[f.kind] = f.id; Save.persist(); toast(`Equipped ${esc(f.name)}`); md.close(); });
  }
  act_continue() { this.showMenu('home'); }
  act_again() { const c = this.lastConfig; if (!c) { this.showMenu('play'); return; } const me = c.players[0]; this.launch(this.buildConfig(me.heroId, me.skinId, c.difficulty)); }

  // ---------------- shared buy dialog ----------------
  buyDialog(kind, id) { return this.openBuy(kind, id); }

  dispose() { this.disposePreview(); this.unsub && this.unsub(); this.el.remove(); }
}

Object.assign(App.prototype, MetaScreens);
export default App;
