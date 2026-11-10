(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const library = window.NES_LIBRARY.games;
  const canvas = $('screen'), context = canvas.getContext('2d', { alpha: false });
  const image = context.createImageData(256, 240), pixels = new Uint32Array(image.data.buffer);
  let nes = null, rom = null, current = null, running = false, generation = 0;
  let lastTime = 0, debt = 0, frame = 0, audio = null, muted = true;
  let audioNode = null, read = 0, write = 0, stored = 0;
  const audioLeft = new Float32Array(16384), audioRight = new Float32Array(16384);
  const held = new Map();
  let page = 0;
  const display = window.NESDisplay({ release: releaseAll, pause, start });
  function status(text) { $('status').textContent = $('menu-status').textContent = text; }
  function buttons(ready) {
    for (const id of ['play', 'pause', 'reset', 'save', 'restore', 'export']) $(id).disabled = !ready;
    for (const id of ['menu-resume', 'menu-save', 'menu-restore']) $(id).disabled = !ready;
  }
  function draw(buffer) {
    for (let i = 0; i < pixels.length; i++) pixels[i] = 0xff000000 | buffer[i];
    context.putImageData(image, 0, 0);
  }
  function makeNES() {
    return new jsnes.NES({ onFrame: draw, sampleRate: audio ? audio.sampleRate : 48000,
      onAudioSample(left, right) {
        if (!running || muted || !audio || audio.state !== 'running') return;
        if (stored >= audioLeft.length) { read = (read + 1) % audioLeft.length; stored--; }
        audioLeft[write] = left; audioRight[write] = right;
        write = (write + 1) % audioLeft.length; stored++;
      } });
  }
  function flushAudio() { read = write = stored = 0; }
  async function enableAudio() {
    try {
      if (!audio) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw Error('此浏览器不支持 Web Audio');
        audio = new Audio({ sampleRate: 48000 });
        audioNode = audio.createScriptProcessor(2048, 0, 2);
        audioNode.onaudioprocess = e => {
          const l = e.outputBuffer.getChannelData(0), r = e.outputBuffer.getChannelData(1);
          for (let i = 0; i < l.length; i++) {
            l[i] = r[i] = 0;
            if (running && !muted && stored) {
              l[i] = audioLeft[read]; r[i] = audioRight[read];
              read = (read + 1) % audioLeft.length; stored--;
            }
          }
        };
        audioNode.connect(audio.destination);
      }
      await audio.resume();
      if (nes && nes.papu.sampleRate !== audio.sampleRate) {
        nes.opts.sampleRate = audio.sampleRate; nes.papu.sampleRate = audio.sampleRate; nes.papu.setFrameRate(60);
      }
    } catch (e) { status('声音未开启：' + e.message); }
  }
  function releaseAll() {
    if (nes) for (let p = 1; p <= 2; p++) for (let b = 0; b < 10; b++) nes.buttonUp(p, b);
    held.clear();
    document.querySelectorAll('[data-held]').forEach(b => b.removeAttribute('data-held'));
  }
  function pause(message) {
    running = false; cancelAnimationFrame(frame); frame = 0; releaseAll(); flushAudio();
    $('play').textContent = '开始 / 继续';
    if (message) status(message);
  }
  function tick(time) {
    if (!running) return;
    debt += Math.min(time - lastTime, 100); lastTime = time;
    try {
      let count = 0;
      while (debt >= 1000 / 60 && count < 4) { nes.frame(); debt -= 1000 / 60; count++; }
      if (count === 4) debt = 0;
    } catch (e) {
      pause('此版本运行异常：' + e.message + '。可以重新开机或选择其他版本。');
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function start() {
    if (!nes || running || display.menuOpen()) return;
    if (!muted) enableAudio();
    running = true; lastTime = performance.now(); debt = 0;
    $('screen-label').hidden = true; $('play').textContent = '运行中';
    status('运行中 · 按 START 开始游戏，SELECT 选择模式。');
    frame = requestAnimationFrame(tick);
  }
  function hold(source, player, name) {
    if (!nes || !running || held.has(source)) return;
    const button = jsnes.Controller['BUTTON_' + name];
    held.set(source, { player, button, name }); nes.buttonDown(player, button);
  }
  function release(source) {
    const value = held.get(source);
    if (!value) return;
    held.delete(source);
    if (![...held.values()].some(v => v.player === value.player && v.button === value.button)) nes.buttonUp(value.player, value.button);
  }
  document.querySelectorAll('[data-key]').forEach(button => {
    button.addEventListener('pointerdown', e => {
      e.preventDefault(); if (!running) return;
      button.setPointerCapture(e.pointerId);
      hold('pointer-' + e.pointerId, 1, button.dataset.key); button.setAttribute('data-held', '');
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, e => {
      release('pointer-' + e.pointerId);
      if (![...held.values()].some(v => v.name === button.dataset.key)) button.removeAttribute('data-held');
    });
    button.addEventListener('contextmenu', e => e.preventDefault());
  });
  const keys = { ArrowUp:[1,'UP'], ArrowDown:[1,'DOWN'], ArrowLeft:[1,'LEFT'], ArrowRight:[1,'RIGHT'],
    KeyZ:[1,'A'], KeyX:[1,'B'], ShiftRight:[1,'SELECT'], Enter:[1,'START'],
    KeyI:[2,'UP'], KeyK:[2,'DOWN'], KeyJ:[2,'LEFT'], KeyL:[2,'RIGHT'], KeyG:[2,'A'], KeyH:[2,'B'], KeyT:[2,'SELECT'], KeyY:[2,'START'] };
  window.addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select') || !running) return;
    if (e.code === 'Enter' && e.target.closest('button,a')) return;
    if (keys[e.code]) { e.preventDefault(); hold('key-' + e.code, ...keys[e.code]); }
  });
  window.addEventListener('keyup', e => release('key-' + e.code));
  window.addEventListener('blur', () => pause(nes ? '已暂停，点击继续。' : ''));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(nes ? '已暂停，点击继续。' : ''); });
  window.addEventListener('pagehide', () => pause());
  $('play').onclick = () => { start(); canvas.focus({ preventScroll: true }); };
  $('pause').onclick = $('console-pause').onclick = () => pause('已暂停。');
  $('mute').onclick = async () => {
    muted = !muted; flushAudio();
    $('mute').textContent = $('menu-mute').textContent = muted ? '开启声音' : '静音'; $('mute').setAttribute('aria-pressed', String(!muted));
    if (!muted) await enableAudio();
  };
  $('reset').onclick = () => {
    if (!nes || !window.confirm('重新开机将丢弃未保存的当前进度，继续吗？')) return;
    pause(); try { nes = makeNES(); nes.loadROM(rom); start(); } catch (e) { status(e.message); }
  };
  function validateROM(bytes) {
    if (bytes.length < 16 || bytes[0] !== 78 || bytes[1] !== 69 || bytes[2] !== 83 || bytes[3] !== 26) throw Error('不是有效的 .nes 文件');
    if (bytes.length > 16 * 1024 * 1024) throw Error('卡带文件超过 16 MB');
    const minimum = 16 + ((bytes[6] & 4) ? 512 : 0) + bytes[4] * 16384 + bytes[5] * 8192;
    if (bytes.length < minimum) throw Error('卡带文件不完整');
  }
  async function load(entry, bytes) {
    const token = ++generation;
    pause(); buttons(false); nes = null; rom = null; current = null;
    $('screen-label').hidden = false; $('screen-label').textContent = '正在读取卡带…';
    $('title').textContent = entry.title; document.title = entry.title + ' · 怀旧 · LiteGame';
    status('正在读取 ' + entry.title + '…');
    try {
      if (entry.status === 'timeout') throw Error('此版本在启动检查中超时，为避免页面卡住，请选择其他版本');
      if (!bytes) {
        const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch(entry.rom, { signal: controller.signal });
          if (!response.ok) throw Error('下载失败 HTTP ' + response.status);
          bytes = new Uint8Array(await response.arrayBuffer());
        } finally { clearTimeout(timeout); }
      }
      if (token !== generation) return;
      validateROM(bytes);
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2,'0')).join('');
      if (token !== generation) return;
      if (entry.sha256 && entry.sha256 !== digest) throw Error('卡带校验失败，请重新下载');
      const candidate = makeNES(); candidate.loadROM(bytes);
      nes = candidate; rom = bytes; current = { ...entry, sha256: digest };
      buttons(true); $('screen-label').textContent = 'READY · 点击开始 / 继续';
      status('卡带已就绪。点击“开始 / 继续”或“读档”。' + (entry.status && entry.status !== 'boot' ? ' 此版本尚未通过启动检查。' : ''));
    } catch (e) {
      if (token !== generation) return;
      $('screen-label').textContent = '卡带加载失败';
      status('无法加载：' + e.message + '。可从下方选择其他版本或重新打开本页重试。');
    }
  }
  $('rom-file').onchange = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    pause(); const token = ++generation;
    try {
      if (file.size > 16 * 1024 * 1024) throw Error('卡带文件超过 16 MB');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (token === generation) await load({ title: file.name }, bytes);
    } catch (err) { status(err.message); }
  };
  // IndexedDB avoids the small localStorage quota of multi-megabyte emulator snapshots.
  function database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('litegame-nes', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('states');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error('存档数据库被其他页面占用'));
    });
  }
  async function storedState(key, value) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('states', value ? 'readwrite' : 'readonly');
      const request = value ? tx.objectStore('states').put(value, key) : tx.objectStore('states').get(key);
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || Error('存档写入失败')); };
    });
  }
  function snapshot() {
    if (!nes || !current) throw Error('请先载入卡带');
    return { format: 1, emulator: 'jsnes-2.1.0', sha256: current.sha256, title: current.title, savedAt: new Date().toISOString(), state: JSON.parse(JSON.stringify(nes.toJSON())) };
  }
  function applySnapshot(data) {
    if (!current || !data || data.format !== 1 || data.emulator !== 'jsnes-2.1.0' || data.sha256 !== current.sha256) throw Error('存档版本或卡带不匹配');
    const state = data.state;
    if (!state || !state.cpu || !state.ppu || !state.mmap || !state.papu) throw Error('存档结构不完整');
    function check(value, model, depth, field) {
      // JSNES rebuilds cached scanline Tile objects on restore; exported arrays omit their helper flags.
      if (field.startsWith('state.ppu.scantile.')) return;
      if (depth > 30) throw Error('存档嵌套过深');
      if (typeof model === 'number') { if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('存档数值损坏'); return; }
      if (model === null || model === undefined) return;
      if (typeof model !== 'object') { if (typeof value !== typeof model) throw Error('存档字段损坏：' + field); return; }
      if (!value || typeof value !== 'object') throw Error('存档字段缺失');
      if (Array.isArray(model) && (!Array.isArray(value) || value.length !== model.length)) throw Error('存档数组损坏');
      for (const key of Object.keys(model)) check(value[key], model[key], depth + 1, field + '.' + key);
    }
    check(state, JSON.parse(JSON.stringify(nes.toJSON())), 0, 'state');
    // Validate in a disposable machine; a broken import must not replace the active game.
    const candidate = makeNES();
    candidate.loadROM(rom); candidate.fromJSON(state);
    if (audio) { candidate.opts.sampleRate = audio.sampleRate; candidate.papu.sampleRate = audio.sampleRate; candidate.papu.setFrameRate(60); }
    nes = candidate; releaseAll(); draw(nes.ppu.buffer);
  }
  $('save').onclick = async () => {
    pause();
    try { const data = snapshot(); await storedState(data.sha256, data); status('已保存当前进度。点击继续。'); }
    catch (e) { status('保存失败：' + e.message); }
  };
  $('restore').onclick = async () => {
    pause(); const token = generation;
    try {
      const data = await storedState(current.sha256);
      if (token !== generation) return;
      if (!data) throw Error('此卡带还没有存档');
      applySnapshot(data); $('screen-label').hidden = true; status('已读档，点击继续。');
    } catch (e) { status('读档失败：' + e.message); }
  };
  $('export').onclick = () => {
    pause();
    try {
      const data = snapshot(), url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'nes-' + data.sha256.slice(0,12) + '.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000); status('已导出当前进度。');
    } catch (e) { status(e.message); }
  };
  $('state-file').onchange = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    pause(); const token = generation;
    try {
      if (!current) throw Error('请先载入对应卡带');
      if (file.size > 12 * 1024 * 1024) throw Error('存档文件过大');
      const data = JSON.parse(await file.text());
      if (token !== generation) return;
      applySnapshot(data); $('screen-label').hidden = true; status('导入成功，点击继续；点击存档可保存到本机。');
    } catch (err) { status('导入失败：' + err.message); }
  };
  function renderLibrary() {
    const query = $('search').value.trim().toLowerCase();
    const list = library.filter(g => g.title.toLowerCase().includes(query) && (!$('compatible').checked || g.status === 'boot'));
    const pages = Math.max(1, Math.ceil(list.length / 36)); page = Math.min(page, pages - 1);
    $('count').textContent = list.length + ' 个卡带版本 · 第 ' + (page + 1) + ' / ' + pages + ' 页';
    $('library').replaceChildren(); $('pages').replaceChildren();
    for (const game of list.slice(page * 36, (page + 1) * 36)) {
      const link = document.createElement('a'); link.href = '?game=' + game.id + '&from=retro'; link.textContent = game.title;
      const small = document.createElement('small'); small.textContent = game.status === 'boot' ? '启动已检查 · Mapper ' + game.mapper : game.detail;
      link.append(small); $('library').append(link);
    }
    for (const [label, step] of [['上一页', -1], ['下一页', 1]]) {
      const button = document.createElement('button'); button.textContent = label;
      button.disabled = page + step < 0 || page + step >= pages;
      button.onclick = () => { page += step; renderLibrary(); }; $('pages').append(button);
    }
  }
  $('search').oninput = $('compatible').onchange = () => { page = 0; renderLibrary(); };
  renderLibrary();
  const requested = new URLSearchParams(location.search).get('game');
  if (requested) {
    const entry = library.find(g => g.id === requested);
    if (entry) load(entry); else status('没有找到这张卡带，请从下方选择。');
  }
})();
