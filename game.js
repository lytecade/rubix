'use strict';
/* ============================================================
 *  R U B I X
 *  Arcade cyberpunk Rubik's cube solver.
 *  HTML5 canvas + vanilla JS. No external libraries.
 *  Colors: Arne16 palette ONLY.
 *
 *  Responsive graphics:
 *   - canvas fills the whole viewport in any orientation
 *   - device detection: touch / coarse-pointer phones get their
 *     own portrait & landscape layouts with touch-sized controls
 *   - devicePixelRatio-aware backing store for crisp graphics
 *   - safe-area (notch / home-bar) aware placement
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

/* Cube face colors */
const FACE_COLORS = {
  '+x': RED,    // right
  '-x': ORANGE, // left
  '+y': WHITE,  // top
  '-y': GOLD,   // bottom
  '+z': NEON,   // front
  '-z': GRN     // back
};

/* ---------------- device detection ---------------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isCoarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
/* glow (shadowBlur) is expensive on mobile GPUs — dial it down there */
const GLOW = isCoarse ? 0.5 : 1;

/* ---------------- canvas / scaling ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
let VW = 0, VH = 0, DPR = 1;          // viewport in CSS px + backing scale
let portrait = false;
let insets = { l: 0, r: 0, t: 0, b: 0 }; // safe-area insets (notch etc.)
let lastOrientation = null;

/* read CSS env(safe-area-inset-*) values via hidden probe elements */
function readInsets() {
  try {
    const measure = (side, horiz) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;margin:0;padding:0;';
      d.style[horiz ? 'width' : 'height'] = 'env(safe-area-inset-' + side + ')';
      document.body.appendChild(d);
      const v = horiz ? d.offsetWidth : d.offsetHeight;
      document.body.removeChild(d);
      return clamp(v || 0, 0, 80);
    };
    insets.l = measure('left', true);
    insets.r = measure('right', true);
    insets.t = measure('top', false);
    insets.b = measure('bottom', false);
  } catch (e) { insets = { l: 0, r: 0, t: 0, b: 0 }; }
}

function resize() {
  const vv = window.visualViewport;
  const w = vv ? vv.width : window.innerWidth;
  const h = vv ? vv.height : window.innerHeight;
  VW = Math.max(200, Math.round(w));
  VH = Math.max(200, Math.round(h));
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  canvas.style.width = VW + 'px';
  canvas.style.height = VH + 'px';
  canvas.width = Math.round(VW * DPR);
  canvas.height = Math.round(VH * DPR);
  const o = VH > VW ? 'portrait' : 'landscape';
  if (o !== lastOrientation) { readInsets(); lastOrientation = o; }
  computeLayout();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 80));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
try {
  const mq = window.matchMedia('(orientation: portrait)');
  const onOr = () => setTimeout(resize, 80);
  if (mq.addEventListener) mq.addEventListener('change', onOr);
  else if (mq.addListener) mq.addListener(onOr);
} catch (e) { /* ignore */ }

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
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

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

/* ---------------- layout / controls ----------------
 * Control types / actions are fixed; their rects are recomputed by
 * computeLayout() for the current viewport, orientation & device class. */
const C = {
  vL:  { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'move', axis: 'x', layer: -1, label: 'L' },
  vM:  { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'move', axis: 'x', layer: 0,  label: 'M' },
  vR:  { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'move', axis: 'x', layer: 1,  label: 'R' },
  hU:  { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'move', axis: 'y', layer: 1,  label: 'U' },
  hM:  { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'move', axis: 'y', layer: 0,  label: 'M' },
  hD:  { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'move', axis: 'y', layer: -1, label: 'D' },
  vslide: { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'vslide' },
  hslide: { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'hslide' },
  reset:   { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'reset',   label: 'RESET VIEW' },
  shuffle: { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'shuffle', label: 'SHUFFLE' },
  quit:    { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'quit',    label: 'QUIT' }
};
const focusList = ['vL', 'vM', 'vR', 'vslide', 'hU', 'hM', 'hD', 'hslide', 'reset', 'shuffle', 'quit'];
let focusIdx = 1;

const ccx = (c) => c.rect.x + c.rect.w / 2;
const ccy = (c) => c.rect.y + c.rect.h / 2;
const focusKey = () => focusList[focusIdx];
const isSlideKey = (k) => k === 'vslide' || k === 'hslide';

