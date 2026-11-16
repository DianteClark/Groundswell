// Fog-of-war visibility texture (R) + static canopy-dapple mask (G), 2 world units per texel over the map.
// Mirrors the sim's vision rules (hero 20, minion 12, tower 18, core 20, summons, fountain 26, brush blocks)
// and eases toward the target so the fog breathes rather than pops. Used by the post composite.
import * as THREE from 'three';

export class FogOfWar {
  constructor(map, canopy = []) {
    this.W = map.width || 240; this.H = map.height || 160; this.map = map;
    this.cs = 2; this.nx = Math.ceil(this.W / this.cs); this.ny = Math.ceil(this.H / this.cs);
    const N = this.nx * this.ny;
    this.vis = new Float32Array(N).fill(1); this.tgt = new Float32Array(N);
    this.data = new Uint8Array(N * 4);
    this.brushId = new Int8Array(N).fill(-1);
    const br = map.brush || [];
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const x = (i + 0.5) * this.cs, y = (j + 0.5) * this.cs; const k = j * this.nx + i;
      for (let b = 0; b < br.length; b++) if ((x - br[b].x) ** 2 + (y - br[b].y) ** 2 < (br[b].r - 0.3) ** 2) { this.brushId[k] = b; break; }
      // canopy mask: near tree masses (dappled light)
      let c = 0; for (const t of canopy) { const d = Math.hypot(x - t.x, y - t.z) - t.r; if (d < 6) c = Math.max(c, 1 - Math.max(0, d) / 6); }
      this.data[k * 4 + 1] = Math.round(Math.min(1, c) * 255); this.data[k * 4 + 3] = 255;
    }
    this.tex = new THREE.DataTexture(this.data, this.nx, this.ny, THREE.RGBAFormat); this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter; this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping; this.tex.needsUpdate = true;
    this.domain = new THREE.Vector4(0, 0, 1 / (this.nx * this.cs), 1 / (this.ny * this.cs));
    this.viewers = []; this.acc = 1;
  }
  _stamp(x, y, r, inBrush) {
    const cs = this.cs, nx = this.nx, ny = this.ny; const soft = 3.2;
    const i0 = Math.max(0, Math.floor((x - r - soft) / cs)), i1 = Math.min(nx - 1, Math.floor((x + r + soft) / cs));
    const j0 = Math.max(0, Math.floor((y - r - soft) / cs)), j1 = Math.min(ny - 1, Math.floor((y + r + soft) / cs));
    const T = this.tgt, B = this.brushId;
    for (let j = j0; j <= j1; j++) { const cy = (j + 0.5) * cs - y; for (let i = i0; i <= i1; i++) {
      const k = j * nx + i; if (B[k] >= 0 && B[k] !== inBrush) continue;
      const cx = (i + 0.5) * cs - x; const d = Math.sqrt(cx * cx + cy * cy); let v = d <= r - soft ? 1 : d >= r + soft * 0.4 ? 0 : (r + soft * 0.4 - d) / (soft * 1.4);
      if (v > T[k]) T[k] = v; } }
  }
  update(match, team, dt, reveal) {
    const T = this.tgt; T.fill(reveal ? 1 : 0);
    if (!reveal && match) {
      const inBrush = (x, y) => { const br = this.map.brush || []; for (let i = 0; i < br.length; i++) if ((x - br[i].x) ** 2 + (y - br[i].y) ** 2 < br[i].r * br[i].r) return i; return -1; };
      for (const e of match.entities.values()) {
        if (!e.alive || e.team !== team) continue; let r = 0;
        if (e.kind === 'hero') r = 20; else if (e.kind === 'minion') r = 12; else if (e.kind === 'tower') r = 18; else if (e.kind === 'core') r = 20; else if (e.kind === 'summon' && !e.wall) r = e.visionRange ?? 10;
        if (r) this._stamp(e.x, e.y, r, inBrush(e.x, e.y));
      }
      const f = this.map.fountains?.[team]; if (f) this._stamp(f.x, f.y, 26, -1);
    }
    const k = 1 - Math.exp(-dt * 7); const V = this.vis, D = this.data;
    for (let i = 0; i < V.length; i++) { V[i] += (T[i] - V[i]) * k; D[i * 4] = V[i] * 255; }
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); }
}
