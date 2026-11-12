  // ---------- Crash ----------
  const CRASH_HOUSE = 0.90; // 10% Hausvorteil
  let crashActive = false, crashBet = 0, crashPoint = 1, crashCur = 1, crashTimer = null, crashCashed = false, crashCashMult = 0, crashCashWon = 0;
  function crashColor(m) { return m < 2 ? "#f59e0b" : m < 5 ? "#22c55e" : m < 20 ? "#3b82f6" : "#a855f7"; }
  let crashHist = [];
  function drawCrash(crashed) {
    const cv = $("crashCanvas"); if (!cv) return;
    const ctx = cv.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 340, h = cv.clientHeight || 170;
    if (cv.width !== Math.round(w * DPR)) { cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR); }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pad = 8;
    const last = crashHist.length ? crashHist[crashHist.length - 1] : { t: 0, m: 1 };
    const tMax = Math.max(4, last.t);
    const mMax = Math.max(1.6, last.m * 1.12);
    const X = (t) => pad + (t / tMax) * (w - pad * 2);
    const Y = (m) => (h - pad) - ((m - 1) / (mMax - 1)) * (h - pad * 2);
    // Gitternetz
    ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { const y = pad + (i / 4) * (h - pad * 2); ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }
    if (crashHist.length < 2) return;
    const col = crashed ? "#ef4444" : crashColor(last.m);
    // Fläche
    ctx.beginPath(); ctx.moveTo(X(crashHist[0].t), Y(crashHist[0].m));
    for (const p of crashHist) ctx.lineTo(X(p.t), Y(p.m));
    ctx.lineTo(X(last.t), h - pad); ctx.lineTo(X(crashHist[0].t), h - pad); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, col + "55"); grad.addColorStop(1, col + "00");
    ctx.fillStyle = grad; ctx.fill();
    // Linie
    ctx.beginPath(); ctx.moveTo(X(crashHist[0].t), Y(crashHist[0].m));
    for (const p of crashHist) ctx.lineTo(X(p.t), Y(p.m));
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
    // Spitze
    ctx.beginPath(); ctx.arc(X(last.t), Y(last.m), crashed ? 6 : 5, 0, Math.PI * 2);
    ctx.fillStyle = crashed ? "#ef4444" : "#fff"; ctx.fill();
  }
  // Letzte 5 Absturzpunkte (nur diese Sitzung)
  let crashPast = [];
  function renderCrashHist() {
    const box = $("crashHist"); if (!box) return;
    box.innerHTML = crashPast.length
      ? crashPast.slice(-5).map((m) => `<span class="crash-chip" style="color:${m < 2 ? "#ef4444" : "#22c55e"}">${m.toFixed(2)}x</span>`).join("")
      : `<span class="hint">Noch keine Runde</span>`;
  }
  renderCrashHist();
  $("crashStartBtn").addEventListener("click", () => {
    if (crashActive) return;
    const bet = Math.floor(Number($("crashBet").value));
    if (!bet || bet < 1) { $("crashResult").style.color = ""; $("crashResult").textContent = "Einsatz eingeben."; return; }
    if (bet > coins) { $("crashResult").style.color = ""; $("crashResult").textContent = "So viele Coins hast du nicht."; return; }
    setCoins(coins - bet); sfx.click(); addXPbet(bet); bump("crashPlayed");
    crashBet = bet; crashActive = true; crashCashed = false; crashCur = 1;
    // Absturzpunkt ziehen (10% Hausvorteil, ~10% Instant-Crash bei 1.00)
    const u = Math.random();
    crashPoint = u < (1 - CRASH_HOUSE) ? 1.00 : Math.min(1000, CRASH_HOUSE / (1 - u));
    $("crashStart").classList.add("hidden"); $("crashGame").classList.remove("hidden");
    $("crashResult").textContent = ""; $("crashCash").disabled = false;
    $("crashRocket").classList.add("fly");
    crashHist = [{ t: 0, m: 1 }]; drawCrash(false);
    const t0 = Date.now();
    crashTimer = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      crashCur = Math.pow(Math.E, 0.3 * el); // exponentieller Anstieg (langsamer = mehr Reaktionszeit)
      if (crashCur >= crashPoint) {
        crashCur = crashPoint; clearInterval(crashTimer); crashTimer = null;
        crashHist.push({ t: el, m: crashPoint }); drawCrash(true);
        crashPast.push(crashPoint); renderCrashHist();
        $("crashMult").textContent = crashPoint.toFixed(2) + "x"; $("crashMult").style.color = "#ef4444";
        $("crashRocket").classList.remove("fly");
        crashActive = false;
        $("crashGame").classList.add("hidden"); $("crashStart").classList.remove("hidden");
        if (crashCashed) {
          const wouldWin = Math.floor(crashBet * crashPoint);
          $("crashResult").style.color = "#22c55e";
          $("crashResult").textContent = `✅ Gecasht bei ${crashCashMult.toFixed(2)}x (+${fmt(crashCashWon)}). Abgestürzt bei ${crashPoint.toFixed(2)}x, komplett wären es ${fmt(wouldWin)} Coins gewesen.`;
        } else {
          sfx.lose();
          stats.totalLost = (stats.totalLost || 0) + crashBet; saveStats(); checkAch();
          $("crashResult").style.color = "#ef4444"; $("crashResult").textContent = `💥 Absturz bei ${crashPoint.toFixed(2)}x! Einsatz ${fmt(crashBet)} weg.`;
        }
        return;
      }
      crashHist.push({ t: el, m: crashCur });
      if (crashHist.length > 400) crashHist.shift();
      drawCrash(false);
      $("crashMult").textContent = crashCur.toFixed(2) + "x"; $("crashMult").style.color = crashColor(crashCur);
    }, 50);
  });
  $("crashCash").addEventListener("click", () => {
    if (!crashActive || crashCashed) return;
    crashCashed = true; $("crashCash").disabled = true; // Spiel laeuft weiter bis zum Absturz
    crashCashMult = crashCur;
    const won = addWin(Math.floor(crashBet * crashCur));
    crashCashWon = won;
    if (crashCur > (stats.crashBest || 0)) { stats.crashBest = Math.round(crashCur * 100) / 100; saveStats(); }
    sfx.win(); rain("🪙", "#f59e0b", 20);
    $("crashResult").style.color = "#22c55e"; $("crashResult").textContent = `Gecasht bei ${crashCur.toFixed(2)}x! +${fmt(won)} Coins. Mal sehen, wie weit es noch geht...`;
  });

  // ---------- Plinko ----------
  const PLINKO_ROWS = 8;
  const PLINKO_MULTS = [20, 3, 2, 0.2, 0.12, 0.2, 2, 3, 20]; // ca. 9.8% Hausvorteil (Binomial 8 Reihen)
  const PLINKO_COLORS = ["#f43f5e", "#a855f7", "#3b82f6", "#334155", "#1e293b", "#334155", "#3b82f6", "#a855f7", "#f43f5e"];
  let plinkoDropping = false;
  function buildPlinko() {
    const board = $("plinkoBoard");
    board.querySelectorAll(".plinko-peg").forEach((p) => p.remove());
    const W = board.clientWidth || 300, H = 220;
    for (let r = 0; r < PLINKO_ROWS; r++) {
      const pegs = r + 2;
      for (let c = 0; c < pegs; c++) {
        const peg = document.createElement("div"); peg.className = "plinko-peg";
        const x = (c + 0.5) / pegs * W;
        const y = 24 + r / PLINKO_ROWS * H;
        peg.style.left = x + "px"; peg.style.top = y + "px";
        board.appendChild(peg);
      }
    }
    $("plinkoSlots").innerHTML = PLINKO_MULTS.map((m, i) => `<div class="plinko-slot" data-i="${i}" style="background:${PLINKO_COLORS[i]}">${m}x</div>`).join("");
  }
  function finishPlinko(n, totalBet, totalReturn) {
    plinkoDropping = false; checkAch();
    const net = totalReturn - totalBet;
    const res = $("plinkoResult");
    if (net >= 0) {
      res.style.color = "#22c55e";
      res.textContent = n === 1 ? `Zurück: ${fmt(totalReturn)} Coins (Gewinn ${fmt(net)}).` : `${n} Bälle: zurück ${fmt(totalReturn)} Coins, Gewinn ${fmt(net)}.`;
      sfx.win(); rain("🔵", "#3b82f6", Math.min(30, 10 + n * 2));
    } else {
      res.style.color = "#ef4444";
      res.textContent = `${n} ${n === 1 ? "Ball" : "Bälle"}: zurück ${fmt(totalReturn)} Coins, Verlust ${fmt(-net)}.`;
      sfx.lose();
    }
  }
  function dropOneBall(bet, W, H, onDone) {
    const board = $("plinkoBoard");
    let rights = 0; const path = [];
    for (let r = 0; r < PLINKO_ROWS; r++) { const right = Math.random() < 0.5; if (right) rights++; path.push(right); }
    const slot = rights;
    const ball = document.createElement("div"); ball.className = "plinko-ball";
    ball.style.left = (W / 2 + (Math.random() * 10 - 5)) + "px"; ball.style.top = "10px";
    board.appendChild(ball);
    let col = 0, step = 0;
    const stepT = setInterval(() => {
      if (step >= PLINKO_ROWS) {
        clearInterval(stepT);
        const slotX = (slot + 0.5) / PLINKO_MULTS.length * W;
        ball.style.left = slotX + "px"; ball.style.top = (H + 28) + "px";
        setTimeout(() => {
          ball.remove();
          const slotEl = document.querySelector(`.plinko-slot[data-i="${slot}"]`);
          if (slotEl) { slotEl.classList.add("hit"); setTimeout(() => slotEl.classList.remove("hit"), 450); }
          const mult = PLINKO_MULTS[slot];
          let ret;
          if (mult >= 1) {
            ret = addWin(Math.floor(bet * mult));
            if (ret > (stats.plinkoBest || 0)) { stats.plinkoBest = ret; saveStats(); }
          } else {
            ret = Math.floor(bet * mult);
            setCoins(coins + ret);
            stats.totalLost = (stats.totalLost || 0) + (bet - ret); saveStats();
          }
          onDone(ret);
        }, 200);
        return;
      }
      if (path[step]) col++;
      const pegs = step + 2;
      ball.style.left = ((col + 0.5) / pegs * W) + "px";
      ball.style.top = (24 + (step + 0.5) / PLINKO_ROWS * H) + "px";
      step++;
    }, 180);
  }
  $("plinkoDropBtn").addEventListener("click", () => {
    if (plinkoDropping) return;
    const bet = Math.floor(Number($("plinkoBet").value));
    let n = Math.floor(Number($("plinkoBalls").value) || 1);
    n = Math.max(1, Math.min(20, n));
    if (!bet || bet < 1) { $("plinkoResult").style.color = ""; $("plinkoResult").textContent = "Einsatz eingeben."; return; }
    const totalBet = bet * n;
    if (totalBet > coins) { $("plinkoResult").style.color = ""; $("plinkoResult").textContent = `Für ${n} Bälle brauchst du ${fmt(totalBet)} Coins.`; return; }
    setCoins(coins - totalBet); sfx.click(); addXPbet(totalBet);
    for (let i = 0; i < n; i++) bump("plinkoPlayed");
    plinkoDropping = true; buildPlinko();
    $("plinkoResult").textContent = "";
    document.querySelectorAll(".plinko-slot").forEach((s) => s.classList.remove("hit"));
    $("plinkoBoard").querySelectorAll(".plinko-ball").forEach((b) => b.remove());
    const board = $("plinkoBoard"), W = board.clientWidth || 300, H = 220;
    let done = 0, totalReturn = 0;
    for (let b = 0; b < n; b++) {
      setTimeout(() => {
        dropOneBall(bet, W, H, (ret) => {
          totalReturn += ret; done++;
          if (done >= n) finishPlinko(n, totalBet, totalReturn);
        });
      }, b * 90);
    }
  });

  // Skins + Lootbox
  // Fairere Verkaufspreise: erwarteter Wert pro Box ~42 bei 50 Einsatz (~16% Hausvorteil)
  const RARITIES = {
    common: { name: "Gewöhnlich", color: "#9ca3af", weight: 50, sell: 10 },
    uncommon: { name: "Ungewöhnlich", color: "#22c55e", weight: 25, sell: 18 },
    rare: { name: "Selten", color: "#3b82f6", weight: 15, sell: 40 },
    epic: { name: "Episch", color: "#a855f7", weight: 7, sell: 95 },
    legendary: { name: "Legendär", color: "#f59e0b", weight: 2.4, sell: 260 },
    mythic: { name: "Mythisch", color: "#ef4444", weight: 0.5, sell: 750 },
    exotic: { name: "Exotisch", color: "#f0abfc", weight: 0.1, sell: 2000 }
  };
  const SKINS = [
    { id: "standard", name: "Standard", rarity: "common", bg: "#0b1120", card: "#111a2e", text: "#f9fafb", start: true },
    { id: "grau", name: "Grau wie deine Zukunft", rarity: "common", bg: "#4b5563", card: "#374151", text: "#f9fafb" },
    { id: "kaffee", name: "Kaffeefleck", rarity: "common", bg: "#3b2a1a", card: "#5c4130", text: "#fef3c7", font: "Georgia, serif" },
    { id: "notepad", name: "Notepad Classic", rarity: "common", bg: "#e5e7eb", card: "#ffffff", text: "#111827", font: "'Courier New', monospace", radius: "0px", align: "flex-start", talign: "left" },
    { id: "darcula", name: "IntelliJ Darcula", rarity: "rare", bg: "#2b2b2b", card: "#3c3f41", text: "#a9b7c6", font: "'Courier New', monospace", radius: "4px" },
    { id: "matrix", name: "Matrix", rarity: "rare", bg: "#000000", card: "#052e16", text: "#22c55e", font: "'Courier New', monospace", radius: "0px", align: "flex-start", talign: "left" },
    { id: "bluescreen", name: "Blue Screen", rarity: "rare", bg: "#0078d7", card: "#005a9e", text: "#ffffff", font: "'Segoe UI', sans-serif", radius: "0px", align: "flex-start", talign: "left" },
    { id: "pink", name: "Pink Panic", rarity: "epic", bg: "#831843", card: "#be185d", text: "#fdf2f8", radius: "24px" },
    { id: "sunset", name: "Sonnenuntergang", rarity: "epic", bg: "linear-gradient(135deg, #f97316, #db2777, #7c3aed)", card: "rgba(0,0,0,.35)", text: "#ffffff", radius: "20px" },
    { id: "vapor", name: "Vaporwave", rarity: "epic", bg: "linear-gradient(135deg, #22d3ee, #a855f7, #f472b6)", card: "rgba(17,24,39,.6)", text: "#ffffff", font: "'Comic Sans MS', cursive", radius: "18px" },
    { id: "gold", name: "Gold Edition", rarity: "legendary", bg: "linear-gradient(135deg, #78350f, #f59e0b, #78350f)", card: "rgba(0,0,0,.45)", text: "#fef3c7", font: "Georgia, serif", radius: "16px" },
    { id: "rainbow", name: "Regenbogen", rarity: "legendary", bg: "linear-gradient(90deg, #ef4444, #f59e0b, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)", card: "rgba(0,0,0,.5)", text: "#ffffff", anim: true, radius: "22px" },
    { id: "bestanden", name: "Bestanden (fühlt sich falsch an)", rarity: "mythic", bg: "linear-gradient(135deg, #14532d, #22c55e, #14532d)", card: "rgba(0,0,0,.4)", text: "#f0fdf4", anim: true, font: "Georgia, serif", radius: "16px" },
    { id: "platin", name: "Platin (Achievement-Belohnung)", rarity: "mythic", bg: "linear-gradient(135deg, #1e293b, #cbd5e1, #94a3b8, #e2e8f0, #1e293b)", card: "rgba(0,0,0,.35)", text: "#f8fafc", anim: true, radius: "18px" },
    { id: "toxic", name: "Toxic", rarity: "rare", bg: "#0a1f0a", card: "#14321a", text: "#a3e635", font: "'Courier New', monospace" },
    { id: "neon", name: "Neon Nights", rarity: "epic", bg: "linear-gradient(135deg, #0f0524, #2d0a4e, #0f0524)", card: "rgba(236,72,153,.12)", text: "#f0abfc", radius: "20px" },
    { id: "lava", name: "Lava", rarity: "epic", bg: "linear-gradient(180deg, #450a0a, #b91c1c, #f59e0b)", card: "rgba(0,0,0,.4)", text: "#fff7ed", radius: "16px" },
    { id: "ocean", name: "Tiefsee", rarity: "rare", bg: "linear-gradient(180deg, #082f49, #0e7490, #155e75)", card: "rgba(0,0,0,.35)", text: "#e0f2fe", radius: "18px" },
    { id: "galaxy", name: "Galaxie", rarity: "legendary", bg: "linear-gradient(135deg, #1e1b4b, #4c1d95, #be185d, #1e1b4b)", card: "rgba(0,0,0,.5)", text: "#ede9fe", anim: true, radius: "22px" },
    { id: "holo", name: "Hologramm", rarity: "mythic", bg: "linear-gradient(135deg, #22d3ee, #a78bfa, #f0abfc, #86efac, #22d3ee)", card: "rgba(10,10,25,.55)", text: "#ffffff", anim: true, radius: "20px" },
    // --- Ungewöhnlich ---
    { id: "mint", name: "Minze", rarity: "uncommon", bg: "linear-gradient(135deg, #064e3b, #10b981)", card: "rgba(0,0,0,.35)", text: "#ecfdf5", radius: "16px" },
    { id: "army", name: "Tarnfleck", rarity: "uncommon", bg: "#1a2e05", card: "#2f3d1a", text: "#d9f99d", font: "'Courier New', monospace" },
    { id: "slate", name: "Schiefer", rarity: "uncommon", bg: "linear-gradient(135deg, #334155, #475569)", card: "rgba(0,0,0,.3)", text: "#e2e8f0", radius: "14px" },
    { id: "sand", name: "Wüstensand", rarity: "uncommon", bg: "linear-gradient(135deg, #78350f, #b45309, #d97706)", card: "rgba(0,0,0,.3)", text: "#fffbeb", radius: "16px" },
    // --- Selten ---
    { id: "terminal", name: "Terminal", rarity: "rare", bg: "#020617", card: "#0f172a", text: "#38bdf8", font: "'Courier New', monospace", radius: "4px", align: "flex-start", talign: "left" },
    { id: "rose", name: "Rosé", rarity: "rare", bg: "linear-gradient(135deg, #4c0519, #9f1239)", card: "rgba(0,0,0,.35)", text: "#ffe4e6", radius: "18px" },
    // --- Episch ---
    { id: "aurora", name: "Aurora", rarity: "epic", bg: "linear-gradient(135deg, #042f2e, #0d9488, #6366f1)", card: "rgba(0,0,0,.4)", text: "#ccfbf1", radius: "20px" },
    { id: "candy", name: "Zuckerwatte", rarity: "epic", bg: "linear-gradient(135deg, #f0abfc, #818cf8, #5eead4)", card: "rgba(17,24,39,.55)", text: "#1e1b4b", radius: "22px" },
    // --- Legendär ---
    { id: "inferno", name: "Inferno", rarity: "legendary", bg: "linear-gradient(135deg, #450a0a, #dc2626, #f59e0b, #450a0a)", card: "rgba(0,0,0,.5)", text: "#fff7ed", anim: true, radius: "18px" },
    { id: "emerald", name: "Smaragd", rarity: "legendary", bg: "linear-gradient(135deg, #064e3b, #059669, #a7f3d0, #064e3b)", card: "rgba(0,0,0,.5)", text: "#ecfdf5", anim: true, radius: "18px" },
    // --- Mythisch ---
    { id: "prisma", name: "Prisma", rarity: "mythic", bg: "linear-gradient(135deg, #0ea5e9, #8b5cf6, #ec4899, #f59e0b, #0ea5e9)", card: "rgba(10,10,25,.55)", text: "#ffffff", anim: true, radius: "20px" },
    // --- Exotisch ---
    { id: "singularity", name: "Singularität", rarity: "exotic", bg: "radial-gradient(circle at 50% 40%, #000000, #1e1b4b, #4c1d95, #000000)", card: "rgba(139,92,246,.15)", text: "#e9d5ff", anim: true, radius: "24px" },
    { id: "goldrush", name: "Goldrausch", rarity: "exotic", bg: "linear-gradient(135deg, #713f12, #fbbf24, #fde68a, #fbbf24, #713f12)", card: "rgba(0,0,0,.45)", text: "#451a03", font: "Georgia, serif", anim: true, radius: "20px" }
  ];
  const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];
  let inv = store.get("inv", null);
  if (!inv) { const legacy = store.get("skins", ["standard"]); inv = {}; legacy.forEach((id) => inv[id] = 1); if (!inv.standard) inv.standard = 1; store.set("inv", inv); }
  let equipped = store.get("equipped", "standard");
  const saveInv = () => store.set("inv", inv);
  const ownedIds = () => Object.keys(inv).filter((id) => inv[id] > 0);

  $("rarityInfo").innerHTML = Object.values(RARITIES).map((r) => `<span style="color:${r.color}">${r.name} ${r.weight} % · Verkauf ${r.sell}</span>`).join(" · ");

  function applySkin(id) {
    const s = skinById(id);
    const root = document.documentElement.style;
    root.setProperty("--bg", s.bg); root.setProperty("--card", s.card); root.setProperty("--text", s.text);
    root.setProperty("--font", s.font || "system-ui, sans-serif"); root.setProperty("--radius", s.radius || "16px");
    // Layout bleibt immer zentriert, egal welcher Skin
    root.setProperty("--align", "center"); root.setProperty("--talign", "center");
    root.setProperty("--border", s.start ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.14)");
    document.body.classList.toggle("skin-anim", !!s.anim);
    equipped = s.id; store.set("equipped", s.id); renderInventory();
  }
  // Alle Loot-Items auf einmal verkaufen (ausgerüsteter Skin bleibt)
  function sellAllLoot() {
    let total = 0, n = 0;
    Object.keys(inv).forEach((id) => {
      if (id === "standard" || id === equipped || !(inv[id] > 0)) return;
      const r = RARITIES[skinById(id).rarity];
      total += r.sell * inv[id]; n += inv[id];
      delete inv[id];
    });
    if (!n) { toast("Keine Loot-Items zum Verkaufen."); return; }
    saveInv(); setCoins(coins + total); sfx.coin();
    $("caseResult").style.color = "#22c55e";
    $("caseResult").textContent = `${n} Items verkauft für +${fmt(total)} Coins.`;
    renderInventory();
  }
  function renderInventory() {
    $("inventory").innerHTML = "";
    const sellAllBtn = document.createElement("button");
    sellAllBtn.className = "sellBtn"; sellAllBtn.textContent = "🗑️ Alle Loot-Items verkaufen";
    sellAllBtn.style.gridColumn = "1 / -1"; sellAllBtn.addEventListener("click", sellAllLoot);
    $("inventory").appendChild(sellAllBtn);
    SKINS.filter((s) => (inv[s.id] || 0) > 0).forEach((s) => {
      const r = RARITIES[s.rarity];
      const wrap = document.createElement("div"); wrap.className = "inv-item" + (s.id === equipped ? " equipped" : ""); wrap.style.borderColor = r.color;
      const title = document.createElement("div"); title.textContent = s.name;
      const cnt = document.createElement("div"); cnt.className = "count"; cnt.textContent = `x${inv[s.id]} · ${r.name} · Verkauf ${r.sell}`;
      const btns = document.createElement("div"); btns.className = "inv-btns";
      const eq = document.createElement("button"); eq.className = "equipBtn"; eq.textContent = s.id === equipped ? "Aktiv" : "Equip"; eq.disabled = s.id === equipped;
      eq.addEventListener("click", () => { sfx.click(); applySkin(s.id); }); btns.appendChild(eq);
      if (s.id !== "standard") { const sell = document.createElement("button"); sell.className = "sellBtn"; sell.textContent = `Verkauf +${r.sell}`; sell.addEventListener("click", () => sellSkin(s.id)); btns.appendChild(sell); }
      wrap.append(title, cnt, btns); $("inventory").appendChild(wrap);
    });
    $("invCount").textContent = `${ownedIds().length} Arten`;
    if (typeof renderTraderBuy === "function") renderTraderBuy();
  }
  function sellSkin(id) {
    if ((inv[id] || 0) <= 0) return;
    const r = RARITIES[skinById(id).rarity];
    inv[id]--; if (inv[id] <= 0) { delete inv[id]; if (equipped === id) applySkin("standard"); }
    saveInv(); setCoins(coins + r.sell); sfx.coin();
    $("caseResult").style.color = r.color; $("caseResult").textContent = `Verkauft für +${r.sell} Coins.`; renderInventory();
  }
  function rollSkin() {
    let x = Math.random() * 100, rarity = "common";
    for (const [key, r] of Object.entries(RARITIES)) { if (x < r.weight) { rarity = key; break; } x -= r.weight; }
    const options = SKINS.filter((s) => !s.start && s.rarity === rarity);
    return options[rnd(0, options.length - 1)];
  }
  function caseItem(s) { const d = document.createElement("div"); d.className = "case-item"; d.style.borderBottomColor = RARITIES[s.rarity].color; d.textContent = s.name; return d; }
  for (let i = 0; i < 8; i++) $("caseStrip").appendChild(caseItem(rollSkin()));

  let caseOpening = false;
  function updateCaseBtn() { $("caseBtn").textContent = `Lootbox öffnen (${boxPrice()} Coins)`; }
  updateCaseBtn();
  function caseReveal(winner) {
    caseOpening = false; addXPbet(boxPrice());
    const r = RARITIES[winner.rarity]; const had = (inv[winner.id] || 0) > 0;
    inv[winner.id] = (inv[winner.id] || 0) + 1; saveInv(); renderInventory();
    $("caseResult").style.color = r.color;
    $("caseResult").textContent = had ? `${winner.name} (${r.name}) - schon wieder. Jetzt x${inv[winner.id]}. Verkaufen für ${r.sell}?` : `NEU: ${winner.name} (${r.name})! Equippen oder verkaufen.`;
    if (winner.rarity === "legendary" || winner.rarity === "mythic" || winner.rarity === "exotic") { rain("✨", r.color, 50); sfx.win(); } else sfx.coin();
  }
  function openCase(quick) {
    if (caseOpening) return;
    const price = boxPrice();
    if (coins < price) { $("caseResult").style.color = ""; $("caseResult").textContent = `${price} Coins nötig. Hol den Minuten-Bonus.`; return; }
    setCoins(coins - price); caseOpening = true; sfx.click(); bump("boxes"); stats.totalLost = (stats.totalLost || 0) + price; saveStats();
    const winner = rollSkin();
    if (quick) {
      // Schnell: Gewinnfeld direkt in die Mitte setzen, keine lange Animation
      const strip = $("caseStrip"); strip.style.transition = "none"; strip.style.transform = "translateX(0)"; strip.innerHTML = "";
      strip.appendChild(caseItem(winner));
      caseReveal(winner);
      return;
    }
    const strip = $("caseStrip"); const WIN_IDX = 35;
    strip.innerHTML = ""; strip.style.transition = "none"; strip.style.transform = "translateX(0)";
    for (let i = 0; i < 40; i++) strip.appendChild(caseItem(i === WIN_IDX ? winner : rollSkin()));
    const offset = 11 + WIN_IDX * 100 + 46 - strip.parentElement.clientWidth / 2 + rnd(-30, 30);
    $("caseResult").style.color = ""; $("caseResult").textContent = "Lootbox öffnet sich...";
    strip.offsetWidth; strip.style.transition = "transform 4.5s cubic-bezier(.12,.8,.2,1)"; strip.style.transform = `translateX(-${offset}px)`;
    setTimeout(() => caseReveal(winner), 4700);
  }
  $("caseBtn").addEventListener("click", () => openCase(false));
  $("caseQuickBtn").addEventListener("click", () => openCase(true));

