// src/_lab/core/lab.js — the parts every other lab script leans on: who hosts a page, the canvas's shortcut list
// (shared by the canvas and every screen), and the message protocol between frames.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScript } from './support/run-script.mjs';

/**
 * a page's globals — `frame`: what window.frameElement returns (undefined = not framed at all)
 * @param {{ frame?: { closest(selector: string): object | null } | null, protocol?: string }} [page]
 */
const load = ({ frame, protocol = 'http:' } = {}) => {
  const listeners = [];
  const g = {
    location: { protocol, href: `${protocol}//lab.test/wireframes/screen-01.html` },
    Element: class {},
    performance: {},
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    removeEventListener: () => {},
    setTimeout,
  };
  // lab.js only compares self with top: framed = top is some other window
  const self = {};
  const sandbox = runScript('src/_lab/core/lab.js', { ...g, self, top: frame === undefined ? self : {}, frameElement: frame ?? null });
  return { Lab: sandbox.Lab, listeners };
};
const frameIn = (selectorsItMatches) => ({ closest: (sel) => (selectorsItMatches.some((s) => sel.includes(s)) ? {} : null) });

test('a page that is not in a frame hosts itself', () => {
  assert.equal(load().Lab.hosted, false);
});

test('a screen inside a canvas or the full-screen viewer is hosted by the lab', () => {
  assert.equal(load({ frame: frameIn(['[data-canvas]']) }).Lab.hosted, true);
  assert.equal(load({ frame: frameIn(['.lab-viewer']) }).Lab.hosted, true);
});

test('a lab page embedded by someone else (a Notion embed) is framed but not hosted', () => {
  assert.equal(load({ frame: null, protocol: 'https:' }).Lab.hosted, false); // cross-origin parent over https
  assert.equal(load({ frame: frameIn([]) }).Lab.hosted, false); // same-origin parent that isn't a canvas / viewer
});

test('on file:// a cross-origin parent can only be the lab', () => {
  assert.equal(load({ frame: null, protocol: 'file:' }).Lab.hosted, true);
});

test('canvas shortcuts: one list for the canvas and for screens that pass keys up', () => {
  const { Lab } = load();
  const key = (key, mods = {}) => Lab.canvasKey({ key, code: mods.code ?? '', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });
  assert.equal(key('+'), 'in');
  assert.equal(key('='), 'in');
  assert.equal(key('+', { ctrlKey: true }), 'in'); // beats browser zoom
  assert.equal(key('', { code: 'NumpadAdd' }), 'in');
  assert.equal(key('-'), 'out');
  assert.equal(key('_'), 'out');
  assert.equal(key('!', { shiftKey: true, code: 'Digit1' }), 'fit');
  assert.equal(key(')', { shiftKey: true, code: 'Digit0' }), 'actual');
  assert.equal(key('?', { shiftKey: true }), 'help');
  assert.equal(key('?', { ctrlKey: true }), null); // browser / OS shortcuts stay theirs
  assert.equal(key('!', { metaKey: true, shiftKey: true, code: 'Digit1' }), null);
  assert.equal(key('+', { altKey: true }), null);
  assert.equal(key('a'), null);
});

test('messages: a known type is posted in the lab envelope; an unknown one throws', () => {
  const { Lab } = load();
  const sent = [];
  const target = { postMessage: (data, origin) => sent.push({ data: { ...data }, origin }) };
  Lab.post(target, 'canvas:links', { page: 'p', lab: 'forged' });
  assert.deepEqual(sent, [{ data: { page: 'p', lab: 'canvas:links' }, origin: '*' }]);
  assert.throws(() => Lab.post(target, 'canvas:link'), /unknown message type "canvas:link"/);
  assert.throws(() => Lab.on('hotspot:mode', () => {}), /unknown message type/);
});

test('messages: a handler hears only its own type', () => {
  const { Lab, listeners } = load();
  const heard = [];
  Lab.on('canvas:hover', (d) => heard.push(d.index));
  const deliver = (data) => listeners.filter((l) => l.type === 'message').forEach((l) => l.fn({ data }));
  deliver({ lab: 'canvas:hover', index: 3 });
  deliver({ lab: 'canvas:links', index: 4 });
  deliver('not a lab message');
  deliver(null);
  assert.deepEqual(heard, [3]);
});
