/* Shared interaction policy, including dynamically created controls and iframe games. */
(function () {
  'use strict';
  if (window.LiteMobileUI) return;
  window.LiteMobileUI = true;
  const root = document.documentElement;
  const coarse = matchMedia('(any-pointer: coarse)');
  function update() { root.classList.toggle('lg-touch-ui', coarse.matches || navigator.maxTouchPoints > 0); }
  update(); coarse.addEventListener?.('change', update);
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') root.classList.add('lg-touch-ui');
  }, { capture: true, passive: true });
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = new URL('../css/mobile-ui.css', document.currentScript.src).href;
  document.head.append(link);
  function protectedTarget(target) {
    const node = target instanceof Element ? target : target?.parentElement;
    if (!node || node.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-allow-select]')) return false;
    return root.classList.contains('lg-touch-ui') || !!node.closest('button,[role="button"],[data-key],[data-hold],.direction-disc');
  }
  // Do not cancel pointer/touch starts: games need their normal hold, multitouch, scroll and release events.
  for (const type of ['selectstart', 'contextmenu', 'dragstart']) {
    document.addEventListener(type, e => {
      if (protectedTarget(e.target)) e.preventDefault();
      else if (type === 'contextmenu' && e.target instanceof Element && e.target.closest('input,textarea,[contenteditable]:not([contenteditable="false"]),[data-allow-select]')) {
        // Some imported engines cancel every window contextmenu. Preserve native copy/paste in forms.
        e.stopPropagation();
      }
    }, true);
  }
})();