/* computed layout, refreshed on every resize / orientation change */
const L = {
  u: 1,                 // global UI size multiplier
  hudH: 60,
  touchPad: 12,         // hit-test padding around controls
  knob: 13,             // slider knob radius
  cube: { cx: 0, cy: 0, scale: 50 },
  ring: { cx: 0, cy: 0, rx: 100, ry: 20 },
  fonts: {},
  labels: {}
};

function setRect(c, x, y, w, h) {
  c.rect.x = x; c.rect.y = y; c.rect.w = Math.max(20, w); c.rect.h = Math.max(20, h);
}

function computeLayout() {
  portrait = VH > VW;
  const m = Math.min(VW, VH);
  L.u = clamp(m / 800, 0.78, 1.6);
  L.touchPad = isCoarse ? 16 : 10;
  L.knob = Math.round(clamp(13 * L.u, isCoarse ? 11 : 9, 17));
  const r = Math.round;
  L.fonts = {
    hudLogo:  r(clamp(26 * L.u, 18, 42)),
    hudLabel: r(clamp(12.5 * L.u, 9, 18)),
    hudVal:   r(clamp(24 * L.u, 15, 34)),
    hudValSm: r(clamp(15 * L.u, 12, 20)),
    hudSmall: r(clamp(13 * L.u, 10, 16)),
    btn:      r(clamp(20 * L.u, 13, 28)),
    action:   r(clamp(16 * L.u, 11, 22)),
    slider:   r(clamp(14 * L.u, 11, 18)),
    section:  r(clamp(12.5 * L.u, 9, 16))
  };
  if (portrait) layoutPortrait();
  else layoutLandscape();
}

/* --- portrait phones/tablets: cube on top, control stack below --- */
function layoutPortrait() {
  const padBase = Math.max(12, VW * 0.035);
  const cx0 = insets.l + padBase;                 // content left
  const cx1 = VW - insets.r - padBase;            // content right
  const cw = Math.max(120, cx1 - cx0);
  const top = insets.t;
  const topPad = Math.max(10, VH * 0.012);

  L.hudH = clamp(VH * 0.085, 58, 84);
  const hudBottom = top + L.hudH;
  const avail = Math.max(120, VH - hudBottom - insets.b - topPad);

  /* size the control panel first so it always fits, then give the cube
   * whatever vertical budget remains. */
  const rhTarget = clamp(avail * 0.11, 44, 70);
  const gapTarget = clamp(avail * 0.02, 6, 20);
  const gapTop = clamp(VH * 0.015, 8, 24);
  const panelBudget = 4 * rhTarget + 5 * gapTarget;
  const cubeBudget = avail - panelBudget - gapTop;
  const scale = clamp(Math.min(VW * 0.155, cubeBudget / 5.05), 24, 120);
  const cubeCy = hudBottom + gapTop + scale * 1.9;
  L.cube = { cx: VW / 2, cy: cubeCy, scale };
  L.ring = { cx: VW / 2, cy: cubeCy + scale * 2.45, rx: scale * 2.5, ry: scale * 0.36 };

  /* vertical view slider beside the cube (left margin) */
  const sw = clamp(VW * 0.11, 36, 56);
  const sh = Math.min(clamp(scale * 4.4, 150, 340), (cubeCy - hudBottom - 10) * 2);
  setRect(C.vslide, cx0, cubeCy - sh / 2, sw, sh);

  /* control panel: 4 rows (L M R / U M D / slider / actions), centered */
  const panelTop = cubeCy + scale * 3.15;
  const panelBottom = VH - insets.b - topPad;
  const panelAvail = Math.max(4 * 34, panelBottom - panelTop);
  const gapR = clamp(panelAvail * 0.03, 5, 20);
  const rh = clamp((panelAvail - 5 * gapR) / 4, 30, 74);
  const used = 4 * rh + 5 * gapR;
  const g = Math.max(8, cw * 0.02);
  const bw = (cw - 2 * g) / 3;

  const y1 = panelTop + (panelAvail - used) / 2 + gapR;
  const y2 = y1 + rh + gapR;
  const y3 = y2 + rh + gapR;
  const y4 = y3 + rh + gapR;

  setRect(C.vL, cx0, y1, bw, rh);
  setRect(C.vM, cx0 + bw + g, y1, bw, rh);
  setRect(C.vR, cx0 + 2 * (bw + g), y1, bw, rh);
  setRect(C.hU, cx0, y2, bw, rh);
  setRect(C.hM, cx0 + bw + g, y2, bw, rh);
  setRect(C.hD, cx0 + 2 * (bw + g), y2, bw, rh);
  setRect(C.hslide, cx0, y3, cw, rh);
  setRect(C.reset, cx0, y4, bw, rh);
  setRect(C.shuffle, cx0 + bw + g, y4, bw, rh);
  setRect(C.quit, cx0 + 2 * (bw + g), y4, bw, rh);

  const vsBottom = C.vslide.rect.y + C.vslide.rect.h;
  L.labels = {
    vSlices: { x: VW / 2, y: y1 - gapR * 0.5 },
    hSlices: { x: VW / 2, y: y2 - gapR * 0.5 },
    hView:   { x: VW / 2, y: y3 - gapR * 0.5 },
    hViewVal:{ x: VW / 2, y: y3 + rh + gapR * 0.5 },
    vView:   { x: C.vslide.rect.x, y: vsBottom + 14, align: 'left' },
    vViewVal:{ x: C.vslide.rect.x, y: vsBottom + 30, align: 'left' }
  };
}

