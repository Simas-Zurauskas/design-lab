// Parcel with a relative --public-url writes bundle refs relative to each
// page's own directory, but shared bundles (CSS) are emitted at dist root —
// nested pages end up pointing at files that don't exist. This rewrites any
// ref that doesn't resolve from the page but does resolve from dist root.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

let fixedCount = 0;
for (const file of walk(dist).filter((p) => p.endsWith('.html'))) {
  const pageDir = dirname(file);
  if (pageDir === dist) continue;
  const up = relative(pageDir, dist).split(sep).join('/') + '/';
  const html = readFileSync(file, 'utf8');
  // never rewrite inside inline <script> bodies — JS strings can look like attrs
  const scriptRanges = [...html.matchAll(/<script[\s\S]*?<\/script>/gi)].map((s) => [s.index, s.index + s[0].length]);
  const inScript = (i) => scriptRanges.some(([a, b]) => i >= a && i < b);
  const fixed = html.replace(/(href|src)=("?)([^"'\s>]+)\2/g, (m, attr, q, url, offset) => {
    if (inScript(offset)) return m;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#|\.{1,2}\/)/i.test(url)) return m;
    const target = url.split(/[?#]/)[0];
    if (existsSync(join(pageDir, target))) return m;
    if (existsSync(join(dist, target))) {
      fixedCount++;
      return `${attr}=${q}${up}${url}${q}`;
    }
    return m;
  });
  if (fixed !== html) writeFileSync(file, fixed);
}
console.log(`fix-nested-urls: rewrote ${fixedCount} ref(s)`);
