const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, rng } = require('./engine-loader.cjs');
const copy = value => JSON.parse(JSON.stringify(value));
function deck(cards, size = 52) {
  assert.equal(cards.length, size, 'card count');
  assert.equal(new Set(cards).size, size, 'unique cards');
  assert.ok(cards.every(c => Number.isInteger(c) && c >= 0 && c < size));
}

test('Spider: legal moves/deals conserve all 104 cards and undo restores exact piles', () => {
  const E = load('spider');
  for (const suits of [1, 2, 4]) for (let seed = 1; seed <= 12; seed++) {
    const s = E.deal(rng(seed), suits);
    for (let i = 0; i < 80; i++) {
      deck([...s.tab.flat(), ...s.stock, ...s.found.flat()], 104);
      assert.ok(E.validState(s));
      const before = copy({ tab: s.tab, stock: s.stock, found: s.found, down: s.down });
      const hint = E.hint(s);
      if (!hint) break;
      const apply = () => hint.deal ? E.dealRow(s) : E.move(s, hint.src, hint.dst);
      assert.ok(apply());
      assert.ok(E.undo(s));
      assert.deepEqual(copy({ tab: s.tab, stock: s.stock, found: s.found, down: s.down }), before);
      apply();
    }
  }
});

test('Klondike: stock cycling and undo conserve the complete deck for draw-one/draw-three', () => {
  const E = load('klondike');
  for (const draw of [1, 3]) for (let seed = 1; seed <= 15; seed++) {
    const s = E.deal(rng(seed), draw);
    for (let step = 0; step < 40; step++) {
      const before = copy({ tab: s.tab, down: s.down, stock: s.stock, waste: s.waste, found: s.found });
      E.drawStock(s);
      assert.ok(E.validState(s));
      assert.ok(E.undo(s));
      assert.deepEqual(copy({ tab: s.tab, down: s.down, stock: s.stock, waste: s.waste, found: s.found }), before);
      E.drawStock(s);
      const homes = s.found.flatMap((n, suit) => Array.from({ length: n }, (_, r) => r * 4 + suit));
      deck([...s.tab.flat(), ...s.stock, ...s.waste, ...homes]);
    }
  }
});

test('Freecell: legal move/undo and automatic foundations preserve cards', () => {
  const E = load('freecell');
  for (let seed = 1; seed <= 20; seed++) {
    const s = E.newGame(seed);
    for (let step = 0; step < 35; step++) {
      assert.ok(E.validState(s));
      const moves = [];
      for (let from = 0; from < 12; from++) for (let to = 0; to < 16; to++) if (E.canMove(s, from, 1, to)) moves.push([from, to]);
      if (!moves.length) break;
      const [from, to] = moves[(seed + step) % moves.length];
      const before = copy({ cols: s.cols, cells: s.cells, found: s.found });
      assert.ok(E.move(s, from, 1, to)); E.autoAll(s);
      assert.ok(E.undo(s));
      assert.deepEqual(copy({ cols: s.cols, cells: s.cells, found: s.found }), before);
      E.move(s, from, 1, to); E.autoAll(s);
      deck([...s.cols.flat(), ...s.cells.filter(c => c >= 0), ...s.found.flatMap((n, suit) => Array.from({ length: n }, (_, r) => r * 4 + suit))]);
    }
  }
});

test('Blackjack: soft aces, natural blackjack, dealer settlement and card conservation', () => {
  const E = load('blackjack');
  assert.equal(E.total([0, 1, 36]).value, 12); // A A 10
  assert.equal(E.isBlackjack([0, 48]), true);
  for (let seed = 1; seed <= 200; seed++) {
    const s = E.deal(rng(seed));
    while (!s.done && E.total(s.player).value < 17) E.hit(s);
    if (!s.done) E.stand(s);
    assert.ok(s.done);
    assert.ok(['win', 'blackjack', 'lose', 'bust', 'push'].includes(s.result));
    deck([...s.player, ...s.dealer, ...s.deck]);
  }
});

