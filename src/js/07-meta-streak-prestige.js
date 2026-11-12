  // Spielzeit als "x h y min"
  function fmtPlay(sec) { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min`; }
  // ---------- Statistik- und Achievement-Anzeige ----------
  function renderStats() {
    // Hervorgehobene Kennzahlen oben, Rest als Kacheln
    const big = [
      { ic: "🪙", label: "Coins", val: fmt(coins), col: "#f59e0b" },
      { ic: "🏆", label: "Größter Gewinn", val: fmt(stats.biggestWin || 0), col: "#22c55e" },
      { ic: "⭐", label: "Level", val: level, col: "#a855f7" }
    ];
    const tiles = [
      { ic: "🎮", label: "Spiele gespielt", val: fmt(stats.games || 0) },
      { ic: "💸", label: "Coins verspielt", val: fmt(stats.totalLost || 0) },
      { ic: "🃏", label: "Beste H/L-Serie", val: stats.hlBest || 0 },
      { ic: "🎡", label: "Wheel-Spins", val: stats.spins || 0 },
      { ic: "📦", label: "Lootboxen", val: stats.boxes || 0 },
      { ic: "🪙", label: "Münzwürfe", val: stats.flips || 0 },
      { ic: "🂡", label: "Blackjack", val: stats.bjPlayed || 0 },
      { ic: "💣", label: "Mines", val: stats.minesPlayed || 0 },
      { ic: "🚀", label: "Crash", val: stats.crashPlayed || 0 },
      { ic: "🔵", label: "Plinko", val: stats.plinkoPlayed || 0 },
      { ic: "⏱️", label: "Spielzeit", val: fmtPlay(store.get("playtime", 0)) }
    ];
    const bigHtml = big.map((b) => `<div class="stat-big"><div class="sb-ic">${b.ic}</div><div class="sb-val" style="color:${b.col}">${b.val}</div><div class="sb-lbl">${b.label}</div></div>`).join("");
    const tilesHtml = tiles.map((t) => `<div class="stat-tile"><span class="st-ic">${t.ic}</span><span class="st-val">${t.val}</span><span class="st-lbl">${t.label}</span></div>`).join("");
    $("statList").innerHTML = `<div class="stat-big-row">${bigHtml}</div><div class="stat-grid">${tilesHtml}</div>`;
  }
  function renderAch() {
    const have = ACHIEVEMENTS.filter((a) => achDone[a.id]).length;
    $("achCount").textContent = `${have} / ${ACHIEVEMENTS.length}`;
    $("achList").innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const done = !!achDone[a.id];
      const d = document.createElement("div"); d.className = "ach" + (done ? " done" : "");
      d.innerHTML = `<div class="ach-ic">${a.icon}</div><div class="ach-body"><div class="ach-name">${a.name}${done ? " ✓" : ""}</div><div class="ach-desc">${a.desc}</div></div><div class="ach-reward">+${fmt(a.reward)}</div>`;
      $("achList").appendChild(d);
    });
  }

  // ---------- Login-Streak ----------
  function renderStreak() {
    const streak = store.get("streak", 0);
    const last = store.get("streakDay", "");
    const claimedToday = last === todayKey();
    const nextReward = 20 + Math.min(streak, 30) * 10; // wächst bis Tag 30
    $("streakText").textContent = `Jeden Tag einloggen gibt wachsenden Bonus. Aktuelle Serie: ${streak} Tag(e).`;
    if (claimedToday) {
      $("streakBtn").disabled = true; $("streakBtn").textContent = "Heute schon abgeholt";
      $("streakInfo").textContent = `Komm morgen wieder. Nächster Bonus: ${fmt(20 + Math.min(streak, 30) * 10)} Coins.`;
    } else {
      $("streakBtn").disabled = false; $("streakBtn").textContent = `Bonus abholen (${fmt(nextReward)} Coins)`;
      $("streakInfo").textContent = "Verpasst du einen Tag, beginnt die Serie von vorn.";
    }
  }
  $("streakBtn").addEventListener("click", () => {
    const last = store.get("streakDay", "");
    if (last === todayKey()) return;
    // gestern? -> Serie +1, sonst Reset auf 1
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yKey = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    let streak = store.get("streak", 0);
    streak = (last === yKey) ? streak + 1 : 1;
    const reward = 20 + Math.min(streak - 1, 30) * 10;
    store.set("streak", streak); store.set("streakDay", todayKey());
    setCoins(coins + reward); addXP(10); sfx.coin(); rain("🪙", "#22c55e", 20);
    toast(`Login-Streak Tag ${streak}: +${fmt(reward)} Coins!`);
    renderStreak(); renderStreakWeek();
  });
  // Kalender der letzten 7 Tage: Flamme = Tag gehört zur aktuellen Serie
  function renderStreakWeek() {
    const box = $("streakWeek"); if (!box) return;
    const streak = store.get("streak", 0), last = store.get("streakDay", "");
    const parse = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
    const lastD = last ? parse(last) : null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const names = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    let html = "";
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const diff = lastD ? Math.round((lastD - d) / 86400000) : -1; // 0 = dieser Tag ist der letzte Serientag
      const done = !!lastD && diff >= 0 && diff < streak;
      html += `<div class="sw-day${done ? " done" : ""}${i === 0 ? " today" : ""}" style="animation-delay:${(6 - i) * 70}ms"><span class="sw-name">${names[d.getDay()]}</span><span class="sw-dot">${done ? "🔥" : ""}</span></div>`;
    }
    box.innerHTML = html;
    if ($("streakNum")) $("streakNum").textContent = streak;
  }
  renderStreak();
  renderStreakWeek();

  // ---------- Tägliche Challenges ----------
  // Pool fester Challenges; 3 pro Tag werden deterministisch aus dem Datum gewählt
  const CHALLENGE_POOL = [
    { id: "c_games5", icon: "🎮", desc: "Spiele 5 Runden", target: 5, reward: 300, prog: () => daily.games || 0 },
    { id: "c_games15", icon: "🔥", desc: "Spiele 15 Runden", target: 15, reward: 700, prog: () => daily.games || 0 },
    { id: "c_won2k", icon: "💰", desc: "Gewinne 2.000 Coins heute", target: 2000, reward: 500, prog: () => daily.won || 0 },
    { id: "c_won10k", icon: "🤑", desc: "Gewinne 10.000 Coins heute", target: 10000, reward: 1500, prog: () => daily.won || 0 },
    { id: "c_box3", icon: "📦", desc: "Öffne 3 Lootboxen", target: 3, reward: 400, prog: () => daily.boxes || 0 },
    { id: "c_spin10", icon: "🎡", desc: "Dreh das Wheel 10 Mal", target: 10, reward: 350, prog: () => daily.spins || 0 }
  ];
  function todaysChallenges() {
    dailyCheck();
    const seed = [...todayKey()].reduce((a, c) => a + c.charCodeAt(0), 0);
    // 3 verschiedene Challenges deterministisch wählen
    const idxs = [];
    let s = seed;
    while (idxs.length < 3) { s = (s * 31 + 7) % CHALLENGE_POOL.length; if (!idxs.includes(s)) idxs.push(s); }
    return idxs.map((i) => CHALLENGE_POOL[i]);
  }
  function renderChallenges() {
    dailyCheck();
    const claimed = store.get("challClaimed", {});
    const day = todayKey();
    $("challengeList").innerHTML = "";
    todaysChallenges().forEach((c) => {
      const p = Math.min(c.prog(), c.target);
      const done = p >= c.target;
      const key = day + "_" + c.id;
      const isClaimed = claimed[key];
      const row = document.createElement("div"); row.className = "reward-row"; row.style.flexWrap = "wrap";
      const left = document.createElement("div"); left.style.flex = "1"; left.style.minWidth = "160px"; left.style.textAlign = "left";
      left.innerHTML = `<div>${c.icon} ${c.desc}</div><div style="font-size:.75rem;color:#94a3b8;">${fmt(p)} / ${fmt(c.target)} · Belohnung ${fmt(c.reward)} 🪙</div>`;
      const b = document.createElement("button"); b.style.padding = "7px 12px"; b.style.fontSize = ".78rem";
      if (isClaimed) { b.textContent = "✓ Abgeholt"; b.className = "owned"; b.disabled = true; b.style.background = "#22c55e"; b.style.color = "#052e16"; }
      else if (done) { b.textContent = "Abholen"; b.style.background = "#eab308"; b.style.color = "#1f1300";
        b.addEventListener("click", () => { const cl = store.get("challClaimed", {}); if (cl[key]) return; cl[key] = true; store.set("challClaimed", cl); setCoins(coins + c.reward); sfx.coin(); rain("🪙", "#22c55e", 18); confetti(40); toast(`Challenge geschafft: +${fmt(c.reward)} Coins!`); renderChallenges(); }); }
      else { b.textContent = "Offen"; b.disabled = true; b.style.background = "#334155"; b.style.color = "#94a3b8"; }
      row.append(left, b); $("challengeList").appendChild(row);
    });
  }
  renderChallenges();

  // ---------- Prestige / Rebirth ----------
  const PRESTIGE_COST = 5000000;
  function renderPrestige() {
    $("prestigeText").innerHTML = `Ab ${fmt(PRESTIGE_COST)} Coins kannst du Prestigen: Coins werden zurückgesetzt, dafür gibt es dauerhaft <b>+0.5% Coins</b> pro Stufe (stapelt). Aktuelle Prestige-Stufe: <b>${prestige}</b> (+${(prestige * 0.5).toFixed(1)}%).`;
    if (coins >= PRESTIGE_COST) {
      $("prestigeBtn").disabled = false; $("prestigeBtn").textContent = `Prestige (Stufe ${prestige + 1})`;
      $("prestigeInfo").textContent = "Skins, Level, Perks und Achievements bleiben erhalten.";
    } else {
      $("prestigeBtn").disabled = true; $("prestigeBtn").textContent = "Prestige gesperrt";
      $("prestigeInfo").textContent = `Noch ${fmt(PRESTIGE_COST - coins)} Coins bis zum nächsten Prestige.`;
    }
  }
  $("prestigeBtn").addEventListener("click", () => {
    if (coins < PRESTIGE_COST) return;
    if (!confirm(`Wirklich prestigen? Deine ${fmt(coins)} Coins werden auf 100 zurückgesetzt. Du bekommst dauerhaft +0.5% Coins (neue Stufe ${prestige + 1}).`)) return;
    prestige++; store.set("prestige", prestige);
    setCoins(100); sfx.win(); confetti(140); rain("♻️", "#a855f7", 50);
    toast(`Prestige ${prestige}! Dauerhaft +${(prestige * 0.5).toFixed(1)}% Coins.`);
    renderPrestige(); applyTitle();
  });
  renderPrestige();
  setInterval(renderPrestige, 2000); // Button-Status aktuell halten

  // ---------- Rekorde ----------
  function renderRecords() {
    const recs = [
      ["🏆 Größter Einzelgewinn", fmt(stats.biggestWin || 0) + " 🪙"],
      ["🃏 Längste Higher/Lower-Serie", (stats.hlBest || 0)],
      ["🚀 Bester Crash-Cashout", (stats.crashBest || 0).toFixed ? (stats.crashBest || 0).toFixed(2) + "x" : (stats.crashBest || 0) + "x"],
      ["🔵 Bester Plinko-Gewinn", fmt(stats.plinkoBest || 0) + " 🪙"],
      ["💥 Echte Blackjacks", (stats.bjBlackjack || 0)],
      ["♻️ Prestige-Stufe", prestige]
    ];
    if ($("recordList")) $("recordList").innerHTML = recs.map((r) => `<div class="stat-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");
  }
  renderRecords();

  // Initiale Achievement-Prüfung (z.B. falls schon Level 10 erreicht)
  checkAch(); renderStats();

  applySkin(equipped);

  const facts = ["Was ist eine NullPointerException? Tipp: deine Vorbereitung.", "Was gibt System.out.println(maxi.isReady()) aus? Antwort: false", "Unterschied zwischen == und equals()? Ungefähr eine ganze Note.", "Eine for-Schleife läuft öfter, als du lernst.", "Wie viele Semikolons wirst du bei der PLF vergessen? Ja.", "Der Garbage Collector räumt mehr auf als du in deinem Zimmer.", "while(true) beschreibt, wie lange du das Lernen schon aufschiebst.", "ChatGPT darf nicht mit zur PLF. Nur damit du es weißt.", "Fun Fact: Auch IntelliJ glaubt nicht an dich."];
  $("fact").textContent = facts[Math.floor(Date.now() / 86400000) % facts.length];

  const excuses = ["mein IntelliJ gerade indexiert.", "die PLF eh noch ewig weg ist.", "ich zuerst noch FIFA spielen muss.", "mein Laptop ein Update macht.", "ich das morgen eh in einer Stunde schaffe.", "Java mich emotional verletzt hat.", "ich zuerst meinen Schreibtisch aufräumen muss.", "Merkur rückläufig ist."];
  $("excuseBtn").addEventListener("click", () => { sfx.click(); $("excuse").textContent = "Heute kann ich nicht lernen, weil " + excuses[rnd(0, excuses.length - 1)]; });

