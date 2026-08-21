'use strict';
/* ============================================================
 *  R U B I X
 *  Arcade cyberpunk Rubik's cube solver.
 *  HTML5 canvas + vanilla JS. No external libraries.
 *  Colors: Arne16 palette ONLY.
 * ============================================================ */

/* ---------------- Arne16 palette ---------------- */
const ARNE = ['#000000', '#9D9D9D', '#FFFFFF', '#BE2633', '#E06F8B',
              '#493C2B', '#A46422', '#EB8931', '#F7E26B', '#2F484E',
              '#44891A', '#A3CE27', '#1B2632', '#005784', '#31A2F2', '#B2DCEF'];

const BG     = '#000000';
const DIM    = '#9D9D9D';
const WHITE  = '#FFFFFF';
const RED    = '#BE2633';
const PINK   = '#E06F8B';
const COAL   = '#493C2B';
const BROWN  = '#A46422';
const ORANGE = '#EB8931';
const GOLD   = '#F7E26B';
const TEAL   = '#2F484E';
const GRN    = '#44891A';
const LIME   = '#A3CE27';
const PANEL  = '#1B2632';
const BLUE   = '#005784';
const NEON   = '#31A2F2';
const ICE    = '#B2DCEF';

/* nearest-palette color to (color * factor) — keeps shading in-palette */
function hexRGB(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function nearestPalette(hex, factor) {
  const [r, g, b] = hexRGB(hex);
  let best = ARNE[0], bd = Infinity;
  for (const c of ARNE) {
    const [R, G, B] = hexRGB(c);
    const d = (R - r * factor) ** 2 + (G - g * factor) ** 2 + (B - b * factor) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/* Cube face colors (bright tier) */
const FACE_COLORS = {
  '+x': RED,    // right
  '-x': ORANGE, // left
  '+y': WHITE,  // top
  '-y': GOLD,   // bottom
  '+z': NEON,   // front
  '-z': GRN     // back
};
/* shading tiers per base color: [bright, mid, dark] */
const SHADES = {};
for (const k in FACE_COLORS) {
  const base = FACE_COLORS[k];
  SHADES[base] = [base, nearestPalette(base, 0.62), nearestPalette(base, 0.34)];
}

/* ---------------- canvas / scaling ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const LOGICAL = 800;          // 800x800 logical square
let unit = 1;

function resize() {
  const s = Math.max(200, Math.min(window.innerWidth, window.innerHeight));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = s + 'px';
  canvas.style.height = s + 'px';
  canvas.width = Math.round(s * dpr);
  canvas.height = Math.round(s * dpr);
  unit = canvas.width / LOGICAL;
}
window.addEventListener('resize', resize);
resize();

/* ---------------- quaternion math ---------------- */
const Q = {
  mul(a, b) { // a * b
    return [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
      a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
      a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]
    ];
  },
  inv(q) { return [q[0], -q[1], -q[2], -q[3]]; },
  axisAngle(ax, ay, az, a) {
    const s = Math.sin(a / 2), c = Math.cos(a / 2);
    return [c, ax * s, ay * s, az * s];
  },
  rot(q, v) { // rotate vector v by unit quaternion q
    const [w, x, y, z] = q;
    const [px, py, pz] = v;
    const tx = 2 * (y * pz - z * py);
    const ty = 2 * (z * px - x * pz);
    const tz = 2 * (x * py - y * px);
    return [px + w * tx + (y * tz - z * ty),
            py + w * ty + (z * tx - x * tz),
            pz + w * tz + (x * ty - y * tx)];
  }
};
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const LIGHT = norm([0.45, 0.7, 0.6]);

/* ---------------- cube state ---------------- */
const cubies = []; // {x,y,z,q,colors}

function resetCube() {
  cubies.length = 0;
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const colors = {};
        if (x === 1) colors['+x'] = FACE_COLORS['+x'];
        if (x === -1) colors['-x'] = FACE_COLORS['-x'];
        if (y === 1) colors['+y'] = FACE_COLORS['+y'];
        if (y === -1) colors['-y'] = FACE_COLORS['-y'];
        if (z === 1) colors['+z'] = FACE_COLORS['+z'];
        if (z === -1) colors['-z'] = FACE_COLORS['-z'];
        cubies.push({ x, y, z, q: [1, 0, 0, 0], colors });
      }
}

/* clockwise 90° moves: vertical slices (L,M,R) about +X as seen from the
 * right side; horizontal slices (U,M,D) about +Y as seen from above.
 * Both are -90° by the right-hand rule. */
function moveQuat(axis) {
  return axis === 'x' ? Q.axisAngle(1, 0, 0, -Math.PI / 2)
                      : Q.axisAngle(0, 1, 0, -Math.PI / 2);
}

function applyMove(axis, layer) { // commit instantly
  const qa = moveQuat(axis);
  for (const c of cubies) {
    if (c[axis] !== layer) continue;
    c.q = Q.mul(qa, c.q);
    const p = Q.rot(qa, [c.x, c.y, c.z]);
    c.x = Math.round(p[0]); c.y = Math.round(p[1]); c.z = Math.round(p[2]);
  }
}

function axisKey(v) { // dominant axis -> '+x' style key
  let ax = 0, m = Math.abs(v[0]);
  if (Math.abs(v[1]) > m) { m = Math.abs(v[1]); ax = 1; }
  if (Math.abs(v[2]) > m) { ax = 2; }
  return (v[ax] > 0 ? '+' : '-') + 'xyz'[ax];
}

function isSolved() {
  const dirs = [['x', 1], ['x', -1], ['y', 1], ['y', -1], ['z', 1], ['z', -1]];
  for (const [ax, s] of dirs) {
    let col = null;
    for (const c of cubies) {
      if (c[ax] !== s) continue;
      const d = [0, 0, 0]; d['xyz'.indexOf(ax)] = s;
      const key = axisKey(Q.rot(Q.inv(c.q), d));
      const col2 = c.colors[key];
      if (!col2) return false;
      if (col === null) col = col2;
      else if (col !== col2) return false;
    }
  }
  return true;
}

/* ---------------- game state ---------------- */
let screen = 'title';          // 'title' | 'play' | 'end'
let yaw = 0, pitch = 0;        // view rotation (radians)
let moves = 0;
let startTime = 0, timerOn = false, elapsed = 0;
let anim = null;               // {axis, layer, start, dur}
let pending = null;            // queued move (arcade chaining)
let endReadyAt = 0;
let endRecT = false, endRecM = false;

let best = { time: null, moves: null };
try {
  const t = localStorage.getItem('rubix_best_time');
  const m = localStorage.getItem('rubix_best_moves');
  if (t !== null) best.time = +t;
  if (m !== null) best.moves = +m;
} catch (e) { /* storage unavailable */ }
function saveBest() {
  try {
    localStorage.setItem('rubix_best_time', String(best.time));
    localStorage.setItem('rubix_best_moves', String(best.moves));
  } catch (e) { /* ignore */ }
}

function reshuffle() {
  resetCube();
  const all = [];
  for (const ax of ['x', 'y']) for (const l of [-1, 0, 1]) all.push([ax, l]);
  let prev = -1;
  for (let i = 0; i < 28; i++) {
    let j;
    do { j = Math.floor(Math.random() * all.length); } while (j === prev);
    prev = j;
    applyMove(all[j][0], all[j][1]);
  }
  if (isSolved()) reshuffle();
  moves = 0;
  timerOn = false;
  startTime = 0;
  elapsed = 0;
  yaw = 0;
  pitch = 0;
  anim = null;
  pending = null;
}

function startGame() {
  reshuffle();
  focusIdx = 1; // start focused on M (vertical middle)
  screen = 'play';
}

function doMove(axis, layer) {
  if (anim) { pending = { axis, layer }; return; }
  if (!timerOn) { timerOn = true; startTime = performance.now(); }
  moves++;
  anim = { axis, layer, start: performance.now(), dur: 170 };
}

function commitAnim(now) {
  applyMove(anim.axis, anim.layer);
  anim = null;
  if (screen === 'play' && isSolved()) {
    timerOn = false;
    elapsed = performance.now() - startTime;
    endRecT = (best.time === null || elapsed < best.time);
    endRecM = (best.moves === null || moves < best.moves);
    if (endRecT) { best.time = elapsed; saveBest(); }
    if (endRecM) { best.moves = moves; saveBest(); }
    endReadyAt = performance.now() + 600;
    screen = 'end';
  } else if (pending) {
    const p = pending; pending = null;
    doMove(p.axis, p.layer);
  }
}

/* ---------------- layout / controls ---------------- */
const C = {
  vL:  { rect: { x: 306, y: 110, w: 56, h: 48 }, type: 'move', axis: 'x', layer: -1, label: 'L' },
  vM:  { rect: { x: 372, y: 110, w: 56, h: 48 }, type: 'move', axis: 'x', layer: 0,  label: 'M' },
  vR:  { rect: { x: 438, y: 110, w: 56, h: 48 }, type: 'move', axis: 'x', layer: 1,  label: 'R' },
  hU:  { rect: { x: 692, y: 280, w: 64, h: 46 }, type: 'move', axis: 'y', layer: 1,  label: 'U' },
  hM:  { rect: { x: 692, y: 389, w: 64, h: 46 }, type: 'move', axis: 'y', layer: 0,  label: 'M' },
  hD:  { rect: { x: 692, y: 498, w: 64, h: 46 }, type: 'move', axis: 'y', layer: -1, label: 'D' },
  vslide: { rect: { x: 52, y: 262, w: 52, h: 300 }, type: 'vslide' },
  hslide: { rect: { x: 210, y: 618, w: 380, h: 48 }, type: 'hslide' },
  reset:   { rect: { x: 140, y: 716, w: 170, h: 56 }, type: 'reset',   label: 'RESET VIEW' },
  shuffle: { rect: { x: 330, y: 716, w: 140, h: 56 }, type: 'shuffle', label: 'SHUFFLE' },
  quit:    { rect: { x: 500, y: 716, w: 170, h: 56 }, type: 'quit',    label: 'QUIT' }
};
const focusList = ['vL', 'vM', 'vR', 'vslide', 'hU', 'hM', 'hD', 'hslide', 'reset', 'shuffle', 'quit'];
let focusIdx = 1;

const ccx = (c) => c.rect.x + c.rect.w / 2;
const ccy = (c) => c.rect.y + c.rect.h / 2;
const focusKey = () => focusList[focusIdx];
const isSlideKey = (k) => k === 'vslide' || k === 'hslide';

function moveFocus(dx, dy) {
  const cur = C[focusKey()];
  let bestI = -1, bestScore = Infinity;
  focusList.forEach((k, i) => {
    if (k === focusKey()) return;
    const t = C[k];
    const vx = ccx(t) - ccx(cur);
    const vy = ccy(t) - ccy(cur);
    if (vx * dx + vy * dy < 24) return;        // must be roughly in direction
    const off = Math.abs(vx * dy) + Math.abs(vy * dx); // cross-axis misalignment
    const score = Math.hypot(vx, vy) + off * 2;
    if (score < bestScore) { bestScore = score; bestI = i; }
  });
  if (bestI >= 0) focusIdx = bestI;
}

function setSliderDeg(key, deg) {
  deg = ((deg % 360) + 360) % 360;
  if (key === 'hslide') yaw = deg * Math.PI / 180;
  else pitch = deg * Math.PI / 180;
}
const sliderDeg = (key) => ((key === 'hslide' ? yaw : pitch) * 180 / Math.PI + 360) % 360;

function activate(key) {
  if (key === 'vL' || key === 'vM' || key === 'vR' || key === 'hU' || key === 'hM' || key === 'hD') {
    doMove(C[key].axis, C[key].layer);
  } else if (key === 'reset') {
    yaw = 0; pitch = 0;
  } else if (key === 'shuffle') {
    reshuffle();
  } else if (key === 'quit') {
    screen = 'title';
  }
}

/* ---------------- 3D cube rendering ---------------- */
const FACE_DEFS = [
  { n: [ 1, 0, 0], c: '+x', v: [[ .5,-.5,-.5], [ .5,-.5, .5], [ .5, .5, .5], [ .5, .5,-.5]] },
  { n: [-1, 0, 0], c: '-x', v: [[-.5,-.5,-.5], [-.5, .5,-.5], [-.5, .5, .5], [-.5,-.5, .5]] },
  { n: [ 0, 1, 0], c: '+y', v: [[-.5, .5,-.5], [-.5, .5, .5], [ .5, .5, .5], [ .5, .5,-.5]] },
  { n: [ 0,-1, 0], c: '-y', v: [[-.5,-.5,-.5], [ .5,-.5,-.5], [ .5,-.5, .5], [-.5,-.5, .5]] },
  { n: [ 0, 0, 1], c: '+z', v: [[-.5,-.5, .5], [ .5,-.5, .5], [ .5, .5, .5], [-.5, .5, .5]] },
  { n: [ 0, 0,-1], c: '-z', v: [[-.5,-.5,-.5], [-.5, .5,-.5], [ .5, .5,-.5], [ .5,-.5,-.5]] }
];
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function drawCube(cx, cy, scale, viewYaw, viewPitch, now) {
  const qView = Q.mul(Q.axisAngle(1, 0, 0, viewPitch), Q.axisAngle(0, 1, 0, viewYaw));
  const camD = 9;
  const items = [];

  for (const c of cubies) {
    let px = c.x, py = c.y, pz = c.z, q = c.q;
    if (anim && c[anim.axis] === anim.layer) {
      const k = Math.min(1, (now - anim.start) / anim.dur);
      const a = -ease(k) * Math.PI / 2;
      const qa = anim.axis === 'x' ? Q.axisAngle(1, 0, 0, a) : Q.axisAngle(0, 1, 0, a);
      const p = Q.rot(qa, [c.x, c.y, c.z]);
      px = p[0]; py = p[1]; pz = p[2];
      q = Q.mul(qa, c.q);
    }
    for (const f of FACE_DEFS) {
      const n = Q.rot(q, f.n);
      const nv = Q.rot(qView, n);
      if (nv[2] < 0.02) continue;              // backface cull: keep faces pointing at camera (+z)
      const ctr = Q.rot(qView, [px, py, pz]);
      const verts = f.v.map((v) => {
        const l = Q.rot(q, v);
        const pv = Q.rot(qView, [px + l[0], py + l[1], pz + l[2]]);
        const s = camD / (camD - pv[2]);
        return [cx + pv[0] * s * scale, cy - pv[1] * s * scale];
      });
      items.push({ z: ctr[2], verts, f, n, sticker: c.colors[f.c] || null });
    }
  }
  items.sort((a, b) => a.z - b.z);             // far -> near (camera at +z)

  for (const it of items) {
    poly(it.verts, PANEL);                     // cubie body
    if (it.sticker) {
      const d = dot3(it.n, LIGHT);
      const tiers = SHADES[it.sticker];
      const col = d > 0.45 ? tiers[0] : d > 0.05 ? tiers[1] : tiers[2];
      const c0 = [
        (it.verts[0][0] + it.verts[1][0] + it.verts[2][0] + it.verts[3][0]) / 4,
        (it.verts[0][1] + it.verts[1][1] + it.verts[2][1] + it.verts[3][1]) / 4
      ];
      const sv = it.verts.map((v) => [c0[0] + (v[0] - c0[0]) * 0.82, c0[1] + (v[1] - c0[1]) * 0.82]);
      poly(sv, col);
      poly(sv, col);                           // crisp sticker edge
    }
  }
}

function poly(pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/* ---------------- UI widgets ---------------- */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawArrowIcon(x, y, r, color) { // small clockwise circular arrow
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r, -2.4, 1.6);
  ctx.stroke();
  const a = 1.6;
  const tx = x + Math.cos(a) * r, ty = y + Math.sin(a) * r;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tx + Math.cos(a + 1.9) * 6, ty + Math.sin(a + 1.9) * 6);
  ctx.lineTo(tx + Math.cos(a + 0.4) * 6, ty + Math.sin(a + 0.4) * 6);
  ctx.lineTo(tx, ty);
  ctx.closePath();
  ctx.fill();
}

