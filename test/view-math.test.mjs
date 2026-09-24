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
