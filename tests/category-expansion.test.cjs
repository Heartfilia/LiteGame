const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, rng } = require('./engine-loader.cjs');
const clone = s => JSON.parse(JSON.stringify(s));

test('Circuit ordered checkpoints prevent skipped laps and a steering driver finishes three laps', () => {
  const E = load('circuit'), skip = E.newGame();
  skip.x = 300; skip.y = 410; E.step(skip, 0.01, {}); assert.equal(skip.gate, 1);
  const s = E.newGame();
  while (!s.over) {
    const theta = Math.atan2((s.y - 240) / 170, (s.x - 300) / 210) + 0.35;
    const desired = Math.atan2(240 + 170 * Math.sin(theta) - s.y, 300 + 210 * Math.cos(theta) - s.x);
    const err = Math.atan2(Math.sin(desired - s.angle), Math.cos(desired - s.angle));
    E.step(s, 1 / 120, { left: err < -0.025, right: err > 0.025, brake: Math.abs(err) > 0.5 });
  }
  assert.ok(s.won); assert.equal(s.laps, 3); assert.equal(s.gate, 13);
  const final = clone(s); E.step(s, 1, { right: true }); assert.deepEqual(clone(s), final);
});
test('Drag race rejects pre-start shifts, rewards timing and consumes a single nitro charge', () => {
  const E = load('drag-race'), s = E.newGame();
  assert.equal(E.shift(s), false); assert.equal(E.boost(s), false);
  while (!s.over) {
    if (E.rpm(s) >= 0.86) E.shift(s);
    if (s.gear >= 3) E.boost(s);
    E.step(s, 1 / 120);
  }
  assert.ok(s.won); assert.equal(s.perfect, 4); assert.equal(s.nitro, 0); assert.equal(E.boost(s), false);
  const bad = E.newGame(); bad.countdown = 0; assert.ok(E.shift(bad)); assert.equal(bad.perfect, 0); assert.ok(bad.penalty > 0);
  while (!bad.over) E.step(bad, 1 / 120);
  assert.ok(s.time < bad.time); assert.ok(s.score > bad.score);
});
test('Stack cuts overhang, rewards three perfect drops, rejects double taps and finishes at 30', () => {
  const E = load('stack'), cut = E.newGame(); cut.x = 210;
  E.drop(cut); assert.equal(cut.layers[1].w, 200); assert.equal(cut.layers[1].x, 210);
  assert.equal(E.drop(cut), false);
  const miss = E.newGame(); miss.layers[0].w = 100; E.drop(miss); assert.ok(miss.over); assert.equal(miss.won, false);
  const s = E.newGame();
  for (let i = 0; i < 30; i++) { s.x = s.layers.at(-1).x; s.cooldown = 0; assert.ok(E.drop(s)); if (i === 2) assert.equal(s.layers.at(-1).w, 236); }
  assert.ok(s.won); assert.equal(s.layers.length, 31); assert.equal(E.drop(s), false);
});
test('Pitch grades both directions and equal notes, only scores once, and assists one round', () => {
  const E = load('pitch'), s = E.newGame(rng(32));
  assert.ok(E.newGame(() => 0).rounds.every(r => r.first >= 0 && r.second >= 0), 'pitched notes cannot use the negative rest sentinel');
  for (let i = 0; i < 12; i++) {
    if (!i) s.visual = true;
    const r = s.rounds[i]; assert.ok(E.answer(s, Math.sign(r.second - r.first)));
    const score = s.score; assert.equal(E.answer(s, 0), false); assert.equal(s.score, score);
    assert.ok(E.next(s)); if (!s.over) assert.equal(s.visual, false);
  }
  assert.ok(s.won); assert.equal(s.correct, 12); assert.equal(s.assisted, 1);
  assert.equal(E.next(s), false);
  const wrong = E.newGame(rng(32)); const direction = Math.sign(wrong.rounds[0].second - wrong.rounds[0].first);
  assert.equal(E.answer(wrong, direction === 0 ? 1 : 0), false); assert.equal(wrong.correct, 0);
});
test('Melody shuffled tiles are solvable, wrong arrangements cannot advance, and hints reduce score', () => {
  const E = load('melody');
  for (const assisted of [false, true]) {
    const s = E.newGame(rng(84));
    for (let i = 0; i < 5; i++) {
      const r = s.rounds[i];
      assert.notDeepEqual(Array.from(r.tiles), Array.from(r.target));
      for (let j = 0; j < r.tiles.length; j++) assert.ok(E.pick(s, j));
      assert.equal(E.pick(s, 0), false); assert.equal(E.check(s), false); assert.equal(E.next(s), false);
      while (E.undo(s)) {}
      s.revealed = assisted;
      for (const n of r.target) assert.ok(E.pick(s, r.tiles.indexOf(n)));
      assert.ok(E.check(s)); const score = s.score; assert.equal(E.check(s), false); assert.equal(s.score, score);
      assert.ok(E.next(s));
    }
    assert.ok(s.won); assert.equal(s.solved, 5); assert.equal(s.score, assisted ? 1500 : 2500);
  }
});
test('All five new games round-trip active progress and reject corrupt or ended saves', () => {
  for (const id of ['circuit', 'drag-race', 'stack', 'pitch', 'melody']) {
    const E = load(id), s = E.newGame(rng(45));
    for (let i = 0; i < 30; i++) E.step(s, 0.02, {});
    assert.deepEqual(clone(E.restore(clone(s))), clone(s), id);
    assert.equal(E.restore({}), null, id); assert.equal(E.restore(null), null, id);
    assert.equal(E.restore({ ...clone(s), elapsed: NaN }), null, id);
    assert.equal(E.restore({ ...clone(s), over: true }), null, id);
  }
});
