// scripts/links.mjs — `yarn links`: the link map, and the checks that fail it.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { analyze } from '../scripts/links.mjs';

// a small src/ with two sections, a design part, lab chrome, and one of every case the map has to get right
const FILES = {
  'components/part.html': '<a href="screen-02.html">From a part</a>',
  '_lab/chrome.html': '<a href="index.html">‹ Gallery</a>',
  'wf/screen-01.html': `<!doctype html><html><head><title>01 · Home</title></head><body>
    <!-- <a href="screen-99.html">old</a> -->
    <a href='screen-02.html'>Next</a>
    <a href="../other/screen-01.html">Elsewhere</a>
    <a href="#">Later</a>
    <nav><a href="screen-01.html">Home</a></nav>
    <include src="components/part.html"></include>
    <button aria-pressed="false">Chip</button>
    <div role="radiogroup" aria-label="Size"><button role="radio" aria-checked="true">S</button></div>
    <button><i data-lucide="x"></i></button>
    <a href="screen-03.html" aria-label="Onward">→</a>
    <include src="_lab/chrome.html"></include>
  </body></html>`,
  'wf/screen-02.html': '<title>02 · Detail &amp; more</title><a href="screen-01.html" aria-label="Back"><i data-lucide="chevron-left"></i></a>',
  'wf/index.html': `
    <figure class="lab-screen"><figcaption><a href="screen-01.html">01 · Home</a></figcaption><iframe src="screen-01.html" title="Home"></iframe></figure>
    <figure class="lab-screen"><figcaption><a href="screen-02.html">02 · Details</a></figcaption><iframe src="screen-02.html" title="Detail &amp; more"></iframe></figure>`,
  'other/screen-01.html': '<title>01 · Other</title>',
};
let src;
let wf;
before(() => {
  src = mkdtempSync(join(tmpdir(), 'links-'));
  for (const [path, html] of Object.entries(FILES)) {
    mkdirSync(join(src, dirname(path)), { recursive: true });
    writeFileSync(join(src, path), html);
  }
  wf = analyze(src).find((s) => s.name === 'wf');
});
after(() => rmSync(src, { recursive: true, force: true }));

const linkTo = (label) => wf.screens[0].links.find((l) => l.label === `"${label}"`);

test('only sections with screens are listed; lab and part folders are not sections', () => {
  assert.deepEqual(
    analyze(src).map((s) => s.name),
    ['other', 'wf'],
  );
});

test('links are read the way the build reads them', () => {
  assert.equal(linkTo('Next').to, 'screen'); // single-quoted
  assert.equal(linkTo('Next').target.title, '02 · Detail & more'); // entities decoded
  assert.equal(linkTo('From a part').to, 'screen'); // from an <include>d design part
  assert.equal(linkTo('Later').to, 'placeholder');
  assert.deepEqual([linkTo('Home').to, linkTo('Home').nav], ['self', true]);
  assert.deepEqual([linkTo('Elsewhere').to, linkTo('Elsewhere').target], ['page', join('other', 'screen-01.html')]); // exists: not missing
  assert.equal(linkTo('old'), undefined); // inside a comment
  assert.equal(linkTo('‹ Gallery'), undefined); // lab chrome is not design
});

test('controls are classified by their markup', () => {
  const kinds = wf.screens[0].controls.map((c) => c.kind);
  assert.deepEqual(kinds, ['toggle', 'choice', 'inert']);
  assert.deepEqual(wf.screens[0].groups, ['Size']);
});

test('a missing target, an unnamed control and a canvas name out of step with <title> each fail', () => {
  assert.equal(wf.problems.length, 3, wf.problems.join('\n'));
  assert.match(wf.problems[0], /"Onward" links to screen-03\.html — no such page/);
  assert.match(wf.problems[1], /\[icon x\] has no accessible name/);
  assert.match(wf.problems[2], /caption "02 · Details" ≠ <title> "02 · Detail & more"/);
});

test('screens every other screen reaches are not orphans', () => {
  assert.deepEqual(wf.orphans, []);
});
