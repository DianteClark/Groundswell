// Static map layout + grid navigation (A*). Deterministic.
import { MAP_W, MAP_H } from './constants.js';

const mirrorX = (p) => ({ ...p, x: MAP_W - p.x });
const mirrorY = (p) => ({ ...p, y: MAP_H - p.y });

const topLane = [
  { x: 30, y: 72 }, { x: 36, y: 40 }, { x: 52, y: 22 }, { x: 90, y: 16 },
  { x: 150, y: 16 }, { x: 188, y: 22 }, { x: 204, y: 40 }, { x: 210, y: 72 },
];
const botLane = topLane.map(mirrorY);

const obstacles = [];
const circ = (x, y, r) => obstacles.push({ type: 'circle', x, y, r });
// corners outside the lanes
circ(8, 14, 24); circ(232, 14, 24); circ(8, 146, 24); circ(232, 146, 24);
// lane / jungle separators
for (const [x, y, r] of [[62, 40, 6], [100, 32, 6.5], [140, 32, 6.5], [178, 40, 6]]) { circ(x, y, r); circ(x, MAP_H - y, r); }
// inner jungle
for (const [x, y, r] of [[96, 60, 4.5], [144, 60, 4.5], [96, 100, 4.5], [144, 100, 4.5], [120, 80, 6], [78, 80, 4], [162, 80, 4]]) circ(x, y, r);
// base walls
for (const [x, y, r] of [[48, 56, 5], [48, 104, 5], [192, 56, 5], [192, 104, 5]]) circ(x, y, r);

const brush = [
  { x: 66, y: 25, r: 4 }, { x: 174, y: 25, r: 4 }, { x: 66, y: 135, r: 4 }, { x: 174, y: 135, r: 4 },
  { x: 108, y: 66, r: 3.2 }, { x: 132, y: 94, r: 3.2 }, { x: 88, y: 92, r: 3.2 }, { x: 152, y: 68, r: 3.2 },
];

const towersBlue = [
  { lane: 'top', tier: 'outer', x: 84, y: 16.5, hp: 2050 },
  { lane: 'top', tier: 'inner', x: 41, y: 33, hp: 2350 },
  { lane: 'bot', tier: 'outer', x: 84, y: 143.5, hp: 2050 },
  { lane: 'bot', tier: 'inner', x: 41, y: 127, hp: 2350 },
  { lane: 'base', tier: 'base', x: 40, y: 80, hp: 2700 },
];

export const MAP = {
  width: MAP_W, height: MAP_H,
  lanes: [{ name: 'top', points: topLane }, { name: 'bot', points: botLane }],
  obstacles,
  brush,
  river: { x0: 112, x1: 128, y0: 30, y1: 130, polygon: [{ x: 112, y: 24 }, { x: 128, y: 24 }, { x: 128, y: 136 }, { x: 112, y: 136 }] },
  bases: [{ team: 0, x: 18, y: 80, r: 24 }, { team: 1, x: 222, y: 80, r: 24 }],
  fountains: [{ team: 0, x: 9, y: 80 }, { team: 1, x: 231, y: 80 }],
  cores: [{ team: 0, x: 26, y: 80 }, { team: 1, x: 214, y: 80 }],
  towers: [...towersBlue.map(t => ({ ...t, team: 0 })), ...towersBlue.map(t => ({ ...mirrorX(t), team: 1 }))],
  pits: { wyrm: { x: 120, y: 50, r: 9 }, colossus: { x: 120, y: 110, r: 10 } },
  camps: [
    { id: 'b_s1', x: 72, y: 50, type: 'camp_small', side: 0 }, { id: 'b_s2', x: 72, y: 110, type: 'camp_small', side: 0 }, { id: 'b_big', x: 94, y: 80, type: 'camp_big', side: 0 },
    { id: 'r_s1', x: 168, y: 50, type: 'camp_small', side: 1 }, { id: 'r_s2', x: 168, y: 110, type: 'camp_small', side: 1 }, { id: 'r_big', x: 146, y: 80, type: 'camp_big', side: 1 },
  ],
  // living-map zones that can transform
  zones: { wyrm: { x: 120, y: 50, r: 18 }, colossus: { x: 120, y: 110, r: 18 }, river: { x: 120, y: 80, r: 14 } },
};
// spawn & lane start points
MAP.laneFor = (name, team) => {
  const pts = MAP.lanes.find(l => l.name === name).points;
  return team === 0 ? pts : [...pts].reverse();
};

// ---------- nav grid ----------
export const CELL = 1;
const SOLID_PAD = 0.4, DYN_PAD = 0.15, EDGE_X = 3, EDGE_Y = 4;
export const GW = Math.ceil(MAP_W / CELL), GH = Math.ceil(MAP_H / CELL);

