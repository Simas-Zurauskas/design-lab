// scripts/fix-nested-urls.mjs — the post-build step every nested page's CSS and scripts depend on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixPage, fixDist } from '../scripts/fix-nested-urls.mjs';

// a dist with a shared CSS + JS bundle at the root and one nested section
const files = new Set(['/d/index.html', '/d/styles.css', '/d/app.js', '/d/wireframes/index.html', '/d/wireframes/screen-02.html']);
const exists = (p) => files.has(p);
const fix = (html, pageDir = '/d/wireframes') => fixPage(html, pageDir, '/d', exists);

test("a nested page's refs to root bundles are pointed up to the root, quoted or not", () => {
  const r = fix('<link rel=stylesheet href=styles.css><script src="app.js"></script>');
  assert.equal(r.html, '<link rel=stylesheet href=../styles.css><script src="../app.js"></script>');
  assert.equal(r.fixed, 2);
  assert.deepEqual(r.unresolved, []);
  assert.equal(fix('<link href=styles.css>', '/d/a/b').html, '<link href=../../styles.css>');
});

test('refs that already resolve, external refs and non-refs are left alone', () => {
  const html =
    '<a href=screen-02.html></a><a href=../index.html></a><a href="https://x.test/a.css"></a><a href=#top></a><a href=mailto:a@b.test></a><img data-src=app.js>';
  assert.deepEqual({ ...fix(html) }, { html, fixed: 0, unresolved: [] });
});

test("an inline script body is never rewritten, but its tag's own src is", () => {
  const html = `<script src=app.js>const s = 'src=app.js'</script>`;
  assert.equal(fix(html).html, `<script src=../app.js>const s = 'src=app.js'</script>`);
});

test('a ref that resolves nowhere is reported — nested or at the root', () => {
  assert.deepEqual([...fix('<link href=missing.css><a href=../gone/index.html></a>').unresolved], ['missing.css', '../gone/index.html']);
  const root = fix('<a href=wireframes/index.html></a><a href=nope.html></a>', '/d');
  assert.equal(root.fixed, 0);
  assert.deepEqual([...root.unresolved], ['nope.html']);
});

test('fixDist rewrites pages in place and lists what resolves nowhere', () => {
  const dist = mkdtempSync(join(tmpdir(), 'fix-nested-'));
  try {
    mkdirSync(join(dist, 'wireframes'));
    writeFileSync(join(dist, 'styles.css'), '');
    writeFileSync(join(dist, 'index.html'), '<a href=wireframes/index.html>lab</a>');
    writeFileSync(join(dist, 'wireframes', 'index.html'), '<link href=styles.css><script src=gone.js></script>');
    const r = fixDist(dist);
    assert.equal(r.fixed, 1);
    assert.deepEqual(r.unresolved, [join('wireframes', 'index.html') + ' → gone.js']);
    assert.equal(readFileSync(join(dist, 'wireframes', 'index.html'), 'utf8'), '<link href=../styles.css><script src=gone.js></script>');
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