/* --- landscape phones / desktops: cube centered, controls around --- */
function layoutLandscape() {
  const padY = Math.max(10, VH * 0.02);
  const padBase = Math.max(12, VW * 0.015);
  const left = insets.l + padBase;
  const right = VW - insets.r - padBase;
  const top = insets.t;
  const bottom = VH - insets.b;

  L.hudH = clamp(VH * 0.13, 44, 90);
  const hudBottom = top + L.hudH;
  const areaTop = hudBottom;
  const areaBottom = bottom - padY;
  const areaH = Math.max(160, areaBottom - areaTop);

  /* cube slightly left of centre (right column takes the edge) */
  const scale = clamp(Math.min(areaH * 0.135, VW * 0.085), 26, 150);
  const cubeCx = left + (right - left) * 0.47;
  /* vertical slice buttons (L M R) sit above the cube */
  const tbW = clamp(VH * 0.19, 60, 100);
  const tbH = clamp(VH * 0.12, 42, 62);
  const tgap = clamp(VH * 0.02, 6, 14);
  const rowW = 3 * tbW + 2 * tgap;
  const rowX = cubeCx - rowW / 2;
  const rowY = areaTop + clamp(areaH * 0.055, 8, 30);
  /* keep the cube far enough below the top row even in very short windows */
  const cubeCy = Math.max(areaTop + areaH * 0.52, rowY + tbH + scale * 1.9 + 8);
  L.cube = { cx: cubeCx, cy: cubeCy, scale };
  L.ring = { cx: cubeCx, cy: cubeCy + scale * 2.35, rx: scale * 2.5, ry: scale * 0.34 };
  setRect(C.vL, rowX, rowY, tbW, tbH);
  setRect(C.vM, rowX + tbW + tgap, rowY, tbW, tbH);
  setRect(C.vR, rowX + 2 * (tbW + tgap), rowY, tbW, tbH);

  /* horizontal slice buttons (U M D) on the right edge */
  const rbW = clamp(VH * 0.17, 56, 96);
  const rbH = clamp(VH * 0.12, 42, 64);
  const rgap = clamp(VH * 0.03, 8, 18);
  const colH = 3 * rbH + 2 * rgap;
  const colX = right - rbW;
  const colY = cubeCy - colH / 2;
  setRect(C.hU, colX, colY, rbW, rbH);
  setRect(C.hM, colX, colY + rbH + rgap, rbW, rbH);
  setRect(C.hD, colX, colY + 2 * (rbH + rgap), rbW, rbH);

  /* vertical view slider on the left edge */
  const vsW = clamp(VH * 0.11, 36, 56);
  let vsH = clamp(areaH * 0.6, 140, 420);
  let vsY = Math.max(cubeCy - vsH / 2, hudBottom + 34); // room for its labels
  vsH = Math.min(vsH, Math.max(80, areaBottom - vsY));
  setRect(C.vslide, left, vsY, vsW, vsH);

  /* bottom row: action buttons left, horizontal view slider right */
  const bottomH = clamp(VH * 0.13, 44, 64);
  const bottomY = areaBottom - bottomH;
  const abGap = clamp(VW * 0.008, 6, 14);
  const abW = clamp(VW * 0.115, 86, 160);
  setRect(C.reset, left, bottomY, abW, bottomH);
  setRect(C.shuffle, left + abW + abGap, bottomY, abW, bottomH);
  setRect(C.quit, left + 2 * (abW + abGap), bottomY, abW, bottomH);
  const hsX = left + 3 * (abW + abGap) + clamp(VW * 0.02, 14, 30);
  const hsW = Math.max(60, right - hsX);
  setRect(C.hslide, hsX, bottomY, hsW, bottomH);

  L.labels = {
    vSlices: { x: cubeCx, y: Math.max(rowY - 10, hudBottom + 8) },
    hSlices: { x: colX - Math.max(10, rbW * 0.25), y: cubeCy, rot: true },
    vView:   { x: C.vslide.rect.x, y: C.vslide.rect.y - 26, align: 'left' },
    vViewVal:{ x: C.vslide.rect.x, y: C.vslide.rect.y - 12, align: 'left' },
    hView:   { x: hsX + hsW / 2, y: bottomY - 24 },
    hViewVal:{ x: hsX + hsW / 2, y: bottomY - 10 }
  };
}

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
      if (nv[2] < 0) continue;             // backface cull
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
      const col = it.sticker;
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
  ctx.lineWidth = Math.max(1.5, r * 0.25);
  ctx.beginPath();
  ctx.arc(x, y, r, -2.4, 1.6);
  ctx.stroke();
  const a = 1.6;
  const hx = x + Math.cos(a) * r, hy = y + Math.sin(a) * r;
  const hl = r * 0.6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(hx + Math.cos(a + 1.9) * hl, hy + Math.sin(a + 1.9) * hl);
  ctx.lineTo(hx + Math.cos(a + 0.4) * hl, hy + Math.sin(a + 0.4) * hl);
  ctx.lineTo(hx, hy);
  ctx.closePath();
  ctx.fill();
}

