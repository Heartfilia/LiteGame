// Shared lifecycle for the small canvas games: each page owns its rules and art.
(function () {
  'use strict';
  window.LiteArcade = function (cfg) {
    var C = window.Chogan, el = C.el, E = cfg.engine;
    C.boot({});
    var ctx = C.game({ id: cfg.id, name: { zh: cfg.title, en: cfg.title }, accent: cfg.accent, scroll: true });
    var S, running = false, ended = false, last = 0, held = {}, keyDown = {}, pointers = {}, buttons = {}, audio = null, voices = [], soundUntil = 0;
    var cv = el('canvas', { class: 'arc-canvas', width: '600', height: '480', role: 'img', 'aria-label': cfg.title + '游戏画面' }), g = cv.getContext('2d');
    var overlay = el('div', { class: 'arc-overlay' }, [el('strong', { text: cfg.title }), el('span', { text: '点击开始，或按 Enter' })]);
    var status = el('div', { class: 'arc-status', role: 'status', 'aria-live': 'polite' });
    var controls = el('div', { class: 'arc-controls', role: 'group', 'aria-label': '游戏操作' });
    var play = el('button', { class: 'ch-btn ch-btn--primary', type: 'button', text: '开始', onclick: toggle });
    var sound = el('button', { class: 'ch-btn ch-btn--soft', type: 'button', onclick: function () { C.audio.setSfx(!C.state.settings.sfx); stopAudio(); update(); } });
    var best = el('span', { class: 'ch-badge' });
    ctx.stat('score', '得分');
    function blocked() { return document.hidden || !!document.querySelector('.ch-scrim'); }
    function clearHeld() { held = {}; keyDown = {}; pointers = {}; Object.keys(buttons).forEach(function (k) { buttons[k].removeAttribute('data-held'); }); }
    function stopAudio() { voices.forEach(function (o) { try { o.stop(); } catch (e) { /* already stopped */ } }); voices = []; soundUntil = 0; }
    function unlockAudio() {
      try { var AC = window.AudioContext || window.webkitAudioContext; if (!audio && AC) audio = new AC(); if (audio && audio.state === 'suspended') audio.resume().catch(function () {}); } catch (e) { /* Visual notation remains available. */ }
    }
    var api = {
      get state() { return S; }, get running() { return running; },
      get speaking() { return performance.now() < soundUntil; },
      tone: function (notes, beat) {
        stopAudio(); unlockAudio(); C.audio.stopMusic(0);
        if (!C.state.settings.sfx || !audio) return;
        var start = audio.currentTime + 0.06; beat = beat || 0.42;
        notes.forEach(function (n, i) {
          (Array.isArray(n) ? n : [n]).forEach(function (n, voice, chord) {
          if (n < 0) return;
          var o = audio.createOscillator(), gain = audio.createGain(), at = start + i * beat;
          o.type = 'triangle'; o.frequency.value = 261.6256 * Math.pow(2, n / 12);
          gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.15 / chord.length, at + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, at + beat * 0.85);
          o.connect(gain); gain.connect(audio.destination); voices.push(o);
          o.onended = function () { o.disconnect(); gain.disconnect(); var j = voices.indexOf(o); if (j >= 0) voices.splice(j, 1); };
          o.start(at); o.stop(at + beat);
          });
        });
        soundUntil = performance.now() + (notes.length * beat + 0.06) * 1000;
      },
      stopAudio: stopAudio,
      text: function (text, x, y, size, color, align) { g.fillStyle = color || '#edf2ff'; g.font = '600 ' + (size || 20) + 'px sans-serif'; g.textAlign = align || 'center'; g.fillText(text, x, y); },
      button: function (id) { return buttons[id]; }
    };
    function action(id) {
      if (!running || ended || blocked()) return;
      unlockAudio(); cfg.action(S, id, api); if (S.over) finish(); else { ctx.save(); update(); }
    }
    (cfg.controls || []).forEach(function (c) {
      var b = el('button', { class: 'ch-btn ch-btn--soft', type: 'button', text: c.label, 'aria-label': c.label, 'data-action': c.id }); buttons[c.id] = b;
      if (c.hold) {
        b.addEventListener('pointerdown', function (e) { if (e.button !== 0 || !running || blocked()) return; e.preventDefault(); pointers[e.pointerId] = c.id; held[c.id] = true; b.setPointerCapture(e.pointerId); b.setAttribute('data-held', ''); });
        function release(e) { delete pointers[e.pointerId]; held[c.id] = Object.keys(pointers).some(function (p) { return pointers[p] === c.id; }) || Object.keys(keyDown).some(function (k) { return keyDown[k] === c.id; }); if (!held[c.id]) b.removeAttribute('data-held'); }
        b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
      } else b.addEventListener('click', function () { action(c.id); });
      controls.appendChild(b);
    });
    ctx.button({ icon: 'help', label: '玩法说明', onClick: function () { pause(); C.ui.modal({ title: cfg.title + ' · 玩法', body: [el('p', { text: cfg.help })], actions: [{ label: '知道了', kind: 'primary' }] }); } });
    ctx.button({ icon: 'refresh', label: '重新开始', onClick: function () { pause(); C.ui.confirm({ title: '重新开始？', body: [el('p', { text: '当前进度将替换为新一局。' })], onOk: fresh }); } });
    ctx.main.appendChild(el('div', { class: 'arc-wrap arc-' + cfg.id }, [el('div', { class: 'arc-tools' }, [best]), el('div', { class: 'arc-stage' }, [cv, overlay]), controls, el('div', { class: 'arc-tools' }, cfg.music ? [play, sound] : [play]), el('p', { class: 'arc-help', text: cfg.hint }), status]));
    ctx.mount();
    function update() {
      ctx.setStat('score', Math.round(S.score)); best.textContent = '最佳 ' + (C.stats.getBest(cfg.id, 'score') || 0);
      play.textContent = ended ? '再来一局' : running ? '暂停' : '开始 / 继续';
      sound.textContent = C.state.settings.sfx ? '声音：开' : '声音：关'; sound.setAttribute('aria-pressed', String(C.state.settings.sfx));
      overlay.hidden = running || ended;
      status.textContent = cfg.status(S) + (!running && !ended ? ' · 已暂停' : '');
      if (cfg.update) cfg.update(S, api);
      Object.keys(buttons).forEach(function (id) { buttons[id].setAttribute('aria-label', buttons[id].textContent); });
    }
    function fresh() { running = false; ended = false; stopAudio(); clearHeld(); S = E.newGame(Math.random); ctx.save(); update(); }
    function pause() { running = false; clearHeld(); stopAudio(); if (S) { ctx.save(); update(); } }
    function toggle() { if (blocked()) return; if (running) { pause(); return; } if (ended) fresh(); unlockAudio(); if (cfg.music) C.audio.stopMusic(0); running = true; last = performance.now(); update(); }
    function finish() {
      if (ended) return; ended = true; running = false; clearHeld(); stopAudio(); C.stats.best(cfg.id, 'score', S.score); update();
      var result = cfg.result(S);
      ctx.finish({ won: S.won, title: result.title, timeMs: S.elapsed * 1000, coins: Math.min(25, Math.floor(S.score / 100)), points: Math.min(120, Math.floor(S.score / 10)), lines: result.lines, onAgain: fresh });
    }
    var displayAt = 0;
    function frame(t) {
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0; last = t;
      if (running) { if (blocked()) pause(); else { E.step(S, dt, held); if (S.over) finish(); } }
      g.clearRect(0, 0, 600, 480); cfg.draw(g, S, api);
      if (t - displayAt > 120) { update(); displayAt = t; }
      requestAnimationFrame(frame);
    }
    window.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || blocked()) return;
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); if (!e.repeat) toggle(); return; }
      var c = cfg.controls.find(function (c) { return (c.keys || []).includes(e.key.toLowerCase()); });
      if (!c || !running || (e.key === ' ' && e.target.tagName === 'BUTTON')) return;
      e.preventDefault(); if (c.hold) { keyDown[e.code || e.key] = c.id; held[c.id] = true; } else if (!e.repeat) action(c.id);
    });
    window.addEventListener('keyup', function (e) {
      var code = e.code || e.key, id = keyDown[code]; delete keyDown[code];
      if (id) held[id] = Object.keys(keyDown).some(function (k) { return keyDown[k] === id; }) || Object.keys(pointers).some(function (p) { return pointers[p] === id; });
    });
    cv.addEventListener('click', function (e) { if (blocked()) return; if (!running && !ended) { toggle(); return; } if (cfg.tap && running) { var r = cv.getBoundingClientRect(); cfg.tap(S, (e.clientX - r.left) * 600 / r.width, (e.clientY - r.top) * 480 / r.height, api); if (S.over) finish(); else { ctx.save(); update(); } } });
    C.onPause(pause); window.addEventListener('blur', pause);
    if (cfg.music) C.onResume(function () { C.audio.stopMusic(0); });
    ctx.autosave(function () { return ended || !S ? { inProgress: false } : S; });
    S = E.restore(ctx.loadSave()); if (!S) fresh(); else update();
    requestAnimationFrame(frame); return api;
  };
})();
