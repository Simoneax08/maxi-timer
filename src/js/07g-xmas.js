  // ---------- Weihnachts-Deko: Schneefall im Hintergrund ----------
  (function () {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("canvas"); c.className = "snow-canvas"; document.body.prepend(c);
    const ctx = c.getContext("2d"); let W = 0, H = 0, flakes = [];
    const mk = (first) => ({ x: Math.random() * W, y: first ? Math.random() * H : -10, r: 1 + Math.random() * 2.6, v: 0.4 + Math.random(), dx: Math.random() * 0.6 - 0.3, o: 0.5 + Math.random() * 0.5 });
    function size() { W = c.width = innerWidth; H = c.height = innerHeight; flakes = Array.from({ length: Math.min(120, Math.floor(W / 11)) }, () => mk(true)); }
    function frame() {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#fff";
      for (const f of flakes) {
        f.y += f.v; f.x += f.dx;
        if (f.y > H + 10 || f.x < -10 || f.x > W + 10) Object.assign(f, mk(false));
        ctx.globalAlpha = f.o; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; requestAnimationFrame(frame);
    }
    addEventListener("resize", size); size(); frame();
  })();
