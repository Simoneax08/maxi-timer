  // ---------- Statistik ----------
  let stats = store.get("stats", { games: 0, biggestWin: 0, totalLost: 0, hlBest: 0, spins: 0, boxes: 0, flips: 0, bjPlayed: 0, bjBlackjack: 0 });
  function saveStats() { store.set("stats", stats); if (typeof renderStats === "function") renderStats(); if (typeof renderRecords === "function") renderRecords(); }
  // Tages-Zähler für die Challenges (setzen sich täglich zurück)
  let daily = store.get("daily", { day: "", games: 0, won: 0, boxes: 0, spins: 0 });
  function dailyCheck() { const d = todayKey(); if (daily.day !== d) { daily = { day: d, games: 0, won: 0, boxes: 0, spins: 0 }; store.set("daily", daily); } }
  function dailyBump(key, n = 1) { dailyCheck(); daily[key] = (daily[key] || 0) + n; store.set("daily", daily); if (typeof renderChallenges === "function") renderChallenges(); }
  function bump(key, n = 1) {
    stats[key] = (stats[key] || 0) + n;
    const isGame = key.endsWith("Played") || key === "spins" || key === "flips";
    stats.games = (stats.games || 0) + (isGame ? n : 0);
    if (isGame) dailyBump("games", n);
    if (key === "spins") dailyBump("spins", n);
    if (key === "boxes") dailyBump("boxes", n);
    saveStats(); if (typeof checkAch === "function") checkAch();
  }

  // ---------- Achievements ----------
  let achDone = store.get("achDone", {}); // id -> true (abgeschlossen)
  let achClaimed = store.get("achClaimed", {}); // id -> true (Belohnung abgeholt, via auto)
  let allAchBonus = store.get("allAchBonus", false); // 1.01x Dauer-Multiplier bei allen 12
  const ACHIEVEMENTS = [
    { id: "first_spin", icon: "🎡", name: "Erster Dreh", desc: "Dreh das Wheel einmal.", reward: 50, check: () => (stats.spins || 0) >= 1 },
    { id: "first_box", icon: "📦", name: "Erste Lootbox", desc: "Öffne eine Lootbox.", reward: 50, check: () => (stats.boxes || 0) >= 1 },
    { id: "spin25", icon: "🌀", name: "Dreh-Junkie", desc: "Dreh das Wheel 25 Mal.", reward: 150, check: () => (stats.spins || 0) >= 25 },
    { id: "box10", icon: "🎁", name: "Sammler", desc: "Öffne 10 Lootboxen.", reward: 200, check: () => (stats.boxes || 0) >= 10 },
    { id: "hl5", icon: "🃏", name: "Kartenzähler", desc: "Erreiche eine Serie von 5 bei Higher/Lower.", reward: 250, check: () => (stats.hlBest || 0) >= 5 },
    { id: "bj_bj", icon: "🂡", name: "Blackjack!", desc: "Hol dir einen echten Blackjack.", reward: 300, check: () => (stats.bjBlackjack || 0) >= 1 },
    { id: "win1k", icon: "💰", name: "Großer Fang", desc: "Gewinne 1.000 Coins auf einen Schlag.", reward: 200, check: () => (stats.biggestWin || 0) >= 1000 },
    { id: "win10k", icon: "🤑", name: "Jackpot-Jäger", desc: "Gewinne 10.000 Coins auf einen Schlag.", reward: 500, check: () => (stats.biggestWin || 0) >= 10000 },
    { id: "lost5k", icon: "🕳️", name: "Zockerherz", desc: "Verliere insgesamt 5.000 Coins.", reward: 200, check: () => (stats.totalLost || 0) >= 5000 },
    { id: "lvl10", icon: "⭐", name: "Aufsteiger", desc: "Erreiche Level 10.", reward: 300, check: () => level >= 10 },
    { id: "flips50", icon: "🪙", name: "Münzmeister", desc: "Wirf die Münze 50 Mal.", reward: 150, check: () => (stats.flips || 0) >= 50 },
    { id: "rich", icon: "🏦", name: "Reich", desc: "Besitze gleichzeitig 50.000 Coins.", reward: 500, check: () => coins >= 50000 }
  ];
  function checkAch() {
    let changed = false;
    ACHIEVEMENTS.forEach((a) => {
      if (!achDone[a.id] && a.check()) {
        achDone[a.id] = true; changed = true;
        setCoins(coins + a.reward); sfx.level(); rain("🏆", "#facc15", 25);
        toast(`Achievement: ${a.name}! +${fmt(a.reward)} Coins`);
      }
    });
    if (changed) { store.set("achDone", achDone); }
    // Alle 12 erreicht: exklusiver Skin + 1.01x Dauer-Multiplier
    const total = ACHIEVEMENTS.length;
    const have = ACHIEVEMENTS.filter((a) => achDone[a.id]).length;
    if (have >= total && !allAchBonus) {
      allAchBonus = true; store.set("allAchBonus", true);
      inv["platin"] = (inv["platin"] || 0) + 1; if (typeof saveInv === "function") saveInv();
      if (typeof renderInventory === "function") renderInventory();
      rain("💎", "#e0e7ff", 60); sfx.win();
      toast("ALLE Achievements! Platin-Skin + dauerhaft 1.01x Coins freigeschaltet!");
    }
    if (typeof renderAch === "function") renderAch();
  }

  // Level
  // Shop-/Booster-State früh deklariert (von Level & addXP genutzt)
  let xpBoostUntil = store.get("xpBoostUntil", 0);
  let nextWinMult = 1; // Coins-Booster entfernt (stapelt sonst auf den Deckel) // einmaliger Coins-Booster: nächster Gewinn x2/x10
  let perks = store.get("perks", {});
  let ownedTitles = store.get("titles", []);
  let activeTitle = store.get("activeTitle", "");
  let prestige = store.get("prestige", 0); // Rebirth-Stufe: +5% Coins je Stufe
  // Hilfsfunktionen für Boni
  const boxPrice = () => perks.box ? 34 : 38; // erwarteter Verkaufswert ca. 34,1: ohne Perk ca. 10 % Hausvorteil, mit Perk fair
  const bonusPerMin = () => perks.bonus5 ? 50 : perks.bonus ? 20 : 10;
  // Dauerhafter Coin-Multiplikator aus Perks + Platin + Prestige (bewusst moderat)
  function coinMult() {
    // Gesamtbonus gedeckelt auf 1.10 (fair waere 1.111 bei 90 % Auszahlung): alles zusammen bleibt minimal unter fair
    return Math.min(1.10, (perks.coins ? 1.02 : 1) * (perks.coins15 ? 1.03 : 1) * (allAchBonus ? 1.01 : 1) * (1 + prestige * 0.005));
  }
  // Gewinn-Coins gutschreiben (nur bei echtem Gewinn aufrufen, nicht bei Push)
  function addWin(base) {
    let total = Math.floor(base * coinMult());
    if (nextWinMult > 1) { total = Math.floor(total * nextWinMult); toast(`Coins-Booster: Gewinn x${nextWinMult}!`); nextWinMult = 1; store.set("nextWinMult", 1); if (typeof updateWinBoost === "function") updateWinBoost(); }
    setCoins(coins + total);
    if (total > (stats.biggestWin || 0)) { stats.biggestWin = total; saveStats(); }
    if (typeof dailyBump === "function") dailyBump("won", total);
    if (total >= 5000) confetti(total >= 50000 ? 140 : 80); // Konfetti bei großen Gewinnen
    checkAch();
    return total;
  }

  let level = store.get("level", 1), xp = store.get("xp", 0);
  // Gesamte Spielzeit in Sekunden (nur, wenn der Tab sichtbar ist)
  setInterval(() => { if (document.visibilityState === "visible") store.set("playtime", store.get("playtime", 0) + 1); }, 1000);
  let claimedLevel = store.get("claimedLevel", 1); // bis zu diesem Level ist alles abgeholt
  const xpNeeded = (lvl) => 50 + (lvl - 1) * 40;
  // Bessere Level-Belohnungen: wachsen deutlich mit dem Level
  const levelReward = (lvl) => 100 + lvl * 50 + lvl * lvl * 5;
  const unclaimedCount = () => Math.max(0, level - claimedLevel);
  function renderLevel() {
    $("xpFill").style.width = Math.min(100, (xp / xpNeeded(level)) * 100) + "%";
    applyTitle();
  }
  function addXP(amount) {
    xp += Math.round(amount * (xpBoostUntil > Date.now() ? 2 : 1));
    let gained = false;
    while (xp >= xpNeeded(level)) { xp -= xpNeeded(level); level++; gained = true; }
    if (gained) { sfx.level(); rain("⭐", "#facc15", 25); toast(`Level ${level}! Belohnung im Level-Menü abholen 🎁`); }
    store.set("level", level); store.set("xp", xp); renderLevel();
    if (!$("levelModal").classList.contains("hidden")) renderLevelModal();
  }
  // Einsatzabhängige XP: Grund-XP + 1 XP pro 50 gesetzten Coins (gedeckelt bei +40)
  // XP hängt vom Einsatz ab: 1 XP pro 100 Coins, mindestens 1, gedeckelt bei 100.
  function addXPbet(bet) { addXP(Math.max(1, Math.min(100, Math.floor((bet || 0) / 100)))); }

  // Belohnungs-Lotterie beim Abholen
  function claimBurst(amount, label, color) {
    const el = $("claimBurst");
    el.querySelector(".amt").textContent = `+${fmt(amount)} 🪙`;
    el.querySelector(".amt").style.color = color || "#facc15";
    el.querySelector(".lbl").textContent = label;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  }

