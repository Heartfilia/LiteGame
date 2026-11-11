(function () {
  'use strict';
  const id = document.body.dataset.gameId, category = document.body.dataset.category;
  const game = window.GAME_DATA.games.find(game => game.id === id);
  const bar = document.createElement('nav'); bar.id = 'lite-toolbar'; bar.setAttribute('aria-label', '游戏导航');
  bar.innerHTML = '<a href="../../index.html#/category/' + category + '">← 分区</a><a href="../../index.html">游戏厅</a><strong></strong><button id="lite-favorite" type="button">收藏</button><button id="lite-fullscreen" type="button">全屏</button><button id="lite-pause" type="button">暂停</button>';
  bar.querySelector('strong').textContent = game.title; document.body.append(bar);
  const hint = document.createElement('p'); hint.id = 'lite-status'; hint.setAttribute('role', 'status'); hint.hidden = true; document.body.append(hint);
  const rotate = document.createElement('div'); rotate.id = 'lite-rotate';
  rotate.innerHTML = '<div><strong>横屏游玩体验更好</strong><p>请将手机横拿，左右手分别操作。</p><button type="button">继续竖屏游玩</button></div>'; document.body.append(rotate);
  rotate.querySelector('button').onclick = () => document.body.classList.add('allow-portrait');
  let api = null;
  function message(text) { hint.textContent = text; hint.hidden = false; }
  const favorite = document.getElementById('lite-favorite');
  function syncFavorite() { const active = GameFavorites.read().includes(id); favorite.textContent = active ? '♥ 已收藏' : '♡ 收藏'; favorite.setAttribute('aria-pressed', String(active)); }
  favorite.onclick = () => { try { GameFavorites.toggle(id); } catch (e) { message('收藏未保存：浏览器存储不可用。'); } };
  window.addEventListener('favoriteschange', syncFavorite); syncFavorite();
  document.getElementById('lite-pause').onclick = () => api?.pause();
  document.getElementById('lite-fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); if (matchMedia('(pointer:coarse)').matches) try { await screen.orientation.lock('landscape'); } catch (e) {} }
      else message('当前浏览器使用网页铺满模式，请将手机横拿。');
    } catch (e) { message('未能进入系统全屏，可继续使用网页模式。'); }
  };
  document.addEventListener('fullscreenchange', () => { document.getElementById('lite-fullscreen').textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
  // Keep toolbar and dialog gestures out of the game input handlers.
  for (const node of [bar, rotate]) for (const name of ['pointerdown', 'touchstart', 'mousedown', 'keydown']) node.addEventListener(name, event => event.stopPropagation());
  for (const a of bar.querySelectorAll('a')) a.addEventListener('click', () => api?.leave());
  const pause = () => api?.pause();
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => api?.leave());
  window.addEventListener('resize', () => { if (matchMedia('(pointer:coarse) and (orientation:portrait)').matches) pause(); });
  window.LiteAI = {
    ready(value) { api = value; document.body.dataset.ready = 'true'; },
    error(error) { message('3D 游戏暂时无法启动：' + error.message + '。请确认浏览器支持 WebGL，或尝试开启硬件加速。'); },
    state(playing) { document.body.classList.toggle('lite-playing', playing); }
  };
})();
