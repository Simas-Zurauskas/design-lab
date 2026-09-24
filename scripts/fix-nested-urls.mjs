// Parcel with a relative --public-url writes bundle refs relative to each
// page's own directory, but shared bundles (CSS) are emitted at dist root —
// nested pages end up pointing at files that don't exist. This rewrites any
// ref that doesn't resolve from the page but does resolve from dist root —
// and then fails (exit 1) if any ref still resolves nowhere, so a page with
// broken CSS or scripts can't ship from a green build.
// `node scripts/fix-nested-urls.mjs [distDir]` (default: dist/). Tests: test/fix-nested-urls.test.mjs.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// href= / src= (quoted or not — Parcel's minifier drops the quotes); not data-src= and the like
const REF = /(?<![\w-])(href|src)=("?)([^"'\s>]+)\2/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#)/i; // https:, mailto:, data:, #anchor — nothing to resolve

/** One page: `{ html, fixed, unresolved }` — the rewritten html, how many refs were rewritten, and the refs that
    resolve neither from the page nor from dist root. */
export function fixPage(html, pageDir, dist, exists = existsSync) {
  const up = relative(pageDir, dist).split(sep).join('/'); // '' for a page at dist root
  // never touch inline <script> bodies — JS strings can look like attrs. Only the body: the opening tag's own src
  // must still be fixed, or every bundled script 404s on nested pages
  const scripts = [...html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)].map((s) => [s.index + s[1].length, s.index + s[1].length + s[2].length]);
  const inScript = (i) => scripts.some(([a, b]) => i >= a && i < b);
  let fixed = 0;
  const unresolved = [];
  const out = html.replace(REF, (m, attr, q, url, offset) => {
    if (inScript(offset) || EXTERNAL.test(url)) return m;
    const target = url.split(/[?#]/)[0];
    if (url.startsWith('/')) {
      if (!exists(join(dist, target))) unresolved.push(url);
      return m;
    }
    if (exists(join(pageDir, target))) return m;
    if (up && !target.startsWith('.') && exists(join(dist, target))) {
      fixed++;
      return `${attr}=${q}${up}/${url}${q}`;
    }
    unresolved.push(url);
    return m;
  });
  return { html: out, fixed, unresolved };
}

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Every page in `dist`, rewritten in place: `{ fixed, unresolved: ['page.html → ref', …] }` */
export function fixDist(dist) {
  let fixed = 0;
  const unresolved = [];
  for (const file of walk(dist).filter((p) => p.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    const page = fixPage(html, dirname(file), dist);
    fixed += page.fixed;
    unresolved.push(...page.unresolved.map((url) => `${relative(dist, file)} → ${url}`));
    if (page.html !== html) writeFileSync(file, page.html);
  }
  return { fixed, unresolved };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dist = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const { fixed, unresolved } = fixDist(dist);
  console.log(`fix-nested-urls: rewrote ${fixed} ref(s)`);
  if (unresolved.length) {
    console.error(`✗ ${unresolved.length} ref(s) resolve nowhere:\n${unresolved.map((u) => `  ${u}`).join('\n')}`);
    process.exit(1);
  }
}
