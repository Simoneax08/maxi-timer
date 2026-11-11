  // ---------- Belohnungs-Spin (CS-Case-Style Band, beim Level-Abholen) ----------
  // Felder: Faktor, Gewicht (Chance), Farbe, Label
  const REWARD_SEGS = [
    { mult: 1,  weight: 70, color: "#f59e0b", label: "x1" },
    { mult: 2,  weight: 20, color: "#22c55e", label: "x2" },
    { mult: 5,  weight: 8,  color: "#3b82f6", label: "x5" },
    { mult: 20, weight: 2,  color: "#a855f7", label: "JACKPOT" }
  ];
  const rwTotalW = REWARD_SEGS.reduce((a, s) => a + s.weight, 0);
  function rwPick() { let x = Math.random() * rwTotalW; for (const s of REWARD_SEGS) { if (x < s.weight) return s; x -= s.weight; } return REWARD_SEGS[0]; }
  function rwItem(seg, base) {
    const d = document.createElement("div");
    d.className = "rs-item";
    d.style.background = seg.color;
    d.style.borderBottomColor = "rgba(0,0,0,.4)";
    d.innerHTML = `<span class="rs-mult">${seg.label}</span><span class="rs-amt">${fmt(Math.floor(base * seg.mult))}</span>`;
    return d;
  }
  let rwSpinning = false;

  function claimLevel(lvl) {
    if (lvl > level || lvl <= claimedLevel || rwSpinning) return;
    const chosen = rwPick();
    const base = levelReward(lvl);
    const coinsWon = Math.floor(base * chosen.mult);
    rwSpinning = true;

    // Band aufbauen: viele zufällige Felder, Gewinnfeld an fester Position
    const strip = $("rsStrip");
    const WIN_IDX = 40;
    strip.style.transition = "none"; strip.style.transform = "translateX(0)";
    strip.innerHTML = "";
    for (let i = 0; i < 48; i++) strip.appendChild(rwItem(i === WIN_IDX ? chosen : rwPick(), base));
    $("rewardSpinWrap").classList.remove("hidden");
    $("rsResult").textContent = "Spinnt...";
    $("rsResult").style.color = "";
    // auf das Gewinnfeld unter die gelbe Linie schieben (Item 96px + 8px gap = 104)
    const ITEM = 104;
    const winRow = $("rsStrip").parentElement;
    const offset = 9 + WIN_IDX * ITEM + 48 - winRow.clientWidth / 2 + rnd(-24, 24);
    strip.offsetWidth; // reflow
    strip.style.transition = "transform 3.4s cubic-bezier(.12,.75,.15,1)";
    strip.style.transform = `translateX(-${offset}px)`;

    setTimeout(() => {
      rwSpinning = false;
      setCoins(coins + coinsWon);
      claimedLevel = lvl; store.set("claimedLevel", claimedLevel);
      $("rsResult").style.color = chosen.color;
      $("rsResult").textContent = `Level ${lvl}: ${chosen.label} → +${fmt(coinsWon)} Coins!`;
      if (chosen.mult >= 5) { rain("✨", chosen.color, 50); sfx.win(); } else { rain("🪙", "#f59e0b", 20); sfx.coin(); }
      claimBurst(coinsWon, `Level ${lvl} · ${chosen.label}`, chosen.color);
      renderLevel(); renderLevelModal();
    }, 3600);
  }
  function claimAll() {
    if (rwSpinning) return;
    const next = claimedLevel + 1;
    if (next > level) return;
    claimLevel(next);
    if (claimedLevel < level) setTimeout(claimAll, 3900);
  }

  function renderLevelModal() {
    $("lmTitle").textContent = "Level " + level;
    const need = xpNeeded(level);
    $("lmProgress").textContent = `${xp} / ${need} XP`;
    $("lmBar").style.width = Math.min(100, (xp / need) * 100) + "%";
    $("lmNeed").textContent = `Noch ${Math.max(0, need - xp)} XP bis Level ${level + 1}.`;
    $("lmRewards").innerHTML = "";

    const u = unclaimedCount();
    // Abholbare Level
    if (u > 0) {
      const head = document.createElement("p"); head.style.fontWeight = "700"; head.style.margin = "4px 0";
      head.innerHTML = `🎁 Abholbar (${u}) <span style="color:#94a3b8;font-weight:400;font-size:.8rem;">Spin entscheidet: x1, x2, x5 oder Jackpot</span>`;
      $("lmRewards").appendChild(head);
      const allBtn = document.createElement("button"); allBtn.textContent = "Alle abholen"; allBtn.style.background = "#22c55e"; allBtn.style.color = "#052e16"; allBtn.style.width = "100%"; allBtn.style.marginBottom = "8px";
      allBtn.addEventListener("click", claimAll); $("lmRewards").appendChild(allBtn);
      for (let lv = claimedLevel + 1; lv <= level; lv++) {
        const row = document.createElement("div"); row.className = "reward-row";
        const label = document.createElement("span"); label.className = "lv"; label.textContent = `Level ${lv}`;
        const b = document.createElement("button"); b.textContent = `Abholen (~${fmt(levelReward(lv))})`; b.style.padding = "6px 12px"; b.style.fontSize = ".78rem"; b.style.background = "#eab308"; b.style.color = "#1f1300";
        b.addEventListener("click", () => claimLevel(lv));
        row.append(label, b); $("lmRewards").appendChild(row);
      }
    }
    // Vorschau nächste Level
    const head2 = document.createElement("p"); head2.style.fontWeight = "700"; head2.style.margin = "14px 0 4px";
    head2.textContent = "Kommende Level";
    $("lmRewards").appendChild(head2);
    for (let i = 1; i <= 5; i++) { const lv = level + i; const row = document.createElement("div"); row.className = "reward-row"; row.innerHTML = `<span class="lv">Level ${lv}</span><span>~${fmt(levelReward(lv))} 🪙</span>`; $("lmRewards").appendChild(row); }
  }
  $("levelBox").addEventListener("click", () => { sfx.click(); renderLevelModal(); $("levelModal").classList.remove("hidden"); });
  $("levelClose").addEventListener("click", () => { sfx.click(); $("levelModal").classList.add("hidden"); });
  $("levelModal").addEventListener("click", (e) => { if (e.target === $("levelModal")) $("levelModal").classList.add("hidden"); });
  renderLevel();

  // XP-Booster-Leiste (5 Min Laufzeit)
  const XP_BOOST_MS = 5 * 60000;
  function updateBoostBar() {
    const left = xpBoostUntil - Date.now();
    if (left > 0) {
      $("boostWrap").classList.remove("hidden");
      const secs = Math.ceil(left / 1000);
      $("boostLabel").textContent = `⚡ XP x2 · ${Math.floor(secs/60)}:${pad(secs%60)}`;
      $("boostFill").style.width = Math.min(100, (left / XP_BOOST_MS) * 100) + "%";
    } else {
      $("boostWrap").classList.add("hidden");
    }
  }
  updateBoostBar(); setInterval(updateBoostBar, 1000);

  // Anzeige für den einmaligen Coins-Booster (nächster Gewinn)
  function updateWinBoost() {
    if (nextWinMult > 1) { $("winBoostBadge").classList.remove("hidden"); $("winBoostBadge").textContent = `💰 Nächster Gewinn x${nextWinMult}`; }
    else { $("winBoostBadge").classList.add("hidden"); }
  }
  updateWinBoost();

  function rain(text, color, count = 40) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span"); el.className = "drop"; el.textContent = text;
      el.style.left = Math.random() * 100 + "vw"; el.style.color = color;
      el.style.fontSize = 12 + Math.random() * 10 + "px";
      el.style.animationDuration = 2 + Math.random() * 2 + "s"; el.style.animationDelay = Math.random() * 1.5 + "s";
      document.body.appendChild(el); setTimeout(() => el.remove(), 6000);
    }
  }
  // Konfetti bei großen Gewinnen
  const CONFETTI_COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ef4444", "#22d3ee", "#facc15"];
  function confetti(count = 80) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div"); el.className = "confetti";
      el.style.left = Math.random() * 100 + "vw";
      el.style.background = CONFETTI_COLORS[rnd(0, CONFETTI_COLORS.length - 1)];
      el.style.animationDuration = 2.2 + Math.random() * 2 + "s"; el.style.animationDelay = Math.random() * 0.6 + "s";
      el.style.width = 6 + Math.random() * 8 + "px"; el.style.height = 8 + Math.random() * 10 + "px";
      el.style.opacity = 0.8 + Math.random() * 0.2;
      document.body.appendChild(el); setTimeout(() => el.remove(), 5000);
    }
  }

  function tick() {
    const diff = PLF - Date.now();
    if (diff <= 0) { $("countdown").textContent = "Vorbei. Hoffentlich hast du gelernt."; document.title = "PLF vorbei"; document.body.classList.remove("panic"); return; }
    const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24, m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60;
    $("countdown").innerHTML = `${d}<small>T</small> ${pad(h)}<small>h</small> ${pad(m)}<small>m</small> ${pad(s)}<small>s</small> ${pad(diff % 1000, 3)}<small>ms</small>`;
    document.title = `${d}T ${pad(h)}:${pad(m)}:${pad(s)} bis zur PLF`;
    document.body.classList.toggle("panic", diff < 86400000);
    requestAnimationFrame(tick);
  }
  tick();
  document.addEventListener("visibilitychange", () => { if (document.hidden) document.title = "Komm zurück und lern!"; });

  const tickerLines = [
    () => `Maxi hat vor ${rnd(2, 9)} Stunden zuletzt IntelliJ geöffnet`,
    () => `Maxi hat heute ${rnd(4, 30)} Mal YouTube statt Java geöffnet`,
    () => `Letzter erfolgreicher Compile: vor ${rnd(3, 40)} Tagen`,
    () => `Maxi hat heute ${rnd(10, 99)} Semikolons vergessen`,
    () => `Maxi googelt gerade: "Was ist eine Klasse"`,
    () => `Maxi hat ${rnd(0, 2)} von 47 Übungsaufgaben gemacht`
  ];
  const showTicker = () => { $("ticker").textContent = tickerLines[rnd(0, tickerLines.length - 1)](); };
  showTicker(); setInterval(showTicker, 4000);
  setInterval(() => { $("chance").textContent = (0.1 + Math.random() * 11.9).toFixed(1) + " %"; }, 1000);

  let progress = 3;
  setInterval(() => {
    progress += Math.random() < 0.6 ? -Math.random() * 2 : Math.random() * 1.5;
    progress = Math.min(7, Math.max(0.5, progress));
    $("barFill").style.width = progress + "%"; $("barFill").style.background = progress < 2 ? "#ef4444" : "#22c55e";
    $("barLabel").textContent = progress.toFixed(1) + " %";
  }, 1500);

  $("learnBtn").addEventListener("click", () => {
    rain("NullPointerException", "#ef4444");
    if (store.get("learnDay", "") !== todayKey()) { store.set("learnDay", todayKey()); setCoins(coins + 20); addXP(15); sfx.coin(); $("learnBtn").textContent = "+20 Coins. Glaub ich dir trotzdem nicht."; }
    else { $("learnBtn").textContent = "Schon wieder? Sicher nicht."; }
  });

  // Minuten-Bonus: einmal pro Minute abholbar, sammelt sich NICHT an
  if (!store.get("lastBonus", null)) store.set("lastBonus", Date.now() - 60000);
  function bonusReady() { return Date.now() - store.get("lastBonus", Date.now()) >= 60000; }
  function updateCollect() {
    if (bonusReady()) {
      $("collectBtn").disabled = false; $("collectBtn").textContent = `🪙 ${bonusPerMin()} Coins abholen`;
      $("collectInfo").textContent = "Jetzt abholen, sonst verfällt die Minute.";
    } else {
      $("collectBtn").disabled = true;
      const secs = 60 - Math.floor((Date.now() - store.get("lastBonus", Date.now())) / 1000);
      $("collectBtn").textContent = `🪙 Nächste in ${secs}s`;
      $("collectInfo").textContent = "Pro Minute gibt es genau einmal. Verpasst ist verpasst.";
    }
  }
  updateCollect(); setInterval(updateCollect, 1000);
  $("collectBtn").addEventListener("click", () => {
    if (!bonusReady()) return;
    setCoins(coins + bonusPerMin()); addXP(1); sfx.coin(); rain("🪙", "#22c55e", 12);
    store.set("lastBonus", Date.now()); updateCollect();
  });

  // Daily Chest
  function updateChest() {
    if (store.get("chestDay", "") === todayKey()) {
      $("chestBtn").disabled = true; $("chestBtn").textContent = "🔒 Schon geöffnet";
      const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
      const ms = mid - now;
      $("chestTimer").textContent = `Nächste Truhe in ${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}`;
    } else { $("chestBtn").disabled = false; $("chestBtn").textContent = "🎁 Truhe öffnen"; $("chestTimer").textContent = ""; }
  }
  updateChest(); setInterval(updateChest, 1000);
  $("chestBtn").addEventListener("click", () => {
    if (store.get("chestDay", "") === todayKey()) return;
    $("chestBtn").disabled = true; $("chestBtn").classList.add("opening"); sfx.click();
    setTimeout(() => {
      $("chestBtn").classList.remove("opening");
      const r = Math.random(); let win, msg;
      if (r < 0.10) { win = 0; msg = "Die Truhe war leer. Wie dein Kopf vor der PLF."; }
      else if (r < 0.13) { win = 200; msg = "JACKPOT! +200 Coins. Bestanden hast du trotzdem nicht."; }
      else { win = rnd(10, 50); msg = `+${win} Coins. Kauf dir davon ein Java-Buch.`; }
      setCoins(coins + win); store.set("chestDay", todayKey()); $("chestText").textContent = msg;
      if (win > 0) { rain("🪙", "#f59e0b", 30); addXP(20); sfx.coin(); } else sfx.lose();
      updateChest();
    }, 1200);
  });

  // Wheel of Fortune
  const cv = $("wheel"), ctx = cv.getContext("2d"), C = 320, rad = (d) => d * Math.PI / 180;
  // Ausbalanciert auf ~5% Hausvorteil (Einsatz 10, erwartete Auszahlung 9.5)
  const wheelSegs = [
    { label: "BESTANDEN", weight: 0.5, coins: 500, color: "#22c55e", pass: true },
    { label: "+100", weight: 1.5, coins: 100, color: "#16a34a" },
    { label: "+50", weight: 4, coins: 50, color: "#16a34a" },
    { label: "+20", weight: 10, coins: 20, color: "#15803d" },
    { label: "+10", weight: 10, coins: 10, color: "#15803d" },
    { label: "Niete", weight: 28, coins: 0, color: "#b91c1c" },
    { label: "5er", weight: 23, coins: 0, color: "#ef4444" },
    { label: "Durchgefallen", weight: 23, coins: 0, color: "#991b1b" }
  ];
  // gleich große Segmente fürs Zeichnen, Gewicht nur fürs Ergebnis
  const totalW = wheelSegs.reduce((a, s) => a + s.weight, 0);
  const segAngle = 360 / wheelSegs.length;
  wheelSegs.forEach((s, i) => { s.drawStart = i * segAngle; s.drawEnd = (i + 1) * segAngle; });
  function drawWheel() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    wheelSegs.forEach((s) => {
      ctx.beginPath(); ctx.moveTo(C, C); ctx.arc(C, C, C - 8, rad(s.drawStart - 90), rad(s.drawEnd - 90)); ctx.closePath();
      ctx.fillStyle = s.color; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 2; ctx.stroke();
      // Label gerade lesbar, entlang des Radius
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate(rad((s.drawStart + s.drawEnd) / 2 - 90));
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = s.pass ? "800 20px system-ui" : "700 18px system-ui";
      ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 3;
      ctx.translate(C * 0.62, 0);
      ctx.rotate(rad(90)); // Text aufrecht stellen
      ctx.fillText(s.label, 0, 0);
      ctx.restore();
    });
    // Nabe
    ctx.beginPath(); ctx.arc(C, C, 46, 0, Math.PI * 2); ctx.fillStyle = "#0b1120"; ctx.fill();
    ctx.strokeStyle = "#facc15"; ctx.lineWidth = 5; ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = "#facc15"; ctx.font = "800 22px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🎡", C, C);
  }
  drawWheel();

  let rotation = 0, spinning = false;
  $("spinBtn").addEventListener("click", () => {
    if (spinning) return;
    if (coins < 10) { $("spinResult").textContent = "Pleite. Hol dir den Minuten-Bonus."; return; }
    setCoins(coins - 10); sfx.click(); bump("spins");
    let x = Math.random() * totalW, chosen = wheelSegs[0];
    for (const s of wheelSegs) { if (x < s.weight) { chosen = s; break; } x -= s.weight; }
    // Mitte des gezeichneten Segments (oben = 0°, da wir beim Zeichnen -90° genutzt haben)
    const mid = (chosen.drawStart + chosen.drawEnd) / 2;
    const current = ((rotation % 360) + 360) % 360;
    let delta = (360 - mid - current) % 360; if (delta < 0) delta += 360;
    rotation += 1800 + delta + (Math.random() * (segAngle * 0.5) - segAngle * 0.25);
    spinning = true; $("spinResult").textContent = "Dreht sich...";
    cv.style.transform = `rotate(${rotation}deg)`;
    setTimeout(() => {
      spinning = false; addXPbet(10);
      if (chosen.coins > 0) {
        const won = addWin(chosen.coins);
        sfx.win();
        if (chosen.pass) { rain("🎉", "#22c55e", 60); $("spinResult").textContent = `BESTANDEN?! Statistisch unmöglich. +${fmt(won)} Coins`; }
        else { rain("🪙", "#f59e0b", 15); $("spinResult").textContent = `+${fmt(won)} Coins! Glück gehabt.`; }
      } else {
        sfx.lose(); $("spinResult").textContent = `${chosen.label}. War ja klar.`;
        stats.totalLost = (stats.totalLost || 0) + 10; saveStats(); checkAch();
      }
    }, 5600);
  });

  // Münz-Skins mit je eigener Animation
  const COIN_SKINS = [
    { id: "gold", name: "Gold", price: 0, grad: "radial-gradient(circle at 30% 30%, #fde68a, #f59e0b 60%, #b45309)", text: "#1f1300" },
    { id: "silver", name: "Silber", price: 100, grad: "radial-gradient(circle at 30% 30%, #f1f5f9, #94a3b8 60%, #475569)", text: "#1e293b" },
    { id: "emerald", name: "Smaragd", price: 250, grad: "radial-gradient(circle at 30% 30%, #86efac, #22c55e 60%, #15803d)", text: "#052e16" },
    { id: "ruby", name: "Rubin", price: 400, grad: "radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 60%, #991b1b)", text: "#fff" },
    { id: "diamond", name: "Diamant", price: 1000, grad: "radial-gradient(circle at 30% 30%, #cffafe, #22d3ee 60%, #0891b2)", text: "#083344" },
    { id: "plasma", name: "Plasma", price: 5000, grad: "linear-gradient(135deg, #22d3ee, #a855f7, #f472b6, #22d3ee)", text: "#fff" },
    { id: "singularity", name: "Singularität", price: 10000, grad: "conic-gradient(from 0deg, #a855f7, #22d3ee, #f472b6, #facc15, #a855f7)", text: "#fff" }
  ];
  let ownedCoinSkins = store.get("coinSkins", ["gold"]);
  let coinSkin = store.get("coinSkin", "gold");
  function applyCoinSkin(id) {
    const s = COIN_SKINS.find((x) => x.id === id) || COIN_SKINS[0];
    const coin = $("flipCoin");
    coin.style.background = s.grad; coin.style.color = s.text;
    coinSkin = id; store.set("coinSkin", id); renderCoinShop();
  }
  function renderCoinShop() {
    $("coinSkinShop").innerHTML = "";
    COIN_SKINS.forEach((s) => {
      const owned = ownedCoinSkins.includes(s.id);
      const card = document.createElement("div");
      card.className = "coinSkinCard" + (s.id === coinSkin ? " active" : "");
      const prev = document.createElement("div"); prev.className = "coinPreview";
      prev.style.background = s.grad;
      const name = document.createElement("div"); name.style.fontSize = ".8rem"; name.style.fontWeight = "700"; name.textContent = s.name;
      const btn = document.createElement("button"); btn.style.fontSize = ".72rem"; btn.style.padding = "6px 10px";
      if (!owned) { btn.textContent = `${fmt(s.price)} 🪙`; btn.style.background = "#eab308"; btn.style.color = "#1f1300";
        btn.addEventListener("click", () => { if (coins < s.price) { toast("Zu teuer."); return; } setCoins(coins - s.price); ownedCoinSkins.push(s.id); store.set("coinSkins", ownedCoinSkins); sfx.coin(); applyCoinSkin(s.id); });
      } else if (s.id === coinSkin) { btn.textContent = "Aktiv"; btn.disabled = true; btn.style.background = "#22c55e"; btn.style.color = "#052e16"; }
      else { btn.textContent = "Equip"; btn.style.background = "#22c55e"; btn.style.color = "#052e16"; btn.addEventListener("click", () => { sfx.click(); applyCoinSkin(s.id); }); }
      card.append(prev, name, btn); $("coinSkinShop").appendChild(card);
    });
  }
  applyCoinSkin(coinSkin);

  // Münzwurf
  document.querySelectorAll(".betMul").forEach((b) => b.addEventListener("click", () => {
    const target = b.dataset.target || "betInput";
    let v = Math.floor(Number($(target).value)) || 1;
    v = b.dataset.mul === "double" ? v * 2 : Math.max(1, Math.floor(v / 2));
    $(target).value = v; sfx.click();
  }));
  let flipping = false;
  const loseTexts = ["Das Haus gewinnt immer. Wie die PLF.", "Genauso viel Glück wie bei Java.", "Vielleicht doch lieber lernen?", "Die Münze hat auch nicht an dich geglaubt.", "Statistisch gesehen warst du eh chancenlos."];
  function flip(choice) {
    if (flipping) return;
    const bet = Math.floor(Number($("betInput").value));
    if (!bet || bet < 1) { $("flipResult").textContent = "Einsatz eingeben. So schwer ist das nicht."; return; }
    if (bet > coins) { $("flipResult").textContent = "So viele Coins hast du nicht. Rechnen ist auch nicht deine Stärke."; return; }
    setCoins(coins - bet); flipping = true; sfx.click(); bump("flips");
    $("flipCoin").textContent = "?"; $("flipCoin").classList.add("flipping");
    $("flipResult").textContent = "Die Münze fliegt...";
    const win = Math.random() < 0.45;
    const other = choice === "Kopf" ? "Zahl" : "Kopf";
    setTimeout(() => {
      $("flipCoin").classList.remove("flipping");
      $("flipCoin").textContent = win ? choice : other; flipping = false; addXPbet(bet);
      if (win) { const won = addWin(bet * 2); sfx.win(); rain("🪙", "#f59e0b", 20); $("flipResult").textContent = `${choice}! +${fmt(won)} Coins. Glück gehabt, Können war es nicht.`; }
      else { stats.totalLost = (stats.totalLost || 0) + bet; saveStats(); checkAch(); if (coins === 0) { sfx.lose(); $("flipResult").textContent = `${other}. Alles weg. Hol den Minuten-Bonus.`; } else { sfx.lose(); $("flipResult").textContent = `${other}. -${bet} Coins. ${loseTexts[rnd(0, loseTexts.length - 1)]}`; } }
    }, 1500);
  }
  $("flipHeads").addEventListener("click", () => flip("Kopf"));
  $("flipTails").addEventListener("click", () => flip("Zahl"));

  // Zahlen raten
  const HOUSE = 0.9; // 10 % Hausvorteil
  function updateGuessCalc() {
    const range = Number($("guessRange").value);
    const bet = Math.floor(Number($("guessBet").value)) || 0;
    const payout = Math.floor(bet * range * HOUSE);
    $("guessCalc").innerHTML = `Trefferchance: <b>1 zu ${fmt(range)}</b> · Multiplikator: <b>${fmt(range)}x</b> · Gewinn bei Treffer: <b style="color:#22c55e">${fmt(payout)} Coins</b>`;
    $("guessInput").max = range; $("guessInput").placeholder = `1 - ${fmt(range)}`;
  }
  $("guessRange").addEventListener("change", () => { updateGuessCalc(); sfx.click(); });
  $("guessBet").addEventListener("input", updateGuessCalc);
  updateGuessCalc();
  function doGuess() {
    const range = Number($("guessRange").value);
    const bet = Math.floor(Number($("guessBet").value));
    const g = Math.floor(Number($("guessInput").value));
    if (!bet || bet < 1) { $("guessResult").style.color = ""; $("guessResult").textContent = "Einsatz eingeben."; return; }
    if (bet > coins) { $("guessResult").style.color = ""; $("guessResult").textContent = "So viele Coins hast du nicht."; return; }
    if (!g || g < 1 || g > range) { $("guessResult").style.color = ""; $("guessResult").textContent = `Zahl zwischen 1 und ${fmt(range)} eingeben.`; return; }
    setCoins(coins - bet); sfx.click(); addXPbet(bet);
    const secret = rnd(1, range);
    if (g === secret) {
      const win = addWin(bet * range * HOUSE);
      sfx.win(); rain("🪙", "#22c55e", 60); toast(`JACKPOT! +${fmt(win)} Coins`);
      $("guessResult").style.color = "#22c55e"; $("guessResult").textContent = `Die Zahl war ${secret}. GETROFFEN! +${fmt(win)} Coins. Das glaubt dir keiner.`;
    } else {
      sfx.lose(); stats.totalLost = (stats.totalLost || 0) + bet; saveStats(); checkAch();
      $("guessResult").style.color = "#ef4444"; $("guessResult").textContent = `Die Zahl war ${secret}, du hattest ${g}. Daneben. -${bet} Coins. Wie bei der PLF.`;
    }
  }
  $("guessGo").addEventListener("click", doGuess);
  $("guessInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doGuess(); });

