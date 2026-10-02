// LAB CHROME — icons: Lucide at build time. A posthtml plugin (.posthtmlrc, after posthtml-include) that turns every
//   <i data-lucide="name" class="h-5 w-5"></i>
// in a page into the icon's inline <svg> — the same markup lucide's createIcons() makes in the browser (attributes
// copied, classes merged, aria-hidden unless the element is labelled), with the FULL icon set, so any name works
// with no system edit. Build time, not a runtime script: the runtime shipped all ~1,600 icons (400 KB) into every
// screen, and a canvas evaluated it once per screen — measured, the biggest cost of opening a section. Inline SVG
// also renders from file://. An unknown name fails the build, like a link to a missing screen.
// A package (linked in package.json) only so .posthtmlrc can name it: Parcel resolves plugin names from each page.
// CommonJS: Parcel loads an ES-module plugin with an "experimental" warning. Tests: test/icons.test.mjs.
const { icons } = require('lucide');

// lucide's own attribute defaults and name rules (lucide/dist/esm: defaultAttributes, toPascalCase, hasA11yProp) —
// less xmlns: inline SVG in HTML needs none, and Parcel's SVG optimizer mangles it into xmlns:xmlns
const DEFAULTS = {
  width: '24',
  height: '24',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};
const pascal = (name) => {
  const camel = name.replace(/^([A-Z])|[\s-_]+(\w)/g, (m, p1, p2) => (p2 ? p2.toUpperCase() : p1.toLowerCase()));
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};
const labelled = (attrs) => Object.keys(attrs).some((a) => a.startsWith('aria-') || a === 'role' || a === 'title');
const svgNode = ([tag, attrs, children = []]) => ({
  tag,
  attrs: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, String(v)])),
  content: children.map(svgNode),
});

/** one <… data-lucide="name"> element (a posthtml node) → the icon's <svg> node */
function iconNode(node) {
  const name = node.attrs['data-lucide'];
  const icon = icons[pascal(name)];
  // posthtml isn't told which page it is working on — say how to find it
  if (!icon) throw new Error(`Unknown Lucide icon "${name}" — names are at https://lucide.dev/icons; used here: grep -rn 'data-lucide="${name}"' src`);
  const own = { ...node.attrs };
  const classes = [...new Set(['lucide', `lucide-${name}`, ...(own.class || '').split(/\s+/)].filter(Boolean))];
  return svgNode(['svg', { ...DEFAULTS, 'data-lucide': name, ...(labelled(own) ? {} : { 'aria-hidden': 'true' }), ...own, class: classes.join(' ') }, icon]);
}

/** every element with a data-lucide name, at any depth, becomes its icon — in place */
function inline(nodes) {
  if (!Array.isArray(nodes)) return;
  nodes.forEach((node, i) => {
    if (!node || typeof node !== 'object') return; // text
    if (node.attrs?.['data-lucide']) nodes[i] = iconNode(node);
    else inline(node.content);
  });
}

/** the plugin (posthtml calls it with the page's tree) */
module.exports = () => (tree) => {
  inline(tree);
  return tree;
};
