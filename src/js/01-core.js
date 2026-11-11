(function () { // Kapsel: Internals (setCoins, coins, store ...) aus der Konsole unerreichbar
  const $ = (id) => document.getElementById(id);
  const PLF = new Date("2027-01-13T10:45:00+01:00");
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const fmt = (n) => n.toLocaleString("de-DE");
  // Leichte Manipulationssperre: jeder Wert bekommt eine Prüfsumme.
  // Wird der Wert im localStorage direkt geändert, stimmt die Prüfsumme nicht
  // mehr und der Wert fällt auf den Standard zurück. Kein echter Schutz,
  // aber stoppt schnelles Herumtippen in den DevTools.
  const SALT = "mx27_v1";
  function sig(str) { let h = 2166136261 >>> 0; const s = str + SALT; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  const store = {
    get(k, d) {
      try {
        const raw = localStorage.getItem(k);
        if (raw === null) return d;
        const obj = JSON.parse(raw);
        // Altes Format ohne Signatur: einmalig akzeptieren und neu signieren
        if (!obj || typeof obj !== "object" || !("v" in obj) || !("s" in obj)) { store.set(k, obj); return obj; }
        const payload = JSON.stringify(obj.v);
        if (obj.s !== sig(payload)) return d; // manipuliert -> Standard
        return obj.v;
      } catch { return d; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify({ v, s: sig(JSON.stringify(v)) })); } catch {} }
  };
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  // ---------- Globaler Reset ----------
  // Erhöhe diese Zahl, um bei JEDEM Spieler einmalig den Fortschritt zurückzusetzen
  // (Coins, Level, Inventar, Stats, Achievements, Streak usw.). Danach läuft alles normal weiter.
  const RESET_VERSION = 2; // bump = kompletter Reset bei allen beim naechsten Laden
  let __justReset = false;
  (function () {
    try {
      if (Number(localStorage.getItem("resetVersion")) !== RESET_VERSION) {
        localStorage.clear();
        localStorage.setItem("resetVersion", String(RESET_VERSION));
        __justReset = true; // Coins starten dann bei 5000 statt 100
      }
    } catch {}
  })();

  let toastT;
  function toast(msg) { $("toast").textContent = msg; $("toast").classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => $("toast").classList.remove("show"), 2500); }

  // Sounds
  let soundOn = store.get("soundOn", true);
  let actx = null;
  function beep(freq, dur = 0.12, type = "square", vol = 0.08) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = vol;
      o.connect(g); g.connect(actx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur); o.stop(actx.currentTime + dur);
    } catch {}
  }
  const sfx = {
    click: () => beep(440, 0.06, "square", 0.05),
    win: () => { beep(660, 0.1); setTimeout(() => beep(880, 0.14), 90); },
    lose: () => beep(200, 0.18, "sawtooth", 0.07),
    coin: () => beep(1040, 0.08, "triangle", 0.06),
    level: () => { beep(523,0.1); setTimeout(()=>beep(659,0.1),100); setTimeout(()=>beep(784,0.16),200); }
  };
  function updateSoundBtn() { $("soundToggle").textContent = soundOn ? "🔊" : "🔇"; }
  updateSoundBtn();
  $("soundToggle").addEventListener("click", () => { soundOn = !soundOn; store.set("soundOn", soundOn); updateSoundBtn(); if (soundOn) sfx.click(); });

  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    sfx.click();
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    const which = t.dataset.tab;
    $("page-timer").classList.toggle("hidden", which !== "timer");
    $("page-market").classList.toggle("hidden", which !== "market");
    $("page-stats").classList.toggle("hidden", which !== "stats");
    $("page-leaderboard").classList.toggle("hidden", which !== "leaderboard");
    $("page-login").classList.toggle("hidden", which !== "login");
    if (which === "stats") { renderStats(); renderAch(); renderRecords(); }
    if (which === "market") { renderChallenges(); renderPrestige(); }
    if (which === "leaderboard") { renderAuth(); loadLeaderboard(); }
    if (which === "login") { renderAuth(); }
  }));

  // Spiele-Unterreiter
  document.querySelectorAll(".gtab").forEach((t) => t.addEventListener("click", () => {
    sfx.click();
    document.querySelectorAll(".gtab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    const g = t.dataset.game;
    ["hl", "wheel", "flip", "guess", "bj", "mines", "crash", "plinko", "chicken", "horses"].forEach((name) => $("game-" + name).classList.toggle("hidden", name !== g));
    if (g === "plinko") buildPlinko();
  }));

  // Max-Einsatz: setzt die volle aktuelle Balance ins Einsatzfeld
  document.querySelectorAll(".maxBet").forEach((b) => b.addEventListener("click", () => {
    sfx.click(); $(b.dataset.target).value = coins;
  }));

  // Ladebildschirm
  let lp = 0;
  const li = setInterval(() => {
    lp = Math.min(99, lp + Math.random() * 8);
    $("loadFill").style.width = lp + "%"; $("loadText").textContent = Math.floor(lp) + " %";
    if (lp >= 99) { clearInterval(li); setTimeout(() => { $("loadText").textContent = "Fehler: Keine Daten gefunden"; $("loadText").style.color = "#ef4444"; setTimeout(() => $("loader").remove(), 1800); }, 1500); }
  }, 120);

  // Coins
  // accountMode: eingeloggt. Dann merkt sich setCoins Einsätze (pendingWager)
  // und Gewinne (pendingWin), die 08-account-supabase.js regelmäßig an den Server schickt.
  let coins = store.get("coins", __justReset ? 5000 : 100);
  let syncDirty = false, accountMode = false, pendingWager = 0, pendingWin = 0;
  function showCoins() { $("coins").textContent = "🪙 " + fmt(coins); store.set("coins", coins); if ($("acctCoins")) $("acctCoins").textContent = fmt(coins); }
  function setCoins(v) {
    const d = v - coins;
    if (accountMode) { if (d < 0) pendingWager += -d; else pendingWin += d; }
    coins = v; syncDirty = true; showCoins();
  }
  setCoins(coins);

  // ---------- Code einlösen (Server, 1x pro Konto, Login nötig) ----------
  if ($("redeemBtn")) {
    $("redeemBtn").addEventListener("click", () => {
      const info = $("redeemInfo");
      const code = ($("redeemInput").value || "").trim(); // case-sensitive
      if (!code) { info.style.color = ""; info.textContent = "Code eingeben."; return; }
      if (!accountMode) { info.style.color = "#ef4444"; info.textContent = "Zum Einlösen bitte einloggen."; sfx.lose(); return; }
      redeemCode(code, info);
    });
    $("bonusBtn").addEventListener("click", () => { sfx.click(); $("redeemInfo").textContent = ""; $("bonusModal").classList.remove("hidden"); });
    $("bonusClose").addEventListener("click", () => { sfx.click(); $("bonusModal").classList.add("hidden"); });
    $("bonusModal").addEventListener("click", (e) => { if (e.target === $("bonusModal")) $("bonusModal").classList.add("hidden"); });
  }

