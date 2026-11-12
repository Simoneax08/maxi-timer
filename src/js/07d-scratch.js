  // ---------- Rubbellos: 3 Felder freirubbeln, 3 gleiche gewinnen ----------
  // Erwarteter Wert: 0.45^3 x3 + 0.35^3 x12 + 0.2^3 x14 = 0.90 (10 % Hausvorteil)
  const SCR_SYMS = [{ ic: "🍀", p: 0.45, mult: 3 }, { ic: "💎", p: 0.35, mult: 12 }, { ic: "🎰", p: 0.2, mult: 14 }];
  let scrBet = 0, scrCells = [], scrOpen = [], scrLive = false;
  function scrPick() { const r = Math.random(); let acc = 0; for (const s of SCR_SYMS) { acc += s.p; if (r < acc) return s; } return SCR_SYMS[SCR_SYMS.length - 1]; }
  function scrRender() {
    const box = $("scrCells"); box.innerHTML = "";
    scrCells.forEach((sym, i) => {
      const c = document.createElement("button");
      c.className = "scr-cell" + (scrOpen[i] ? " open" : "");
      c.textContent = scrOpen[i] ? sym.ic : "❔";
      c.addEventListener("click", () => scrReveal(i));
      box.appendChild(c);
    });
  }
  function scrBuy() {
    if (scrLive) return;
    const bet = Math.floor(Number($("scrBet").value) || 0);
    if (bet < 1) { toast("Mindestens 1 Coin."); return; }
    if (bet > coins) { toast("Zu wenig Coins."); return; }
    setCoins(coins - bet); addXPbet(bet); sfx.click();
    scrBet = bet; scrCells = [scrPick(), scrPick(), scrPick()]; scrOpen = [false, false, false]; scrLive = true;
    $("scrResult").textContent = ""; scrRender();
    $("scrBuyBtn").disabled = true; $("scrAllBtn").disabled = false;
  }
  function scrReveal(i) {
    if (!scrLive || scrOpen[i]) return;
    scrOpen[i] = true; sfx.click(); scrRender();
    if (scrOpen.every(Boolean)) scrFinish();
  }
  function scrFinish() {
    scrLive = false;
    const [a, b, c] = scrCells;
    let msg;
    if (a === b && b === c) {
      const won = addWin(scrBet * a.mult);
      sfx.win(); rain(a.ic, "#f59e0b", 24);
      msg = `${a.ic} ${a.ic} ${a.ic}! Gewinn +${fmt(won)} Coins (x${a.mult})`;
    } else { sfx.lose(); msg = `Keine Drillingsreihe. ${fmt(scrBet)} Coins weg.`; }
    $("scrResult").textContent = msg; toast(msg);
    $("scrBuyBtn").disabled = false; $("scrAllBtn").disabled = true;
  }
  if ($("scrBuyBtn")) {
    $("scrBuyBtn").addEventListener("click", scrBuy);
    $("scrAllBtn").addEventListener("click", () => { if (!scrLive) return; scrOpen = [true, true, true]; scrRender(); scrFinish(); });
    $("scrAllBtn").disabled = true;
  }
