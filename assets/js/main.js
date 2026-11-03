(function () {
  'use strict';

  const { categories, games } = window.GAME_DATA;
  const app = document.getElementById('app');
  const searchInput = document.getElementById('searchInput');
  const searchDropdown = document.getElementById('searchDropdown');
  const searchWrap = document.querySelector('.search-wrap');
  const allCategoriesLink = document.getElementById('allCategoriesLink');

  const ICON_PATHS = {
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
    return categories.find(function (c) { return c.id === id; }) || null;
  }

  function gamesInCategory(id) {
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
          '<span class="category-count">' + (count > 0 ? count + ' 款游戏' : '暂无游戏') + '</span>' +
          '<span class="category-dot"></span>' +
        '</div>' +
      '</a>';
  }

  function gameCard(game) {
    const cat = categoryById(game.category);
    return '' +
      '<a class="game-card" href="' + esc(game.url) + '">' +
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
      '</a>';
  }

  function featureGame(game) {
    const cat = categoryById(game.category);
    return '' +
      '<a class="feature-game" href="' + esc(game.url) + '">' +
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
      '</a>';
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
    const featuredCat = featured ? categoryById(featured.category) : null;

    app.innerHTML = '' +
      '<div class="view">' +
        '<section class="hero">' +
          '<div class="hero-copy">' +
            '<span class="eyebrow"><span class="eyebrow-dot"></span>无需下载 · 打开即玩</span>' +
            '<h1>别等了，<br /><span class="gradient-text">来玩一局。</span></h1>' +
            '<p class="hero-lead">一个轻量的网页小游戏合集。竞速、街机、解谜、棋牌都能玩，手机触屏、电脑键盘随时开局。</p>' +
            '<div class="hero-actions">' +
              (featured
                ? '<a class="btn btn-primary btn-lg" href="' + esc(featured.url) + '">' + icon('play') + '立即开玩</a>'
                : '') +
              '<button class="btn btn-ghost btn-lg" type="button" data-scroll-categories>浏览分区' + icon('arrowDown') + '</button>' +
            '</div>' +
            '<div class="hero-stats">' +
              '<div><strong>' + games.length + '</strong><span>款游戏</span></div>' +
              '<div><strong>' + categories.length + '</strong><span>个分区</span></div>' +
              '<div><strong>0</strong><span>次下载</span></div>' +
            '</div>' +
          '</div>' +
          (featured
            ? '<div class="hero-showcase">' +
                '<div class="showcase-glow" aria-hidden="true"></div>' +
                '<a class="showcase-card" href="' + esc(featured.url) + '">' +
                  '<img src="' + esc(featured.cover) + '" alt="' + esc(featured.title) + ' 游戏封面" />' +
                  '<span class="showcase-shade"></span>' +
                  '<span class="game-badge">' + esc(featured.badge || 'PLAY') + '</span>' +
                  '<div class="showcase-meta">' +
                    '<span class="showcase-kicker">' + esc(featuredCat ? featuredCat.name : '精选') + ' · 竞速</span>' +
                    '<h2>' + esc(featured.title) + '</h2>' +
                    '<span class="showcase-play">' + icon('play') + '开始游戏</span>' +
                  '</div>' +
                '</a>' +
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
          '<div class="category-grid">' + categories.map(categoryCard).join('') + '</div>' +
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
    const cat = categoryById(id);
    if (!cat) {
      app.innerHTML = '<div class="view"><section class="page-head"><a class="back-link" href="#/">' + icon('arrowLeft') + '返回首页</a></section>' +
        emptyState('没有找到这个分区', '它可能已经被移动或尚未开放。', '#/', '回到主菜单') + '</div>';
      return;
    }
    const list = gamesInCategory(cat.id);
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
        (list.length
          ? '<section class="section section-tight"><div class="game-grid">' + list.map(gameCard).join('') + '</div></section>'
          : '<section class="section section-tight">' + emptyState('这个分区还是空的', '我们正在给它攒一个好玩的开局，先去其他分区逛逛吧。', '#/', '回到主菜单') + '</section>') +
      '</div>';
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
        '<a class="search-result" href="' + esc(game.url) + '">' +
          '<span class="search-thumb"><img src="' + esc(game.cover) + '" alt="" loading="lazy" /></span>' +
          '<span class="search-result-text">' +
            '<strong>' + esc(game.title) + '</strong>' +
            '<small>' + esc(cat ? cat.name : '游戏') + ' · ' + esc((game.tags || []).slice(0, 2).join(' / ')) + '</small>' +
          '</span>' +
          icon('arrow', 'search-go') +
        '</a>';
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

  function route() {
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
      window.scrollTo({ top: 0 });
    } else if (routeName === 'search') {
      searchInput.value = routeQuery;
      renderSearch(routeQuery);
      document.title = '搜索 · LiteGame 轻量游戏厅';
      window.scrollTo({ top: 0 });
    } else {
      renderHome();
      document.title = 'LiteGame 轻量游戏厅 · 网页小游戏合集';
      if (pendingCategoryScroll) {
        pendingCategoryScroll = false;
        requestAnimationFrame(function () {
          const target = document.getElementById('categories');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      } else {
        window.scrollTo({ top: 0 });
      }
    }
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
    const link = event.target.closest('a');
    if (link) {
      hideSearchDropdown();
      searchInput.blur();
    }
  });

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

  window.addEventListener('hashchange', route);
  route();
})();
