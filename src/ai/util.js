// Bot helpers: lane geometry, estimates. Owner: Agent A. Pure / deterministic.
import { MAP } from '../sim/map.js';
import { TOWER } from '../sim/constants.js';

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const hasSt = (e, k) => e.statuses?.some(s => s.key === k);

const GEO = {};
export function laneGeo(lane, team) {
  const key = lane + team; if (GEO[key]) return GEO[key];
  const pts = MAP.laneFor(lane, team); const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return (GEO[key] = { pts, cum, total: cum[cum.length - 1] });
}
/** Arc-length of the nearest point on the lane polyline + distance from it. */
export function laneProject(geo, x, y) {
  let best = Infinity, s = 0;
  const { pts, cum } = geo;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
    let t = ((x - a.x) * vx + (y - a.y) * vy) / l2; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(a.x + vx * t - x, a.y + vy * t - y);
    if (d < best) { best = d; s = cum[i] + t * Math.sqrt(l2); }
  }
  return { s, d: best };
}
export function lanePoint(geo, s) {
  const { pts, cum, total } = geo; s = Math.max(0, Math.min(total, s));
  for (let i = 0; i < pts.length - 1; i++) if (s <= cum[i + 1]) { const t = (s - cum[i]) / (cum[i + 1] - cum[i] || 1); return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }; }
  return { ...pts[pts.length - 1] };
}
export function laneOf(x, y) {
  const a = laneProject(laneGeo('top', 0), x, y).d, b = laneProject(laneGeo('bot', 0), x, y).d;
  if (Math.min(a, b) > 12) return null; return a < b ? 'top' : 'bot';
}

export const TOWER_RANGE = TOWER.attackRange;

/** Raw auto damage after armor vs target. */
export function autoDmg(h, t) {
  const raw = h.stats.power * (h.def?.attackRatio ?? 1);
  const eff = Math.max(0, (t.stats?.armor || 0) * (1 - (h.stats.armorPen || 0)) - (h.stats.flatPen || 0));
  return raw * 100 / (100 + eff);
}
export function armorMul(src, t) { const eff = Math.max(0, (t.stats?.armor || 0) * (1 - (src.stats?.armorPen || 0))); return 100 / (100 + eff); }

/** Rough damage a hero can burst in ~3s (abilities ready + autos), after armor. */
export function burstEstimate(h, t, m) {
  const L = h.level - 1, p = h.stats.power;
  let raw = 0;
  for (const k of ['q', 'w', 'r']) {
    const st = h.abilities[k]; if (!st || !st.ready || (k === 'r' && h.level < 5)) continue;
    raw += k === 'r' ? (170 + 40 * L + 0.9 * p) : (55 + 17 * L + 0.6 * p);
  }
  raw += h.stats.power * (h.def?.attackRatio ?? 1) * Math.max(1.5, h.stats.attackSpeed * 3);
  return raw * armorMul(h, t);
}
/** Sustained fight value: effective HP × DPS proxy. */
export function fightValue(h) {
  if (!h.alive) return { ehp: 0, dps: 0 };
  const ehp = (h.hp + (h.shield || 0)) * (1 + (h.stats.armor || 0) / 100);
  let ready = 0; for (const k of ['q', 'w', 'r']) if (h.abilities[k]?.ready && (k !== 'r' || h.level >= 5)) ready += k === 'r' ? 1.6 : 0.7;
  const dps = h.stats.power * (h.def?.attackRatio ?? 1) * h.stats.attackSpeed * (1 + 0.25 * ready) + (40 + 12 * h.level) * 0.25 * ready;
  return { ehp, dps };
}
