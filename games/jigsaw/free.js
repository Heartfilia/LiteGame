(function (root) {
  'use strict';
  // Coordinates are measured in piece widths/heights. A group's origin is the
  // hypothetical top-left of the complete image, so joins never accumulate drift.
  var COLS = 20, COUNT = 400, SNAP = 0.24;
  function columns(state) { return state.cols === undefined ? COLS : state.cols; }
  function adjacent(a, b, cols) {
    cols = cols === undefined ? COLS : cols;
    return Math.abs(a % cols - b % cols) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1;
  }
  function groupOf(state, piece) {
    return state.groups.find(function (g) { return g.pieces.indexOf(piece) >= 0; });
  }
  function add(state, piece, x, y) {
    var cols = columns(state);
    if (!Number.isInteger(piece) || piece < 0 || piece >= cols * cols || groupOf(state, piece) || !validCoord(x) || !validCoord(y)) return null;
    var g = { pieces: [piece], x: x - piece % cols, y: y - Math.floor(piece / cols) };
    state.groups.push(g);
    return g;
  }
  function move(g, x, y) {
    if (!g || !validCoord(x) || !validCoord(y)) return false;
    g.x = x; g.y = y;
    return true;
  }
  function join(state, moving) {
    if (state.groups.indexOf(moving) < 0) return 0;
    var merged = 0, found;
    do {
      found = null;
      var distance = Infinity;
      state.groups.forEach(function (other) {
        if (other === moving) return;
        var dx = other.x - moving.x, dy = other.y - moving.y;
        if (Math.abs(dx) > SNAP || Math.abs(dy) > SNAP || dx * dx + dy * dy >= distance) return;
        if (!moving.pieces.some(function (a) { return other.pieces.some(function (b) { return adjacent(a, b, columns(state)); }); })) return;
        found = other; distance = dx * dx + dy * dy;
      });
      if (found) {
        moving.x = found.x; moving.y = found.y;
        moving.pieces = moving.pieces.concat(found.pieces);
        state.groups.splice(state.groups.indexOf(found), 1);
        merged++;
      }
    } while (found);
    return merged;
  }
  function complete(state) { return state.groups.length === 1 && state.groups[0].pieces.length === columns(state) * columns(state); }
  function validCoord(n) { return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000000; }
  function restore(raw, placed, expectedCols) {
    if (!raw) return null;
    var cols = columns(raw), count = cols * cols;
    if ((cols !== 10 && cols !== 20) || (expectedCols !== undefined && cols !== expectedCols)) return null;
    if (raw.version !== 1 || !Array.isArray(raw.groups) || raw.groups.length > count || !Array.isArray(placed)) return null;
    var seen = new Set(), groups = [];
    for (var g of raw.groups) {
      if (!g || !validCoord(g.x) || !validCoord(g.y) || !Array.isArray(g.pieces) || !g.pieces.length || g.pieces.length > count) return null;
      for (var p of g.pieces) {
        if (!Number.isInteger(p) || p < 0 || p >= count || seen.has(p)) return null;
        seen.add(p);
      }
      // Every saved assembly must be connected through genuine image neighbours.
      var pending = new Set(g.pieces), stack = [g.pieces[0]];
      pending.delete(stack[0]);
      while (stack.length) {
        var a = stack.pop();
        for (var b of pending) if (adjacent(a, b, cols)) { pending.delete(b); stack.push(b); }
      }
      if (pending.size) return null;
      groups.push({ pieces: g.pieces.slice(), x: g.x, y: g.y });
    }
    if (seen.size !== placed.length || placed.some(function (p) { return !seen.has(p); })) return null;
    var view = raw.view;
    if (!view || !validCoord(view.x) || !validCoord(view.y) || !Number.isFinite(view.zoom) || view.zoom < 0.1 || view.zoom > 3) return null;
    return { version: 1, cols: cols, groups: groups, view: { x: view.x, y: view.y, zoom: view.zoom } };
  }
  var api = { COLS: COLS, COUNT: COUNT, SNAP: SNAP, adjacent: adjacent, groupOf: groupOf, add: add, move: move, join: join, complete: complete, restore: restore,
    create: function (cols) { return { version: 1, cols: cols === undefined ? COLS : cols, groups: [], view: { x: 0, y: 0, zoom: 1 } }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JigsawFree = api;
})(typeof window !== 'undefined' ? window : globalThis);
