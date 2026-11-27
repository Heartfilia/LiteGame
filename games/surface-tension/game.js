/* 表面张力 · 倒酒手感 */
(function () {
  'use strict';

  const P = window.Premium;
  const SAVE = P.save('surface-tension.v1');
  const $ = (sel) => document.querySelector(sel);

  const canvas = $('#cv');
  const ctx = canvas.getContext('2d');
  const stage = $('#stage');
  const tip = $('#tip');
  const fillBar = $('#fillBar');
  const bestEl = $('#bestScore');

  const RATE = 0.17;          // 每秒倒进杯中的比例
  const PERFECT_FROM = 0.965; // 超过这里才算「满而不溢」
  const SPILL_AT = 1.0;

  let level = 0.28;
  let pouring = false;
  let running = false;
  let spilled = false;
  let wobble = 0;
  let last = 0;
  let dpr = 1;
  let w = 0;
  let h = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    w = Math.max(240, rect.width);
    h = Math.max(240, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function glassGeometry() {
    const gh = Math.min(h * 0.62, 300);
    const gw = gh * 0.46;
    return {
      x: w / 2 - gw / 2,
      y: h / 2 - gh / 2 + 10,
      w: gw,
      h: gh,
      rim: h / 2 - gh / 2 + 10
    };
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const g = glassGeometry();
    const bottom = g.y + g.h;
    const inner = 7;

    // 杯身
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x, bottom - 10);
    ctx.quadraticCurveTo(g.x, bottom, g.x + 12, bottom);
    ctx.lineTo(g.x + g.w - 12, bottom);
    ctx.quadraticCurveTo(g.x + g.w, bottom, g.x + g.w, bottom - 10);
    ctx.lineTo(g.x + g.w, g.y);
    ctx.strokeStyle = 'rgba(239, 230, 212, 0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 玻璃反光
    ctx.beginPath();
    ctx.moveTo(g.x + 8, g.y + 18);
    ctx.lineTo(g.x + 8, bottom - 26);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 液体
    const fillH = Math.min(1, level) * (g.h - inner * 2);
    const topY = bottom - inner - fillH;
    const liquidW = g.w - inner * 2;
    const dome = level > 0.9 ? (level - 0.9) * 10 : 0;

    ctx.beginPath();
    ctx.moveTo(g.x + inner, topY);
    ctx.quadraticCurveTo(
      g.x + inner + liquidW / 2, topY - dome,
      g.x + inner + liquidW, topY
    );
    ctx.lineTo(g.x + inner + liquidW, bottom - inner - 8);
    ctx.quadraticCurveTo(g.x + inner + liquidW, bottom - inner, g.x + inner + liquidW - 10, bottom - inner);
    ctx.lineTo(g.x + inner + 10, bottom - inner);
    ctx.quadraticCurveTo(g.x + inner, bottom - inner, g.x + inner, bottom - inner - 8);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, topY, 0, bottom);
    grad.addColorStop(0, 'rgba(232, 200, 133, 0.92)');
    grad.addColorStop(1, 'rgba(176, 96, 47, 0.86)');
    ctx.fillStyle = grad;
    ctx.fill();

    // 液面高光（表面张力的那道亮边）
    ctx.beginPath();
    ctx.moveTo(g.x + inner, topY);
    ctx.quadraticCurveTo(g.x + inner + liquidW / 2, topY - dome, g.x + inner + liquidW, topY);
    ctx.strokeStyle = 'rgba(255, 244, 214, ' + (0.35 + dome / 12) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 溢出
    if (spilled) {
      ctx.beginPath();
      ctx.moveTo(g.x + 4, g.y + 2);
      ctx.quadraticCurveTo(g.x + g.w / 2, bottom - 6, g.x + g.w - 4, g.y + 2);
      ctx.fillStyle = 'rgba(176, 96, 47, 0.35)';
      ctx.fill();
    }

    // 杯口刻度提示
    ctx.fillStyle = 'rgba(239, 230, 212, 0.35)';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('杯口', w / 2, g.y - 10);
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (pouring && !spilled) {
      level += RATE * dt;
      if (level >= SPILL_AT) {
        level = SPILL_AT;
        spilled = true;
        pouring = false;
        P.sfx.bad();
        endRound(true);
      }
    }
    fillBar.style.width = Math.min(100, level * 100) + '%';
    draw();
    if (running) requestAnimationFrame(tick);
  }

  function endRound(spill) {
    running = false;
    const percent = Math.round(Math.min(level, 1) * 1000) / 10;
    const save = SAVE.read();
    const best = Math.max(save.best || 0, spill ? 0 : percent);
    const rounds = (save.rounds || 0) + 1;
    SAVE.write({ best, rounds });
    bestEl.textContent = best.toFixed(1) + '%';

    let title;
    let why;
    if (spill) {
      title = '溢出来了';
      why = '贪了一点，酒顺着杯壁流下去了。';
    } else if (level >= PERFECT_FROM) {
      title = '满而不溢';
      why = '就差一线，表面张力替你兜住了。';
    } else if (level >= 0.85) {
      title = '很接近';
      why = '再补一点就漂亮了。';
    } else if (level >= 0.6) {
      title = '还差几口';
      why = '停得太早，杯子还空着一截。';
    } else {
      title = '太保守';
      why = '这杯连半满都没到。';
    }

    P.showResult({
      title,
      why,
      showFinal: false,
      best: '这杯 ' + percent.toFixed(1) + '% · 最佳 ' + best.toFixed(1) + '% · 第 ' + rounds + ' 杯',
      againLabel: '再倒一杯',
      onAgain: start,
      onExit: () => { location.href = '../../index.html#/category/premium'; }
    });
  }

  function start() {
    P.hideResult();
    $('#screen-start').hidden = true;
    $('#screen-game').hidden = false;
    resize();
    level = 0.28;
    spilled = false;
    pouring = false;
    running = true;
    last = performance.now();
    tip.innerHTML = '按住倒酒，<b>松手就停</b>';
    requestAnimationFrame(tick);
  }

  function setPouring(on) {
    if (!running) return;
    pouring = on;
    if (on) P.sfx.tap();
    tip.innerHTML = on ? '<b>倒…</b> 松手停' : '按住倒酒，<b>松手就停</b>';
  }

  /** 松手即结算：液面会再晃一下，给一点停顿感。 */
  function release() {
    if (!running || !pouring) return;
    setPouring(false);
    setTimeout(() => {
      if (running && !spilled) endRound(false);
    }, 320);
  }

  stage.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setPouring(true);
  });
  window.addEventListener('pointerup', () => {
    if (pouring) release();
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') { event.preventDefault(); setPouring(true); }
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') release();
  });

  window.addEventListener('resize', () => { if (running) { resize(); draw(); } });

  $('#startSingle').addEventListener('click', start);
  P.mountChrome({});

  const save = SAVE.read();
  bestEl.textContent = (save.best || 0).toFixed(1) + '%';
  resize();
  draw();
})();