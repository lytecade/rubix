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

/* 90° slice moves around axes X, Y, and Z.
 * dir = -1 (clockwise, default for legacy buttons) or +1 (counter-clockwise). */
function moveQuat(axis, dir = -1) {
  const a = dir * (Math.PI / 2);
  if (axis === 'x') return Q.axisAngle(1, 0, 0, a);
  if (axis === 'y') return Q.axisAngle(0, 1, 0, a);
  return Q.axisAngle(0, 0, 1, a);
}

function applyMove(axis, layer, dir = -1) { // commit instantly
  const qa = moveQuat(axis, dir);
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
const DEFAULT_VIEW_DEG = 35;
const DEFAULT_VIEW_RAD = DEFAULT_VIEW_DEG * Math.PI / 180;
let yaw = DEFAULT_VIEW_RAD, pitch = DEFAULT_VIEW_RAD; // view rotation (radians)
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
  for (const ax of ['x', 'y', 'z']) {
    for (const l of [-1, 0, 1]) {
      for (const d of [-1, 1]) {
        all.push([ax, l, d]);
      }
    }
  }
  let prev = -1;
  for (let i = 0; i < 28; i++) {
    let j;
    do { j = Math.floor(Math.random() * all.length); } while (j === prev);
    prev = j;
    applyMove(all[j][0], all[j][1], all[j][2]);
  }
  if (isSolved()) reshuffle();
  moves = 0;
  timerOn = false;
  startTime = 0;
  elapsed = 0;
  yaw = DEFAULT_VIEW_RAD;
  pitch = DEFAULT_VIEW_RAD;
  anim = null;
  pending = null;
}

function startGame() {
  reshuffle();
  yaw = DEFAULT_VIEW_RAD;
  pitch = DEFAULT_VIEW_RAD;
  screen = 'play';
}

function doMove(axis, layer, dir = -1) {
  if (anim) { pending = { axis, layer, dir }; return; }
  if (!timerOn) { timerOn = true; startTime = performance.now(); }
  moves++;
  anim = { axis, layer, dir, start: performance.now(), dur: 170 };
}

function commitAnim(now) {
  applyMove(anim.axis, anim.layer, anim.dir);
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
    doMove(p.axis, p.layer, p.dir);
  }
}

/* ---------------- layout / controls ----------------
 * Control types / actions are fixed; their rects are recomputed by
 * computeLayout() for the current viewport, orientation & device class. */
const C = {
  vslide:  { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'vslide' },
  hslide:  { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'hslide' },
  reset:   { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'reset',   label: 'RESET VIEW' },
  shuffle: { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'shuffle', label: 'SHUFFLE' },
  quit:    { rect: { x: 0, y: 0, w: 0, h: 0 }, type: 'quit',    label: 'QUIT' }
};
const controlKeys = ['vslide', 'hslide', 'reset', 'shuffle', 'quit'];
const actionKeys = ['reset', 'shuffle', 'quit'];

const ccx = (c) => c.rect.x + c.rect.w / 2;
const ccy = (c) => c.rect.y + c.rect.h / 2;
const isSlideKey = (k) => k === 'vslide' || k === 'hslide';

/* computed layout, refreshed on every resize / orientation change */
const L = {
  u: 1,                 // global UI size multiplier
  hudTop: 12,
  hudH: 60,
  touchPad: 12,         // hit-test padding around controls
  knob: 13,             // slider knob radius
  cube: { cx: 0, cy: 0, scale: 50 },
  fonts: {},
  labels: {}
};

function setRect(c, x, y, w, h) {
  c.rect.x = x; c.rect.y = y; c.rect.w = Math.max(20, w); c.rect.h = Math.max(20, h);
}

function computeLayout() {
  portrait = VH > VW;
  const m = Math.min(VW, VH);
  L.u = clamp(m / 800, 0.74, 1.6);
  L.touchPad = isCoarse ? 16 : 10;
  L.knob = Math.round(clamp(13 * L.u, isCoarse ? 11 : 9, 17));
  const r = Math.round;
  L.fonts = {
    hudLogo:  r(clamp(26 * L.u, 18, 42)),
    hudLabel: r(clamp(12.5 * L.u, 9, 18)),
    hudVal:   r(clamp(24 * L.u, 15, 34)),
    hudValSm: r(clamp(15 * L.u, 11, 20)),
    hudSmall: r(clamp(13 * L.u, 9, 16)),
    action:   r(clamp(16 * L.u, 11, 22)),
    slider:   r(clamp(14 * L.u, 10, 18)),
    section:  r(clamp(12.5 * L.u, 9, 16))
  };
  if (portrait) layoutPortrait();
  else layoutLandscape();
}

