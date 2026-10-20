import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
  ARENA_RADIUS,
  SURVIVE_SECONDS,
  CHARACTERS,
  WEAPONS,
  TOMES,
  ENEMY_KINDS,
  ENEMY_SPEED_SCALE,
  BOSSES,
  RARITY,
  RARITY_MULT,
  SHRINES,
  QUESTS,
} from "./content.js";
import { Sfx } from "./audio.js";
import { ModelKit } from "./models.js";

const TAU = Math.PI * 2;
const SAVE_KEY = "bonkrush-save-v1";
const MOVE_SCALE = 1.06;
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

const $ = (id) => document.getElementById(id);
// World scale: layout was authored for a radius-48 island; landmarks and props spread with ARENA_RADIUS.
const WS = ARENA_RADIUS / 48;
const AREA = WS * WS;
const RADAR_RANGE = 64;
const OBST_CELL = 8;
const MOTE_BOX = 64;
const SHADOW_HALF = 44;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function rand(a, b) {
  return a + Math.random() * (b - a);
}
function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}

function makeToonRamp() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 1;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 4, 0);
  g.addColorStop(0, "#1c1c1c");
  g.addColorStop(0.28, "#4a4a4a");
  g.addColorStop(0.29, "#b8b8b8");
  g.addColorStop(0.72, "#ffffff");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function makeGrassTex() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4aa056";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 48; i++) {
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = Math.random() > 0.5 ? "#2f7a3c" : "#6ed478";
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, Math.random() * 512, 36 + Math.random() * 90, 24 + Math.random() * 70, Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 16000; i++) {
    const shade = Math.random();
    ctx.fillStyle = shade > 0.66 ? "#6ed47a" : shade > 0.33 ? "#3a8646" : "#58b464";
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 2 + Math.random() * 7);
  }
  for (let i = 0; i < 280; i++) {
    ctx.fillStyle = "#c2a86a";
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 4, 2);
  }
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#ffe066" : "#ff8ab0";
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Keep only the detail as brightness so the ground's vertex colors (grass, rock, snow) show through.
  const img = ctx.getImageData(0, 0, 512, 512);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const v = clamp((0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) * 1.65, 0, 255);
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 7);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTex() {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 512;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#2f78c4");
  g.addColorStop(0.22, "#6eb6f0");
  g.addColorStop(0.42, "#c5e8ff");
  g.addColorStop(0.56, "#ffe7c0");
  g.addColorStop(0.72, "#ff9a58");
  g.addColorStop(0.88, "#e86838");
  g.addColorStop(1, "#c44a28");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDirtTex() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c4a86e";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#d8c48a" : "#a88852";
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWaterTex() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a6aa8";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 48; i++) {
    ctx.strokeStyle = `rgba(190,235,255,${0.07 + Math.random() * 0.14})`;
    ctx.lineWidth = 1 + Math.random() * 2.2;
    ctx.beginPath();
    const y0 = Math.random() * 256;
    ctx.moveTo(0, y0);
    for (let x = 0; x <= 256; x += 12) ctx.lineTo(x, y0 + Math.sin(x * 0.09 + i) * 7);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function paintGroundColors(geo) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const n = Math.sin(x * 0.19) * Math.cos(y * 0.16) + Math.sin((x + y) * 0.07);
    if (n > 0.42) c.setHex(0x6fd070);
    else if (n < -0.38) c.setHex(0x2f7040);
    else c.setHex(0x4ea35a);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

const TOON_RAMP = makeToonRamp();
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x1a120c, side: THREE.BackSide });
function toon(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_RAMP, ...extra });
}
function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, ...extra });
}
function makeInstanced(geo, mat, matrices, cast = true, receive = false) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length));
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = matrices.length;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.computeBoundingSphere();
  return mesh;
}

function setShadow(obj, cast = true, receive = false) {
  obj.traverse((n) => {
    if (!n.isMesh) return;
    const mat = n.material;
    if (mat && (mat.side === THREE.BackSide || mat.opacity < 0.5)) return;
    n.castShadow = cast;
    n.receiveShadow = receive;
  });
}
function hull(geo, y, s = 1.12) {
  const m = new THREE.Mesh(geo, OUTLINE_MAT);
  m.position.y = y;
  m.scale.setScalar(s);
  return m;
}
function hypot2(x, z) {
  return Math.hypot(x, z);
}

const POND = { x: 0, z: 0, r: 7.6 };
const RIDGE = { x: 0, z: 0 };
const MESA = { x: 0, z: 0 };
const KNOLL = { x: 0, z: 0 };
const CRATER = { x: 0, z: 0 };
const DUNE = { x: 0, z: 0 };
// Authored landmark spots (radius-48 units); each map rotates/mirrors the layout and jitters them.
const LANDMARK_BASE = [
  [POND, 24, -6],
  [RIDGE, -18, 16],
  [MESA, 20, 14],
  [KNOLL, -8, 26],
  [CRATER, -22, -18],
  [DUNE, 10, -26],
];
const LAYOUT = { ang: 0, cos: 1, sin: 0, flip: 1 };

// Maps an authored (radius-48) point into the current map's rotated, mirrored, scaled layout.
function lay(x, z) {
  const fz = z * LAYOUT.flip;
  return [(x * LAYOUT.cos - fz * LAYOUT.sin) * WS, (x * LAYOUT.sin + fz * LAYOUT.cos) * WS];
}

// Random hills, plateaus and hollows, kept clear of the plaza and pond.
let TERRAIN_FEATURES = [];
function rollTerrainFeatures() {
  const list = [];
  const want = Math.round(ARENA_RADIUS * ARENA_RADIUS * 0.0014);
  for (let t = 0; t < want * 30 && list.length < want; t++) {
    const a = rand(0, TAU);
    const d = Math.sqrt(Math.random()) * (ARENA_RADIUS - 20);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (d < 18 || Math.hypot(x - POND.x, z - POND.z) < 22) continue;
    const up = Math.random() < 0.62;
    const r = up ? rand(7, 20) : rand(6, 15);
    if (list.some((f) => Math.hypot(f.x - x, f.z - z) < (f.r + r) * 0.65)) continue;
    list.push({ x, z, r, h: up ? rand(2.5, 9) : -rand(1.4, 3.2), mesa: up && Math.random() < 0.3 });
  }
  return list;
}

// Tall peaks: high ground worth climbing for, with rock and snow on top.
let MOUNTAINS = [];
function rollMountains() {
  const list = [];
  const want = Math.max(3, Math.round(ARENA_RADIUS * ARENA_RADIUS * 0.0002));
  for (let t = 0; t < want * 60 && list.length < want; t++) {
    const a = rand(0, TAU);
    const d = rand(40, ARENA_RADIUS - 26);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const r = rand(20, 32);
    if (Math.hypot(x - POND.x, z - POND.z) < r + 14) continue;
    if (list.some((o) => Math.hypot(o.x - x, o.z - z) < (o.r + r) * 0.9)) continue;
    list.push({ x, z, r, h: rand(12, 20), seed: rand(0, TAU) });
  }
  return list;
}

// Low ground: river valleys that wind in from the coast, carving passes through the hills.
let VALLEYS = [];
function rollValleys() {
  const list = [];
  const n = Math.max(2, Math.round(ARENA_RADIUS / 60));
  const base = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    let a = base + (i / n) * TAU + rand(-0.35, 0.35);
    let d = ARENA_RADIUS + 4;
    const stop = rand(26, ARENA_RADIUS * 0.4);
    const pts = [[Math.cos(a) * d, Math.sin(a) * d]];
    while (d > stop) {
      d -= rand(14, 22);
      a += rand(-0.22, 0.22);
      pts.push([Math.cos(a) * Math.max(d, stop), Math.sin(a) * Math.max(d, stop)]);
    }
    const w = rand(7, 10);
    const pad = w * 1.8;
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    list.push({
      pts,
      w,
      depth: rand(3, 4.2),
      box: [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...zs) - pad, Math.max(...zs) + pad],
    });
  }
  return list;
}

function smooth01(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const bx = pts[i + 1][0] - ax;
    const bz = pts[i + 1][1] - az;
    const t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1);
    const d = Math.hypot(x - ax - bx * t, z - az - bz * t);
    if (d < best) best = d;
  }
  return best;
}

// Rolls a fresh map: layout orientation, landmark jitter and terrain features.
function rollMap() {
  LAYOUT.ang = rand(0, TAU);
  LAYOUT.cos = Math.cos(LAYOUT.ang);
  LAYOUT.sin = Math.sin(LAYOUT.ang);
  LAYOUT.flip = Math.random() < 0.5 ? -1 : 1;
  for (const [o, bx, bz] of LANDMARK_BASE) {
    [o.x, o.z] = lay(bx * rand(0.85, 1.2), bz * rand(0.85, 1.2));
  }
  MOUNTAINS = rollMountains();
  VALLEYS = rollValleys();
  TERRAIN_FEATURES = rollTerrainFeatures().filter(
    (f) => !MOUNTAINS.some((o) => Math.hypot(o.x - f.x, o.z - f.z) < o.r + f.r * 0.5)
  );
}

function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) {
      m.map?.dispose();
      m.dispose();
    }
  });
}

function heightAt(x, z) {
  const d = Math.hypot(x, z);
  let h =
    Math.sin(x * 0.055) * Math.cos(z * 0.05) * 1.85 +
    Math.sin(x * 0.12 + 1.3) * Math.cos(z * 0.11 + 0.6) * 1.05 +
    Math.sin(x * 0.27 + z * 0.24) * 0.42 +
    Math.sin(x * 0.51) * Math.sin(z * 0.47) * 0.22;

  // Fully flat under the plaza disc so the player stands on it, blending out by d = 9.5.
  const plaza = clamp((9.5 - d) / 3, 0, 1);
  const plazaS = plaza * plaza * (3 - 2 * plaza);
  h = lerp(h, 0.12, plazaS);

  const ridge = Math.hypot(x - RIDGE.x, z - RIDGE.z);
  h += Math.pow(Math.max(0, 1 - ridge / 16.5), 1.85) * 7.4;

  const mesa = Math.hypot(x - MESA.x, z - MESA.z);
  const mt = Math.max(0, 1 - mesa / 10.4);
  h += mt * mt * (3 - 2 * mt) * 4.1;

  const knoll = Math.hypot(x - KNOLL.x, z - KNOLL.z);
  h += Math.pow(Math.max(0, 1 - knoll / 9.2), 1.7) * 4.35;

  const dune = Math.hypot(x - DUNE.x, z - DUNE.z);
  h += Math.pow(Math.max(0, 1 - dune / 11), 2) * 3.6;

  const pond = Math.hypot(x - POND.x, z - POND.z);
  if (pond < 9.4) h -= Math.pow(1 - pond / 9.4, 1.2) * 3.15;

  const crater = Math.hypot(x - CRATER.x, z - CRATER.z);
  if (crater < 7.4) {
    const ct = 1 - crater / 7.4;
    h += (crater < 3.6 ? -1.55 : 2.05) * Math.pow(ct, 1.1);
  }

  for (const f of TERRAIN_FEATURES) {
    const fx = x - f.x;
    const fz = z - f.z;
    if (fx > f.r || fx < -f.r || fz > f.r || fz < -f.r) continue;
    let t = 1 - Math.hypot(fx, fz) / f.r;
    if (t <= 0) continue;
    if (f.mesa) t = Math.min(1, t * 1.8);
    const s = t * t * (3 - 2 * t) * f.h;
    // Hollows stop above sea level so they never flood with ocean water.
    h = f.h > 0 ? h + s : Math.max(h + s, Math.min(h, -1.5));
  }

  for (const o of MOUNTAINS) {
    const dx = x - o.x;
    const dz = z - o.z;
    const lim = o.r * 1.24;
    if (dx > lim || dx < -lim || dz > lim || dz < -lim) continue;
    const a = Math.atan2(dz, dx);
    const r = o.r * (1 + Math.sin(a * 3 + o.seed) * 0.16 + Math.sin(a * 7 + o.seed * 2) * 0.06);
    const t = 1 - Math.hypot(dx, dz) / r;
    if (t <= 0) continue;
    const ridges = Math.abs(Math.sin(a * 5 + o.seed)) * 0.18 + Math.abs(Math.sin(x * 0.21 + z * 0.17)) * 0.08;
    h += o.h * Math.pow(t, 1.45) * (0.88 + ridges);
  }

  for (const v of VALLEYS) {
    if (x < v.box[0] || x > v.box[1] || z < v.box[2] || z > v.box[3]) continue;
    const vd = distToPolyline(x, z, v.pts);
    if (vd >= v.w * 1.8) continue;
    const t = 1 - vd / (v.w * 1.8);
    h -= v.depth * smooth01(t * 1.4) + Math.max(0, h - 0.6) * smooth01(t * 1.6) * 0.6;
    h = Math.max(h, -1.3);
  }

  // Let the high ground settle back down to the beach before the cliffs.
  h = lerp(h, 0.4, smooth01((d - (ARENA_RADIUS - 22)) / 12));

  if (d > ARENA_RADIUS - 10) h += (d - (ARENA_RADIUS - 10)) * 0.22;
  if (d > ARENA_RADIUS - 4) h -= (d - (ARENA_RADIUS - 4)) * 1.15;
  return h;
}

function inPond(x, z) {
  return Math.hypot(x - POND.x, z - POND.z) < POND.r;
}

function slopeAt(x, z) {
  const e = 0.6;
  return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
}

// Sand, grass, highland, rock and snow by height and steepness.
function groundColor(x, z, y, c, steep = 0) {
  const d = Math.hypot(x, z);
  const n = Math.sin(x * 0.19) * Math.cos(z * 0.16) + Math.sin((x + z) * 0.07);
  if (Math.hypot(x - POND.x, z - POND.z) < 9) c.setHex(0xc9b07a);
  else if (y > 12.5) c.setHex(0xf2f5f8);
  else if (y > 10.5) c.setHex(0xb8b4ac);
  else if (steep > 1.05) c.setHex(0x8a8378);
  else if (y > 6.5) c.setHex(0x7f9150);
  else if (d > ARENA_RADIUS - 8 && y < 1.4) c.setHex(0xc2a86a);
  else if (y < -0.5) c.setHex(n > 0 ? 0x2f8a46 : 0x3b9a52);
  else if (y > 2.6) c.setHex(0x5f8a48);
  else if (n > 0.42) c.setHex(0x5cb866);
  else if (n < -0.38) c.setHex(0x3f8a4c);
  else c.setHex(0x4ea35a);
  return c;
}

// Top-down picture of this map's terrain for the minimap, covering [-R, R] on both axes.
function makeTerrainMap(size = 256) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(size, size);
  const c = new THREE.Color();
  const R = ARENA_RADIUS;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 * R - R;
      const z = ((j + 0.5) / size) * 2 * R - R;
      const k = (j * size + i) * 4;
      if (Math.hypot(x, z) > R) continue;
      const y = heightAt(x, z);
      groundColor(x, z, y, c);
      const shade = 0.72 + clamp(y / 18, -0.2, 0.5);
      img.data[k] = Math.min(255, c.r * 255 * shade);
      img.data[k + 1] = Math.min(255, c.g * 255 * shade);
      img.data[k + 2] = Math.min(255, c.b * 255 * shade);
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = "rgba(90,180,240,0.9)";
  ctx.lineWidth = 2;
  for (const v of VALLEYS) {
    ctx.beginPath();
    v.pts.forEach(([x, z], i) => {
      const px = ((x + R) / (2 * R)) * size;
      const pz = ((z + R) / (2 * R)) * size;
      if (i === 0) ctx.moveTo(px, pz);
      else ctx.lineTo(px, pz);
    });
    ctx.stroke();
  }
  return cv;
}

