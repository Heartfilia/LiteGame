(function () {
  'use strict';

  // ---------- DOM ----------
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const IS_TOUCH = (navigator.maxTouchPoints || 0) > 0 || window.matchMedia('(pointer: coarse)').matches;
  if (IS_TOUCH) document.body.classList.add('touch-device');

  const ui = {
    hud: document.getElementById('gameHud'),
    time: document.getElementById('hudTime'),
    remaining: document.getElementById('hudRemaining'),
    stage: document.getElementById('hudStage'),
    speed: document.getElementById('hudSpeed'),
    distance: document.getElementById('hudDistance'),
    progress: document.getElementById('progressFill'),
    timerBox: document.getElementById('timerBox'),
    pauseBtn: document.getElementById('pauseBtn'),
    startOverlay: document.getElementById('startOverlay'),
    startBtn: document.getElementById('startBtn'),
    bestStart: document.getElementById('bestStart'),
    pauseOverlay: document.getElementById('pauseOverlay'),
    resumeBtn: document.getElementById('resumeBtn'),
    restartBtn: document.getElementById('restartBtn'),
    overOverlay: document.getElementById('overOverlay'),
    finalDistance: document.getElementById('finalDistance'),
    finalStage: document.getElementById('finalStage'),
    finalBest: document.getElementById('finalBest'),
    newRecord: document.getElementById('newRecord'),
    retryBtn: document.getElementById('retryBtn'),
    countdown: document.getElementById('countdown'),
    countdownText: document.getElementById('countdownText'),
    stageToast: document.getElementById('stageToast'),
    stageToastBonus: document.getElementById('stageToastBonus'),
    stageToastSub: document.getElementById('stageToastSub'),
    touchControls: document.getElementById('touchControls'),
    offroadWarning: document.getElementById('offroadWarning'),
    hudTip: document.getElementById('hudTip')
  };

  // ---------- Utils ----------
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIn = (a, b, t) => a + (b - a) * t * t;
  const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
  const wrap = (v, max) => ((v % max) + max) % max;
  const rand = (min, max) => min + Math.random() * (max - min);
  const formatNumber = (v) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // ---------- Constants ----------
  const SEG_LEN = 200;
  const RUMBLE_SEGS = 3;
  const ROAD_HALF = 2000;
  const DRAW_DIST = 230;
  const FOV = 100;
  const CAMERA_HEIGHT = 1050;
  const MAX_SPEED = 12000;
  const OFFROAD_MAX = 4300;
  const ACCEL = 8200;
  const BRAKE_DECEL = 26000;
  const OFFROAD_DRAG = 14000;
  const CENTRIFUGAL = 0.16;
  const STEER_RATE = 1.9;
  const START_TIME = 35;
  const STAGE_BASE = 280000;
  const STAGE_STEP = 24000;
  const STAGE_BONUS = 26;
  const STAGE_BANNER_TIME = 2.4;
  // Only cars visibly ahead in the contact band collide; closer ones are already passing.
  const COLLIDE_MIN_DZ = 1500;
  const COLLIDE_MAX_DZ = 2100;
  const UNITS_PER_M = 200;
  const KMH_FACTOR = 189 / MAX_SPEED;
  const BEST_KEY = 'litegame.crazy-racing.best';

  const TRAFFIC_COLORS = [
    { body: '#ff7a8a', dark: '#7d2a3d', glass: '#180d19' },
    { body: '#ffd166', dark: '#805a1a', glass: '#171019' },
    { body: '#7bdff2', dark: '#1d6070', glass: '#0b1921' },
    { body: '#b28dff', dark: '#4c2e85', glass: '#140e22' },
    { body: '#f4f1ff', dark: '#6f6a83', glass: '#141220' },
    { body: '#6fe3a1', dark: '#1e603c', glass: '#0b1712' }
  ];

  // ---------- View ----------
  const view = { w: 0, h: 0, dpr: 1, depth: 1 };

  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    view.depth = 1 / Math.tan((FOV / 2) * Math.PI / 180);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 180));

  // ---------- Track ----------
  const segments = [];
  let trackY = 0;

  function addSection(enter, hold, leave, curve, deltaY) {
    const total = enter + hold + leave;
    if (!total) return;
    const startY = trackY;
    const endY = startY + deltaY;
    for (let n = 0; n < total; n++) {
      let c;
      if (n < enter) c = easeIn(0, curve, (n + 1) / enter);
      else if (n < enter + hold) c = curve;
      else c = easeIn(curve, 0, (n - enter - hold + 1) / leave);
      const y1 = easeInOut(startY, endY, n / total);
      const y2 = easeInOut(startY, endY, (n + 1) / total);
      segments.push({ index: segments.length, curve: c, y1, y2, props: [] });
    }
    trackY = endY;
  }

  const TRACK_SECTIONS = [
    [50, 70, 50, 0, 0],
    [40, 50, 40, 2.2, 350],
    [30, 40, 30, 0, 150],
    [40, 60, 40, -2.8, -500],
    [30, 30, 30, 0, 0],
    [50, 70, 50, 3.4, 600],
    [30, 30, 30, -1.8, -200],
    [40, 50, 40, 2.6, 0],
    [30, 30, 30, 0, -300],
    [40, 50, 40, -3, 400],
    [30, 40, 30, 1.6, 0],
    [50, 60, 50, 2.4, -250],
    [30, 30, 30, -2.2, 0],
    [40, 50, 40, 0, 300],
    [40, 50, 40, 3, -300],
    [30, 40, 30, 0, 0],
    [40, 50, 40, -2.6, 200],
    [30, 30, 30, 0, 0]
  ];

  TRACK_SECTIONS.forEach((section) => addSection(section[0], section[1], section[2], section[3], section[4]));
  addSection(40, 40, 40, 0, -trackY);

  const trackLength = segments.length * SEG_LEN;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i % 8 === 0) {
      seg.props.push({ type: 'pole', side: i % 16 === 0 ? 1 : -1 });
    }
    if (i % 13 === 5) {
      seg.props.push({ type: 'tree', side: -1, offset: 1.42 + (i % 4) * 0.2, size: 0.85 + (i % 5) * 0.07 });
    }
    if (i % 17 === 9) {
      seg.props.push({ type: 'tree', side: 1, offset: 1.38 + (i % 3) * 0.22, size: 0.9 + (i % 4) * 0.08 });
    }
  }

  // ---------- Assets / background shapes ----------
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: ((i * 137) % 997) / 997,
      y: ((i * 71) % 383) / 383,
      size: 0.7 + ((i * 29) % 10) / 9,
      alpha: 0.25 + ((i * 17) % 13) / 30
    });
  }

  const MOUNTAINS_BACK = [
    [0, 0.505], [0.07, 0.445], [0.15, 0.482], [0.23, 0.418], [0.31, 0.468],
    [0.39, 0.43], [0.47, 0.478], [0.55, 0.412], [0.63, 0.464], [0.71, 0.426],
    [0.79, 0.475], [0.87, 0.422], [0.94, 0.462], [1, 0.438]
  ];
  const MOUNTAINS_FRONT = [
    [0, 0.51], [0.08, 0.468], [0.17, 0.496], [0.26, 0.455], [0.35, 0.487],
    [0.44, 0.462], [0.53, 0.499], [0.62, 0.464], [0.71, 0.494], [0.8, 0.468],
    [0.89, 0.492], [0.96, 0.464], [1, 0.486]
  ];

  // ---------- Game state ----------
  const loadBest = () => {
    try {
      const value = Number(localStorage.getItem(BEST_KEY));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch (error) {
      return 0;
    }
  };

  const game = {
    state: 'menu',
    time: 0,
    position: 0,
    playerX: 0,
    speed: 0,
    cameraY: 0,
    timeLeft: START_TIME,
    stage: 1,
    target: STAGE_BASE,
    stageStart: 0,
    traffic: [],
    countdown: 0,
    countdownLabel: '',
    goTimer: 0,
    stageBannerTimer: 0,
    collisionCooldown: 0,
    spawnCooldown: 0,
    dustTimer: 0,
    flash: 0,
    shake: 0,
    offroad: false,
    best: loadBest(),
    hudAccum: 0
  };

  const input = { left: false, right: false, brake: false };
  const particles = [];

  // ---------- UI helpers ----------
  function updateBestLabels() {
    ui.bestStart.textContent = formatNumber(game.best) + ' m';
  }

  function updateHud() {
    const meters = game.position / UNITS_PER_M;
    ui.time.textContent = Math.max(0, game.timeLeft).toFixed(1);
    ui.stage.textContent = String(game.stage);
    ui.speed.textContent = String(Math.round(game.speed * KMH_FACTOR));
    ui.distance.textContent = formatNumber(meters);
    const remaining = Math.max(0, Math.ceil((game.target - game.position) / UNITS_PER_M));
    ui.remaining.textContent = '距终点 ' + formatNumber(remaining) + ' m';
    const progress = clamp((game.position - game.stageStart) / (game.target - game.stageStart), 0, 1);
    ui.progress.style.width = (progress * 100).toFixed(2) + '%';
    ui.timerBox.classList.toggle('low', game.timeLeft <= 10);
  }

  function setCountdownLabel(label, isGo) {
    ui.countdownText.textContent = label;
    ui.countdown.classList.toggle('go', !!isGo);
    ui.countdownText.classList.remove('pop');
    void ui.countdownText.offsetWidth;
    ui.countdownText.classList.add('pop');
  }

  function setTouchVisible(show) {
    const visible = IS_TOUCH && show;
    ui.touchControls.hidden = !visible;
    if (!visible) clearInputs();
  }

  function showHudTip() {
    if (IS_TOUCH) return;
    ui.hudTip.classList.remove('show');
    void ui.hudTip.offsetWidth;
    ui.hudTip.classList.add('show');
  }

  function clearInputs() {
    input.left = false;
    input.right = false;
    input.brake = false;
    document.querySelectorAll('.touch-btn.active').forEach((btn) => btn.classList.remove('active'));
  }

  function syncOffroadWarning() {
    const show = game.state === 'playing' && game.offroad && game.stageBannerTimer <= 0;
    ui.offroadWarning.hidden = !show;
  }

  // ---------- Game flow ----------
  function resetGame() {
    game.position = 0;
    game.playerX = 0;
    game.speed = 0;
    game.timeLeft = START_TIME;
    game.stage = 1;
    game.target = STAGE_BASE;
    game.stageStart = 0;
    game.cameraY = segments[0].y1;
    game.traffic.length = 0;
    game.countdown = 3;
    game.countdownLabel = '';
    game.goTimer = 0;
    game.stageBannerTimer = 0;
    game.collisionCooldown = 0;
    game.spawnCooldown = 0;
    game.dustTimer = 0;
    game.flash = 0;
    game.shake = 0;
    game.offroad = false;
    game.hudAccum = 0;
    particles.length = 0;
    clearInputs();
    ui.countdown.classList.remove('go');
    ui.stageToast.hidden = true;
    ui.offroadWarning.hidden = true;
    updateHud();
  }

  function startGame() {
    if (game.state === 'playing' || game.state === 'countdown') return;
    resetGame();
    game.state = 'countdown';
    ui.startOverlay.hidden = true;
    ui.pauseOverlay.hidden = true;
    ui.overOverlay.hidden = true;
    ui.hud.hidden = false;
    ui.countdown.hidden = false;
    ui.newRecord.hidden = true;
    ui.countdownLabel = '3';
    setCountdownLabel('3', false);
    spawnInitialTraffic();
    setTouchVisible(true);
    showHudTip();
    updateHud();
  }

  function pauseGame() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    clearInputs();
    ui.offroadWarning.hidden = true;
    ui.pauseOverlay.hidden = false;
    setTouchVisible(false);
  }

  function resumeGame() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    ui.pauseOverlay.hidden = true;
    setTouchVisible(true);
  }

  function completeStage() {
    game.timeLeft += STAGE_BONUS;
    game.stageStart = game.target;
    game.stage += 1;
    game.target = game.stageStart + STAGE_BASE + (game.stage - 1) * STAGE_STEP;
    game.stageBannerTimer = STAGE_BANNER_TIME;
    ui.offroadWarning.hidden = true;
    ui.stageToastBonus.textContent = '+' + STAGE_BONUS + 's';
    ui.stageToastSub.textContent = '进入第 ' + game.stage + ' 赛段';
    ui.stageToast.hidden = false;
    updateHud();
  }

  function gameOver() {
    game.state = 'over';
    clearInputs();
    setTouchVisible(false);
    ui.offroadWarning.hidden = true;
    ui.stageToast.hidden = true;
    ui.countdown.hidden = true;
    const meters = Math.floor(game.position / UNITS_PER_M);
    const isRecord = meters > game.best;
    if (isRecord) {
      game.best = meters;
      try {
        localStorage.setItem(BEST_KEY, String(meters));
      } catch (error) {
        // Storage may be unavailable; the run still counts for this session.
      }
      updateBestLabels();
    }
    ui.finalDistance.textContent = formatNumber(meters);
    ui.finalStage.textContent = String(game.stage);
    ui.finalBest.textContent = formatNumber(game.best) + ' m';
    ui.newRecord.hidden = !isRecord;
    ui.overOverlay.hidden = false;
    updateHud();
  }

  // ---------- Traffic ----------
  function trafficTarget() {
    return Math.min(3 + (game.stage - 1) * 3, 17);
  }

  function spawnTrafficCar(farOnly) {
    const start = wrap(game.position, trackLength);
    for (let attempt = 0; attempt < 14; attempt++) {
      const aheadRatio = farOnly ? rand(0.38, 0.82) : rand(0.25, 0.85);
      const ahead = aheadRatio * DRAW_DIST * SEG_LEN;
      const z = wrap(start + ahead, trackLength);
      const lanes = [-0.62, 0, 0.62];
      const offset = lanes[(Math.random() * lanes.length) | 0] + rand(-0.06, 0.06);
      let blocked = false;
      for (let i = 0; i < game.traffic.length; i++) {
        const other = game.traffic[i];
        const gap = wrapDistance(other.z, z);
        if (gap < 3600 && Math.abs(other.offset - offset) < 0.48) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      game.traffic.push({
        z,
        offset,
        speed: MAX_SPEED * rand(0.3, 0.53),
        palette: TRAFFIC_COLORS[(Math.random() * TRAFFIC_COLORS.length) | 0]
      });
      return true;
    }
    return false;
  }

  function wrapDistance(a, b) {
    let diff = a - b;
    diff = ((diff % trackLength) + trackLength) % trackLength;
    if (diff > trackLength / 2) diff -= trackLength;
    return Math.abs(diff);
  }

  function signedAhead(carZ, playerZ) {
    let diff = carZ - playerZ;
    diff = ((diff % trackLength) + trackLength) % trackLength;
    if (diff > trackLength / 2) diff -= trackLength;
    return diff;
  }

  function spawnInitialTraffic() {
    const count = trafficTarget();
    for (let i = 0; i < count; i++) spawnTrafficCar(true);
  }

  function ensureTraffic(dt) {
    const playerZ = wrap(game.position, trackLength);
    for (let i = game.traffic.length - 1; i >= 0; i--) {
      const ahead = signedAhead(game.traffic[i].z, playerZ);
      if (ahead < -50000 || ahead > DRAW_DIST * SEG_LEN + 30000) game.traffic.splice(i, 1);
    }
    if (game.traffic.length >= trafficTarget()) {
      game.spawnCooldown = 0.3;
      return;
    }
    game.spawnCooldown -= dt;
    if (game.spawnCooldown <= 0) {
      spawnTrafficCar(false);
      game.spawnCooldown = 0.5;
    }
  }

  function updateTraffic(dt) {
    for (let i = 0; i < game.traffic.length; i++) {
      const car = game.traffic[i];
      car.z = wrap(car.z + car.speed * dt, trackLength);
    }
  }

  function checkCollisions() {
    if (game.collisionCooldown > 0) return;
    const playerZ = wrap(game.position, trackLength);
    for (let i = 0; i < game.traffic.length; i++) {
      const car = game.traffic[i];
      const dz = signedAhead(car.z, playerZ);
      if (dz < COLLIDE_MIN_DZ || dz > COLLIDE_MAX_DZ) continue;
      if (game.speed <= car.speed) continue;
      const dx = (car.offset - game.playerX) * ROAD_HALF;
      if (Math.abs(dx) > 800) continue;
      game.speed = Math.max(1200, Math.min(game.speed * 0.4, car.speed * 0.92));
      game.playerX = clamp(game.playerX + (game.playerX >= car.offset ? 0.075 : -0.075), -1.3, 1.3);
      game.collisionCooldown = 0.85;
      game.shake = 1;
      game.flash = 1;
      spawnHitParticles();
      return;
    }
  }

  // ---------- Player update ----------
  function updatePlayer(dt) {
    const roadPos = wrap(game.position, trackLength);
    const segIndex = Math.floor(roadPos / SEG_LEN) % segments.length;
    const seg = segments[segIndex];
    const speedRatio = game.speed / MAX_SPEED;

    let steer = 0;
    if (input.left) steer -= 1;
    if (input.right) steer += 1;
    game.playerX += steer * STEER_RATE * (0.45 + 0.55 * speedRatio) * dt;
    game.playerX -= seg.curve * CENTRIFUGAL * speedRatio * dt;

    const offroad = Math.abs(game.playerX) > 1;
    game.offroad = offroad;

    if (input.brake) {
      game.speed = Math.max(0, game.speed - BRAKE_DECEL * dt);
    } else {
      const cap = offroad ? OFFROAD_MAX : MAX_SPEED;
      if (game.speed < cap) {
        game.speed = Math.min(cap, game.speed + ACCEL * dt);
      } else {
        const drag = offroad ? OFFROAD_DRAG : 2600;
        game.speed = Math.max(cap, game.speed - drag * dt);
      }
    }

    if (offroad && !input.brake) {
      game.shake = Math.max(game.shake, 0.16 + 0.24 * speedRatio);
      game.dustTimer -= dt;
      if (game.speed > 2200 && game.dustTimer <= 0) {
        spawnDustParticles();
        game.dustTimer = 0.055;
      }
    }

    game.playerX = clamp(game.playerX, -1.32, 1.32);
    game.position += game.speed * dt;

    checkCollisions();
    ensureTraffic(dt);
    syncOffroadWarning();
  }

  function updateCamera(dt) {
    const roadPos = wrap(game.position, trackLength);
    const idx = Math.floor(roadPos / SEG_LEN) % segments.length;
    const percent = (roadPos % SEG_LEN) / SEG_LEN;
    const seg = segments[idx];
    const targetY = lerp(seg.y1, seg.y2, percent);
    const smoothing = 1 - Math.exp(-dt * 11);
    game.cameraY += (targetY - game.cameraY) * smoothing;
    if (!Number.isFinite(game.cameraY)) game.cameraY = targetY;
  }

  // ---------- Particles ----------
  function spawnHitParticles() {
    const cw = clamp(view.w * 0.125, 84, 150);
    const baseY = view.h - (IS_TOUCH ? Math.max(22, view.h * 0.03) : Math.max(56, view.h * 0.065));
    const cx = view.w / 2;
    const y = baseY - cw * 0.3;
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: cx + rand(-cw * 0.4, cw * 0.4),
        y: y + rand(-cw * 0.18, cw * 0.18),
        vx: rand(-340, 340),
        vy: rand(-420, -40),
        gravity: 950,
        size: rand(1.2, 3.2),
        life: rand(0.3, 0.65),
        maxLife: 0.65,
        color: Math.random() < 0.5 ? 'rgba(255, 209, 102, 0.95)' : 'rgba(255, 100, 130, 0.95)',
        additive: true
      });
    }
  }

  function spawnDustParticles() {
    const cw = clamp(view.w * 0.125, 84, 150);
    const baseY = view.h - (IS_TOUCH ? Math.max(22, view.h * 0.03) : Math.max(56, view.h * 0.065));
    for (let i = 0; i < 2; i++) {
      particles.push({
        x: view.w / 2 + rand(-cw * 0.62, cw * 0.62),
        y: baseY - rand(0, 12),
        vx: rand(-110, 110),
        vy: rand(-90, -20),
        gravity: 220,
        size: rand(2, 5.5),
        life: rand(0.35, 0.7),
        maxLife: 0.7,
        color: 'rgba(198, 178, 156, 0.5)',
        additive: false
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
  }

  // ---------- Update loop ----------
  function update(dt) {
    game.time += dt;
    game.shake = Math.max(0, game.shake - dt * 2.6);
    game.flash = Math.max(0, game.flash - dt * 2.2);
    game.collisionCooldown = Math.max(0, game.collisionCooldown - dt);
    updateParticles(dt);

    if (game.state === 'menu') {
      game.position += 2600 * dt;
      game.playerX = Math.sin(game.time * 0.42) * 0.22;
      game.speed = 2600;
      updateCamera(dt);
      return;
    }

    if (game.state === 'countdown') {
      game.countdown -= dt;
      if (game.countdown > 0) {
        const label = String(Math.ceil(game.countdown));
        if (label !== game.countdownLabel) {
          game.countdownLabel = label;
          setCountdownLabel(label, false);
        }
      } else if (game.countdownLabel !== 'GO') {
        game.countdownLabel = 'GO';
        setCountdownLabel('GO', true);
        game.state = 'playing';
        game.goTimer = 0.7;
        setTouchVisible(true);
        showHudTip();
        updateHud();
      }
      updateCamera(dt);
      return;
    }

    if (game.state === 'playing') {
      if (game.goTimer > 0) {
        game.goTimer -= dt;
        if (game.goTimer <= 0) {
          ui.countdown.hidden = true;
          ui.countdown.classList.remove('go');
        }
      }

      if (game.stageBannerTimer > 0) {
        game.stageBannerTimer -= dt;
        if (game.stageBannerTimer <= 0) ui.stageToast.hidden = true;
      }

      game.timeLeft -= dt;
      if (game.timeLeft <= 0) {
        game.timeLeft = 0;
        gameOver();
        return;
      }

      updateTraffic(dt);
      updatePlayer(dt);
      updateCamera(dt);

      game.hudAccum += dt;
      if (game.hudAccum >= 0.08) {
        game.hudAccum = 0;
        updateHud();
      }

      if (game.position >= game.target) {
        completeStage();
        return;
      }
      return;
    }
  }

  // ---------- Rendering ----------
  function fillQuad(x1, y1, w1, x2, y2, w2, color) {
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x1 + w1, y1);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x2 - w2, y2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function fillRoundRect(x, y, w, h, radius, color) {
    const r = Math.max(0.5, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawSky(w, h) {
    const horizon = h * 0.505;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon + h * 0.035);
    sky.addColorStop(0, '#05040d');
    sky.addColorStop(0.35, '#14102d');
    sky.addColorStop(0.62, '#3c1d3e');
    sky.addColorStop(0.85, '#7d3750');
    sky.addColorStop(1, '#b45558');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const parallax = game.playerX * 24;

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      if (star.y > 0.5) continue;
      const twinkle = 0.72 + Math.sin(game.time * 1.6 + star.x * 23) * 0.28;
      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = '#fff';
      ctx.fillRect(star.x * w + parallax * 0.4, star.y * h * 0.7, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    const sunR = Math.min(w, h) * 0.175;
    const sunX = w * 0.72 + parallax;
    const sunY = horizon - sunR * 1.02;

    let glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.3);
    glow.addColorStop(0, 'rgba(255, 170, 120, 0.3)');
    glow.addColorStop(0.45, 'rgba(255, 93, 143, 0.13)');
    glow.addColorStop(1, 'rgba(255, 93, 143, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 3.3, 0, Math.PI * 2);
    ctx.fill();

    const sun = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sun.addColorStop(0, '#fff3c4');
    sun.addColorStop(0.48, '#ffc06d');
    sun.addColorStop(1, '#ff6b6b');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      const stripeY = sunY + sunR * 0.1 + i * sunR * 0.15;
      ctx.fillStyle = 'rgba(38, 18, 48, ' + (0.45 + i * 0.07) + ')';
      ctx.fillRect(sunX - sunR, stripeY, sunR * 2, sunR * (0.03 + i * 0.012));
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-60, horizon + 4);
    for (let i = 0; i < MOUNTAINS_BACK.length; i++) {
      const point = MOUNTAINS_BACK[i];
      ctx.lineTo(point[0] * (w + 120) - 60 + parallax * 0.6, point[1] * h);
    }
    ctx.lineTo(w + 60, horizon + 4);
    ctx.closePath();
    ctx.fillStyle = '#1d1232';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-60, horizon + 8);
    for (let i = 0; i < MOUNTAINS_FRONT.length; i++) {
      const point = MOUNTAINS_FRONT[i];
      ctx.lineTo(point[0] * (w + 120) - 60 + parallax * 0.9, point[1] * h);
    }
    ctx.lineTo(w + 60, horizon + 8);
    ctx.closePath();
    ctx.fillStyle = '#120b20';
    ctx.fill();
    ctx.restore();

    const haze = ctx.createLinearGradient(0, horizon - h * 0.1, 0, horizon + h * 0.05);
    haze.addColorStop(0, 'rgba(255, 120, 120, 0)');
    haze.addColorStop(0.6, 'rgba(255, 120, 120, 0.08)');
    haze.addColorStop(1, 'rgba(8, 20, 24, 1)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - h * 0.1, w, h * 0.15);
  }

  function drawPole(e, prop) {
    const baseY = e.y1;
    const poleH = Math.min(e.w1 * 0.6, view.h * 0.42);
    if (poleH < 1.5) return;
    const x = e.x1 + prop.side * e.w1 * 1.17;
    const lineW = Math.max(0.7, e.w1 * 0.024);
    ctx.strokeStyle = 'rgba(255, 138, 176, 0.62)';
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - poleH);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
    ctx.beginPath();
    ctx.arc(x, baseY - poleH, Math.max(0.8, lineW * 1.7), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTree(e, prop) {
    const baseY = e.y1;
    const treeH = Math.min(e.w1 * 1.15 * prop.size, view.h * 0.9);
    if (treeH < 3) return;
    const x = e.x1 + prop.side * e.w1 * prop.offset;
    const treeW = treeH * 0.44;
    ctx.fillStyle = '#0a171c';
    ctx.beginPath();
    ctx.moveTo(x, baseY - treeH);
    ctx.lineTo(x + treeW * 0.46, baseY - treeH * 0.46);
    ctx.lineTo(x - treeW * 0.46, baseY - treeH * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, baseY - treeH * 0.74);
    ctx.lineTo(x + treeW * 0.56, baseY - treeH * 0.14);
    ctx.lineTo(x - treeW * 0.56, baseY - treeH * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#071216';
    ctx.fillRect(x - treeW * 0.08, baseY - treeH * 0.18, treeW * 0.16, treeH * 0.18);
    if (treeH > 26) {
      ctx.strokeStyle = 'rgba(120, 200, 220, 0.1)';
      ctx.lineWidth = Math.max(0.6, treeH * 0.008);
      ctx.beginPath();
      ctx.moveTo(x, baseY - treeH);
      ctx.lineTo(x + treeW * 0.46, baseY - treeH * 0.46);
      ctx.stroke();
    }
  }

  function drawProps(e) {
    const props = e.seg.props;
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      if (prop.type === 'pole') drawPole(e, prop);
      else drawTree(e, prop);
    }
  }

  function drawTrafficCar(cx, baseY, cw, palette) {
    const h = cw * 0.62;
    if (cw < 2.5) return;
    if (cw < 18) {
      ctx.fillStyle = palette.body;
      fillRoundRect(cx - cw * 0.5, baseY - h * 0.72, cw, h * 0.52, cw * 0.1, palette.body);
      ctx.fillStyle = 'rgba(255, 70, 100, 0.9)';
      ctx.fillRect(cx - cw * 0.34, baseY - h * 0.45, cw * 0.18, Math.max(0.8, h * 0.08));
      ctx.fillRect(cx + cw * 0.16, baseY - h * 0.45, cw * 0.18, Math.max(0.8, h * 0.08));
      return;
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + h * 0.02, cw * 0.55, h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#07060c';
    fillRoundRect(cx - cw * 0.49, baseY - h * 0.24, cw * 0.16, h * 0.24, cw * 0.035, '#07060c');
    fillRoundRect(cx + cw * 0.33, baseY - h * 0.24, cw * 0.16, h * 0.24, cw * 0.035, '#07060c');

    const bodyTop = baseY - h * 0.72;
    const bodyH = h * 0.6;
    const bodyGradient = ctx.createLinearGradient(0, bodyTop, 0, baseY);
    bodyGradient.addColorStop(0, palette.body);
    bodyGradient.addColorStop(1, palette.dark);
    fillRoundRect(cx - cw * 0.5, bodyTop, cw, bodyH, cw * 0.09, bodyGradient);

    fillRoundRect(cx - cw * 0.5, baseY - h * 0.18, cw, h * 0.13, cw * 0.04, palette.dark);

    const cabinW = cw * 0.58;
    const cabinH = h * 0.3;
    const cabinX = cx - cabinW / 2;
    const cabinY = baseY - h * 0.99;
    fillRoundRect(cabinX, cabinY, cabinW, cabinH, cw * 0.06, palette.dark);
    fillRoundRect(cabinX + cw * 0.035, cabinY + h * 0.045, cabinW - cw * 0.07, cabinH - h * 0.075, cw * 0.035, palette.glass);
    ctx.fillStyle = 'rgba(150, 210, 255, 0.18)';
    ctx.fillRect(cabinX + cw * 0.08, cabinY + h * 0.07, cabinW * 0.36, Math.max(0.6, h * 0.014));

    const lightY = baseY - h * 0.5;
    ctx.fillStyle = '#ff415f';
    fillRoundRect(cx - cw * 0.42, lightY, cw * 0.19, Math.max(1, h * 0.085), cw * 0.02, '#ff415f');
    fillRoundRect(cx + cw * 0.23, lightY, cw * 0.19, Math.max(1, h * 0.085), cw * 0.02, '#ff415f');
    ctx.fillStyle = 'rgba(255, 80, 110, 0.18)';
    fillRoundRect(cx - cw * 0.46, lightY - h * 0.02, cw * 0.26, Math.max(1, h * 0.13), cw * 0.03, 'rgba(255, 60, 100, 0.16)');
    fillRoundRect(cx + cw * 0.2, lightY - h * 0.02, cw * 0.26, Math.max(1, h * 0.13), cw * 0.03, 'rgba(255, 60, 100, 0.16)');

    ctx.fillStyle = 'rgba(240, 235, 255, 0.25)';
    ctx.fillRect(cx - cw * 0.09, baseY - h * 0.31, cw * 0.18, Math.max(0.8, h * 0.07));
  }

  function drawPlayerCar(t) {
    const w = view.w;
    const hgt = view.h;
    const cw = clamp(w * 0.125, 84, 150);
    const carH = cw * 0.62;
    const bottomOffset = IS_TOUCH ? Math.max(22, hgt * 0.03) : Math.max(56, hgt * 0.065);
    const bounce = game.offroad ? Math.sin(t * 38) * 2.6 : Math.sin(t * 8.5) * 0.6;
    const baseY = hgt - bottomOffset + bounce;
    const steerDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const cx = w / 2 + steerDir * cw * 0.04;
    const speedAlpha = clamp(game.speed / MAX_SPEED, 0, 1);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 3, cw * 0.58, cw * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(cx, baseY);
    ctx.rotate(steerDir * 0.028);

    const h = carH;
    const bodyTop = -h * 0.74;
    const bodyH = h * 0.62;

    ctx.fillStyle = '#06060c';
    fillRoundRect(-cw * 0.51, -h * 0.27, cw * 0.17, h * 0.27, cw * 0.04, '#06060c');
    fillRoundRect(cw * 0.34, -h * 0.27, cw * 0.17, h * 0.27, cw * 0.04, '#06060c');
    ctx.fillStyle = 'rgba(90, 240, 255, 0.22)';
    ctx.fillRect(-cw * 0.49, -h * 0.16, cw * 0.13, Math.max(0.8, h * 0.02));
    ctx.fillRect(cw * 0.36, -h * 0.16, cw * 0.13, Math.max(0.8, h * 0.02));

    const bodyGradient = ctx.createLinearGradient(0, bodyTop, 0, -h * 0.06);
    bodyGradient.addColorStop(0, '#8af5ff');
    bodyGradient.addColorStop(0.4, '#4cd7f0');
    bodyGradient.addColorStop(1, '#166583');
    fillRoundRect(-cw * 0.5, bodyTop, cw, bodyH, cw * 0.09, bodyGradient);

    fillRoundRect(-cw * 0.5, -h * 0.22, cw, h * 0.16, cw * 0.045, '#0b2a36');
    fillRoundRect(-cw * 0.34, -h * 0.19, cw * 0.68, h * 0.04, h * 0.02, 'rgba(240, 252, 255, 0.18)');

    const cabinW = cw * 0.56;
    const cabinH = h * 0.32;
    const cabinX = -cabinW / 2;
    const cabinY = -h * 1.01;
    fillRoundRect(cabinX, cabinY, cabinW, cabinH, cw * 0.055, '#0a2431');
    fillRoundRect(cabinX + cw * 0.03, cabinY + h * 0.04, cabinW - cw * 0.06, cabinH - h * 0.075, cw * 0.035, '#071723');
    ctx.fillStyle = 'rgba(130, 235, 255, 0.28)';
    ctx.fillRect(cabinX + cw * 0.075, cabinY + h * 0.065, cabinW * 0.34, Math.max(0.7, h * 0.015));
    ctx.fillStyle = 'rgba(130, 235, 255, 0.12)';
    ctx.fillRect(cabinX + cw * 0.075, cabinY + h * 0.11, cabinW * 0.2, Math.max(0.6, h * 0.01));

    const wingY = -h * 0.9;
    ctx.fillStyle = '#0a2531';
    ctx.fillRect(-cw * 0.42, wingY, cw * 0.05, h * 0.16);
    ctx.fillRect(cw * 0.37, wingY, cw * 0.05, h * 0.16);
    fillRoundRect(-cw * 0.48, wingY - h * 0.035, cw * 0.96, h * 0.05, h * 0.025, '#123845');
    ctx.fillStyle = 'rgba(94, 231, 255, 0.55)';
    ctx.fillRect(-cw * 0.44, wingY - h * 0.018, cw * 0.88, Math.max(0.7, h * 0.01));

    const lightY = -h * 0.48;
    const lightH = Math.max(1.2, h * 0.09);
    ctx.fillStyle = 'rgba(255, 80, 120, 0.2)';
    fillRoundRect(-cw * 0.47, lightY - lightH * 0.5, cw * 0.27, lightH * 2.1, cw * 0.03, 'rgba(255, 75, 115, 0.16)');
    fillRoundRect(cw * 0.2, lightY - lightH * 0.5, cw * 0.27, lightH * 2.1, cw * 0.03, 'rgba(255, 75, 115, 0.16)');
    fillRoundRect(-cw * 0.43, lightY, cw * 0.2, lightH, cw * 0.02, '#ff4d79');
    fillRoundRect(cw * 0.23, lightY, cw * 0.2, lightH, cw * 0.02, '#ff4d79');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(-cw * 0.4, lightY + lightH * 0.15, cw * 0.1, Math.max(0.5, lightH * 0.22));
    ctx.fillRect(cw * 0.26, lightY + lightH * 0.15, cw * 0.1, Math.max(0.5, lightH * 0.22));

    ctx.fillStyle = 'rgba(238, 246, 255, 0.34)';
    ctx.fillRect(-cw * 0.1, -h * 0.33, cw * 0.2, Math.max(0.8, h * 0.07));

    const exhaustGlow = ctx.createRadialGradient(0, -h * 0.08, 1, 0, -h * 0.08, cw * 0.28);
    exhaustGlow.addColorStop(0, 'rgba(94, 231, 255, ' + (0.28 * speedAlpha) + ')');
    exhaustGlow.addColorStop(1, 'rgba(94, 231, 255, 0)');
    ctx.fillStyle = exhaustGlow;
    ctx.beginPath();
    ctx.arc(0, -h * 0.08, cw * 0.28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawFinishGate(e) {
    const baseY = (e.y1 + e.y2) / 2;
    const cx = (e.x1 + e.x2) / 2;
    const halfW = (e.w1 + e.w2) / 2;
    if (halfW < 4) return;

    const stripeH = Math.max(2, halfW * 0.055);
    const cols = 12;
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = c % 2 === 0 ? '#f6f1ff' : '#161120';
      ctx.fillRect(cx - halfW + (halfW * 2 * c) / cols, baseY - stripeH / 2, (halfW * 2) / cols + 0.5, stripeH);
    }

    if (halfW < 8) return;
    const gateH = clamp(halfW * 0.72, 12, view.h * 0.5);
    const postW = Math.max(1.6, halfW * 0.045);
    const bannerH = Math.max(3, gateH * 0.2);
    const left = cx - halfW * 1.06;
    const right = cx + halfW * 1.06;
    const top = baseY - gateH;

    ctx.fillStyle = 'rgba(255, 200, 90, 0.85)';
    ctx.fillRect(left, top, postW, gateH);
    ctx.fillRect(right - postW, top, postW, gateH);

    const bannerW = right - left;
    const bannerCols = 14;
    for (let c = 0; c < bannerCols; c++) {
      ctx.fillStyle = c % 2 === 0 ? '#f9f4e6' : '#171120';
      ctx.fillRect(left + (bannerW * c) / bannerCols, top, bannerW / bannerCols + 0.5, bannerH);
    }
    ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.fillRect(left, top + bannerH, bannerW, Math.max(1, bannerH * 0.12));
    ctx.fillStyle = 'rgba(255, 209, 102, 0.1)';
    ctx.fillRect(left, top + bannerH, bannerW, gateH * 0.1);
  }

  function drawSegment(e, buckets, finishN) {
    const seg = e.seg;
    const grassAlt = Math.floor(seg.index / RUMBLE_SEGS) % 2 === 0;
    const rumbleAlt = Math.floor(seg.index / RUMBLE_SEGS) % 2 === 0;
    const roadAlt = Math.floor(seg.index / RUMBLE_SEGS) % 2 === 0;

    if (e.y1 > e.y2) {
      ctx.fillStyle = grassAlt ? '#0a1e24' : '#081a20';
      ctx.fillRect(-40, e.y2, view.w + 80, e.y1 - e.y2 + 1);
    }

    const rumbleW1 = Math.max(0.6, e.w1 * 0.13);
    const rumbleW2 = Math.max(0.4, e.w2 * 0.13);
    fillQuad(e.x1, e.y1, e.w1 + rumbleW1, e.x2, e.y2, e.w2 + rumbleW2, rumbleAlt ? '#f25c84' : '#eee8f8');

    fillQuad(e.x1, e.y1, e.w1, e.x2, e.y2, e.w2, roadAlt ? '#232330' : '#20202b');

    fillQuad(e.x1 - e.w1 * 0.9, e.y1, Math.max(0.35, e.w1 * 0.007), e.x2 - e.w2 * 0.9, e.y2, Math.max(0.25, e.w2 * 0.007), 'rgba(240, 235, 255, 0.32)');
    fillQuad(e.x1 + e.w1 * 0.9, e.y1, Math.max(0.35, e.w1 * 0.007), e.x2 + e.w2 * 0.9, e.y2, Math.max(0.25, e.w2 * 0.007), 'rgba(240, 235, 255, 0.32)');

    if (seg.index % 9 < 5) {
      const laneW1 = Math.max(0.4, e.w1 * 0.009);
      const laneW2 = Math.max(0.3, e.w2 * 0.009);
      fillQuad(e.x1 - e.w1 / 3, e.y1, laneW1, e.x2 - e.w2 / 3, e.y2, laneW2, 'rgba(245, 240, 255, 0.52)');
      fillQuad(e.x1 + e.w1 / 3, e.y1, laneW1, e.x2 + e.w2 / 3, e.y2, laneW2, 'rgba(245, 240, 255, 0.52)');
    }

    drawProps(e);

    const cars = buckets.get(e.n);
    if (cars) {
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        const cw = Math.min(e.w1 * 0.34, view.h * 0.3, 190);
        if (cw < 2.5) continue;
        const cx = e.x1 + car.offset * e.w1;
        if (cx + cw < -40 || cx - cw > view.w + 40) continue;
        if (e.y1 < -cw || e.y1 > view.h + cw) continue;
        drawTrafficCar(cx, e.y1, cw, car.palette);
      }
    }

    const fog = Math.min(0.9, Math.pow(e.n / DRAW_DIST, 1.7) * 1.06);
    if (fog > 0.02) {
      ctx.globalAlpha = fog;
      ctx.fillStyle = '#2a1735';
      ctx.fillRect(-40, e.y2, view.w + 80, Math.max(0, e.y1 - e.y2) + 1);
      ctx.globalAlpha = 1;
    }

    if (e.n === finishN) drawFinishGate(e);
  }

  function render(t) {
    const w = view.w;
    const h = view.h;
    drawSky(w, h);

    const roadPos = wrap(game.position, trackLength);
    const baseIndex = Math.floor(roadPos / SEG_LEN) % segments.length;
    const basePercent = (roadPos % SEG_LEN) / SEG_LEN;
    const baseSeg = segments[baseIndex];
    const cameraX = game.playerX * ROAD_HALF;
    const cameraY = game.cameraY + CAMERA_HEIGHT;
    const depth = view.depth;

    const shakeAmp = game.shake * Math.min(9, w * 0.009);
    const shakeX = Math.sin(t * 93) * shakeAmp;
    const shakeY = Math.cos(t * 71) * shakeAmp * 0.55;

    const entries = [];
    let x = 0;
    let dx = -(baseSeg.curve * basePercent);

    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segments[(baseIndex + n) % segments.length];
      const z1 = (n - basePercent) * SEG_LEN;
      const z2 = z1 + SEG_LEN;
      const x1Off = x;
      const x2Off = x + dx;

      if (z1 > 1) {
        const scale1 = depth / z1;
        const scale2 = depth / z2;
        const px1 = w / 2 + scale1 * (x1Off - cameraX) * w / 2;
        const py1 = h / 2 - scale1 * (seg.y1 - cameraY) * h / 2;
        const pw1 = scale1 * ROAD_HALF * w / 2;
        const px2 = w / 2 + scale2 * (x2Off - cameraX) * w / 2;
        const py2 = h / 2 - scale2 * (seg.y2 - cameraY) * h / 2;
        const pw2 = scale2 * ROAD_HALF * w / 2;
        entries.push({ seg, n, x1: px1, y1: py1, w1: pw1, x2: px2, y2: py2, w2: pw2 });
      }

      x += dx;
      dx += seg.curve;
    }

    let finishN = -1;
    if ((game.state === 'playing' || game.state === 'countdown') && game.target > game.position) {
      const remain = game.target - game.position;
      if (remain < DRAW_DIST * SEG_LEN) {
        finishN = Math.max(1, Math.floor(remain / SEG_LEN + basePercent));
        if (finishN >= DRAW_DIST) finishN = -1;
      }
    }

    const buckets = new Map();
    for (let i = 0; i < game.traffic.length; i++) {
      const car = game.traffic[i];
      const rel = wrap(car.z - roadPos, trackLength);
      if (rel <= 0 || rel >= DRAW_DIST * SEG_LEN) continue;
      let n = Math.floor(rel / SEG_LEN + basePercent);
      if (n < 0) n = 0;
      if (n >= DRAW_DIST) n = DRAW_DIST - 1;
      if (!buckets.has(n)) buckets.set(n, []);
      buckets.get(n).push(car);
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.y2 > h + 60) continue;
      if (e.x1 + e.w1 < -120 || e.x1 - e.w1 > w + 120) continue;
      drawSegment(e, buckets, finishN);
    }

    drawPlayerCar(t);

    ctx.restore();

    if (particles.length) {
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (game.flash > 0.01) {
      const flash = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.18, w / 2, h * 0.55, h * 0.82);
      flash.addColorStop(0, 'rgba(255, 45, 85, 0)');
      flash.addColorStop(1, 'rgba(255, 45, 85, ' + (game.flash * 0.32) + ')');
      ctx.fillStyle = flash;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ---------- Input ----------
  const KEY_MAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowDown: 'brake',
    KeyS: 'brake'
  };

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(event.code) !== -1) {
      event.preventDefault();
    }

    if (event.code === 'Space' || event.code === 'Enter') {
      if (game.state === 'menu' || game.state === 'over') {
        event.preventDefault();
        startGame();
        return;
      }
      if (game.state === 'paused') {
        event.preventDefault();
        resumeGame();
        return;
      }
    }

    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (game.state === 'playing') pauseGame();
      else if (game.state === 'paused') resumeGame();
      return;
    }

    const control = KEY_MAP[event.code];
    if (control) {
      input[control] = true;
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    const control = KEY_MAP[event.code];
    if (control) input[control] = false;
  });

  window.addEventListener('blur', () => {
    clearInputs();
    if (game.state === 'playing') pauseGame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') pauseGame();
  });

  document.querySelectorAll('.touch-btn').forEach((btn) => {
    const control = btn.dataset.control;
    const press = (event) => {
      event.preventDefault();
      try {
        btn.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture is best-effort on older browsers.
      }
      input[control] = true;
      btn.classList.add('active');
    };
    const release = () => {
      input[control] = false;
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  ui.startBtn.addEventListener('click', startGame);
  ui.pauseBtn.addEventListener('click', pauseGame);
  ui.resumeBtn.addEventListener('click', resumeGame);
  ui.restartBtn.addEventListener('click', startGame);
  ui.retryBtn.addEventListener('click', startGame);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // ---------- Initialize ----------
  resize();
  game.cameraY = segments[0].y1;
  updateBestLabels();
  updateHud();

  let lastTime = performance.now();
  function frame(now) {
    const dt = clamp((now - lastTime) / 1000, 0, 0.05);
    lastTime = now;
    update(dt);
    render(now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
