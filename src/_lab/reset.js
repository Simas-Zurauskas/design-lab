// LAB CHROME — gallery reset buttons (workbench infrastructure, not design content).
// Reassigning src (even to the same value) reloads an iframe back to its original page.
// A button lights up (.lab-btn-alert) while its screen is away from its original state.
const resetAllBtn = document.querySelector('[data-reset-all]');

const refreshResetAll = () => {
  if (resetAllBtn) resetAllBtn.classList.toggle('lab-btn-alert', !!document.querySelector('[data-reset].lab-btn-alert'));
};

const resetFrame = (figure) => {
  const iframe = figure.querySelector('iframe');
  if (!iframe) return;
  iframe.dataset.resetting = '1';
  iframe.src = iframe.getAttribute('src');
};

document.querySelectorAll('figure').forEach((figure) => {
  const iframe = figure.querySelector('iframe');
  const btn = figure.querySelector('[data-reset]');
  if (!iframe || !btn) return;
  const original = new URL(iframe.getAttribute('src'), location.href).pathname;
  let loadedOnce = false;
  iframe.addEventListener('load', () => {
    let away;
    if (iframe.dataset.resetting) {
      delete iframe.dataset.resetting;
      away = false;
    } else {
      try {
        away = iframe.contentWindow.location.pathname !== original;
      } catch {
        away = loadedOnce; // file:// blocks frame access — any post-initial load counts as away
      }
    }
    loadedOnce = true;
    btn.classList.toggle('lab-btn-alert', away);
    refreshResetAll();
  });
  btn.addEventListener('click', () => resetFrame(figure));
});

resetAllBtn?.addEventListener('click', () => {
  document.querySelectorAll('figure').forEach(resetFrame);
});
