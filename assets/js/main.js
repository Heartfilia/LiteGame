(function () {
  'use strict';

  const { categories, games } = window.GAME_DATA;
  const app = document.getElementById('app');
  const searchInput = document.getElementById('searchInput');
  const searchDropdown = document.getElementById('searchDropdown');
  const searchWrap = document.querySelector('.search-wrap');
  const allCategoriesLink = document.getElementById('allCategoriesLink');
  const favorites = window.GameFavorites;
  const favoriteCategory = { id: 'favorites', name: '我的收藏', tagline: '喜欢的游戏，都在这里', description: '收藏各个分区的游戏，下次直接来这里开玩。支持导出到其他电脑浏览器，再导入恢复收藏。', accent: '#ff8ab0', icon: 'heart' };
  let homeTimer = null;
  let slideTimer = null;
  let noticeTimer = null;
  let refreshFavoriteList = null;

  const ICON_PATHS = {
    target: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6" stroke="currentColor" stroke-width="1.8"/>',
    heart: '<path d="M20.8 4.9a5.3 5.3 0 0 0-7.5 0L12 6.2l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.6a5.3 5.3 0 0 0 0-7.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    flag: '<path d="M5 21V3.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M5 4.2c3.2-1.5 6.3 1.1 9.5 0 2.6-.9 4.5-.7 4.5-.7v9.1s-1.9-.2-4.5.7c-3.2 1.1-6.3-1.5-9.5 0" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" fill="currentColor" fill-opacity=".14"/><path d="M9.1 4.6v8.2M13.4 5.4v8.5M17.7 5v8.6" stroke="currentColor" stroke-width="1.2" opacity=".45"/>',
    bolt: '<path d="M13.2 2.5 5.1 13.2h5.3L9.7 21.5l8.9-11.6h-5.6l1.2-7.4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="currentColor" fill-opacity=".12"/>',
    puzzle: '<rect x="3.6" y="3.6" width="7.2" height="7.2" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="13.2" y="3.6" width="7.2" height="7.2" rx="2" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".18"/><rect x="3.6" y="13.2" width="7.2" height="7.2" rx="2" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".18"/><rect x="13.2" y="13.2" width="7.2" height="7.2" rx="2" stroke="currentColor" stroke-width="1.8"/>',
    leaf: '<path d="M20.4 3.8C11.2 3.8 4.8 8.3 4.8 15a5.2 5.2 0 0 0 8.8 3.7c4-3.6 6.2-9.7 6.8-14.9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="currentColor" fill-opacity=".12"/><path d="M4.5 21c1.2-5 4-8.4 8.5-11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    note: '<path d="M9.4 17.2V6.4L19 4.2v10.6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><ellipse cx="6.9" cy="17.9" rx="2.7" ry="2.2" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".15"/><ellipse cx="16.5" cy="15.5" rx="2.7" ry="2.2" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".15"/>',
    ball: '<circle cx="12" cy="12" r="8.6" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 12h16.8M12 3.4v17.2M5.8 5.8a13 13 0 0 1 0 12.4M18.2 5.8a13 13 0 0 0 0 12.4" stroke="currentColor" stroke-width="1.6"/>',
    board: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="3.6" stroke="currentColor" stroke-width="1.8"/><path d="M3.6 9.2h16.8M3.6 14.8h16.8M9.2 3.6v16.8M14.8 3.6v16.8" stroke="currentColor" stroke-width="1.25" opacity=".42"/><circle cx="12" cy="12" r="2.1" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.5"/>',
    cards: '<rect x="8.4" y="3.1" width="11" height="16.2" rx="2.4" transform="rotate(10 13.9 11.2)" stroke="currentColor" stroke-width="1.7"/><rect x="4.2" y="4.6" width="11" height="15.8" rx="2.3" stroke="currentColor" stroke-width="1.8" fill="currentColor" fill-opacity=".06"/><path d="m9.7 9.2 2.1 2.7-2.1 2.7-2.1-2.7 2.1-2.7Z" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    play: '<path d="M8.4 5.6v12.8L19 12 8.4 5.6Z" fill="currentColor"/>',
    arrow: '<path d="M4.8 12h13.4m-5.2-5.2L18.2 12l-5.2 5.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    arrowLeft: '<path d="M19.2 12H5.8m5.2-5.2L5.8 12l5.2 5.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    arrowDown: '<path d="M12 4.8v13.4m-5.2-5.2L12 18.2l5.2-5.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
    controller: '<path d="M7.2 8.2h9.6a4.6 4.6 0 0 1 4.5 5.7l-.6 2.8a2.7 2.7 0 0 1-4.7 1.2l-1.3-1.4H9.3l-1.3 1.4a2.7 2.7 0 0 1-4.7-1.2l-.6-2.8a4.6 4.6 0 0 1 4.5-5.7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 12.3h2.6M9.3 11v2.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="15.4" cy="11.7" r=".9" fill="currentColor"/><circle cx="17.4" cy="13.7" r=".9" fill="currentColor"/>',
    keyboard: '<rect x="2.8" y="6" width="18.4" height="12" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M6.2 9.6h.1M9.4 9.6h.1M12.6 9.6h.1M15.8 9.6h.1M19 9.6h.1M6.2 12.7h.1M9.4 12.7h.1M12.6 12.7h.1M15.8 12.7h.1M18 12.7h.1M8 15.6h8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    phone: '<rect x="6.6" y="2.6" width="10.8" height="18.8" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M10.4 18.5h3.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    clock: '<circle cx="12" cy="12" r="8.4" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.2v5.2l3.4 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    spark: '<path d="M12 2.8 13.9 9l6.3 1.9-6.3 1.9L12 19l-1.9-6.2L3.8 10.9 10.1 9 12 2.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="currentColor" fill-opacity=".12"/>',
    empty: '<path d="M4.6 9.2 8 4.8h8l3.4 4.4v8.2a1.8 1.8 0 0 1-1.8 1.8H6.4a1.8 1.8 0 0 1-1.8-1.8V9.2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M4.8 9.4h14.4M9.4 13.2h5.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".65"/>'
  };

  function icon(name, cls) {
    const paths = ICON_PATHS[name] || ICON_PATHS.spark;
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + paths + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function categoryById(id) {
    if (id === 'favorites') return favoriteCategory;
    return categories.find(function (c) { return c.id === id; }) || null;
  }

  function gamesInCategory(id) {
    if (id === 'favorites') { const ids = new Set(favorites.read()); return games.filter(game => ids.has(game.id)); }
    return games.filter(function (g) { return g.category === id; });
  }

  function searchGames(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return games.filter(function (game) {
      const cat = categoryById(game.category);
      const haystack = [
        game.title,
        game.subtitle,
        game.description,
        cat ? cat.name : '',
        (game.tags || []).join(' ')
      ].join(' ').toLowerCase();
      return haystack.indexOf(q) !== -1;
    });
  }

  function categoryCard(cat) {
    const count = gamesInCategory(cat.id).length;
    return '' +
      '<a class="category-card" href="#/category/' + encodeURIComponent(cat.id) + '" style="--accent:' + esc(cat.accent) + '">' +
        '<div class="category-top">' +
          '<span class="category-icon">' + icon(cat.icon) + '</span>' +
          '<span class="category-arrow">' + icon('arrow') + '</span>' +
        '</div>' +
        '<h3>' + esc(cat.name) + '</h3>' +
        '<p>' + esc(cat.tagline) + '</p>' +
        '<div class="category-foot">' +
          '<span class="category-count">' + (count > 0 || cat.id === 'favorites' ? count + ' 款游戏' : '暂无游戏') + '</span>' +
          '<span class="category-dot"></span>' +
        '</div>' +
      '</a>';
  }

  function gameCard(game) {
    const cat = categoryById(game.category);
    return '' +
      '<div class="game-card-shell"><a class="game-card" href="' + esc(game.url) + '">' +
        '<div class="game-cover">' +
          '<img src="' + esc(game.cover) + '" alt="' + esc(game.title) + ' 封面" loading="lazy" />' +
          '<span class="game-shade"></span>' +
          (game.badge ? '<span class="game-badge">' + esc(game.badge) + '</span>' : '') +
          '<span class="game-play">' + icon('play') + '</span>' +
        '</div>' +
        '<div class="game-body">' +
          '<span class="game-kicker">' + esc(cat ? cat.name : '游戏') + '</span>' +
          '<h3>' + esc(game.title) + '</h3>' +
          '<p>' + esc(game.description) + '</p>' +
          '<div class="game-tags">' + (game.tags || []).map(function (tag) {
            return '<span>' + esc(tag) + '</span>';
          }).join('') + '</div>' +
        '</div>' +
      '</a>' + favoriteButton(game) + '</div>';
  }

  function featureGame(game) {
    const cat = categoryById(game.category);
    return '' +
      '<div class="feature-game-shell"><a class="feature-game" href="' + esc(game.url) + '">' +
        '<div class="feature-cover">' +
          '<img src="' + esc(game.cover) + '" alt="' + esc(game.title) + ' 封面" />' +
          '<span class="game-shade"></span>' +
          (game.badge ? '<span class="game-badge">' + esc(game.badge) + '</span>' : '') +
        '</div>' +
        '<div class="feature-info">' +
          '<span class="section-kicker">' + esc(cat ? cat.name : '精选') + ' · 本周推荐</span>' +
          '<h3>' + esc(game.title) + '</h3>' +
          '<p>' + esc(game.description) + '</p>' +
          '<div class="game-tags">' + (game.tags || []).map(function (tag) {
            return '<span>' + esc(tag) + '</span>';
          }).join('') + '</div>' +
          '<div class="feature-meta">' +
            '<span>' + icon('keyboard') + '键盘</span>' +
            '<span>' + icon('phone') + '触屏</span>' +
            '<span>' + icon('clock') + '限时冲线</span>' +
          '</div>' +
          '<span class="btn btn-primary btn-inline">开始游戏' + icon('play') + '</span>' +
        '</div>' +
      '</a>' + favoriteButton(game) + '</div>';
  }

  function favoriteButton(game) {
    const active = favorites.read().includes(game.id);
    return '<button class="favorite-button" type="button" data-favorite="' + esc(game.id) + '" aria-pressed="' + active + '" aria-label="' + esc((active ? '取消收藏：' : '收藏：') + game.title) + '">' + icon('heart') + '<span>' + (active ? '已收藏' : '收藏') + '</span></button>';
  }

  function notifyFavorite(text) {
    const notice = document.getElementById('favorite-notice');
    notice.textContent = text; notice.hidden = false;
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
  }

  function stopHomeRotation() {
    clearInterval(homeTimer); clearTimeout(slideTimer); homeTimer = slideTimer = null;
  }

  function showcaseCard(game, saved) {
    const cat = categoryById(game.category);
    return '<div class="showcase-slide" data-game-id="' + esc(game.id) + '"><a class="showcase-card" href="' + esc(game.url) + '">' +
      '<img src="' + esc(game.cover) + '" alt="' + esc(game.title) + ' 游戏封面" />' +
      '<span class="showcase-shade"></span><span class="game-badge">' + esc(game.badge || 'PLAY') + '</span>' +
      '<div class="showcase-meta"><span class="showcase-kicker">' + esc(cat ? cat.name : '精选') + (saved ? ' · 我的收藏' : ' · 竞速') + '</span>' +
      '<h2>' + esc(game.title) + '</h2><span class="showcase-play">' + icon('play') + '开始游戏</span></div></a>' + favoriteButton(game) + '</div>';
  }

  function updateHomeFavorites() {
    stopHomeRotation();
    const stage = document.getElementById('showcase-stage');
    if (!stage) return;
    const saved = gamesInCategory('favorites');
    const featured = games.find(game => game.featured) || games[0];
    const queue = saved.slice();
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (!queue.length && featured) queue.push(featured);
    const entry = document.getElementById('home-play');
    entry.href = saved.length ? '#/category/favorites' : featured.url;
    entry.innerHTML = icon(saved.length ? 'heart' : 'play') + (saved.length ? '我的收藏' : '立即开玩');
    const chip = app.querySelector('.chip-c');
    chip.innerHTML = icon(saved.length ? 'heart' : 'clock') + (saved.length ? saved.length + ' 款收藏' : '限时冲线');
    stage.innerHTML = queue.length ? showcaseCard(queue[0], saved.length > 0) : '';
    const pause = document.getElementById('showcase-pause');
    pause.hidden = saved.length < 2;
    pause.setAttribute('aria-pressed', 'false'); pause.textContent = '暂停轮播';
    pause.onclick = () => {
      const paused = pause.getAttribute('aria-pressed') !== 'true';
      pause.setAttribute('aria-pressed', String(paused)); pause.textContent = paused ? '继续轮播' : '暂停轮播';
    };
    let index = 0;
    if (saved.length > 1) homeTimer = setInterval(() => {
      if (document.hidden || pause.getAttribute('aria-pressed') === 'true' || stage.contains(document.activeElement) || stage.matches(':hover')) return;
      const old = stage.querySelector('.showcase-slide');
      index = (index + 1) % queue.length;
      stage.insertAdjacentHTML('beforeend', showcaseCard(queue[index], true));
      const next = stage.lastElementChild;
      next.classList.add('slide-enter');
      old.classList.add('slide-leave'); old.inert = true; old.setAttribute('aria-hidden', 'true');
      slideTimer = setTimeout(() => { old.remove(); next.classList.remove('slide-enter'); }, 600);
    }, 10000);
  }

  function emptyState(title, desc, actionHref, actionLabel) {
    return '' +
      '<div class="empty-state">' +
        '<div class="empty-art">' + icon('empty') + '<span class="empty-glow"></span></div>' +
        '<h3>' + esc(title) + '</h3>' +
        '<p>' + esc(desc) + '</p>' +
        '<a class="btn btn-primary" href="' + esc(actionHref) + '">' + esc(actionLabel) + icon('arrow') + '</a>' +
      '</div>';
  }

  function renderHome() {
    const featured = games.find(function (g) { return g.featured; }) || games[0];

    app.innerHTML = '' +
      '<div class="view">' +
        '<section class="hero">' +
          '<div class="hero-copy">' +
            '<span class="eyebrow"><span class="eyebrow-dot"></span>无需下载 · 打开即玩</span>' +
            '<h1>别等了，<br /><span class="gradient-text">来玩一局。</span></h1>' +
            '<p class="hero-lead">一个轻量的网页小游戏合集。竞速、街机、解谜、棋牌都能玩，手机触屏、电脑键盘随时开局。</p>' +
            '<div class="hero-actions">' +
              (featured
                ? '<a id="home-play" class="btn btn-primary btn-lg" href="' + esc(featured.url) + '">' + icon('play') + '立即开玩</a>'
                : '') +
              '<button class="btn btn-ghost btn-lg" type="button" data-scroll-categories>浏览分区' + icon('arrowDown') + '</button>' +
            '</div>' +
            '<div class="hero-stats">' +
              '<div><strong>' + games.length + '</strong><span>款游戏</span></div>' +
              '<div><strong>' + (categories.length + 1) + '</strong><span>个分区</span></div>' +
              '<div><strong>0</strong><span>次下载</span></div>' +
            '</div>' +
          '</div>' +
          (featured
            ? '<div class="hero-showcase">' +
                '<div class="showcase-glow" aria-hidden="true"></div>' +
                '<div id="showcase-stage" class="showcase-stage" aria-label="推荐游戏"></div>' +
                '<button id="showcase-pause" class="showcase-pause" type="button" aria-pressed="false" hidden>暂停轮播</button>' +
                '<span class="float-chip chip-a">' + icon('phone') + '手机触屏</span>' +
                '<span class="float-chip chip-b">' + icon('keyboard') + '键盘操控</span>' +
                '<span class="float-chip chip-c">' + icon('clock') + '限时冲线</span>' +
              '</div>'
            : '') +
        '</section>' +

        '<section class="section" id="categories">' +
          '<div class="section-head">' +
            '<div><span class="section-kicker">CATEGORIES</span><h2>按分区逛逛</h2></div>' +
            '<p class="section-note">目前有 ' + games.length + ' 款游戏，更多正在路上。</p>' +
          '</div>' +
          '<div class="category-grid">' + [favoriteCategory].concat(categories).map(categoryCard).join('') + '</div>' +
        '</section>' +

        '<section class="section section-last">' +
          '<div class="section-head">' +
            '<div><span class="section-kicker">FEATURED</span><h2>精选游戏</h2></div>' +
            '<a class="text-link" href="#/category/racing">查看赛车分区' + icon('arrow') + '</a>' +
          '</div>' +
          (featured ? featureGame(featured) : emptyState('还没有游戏', '新的游戏正在制作中，敬请期待。', '#/', '回到首页')) +
        '</section>' +
      '</div>';

    bindHomeEvents();
    updateHomeFavorites();
  }

  function bindHomeEvents() {
    const scrollBtn = app.querySelector('[data-scroll-categories]');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', function () {
        const target = document.getElementById('categories');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function renderCategory(id) {
    if (id === 'favorites') { renderFavorites(); return; }
    const cat = categoryById(id);
    if (!cat) {
      app.innerHTML = '<div class="view"><section class="page-head"><a class="back-link" href="#/">' + icon('arrowLeft') + '返回首页</a></section>' +
        emptyState('没有找到这个分区', '它可能已经被移动或尚未开放。', '#/', '回到主菜单') + '</div>';
      return;
    }
    const allGames = gamesInCategory(cat.id);
    let list = allGames;
    let categoryQuery = '';
    try { categoryQuery = sessionStorage.getItem('litegame.category-search.' + cat.id) || ''; } catch (e) {}
    app.innerHTML = '' +
      '<div class="view">' +
        '<section class="page-head" style="--accent:' + esc(cat.accent) + '">' +
          '<a class="back-link" href="#/">' + icon('arrowLeft') + '返回主菜单</a>' +
          '<div class="page-head-row">' +
            '<span class="page-icon">' + icon(cat.icon) + '</span>' +
            '<div class="page-title">' +
              '<span class="section-kicker">CATEGORY</span>' +
              '<h1>' + esc(cat.name) + '分区</h1>' +
              '<p>' + esc(cat.description) + '</p>' +
            '</div>' +
            '<span class="page-count">' + list.length + '<small>款游戏</small></span>' +
          '</div>' +
        '</section>' +
        '<section class="category-search" role="search" aria-label="搜索本分区">' +
          '<label for="category-search">搜索本分区的游戏</label>' +
          '<div class="category-search-row"><input id="category-search" type="search" placeholder="输入游戏名称或关键词" autocomplete="off" value="' + esc(categoryQuery) + '"><button id="category-search-clear" class="btn btn-ghost" type="button">清空</button></div>' +
          '<p id="category-search-status" role="status"></p>' +
        '</section>' +
        (cat.id === 'retro'
          ? '<section class="section section-tight"><a class="btn btn-ghost" href="games/nes/index.html">打开游戏机 / 导入本地卡带</a><nav id="retro-pages-top" class="game-pagination" aria-label="怀旧游戏顶部分页"></nav><div id="retro-cards" class="game-grid"></div><nav id="retro-pages" class="game-pagination" aria-label="怀旧游戏底部分页"></nav></section>'
          : list.length
          ? '<section class="section section-tight"><div id="category-cards" class="game-grid">' + list.map(gameCard).join('') + '</div></section>'
          : '<section class="section section-tight">' + emptyState('这个分区还是空的', '我们正在给它攒一个好玩的开局，先去其他分区逛逛吧。', '#/', '回到主菜单') + '</section>') +
      '</div>';
    const field = document.getElementById('category-search');
    function filterCategory() {
      const q = field.value.trim().toLowerCase();
      list = allGames.filter(game => [game.title, game.subtitle, game.description, (game.tags || []).join(' ')].join(' ').toLowerCase().includes(q));
      document.getElementById('category-search-status').textContent = list.length ? '找到 ' + list.length + ' 款本分区游戏' : '本分区没有匹配的游戏，请换个关键词或清空搜索。';
      try { sessionStorage.setItem('litegame.category-search.' + cat.id, field.value); } catch (e) {}
    }
    filterCategory();
    let updateCategory;
    if (cat.id === 'retro') {
      let page = 0;
      try { page = Math.max(0, Math.min(Math.ceil(list.length / 36) - 1, Math.floor(Number(sessionStorage.getItem('litegame.retro-page'))) || 0)); } catch (e) {}
      function renderRetroPage() {
        document.getElementById('retro-cards').innerHTML = list.slice(page * 36, (page + 1) * 36).map(gameCard).join('');
        for (const id of ['retro-pages-top', 'retro-pages']) {
          const nav = document.getElementById(id); nav.replaceChildren();
          const label = document.createElement('span'); label.textContent = (page + 1) + ' / ' + Math.max(1, Math.ceil(list.length / 36));
          for (const [text, step] of [['上一页', -1], ['下一页', 1]]) {
            const button = document.createElement('button'); button.className = 'btn btn-ghost'; button.textContent = text;
            button.disabled = page + step < 0 || (page + step) * 36 >= list.length;
            button.onclick = function () {
              page += step;
              try { sessionStorage.setItem('litegame.retro-page', String(page)); } catch (e) {}
              renderRetroPage(); document.getElementById('retro-pages-top').scrollIntoView({ block: 'start', behavior: 'instant' });
              document.querySelector('#retro-pages-top button:not(:disabled)').focus({ preventScroll: true });
            };
            nav.append(button); if (step === -1) nav.append(label);
          }
        }
      }
      renderRetroPage();
      updateCategory = () => { page = 0; try { sessionStorage.setItem('litegame.retro-page', '0'); } catch (e) {} renderRetroPage(); };
    } else {
      updateCategory = () => { const cards = document.getElementById('category-cards'); if (cards) cards.innerHTML = list.map(gameCard).join(''); };
      updateCategory();
    }
    field.addEventListener('input', () => { filterCategory(); updateCategory(); });
    document.getElementById('category-search-clear').onclick = () => { field.value = ''; filterCategory(); updateCategory(); field.focus(); };
  }

  function renderSearch(query) {
    const q = query.trim();
    const results = searchGames(q);
    const cats = categories.filter(function (cat) {
      return cat.name.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    });
    app.innerHTML = '' +
      '<div class="view">' +
        '<section class="page-head page-head-search">' +
          '<a class="back-link" href="#/">' + icon('arrowLeft') + '返回主菜单</a>' +
          '<div class="page-head-row">' +
            '<span class="page-icon page-icon-search">' + icon('spark') + '</span>' +
            '<div class="page-title">' +
              '<span class="section-kicker">SEARCH</span>' +
              '<h1>搜索 “' + esc(q) + '”</h1>' +
              '<p>找到 ' + results.length + ' 款相关游戏' +
                (results.length === 0 && cats.length ? '，你也可以去 ' + cats.map(function (c) { return esc(c.name); }).join('、') + ' 分区看看。' : '。') +
              '</p>' +
            '</div>' +
          '</div>' +
        '</section>' +
        (results.length
          ? '<section class="section section-tight"><div class="game-grid">' + results.map(gameCard).join('') + '</div></section>'
          : '<section class="section section-tight">' + emptyState('没有找到相关游戏', '试试更短的关键词，比如「赛车」「数独」或「双人」。', '#/', '回到主菜单') + '</section>') +
      '</div>';
  }

  function downloadJSON(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function renderFavorites() {
    app.innerHTML = '<div class="view"><section class="page-head"><a class="back-link" href="#/">' + icon('arrowLeft') + '返回主菜单</a>' +
      '<div class="page-head-row"><span class="page-icon">' + icon('heart') + '</span><div class="page-title"><span class="section-kicker">FAVORITES</span><h1>我的收藏</h1><p>' + esc(favoriteCategory.description) + '</p></div><span class="page-count"><span data-favorite-count>0</span><small>款游戏</small></span></div></section>' +
      '<section class="favorites-tools"><div class="data-actions"><button id="favorites-export" class="btn btn-primary" type="button">导出收藏</button><button id="favorites-import" class="btn btn-ghost" type="button">导入收藏</button><input id="favorites-file" type="file" accept="application/json,.json" hidden></div><p>导入会合并到当前收藏并自动去重。收藏备份只记录游戏列表。</p><p id="favorites-message" role="status"></p></section>' +
      '<section class="category-search" role="search" aria-label="搜索我的收藏"><label for="favorites-search">搜索我的收藏</label><div class="category-search-row"><input id="favorites-search" type="search" placeholder="输入游戏名称或关键词"><button id="favorites-clear" class="btn btn-ghost" type="button">清空</button></div></section>' +
      '<nav id="favorites-pages-top" class="game-pagination" aria-label="收藏顶部分页"></nav><div id="favorites-cards" class="game-grid"></div><div id="favorites-empty"></div><nav id="favorites-pages" class="game-pagination" aria-label="收藏底部分页"></nav></div>';
    const field = document.getElementById('favorites-search');
    let page = 0;
    refreshFavoriteList = () => {
      const all = gamesInCategory('favorites'), q = field.value.trim().toLowerCase();
      const list = all.filter(game => [game.title, game.description, (game.tags || []).join(' '), categoryById(game.category).name].join(' ').toLowerCase().includes(q));
      const pages = Math.max(1, Math.ceil(list.length / 36)); page = Math.min(page, pages - 1);
      document.getElementById('favorites-cards').innerHTML = list.slice(page * 36, (page + 1) * 36).map(gameCard).join('');
      document.getElementById('favorites-empty').innerHTML = list.length ? '' : emptyState(all.length ? '没有匹配的收藏' : '还没有收藏游戏', all.length ? '换个关键词或清空搜索试试。' : '点击游戏卡片上的“收藏”，把喜欢的游戏放到这里。', '#/', '去挑选游戏');
      document.getElementById('favorites-export').disabled = !all.length;
      document.querySelectorAll('[data-favorite-count]').forEach(node => { node.textContent = all.length; });
      for (const id of ['favorites-pages-top', 'favorites-pages']) {
        const nav = document.getElementById(id); nav.replaceChildren(); nav.hidden = !list.length;
        for (const step of [-1, 1]) {
          const button = document.createElement('button'); button.className = 'btn btn-ghost'; button.textContent = step < 0 ? '上一页' : '下一页';
          button.disabled = page + step < 0 || page + step >= pages;
          button.onclick = () => { page += step; refreshFavoriteList(); document.getElementById('favorites-pages-top').scrollIntoView({ block: 'start' }); };
          nav.append(button);
          if (step < 0) { const label = document.createElement('span'); label.textContent = (page + 1) + ' / ' + pages; nav.append(label); }
        }
      }
    };
    field.oninput = () => { page = 0; refreshFavoriteList(); };
    document.getElementById('favorites-clear').onclick = () => { field.value = ''; page = 0; refreshFavoriteList(); field.focus(); };
    document.getElementById('favorites-export').onclick = () => downloadJSON(favorites.export(), 'litegame-favorites-' + new Date().toISOString().slice(0, 10) + '.json');
    const fileInput = document.getElementById('favorites-file');
    document.getElementById('favorites-import').onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0], message = document.getElementById('favorites-message');
      if (!file) return;
      try {
        const result = favorites.import(JSON.parse(await file.text()));
        message.textContent = '导入完成，新增 ' + result.added + ' 款收藏。' + (result.skipped ? '已跳过 ' + result.skipped + ' 款当前目录不存在的游戏。' : '');
      } catch (e) { message.textContent = '导入失败：' + e.message; }
      fileInput.value = '';
    };
    refreshFavoriteList();
  }

  app.addEventListener('click', event => {
    const button = event.target.closest('[data-favorite]');
    if (!button) return;
    const id = button.dataset.favorite;
    try {
      const ids = favorites.toggle(id);
      notifyFavorite(ids.includes(id) ? '已加入我的收藏' : '已取消收藏');
    } catch (e) { notifyFavorite('收藏未保存：浏览器存储不可用，请重试。'); }
  });

  function syncFavorites() {
    const ids = new Set(favorites.read());
    document.querySelectorAll('[data-favorite-count]').forEach(node => { node.textContent = ids.size; });
    app.querySelectorAll('[data-favorite]').forEach(button => {
      const game = games.find(game => game.id === button.dataset.favorite), active = ids.has(game.id);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', (active ? '取消收藏：' : '收藏：') + game.title);
      button.querySelector('span').textContent = active ? '已收藏' : '收藏';
    });
    const count = app.querySelector('a[href="#/category/favorites"] .category-count');
    if (count) count.textContent = ids.size + ' 款游戏';
    if (refreshFavoriteList) refreshFavoriteList();
    updateHomeFavorites();
  }
  window.addEventListener('favoriteschange', syncFavorites);

  function showSearchDropdown() {
    const q = searchInput.value.trim();
    if (!q) {
      hideSearchDropdown();
      return;
    }
    const results = searchGames(q).slice(0, 6);
    const items = results.map(function (game) {
      const cat = categoryById(game.category);
      return '' +
        '<div class="search-result-shell"><a class="search-result" href="' + esc(game.url) + '">' +
          '<span class="search-thumb"><img src="' + esc(game.cover) + '" alt="" loading="lazy" /></span>' +
          '<span class="search-result-text">' +
            '<strong>' + esc(game.title) + '</strong>' +
            '<small>' + esc(cat ? cat.name : '游戏') + ' · ' + esc((game.tags || []).slice(0, 2).join(' / ')) + '</small>' +
          '</span>' +
          icon('arrow', 'search-go') +
        '</a>' + favoriteButton(game) + '</div>';
    }).join('');

    searchDropdown.innerHTML = results.length
      ? items +
        '<a class="search-all" href="#/search/' + encodeURIComponent(q) + '">查看全部搜索结果' + icon('arrow') + '</a>'
      : '<div class="search-none">没有找到 “' + esc(q) + '”<br /><span>换个关键词试试，比如「数独」</span></div>';
    searchDropdown.hidden = false;
  }

  function hideSearchDropdown() {
    searchDropdown.hidden = true;
  }

  function goSearch() {
    const q = searchInput.value.trim();
    if (!q) {
      searchInput.focus();
      return;
    }
    hideSearchDropdown();
    searchInput.blur();
    const hash = '#/search/' + encodeURIComponent(q);
    if (location.hash === hash) {
      route();
    } else {
      location.hash = hash;
    }
  }

  let pendingCategoryScroll = false;
  let routeNavigation = 'initial';
  let currentRouteKey = '';
  let routeTrail = [];
  let routeTrailIndex = -1;
  const SCROLL_STORAGE_KEY = 'litegame.scroll-position';

  function routeKey(hash) {
    return (hash || '').replace(/^#\/?/, '') || 'home';
  }

  function readScrollPositions() {
    try { return JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function saveRouteScroll(key) {
    if (!key) return;
    try {
      const positions = readScrollPositions();
      positions[key] = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
    } catch (e) { /* storage may be unavailable */ }
  }

  function applyRouteScroll(key, mode) {
    const categoryScroll = pendingCategoryScroll;
    if (categoryScroll) pendingCategoryScroll = false;
    function restore() {
      if (categoryScroll) {
        const target = document.getElementById('categories');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      let top = 0;
      if (mode === 'back' || mode === 'initial') {
        const saved = readScrollPositions()[key];
        if (typeof saved === 'number' && isFinite(saved)) top = saved;
      }
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, top);
      requestAnimationFrame(function () { root.style.scrollBehavior = previousBehavior; });
    }
    restore();
    requestAnimationFrame(restore);
    // Some mobile browsers apply their own fragment restoration after
    // hashchange. A final task wins that race without changing the visible
    // behavior of ordinary route transitions.
    setTimeout(restore, 0);
    setTimeout(restore, 60);
  }

  function route() {
    stopHomeRotation(); refreshFavoriteList = null;
    const nextRouteKey = routeKey(location.hash);
    let navigation = routeNavigation;
    if (currentRouteKey && currentRouteKey !== nextRouteKey) {
      // Safari and some embedded WebViews report a fragment traversal through
      // hashchange without firing popstate. The route trail lets us identify
      // that traversal instead of treating it as a fresh forward navigation.
      if (routeTrailIndex > 0 && routeTrail[routeTrailIndex - 1] === nextRouteKey) navigation = 'back';
      else if (routeTrailIndex + 1 < routeTrail.length && routeTrail[routeTrailIndex + 1] === nextRouteKey) navigation = 'forward';
    }
    if (currentRouteKey && currentRouteKey !== nextRouteKey) saveRouteScroll(currentRouteKey);
    currentRouteKey = nextRouteKey;
    if (routeTrailIndex < 0) {
      routeTrail = [nextRouteKey];
      routeTrailIndex = 0;
    } else if (navigation === 'back' && routeTrailIndex > 0) {
      routeTrailIndex--;
    } else if (navigation === 'forward') {
      routeTrail = routeTrail.slice(0, routeTrailIndex + 1);
      routeTrail.push(nextRouteKey);
      routeTrailIndex++;
    }
    const hash = location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);
    let routeName = 'home';
    let routeId = '';
    let routeQuery = '';

    if (parts[0] === 'category' && parts[1]) {
      routeName = 'category';
      routeId = decodeURIComponent(parts.slice(1).join('/'));
    } else if (parts[0] === 'search' && parts[1]) {
      routeName = 'search';
      routeQuery = decodeURIComponent(parts.slice(1).join('/'));
    }

    hideSearchDropdown();
    if (routeName !== 'search') searchInput.value = '';

    if (routeName === 'category') {
      renderCategory(routeId);
      document.title = '分区 · LiteGame 轻量游戏厅';
    } else if (routeName === 'search') {
      searchInput.value = routeQuery;
      renderSearch(routeQuery);
      document.title = '搜索 · LiteGame 轻量游戏厅';
    } else {
      renderHome();
      document.title = 'LiteGame 轻量游戏厅 · 网页小游戏合集';
    }
    applyRouteScroll(nextRouteKey, navigation);
    document.querySelectorAll('[data-favorite-count]').forEach(node => { node.textContent = favorites.read().length; });
    routeNavigation = 'forward';
  }

  searchInput.addEventListener('input', showSearchDropdown);
  searchInput.addEventListener('focus', function () {
    if (searchInput.value.trim()) showSearchDropdown();
  });
  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      goSearch();
    } else if (event.key === 'Escape') {
      hideSearchDropdown();
      searchInput.blur();
    }
  });

  searchDropdown.addEventListener('click', function (event) {
    const button = event.target.closest('[data-favorite]');
    if (button) {
      try { favorites.toggle(button.dataset.favorite); showSearchDropdown(); }
      catch (e) { notifyFavorite('收藏未保存：浏览器存储不可用，请重试。'); }
      return;
    }
    const link = event.target.closest('a');
    if (link) {
      hideSearchDropdown();
      searchInput.blur();
    }
  });

  document.addEventListener('click', function (event) {
    const link = event.target.closest && event.target.closest('a[href^="#"]');
    if (link) {
      saveRouteScroll(currentRouteKey);
      routeNavigation = 'forward';
    }
  }, true);

  document.addEventListener('click', function (event) {
    if (!searchWrap.contains(event.target)) hideSearchDropdown();
  });

  document.addEventListener('keydown', function (event) {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement && document.activeElement.isContentEditable);
    if (event.key === '/' && !typing) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  allCategoriesLink.addEventListener('click', function (event) {
    event.preventDefault();
    const isHome = !location.hash || location.hash === '#/' || location.hash === '#';
    if (isHome) {
      const target = document.getElementById('categories');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      pendingCategoryScroll = true;
      if (location.hash === '#/' || location.hash === '') {
        route();
      } else {
        location.hash = '#/';
      }
    }
  });

  window.addEventListener('popstate', function () { routeNavigation = 'back'; });
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', function () { saveRouteScroll(currentRouteKey); stopHomeRotation(); });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && currentRouteKey) { syncFavorites(); applyRouteScroll(currentRouteKey, 'back'); }
  });

  /* -------------------------------------------- 进度导入 / 导出 */

  const DATA_PREFIXES = ['litegame.', 'chogan.'];
  const dataBtn = document.getElementById('dataBtn');
  const dataModal = document.getElementById('dataModal');
  const dataStats = document.getElementById('dataStats');
  const dataMsg = document.getElementById('dataMsg');
  const dataConfirm = document.getElementById('dataConfirm');
  const dataConfirmText = document.getElementById('dataConfirmText');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const importConfirmBtn = document.getElementById('importConfirmBtn');
  const importCancelBtn = document.getElementById('importCancelBtn');

  let pendingImport = null;

  function storedEntries() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && DATA_PREFIXES.some(function (p) { return k.indexOf(p) === 0; })) {
          out.push([k, localStorage.getItem(k)]);
        }
      }
    } catch (e) { /* 隐私模式等 */ }
    return out;
  }

  function gameIdsOf(entries) {
    const ids = new Set();
    entries.forEach(function (pair) {
      if (pair[0] === favorites.key) return;
      const parts = pair[0].split('.');
      if (parts[0] === 'chogan' && parts[1] && parts[1] !== 'app') ids.add(parts[1]);
      else if (parts[0] === 'litegame') ids.add(parts.slice(1).join('.'));
    });
    return ids;
  }

  function showDataMsg(text, ok) {
    dataMsg.hidden = false;
    dataMsg.textContent = text;
    dataMsg.classList.toggle('data-msg-ok', !!ok);
    dataMsg.classList.toggle('data-msg-err', !ok);
  }

  function openDataModal() {
    const entries = storedEntries();
    const ids = gameIdsOf(entries);
    dataStats.textContent = entries.length
      ? '当前已有 ' + entries.length + ' 条记录，来自 ' + ids.size + ' 款游戏；已收藏 ' + favorites.read().length + ' 款。'
      : '当前还没有任何游戏记录，玩过一局后这里就会有数据。';
    dataMsg.hidden = true;
    dataConfirm.hidden = true;
    pendingImport = null;
    dataModal.hidden = false;
  }

  function closeDataModal() {
    dataModal.hidden = true;
    dataConfirm.hidden = true;
    pendingImport = null;
    importFile.value = '';
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  exportBtn.addEventListener('click', function () {
    const entries = storedEntries();
    if (!entries.length) {
      showDataMsg('还没有可导出的记录，先去玩一局吧。', false);
      return;
    }
    const data = {};
    entries.forEach(function (pair) { data[pair[0]] = pair[1]; });
    const now = new Date();
    const stamp = now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '-' + pad2(now.getHours()) + pad2(now.getMinutes());
    const payload = {
      app: 'litegame',
      type: 'progress-backup',
      version: 1,
      exportedAt: now.toISOString(),
      count: entries.length,
      data: data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'litegame-progress-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    showDataMsg('已导出 ' + entries.length + ' 条记录，文件在浏览器下载里。', true);
  });

  importBtn.addEventListener('click', function () { importFile.click(); });

  importFile.addEventListener('change', function () {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        showDataMsg('导入失败：这不是有效的 JSON 文件。', false);
        return;
      }
      if (!parsed || parsed.app !== 'litegame' || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
        showDataMsg('导入失败：文件不是 LiteGame 的进度备份。', false);
        return;
      }
      const keys = Object.keys(parsed.data);
      if (Object.prototype.hasOwnProperty.call(parsed.data, favorites.key)) {
        try { favorites.validate(JSON.parse(parsed.data[favorites.key])); }
        catch (e) { showDataMsg('导入失败：备份中的收藏记录格式不正确。', false); return; }
      }
      if (!keys.length) {
        showDataMsg('这个备份文件里没有记录。', false);
        return;
      }
      pendingImport = parsed;
      const when = parsed.exportedAt ? new Date(parsed.exportedAt) : null;
      const whenText = when && !isNaN(when.getTime())
        ? '，导出于 ' + when.getFullYear() + '-' + pad2(when.getMonth() + 1) + '-' + pad2(when.getDate())
        : '';
      dataConfirmText.textContent = '文件里有 ' + keys.length + ' 条记录' + whenText + '。导入会覆盖浏览器里同名的记录，确定继续吗？';
      dataMsg.hidden = true;
      dataConfirm.hidden = false;
    };
    reader.onerror = function () {
      showDataMsg('导入失败：文件读取不了。', false);
    };
    reader.readAsText(file);
  });

  importConfirmBtn.addEventListener('click', function () {
    if (!pendingImport) return;
    let written = 0;
    try {
      Object.keys(pendingImport.data).forEach(function (k) {
        if (DATA_PREFIXES.some(function (p) { return k.indexOf(p) === 0; })) {
          localStorage.setItem(k, String(pendingImport.data[k]));
          written++;
        }
      });
    } catch (e) {
      showDataMsg('导入失败：浏览器存储不可用。', false);
      dataConfirm.hidden = true;
      pendingImport = null;
      return;
    }
    dataConfirm.hidden = true;
    pendingImport = null;
    importFile.value = '';
    showDataMsg('已导入 ' + written + ' 条记录，正在刷新页面…', true);
    setTimeout(function () { location.reload(); }, 900);
  });

  importCancelBtn.addEventListener('click', function () {
    dataConfirm.hidden = true;
    pendingImport = null;
    importFile.value = '';
  });

  dataBtn.addEventListener('click', openDataModal);
  dataModal.addEventListener('click', function (event) {
    if (event.target.closest('[data-close]')) closeDataModal();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !dataModal.hidden) closeDataModal();
  });

  try { history.scrollRestoration = 'manual'; } catch (e) { /* older browsers */ }
  route();
})();
