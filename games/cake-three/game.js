/* 蛋糕三等分 · 转盘落刀 */
(function () {
  'use strict';

  const P = window.Premium;
  const SAVE = P.save('cake-three.v1');
  const $ = (sel) => document.querySelector(sel);

  const canvas = $('#cv');
  const ctx = canvas.getContext('2d');
  const stage = $('#stage');
  const tip = $('#tip');
  const bestEl = $('#bestScore');
  const roundLabel = $('#roundLabel');
  const dots = [$('#d1'), $('#d2'), $('#d3')];

  const SPEED = 72; // 度/秒
  const TARGET = 120;

  let angle = 0;
  let cuts = [];
  let running = false;
  let armed = false;
  let slicing = 0;   // 落刀后的短暂停顿
  let finished = false;
  let last = 0;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let errors = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    w = Math.max(240, rect.width);
    h = Math.max(240, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function radius() {
    return Math.min(w, h) * 0.34;
  }

  function sectorDiff(a, b) {
    return ((b - a) % 360 + 360) % 360;
  }

  function drawWedge(start, end, R, color, offsetDeg) {
    const a0 = (start + offsetDeg) * Math.PI / 180;
    const a1 = (end + offsetDeg) * Math.PI / 180;
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const R = radius();
    const cx = w / 2;
    const cy = h / 2;

    // 盘子
    ctx.beginPath();
    ctx.arc(cx, cy, R + 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 236, 216, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 176, 106, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (cuts.length < 3) {
      // 尚未切开：整块蛋糕 + 刀
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(cx, cy - R * 0.3, R * 0.2, cx, cy, R);
      grad.addColorStop(0, '#f6e4c2');
      grad.addColorStop(0.72, '#e6c795');
      grad.addColorStop(1, '#cf9d63');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 105, 55, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 奶油裱花
      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68, R * 0.07, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 250, 236, 0.85)';
        ctx.fill();
      }
      ctx.restore();

      // 已落的刀口
      for (const c of cuts) {
        const a = c * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.strokeStyle = 'rgba(120, 74, 34, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // 旋转的刀
      const ka = angle * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ka) * (R + 10), cy + Math.sin(ka) * (R + 10));
      ctx.strokeStyle = 'rgba(239, 230, 212, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ka) * (R + 10), cy + Math.sin(ka) * (R + 10), 3.4, 0, Math.PI * 2);
      ctx.fillStyle = '#d9b06a';
      ctx.fill();
    } else {
      // 切完：三份带一点分离感
      const bounds = cuts.concat([cuts[0] + 360]);
      const colors = ['#f6e4c2', '#e9cd9f', '#dcb680'];
      for (let i = 0; i < 3; i += 1) {
        drawWedge(bounds[i], bounds[i + 1], R, colors[i], finished ? (i - 1) * 4 : 0);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150, 105, 55, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 角度标注
    if (cuts.length >= 3) {
      ctx.fillStyle = 'rgba(239, 230, 212, 0.6)';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      errors.forEach((e, i) => {
        ctx.fillText((i + 1) + ' 份 ' + e.size.toFixed(0) + '°', w / 2, 18 + i * 15);
      });
    }
  }

  function tick(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (armed && !finished) angle = (angle + SPEED * dt) % 360;
    if (slicing > 0) {
      slicing -= dt;
      if (slicing <= 0 && cuts.length >= 3) settle();
    }
    draw();
    requestAnimationFrame(tick);
  }

  function cut() {
    if (!running || !armed || finished) return;
    if (cuts.length >= 3) return;
    cuts.push(angle);
    P.sfx.tap();
    dots[cuts.length - 1].classList.add('is-done');
    if (cuts.length === 1) {
      tip.innerHTML = '第 2 刀：<b>再隔 120°</b>';
      roundLabel.textContent = '第 2 刀';
    } else if (cuts.length === 2) {
      tip.innerHTML = '第 3 刀：<b>收口也要准</b>';
      roundLabel.textContent = '第 3 刀';
    } else {
      armed = false;
      slicing = 0.35;
      tip.innerHTML = '落刀…';
    }
  }

  function settle() {
    finished = true;
    const a = cuts[0];
    const b = cuts[1];
    const c = cuts[2];
    const s1 = sectorDiff(a, b);
    const s2 = sectorDiff(b, c);
    const s3 = 360 - s1 - s2;
    errors = [
      { size: s1, dev: Math.abs(s1 - TARGET) },
      { size: s2, dev: Math.abs(s2 - TARGET) },
      { size: s3, dev: Math.abs(s3 - TARGET) }
    ];
    const total = errors.reduce((acc, e) => acc + e.dev, 0) / 2; // 三等份平均偏差
    dots[2].classList.add('is-done');

    const save = SAVE.read();
    const best = save.best == null ? total : Math.min(save.best, total);
    SAVE.write({ best, rounds: (save.rounds || 0) + 1 });
    bestEl.textContent = best.toFixed(1) + '°';

    let title;
    if (total < 5) title = '刀法精准';
    else if (total < 12) title = '分得漂亮';
    else if (total < 25) title = '还算均匀';
    else title = '大小眼';

    setTimeout(() => {
      P.showResult({
        title,
        why: '三份分别是 ' + errors.map((e) => e.size.toFixed(0) + '°').join(' / ') + '，平均偏差 ' + total.toFixed(1) + '°。',
        showFinal: false,
        best: '最佳偏差 ' + best.toFixed(1) + '° · 已切 ' + ((save.rounds || 0) + 1) + ' 个',
        againLabel: '再切一个',
        onAgain: start,
        onExit: () => { location.href = '../../index.html#/category/premium'; }
      });
    }, 420);
  }

  function start() {
    P.hideResult();
    $('#screen-start').hidden = true;
    $('#screen-game').hidden = false;
    resize();
    cuts = [];
    errors = [];
    finished = false;
    slicing = 0;
    angle = Math.random() * 360;
    armed = true;
    running = true;
    last = performance.now();
    dots.forEach((d) => d.classList.remove('is-done'));
    roundLabel.textContent = '第 1 刀';
    tip.innerHTML = '点一下落刀';
    requestAnimationFrame(tick);
  }

  stage.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    cut();
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); cut(); }
  });
  window.addEventListener('resize', () => { if (running) { resize(); draw(); } });

  $('#startSingle').addEventListener('click', start);
  P.mountChrome({});

  const save = SAVE.read();
  bestEl.textContent = save.best == null ? '—' : save.best.toFixed(1) + '°';
  resize();
  draw();
})();