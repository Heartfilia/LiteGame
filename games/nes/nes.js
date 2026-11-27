(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  // 重复条目（与已收录游戏字节相同）在目录里标记为 hidden，不进入游戏机列表
  const library = window.NES_LIBRARY.games.filter(g => !g.hidden);
  const canvas = $('screen'), context = canvas.getContext('2d', { alpha: false });
  const image = context.createImageData(256, 240), pixels = new Uint32Array(image.data.buffer);
  let nes = null, rom = null, current = null, running = false, generation = 0;
  let lastTime = 0, debt = 0, frame = 0, audio = null, muted = true;
  let audioNode = null, read = 0, write = 0, stored = 0;
  const audioLeft = new Float32Array(16384), audioRight = new Float32Array(16384);
  const held = new Map();
  const systemPulses = new Map();
  const netApplied = [0, 0, 0];
  const netPulses = new Uint8Array(10);
  let playedFrames = 0, hasStarted = false, suppressNetNotify = false, netplay = null;
  let page = 0;
  const display = window.NESDisplay({ release: releaseAll, pause, start });
  const directionPad = window.NESDirectionPad($('direction-disc'), {
    enabled: () => running && !display.menuOpen() && !netplay?.isOpen(),
    down: (source, name) => hold(source, 1, name), up: release
  });
  function status(text) { $('status').textContent = $('menu-status').textContent = text; }
  function syncNetplayButtons(ready = !!nes) {
    const inRoom = !!netplay?.inRoom();
    const guest = inRoom && netplay.role() === 2;
    const label = inRoom ? ('联机房间 ' + netplay.roomCode()) : '双人联机';
    $('netplay').disabled = !ready && !inRoom;
    $('menu-netplay').disabled = !ready && !inRoom;
    $('netplay').textContent = $('menu-netplay').textContent = label;
    $('reset').disabled = !ready || guest;
    $('restore').disabled = !ready || guest;
    $('menu-restore').disabled = !ready || guest;
  }
  function buttons(ready) {
    document.body.classList.toggle('nes-has-game', ready);
    for (const id of ['play', 'pause', 'reset', 'save', 'restore', 'export', 'console-pause']) $(id).disabled = !ready;
    for (const id of ['menu-resume', 'menu-save', 'menu-restore']) $(id).disabled = !ready;
    document.querySelectorAll('[data-key]').forEach(button => { button.disabled = !ready; });
    $('direction-disc').setAttribute('aria-disabled', String(!ready));
    $('console-pause').textContent = hasStarted ? '继续' : '开始';
    syncNetplayButtons(ready);
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
  function applyPlayerMask(player, nextMask) {
    const diff = netApplied[player] ^ nextMask;
    if (!diff) return;
    for (let b = 0; b < 10; b++) {
      if (diff & (1 << b)) {
        if (nextMask & (1 << b)) nes.buttonDown(player, b);
        else nes.buttonUp(player, b);
      }
    }
    netApplied[player] = nextMask;
  }
  function sampleLocalNetMask() {
    let mask = 0;
    for (const v of held.values()) if (v.button >= 0 && v.button < 10) mask |= (1 << v.button);
    for (let b = 0; b < 10; b++) {
      if (netPulses[b] > 0) { mask |= (1 << b); netPulses[b]--; }
    }
    return mask;
  }
  function releaseAll() {
    directionPad.reset();
    if (nes && !netplay?.active()) for (let p = 1; p <= 2; p++) for (let b = 0; b < 10; b++) nes.buttonUp(p, b);
    held.clear(); systemPulses.clear();
    document.querySelectorAll('[data-held]').forEach(b => b.removeAttribute('data-held'));
  }
  function pause(message, fromRemote = false) {
    const wasRunning = running;
    running = false; cancelAnimationFrame(frame); frame = 0; releaseAll(); flushAudio();
    $('play').textContent = '开始 / 继续';
    $('play').hidden = false; $('pause').hidden = true;
    $('console-pause').textContent = hasStarted ? '继续' : '开始';
    if (message) status(message);
    if (wasRunning && !fromRemote && !suppressNetNotify) netplay?.notifyLocalPause(message || '对方已暂停游戏');
  }
  function tick(time) {
    if (!running) return;
    debt += Math.min(time - lastTime, 100); lastTime = time;
    try {
      let count = 0;
      if (!netplay?.active()) {
        while (debt >= 1000 / 60 && count < 4) {
          nes.frame(); debt -= 1000 / 60; count++; playedFrames++;
          for (const [source, until] of systemPulses) if (playedFrames >= until) { systemPulses.delete(source); release(source); }
        }
        if (count === 4) debt = 0;
      } else {
        while (debt >= 1000 / 60 && count < 4) {
          const step = netplay.stepFrame(sampleLocalNetMask);
          if (!step.ready) {
            debt = Math.min(debt, 1000 / 60);
            if (step.stalledMs > 450) status('等待对方网络同步…');
            break;
          }
          applyPlayerMask(1, step.p1);
          applyPlayerMask(2, step.p2);
          nes.frame();
          debt -= 1000 / 60; count++; playedFrames++;
          if (step.catchUp && count < 4) {
            const extra = netplay.stepFrame(sampleLocalNetMask);
            if (extra.ready) {
              applyPlayerMask(1, extra.p1);
              applyPlayerMask(2, extra.p2);
              nes.frame();
              count++; playedFrames++;
            }
          }
        }
        if (count === 4) debt = 0;
      }
    } catch (e) {
      pause('此版本运行异常：' + e.message + '。可以重新开机或选择其他版本。');
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  function start(fromRemote = false) {
    if (!nes || running || display.menuOpen() || netplay?.isOpen()) return;
    if (!muted) enableAudio();
    running = true; lastTime = performance.now(); debt = 0;
    hasStarted = true; $('console-pause').textContent = '暂停';
    $('screen-label').hidden = true; $('play').textContent = '运行中';
    $('play').hidden = true; $('pause').hidden = false;
    status(netplay?.active()
      ? ('双人联机运行中（你是 ' + netplay.role() + 'P）· 1P 按 SELECT 选双人，START 开始。')
      : '运行中 · 按 START 开始游戏，SELECT 选择模式。');
    if (!fromRemote && !suppressNetNotify) netplay?.notifyLocalResume();
    frame = requestAnimationFrame(tick);
  }
  function hold(source, player, name) {
    if (!nes || !running || held.has(source)) return;
    const button = jsnes.Controller['BUTTON_' + name];
    if (netplay?.active()) {
      held.set(source, { player: netplay.role(), button, name, net: true });
      return;
    }
    held.set(source, { player, button, name }); nes.buttonDown(player, button);
  }
  function release(source) {
    const value = held.get(source);
    if (!value) return;
    held.delete(source);
    if (value.net) return;
    if (![...held.values()].some(v => !v.net && v.player === value.player && v.button === value.button)) nes.buttonUp(value.player, value.button);
  }
  function systemButton(name) {
    if (!nes || display.menuOpen() || netplay?.isOpen()) return;
    // Wake the emulator without accidentally toggling the cartridge's own pause.
    // Boot screens may ignore START: the next press after boot is the game input.
    if (!running) { start(); return; }
    if (netplay?.active()) {
      const btn = jsnes.Controller['BUTTON_' + name];
      netPulses[btn] = Math.max(netPulses[btn], 2);
      return;
    }
    const source = 'system-' + name;
    hold(source, 1, name);
    systemPulses.set(source, playedFrames + 2);
  }
  document.querySelectorAll('[data-key]').forEach(button => {
    if (['START', 'SELECT'].includes(button.dataset.key)) {
      button.addEventListener('click', () => systemButton(button.dataset.key));
      button.addEventListener('contextmenu', e => e.preventDefault());
      return;
    }
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
    if (e.target.closest('input,textarea,select') || display.menuOpen() || netplay?.isOpen()) return;
    if (e.code === 'Enter' && e.target.closest('button,a')) return;
    if (!running) {
      if (keys[e.code] && ['START', 'SELECT'].includes(keys[e.code][1]) && !e.repeat) { e.preventDefault(); start(); }
      return;
    }
    if (keys[e.code]) { e.preventDefault(); hold('key-' + e.code, ...keys[e.code]); }
  });
  window.addEventListener('keyup', e => release('key-' + e.code));
  window.addEventListener('blur', () => {
    if (netplay?.active()) { releaseAll(); return; }
    pause(nes ? '已暂停，点击继续。' : '');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(nes ? '已暂停，点击继续。' : ''); });
  window.addEventListener('pagehide', () => pause());
  $('play').onclick = () => { start(); canvas.focus({ preventScroll: true }); };
  $('pause').onclick = () => pause('已暂停。');
  $('console-pause').onclick = () => { if (running) pause('已暂停，点击底部“继续”恢复。'); else start(); };
  $('mute').onclick = async () => {
    muted = !muted; flushAudio();
    $('mute').textContent = $('menu-mute').textContent = muted ? '开启声音' : '静音'; $('mute').setAttribute('aria-pressed', String(!muted));
    if (!muted) await enableAudio();
  };
  $('reset').onclick = async () => {
    if (!nes || !window.confirm(netplay?.inRoom() ? '重新开机将同步重置双人进度，继续吗？' : '重新开机将丢弃未保存的当前进度，继续吗？')) return;
    if (netplay?.inRoom() && netplay.role() === 1 && netplay.active()) { await netplay.syncFromHost('reset'); return; }
    pause(); try { nes = makeNES(); nes.loadROM(rom); start(); } catch (e) { status(e.message); }
  };
  function validateROM(bytes) {
    if (bytes.length < 16 || bytes[0] !== 78 || bytes[1] !== 69 || bytes[2] !== 83 || bytes[3] !== 26) throw Error('不是有效的 .nes 文件');
    if (bytes.length > 16 * 1024 * 1024) throw Error('卡带文件超过 16 MB');
    const minimum = 16 + ((bytes[6] & 4) ? 512 : 0) + bytes[4] * 16384 + bytes[5] * 8192;
    if (bytes.length < minimum) throw Error('卡带文件不完整');
  }
  let loadingForNetplay = false;
  async function load(entry, bytes) {
    const token = ++generation;
    if (!loadingForNetplay && netplay?.inRoom() && current?.id !== entry.id) netplay.disconnect({ notice: '' });
    pause(); hasStarted = false; buttons(false); nes = null; rom = null; current = null;
    $('screen-label').hidden = false; $('screen-label').textContent = '正在读取卡带…';
    $('title').textContent = entry.title; document.title = entry.title + ' · 怀旧 · LiteGame';
    status('正在读取 ' + entry.title + '…');
    try {
      if (entry.status === 'timeout') throw Error('此版本在启动检查中超时，为避免页面卡住，请选择其他版本');
      if (entry.status === 'unsupported') throw Error('此卡带版本暂不兼容，请从下方选择通过启动检查的版本');
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
      status('卡带已就绪。可点击底部“开始”、START / SELECT 启动，点击“读档”或开启“双人联机”。' + (entry.status && entry.status !== 'boot' ? ' 此版本尚未通过启动检查。' : ''));
      if (!loadingForNetplay) await netplay?.onGameLoaded();
    } catch (e) {
      if (token !== generation) return;
      $('screen-label').textContent = '卡带加载失败';
      status('无法加载：' + e.message + '。可从下方选择其他版本或重新打开本页重试。');
    }
  }
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
    if (value) window.LiteSync?.guard();
    const db = await database();
    if (value) { try { window.LiteSync?.guard(); } catch (e) { db.close(); throw e; } }
    return new Promise((resolve, reject) => {
      const tx = db.transaction('states', value ? 'readwrite' : 'readonly');
      const request = value ? tx.objectStore('states').put(value, key) : tx.objectStore('states').get(key);
      tx.oncomplete = () => { db.close(); if (value) window.LiteSync?.nesSaved(key); resolve(request.result); };
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
      await window.LiteSync?.sync();
      const data = await storedState(current.sha256);
      if (token !== generation) return;
      if (!data) throw Error('此卡带还没有存档');
      applySnapshot(data); hasStarted = true; $('screen-label').hidden = true;
      if (netplay?.inRoom() && netplay.role() === 1) {
        await netplay.syncFromHost('snapshot');
        status('已读档并同步给 2P，正在继续双人游戏。');
      } else {
        status('已读档，点击继续。');
      }
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
    const list = library.filter(g => g.title.toLowerCase().includes(query) && ($('show-other').checked || g.status === 'boot'));
    const pages = Math.max(1, Math.ceil(list.length / 36)); page = Math.min(page, pages - 1);
    $('count').textContent = list.length + ' 个卡带版本 · 第 ' + (page + 1) + ' / ' + pages + ' 页';
    $('library').replaceChildren();
    for (const game of list.slice(page * 36, (page + 1) * 36)) {
      const link = document.createElement('a');
      const returnTo = new URLSearchParams(location.search).get('returnTo');
      link.href = '?game=' + game.id + '&from=retro' + (returnTo ? '&returnTo=' + encodeURIComponent(returnTo) : ''); link.textContent = game.title;
      const small = document.createElement('small'); small.textContent = game.status === 'boot' ? '已通过启动检查' : '此版本暂不兼容，请选择其他版本';
      if (game.status !== 'boot') { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
      const card = document.createElement('div'); card.className = 'cartridge-card';
      const favorite = document.createElement('button'); favorite.type = 'button'; favorite.dataset.favorite = game.id;
      const update = () => {
        const active = window.GameFavorites.read().includes(game.id);
        favorite.textContent = active ? '♥ 已收藏' : '♡ 收藏'; favorite.setAttribute('aria-pressed', String(active));
        favorite.setAttribute('aria-label', (active ? '取消收藏：' : '收藏：') + game.title);
      };
      update();
      favorite.onclick = () => {
        try { window.GameFavorites.toggle(game.id); }
        catch (e) { status('收藏未保存：浏览器存储不可用，请重试。'); }
      };
      link.append(small); card.append(link, favorite); $('library').append(card);
    }
    for (const id of ['pages-top', 'pages']) {
      const nav = $(id); nav.replaceChildren(); nav.hidden = pages <= 1;
      for (const [label, step] of [['上一页', -1], ['下一页', 1]]) {
        const button = document.createElement('button'); button.textContent = label;
        button.disabled = page + step < 0 || page + step >= pages;
        button.onclick = () => {
          page += step; renderLibrary(); $('pages-top').scrollIntoView({ block: 'start', behavior: 'instant' });
          $('pages-top').querySelector('button:not(:disabled)').focus({ preventScroll: true });
        };
        nav.append(button);
        if (step === -1) { const label = document.createElement('span'); label.textContent = (page + 1) + ' / ' + pages; nav.append(label); }
      }
    }
  }
  $('search').oninput = $('show-other').onchange = () => { page = 0; renderLibrary(); };
  $('change-game').onclick = () => { pause(); document.querySelector('.library').scrollIntoView({ behavior: 'smooth' }); $('search').focus({ preventScroll: true }); };
  $('menu-back').onclick = async () => { pause(); await display.exit(); if (window.LiteNavigation) window.LiteNavigation.back(); else location.href = '../../index.html#/category/retro'; };
  const destination = window.LiteNavigation?.destination();
  if (destination) $('menu-back').textContent = '返回' + destination.label;
  window.addEventListener('favoriteschange', () => {
    const ids = new Set(window.GameFavorites.read());
    $('library').querySelectorAll('[data-favorite]').forEach(button => {
      const active = ids.has(button.dataset.favorite), game = library.find(game => game.id === button.dataset.favorite);
      button.textContent = active ? '♥ 已收藏' : '♡ 收藏'; button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', (active ? '取消收藏：' : '收藏：') + game.title);
    });
  });
  if (window.LiteNetplay) {
    netplay = window.LiteNetplay.createController({
      getGame: () => current ? {
        id: current.id,
        title: current.title,
        kind: 'nes',
        romSha256: current.sha256,
        url: 'games/nes/index.html?game=' + encodeURIComponent(current.id) + '&from=retro'
      } : null,
      canSyncCurrent: () => !!(nes && current && hasStarted),
      exportSnapshot: () => snapshot(),
      async loadGameById(gameId) {
        const entry = library.find(g => g.id === gameId);
        if (!entry) throw new Error('本地卡带目录中没有找到房间指定的游戏');
        loadingForNetplay = true;
        try { await load(entry); } finally { loadingForNetplay = false; }
      },
      async onSessionStart({ mode, snapshot: snap }) {
        suppressNetNotify = true;
        try {
          pause('', true);
          netApplied[1] = netApplied[2] = 0;
          netPulses.fill(0);
          if (mode === 'snapshot' && snap) {
            applySnapshot(snap);
          } else {
            const fresh = makeNES();
            fresh.loadROM(rom);
            nes = fresh;
            draw(nes.ppu.buffer);
          }
          if (window.nesTest) window.nesTest = nes;
          syncNetplayButtons(true);
        } finally {
          suppressNetNotify = false;
        }
        start(true);
      },
      onRemotePause(reason) { pause(reason, true); },
      onRemoteResume() { start(true); },
      onPeerLeft(reason) { pause(reason, true); syncNetplayButtons(!!nes); },
      onExitNetplay(notice) {
        suppressNetNotify = true;
        try { pause('', true); } finally { suppressNetNotify = false; }
        netApplied[1] = netApplied[2] = 0;
        netPulses.fill(0);
        if (nes) for (let p = 1; p <= 2; p++) for (let b = 0; b < 10; b++) nes.buttonUp(p, b);
        syncNetplayButtons(!!nes);
        if (notice) status(notice);
      },
      async onUnlockAudio() {
        if (muted) {
          muted = false;
          flushAudio();
          $('mute').textContent = $('menu-mute').textContent = '静音';
          $('mute').setAttribute('aria-pressed', 'true');
        }
        await enableAudio();
      },
      onOpenModal() {
        if (running) pause('已打开联机面板，游戏已暂停。');
        syncNetplayButtons(!!nes);
      },
      mountModalTarget: () => $('console').classList.contains('immersive') ? $('console').querySelector('.console-layout') : document.body,
      mountPillTarget: () => $('console').querySelector('.screen-glass')
    });
    new MutationObserver(() => { netplay.refreshMount(); syncNetplayButtons(!!nes); })
      .observe($('console'), { attributes: true, attributeFilter: ['class'] });
    $('netplay').onclick = () => netplay.open();
    $('menu-netplay').onclick = () => {
      if (display.menuOpen()) $('console-menu').click();
      netplay.open();
    };
    $('library-join-room').onclick = () => netplay.open('join');
    window.nesNetplay = netplay;
  }
  renderLibrary();
  buttons(false);
  const searchParams = new URLSearchParams(location.search);
  const requested = searchParams.get('game');
  if (requested) {
    const entry = library.find(g => g.id === requested);
    if (entry) load(entry); else status('没有找到这张卡带，请从下方选择。');
  } else if (searchParams.get('room')) {
    netplay?.onGameLoaded();
  }
})();
