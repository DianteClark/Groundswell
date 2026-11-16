// Armory, Shop, Profile, Settings screens (mixed into App.prototype).
import Save from '../meta/save.js';
import { HEROES, HERO_BY_ID, ITEMS, ITEM_BY_ID, RELICS, RELIC_BY_ID, SIGILS, SIGIL_BY_ID, getSkins, skinsFor, skinById, heroPrice, unlockCost, roleIcon, fmtStats, RARITY, recommendedLoadout } from '../meta/registry.js';
import { FLAIR_KINDS, FLAIR_LABEL, flair, sourceText } from '../meta/flair.js';
import { rankInfo, RANKS, DIFFICULTIES, masteryProgress, MASTERY_NAMES, MASTERY_COLORS, xpToNext, seeded, dayKey, msToMidnight, fmtCountdown } from '../meta/economy.js';
import { esc, fmt, fmtTime, avatarHTML, bannerStyle, bannerClass, titleHTML, heroArtHTML, heroChipHTML, toast, modal, profileCardHTML, ESS, PRI, priceHTML, rarityColor } from './dom.js';
import { sfx, setVolume } from './audio.js';

const SKIN_DEFAULT_PRICE = { common: { essence: 1500 }, rare: { essence: 2500 }, epic: { prisms: 400 }, legendary: { prisms: 1000 } };
const skinPrice = (k) => (k.price && (k.price.essence || k.price.prisms)) ? k.price : (SKIN_DEFAULT_PRICE[k.rarity] || { essence: 1500 });
const absCost = (x) => ({ essence: unlockCost(x) });

function priceOf(kind, id) {
  if (kind === 'hero') return heroPrice(HERO_BY_ID[id]);
  if (kind === 'skin') return skinPrice(skinById(id) || {});
  if (kind === 'item') return absCost(ITEM_BY_ID[id]);
  if (kind === 'relic') return absCost(RELIC_BY_ID[id]);
  if (kind === 'sigil') return absCost(SIGIL_BY_ID[id]);
  if (kind === 'flair') return flair(id)?.source?.price || null;
  return null;
}
function nameOf(kind, id) {
  return ({ hero: HERO_BY_ID[id]?.name, skin: skinById(id)?.name, item: ITEM_BY_ID[id]?.name, relic: RELIC_BY_ID[id]?.name, sigil: SIGIL_BY_ID[id]?.name, flair: flair(id)?.name })[kind] || id;
}
function featured() {
  // deterministic by date: 1 hero, 2 skins, 1 flair, 25% off
  const rnd = seeded('featured:' + dayKey());
  const pick = (arr) => arr.length ? arr.splice(Math.floor(rnd() * arr.length), 1)[0] : null;
  const heroes = HEROES.filter(h => !['bram', 'lumi', 'vex'].includes(h.id));
  const skins = getSkins().filter(k => k.rarity !== 'default');
  const fl = Object.values(FLAIR_KINDS).flat().filter(f => f.source?.type === 'shop');
  const out = [];
  const h = pick(heroes); if (h) out.push({ kind: 'hero', id: h.id });
  for (let i = 0; i < 2; i++) { const k = pick(skins); if (k) out.push({ kind: 'skin', id: k.id }); }
  const fe = fl.filter(x => x.rarity === 'epic' || x.rarity === 'legendary');
  for (let i = 0; i < 2; i++) { const f = pick(fe.length ? fe : fl); if (f) out.push({ kind: 'flair', id: f.id }); }
  return out;
}
const discount = (p, pct = 0.25) => p ? Object.fromEntries(Object.entries(p).filter(([, v]) => v).map(([k, v]) => [k, Math.round(v * (1 - pct) / 5) * 5])) : p;

function flairPreviewHTML(f, eq) {
  if (f.kind === 'banner') return `<div class="fp-banner ${bannerClass(f.id)}" style="${bannerStyle(f.id)}"></div>`;
  if (f.kind === 'border') return avatarHTML({ ...eq, border: f.id }, 64);
  if (f.kind === 'icon') return avatarHTML({ ...eq, icon: f.id }, 64);
  if (f.kind === 'emote') return `<div class="fp-emote">${esc(f.glyph)}<small>${esc(f.text)}</small></div>`;
  return `<div class="fp-title">${titleHTML(f.id)}</div>`;
}

