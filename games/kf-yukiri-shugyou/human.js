// human.js — リアル寄りの人間モデル（three.js だけで作る。画像ファイル不要）
//
// 使い方（ゲームのフォルダにこのファイルをコピーして使う）:
//   import { makeHuman } from './human.js';
//   const h = makeHuman({ sex: 'female', age: 'adult', seed: 3 });
//   scene.add(h.root);                // 足元が原点、+Z を向いて立つ。単位はメートル（大人で 1.5〜1.85）
//   毎フレーム h.update(dt);          // まばたき・呼吸・ポーズ・歩き
//
// 動かし方:
//   h.pose = 'stand' | 'wave' | 'cheer' | 'peace' | 'sit' | 'point' | 'hips'
//   h.walkSpeed = 1.2;                // m/s。0 で止まる（移動そのものはゲーム側で root を動かす）
//   h.face.smile = 0.8; h.face.open = 0.5; h.face.brow = -1;   // 表情（-1〜1 / 0〜1）
//   h.lookAt(worldPos);               // 顔と目をそちらに向ける（null で正面に戻す）
//   h.auto = false;                   // 自分で関節を回すとき（h.j.shoulderR.rotation.z など）
//   h.j … 関節: pelvis spine neck head shoulderL/R elbowL/R wristL/R hipL/R kneeL/R ankleL/R
//   L/R は本人から見た左右（L が +X 側）。腕を横に上げる: shoulderL.rotation.z = +角度、shoulderR は −角度。
//   前に上げる: rotation.x = −角度。ひじ・ももを曲げる: elbow.x / hip.x = −角度、ひざ: knee.x = +角度。
//
// オプション（省略するとランダム。seed を同じにすると同じ人になる）:
//   sex: 'male'|'female', age: 'child'|'adult'|'elder', height: m, build: 0.85〜1.3（細い〜がっしり）,
//   skin, hair: 'short'|'buzz'|'bob'|'long'|'bangs'|'ponytail'|'bun'|'bald', hairColor, eyeColor,
//   top: 色, sleeve: 'short'|'long', bottom: 'pants'|'shorts'|'skirt', bottomColor, shoes: 色, glasses: true/false
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const gauss = (dx, dy = 0) => Math.exp(-(dx * dx + dy * dy));
const lerp = (a, b, t) => a + (b - a) * t;

const SKINS = ['#f7dcc8', '#f0c9ab', '#e6b896', '#d6a47f', '#c08a63', '#a06c4a', '#7f4f33', '#5e3824'];
const HAIRS = ['#16110e', '#241812', '#33241a', '#4a3322', '#6b4a2e', '#8f6a42', '#b89060', '#7a3418'];
const GREYS = ['#77736e', '#a19c96', '#c9c5bf', '#e6e3dd'];
const EYES = ['#2e1c10', '#3f2817', '#4f3a22', '#3d5537', '#46667f', '#5f7383'];
const TOPS = ['#2f3e5c', '#8a3232', '#e9e5db', '#3c5a3a', '#c9a227', '#4a4a4a', '#9fb6cf', '#b5654a', '#6b4f7a', '#222326', '#d98fa3', '#f4f4f2', '#5a7f8a'];
const BOTTOMS = ['#27324a', '#1d1d20', '#5b4a3a', '#3d4a5c', '#8a7a62', '#4b5a6a', '#6e6a62'];
const SHOES = ['#1b1b1d', '#3b2a1e', '#f0efea', '#5a3a26', '#30343c'];

function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- 形を作る道具 ----------

// 楕円の輪切りをなめらかにつないだ筒（胴・腕・脚・指・靴など）。secs: [[y, 横半径, 奥行き半径, 中心x, 中心z], ...]
function loft(secs, { radial = 20, steps = 4, power = 2, caps = true } = {}) {
  if (secs[0][0] > secs[secs.length - 1][0]) secs = secs.slice().reverse();
  secs = secs.map(s => [s[0], s[1], s[2], s[3] || 0, s[4] || 0]);
  const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const rings = [], n = secs.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = secs[Math.max(0, i - 1)], p1 = secs[i], p2 = secs[i + 1], p3 = secs[Math.min(n - 1, i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      rings.push([lerp(p1[0], p2[0], t), ...[1, 2, 3, 4].map(c => cr(p0[c], p1[c], p2[c], p3[c], t))]);
    }
  }
  rings.push(secs[n - 1]);
  const se = c => Math.sign(c) * Math.pow(Math.abs(c), 2 / power);
  const pos = [], uv = [], idx = [], R = radial;
  const ringPts = r => { const out = []; for (let j = 0; j < R; j++) { const th = j / R * Math.PI * 2; out.push([r[3] + Math.max(1e-4, r[1]) * se(Math.cos(th)), r[0], r[4] + Math.max(1e-4, r[2]) * se(Math.sin(th))]); } return out; };
  rings.forEach((r, i) => ringPts(r).forEach((p, j) => { pos.push(...p); uv.push(j / R, i / (rings.length - 1)); }));
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < R; j++) {
    const a = i * R + j, b = i * R + (j + 1) % R, c = (i + 1) * R + j, d = (i + 1) * R + (j + 1) % R;
    idx.push(a, c, b, b, c, d);
  }
  if (caps) for (const [ri, up] of [[0, false], [rings.length - 1, true]]) {
    const r = rings[ri], base = pos.length / 3;
    ringPts(r).forEach((p, j) => { pos.push(...p); uv.push(j / R, ri ? 1 : 0); });
    pos.push(r[3], r[0], r[4]); uv.push(0.5, ri ? 1 : 0);
    const c = base + R;
    for (let j = 0; j < R; j++) { const a = base + j, b = base + (j + 1) % R; up ? idx.push(c, b, a) : idx.push(c, a, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 球の継ぎ目で法線が割れないよう、同じ位置の頂点の法線をそろえる
function smoothSeams(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
    let e = map.get(k); if (!e) map.set(k, e = { v: new THREE.Vector3(), ids: [] });
    e.v.x += n.getX(i); e.v.y += n.getY(i); e.v.z += n.getZ(i); e.ids.push(i);
  }
  for (const e of map.values()) { if (e.ids.length < 2) continue; e.v.normalize(); for (const i of e.ids) n.setXYZ(i, e.v.x, e.v.y, e.v.z); }
  n.needsUpdate = true;
  return g;
}

function deformSphere(ws, hs, fn) {
  const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position, v = new THREE.Vector3(), o = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, o); p.setXYZ(i, o.x, o.y, o.z); }
  return smoothSeams(g);
}