function makeIslandGeometry(radius, rings = 40, segs = 80) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const c = new THREE.Color();
  const pushV = (x, z) => {
    const y = heightAt(x, z);
    positions.push(x, y, z);
    uvs.push(x * 0.085, z * 0.085);
    groundColor(x, z, y, c, slopeAt(x, z));
    colors.push(c.r, c.g, c.b);
  };
  pushV(0, 0);
  for (let r = 1; r <= rings; r++) {
    const d = (r / rings) * radius;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * TAU;
      pushV(Math.cos(a) * d, Math.sin(a) * d);
    }
  }
  for (let i = 0; i < segs; i++) {
    indices.push(0, 1 + ((i + 1) % segs), 1 + i);
  }
  for (let r = 1; r < rings; r++) {
    const r0 = 1 + (r - 1) * segs;
    const r1 = 1 + r * segs;
    for (let i = 0; i < segs; i++) {
      const i0 = r0 + i;
      const i1 = r0 + ((i + 1) % segs);
      const j0 = r1 + i;
      const j1 = r1 + ((i + 1) % segs);
      indices.push(i0, i1, j0, i1, j1, j0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// A ribbon that follows the terrain, so walkers stand on it instead of sinking into a flat slab.
function addTrail(world, pts, mat, width, lift = 0.04) {
  const samples = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.9));
    for (let s = 0; s < steps; s++) samples.push([lerp(ax, bx, s / steps), lerp(az, bz, s / steps)]);
  }
  samples.push(pts[pts.length - 1]);
  const keep = samples.filter(([x, z]) => Math.hypot(x, z) > 6.2);
  if (keep.length < 2) return;
  const positions = [];
  const uvs = [];
  const indices = [];
  let along = 0;
  for (let k = 0; k < keep.length; k++) {
    const prev = keep[Math.max(0, k - 1)];
    const next = keep[Math.min(keep.length - 1, k + 1)];
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    if (k > 0) along += Math.hypot(keep[k][0] - keep[k - 1][0], keep[k][1] - keep[k - 1][1]);
    for (const side of [-0.5, 0.5]) {
      const vx = keep[k][0] - dz * width * side;
      const vz = keep[k][1] + dx * width * side;
      positions.push(vx, heightAt(vx, vz) + lift, vz);
      uvs.push((side + 0.5) * width * 0.25, along * 0.25);
    }
    if (k > 0) {
      const a = (k - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const ribbon = new THREE.Mesh(geo, mat);
  ribbon.receiveShadow = true;
  world.add(ribbon);
}

// Random spots spread at least minGap apart, on dry ground, away from the plaza.
function scatterSpots(n, minGap, minCenter, taken = []) {
  const out = [];
  for (let t = 0; t < n * 40 && out.length < n; t++) {
    const a = rand(0, TAU);
    const d = Math.sqrt(Math.random()) * (ARENA_RADIUS - 10);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (d < minCenter || inPond(x, z) || heightAt(x, z) < -1.2) continue;
    if (out.concat(taken).some(([ox, oz]) => Math.hypot(ox - x, oz - z) < minGap)) continue;
    out.push([x, z]);
  }
  return out;
}
function nowSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
  } catch {
    return {};
  }
}
function writeSave(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function weightedRarity(luck) {
  const entries = Object.values(RARITY);
  const weights = entries.map((r) => {
    if (r.id === "legendary") return r.weight * luck * 1.4;
    if (r.id === "rare") return r.weight * luck * 1.15;
    if (r.id === "uncommon") return r.weight * luck;
    return r.weight;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i].id;
  }
  return "common";
}

class Game {
  constructor() {
    this.sfx = new Sfx();
    this.kit = new ModelKit();
    this.save = Object.assign(
      { bestTime: 0, bestKills: 0, unlocks: { rook: true }, runs: 0, quests: {} },
      nowSave()
    );
    this.lang = localStorage.getItem("bonkrush-lang") || "ar";
    this.keys = new Set();
    this.pointer = { locked: false, dx: 0, dy: 0 };
    this.mode = "menu";
    this.selectedHero = "rook";
    this.clock = new THREE.Clock();
    this.shake = 0;
    this.hitstop = 0;
    this.mouseRight = false;
    this.charging = false;
    this.charge = 0;
    this.bindDom();
    this.setupRenderer();
    this.buildStaticWorld();
    this.loop = this.loop.bind(this);
    this.refreshMenu();
    requestAnimationFrame(this.loop);
  }

  t(ar, en) {
    return this.lang === "ar" ? ar : en;
  }

  bindDom() {
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.lang === "ar" ? "rtl" : "ltr";
    this.els = {
      menu: $("menu"),
      hud: $("hud"),
      pause: $("pause"),
      levelup: $("levelup"),
      end: $("end"),
      toast: $("toast"),
      hpFill: $("hp-fill"),
      hpText: $("hp-text"),
      xpFill: $("xp-fill"),
      xpText: $("xp-text"),
      timer: $("timer"),
      kills: $("kills"),
      gold: $("gold"),
      lvl: $("lvl"),
      weapons: $("weapon-strip"),
      cards: $("cards"),
      heroes: $("heroes"),
      endTitle: $("end-title"),
      endStats: $("end-stats"),
      banner: $("banner"),
      dmg: $("dmg-layer"),
      minimap: $("minimap"),
      hint: $("hint"),
      prompt: $("prompt"),
      chargeFill: $("charge-fill"),
      chargeText: $("charge-text"),
      buffs: $("buffs"),
      shop: $("shop"),
      flash: $("hurt-flash"),
    };
    this.minimapCtx = this.els.minimap.getContext("2d");
    this.dmgPool = [];
    for (let i = 0; i < 28; i++) {
      const n = document.createElement("div");
      n.className = "floater";
      n.style.display = "none";
      this.els.dmg.appendChild(n);
      this.dmgPool.push({ el: n, t: 0, x: 0, y: 0, z: 0, vy: 0 });
    }

    $("btn-start").onclick = () => {
      this.sfx.ui();
      this.startRun();
    };
    $("btn-how").onclick = () => {
      this.sfx.ui();
      $("how").classList.toggle("open");
      $("quests").classList.remove("open");
    };
    $("btn-quests").onclick = () => {
      this.sfx.ui();
      $("quests").classList.toggle("open");
      $("how").classList.remove("open");
      this.refreshQuests();
    };
    $("btn-lang").onclick = () => {
      this.lang = this.lang === "ar" ? "en" : "ar";
      localStorage.setItem("bonkrush-lang", this.lang);
      document.documentElement.lang = this.lang;
      document.documentElement.dir = this.lang === "ar" ? "rtl" : "ltr";
      this.refreshMenu();
    };
    $("btn-mute").onclick = () => {
      this.sfx.setMuted(!this.sfx.muted);
      $("btn-mute").textContent = this.sfx.muted ? "🔇" : "🔊";
    };
    $("btn-resume").onclick = () => this.setPaused(false);
    $("btn-quit").onclick = () => this.quitToMenu();
    $("btn-again").onclick = () => this.startRun();
    $("btn-menu").onclick = () => this.quitToMenu();
    $("btn-reroll").onclick = () => this.rerollCards();
    $("btn-skip").onclick = () => this.skipLevelUp();
    $("btn-shop-close").onclick = () => this.closeShop();

    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "Space" && !e.repeat && this.player) this.player.jumpBuf = 0.14;
      if (e.code === "Enter" && this.mode === "menu") this.startRun();
      if (e.code === "Escape") {
        if (this.mode === "run") this.setPaused(!this.paused);
        else if (this.mode === "paused") this.setPaused(false);
      }
      if (this.choosing) {
        if (e.code === "Digit1") this.pickCard(0);
        if (e.code === "Digit2") this.pickCard(1);
        if (e.code === "Digit3") this.pickCard(2);
        if (e.code === "KeyR") this.rerollCards();
        if (e.code === "KeyX") this.skipLevelUp();
      }
      if (e.code === "KeyE" && this.mode === "run" && !this.choosing && !this.shopping) {
        this.tryInteract();
      }
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    const view = $("view");
    view.addEventListener("click", () => {
      if (this.mode === "run" && !this.choosing && !this.shopping) view.requestPointerLock();
    });
    // Right-click never opens the browser menu or acts on overlays.
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    view.addEventListener("mousedown", (e) => {
      if (e.button === 2) this.mouseRight = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 2) this.mouseRight = false;
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointer.locked = document.pointerLockElement === view;
    });
    document.addEventListener("mousemove", (e) => {
      // Mouse always steers the camera in play, even if the browser refused pointer lock.
      if (!this.pointer.locked && !(this.mode === "run" && !this.choosing && !this.shopping)) return;
      this.camYaw -= e.movementX * 0.0022;
      this.camPitch = clamp(this.camPitch - e.movementY * 0.0016, 0.16, 0.85);
    });
    window.addEventListener("resize", () => this.resize());
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: $("view"),
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor(0xff9a58, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xffb080, 50, 150);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
    this.camYaw = 0.4;
    this.camPitch = 0.34;

    const hemi = new THREE.HemisphereLight(0xffe2b8, 0x1a3358, 0.5);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.35);
    sun.position.set(28, 38, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 6;
    sun.shadow.camera.far = 130;
    sun.shadow.camera.left = -SHADOW_HALF;
    sun.shadow.camera.right = SHADOW_HALF;
    sun.shadow.camera.top = SHADOW_HALF;
    sun.shadow.camera.bottom = -SHADOW_HALF;
    sun.shadow.bias = -0.0007;
    sun.shadow.normalBias = 0.045;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    const rim = new THREE.DirectionalLight(0x7aa8ff, 0.38);
    rim.position.set(-18, 12, -14);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0xfff1e0, 0.06));

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.34, 0.62, 0.72);
    this.composer.addPass(this.bloomPass);
    this.resize();
    this.initFxPool();
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  }

  buildStaticWorld() {
    if (this.worldRoot) {
      this.scene.remove(this.worldRoot);
      disposeTree(this.worldRoot);
    }
    rollMap();
    this.worldRoot = new THREE.Group();
    this.scene.add(this.worldRoot);
    const root = this.worldRoot;
    // Sky, sun and god rays ride along with the camera so the island can be bigger than the sky dome.
    this.skyRig = new THREE.Group();
    root.add(this.skyRig);
    this.world = new THREE.Group();
    root.add(this.world);
    this.obstacles = [];
    this.obstacleGrid = null;

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(160, 32, 20),
      new THREE.MeshBasicMaterial({ map: makeSkyTex(), side: THREE.BackSide, fog: false, depthWrite: false })
    );
    sky.rotation.y = 0.55;
    this.skyRig.add(sky);

    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff6d0, fog: false })
    );
    sunOrb.position.set(42, 32, 20);
    this.skyRig.add(sunOrb);
    const sunGlow = new THREE.Mesh(
      new THREE.SphereGeometry(11, 14, 10),
      new THREE.MeshBasicMaterial({
        color: 0xffaa55,
        transparent: true,
        opacity: 0.28,
        fog: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    sunGlow.position.copy(sunOrb.position);
    this.skyRig.add(sunGlow);

    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffd8a8,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.godRays = [];
    for (let i = 0; i < 5; i++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 36), rayMat);
      ray.position.set(22 + i * 3.2, 16, 10 - i * 2.4);
      ray.lookAt(0, 2, 0);
      this.skyRig.add(ray);
      this.godRays.push(ray);
    }

    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff8ee, transparent: true, opacity: 0.92, fog: false });
    for (let i = 0; i < Math.min(32, Math.round(16 * WS)); i++) {
      const puff = new THREE.Group();
      const n = 3 + ((Math.random() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rand(1.8, 3.1), 8, 6), cloudMat);
        s.position.set(rand(-2.6, 2.6), rand(-0.3, 0.5), rand(-1.3, 1.3));
        s.scale.y = 0.42;
        puff.add(s);
      }
      const a = rand(0, TAU);
      puff.position.set(Math.cos(a) * rand(20, 52) * WS, rand(12, 20), Math.sin(a) * rand(20, 52) * WS);
      this.clouds.add(puff);
    }
    root.add(this.clouds);

    this.waterTex = makeWaterTex();
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_RADIUS + 70, 64),
      new THREE.MeshPhongMaterial({
        map: this.waterTex,
        color: 0x2a86c8,
        specular: 0xaad8ff,
        shininess: 72,
        transparent: true,
        opacity: 0.94,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2.05;
    this.world.add(water);
    this.water = water;

    const hillMat = lambert(0x2f5c3a);
    const hillCount = Math.round(20 * WS);
    for (let i = 0; i < hillCount; i++) {
      const a = (i / hillCount) * TAU + rand(-0.08, 0.08);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(rand(7, 14), rand(5, 13), 6), hillMat);
      hill.position.set(Math.cos(a) * rand(ARENA_RADIUS + 30, ARENA_RADIUS + 48), -1.2, Math.sin(a) * rand(ARENA_RADIUS + 30, ARENA_RADIUS + 48));
      hill.rotation.y = a;
      root.add(hill);
    }

    const grassTex = makeGrassTex();
    grassTex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const ground = new THREE.Mesh(
      makeIslandGeometry(ARENA_RADIUS + 1.2, Math.round(48 * WS), Math.round(88 * WS)),
      lambert(0xffffff, { map: grassTex, vertexColors: true })
    );
    ground.receiveShadow = true;
    ground.castShadow = true;
    this.world.add(ground);
    this.terrainMap = makeTerrainMap(256);

    const foam = new THREE.Mesh(
      new THREE.RingGeometry(ARENA_RADIUS + 3.2, ARENA_RADIUS + 6.8, Math.round(64 * WS)),
      new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.55 })
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = -1.92;
    this.world.add(foam);
    this.foam = foam;

    const cliffGeo = new THREE.CylinderGeometry(ARENA_RADIUS + 2.0, ARENA_RADIUS + 6.2, 7.4, Math.round(64 * WS), 6, true);
    const cpos = cliffGeo.attributes.position;
    for (let i = 0; i < cpos.count; i++) {
      const x = cpos.getX(i);
      const z = cpos.getZ(i);
      const a = Math.atan2(z, x);
      const wob = 1 + Math.sin(a * 6.0) * 0.05 + Math.sin(a * 13) * 0.022;
      cpos.setX(i, x * wob);
      cpos.setZ(i, z * wob);
    }
    cliffGeo.computeVertexNormals();
    const cliff = new THREE.Mesh(cliffGeo, lambert(0x8a6a42, { map: makeDirtTex() }));
    cliff.position.y = -3.1;
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    this.world.add(cliff);

    const dirtMat = lambert(0xd8c48a, { map: makeDirtTex() });
    const scalePts = (pts) => pts.map(([x, z]) => lay(x, z));
    addTrail(this.world, scalePts([[0, 0], [6, 5], [14, 8], [18, 12], [20, 14]]), dirtMat, 2.6);
    addTrail(this.world, scalePts([[0, 0], [8, -3], [16, -5], [22, -6]]), dirtMat, 2.3);
    addTrail(this.world, scalePts([[0, 0], [-7, 8], [-14, 13], [-18, 16]]), dirtMat, 2.2);
    addTrail(this.world, scalePts([[0, 0], [4, -10], [8, -18], [10, -26]]), dirtMat, 2.0);

    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 0.28, 10), lambert(0xb9a888));
    plaza.position.y = heightAt(0, 0) - 0.11;
    plaza.receiveShadow = true;
    plaza.castShadow = true;
    this.world.add(plaza);
    const plazaRing = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.12, 6, 24), toon(0x8a7a5a));
    plazaRing.rotation.x = Math.PI / 2;
    plazaRing.position.y = heightAt(0, 0) + 0.05;
    this.world.add(plazaRing);

    const pondWater = new THREE.Mesh(
      new THREE.CircleGeometry(POND.r - 0.35, 28),
      new THREE.MeshLambertMaterial({
        map: this.waterTex,
        color: 0x2a7aaa,
        transparent: true,
        opacity: 0.88,
      })
    );
    pondWater.rotation.x = -Math.PI / 2;
    pondWater.position.set(POND.x, heightAt(POND.x, POND.z) + 1.35, POND.z);
    this.world.add(pondWater);
    this.obstacles.push({ x: POND.x, z: POND.z, r: POND.r - 0.9 });

    const reedMat = toon(0x3d7a44);
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU);
      const d = POND.r - 0.4 + rand(-0.4, 0.8);
      const x = POND.x + Math.cos(a) * d;
      const z = POND.z + Math.sin(a) * d;
      const reed = new THREE.Mesh(new THREE.ConeGeometry(0.07, rand(0.7, 1.3), 4), reedMat);
      reed.position.set(x, heightAt(x, z) + 0.45, z);
      this.world.add(reed);
    }

    const stoneMat = toon(0x8d8678);
    const darkStone = toon(0x6e675c);
    const dummy0 = new THREE.Object3D();
    for (let i = 0; i < 18; i++) {
      const a = rand(-0.9, 0.9) + Math.atan2(RIDGE.z, RIDGE.x);
      const d = rand(2, 11);
      const x = RIDGE.x + Math.cos(a) * d;
      const z = RIDGE.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > ARENA_RADIUS - 4) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.7, 1.5), 0), stoneMat);
      rock.position.set(x, heightAt(x, z) + 0.55, z);
      rock.rotation.set(rand(0, 1), rand(0, TAU), rand(0, 1));
      rock.scale.set(rand(0.8, 1.6), rand(0.7, 1.8), rand(0.8, 1.5));
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.world.add(rock);
      this.obstacles.push({ x, z, r: 0.7 * rock.scale.x });
    }

    const towerY = heightAt(MESA.x, MESA.z);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.45, 4.6, 8), darkStone);
    tower.position.set(MESA.x, towerY + 2.3, MESA.z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.world.add(tower);
    const battlement = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.15, 0.55, 8), stoneMat);
    battlement.position.set(MESA.x, towerY + 4.7, MESA.z);
    battlement.castShadow = true;
    this.world.add(battlement);
    const ruinBit = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.4, 0.4), stoneMat);
    ruinBit.position.set(MESA.x + 0.9, towerY + 5.3, MESA.z + 0.2);
    ruinBit.rotation.z = 0.45;
    ruinBit.castShadow = true;
    this.world.add(ruinBit);
    this.obstacles.push({ x: MESA.x, z: MESA.z, r: 1.9 });

    const [archX, archZ] = lay(4, -18);
    const archY = heightAt(archX, archZ);
    const ax = LAYOUT.cos * 1.5;
    const az = LAYOUT.sin * 1.5;
    const pillarGeo = new THREE.BoxGeometry(0.7, 3.2, 0.7);
    const pL = new THREE.Mesh(pillarGeo, stoneMat);
    const pR = new THREE.Mesh(pillarGeo, stoneMat);
    pL.position.set(archX - ax, archY + 1.6, archZ - az);
    pR.position.set(archX + ax, archY + 1.6, archZ + az);
    pL.rotation.y = pR.rotation.y = -LAYOUT.ang;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.55, 0.85), darkStone);
    lintel.position.set(archX, archY + 3.35, archZ);
    lintel.rotation.y = -LAYOUT.ang;
    pL.castShadow = pR.castShadow = lintel.castShadow = true;
    this.world.add(pL, pR, lintel);
    this.obstacles.push({ x: archX - ax, z: archZ - az, r: 0.7 }, { x: archX + ax, z: archZ + az, r: 0.7 });

    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.4;
      const x = CRATER.x + Math.cos(a) * 4.2;
      const z = CRATER.z + Math.sin(a) * 4.2;
      const menhir = new THREE.Mesh(new THREE.BoxGeometry(0.7, rand(2.2, 3.4), 0.45), darkStone);
      menhir.position.set(x, heightAt(x, z) + 1.4, z);
      menhir.rotation.y = a;
      menhir.castShadow = true;
      this.world.add(menhir);
      this.obstacles.push({ x, z, r: 0.65 });
    }

    const [lx, lz] = lay(-12, 6);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 4.4, 7), toon(0x6a4428));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.5 - LAYOUT.ang;
    log.position.set(lx, heightAt(lx, lz) + 0.32, lz);
    log.castShadow = true;
    this.world.add(log);

    const streamMat = new THREE.MeshPhongMaterial({
      color: 0x4eb4e0,
      transparent: true,
      opacity: 0.72,
      shininess: 60,
    });
    addTrail(this.world, scalePts([[-14, 12], [-6, 8], [4, 4], [14, 0], [22, -4]]), streamMat, 0.85, 0.07);
    for (const v of VALLEYS) addTrail(this.world, v.pts, streamMat, 1.6, 0.07);

    // Summits: find each peak's top, mark it with a cairn, scatter boulders over the flanks.
    const boulderM = [];
    const cairnM = [];
    for (const o of MOUNTAINS) {
      let top = { x: o.x, z: o.z, y: heightAt(o.x, o.z) };
      for (let k = 0; k < 60; k++) {
        const x = o.x + rand(-6, 6);
        const z = o.z + rand(-6, 6);
        const y = heightAt(x, z);
        if (y > top.y) top = { x, z, y };
      }
      o.top = top;
      for (let s = 0; s < 3; s++) {
        const cs = 0.8 - s * 0.2;
        dummy0.position.set(top.x + 1.8, top.y + 0.4 + s * 0.62, top.z + 1.4);
        dummy0.rotation.set(rand(0, 1), rand(0, TAU), 0);
        dummy0.scale.setScalar(cs);
        dummy0.updateMatrix();
        cairnM.push(dummy0.matrix.clone());
      }
      for (let i = 0; i < 14; i++) {
        const a = rand(0, TAU);
        const d = rand(4, o.r * 0.85);
        const x = o.x + Math.cos(a) * d;
        const z = o.z + Math.sin(a) * d;
        if (Math.hypot(x, z) > ARENA_RADIUS - 6) continue;
        const sx = rand(1.1, 2.2);
        dummy0.position.set(x, heightAt(x, z) + 0.35 * sx, z);
        dummy0.rotation.set(rand(0, 1), rand(0, TAU), rand(0, 1));
        dummy0.scale.set(sx, rand(0.8, 1.6), sx);
        dummy0.updateMatrix();
        boulderM.push(dummy0.matrix.clone());
        this.obstacles.push({ x, z, r: 0.7 * sx });
      }
    }
    const boulderGeo = new THREE.DodecahedronGeometry(0.7, 0);
    this.world.add(makeInstanced(boulderGeo, darkStone, boulderM, true, true));
    this.world.add(makeInstanced(boulderGeo, stoneMat, cairnM, true, false));

    for (let i = 0; i < 5; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.55), toon(0x8a6238));
      const [px, pz] = lay(-1 / WS + (i * 0.15) / WS, 40 + (i * 0.55) / WS);
      plank.position.set(px, heightAt(px, pz) + 0.2, pz);
      plank.rotation.y = 0.08 - LAYOUT.ang;
      this.world.add(plank);
    }

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 2.2, 7);
    const leafGeo = new THREE.IcosahedronGeometry(1.08, 0);
    const trunkMat = toon(0x6a4428);
    const leafMats = [0x2f9a44, 0x247a3a, 0x48b85a, 0x1f6b32].map((c) => toon(c));
    // Props are instanced: the large island holds hundreds of each, one draw call per material.
    const dummy = new THREE.Object3D();
    const place = (list, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rx, ry, rz);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      list.push(dummy.matrix.clone());
    };
    const trunkM = [];
    const leafM = leafMats.map(() => []);
    const pineM = [];
    const plantTree = (x, z, extraScale = 1) => {
      if (inPond(x, z) || Math.hypot(x, z) < 8) return;
      const y = heightAt(x, z);
      if (y > 10 || slopeAt(x, z) > 0.9) return;
      place(trunkM, x, y + 1.1, z, 1);
      if (y > 4.5) {
        place(pineM, x, y + 2.6 * extraScale, z, extraScale * rand(0.9, 1.2), undefined, undefined, 0, rand(0, TAU));
        place(pineM, x, y + 3.6 * extraScale, z, extraScale * rand(0.6, 0.8), undefined, undefined, 0, rand(0, TAU));
        this.obstacles.push({ x, z, r: 0.85 * extraScale });
        return;
      }
      const li = (Math.random() * leafMats.length) | 0;
      place(leafM[li], x, y + 2.45, z, rand(1.0, 1.4) * extraScale);
      place(leafM[li], x + rand(-0.5, 0.5), y + 2.85, z + rand(-0.4, 0.4), rand(0.58, 0.9) * extraScale);
      place(leafM[(Math.random() * leafMats.length) | 0], x + rand(-0.35, 0.35), y + 2.15, z + rand(-0.35, 0.35), rand(0.45, 0.7) * extraScale);
      this.obstacles.push({ x, z, r: 0.85 * extraScale });
    };
    for (let i = 0; i < Math.round(55 * AREA); i++) {
      const a = rand(0, TAU);
      const d = Math.max(9, Math.sqrt(Math.random()) * (ARENA_RADIUS - 5));
      plantTree(Math.cos(a) * d, Math.sin(a) * d);
    }
    for (let i = 0; i < 22; i++) {
      const a = rand(0, TAU);
      const d = rand(0, 7);
      plantTree(KNOLL.x + Math.cos(a) * d, KNOLL.z + Math.sin(a) * d, 1.15);
    }
    // Forest groves scattered over the island.
    for (const [gx, gz] of scatterSpots(Math.round(ARENA_RADIUS * 0.16), 24, 20)) {
      const gr = rand(5, 12);
      const n = 8 + ((Math.random() * 16) | 0);
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU);
        const d = Math.sqrt(Math.random()) * gr;
        plantTree(gx + Math.cos(a) * d, gz + Math.sin(a) * d, rand(0.9, 1.25));
      }
    }
    // Pine woods on the mountain shoulders.
    for (const o of MOUNTAINS) {
      for (let i = 0; i < 26; i++) {
        const a = rand(0, TAU);
        const d = rand(o.r * 0.3, o.r * 0.95);
        plantTree(o.x + Math.cos(a) * d, o.z + Math.sin(a) * d, rand(0.95, 1.25));
      }
    }
    // Woods along the valley floors.
    for (const v of VALLEYS) {
      for (let i = 0; i < 30; i++) {
        const seg = (Math.random() * (v.pts.length - 1)) | 0;
        const t = Math.random();
        const x = lerp(v.pts[seg][0], v.pts[seg + 1][0], t) + rand(-1, 1) * v.w * 1.3;
        const z = lerp(v.pts[seg][1], v.pts[seg + 1][1], t) + rand(-1, 1) * v.w * 1.3;
        if (distToPolyline(x, z, v.pts) < 2.4) continue;
        plantTree(x, z, rand(0.95, 1.25));
      }
    }
    this.world.add(makeInstanced(trunkGeo, trunkMat, trunkM, true, true));
    this.world.add(makeInstanced(new THREE.ConeGeometry(1.2, 2.6, 7), toon(0x2a6a3c), pineM, true, true));
    leafMats.forEach((m, i) => this.world.add(makeInstanced(leafGeo, m, leafM[i], true, true)));

    const rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
    const rockM = [];
    for (let i = 0; i < Math.round(22 * AREA); i++) {
      const a = rand(0, TAU);
      const d = rand(10, ARENA_RADIUS - 3);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (inPond(x, z)) continue;
      const sx = rand(0.6, 1.45);
      place(rockM, x, heightAt(x, z) + 0.28, z, sx, rand(0.45, 1.1), rand(0.6, 1.45), rand(0, 1), rand(0, TAU), rand(0, 1));
      this.obstacles.push({ x, z, r: 0.7 * sx });
    }
    this.world.add(makeInstanced(rockGeo, stoneMat, rockM, true, true));

    const ruinMat = toon(0xb9a27a);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.55;
      const d = 15 * WS;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const y = heightAt(x, z);
      const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.7), ruinMat);
      block.position.set(x, y + 0.8, z);
      block.rotation.y = a;
      block.castShadow = true;
      block.receiveShadow = true;
      this.world.add(block);
      this.obstacles.push({ x, z, r: 1.1 });
    }

    const bushMat = toon(0x2e8a3c);
    const bushGeo = new THREE.IcosahedronGeometry(0.52, 0);
    const bushM = [];
    for (let i = 0; i < Math.round(48 * AREA); i++) {
      const a = rand(0, TAU);
      const d = rand(8, ARENA_RADIUS - 5);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (inPond(x, z) || heightAt(x, z) > 10) continue;
      place(bushM, x, heightAt(x, z) + 0.32, z, rand(0.8, 1.5), rand(0.5, 0.95), rand(0.8, 1.5));
    }
    this.world.add(makeInstanced(bushGeo, bushMat, bushM, true, false));

    const shroomCap = toon(0xe24b4b);
    const shroomStem = toon(0xf5f0d8);
    const stemM = [];
    const capM = [];
    for (let i = 0; i < Math.round(28 * AREA * 0.75); i++) {
      const a = rand(0, TAU);
      const d = rand(6, ARENA_RADIUS - 8);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (inPond(x, z)) continue;
      const y = heightAt(x, z);
      if (y > 10) continue;
      place(stemM, x, y + 0.2, z, 1);
      place(capM, x, y + 0.44, z, 1);
    }
    this.world.add(makeInstanced(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 6), shroomStem, stemM, false, false));
    this.world.add(makeInstanced(new THREE.SphereGeometry(0.24, 8, 6, 0, TAU, 0, 1.4), shroomCap, capM, false, false));

    const tuftGeo = new THREE.ConeGeometry(0.11, 0.4, 4);
    const tuftMat = toon(0x3d9a4a);
    const tuftMax = Math.round(380 * AREA);
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftMax);
    tufts.castShadow = true;
    let placed = 0;
    for (let i = 0; i < tuftMax * 1.4 && placed < tuftMax; i++) {
      const a = rand(0, TAU);
      const d = rand(7.2, ARENA_RADIUS - 6);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (inPond(x, z) || heightAt(x, z) > 11) continue;
      dummy.position.set(x, heightAt(x, z) + 0.18, z);
      dummy.rotation.set(rand(-0.18, 0.18), rand(0, TAU), rand(-0.18, 0.18));
      dummy.scale.setScalar(rand(0.7, 1.7));
      dummy.updateMatrix();
      tufts.setMatrixAt(placed++, dummy.matrix);
    }
    tufts.count = placed;
    tufts.computeBoundingSphere();
    this.world.add(tufts);

    const moteGeo = new THREE.SphereGeometry(0.055, 6, 4);
    const moteMat = new THREE.MeshBasicMaterial({
      color: 0xffe08a,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.motes = [];
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(moteGeo, moteMat);
      const ox = rand(-MOTE_BOX / 2, MOTE_BOX / 2);
      const oz = rand(-MOTE_BOX / 2, MOTE_BOX / 2);
      const oy = rand(0.45, 3.6);
      m.position.set(ox, oy + heightAt(ox, oz), oz);
      root.add(m);
      this.motes.push({ mesh: m, ox, oy, oz, ph: rand(0, TAU) });
    }
  }

  makeHeroMesh(hero) {
    const g = new THREE.Group();
    const inst = this.kit?.spawnHero(hero.id);
    if (inst) {
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.78, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.03;
      g.add(shadow);
      g.add(inst.model);
      const held = new THREE.Group();
      if (inst.hand) inst.hand.add(held);
      else {
        held.position.set(0.42, 1.08, 0.22);
        g.add(held);
      }
      g.userData.held = held;
      g.userData.body = inst.model;
      g.userData.mixer = inst.mixer;
      g.userData.idle = inst.idle;
      g.userData.walk = inst.walk;
      g.userData.attack = inst.attack;
      g.userData.mats = inst.mats;
      g.userData.mat = inst.mats[0];
      g.userData.kit = true;
      g.userData.moveW = 0;
      return g;
    }
    const bodyMat = toon(hero.color);
    const accent = toon(hero.accent);
    const dark = toon(0x1a1612);
    const white = toon(0xfff8ee);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.78, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    g.add(shadow);

    const bodyGeo = new THREE.CapsuleGeometry(0.4, 0.72, 4, 10);
    const headGeo = new THREE.SphereGeometry(0.36, 12, 10);
    g.add(hull(bodyGeo, 0.88, 1.14));
    g.add(hull(headGeo, 1.58, 1.16));
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.88;
    g.add(body);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.y = 1.58;
    g.add(head);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), accent);
    snout.position.set(0, 1.48, 0.3);
    g.add(snout);
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), white);
    const eyeW2 = eyeW.clone();
    eyeW.position.set(-0.13, 1.62, 0.28);
    eyeW2.position.set(0.13, 1.62, 0.28);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), dark);
    const pupil2 = pupil.clone();
    pupil.position.set(-0.13, 1.63, 0.355);
    pupil2.position.set(0.13, 1.63, 0.355);
    g.add(eyeW, eyeW2, pupil, pupil2);

    const armGeo = new THREE.CapsuleGeometry(0.1, 0.32, 3, 6);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    const armR = armL.clone();
    armL.position.set(-0.48, 1.05, 0.05);
    armL.rotation.z = 0.4;
    armR.position.set(0.48, 1.05, 0.05);
    armR.rotation.z = -0.4;
    g.add(armL, armR);

    const legGeo = new THREE.CapsuleGeometry(0.12, 0.28, 3, 6);
    const legL = new THREE.Mesh(legGeo, bodyMat);
    const legR = legL.clone();
    legL.position.set(-0.16, 0.34, 0);
    legR.position.set(0.16, 0.34, 0);
    g.add(legL, legR);

    if (hero.id === "rook") {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 6), bodyMat);
      const ear2 = ear.clone();
      ear.position.set(-0.16, 1.94, -0.02);
      ear2.position.set(0.16, 1.94, -0.02);
      g.add(ear, ear2);
    } else if (hero.id === "nyla") {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), bodyMat);
      const ear2 = ear.clone();
      ear.position.set(-0.14, 2.02, -0.02);
      ear2.position.set(0.14, 2.02, -0.02);
      g.add(ear, ear2);
    } else if (hero.id === "kett") {
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.4, 0.18, 8), accent);
      hat.position.y = 1.92;
      g.add(hat);
    } else if (hero.id === "vex") {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), accent);
      const horn2 = horn.clone();
      horn.position.set(-0.14, 1.92, -0.04);
      horn.rotation.z = 0.35;
      horn2.position.set(0.14, 1.92, -0.04);
      horn2.rotation.z = -0.35;
      g.add(horn, horn2);
    } else {
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.44, 8, 6), accent);
      belly.position.set(0, 0.72, 0.12);
      belly.scale.set(1, 0.8, 0.85);
      g.add(belly);
    }

    const held = new THREE.Group();
    held.position.set(0.48, 1.08, 0.18);
    g.add(held);
    setShadow(g, true, false);
    g.userData.held = held;
    g.userData.body = body;
    g.userData.head = head;
    g.userData.armL = armL;
    g.userData.armR = armR;
    g.userData.legL = legL;
    g.userData.legR = legR;
    g.userData.mat = bodyMat;
    return g;
  }

  makeEnemyMesh(kind, color, scale, boss = false) {
    const g = new THREE.Group();
    const inst = this.kit?.spawnEnemy(kind, boss);
    if (inst) {
      inst.model.scale.multiplyScalar(scale);
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.55 * scale, 10),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.02;
      g.add(shadow);
      g.add(inst.model);
      g.userData.body = inst.model;
      g.userData.mixer = inst.mixer;
      g.userData.idle = inst.idle;
      g.userData.walk = inst.walk;
      g.userData.attack = inst.attack;
      g.userData.mats = inst.mats;
      g.userData.mat = inst.mats[0] || toon(color);
      g.userData.kit = true;
      g.userData.moveW = 0;
      return g;
    }
    const mat = toon(color);
    const dark = toon(0x1a1814);
    const white = toon(0xfff8ee);
    const bodyGeo = new THREE.IcosahedronGeometry(0.55, 0);
    g.add(hull(bodyGeo, 0.55, 1.14));
    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.55;
    g.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), white);
    const eye2 = eye.clone();
    eye.position.set(-0.16, 0.72, 0.36);
    eye2.position.set(0.16, 0.72, 0.36);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), dark);
    const p2 = p.clone();
    p.position.set(-0.16, 0.73, 0.44);
    p2.position.set(0.16, 0.73, 0.44);
    g.add(eye, eye2, p, p2);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 10),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    g.scale.setScalar(scale);
    if (scale >= 1.25) setShadow(g, true, false);
    g.userData.body = body;
    g.userData.mat = mat;
    return g;
  }

  refreshMenu() {
    $("title-ar").style.display = this.lang === "ar" ? "block" : "none";
    $("title-en").style.display = this.lang === "en" ? "block" : "none";
    $("tagline").textContent = this.t("اضرب. اجمع. صِرْ وحشاً.", "Smash. Loot. Get stupid strong.");
    $("btn-start").textContent = this.t("ابدأ الجولة", "Start Run");
    $("btn-how").textContent = this.t("كيف تلعب", "How to play");
    $("btn-lang").textContent = this.lang === "ar" ? "EN" : "عربي";
    $("how-text").innerHTML = this.t(
      `<p>حرّك بـ <b>WASD</b> • الكاميرا بالماوس • <b>Shift</b> اندفاع • <b>مسافة</b> قفز</p>
       <p>أسلحتك تضرب وحدها. اضغط <b>F</b> أو زر الفأرة الأيمن لشحن ضربة قوية.</p>
       <p>قرب المزارات والصناديق واضغط <b>E</b>. عند الترقية: <b>R</b> إعادة سحب (ذهب) • <b>X</b> تخطي بشفاء.</p>
       <p>عِش <b>8 دقائق</b>. الوحوش تكبر، وأنت أيضاً.</p>`,
      `<p>Move with <b>WASD</b> • Mouse look • <b>Shift</b> dash • <b>Space</b> jump</p>
       <p>Weapons attack on their own. Hold <b>F</b> or right-click to charge a smash.</p>
       <p>Walk up to shrines and press <b>E</b>. On level-up: <b>R</b> reroll (gold) • <b>X</b> skip+heal.</p>
       <p>Survive <b>8 minutes</b>. The horde scales. So do you.</p>`
    );
    $("btn-quests").textContent = this.t("المهام", "Quests");
    this.refreshQuests();
    $("best-line").textContent = this.t(
      `أفضل وقت: ${this.fmtTime(this.save.bestTime)} • أفضل قتل: ${this.save.bestKills} • جولات: ${this.save.runs}`,
      `Best time: ${this.fmtTime(this.save.bestTime)} • Best kills: ${this.save.bestKills} • Runs: ${this.save.runs}`
    );
    const box = this.els.heroes;
    box.innerHTML = "";
    for (const h of CHARACTERS) {
      const unlocked = h.unlocked || this.save.unlocks[h.id];
      const card = document.createElement("button");
      card.className = "hero-card" + (this.selectedHero === h.id ? " selected" : "") + (unlocked ? "" : " locked");
      card.innerHTML = `
        <div class="hero-swatch" style="background:${"#" + h.color.toString(16).padStart(6, "0")}"></div>
        <div class="hero-name">${this.t(h.name, h.nameEn)}</div>
        <div class="hero-title">${this.t(h.title, h.titleEn)}</div>
        <div class="hero-desc">${unlocked ? this.t(h.desc, h.descEn) : this.t(h.unlock.label, h.unlock.labelEn)}</div>`;
      card.onclick = () => {
        if (!unlocked) return;
        this.selectedHero = h.id;
        this.refreshMenu();
      };
      box.appendChild(card);
    }
  }

  refreshQuests() {
    const lines = QUESTS.map((q) => {
      let done = false;
      if (q.hero) done = !!this.save.unlocks[q.hero];
      else done = !!this.save.quests?.[q.id];
      const mark = done ? "✔" : "○";
      return `<p>${mark} ${this.t(q.label, q.labelEn)}</p>`;
    });
    $("quests-text").innerHTML = lines.join("");
  }

  fmtTime(s) {
    s = Math.max(0, s | 0);
    const m = (s / 60) | 0;
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  async startRun() {
    this.sfx.resume();
    if (this.kit && !this.kit.loaded) {
      this.toast(this.t("الموديلات تتحمل...", "Loading models..."));
      await this.kit.ready;
    }
    const hero = CHARACTERS.find((h) => h.id === this.selectedHero) || CHARACTERS[0];
    if (!(hero.unlocked || this.save.unlocks[hero.id])) return;

    if (this.mapUsed) this.buildStaticWorld();
    this.mapUsed = true;
    this.clearRunActors();
    this.hero = hero;
    this.mode = "run";
    this.paused = false;
    this.choosing = false;
    this.levelQueue = 0;
    this.time = 0;
    this.kills = 0;
    this.gold = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = 16;
    this.hp = hero.hp;
    this.stats = {
      damage: 1,
      speed: 1,
      cooldown: 0,
      area: 1,
      projectiles: 0,
      luck: 1,
      lifesteal: 0,
      magnet: 4.6,
      maxHp: hero.hp,
      regen: 0.2,
      xpGain: 1,
      knockback: 1,
      crit: 0.06,
      critDmg: 2,
      dash: 1,
      armor: 0,
      duration: 1,
      goldFind: 1,
      curse: 0,
    };
    if (hero.passive) {
      for (const [k, v] of Object.entries(hero.passive)) {
        if (k === "gold") this.stats.goldFind += v;
        else if (k === "armor" || k === "magnet" || k === "regen") this.stats[k] = (this.stats[k] || 0) + v;
        else if (k === "cooldown") this.stats.cooldown += v;
        else this.stats[k] = (this.stats[k] || 0) + v;
      }
    }
    this.player = {
      x: 0,
      y: heightAt(0, 0),
      z: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      yaw: 0,
      grounded: true,
      dashCd: 0,
      dashT: 0,
      dashDx: 0,
      dashDz: 0,
      airDash: 1,
      airJumps: 1,
      coyote: 0,
      jumpBuf: 0,
      jumpHeld: false,
      land: 0,
      visYaw: 0,
      iframes: 1.6,
      hurtFlash: 0,
      radius: 0.48,
    };
    this.loadout = [{ id: hero.startWeapon, level: 1, cd: 0.2, evolved: false }];
    this.tomesOwned = [];
    this.banished = new Set();
    this.rerolls = 0;
    this.chestsOpened = 0;
    this.chargeKills = 0;
    this.bossKills = 0;
    this.shopping = false;
    this.charge = 0;
    this.charging = false;
    this.buffs = { overcharge: 0, freeze: 0, tempArmor: 0, haste: 0 };
    this.nearInteract = null;
    this.enemies = [];
    this.enemyPool = [];
    this.projectiles = [];
    this.gems = [];
    this.pickups = [];
    this.chests = [];
    this.fx = [];
    this.spit = [];
    this.shrines = [];
    this.shopKeep = null;
    this.spawnAcc = 0.2;
    this.chestAcc = 12;
    this.nextBoss = 0;
    this.killBannerT = 0;
    this.orbitPhase = 0;
    this.slashT = 0;
    this.nukeT = 0;

    if (!this.playerMesh) {
      this.playerMesh = this.makeHeroMesh(hero);
      this.scene.add(this.playerMesh);
    } else {
      this.scene.remove(this.playerMesh);
      this.playerMesh = this.makeHeroMesh(hero);
      this.scene.add(this.playerMesh);
    }
    this.rebuildHeldWeapon();
    this.buildOrbitMeshes();
    this.buildSlashMesh();
    this.buildAuraMesh();
    this.spawnWorldShrines();
    this.spawnWorldChests();
    for (let i = 0; i < 12; i++) this.spawnEnemy(i < 4 ? "runner" : "grunt");

    this.els.menu.classList.remove("show");
    this.els.end.classList.remove("show");
    this.els.pause.classList.remove("show");
    this.els.levelup.classList.remove("show");
    this.els.shop?.classList.remove("show");
    this.els.hud.classList.add("show");
    this.els.hint.textContent = this.t("اضغط للعب • WASD حركة", "Click to play • WASD move");
    setTimeout(() => {
      if (this.mode === "run") this.els.hint.textContent = "";
    }, 3500);
    $("view").requestPointerLock?.();
    this.clock.getDelta();
    this.toast(this.t(`انطلق يا ${hero.name}!`, `Go, ${hero.nameEn}!`));
  }

  clearRunActors() {
    const dump = (arr, key = "mesh") => {
      if (!arr) return;
      for (const o of arr) {
        const m = o[key] || o.mesh;
        if (m && m.parent) m.parent.remove(m);
      }
    };
    dump(this.enemies);
    dump(this.projectiles);
    dump(this.gems);
    dump(this.pickups);
    dump(this.chests);
    dump(this.fx);
    dump(this.spit);
    dump(this.shrines);
    if (this.shopKeep?.mesh?.parent) this.shopKeep.mesh.parent.remove(this.shopKeep.mesh);
    this.shopKeep = null;
    if (this.orbitGroup && this.orbitGroup.parent) this.orbitGroup.parent.remove(this.orbitGroup);
    if (this.slashGroup && this.slashGroup.parent) this.slashGroup.parent.remove(this.slashGroup);
    if (this.auraMesh && this.auraMesh.parent) this.auraMesh.parent.remove(this.auraMesh);
  }

  rebuildHeldWeapon() {
    const held = this.playerMesh.userData.held;
    held.clear();
    const id = this.loadout[0]?.id || "blade";
    if (id === "hammer") {
      const h = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.28, 0.9),
        new THREE.MeshLambertMaterial({ color: 0x888078 })
      );
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.45, 0.45),
        new THREE.MeshLambertMaterial({ color: 0xcaa56a })
      );
      head.position.z = 0.5;
      held.add(h, head);
    } else {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.08, 1.45),
        new THREE.MeshLambertMaterial({ color: 0xf4f7ff, emissive: 0x8899aa, emissiveIntensity: 0.15 })
      );
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.12, 0.12),
        new THREE.MeshLambertMaterial({ color: 0xd4a017 })
      );
      blade.position.z = 0.55;
      held.add(blade, guard);
      held.scale.setScalar(1.15);
    }
  }

  buildOrbitMeshes() {
    this.orbitGroup = new THREE.Group();
    this.scene.add(this.orbitGroup);
    this.orbitBalls = [];
    const geo = new THREE.SphereGeometry(0.28, 8, 6);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshLambertMaterial({ color: 0xffe066, emissive: 0xaa7700, emissiveIntensity: 0.4 });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      this.orbitGroup.add(m);
      this.orbitBalls.push(m);
    }
  }

  buildSlashMesh() {
    this.slashGroup = new THREE.Group();
    this.slashMesh = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 3.4, 18, 1, -0.85, 1.7),
      new THREE.MeshBasicMaterial({
        color: 0xfff6c0,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.slashMesh.rotation.x = -Math.PI / 2;
    this.slashGroup.add(this.slashMesh);
    this.scene.add(this.slashGroup);
  }

  buildAuraMesh() {
    this.auraMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 1.1, 24),
      new THREE.MeshBasicMaterial({
        color: 0x7ad0ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.auraMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.auraMesh);
    this.auraPulse = { active: false, r: 0, max: 4, hit: new Set() };
  }

  quitToMenu() {
    this.mode = "menu";
    this.paused = false;
    this.choosing = false;
    document.exitPointerLock?.();
    this.els.hud.classList.remove("show");
    this.els.pause.classList.remove("show");
    this.els.levelup.classList.remove("show");
    this.els.end.classList.remove("show");
    this.els.shop?.classList.remove("show");
    this.els.menu.classList.add("show");
    this.refreshMenu();
  }

  setPaused(v) {
    if (this.mode !== "run" && this.mode !== "paused") return;
    if (this.choosing || this.shopping) return;
    this.paused = v;
    this.mode = v ? "paused" : "run";
    this.els.pause.classList.toggle("show", v);
    $("pause-title").textContent = this.t("إيقاف", "Paused");
    $("btn-resume").textContent = this.t("متابعة", "Resume");
    $("btn-quit").textContent = this.t("القائمة", "Menu");
    if (v) {
      document.exitPointerLock?.();
      this.renderPauseBuild();
    } else $("view").requestPointerLock?.();
  }

  renderPauseBuild() {
    const weps = this.loadout
      .map((w) => {
        const d = WEAPONS[w.id];
        const n = w.evolved ? this.t(d.evoName, d.evoNameEn) : this.t(d.name, d.nameEn);
        return `${d.icon} ${n} Lv${w.level}`;
      })
      .join("<br>");
    const tomes = this.tomesOwned.length
      ? this.tomesOwned.map((id) => {
          const t = TOMES.find((x) => x.id === id);
          return t ? `${t.icon} ${this.t(t.name, t.nameEn)}` : id;
        }).join("<br>")
      : this.t("لا كتب بعد", "No tomes yet");
    $("pause-build").innerHTML = `<b>${this.t("الأسلحة", "Weapons")}</b><br>${weps}<br><br><b>${this.t("الكتب", "Tomes")}</b><br>${tomes}`;
  }

  tickBuffs(dt) {
    for (const k of Object.keys(this.buffs)) {
      if (this.buffs[k] > 0) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    }
  }

  updateCharge(dt) {
    const hold = this.keys.has("KeyF") || this.mouseRight;
    const rate = 1.45 * (this.hero.chargeRate || 1);
    if (hold) {
      this.charging = true;
      this.charge = Math.min(1, this.charge + dt * rate);
      this.sfx.chargeHum(this.charge);
    } else if (this.charging) {
      if (this.charge > 0.22) this.releaseCharge();
      this.charging = false;
      this.charge = 0;
      this.sfx.chargeHum(0);
    } else {
      this.charge = Math.max(0, this.charge - dt * 2);
      this.sfx.chargeHum(0);
    }
  }

  releaseCharge() {
    const p = this.player;
    const power = this.charge;
    const precise = power >= 0.84;
    const dmg = (28 + this.level * 1.4) * this.stats.damage * (0.7 + power * 2.4) * (precise ? this.stats.critDmg : 1);
    const range = 3.2 * this.stats.area * (1 + power * 1.1);
    this.slashT = 0.22;
    this.slashGroup.position.set(p.x, 0.18 + p.y, p.z);
    this.slashGroup.rotation.y = p.yaw;
    this.shake = Math.max(this.shake, 0.18 + power * 0.35);
    this.sfx.bonk();
    if (precise) this.sfx.crit();
    const before = this.kills;
    this.hitCone(p.x, p.z, p.yaw, range, 1.7, dmg, 7 + power * 6);
    this.hitCircle(p.x, p.z, range * 0.55, dmg * 0.55, 5, "charge", 0.05);
    this.spawnBurst(p.x, p.y + 0.4, p.z, precise ? 0xffd24a : 0xfff1a8, 10 + Math.floor(power * 10));
    this.chargeKills += Math.max(0, this.kills - before);
    this.floatText(p.x, p.y + 2.2, p.z, precise ? "PREC" : "BONK", precise ? "#ffd24a" : "#fff8d0");
  }

  spawnWorldShrines() {
    // A shrine waits on top of most peaks: a reward for taking the high ground.
    const peakKinds = ["power", "greed", "combat", "magnet"];
    MOUNTAINS.forEach((o, i) => {
      if (o.top && i < 5) this.spawnShrine(peakKinds[i % peakKinds.length], o.top.x, o.top.z);
    });
    const kinds = ["combat", "greed", "magnet", "power", "moai"];
    kinds.forEach((id, i) => {
      const a = (i / kinds.length) * TAU + 0.3;
      const d = 18 * WS;
      this.spawnShrine(id, Math.cos(a) * d, Math.sin(a) * d);
    });
    const taken = this.shrines.map((s) => [s.x, s.z]);
    for (const [x, z] of scatterSpots(Math.round(ARENA_RADIUS / 12), 26, 20, taken)) this.spawnShrine(pick(kinds), x, z);
  }

  spawnWorldChests() {
    const taken = this.shrines.map((s) => [s.x, s.z]);
    for (const [x, z] of scatterSpots(Math.round(ARENA_RADIUS / 8), 18, 14, taken)) this.placeChest(x, z);
  }

  spawnShrine(id, x, z) {
    const def = SHRINES.find((s) => s.id === id) || SHRINES[0];
    [x, z] = this.resolvePos(x, z, 1.2);
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 0.35, 8),
      new THREE.MeshLambertMaterial({ color: 0x4a4034 })
    );
    base.position.y = 0.18;
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.6, 0.35),
      new THREE.MeshLambertMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.22 })
    );
    stone.position.y = 1.1;
    g.add(base, stone);
    g.position.set(x, heightAt(x, z), z);
    this.scene.add(g);
    this.shrines.push({ id, mesh: g, x, z, used: false });
  }

  spawnShop() {
    if (this.shopKeep) return;
    const a = rand(0, TAU);
    let x = this.player.x + Math.cos(a) * 12;
    let z = this.player.z + Math.sin(a) * 12;
    [x, z] = this.resolvePos(x, z, 1.2);
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 1.8, 8),
      new THREE.MeshLambertMaterial({ color: 0x9aa7b8, emissive: 0x334455, emissiveIntensity: 0.2 })
    );
    body.position.y = 0.9;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshLambertMaterial({ color: 0x111 }));
    eye.position.set(0.18, 1.45, 0.4);
    g.add(body, eye);
    g.position.set(x, heightAt(x, z), z);
    this.scene.add(g);
    this.shopKeep = { mesh: g, x, z };
    this.banner(this.t("المواي فتح دكانه!", "The Moai opened a shop!"));
  }

  nearestInteract() {
    const p = this.player;
    let best = null;
    let bestD = 2.2;
    for (const s of this.shrines) {
      if (s.used) continue;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = { type: "shrine", obj: s };
      }
    }
    if (this.shopKeep) {
      const d = Math.hypot(this.shopKeep.x - p.x, this.shopKeep.z - p.z);
      if (d < bestD) best = { type: "shop", obj: this.shopKeep };
    }
    return best;
  }

  updateInteractPrompt() {
    const n = this.nearestInteract();
    this.nearInteract = n;
    if (!n) {
      this.els.prompt.classList.remove("show");
      return;
    }
    const msg =
      n.type === "shop"
        ? this.t("E  تسوّق", "E  Shop")
        : this.t(`E  ${SHRINES.find((s) => s.id === n.obj.id)?.name || "مزار"}`, `E  ${SHRINES.find((s) => s.id === n.obj.id)?.nameEn || "Shrine"}`);
    this.els.prompt.textContent = msg;
    this.els.prompt.classList.add("show");
  }

  tryInteract() {
    const n = this.nearestInteract();
    if (!n) return;
    if (n.type === "shop") this.openShop();
    else this.activateShrine(n.obj);
  }

  activateShrine(s) {
    if (s.used) return;
    s.used = true;
    s.mesh.traverse((ch) => {
      if (ch.material) ch.material.emissiveIntensity = 0;
    });
    this.sfx.shrine();
    if (s.id === "combat") {
      for (let i = 0; i < 14; i++) this.spawnEnemy(i < 2 ? "elite" : i < 6 ? "tank" : "runner");
      this.applyTome(pick(TOMES), 1.55);
      this.banner(this.t("مزار القتال!", "Combat shrine!"));
    } else if (s.id === "greed") {
      this.gold += 22;
      this.hp = Math.max(1, this.hp - 16);
      this.toast(this.t("طمع: +22 ذهب", "Greed: +22 gold"));
    } else if (s.id === "magnet") {
      for (const g of this.gems) g.magnet = true;
      this.stats.magnet += 1.6;
      this.toast(this.t("سحب شامل!", "Full vacuum!"));
    } else if (s.id === "power") {
      this.buffs.overcharge = 14;
      this.toast(this.t("شحن زائد 14ث", "Overcharge 14s"));
    } else if (s.id === "moai") {
      this.applyTome(pick(TOMES), 1.25);
      this.gold += 6;
      this.toast(this.t("بركة المواي", "Moai blessing"));
    }
  }

  openShop() {
    this.shopping = true;
    this.paused = true;
    document.exitPointerLock?.();
    const stock = [
      { id: "heal", icon: "❤", name: "قلب", nameEn: "Heart", desc: "+40 صحة", descEn: "+40 HP", cost: 12 },
      { id: "wep", icon: "⚔", name: "سلاح عشوائي", nameEn: "Random weapon", desc: "يُضاف للحمل", descEn: "Added to loadout", cost: 24 },
      { id: "luck", icon: "🍀", name: "تميمة حظ", nameEn: "Luck charm", desc: "+20% حظ", descEn: "+20% luck", cost: 16 },
    ];
    this.shopStock = stock;
    $("shop-title").textContent = this.t("دكان المواي", "Moai Shop");
    $("shop-sub").textContent = this.t(`ذهبك: ${this.gold}  —  اضغط بطاقة للشراء`, `Gold: ${this.gold}  —  click a card to buy`);
    $("btn-shop-close").textContent = this.t("إغلاق", "Close");
    const box = $("shop-cards");
    box.innerHTML = "";
    stock.forEach((c, i) => {
      const el = document.createElement("button");
      el.className = "card rarity-uncommon";
      el.innerHTML = `<div class="card-icon">${c.icon}</div><div class="card-name">${this.t(c.name, c.nameEn)}</div><div class="card-desc">${this.t(c.desc, c.descEn)}</div><div class="card-rare">◆ ${c.cost}</div>`;
      el.onclick = () => this.buyShop(i);
      box.appendChild(el);
    });
    this.els.shop.classList.add("show");
  }

  buyShop(i) {
    const c = this.shopStock?.[i];
    if (!c) return;
    if (this.gold < c.cost) {
      this.toast(this.t("ذهب ناقص", "Not enough gold"));
      return;
    }
    this.gold -= c.cost;
    if (c.id === "heal") this.hp = Math.min(this.stats.maxHp, this.hp + 40);
    else if (c.id === "luck") this.stats.luck += 0.2;
    else if (c.id === "wep") {
      const owned = new Set(this.loadout.map((w) => w.id));
      const pool = Object.keys(WEAPONS).filter((id) => !owned.has(id));
      if (pool.length && this.loadout.length < 4) {
        this.loadout.push({ id: pick(pool), level: 1, cd: 0.05, evolved: false });
      } else if (this.loadout[0]) this.loadout[0].level += 1;
    }
    this.sfx.pickup();
    this.closeShop();
  }

  closeShop() {
    this.shopping = false;
    this.els.shop.classList.remove("show");
    if (this.mode === "run" || this.mode === "paused") {
      this.paused = false;
      this.mode = "run";
      $("view").requestPointerLock?.();
    }
  }

  buildObstacleGrid() {
    // Bucket obstacles by cell (padded by the largest entity radius) so lookups stay local.
    const grid = new Map();
    const pad = 2.5;
    for (const o of this.obstacles) {
      const reach = o.r + pad;
      const x0 = Math.floor((o.x - reach) / OBST_CELL);
      const x1 = Math.floor((o.x + reach) / OBST_CELL);
      const z0 = Math.floor((o.z - reach) / OBST_CELL);
      const z1 = Math.floor((o.z + reach) / OBST_CELL);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const k = gx * 4096 + gz;
          let cell = grid.get(k);
          if (!cell) grid.set(k, (cell = []));
          cell.push(o);
        }
      }
    }
    this.obstacleGrid = grid;
    this.obstacleGridSize = this.obstacles.length;
  }

  resolvePos(x, z, r) {
    if (!this.obstacleGrid || this.obstacleGridSize !== this.obstacles.length) this.buildObstacleGrid();
    const cell = this.obstacleGrid.get(Math.floor(x / OBST_CELL) * 4096 + Math.floor(z / OBST_CELL)) || [];
    for (const o of cell) {
      const dx = x - o.x;
      const dz = z - o.z;
      const d = Math.hypot(dx, dz);
      const min = r + o.r;
      if (d < min && d > 0.0001) {
        const k = (min - d) / d;
        x += dx * k;
        z += dz * k;
      }
    }
    const d = Math.hypot(x, z);
    const lim = ARENA_RADIUS - r - 0.4;
    if (d > lim) {
      x = (x / d) * lim;
      z = (z / d) * lim;
    }
    return [x, z];
  }

  updatePlayer(dt) {
    const p = this.player;
    const camSin = Math.sin(this.camYaw);
    const camCos = Math.cos(this.camYaw);
    const fwdX = -camSin;
    const fwdZ = -camCos;
    const rightX = camCos;
    const rightZ = -camSin;
    let ix = 0;
    let iz = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) {
      ix += fwdX;
      iz += fwdZ;
    }
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) {
      ix -= fwdX;
      iz -= fwdZ;
    }
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
      ix += rightX;
      iz += rightZ;
    }
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
      ix -= rightX;
      iz -= rightZ;
    }
    const len = Math.hypot(ix, iz);
    if (len > 0) {
      ix /= len;
      iz /= len;
      p.yaw = Math.atan2(ix, iz);
    }
    const grounded = p.grounded;
    const e = 0.6;
    const gx = (heightAt(p.x + e, p.z) - heightAt(p.x - e, p.z)) / (2 * e);
    const gz = (heightAt(p.x, p.z + e) - heightAt(p.x, p.z - e)) / (2 * e);
    // Uphill is slower, downhill a little faster: high ground costs time to take.
    const climb = len > 0 ? ix * gx + iz * gz : 0;
    const slopeMul = grounded ? clamp(1 - climb * 0.32, 0.58, 1.22) : 1;
    const spdMul = this.charging ? 0.72 : 1;
    const spd = this.hero.speed * this.stats.speed * spdMul * slopeMul * (this.buffs.haste > 0 ? 1.2 : 1) * MOVE_SCALE;

    // Quick to reach speed, quick to stop on the ground, floatier in the air.
    let k;
    if (!grounded) k = 1 - Math.pow(len > 0 ? 0.08 : 0.4, dt);
    else if (len > 0) k = 1 - Math.pow(0.0004, dt);
    else k = 1 - Math.pow(0.00002, dt);
    if (p.dashT <= 0) {
      p.vx = lerp(p.vx, ix * spd, k);
      p.vz = lerp(p.vz, iz * spd, k);
    }

    p.dashCd = Math.max(0, p.dashCd - dt);
    const dashKey = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || this.keys.has("KeyQ");
    if (dashKey && p.dashCd <= 0 && (grounded || p.airDash > 0)) {
      const dx = len > 0 ? ix : Math.sin(p.yaw);
      const dz = len > 0 ? iz : Math.cos(p.yaw);
      p.dashDx = dx;
      p.dashDz = dz;
      p.dashT = 0.17;
      p.dashCd = 1.05 / this.stats.dash;
      if (!grounded) {
        p.airDash -= 1;
        p.vy = Math.max(p.vy, 1.5);
      }
      p.iframes = Math.max(p.iframes, 0.24);
      this.sfx.dash();
      this.spawnBurst(p.x, p.y + 0.6, p.z, 0xfff1a8, 8);
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      const ds = Math.max(spd, this.hero.speed) + 17 * Math.sqrt(this.stats.dash);
      p.vx = p.dashDx * ds;
      p.vz = p.dashDz * ds;
      if (p.dashT <= 0) {
        p.vx *= 0.55;
        p.vz *= 0.55;
      }
    }

    // Jump with coyote time, input buffering, variable height and one air jump.
    p.coyote = grounded ? 0.12 : Math.max(0, p.coyote - dt);
    p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    if (p.jumpBuf > 0) {
      if (p.coyote > 0) {
        p.vy = 9.8;
        p.coyote = 0;
        p.jumpBuf = 0;
        p.jumpHeld = true;
        p.grounded = false;
      } else if (p.airJumps > 0) {
        p.vy = 8.6;
        p.airJumps -= 1;
        p.jumpBuf = 0;
        p.jumpHeld = true;
        this.spawnBurst(p.x, p.y + 0.3, p.z, 0xdff4ff, 8);
      }
    }
    if (p.jumpHeld && !this.keys.has("Space")) {
      p.jumpHeld = false;
      if (p.vy > 3.2) p.vy = 3.2;
    }
    const wasAir = !p.grounded;
    const fallVy = p.vy;
    p.vy -= (p.vy > 0 ? 27 : 38) * dt;
    p.vy = Math.max(p.vy, -40);
    p.y += p.vy * dt;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    [p.x, p.z] = this.resolvePos(p.x, p.z, p.radius);
    const gy = heightAt(p.x, p.z);
    // Stick to the ground when walking down slopes instead of hopping off them.
    const snap = !wasAir && p.vy <= 0 && p.y - gy < 0.9;
    if (p.y <= gy + 0.02 || snap) {
      if (wasAir && fallVy < -1.5) {
        this.spawnBurst(p.x, gy + 0.14, p.z, 0xc8b070, fallVy < -16 ? 14 : 7);
        if (fallVy < -16) this.shake = Math.max(this.shake, 0.18);
        p.land = 0.16;
      }
      p.y = gy;
      p.vy = 0;
      p.grounded = true;
      p.airJumps = 1;
      p.airDash = 1;
    } else {
      p.grounded = false;
    }
    p.land = Math.max(0, (p.land || 0) - dt);
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt);
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);
    this.tickBuffs(dt);
    this.updateCharge(dt);
    this.updateInteractPrompt();

    this.playerMesh.position.set(p.x, p.y, p.z);
    let dy = p.yaw - p.visYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    p.visYaw += dy * (1 - Math.pow(0.000005, dt));
    this.playerMesh.rotation.y = p.visYaw;
    const hspd = Math.hypot(p.vx, p.vz);
    const sq = p.land > 0 ? 1 - p.land * 0.9 : 1;
    this.playerMesh.scale.set(2 - sq, sq, 2 - sq);
    const ud = this.playerMesh.userData;
    if (ud.kit) {
      this.kit.playMove(ud, hspd > 1 && p.grounded, dt, clamp(hspd / this.hero.speed, 0.7, 1.8) * 1.1);
      this.kit.setCharge(ud, this.charging ? this.charge : 0);
      if (this.slashT > 0 && !this._atkPlayed) {
        this.kit.playAttack(ud);
        this._atkPlayed = true;
      }
      if (this.slashT <= 0) this._atkPlayed = false;
    } else {
      const bob = len > 0.1 && p.grounded ? Math.sin(this.time * 14) * 0.06 : 0;
      const body = ud.body;
      body.position.y = 0.88 + bob;
      if (ud.head) ud.head.position.y = 1.58 + bob;
      if (!p.grounded) body.scale.set(0.92, 1.12, 0.92);
      else if (len > 0.1) {
        const s = 1 + Math.sin(this.time * 14) * 0.04;
        body.scale.set(1.02, s, 1.02);
      } else body.scale.set(1, 1, 1);
      if (ud.armL) {
        const swing = len > 0.1 && p.grounded ? Math.sin(this.time * 10) * 0.45 : 0;
        ud.armL.rotation.x = swing;
        ud.armR.rotation.x = -swing;
        if (ud.legL) {
          ud.legL.rotation.x = swing * 0.9;
          ud.legR.rotation.x = -swing * 0.9;
        }
      }
      if (ud.mat) {
        const ch = this.charging ? this.charge : 0;
        ud.mat.emissive.setHex(ch > 0.04 ? 0xffaa44 : 0x000000);
        ud.mat.emissiveIntensity = ch * 0.75;
      }
    }
    if (this.slashT > 0) {
      this.playerMesh.userData.held.rotation.y = Math.sin((1 - this.slashT / 0.18) * Math.PI) * 1.4;
    } else {
      this.playerMesh.userData.held.rotation.y *= 0.8;
    }
  }

  hurtPlayer(amount, fromX, fromZ) {
    const p = this.player;
    if (p.iframes > 0 || this.hp <= 0) return;
    const armor = clamp((this.stats.armor || 0) + (this.buffs.tempArmor > 0 ? 0.35 : 0), 0, 0.65);
    amount *= 1 - armor;
    this.hp -= amount;
    p.iframes = 0.45;
    p.hurtFlash = 0.2;
    if (this.els.flash) {
      this.els.flash.classList.add("show");
      setTimeout(() => this.els.flash.classList.remove("show"), 140);
    }
    this.shake = Math.max(this.shake, 0.28);
    this.sfx.hurt();
    const dx = p.x - fromX;
    const dz = p.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    p.vx += (dx / d) * 6;
    p.vz += (dz / d) * 6;
    if (this.hp <= 0) {
      this.hp = 0;
      this.endRun(false);
    }
  }

  xpForLevel(lv) {
    return Math.floor(14 + lv * 8 + lv * lv * 0.75);
  }

  addXp(n) {
    this.xp += n * this.stats.xpGain;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level += 1;
      this.xpNeed = this.xpForLevel(this.level);
      this.levelQueue += 1;
      this.sfx.level();
    }
    if (this.levelQueue > 0 && !this.choosing) this.openLevelUp();
  }

  openLevelUp() {
    this.choosing = true;
    this.paused = true;
    document.exitPointerLock?.();
    const opts = this.rollCards(3);
    this.cardOpts = opts;
    this.els.cards.innerHTML = "";
    $("levelup-title").textContent = this.t(`مستوى ${this.level} — اختر ترقية`, `Level ${this.level} — pick an upgrade`);
    $("levelup-sub").textContent = this.t("1 / 2 / 3  •  R إعادة سحب  •  X تخطي", "1 / 2 / 3  •  R reroll  •  X skip");
    opts.forEach((c, i) => {
      const el = document.createElement("button");
      el.className = `card rarity-${c.rarity}`;
      const rare = RARITY[c.rarity];
      el.innerHTML = `
        <div class="card-rare">${this.t(rare.name, rare.nameEn)}</div>
        <div class="card-icon">${c.icon}</div>
        <div class="card-name">${this.t(c.name, c.nameEn)}</div>
        <div class="card-desc">${this.t(c.desc, c.descEn)}</div>
        <div class="card-key">${i + 1}</div>`;
      el.onclick = (ev) => {
        if (ev.button === 0) this.pickCard(i);
      };
      this.els.cards.appendChild(el);
    });
    const cost = this.rerollCost();
    $("btn-reroll").textContent = this.t(`إعادة سحب ◆${cost}`, `Reroll ◆${cost}`);
    $("btn-skip").textContent = this.t("تخطي +شفاء", "Skip +heal");
    this.els.levelup.classList.add("show");
  }

  rollCards(n) {
    const owned = new Set(this.loadout.map((w) => w.id));
    const pool = [];
    for (const w of this.loadout) {
      const def = WEAPONS[w.id];
      pool.push({
        type: "wup",
        weaponId: w.id,
        icon: def.icon,
        name: this.t(`ترقية ${def.name}`, `Upgrade ${def.nameEn}`),
        nameEn: `Upgrade ${def.nameEn}`,
        desc: `${def.icon} +مستوى ${w.level + 1}`,
        descEn: `${def.icon} +level ${w.level + 1}`,
      });
    }
    if (this.loadout.length < 4) {
      for (const id of Object.keys(WEAPONS)) {
        if (owned.has(id)) continue;
        const def = WEAPONS[id];
        pool.push({
          type: "weapon",
          weaponId: id,
          icon: def.icon,
          name: def.name,
          nameEn: def.nameEn,
          desc: def.desc,
          descEn: def.descEn,
        });
      }
    }
    for (const tome of TOMES) {
      pool.push({
        type: "tome",
        tomeId: tome.id,
        icon: tome.icon,
        name: tome.name,
        nameEn: tome.nameEn,
        desc: tome.desc,
        descEn: tome.descEn,
        stat: tome.stat,
        value: tome.value,
      });
    }
    const out = [];
    const used = new Set();
    let guard = 0;
    while (out.length < n && guard++ < 80) {
      const c = { ...pick(pool) };
      const key = c.type + (c.weaponId || c.tomeId);
      if (used.has(key) || this.banished.has(key)) continue;
      used.add(key);
      c.rarity = weightedRarity(this.stats.luck);
      out.push(c);
    }
    return out;
  }

  pickCard(i) {
    if (!this.choosing || !this.cardOpts?.[i]) return;
    const c = this.cardOpts[i];
    const mult = RARITY_MULT[c.rarity] || 1;
    if (c.type === "weapon") {
      this.loadout.push({ id: c.weaponId, level: 1, cd: 0.05, evolved: false });
      if (this.loadout.length === 1) this.rebuildHeldWeapon();
      this.toast(this.t(`سلاح جديد: ${WEAPONS[c.weaponId].name}`, `New weapon: ${WEAPONS[c.weaponId].nameEn}`));
    } else if (c.type === "wup") {
      const w = this.loadout.find((x) => x.id === c.weaponId);
      if (w) {
        w.level += 1;
        if (w.level >= 8 && !w.evolved) this.evolveWeapon(w);
      }
      this.toast(this.t("السلاح أقوى!", "Weapon stronger!"));
    } else if (c.type === "tome") {
      const tome = TOMES.find((t) => t.id === c.tomeId) || c;
      const vMult = c.rarity ? (RARITY_MULT[c.rarity] === 1 ? 1 : 0.65 + RARITY_MULT[c.rarity] * 0.35) : 1;
      this.applyTome(tome, vMult);
    }
    this.sfx.pickup();
    this.levelQueue = Math.max(0, this.levelQueue - 1);
    this.choosing = false;
    this.els.levelup.classList.remove("show");
    if (this.levelQueue > 0) {
      this.openLevelUp();
      return;
    }
    this.paused = false;
    this.mode = "run";
    this.spawnLevelWave();
    $("view").requestPointerLock?.();
  }

  applyTome(tome, mult = 1) {
    if (!tome) return;
    const v = (tome.value || 0) * mult;
    if (tome.stat === "projectiles") this.stats.projectiles += Math.round(tome.value || 1);
    else if (tome.stat === "maxHp") {
      this.stats.maxHp += v;
      this.hp += v;
    } else if (tome.stat === "magnet" || tome.stat === "regen" || tome.stat === "armor" || tome.stat === "duration") {
      this.stats[tome.stat] = (this.stats[tome.stat] || 0) + v;
    } else if (tome.stat === "cooldown") this.stats.cooldown = Math.min(0.7, this.stats.cooldown + v);
    else if (tome.stat === "curse") {
      this.stats.curse += 1;
      this.stats.damage += 0.22;
    } else this.stats[tome.stat] = (this.stats[tome.stat] || 0) + v;
    this.tomesOwned.push(tome.id || tome.tomeId);
    this.toast(this.t(tome.name, tome.nameEn));
  }

  evolveWeapon(w) {
    w.evolved = true;
    const def = WEAPONS[w.id];
    this.banner(this.t(`تطور: ${def.evoName}`, `Evolved: ${def.evoNameEn}`));
    this.sfx.level();
  }

  rerollCost() {
    const disc = this.hero.rerollDiscount || 0;
    return Math.max(4, Math.round((8 + this.rerolls * 5) * (1 - disc)));
  }

  rerollCards() {
    if (!this.choosing) return;
    const cost = this.rerollCost();
    if (this.gold < cost) {
      this.toast(this.t("ذهب ناقص", "Not enough gold"));
      return;
    }
    this.gold -= cost;
    this.rerolls += 1;
    this.sfx.pickup();
    this.openLevelUp();
  }

  skipLevelUp() {
    if (!this.choosing) return;
    this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.16);
    this.gold += 3;
    this.toast(this.t("تخطي: شفاء", "Skip: healed"));
    this.levelQueue = Math.max(0, this.levelQueue - 1);
    this.choosing = false;
    this.els.levelup.classList.remove("show");
    if (this.levelQueue > 0) {
      this.openLevelUp();
      return;
    }
    this.paused = false;
    this.mode = "run";
    this.spawnLevelWave();
    $("view").requestPointerLock?.();
  }

  spawnLevelWave() {
    const n = 5 + Math.floor(this.level * 1.7);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      let kind = "grunt";
      if (this.level >= 8 && r < 0.2) kind = "elite";
      else if (this.level >= 5 && r < 0.42) kind = "tank";
      else if (this.level >= 4 && r < 0.6) kind = "spitter";
      else if (this.level >= 2 && r < 0.82) kind = "runner";
      this.spawnEnemy(kind);
    }
    this.banner(this.t(`موجة مستوى ${this.level}!`, `Level ${this.level} wave!`));
  }

  weaponCount(w, def) {
    return (def.count || 1) + this.stats.projectiles + Math.floor((w.level - 1) / 2);
  }

  weaponDmg(w, def) {
    return def.baseDmg * this.stats.damage * (1 + (w.level - 1) * 0.18) * (w.evolved ? 1.45 : 1);
  }

  weaponRange(w, def) {
    return def.range * this.stats.area * (1 + (w.level - 1) * 0.06);
  }

  updateWeapons(dt) {
    this.slashT = Math.max(0, this.slashT - dt);
    this.orbitPhase += dt * 3.2 * (1 + this.stats.cooldown + (this.buffs.overcharge > 0 ? 0.45 : 0));
    for (const ball of this.orbitBalls) ball.visible = false;
    let ballIndex = 0;
    for (const w of this.loadout) {
      const def = WEAPONS[w.id];
      if (def.kind !== "orbit") continue;
      const n = Math.min(this.orbitBalls.length - ballIndex, this.weaponCount(w, def));
      const rad = this.weaponRange(w, def);
      const dmg = this.weaponDmg(w, def);
      for (let i = 0; i < n; i++) {
        const a = this.orbitPhase * def.spin + (i / Math.max(n, 1)) * TAU + ballIndex;
        const x = this.player.x + Math.cos(a) * rad;
        const z = this.player.z + Math.sin(a) * rad;
        const ball = this.orbitBalls[ballIndex++];
        ball.visible = true;
        ball.position.set(x, heightAt(x, z) + 0.9, z);
        if (w.id === "aegis") {
          ball.material.color.setHex(0x9ad0ff);
          ball.material.emissive.setHex(0x224466);
        } else {
          ball.material.color.setHex(0xffe066);
          ball.material.emissive.setHex(0xaa7700);
        }
        this.hitCircle(x, z, 0.55 * this.stats.area, dmg, def.knock, w.id, 0.16);
      }
    }

    if (this.auraPulse.active) {
      this.auraPulse.r += dt * 14;
      const r = this.auraPulse.r;
      this.auraMesh.position.set(this.auraPulse.x, heightAt(this.auraPulse.x, this.auraPulse.z) + 0.12, this.auraPulse.z);
      this.auraMesh.scale.setScalar(Math.max(0.2, r));
      this.auraMesh.material.opacity = clamp(1 - r / this.auraPulse.max, 0, 0.7);
      this.hitRing(this.auraPulse.x, this.auraPulse.z, r, 0.7, this.auraPulse.dmg, 2.2, this.auraPulse.hit);
      if (r >= this.auraPulse.max) {
        this.auraPulse.active = false;
        this.auraMesh.material.opacity = 0;
      }
    }

    if (this.slashT > 0) {
      this.slashMesh.material.opacity = this.slashT / 0.18 * 0.75;
    } else {
      this.slashMesh.material.opacity *= 0.7;
    }

    for (const w of this.loadout) {
      if (w.id === "orbit") continue;
      const def = WEAPONS[w.id];
      w.cd -= dt;
      if (w.cd > 0) continue;
      const cd =
        def.cooldown *
        (1 - this.stats.cooldown) *
        (1 - (w.level - 1) * 0.04) *
        (this.buffs.overcharge > 0 ? 0.62 : 1);
      w.cd = Math.max(0.1, cd);
      this.fireWeapon(w, def);
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.kind === "rang") {
        p.age += dt;
        if (p.age > p.out) {
          const dx = this.player.x - p.x;
          const dz = this.player.z - p.z;
          const d = Math.hypot(dx, dz) || 1;
          p.vx = (dx / d) * p.spd;
          p.vz = (dz / d) * p.spd;
          if (d < 0.8) p.life = 0;
        }
      }
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, heightAt(p.x, p.z) + 0.9, p.z);
      p.mesh.rotation.y += dt * 10;
      let hit = false;
      for (const e of this.enemies) {
        if (!e.alive || p.hit.has(e.id)) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) < e.radius + p.r) {
          this.damageEnemy(e, p.dmg, p.knock, p.x, p.z);
          p.hit.add(e.id);
          p.pierce -= 1;
          hit = true;
          if (p.pierce < 0) break;
        }
      }
      if (p.life <= 0 || p.pierce < 0 || hit && p.pierce < 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  fireWeapon(w, def) {
    const p = this.player;
    const dmg = this.weaponDmg(w, def);
    const range = this.weaponRange(w, def);
    const n = this.weaponCount(w, def);
    if (def.kind === "slash") {
      const target = this.nearestEnemy(range + 2);
      const yaw = target ? Math.atan2(target.x - p.x, target.z - p.z) : p.yaw;
      p.yaw = yaw;
      this.slashT = 0.18;
      this.slashGroup.position.set(p.x, 0.18 + p.y, p.z);
      this.slashGroup.rotation.y = yaw;
      this.sfx.bonk();
      this.hitCone(p.x, p.z, yaw, range, def.arc, dmg, def.knock);
    } else if (def.kind === "smash") {
      this.sfx.bonk();
      this.shake = Math.max(this.shake, 0.2);
      this.hitCircle(p.x, p.z, range, dmg, def.knock, "smash", 0.05);
      this.spawnBurst(p.x, p.y + 0.3, p.z, 0xc8a050, 14);
    } else if (def.kind === "bolt" || def.kind === "radial" || def.kind === "rang") {
      const count = def.kind === "radial" ? n : n;
      if (def.kind === "radial") {
        for (let i = 0; i < count; i++) {
          const a = (i / count) * TAU;
          this.spawnBolt(p.x, p.z, Math.sin(a), Math.cos(a), dmg, def, 0xff8844);
        }
      } else {
        const t = this.nearestEnemy(18);
        let fx = Math.sin(p.yaw);
        let fz = Math.cos(p.yaw);
        if (t) {
          const d = Math.hypot(t.x - p.x, t.z - p.z) || 1;
          fx = (t.x - p.x) / d;
          fz = (t.z - p.z) / d;
        }
        for (let i = 0; i < count; i++) {
          const spread = (i - (count - 1) / 2) * 0.18;
          const cs = Math.cos(spread);
          const sn = Math.sin(spread);
          const nx = fx * cs - fz * sn;
          const nz = fx * sn + fz * cs;
          this.spawnBolt(p.x, p.z, nx, nz, dmg, def, def.kind === "rang" ? 0xffdd55 : 0xff6622, def.kind);
        }
      }
    } else if (def.kind === "chain") {
      this.fireChain(range, dmg, n);
    } else if (def.kind === "aura") {
      this.auraPulse = {
        active: true,
        r: 0.4,
        max: range,
        x: p.x,
        z: p.z,
        dmg,
        hit: new Set(),
        leech: def.lifesteal || 0,
      };
    }
  }

  spawnBolt(x, z, fx, fz, dmg, def, color, kind = "bolt") {
    const geo = kind === "rang" ? new THREE.TorusGeometry(0.28, 0.08, 6, 10) : new THREE.SphereGeometry(0.18, 6, 6);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 }));
    mesh.position.set(x, heightAt(x, z) + 0.9, z);
    this.scene.add(mesh);
    const spd = (def.speed || 18) * (1 + this.stats.area * 0.05);
    this.projectiles.push({
      mesh,
      x,
      z,
      y: 0.9,
      vx: fx * spd,
      vz: fz * spd,
      spd,
      life: 1.1 * (this.stats.duration || 1),
      dmg,
      knock: def.knock,
      pierce: kind === "rang" ? 8 : Math.floor(this.stats.projectiles > 2 ? 1 : 0),
      r: 0.32 * this.stats.area,
      hit: new Set(),
      kind,
      age: 0,
      out: 0.45,
    });
  }

  fireChain(range, dmg, jumps) {
    let srcX = this.player.x;
    let srcZ = this.player.z;
    const hit = new Set();
    const pts = [{ x: srcX, y: 1.2, z: srcZ }];
    for (let i = 0; i < jumps; i++) {
      let best = null;
      let bestD = range;
      for (const e of this.enemies) {
        if (!e.alive || hit.has(e.id)) continue;
        const d = Math.hypot(e.x - srcX, e.z - srcZ);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best) break;
      hit.add(best.id);
      this.damageEnemy(best, dmg * (1 - i * 0.12), 0.8, srcX, srcZ);
      srcX = best.x;
      srcZ = best.z;
      pts.push({ x: srcX, y: 1.1, z: srcZ });
    }
    if (pts.length > 1) this.drawZap(pts);
    if (hit.size) this.sfx.hit();
  }

  drawZap(pts) {
    const arr = [];
    for (const p of pts) arr.push(p.x, p.y, p.z);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xddf0ff, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.fx.push({ mesh: line, life: 0.12 });
  }

  nearestEnemy(maxD) {
    let best = null;
    let bestD = maxD;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - this.player.x, e.z - this.player.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  hitCircle(x, z, r, dmg, knock, tag, cd) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.hitCd[tag] > 0) continue;
      if (Math.hypot(e.x - x, e.z - z) < r + e.radius) {
        this.damageEnemy(e, dmg, knock, x, z);
        e.hitCd[tag] = cd;
      }
    }
  }

  hitRing(x, z, r, thick, dmg, knock, set) {
    for (const e of this.enemies) {
      if (!e.alive || set.has(e.id)) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (Math.abs(d - r) < thick + e.radius) {
        this.damageEnemy(e, dmg, knock, x, z);
        set.add(e.id);
        if (this.auraPulse?.leech) this.hp = Math.min(this.stats.maxHp, this.hp + dmg * this.auraPulse.leech);
      }
    }
  }

  hitCone(x, z, yaw, range, arc, dmg, knock) {
    const half = arc / 2;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.radius) continue;
      const ang = Math.atan2(dx, dz);
      let diff = ang - yaw;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      if (Math.abs(diff) <= half + 0.15) this.damageEnemy(e, dmg, knock, x, z);
    }
  }

  damageEnemy(e, dmg, knock, fromX, fromZ) {
    if (!e.alive) return;
    let crit = false;
    if (Math.random() < this.stats.crit) {
      dmg *= this.stats.critDmg;
      crit = true;
      this.hitstop = Math.max(this.hitstop, 0.045);
      this.sfx.crit();
    } else {
      this.sfx.hit();
    }
    e.hp -= dmg;
    e.flash = 0.08;
    const dx = e.x - fromX;
    const dz = e.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    const k = knock * this.stats.knockback;
    e.kx += (dx / d) * k;
    e.kz += (dz / d) * k;
    this.floatText(e.x, e.y + 1.2, e.z, String(Math.round(dmg)), crit ? "#ffd24a" : "#fff");
    this.shake = Math.max(this.shake, crit ? 0.16 : 0.06);
    if (this.stats.lifesteal > 0) this.hp = Math.min(this.stats.maxHp, this.hp + dmg * this.stats.lifesteal);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.alive = false;
    e.mesh.visible = false;
    this.kills += 1;
    this.gold += Math.random() < e.gold * this.stats.goldFind ? 1 + (this.hero.id === "kett" ? 1 : 0) : 0;
    this.spawnGem(e.x, e.z, e.xp);
    this.spawnBurst(e.x, e.y + 0.5, e.z, e.color, 16);
    if (e.elite && Math.random() < 0.7) {
      const kinds = ["magnet", "nuke", "overcharge", "freeze", "armor"];
      this.spawnPickup(e.x, e.z, pick(kinds));
    }
    if (e.boss) {
      this.gold += 25;
      this.spawnPickup(e.x, e.z, "heart");
      this.bossKills += 1;
      this.banner(this.t("سقط الزعيم!", "Boss down!"));
      this.addXp(e.xp);
    }
  }

  spawnGem(x, z, value) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.2, 0),
      new THREE.MeshLambertMaterial({ color: 0x7ae7ff, emissive: 0x33ccff, emissiveIntensity: 0.85 })
    );
    mesh.position.set(x, heightAt(x, z) + 0.35, z);
    this.scene.add(mesh);
    this.gems.push({ mesh, x, z, value, magnet: false });
  }

  spawnPickup(x, z, kind) {
    const colors = { magnet: 0x66ff99, nuke: 0xff5533, heart: 0xff6688, haste: 0xffee55, overcharge: 0xff8844, freeze: 0x7ad0ff, armor: 0x9aa7b8 };
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.32, 0),
      new THREE.MeshLambertMaterial({ color: colors[kind], emissive: colors[kind], emissiveIntensity: 0.7 })
    );
    mesh.position.set(x, heightAt(x, z) + 0.5, z);
    this.scene.add(mesh);
    this.pickups.push({ mesh, x, z, kind, t: 20 });
  }

  spawnChest() {
    const a = rand(0, TAU);
    const d = rand(10, 28);
    const x = this.player.x + Math.cos(a) * d;
    const z = this.player.z + Math.sin(a) * d;
    this.placeChest(x, z);
    this.banner(this.t("صندوق ظهر!", "A chest appeared!"));
  }

  placeChest(x, z) {
    const [cx, cz] = this.resolvePos(x, z, 0.6);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.55, 0.6),
      new THREE.MeshLambertMaterial({ color: 0xe8c03a, emissive: 0xaa7700, emissiveIntensity: 0.35 })
    );
    mesh.position.set(cx, heightAt(cx, cz) + 0.3, cz);
    this.scene.add(mesh);
    this.chests.push({ mesh, x: cx, z: cz, open: false });
  }

  initFxPool() {
    this.fxPool = [];
    this.fxGeo = new THREE.SphereGeometry(0.11, 6, 4);
    for (let i = 0; i < 140; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(this.fxGeo, mat);
      m.visible = false;
      this.scene.add(m);
      this.fxPool.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0, max: 0.4 });
    }
  }

  spawnBurst(x, y, z, color, n) {
    let used = 0;
    for (const p of this.fxPool) {
      if (used >= n) break;
      if (p.life > 0) continue;
      p.life = 0.38;
      p.max = 0.38;
      p.vx = rand(-6, 6);
      p.vy = rand(3, 10);
      p.vz = rand(-6, 6);
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 1;
      p.mesh.scale.setScalar(rand(0.7, 1.4));
      used += 1;
    }
  }

  getEnemy() {
    let e = this.enemyPool.find((x) => !x.alive && x.mesh && !this.enemies.includes(x));
    if (e) return e;
    e = {
      id: this.enemyPool.length + 1,
      mesh: null,
      alive: false,
      hitCd: {},
    };
    this.enemyPool.push(e);
    return e;
  }

  spawnEnemy(kindId, bossDef = null) {
    const kind = bossDef
      ? {
          hp: bossDef.hp * (1 + this.time / 240),
          speed: bossDef.speed,
          dmg: bossDef.dmg,
          radius: bossDef.radius,
          color: bossDef.color,
          xp: 80,
          gold: 1,
          scale: bossDef.scale,
          name: bossDef.name,
        }
      : ENEMY_KINDS[kindId];
    const scaleHp = 1 + this.time / 62 + Math.max(0, this.level - 1) * 0.1;
    const scaleDmg = 1 + this.time / 150 + Math.max(0, this.level - 1) * 0.05;
    const a = rand(0, TAU);
    const d = rand(16, 24);
    let x = this.player.x + Math.cos(a) * d;
    let z = this.player.z + Math.sin(a) * d;
    [x, z] = this.resolvePos(x, z, kind.radius);
    const e = this.getEnemy();
    const wantKind = bossDef ? "boss" : kindId;
    if (!e.mesh || e.meshKind !== wantKind) {
      if (e.mesh?.parent) e.mesh.parent.remove(e.mesh);
      e.mesh = this.makeEnemyMesh(kindId, kind.color, kind.scale, !!bossDef);
      this.scene.add(e.mesh);
      e.meshKind = wantKind;
    } else {
      e.mesh.visible = true;
      if (!e.mesh.userData.kit && e.mesh.userData.mat) e.mesh.userData.mat.color.setHex(kind.color);
      if (kind.scale >= 1.25) setShadow(e.mesh, true, false);
      if (!e.mesh.parent) this.scene.add(e.mesh);
    }
    e.alive = true;
    e.kind = kindId;
    e.x = x;
    e.z = z;
    e.y = heightAt(x, z);
    e.hp = kind.hp * (bossDef ? 1 + this.time / 280 : scaleHp);
    e.maxHp = e.hp;
    e.speed = kind.speed * ENEMY_SPEED_SCALE * (0.92 + Math.random() * 0.16);
    e.dmg = kind.dmg * (bossDef ? 1 : scaleDmg);
    e.radius = kind.radius;
    e.xp = kind.xp;
    e.gold = kind.gold;
    e.color = kind.color;
    e.ranged = !!kind.ranged;
    e.elite = !!kind.elite;
    e.boss = !!bossDef;
    e.kx = 0;
    e.kz = 0;
    e.flash = 0;
    e.shootCd = rand(0.5, 1.6);
    e.slamCd = 3;
    e.hitCd = {};
    e.name = kind.name;
    this.enemies.push(e);
    e.mesh.position.set(x, e.y, z);
    if (bossDef) this.banner(this.t(`${bossDef.name} وصل!`, `${bossDef.nameEn} arrives!`));
  }

  updateEnemies(dt) {
    const p = this.player;
    const cap = Math.min(280, 52 + this.time * 0.72 + this.level * 6);
    this.spawnAcc += dt;
    const rate = Math.max(0.055, 0.46 - this.time * 0.0026 - this.level * 0.012);
    const batch = this.time > 130 ? 3 : this.time > 35 ? 2 : 1;
    while (this.spawnAcc >= rate && this.enemies.filter((e) => e.alive).length < cap) {
      this.spawnAcc -= rate;
      for (let b = 0; b < batch; b++) {
        if (this.enemies.filter((e) => e.alive).length >= cap) break;
        const t = this.time;
        let kind = "grunt";
        const r = Math.random();
        if (t > 50 && r < 0.2) kind = "swarm";
        else if (t > 35 && r < 0.1) kind = "elite";
        else if (t > 28 && r < 0.28) kind = "spitter";
        else if (t > 18 && r < 0.48) kind = "tank";
        else if (t > 8 && r < 0.7) kind = "runner";
        if (kind === "swarm") {
          for (let s = 0; s < 5; s++) this.spawnEnemy("swarm");
        } else this.spawnEnemy(kind);
      }
    }

    const b = BOSSES[this.nextBoss];
    if (b && this.time >= b.time) {
      this.spawnEnemy("elite", b);
      this.nextBoss += 1;
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        this.enemies.splice(i, 1);
        continue;
      }
      for (const k of Object.keys(e.hitCd)) e.hitCd[k] -= dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.mesh.userData.kit) {
        this.kit.setFlash(e.mesh.userData, e.flash > 0);
      } else if (e.mesh.userData.mat) {
        e.mesh.userData.mat.emissive.setHex(e.flash > 0 ? 0xffffff : 0x000000);
        e.mesh.userData.mat.emissiveIntensity = e.flash > 0 ? 0.65 : 0;
        const sq = e.flash > 0 ? 0.78 : 1;
        e.mesh.userData.body.scale.set(1.15, sq, 1.15);
      }

      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const nx = dx / dist;
      const nz = dz / dist;
      let move = 1;
      if (this.buffs.freeze > 0 && !e.boss) move = 0;
      if (e.ranged && dist < 9 && dist > 4.5) move = 0.15;
      const curseSpd = 1 + (this.stats.curse || 0) * 0.25;
      // Enemies slow down climbing toward a player on high ground.
      const climb = heightAt(e.x + nx * 0.8, e.z + nz * 0.8) - e.y;
      if (!e.boss) move *= clamp(1 - climb * 0.45, 0.5, 1.2);
      e.x += nx * e.speed * curseSpd * move * dt + e.kx * dt;
      e.z += nz * e.speed * curseSpd * move * dt + e.kz * dt;
      e.kx *= Math.pow(0.04, dt);
      e.kz *= Math.pow(0.04, dt);
      [e.x, e.z] = this.resolvePos(e.x, e.z, e.radius);
      e.y = heightAt(e.x, e.z);
      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.lookAt(p.x, e.y, p.z);
      if (e.mesh.userData.kit) {
        this.kit.playMove(e.mesh.userData, move > 0.2, dt);
      } else {
        e.mesh.userData.body.rotation.y = this.time * (e.kind === "runner" ? 8 : 3);
      }

      if (e.ranged) {
        e.shootCd -= dt;
        if (e.shootCd <= 0 && dist < 12) {
          e.shootCd = 1.8;
          this.spawnSpit(e.x, e.z, nx, nz, e.dmg);
        }
      }
      if (e.boss) {
        e.slamCd -= dt;
        if (e.slamCd <= 0) {
          e.slamCd = 4.2;
          this.hitCircle(e.x, e.z, 4.2, e.dmg * 1.4, 10, "slam", 0.05);
          this.spawnBurst(e.x, e.y + 0.4, e.z, e.color, 18);
          this.shake = Math.max(this.shake, 0.4);
        }
      }
      if (dist < e.radius + p.radius + 0.15 && p.y < heightAt(p.x, p.z) + 0.85) {
        this.hurtPlayer(e.dmg, e.x, e.z);
      }
    }

    for (let i = this.spit.length - 1; i >= 0; i--) {
      const s = this.spit[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.mesh.position.set(s.x, heightAt(s.x, s.z) + 0.7, s.z);
      if (Math.hypot(s.x - p.x, s.z - p.z) < 0.55 && p.y < heightAt(p.x, p.z) + 1) {
        this.hurtPlayer(s.dmg, s.x, s.z);
        s.life = 0;
      }
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.spit.splice(i, 1);
      }
    }
  }

  spawnSpit(x, z, nx, nz, dmg) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xc45ee0, emissive: 0x661188, emissiveIntensity: 0.4 })
    );
    mesh.position.set(x, heightAt(x, z) + 0.7, z);
    this.scene.add(mesh);
    this.spit.push({ mesh, x, z, vx: nx * 9, vz: nz * 9, life: 2.2, dmg });
  }

  updateDrops(dt) {
    const p = this.player;
    const mag = this.stats.magnet + (this.nukeT > 0 ? 14 : 0);
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = p.x - g.x;
      const dz = p.z - g.z;
      const d = Math.hypot(dx, dz);
      if (d < mag) g.magnet = true;
      if (g.magnet) {
        const s = 18 + (1 - d / mag) * 14;
        g.x += (dx / (d || 1)) * s * dt;
        g.z += (dz / (d || 1)) * s * dt;
      }
      g.mesh.position.set(g.x, heightAt(g.x, g.z) + 0.35 + Math.sin(this.time * 6 + i) * 0.08, g.z);
      g.mesh.rotation.y += dt * 4;
      if (Math.hypot(g.x - p.x, g.z - p.z) < 0.85) {
        this.addXp(g.value);
        this.sfx.xp();
        this.scene.remove(g.mesh);
        this.gems.splice(i, 1);
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      u.t -= dt;
      u.mesh.rotation.y += dt * 3;
      u.mesh.position.y = heightAt(u.x, u.z) + 0.5 + Math.sin(this.time * 4) * 0.12;
      if (Math.hypot(u.x - p.x, u.z - p.z) < 1 || u.t <= 0 && Math.hypot(u.x - p.x, u.z - p.z) < 2) {
        if (Math.hypot(u.x - p.x, u.z - p.z) < 1.1) {
          if (u.kind === "magnet") {
            for (const g of this.gems) g.magnet = true;
            this.toast(this.t("مغناطيس!", "Magnet!"));
          } else if (u.kind === "nuke") {
            for (const e of this.enemies) if (e.alive && !e.boss) this.damageEnemy(e, 80 * this.stats.damage, 6, p.x, p.z);
            this.toast(this.t("إبادة!", "Nuke!"));
            this.shake = 0.5;
          } else if (u.kind === "heart") {
            this.hp = Math.min(this.stats.maxHp, this.hp + 40);
            this.toast(this.t("قلب +40", "Heart +40"));
          } else if (u.kind === "haste") {
            this.buffs.haste = 8;
            this.toast(this.t("سرعة!", "Haste!"));
          } else if (u.kind === "overcharge") {
            this.buffs.overcharge = 10;
            this.toast(this.t("شحن زائد!", "Overcharge!"));
          } else if (u.kind === "freeze") {
            this.buffs.freeze = 3.2;
            this.toast(this.t("تجميد!", "Freeze!"));
          } else if (u.kind === "armor") {
            this.buffs.tempArmor = 8;
            this.toast(this.t("درع!", "Armor!"));
          }
          this.sfx.chest();
          this.scene.remove(u.mesh);
          this.pickups.splice(i, 1);
        } else if (u.t <= 0) {
          this.scene.remove(u.mesh);
          this.pickups.splice(i, 1);
        }
      }
    }
    this.chestAcc -= dt;
    if (this.chestAcc <= 0) {
      this.chestAcc = 42;
      this.spawnChest();
    }
    if (this.time >= 90 && !this.shopKeep) this.spawnShop();
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      c.mesh.position.y = heightAt(c.x, c.z) + 0.3 + Math.sin(this.time * 3) * 0.05;
      if (!c.open && Math.hypot(c.x - p.x, c.z - p.z) < 1.2) {
        c.open = true;
        this.chestsOpened += 1;
        this.applyTome(pick(TOMES), 1);
        this.gold += 8;
        this.sfx.chest();
        this.scene.remove(c.mesh);
        this.chests.splice(i, 1);
      }
    }
  }

  updateFx(dt) {
    if (this.fxPool) {
      for (const p of this.fxPool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 16 * dt;
        p.mesh.material.opacity = clamp(p.life / p.max, 0, 1);
        p.mesh.rotation.x += dt * 8;
        if (p.life <= 0) p.mesh.visible = false;
      }
    }
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      if (f.vx != null) {
        f.mesh.position.x += f.vx * dt;
        f.mesh.position.y += f.vy * dt;
        f.mesh.position.z += f.vz * dt;
        f.vy -= 14 * dt;
        if (f.mesh.material) f.mesh.material.opacity = clamp(f.life / 0.35, 0, 1);
      }
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        this.fx.splice(i, 1);
      }
    }
    for (const d of this.dmgPool) {
      if (d.t <= 0) continue;
      d.t -= dt;
      d.y += dt * 1.2;
      tmp.set(d.x, d.y, d.z).project(this.camera);
      const x = (tmp.x * 0.5 + 0.5) * innerWidth;
      const y = (-tmp.y * 0.5 + 0.5) * innerHeight;
      d.el.style.transform = `translate(${x}px, ${y}px)`;
      d.el.style.opacity = String(clamp(d.t / 0.6, 0, 1));
      if (d.t <= 0) d.el.style.display = "none";
    }
  }

  floatText(x, y, z, text, color) {
    const d = this.dmgPool.find((o) => o.t <= 0) || this.dmgPool[0];
    d.t = 0.65;
    d.x = x;
    d.y = y;
    d.z = z;
    d.el.textContent = text;
    d.el.style.color = color;
    d.el.style.display = "block";
  }

  toast(msg) {
    this.els.toast.textContent = msg;
    this.els.toast.classList.add("show");
    this.toastT = 1.8;
  }

  banner(msg) {
    this.els.banner.textContent = msg;
    this.els.banner.classList.add("show");
    this.killBannerT = 2.4;
  }

  updateHud() {
    const hpPct = clamp(this.hp / this.stats.maxHp, 0, 1);
    this.els.hpFill.style.width = `${hpPct * 100}%`;
    this.els.hpText.textContent = `${Math.ceil(this.hp)} / ${Math.ceil(this.stats.maxHp)}`;
    this.els.xpFill.style.width = `${clamp(this.xp / this.xpNeed, 0, 1) * 100}%`;
    this.els.xpText.textContent = `XP ${Math.floor(this.xp)}/${this.xpNeed}`;
    this.els.timer.textContent = this.fmtTime(this.time);
    this.els.kills.textContent = String(this.kills);
    this.els.gold.textContent = String(this.gold);
    this.els.lvl.textContent = String(this.level);
    this.els.weapons.innerHTML = this.loadout
      .map((w) => {
        const def = WEAPONS[w.id];
        return `<div class="wep" title="${def.nameEn}"><span>${def.icon}</span><small>${w.evolved ? "EVO" : "Lv" + w.level}</small></div>`;
      })
      .join("");
    if (this.els.chargeFill) {
      this.els.chargeFill.style.width = `${this.charge * 100}%`;
      this.els.chargeText.textContent = this.charge >= 0.84 ? "PRECISION" : "CHARGE";
    }
    if (this.els.buffs) {
      const chips = [];
      if (this.buffs.overcharge > 0) chips.push(`⚡ ${this.buffs.overcharge | 0}s`);
      if (this.buffs.freeze > 0) chips.push(`❄ ${this.buffs.freeze | 0}s`);
      if (this.buffs.tempArmor > 0) chips.push(`🛡 ${this.buffs.tempArmor | 0}s`);
      if (this.buffs.haste > 0) chips.push(`💨 ${this.buffs.haste | 0}s`);
      this.els.buffs.innerHTML = chips.map((c) => `<div class="buff-chip">${c}</div>`).join("");
    }
    this.drawMinimap();
  }

  drawMinimap() {
    const ctx = this.minimapCtx;
    const s = 128;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "rgba(8,16,12,0.72)";
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, TAU);
    ctx.fill();
    const scale = 62 / RADAR_RANGE;
    const px = this.player.x;
    const pz = this.player.z;
    ctx.save();
    ctx.beginPath();
    ctx.arc(64, 64, 61, 0, TAU);
    ctx.clip();
    ctx.translate(64, 64);
    ctx.rotate(this.camYaw);
    if (this.terrainMap) {
      const R = ARENA_RADIUS;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(this.terrainMap, (-R - px) * scale, (-R - pz) * scale, 2 * R * scale, 2 * R * scale);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "rgba(232,244,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-px * scale, -pz * scale, ARENA_RADIUS * scale, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "#5ad0ff";
    for (const g of this.gems) {
      ctx.fillRect((g.x - px) * scale - 1, (g.z - pz) * scale - 1, 2, 2);
    }
    ctx.fillStyle = "#e24b4b";
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const sz = e.boss ? 5 : 2;
      ctx.fillRect((e.x - px) * scale - sz / 2, (e.z - pz) * scale - sz / 2, sz, sz);
    }
    const pin = (x, z, size) => {
      let dx = (x - px) * scale;
      let dz = (z - pz) * scale;
      const l = Math.hypot(dx, dz);
      if (l > 57 * 2.5) return;
      if (l > 57) {
        dx *= 57 / l;
        dz *= 57 / l;
      }
      ctx.fillRect(dx - size / 2, dz - size / 2, size, size);
    };
    ctx.fillStyle = "#f0c14a";
    for (const c of this.chests) if (!c.open) pin(c.x, c.z, 4);
    ctx.fillStyle = "#c45ee0";
    for (const s of this.shrines) {
      if (s.used) continue;
      pin(s.x, s.z, 4);
    }
    if (this.shopKeep) {
      ctx.fillStyle = "#7ad0ff";
      pin(this.shopKeep.x, this.shopKeep.z, 6);
    }
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(64, 64, 61, 0, TAU);
    ctx.stroke();
  }

  updateCamera(dt) {
    const p = this.player;
    // Follow point: tight on x/z, eased on y so bumps and jumps don't jolt the view.
    if (!this.camFocus) this.camFocus = new THREE.Vector3(p.x, p.y, p.z);
    const f = this.camFocus;
    f.x = p.x;
    f.z = p.z;
    f.y = Math.abs(f.y - p.y) > 12 ? p.y : lerp(f.y, p.y, 1 - Math.pow(p.grounded ? 0.0008 : 0.06, dt));
    const dist = 11.6 + this.stats.area * 0.35;
    const height = 4.6 + this.camPitch * 8.8;
    const tx = f.x + Math.sin(this.camYaw) * dist * Math.cos(this.camPitch * 0.2);
    const tz = f.z + Math.cos(this.camYaw) * dist;
    let ty = f.y + height;
    // Keep the camera above hills between it and the player.
    for (let i = 1; i <= 4; i++) {
      const t = i / 4;
      const gh = heightAt(lerp(f.x, tx, t), lerp(f.z, tz, t)) + 0.9 + t * 0.6;
      if (gh > lerp(f.y + 1.3, ty, t)) ty = f.y + 1.3 + (gh - f.y - 1.3) / t;
    }
    if (this.camY == null || Math.abs(this.camY - ty) > 30) this.camY = ty;
    this.camY = lerp(this.camY, ty, 1 - Math.pow(ty > this.camY ? 0.0005 : 0.02, dt));
    this.shake *= Math.pow(0.004, dt);
    const sx = (Math.random() - 0.5) * this.shake * 2;
    const sy = (Math.random() - 0.5) * this.shake * 2;
    this.camera.position.set(tx + sx, this.camY + sy, tz + sx * 0.3);
    this.camera.lookAt(f.x, f.y + 1.28, f.z);

    // Widen the view a touch at speed.
    const fov = 58 + clamp((Math.hypot(p.vx, p.vz) - this.hero.speed) * 0.7, 0, 9);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = lerp(this.camera.fov, fov, 1 - Math.pow(0.02, dt));
      this.camera.updateProjectionMatrix();
    }
    this.followSun(p.x, p.z, p.y);
  }

  followSun(x, z, y = 0) {
    // Snap to shadow texels so the moving frustum does not make shadows shimmer.
    const step = (SHADOW_HALF * 2) / this.sun.shadow.mapSize.x;
    const sx = Math.round(x / step) * step;
    const sz = Math.round(z / step) * step;
    // Height moves in coarse steps so jumping does not slide the shadow map around.
    y = Math.round(y / 6) * 6;
    this.sun.position.set(sx + 28, y + 38, sz + 16);
    this.sun.target.position.set(sx, y, sz);
  }

  endRun(won) {
    this.mode = won ? "win" : "dead";
    this.paused = true;
    document.exitPointerLock?.();
    this.save.runs += 1;
    this.save.bestTime = Math.max(this.save.bestTime, this.time | 0);
    this.save.bestKills = Math.max(this.save.bestKills, this.kills);
    this.save.quests = this.save.quests || {};
    if (this.time >= 180) this.save.unlocks.grom = true;
    if (this.kills >= 400) this.save.unlocks.vex = true;
    if (this.chestsOpened >= 3) this.save.unlocks.nyla = true;
    if (this.gold >= 40) this.save.unlocks.kett = true;
    if (this.chargeKills >= 20) this.save.quests.charge = true;
    if (this.bossKills >= 1) this.save.quests.boss = true;
    writeSave(this.save);
    if (won) this.sfx.win();
    else this.sfx.death();
    this.els.hud.classList.remove("show");
    this.els.levelup.classList.remove("show");
    this.els.shop?.classList.remove("show");
    this.els.end.classList.add("show");
    this.els.endTitle.textContent = won
      ? this.t("نجوت من البونك!", "You survived the bonk!")
      : this.t("انكسر البونك", "You got bonked");
    this.els.endStats.innerHTML = `
      <div>${this.t("الوقت", "Time")}: <b>${this.fmtTime(this.time)}</b></div>
      <div>${this.t("القتل", "Kills")}: <b>${this.kills}</b></div>
      <div>${this.t("المستوى", "Level")}: <b>${this.level}</b></div>
      <div>${this.t("ذهب", "Gold")}: <b>${this.gold}</b></div>`;
    $("btn-again").textContent = this.t("جولة أخرى", "Run again");
    $("btn-menu").textContent = this.t("القائمة", "Menu");
    const extra = [];
    if (this.time >= 180) extra.push(this.t("فُتح غروم!", "Grom unlocked!"));
    if (this.kills >= 400) extra.push(this.t("فُتحت فِكس!", "Vex unlocked!"));
    if (this.chestsOpened >= 3) extra.push(this.t("فُتحت نايلا!", "Nyla unlocked!"));
    if (this.gold >= 40) extra.push(this.t("فُتح كيت!", "Kett unlocked!"));
    $("end-unlock").textContent = extra.join(" • ");
  }

  loop() {
    requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, this.clock.getDelta());
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.els.toast.classList.remove("show");
    }
    if (this.killBannerT > 0) {
      this.killBannerT -= dt;
      if (this.killBannerT <= 0) this.els.banner.classList.remove("show");
    }

    if (this.mode === "run" && !this.paused && !this.choosing && !this.shopping) {
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        dt *= 0.18;
      }
      this.time += dt;
      this.updatePlayer(dt);
      this.updateWeapons(dt);
      this.updateEnemies(dt);
      this.updateDrops(dt);
      this.updateFx(dt);
      this.updateCamera(dt);
      this.updateHud();
      this.sfx.tickMusic(dt, clamp(this.time / SURVIVE_SECONDS, 0, 1));
      if (this.time >= SURVIVE_SECONDS && this.hp > 0) this.endRun(true);
    } else if (this.mode === "menu") {
      this.camYaw += dt * 0.06;
      this.camera.position.set(Math.sin(this.camYaw) * 46, 26, Math.cos(this.camYaw) * 46);
      this.camera.lookAt((RIDGE.x / WS) * 0.35, 3.4, (RIDGE.z / WS) * 0.35);
    } else if (this.playerMesh && (this.mode === "paused" || this.choosing || this.mode === "dead" || this.mode === "win")) {
      this.updateCamera(dt);
      this.updateFx(dt);
    }
    const t = this.clock.elapsedTime;
    if (this.skyRig) this.skyRig.position.set(this.camera.position.x, 0, this.camera.position.z);
    if (this.clouds) this.clouds.rotation.y += dt * 0.015;
    if (this.waterTex) {
      this.waterTex.offset.x += dt * 0.014;
      this.waterTex.offset.y += dt * 0.009;
    }
    if (this.foam) this.foam.material.opacity = 0.42 + Math.sin(t * 1.4) * 0.12;
    if (this.motes) {
      const cx = this.player?.x || 0;
      const cz = this.player?.z || 0;
      const wrap = (v, c) => c + ((((v - c) % MOTE_BOX) + MOTE_BOX * 1.5) % MOTE_BOX) - MOTE_BOX / 2;
      for (const m of this.motes) {
        const x = wrap(m.ox, cx) + Math.sin(t * 0.55 + m.ph) * 1.5;
        const z = wrap(m.oz, cz) + Math.cos(t * 0.48 + m.ph) * 1.5;
        m.mesh.position.set(x, heightAt(x, z) + m.oy + Math.sin(t * 1.15 + m.ph) * 0.45, z);
      }
    }
    if (this.godRays) {
      for (let i = 0; i < this.godRays.length; i++) {
        this.godRays[i].material.opacity = 0.035 + Math.sin(t * 0.7 + i) * 0.018;
      }
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
if (new URLSearchParams(location.search).has("debug")) window.bonk = game;
