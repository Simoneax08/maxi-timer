  // ---------- Pferderennen: 4 Pferde, feste Quoten, Wette nur vor dem Start ----------
  const HORSES = [
    { name: "Blitz", p: 0.42 }, { name: "Donner", p: 0.28 }, { name: "Schatten", p: 0.18 }, { name: "Wirbel", p: 0.12 }
  ].map((h) => ({ ...h, odds: Math.round((0.90 / h.p) * 100) / 100 })); // 10 % Hausvorteil
  let hrPick = 0, hrRacing = false;
  function hrBuildUI() {
    $("hrPick").innerHTML = HORSES.map((h, i) => `<button class="hrPickBtn${i === hrPick ? " picked" : ""}" data-i="${i}">🐎 ${h.name} x${h.odds.toFixed(2)}</button>`).join("");
    $("hrTrack").innerHTML = HORSES.map((h, i) => `<div class="horse-row"><span class="horse-name">🐎 ${h.name}</span><div class="horse-bar"><i id="hrBar${i}"></i></div></div>`).join("");
  }
  function hrStart() {
    if (hrRacing) return;
    const bet = Math.floor(Number($("hrBet").value) || 0);
    if (bet < 1) { toast("Mindestens 1 Coin."); return; }
    if (bet > coins) { toast("Zu wenig Coins."); return; }
    setCoins(coins - bet); addXPbet(bet); sfx.click();
    // Sieger zuerst auslosen, dann das Rennen dazu zeigen
    const r = Math.random(); let acc = 0, winner = HORSES.length - 1;
    for (let i = 0; i < HORSES.length; i++) { acc += HORSES[i].p; if (r < acc) { winner = i; break; } }
    const T = 3000;
    const finish = HORSES.map((_, i) => i === winner ? T : T + 200 + Math.random() * 1200);
    const end = Math.max(...finish);
    hrRacing = true; $("hrGo").disabled = true; $("hrResult").textContent = "Rennen läuft...";
    HORSES.forEach((_, i) => { $("hrBar" + i).style.width = "0%"; });
    const t0 = performance.now();
    const tick = () => {
      const t = performance.now() - t0;
      HORSES.forEach((_, i) => { $("hrBar" + i).style.width = Math.min(100, (t / finish[i]) * 100) + "%"; });
      if (t < end) requestAnimationFrame(tick); else hrFinish(winner, bet);
    };
    requestAnimationFrame(tick);
  }
  function hrFinish(winner, bet) {
    hrRacing = false; $("hrGo").disabled = false;
    if (winner === hrPick) {
      const win = Math.floor(bet * HORSES[winner].odds);
      setCoins(coins + win); sfx.win(); rain("🏆", "#f59e0b", 24);
      $("hrResult").textContent = `${HORSES[winner].name} gewinnt! +${fmt(win)} Coins`;
    } else {
      sfx.lose();
      $("hrResult").textContent = `${HORSES[winner].name} gewinnt. ${fmt(bet)} Coins weg.`;
    }
  }
  if ($("hrGo")) {
    hrBuildUI();
    $("hrGo").addEventListener("click", hrStart);
    $("hrPick").addEventListener("click", (e) => {
      const b = e.target.closest(".hrPickBtn");
      if (!b || hrRacing) return;
      hrPick = Number(b.dataset.i); hrBuildUI();
    });
  }