function fitFont(text, w, h, max) {
  const f = Math.min(max, w / (0.62 * text.length), h * 0.5);
  return Math.max(9, Math.round(f));
}

function drawMoveButton(c, focused) {
  const { x, y, w, h } = c.rect;
  ctx.save();
  if (focused) { ctx.shadowColor = GOLD; ctx.shadowBlur = 14 * GLOW; }
  else { ctx.shadowColor = NEON; ctx.shadowBlur = 6 * GLOW; }
  roundRect(x, y, w, h, Math.min(9, h * 0.18));
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = focused ? GOLD : BLUE;
  ctx.lineWidth = focused ? 3 : 2;
  ctx.stroke();
  drawArrowIcon(x + w * 0.24, y + h / 2, clamp(h * 0.2, 7, 12), focused ? GOLD : NEON);
  ctx.fillStyle = focused ? GOLD : ICE;
  ctx.font = 'bold ' + Math.max(12, Math.round(Math.min(L.fonts.btn, h * 0.48, w * 0.36))) + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.label, x + w * 0.62, y + h / 2 + 1);
  ctx.restore();
}

function drawActionButton(c, focused, danger) {
  const { x, y, w, h } = c.rect;
  ctx.save();
  if (focused) { ctx.shadowColor = GOLD; ctx.shadowBlur = 14 * GLOW; }
  else if (danger) { ctx.shadowColor = RED; ctx.shadowBlur = 8 * GLOW; }
  else { ctx.shadowColor = NEON; ctx.shadowBlur = 6 * GLOW; }
  roundRect(x, y, w, h, Math.min(9, h * 0.18));
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = focused ? GOLD : (danger ? RED : BLUE);
  ctx.lineWidth = focused ? 3 : 2;
  ctx.stroke();
  ctx.fillStyle = focused ? GOLD : (danger ? PINK : ICE);
  ctx.font = 'bold ' + fitFont(c.label, w - 14, h, L.fonts.action) + 'px monospace';
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
  const pad = L.knob;
  const cx = ccx(C[key]), cy = ccy(C[key]);
  ctx.save();
  if (vertical) {
    // track
    ctx.strokeStyle = focused ? NEON : BLUE;
    ctx.lineWidth = Math.max(3, 5 * L.u);
    ctx.beginPath();
    ctx.moveTo(cx, r.y + pad);
    ctx.lineTo(cx, r.y + r.h - pad);
    ctx.stroke();
    // ticks every 90°
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2;
    const tick = 12 * clamp(L.u, 0.8, 1.4);
    for (let d = 0; d < 360; d += 90) {
      const ty = r.y + pad + (d / 360) * (r.h - 2 * pad);
      ctx.beginPath();
      ctx.moveTo(cx - tick, ty);
      ctx.lineTo(cx + tick, ty);
      ctx.stroke();
    }
    // knob
    const ky = r.y + pad + t * (r.h - 2 * pad);
    ctx.shadowColor = NEON;
    ctx.shadowBlur = (focused ? 14 : 8) * GLOW;
    ctx.beginPath();
    ctx.arc(cx, ky, L.knob, 0, Math.PI * 2);
    ctx.fillStyle = focused ? GOLD : NEON;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = focused ? WHITE : ICE;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = focused ? NEON : BLUE;
    ctx.lineWidth = Math.max(3, 5 * L.u);
    ctx.beginPath();
    ctx.moveTo(r.x + pad, cy);
    ctx.lineTo(r.x + r.w - pad, cy);
    ctx.stroke();
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 2;
    const tick = 12 * clamp(L.u, 0.8, 1.4);
    for (let d = 0; d < 360; d += 90) {
      const tx = r.x + pad + (d / 360) * (r.w - 2 * pad);
      ctx.beginPath();
      ctx.moveTo(tx, cy - tick);
      ctx.lineTo(tx, cy + tick);
      ctx.stroke();
    }
    const kx = r.x + pad + t * (r.w - 2 * pad);
    ctx.shadowColor = NEON;
    ctx.shadowBlur = (focused ? 14 : 8) * GLOW;
    ctx.beginPath();
    ctx.arc(kx, cy, L.knob, 0, Math.PI * 2);
    ctx.fillStyle = focused ? GOLD : NEON;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = focused ? WHITE : ICE;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // value readout (position decided by the active layout)
  const vp = key === 'vslide' ? L.labels.vViewVal : L.labels.hViewVal;
  if (vp) {
    ctx.fillStyle = ICE;
    ctx.font = 'bold ' + L.fonts.slider + 'px monospace';
    ctx.textAlign = vp.align === 'left' ? 'left' : 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(deg) + '°', vp.x, vp.y);
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
  ctx.fillRect(0, 0, VW, VH);
  // faint tech grid
  const step = 40 * clamp(L.u, 0.85, 1.5);
  ctx.strokeStyle = PANEL;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = step; i < VW; i += step) { ctx.moveTo(i, 0); ctx.lineTo(i, VH); }
  for (let j = step; j < VH; j += step) { ctx.moveTo(0, j); ctx.lineTo(VW, j); }
  ctx.stroke();
  // frame (kept inside the safe area)
  const o = 6;
  const fx = insets.l + o, fy = insets.t + o;
  const fw = VW - insets.l - insets.r - 2 * o;
  const fh = VH - insets.t - insets.b - 2 * o;
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 3;
  ctx.strokeRect(fx, fy, fw, fh);
  ctx.strokeStyle = NEON;
  ctx.lineWidth = 1;
  ctx.strokeRect(fx + 6, fy + 6, fw - 12, fh - 12);
}

