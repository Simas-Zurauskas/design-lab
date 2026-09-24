/* ============================================================
   LAB CHROME — screen: in-screen interactions, declared in plain
   HTML — no per-screen script, ever. Clicking flips the control's
   own state attribute; the design styles both states with Tailwind:
     <button aria-pressed="false" class="… aria-pressed:bg-gray-900">
       on/off — chips, switches, likes
     <div role="radiogroup" aria-label="Time">
       <button role="radio" aria-checked="false" class="… aria-checked:…">
       one of many — day, time, plan
   Children follow their control with group-aria-pressed: /
   group-aria-checked: (add `group` on the control). Disabled
   controls don't change. A placeholder link (href="#") does nothing
   at all. A change tells whatever shows the screen, so its ↺ reset
   lights up ('screen:changed' → canvas/gallery.js, screen/viewer.js).
   ============================================================ */

(() => {
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('a[href="#"]')) return e.preventDefault();
    const el = e.target.closest('[aria-pressed], [role="radio"]');
    if (!el || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return;
    if (el.closest('[data-lab-bar]')) return; // the lab's own toggles drive themselves
    if (el.hasAttribute('aria-pressed')) {
      el.setAttribute('aria-pressed', String(el.getAttribute('aria-pressed') !== 'true'));
    } else {
      const group = el.closest('[role="radiogroup"]');
      for (const r of group ? group.querySelectorAll('[role="radio"]') : [el]) r.setAttribute('aria-checked', String(r === el));
    }
    // the screen is no longer as it opened: light its ↺ reset (canvas/gallery.js / viewer.js); a reset reloads it
    if (Lab.hosted) Lab.post(window.parent, 'screen:changed');
  });
})();