export class Nav {
  constructor() {
    this.static = new Uint8Array(GW * GH);
    this.dyn = new Uint16Array(GW * GH);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const x = (gx + 0.5) * CELL, y = (gy + 0.5) * CELL;
      let b = x < 3 || y < 4 || x > MAP_W - 3 || y > MAP_H - 4;
      if (!b) for (const o of obstacles) { const dx = x - o.x, dy = y - o.y; if (dx * dx + dy * dy < (o.r + 0.4) * (o.r + 0.4)) { b = true; break; } }
      this.static[gy * GW + gx] = b ? 1 : 0;
    }
    this.dynObs = [];
  }
  blockedCell(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return true;
    const i = gy * GW + gx; return this.static[i] === 1 || this.dyn[i] > 0;
  }
  blocked(x, y) { return this.blockedCell(Math.floor(x / CELL), Math.floor(y / CELL)); }
  // ---- smooth (geometric) collision for movement: circles + map edges, no grid staircase ----
  _bucketsInit() {
    const B = this._B = 8, bw = Math.ceil(MAP_W / B), bh = Math.ceil(MAP_H / B);
    this._bw = bw; this._buckets = Array.from({ length: bw * bh }, () => []);
    for (const o of obstacles) {
      const R = o.r + SOLID_PAD + 1;
      for (let by = Math.max(0, Math.floor((o.y - R) / B)); by <= Math.min(bh - 1, Math.floor((o.y + R) / B)); by++)
        for (let bx = Math.max(0, Math.floor((o.x - R) / B)); bx <= Math.min(bw - 1, Math.floor((o.x + R) / B)); bx++) this._buckets[by * bw + bx].push(o);
    }
  }
  _near(x, y) {
    if (!this._buckets) this._bucketsInit();
    const bx = Math.max(0, Math.min(this._bw - 1, Math.floor(x / this._B))), by = Math.max(0, Math.floor(y / this._B));
    return this._buckets[by * this._bw + bx] || [];
  }
  /** Geometric solidity: inside an (inflated) obstacle circle, a dynamic obstacle, or outside the playable rect. */
  solid(x, y) {
    if (x < EDGE_X || y < EDGE_Y || x > MAP_W - EDGE_X || y > MAP_H - EDGE_Y) return true;
    for (const o of this._near(x, y)) { const dx = x - o.x, dy = y - o.y, R = o.r + SOLID_PAD; if (dx * dx + dy * dy < R * R) return true; }
    for (const o of this.dynObs) { const dx = x - o.x, dy = y - o.y, R = o.r + DYN_PAD; if (dx * dx + dy * dy < R * R) return true; }
    return false;
  }
  /** Push (x,y) out of obstacles (radial = slides along curved walls). Returns {x,y,ok}. */
  resolve(x, y) {
    for (let it = 0; it < 4; it++) {
      let moved = false;
      if (x < EDGE_X + 1e-3) { x = EDGE_X + 1e-3; moved = true; } else if (x > MAP_W - EDGE_X - 1e-3) { x = MAP_W - EDGE_X - 1e-3; moved = true; }
      if (y < EDGE_Y + 1e-3) { y = EDGE_Y + 1e-3; moved = true; } else if (y > MAP_H - EDGE_Y - 1e-3) { y = MAP_H - EDGE_Y - 1e-3; moved = true; }
      const push = (o, R) => { const dx = x - o.x, dy = y - o.y, d2 = dx * dx + dy * dy; if (d2 >= R * R) return; const d = Math.sqrt(d2); if (d < 1e-6) { x = o.x + R + 1e-3; } else { x = o.x + dx / d * (R + 1e-3); y = o.y + dy / d * (R + 1e-3); } moved = true; };
      for (const o of this._near(x, y)) push(o, o.r + SOLID_PAD);
      for (const o of this.dynObs) push(o, o.r + DYN_PAD);
      if (!moved) return { x, y, ok: true };
    }
    return { x, y, ok: !this.solid(x, y) };
  }
  // dynamic circular obstacle (walls from abilities, map changes). returns handle
  addObstacle(x, y, r) {
    const cells = [];
    const g0x = Math.floor((x - r) / CELL), g1x = Math.floor((x + r) / CELL), g0y = Math.floor((y - r) / CELL), g1y = Math.floor((y + r) / CELL);
    for (let gy = g0y; gy <= g1y; gy++) for (let gx = g0x; gx <= g1x; gx++) {
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
      const cx = (gx + 0.5) * CELL, cy = (gy + 0.5) * CELL;
      if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r) { this.dyn[gy * GW + gx]++; cells.push(gy * GW + gx); }
    }
    const h = { x, y, r, cells }; this.dynObs.push(h); return h;
  }
  removeObstacle(h) {
    for (const i of h.cells) this.dyn[i]--;
    const k = this.dynObs.indexOf(h); if (k >= 0) this.dynObs.splice(k, 1);
  }
  lineClear(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0); const n = Math.ceil(d / (CELL * 0.5));
    for (let i = 1; i <= n; i++) { const t = i / n; if (this.blocked(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  }
  nearestFree(x, y) {
    if (!this.blocked(x, y)) return { x, y };
    for (let r = 1; r < 30; r++) for (let a = 0; a < 16; a++) {
      const ang = a / 16 * Math.PI * 2; const nx = x + Math.cos(ang) * r * CELL, ny = y + Math.sin(ang) * r * CELL;
      if (!this.blocked(nx, ny)) return { x: nx, y: ny };
    }
    return { x, y };
  }
  // A* on grid with octile heuristic, then string-pull. returns array of points (excluding start)
  findPath(sx, sy, tx, ty, maxIter = 6000) {
    const t = this.nearestFree(tx, ty); tx = t.x; ty = t.y;
    if (this.lineClear(sx, sy, tx, ty)) return [{ x: tx, y: ty }];
    const sgx = Math.floor(sx / CELL), sgy = Math.floor(sy / CELL), tgx = Math.floor(tx / CELL), tgy = Math.floor(ty / CELL);
    const N = GW * GH;
    if (!this._g) { this._g = new Float32Array(N); this._from = new Int32Array(N); this._stamp = new Uint32Array(N); this._closed = new Uint32Array(N); this._gen = 0; }
    const gen = ++this._gen; const g = this._g, from = this._from, stamp = this._stamp, closed = this._closed;
    const heap = new MinHeap();
    const start = sgy * GW + sgx, goal = tgy * GW + tgx;
    g[start] = 0; stamp[start] = gen; from[start] = -1;
    const h = (gx, gy) => { const dx = Math.abs(gx - tgx), dy = Math.abs(gy - tgy); return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy); };
    heap.push(start, h(sgx, sgy));
    let found = false, iter = 0, best = start, bestH = Infinity;
    while (heap.size && iter++ < maxIter) {
      const cur = heap.pop();
      if (closed[cur] === gen) continue; closed[cur] = gen;
      if (cur === goal) { found = true; break; }
      const cx = cur % GW, cy = (cur / GW) | 0;
      const hh = h(cx, cy); if (hh < bestH) { bestH = hh; best = cur; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        const ni = ny * GW + nx;
        if (ni !== goal && this.blockedCell(nx, ny)) continue;
        if (dx && dy && (this.blockedCell(cx + dx, cy) || this.blockedCell(cx, cy + dy))) continue; if (closed[ni] === gen) continue;
        const ng = g[cur] + (dx && dy ? 1.4142 : 1);
        if (stamp[ni] !== gen || ng < g[ni]) { stamp[ni] = gen; g[ni] = ng; from[ni] = cur; heap.push(ni, ng + h(nx, ny)); }
      }
    }
    let end = found ? goal : best;
    const cells = [];
    for (let c = end; c !== -1 && c !== start; c = from[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map(c => ({ x: (c % GW + 0.5) * CELL, y: (((c / GW) | 0) + 0.5) * CELL }));
    if (found) pts.push({ x: tx, y: ty });
    // string pulling
    const out = []; let ax = sx, ay = sy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(ax, ay, pts[j].x, pts[j].y)) j--;
      out.push(pts[j]); ax = pts[j].x; ay = pts[j].y; i = j + 1;
    }
    return out;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p);
    while (i > 0) { const pa = (i - 1) >> 1; if (P[pa] <= p) break; K[i] = K[pa]; P[i] = P[pa]; i = pa; }
    K[i] = k; P[i] = p;
  }
  pop() {
    const K = this.k, P = this.p; const top = K[0]; const lk = K.pop(), lp = P.pop();
    if (K.length) {
      let i = 0; const n = K.length;
      while (true) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && P[c + 1] < P[c]) c++; if (P[c] >= lp) break; K[i] = K[c]; P[i] = P[c]; i = c; }
      K[i] = lk; P[i] = lp;
    }
    return top;
  }
}

export function inBrush(x, y) {
  for (let i = 0; i < brush.length; i++) { const b = brush[i]; if ((x - b.x) ** 2 + (y - b.y) ** 2 < b.r * b.r) return i; }
  return -1;
}