function colorize(g, base, fn) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(base); fn(p.getX(i), p.getY(i), p.getZ(i), c); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// 顔の前面の高さ（z）を、頭のメッシュから格子に焼いておく（目・鼻・口を顔の表面に沿わせるため）
function heightMap(g, x0, x1, y0, y1, st) {
  const nx = Math.round((x1 - x0) / st) + 1, ny = Math.round((y1 - y0) / st) + 1, H = new Float32Array(nx * ny).fill(-9);
  const p = g.attributes.position.array, ix = g.index.array;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const ax = p[a], ay = p[a + 1], az = p[a + 2], bx = p[b], by = p[b + 1], bz = p[b + 2], cx = p[c], cy = p[c + 1], cz = p[c + 2];
    if (az < 0 && bz < 0 && cz < 0) continue;
    const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(det) < 1e-12) continue;
    const gx0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / st)), gx1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, cx) - x0) / st));
    const gy0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - y0) / st)), gy1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by, cy) - y0) / st));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const px = x0 + gx * st, py = y0 + gy * st;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const z = l1 * az + l2 * bz + l3 * cz, k = gy * nx + gx; if (z > H[k]) H[k] = z;
    }
  }
  return (x, y) => {
    const fx = clamp((x - x0) / st, 0, nx - 1.001), fy = clamp((y - y0) / st, 0, ny - 1.001), i = fx | 0, j = fy | 0, u = fx - i, v = fy - j;
    const h = (a, b) => H[b * nx + a];
    return lerp(lerp(h(i, j), h(i + 1, j), u), lerp(h(i, j + 1), h(i + 1, j + 1), u), v);
  };
}

// 顔に貼りつく薄い膜（唇・眉・口の中など）。fn(s, t) が [x, y, 表面からの浮き] を返す
function decal(surf, nu, nv, fn) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array(nu * nv * 3), idx = [];
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i; idx.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  g.update = () => {
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const [x, y, lift] = fn(i / (nu - 1), j / (nv - 1)); pos.set([x, y, surf(x, y) + lift], (j * nu + i) * 3);
    }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  };
  g.update();
  return g;
}

// ---------- 画像なしの質感（Canvas で描いて全員で使い回す） ----------
let FABRIC, HAIRTEX, KNIT;
function canvasTex(w, h, draw, rep = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function textures() {
  if (FABRIC) return;
  FABRIC = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#ececec'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { c.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.03})`; c.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { c.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.04})`; c.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; c.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  }, 6);
  HAIRTEX = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * w, l = Math.random();
      c.strokeStyle = l < 0.5 ? `rgba(0,0,0,${0.12 + Math.random() * 0.25})` : `rgba(255,255,255,${0.1 + Math.random() * 0.25})`;
      c.lineWidth = 0.6 + Math.random() * 1.4; c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y <= h; y += 16) c.lineTo(x + Math.sin(y * 0.03 + i) * 2, y);
      c.stroke();
    }
  }, 3);
  KNIT = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#e4e4e4'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { c.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; c.fillRect(x, y, 2, 3); }
  }, 10);
}

function eyeTexture(iris) {
  return canvasTex(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#e9d6cf'); g.addColorStop(0.25, '#fbf8f4'); g.addColorStop(0.5, '#e9d6cf'); g.addColorStop(1, '#e9d6cf');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { // 白目のうっすらした血管
      c.strokeStyle = 'rgba(190,70,70,0.18)'; c.lineWidth = 0.8; c.beginPath();
      let x = 128 + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 30), y = 128 + (Math.random() - 0.5) * 80; c.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (x < 128 ? 1 : -1) * 6 + (Math.random() - 0.5) * 6; y += (Math.random() - 0.5) * 8; c.lineTo(x, y); }
      c.stroke();
    }
    const cx = 128, cy = 128, R = 47, col = new THREE.Color(iris);
    const rg = c.createRadialGradient(cx, cy, 6, cx, cy, R);
    rg.addColorStop(0, '#' + col.clone().offsetHSL(0, 0, 0.12).getHexString()); rg.addColorStop(0.55, '#' + col.getHexString()); rg.addColorStop(0.9, '#' + col.clone().offsetHSL(0, 0, -0.1).getHexString()); rg.addColorStop(1, '#1a120c');
    c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
    for (let i = 0; i < 90; i++) { // 虹彩のすじ
      const a = Math.random() * 7, r0 = 15 + Math.random() * 5, r1 = 30 + Math.random() * 10;
      c.strokeStyle = Math.random() < 0.5 ? 'rgba(255,240,210,0.16)' : 'rgba(0,0,0,0.2)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
    }
    c.fillStyle = '#070505'; c.beginPath(); c.arc(cx, cy, 15, 0, 7); c.fill();
  });
}

// ---------- 頭の形 ----------
function headShape(child, eyeY, male) {
  const jk = child ? 0.55 : 1, jn = male ? 0.6 : 1;
  return (p, o) => {
    const { x, y, z } = p;
    const jaw = smooth(0.15, -1.0, y);
    let qx = x * (child ? 0.76 : 0.73) * (1 - 0.2 * jn * jaw * jk - 0.1 * jaw ** 3 * jk);
    let qz = z * 0.88 * (1 - 0.45 * jaw * jk) + 0.5 * Math.pow(jaw, 1.5) * jk;
    let qy = y * (child ? 0.97 : 1);
    if (z < 0) qz *= 1 + 0.09 * smooth(-0.7, 0.1, y);            // 後頭部のふくらみ
    if (z > 0) qz -= 0.12 * Math.max(0, y) ** 2 * z;              // おでこの傾き
    const front = smooth(0.25, 0.75, z), ax = Math.abs(qx);
    qz -= 0.085 * front * gauss((ax - 0.27) / 0.13, (qy - eyeY) / 0.1);                 // 目のくぼみ
    qz += 0.03 * front * gauss((ax - 0.24) / 0.2, (qy - eyeY - 0.17) / 0.06);          // 眉の骨
    qz += 0.03 * front * gauss(qx / 0.24, (qy + 0.5) / 0.13);                           // 口元のふくらみ
    qz += 0.035 * front * gauss((ax - 0.42) / 0.14, (qy - eyeY + 0.2) / 0.13);         // ほお
    qx += Math.sign(qx) * 0.035 * smooth(0, 0.5, z) * gauss((ax - 0.6) / 0.15, (qy - eyeY + 0.12) / 0.12); // ほお骨
    qx -= Math.sign(qx) * 0.025 * gauss((qy - eyeY - 0.25) / 0.15, (z - 0.35) / 0.25);  // こめかみ
    o.set(qx, qy, qz);
  };
}