/* --- portrait phones/tablets: HUD top, cube + vertical slider middle, horizontal slider + actions bottom --- */
function layoutPortrait() {
  const framePad = 12;
  const padBase = Math.max(14, VW * 0.035);
  const cx0 = insets.l + padBase;                 // content left
  const cx1 = VW - insets.r - padBase;            // content right
  const cw = Math.max(160, cx1 - cx0);

  L.hudTop = insets.t + framePad;
  L.hudH = clamp(VH * 0.088, 56, 86);
  const hudBottom = L.hudTop + L.hudH;

  /* bottom stack: horizontal view slider + action buttons (RESET VIEW, SHUFFLE, QUIT) */
  const bottomPad = insets.b + Math.max(14, VH * 0.018);
  const rowH = clamp(VH * 0.068, 40, 66);
  const midGap = clamp(VH * 0.036, 22, 34);
  const labelLead = clamp(VH * 0.024, 16, 26);

  const btnY = VH - bottomPad - rowH;
  const btnGap = Math.max(8, cw * 0.025);
  const bw = (cw - 2 * btnGap) / 3;
  setRect(C.reset,   cx0,               btnY, bw, rowH);
  setRect(C.shuffle, cx0 + bw + btnGap, btnY, bw, rowH);
  setRect(C.quit,    cx0 + 2 * (bw + btnGap), btnY, bw, rowH);

  const hSlideY = btnY - midGap - rowH;
  setRect(C.hslide, cx0, hSlideY, cw, rowH);
  const controlsTop = hSlideY - labelLead;

  /* middle play zone: vertical slider on left, cube centered in remaining space */
  const areaTop = hudBottom + Math.max(10, VH * 0.015);
  const areaBottom = controlsTop - Math.max(10, VH * 0.015);
  const areaH = Math.max(120, areaBottom - areaTop);

  const sw = clamp(VW * 0.095, 34, 54);
  const vLabelPad = clamp(VH * 0.025, 16, 24);
  const sh = Math.min(clamp(areaH * 0.72, 100, 380), Math.max(70, areaH - 2 * vLabelPad));
  const vSlideY = areaTop + (areaH - sh) / 2;
  setRect(C.vslide, cx0, vSlideY, sw, sh);

  const cubeLeftMin = cx0 + sw + Math.max(10, VW * 0.02);
  const cubeAvailW = Math.max(90, cx1 - cubeLeftMin);
  /* 2.72*scale is the worst-case projected half-extent of the 3x3x3 cube */
  const scale = clamp(Math.min(cubeAvailW / 5.55, areaH / 5.55), 22, 125);
  const cubeCx = clamp(cubeLeftMin + cubeAvailW / 2, cubeLeftMin + scale * 2.75, cx1 - scale * 2.75);
  const cubeCy = areaTop + areaH / 2;
  L.cube = { cx: cubeCx, cy: cubeCy, scale };

  L.labels = {
    vView:    { x: cx0, y: vSlideY - 12, align: 'left' },
    vViewVal: { x: ccx(C.vslide), y: vSlideY + sh + 12, align: 'center' },
    hView:    { x: cx0 + cw / 2, y: hSlideY - Math.max(11, labelLead * 0.5) },
    hViewVal: { x: cx0 + cw / 2, y: hSlideY + rowH + midGap * 0.45 }
  };
}

