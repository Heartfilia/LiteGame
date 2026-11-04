const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load, rng, root } = require('./engine-loader.cjs');
const copy = x => JSON.parse(JSON.stringify(x));
const finite = x => { if (typeof x === 'number') assert.ok(Number.isFinite(x)); else if (x && typeof x === 'object') Object.values(x).forEach(finite); };

test('Every catalog HTML/JS parses and every exported game engine initializes', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/games.js'), 'utf8'), { window });
  const checked = new Set();
  for (const g of window.GAME_DATA.games) {
    const file = path.join(root, g.url.split('?')[0]), html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      const src = /src=["']([^"']+)/.exec(m[1]);
      if (src) {
        const js = path.resolve(path.dirname(file), src[1]);
        if (!checked.has(js)) { new vm.Script(fs.readFileSync(js, 'utf8'), { filename: js }); checked.add(js); }
      } else new vm.Script(m[2], { filename: file });
    }
    if (html.includes('ENGINE START')) assert.ok(Object.keys(load(g.id)).length, g.id);
  }
});

test('Sudoku generated puzzles have one solution consistent with all clues', () => {
  const E = load('sudoku');
  for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
    const p = E.makePuzzle(rng(23), difficulty);
    assert.equal(E.solveCount(p.puzzle, 2), 1);
    for (const unit of [...E.ROWS, ...E.COLS, ...E.BOXES]) assert.equal(new Set(unit.map(i => p.solution[i])).size, 9);
    assert.ok(p.puzzle.every((n, i) => !n || n === p.solution[i]));
  }
});
test('Minesweeper first reveal is safe and neighboring mine counts are exact', () => {
  const E = load('minesweeper');
  for (let seed = 1; seed <= 20; seed++) {
    const p = E.generate({ rows: 9, cols: 9, mines: 10, safe: seed, rnd: rng(seed), noGuess: false });
    assert.equal(p.mine.filter(Boolean).length, 10);
    assert.ok(!p.mine[seed]);
    assert.ok(p.nb[seed].every(i => !p.mine[i]));
    p.num.forEach((n, i) => { if (!p.mine[i]) assert.equal(n, p.nb[i].filter(j => p.mine[j]).length); });
  }
});
test('Lights and Bridges generated puzzles can be solved using their solver', () => {
  const E = load('lights');
  for (const n of E.SIZES) for (let seed = 1; seed <= 5; seed++) {
    const p = E.generate(n, rng(seed)), b = p.start.slice(), solution = E.solve(b, n);
    assert.ok(solution); solution.forEach((v, i) => { if (v) E.press(b, n, i); }); assert.equal(E.lit(b), 0);
  }
  const B = load('bridges');
  for (const n of [7, 9, 11]) {
    const p = B.generate(rng(n), n); assert.ok(p);
    const g = B.build(n, p.islands); assert.equal(B.solve(g, 2).count, 1); assert.ok(B.check(g, p.solution).solved);
  }
});
test('Nonogram clues reproduce generated solutions without guessing', () => {
  const E = load('nonogram');
  for (const n of [5, 10, 15]) {
    const p = E.generate(rng(n), n), solved = E.solve(p.rows, p.cols);
    assert.ok(solved.solved && !solved.contradiction); finite(solved);
    assert.deepEqual(copy(solved.grid), copy(p.solution));
    assert.ok(p.rows.length === n && p.cols.length === n);
  }
});
test('Sliding puzzles keep solvable parity after legal moves and restore', () => {
  const E = load('sliding');
  for (const n of E.SIZES) {
    const s = E.make(n, rng(n));
    for (let i = 0; i < 100; i++) { E.step(s, i % 4); assert.ok(E.valid(s.tiles, n)); assert.ok(E.solvable(s.tiles, n)); }
    assert.ok(E.restore(copy(s)));
  }
});
test('Way Out and Gridlock generated levels have a valid path to completion', () => {
  const W = load('wayout'), G = load('gridlock');
  for (const level of [1, 6, 15, 30]) {
    const s = W.generate(level, rng(level));
    assert.ok(W.restore(copy(s)));
    for (let i = 0; i < 1000 && !s.done; i++) { const free = W.freeArrows(s); assert.ok(free.length); W.tap(s, free[0]); }
    assert.ok(s.done);
    const g = G.generate(level, rng(level)); assert.ok(G.restore(copy(g)));
    for (let i = 0; i < 300 && !G.solved(g); i++) { const m = G.nextMove(g); assert.ok(m); G.move(g, m.v, m.to); }
    assert.ok(G.solved(g));
  }
});
test('Peg solitaire removes one peg per legal jump and undo restores the board', () => {
  const E = load('peg'), s = E.newGame(E.CENTRE);
  for (let i = 0; i < 30; i++) {
    const legal = E.legalMoves(s.board); if (!legal.length) break;
    const before = copy(s.board), count = E.pegCount(s.board), m = legal[0];
    assert.ok(E.applyMove(s, m.from, m.to)); assert.equal(E.pegCount(s.board), count - 1);
    E.undo(s); assert.deepEqual(copy(s.board), before); E.applyMove(s, m.from, m.to);
  }
});
test('Chess standard perft and Xiangqi legal moves / undo', () => {
  const C = load('chess'), s = C.parse(C.START);
  assert.equal(C.perft(s, 1), 20); assert.equal(C.perft(s, 2), 400); assert.equal(C.perft(s, 3), 8902);
  const E = load('xiangqi'), x = E.deal();
  for (let i = 0; i < 60; i++) {
    const legal = E.legal(x); if (!legal.length) break;
    const before = x.board.join(''), turn = x.turn, move = legal[i % legal.length];
    E.make(x, move); assert.ok(!E.inCheck(x, turn)); E.undo(x); assert.equal(x.board.join(''), before); E.make(x, move);
  }
});
test('Reversi and Checkers legal games respect turn, piece and board invariants', () => {
  const E = load('reversi'), s = E.newState('two');
  for (let i = 0; i < 60 && !E.isOver(s.board); i++) {
    const moves = E.legalMoves(s.board, s.turn);
    if (!moves.length) { s.turn = 3 - s.turn; continue; }
    const before = s.board.filter(Boolean).length;
    assert.ok(E.applyMove(s, moves[i % moves.length])); assert.equal(s.board.filter(Boolean).length, before + 1);
  }
  const C = load('checkers');
  for (const rules of ['classic', 'spanish', 'huevo']) {
    const x = C.newState('two', rules, false);
    for (let i = 0; i < 120 && x.winner < 0; i++) {
      const moves = C.moves(x.board, x.turn, x.rules, x.free, x); if (!moves.length) break;
      const n = x.board.filter(Boolean).length; assert.ok(C.applyMove(x, moves[i % moves.length]));
      assert.ok(x.board.filter(Boolean).length <= n); assert.equal(x.board.length, 64);
    }
  }
});
test('Mancala conserves seeds; Backgammon conserves both players’ fifteen checkers', () => {
  const E = load('mancala'), s = E.newState('two', 'easy', E.newBoard(4));
  for (let i = 0; i < 250 && !s.done; i++) { const moves = E.legalMoves(s.board, s.turn); assert.ok(moves.length); assert.ok(E.applyMove(s, moves[i % moves.length])); assert.equal(E.total(s.board), 48); }
  const B = load('backgammon'), b = B.newGame(123);
  for (let i = 0; i < 200 && !b.winner; i++) { const legal = B.legal(b); if (legal.length) assert.ok(B.play(b, legal[i % legal.length])); else assert.ok(B.endTurn(b)); assert.equal(B.count(b, 1), 15); assert.equal(B.count(b, 2), 15); }
});
test('Ludo, Snakes and Ladders, and Chain Reaction state stays within board bounds', () => {
  const L = load('ludo'), N = load('snakes'), C = load('chain'), rnd = rng(37);
  let l = L.newGame(4, 2), n = N.newGame(4, true), c = C.newGame(4, 5, 2);
  for (let i = 0; i < 1500; i++) {
    if (l.winner < 0) { const die = L.roll(rnd), moves = L.moves(l, die); l = !moves.length || (die === 6 && l.sixes === 2) ? L.pass(l) : L.play(l, moves[0], die).state; assert.ok(l.pos.flat().every(p => p >= -1 && p <= L.HOME)); }
    if (n.winner < 0) { n = N.play(n, N.roll(rnd)).state; assert.ok(n.pos.every(p => p >= 0 && p <= 100)); }
    if (!c.winner && i < 150) { const moves = C.legalMoves(c); c = C.play(c, moves[Math.floor(rnd() * moves.length)]).state; assert.equal(c.orbs.reduce((a, b) => a + b, 0), c.moves); }
  }
  assert.ok(l.winner >= 0 && n.winner >= 0);
});
test('Battleship fleets are valid and AI eventually sinks all ships without repeat shots', () => {
  const E = load('battleship');
  for (let seed = 1; seed <= 5; seed++) {
    const rnd = rng(seed), ships = E.randomFleet(rnd); assert.ok(E.validFleet(ships));
    const board = E.makeBoard(ships);
    for (let i = 0; i < 100 && !E.allSunk(board); i++) { const shot = E.aiShot(E.knowledge(board), 'medium', rnd); assert.ok(E.canFire(board, shot)); E.fire(board, shot); }
    assert.ok(E.allSunk(board));
  }
});
test('Corridor walls cannot block all paths; Linkup legal moves complete a connection', () => {
  const C = load('corridor'), c = C.newGame('none'), L = load('linkup'), l = L.newGame('s', 2), rnd = rng(29);
  for (let i = 0; i < 90 && c.winner < 0; i++) { const m = C.think(c, 'easy', rnd); assert.ok(C.legal(c, m)); assert.ok(C.play(c, m)); assert.ok(C.valid(c)); }
  for (let i = 0; i < 100 && l.winner < 0; i++) { const m = L.think(l, 'easy', rnd); assert.ok(L.play(l, m)); assert.ok(L.valid(l)); }
  assert.ok(l.winner >= 0);
});
test('Bowling perfect game = 300; darts requires a double and restores score on bust', () => {
  const B = load('bowling'); let s = B.newGame(1);
  for (let i = 0; i < 12; i++) s = B.roll(s, Array(10).fill(true)).state;
  assert.ok(s.done); assert.equal(B.score(s.frames[0])[9], 300);
  const D = load('darts'), d = D.newGame(1, 40);
  assert.ok(D.throwDart(d, D.mk(20, 2)).won);
  const bust = D.throwDart(d, D.mk(20, 3)); assert.ok(bust.bust); assert.equal(bust.state.rem[0], 40);
});
test('Hop simulation and deterministic saved state continue on the same platforms', () => {
  const E = load('hop'), s = E.newGame(rng(17));
  for (let i = 0; i < 600; i++) E.step(s, E.botSteer(s));
  const restored = E.restore(copy(E.snapshot(s)), rng(17)); assert.ok(restored);
  for (let i = 0; i < 120; i++) { const steer = E.botSteer(s); E.step(s, steer); E.step(restored, steer); }
  assert.deepEqual(copy(E.snapshot(restored)), copy(E.snapshot(s)));
});
test('Breakout and Block Drop simulation remains finite and save/restore is valid', () => {
  const B = load('breakout');
  for (let level = 0; level < B.LEVELS.length; level++) {
    const s = B.createGame(level); B.launch(s);
    for (let i = 0; i < 400; i++) B.step(s, s.ball.x);
    finite(s); assert.ok(B.restore(B.serialize(s)));
  }
  const D = load('blockdrop'), d = D.create('sprint', 59);
  for (let i = 0; i < 30 && !d.over; i++) { D.move(d, i % 2 ? 1 : -1); D.rotate(d, 1); D.hardDrop(d); }
  finite(d); assert.deepEqual(copy(D.restore(D.serialize(d))), copy(d));
});

