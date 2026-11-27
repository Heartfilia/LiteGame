// ===== ロボットの物理（three.js に依存しない） =====
// 立ったときの姿勢で全部の剛体を回転なしで作る → 関節の角度 0 = 直立
export function createSim(R) {
  const DT = 1 / 120, G = 9.81;
  const world = new R.World({ x: 0, y: -G, z: 0 });
  world.timestep = DT;
  world.integrationParameters.numSolverIterations = 8;
  const events = new R.EventQueue(true);

  const GROUND = (0x1 << 16) | 0xffff, ROBOT = (0x2 << 16) | 0x5, BALL = (0x4 << 16) | 0x7, NONE = 0;
  world.createCollider(R.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setFriction(1).setRestitution(0.2).setCollisionGroups(GROUND));

  // ---- 寸法（メートル）----
  const HIP_X = 0.1, HIP_Y = 0.87, KNEE_Y = 0.47, ANKLE_Y = 0.09, L1 = HIP_Y - KNEE_Y, L2 = KNEE_Y - ANKLE_Y;
  const KNOCKOUT = 150; // これより強い一撃（kg·m/s）は一発で吹っ飛ぶ
  const SETTLE_PRE = 0.3, SETTLE_DUR = 0.75; // そろえる時: 先に体重を移す時間・足を運ぶ時間
  const SETTLE_TOL = 0.03, STEP_H = 0.21, SETTLE_H = 0.08; // 直し始めるずれ・足を上げる高さ
  const PELVIS_Y = 0.92, STAND_H = 0.905, SH_X = 0.25, SH_Y = 1.38, ELB_Y = 1.09, NECK_Y = 1.46;
  const parts = {}, partList = [], colliderPart = new Map();
  let totalMass = 0;
  function part(name, shape, pos, mass, opts = {}) {
    const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos[0], pos[1], pos[2])
      .setLinearDamping(0.05).setAngularDamping(0.3).setCanSleep(false));
    let cd;
    if (shape[0] === 'box') cd = R.ColliderDesc.cuboid(shape[1], shape[2], shape[3]);
    else if (shape[0] === 'cap') cd = R.ColliderDesc.capsule(shape[1], shape[2]);
    else cd = R.ColliderDesc.ball(shape[1]);
    if (opts.offset) cd.setTranslation(...opts.offset);
    if (opts.ghost) cd.setMassProperties(mass, { x: 0, y: 0, z: 0 }, { x: 0.03, y: 0.03, z: 0.03 }, { x: 0, y: 0, z: 0, w: 1 });
    else cd.setMass(mass);
    cd.setFriction(opts.friction ?? 0.6).setRestitution(0.15)
      .setCollisionGroups(opts.ghost ? NONE : ROBOT).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
    const c = world.createCollider(cd, b);
    const p = { name, body: b, collider: c, shape, mass, home: pos.slice(), ghost: !!opts.ghost };
    parts[name] = p; partList.push(p); colliderPart.set(c.handle, p);
    totalMass += mass;
    return p;
  }
  part('pelvis', ['box', 0.15, 0.07, 0.1], [0, PELVIS_Y, 0], 7);
  part('waistY', ['ball', 0.03], [0, 0.99, 0], 0.4, { ghost: true });
  part('torso', ['box', 0.19, 0.22, 0.12], [0, 1.22, 0], 11);
  part('head', ['box', 0.15, 0.12, 0.13], [0, 1.6, 0], 3);
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'R' : 'L';
    part('hipY' + k, ['ball', 0.03], [s * HIP_X, HIP_Y, 0], 0.4, { ghost: true });
    part('thigh' + k, ['cap', 0.135, 0.065], [s * HIP_X, (HIP_Y + KNEE_Y) / 2, 0], 4);
    part('shin' + k, ['cap', 0.13, 0.06], [s * HIP_X, (KNEE_Y + ANKLE_Y) / 2, 0], 3);
    part('ankY' + k, ['ball', 0.03], [s * HIP_X, ANKLE_Y, 0], 0.3, { ghost: true });
    part('foot' + k, ['box', 0.07, 0.045, 0.125], [s * HIP_X, 0.045, 0.03], 1.6, { friction: 1.2 });
    part('shY' + k, ['ball', 0.03], [s * SH_X, SH_Y, 0], 0.3, { ghost: true });
    part('upper' + k, ['cap', 0.1, 0.05], [s * SH_X, (SH_Y + ELB_Y) / 2, 0], 2);
    part('fore' + k, ['cap', 0.1, 0.045], [s * SH_X, ELB_Y - 0.15, 0], 1.6);
  }

  const joints = {};
  function rev(name, a, b, anchor, axis, lo, hi, kp, kd) {
    const A = parts[a], B = parts[b];
    const la = { x: anchor[0] - A.home[0], y: anchor[1] - A.home[1], z: anchor[2] - A.home[2] };
    const lb = { x: anchor[0] - B.home[0], y: anchor[1] - B.home[1], z: anchor[2] - B.home[2] };
    const ax = axis === 'x' ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
    const j = world.createImpulseJoint(R.JointData.revolute(la, lb, ax), A.body, B.body, true);
    j.setLimits(lo, hi);
    j.configureMotorModel(R.MotorModel.ForceBased);
    const jj = { name, j, kp, kd, target: 0, lo, hi, gain: 1 };
    joints[name] = jj;
    return jj;
  }
  rev('waistP', 'pelvis', 'waistY', [0, 0.99, 0], 'x', -0.4, 1.3, 900, 40);
  rev('waistR', 'waistY', 'torso', [0, 0.99, 0], 'z', -0.4, 0.4, 900, 40);
  rev('neck', 'torso', 'head', [0, NECK_Y, 0], 'x', -0.5, 0.6, 120, 6);
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'R' : 'L';
    // 外に開く向きが正になるよう、左右で限界を入れ替える
    const out = (a, b) => s > 0 ? [a, b] : [-b, -a];
    rev('hipR' + k, 'pelvis', 'hipY' + k, [s * HIP_X, HIP_Y, 0], 'z', ...out(-0.25, 0.7), 1400, 50);
    rev('hipP' + k, 'hipY' + k, 'thigh' + k, [s * HIP_X, HIP_Y, 0], 'x', -1.9, 0.6, 1400, 50);
    rev('knee' + k, 'thigh' + k, 'shin' + k, [s * HIP_X, KNEE_Y, 0], 'x', 0, 2.4, 1200, 40);
    rev('ankP' + k, 'shin' + k, 'ankY' + k, [s * HIP_X, ANKLE_Y, 0], 'x', -0.9, 0.9, 700, 20);
    rev('ankR' + k, 'ankY' + k, 'foot' + k, [s * HIP_X, ANKLE_Y, 0], 'z', -0.45, 0.45, 500, 15);
    rev('shP' + k, 'torso', 'shY' + k, [s * SH_X, SH_Y, 0], 'x', -3.0, 1.0, 140, 6);
    rev('shR' + k, 'shY' + k, 'upper' + k, [s * SH_X, SH_Y, 0], 'z', ...out(-0.1, 2.6), 140, 6);
    rev('elb' + k, 'upper' + k, 'fore' + k, [s * SH_X, ELB_Y, 0], 'x', -2.4, 0, 80, 4);
  }
  const jointList = Object.values(joints);

  // ---- 小さなベクトル・クォータニオン ----
  const rotV = (q, v) => { // q * v * q^-1
    const { x, y, z, w } = q, ix = w * v.x + y * v.z - z * v.y, iy = w * v.y + z * v.x - x * v.z, iz = w * v.z + x * v.y - y * v.x, iw = -x * v.x - y * v.y - z * v.z;
    return { x: ix * w + iw * -x + iy * -z - iz * -y, y: iy * w + iw * -y + iz * -x - ix * -z, z: iz * w + iw * -z + ix * -y - iy * -x };
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // 足の上げ方: すばやく上げて、上でねばってから下ろす
  const lift = u => Math.pow(Math.max(0, Math.sin(Math.PI * clamp(u, 0, 1))), 0.6);
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

  // ---- 状態 ----
  const sim = {
    world, parts, partList, joints, colliderPart, totalMass, DT,
    state: 'stand', stateT: 0, tilt: 0, stagger: 0, time: 0,
    com: { x: 0, y: 0, z: 0 }, comV: { x: 0, y: 0, z: 0 },
    swing: null, stepCool: 0, settleLeft: 4, flap: 0, postSettle: 0, gu: {}, stun: 0, stunK: 0, stunDur: 1, hits: [], balls: [], onStep: null, onFall: null, onGetup: null, onPhase: null, onLand: null,
  };
  const feet = [{ s: -1, k: 'R' }, { s: 1, k: 'L' }];

  function measure() {
    let m = 0, cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0;
    for (const p of partList) {
      const t = p.body.translation(), v = p.body.linvel(), w = p.mass;
      m += w; cx += t.x * w; cy += t.y * w; cz += t.z * w; vx += v.x * w; vy += v.y * w; vz += v.z * w;
    }
    sim.com = { x: cx / m, y: cy / m, z: cz / m }; sim.comV = { x: vx / m, y: vy / m, z: vz / m };
    const up = rotV(parts.torso.body.rotation(), { x: 0, y: 1, z: 0 });
    sim.tilt = Math.acos(clamp(up.y, -1, 1));
    const pf = rotV(parts.pelvis.body.rotation(), { x: 0, y: 0, z: 1 });
    sim.yaw = Math.atan2(pf.x, pf.z);
    for (const f of feet) {
      const b = parts['foot' + f.k].body, t = b.translation(), fu = rotV(b.rotation(), { x: 0, y: 1, z: 0 });
      // 足首の位置（足の中心から上に少し・かかと寄り）
      const a = rotV(b.rotation(), { x: 0, y: ANKLE_Y - 0.045, z: -0.03 });
      f.ankle = { x: t.x + a.x, y: t.y + a.y, z: t.z + a.z };
      f.ground = t.y < 0.09 && fu.y > 0.85;
    }
  }

  // 脚の逆運動学: 骨盤の座標で見た足首の位置 v → 5つの関節角
  function legIK(k, s, v, ankPitchAdd = 0, ankRollAdd = 0) {
    const r = Math.atan2(v.x, -v.y);
    const ly = Math.hypot(v.x, v.y), D = clamp(Math.hypot(ly, v.z), 0.25, L1 + L2 - 0.002);
    const knee = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
    const beta = Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
    const alpha = Math.atan2(v.z, ly);
    const p = -(alpha + beta);
    joints['hipR' + k].target = r; joints['hipP' + k].target = p; joints['knee' + k].target = knee;
    joints['ankP' + k].target = -(p + knee) + ankPitchAdd; joints['ankR' + k].target = -r + ankRollAdd;
  }

  // 骨盤の「なりたい位置」から、足首の世界座標を骨盤の座標に直す
  function legsToward(P, yaw, targets) {
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    for (const f of feet) {
      const A = targets[f.k];
      const hx = P.x + c * f.s * HIP_X, hz = P.z - sn * f.s * HIP_X, hy = P.y + (HIP_Y - PELVIS_Y);
      const dx = A.x - hx, dy = A.y - hy, dz = A.z - hz;
      // 世界 → 骨盤（向きだけ）
      const v = { x: c * dx - sn * dz, y: dy, z: sn * dx + c * dz };
      legIK(f.k, f.s, v);
    }
  }

  function setGains(g, legs = g, arms = g) {
    for (const j of jointList) {
      const n = j.name;
      j.gain = /^(hip|knee|ank)/.test(n) ? legs : /^(sh|elb)/.test(n) ? arms : g;
    }
  }

  // 上体をまっすぐに戻す補助（倒れないための「ずる」は小さく、起き上がりの時だけ強く）
  function uprightAssist(name, kp, kd, max) {
    const b = parts[name].body, q = b.rotation(), up = rotV(q, { x: 0, y: 1, z: 0 }), w = b.angvel();
    // up → (0,1,0) へ回す軸 = up × Y
    let ax = -up.z, az = up.x; // up × (0,1,0) = (-up.z, 0, up.x)
    const ang = Math.acos(clamp(up.y, -1, 1)), sl = Math.hypot(ax, az) || 1;
    ax /= sl; az /= sl;
    let tx = kp * ang * ax - kd * w.x, tz = kp * ang * az - kd * w.z, ty = -kd * 0.3 * w.y;
    const tl = Math.hypot(tx, tz);
    if (tl > max) { tx *= max / tl; tz *= max / tl; }
    b.applyTorqueImpulse({ x: tx * DT, y: ty * DT, z: tz * DT }, true);
  }

  // 体の「上」を target の向きへ回す補助（起き上がり用。上限つき）
  function orientAssist(name, target, kp, kd, max) {
    const b = parts[name].body, up = rotV(b.rotation(), { x: 0, y: 1, z: 0 }), w = b.angvel();
    let ax = up.y * target.z - up.z * target.y, ay = up.z * target.x - up.x * target.z, az = up.x * target.y - up.y * target.x;
    const sl = Math.hypot(ax, ay, az), ang = Math.atan2(sl, up.x * target.x + up.y * target.y + up.z * target.z);
    if (sl > 1e-6) { ax /= sl; ay /= sl; az /= sl; } else { ax = ay = az = 0; }
    let tx = kp * ang * ax - kd * w.x, ty = kp * ang * ay - kd * w.y, tz = kp * ang * az - kd * w.z;
    const tl = Math.hypot(tx, ty, tz);
    if (tl > max) { tx *= max / tl; ty *= max / tl; tz *= max / tl; }
    b.applyTorqueImpulse({ x: tx * DT, y: ty * DT, z: tz * DT }, true);
  }
  function liftUp(name, fy) { parts[name].body.applyImpulse({ x: 0, y: fy * DT, z: 0 }, true); }
  function setPose(o) { for (const k in o) { if (joints[k]) joints[k].target = o[k]; else for (const sd of ['L', 'R']) if (joints[k + sd]) joints[k + sd].target = (/^(shR|hipR|ankR)/.test(k) && sd === 'R' ? -1 : 1) * o[k]; } }

  const ARM_IDLE = { shP: 0.05, shR: 0.12, elb: -0.25 };
  function armPose(shP, shR, elb) {
    for (const k of ['R', 'L']) { joints['shP' + k].target = shP; joints['shR' + k].target = shR * (k === 'L' ? 1 : -1); joints['elb' + k].target = elb; }
  }

  function setState(s) { sim.state = s; sim.stateT = 0; }

  function control() {
    measure();
    const st = sim.state, t = sim.stateT;
    const pel = parts.pelvis.body, pt = pel.translation(), pv = pel.linvel();
    const yaw = sim.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
    const fwd = { x: sn, z: c }, side = { x: c, z: -sn }; // side = 骨盤の +x（L 側）
    const FL = feet[1], FR = feet[0];

    if (st === 'stand') {
      sim.stepCool -= DT;
      const Tc = Math.sqrt(0.9 / G);
      // 支えの中心
      let sx, sz;
      if (sim.swing) {
        const sf = feet.find(f => f !== sim.swing.foot); sx = sf.ankle.x; sz = sf.ankle.z;
        // そろえる時は、重心を立っている足の少し内側までだけ移す（行きすぎて反対へ倒れないように）
        if (sim.swing.settle) { const o = sim.swing.foot.s * 0.035; sx += side.x * o; sz += side.z * o; }
      }
      else { sx = (FL.ankle.x + FR.ankle.x) / 2; sz = (FL.ankle.z + FR.ankle.z) / 2; }
      const ex = sim.com.x - sx, ez = sim.com.z - sz;
      const cpx = ex + sim.comV.x * Tc, cpz = ez + sim.comV.z * Tc;
      const cpF = cpx * fwd.x + cpz * fwd.z, cpS = cpx * side.x + cpz * side.z;
      const cpLen = Math.hypot(cpx, cpz);
      sim.stagger = clamp(cpLen / 0.25, 0, 1); sim.cpF = cpF; sim.cpS = cpS;

      // 踏み出し
      // 踏み出すかどうか。足をそろえた直後だけは、左右を「両足を結んだ線」からのはみ出しで見る（体重を片足に寄せたままでも慌てて踏み出さない）
      let oF = cpF, oS = cpS;
      sim.postSettle -= DT;
      if (!sim.swing && sim.postSettle > 0) {
        const ax = FR.ankle.x, az = FR.ankle.z, bx = FL.ankle.x - ax, bz = FL.ankle.z - az;
        const Cx = sim.com.x + sim.comV.x * Tc, Cz = sim.com.z + sim.comV.z * Tc;
        const u = clamp(((Cx - ax) * bx + (Cz - az) * bz) / (bx * bx + bz * bz || 1), 0, 1);
        const dx = Cx - (ax + bx * u), dz = Cz - (az + bz * u);
        oF = dx * fwd.x + dz * fwd.z; oS = dx * side.x + dz * side.z;
      }
      if (!sim.swing && sim.stepCool <= 0 && (cpF > 0.09 || cpF < -0.07 || Math.abs(oS) > 0.1)) {
        let foot;
        if (Math.abs(cpS) > Math.abs(cpF) * 0.8) foot = cpS > 0 ? FL : FR;
        else { // 押された向きで後ろにある足を出す
          const dl = (FL.ankle.x - sx) * cpx + (FL.ankle.z - sz) * cpz, dr = (FR.ankle.x - sx) * cpx + (FR.ankle.z - sz) * cpz;
          foot = dl < dr ? FL : FR;
        }
        // 続けて踏むときは足を交互に
        if (sim.lastStep && sim.lastStep.k === foot.k && sim.time - sim.lastStep.t < 0.6) foot = foot === FL ? FR : FL;
        sim.swing = { foot, u: 0, start: { ...foot.ankle }, dur: 0.3 };
        sim.lastStep = { k: foot.k, t: sim.time };
        sim.settleLeft = 4;
        if (sim.onStep) sim.onStep(foot.k);
      }
      // 落ち着いたら、両足を理想の位置（重心の真下で腰幅に開き、前後をそろえた所）へ戻す
      sim.calm = Math.hypot(sim.comV.x, sim.comV.z) < 0.1 && cpLen < 0.16 ? (sim.calm || 0) + DT : 0;
      // ずれ = 両足の幅と前後の差が、腰幅・そろった状態からどれだけ離れているか
      const ldx = FL.ankle.x - FR.ankle.x, ldz = FL.ankle.z - FR.ankle.z;
      sim.footErr = Math.hypot(ldx * side.x + ldz * side.z - 2 * HIP_X, ldx * fwd.x + ldz * fwd.z);
      if (!sim.swing && sim.calm > 0.3 && sim.settleLeft > 0 && sim.footErr > SETTLE_TOL) {
        // 動かすのは骨盤の真下から遠い方。もう片方の足の横、腰幅の所へ（体は踏ん張りで両足の真ん中に戻る）
        const off = g => { const ex = g.ankle.x - pt.x, ez = g.ankle.z - pt.z; return Math.hypot(ex * side.x + ez * side.z - g.s * HIP_X, ex * fwd.x + ez * fwd.z); };
        const f = off(FL) > off(FR) ? FL : FR, o = f === FL ? FR : FL;
        const tgt = { x: o.ankle.x + side.x * f.s * 2 * HIP_X, z: o.ankle.z + side.z * f.s * 2 * HIP_X };
        sim.swing = { foot: f, u: -SETTLE_PRE / SETTLE_DUR, start: { ...f.ankle }, dur: SETTLE_DUR, fixed: tgt, settle: true, bias: { x: 0, z: 0 } };
        sim.settleLeft--;
        sim.calm = 0;
        if (sim.onStep) sim.onStep(f.k);
      }

      // 骨盤のなりたい位置: 今の位置から、倒れる向きと逆へずらす（足首と股関節の踏ん張り）
      const lean = 0.9, lx = clamp(-cpx * lean, -0.1, 0.1), lz = clamp(-cpz * lean, -0.1, 0.1);
      const P = { x: pt.x + lx, y: STAND_H - (sim.swing ? 0.02 : 0), z: pt.z + lz };
      const targets = {};
      for (const f of feet) targets[f.k] = { ...f.ankle, y: ANKLE_Y };
      if (sim.swing) {
        const sw = sim.swing, f = sw.foot;
        sw.u += DT / sw.dur;
        // 着地点: 重心＋捕捉点の先、腰幅ぶん横へ
        const ox = f.s * HIP_X * side.x, oz = f.s * HIP_X * side.z;
        let tx = sim.com.x + sim.comV.x * Tc * 1.15 + ox, tz = sim.com.z + sim.comV.z * Tc * 1.15 + oz;
        const other = feet.find(g => g !== f);
        // 足が交差しないように: 相手の足より外側
        const rel = (tx - other.ankle.x) * side.x + (tz - other.ankle.z) * side.z;
        if (rel * f.s < 0.14) { const d = 0.14 * f.s - rel; tx += d * side.x; tz += d * side.z; }
        // 一歩の上限
        const sdx = tx - other.ankle.x, sdz = tz - other.ankle.z, sl = Math.hypot(sdx, sdz);
        if (sl > 0.55) { tx = other.ankle.x + sdx * 0.55 / sl; tz = other.ankle.z + sdz * 0.55 / sl; }
        if (sw.fixed) sw.target = sw.fixed; else if (sw.u < 0.6) sw.target = { x: tx, z: tz };
        const u = smooth(sw.u), tg = sw.target;
        if (sw.u < 1) {
          targets[f.k] = { x: sw.start.x + (tg.x - sw.start.x) * u, y: ANKLE_Y + STEP_H * lift(sw.u), z: sw.start.z + (tg.z - sw.start.z) * u };
          if (sw.settle) targets[f.k].y = ANKLE_Y + SETTLE_H * lift(sw.u) * (1 - 0.15 * u) + 0.025 * u;
        } else if (sw.settle) {
          // そろえる時は、ねらった位置に届くまで少し浮かせたまま合わせてから下ろす（モーターの遅れは bias で補う）
          const er = Math.hypot(f.ankle.x - tg.x, f.ankle.z - tg.z);
          if (er > 0.012 && sw.u < 1.8 && !sw.lower) {
            sw.bias.x = clamp(sw.bias.x + (tg.x - f.ankle.x) * DT * 6, -0.06, 0.06);
            sw.bias.z = clamp(sw.bias.z + (tg.z - f.ankle.z) * DT * 6, -0.06, 0.06);
            targets[f.k] = { x: tg.x + sw.bias.x, y: ANKLE_Y + 0.025, z: tg.z + sw.bias.z };
          } else {
            if (!sw.lower) { sw.lower = true; sw.lowT = 0; }
            sw.lowT += DT;
            // そっと下ろす
            targets[f.k] = { x: tg.x + sw.bias.x, y: ANKLE_Y + 0.025 * (1 - smooth(sw.lowT / 0.2)) - 0.005, z: tg.z + sw.bias.z };
          }
        } else targets[f.k] = { x: tg.x, y: ANKLE_Y, z: tg.z };
        // 支える脚が体重で沈んだぶん、上げている足も下がってしまうので足し戻す
        if (!sw.lower && sw.u > 0) targets[f.k].y += clamp(P.y - pt.y, 0, 0.08) * Math.min(1, sw.u * 4);
        const done = sw.settle ? sw.lower && f.ground && (sw.landT = (sw.landT || 0) + DT) > 0.05 : sw.u >= 1 && f.ground;
        if (done || sw.u > 2.6) { sim.swing = null; sim.stepCool = sw.settle ? 0.25 : 0.05; if (sw.settle) sim.postSettle = 0.8; if (sim.onLand) sim.onLand(f.k); }
      }
      legsToward(P, yaw, targets);
      // 足首でも踏ん張る
      for (const f of feet) {
        if (sim.swing && sim.swing.foot === f) continue;
        joints['ankP' + f.k].target += clamp(cpF * 1.2, -0.25, 0.25);
        joints['ankR' + f.k].target += clamp(-cpS * 2, -0.25, 0.25);
      }
      joints.waistP.target = clamp(-cpF * 0.8, -0.3, 0.4); joints.waistR.target = clamp(cpS * 0.8, -0.3, 0.3);
      joints.neck.target = 0;
      // 腕: よろけるほど広げてバランスを取る
      const a = sim.stagger;
      armPose(ARM_IDLE.shP + cpF * 1.0, ARM_IDLE.shR + a * 1.3, ARM_IDLE.elb - a * 0.6);
      // バタバタ: よろけている間と足を上げている間は、腕を左右ちがう向きにばたつかせる
      sim.flap += ((sim.swing && !sim.swing.settle ? 1 : 0) * 0.6 + a - sim.flap) * Math.min(1, DT * 6);
      if (sim.flap > 0.02) {
        for (const k of ['R', 'L']) {
          const ph = k === 'L' ? 0 : Math.PI, sg = k === 'L' ? 1 : -1;
          joints['shP' + k].target += Math.sin(sim.time * 13 + ph) * 0.7 * sim.flap;
          joints['shR' + k].target += sg * (0.25 + 0.35 * Math.sin(sim.time * 17 + ph * 0.5)) * sim.flap;
          joints['elb' + k].target += -0.4 * sim.flap * (1 + Math.sin(sim.time * 11 + ph));
        }
      }
      // 当たった直後（stun）は、上体・腕・脚の力と立て直しの補助を一時的に弱める
      const sn = sim.stun > 0 ? sim.stunK * Math.pow(sim.stun / sim.stunDur, 0.7) : 0;
      setGains(1 - 0.75 * sn, 1 - 0.5 * sn, 1 - 0.85 * sn);
      uprightAssist('torso', 250 * (1 - sn), 30 * (1 - sn), 45 * (1 - sn));
      uprightAssist('pelvis', 120 * (1 - sn), 10 * (1 - sn), 25 * (1 - sn));
      if (sim.tilt > 0.7 || pt.y < 0.62) { setState('fallen'); sim.swing = null; if (sim.onFall) sim.onFall(); }
    } else if (st === 'fallen') {
      setGains(0.03, 0.03, 0.03);
      // 力が抜けた姿勢（少しだけ縮こまる）
      for (const j of jointList) j.target = 0;
      for (const k of ['R', 'L']) { joints['knee' + k].target = 0.4; joints['hipP' + k].target = -0.3; joints['elb' + k].target = -0.5; }
      const sp = Math.hypot(pv.x, pv.y, pv.z);
      if (t > 2.6 && sp < 0.4) { setState('getup'); if (sim.onGetup) sim.onGetup(); }
    } else if (st === 'getup') {
      // 倒れ方で段取りを変える: 仰向け・横向き → 寝返り → うつ伏せで腕立て → 四つんばい → しゃがむ → 立つ
      // 動きは関節のモーターが中心。補助の力は小さく、うまくいかない時だけ少しずつ強くする
      const tq = parts.torso.body.rotation(), chest = rotV(tq, { x: 0, y: 0, z: 1 }), tup = rotV(tq, { x: 0, y: 1, z: 0 });
      const M = sim.totalMass, gu = sim.gu;
      if (!gu.phase) { gu.phase = chest.y < -0.45 ? 'push' : 'roll'; gu.t = 0; gu.boost = gu.boost || 1; if (sim.onPhase) sim.onPhase(gu.phase); }
      gu.t += DT;
      const go = (ph) => { if (ph !== gu.phase && sim.onPhase) sim.onPhase(ph); gu.phase = ph; gu.t = 0; };
      const B = gu.boost;
      // 頭の向き（水平）: うつ伏せから立った時に向く方向
      let hx = tup.x, hz = tup.z; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
      setGains(clamp(sim.stateT / 0.4, 0.03, 1));
      if (gu.phase === 'roll') {
        // 寝返り: 片腕を体の前に回し、同じ側の脚を曲げ、体の軸まわりに少し回す
        if (gu.dir === undefined) {
          // 胸が向いている横の向き（ロボットの左右どちらに回ると早く下を向くか）
          const lat = rotV(tq, { x: 1, y: 0, z: 0 });
          gu.dir = lat.y > 0 ? 1 : -1; // +1: 左側(+x)が上 → 右へ回る
        }
        const d = gu.dir, up = d > 0 ? 'L' : 'R', dn = d > 0 ? 'R' : 'L';
        setPose({ waistP: 0.3, waistR: 0, neck: 0.3 });
        joints['shP' + up].target = -1.8; joints['shR' + up].target = (up === 'L' ? 1 : -1) * -0.1; joints['elb' + up].target = -0.6;
        joints['shP' + dn].target = -0.3; joints['shR' + dn].target = (dn === 'L' ? 1 : -1) * 0.6; joints['elb' + dn].target = -0.3;
        joints['hipP' + up].target = -1.3; joints['knee' + up].target = 1.6; joints['hipR' + up].target = 0;
        joints['hipP' + dn].target = -0.2; joints['knee' + dn].target = 0.3;
        // 体の軸（頭の向き）まわりに回す
        const w = parts.torso.body.angvel(), spin = w.x * tup.x + w.y * tup.y + w.z * tup.z;
        const T = clamp((70 * B) * (-d) - 12 * spin, -110 * B, 110 * B);
        for (const n of ['torso', 'pelvis']) parts[n].body.applyTorqueImpulse({ x: tup.x * T * DT * (n === 'torso' ? 1 : 0.6), y: tup.y * T * DT * (n === 'torso' ? 1 : 0.6), z: tup.z * T * DT * (n === 'torso' ? 1 : 0.6) }, true);
        if (chest.y < -0.6) go('push');
        if (gu.t > 2.5) { gu.boost = Math.min(3, B + 0.4); gu.dir = -gu.dir; gu.t = 0; }
      } else if (gu.phase === 'push') {
        // 腕立て: 腕を胸の下につき、肘を伸ばして上体を押し上げる
        const u = smooth(gu.t / 0.9);
        setPose({ shP: -1.45, shR: 0.25, elb: -1.7 + 1.55 * smooth((gu.t - 0.3) / 0.6), hipP: -0.1, hipR: 0.05, knee: 0.3, ankP: -0.3, ankR: 0, waistP: 0, waistR: 0, neck: -0.4 });
        // 上体をななめ（25°）まで起こす手伝い
        const a = 0.45 * u, tgt = { x: hx * Math.cos(a), y: Math.sin(a), z: hz * Math.cos(a) };
        orientAssist('torso', tgt, 260 * B, 30, 90 * B);
        liftUp('torso', M * G * 0.12 * B * u);
        if (gu.t > 0.95 && tup.y > 0.25) go('knees');
        if (gu.t > 2.5) { gu.boost = Math.min(3, B + 0.4); go('push'); }
      } else if (gu.phase === 'knees') {
        // 四つんばい: 膝を胸の下へ引き寄せる
        const u = smooth(gu.t / 0.7);
        setPose({ shP: -1.35 + 0.3 * u, shR: 0.25, elb: -0.15, hipP: -1.65 * u - 0.1, hipR: 0.08, knee: 0.3 + 1.9 * u, ankP: -0.5, ankR: 0, waistP: 0.25 * u, waistR: 0, neck: -0.3 });
        const a = 0.45 + 0.35 * u, tgt = { x: hx * Math.cos(a), y: Math.sin(a), z: hz * Math.cos(a) };
        orientAssist('torso', tgt, 300 * B, 35, 110 * B);
        liftUp('pelvis', M * G * 0.15 * B * u); liftUp('torso', M * G * 0.15 * B);
        if (gu.t > 0.8) go('squat');
      } else if (gu.phase === 'squat') {
        // 手で押し離して、かかとに腰を落としたしゃがみ姿勢へ（足は骨盤の真下）
        const u = smooth(gu.t / 0.9);
        const P = { x: pt.x, y: 0.5, z: pt.z }, targets = {};
        for (const f of feet) { const hx2 = P.x + c * f.s * HIP_X, hz2 = P.z - sn * f.s * HIP_X; targets[f.k] = { x: hx2 + fwd.x * 0.04, y: ANKLE_Y, z: hz2 + fwd.z * 0.04 }; }
        legsToward(P, yaw, targets);
        joints.waistP.target = 0.45 - 0.2 * u; joints.waistR.target = 0; joints.neck.target = 0;
        armPose(-1.3 + 0.4 * u, 0.3, -0.2 - 0.3 * u);
        orientAssist('torso', { x: 0, y: 1, z: 0 }, 420 * B, 45, 150 * B * (0.4 + 0.6 * u));
        orientAssist('pelvis', { x: 0, y: 1, z: 0 }, 250 * B, 25, 90 * B * u);
        const fy = M * (G * 0.3 * B * u + 12 * (0.5 - pt.y) * u - 4 * pv.y);
        pel.applyImpulse({ x: -M * 2 * pv.x * DT, y: clamp(fy, -150, M * G * 0.6 * B) * DT, z: -M * 2 * pv.z * DT }, true);
        if (gu.t > 1.0 && sim.tilt < 0.6) go('rise');
        if (gu.t > 3) { gu.boost = Math.min(3, B + 0.4); gu.t = 0; }
      } else if (gu.phase === 'rise') {
        // 立ち上がる: 腰を上げながら膝を伸ばす。補助はだんだん抜く
        const u = smooth(gu.t / 1.0), h = 0.5 + (STAND_H - 0.5) * u;
        const P = { x: pt.x, y: h, z: pt.z }, targets = {};
        for (const f of feet) { const hx2 = P.x + c * f.s * HIP_X, hz2 = P.z - sn * f.s * HIP_X; targets[f.k] = { x: hx2 + fwd.x * 0.03, y: ANKLE_Y, z: hz2 + fwd.z * 0.03 }; }
        legsToward(P, yaw, targets);
        joints.waistP.target = 0.45 * (1 - u); joints.waistR.target = 0; joints.neck.target = 0;
        armPose(-0.9 * (1 - u) + 0.05, 0.3, -0.3);
        const k = 1 - smooth((gu.t - 0.9) / 0.6);
        orientAssist('torso', { x: 0, y: 1, z: 0 }, 400 * B * k, 45 * k, 150 * B * k);
        orientAssist('pelvis', { x: 0, y: 1, z: 0 }, 200 * B * k, 20 * k, 80 * B * k);
        const fy = M * (G * 0.35 * B + 15 * (h - pt.y) - 5 * pv.y) * k;
        pel.applyImpulse({ x: -M * 2 * pv.x * k * DT, y: clamp(fy, -150, M * G * 0.7 * B) * DT, z: -M * 2 * pv.z * k * DT }, true);
        if (gu.t > 1.5 && sim.tilt < 0.25) { setState('stand'); sim.stepCool = 0.2; sim.settleLeft = 4; sim.gu = {}; }
        if (gu.t > 3.5) { gu.boost = Math.min(3, B + 0.4); go('squat'); }
      }
      // 途中で大きく崩れたら、倒れた状態に戻ってやり直す（次は少し強めに手伝う）
      const pup = rotV(pel.rotation(), { x: 0, y: 1, z: 0 }).y;
      const broke = (gu.phase === 'squat' && gu.t > 1.2 && (sim.tilt > 1.35 || pup < 0.35)) || (gu.phase === 'rise' && gu.t > 0.3 && (sim.tilt > 1.0 || pup < 0.5));
      if (broke || sim.stateT > 12) { const bo = Math.min(3, B + 0.3); setState('fallen'); sim.gu = { boost: bo }; if (sim.onFall) sim.onFall(); }
    }

    for (const j of jointList) j.j.configureMotorPosition(j.target, j.kp * j.gain, j.kd * Math.max(j.gain, 0.08));
  }

  sim.step = () => {
    control();
    for (const b of sim.balls) b.pv = b.body.linvel();
    world.step(events);
    if (sim.stun > 0) sim.stun = Math.max(0, sim.stun - DT);
    sim.stateT += DT; sim.time += DT;
    sim.hits.length = 0;
    events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const b1 = sim.balls.find(b => b.collider.handle === h1 || b.collider.handle === h2);
      const p = colliderPart.get(h1) || colliderPart.get(h2);
      if (b1 && p) {
        sim.hits.push({ ball: b1, part: p });
        // 当たった瞬間は力を抜いて、ボールの勢いに体が持っていかれるようにする
        const v = p.body.linvel(), pv = b1.pv || v;
        const J = Math.hypot(pv.x - v.x, pv.y - v.y, pv.z - v.z) * b1.mass; // ぶつかった勢い（運動量）
        const k = clamp(J / 40, 0, 1);
        // とても強い一撃は、踏ん張らずにそのまま吹っ飛ぶ
        if (J > KNOCKOUT && sim.state !== 'fallen') { setState('fallen'); sim.swing = null; if (sim.onFall) sim.onFall(); }
        if (k > 0.15 && sim.state === 'stand') {
          const s = sim.stun > 0 ? sim.stunK * sim.stun / sim.stunDur : 0;
          sim.stunK = Math.max(s, k); sim.stunDur = 0.3 + 0.3 * k; sim.stun = sim.stunDur;
        }
      }
      else if (b1) sim.hits.push({ ball: b1, part: null });
      else if (p) sim.hits.push({ ball: null, part: p }); // ロボットと地面（自分どうしは当たらない）
    });
  };

  sim.throwBall = (pos, vel, r = 0.11, mass = 1.6) => {
    const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinvel(vel.x, vel.y, vel.z).setCcdEnabled(true).setAngularDamping(0.5));
    const c = world.createCollider(R.ColliderDesc.ball(r).setMass(mass).setRestitution(0.45).setFriction(0.5)
      .setCollisionGroups(BALL).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), b);
    const ball = { body: b, collider: c, r, age: 0, mass };
    sim.balls.push(ball);
    return ball;
  };
  sim.removeBall = ball => { world.removeRigidBody(ball.body); sim.balls.splice(sim.balls.indexOf(ball), 1); };

  // 起動時に少し回して落ち着かせる
  for (let i = 0; i < 60; i++) sim.step();
  sim.time = 0;
  return sim;
}