/* --- landscape phones/tablets/desktops: HUD top, vertical slider left, cube center, actions + horizontal slider bottom --- */
function layoutLandscape() {
  const framePad = 12;
  const padX = Math.max(14, VW * 0.018);
  const left = insets.l + padX;
  const right = VW - insets.r - padX;
  const availW = Math.max(240, right - left);

  L.hudTop = insets.t + framePad;
  L.hudH = clamp(VH * 0.125, 44, 82);
  const hudBottom = L.hudTop + L.hudH;

  /* bottom row: action buttons on the left, horizontal view slider on the right */
  const bottomPad = insets.b + Math.max(12, VH * 0.02);
  const bottomH = clamp(VH * 0.13, 38, 62);
  const bottomY = VH - bottomPad - bottomH;

  const abGap = clamp(VW * 0.009, 6, 14);
  const maxBtnGroup = availW * 0.54;
  const abW = clamp(Math.min(availW * 0.115, (maxBtnGroup - 2 * abGap) / 3), 72, 155);
  setRect(C.reset,   left,                  bottomY, abW, bottomH);
  setRect(C.shuffle, left + abW + abGap,    bottomY, abW, bottomH);
  setRect(C.quit,    left + 2 * (abW + abGap), bottomY, abW, bottomH);

  const btnEnd = left + 3 * abW + 2 * abGap;
  const midGap = clamp(VW * 0.025, 14, 36);
  const maxHsW = Math.max(100, right - (btnEnd + midGap));
  const hsW = clamp(availW * 0.40, 110, Math.min(maxHsW, 480));
  const hsX = right - hsW;
  setRect(C.hslide, hsX, bottomY, hsW, bottomH);

  const hLabelTop = bottomY - clamp(VH * 0.07, 26, 36);

  /* middle play zone: vertical slider left, cube centered */
  const areaTop = hudBottom + Math.max(8, VH * 0.015);
  const areaBottom = hLabelTop - Math.max(6, VH * 0.012);
  const areaH = Math.max(96, areaBottom - areaTop);

  const vsW = clamp(VH * 0.105, 34, 54);
  const vLabelPad = clamp(VH * 0.04, 15, 22);
  const vsH = Math.min(clamp(areaH * 0.72, 80, 380), Math.max(64, areaH - 2 * vLabelPad));
  const vsY = areaTop + (areaH - vsH) / 2;
  setRect(C.vslide, left, vsY, vsW, vsH);

  const cubeLeftMin = left + vsW + Math.max(12, VW * 0.02);
  const cubeAvailW = Math.max(90, right - cubeLeftMin);
  const scale = clamp(Math.min(areaH / 5.55, cubeAvailW / 5.55), 22, 150);
  const cubeCx = clamp(VW / 2, cubeLeftMin + scale * 2.75, right - scale * 2.75);
  const cubeCy = areaTop + areaH / 2;
  L.cube = { cx: cubeCx, cy: cubeCy, scale };

  L.labels = {
    vView:    { x: left, y: vsY - 12, align: 'left' },
    vViewVal: { x: ccx(C.vslide), y: vsY + vsH + 12, align: 'center' },
    hView:    { x: hsX + hsW / 2, y: bottomY - 22 },
    hViewVal: { x: hsX + hsW / 2, y: bottomY - 9 }
  };
}

function setSliderDeg(key, deg) {
  deg = ((deg % 360) + 360) % 360;
  if (key === 'hslide') yaw = deg * Math.PI / 180;
  else pitch = deg * Math.PI / 180;
}
const sliderDeg = (key) => ((key === 'hslide' ? yaw : pitch) * 180 / Math.PI + 360) % 360;

