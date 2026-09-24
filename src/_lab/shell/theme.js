/* ============================================================
   LAB CHROME — shell: light / dark for the lab UI (never the
   designs). Runs right after core/lab.js — first thing on every
   page — so the theme lands before anything paints. Follows the
   system until someone picks on the sidebar switch; the pick is
   kept in this browser (localStorage) and syncs across tabs.
   Sets <html data-lab-theme="light|dark">; colors in core/tokens.css.
   ============================================================ */

(() => {
  if (Lab.hosted) return; // a screen shown inside the canvas / viewer — its host themes the lab UI

  const KEY = 'lab:theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const chosen = () => {
    const v = Lab.local.get(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  };
  const apply = (mode) => {
    if (document.documentElement.dataset.labTheme === mode) return;
    document.documentElement.dataset.labTheme = mode;
    document.dispatchEvent(new CustomEvent('lab:theme', { detail: mode }));
  };

  apply(chosen() || (system.matches ? 'dark' : 'light'));
  system.addEventListener('change', () => chosen() || apply(system.matches ? 'dark' : 'light'));
  addEventListener('storage', (e) => e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark') && apply(e.newValue));

  Lab.theme = { key: KEY, get: () => document.documentElement.dataset.labTheme, apply };
})();
