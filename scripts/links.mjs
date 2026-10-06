// SYSTEM — `yarn links`: the link map of every section with screens, read straight from the screens' markup. A
// screen's <a href> is the ONLY link data there is: clicking it, its hotspot outline and its flow line on the
// canvas all come from that same attribute — nothing is defined twice.
//   → goes to a screen       <a href="screen-05.html">
//   ◦ changes the UI         <button aria-pressed> / role="radio" (see src/_lab/screen/interact.js)
//   · does nothing yet       <a href="#"> (placeholder) / a plain <button> — not clickable in the lab
// Each screen is expanded by the build's own pipeline — posthtml + posthtml-include, options from .posthtmlrc —
// so an <include>'s locals, {{ expressions }}, <if> / <each> resolve exactly as they do in dist/, and comments, quoting
// and entities count the way the build counts them; the checks read the expanded page. Fails (exit 1) on: links to
// pages that don't exist; links and controls with no accessible name (CLAUDE.md rule 4); a caption or frame title
// out of step with the screen's <title> — on the section's index (canvas or sheet) and on its round pages
// (round-*.html, Explorations); a screen the build can't expand (a throwing expression).
// Also lists placeholders and screens nothing links to. Tests: test/links.test.mjs.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { parser } from 'posthtml-parser';

// posthtml and its match() exactly as posthtml-include resolves them — the very modules the build runs
const fromInclude = createRequire(createRequire(import.meta.url).resolve('posthtml-include'));
const posthtml = fromInclude('posthtml');
const { match } = fromInclude('posthtml/lib/api');
const include = fromInclude('posthtml-include');
const POSTHTMLRC = JSON.parse(readFileSync(new URL('../.posthtmlrc', import.meta.url), 'utf8'));

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] !== '#' ? (NAMED[e] ?? m) : String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))),
  );
const isElement = (n) => n !== null && typeof n === 'object';
const isMarkup = (n) => typeof n === 'string' && n.startsWith('<!'); // a comment or the doctype — not text

// <include src="…"> expanded by posthtml-include itself, with .posthtmlrc's options (`root` → `src`): locals
// from the JSON body or `locals` attribute, posthtml-expressions with its defaults, nested includes. Two
// departures, both in the include matcher, which every nested include inherits: lab chrome (`_lab/…`) is dropped —
// its links (‹ Gallery …) aren't part of any design — and so is an include of a file that doesn't exist (the
// build fails on that itself). The Lucide icon plugin is not run: an icon-only control is named by its data-lucide.
const expander = (src) => {
  const plugin = include({ ...POSTHTMLRC.plugins['posthtml-include'], root: src });
  // one plugin, not two: posthtml re-attaches its own match() to the tree before each plugin runs
  const designOnly = (tree) => {
    tree.match = function (expression, cb) {
      return match.call(this, expression, (node) => {
        const path = node.attrs?.src;
        const drop = expression?.tag === 'include' && (!path || path.startsWith('_lab/') || !existsSync(join(src, path)));
        return drop ? { tag: false, content: [] } : cb(node);
      });
    };
    return plugin(tree);
  };
  const pipeline = posthtml([designOnly]);
  return (file) => flatten(pipeline.process(readFileSync(file, 'utf8'), { sync: true }).tree);
};
// an expanded <include> is a tag-less node around its content: lift the content into place
const flatten = (nodes) =>
  (nodes ?? []).flatMap((n) => (!isElement(n) ? [n] : n.tag === false ? flatten(n.content) : [{ ...n, content: n.content && flatten(n.content) }]));

