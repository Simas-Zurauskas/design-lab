/* ============================================================
   LAB CHROME — shell: the sidebar's behavior. Marks the current
   section (from <body data-section="…">, so adding a section needs
   no CSS) and runs the light / dark switch at the bottom.
   Loaded at the end of shell/sidebar.html.
   ============================================================ */

(() => {
  const section = document.body.dataset.section;
  for (const a of document.querySelectorAll('.lab-nav [data-side]')) {
    if (a.getAttribute('data-side') === section) a.setAttribute('aria-current', 'page');
  }

  if (!Lab.theme) return; // theme.js stands down on a page the lab itself shows — nothing to switch there
  const theme = Lab.toggle('theme', { store: Lab.local, key: Lab.theme.key, fallback: Lab.theme.get(), onChange: Lab.theme.apply });
  // the system or another tab switched it — keep the switch in step (without saving a choice)
  document.addEventListener('lab:theme', (/** @type {CustomEvent<string>} */ e) => theme.get() !== e.detail && theme.set(e.detail, false));
})();