function drawMoveButton(c, focused) {
  const { x, y, w, h } = c.rect;
  ctx.save();
  if (focused) { ctx.shadowColor = GOLD; ctx.shadowBlur = 14; }
  else { ctx.shadowColor = NEON; ctx.shadowBlur = 6; }
  roundRect(x, y, w, h, 9);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = focused ? GOLD : BLUE;
  ctx.lineWidth = focused ? 3 : 2;
  ctx.stroke();
  drawArrowIcon(x + 20, y + h / 2, 10, focused ? GOLD : NEON);
  ctx.fillStyle = focused ? GOLD : ICE;
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.label, x + w - 18, y + h / 2 + 1);
  ctx.restore();
}

function drawActionButton(c, focused, danger) {
  const { x, y, w, h } = c.rect;
  ctx.save();
  if (focused) { ctx.shadowColor = GOLD; ctx.shadowBlur = 14; }
  else if (danger) { ctx.shadowColor = RED; ctx.shadowBlur = 8; }
  else { ctx.shadowColor = NEON; ctx.shadowBlur = 6; }
  roundRect(x, y, w, h, 9);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = focused ? GOLD : (danger ? RED : BLUE);
  ctx.lineWidth = focused ? 3 : 2;
  ctx.stroke();
  ctx.fillStyle = focused ? GOLD : (danger ? PINK : ICE);
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawSlider(key, focused) {
  const r = C[key].rect;
  const deg = sliderDeg(key);
  const vertical = key === 'vslide';
  const t = deg / 360;
  ctx.save();
  if (vertical) {
    // track
    ctx.strokeStyle = focused ? NEON : BLUE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ccx(C[key]), r.y + 8);
    ctx.lineTo(ccx(C[key]), r.y + r.h - 8);
    ctx.stroke();
    // ticks every 90°
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2;
    for (let d = 0; d < 360; d += 90) {
      const ty = r.y + 8 + (d / 360) * (r.h - 16);
      ctx.beginPath();
      ctx.moveTo(ccx(C[key]) - 12, ty);
      ctx.lineTo(ccx(C[key]) + 12, ty);
      ctx.stroke();
    }
    // knob
    const ky = r.y + 8 + t * (r.h - 16);
    ctx.shadowColor = NEON;
    ctx.shadowBlur = focused ? 14 : 8;
    ctx.beginPath();
    ctx.arc(ccx(C[key]), ky, 13, 0, Math.PI * 2);
    ctx.fillStyle = focused ? GOLD : NEON;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = focused ? WHITE : ICE;
    ctx.lineWidth = 2;
    ctx.stroke();
    // value
    ctx.fillStyle = ICE;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(deg) + '°', r.x + r.w / 2, r.y + r.h + 22);
  } else {
    ctx.strokeStyle = focused ? NEON : BLUE;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r.x + 8, ccy(C[key]));
    ctx.lineTo(r.x + r.w - 8, ccy(C[key]));
    ctx.stroke();
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2;
    for (let d = 0; d < 360; d += 90) {
      const tx = r.x + 8 + (d / 360) * (r.w - 16);
      ctx.beginPath();
      ctx.moveTo(tx, ccy(C[key]) - 12);
      ctx.lineTo(tx, ccy(C[key]) + 12);
      ctx.stroke();
    }
    const kx = r.x + 8 + t * (r.w - 16);
    ctx.shadowColor = NEON;
    ctx.shadowBlur = focused ? 14 : 8;
    ctx.beginPath();
    ctx.arc(kx, ccy(C[key]), 13, 0, Math.PI * 2);
    ctx.fillStyle = focused ? GOLD : NEON;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = focused ? WHITE : ICE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ICE;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(deg) + '°', r.x + r.w + 34, ccy(C[key]));
  }
  if (focused) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    roundRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8, 10);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- background / chrome ---------------- */
