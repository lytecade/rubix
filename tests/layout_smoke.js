'use strict';
/* Headless smoke test for RUBIX responsive layout.
 * Shims a minimal DOM/canvas, loads game.js, then drives resize()
 * across a matrix of device viewports (portrait + landscape) and
 * validates every computed control rect. */

const noop = () => {};

/* ---- canvas 2D context stub: every method no-ops, setters accept ---- */
function makeCtx() {
  const ctx = { canvas: null };
  const methods = ['setTransform', 'beginPath', 'moveTo', 'lineTo', 'closePath',
    'fill', 'stroke', 'arc', 'arcTo', 'ellipse', 'save', 'restore',
    'fillText', 'strokeText', 'translate', 'rotate', 'clearRect', 'fillRect',
    'strokeRect', 'drawImage', 'scale'];
  for (const m of methods) ctx[m] = noop;
  ctx.measureText = () => ({ width: 10 });
  return new Proxy(ctx, {
    set(t, p, v) { t[p] = v; return true; },
    get(t, p) { return t[p]; }
  });
}

/* ---- element stubs ---- */
function makeDiv() {
  return { style: {}, offsetWidth: 0, offsetHeight: 0 };
}
const canvasStub = {
  style: {},
  width: 0,
  height: 0,
  getContext: () => makeCtx(),
  addEventListener: noop,
  setPointerCapture: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: win.innerWidth, height: win.innerHeight })
};

/* ---- window/document shims ---- */
const listeners = {};
const win = {
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 2,
  matchMedia: () => ({ matches: true, addEventListener: noop, addListener: noop }),
  visualViewport: null,
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  __RUBIX_TEST__: true
};
const doc = {
  getElementById: () => canvasStub,
  createElement: () => makeDiv(),
  addEventListener: noop,
  body: { appendChild: noop, removeChild: noop }
};

global.window = win;
global.document = doc;
try {
  Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 5 }, configurable: true });
} catch (e) { /* node may expose navigator as getter-only; game.js guards usage */ }
global.requestAnimationFrame = () => 0;   // don't loop

require('../game.js');

const api = win.__rubix;
if (!api) throw new Error('test hook missing');

const resizeHandlers = listeners['resize'] || [];
const orientHandlers = listeners['orientationchange'] || [];
console.log(`resize listeners: ${resizeHandlers.length}, orientationchange: ${orientHandlers.length}`);

function setViewport(w, h) {
  win.innerWidth = w;
  win.innerHeight = h;
  resizeHandlers.forEach(f => f());
}

const CONTROL_KEYS = ['vL', 'vM', 'vR', 'hU', 'hM', 'hD', 'vslide', 'hslide', 'reset', 'shuffle', 'quit'];

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

let failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.log('  FAIL: ' + msg); }
}

function validateViewport(name, w, h, minTarget) {
  setViewport(w, h);
  const s = api.state();
  console.log(`\n== ${name} (${w}x${h}) -> ${s.portrait ? 'PORTRAIT' : 'LANDSCAPE'}, u=${s.L.u.toFixed(2)}`);

  check(s.portrait === (h > w), `${name}: orientation detection`);
  check(Number.isFinite(s.VW) && Number.isFinite(s.VH), `${name}: VW/VH finite`);
  check(s.L.cube.scale >= 24 && Number.isFinite(s.L.cube.scale), `${name}: cube scale sane (${s.L.cube.scale})`);
  // cube must be on screen
  check(s.L.cube.cx > 0 && s.L.cube.cx < w && s.L.cube.cy > 0 && s.L.cube.cy < h,
    `${name}: cube center on screen`);

  const buttons = [];
  for (const k of CONTROL_KEYS) {
    const r = s.C[k].rect;
    check(Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.w) && Number.isFinite(r.h),
      `${name}: ${k} rect finite`);
    check(r.w >= 20 && r.h >= 20, `${name}: ${k} min size (${r.w.toFixed(0)}x${r.h.toFixed(0)})`);
    check(r.x >= -2 && r.y >= -2 && r.x + r.w <= w + 2 && r.y + r.h <= h + 2,
      `${name}: ${k} inside viewport (${r.x.toFixed(0)},${r.y.toFixed(0)} ${r.w.toFixed(0)}x${r.h.toFixed(0)})`);
    if (k !== 'vslide' && k !== 'hslide') {
      check(r.h >= minTarget, `${name}: ${k} touch height >= ${minTarget} (${r.h.toFixed(0)})`);
      buttons.push({ k, ...r });
    }
  }
  // buttons must not overlap each other
  for (let i = 0; i < buttons.length; i++)
    for (let j = i + 1; j < buttons.length; j++)
      check(!overlaps(buttons[i], buttons[j]),
        `${name}: ${buttons[i].k} overlaps ${buttons[j].k}`);

  // labels must be inside the viewport
  for (const [lk, lp] of Object.entries(s.L.labels)) {
    if (!lp) continue;
    check(Number.isFinite(lp.x) && Number.isFinite(lp.y), `${name}: label ${lk} finite`);
    check(lp.y >= -2 && lp.y <= h + 2, `${name}: label ${lk} y in range (${lp.y.toFixed(0)})`);
  }

  // render one frame on title, play and end screens (catches draw-time errors)
  api.setScreen('title'); api.draw();
  api.startGame(); api.draw();
  api.setScreen('end'); api.draw();
  api.setScreen('play');
  return s;
}

/* ---- device matrix ---- */
validateViewport('iPhone 15 portrait', 393, 852, 44);
validateViewport('iPhone 15 landscape', 852, 393, 40);
validateViewport('small Android portrait', 360, 640, 42);
validateViewport('small Android landscape', 640, 360, 40);
validateViewport('iPhone SE landscape', 568, 320, 38);
validateViewport('Pixel 7 landscape', 915, 412, 40);
validateViewport('tablet portrait', 768, 1024, 44);
validateViewport('tablet landscape', 1024, 768, 44);
validateViewport('laptop', 1280, 720, 40);
validateViewport('desktop FHD', 1920, 1080, 40);
validateViewport('ultrawide', 3440, 1440, 40);
validateViewport('tiny window', 400, 350, 30);

/* ---- mid-game orientation flip must keep working ---- */
setViewport(393, 852);
api.startGame();
api.draw();
setViewport(852, 393);   // rotate mid-play
api.draw();
const s2 = api.state();
check(s2.portrait === false, 'mid-play rotation -> landscape');
check(s2.screen === 'play', 'mid-play rotation keeps play screen');

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED ✔' : `${failures} CHECKS FAILED ✘`));
process.exit(failures === 0 ? 0 : 1);