export const MetaScreens = {
  // ================= BUY DIALOG =================
  openBuy(kind, id, priceOverride) {
    const price = priceOverride || priceOf(kind, id);
    if (!price) { toast(esc(sourceText(flair(id)) || 'Not purchasable')); return; }
    const name = nameOf(kind, id);
    let art = '';
    if (kind === 'hero') { const h = HERO_BY_ID[id]; art = `<div class="buy-prev"><div class="preview-slot-m"></div></div><h2>${esc(h.name)}</h2><div class="muted">${roleIcon(h.role)} ${esc(h.role)} · ${esc(h.title || '')}</div><p class="lore">${esc(h.lore || '')}</p>`; }
    else if (kind === 'skin') { const k = skinById(id); art = `<div class="buy-prev"><div class="preview-slot-m"></div></div><div class="rar" style="--rc:${rarityColor(k.rarity)}">${RARITY[k.rarity]?.name || k.rarity}</div><h2>${esc(k.name)}</h2><div class="muted">${esc(HERO_BY_ID[k.heroId]?.name || '')} skin</div><p class="lore">${esc(k.desc || '')}</p>`; }
    else if (kind === 'flair') { const f = flair(id); art = `<div class="buy-flair">${flairPreviewHTML(f, this.s.equipped)}</div><div class="rar" style="--rc:${rarityColor(f.rarity)}">${RARITY[f.rarity]?.name} ${f.kind}</div><h2>${esc(f.name)}</h2>`; }
    else { const d = kind === 'item' ? ITEM_BY_ID[id] : kind === 'relic' ? RELIC_BY_ID[id] : SIGIL_BY_ID[id]; art = `<div class="buy-icon">${esc(d.icon || '◆')}</div><h2>${esc(d.name)}</h2><p class="lore">${esc(d.desc || '')}${d.bonusDesc ? '<br><em>' + esc(d.bonusDesc) + '</em>' : ''}</p>`; }
    const btns = Object.entries(price).filter(([, v]) => v).map(([cur, v]) => `<button class="btn primary buyb" data-cur="${cur}" data-v="${v}" ${(this.s[cur] || 0) < v ? 'disabled' : ''}>${cur === 'essence' ? ESS : PRI}${fmt(v)}</button>`).join('');
    const md = modal(`<div class="buy">${art}<div class="buy-btns">${btns}</div><div class="muted sm">You have ${ESS}${fmt(this.s.essence)} ${PRI}${fmt(this.s.prisms)}</div></div>`, { cls: 'buy-m' });
    const slot = md.el.querySelector('.preview-slot-m');
    let pv = null;
    if (slot) {
      const hid = kind === 'hero' ? id : skinById(id)?.heroId; const sid = kind === 'skin' ? id : (skinsFor(id)[0]?.id);
      if (this.opts.createHeroPreview) { this.disposePreview(); try { pv = this.opts.createHeroPreview(slot, hid, sid); } catch (e) { pv = null; slot.innerHTML = heroArtHTML(hid, sid, 'big'); } }
      else slot.innerHTML = heroArtHTML(hid, sid, 'big');
    }
    const cleanup = () => { if (pv) { try { pv.dispose(); } catch (e) { /* */ } pv = null; this.render(); } };
    md.el.addEventListener('click', (e) => { if (e.target === md.el || e.target.closest('[data-close]')) cleanup(); });
    md.el.querySelectorAll('.buyb').forEach(b => b.addEventListener('click', () => {
      if (Save.purchase(kind, id, b.dataset.cur, +b.dataset.v)) {
        sfx('purchase'); md.close(); cleanup();
        this.celebrate(kind, id, name);
        if (kind === 'skin') { const k = skinById(id); this.s.lastPick.skin[k.heroId] = id; Save.persist(); }
        this.render();
      } else { sfx('error'); toast('Not enough currency', 'bad'); }
    }));
  },
  celebrate(kind, id, name) {
    const label = { hero: 'HERO UNLOCKED', skin: 'SKIN UNLOCKED', flair: 'FLAIR UNLOCKED', item: 'ITEM UNLOCKED', relic: 'RELIC UNLOCKED', sigil: 'SIGIL UNLOCKED' }[kind];
    const rar = kind === 'skin' ? skinById(id)?.rarity : kind === 'flair' ? flair(id)?.rarity : kind === 'hero' ? 'legendary' : 'rare';
    let art = '';
    if (kind === 'hero') art = heroArtHTML(id, skinsFor(id)[0]?.id, 'big');
    else if (kind === 'skin') art = heroArtHTML(skinById(id)?.heroId, id, 'big');
    else if (kind === 'flair') art = flairPreviewHTML(flair(id), this.s.equipped);
    else { const d = ITEM_BY_ID[id] || RELIC_BY_ID[id] || SIGIL_BY_ID[id]; art = `<div class="pop-glyph">${esc(d?.icon || '◆')}</div>`; }
    const col = rarityColor(rar);
    const md = modal(`<div class="unlock-pop" style="--rc:${col}"><div class="up-rays"></div><div class="up-k">${label}</div><div class="up-art">${art}</div><div class="up-n">${esc(name)}</div>${kind === 'flair' ? '<button class="btn primary" data-eq>Equip now</button>' : ''}<button class="btn ghost" data-close>Nice!</button></div>`, { cls: 'pop' });
    const eq = md.el.querySelector('[data-eq]');
    if (eq) eq.addEventListener('click', () => { const f = flair(id); this.s.equipped[f.kind] = id; Save.persist(); md.close(); this.render(); });
  },

  // ================= ARMORY =================
  screen_armory() {
    const a = this.ui.armory; const s = this.s;
    if (!a.heroId || !HERO_BY_ID[a.heroId]) a.heroId = s.lastPick.heroId || s.owned.heroes[0];
    const h = HERO_BY_ID[a.heroId];
    const tabs = [['loadouts', 'Loadouts'], ['items', 'Items'], ['relics', 'Relics'], ['sigils', 'Sigils'], ['abilities', 'Abilities']];
    return `
    <div class="scr-head"><h1>Armory</h1><div class="muted">Plan builds, browse gear and study your heroes.</div></div>
    <div class="hstrip" data-scroll="arm-h">${HEROES.map(x => `<button class="hstrip-b ${x.id === h.id ? 'on' : ''} ${Save.owns('hero', x.id) ? '' : 'locked'}" data-act="armHero" data-h="${x.id}">${heroChipHTML(x.id, 44)}<span>${esc(x.name)}</span></button>`).join('')}</div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${a.tab === k ? 'on' : ''}" data-act="armTab" data-t="${k}">${l}</button>`).join('')}</div>
    <div class="arm-body">${this['arm_' + a.tab](h)}</div>`;
  },
  act_armHero(d) { this.ui.armory.heroId = d.h; this.render(); },
  act_armTab(d) { this.ui.armory.tab = d.t; this.render(); },

  arm_loadouts(h) {
    const owned = Save.owns('hero', h.id);
    const L = Save.heroLoadouts(h.id); const lo = Save.sanitizeLoadout(L.list[L.active], h.id);
    L.list[L.active] = { ...lo };
    const slotCard = (label, icon, name, desc, act, data = '', cls = '') => `<button class="lslot ${cls}" data-act="${act}" ${data}><span class="ls-lbl">${label}</span><span class="ls-ic">${esc(icon || '+')}</span><span class="ls-n">${esc(name || 'Empty')}</span><span class="ls-d">${esc(desc || '')}</span></button>`;
    const r = RELIC_BY_ID[lo.relic]; const so = SIGIL_BY_ID[lo.sigils.offense]; const su = SIGIL_BY_ID[lo.sigils.utility];
    return `
    ${owned ? '' : `<div class="notice">🔒 You don't own ${esc(h.name)} yet — you can still plan builds. <button class="btn sm primary" data-act="buyHero" data-h="${h.id}">Unlock ${priceHTML(heroPrice(h))}</button></div>`}
    <div class="lo-list">${L.list.map((l, i) => `<button class="chip ${i === L.active ? 'on' : ''}" data-act="loSel" data-i="${i}">${esc(l.name)}</button>`).join('')}
      ${L.list.length < 5 ? '<button class="chip add" data-act="loNew">＋ New</button>' : ''}</div>
    <div class="panel lo-ed">
      <div class="lo-head"><input class="inp" maxlength="20" value="${esc(lo.name)}" data-inp="loName" aria-label="Loadout name"><button class="btn sm ghost" data-act="loReset" title="Reset to recommended">↺ Reset</button>${L.list.length > 1 ? '<button class="btn sm danger" data-act="loDel">Delete</button>' : ''}</div>
      <div class="lbl">Items <span class="muted sm lbl-help">· each slot upgrades Tier 1 → Tier 2 → choose a branch, in-match</span></div>
      <div class="lslots">${[0, 1, 2].map(i => { const it = ITEM_BY_ID[lo.items[i]]; return slotCard(`Slot ${i + 1}`, it?.icon, it?.name, it ? `${it.category} · ${it.branches?.a?.name || ''} / ${it.branches?.b?.name || ''}` : '', 'loPick', `data-k="item" data-i="${i}"`, 'cat-' + (it?.category || '')); }).join('')}</div>
      <div class="lbl">Relic &amp; Sigils</div>
      <div class="lslots">${slotCard('Relic', r?.icon, r?.name, r?.desc, 'loPick', 'data-k="relic"', 'relic')}${slotCard('Offense Sigil', so?.icon, so?.name, so?.desc, 'loPick', 'data-k="sigil" data-slot="offense"', 'sig')}${slotCard('Utility Sigil', su?.icon, su?.name, su?.desc, 'loPick', 'data-k="sigil" data-slot="utility"', 'sig')}</div>
    </div>`;
  },
  inp_loName(el) { const L = Save.heroLoadouts(this.ui.armory.heroId); L.list[L.active].name = el.value.slice(0, 20) || 'Loadout'; Save.persist(); },
  act_loSel(d) { const L = Save.heroLoadouts(this.ui.armory.heroId); L.active = +d.i; Save.persist(); this.render(); },
  act_loNew() { const id = this.ui.armory.heroId; const L = Save.heroLoadouts(id); L.list.push(Save.sanitizeLoadout({ ...L.list[L.active], name: 'Build ' + (L.list.length + 1) }, id)); L.active = L.list.length - 1; Save.persist(); this.render(); },
  act_loDel() { const L = Save.heroLoadouts(this.ui.armory.heroId); if (L.list.length <= 1) return; L.list.splice(L.active, 1); L.active = 0; Save.persist(); this.render(); },
  act_loReset() { const id = this.ui.armory.heroId; const L = Save.heroLoadouts(id); L.list[L.active] = Save.sanitizeLoadout({ name: L.list[L.active].name, ...recommendedLoadout(HERO_BY_ID[id]) }, id); Save.persist(); this.render(); },
  act_buyHero(d) { this.openBuy('hero', d.h); },
  act_loPick(d) {
    const id = this.ui.armory.heroId; const L = Save.heroLoadouts(id); const lo = L.list[L.active];
    let list = [], kind = d.k;
    if (kind === 'item') list = ITEMS; else if (kind === 'relic') list = RELICS; else list = SIGILS.filter(x => x.slot === d.slot);
    const cur = kind === 'item' ? lo.items[+d.i] : kind === 'relic' ? lo.relic : lo.sigils[d.slot];
    const html = `<h2>Choose ${kind === 'item' ? 'item for slot ' + (+d.i + 1) : kind === 'relic' ? 'relic' : d.slot + ' sigil'}</h2><div class="pick-list">${list.map(x => {
      const own = Save.owns(kind, x.id); const used = kind === 'item' && lo.items.includes(x.id) && x.id !== cur;
      return `<button class="pick-row ${x.id === cur ? 'on' : ''} ${own ? '' : 'locked'} ${used ? 'used' : ''} cat-${x.category || ''}" data-id="${x.id}"><span class="pr-ic">${esc(x.icon || '◆')}</span><span class="pr-t"><b>${esc(x.name)}</b><small>${esc(kind === 'item' ? (x.tiers?.[0]?.desc || fmtStats(x.tiers?.[0]?.stats)) + ' → ' + [x.branches?.a?.name, x.branches?.b?.name].filter(Boolean).join(' / ') : x.desc || '')}</small></span>${own ? (used ? '<em>in use</em>' : '') : `<em class="pr-price">🔒 ${priceHTML(priceOf(kind, x.id))}</em>`}</button>`;
    }).join('')}</div>`;
    const md = modal(html, { cls: 'wide' });
    md.el.querySelectorAll('.pick-row').forEach(b => b.addEventListener('click', () => {
      const xid = b.dataset.id;
      if (!Save.owns(kind, xid)) { md.close(); this.openBuy(kind, xid); return; }
      if (kind === 'item') { const j = lo.items.indexOf(xid); if (j >= 0 && j !== +d.i) lo.items[j] = lo.items[+d.i]; lo.items[+d.i] = xid; }
      else if (kind === 'relic') lo.relic = xid; else lo.sigils[d.slot] = xid;
      L.list[L.active] = Save.sanitizeLoadout(lo, id); Save.persist(); sfx('click'); md.close(); this.render();
    }));
  },

  arm_items() {
    const cats = [...new Set(ITEMS.map(i => i.category))];
    return cats.map(c => `<div class="lbl cat-${c}">${esc(c)}</div><div class="icards">${ITEMS.filter(i => i.category === c).map(it => {
      const own = Save.owns('item', it.id);
      const br = (k) => it.branches?.[k] ? `<div class="ib-br"><span class="ib-ic">${esc(it.branches[k].icon || '')}</span><b>${esc(it.branches[k].name)}</b><span class="cost">${fmt(it.branches[k].cost)}g</span><small>${esc(it.branches[k].desc || fmtStats(it.branches[k].stats))}</small>${it.branches[k].passive ? `<small class="pas"><b>${esc(it.branches[k].passive.name)}:</b> ${esc(it.branches[k].passive.desc)}</small>` : ''}</div>` : '';
      return `<div class="icard cat-${it.category} ${own ? '' : 'locked'}"><div class="ic-h"><span class="ic-ic">${esc(it.icon)}</span><b>${esc(it.name)}</b>${own ? '' : `<button class="btn sm primary" data-act="unlock" data-k="item" data-id="${it.id}">🔒 ${priceHTML(priceOf('item', it.id))}</button>`}</div>
        <div class="ib-tiers">${(it.tiers || []).map((t, i) => `<div class="ib-t"><span class="tier">T${i + 1}</span><span class="cost">${fmt(t.cost)}g</span><small>${esc(t.desc || fmtStats(t.stats))}</small></div>`).join('<span class="ib-arrow">›</span>')}</div>
        <div class="ib-brs">${br('a')}<span class="ib-or">or</span>${br('b')}</div></div>`;
    }).join('')}</div>`).join('');
  },
  arm_relics() {
    return `<div class="icards">${RELICS.map(r => { const own = Save.owns('relic', r.id); return `<div class="icard relic ${own ? '' : 'locked'}"><div class="ic-h"><span class="ic-ic">${esc(r.icon)}</span><b>${esc(r.name)}</b><span class="muted sm">${r.cd ? r.cd + 's' : ''}</span>${own ? '' : `<button class="btn sm primary" data-act="unlock" data-k="relic" data-id="${r.id}">🔒 ${priceHTML(priceOf('relic', r.id))}</button>`}</div>
      <p><b class="hl">Spell:</b> ${esc(r.desc || '')}</p>${r.bonusDesc ? `<p><b class="hl2">Bonus:</b> ${esc(r.bonusDesc)}</p>` : ''}</div>`; }).join('')}</div>`;
  },
  arm_sigils() {
    return ['offense', 'utility'].map(sl => `<div class="lbl">${sl === 'offense' ? '⚔ Offense' : '✦ Utility'} Sigils</div><div class="icards">${SIGILS.filter(x => x.slot === sl).map(x => { const own = Save.owns('sigil', x.id); return `<div class="icard sig ${own ? '' : 'locked'}"><div class="ic-h"><span class="ic-ic">${esc(x.icon)}</span><b>${esc(x.name)}</b>${own ? '' : `<button class="btn sm primary" data-act="unlock" data-k="sigil" data-id="${x.id}">🔒 ${priceHTML(priceOf('sigil', x.id))}</button>`}</div><p>${esc(x.desc || '')}</p></div>`; }).join('')}</div>`).join('');
  },
  arm_abilities(h) {
    const ab = h.abilities || {};
    const row = (k, lbl) => ab[k] ? `<div class="abrow"><span class="ab-k">${lbl}</span><div><b>${esc(ab[k].name)}</b>${ab[k].cd ? `<span class="muted sm"> · ${typeof ab[k].cd === 'number' ? ab[k].cd + 's' : ''}</span>` : ''}${(ab[k].tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}<p>${esc(ab[k].desc || '')}</p></div></div>` : '';
    const aug = h.augments || {};
    return `<div class="panel"><div class="ab-head">${heroArtHTML(h.id, skinsFor(h.id)[0]?.id, 'sm')}<div><h2>${esc(h.name)}</h2><div class="muted">${roleIcon(h.role)} ${esc(h.role)} · ${esc(h.title || '')} · Difficulty ${'◆'.repeat(h.difficulty || 1)}</div><p class="lore">${esc(h.lore || '')}</p></div></div>
      ${row('passive', 'P')}${row('q', 'Q')}${row('w', 'W')}${row('r', 'R')}</div>
      <div class="lbl">Augments <span class="muted sm">· pick one per level in-match</span></div>
      <div class="augs">${Object.keys(aug).map(l => `<div class="aug-l"><span class="aug-lv">Lv ${l}</span>${['a', 'b'].map(k => aug[l][k] ? `<div class="aug-c"><b>${esc(aug[l][k].name)}</b><small>${esc(aug[l][k].desc || '')}</small></div>` : '').join('<span class="ib-or">or</span>')}</div>`).join('')}</div>`;
  },
  act_unlock(d) { this.openBuy(d.k, d.id); },

  // ================= SHOP =================
  screen_shop() {
    const t = this.ui.shop.tab;
    const tabs = [['featured', '★ Featured'], ['heroes', 'Heroes'], ['skins', 'Skins'], ['gear', 'Gear'], ['flair', 'Flair']];
    return `<div class="scr-head"><h1>Shop</h1><div class="muted">Everything is earnable by playing. No real money — ever.</div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${t === k ? 'on' : ''}" data-act="shopTab" data-t="${k}">${l}</button>`).join('')}</div>
      <div class="shop-body">${this['shop_' + t]()}</div>`;
  },
  act_shopTab(d) { this.ui.shop.tab = d.t; this.render(); },
  offerHTML(kind, id, opts = {}) {
    const own = Save.owns(kind, id); const base = priceOf(kind, id); const price = opts.sale ? discount(base) : base;
    let art = '', title = nameOf(kind, id), sub = '', rar = 'common';
    if (kind === 'hero') { const h = HERO_BY_ID[id]; art = heroArtHTML(id, skinsFor(id)[0]?.id, 'shop'); sub = `${roleIcon(h.role)} ${h.role}`; rar = 'legendary'; }
    else if (kind === 'skin') { const k = skinById(id); art = heroArtHTML(k.heroId, id, 'shop'); sub = HERO_BY_ID[k.heroId]?.name || ''; rar = k.rarity; }
    else if (kind === 'flair') { const f = flair(id); art = `<div class="of-flair">${flairPreviewHTML(f, this.s.equipped)}</div>`; sub = f.kind; rar = f.rarity; }
    else { const d = ITEM_BY_ID[id] || RELIC_BY_ID[id] || SIGIL_BY_ID[id]; art = `<div class="of-glyph">${esc(d.icon || '◆')}</div>`; sub = kind === 'item' ? d.category + ' item' : kind; rar = 'rare'; }
    const pr = price ? Object.entries(price).filter(([, v]) => v).map(([c, v]) => `${c === 'essence' ? ESS : PRI}${fmt(v)}`).join('<span class="or">/</span>') : '';
    return `<button class="offer r-${rar} ${own ? 'owned' : ''} ${opts.big ? 'big' : ''}" style="--rc:${rarityColor(rar)}" data-act="offer" data-k="${kind}" data-id="${id}" ${opts.sale ? 'data-sale="1"' : ''}>
      ${opts.sale ? '<span class="sale">-25%</span>' : ''}<div class="of-art">${art}</div>
      <div class="of-info"><span class="of-rar">${esc(RARITY[rar]?.name || '')} ${esc(sub)}</span><b>${esc(title)}</b><span class="of-p">${own ? '✔ Owned' : (opts.sale ? `<s>${priceHTML(base)}</s> ` : '') + pr}</span></div></button>`;
  },
  act_offer(d) { if (Save.owns(d.k, d.id)) { if (d.k === 'skin') { const k = skinById(d.id); this.ui.play.heroId = k.heroId; this.s.lastPick.skin[k.heroId] = d.id; Save.persist(); toast(`Equipped ${esc(k.name)}`); } else toast('Already owned'); return; } this.openBuy(d.k, d.id, d.sale ? discount(priceOf(d.k, d.id)) : null); },
  shop_featured() {
    const f = featured();
    return `<div class="feat-head"><span>Daily rotation</span><span class="muted">New deals in ${fmtCountdown(msToMidnight())}</span></div>
      <div class="offers feat">${f.map((o, i) => this.offerHTML(o.kind, o.id, { sale: true, big: i === 0 })).join('')}</div>`;
  },
  shop_heroes() { return `<div class="offers">${HEROES.map(h => this.offerHTML('hero', h.id)).join('')}</div>`; },
  shop_skins() {
    const sk = getSkins().filter(k => k.rarity !== 'default').sort((a, b) => (RARITY[b.rarity]?.order || 0) - (RARITY[a.rarity]?.order || 0));
    return `<div class="offers">${sk.map(k => this.offerHTML('skin', k.id)).join('')}</div>`;
  },
  shop_gear() {
    const locked = (list, kind) => list.filter(x => unlockCost(x) > 0).map(x => this.offerHTML(kind, x.id)).join('');
    const all = locked(ITEMS, 'item') + locked(RELICS, 'relic') + locked(SIGILS, 'sigil');
    return all ? `<div class="offers">${all}</div>` : '<div class="panel muted center">All gear unlocked!</div>';
  },
  shop_flair() {
    return Object.entries(FLAIR_KINDS).map(([k, list]) => { const sh = list.filter(f => f.source?.type === 'shop'); return sh.length ? `<div class="lbl">${FLAIR_LABEL[k]}</div><div class="offers">${sh.map(f => this.offerHTML('flair', f.id)).join('')}</div>` : ''; }).join('');
  },

  // ================= PROFILE =================
  screen_profile() {
    const s = this.s; const p = this.ui.profile; const li = rankInfo(s.ladder.points);
    const tabs = [['customize', 'Customize'], ['stats', 'Stats'], ['mastery', 'Mastery'], ['history', 'History'], ['save', 'Save']];
    return `<div class="prof-head">${profileCardHTML({ ...this.profile() }, { cls: 'huge', av: 96 })}
        <div class="prof-meta"><button class="btn sm ghost" data-act="rename">✎ Rename</button>
        <span class="rankchip big" style="--rc:${li.rank.color}">${li.rank.icon} ${li.label}${li.idx < 6 ? ` · ${li.lp} LP` : ` · ${li.lp} LP`}</span>
        <div class="xpbar sm"><div class="xpfill" style="width:${(s.xp / xpToNext(s.level) * 100).toFixed(1)}%"></div><span>Lv ${s.level} · ${fmt(s.xp)}/${fmt(xpToNext(s.level))}</span></div></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${p.tab === k ? 'on' : ''}" data-act="profTab" data-t="${k}">${l}</button>`).join('')}</div>
      <div class="prof-body">${this['prof_' + p.tab]()}</div>`;
  },
  act_profTab(d) { this.ui.profile.tab = d.t; this.render(); },
  act_rename() {
    const md = modal(`<h2>Rename</h2><input class="inp big" maxlength="16" value="${esc(this.s.name)}" id="rn"><div class="buy-btns"><button class="btn primary" id="rnok">Save</button></div>`);
    const i = md.el.querySelector('#rn'); i.focus(); i.select();
    const ok = () => { const v = i.value.replace(/[<>]/g, '').trim().slice(0, 16); if (v.length >= 2) { this.s.name = v; Save.persist(); md.close(); this.render(); } else toast('Name too short', 'bad'); };
    md.el.querySelector('#rnok').addEventListener('click', ok); i.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  },
  prof_customize() {
    const k = this.ui.profile.kind; const list = FLAIR_KINDS[k]; const eq = this.s.equipped;
    return `<div class="chips">${Object.keys(FLAIR_KINDS).map(x => `<button class="chip ${x === k ? 'on' : ''}" data-act="flKind" data-k="${x}">${FLAIR_LABEL[x]} <small>${FLAIR_KINDS[x].filter(f => Save.owns('flair', f.id)).length}/${FLAIR_KINDS[x].length}</small></button>`).join('')}</div>
      <div class="fgrid k-${k}">${[...list].sort((a, b) => (Save.owns('flair', b.id) - Save.owns('flair', a.id)) || (RARITY[a.rarity].order - RARITY[b.rarity].order)).map(f => { const own = Save.owns('flair', f.id); const on = eq[k] === f.id;
        return `<button class="fcard r-${f.rarity} ${own ? '' : 'locked'} ${on ? 'on' : ''}" style="--rc:${rarityColor(f.rarity)}" data-act="flEquip" data-id="${f.id}">${flairPreviewHTML(f, eq)}<b>${esc(f.name)}</b><small>${on ? '✔ Equipped' : own ? RARITY[f.rarity].name : (f.source.type === 'shop' ? '🔒 ' + priceHTML(f.source.price) : '🔒 ' + esc(sourceText(f)))}</small></button>`; }).join('')}</div>`;
  },
  act_flKind(d) { this.ui.profile.kind = d.k; this.render(); },
  act_flEquip(d) {
    const f = flair(d.id);
    if (!Save.owns('flair', f.id)) { if (f.source.type === 'shop') this.openBuy('flair', f.id); else toast('🔒 ' + esc(sourceText(f))); return; }
    this.s.equipped[f.kind] = f.id; Save.persist(); sfx('purchase'); this.render();
  },
  prof_stats() {
    const st = this.s.stats; const li = rankInfo(this.s.ladder.points);
    const kda = ((st.kills + st.assists) / Math.max(1, st.deaths)).toFixed(2);
    const tile = (v, l) => `<div class="stile"><b>${v}</b><span>${l}</span></div>`;
    const maxW = Math.max(1, ...st.winsByDiff.slice(1));
    return `<div class="panel ladder"><div class="ph"><h3>Bot Ladder</h3><span class="muted">Climb by winning at harder difficulties</span></div>
      <div class="lad-row">${RANKS.map((r, i) => `<div class="lad ${i === li.idx ? 'on' : ''} ${i < li.idx ? 'past' : ''}" style="--rc:${r.color}"><span>${r.icon}</span><b>${r.name}</b><small>${DIFFICULTIES[r.minDiff - 1].name}+</small></div>`).join('')}</div>
      <div class="bar"><div style="width:${li.pct * 100}%;background:${li.rank.color}"></div></div><div class="muted sm">${li.label} · ${li.lp}${li.idx < 6 ? '/100' : ''} LP · Wins at ${DIFFICULTIES[li.rank.minDiff - 1].name} or higher give full LP</div></div>
      <div class="stiles">${tile(st.games, 'Games')}${tile(st.games ? Math.round(st.wins / st.games * 100) + '%' : '—', 'Win rate')}${tile(kda, 'KDA')}${tile(fmt(st.cs), 'Last hits')}${tile(st.wyrms, 'Wyrms')}${tile(st.colossus, 'Colossi')}${tile(st.towers, 'Towers')}${tile(fmtTime(st.playtime).replace(/:\d\d$/, '') + 'm', 'Play time')}${tile(st.bestStreak, 'Best streak')}${tile(st.bestKills, 'Most kills')}${tile(fmt(st.essenceEarned), 'Essence earned')}${tile(st.perfectGames, 'Perfect games')}</div>
      <div class="panel"><div class="ph"><h3>Wins by difficulty</h3></div>${DIFFICULTIES.map(d => `<div class="wbd"><span style="color:${d.color}">${d.name}</span><div class="bar"><div style="width:${st.winsByDiff[d.id] / maxW * 100}%;background:${d.color}"></div></div><b>${st.winsByDiff[d.id]}</b></div>`).join('')}</div>`;
  },
  prof_mastery() {
    return `<div class="mlist">${HEROES.map(h => { const m = Save.masteryOf(h.id); const mp = masteryProgress(m); const own = Save.owns('hero', h.id);
      return `<div class="mrow ${own ? '' : 'locked'}">${heroChipHTML(h.id, 46)}<div class="mr-b"><div class="mr-t"><b>${esc(h.name)}</b><span class="mbadge" style="--mc:${MASTERY_COLORS[mp.level - 1]}">M${mp.level} ${MASTERY_NAMES[mp.level - 1]}</span></div>
        <div class="mpips">${[1, 2, 3, 4, 5, 6, 7].map(i => `<i class="${i <= mp.level ? 'on' : ''}" style="--mc:${MASTERY_COLORS[i - 1]}"></i>`).join('')}</div>
        <div class="bar sm"><div style="width:${mp.pct * 100}%;background:${MASTERY_COLORS[mp.level - 1]}"></div></div><small class="muted">${m.games || 0} games · ${m.wins || 0} wins${mp.next ? ` · ${fmt(mp.cur)}/${fmt(mp.next)} xp` : ' · MAX'}</small></div></div>`; }).join('')}</div>`;
  },
  prof_history() {
    const hs = this.s.history;
    if (!hs.length) return '<div class="panel center muted">No matches yet. Go make some history!</div>';
    return `<div class="hist">${hs.map(m => `<div class="hrow ${m.won ? 'w' : 'l'}"><span class="hr-res">${m.won ? 'WIN' : m.finished === false ? 'LEFT' : 'LOSS'}</span>${heroChipHTML(m.heroId, 36)}<div class="hr-b"><b>${esc(HERO_BY_ID[m.heroId]?.name || m.heroId)}</b><small>${DIFFICULTIES[(m.diff || 1) - 1].name} · ${fmtTime(m.dur)} · ${new Date(m.t).toLocaleDateString()}</small></div><span class="hr-kda">${m.k}/${m.d}/${m.a}</span><span class="hr-cs">${m.cs} cs</span></div>`).join('')}</div>`;
  },
  prof_save() {
    return `<div class="panel"><div class="ph"><h3>Export save</h3></div><p class="muted sm">Your progress lives in this browser. Copy this code to back it up or move it to another device.</p>
      <textarea class="inp code" readonly id="exp">${esc(Save.exportCode())}</textarea><button class="btn primary" data-act="copyCode">Copy code</button></div>
      <div class="panel"><div class="ph"><h3>Import save</h3></div><p class="muted sm">Paste a save code. This replaces your current progress.</p>
      <textarea class="inp code" id="imp" placeholder="GS1...."></textarea><button class="btn" data-act="importCode">Import</button></div>
      <div class="panel danger-zone"><div class="ph"><h3>Reset</h3></div><button class="btn danger" data-act="resetSave">Reset all progress</button></div>`;
  },
  act_copyCode() { const t = this.main.querySelector('#exp'); t.select(); (navigator.clipboard?.writeText(t.value) || Promise.reject()).then(() => toast('Save code copied'), () => { document.execCommand && document.execCommand('copy'); toast('Save code selected — copy it'); }); },
  act_importCode() { const v = this.main.querySelector('#imp').value; const r = Save.importCode(v); if (r.ok) { sfx('purchase'); toast('Save imported!'); this.s = Save.get(); this.render(); } else { sfx('error'); toast(esc(r.error), 'bad'); } },
  act_resetSave() { const md = modal('<h2>Reset everything?</h2><p class="muted">This cannot be undone. Export your save first if unsure.</p><div class="buy-btns"><button class="btn danger" id="rs">Yes, reset</button><button class="btn ghost" data-close>Cancel</button></div>'); md.el.querySelector('#rs').addEventListener('click', () => { Save.reset(); md.close(); this.s = Save.get(); toast('Progress reset'); this.go('home'); }); },

  // ================= SETTINGS =================
  screen_settings() {
    const st = this.s.settings;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="segb ${st[key] === v ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const slider = (key, min, max, step, fmtv) => `<div class="sl"><input type="range" min="${min}" max="${max}" step="${step}" value="${st[key]}" data-inp="setRange" data-k="${key}"><output>${fmtv(st[key])}</output></div>`;
    const tog = (key) => `<button class="tog ${st[key] ? 'on' : ''}" data-act="setTog" data-k="${key}"><i></i></button>`;
    const pct = v => Math.round(v * 100) + '%';
    return `<div class="scr-head"><h1>Settings</h1></div>
      <div class="panel setg"><h3>Graphics</h3><div class="srow"><span>Quality</span>${seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['med', 'Medium'], ['high', 'High']])}</div><div class="srow"><span>Show FPS</span>${tog('showFps')}</div></div>
      <div class="panel setg"><h3>Audio</h3><div class="srow"><span>Master</span>${slider('master', 0, 1, 0.05, pct)}</div><div class="srow"><span>Effects</span>${slider('sfx', 0, 1, 0.05, pct)}</div><div class="srow"><span>Music</span>${slider('music', 0, 1, 0.05, pct)}</div></div>
      <div class="panel setg"><h3>Controls</h3><div class="srow"><span>Camera</span>${seg('camera', [['follow', 'Follow hero'], ['free', 'Free (edge pan)']])}</div><div class="srow"><span>Edge panning</span>${tog('edgePan')}</div><div class="srow"><span>Touch control size</span>${slider('touchSize', 0.7, 1.4, 0.05, pct)}</div><div class="srow"><span>Attack: prioritize champions</span>${tog('champPriority')}</div><div class="srow"><span>Auto-buy items at fountain</span><button class="tog ${(st.autoBuy ?? matchMedia('(pointer: coarse)').matches) ? 'on' : ''}" data-act="setAuto"><i></i></button></div>
      <div class="keys muted sm"><b>Desktop:</b> Right-click move/attack · A+click attack-move · Q W R abilities (aim at cursor) · D/F relic · B recall · S stop · Space center camera · Y lock camera · Tab scoreboard · P shop</div></div>
      <div class="panel setg"><h3>About</h3><p class="muted sm">Groundswell — a free 3v3 arena where the battlefield itself swells and shifts. All progress is local; back it up from Profile › Save.</p></div>`;
  },
  act_set(d) { this.s.settings[d.k] = d.v; Save.persist(); this.opts.onSettings?.(this.s.settings); this.render(); },
  act_setAuto() { const st = this.s.settings; st.autoBuy = !(st.autoBuy ?? matchMedia('(pointer: coarse)').matches); Save.persist(); this.opts.onSettings?.(st); this.render(); },
  act_setTog(d) { this.s.settings[d.k] = !this.s.settings[d.k]; Save.persist(); this.opts.onSettings?.(this.s.settings); this.render(); },
  inp_setRange(el, e) {
    const k = el.dataset.k; this.s.settings[k] = +el.value; el.nextElementSibling.textContent = Math.round(el.value * 100) + '%';
    setVolume((this.s.settings.master ?? 0.7) * (this.s.settings.sfx ?? 0.8));
    if (e.type === 'change') { Save.persist(); this.opts.onSettings?.(this.s.settings); sfx('click'); }
  },
};