function bestStr() {
  return (best.time === null ? '--:--.-' : fmtTime(best.time)) + ' / ' +
         (best.moves === null ? '---' : best.moves) + ' mv';
}

function drawHUD(now) {
  const t = timerOn ? performance.now() - startTime : elapsed;
  const top = insets.t;
  const padL = insets.l + Math.max(10, VW * 0.014);
  const padR = VW - insets.r - Math.max(10, VW * 0.014);
  ctx.save();
  ctx.textBaseline = 'middle';
  // logo
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 10 * GLOW;
  ctx.fillStyle = GOLD;
  ctx.font = 'bold ' + L.fonts.hudLogo + 'px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('RUBIX', padL, top + L.hudH * (portrait ? 0.32 : 0.5));
  ctx.shadowBlur = 0;
  // best record
  if (portrait) {
    // narrow screen: second line under the logo
    const by = top + L.hudH * 0.74;
    ctx.font = 'bold ' + L.fonts.hudSmall + 'px monospace';
    ctx.fillStyle = DIM;
    ctx.fillText('BEST ', padL, by);
    ctx.fillStyle = ICE;
    ctx.fillText(bestStr(), padL + ctx.measureText('BEST ').width, by);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = DIM;
    ctx.font = 'bold ' + L.fonts.hudSmall + 'px monospace';
    ctx.fillText('BEST', padR, top + L.hudH * 0.30);
    ctx.fillStyle = ICE;
    ctx.font = 'bold ' + L.fonts.hudValSm + 'px monospace';
    ctx.fillText(bestStr(), padR, top + L.hudH * 0.66);
  }
  // time + moves
  const statX = portrait ? [VW * 0.58, VW * 0.84] : [VW * 0.40, VW * 0.58];
  ctx.textAlign = 'center';
  for (let i = 0; i < 2; i++) {
    const x = statX[i];
    ctx.fillStyle = DIM;
    ctx.font = 'bold ' + L.fonts.hudLabel + 'px monospace';
    ctx.fillText(i === 0 ? 'TIME' : 'MOVES', x, top + L.hudH * 0.30);
    ctx.fillStyle = i === 0 ? WHITE : LIME;
    ctx.font = 'bold ' + L.fonts.hudVal + 'px monospace';
    ctx.fillText(i === 0 ? fmtTime(t) : String(moves).padStart(3, '0'), x, top + L.hudH * 0.70);
  }
  // divider under the HUD strip
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(insets.l, top + L.hudH + 1);
  ctx.lineTo(VW - insets.r, top + L.hudH + 1);
  ctx.stroke();
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
  const cx = VW / 2;
  const m = Math.min(VW, VH);
  // decorative spinning cube
  const sc = clamp(Math.min(VW * 0.16, VH * 0.09), 28, 80);
  const cy = VH * 0.26;
  const a = now * 0.00045;
  drawCube(cx, cy, sc, a, 0.5, now);
  // holo ring
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy + sc * 2.6, sc * 2.7, sc * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  // logo
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (blinkOn(now)) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold ' + Math.round(clamp(m * 0.03, 14, 22)) + 'px monospace';
    ctx.fillText(isCoarse ? 'TAP TO START' : 'TAP OR PRESS ANY KEY TO START', cx, VH * 0.55);
  }
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 26 * GLOW;
  ctx.fillStyle = WHITE;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.155, 36, 92)) + 'px monospace';
  ctx.fillText('RUBIX', cx, VH * 0.66);
  ctx.shadowBlur = 12 * GLOW;
  ctx.fillStyle = NEON;
  ctx.fillText('RUBIX', cx, VH * 0.66);
  ctx.shadowBlur = 0;
  ctx.fillStyle = ICE;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.022, 10, 18)) + 'px monospace';
  ctx.fillText('A R C A D I C   C U B E   S O L V E R', cx, VH * 0.735);
  if (best.time !== null) {
    ctx.fillStyle = LIME;
    ctx.font = 'bold ' + Math.round(clamp(m * 0.02, 11, 16)) + 'px monospace';
    ctx.fillText('RECORD  ' + fmtTime(best.time) + '  ·  ' + best.moves + ' MOVES', cx, VH * 0.785);
  }
  ctx.fillStyle = DIM;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.017, 9, 14)) + 'px monospace';
  ctx.fillText(isCoarse
    ? 'TAP BUTTONS TO ROTATE SLICES · DRAG SLIDERS TO ROTATE VIEW'
    : 'ARROW KEYS NAVIGATE  ·  ENTER / SPACE CONFIRM  ·  SLIDERS ROTATE VIEW', cx, VH * 0.92);
  ctx.restore();
}