test('Crazy Eights: complete bot rounds, penalties, recycling and card conservation', () => {
  const E = load('crazyeights');
  for (const rules of ['classic', 'iran']) for (let seed = 1; seed <= 30; seed++) {
    const rnd = rng(seed), s = E.newRound(rnd, 2 + seed % 3, 0, rules);
    for (let step = 0; step < 2000 && s.winner < 0; step++) {
      deck([...s.hands.flat(), ...s.stock, ...s.discard]);
      assert.ok(E.validRound(s));
      const m = E.botMove(s, 'medium', rnd);
      if (m.take) E.takePenalty(s, rnd);
      else if (m.play !== undefined) assert.ok(E.play(s, m.play, m.suit));
      else if (m.draw && E.draw(s, rnd) >= 0) continue;
      else assert.ok(E.pass(s));
    }
    assert.ok(s.winner >= 0, `seed ${seed} ${rules}: round stalled`);
  }
});

test('Gin Rummy: bot decisions are legal and complete hands without losing cards', () => {
  const E = load('ginrummy');
  for (let seed = 1; seed <= 30; seed++) {
    const rnd = rng(seed), s = E.newHand(rnd, seed % 2);
    for (let step = 0; step < 400 && s.phase !== 'over'; step++) {
      deck([...s.hands.flat(), ...s.stock, ...s.discard]);
      assert.ok(E.validHand(s));
      if (s.phase === 'draw') assert.ok(E.draw(s, E.botDraw(s, 'medium')) >= 0);
      else { const m = E.botDiscard(s, 'medium', rnd); assert.ok(E.discard(s, m.c, m.knock)); }
    }
    assert.equal(s.phase, 'over');
    assert.ok(s.result.points >= 0);
  }
});

test('Hokm: trump dealing, follow-suit legality and complete matches', () => {
  const E = load('hokm');
  for (let seed = 1; seed <= 20; seed++) {
    const rnd = rng(seed), s = E.newMatch(rnd, 3);
    for (let step = 0; step < 1000 && !s.done; step++) {
      deck([...s.hands.flat(), ...s.rest, ...s.played]);
      if (s.phase === 'trump') assert.ok(E.chooseTrump(s, E.aiTrump(s.hands[s.hakem], 'medium', rnd)));
      else if (s.phase === 'handover') E.newHand(s, rnd);
      else { const c = E.aiPlay(s, s.turn, 'medium', rnd); assert.ok(E.legal(s, s.turn).includes(c)); assert.ok(E.play(s, s.turn, c)); }
    }
    assert.ok(s.done);
    assert.ok(Math.max(...s.score) >= 3);
  }
});

test('Shelem: full hand has 165 points and preserves 52 cards through bidding/burying', () => {
  const E = load('shelem');
  for (let seed = 1; seed <= 25; seed++) {
    const rnd = rng(seed), s = E.newMatch(rnd, 505);
    assert.ok(E.bid(s, s.turn, 165));
    assert.ok(E.bury(s, s.hands[s.declarer].slice(0, 4)));
    assert.ok(E.chooseTrump(s, seed % 4));
    while (s.phase === 'play') {
      deck([...s.hands.flat(), ...s.buried, ...s.played]);
      const c = E.aiPlay(s, s.turn, 'medium', rnd);
      assert.ok(E.legal(s, s.turn).includes(c)); assert.ok(E.play(s, s.turn, c));
    }
    assert.equal(s.taken[0] + s.taken[1], 165);
    assert.equal(s.played.length, 48);
  }
});

test('Pasur: captures/undo conserve all cards and every full deal ends', () => {
  const E = load('pasur');
  for (let seed = 1; seed <= 30; seed++) {
    const rnd = rng(seed), s = E.newDeal(rnd, seed % 2);
    for (let step = 0; step < 60 && !s.done; step++) {
      deck([...s.hands.flat(), ...s.deck, ...s.table, ...s.caps.flat()]);
      const m = E.aiMove(s, 'medium', rnd), before = copy(s);
      assert.ok(E.play(s, m.card, m.set)); assert.ok(E.undo(s));
      assert.deepEqual(copy(s), before);
      E.play(s, m.card, m.set);
    }
    assert.ok(s.done);
    deck([...s.hands.flat(), ...s.deck, ...s.table, ...s.caps.flat()]);
  }
});
