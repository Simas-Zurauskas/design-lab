// scripts/posthtml-lab-icons — Lucide icons inlined at build time, the same <svg> lucide's createIcons() makes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parser } from 'posthtml-parser';
import labIcons from '../scripts/posthtml-lab-icons/index.cjs';

const run = (html) => labIcons()(parser(html));
const tags = (nodes) => nodes.filter((n) => typeof n === 'object').map((n) => n.tag);

test('an icon element becomes lucide’s svg: its defaults, its own attributes kept, classes merged', () => {
  const [svg] = run('<i data-lucide="house" class="h-5 w-5" data-x="1"></i>');
  assert.equal(svg.tag, 'svg');
  assert.deepEqual(svg.attrs, {
    width: '24',
    height: '24',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'data-lucide': 'house',
    'aria-hidden': 'true',
    class: 'lucide lucide-house h-5 w-5',
    'data-x': '1',
  });
  assert.deepEqual(tags(svg.content), ['path', 'path']);
  assert.match(svg.content[0].attrs.d, /^M15 21v-8/);
});

test('a labelled icon is not hidden from screen readers; an own attribute beats a default', () => {
  const [svg] = run('<i data-lucide="x" aria-label="Close" stroke-width="1.5"></i>');
  assert.equal(svg.attrs['aria-hidden'], undefined);
  assert.equal(svg.attrs['aria-label'], 'Close');
  assert.equal(svg.attrs['stroke-width'], '1.5');
});

test('icons are found at any depth, aliases resolve, and nothing else changes', () => {
  const [button] = run('<button class="b"><span>Go</span><i data-lucide="home"></i></button>');
  assert.deepEqual(tags(button.content), ['span', 'svg']);
  assert.equal(button.content[1].attrs.class, 'lucide lucide-home'); // lucide's alias of house
  assert.deepEqual(button.attrs, { class: 'b' });
});

test('an unknown icon name fails the build', () => {
  assert.throws(() => run('<i data-lucide="hous"></i>'), /Unknown Lucide icon "hous"/);
});
