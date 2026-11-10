(function (root) {
  'use strict';
  // Coordinates are measured in piece widths/heights. A group's origin is the
  // hypothetical top-left of the complete image, so joins never accumulate drift.
  var COLS = 20, COUNT = 400, SNAP = 0.24;
  function adjacent(a, b) {
    return Math.abs(a % COLS - b % COLS) + Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)) === 1;
  }
  function groupOf(state, piece) {
    return state.groups.find(function (g) { return g.pieces.indexOf(piece) >= 0; });
  }
  function add(state, piece, x, y) {
    if (!Number.isInteger(piece) || piece < 0 || piece >= COUNT || groupOf(state, piece) || !validCoord(x) || !validCoord(y)) return null;
    var g = { pieces: [piece], x: x - piece % COLS, y: y - Math.floor(piece / COLS) };
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
        if (!moving.pieces.some(function (a) { return other.pieces.some(function (b) { return adjacent(a, b); }); })) return;
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
  function complete(state) { return state.groups.length === 1 && state.groups[0].pieces.length === COUNT; }
  function validCoord(n) { return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000000; }
  function restore(raw, placed) {
    if (!raw || raw.version !== 1 || !Array.isArray(raw.groups) || raw.groups.length > COUNT || !Array.isArray(placed)) return null;
    var seen = new Set(), groups = [];
    for (var g of raw.groups) {
      if (!g || !validCoord(g.x) || !validCoord(g.y) || !Array.isArray(g.pieces) || !g.pieces.length || g.pieces.length > COUNT) return null;
      for (var p of g.pieces) {
        if (!Number.isInteger(p) || p < 0 || p >= COUNT || seen.has(p)) return null;
        seen.add(p);
      }
      // Every saved assembly must be connected through genuine image neighbours.
      var pending = new Set(g.pieces), stack = [g.pieces[0]];
      pending.delete(stack[0]);
      while (stack.length) {
        var a = stack.pop();
        for (var b of pending) if (adjacent(a, b)) { pending.delete(b); stack.push(b); }
      }
      if (pending.size) return null;
      groups.push({ pieces: g.pieces.slice(), x: g.x, y: g.y });
    }
    if (seen.size !== placed.length || placed.some(function (p) { return !seen.has(p); })) return null;
    var view = raw.view;
    if (!view || !validCoord(view.x) || !validCoord(view.y) || !Number.isFinite(view.zoom) || view.zoom < 0.1 || view.zoom > 3) return null;
    return { version: 1, groups: groups, view: { x: view.x, y: view.y, zoom: view.zoom } };
  }
  var api = { COLS: COLS, COUNT: COUNT, SNAP: SNAP, adjacent: adjacent, groupOf: groupOf, add: add, move: move, join: join, complete: complete, restore: restore,
    create: function () { return { version: 1, groups: [], view: { x: 0, y: 0, zoom: 1 } }; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JigsawFree = api;
})(typeof window !== 'undefined' ? window : globalThis);
