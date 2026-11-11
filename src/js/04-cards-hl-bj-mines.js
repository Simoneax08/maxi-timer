  // ---------- Higher or Lower ----------
  // Rang 1 = Ass (niedrig) ... 13 = König (hoch)
  const HL_RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const HL_SUITS = ["♠", "♥", "♦", "♣"];
  const HL_MULT = 1.1; // pro Treffer, deutlich unter der echten Trefferchance -> Haus gewinnt
  let hlActive = false, hlRank = 0, hlSuit = 0, hlPot = 0, hlStreak = 0;
  function drawHlCard(rank, suit) {
    const el = $("hlCard");
    el.textContent = HL_RANKS[rank] + HL_SUITS[suit];
    el.classList.toggle("red", suit === 1 || suit === 2);
    el.classList.remove("flip"); void el.offsetWidth; el.classList.add("flip");
  }
  function hlUpdatePot() {
    $("hlPot").textContent = `Serie: ${hlStreak}`;
    $("hlCash").textContent = `💰 Cashen (${fmt(Math.floor(hlPot))} Coins)`;
    $("hlCash").disabled = hlStreak < 1; // cashen erst nach dem ersten Tipp
  }
  $("hlStartBtn").addEventListener("click", () => {
    if (hlActive) return;
    const bet = Math.floor(Number($("hlBet").value));
    if (!bet || bet < 1) { $("hlResult").style.color = ""; $("hlResult").textContent = "Einsatz eingeben."; return; }
    if (bet > coins) { $("hlResult").style.color = ""; $("hlResult").textContent = "So viele Coins hast du nicht."; return; }
    setCoins(coins - bet); sfx.click(); addXPbet(bet);
    hlActive = true; hlPot = bet; hlStreak = 0;
    hlRank = rnd(1, 13); hlSuit = rnd(0, 3);
    $("hlStart").classList.add("hidden"); $("hlGame").classList.remove("hidden");
    $("hlResult").style.color = ""; $("hlResult").textContent = "";
    drawHlCard(hlRank, hlSuit); hlUpdatePot();
  });
  function hlGuess(higher) {
    if (!hlActive) return;
    sfx.click();
    const nextRank = rnd(1, 13), nextSuit = rnd(0, 3);
    // Ass (Rang 1) zählt als höchste UND niedrigste Karte: bei einem Ass gewinnt jeder Tipp
    const correct = (nextRank === hlRank) || (higher ? nextRank > hlRank : nextRank < hlRank);
    const prev = HL_RANKS[hlRank];
    hlRank = nextRank; hlSuit = nextSuit; drawHlCard(hlRank, hlSuit);
    if (correct) {
      hlStreak++; hlPot *= HL_MULT; hlUpdatePot(); sfx.win();
      $("hlResult").style.color = "#22c55e";
      $("hlResult").textContent = `${HL_RANKS[hlRank]} nach ${prev}. Richtig! Weiter oder cashen?`;
    } else {
      hlActive = false; sfx.lose();
      stats.totalLost = (stats.totalLost || 0) + Math.floor(hlPot); saveStats(); checkAch();
      $("hlGame").classList.add("hidden"); $("hlStart").classList.remove("hidden");
      $("hlResult").style.color = "#ef4444";
      $("hlResult").textContent = `${HL_RANKS[hlRank]} nach ${prev}. Daneben. Topf von ${fmt(Math.floor(hlPot))} verloren. Wie bei der PLF.`;
    }
  }
  $("hlHigher").addEventListener("click", () => hlGuess(true));
  $("hlLower").addEventListener("click", () => hlGuess(false));
  $("hlCash").addEventListener("click", () => {
    if (!hlActive) return;
    const won = addWin(Math.floor(hlPot));
    hlActive = false; sfx.coin(); rain("🪙", "#f59e0b", 20);
    $("hlGame").classList.add("hidden"); $("hlStart").classList.remove("hidden");
    $("hlResult").style.color = "#22c55e";
    $("hlResult").textContent = hlStreak > 0 ? `Gecasht! +${fmt(won)} Coins nach ${hlStreak} Treffer(n).` : `Gecasht. +${fmt(won)} Coins. Mutig, direkt aufzugeben.`;
    if (hlStreak > (stats.hlBest || 0)) { stats.hlBest = hlStreak; saveStats(); }
  });

  // ---------- Blackjack (mit Split & Double Down, Standard-Casinoregeln) ----------
  const BJ_RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  function bjCardValue(r) { if (r === "A") return 11; if (r === "J" || r === "Q" || r === "K" || r === "10") return 10; return Number(r); }
  function bjDraw() { return { r: BJ_RANKS[rnd(0, 12)], s: rnd(0, 3) }; }
  function bjHandValue(hand) {
    let total = 0, aces = 0;
    hand.forEach((c) => { total += bjCardValue(c.r); if (c.r === "A") aces++; });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }
  function miniCard(c, hidden) {
    const d = document.createElement("div");
    d.className = "mini-card" + (hidden ? " back" : "") + ((c.s === 1 || c.s === 2) && !hidden ? " red" : "");
    d.textContent = hidden ? "" : c.r + HL_SUITS[c.s];
    return d;
  }
  let bjDealer = [], bjBet = 0, bjActive = false;
  let bjHandsArr = [], bjIdx = 0; // mehrere Spieler-Hände (für Split)

  function bjRenderDealer(hideHole) {
    $("bjDealer").innerHTML = "";
    bjDealer.forEach((c, i) => $("bjDealer").appendChild(miniCard(c, hideHole && i === 1)));
    $("bjDealerVal").textContent = hideHole ? "" : "(" + bjHandValue(bjDealer) + ")";
  }
  function bjRenderHands() {
    const wrap = $("bjHands"); wrap.innerHTML = "";
    bjHandsArr.forEach((h, i) => {
      const box = document.createElement("div");
      box.className = "bj-hand" + (i === bjIdx && bjActive ? " active" : "");
      const label = document.createElement("div"); label.className = "bj-label";
      const tag = bjHandsArr.length > 1 ? `Hand ${i + 1}` : "Du";
      label.textContent = `${tag} (${bjHandValue(h.cards)})${h.done ? " – fertig" : ""}${h.doubled ? " · Double" : ""}`;
      const row = document.createElement("div"); row.className = "hand";
      h.cards.forEach((c) => row.appendChild(miniCard(c, false)));
      box.append(label, row); wrap.appendChild(box);
    });
  }
  function bjUpdateActions() {
    const h = bjHandsArr[bjIdx];
    // Double: nur mit genau 2 Karten; Split: nur bei zwei gleichwertigen Karten, max 4 Hände
    const twoCards = h.cards.length === 2;
    const isPair = twoCards && bjCardValue(h.cards[0].r) === bjCardValue(h.cards[1].r);
    const doublePossible = twoCards && !h.doubled;
    const splitPossible = isPair && bjHandsArr.length < 4;
    // Button nur zeigen, wenn der Zug grundsätzlich geht; deaktivieren, wenn Coins fehlen
    const canAfford = coins >= h.bet;
    $("bjDouble").style.display = doublePossible ? "" : "none";
    $("bjDouble").disabled = !canAfford;
    $("bjDouble").title = canAfford ? "" : `Dafür brauchst du nochmal ${fmt(h.bet)} Coins`;
    $("bjSplit").style.display = splitPossible ? "" : "none";
    $("bjSplit").disabled = !canAfford;
    $("bjSplit").title = canAfford ? "" : `Dafür brauchst du nochmal ${fmt(h.bet)} Coins`;
    // Hinweis unter den Buttons, wenn Double/Split wegen Coins gesperrt sind
    if ((doublePossible || splitPossible) && !canAfford) {
      $("bjResult").style.color = "#94a3b8";
      $("bjResult").textContent = `Double/Split gesperrt: du brauchst dafür nochmal ${fmt(h.bet)} Coins.`;
    }
  }

  function bjDeal() {
    if (bjActive) return;
    const bet = Math.floor(Number($("bjBet").value));
    if (!bet || bet < 1) { $("bjResult").style.color = ""; $("bjResult").textContent = "Einsatz eingeben."; return; }
    if (bet > coins) { $("bjResult").style.color = ""; $("bjResult").textContent = "So viele Coins hast du nicht."; return; }
    setCoins(coins - bet); sfx.click(); addXPbet(bet);
    bjBet = bet; bjActive = true;
    bjDealer = [bjDraw(), bjDraw()];
    bjHandsArr = [{ cards: [bjDraw(), bjDraw()], bet, done: false, doubled: false }];
    bjIdx = 0;
    $("bjStart").classList.add("hidden"); $("bjTable").classList.remove("hidden"); $("bjActions").classList.remove("hidden");
    $("bjHit").style.display = ""; $("bjStand").style.display = ""; // Grundaktionen immer sichtbar
    $("bjResult").textContent = "";
    bjRenderDealer(true); bjRenderHands();
    const pv = bjHandValue(bjHandsArr[0].cards), dv = bjHandValue(bjDealer);
    // Blackjack-Check direkt nach dem Austeilen
    if (pv === 21 || dv === 21) {
      bjRenderDealer(false);
      if (pv === 21 && dv === 21) bjFinish("Beide Blackjack. Push.", "#94a3b8");
      else if (pv === 21) { bump("bjBlackjack"); bjHandsArr[0].blackjack = true; bjFinish("BLACKJACK! 2.5x Auszahlung.", "#22c55e"); }
      else bjFinish("Compiler hat Blackjack. Verloren.", "#ef4444");
      return;
    }
    bjUpdateActions();
  }
  $("bjDealBtn").addEventListener("click", bjDeal);

  function bjNextHand() {
    bjIdx++;
    if (bjIdx >= bjHandsArr.length) { bjDealerPlay(); return; }
    bjRenderHands(); bjUpdateActions();
    // frisch gesplittete Hand mit 21? automatisch weiter
    if (bjHandValue(bjHandsArr[bjIdx].cards) === 21) { bjHandsArr[bjIdx].done = true; bjNextHand(); }
  }
  $("bjHit").addEventListener("click", () => {
    if (!bjActive) return;
    sfx.click();
    const h = bjHandsArr[bjIdx];
    h.cards.push(bjDraw()); bjRenderHands();
    const v = bjHandValue(h.cards);
    if (v > 21) { h.done = true; h.bust = true; bjNextHand(); }
    else if (v === 21) { h.done = true; bjNextHand(); } // 21 = Insta-Stand
    else bjUpdateActions();
  });
  $("bjStand").addEventListener("click", () => {
    if (!bjActive) return;
    sfx.click(); bjHandsArr[bjIdx].done = true; bjNextHand();
  });
  $("bjDouble").addEventListener("click", () => {
    if (!bjActive) return;
    const h = bjHandsArr[bjIdx];
    if (h.cards.length !== 2 || coins < h.bet || h.doubled) return;
    sfx.click(); setCoins(coins - h.bet); h.bet *= 2; h.doubled = true;
    h.cards.push(bjDraw()); h.done = true;
    bjRenderHands();
    if (bjHandValue(h.cards) > 21) h.bust = true;
    bjNextHand();
  });
  $("bjSplit").addEventListener("click", () => {
    if (!bjActive) return;
    const h = bjHandsArr[bjIdx];
    if (h.cards.length !== 2 || bjCardValue(h.cards[0].r) !== bjCardValue(h.cards[1].r) || coins < h.bet || bjHandsArr.length >= 4) return;
    sfx.click(); setCoins(coins - h.bet);
    const moved = h.cards.pop();
    h.cards.push(bjDraw());
    const newHand = { cards: [moved, bjDraw()], bet: h.bet, done: false, doubled: false };
    bjHandsArr.splice(bjIdx + 1, 0, newHand);
    bjRenderHands(); bjUpdateActions();
    if (bjHandValue(h.cards) === 21) { h.done = true; bjNextHand(); }
  });

  function bjDealerPlay() {
    $("bjActions").classList.add("hidden");
    // Dealer zieht nur, wenn mindestens eine Hand noch im Spiel ist
    const anyAlive = bjHandsArr.some((h) => !h.bust);
    bjRenderDealer(false);
    if (anyAlive) { while (bjHandValue(bjDealer) < 17) bjDealer.push(bjDraw()); bjRenderDealer(false); }
    const dv = bjHandValue(bjDealer);
    // winPayout = echte Gewinne (werden geboostet) · pushReturn = zurück­gegebener Einsatz (KEIN Boost)
    let winPayout = 0, pushReturn = 0, parts = [];
    bjHandsArr.forEach((h, i) => {
      const pv = bjHandValue(h.cards);
      const tag = bjHandsArr.length > 1 ? `H${i + 1}` : "";
      if (h.bust) { parts.push(`${tag} überkauft`); }
      else if (h.blackjack) { winPayout += Math.round(h.bet * 2.5); parts.push(`${tag} Blackjack`); }
      else if (dv > 21) { winPayout += h.bet * 2; parts.push(`${tag} Dealer bust`); }
      else if (pv > dv) { winPayout += h.bet * 2; parts.push(`${tag} ${pv} gewinnt`); }
      else if (pv === dv) { pushReturn += h.bet; parts.push(`${tag} Push`); }
      else { parts.push(`${tag} ${pv} verliert`); }
    });
    const totalBet = bjHandsArr.reduce((a, h) => a + h.bet, 0);
    bjFinishResolved(winPayout, pushReturn, totalBet, `Compiler ${dv}. ` + parts.join(", ") + ".");
  }

  // Für die direkten Blackjack-Fälle beim Austeilen
  function bjFinish(msg, color) {
    const h = bjHandsArr[0];
    let winPayout = 0, pushReturn = 0;
    if (h.blackjack) winPayout = Math.round(h.bet * 2.5);
    else if (color === "#94a3b8") pushReturn = h.bet; // Push: nur Einsatz zurück
    bjFinishResolved(winPayout, pushReturn, h.bet, msg, color);
  }
  function bjFinishResolved(winPayout, pushReturn, totalBet, msg, color) {
    bjActive = false;
    $("bjActions").classList.remove("hidden");
    $("bjStart").classList.remove("hidden");
    bjRenderHands();
    const payout = winPayout + pushReturn;
    const net = payout - totalBet;
    let c = color || (net > 0 ? "#22c55e" : net === 0 ? "#94a3b8" : "#ef4444");
    // echte Gewinne über addWin (mit Boostern), Push-Rückgabe direkt ohne Boost
    if (winPayout > 0) { addWin(winPayout); sfx.win(); if (net > 0) rain("🪙", "#f59e0b", 20); }
    if (pushReturn > 0) setCoins(coins + pushReturn);
    if (net < 0) { sfx.lose(); stats.totalLost = (stats.totalLost || 0) + (totalBet - Math.max(0, payout)); saveStats(); checkAch(); }
    // Ergebnis-Zeile: Einsatz, Auszahlung und Netto klar anzeigen
    let summary;
    if (net > 0) summary = `Einsatz ${fmt(totalBet)} · Auszahlung ${fmt(payout)} · Gewinn +${fmt(net)} Coins`;
    else if (net === 0) summary = `Einsatz ${fmt(totalBet)} zurück · ±0`;
    else summary = `Einsatz ${fmt(totalBet)} · ${payout > 0 ? `Auszahlung ${fmt(payout)} · ` : ""}Verlust ${fmt(-net)} Coins`;
    $("bjResult").style.color = c;
    $("bjResult").innerHTML = `${msg}<br><span style="font-size:.9rem;color:#cbd5e1;">${summary}</span>`;
    bump("bjPlayed");
  }

  // ---------- Mines ----------
  const MINES_TOTAL = 25;
  const MINES_HOUSE = 0.97; // 3% Hausvorteil
  let minesActive = false, minesBet = 0, minesN = 0, minesField = [], minesRevealed = 0, minesMult = 1;
  // Fairer Multiplikator nach k sicheren Feldern: Produkt der Kehrwerte der Sicher-Wahrscheinlichkeiten, mal Hausfaktor
  function minesMultiplier(n, revealed) {
    let m = 1;
    for (let i = 0; i < revealed; i++) {
      const safeLeft = (MINES_TOTAL - n) - i;
      const tilesLeft = MINES_TOTAL - i;
      m *= tilesLeft / safeLeft; // Kehrwert der Wahrscheinlichkeit, ein sicheres Feld zu treffen
    }
    return m * MINES_HOUSE;
  }
  function minesUpdateInfo() {
    const cur = minesMultiplier(minesN, minesRevealed);
    const next = minesMultiplier(minesN, minesRevealed + 1);
    $("minesInfo").textContent = `Aufgedeckt: ${minesRevealed} · Multiplikator: ${cur.toFixed(2)}x · nächstes Feld: ${next.toFixed(2)}x`;
    $("minesCash").textContent = `💰 Cashen (${fmt(Math.floor(minesBet * cur))} Coins)`;
    $("minesCash").disabled = minesRevealed < 1;
  }
  function minesRenderGrid(revealAll) {
    const grid = $("minesGrid"); grid.innerHTML = "";
    for (let i = 0; i < MINES_TOTAL; i++) {
      const b = document.createElement("button"); b.className = "mine-tile";
      const isMine = minesField[i] === 1;
      if (minesField[i] === 2) { b.classList.add("safe"); b.textContent = "💎"; b.disabled = true; }
      else if (revealAll && isMine) { b.classList.add("boom"); b.textContent = "💣"; b.disabled = true; }
      else if (revealAll) { b.textContent = "💎"; b.disabled = true; b.style.opacity = ".5"; }
      else { b.addEventListener("click", () => minesClick(i)); }
      grid.appendChild(b);
    }
  }
  function minesClick(i) {
    if (!minesActive || minesField[i] === 2) return;
    sfx.click();
    if (minesField[i] === 1) {
      // Mine getroffen
      minesActive = false;
      minesRenderGrid(true);
      $("minesCash").disabled = true;
      $("minesGame").classList.add("hidden"); $("minesStart").classList.remove("hidden");
      stats.totalLost = (stats.totalLost || 0) + minesBet; saveStats(); checkAch();
      sfx.lose();
      $("minesResult").style.color = "#ef4444";
      $("minesResult").textContent = `💥 Mine! Einsatz ${fmt(minesBet)} verloren. Wie dein Lernplan: explodiert.`;
      bump("minesPlayed");
      return;
    }
    // sicheres Feld
    minesField[i] = 2; minesRevealed++;
    minesRenderGrid(false); minesUpdateInfo();
    // Alle sicheren Felder aufgedeckt -> automatischer Gewinn
    if (minesRevealed >= MINES_TOTAL - minesN) minesCashOut(true);
  }
  function minesCashOut(auto) {
    if (!minesActive) return;
    const mult = minesMultiplier(minesN, minesRevealed);
    const won = addWin(Math.floor(minesBet * mult));
    minesActive = false;
    minesRenderGrid(true);
    $("minesGame").classList.add("hidden"); $("minesStart").classList.remove("hidden");
    sfx.coin(); rain("💎", "#22d3ee", 20);
    $("minesResult").style.color = "#22c55e";
    $("minesResult").textContent = auto ? `Alles aufgedeckt! +${fmt(won)} Coins (${mult.toFixed(2)}x).` : `Gecasht bei ${mult.toFixed(2)}x! +${fmt(won)} Coins.`;
    bump("minesPlayed");
  }
  $("minesStartBtn").addEventListener("click", () => {
    if (minesActive) return;
    const bet = Math.floor(Number($("minesBet").value));
    let n = Math.floor(Number($("minesCount").value));
    if (!bet || bet < 1) { $("minesResult").style.color = ""; $("minesResult").textContent = "Einsatz eingeben."; return; }
    if (bet > coins) { $("minesResult").style.color = ""; $("minesResult").textContent = "So viele Coins hast du nicht."; return; }
    if (!n || n < 1) n = 1; if (n > 24) n = 24;
    setCoins(coins - bet); sfx.click(); addXPbet(bet);
    minesBet = bet; minesN = n; minesActive = true; minesRevealed = 0;
    // Minenfeld aufbauen: 0 = verdeckt sicher, 1 = Mine, 2 = aufgedeckt sicher
    minesField = new Array(MINES_TOTAL).fill(0);
    let placed = 0;
    while (placed < n) { const idx = rnd(0, MINES_TOTAL - 1); if (minesField[idx] !== 1) { minesField[idx] = 1; placed++; } }
    $("minesStart").classList.add("hidden"); $("minesGame").classList.remove("hidden");
    $("minesResult").textContent = "";
    minesRenderGrid(false); minesUpdateInfo();
  });
  $("minesCash").addEventListener("click", () => minesCashOut(false));

