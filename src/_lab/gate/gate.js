/* ============================================================
   LAB CHROME — gate: a password screen for the hosted lab opened
   in its own tab. Inside a frame (a Notion embed, the lab's own
   canvas and viewer) and when working locally (yarn dev, file://)
   there is none. Once the right password is typed this browser
   remembers it (lab:unlocked) until the password changes.
   Client-side only: it keeps casual visitors out, nothing more —
   the pages themselves are public to anyone who looks at the source.
   Loaded right after core/lab.js + shell/theme.js by
   shell/sidebar.html and screen/chrome.html.
   To change the password: printf %s 'new password' | shasum -a 256
   and paste the result as PASSWORD_SHA256 below.
   ============================================================ */

(() => {
  const PASSWORD_SHA256 = 'e909573a0f2122309b481c7eaccf11d39307cd342a65998f92c3a3d05a79f46b';
  const KEY = 'lab:unlocked';

  const framed = window.self !== window.top;
  const local = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (framed || local || Lab.local.get(KEY) === PASSWORD_SHA256) return;

  const root = document.documentElement;
  root.classList.add('lab-locked'); // gate.css hides the page until it's unlocked

  /** @param {string} text */
  const sha256 = async (text) => {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  /**
   * @template {keyof HTMLElementTagNameMap} T
   * @param {T} tag
   * @param {Record<string, string>} [attrs]
   * @param {string} [text]
   */
  const el = (tag, attrs = {}, text = '') => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    node.textContent = text;
    return node;
  };

  const form = el('form', { class: 'lab-gate', 'aria-label': 'Design Lab password' });
  const card = el('div', { class: 'lab-gate-card' });
  const input = el('input', { id: 'lab-gate-password', type: 'password', autocomplete: 'current-password', required: '' });
  const error = el('p', { class: 'lab-gate-error', role: 'alert' });
  card.append(
    el('h1', {}, 'Design Lab'),
    el('p', {}, 'Open it from Notion, or enter the password.'),
    el('label', { for: 'lab-gate-password' }, 'Password'),
    input,
    el('button', { type: 'submit', class: 'lab-gate-submit' }, 'Open the lab'),
    error,
  );
  form.append(card);
  document.body.prepend(form);
  input.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if ((await sha256(input.value)) !== PASSWORD_SHA256) {
      error.textContent = 'Wrong password.';
      input.select();
      return;
    }
    Lab.local.set(KEY, PASSWORD_SHA256);
    form.remove();
    root.classList.remove('lab-locked');
  });
})();
