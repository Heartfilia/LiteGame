(function () {
  'use strict';
  const key = 'litegame.favorites';
  const known = new Set(window.GAME_DATA.games.map(game => game.id));
  function validate(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.ids) || data.ids.some(id => typeof id !== 'string')) {
      throw new Error('收藏记录格式不正确');
    }
    return [...new Set(data.ids)].filter(id => known.has(id));
  }
  function read() {
    try { return validate(JSON.parse(localStorage.getItem(key) || '{"version":1,"ids":[]}')); }
    catch (e) { return []; }
  }
  function write(ids) {
    const clean = validate({ version: 1, ids });
    localStorage.setItem(key, JSON.stringify({ version: 1, ids: clean }));
    window.dispatchEvent(new Event('favoriteschange'));
    return clean;
  }
  window.GameFavorites = {
    key, read, validate,
    toggle(id) {
      const ids = read();
      return write(ids.includes(id) ? ids.filter(value => value !== id) : ids.concat(id));
    },
    export() {
      return { app: 'litegame', type: 'favorites-backup', version: 1, exportedAt: new Date().toISOString(), ids: read() };
    },
    import(data) {
      if (!data || data.app !== 'litegame' || data.type !== 'favorites-backup') throw new Error('请选择 LiteGame 收藏备份文件');
      const ids = validate(data), before = read();
      const merged = write(before.concat(ids));
      return { added: merged.length - before.length, skipped: new Set(data.ids).size - ids.length };
    }
  };
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) window.dispatchEvent(new Event('favoriteschange'));
  });
})();