/** every element under `nodes`, with its ancestors */
function* elements(nodes, ancestors = []) {
  for (const n of nodes ?? []) {
    if (!isElement(n)) continue;
    yield { node: n, ancestors };
    yield* elements(n.content, [...ancestors, n]);
  }
}
const textOf = (nodes) =>
  (nodes ?? [])
    .map((n) => (isElement(n) ? textOf(n.content) : isMarkup(n) ? ' ' : decode(n)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

/** what a link or control is called — and whether it has an accessible name at all */
const nameOf = (n) => {
  const aria = n.attrs?.['aria-label']?.trim();
  if (aria) return { label: `"${decode(aria)}"`, named: true };
  if (n.attrs?.['aria-labelledby']) return { label: `[labelled by #${n.attrs['aria-labelledby']}]`, named: true };
  const text = textOf(n.content);
  if (text) return { label: `"${text.length > 32 ? `${text.slice(0, 31)}…` : text}"`, named: true };
  const icon = [...elements(n.content)].find(({ node }) => node.attrs?.['data-lucide'])?.node.attrs['data-lucide'];
  return { label: icon ? `[icon ${icon}]` : '[no label]', named: false };
};

/** one screen, expanded the way the build expands it: its title, links, controls (buttons, toggles, choices) and
 * radio groups — or, when the build couldn't expand it either (bad locals JSON, a throwing expression), `error` */
export function readScreen(file, src, expand = expander(src)) {
  let tree;
  try {
    tree = expand(file);
  } catch (e) {
    return { file: basename(file), title: basename(file), links: [], controls: [], groups: [], error: String(e?.message ?? e).split('\n')[0] };
  }
  const all = [...elements(tree)];
  const title = textOf(all.find(({ node }) => node.tag === 'title')?.node.content) || basename(file);
  const links = [];
  const controls = [];
  const groups = [];
  for (const { node, ancestors } of all) {
    const a = node.attrs ?? {};
    if (node.tag === 'a') links.push({ href: a.href, nav: ancestors.some((p) => p.tag === 'nav'), ...nameOf(node) });
    else if (node.tag === 'button' || 'aria-pressed' in a || a.role === 'radio') {
      const kind = 'aria-pressed' in a ? 'toggle' : a.role === 'radio' ? 'choice' : 'inert';
      controls.push({ kind, disabled: 'disabled' in a || a['aria-disabled'] === 'true', ...nameOf(node) });
    }
    if (a.role === 'radiogroup') groups.push(a['aria-label'] ? decode(a['aria-label']) : '(unnamed)');
  }
  return { file: basename(file), title, links, controls, groups };
}

/** a section canvas's screens (figure.lab-screen): caption text + link, and the frame's src + title */
export function readCanvas(file) {
  if (!existsSync(file)) return [];
  return [...elements(parser(readFileSync(file, 'utf8')))]
    .filter(({ node }) => node.tag === 'figure' && /\blab-screen\b/.test(node.attrs?.class ?? ''))
    .map(({ node }) => {
      const inside = [...elements(node.content)].map((e) => e.node);
      const caption = inside.find((n) => n.tag === 'figcaption');
      const link = caption && [...elements(caption.content)].find((e) => e.node.tag === 'a')?.node;
      const frame = inside.find((n) => n.tag === 'iframe');
      return {
        caption: link ? textOf(link.content) : null,
        href: link?.attrs?.href ?? null,
        src: frame?.attrs?.src ?? null,
        frameTitle: frame?.attrs?.title != null ? decode(frame.attrs.title) : null,
      };
    });
}

/** every section with screens under `src`: its screens with resolved links, orphans, and problems (each fails) */
export function analyze(src) {
  const expand = expander(src);
  return readdirSync(src)
    .filter((d) => !d.startsWith('_') && statSync(join(src, d)).isDirectory())
    .sort()
    .map((name) => ({ name, dir: join(src, name) }))
    .map((sec) => ({
      ...sec,
      files: readdirSync(sec.dir)
        .filter((f) => /^screen-.*\.html$/.test(f))
        .sort(),
    }))
    .filter((sec) => sec.files.length)
    .map(({ name, dir, files }) => {
      const screens = files.map((f) => readScreen(join(dir, f), src, expand));
      const byPath = new Map(screens.map((s) => [join(dir, s.file), s]));
      const incoming = new Map(screens.map((s) => [s, 0]));
      const problems = [];
      for (const s of screens) {
        if (s.error) problems.push(`${s.title}: the build can't expand it — ${s.error}`);
        s.links = s.links.map((l) => {
          if (!l.href || l.href.startsWith('#')) return { ...l, to: 'placeholder' };
          if (/^[a-z][a-z0-9+.-]*:/i.test(l.href)) return { ...l, to: 'external' };
          const path = resolve(dir, l.href.split(/[?#]/)[0]);
          const target = byPath.get(path);
          if (target === s) return { ...l, to: 'self' };
          if (target) {
            incoming.set(target, incoming.get(target) + 1);
            return { ...l, to: 'screen', target };
          }
          if (existsSync(path)) return { ...l, to: 'page', target: relative(src, path) };
          problems.push(`${s.title}: ${l.label} links to ${relative(dir, path)} — no such page`);
          return { ...l, to: 'missing', target: relative(dir, path) };
        });
        for (const c of [...s.links, ...s.controls]) if (!c.named) problems.push(`${s.title}: ${c.label} has no accessible name — add aria-label`);
      }
      // the section's pages that show screens: its index (a canvas or a sheet) and any round pages (Explorations)
      const pages = [
        'index.html',
        ...readdirSync(dir)
          .filter((f) => /^round-.*\.html$/.test(f))
          .sort(),
      ];
      for (const page of pages) {
        const where = page === 'index.html' ? 'canvas' : page;
        for (const f of readCanvas(join(dir, page))) {
          const s = f.src && byPath.get(resolve(dir, f.src));
          if (!s) {
            problems.push(`${where}: a frame shows ${f.src} — not a screen of this section`);
            continue;
          }
          const short = s.title.replace(/^[^·]*·\s*/, ''); // "05 · It's a match" → "It's a match"
          if (f.caption !== s.title) problems.push(`${where}: caption "${f.caption}" ≠ <title> "${s.title}" (${s.file})`);
          if (f.href !== f.src) problems.push(`${where}: caption opens ${f.href} but the frame shows ${f.src}`);
          if (f.frameTitle !== short) problems.push(`${where}: frame title "${f.frameTitle}" ≠ "${short}" (${s.file})`);
        }
      }
      const orphans = screens.length > 1 ? screens.filter((s) => incoming.get(s) === 0) : [];
      return { name, screens, orphans, problems };
    });
}

export function print(sections, log = console.log) {
  for (const sec of sections) {
    log(`\n${sec.name} — ${sec.screens.length} screen${sec.screens.length === 1 ? '' : 's'}\n`);
    for (const s of sec.screens) {
      log(s.title);
      for (const l of s.links) {
        const nav = l.nav ? ' (tab bar)' : '';
        if (l.to === 'external') log(`  ↗ ${l.href.padEnd(24)} ${l.label}`);
        else if (l.to === 'self') log(`  ↺ ${'itself'.padEnd(24)} ${l.label}${nav}`);
        else if (l.to === 'screen') log(`  → ${l.target.title.padEnd(24)} ${l.label}${nav}`);
        else if (l.to === 'page') log(`  ↗ ${l.target.padEnd(24)} ${l.label}${nav}`);
        else if (l.to === 'missing') log(`  ✗ ${`${l.target} — MISSING`.padEnd(24)} ${l.label}`);
      }
      const toggles = s.controls.filter((c) => c.kind === 'toggle' && !c.disabled).length;
      const choices = s.groups.length;
      if (toggles || choices) {
        const parts = [
          choices && `${choices} choice${choices > 1 ? 's' : ''} (${s.groups.join(', ')})`,
          toggles && `${toggles} toggle${toggles > 1 ? 's' : ''}`,
        ];
        log(`  ◦ changes the UI: ${parts.filter(Boolean).join(', ')}`);
      }
      const inert = s.controls.filter((c) => c.kind === 'inert').map((c) => c.label);
      if (inert.length) log(`  · does nothing: ${inert.join(', ')}`);
    }
    const pending = sec.screens.flatMap((s) => s.links.filter((l) => l.to === 'placeholder').map((l) => `    ${s.title.padEnd(26)} ${l.label}`));
    if (pending.length) log(`\n  Not wired to a screen yet (href="#"):\n${pending.join('\n')}`);
    if (sec.orphans.length) log(`\n  Nothing links here (only reachable from the gallery):\n${sec.orphans.map((s) => `    ${s.title}`).join('\n')}`);
    if (sec.problems.length) log(`\n  ✗ Problems:\n${sec.problems.map((p) => `    ${p}`).join('\n')}`);
  }
  log('');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const sections = analyze(join(dirname(fileURLToPath(import.meta.url)), '..', 'src'));
  print(sections);
  const problems = sections.reduce((n, s) => n + s.problems.length, 0);
  if (problems) {
    console.error(`✗ ${problems} problem${problems > 1 ? 's' : ''} — see above`);
    process.exit(1);
  }
}
