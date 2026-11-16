// Instanced billboard health bars + hero level badges.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _r = new THREE.Vector3(), _u = new THREE.Vector3();

export class Bars {
  constructor(scene, cap = 512) {
    this.scene = scene; this.cap = cap;
    const g = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(g, this.mat, cap); this.mesh.frustumCulled = false; this.mesh.renderOrder = 900;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.setColorAt(0, _c.set(1, 1, 1));
    scene.add(this.mesh); this.n = 0;
    this.badges = new Map(); // id -> {sprite, level, cv, tex}
    this.badgeSeen = new Set();
  }
  begin(camera) {
    this.n = 0; this.q = camera.quaternion;
    _r.set(1, 0, 0).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.badgeSeen.clear();
  }
  _quad(cx, cy, cz, offR, offU, w, h, color, alpha = 1) {
    if (this.n >= this.cap) return;
    _p.set(cx + _r.x * offR + _u.x * offU, cy + _r.y * offR + _u.y * offU, cz + _r.z * offR + _u.z * offU);
    _m.compose(_p, this.q, _s.set(w, h, 1));
    this.mesh.setMatrixAt(this.n, _m); _c.set(color); this.mesh.setColorAt(this.n, _c); this.n++;
  }
  // o: {x,y,z, w, h, frac, lag, shield, color, hero, level, id, ticks}
  bar(o) {
    const w = o.w, h = o.h, tot = Math.max(1, o.max + (o.shieldAmt || 0));
    const hpF = Math.max(0, o.hp) / tot, lagF = Math.max(hpF, (o.lag ?? o.hp) / tot), shF = (o.shieldAmt || 0) / tot;
    const pad = o.hero ? 0.12 : 0.08;
    this._quad(o.x, o.y, o.z, 0, 0, w + pad * 2, h + pad * 2, 0x14101c);
    this._quad(o.x, o.y, o.z, 0, 0, w, h, 0x3a3044);
    const left = -w / 2;
    if (lagF > hpF + 0.002) this._quad(o.x, o.y, o.z, left + w * (hpF + lagF) / 2, 0, w * (lagF - hpF), h, 0xffe0a0);
    if (hpF > 0) this._quad(o.x, o.y, o.z, left + w * hpF / 2, 0, w * hpF, h, o.color);
    if (hpF > 0) this._quad(o.x, o.y, o.z, left + w * hpF / 2, h * 0.28, w * hpF, h * 0.3, _c.set(o.color).lerp(new THREE.Color(1, 1, 1), 0.4).getHex());
    if (shF > 0) this._quad(o.x, o.y, o.z, left + w * (hpF + shF / 2), 0, w * shF, h, 0xf4f4ff);
    if (o.hero && o.max > 0) { // tick every 250 hp
      const step = 250 / tot * w; if (step > 0.12) for (let t = left + step; t < left + w * hpF - 0.02; t += step) this._quad(o.x, o.y, o.z, t, h * 0.1, 0.04, h * 0.8, 0x14101c);
    }
    if (o.hero && o.level != null) this._badge(o, w);
  }
  _badge(o, w) {
    let b = this.badges.get(o.id);
    if (!b) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false }));
      sp.renderOrder = 901; this.scene.add(sp); b = { sp, cv, tex, level: -1, color: null }; this.badges.set(o.id, b);
    }
    if (b.level !== o.level || b.color !== o.color) {
      b.level = o.level; b.color = o.color;
      const g = b.cv.getContext('2d'); g.clearRect(0, 0, 64, 64);
      g.beginPath(); g.arc(32, 32, 29, 0, Math.PI * 2); g.fillStyle = '#14101c'; g.fill();
      g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.fillStyle = '#' + new THREE.Color(o.color).getHexString(); g.fill();
      g.lineWidth = 3; g.strokeStyle = '#ffe9a8'; g.stroke();
      g.font = '900 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      g.lineWidth = 4; g.strokeStyle = '#14101c'; g.strokeText(String(o.level), 32, 34); g.fillText(String(o.level), 32, 34);
      b.tex.needsUpdate = true;
    }
    const off = -w / 2 - 0.42;
    b.sp.position.set(o.x + _r.x * off, o.y + _r.y * off, o.z + _r.z * off);
    b.sp.scale.set(0.95, 0.95, 1); b.sp.visible = true; this.badgeSeen.add(o.id);
  }
  end() {
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const [id, b] of this.badges) if (!this.badgeSeen.has(id)) b.sp.visible = false;
  }
  dispose() {
    this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); this.mesh.dispose();
    for (const b of this.badges.values()) { this.scene.remove(b.sp); b.tex.dispose(); b.sp.material.dispose(); }
  }
}
