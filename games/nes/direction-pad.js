// One captured finger controls eight sectors, emitting at most two adjacent keys.
window.NESDirectionPad = function (node, api) {
  'use strict';
  let pointer = null, directions = [];
  function set(next) {
    for (const key of directions) if (!next.includes(key)) api.up('disc-' + key);
    for (const key of next) if (!directions.includes(key)) api.down('disc-' + key, key);
    directions = next;
    node.dataset.directions = next.join(' ');
    node.querySelectorAll('[data-direction]').forEach(n => n.classList.toggle('active', next.includes(n.dataset.direction)));
  }
  function reset() {
    const id = pointer; pointer = null; set([]);
    node.style.setProperty('--stick-x', '0px'); node.style.setProperty('--stick-y', '0px');
    if (id !== null && node.hasPointerCapture(id)) node.releasePointerCapture(id);
  }
  function update(e) {
    const r = node.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    // The immersive portrait fallback rotates the whole controller clockwise.
    if (node.closest('.is-rotated')) [x, y] = [y, -x];
    const length = Math.hypot(x, y), scale = Math.max(1, length);
    node.style.setProperty('--stick-x', (x / scale * 18) + 'px');
    node.style.setProperty('--stick-y', (y / scale * 18) + 'px');
    if (length < 0.18) { set([]); return; }
    const sector = (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
    set([['RIGHT'], ['RIGHT', 'DOWN'], ['DOWN'], ['DOWN', 'LEFT'], ['LEFT'], ['LEFT', 'UP'], ['UP'], ['UP', 'RIGHT']][sector]);
  }
  node.addEventListener('pointerdown', e => {
    if (pointer !== null || e.button !== 0 || !api.enabled()) return;
    e.preventDefault(); pointer = e.pointerId; node.setPointerCapture(pointer); update(e);
  });
  node.addEventListener('pointermove', e => {
    if (pointer !== e.pointerId) return;
    e.preventDefault(); if (!api.enabled()) reset(); else update(e);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(event, e => { if (e.pointerId === pointer) reset(); });
  node.addEventListener('contextmenu', e => e.preventDefault());
  return { reset };
};
