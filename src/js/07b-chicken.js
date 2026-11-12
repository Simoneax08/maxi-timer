  // ---------- Chicken Road: Huhn überquert Spur für Spur die Straße ----------
  // Jeder Schritt kann mit einem Auto enden. Je weiter, desto riskanter. Jederzeit kassieren.
  const CR_SURVIVE = (k) => Math.max(0.45, 0.85 - 0.05 * (k - 1)); // Überlebenschance bei Schritt k (ab 1)
  const CR_LANE = 60, CR_BASE_Y = 260, CR_CHICK_X = 170, CR_W = 340, CR_H = 300;
  const CR_COLORS = ["#ef4444", "#3b82f6", "#eab308", "#a855f7", "#f97316", "#e5e7eb"];
  let crBet = 0, crStep = 0, crMult = 1, crLive = false, crBusy = false;
  let crAnimK = 0, crAnimFrom = 0, crAnimTo = 0, crAnimT0 = 0, crAnimDur = 380;
  let crLanes = [], crDeadLane = -1;
  function crMultAt(k) {
    if (k < 1) return 1;
    let p = 1; for (let j = 1; j <= k; j++) p *= CR_SURVIVE(j);
    return Math.round((0.90 / p) * 100) / 100; // 10 % Hausvorteil
  }
  function crRender() {
    const risk = Math.round((1 - CR_SURVIVE(crStep + 1)) * 100);
    const cash = Math.floor(crBet * crMult * coinMult());
    $("crInfo").textContent = `Schritt ${crStep} · x${crMult.toFixed(2)} · nächster Schritt: ${risk} % Risiko`;
    $("crCashBtn").textContent = crStep >= 1 ? `💰 Kassieren (${fmt(cash)} Coins · x${crMult.toFixed(2)})` : "💰 Kassieren";
    $("crCashBtn").disabled = crStep < 1;
  }
  function crEndUI() {
    $("crStartBox").classList.remove("hidden");
    $("crBtns").classList.add("hidden");
  }
  function crLaneCars(j) {
    if (!crLanes[j]) {
      const n = 1 + Math.floor(Math.random() * 2), arr = [];
      for (let i = 0; i < n; i++) arr.push({ x0: Math.random() * CR_W, dir: Math.random() < 0.5 ? 1 : -1, v: 40 + Math.random() * 90, color: CR_COLORS[Math.floor(Math.random() * CR_COLORS.length)] });
      crLanes[j] = arr;
    }
    return crLanes[j];
  }
  function crAnimValue(now) {
    if (crAnimFrom !== crAnimTo) {
      const t = Math.min(1, (now - crAnimT0) / crAnimDur);
      crAnimK = crAnimFrom + (crAnimTo - crAnimFrom) * (t * t * (3 - 2 * t)); // weicher Schritt
    } else crAnimK = crAnimTo;
    return crAnimK;
  }
  function crDraw(now) {
    const cv = $("crCanvas"); if (!cv) return;
    const ctx = cv.getContext("2d");
    const k = crAnimValue(now);
    ctx.clearRect(0, 0, CR_W, CR_H);
    // Bildschirm-Höhe einer Welt-Höhe: das Huhn bleibt immer auf derselben Bildhöhe, die Straße scrollt
    const sy = (h) => CR_BASE_Y - (h - k * CR_LANE);
    const first = Math.max(0, Math.floor(k) - 1), last = Math.floor(k) + 6;
    for (let j = first; j <= last; j++) {
      const top = sy((j + 1) * CR_LANE), bot = sy(j * CR_LANE);
      if (j === 0) { ctx.fillStyle = "#15803d"; ctx.fillRect(0, top, CR_W, bot - top); continue; }
      ctx.fillStyle = "#374151"; ctx.fillRect(0, top, CR_W, bot - top);
      ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2; ctx.setLineDash([12, 10]);
      ctx.beginPath(); ctx.moveTo(0, bot); ctx.lineTo(CR_W, bot); ctx.stroke(); ctx.setLineDash([]);
      for (const c of crLaneCars(j)) {
        const span = CR_W + 60;
        const x = (((c.x0 + c.dir * c.v * (now / 1000)) % span) + span) % span - 30;
        const cy = (top + bot) / 2;
        ctx.fillStyle = c.color; ctx.fillRect(x, cy - 12, 44, 24);
        ctx.fillStyle = "rgba(15,23,42,.6)"; ctx.fillRect(x + (c.dir > 0 ? 30 : 6), cy - 8, 8, 16);
      }
      if (j <= crStep) {
        ctx.fillStyle = "#fde68a"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "top";
        ctx.fillText(`x${crMultAt(j).toFixed(2)}`, 6, top + 4);
      }
    }
    // Huhn (oder Explosion, wenn es überfahren wurde)
    const dead = crDeadLane >= 0 && k === crAnimTo;
    ctx.font = dead ? "52px system-ui" : "36px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(dead ? "💥" : "🐔", CR_CHICK_X, CR_BASE_Y - CR_LANE / 2);
  }
  function crLoop() {
    if (!$("game-chicken").classList.contains("hidden")) crDraw(performance.now());
    requestAnimationFrame(crLoop);
  }
  function crStart() {
    if (crLive || crBusy) return;
    const bet = Math.floor(Number($("crBet").value) || 0);
    if (bet < 1) { toast("Mindestens 1 Coin."); return; }
    if (bet > coins) { toast("Zu wenig Coins."); return; }
    setCoins(coins - bet); addXPbet(bet); sfx.click();
    crBet = bet; crStep = 0; crMult = 1; crLive = true; crDeadLane = -1;
    crLanes = []; crAnimFrom = crAnimTo = crAnimK = 0;
    $("crResult").textContent = "";
    $("crStartBox").classList.add("hidden"); $("crBtns").classList.remove("hidden");
    crRender();
  }
  function crWalk() {
    if (!crLive || crBusy) return;
    const k = crStep + 1;
    const ok = Math.random() < CR_SURVIVE(k);
    crBusy = true; sfx.click();
    crAnimFrom = crAnimK; crAnimTo = k; crAnimT0 = performance.now(); crAnimDur = 380;
    if (ok) {
      setTimeout(() => { crBusy = false; crStep = k; crMult = crMultAt(k); crRender(); }, crAnimDur);
    } else {
      crLive = false; crDeadLane = k;
      setTimeout(() => {
        crBusy = false; sfx.lose();
        $("crResult").textContent = `Angefahren bei Schritt ${k}. ${fmt(crBet)} Coins weg.`;
        crRender(); crEndUI();
      }, crAnimDur + 900);
    }
  }
  function crCash() {
    if (!crLive || crBusy) return;
    if (crStep < 1) { toast("Erst mindestens einen Schritt gehen."); return; }
    const win = addWin(crBet * crMult); crLive = false;
    sfx.win(); rain("🪙", "#f59e0b", 20);
    const msg = `Kassiert: +${fmt(win)} Coins bei x${crMult.toFixed(2)} (Einsatz ${fmt(crBet)})`;
    $("crResult").textContent = msg; toast(msg);
    crRender(); crEndUI();
  }
  if ($("crStartBtn")) {
    $("crStartBtn").addEventListener("click", crStart);
    $("crWalkBtn").addEventListener("click", crWalk);
    $("crCashBtn").addEventListener("click", crCash);
    crRender();
    requestAnimationFrame(crLoop);
  }
