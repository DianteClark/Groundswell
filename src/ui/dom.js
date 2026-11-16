// Small DOM helpers + shared visual components (avatars, banners, hero portraits).
import { flair, DEFAULT_FLAIR } from '../meta/flair.js';
import { HERO_BY_ID, roleIcon, RARITY, skinById, skinColor } from '../meta/registry.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function frag(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const rarityColor = (r) => RARITY[r]?.color || RARITY.common.color;

export const ESS = '<i class="cur ess" aria-label="Essence"></i>';
export const PRI = '<i class="cur pri" aria-label="Prisms"></i>';
export const priceHTML = (p) => p?.prisms ? `${PRI}${fmt(p.prisms)}` : `${ESS}${fmt(p?.essence || 0)}`;

/** avatar: icon inside border ring */
export function avatarHTML(profile = {}, size = 64, extra = '') {
  const ic = flair(profile.icon) || flair(DEFAULT_FLAIR.icon);
  const bd = flair(profile.border) || flair(DEFAULT_FLAIR.border);
  return `<div class="av ${bd.anim ? 'av-' + bd.anim : ''} ${extra}" style="--sz:${size}px;--ring:${bd.ring}">
    <div class="av-ring"></div><div class="av-in" style="background:${ic.bg}"><span>${esc(ic.glyph)}</span></div></div>`;
}
export function bannerStyle(id) { const b = flair(id) || flair(DEFAULT_FLAIR.banner); return `background:${b.css};${b.css.includes('/') ? '' : 'background-size:200% 200%;'}`; }
export function bannerClass(id) { const b = flair(id) || flair(DEFAULT_FLAIR.banner); return b.anim ? 'bn-' + b.anim : ''; }
export function titleHTML(id) { const t = flair(id) || flair(DEFAULT_FLAIR.title); return `<span class="ttl r-${t.rarity}">${esc(t.name)}</span>`; }

// Optional portrait renderer from Agent B: (heroId, skinId, {size, pose, bg}) -> dataURL
let portraitFn = null; const portraitCache = new Map();
export function setPortraitRenderer(fn) { portraitFn = typeof fn === 'function' ? fn : null; portraitCache.clear(); }
const PORTRAIT_SIZE = { big: 384, shop: 256, lc: 256, sm: 160, xs: 96 };
export function heroPortraitURL(heroId, skinId, cls = '') {
  if (!portraitFn || !heroId) return null;
  const key = cls.split(' ')[0] || 'sm';
  const size = PORTRAIT_SIZE[key] || 160;
  const k = heroId + '|' + skinId + '|' + size;
  if (portraitCache.has(k)) return portraitCache.get(k);
  let url = null;
  try { url = portraitFn(heroId, skinId, { size, pose: size >= 256 ? 'hero' : 'idle', bg: 'transparent' }) || null; } catch (e) { console.warn('portrait failed', e); url = null; }
  portraitCache.set(k, url);
  return url;
}
/** hero portrait: rendered image if available, else stylized crest placeholder */
export function heroArtHTML(heroId, skinId, cls = '') {
  const h = HERO_BY_ID[heroId] || { name: heroId || '?', color: '#888', role: '' };
  const sk = skinById(skinId);
  const c = skinColor(sk, h);
  const rar = sk?.rarity && sk.rarity !== 'default' ? sk.rarity : '';
  const url = heroPortraitURL(heroId, skinId, cls);
  if (url) return `<div class="hart has-img ${cls} ${rar ? 'hart-' + rar : ''}" style="--hc:${c}"><div class="hart-glow"></div><img class="hart-img" src="${url}" alt="${esc(h.name)}" draggable="false"><span class="hart-role">${roleIcon(h.role)}</span></div>`;
  return `<div class="hart ${cls} ${rar ? 'hart-' + rar : ''}" style="--hc:${c}">
    <div class="hart-glow"></div><div class="hart-crest"><span class="hart-l">${esc((h.name || '?')[0])}</span></div>
    <span class="hart-role">${roleIcon(h.role)}</span></div>`;
}
export function heroChipHTML(heroId, size = 40, cls = '', skinId = null) {
  const h = HERO_BY_ID[heroId] || { name: heroId || '?', color: '#888' };
  const url = size >= 30 ? heroPortraitURL(heroId, skinId || heroId + '_default', 'xs') : null;
  if (url) return `<span class="hchip img ${cls}" style="--hc:${h.color};--sz:${size}px"><img src="${url}" alt="${esc(h.name)}" draggable="false"></span>`;
  return `<span class="hchip ${cls}" style="--hc:${h.color};--sz:${size}px">${esc((h.name || '?')[0])}</span>`;
}

let toastWrap = null;
export function toast(msg, kind = '') {
  if (!toastWrap || !toastWrap.isConnected) { toastWrap = frag('<div class="toasts"></div>'); document.body.appendChild(toastWrap); }
  const t = frag(`<div class="toast ${kind}">${msg}</div>`);
  toastWrap.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2400); setTimeout(() => t.remove(), 2900);
}

export function modal(html, { cls = '', onClose } = {}) {
  const m = frag(`<div class="modal-bg ${cls}"><div class="modal"><button class="modal-x" data-close aria-label="Close">✕</button>${html}</div></div>`);
  const close = () => { m.classList.add('out'); setTimeout(() => m.remove(), 200); onClose && onClose(); };
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  document.body.appendChild(m);
  return { el: m, close };
}

export function countUp(el, to, dur = 1100, from = 0, onTick) {
  const t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); onTick && onTick(k); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

export function profileCardHTML(p, opts = {}) {
  // p = {name, title, banner, border, icon, level?, sub?}
  return `<div class="pcard ${opts.cls || ''} ${bannerClass(p.banner)}" style="${bannerStyle(p.banner)}">
    <div class="pcard-shade"></div>
    ${avatarHTML(p, opts.av || 68)}
    <div class="pcard-txt"><div class="pcard-name">${esc(p.name)}${p.level ? `<span class="lvl-pill">${p.level}</span>` : ''}</div>${titleHTML(p.title)}${p.sub ? `<div class="pcard-sub">${p.sub}</div>` : ''}</div>
  </div>`;
}
