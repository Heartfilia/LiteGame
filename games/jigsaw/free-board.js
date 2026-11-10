(function () {
  'use strict';
  window.JigsawFreeBoard = function (options) {
    var F = window.JigsawFree, canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    canvas.className = 'jg-free-canvas'; canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '自由拼图工作区：拖动拼块或空白处，使用缩放按钮；选中组合后方向键微调，回车吸附');
    var state, pieces = [], paths = [], cols = 20, count = 400, cw = 48, ch = 64, margin = 22;
    var width = 0, height = 0, selected = null, drag = null, enabled = false;
    function world(x, y) {
      var v = state.view;
      return { x: (x - width / 2) / v.zoom + v.x, y: (y - height / 2) / v.zoom + v.y };
    }
    function local(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function draw() {
      if (!state || !enabled) return;
      var d = Math.min(2, devicePixelRatio || 1), v = state.view;
      ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, width, height);
      ctx.translate(width / 2, height / 2); ctx.scale(v.zoom, v.zoom); ctx.translate(-v.x, -v.y);
      state.groups.forEach(function (g) {
        g.pieces.forEach(function (i) {
          var x = (g.x + i % cols) * cw, y = (g.y + Math.floor(i / cols)) * ch;
          var sx = (x - v.x) * v.zoom + width / 2, sy = (y - v.y) * v.zoom + height / 2;
          if (sx < -(cw + margin) * v.zoom || sy < -(ch + margin) * v.zoom || sx > width + margin * v.zoom || sy > height + margin * v.zoom) return;
          ctx.drawImage(pieces[i], x - margin, y - margin, cw + 2 * margin, ch + 2 * margin);
          if (g === selected) {
            ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 1.5 / v.zoom; ctx.stroke(paths[i]); ctx.restore();
          }
        });
      });
      ctx.setTransform(d, 0, 0, d, 0, 0);
      options.onView(Math.round(v.zoom * 100));
    }
    function hit(p) {
      // Canvas path hit testing ignores transparent corners and gaps in assemblies.
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      var found = null;
      for (var k = state.groups.length - 1; k >= 0 && !found; k--) {
        var g = state.groups[k];
        for (var i of g.pieces) {
          if (ctx.isPointInPath(paths[i], p.x - (g.x + i % cols) * cw, p.y - (g.y + Math.floor(i / cols)) * ch)) { found = g; break; }
        }
      }
      ctx.restore(); return found;
    }
    function bringFront(g) { state.groups.splice(state.groups.indexOf(g), 1); state.groups.push(g); }
    function cancel() {
      if (!drag) return;
      var old = drag; drag = null;
      if (old.group) F.move(old.group, old.x, old.y);
      else { state.view.x = old.x; state.view.y = old.y; }
      if (canvas.hasPointerCapture(old.id)) canvas.releasePointerCapture(old.id);
      draw();
    }
    canvas.addEventListener('pointerdown', function (e) {
      if (!enabled || drag || e.button !== 0 || document.querySelector('.ch-scrim')) return;
      e.preventDefault(); canvas.focus({ preventScroll: true });
      var p = local(e), w = world(p.x, p.y);
      if (options.placeSelected(e.clientX, e.clientY)) return;
      selected = hit(w);
      if (selected) bringFront(selected);
      drag = { id: e.pointerId, group: selected, px: p.x, py: p.y, x: selected ? selected.x : state.view.x, y: selected ? selected.y : state.view.y };
      canvas.setPointerCapture(e.pointerId); draw();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      e.preventDefault(); var p = local(e), dx = (p.x - drag.px) / state.view.zoom, dy = (p.y - drag.py) / state.view.zoom;
      if (drag.group) F.move(drag.group, drag.x + dx / cw, drag.y + dy / ch);
      else { state.view.x = drag.x - dx; state.view.y = drag.y - dy; }
      draw();
    });
    canvas.addEventListener('pointerup', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var g = drag.group; drag = null; canvas.releasePointerCapture(e.pointerId);
      var merged = g ? F.join(state, g) : 0;
      draw(); options.onChange(merged);
    });
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('lostpointercapture', cancel);
    window.addEventListener('blur', cancel);
    function zoom(factor, point) {
      if (!enabled || drag) return;
      var p = point || { x: width / 2, y: height / 2 }, before = world(p.x, p.y);
      state.view.zoom = Math.max(0.1, Math.min(3, state.view.zoom * factor));
      var after = world(p.x, p.y);
      state.view.x += before.x - after.x; state.view.y += before.y - after.y;
      draw(); options.onChange(0);
    }
    canvas.addEventListener('wheel', function (e) {
      if (!enabled) return;
      e.preventDefault(); zoom(Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.003), local(e));
    }, { passive: false });
    canvas.addEventListener('keydown', function (e) {
      if (!enabled || document.querySelector('.ch-scrim') || e.ctrlKey || e.metaKey || e.altKey) return;
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (e.key === 'Escape') { cancel(); selected = null; draw(); }
      else if (e.key === '+' || e.key === '=') zoom(1.25);
      else if (e.key === '-') zoom(0.8);
      else if (selected && e.key === 'Enter') { options.onChange(F.join(state, selected)); draw(); }
      else if (d && !drag) {
        var step = e.shiftKey ? 0.5 : 0.05;
        if (selected) F.move(selected, selected.x + d[0] * step, selected.y + d[1] * step);
        else { state.view.x += d[0] * 40; state.view.y += d[1] * 40; }
        draw(); options.onChange(0);
      } else return;
      e.preventDefault(); e.stopPropagation();
    });
    return {
      canvas: canvas, draw: draw, cancel: cancel, zoom: zoom,
      active: function () { return !!drag; },
      setEnabled: function (value) { cancel(); enabled = value; },
      setup: function (next, layout, makePiece, outline) {
        cancel(); state = next; selected = null; enabled = true;
        cw = layout.cw; ch = layout.ch; margin = layout.m;
        cols = layout.cols; count = cols * layout.rows;
        pieces = []; paths = [];
        for (var i = 0; i < count; i++) {
          pieces.push(makePiece(i, 1));
          var p = new Path2D();
          outline(i).forEach(function (c) {
            if (c[0] === 'M') p.moveTo(c[1], c[2]);
            else if (c[0] === 'L') p.lineTo(c[1], c[2]);
            else p.bezierCurveTo.apply(p, c.slice(1));
          });
          p.closePath(); paths.push(p);
        }
      },
      resize: function (w, h) {
        cancel(); width = w; height = h;
        var d = Math.min(2, devicePixelRatio || 1);
        canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; draw();
      },
      drop: function (piece, clientX, clientY) {
        var r = canvas.getBoundingClientRect();
        if (clientX < r.left || clientY < r.top || clientX > r.right || clientY > r.bottom) return false;
        var p = world(clientX - r.left, clientY - r.top);
        selected = F.add(state, piece, p.x / cw - 0.5, p.y / ch - 0.5);
        if (!selected) return false;
        var merged = F.join(state, selected); draw(); return { merged: merged };
      },
      fit: function () {
        if (!enabled || drag) return;
        var xs = [], ys = [];
        state.groups.forEach(function (g) { g.pieces.forEach(function (i) { xs.push((g.x + i % cols) * cw); ys.push((g.y + Math.floor(i / cols)) * ch); }); });
        if (!xs.length) { state.view.x = 0; state.view.y = 0; state.view.zoom = 1; }
        else {
          var left = Math.min.apply(null, xs) - margin, right = Math.max.apply(null, xs) + cw + margin;
          var top = Math.min.apply(null, ys) - margin, bottom = Math.max.apply(null, ys) + ch + margin;
          state.view.x = (left + right) / 2; state.view.y = (top + bottom) / 2;
          state.view.zoom = Math.max(0.1, Math.min(1, (width - 32) / (right - left), (height - 32) / (bottom - top)));
        }
        draw(); options.onChange(0);
      }
    };
  };
})();
