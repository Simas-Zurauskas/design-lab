// src/_lab/canvas/view-math.js — the canvas's pan / zoom / fit maths. Expected values are worked out by hand from
// the definitions: a view maps world → canvas as p = world * k + (x, y).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript } from './support/run-script.mjs';

const { viewMath: m } = runScript('src/_lab/canvas/view-math.js', { Lab: {} }).Lab;
const plain = (v) => ({ ...v }); // views come from another realm: compare as plain objects

test('zoom is clamped to 5%–400%', () => {
  assert.equal(m.clampK(10), 4);
  assert.equal(m.clampK(0.001), 0.05);
  assert.equal(m.clampK(1), 1);
});

test('zooming around a point keeps the world point under it in place', () => {
  // world point under (300, 200) before: ((300-100)/1, (200-50)/1) = (200, 150); at k=2 it must still be there
  assert.deepEqual(plain(m.zoomAround({ x: 100, y: 50, k: 1 }, 2, { x: 300, y: 200 })), { k: 2, x: -100, y: -100 });
  assert.equal(m.zoomAround({ x: 0, y: 0, k: 1 }, 100, { x: 0, y: 0 }).k, 4); // and the zoom stays in range
});

test('fitting centers the rect, below the title room, and never zooms past 100%', () => {
  const vp = { w: 1000, h: 800 }; // usable: 920 × 640 (40 padding each side, 40 title room, 40 toolbar room)
  assert.deepEqual(plain(m.fitRect({ x: 0, y: 0, w: 460, h: 320 }, vp)), { k: 1, x: 270, y: 240 });
  // twice as wide as the room: k = 0.5, centered, offset by the rect's own origin
  assert.deepEqual(plain(m.fitRect({ x: 100, y: 200, w: 1840, h: 640 }, vp)), { k: 0.5, x: -10, y: 140 });
  assert.deepEqual(plain(m.fitRect({ x: 0, y: 0, w: 0, h: 0 }, vp)), { k: 1, x: 40, y: 80 }); // nothing to fit
});

test('fitting keeps clear of a panel covering the left edge of the canvas', () => {
  const vp = { w: 1000, h: 800 };
  // 200 px covered: usable width 1000 - 200 - 80 = 720. A 1440-wide rect fits at 0.5 (720 / 1440), starting right
  // of the panel + padding: x = 200 + 40 + (720 - 720) / 2 = 240; height 640 * 0.5 = 320 centered in 640 → y = 240
  assert.deepEqual(plain(m.fitRect({ x: 0, y: 0, w: 1440, h: 640 }, vp, 40, 200)), { k: 0.5, x: 240, y: 240 });
  // a small rect is centered in what's left: x = 240 + (720 - 460) / 2 = 370
  assert.deepEqual(plain(m.fitRect({ x: 0, y: 0, w: 460, h: 320 }, vp, 40, 200)), { k: 1, x: 370, y: 240 });
});

test('the view can never be panned so far that less than 96 px of content stays on screen', () => {
  const vp = { w: 1000, h: 800 };
  const content = { w: 2000, h: 1000 };
  assert.deepEqual(plain(m.clampView({ x: 5000, y: 0, k: 1 }, vp, content)), { k: 1, x: 904, y: 0 }); // 1000 - 96
  assert.deepEqual(plain(m.clampView({ x: -5000, y: -5000, k: 1 }, vp, content)), { k: 1, x: -1904, y: -904 }); // 96 - 2000, 96 - 1000
});

test('zoom steps go to the next stop, and stop at the limits', () => {
  assert.equal(m.step(1, 1), 1.25);
  assert.equal(m.step(1, -1), 0.75);
  assert.equal(m.step(0.9, 1), 1);
  assert.equal(m.step(1.0005, 1), 1.25); // a hair off a stop counts as on it
  assert.equal(m.step(4, 1), 4);
  assert.equal(m.step(0.05, -1), 0.05);
});

test('the view rect is the world the canvas shows, grown by a margin in canvas px', () => {
  const vp = { w: 1000, h: 800 };
  // world point at canvas (0, 0) is (-x/k, -y/k); the canvas spans vp / k world units
  assert.deepEqual(plain(m.viewRect({ x: -200, y: 100, k: 0.5 }, vp)), { x: 400, y: -200, w: 2000, h: 1600 });
  // 100 canvas px of margin = 200 world units at 50%, on every side
  assert.deepEqual(plain(m.viewRect({ x: -200, y: 100, k: 0.5 }, vp, 100)), { x: 200, y: -400, w: 2400, h: 2000 });
});

test('rects overlap when they share area — touching edges do not', () => {
  const a = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(m.overlaps(a, { x: 50, y: 50, w: 100, h: 100 }), true);
  assert.equal(m.overlaps(a, { x: 10, y: 10, w: 10, h: 10 }), true); // inside
  assert.equal(m.overlaps(a, { x: 100, y: 0, w: 50, h: 50 }), false); // touching on the right
  assert.equal(m.overlaps(a, { x: 0, y: -60, w: 50, h: 50 }), false); // above
});