function drawPlay(now) {
  drawBackground();
  drawHUD(now);
  // section labels (positions decided by the active layout)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = DIM;
  ctx.font = 'bold ' + L.fonts.section + 'px monospace';
  const lb = L.labels;
  const label = (txt, l) => {
    if (!l) return;
    ctx.textAlign = l.align === 'left' ? 'left' : 'center';
    ctx.fillText(txt, l.x, l.y);
    ctx.textAlign = 'center';
  };
  label('VERTICAL SLICES · CLOCKWISE', lb.vSlices);
  if (lb.hSlices) {
    if (lb.hSlices.rot) {
      ctx.save();
      ctx.translate(lb.hSlices.x, lb.hSlices.y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('HORIZONTAL SLICES', 0, 0);
      ctx.restore();
    } else label('HORIZONTAL SLICES', lb.hSlices);
  }
  label('VERTICAL VIEW', lb.vView);
  label('HORIZONTAL VIEW', lb.hView);
  ctx.restore();
  // holo ring under cube
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(L.ring.cx, L.ring.cy, L.ring.rx, L.ring.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // the cube
  drawCube(L.cube.cx, L.cube.cy, L.cube.scale, yaw, pitch, now);
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
  const cx = VW / 2;
  const m = Math.min(VW, VH);
  drawCube(cx, VH * 0.24, clamp(Math.min(VW * 0.14, VH * 0.09), 24, 60), -Math.PI / 4, -0.35, now);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = LIME;
  ctx.shadowBlur = 18 * GLOW;
  ctx.fillStyle = LIME;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.065, 20, 46)) + 'px monospace';
  ctx.fillText('CUBE SOLVED', cx, VH * 0.47);
  ctx.shadowBlur = 0;
  const sx = Math.max(VW * 0.16, 80);
  ctx.fillStyle = DIM;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.02, 11, 16)) + 'px monospace';
  ctx.fillText('TIME', cx - sx, VH * 0.56);
  ctx.fillText('MOVES', cx + sx, VH * 0.56);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.045, 16, 34)) + 'px monospace';
  ctx.fillText(fmtTime(elapsed), cx - sx, VH * 0.625);
  ctx.fillStyle = LIME;
  ctx.fillText(String(moves), cx + sx, VH * 0.625);
  if (endRecT || endRecM) {
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 14 * GLOW;
    ctx.fillStyle = GOLD;
    ctx.font = 'bold ' + Math.round(clamp(m * 0.035, 14, 24)) + 'px monospace';
    if (endRecT && endRecM) ctx.fillText('★ DOUBLE NEW RECORD ★', cx, VH * 0.70);
    else if (endRecT) ctx.fillText('★ NEW RECORD — TIME ★', cx, VH * 0.70);
    else ctx.fillText('★ NEW RECORD — MOVES ★', cx, VH * 0.70);
    ctx.shadowBlur = 0;
  }
  if (blinkOn(now)) {
    ctx.fillStyle = ICE;
    ctx.font = 'bold ' + Math.round(clamp(m * 0.028, 13, 20)) + 'px monospace';
    ctx.fillText(isCoarse ? 'TAP TO PLAY AGAIN' : 'PRESS ENTER OR TAP TO PLAY AGAIN', cx, VH * 0.845);
  }
  ctx.fillStyle = DIM;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.018, 10, 14)) + 'px monospace';
  ctx.fillText('BEST  ' + fmtTime(best.time) + '  ·  ' + best.moves + ' MOVES', cx, VH * 0.925);
  ctx.restore();
}