function activate(key) {
  if (key === 'reset') {
    yaw = DEFAULT_VIEW_RAD; pitch = DEFAULT_VIEW_RAD;
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

function getViewQuat(y = yaw, p = pitch) {
  return Q.mul(Q.axisAngle(1, 0, 0, p), Q.axisAngle(0, 1, 0, y));
}

function projectPoint(p, cx, cy, scale, qView) {
  const camD = 9;
  const pv = Q.rot(qView, p);
  const s = camD / (camD - pv[2]);
  return [cx + pv[0] * s * scale, cy - pv[1] * s * scale];
}

function drawCube(cx, cy, scale, viewYaw, viewPitch, now) {
  const qView = getViewQuat(viewYaw, viewPitch);
  const camD = 9;
  const items = [];

  for (const c of cubies) {
    let px = c.x, py = c.y, pz = c.z, q = c.q;
    if (anim && c[anim.axis] === anim.layer) {
      const k = Math.min(1, (now - anim.start) / anim.dur);
      const dir = anim.dir !== undefined ? anim.dir : -1;
      const a = dir * ease(k) * Math.PI / 2;
      const qa = anim.axis === 'x' ? Q.axisAngle(1, 0, 0, a)
               : anim.axis === 'y' ? Q.axisAngle(0, 1, 0, a)
               : Q.axisAngle(0, 0, 1, a);
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
        return projectPoint([px + l[0], py + l[1], pz + l[2]], cx, cy, scale, qView);
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

function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
      (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function hitTestCube(pt) {
  const qView = getViewQuat();
  const cx = L.cube.cx, cy = L.cube.cy, scale = L.cube.scale;
  const items = [];

  for (const c of cubies) {
    let px = c.x, py = c.y, pz = c.z, q = c.q;
    for (const f of FACE_DEFS) {
      const n = Q.rot(q, f.n);
      const nv = Q.rot(qView, n);
      if (nv[2] <= 0.001) continue; // backface cull
      const ctr = Q.rot(qView, [px, py, pz]);
      const verts = f.v.map((v) => {
        const l = Q.rot(q, v);
        return projectPoint([px + l[0], py + l[1], pz + l[2]], cx, cy, scale, qView);
      });
      items.push({
        cubie: c,
        f,
        normal: [Math.round(n[0]), Math.round(n[1]), Math.round(n[2])],
        verts,
        z: ctr[2]
      });
    }
  }

  items.sort((a, b) => a.z - b.z);

  for (let i = items.length - 1; i >= 0; i--) {
    if (pointInPoly(pt, items[i].verts)) {
      return items[i];
    }
  }
  return null;
}

function getFaceTangents(cubie, normal) {
  const qView = getViewQuat();
  const cx = L.cube.cx, cy = L.cube.cy, scale = L.cube.scale;

  const p0 = [
    cubie.x + normal[0] * 0.5,
    cubie.y + normal[1] * 0.5,
    cubie.z + normal[2] * 0.5
  ];
  const s0 = projectPoint(p0, cx, cy, scale, qView);

  let axes = [];
  if (normal[0] !== 0) axes = ['y', 'z'];
  else if (normal[1] !== 0) axes = ['x', 'z'];
  else axes = ['x', 'y'];

  const tangents = [];
  for (const ax of axes) {
    const vec3D = [ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0];
    const p1 = [p0[0] + vec3D[0], p0[1] + vec3D[1], p0[2] + vec3D[2]];
    const s1 = projectPoint(p1, cx, cy, scale, qView);
    const screenVec = [s1[0] - s0[0], s1[1] - s0[1]];
    const len = Math.hypot(screenVec[0], screenVec[1]) || 1;
    const unitScreen = [screenVec[0] / len, screenVec[1] / len];
    tangents.push({
      axis: ax,
      vec3D,
      unitScreen,
      screenLen: len
    });
  }

  return { p0, s0, tangents };
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

function fitFont(text, w, h, max) {
  const f = Math.min(max, w / (0.62 * text.length), h * 0.5);
  return Math.max(9, Math.round(f));
}

function drawActionButton(c, danger) {
  const { x, y, w, h } = c.rect;
  ctx.save();
  if (danger) { ctx.shadowColor = RED; ctx.shadowBlur = 8 * GLOW; }
  else { ctx.shadowColor = NEON; ctx.shadowBlur = 6 * GLOW; }
  roundRect(x, y, w, h, Math.min(9, h * 0.18));
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = danger ? RED : BLUE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = danger ? PINK : ICE;
  ctx.font = 'bold ' + fitFont(c.label, w - 14, h, L.fonts.action) + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawSlider(key) {
  const r = C[key].rect;
  const deg = sliderDeg(key);
  const vertical = key === 'vslide';
  const t = deg / 360;
  const pad = L.knob;
  const cx = ccx(C[key]), cy = ccy(C[key]);
  ctx.save();
  if (vertical) {
    // track
    ctx.strokeStyle = BLUE;
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
    ctx.shadowBlur = 8 * GLOW;
    ctx.beginPath();
    ctx.arc(cx, ky, L.knob, 0, Math.PI * 2);
    ctx.fillStyle = NEON;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ICE;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = BLUE;
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
    ctx.shadowBlur = 8 * GLOW;
    ctx.beginPath();
    ctx.arc(kx, cy, L.knob, 0, Math.PI * 2);
    ctx.fillStyle = NEON;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = ICE;
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
  const top = L.hudTop;
  const padL = insets.l + Math.max(16, VW * 0.018);
  const padR = VW - insets.r - Math.max(16, VW * 0.018);
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
  // time + moves
  const statX = portrait ? [VW * 0.64, VW * 0.87] : [VW * 0.38, VW * 0.57];
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
  // best record
  if (portrait) {
    // narrow screen: second line under the logo, bounded before TIME
    const by = top + L.hudH * 0.74;
    ctx.textAlign = 'left';
    ctx.font = 'bold ' + L.fonts.hudSmall + 'px monospace';
    const timeLeft = statX[0] - L.fonts.hudVal * 2.6;
    const bestLabel = 'BEST ';
    const bestLabelW = ctx.measureText(bestLabel).width;
    const maxValW = Math.max(50, timeLeft - padL - bestLabelW - 8);
    ctx.fillStyle = DIM;
    ctx.fillText(bestLabel, padL, by);
    ctx.fillStyle = ICE;
    ctx.fillText(bestStr(), padL + bestLabelW, by, maxValW);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = DIM;
    ctx.font = 'bold ' + L.fonts.hudSmall + 'px monospace';
    ctx.fillText('BEST', padR, top + L.hudH * 0.30);
    ctx.fillStyle = ICE;
    ctx.font = 'bold ' + L.fonts.hudValSm + 'px monospace';
    ctx.fillText(bestStr(), padR, top + L.hudH * 0.66);
  }
  // divider under the HUD strip (kept inside the inner frame)
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(insets.l + 12, top + L.hudH + 1);
  ctx.lineTo(VW - insets.r - 12, top + L.hudH + 1);
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
  const maxTextW = Math.max(160, VW - insets.l - insets.r - 44);
  // decorative spinning cube
  const sc = clamp(Math.min(VW * 0.15, VH * 0.085), 22, 80);
  const cy = VH * 0.25;
  const a = now * 0.00045;
  drawCube(cx, cy, sc, a, 0.5, now);
  // logo
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (blinkOn(now)) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold ' + Math.round(clamp(m * 0.03, 13, 22)) + 'px monospace';
    ctx.fillText(isCoarse ? 'TAP TO START' : 'CLICK OR TAP TO START', cx, VH * 0.53, maxTextW);
  }
  ctx.shadowColor = NEON;
  ctx.shadowBlur = 26 * GLOW;
  ctx.fillStyle = WHITE;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.145, 34, 92)) + 'px monospace';
  ctx.fillText('RUBIX', cx, VH * 0.635, maxTextW);
  ctx.shadowBlur = 12 * GLOW;
  ctx.fillStyle = NEON;
  ctx.fillText('RUBIX', cx, VH * 0.635, maxTextW);
  ctx.shadowBlur = 0;
  ctx.fillStyle = ICE;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.022, 10, 18)) + 'px monospace';
  ctx.fillText('A R C A D I C   C U B E   S O L V E R', cx, VH * 0.725, maxTextW);
  if (best.time !== null) {
    ctx.fillStyle = LIME;
    ctx.font = 'bold ' + Math.round(clamp(m * 0.02, 10, 16)) + 'px monospace';
    ctx.fillText('RECORD  ' + fmtTime(best.time) + '  ·  ' + best.moves + ' MOVES', cx, VH * 0.785, maxTextW);
  }
  ctx.fillStyle = DIM;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.017, 9, 14)) + 'px monospace';
  ctx.fillText('DRAG A CUBE FACE TO ROTATE ITS SLICE', cx, VH * 0.875, maxTextW);
  ctx.fillText('USE SLIDERS OR DRAG BACKGROUND TO ROTATE VIEW', cx, VH * 0.92, maxTextW);
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
  label('VERTICAL VIEW', lb.vView);
  label('HORIZONTAL VIEW', lb.hView);
  ctx.restore();
  // the cube
  drawCube(L.cube.cx, L.cube.cy, L.cube.scale, yaw, pitch, now);
  // highlight actively dragged cubie face
  if (cubeDrag && !cubeDrag.triggered && cubeDrag.verts) {
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(2, 3 * L.u);
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 12 * GLOW;
    ctx.beginPath();
    ctx.moveTo(cubeDrag.verts[0][0], cubeDrag.verts[0][1]);
    for (let i = 1; i < cubeDrag.verts.length; i++) {
      ctx.lineTo(cubeDrag.verts[i][0], cubeDrag.verts[i][1]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  // controls
  for (const k of actionKeys) drawActionButton(C[k], k === 'quit');
  drawSlider('vslide');
  drawSlider('hslide');
}

function drawEnd(now) {
  drawBackground();
  const cx = VW / 2;
  const m = Math.min(VW, VH);
  const maxTextW = Math.max(160, VW - insets.l - insets.r - 44);
  const sc = clamp(Math.min(VW * 0.14, VH * 0.072), 20, 60);
  drawCube(cx, Math.max(insets.t + 16 + sc * 2.72, VH * 0.24), sc, -Math.PI / 4, -0.35, now);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = LIME;
  ctx.shadowBlur = 18 * GLOW;
  ctx.fillStyle = LIME;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.065, 20, 46)) + 'px monospace';
  ctx.fillText('CUBE SOLVED', cx, VH * 0.47, maxTextW);
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
    if (endRecT && endRecM) ctx.fillText('★ DOUBLE NEW RECORD ★', cx, VH * 0.70, maxTextW);
    else if (endRecT) ctx.fillText('★ NEW RECORD — TIME ★', cx, VH * 0.70, maxTextW);
    else ctx.fillText('★ NEW RECORD — MOVES ★', cx, VH * 0.70, maxTextW);
    ctx.shadowBlur = 0;
  }
  if (blinkOn(now)) {
    ctx.fillStyle = ICE;
    ctx.font = 'bold ' + Math.round(clamp(m * 0.028, 13, 20)) + 'px monospace';
    ctx.fillText(isCoarse ? 'TAP TO PLAY AGAIN' : 'CLICK OR TAP TO PLAY AGAIN', cx, VH * 0.845, maxTextW);
  }
  ctx.fillStyle = DIM;
  ctx.font = 'bold ' + Math.round(clamp(m * 0.018, 10, 14)) + 'px monospace';
  ctx.fillText('BEST  ' + fmtTime(best.time) + '  ·  ' + best.moves + ' MOVES', cx, VH * 0.925, maxTextW);
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
let cubeDrag = null;
let viewDrag = null;

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const now = performance.now();
  if (screen === 'title') { startGame(); return; }
  if (screen === 'end') { if (now >= endReadyAt) startGame(); return; }

  // If a previous move is animating, commit it immediately so input is instantaneous
  if (anim) commitAnim(now);

  const p = toLogical(e);

  // 1. Sliders
  for (const k of ['vslide', 'hslide']) {
    if (inRect(p, C[k].rect, L.touchPad + 4)) {
      applySliderAt(k, p);
      dragKey = k;
      if (canvas.setPointerCapture) {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
      return;
    }
  }

  // 2. Action buttons
  for (const k of actionKeys) {
    if (inRect(p, C[k].rect)) {
      activate(k);
      return;
    }
  }

  // 3. 3D Cube Hit-Test (Direct Slice Drag)
  const hit = hitTestCube(p);
  if (hit) {
    const { s0, tangents } = getFaceTangents(hit.cubie, hit.normal);
    cubeDrag = {
      pointerId: e.pointerId,
      start: p,
      cubie: hit.cubie,
      normal: hit.normal,
      tangents,
      verts: hit.verts,
      triggered: false
    };
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    return;
  }

  // 4. Background Drag (Camera View Orbit)
  viewDrag = {
    pointerId: e.pointerId,
    start: p,
    startYaw: yaw,
    startPitch: pitch
  };
  if (canvas.setPointerCapture) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = toLogical(e);

  // Dynamic cursor style when hovering on play screen
  if (!dragKey && !cubeDrag && !viewDrag && screen === 'play') {
    let overInteractive = false;
    for (const k of controlKeys) {
      if (inRect(p, C[k].rect, isSlideKey(k) ? L.touchPad + 4 : L.touchPad)) {
        overInteractive = true;
        break;
      }
    }
    if (overInteractive) {
      canvas.style.cursor = 'pointer';
    } else if (hitTestCube(p)) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  if (dragKey) {
    applySliderAt(dragKey, p);
    return;
  }

  if (cubeDrag && !cubeDrag.triggered) {
    canvas.style.cursor = 'grabbing';
    const dx = p[0] - cubeDrag.start[0];
    const dy = p[1] - cubeDrag.start[1];
    const delta = [dx, dy];

    const t0 = cubeDrag.tangents[0];
    const t1 = cubeDrag.tangents[1];

    const proj0 = delta[0] * t0.unitScreen[0] + delta[1] * t0.unitScreen[1];
    const proj1 = delta[0] * t1.unitScreen[0] + delta[1] * t1.unitScreen[1];

    const deadZone = Math.max(12, 14 * L.u);
    if (Math.max(Math.abs(proj0), Math.abs(proj1)) >= deadZone) {
      cubeDrag.triggered = true;

      let chosenT, projVal;
      if (Math.abs(proj0) >= Math.abs(proj1)) {
        chosenT = t0;
        projVal = proj0;
      } else {
        chosenT = t1;
        projVal = proj1;
      }

      const sign = projVal > 0 ? 1 : -1;
      const T_3D = [
        sign * chosenT.vec3D[0],
        sign * chosenT.vec3D[1],
        sign * chosenT.vec3D[2]
      ];

      // Cross product R = Normal x T_3D
      const N = cubeDrag.normal;
      const rx = Math.round(N[1] * T_3D[2] - N[2] * T_3D[1]);
      const ry = Math.round(N[2] * T_3D[0] - N[0] * T_3D[2]);
      const rz = Math.round(N[0] * T_3D[1] - N[1] * T_3D[0]);

      let rotAxis, rotDir;
      if (rx !== 0) { rotAxis = 'x'; rotDir = rx; }
      else if (ry !== 0) { rotAxis = 'y'; rotDir = ry; }
      else { rotAxis = 'z'; rotDir = rz; }

      const layer = cubeDrag.cubie[rotAxis];
      doMove(rotAxis, layer, rotDir);
    }
    return;
  }

  if (viewDrag) {
    const dx = p[0] - viewDrag.start[0];
    const dy = p[1] - viewDrag.start[1];
    const sensX = (Math.PI * 2) / Math.max(VW, 400);
    const sensY = (Math.PI * 2) / Math.max(VH, 400);

    yaw = ((viewDrag.startYaw + dx * sensX) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    pitch = ((viewDrag.startPitch + dy * sensY) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    return;
  }
});

function endPointerDrag(e) {
  dragKey = null;
  cubeDrag = null;
  viewDrag = null;
  if (canvas.releasePointerCapture && e && e.pointerId) {
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  }
}
canvas.addEventListener('pointerup', endPointerDrag);
canvas.addEventListener('pointercancel', endPointerDrag);
window.addEventListener('blur', () => { dragKey = null; cubeDrag = null; viewDrag = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
/* block browser zoom gestures so play feels native */
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

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
    state: () => ({ VW, VH, portrait, insets, L, C, controlKeys, screen, anim, pending, moves, yaw, pitch, cubeDrag, viewDrag }),
    setScreen: (s) => { screen = s; },
    startGame,
    activate,
    setSliderDeg,
    sliderDeg,
    DEFAULT_VIEW_DEG,
    DEFAULT_VIEW_RAD,
    draw: () => frame(performance.now()),
    cubies,
    doMove,
    applyMove,
    isSolved,
    hitTestCube,
    getFaceTangents,
    projectPoint,
    getViewQuat,
    pointInPoly
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Q, cubies, resetCube, moveQuat, applyMove, isSolved, doMove,
    hitTestCube, getFaceTangents, projectPoint, getViewQuat, pointInPoly,
    FACE_DEFS, L, C, controlKeys, actionKeys, DEFAULT_VIEW_DEG, DEFAULT_VIEW_RAD
  };
}
