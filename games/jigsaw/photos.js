(function () {
  'use strict';
  var entries = window.JIGSAW_PHOTOS, cache = new Map();
  window.JigsawPhotos = {
    entries: entries,
    get: function (id) { return entries.find(function (p) { return p.id === id; }); },
    load: function (id) {
      var entry = this.get(id);
      if (!entry) return Promise.reject(Error('没有找到这张图片'));
      if (!cache.has(id)) {
        var promise = new Promise(function (resolve, reject) {
          var image = new Image();
          var timeout = setTimeout(function () { image.onload = image.onerror = null; image.src = ''; reject(Error('图片加载超时')); }, 15000);
          image.onload = function () { clearTimeout(timeout); resolve(image); };
          image.onerror = function () { clearTimeout(timeout); reject(Error('图片加载失败')); };
          image.src = entry.src;
        }).catch(function (error) { cache.delete(id); throw error; });
        cache.set(id, promise);
      }
      return cache.get(id);
    }
  };
})();