// ---------- 本体 ----------
export function makeHuman(opt = {}) {
  textures();
  const r = rng(opt.seed ?? Math.floor(Math.random() * 1e9));
  const pick = a => a[Math.floor(r() * a.length)];
  const rr = (a, b) => a + (b - a) * r();

  const age = opt.age ?? pick(['adult', 'adult', 'adult', 'child', 'elder']);
  const sex = opt.sex ?? (r() < 0.5 ? 'male' : 'female');
  const F = sex === 'female', child = age === 'child', elder = age === 'elder';
  const height = opt.height ?? (child ? rr(1.05, 1.35) : (F ? rr(1.52, 1.68) : rr(1.63, 1.82)) * (elder ? 0.97 : 1));
  const build = opt.build ?? (child ? rr(0.95, 1.1) : rr(0.88, 1.25));
  const heads = child ? lerp(5.6, 6.4, clamp((height - 1.05) / 0.3)) : elder ? 7.2 : 7.5;
  const a = height / heads / 2;          // 頭の半分の高さ（m）
  const u = height - 2 * a;              // あごから下の長さ。体の寸法はこれの割合で決める
  const skinC = new THREE.Color(opt.skin ?? pick(SKINS));
  const hairC = new THREE.Color(opt.hairColor ?? (elder ? pick(GREYS) : pick(HAIRS)));
  const hairStyle = opt.hair ?? (F ? pick(['long', 'bob', 'ponytail', 'bun', 'bangs', 'long']) : elder ? pick(['short', 'bald', 'buzz', 'short']) : pick(['short', 'short', 'buzz', 'bangs']));
  const sleeve = opt.sleeve ?? (r() < 0.5 ? 'short' : 'long');
  const bottom = opt.bottom ?? (F && r() < 0.35 ? 'skirt' : r() < 0.2 ? 'shorts' : 'pants');
  const glasses = opt.glasses ?? r() < (elder ? 0.6 : 0.12);

  const skinL = skinC.getHSL({}).l;
  const skinMat = new THREE.MeshPhysicalMaterial({ color: skinC, roughness: 0.52, sheen: 0.15 + 0.5 * clamp(skinL * 2 - 0.4), sheenColor: new THREE.Color('#ff7a5c'), sheenRoughness: 0.55 });
  const faceMat = skinMat.clone(); faceMat.color = new THREE.Color('#fff'); faceMat.vertexColors = true;
  const lipMat = new THREE.MeshPhysicalMaterial({ color: skinC.clone().lerp(new THREE.Color('#a8443f'), 0.45), roughness: 0.38, sheen: 0.4, sheenColor: new THREE.Color('#ff7a6a'), side: THREE.DoubleSide });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairC, map: HAIRTEX, roughness: 0.48, metalness: 0.05, side: THREE.DoubleSide });
  const browMat = new THREE.MeshStandardMaterial({ color: hairC.clone().multiplyScalar(elder ? 0.85 : 0.75), roughness: 0.8, side: THREE.DoubleSide });
  const topMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(opt.top ?? pick(TOPS)), map: sleeve === 'long' && r() < 0.4 ? KNIT : FABRIC, roughness: 0.92 });
  const botMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(opt.bottomColor ?? pick(BOTTOMS)), map: FABRIC, roughness: 0.88 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(opt.shoes ?? pick(SHOES)), roughness: 0.45 });
  const soleMat = new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2a1414', roughness: 0.9, side: THREE.DoubleSide });
  const teethMat = new THREE.MeshStandardMaterial({ color: '#efe9dd', roughness: 0.35, side: THREE.DoubleSide });
  const mats = [skinMat, faceMat, lipMat, hairMat, browMat, topMat, botMat, shoeMat, soleMat, darkMat, teethMat];

  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const grp = (parent, x = 0, y = 0, z = 0, Cls = THREE.Group) => { const g = new Cls(); g.position.set(x, y, z); parent.add(g); return g; };
  const bone = (parent, x, y, z) => grp(parent, x, y, z, THREE.Bone);
  // 関節でなめらかに曲がる1本の腕・脚（SkinnedMesh）。y が cut より上は bones[0]、下は bones[1] についていく
  const binds = [];
  const limbMesh = (parent, geo, mat, bones, cut, blend) => {
    const p = geo.attributes.position, si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) { const w = smooth(cut + blend, cut - blend, p.getY(i)); si[i * 4 + 1] = 1; sw[i * 4] = 1 - w; sw[i * 4 + 1] = w; }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const m = new THREE.SkinnedMesh(geo, mat); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; parent.add(m);
    binds.push([m, bones]); return m;
  };
  const sphere = (rx, ry = rx, rz = rx) => { const g = new THREE.SphereGeometry(1, 20, 14); g.scale(rx, ry, rz); return g; };

  // 体型（u の割合）
  const bw = build, bf = Math.pow(build, 1.7);
  const sh = (F ? 0.105 : 0.118) * (child ? 0.95 : 1) * Math.pow(bw, 0.6);   // 肩の関節の位置（横）
  const hipW = (F ? 0.124 : 0.116) * Math.pow(bw, 0.8);
  const waist = (F ? 0.084 : 0.097) * bf;
  const chest = (F ? 0.098 : 0.106) * bw;
  const depth = (F ? 0.074 : 0.08) * Math.pow(bw, 0.9);
  const belly = (F ? 0.0 : 0.012) * Math.max(0, bf - 1) * 3 + (elder ? 0.006 : 0);
  const limb = Math.pow(bw, 0.7) * (F ? 0.92 : 1);

  const root = new THREE.Group(); root.name = 'human';
  const j = {};
  j.pelvis = grp(root, 0, 0.6 * u, 0);
  j.spine = grp(j.pelvis, 0, 0.11 * u, 0);
  j.neck = grp(j.spine, 0, (0.955 - 0.71) * u, -0.004 * u);
  j.head = grp(j.neck, 0, (1.0 - 0.955) * u, 0.004 * u);

  // 骨盤（下の服）
  const P = y => y * u - 0.6 * u;
  add(j.pelvis, loft([
    [P(0.475), (hipW - 0.05) * u, (depth - 0.04) * u, 0, -0.016 * u],
    [P(0.505), (hipW - 0.016) * u, (depth - 0.014) * u, 0, -0.014 * u],
    [P(0.548), (hipW + 0.004) * u, (depth + 0.008) * u, 0, -0.008 * u],
    [P(0.605), hipW * u, (depth + 0.003) * u, 0, -0.008 * u + belly * u * 0.5],
    [P(0.64), (waist + hipW) / 2 * u, (depth - 0.002) * u, 0, belly * u * 0.7],
    [P(0.675), (waist + 0.004) * u, (depth - 0.005) * u, 0, belly * u * 0.8],
  ], { radial: 32, power: 2.9 }), botMat);
  if (bottom !== 'skirt') { // ベルト
    add(j.pelvis, loft([[P(0.645), (waist + hipW) / 2 * u + 0.006 * u, (depth + 0.004) * u, 0, belly * u * 0.75], [P(0.667), (waist + 0.004) * u + 0.007 * u, (depth + 0.0) * u, 0, belly * u * 0.8]], { radial: 32, steps: 1, power: 2.9, caps: false }), shoeMat);
  }

  // 胴（上の服）
  const S = y => y * u - 0.71 * u;
  const torsoSecs = [
    [S(0.64), (waist - 0.006) * u, (depth - 0.016) * u, 0, belly * u * 0.7],
    [S(0.675), (waist - 0.002) * u, (depth - 0.011) * u, 0, belly * u * 0.9],
    [S(0.71), waist * u, (depth - 0.008) * u, 0, belly * u * 1.1],
    [S(0.78), (waist + chest) / 2 * u, (depth + (F && !child ? 0.004 : 0)) * u, 0, (0.006 + belly * 0.7) * u],
    [S(0.84), chest * u, (depth + 0.008 + (F && !child ? 0.016 * bw : 0)) * u, 0, (0.012 + (F && !child ? 0.016 * bw : 0)) * u],
    [S(0.89), (chest + 0.004) * u, (depth + 0.002) * u, 0, 0.004 * u],
    [S(0.925), (sh - 0.002) * u, (depth - 0.014) * u, 0, -0.006 * u],
    [S(0.955), (sh * 0.72) * u, (depth - 0.024) * u, 0, -0.01 * u],
    [S(0.982), 0.046 * u * limb, 0.042 * u, 0, -0.006 * u],
  ];
  const torso = add(j.spine, loft(torsoSecs, { radial: 32, power: 2.3 }), topMat);
  // えり
  const collar = new THREE.TorusGeometry(0.047 * u * limb, 0.006 * u, 8, 28); collar.rotateX(Math.PI / 2); collar.scale(1, 1, 0.95);
  add(j.spine, collar, topMat, 0, S(0.976), -0.004 * u);

  // 首
  add(j.neck, loft([[-0.03 * u, 0.042 * u * limb, 0.042 * u, 0, 0], [0.04 * u, 0.039 * u * limb, 0.04 * u, 0, 0.004 * u], [0.085 * u, 0.04 * u * limb, 0.042 * u, 0, 0.008 * u]], { radial: 20 }), skinMat);

  // ---------- 頭 ----------
  const eyeY = child ? -0.1 : 0;
  const H = grp(j.head, 0, u + a - 1.0 * u - 0.012 * a, 0.012 * u); H.scale.setScalar(a);
  const headGeo = deformSphere(72, 54, headShape(child, eyeY, !F && !child));
  const light = clamp(skinL * 2.2 - 0.25, 0.25, 1);
  colorize(headGeo, skinC, (x, y, z, c) => {
    const f = smooth(0.2, 0.7, z) * light, ax = Math.abs(x);
    const blush = 0.32 * f * gauss((ax - 0.4) / 0.17, (y - eyeY + 0.26) / 0.14) + 0.12 * f * gauss(x / 0.16, (y + 0.86) / 0.12) + (child ? 0.15 * f * gauss((ax - 0.4) / 0.15, (y - eyeY + 0.25) / 0.12) : 0);
    c.lerp(skinC.clone().multiply(new THREE.Color(1, 0.7, 0.66)), blush);
    c.multiplyScalar(1 - 0.12 * f * gauss((ax - 0.27) / 0.11, (y - eyeY + 0.09) / 0.05) - 0.06 * f * gauss((ax - 0.25) / 0.14, (y - eyeY - 0.07) / 0.05));
    if (!F && !child && hairStyle !== 'long') c.lerp(skinC.clone().multiply(new THREE.Color(0.82, 0.8, 0.8)), 0.35 * smooth(-0.4, -0.75, y) * f * smooth(0.0, 0.25, Math.abs(y + 0.75) < 0.3 ? 1 : 0.5)); // ひげのそり跡
  });
  const headMesh = add(H, headGeo, faceMat);
  const surf = heightMap(headGeo, -0.8, 0.8, -1.05, 0.8, 0.01);

  // 目
  const eyeR = 0.105, ex = child ? 0.29 : 0.275;
  const eyeMat = new THREE.MeshPhysicalMaterial({ map: eyeTexture(opt.eyeColor ?? pick(EYES)), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
  mats.push(eyeMat);
  const eyes = [], lids = [], lowLids = [];
  for (const s of [-1, 1]) {
    const cz = surf(s * ex, eyeY) - 0.03;
    const eg = grp(H, s * ex, eyeY, cz);
    const ball = add(eg, new THREE.SphereGeometry(eyeR, 28, 20), eyeMat); ball.castShadow = false;
    ball.rotation.y = -s * 0.05; eyes.push(ball);
    // 上まぶた（回して閉じる）
    const lid = grp(eg);
    const ul = new THREE.SphereGeometry(eyeR * 1.07, 28, 12, 0, Math.PI * 2, 0, 1.75);
    add(lid, ul, skinMat).castShadow = false;
    const lash = new THREE.TorusGeometry(eyeR * 1.07 * Math.sin(1.75), 0.009, 5, 24, Math.PI); lash.rotateX(Math.PI / 2); lash.translate(0, eyeR * 1.07 * Math.cos(1.75), 0);
    add(lid, lash, darkMat).castShadow = false;
    const crease = new THREE.TorusGeometry(eyeR * 1.11 * Math.sin(1.25), 0.006, 5, 24, Math.PI); crease.rotateX(Math.PI / 2); crease.translate(0, eyeR * 1.11 * Math.cos(1.25), 0);
    add(lid, crease, skinMat).castShadow = false;
    lids.push(lid);
    const low = grp(eg);
    add(low, new THREE.SphereGeometry(eyeR * 1.05, 28, 8, 0, Math.PI * 2, Math.PI - 1.3, 1.3), skinMat).castShadow = false;
    lowLids.push(low);
  }

  // 鼻
  const N = (y, rx, rz, out) => [y, rx, rz, 0, surf(0, y) + out - rz];
  const nk = child ? 0.75 : 1;
  const nose = add(H, loft([
    N(-0.262, 0.035, 0.03, 0.03 * nk), N(-0.248, 0.06, 0.055, 0.1 * nk), N(-0.22, 0.075, 0.07, 0.17 * nk), N(-0.175, 0.068, 0.068, 0.185 * nk),
    N(-0.1, 0.052, 0.06, 0.14 * nk), N(eyeY - 0.0, 0.048, 0.05, 0.085 * nk), N(eyeY + 0.08, 0.05, 0.04, 0.04 * nk), N(eyeY + 0.15, 0.05, 0.03, 0.005),
  ], { radial: 20, steps: 5 }), faceMat);
  colorize(nose.geometry, skinC, (x, y, z, c) => c.lerp(skinC.clone().multiply(new THREE.Color(1, 0.75, 0.72)), 0.25 * gauss(x / 0.08, (y + 0.19) / 0.06)));
  for (const s of [-1, 1]) {
    const al = add(H, sphere(0.045, 0.042, 0.05), faceMat, s * 0.072, -0.222, surf(s * 0.072, -0.222) + 0.035 * nk);
    colorize(al.geometry, skinC, (x, y, z, c) => c.lerp(skinC.clone().multiply(new THREE.Color(1, 0.78, 0.74)), 0.2));
    add(H, sphere(0.022, 0.008, 0.03), darkMat, s * 0.034, -0.258, surf(0, -0.258) + 0.06 * nk).castShadow = false;
  }

  // 耳
  let side = 0;
  { const p = headGeo.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - (eyeY - 0.05)) < 0.06 && Math.abs(p.getZ(i) + 0.1) < 0.1) side = Math.max(side, Math.abs(p.getX(i))); }
  for (const s of [-1, 1]) {
    const ear = grp(H, s * (side - 0.02), eyeY - 0.06, -0.1);
    ear.rotation.set(-0.12, s * 0.35, 0);
    const eg = sphere(0.045, 0.19, 0.11);
    { const p = eg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) * (1 - 0.35 * smooth(0, -0.19, y)) - 0.02 * smooth(0.05, -0.19, y)); p.setX(i, p.getX(i) + s * 0.025 * (1 - Math.abs(p.getZ(i)) / 0.11)); } smoothSeams(eg); }
    colorize(eg, skinC, (x, y, z, c) => c.lerp(skinC.clone().multiply(new THREE.Color(1, 0.72, 0.68)), 0.25));
    add(ear, eg, faceMat);
    const rim = new THREE.TorusGeometry(0.085, 0.022, 8, 20, 4.0); rim.rotateZ(-0.6); rim.rotateY(Math.PI / 2); rim.scale(1, 1.75, 1.05); rim.translate(s * 0.035, 0.02, -0.005);
    colorize(rim, skinC, (x, y, z, c) => c.lerp(skinC.clone().multiply(new THREE.Color(1, 0.75, 0.7)), 0.2));
    add(ear, rim, faceMat);
  }

  // 眉
  const face = { blink: 0, open: 0, smile: child ? 0.3 : 0.1, brow: 0, look: null };
  const brows = [];
  for (const s of [-1, 1]) {
    const bg = decal(surf, 14, 4, (si, ti) => {
      const x = s * (0.1 + si * 0.37);
      const th = lerp(F ? 0.035 : 0.05, 0.015, si * si);
      const y = eyeY + 0.165 + 0.055 * Math.sin(Math.PI * clamp(si * 1.25, 0, 1) * 0.85) - 0.03 * si * si + (ti - 0.5) * th;
      return [x, y, 0.012 + 0.008 * Math.sin(Math.PI * ti)];
    });
    brows.push(add(H, bg, browMat));
    brows[brows.length - 1].castShadow = false;
  }

  // 口（唇は表情で形を作り直す）
  const mW = child ? 0.17 : F ? 0.19 : 0.21, mY = -0.5;
  const lipLine = (s, upper) => {
    const sm = face.smile, gap = face.open * 0.17;
    return mY + 0.045 * sm * s * s - 0.01 * Math.abs(sm) * (1 - s * s) * (sm < 0 ? -1 : 1) + (upper ? gap * 0.25 : -gap * 0.75 * (1 - 0.35 * s * s));
  };
  const W = () => mW * (1 + 0.12 * face.smile + 0.05 * face.open);
  const upperLip = decal(surf, 25, 6, (si, ti) => {
    const s = si * 2 - 1, x = s * W(), base = lipLine(s, true);
    const h = (F ? 0.065 : 0.055) * Math.pow(1 - Math.pow(Math.abs(s), 1.6), 0.8) - 0.012 * gauss(s / 0.09) + 0.006 * gauss((Math.abs(s) - 0.17) / 0.07);
    return [x, base + ti * h, 0.004 + 0.032 * Math.sin(Math.PI * (0.25 + 0.75 * ti)) * Math.sqrt(1 - s * s)];
  });
  const lowerLip = decal(surf, 25, 6, (si, ti) => {
    const s = si * 2 - 1, x = s * W() * 0.96, base = lipLine(s, false);
    const h = (F ? 0.085 : 0.075) * Math.pow(1 - Math.pow(Math.abs(s), 1.8), 0.7);
    return [x, base - (1 - ti) * h, 0.004 + 0.04 * Math.sin(Math.PI * (0.25 + 0.75 * (1 - ti))) * Math.sqrt(1 - s * s)];
  });
  const mouthIn = decal(surf, 19, 3, (si, ti) => {
    const s = si * 2 - 1, x = s * W() * 0.95, y0 = lipLine(s, false), y1 = lipLine(s, true);
    return [x, lerp(y0, y1, ti), 0.006 + 0.01 * (1 - s * s)];
  });
  const teeth = decal(surf, 15, 3, (si, ti) => {
    const s = si * 2 - 1, x = s * W() * 0.7, y1 = lipLine(s, true), y0 = lipLine(s, false);
    return [x, lerp(y1 - Math.min(0.055, (y1 - y0) * 0.45), y1, ti), 0.009 + 0.012 * (1 - s * s)];
  });
  const lipU = add(H, upperLip, lipMat), lipL = add(H, lowerLip, lipMat);
  const mIn = add(H, mouthIn, darkMat), tth = add(H, teeth, teethMat);
  for (const m of [lipU, lipL, mIn, tth]) m.castShadow = false;
  let lastMouth = '';
  const updateMouth = () => {
    const key = face.open.toFixed(2) + face.smile.toFixed(2); if (key === lastMouth) return; lastMouth = key;
    upperLip.update(); lowerLip.update(); mouthIn.update(); teeth.update();
    mIn.visible = tth.visible = face.open > 0.02;
  };
  updateMouth();

  // 髪
  const yF = child ? 0.5 : 0.56;
  const SHORT = [[0, yF], [0.65, yF - 0.04], [1.1, 0.4], [1.27, eyeY + 0.02], [1.42, eyeY + 0.2], [1.9, eyeY + 0.2], [2.5, -0.42], [Math.PI, -0.48]];
  const BOB = [[0, yF - 0.04], [0.6, yF - 0.08], [0.86, -0.1], [1.15, -0.62], [Math.PI, -0.62]];
  const BANGS = [[0, eyeY + 0.24], [0.55, eyeY + 0.26], [0.8, -0.05], [1.15, -0.62], [Math.PI, -0.62]];
  const interp = (tab, x) => { for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) return lerp(tab[i - 1][1], tab[i][1], (x - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0])); return tab[tab.length - 1][1]; };
  if (hairStyle !== 'none') {
    const shape = headShape(child, eyeY, !F && !child), q = new THREE.Vector3();
    let tab = SHORT, thick = 0.07, flare = 0, top = 0.05;
    if (hairStyle === 'buzz') { thick = 0.022; top = 0.008; }
    if (hairStyle === 'bob' || hairStyle === 'long') { tab = BOB; flare = 0.11; thick = 0.07; }
    if (hairStyle === 'bangs') { tab = F ? BANGS : BANGS.map(([x, y], i) => i < 2 ? [x, y] : [x, Math.max(y, interp(SHORT, x))]); flare = F ? 0.1 : 0; }
    if (hairStyle === 'ponytail' || hairStyle === 'bun') { thick = 0.04; top = 0.03; tab = SHORT.map(([x, y]) => [x, x > 1.3 ? y - 0.05 : y]); }
    const hairGeo = deformSphere(64, 48, (p, o) => {
      shape(p, q);
      const az = Math.abs(Math.atan2(p.x, p.z));
      const fringe = 0.022 * (Math.sin(az * 47) * 0.6 + Math.sin(az * 83 + 1) * 0.4) * (hairStyle === 'buzz' ? 0.2 : 1);
      const line = interp(tab, az) + fringe;
      let m = smooth(line - 0.02, line + 0.02, p.y), grow = smooth(line - 0.02, line + (hairStyle === 'buzz' ? 0.1 : 0.32), p.y);
      if (hairStyle === 'bald') { const b = smooth(0.38, 0.22, p.y) * smooth(1.0, 1.4, az); m *= b; grow *= b; }
      if (flare && p.y < 0.2) grow = Math.max(grow, m); // ボブ・ロングの毛先は厚いまま
      const off = lerp(-0.05, 0.008, m) + (thick + top * Math.max(0, p.y) + flare * smooth(0.25, -0.6, p.y)) * grow;
      o.copy(q).addScaledVector(q.clone().normalize(), off);
    });
    add(H, hairGeo, hairMat);
    if (hairStyle === 'long') {
      add(H, loft([[-0.15, 0.74, 0.62, 0, -0.22], [-0.6, 0.8, 0.5, 0, -0.32], [-1.1, 0.82, 0.36, 0, -0.5], [-1.7, 0.82, 0.24, 0, -0.78], [-2.3, 0.74, 0.16, 0, -0.98], [-2.55, 0.55, 0.08, 0, -1.0]], { radial: 28, steps: 5 }), hairMat);
    }
    if (hairStyle === 'ponytail') {
      add(H, loft([[0.25, 0.2, 0.2, 0, -0.95], [0.05, 0.19, 0.19, 0, -1.08], [-0.5, 0.17, 0.14, 0, -1.18], [-1.1, 0.13, 0.1, 0, -1.12], [-1.5, 0.05, 0.05, 0, -1.02]], { radial: 16, steps: 5 }), hairMat);
      const tie = new THREE.TorusGeometry(0.17, 0.04, 8, 18); tie.rotateX(Math.PI / 2 - 0.3);
      add(H, tie, darkMat, 0, 0.18, -0.98);
    }
    if (hairStyle === 'bun') add(H, sphere(0.3, 0.27, 0.27), hairMat, 0, 0.5, -0.82);
  }

  // めがね
  if (glasses) {
    const gm = new THREE.MeshStandardMaterial({ color: pick(['#1c1c1c', '#5a3a22', '#8a8a8a']), roughness: 0.3, metalness: 0.4 }); mats.push(gm);
    const gz = surf(ex, eyeY) + 0.16;
    for (const s of [-1, 1]) {
      const rimG = new THREE.TorusGeometry(0.15, 0.014, 6, 28); rimG.scale(1, 0.78, 1);
      add(H, rimG, gm, s * ex, eyeY, gz);
      const arm = new THREE.CylinderGeometry(0.012, 0.012, 1, 6); arm.rotateX(Math.PI / 2);
      const L = gz + 0.1; const m = add(H, arm, gm, s * (side + 0.01), eyeY + 0.04, gz - L / 2); m.scale.z = L;
      const hinge = add(H, new THREE.BoxGeometry(0.06, 0.03, 0.03), gm, s * (ex + 0.15), eyeY + 0.03, gz);
      hinge.scale.x = (side + 0.01 - ex - 0.15) / 0.06 + 0.5; hinge.position.x = s * (ex + 0.15 + (side + 0.01 - ex - 0.15) / 2);
    }
    const br = new THREE.TorusGeometry(0.07, 0.013, 6, 12, Math.PI); add(H, br, gm, 0, eyeY + 0.01, gz);
  }

  // ---------- 腕 ----------
  const fingerCurl = { L: [0.3, 0.3, 0.3, 0.3, 0.2], R: [0.3, 0.3, 0.3, 0.3, 0.2] };
  const fingerJ = { L: [], R: [] };
  const upperL = (0.915 - 0.727) * u, foreL = (0.727 - 0.56) * u, L = limb;
  for (const s of [-1, 1]) {
    const k = s > 0 ? 'L' : 'R';
    const sho = j['shoulder' + k] = bone(j.spine, s * sh * u, S(0.915), -0.006 * u);
    const longS = sleeve === 'long', sv = longS ? 1.08 : 1, armMat = longS ? topMat : skinMat;
    const elb = j['elbow' + k] = bone(sho, 0, -upperL, 0);
    const o = sho.position, U = upperL, Fo = foreL;
    const armSecs = [[0.04 * u, 0.008, 0.008], [0.032 * u, 0.026, 0.028], [0.012 * u, 0.038, 0.039], [-0.02 * u, 0.04, 0.04], [-0.25 * U, 0.038, 0.037], [-0.55 * U, 0.034, 0.036, 0.003 * u], [-0.85 * U, 0.03, 0.03], [-U, 0.028, 0.028],
      [-U - 0.2 * Fo, 0.032, 0.029, 0.002 * u], [-U - 0.6 * Fo, 0.025, 0.021], [-U - Fo, 0.02, 0.016], [-U - Fo - 0.006 * u, 0.012, 0.01]];
    limbMesh(j.spine, loft(armSecs.map(([y, rx, rz, cz = 0]) => [o.y + y, rx * L * u * sv, rz * L * u * sv, o.x, o.z + cz]), { radial: 18, steps: 5 }), armMat, [sho, elb], o.y - U, 0.035 * u);
    if (!longS) add(sho, loft([[0.042 * u, 0.004 * u, 0.004 * u], [0.034 * u, 0.03 * L * u, 0.034 * L * u], [0.018 * u, 0.044 * L * u, 0.045 * L * u], [-0.02 * u, 0.047 * L * u, 0.047 * L * u], [-0.25 * upperL, 0.045 * L * u, 0.044 * L * u], [-0.5 * upperL, 0.042 * L * u, 0.043 * L * u, 0, 0.002 * u]], { radial: 20, caps: false }), new THREE.MeshStandardMaterial({ color: topMat.color, map: topMat.map, roughness: 0.92, side: THREE.DoubleSide }));
    if (longS) add(elb, loft([[-foreL + 0.012 * u, 0.024 * u * L, 0.021 * u * L], [-foreL - 0.004 * u, 0.024 * u * L, 0.021 * u * L]], { radial: 16, steps: 1 }), topMat);
    const wr = j['wrist' + k] = bone(elb, 0, -foreL, 0);
    // 手（手のひらは体の方を向く）
    const hs = (child ? 0.95 : 1) * (F ? 0.93 : 1);
    add(wr, loft([[0.01 * u, 0.013 * u, 0.019 * u], [0, 0.0135 * u, 0.022 * u], [-0.025 * u * hs, 0.0145 * u, 0.029 * u * hs, -s * 0.001 * u], [-0.052 * u * hs, 0.0135 * u, 0.031 * u * hs, -s * 0.001 * u], [-0.07 * u * hs, 0.011 * u, 0.029 * u * hs, -s * 0.002 * u]], { radial: 16, power: 2.6 }), skinMat);
    const fz = [0.0215, 0.0072, -0.0072, -0.0205], fl = [0.05, 0.056, 0.052, 0.041], fr = [0.0074, 0.0076, 0.0072, 0.0064];
    for (let f = 0; f < 4; f++) {
      const len = fl[f] * u * hs, rad = fr[f] * u * hs;
      const p1 = grp(wr, -s * 0.002 * u, -0.066 * u * hs, fz[f] * u * hs);
      p1.rotation.x = (f - 1.5) * -0.05;
      add(p1, loft([[0.004 * u, rad * 1.1, rad * 1.05], [-0.5 * len, rad, rad * 0.95], [-0.56 * len, rad * 0.95, rad * 0.92]], { radial: 10, steps: 2 }), skinMat);
      const p2 = grp(p1, 0, -0.55 * len, 0);
      add(p2, loft([[0.01 * len, rad * 0.94, rad * 0.9], [-0.35 * len, rad * 0.86, rad * 0.82], [-0.43 * len, rad * 0.7, rad * 0.66], [-0.47 * len, rad * 0.25, rad * 0.25]], { radial: 10, steps: 2 }), skinMat);
      fingerJ[k].push([p1, p2]);
    }
    const th = grp(wr, -s * 0.007 * u, -0.012 * u * hs, 0.022 * u * hs);
    const tl = 0.05 * u * hs, trd = 0.0095 * u * hs;
    add(th, loft([[0.004 * u, trd * 1.2, trd * 1.2], [-0.5 * tl, trd, trd], [-0.55 * tl, trd * 0.95, trd * 0.95]], { radial: 10, steps: 2 }), skinMat);
    const th2 = grp(th, 0, -0.52 * tl, 0);
    add(th2, loft([[0.01 * tl, trd * 0.95, trd * 0.92], [-0.38 * tl, trd * 0.85, trd * 0.8], [-0.46 * tl, trd * 0.6, trd * 0.6], [-0.5 * tl, trd * 0.2, trd * 0.2]], { radial: 10, steps: 2 }), skinMat);
    fingerJ[k].push([th, th2]);
  }

  // ---------- 脚 ----------
  const thighL = (0.595 - 0.329) * u, shinL = (0.329 - 0.045) * u;
  const pantsLong = bottom === 'pants';
  for (const s of [-1, 1]) {
    const k = s > 0 ? 'L' : 'R';
    const hip = j['hip' + k] = bone(j.pelvis, s * (hipW - 0.057) * u, -0.005 * u, 0);
    const kn = j['knee' + k] = bone(hip, 0, -thighL, 0);
    const tr = (F ? 1.04 : 1) * limb, T = thighL, Sh = shinL, o = hip.position, pv = pantsLong ? 1.08 : 1;
    const legSecs = [[0.035 * u, 0.044 * tr, 0.046 * tr, 0, 0.006], [0.0, 0.058 * tr, 0.056 * tr, -0.006 * u, 0.008], [-0.035 * u, 0.066 * tr, 0.058 * tr, -0.003 * u, 0.009], [-0.25 * T, 0.06 * tr, 0.058 * tr, 0.003 * u, 0.004], [-0.6 * T, 0.047 * tr, 0.049 * tr], [-0.9 * T, 0.038 * L, 0.04 * L], [-T, 0.036 * L, 0.037 * L],
      [-T - 0.2 * Sh, 0.039 * L, 0.044 * L, -0.007 * u], [-T - 0.45 * Sh, 0.035 * L, 0.039 * L, -0.006 * u], [-T - 0.75 * Sh, 0.026 * L, 0.027 * L], [-T - Sh, 0.022 * L, 0.024 * L], [-T - Sh - 0.01 * u, 0.018 * L, 0.02 * L]];
    limbMesh(j.pelvis, loft(legSecs.map(([y, rx, rz, cz = 0, ci = 0], i) => pantsLong && i > 5 ? [o.y + y, Math.max(rx * pv, 0.0385 * L) * u, Math.max(rz * pv, 0.04 * L) * u, o.x, o.z + cz * 0.4] : [o.y + y, rx * pv * u, rz * pv * u, o.x - s * ci * u, o.z + cz]), { radial: 20, steps: 5 }),
      pantsLong ? botMat : skinMat, [hip, kn], o.y - T, 0.045 * u);
    if (bottom === 'shorts') add(hip, loft(legSecs.slice(0, 5).map(([y, rx, rz, cz = 0, ci = 0], i) => [i === 4 ? -0.45 * T : y, rx * 1.12 * u, rz * 1.12 * u, -s * ci * u, cz]), { radial: 20, caps: false }), new THREE.MeshStandardMaterial({ color: botMat.color, map: FABRIC, roughness: 0.88, side: THREE.DoubleSide }));
    const an = j['ankle' + k] = bone(kn, 0, -shinL, 0);
    // 靴（足首から前へ）
    const fs = (child ? 0.95 : F ? 0.9 : 1) * u, ay = 0.045 * u;
    const shoe = loft([
      [-0.048 * fs, 0.02 * fs, 0.026 * fs, 0, ay - 0.026 * fs], [-0.038 * fs, 0.029 * fs, 0.04 * fs, 0, ay - 0.04 * fs], [0, 0.033 * fs, 0.052 * fs, 0, ay - 0.052 * fs],
      [0.04 * fs, 0.037 * fs, 0.036 * fs, 0, ay - 0.036 * fs], [0.08 * fs, 0.041 * fs, 0.025 * fs, s * 0.003 * fs, ay - 0.025 * fs], [0.11 * fs, 0.037 * fs, 0.02 * fs, s * 0.006 * fs, ay - 0.02 * fs],
      [0.128 * fs, 0.026 * fs, 0.016 * fs, s * 0.007 * fs, ay - 0.016 * fs], [0.136 * fs, 0.01 * fs, 0.01 * fs, s * 0.007 * fs, ay - 0.01 * fs],
    ], { radial: 20, power: 2.8, steps: 4 });
    shoe.rotateX(Math.PI / 2);
    add(an, shoe, shoeMat);
    const sole = shoe.clone(); sole.scale(1.04, 0.22, 1.02); sole.translate(0, -ay * 0.78 + 0.002 * u, 0);
    add(an, sole, soleMat);
  }
  if (bottom === 'skirt') {
    add(j.pelvis, loft([[P(0.39), hipW * 1.2 * u, depth * 1.42 * u, 0, -0.004 * u], [P(0.5), hipW * 1.07 * u, depth * 1.25 * u, 0, -0.006 * u], [P(0.6), hipW * 1.04 * u, (depth + 0.008) * u, 0, -0.005 * u], [P(0.676), (waist + 0.008) * u, (depth - 0.002) * u, 0, 0]], { radial: 32, power: 2.1, caps: false }), new THREE.MeshStandardMaterial({ color: botMat.color, map: FABRIC, roughness: 0.88, side: THREE.DoubleSide }));
  }

  root.updateMatrixWorld(true);
  for (const [m, b] of binds) m.bind(new THREE.Skeleton(b));

  root.traverse(o => { if (o.isMesh && o.material.side === THREE.DoubleSide && !mats.includes(o.material)) mats.push(o.material); });

  // ---------- 動き ----------
  const rest = {};
  for (const [n, g] of Object.entries(j)) rest[n] = { p: g.position.clone() };
  const armOut = clamp(((bottom === 'skirt' ? hipW * 1.12 : hipW) + 0.04 - sh) / 0.33, 0.09, 0.4);
  const tgt = {};
  const set = (n, ax, v) => { (tgt[n] ||= { x: 0, y: 0, z: 0 })[ax] = v; };
  let time = r() * 10, blinkT = 1 + r() * 3, blinkPh = 0, walkPh = 0, lookYaw = 0, lookPitch = 0, eyeYaw = 0, eyePitch = 0, lookTarget = null;
  const curl = { L: fingerCurl.L.slice(), R: fingerCurl.R.slice() };

  const h = {
    root, j, face, height, sex, age, pose: 'stand', walkSpeed: 0, auto: true,
    stepLength: 0.8 * (thighL + shinL), // 1歩の長さの目安（m）
    lookAt(p) { lookTarget = p ? p.clone() : null; },
    update(dt) {
      dt = Math.min(dt, 0.1); time += dt;
      // まばたき
      blinkT -= dt;
      if (blinkT < 0) { blinkPh = 1; blinkT = 2 + r() * 4 + (r() < 0.15 ? -1.8 : 0); }
      blinkPh = Math.max(0, blinkPh - dt / 0.16);
      const bl = Math.max(face.blink, Math.sin(blinkPh * Math.PI));
      // 視線
      let ty = 0, tp = 0;
      if (lookTarget) {
        const l = j.neck.worldToLocal(lookTarget.clone()); l.y -= (u + a - 0.955 * u);
        ty = Math.atan2(l.x, l.z); tp = Math.atan2(l.y, Math.hypot(l.x, l.z));
      } else { ty = Math.sin(time * 0.31) * 0.08; tp = Math.sin(time * 0.23) * 0.04; }
      const k = 1 - Math.exp(-dt * 6);
      lookYaw = lerp(lookYaw, clamp(ty, -1.1, 1.1) * 0.7, k); lookPitch = lerp(lookPitch, clamp(tp, -0.6, 0.5) * 0.6, k);
      eyeYaw = lerp(eyeYaw, clamp(ty - lookYaw, -0.45, 0.45), 1 - Math.exp(-dt * 25)); eyePitch = lerp(eyePitch, clamp(tp - lookPitch, -0.35, 0.35), 1 - Math.exp(-dt * 25));
      eyes.forEach((e, i) => { e.rotation.y = eyeYaw - (i ? 1 : -1) * 0.04; e.rotation.x = -eyePitch; });
      const open = -0.5 - eyePitch * 0.5 + face.brow * 0.1 + face.smile * 0.06;
      lids.forEach(l => { l.rotation.x = lerp(open, 0.06, bl); });
      lowLids.forEach(l => { l.rotation.x = 0.2 - face.smile * 0.08 - bl * 0.08; });
      brows.forEach((b, i) => { b.position.y = face.brow * 0.035; b.rotation.z = (i ? -1 : 1) * face.brow * -0.06; });
      updateMouth();
      // 呼吸
      const br = Math.sin(time * 1.6);
      torso.scale.set(1 + 0.006 * br, 1, 1 + 0.012 * br);
      if (!h.auto) return;
      // ポーズ
      for (const n in tgt) tgt[n].x = tgt[n].y = tgt[n].z = 0;
      const w = clamp(h.walkSpeed / 1.3), ws = h.walkSpeed;
      walkPh += dt * ws / (2 * h.stepLength) * Math.PI * 2;
      const sw = Math.sin(walkPh), cw = Math.cos(walkPh), idle = 1 - w;
      set('pelvis', 'z', Math.sin(time * 0.7) * 0.012 * idle + sw * 0.03 * w); set('pelvis', 'y', sw * 0.06 * w);
      set('spine', 'x', (elder ? 0.16 : 0.02) + 0.04 * w); set('spine', 'z', -Math.sin(time * 0.7) * 0.01 * idle); set('spine', 'y', -sw * 0.08 * w);
      set('neck', 'x', elder ? -0.1 : 0); set('neck', 'y', lookYaw * 0.35); set('head', 'y', lookYaw * 0.65); set('head', 'x', -lookPitch - (elder ? 0.06 : 0) - 0.02 * w);
      for (const s of [-1, 1]) {
        const K = s > 0 ? 'L' : 'R', ph = s > 0 ? 0 : Math.PI, ls = Math.sin(walkPh + ph), lc = Math.cos(walkPh + ph);
        set('shoulder' + K, 'z', s * armOut); set('elbow' + K, 'x', -0.14 - 0.25 * w - Math.max(0, -ls) * 0.3 * w);
        set('shoulder' + K, 'x', 0.38 * ls * w - 0.04);
        set('hip' + K, 'x', -0.42 * ls * w); set('hip' + K, 'z', s * 0.025);
        set('knee' + K, 'x', w * (0.08 + 0.85 * Math.max(0, lc) * Math.max(0, -ls + 0.3)));
        set('ankle' + K, 'x', w * 0.25 * Math.min(0, ls));
        set('wrist' + K, 'z', s * 0.05);
      }
      const R = 'R', Lf = 'L';
      const handCurl = (K, v) => { curl[K] = v.slice(); };
      handCurl('L', [0.3, 0.32, 0.34, 0.36, 0.2]); handCurl('R', [0.3, 0.32, 0.34, 0.36, 0.2]);
      const ps = h.pose;
      if (ps === 'wave') {
        set('shoulder' + R, 'z', -1.15); set('shoulder' + R, 'x', -0.25); set('elbow' + R, 'z', -1.25 - 0.35 * Math.sin(time * 9)); set('elbow' + R, 'x', 0);
        set('wrist' + R, 'y', 1.4); handCurl(R, [0.05, 0.05, 0.05, 0.05, 0.1]);
      } else if (ps === 'cheer') {
        for (const K of [R, Lf]) { const s = K === 'L' ? 1 : -1; set('shoulder' + K, 'z', s * (2.65 + 0.08 * Math.sin(time * 6))); set('shoulder' + K, 'x', -0.15); set('elbow' + K, 'x', -0.15); set('elbow' + K, 'z', s * 0.12); handCurl(K, [0.05, 0.05, 0.05, 0.05, 0.1]); }
        set('head', 'x', -lookPitch - 0.15); set('pelvis', 'y', Math.abs(Math.sin(time * 6)) * 0.02);
      } else if (ps === 'peace') {
        set('shoulder' + R, 'z', -0.3); set('shoulder' + R, 'x', -0.8); set('elbow' + R, 'x', -2.2); set('elbow' + R, 'z', 0.2); set('wrist' + R, 'y', 1.3);
        handCurl(R, [0, 0, 1.5, 1.55, 1.0]);
      } else if (ps === 'point') {
        set('shoulder' + R, 'x', -1.45); set('shoulder' + R, 'z', -0.15); set('elbow' + R, 'x', -0.05); handCurl(R, [0, 1.5, 1.55, 1.55, 0.9]);
      } else if (ps === 'hips') {
        for (const K of [R, Lf]) { const s = K === 'L' ? 1 : -1; set('shoulder' + K, 'z', s * 0.72); set('shoulder' + K, 'x', 0.12); set('elbow' + K, 'z', -s * 1.9); set('elbow' + K, 'x', -0.25); set('wrist' + K, 'z', -s * 0.3); handCurl(K, [0.15, 0.15, 0.15, 0.15, 0.3]); }
      } else if (ps === 'sit') {
        for (const K of [R, Lf]) { const s = K === 'L' ? 1 : -1; set('hip' + K, 'x', -1.5); set('hip' + K, 'z', s * 0.07); set('knee' + K, 'x', 1.5); set('shoulder' + K, 'x', -0.35); set('elbow' + K, 'x', -0.75); set('shoulder' + K, 'z', s * 0.12); }
      }
      const kk = 1 - Math.exp(-dt * 10);
      for (const n in tgt) {
        const g = j[n], t = tgt[n];
        if (n === 'pelvis') { g.position.y = lerp(g.position.y, rest.pelvis.p.y + t.y * u * 0.3, kk); g.rotation.z = lerp(g.rotation.z, t.z, kk); continue; }
        g.rotation.x = lerp(g.rotation.x, t.x, kk); g.rotation.y = lerp(g.rotation.y, t.y, kk); g.rotation.z = lerp(g.rotation.z, t.z, kk);
      }
      for (const K of ['L', 'R']) {
        const s = K === 'L' ? 1 : -1;
        fingerJ[K].forEach(([p1, p2], f) => {
          const c = curl[K][f];
          if (f < 4) { p1.rotation.z = lerp(p1.rotation.z, -s * c * 0.95, kk); p2.rotation.z = lerp(p2.rotation.z, -s * c * 1.15, kk); }
          else { p1.rotation.x = lerp(p1.rotation.x, -0.35 - c * 0.3, kk); p1.rotation.z = lerp(p1.rotation.z, -s * (0.35 + c * 0.6), kk); p2.rotation.z = lerp(p2.rotation.z, -s * c * 0.8, kk); }
        });
      }
    },
    dispose() {
      root.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      mats.forEach(m => m.dispose()); eyeMat.map.dispose();
    },
  };
  // 初期姿勢をすぐ反映
  const first = h.update.bind(h);
  for (let i = 0; i < 30; i++) first(0.1);
  return h;
}
