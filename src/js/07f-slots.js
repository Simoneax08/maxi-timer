  // ---------- Slots: 3 Walzen, 3 gleiche gewinnen ----------
  // Erwarteter Wert: 0.064x6 + 0.0156x11 + 0.0034x25 + 0.0017x60 + 0.0005x300 = 0.8975 (ca. 10 % Hausvorteil)
  const SL_SYMS = [
    { ic: "🍒", p: 0.40, pay: 6 }, { ic: "🍋", p: 0.25, pay: 11 }, { ic: "🔔", p: 0.15, pay: 25 },
    { ic: "💎", p: 0.12, pay: 60 }, { ic: "7️⃣", p: 0.08, pay: 300 }
  ];
  let slBusy = false;
  function slPick() { const r = Math.random(); let acc = 0; for (const s of SL_SYMS) { acc += s.p; if (r < acc) return s; } return SL_SYMS[SL_SYMS.length - 1]; }
  function slSpin() {
    if (slBusy) return;
    const bet = Math.floor(Number($("slBet").value) || 0);
    if (bet < 1) { toast("Mindestens 1 Coin."); return; }
    if (bet > coins) { toast("Zu wenig Coins."); return; }
    slBusy = true; $("slSpinBtn").disabled = true; $("slResult").textContent = "";
    setCoins(coins - bet); addXPbet(bet); sfx.click();
    const finals = [slPick(), slPick(), slPick()];
    const reels = [...document.querySelectorAll(".sl-reel")];
    reels.forEach((r) => r.classList.remove("win"));
    const timers = reels.map((reel) => {
      reel.classList.add("spinning");
      return setInterval(() => { reel.textContent = SL_SYMS[Math.floor(Math.random() * SL_SYMS.length)].ic; }, 70);
    });
    finals.forEach((sym, i) => {
      setTimeout(() => {
        clearInterval(timers[i]); reels[i].classList.remove("spinning");
        reels[i].textContent = sym.ic; reels[i].classList.add("stop");
        setTimeout(() => reels[i].classList.remove("stop"), 300);
        sfx.click();
        if (i === 2) slFinish(finals, bet);
      }, 900 + i * 450);
    });
  }
  function slFinish(finals, bet) {
    slBusy = false; $("slSpinBtn").disabled = false;
    const [a, b, c] = finals;
    if (a === b && b === c) {
      const won = addWin(bet * a.pay); sfx.win(); rain(a.ic, "#f59e0b", 28);
      document.querySelectorAll(".sl-reel").forEach((r) => r.classList.add("win"));
      $("slResult").textContent = `${a.ic} ${a.ic} ${a.ic}! +${fmt(won)} Coins (x${a.pay})`;
    } else {
      sfx.lose(); $("slResult").textContent = `Kein Gewinn. ${fmt(bet)} Coins weg.`;
    }
  }
  if ($("slSpinBtn")) $("slSpinBtn").addEventListener("click", slSpin);
