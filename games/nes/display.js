// Native fullscreen when available; rotated viewport layout otherwise (including iPhone).
window.NESDisplay = function (api) {
  'use strict';
  const $ = id => document.getElementById(id), host = $('console'), layout = host.querySelector('.console-layout');
  const panel = $('console-menu-panel'), toggle = $('console-menu');
  let active = false, landscape = false, nativeSeen = false, revision = 0, savedScroll = 0, returnFocus = null;
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function unlock() { try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* Unsupported platform. */ } }
  function size() {
    if (!active) return;
    api.release();
    const desktop = matchMedia('(hover:hover) and (pointer:fine)').matches;
    const w = host.clientWidth, h = host.clientHeight, rotated = landscape && h > w && !desktop;
    host.classList.toggle('is-rotated', rotated);
    layout.style.setProperty('--play-width', (rotated ? h : w) + 'px');
    layout.style.setProperty('--play-height', (rotated ? w : h) + 'px');
  }
  function closeMenu() { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
  function menu() {
    if (!active) return;
    api.pause('已暂停，可在菜单中继续或退出横屏。');
    panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); $('menu-resume').focus({ preventScroll: true });
  }
  function leaveLayout() {
    if (!active) return;
    revision++; active = false; nativeSeen = false; unlock(); api.pause('已退出游玩模式，点击开始 / 继续。'); closeMenu();
    host.classList.remove('immersive', 'is-rotated', 'landscape-play'); document.body.classList.remove('nes-immersive');
    for (const child of document.querySelector('main').children) if (child !== host) child.inert = false;
    layout.style.removeProperty('--play-width'); layout.style.removeProperty('--play-height');
    $('landscape').setAttribute('aria-pressed', 'false');
    window.scrollTo(0, savedScroll);
    if (returnFocus) returnFocus.focus({ preventScroll: true });
  }
  async function exit() {
    leaveLayout();
    if (fullscreenElement() === host) {
      try { await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen()); } catch (e) { /* Keep an accessible exit if the browser refuses. */ }
    }
  }
  async function enter(wantLandscape) {
    if (active) return;
    const token = ++revision;
    savedScroll = window.scrollY; returnFocus = document.activeElement; active = true; landscape = wantLandscape;
    api.release(); host.classList.add('immersive'); host.classList.toggle('landscape-play', landscape); document.body.classList.add('nes-immersive');
    for (const child of document.querySelector('main').children) if (child !== host) child.inert = true;
    $('landscape').setAttribute('aria-pressed', String(landscape)); $('exit-display').textContent = landscape ? '退出横屏' : '退出全屏';
    $('display-status').textContent = landscape ? '网页横屏模式；可横拿手机，左上角菜单可退出。' : '网页铺满模式；左上角菜单可退出。';
    size(); toggle.focus({ preventScroll: true });
    try {
      const request = host.requestFullscreen || host.webkitRequestFullscreen;
      if (request) await request.call(host);
      if (token !== revision) { if (!active && fullscreenElement() === host) await exit(); return; }
      nativeSeen = fullscreenElement() === host;
      if (nativeSeen) $('display-status').textContent = landscape ? '已全屏；方向锁定不可用时会自动适配横屏布局。' : '已进入浏览器全屏。';
      if (nativeSeen && landscape && screen.orientation && screen.orientation.lock) {
        try { await screen.orientation.lock('landscape'); }
        catch (e) { /* CSS rotation remains usable when the lock is rejected. */ }
        if (token !== revision) { if (!active) unlock(); return; }
      }
    } catch (e) { /* Fullscreen denied: retain the usable webpage layout. */ }
    if (active && token === revision) size();
  }
  $('landscape').onclick = () => enter(true);
  $('fullscreen').onclick = () => enter(false);
  toggle.onclick = () => { if (panel.hidden) menu(); else { closeMenu(); toggle.focus(); } };
  $('menu-resume').onclick = () => { closeMenu(); api.start(); host.querySelector('canvas').focus({ preventScroll: true }); };
  $('exit-display').onclick = exit;
  for (const name of ['save', 'restore', 'mute']) $('menu-' + name).onclick = () => $(name).click();
  for (const name of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(name, () => {
    if (fullscreenElement() === host) { if (active) nativeSeen = true; }
    else if (active && nativeSeen) leaveLayout();
    size();
  });
  window.addEventListener('resize', size);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', size);
  document.addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); if (panel.hidden) menu(); else exit(); }
    if (!panel.hidden && e.key === 'Tab') {
      const buttons = [...panel.querySelectorAll('button')].filter(b => !b.disabled), first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  return { menuOpen: () => !panel.hidden };
};
