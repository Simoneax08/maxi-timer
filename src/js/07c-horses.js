  // ---------- Pferderennen: 4 Pferde, feste Quoten, Wette nur vor dem Start ----------
  const HORSES = [
    { name: "Blitz", p: 0.42 }, { name: "Donner", p: 0.28 }, { name: "Schatten", p: 0.18 }, { name: "Wirbel", p: 0.12 }
  ].map((h) => ({ ...h, odds: Math.round((0.90 / h.p) * 100) / 100 })); // 10 % Hausvorteil
  let hrPick = 0, hrRacing = false;
  function hrBuildUI() {
    $("hrPick").innerHTML = HORSES.map((h, i) => `<button class="hrPickBtn${i === hrPick ? " picked" : ""}" data-i="${i}">🐎 ${h.name} x${h.odds.toFixed(2)}</button>`).join("");
    $("hrTrack").innerHTML = HORSES.map((h, i) => `<div class="hr-lane"><span class="hr-name">${h.name}</span><div class="hr-lane-track"><span class="hr-horse" id="hrH${i}">🐎</span><span class="hr-finish"></span></div></div>`).join("");
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
    HORSES.forEach((_, i) => { const hz = $("hrH" + i); hz.style.left = "0%"; hz.style.transform = "translate(0,-50%)"; hz.classList.add("run"); hz.parentElement.parentElement.classList.remove("win"); });
    const t0 = performance.now();
    const tick = () => {
      const t = performance.now() - t0;
      HORSES.forEach((_, i) => { const p = Math.min(100, (t / finish[i]) * 100); const hz = $("hrH" + i); hz.style.left = p + "%"; hz.style.transform = `translate(-${p}%,-50%)`; });
      if (t < end) requestAnimationFrame(tick); else hrFinish(winner, bet);
    };
    requestAnimationFrame(tick);
  }
  function hrFinish(winner, bet) {
    hrRacing = false; $("hrGo").disabled = false;
    HORSES.forEach((_, i) => $("hrH" + i).classList.remove("run"));
    $("hrH" + winner).parentElement.parentElement.classList.add("win");
    if (winner === hrPick) {
      const win = addWin(bet * HORSES[winner].odds); sfx.win(); rain("🏆", "#f59e0b", 24);
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
