(function () {
  "use strict";

  var canvas = document.getElementById("hero-shape");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* A rippling surface rather than a solid: a grid of points lifted by
     travelling waves, drawn as a wireframe. Rows and columns are stroked as
     whole polylines instead of per-segment, which keeps this to ~30 stroke
     calls a frame regardless of resolution. */
  var COLS = 15;
  var ROWS = 15;
  var TILT = 1.02;   // radians, looking down at the surface
  var DEPTH = 3.2;   // perspective distance

  function waveHeight(x, z, t) {
    return (
      0.20 * Math.sin(x * 2.3 + t) +
      0.14 * Math.cos(z * 2.0 - t * 0.75) +
      0.09 * Math.sin((x + z) * 3.0 + t * 1.25)
    );
  }

  function project(x, y, z, yaw, radius, cx, cy) {
    var cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    var rx = x * cosY - z * sinY;
    var rz = x * sinY + z * cosY;

    var cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    var ry = y * cosT - rz * sinT;
    var rzz = y * sinT + rz * cosT;

    var s = DEPTH / (DEPTH + rzz);
    return { x: cx + rx * radius * s, y: cy + ry * radius * s, s: s };
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

  function render(ms) {
    if (!width) return;
    var t = ms * 0.0009;
    var yaw = ms * 0.00009;

    ctx.clearRect(0, 0, width, height);

    var cx = width / 2;
    var cy = height / 2 + Math.min(width, height) * 0.04;
    var radius = Math.min(width, height) * 0.52;

    // Build the lifted grid once per frame
    var grid = [];
    for (var i = 0; i < ROWS; i++) {
      var row = [];
      var z = (i / (ROWS - 1)) * 2 - 1;
      for (var j = 0; j < COLS; j++) {
        var x = (j / (COLS - 1)) * 2 - 1;
        var y = waveHeight(x, z, t);
        row.push(project(x, y, z, yaw, radius, cx, cy));
      }
      grid.push(row);
    }

    ctx.lineWidth = 1;

    function strokeLine(points) {
      var depth = 0;
      ctx.beginPath();
      for (var k = 0; k < points.length; k++) {
        depth += points[k].s;
        if (k === 0) ctx.moveTo(points[k].x, points[k].y);
        else ctx.lineTo(points[k].x, points[k].y);
      }
      depth /= points.length;
      ctx.globalAlpha = Math.max(0, Math.min(0.55, (depth - 0.6) * 1.5));
      ctx.strokeStyle = "#38D9F0";
      ctx.stroke();
    }

    for (var r = 0; r < ROWS; r++) strokeLine(grid[r]);

    for (var c = 0; c < COLS; c++) {
      var column = [];
      for (var rr = 0; rr < ROWS; rr++) column.push(grid[rr][c]);
      strokeLine(column);
    }

    // Nodes on every other intersection, brighter where the surface peaks
    ctx.fillStyle = "#EAF1FF";
    for (var a = 0; a < ROWS; a += 2) {
      for (var b = 0; b < COLS; b += 2) {
        var p = grid[a][b];
        ctx.globalAlpha = Math.max(0, Math.min(0.95, (p.s - 0.62) * 2.2));
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.7, (p.s - 0.55) * 3.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

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

  if (prefersReduced) return;

  /* Only animate while the hero is on screen — scrolling past shouldn't
     leave a render loop burning in the background. */
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
