(function () {
  "use strict";

  var canvas = document.getElementById("hero-shape");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var PHI = (1 + Math.sqrt(5)) / 2;

  /* Edges are derived from vertex distance rather than hand-listed, so the
     topology can't drift out of sync with the coordinates. */
  function edgesOf(points, edgeLength) {
    var out = [];
    for (var i = 0; i < points.length; i++) {
      for (var j = i + 1; j < points.length; j++) {
        var d = Math.hypot(
          points[i][0] - points[j][0],
          points[i][1] - points[j][1],
          points[i][2] - points[j][2]
        );
        if (Math.abs(d - edgeLength) < 0.001) out.push([i, j]);
      }
    }
    return out;
  }

  function normalise(points) {
    var r = Math.hypot(points[0][0], points[0][1], points[0][2]);
    return points.map(function (p) { return [p[0] / r, p[1] / r, p[2] / r]; });
  }

  // Icosahedron — 12 vertices, 30 edges
  var icoRaw = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
  ];
  var icoEdges = edgesOf(icoRaw, 2);
  var ico = normalise(icoRaw);

  // Octahedron — 6 vertices, 12 edges, counter-rotating inside
  var octRaw = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
  var octEdges = edgesOf(octRaw, Math.SQRT2);
  var oct = normalise(octRaw);

  var DEPTH = 2.6; // perspective distance; smaller = more dramatic foreshortening

  function project(p, rx, ry, radius, cx, cy) {
    var cosY = Math.cos(ry), sinY = Math.sin(ry);
    var x = p[0] * cosY - p[2] * sinY;
    var z = p[0] * sinY + p[2] * cosY;

    var cosX = Math.cos(rx), sinX = Math.sin(rx);
    var y2 = p[1] * cosX - z * sinX;
    var z2 = p[1] * sinX + z * cosX;

    var s = DEPTH / (DEPTH + z2);
    return { x: cx + x * radius * s, y: cy + y2 * radius * s, s: s };
  }

  var width = 0, height = 0, dpr = 1;

  function resize() {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawShape(points, edges, rx, ry, radius, cx, cy, colour, lineAlpha, dotScale) {
    var projected = points.map(function (p) { return project(p, rx, ry, radius, cx, cy); });

    // Edges, painted back-to-front so nearer lines sit on top
    edges
      .map(function (e) {
        return { e: e, depth: (projected[e[0]].s + projected[e[1]].s) / 2 };
      })
      .sort(function (a, b) { return a.depth - b.depth; })
      .forEach(function (item) {
        var a = projected[item.e[0]], b = projected[item.e[1]];
        ctx.globalAlpha = Math.max(0, Math.min(1, (item.depth - 0.55) * lineAlpha));
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });

    // Vertices
    projected.forEach(function (p) {
      var r = Math.max(0.6, (p.s - 0.5) * dotScale);
      ctx.globalAlpha = Math.max(0, Math.min(1, (p.s - 0.55) * 1.8));
      ctx.fillStyle = "#EAF1FF";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
  }

  function render(t) {
    if (!width) return;
    ctx.clearRect(0, 0, width, height);

    var cx = width / 2, cy = height / 2;
    var base = Math.min(width, height) / 2;

    // Concentric rings behind the solid
    ctx.strokeStyle = "#38D9F0";
    [0.98, 0.84, 0.66].forEach(function (f, i) {
      ctx.globalAlpha = 0.05 + i * 0.02;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, base * f, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    var ry = t * 0.00028;
    var rx = Math.sin(t * 0.00016) * 0.42;

    drawShape(oct, octEdges, -rx * 1.4, -ry * 1.9, base * 0.26, cx, cy, "#4A8CFF", 1.5, 3.4);
    drawShape(ico, icoEdges, rx, ry, base * 0.62, cx, cy, "#38D9F0", 2.1, 5.2);

    // Core
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#EAF1FF";
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  var running = false;
  var rafId = null;

  function loop(ts) {
    render(ts);
    rafId = window.requestAnimationFrame(loop);
  }

  function start() {
    if (running || prefersReduced) return;
    running = true;
    rafId = window.requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  resize();
  render(0);

  if (prefersReduced) return; // a single static frame is enough

  /* Only animate while the hero is actually on screen — scrolling past it
     shouldn't leave a render loop burning in the background. */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) start(); else stop();
      });
    }, { threshold: 0.05 }).observe(canvas);
  } else {
    start();
  }

  window.addEventListener("resize", function () {
    resize();
    if (!running) render(0);
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });
})();