/* ---------------- input ---------------- */
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return [
    (e.clientX - r.left) / r.width * VW,
    (e.clientY - r.top) / r.height * VH
  ];
}
function inRect(p, r, pad = L.touchPad) {
  return p[0] >= r.x - pad && p[0] <= r.x + r.w + pad &&
         p[1] >= r.y - pad && p[1] <= r.y + r.h + pad;
}
function applySliderAt(key, p) {
  const r = C[key].rect;
  const pad = L.knob;
  let t;
  if (key === 'hslide') t = (p[0] - (r.x + pad)) / (r.w - 2 * pad);
  else t = (p[1] - (r.y + pad)) / (r.h - 2 * pad);
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
    if (inRect(p, C[k].rect, L.touchPad + 4)) {
      focusIdx = focusList.indexOf(k);
      applySliderAt(k, p);
      dragKey = k;
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
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
/* block browser zoom gestures so play feels native */
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

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
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (screen === 'title') drawTitle(now);
  else if (screen === 'play') drawPlay(now);
  else drawEnd(now);
  requestAnimationFrame(frame);
}
resetCube();
resize();
frame(performance.now());            // draws immediately, then chains rAF

/* test hook (harmless in normal browser use) */
if (typeof window !== 'undefined' && window.__RUBIX_TEST__) {
  window.__rubix = {
    state: () => ({ VW, VH, portrait, insets, L, C, focusList, screen }),
    setScreen: (s) => { screen = s; },
    startGame,
    draw: () => frame(performance.now())
  };
}
