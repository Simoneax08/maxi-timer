  // ---------- Chicken Road: Schritt für Schritt über die Straße ----------
  // Jeder Schritt kann mit Gegenverkehr enden. Je weiter, desto riskanter. Jederzeit kassieren.
  const CR_SURVIVE = (k) => Math.max(0.45, 0.96 - 0.05 * (k - 1)); // Überlebenschance bei Schritt k (ab 1)
  let crBet = 0, crStep = 0, crMult = 1, crLive = false;
  function crMultAt(k) {
    if (k < 1) return 1;
    let p = 1; for (let j = 1; j <= k; j++) p *= CR_SURVIVE(j);
    return Math.round((0.97 / p) * 100) / 100; // 3 % Hausvorteil
  }
  function crRender() {
    const risk = Math.round((1 - CR_SURVIVE(crStep + 1)) * 100);
    $("crInfo").textContent = `Schritt ${crStep} · x${crMult.toFixed(2)} · Gewinn ${fmt(Math.floor(crBet * crMult))} · nächster Schritt: ${risk} % Risiko`;
  }
  function crShowStart(show) {
    $("crStartBox").classList.toggle("hidden", !show);
    $("crPlay").classList.toggle("hidden", show);
  }
  function crStart() {
    if (crLive) return;
    const bet = Math.floor(Number($("crBet").value) || 0);
    if (bet < 1) { toast("Mindestens 1 Coin."); return; }
    if (bet > coins) { toast("Zu wenig Coins."); return; }
    setCoins(coins - bet); addXPbet(bet); sfx.click();
    crBet = bet; crStep = 0; crMult = 1; crLive = true;
    $("crRoad").innerHTML = ""; $("crResult").textContent = "";
    crShowStart(false); crRender();
  }
  function crWalk() {
    if (!crLive) return;
    const k = crStep + 1;
    const ok = Math.random() < CR_SURVIVE(k);
    const cell = document.createElement("div");
    cell.className = "road-step " + (ok ? "done" : "dead");
    cell.textContent = (ok ? "✓ " : "💥 ") + k;
    $("crRoad").appendChild(cell);
    if (!ok) {
      crLive = false; sfx.lose();
      $("crResult").textContent = `Angefahren bei Schritt ${k}. ${fmt(crBet)} Coins weg.`;
      crShowStart(true); return;
    }
    crStep = k; crMult = crMultAt(k); sfx.click(); crRender();
  }
  function crCash() {
    if (!crLive) return;
    if (crStep < 1) { toast("Erst mindestens einen Schritt gehen."); return; }
    const win = Math.floor(crBet * crMult);
    setCoins(coins + win); crLive = false;
    sfx.win(); rain("🪙", "#f59e0b", 20);
    $("crResult").textContent = `Kassiert: +${fmt(win)} Coins (x${crMult.toFixed(2)})`;
    crShowStart(true);
  }
  if ($("crStartBtn")) {
    $("crStartBtn").addEventListener("click", crStart);
    $("crWalkBtn").addEventListener("click", crWalk);
    $("crCashBtn").addEventListener("click", crCash);
  }