function drawBackground() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, LOGICAL, LOGICAL);
  // faint tech grid
  ctx.strokeStyle = PANEL;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 40; i < LOGICAL; i += 40) {
    ctx.moveTo(i, 0); ctx.lineTo(i, LOGICAL);
    ctx.moveTo(0, i); ctx.lineTo(LOGICAL, i);
  }
  ctx.stroke();
  // frame
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, LOGICAL - 20, LOGICAL - 20);
  ctx.strokeStyle = NEON;
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, LOGICAL - 32, LOGICAL - 32);
}

function drawHUD(now) {
  const t = timerOn ? performance.now() - startTime : elapsed;
  ctx.save();
  ctx.textBaseline = 'middle';
  // logo
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 10;
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('RUBIX', 30, 46);
  ctx.shadowBlur = 0;
  // time
  ctx.fillStyle = DIM;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TIME', 300, 30);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 26px monospace';
  ctx.fillText(fmtTime(t), 300, 54);
  // moves
  ctx.fillStyle = DIM;
  ctx.font = 'bold 14px monospace';
  ctx.fillText('MOVES', 470, 30);
  ctx.fillStyle = LIME;
  ctx.font = 'bold 26px monospace';
  ctx.fillText(String(moves).padStart(3, '0'), 470, 54);
  // best
  ctx.textAlign = 'right';
  ctx.fillStyle = DIM;
  ctx.font = 'bold 12px monospace';
  ctx.fillText('BEST', 770, 30);
  ctx.fillStyle = ICE;
  ctx.font = 'bold 15px monospace';
  ctx.fillText(
    (best.time === null ? '--:--.-' : fmtTime(best.time)) + '  /  ' +
    (best.moves === null ? '---' : best.moves) + ' mv', 770, 52);
  ctx.restore();
}

