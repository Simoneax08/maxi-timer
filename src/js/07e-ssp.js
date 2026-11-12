  // ---------- Schere Stein Papier gegen den Computer ----------
  // Sieg zahlt 1.7x (inkl. Einsatz), Unentschieden gibt den Einsatz zurück. Erwarteter Wert: (1.7 + 1) / 3 = 0.9
  const SSP = [{ ic: "✊", name: "Stein" }, { ic: "✋", name: "Papier" }, { ic: "✌️", name: "Schere" }];
  const SSP_BEATS = [2, 0, 1]; // Stein schlägt Schere, Papier schlägt Stein, Schere schlägt Papier
  let sspBusy = false;
  function sspPlay(me) {
    if (sspBusy) return;
    const bet = Math.floor(Number($("sspBet").value) || 0);
    if (bet < 1) { toast("Mindestens 1 Coin."); return; }
    if (bet > coins) { toast("Zu wenig Coins."); return; }
    sspBusy = true;
    setCoins(coins - bet); addXPbet(bet); sfx.click();
    const bot = Math.floor(Math.random() * 3);
    $("sspMe").textContent = SSP[me].ic; $("sspBot").textContent = "❔";
    $("sspResult").textContent = "...";
    setTimeout(() => {
      $("sspBot").textContent = SSP[bot].ic;
      let msg;
      if (SSP_BEATS[me] === bot) { const won = addWin(bet * 1.7); sfx.win(); rain("🏆", "#f59e0b", 20); msg = `${SSP[me].name} schlägt ${SSP[bot].name}! +${fmt(won)} Coins`; }
      else if (me === bot) { setCoins(coins + bet); sfx.click(); msg = "Unentschieden. Einsatz zurück."; }
      else { sfx.lose(); msg = `${SSP[bot].name} schlägt ${SSP[me].name}. ${fmt(bet)} Coins weg.`; }
      $("sspResult").textContent = msg;
      sspBusy = false;
    }, 700);
  }
  document.querySelectorAll(".sspPick").forEach((b) => b.addEventListener("click", () => sspPlay(Number(b.dataset.i))));
