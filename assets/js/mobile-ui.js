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

  // Keep a validated hall route in the URL so return also works after refresh or opening a new tab.
  if (location.pathname.includes('/games/')) {
    const home = new URL('../../index.html', document.currentScript.src);
    const names = { favorites:'我的收藏',retro:'怀旧分区',rpg:'角色扮演分区',racing:'赛车分区',shooting:'射击分区',action:'动作分区',puzzle:'益智分区',board:'桌游分区',cards:'卡牌分区',casual:'休闲分区',music:'音乐分区',sports:'体育分区' };
    const params = new URLSearchParams(location.search), requested = params.get('returnTo');
    const validRoute = value => value === '#/' || /^#\/category\/(favorites|retro|rpg|racing|shooting|action|puzzle|board|cards|casual|music|sports)$/.test(value || '') || /^#\/search\/[^\s#]+$/.test(value || '');
    let route = validRoute(requested) ? requested : names[params.get('from')] ? '#/category/' + params.get('from') : null;
    function destination() {
      if (!route) {
        const existing = document.querySelector('header a[href*="index.html"],.hall-link,#lite-toolbar a');
        const hash = existing ? new URL(existing.href).hash : '';
        const catalogGame = window.GAME_DATA?.games.find(g => new URL(g.url, home).pathname === location.pathname.replace(/\/$/, '/index.html'));
        const category = params.get('from') || catalogGame?.category || hash.replace(/^#\/?(?:category\/)?/, '');
        route = names[category] ? '#/category/' + category : '#/';
      }
      const label = route.startsWith('#/search/') ? '搜索结果' : names[route.split('/')[2]] || '游戏厅首页';
      return { href: home.href.split('#')[0] + route, label };
    }
    window.LiteNavigation = { destination, back() { location.href = destination().href; } };
    function decorate() {
      const bar = document.querySelector('.ch-gamebar,#lite-toolbar,main > header');
      if (!bar) return;
      const primary = bar.querySelector('.ch-iconbtn:not(.ch-homebtn),a[href*="index.html"]');
      if (!primary) return;
      const target = destination(), text = '← ' + target.label;
      if (primary.tagName === 'A' && primary.href !== target.href) primary.href = target.href;
      if (primary.textContent !== text) primary.textContent = text;
      primary.setAttribute('aria-label', '返回' + target.label); primary.title = '返回' + target.label;
      primary.classList.add('lg-return');
      let menu = bar.querySelector('.lg-navigation-menu');
      if (!menu) {
        menu = document.createElement('details'); menu.className = 'lg-navigation-menu';
        const summary = document.createElement('summary'); summary.textContent = '菜单';
        const content = document.createElement('div'); content.className = 'lg-navigation-links';
        menu.append(summary, content); bar.append(menu);
        menu.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); menu.open = false; summary.focus(); } });
        document.addEventListener('pointerdown', e => { if (menu.open && !menu.contains(e.target)) menu.open = false; }, { passive: true });
        const existingHome = bar.querySelector('.ch-homebtn') || Array.from(bar.querySelectorAll('a[href*="index.html"]')).find(n => n !== primary);
        if (existingHome) { existingHome.textContent = '游戏厅首页'; content.append(existingHome); }
        else { const a = document.createElement('a'); a.href = home.href; a.textContent = '游戏厅首页'; content.append(a); }
        const settings = document.createElement('a'); settings.href = home.href + '#server'; settings.textContent = '备份与服务器'; content.append(settings);
        menu.addEventListener('toggle', () => { if (menu.open) window.dispatchEvent(new Event('blur')); });
      }
    }
    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; decorate(); }); } }).observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', decorate, { once: true });
  }
})();