function fmtTime(ms) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const c = Math.floor((t % 1000) / 10);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
}

function blinkOn(now, ms = 500) {
  return Math.floor(now / ms) % 2 === 0;
}

/* ---------------- screens ---------------- */
function drawTitle(now) {
  drawBackground();
  // decorative spinning cube
  const a = now * 0.00045;
  drawCube(400, 340, 62, a, 0.5, now);
  // holo ring
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(400, 560, 170, 26, 0, 0, Math.PI * 2);
  ctx.stroke();
  // logo
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 26;
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 88px monospace';
  ctx.fillText('RUBIX', 400, 680);
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 12;
  ctx.fillStyle = NEON;
  ctx.font = 'bold 88px monospace';
  ctx.fillText('RUBIX', 400, 680);
  ctx.shadowBlur = 0;
  ctx.fillStyle = ICE;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('A R C A D I C   C U B E   S O L V E R', 400, 732);
  if (blinkOn(now)) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 22px monospace';
    ctx.fillText('TAP OR PRESS ANY KEY TO START', 400, 620);
  }
  ctx.fillStyle = DIM;
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ARROW KEYS NAVIGATE  ·  ENTER / SPACE CONFIRM  ·  SLIDERS ROTATE VIEW', 400, 764);
  if (best.time !== null) {
    ctx.fillStyle = LIME;
    ctx.fillText('RECORD  ' + fmtTime(best.time) + '  ·  ' + best.moves + ' MOVES', 400, 706);
  }
  ctx.restore();
}