test('Mahjong deals have a full removable solution; jigsaw pieces place exactly once', () => {
  const M = load('mahjong');
  for (const layout of Object.keys(M.LAYOUTS)) {
    const s = M.deal(layout, rng(18));
    for (const pair of s.solution) assert.ok(M.remove(s, pair[0], pair[1]));
    assert.equal(M.left(s), 0); assert.ok(s.done);
    assert.ok(M.undo(s)); assert.equal(M.left(s), 2);
  }
  const J = load('jigsaw');
  for (const n of J.COUNTS) {
    const s = J.deal(n, 12, rng(12)); assert.ok(J.restore(copy(s)));
    for (let i = 0; i < n; i++) { assert.ok(J.fitsCell(s, i, i)); assert.ok(J.place(s, i)); assert.equal(J.place(s, i), false); }
    assert.ok(s.done); assert.equal(s.placed.length, n);
  }
});
test('Pairs, Simon and Mastermind recognize correct and incorrect answers', () => {
  const P = load('pairs');
  for (const n of P.ORDER) {
    const s = P.make(n, rng(n));
    for (const symbol of new Set(s.cards)) { P.flip(s, s.cards.indexOf(symbol)); P.flip(s, s.cards.lastIndexOf(symbol)); }
    assert.ok(s.done); assert.equal(s.moves, n / 2);
  }
  const S = load('simon'), s = S.game(rng(42));
  for (let round = 1; round <= 15; round++) { for (let i = 0; i < round; i++) S.press(s, s.seq[i]); assert.equal(s.best, round); }
  assert.equal(S.press(s, (s.seq[0] + 1) % 4), 'wrong');
  const M = load('mastermind'); assert.deepEqual(copy(M.feedback([1, 1, 2, 3], [1, 2, 1, 1])), { b: 1, w: 2 });
  for (const id of M.LEVEL_IDS) { const secret = M.makeSecret(rng(45), id), state = M.newState(id, secret); M.submit(state, secret); assert.ok(state.won && M.validState(state)); }
});
test('Gomoku wins at five; Go captures and rejects suicide', () => {
  const G = load('gomoku'); let b = G.emptyBoard(9);
  for (let i = 0; i < 5; i++) { const out = G.applyMove(b, 9, 9 + i, 1); b = out.board; assert.equal(out.won, i === 4); }
  const E = load('go'), s = E.newState();
  s.board[10] = 2; s.board[1] = s.board[9] = s.board[11] = 1; s.turn = 1;
  assert.ok(E.play(s, 19)); assert.equal(s.board[10], 0); assert.equal(s.caps[1], 1);
  s.turn = 2; assert.equal(E.play(s, 10), false);
});
test('Dots scores every box once; Morris moves/undo preserve the board', () => {
  const D = load('dots'), bd = D.makeBoard(3, 3), s = { edges: Array(bd.E).fill(0), owner: Array(bd.boxes).fill(0), turn: 1, scores: [0, 0, 0], turnBoxes: 0, history: [], mode: 'two' };
  for (let e = 0; e < bd.E; e++) D.applyEdge(bd, s, e);
  assert.equal(s.scores[1] + s.scores[2], 9); assert.ok(s.owner.every(Boolean));
  const M = load('morris'), m = M.newState('two', 'easy');
  for (let i = 0; i < 100 && !m.result; i++) {
    const moves = M.movesOf(m.board, m.hand, m.turn); if (!moves.length) break;
    const move = moves[i % moves.length], before = copy(m.board);
    assert.ok(M.isLegal(m, move)); M.apply(m, move); M.takeBack(m); assert.deepEqual(copy(m.board), before); M.apply(m, move);
    assert.ok(m.board.filter(Boolean).length <= 18);
  }
});
test('Pingpong and Air Hockey physics stay finite under AI play', () => {
  for (const id of ['pingpong', 'airhockey']) {
    const E = load(id), s = E.match(), rnd = rng(59);
    E.setBot(s, 0, 'easy'); E.setBot(s, 1, 'medium');
    for (let i = 0; i < 3000 && s.winner < 0; i++) E.step(s, null, rnd);
    finite(s); assert.ok(s.score.every(n => n >= 0));
    if (s.winner < 0) assert.ok(E.restore(copy(E.snapshot(s))));
  }
});
test('Eightball and Snooker preserve unique ball IDs through a break shot', () => {
  for (const id of ['eightball', 'snooker']) {
    const E = load(id), s = E.newFrame({ rnd: rng(38), reds: 6 });
    const out = E.shoot(s, { angle: E.aimDefault(s), power: 0.8 });
    finite(out.F); assert.equal(out.F.shots, 1);
    assert.equal(new Set(out.F.balls.map(b => b.id)).size, s.balls.length);
  }
});
test('Tower Defence, Tanks and Gorillas simulations terminate with valid state', () => {
  const T = load('tower-defence'), rnd = rng(19), route = T.genPath(rnd);
  assert.ok(!T.validatePath(route));
  const s = T.createGame({ path: route }); T.startWave(s, rnd);
  for (let i = 0; i < 3000 && s.waveActive && !s.over; i++) T.step(s, 0.05, rnd);
  finite(s); assert.ok(!s.waveActive || s.over);
  const K = load('tanks'), k = K.match(rnd);
  for (let i = 0; i < 8; i++) { assert.ok(K.fire(k, k.turn, 'shell', 45, 60, null, rnd)); assert.ok(K.validMatch(k)); }
  finite(k);
  const G = load('gorillas'), g = G.match(rnd);
  const shot = G.shoot(g.city, g.turn, 45, 60); finite(shot); G.record(g, g.turn, shot, 45, 60); assert.ok(G.validMatch(g));
});