function drawPlay(now) {
  drawBackground();
  drawHUD(now);
  // section labels
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = DIM;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('VERTICAL SLICES · CLOCKWISE', 400, 96);
  ctx.save();
  ctx.translate(778, 412);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('HORIZONTAL SLICES', 0, 0);
  ctx.restore();
  ctx.fillText('VERTICAL VIEW', C.vslide.rect.x + C.vslide.rect.w / 2, 244);
  ctx.fillText('HORIZONTAL VIEW', 400, 604);
  ctx.restore();
  // holo ring under cube
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(400, 566, 160, 24, 0, 0, Math.PI * 2);
  ctx.stroke();
  // the cube
  drawCube(400, 412, 58, yaw, pitch, now);
  // controls
  const fk = focusKey();
  for (const k of ['vL', 'vM', 'vR', 'hU', 'hM', 'hD']) drawMoveButton(C[k], k === fk);
  for (const k of ['reset', 'shuffle', 'quit'])
    drawActionButton(C[k], k === fk, k === 'quit');
  drawSlider('vslide', fk === 'vslide');
  drawSlider('hslide', fk === 'hslide');
}

function drawEnd(now) {
  drawBackground();
  drawCube(400, 330, 54, -Math.PI / 4, -0.35, now);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = LIME;
  ctx.shadowBlur = 18;
  ctx.fillStyle = LIME;
  ctx.font = 'bold 46px monospace';
  ctx.fillText('CUBE SOLVED', 400, 520);
  ctx.shadowBlur = 0;
  ctx.fillStyle = DIM;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('TIME', 260, 572);
  ctx.fillText('MOVES', 540, 572);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 34px monospace';
  ctx.fillText(fmtTime(elapsed), 260, 602);
  ctx.fillStyle = LIME;
  ctx.fillText(String(moves), 540, 602);
  let yy = 648;
  if (endRecT || endRecM) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 14;
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 24px monospace';
    if (endRecT && endRecM) ctx.fillText('★ DOUBLE NEW RECORD ★', 400, yy);
    else if (endRecT) ctx.fillText('★ NEW RECORD — TIME ★', 400, yy);
    else ctx.fillText('★ NEW RECORD — MOVES ★', 400, yy);
    ctx.shadowBlur = 0;
    yy += 34;
  }
  if (blinkOn(now)) {
    ctx.fillStyle = ICE;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('PRESS ENTER OR TAP TO PLAY AGAIN', 400, 740);
  }
  ctx.fillStyle = DIM;
  ctx.font = 'bold 13px monospace';
  ctx.fillText('BEST  ' + fmtTime(best.time) + '  ·  ' + best.moves + ' MOVES', 400, 770);
  ctx.restore();
}

/* ---------------- input ---------------- */
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return [
    (e.clientX - r.left) / r.width * LOGICAL,
    (e.clientY - r.top) / r.height * LOGICAL
  ];
}
function inRect(p, r, pad = 10) {
  return p[0] >= r.x - pad && p[0] <= r.x + r.w + pad &&
         p[1] >= r.y - pad && p[1] <= r.y + r.h + pad;
}
function applySliderAt(key, p) {
  const r = C[key].rect;
  let t;
  if (key === 'hslide') t = (p[0] - (r.x + 8)) / (r.w - 16);
  else t = (p[1] - (r.y + 8)) / (r.h - 16);
  t = Math.max(0, Math.min(1, t));
  setSliderDeg(key, t * 359.999);
}

let dragKey = null;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const now = performance.now();
  if (screen === 'title') { startGame(); return; }
  if (screen === 'end') { if (now >= endReadyAt) startGame(); return; }
  const p = toLogical(e);
  for (const k of ['vslide', 'hslide']) {
    if (inRect(p, C[k].rect, 6)) {
      focusIdx = focusList.indexOf(k);
      applySliderAt(k, p);
      dragKey = k;
      canvas.setPointerCapture(e.pointerId);
      return;
    }
  }
  for (const k of focusList) {
    if (isSlideKey(k)) continue;
    if (inRect(p, C[k].rect)) {
      focusIdx = focusList.indexOf(k);
      activate(k);
      return;
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (dragKey) applySliderAt(dragKey, toLogical(e));
});
canvas.addEventListener('pointerup', () => { dragKey = null; });
canvas.addEventListener('pointercancel', () => { dragKey = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (screen === 'title') { startGame(); return; }
  if (screen === 'end') {
    if (performance.now() >= endReadyAt) startGame();
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter'].includes(k))
    e.preventDefault();
  const fk = focusKey();
  switch (k) {
    case 'ArrowUp':
      if (fk === 'vslide') setSliderDeg('vslide', sliderDeg('vslide') - 15);
      else moveFocus(0, -1);
      break;
    case 'ArrowDown':
      if (fk === 'vslide') setSliderDeg('vslide', sliderDeg('vslide') + 15);
      else moveFocus(0, 1);
      break;
    case 'ArrowLeft':
      if (fk === 'hslide') setSliderDeg('hslide', sliderDeg('hslide') - 15);
      else moveFocus(-1, 0);
      break;
    case 'ArrowRight':
      if (fk === 'hslide') setSliderDeg('hslide', sliderDeg('hslide') + 15);
      else moveFocus(1, 0);
      break;
    case 'Enter':
    case ' ':
      if (!e.repeat) activate(fk);
      break;
  }
});

/* ---------------- main loop ---------------- */
function frame(now) {
  if (anim && now - anim.start >= anim.dur) commitAnim(now);
  ctx.setTransform(unit, 0, 0, unit, 0, 0);
  if (screen === 'title') drawTitle(now);
  else if (screen === 'play') drawPlay(now);
  else drawEnd(now);
  requestAnimationFrame(frame);
}
resetCube();
frame(performance.now());            // draws immediately, then chains rAF
