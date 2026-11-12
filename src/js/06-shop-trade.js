  // ---------- Shop ----------
  const SHOP = {
    "⚡ Booster": [
      { id: "xp5", icon: "⚡", title: "XP-Booster", desc: "Doppelte XP für 5 Minuten.", price: 300, buy: () => { xpBoostUntil = Date.now() + 5*60000; store.set("xpBoostUntil", xpBoostUntil); updateBoostBar(); toast("XP-Booster aktiv für 5 Min!"); } },
    ],
    "💎 Perks (dauerhaft, sehr teuer)": [
      { id: "p_coins", icon: "📈", title: "Perk: +2% Coins für immer", desc: "Dauerhaft 2% mehr Coins aus allen Spielen.", price: 20000, perk: "coins" },
      { id: "p_box", icon: "📦", title: "Perk: Lootbox günstiger", desc: "Lootbox kostet dauerhaft nur noch 34 statt 38.", price: 15000, perk: "box" },
    ],
    "🐋 High Roller (für die Reichen)": [
      { id: "p_coins15", icon: "📊", title: "Perk: +3% Coins", desc: "Dauerhaft 3% mehr Coins. Stapelt mit den anderen Coin-Perks.", price: 150000, perk: "coins15" },
      { id: "cash1m", icon: "💸", title: "1 Mio Coins", desc: "Direkt 1.000.000 Coins. Kostet 1.25 Mio. Der Shop gewinnt immer.", price: 1250000, repeat: true, buy: () => { setCoins(coins + 1000000); toast("+1.000.000 Coins!"); } }
    ],
    "🎖️ Titel (zum Flexen)": [
      { id: "t_durchfaller", icon: "🏅", title: "Titel: Durchfaller des Jahres", desc: "Steht oben neben deinem Level.", price: 800, title_val: "Durchfaller des Jahres" },
      { id: "t_coinmillionaer", icon: "🤑", title: "Titel: Coin-Millionär", desc: "Auch wenn du keine Million hast.", price: 2000, title_val: "Coin-Millionär" },
      { id: "t_javagott", icon: "☕", title: "Titel: Java-Gott", desc: "Der höchste Titel. Verdient hast du ihn nicht.", price: 5000, title_val: "Java-Gott" },
      { id: "t_whale", icon: "🐋", title: "Titel: Der Wal", desc: "Für die, die zu viele Coins haben.", price: 500000, title_val: "Der Wal" }
    ],
    "🎨 Garantierte Skins": [
      { id: "s_epic", icon: "🟣", title: "Zufälliger Episch-Skin", desc: "Garantiert Episch. Günstiger als Lootbox-Pech.", price: 300, skin_rarity: "epic" },
      { id: "s_legend", icon: "🟠", title: "Zufälliger Legendär-Skin", desc: "Garantiert Legendär. Kein Risiko.", price: 1000, skin_rarity: "legendary" },
      { id: "s_mythic", icon: "🔴", title: "Bestanden-Skin (Mythisch)", desc: "Der seltenste Skin, direkt gekauft.", price: 4000, skin_id: "bestanden" }
    ]
  };

  function buyShopItem(item) {
    // Titel: wenn bereits besessen, nur anlegen (kostenlos)
    if (item.title_val && ownedTitles.includes(item.id)) { activeTitle = item.title_val; store.set("activeTitle", activeTitle); applyTitle(); renderShop(); return; }
    // Perk: nur einmal kaufbar
    if (item.perk && perks[item.perk]) { toast("Perk hast du schon."); return; }
    if (coins < item.price) { toast("Zu teuer. Farm mehr."); return; }
    if (item.skin_id && (inv[item.skin_id] || 0) > 0) { toast("Hast du schon."); }
    setCoins(coins - item.price); sfx.coin();
    if (item.buy) item.buy();
    if (item.perk) { perks[item.perk] = true; store.set("perks", perks); updateCaseBtn(); toast("Perk dauerhaft freigeschaltet!"); rain("💎", "#22d3ee", 30); }
    if (item.title_val) { ownedTitles.push(item.id); store.set("titles", ownedTitles); activeTitle = item.title_val; store.set("activeTitle", activeTitle); applyTitle(); toast("Titel freigeschaltet!"); }
    if (item.skin_rarity) { const pool = SKINS.filter((s) => !s.start && s.rarity === item.skin_rarity); const s = pool[rnd(0, pool.length - 1)]; inv[s.id] = (inv[s.id]||0)+1; saveInv(); renderInventory(); rain("✨", RARITIES[item.skin_rarity].color, 40); toast(`${s.name} erhalten!`); }
    if (item.skin_id) { inv[item.skin_id] = (inv[item.skin_id]||0)+1; saveInv(); renderInventory(); rain("✨", "#ef4444", 50); toast("Bestanden-Skin erhalten!"); }
    renderShop();
  }
  function applyTitle() {
    const u = unclaimedCount();
    let txt = "Lvl " + level;
    if (u > 0) txt += ` · ${u} 🎁`;
    if (activeTitle) txt += " · " + activeTitle;
    $("levelText").textContent = txt;
  }
  function renderShop() {
    $("shopCats").innerHTML = "";
    for (const [cat, items] of Object.entries(SHOP)) {
      const h = document.createElement("div"); h.className = "shop-cat"; h.textContent = cat; $("shopCats").appendChild(h);
      const grid = document.createElement("div"); grid.id = ""; grid.style.display = "flex"; grid.style.flexWrap = "wrap"; grid.style.gap = "10px"; grid.style.justifyContent = "center"; grid.style.marginTop = "8px";
      items.forEach((item) => {
        const card = document.createElement("div"); card.className = "shop-item";
        const titleOwned = item.title_val && ownedTitles.includes(item.id);
        const perkOwned = item.perk && perks[item.perk];
        card.innerHTML = `<div class="icon">${item.icon}</div><div class="title">${item.title}</div><div class="desc">${item.desc}</div>`;
        const btn = document.createElement("button");
        if (perkOwned) { btn.textContent = "Aktiv ✓"; btn.className = "owned"; btn.disabled = true; }
        else if (titleOwned) { const active = activeTitle === item.title_val; btn.textContent = active ? "Aktiv" : "Anlegen"; btn.className = "owned"; btn.disabled = active; }
        else btn.textContent = `${fmt(item.price)} 🪙`;
        btn.addEventListener("click", () => buyShopItem(item));
        card.appendChild(btn); grid.appendChild(card);
      });
      $("shopCats").appendChild(grid);
    }
  }
  renderShop(); applyTitle();

  // ---------- Händler (fair, mit Perks) ----------
  // Skins zum vollen Verkaufswert ankaufen
  function renderTraderBuy() {
    $("traderBuy").innerHTML = "";
    const owned = ownedIds().filter((id) => id !== "standard");
    if (owned.length === 0) { $("traderBuy").innerHTML = `<span class="hint">Du hast keine Skins zum Verkaufen.</span>`; return; }
    owned.forEach((id) => {
      const s = skinById(id), r = RARITIES[s.rarity];
      const row = document.createElement("div"); row.className = "reward-row";
      const left = document.createElement("span"); left.innerHTML = `<b style="color:${r.color}">${s.name}</b> <span style="color:#94a3b8">x${inv[id]}</span>`;
      const b = document.createElement("button"); b.textContent = `Verkaufen +${r.sell}`; b.style.padding = "6px 12px"; b.style.fontSize = ".78rem"; b.style.background = "#22c55e"; b.style.color = "#052e16";
      b.addEventListener("click", () => {
        if ((inv[id] || 0) <= 0) return;
        inv[id]--; if (inv[id] <= 0) { delete inv[id]; if (equipped === id) applySkin("standard"); }
        saveInv(); setCoins(coins + r.sell); sfx.coin();
        $("tradeResult").style.color = r.color; $("tradeResult").textContent = `Verkauft für vollen Wert: +${r.sell} Coins.`;
        renderInventory(); renderTraderBuy();
      });
      row.append(left, b); $("traderBuy").appendChild(row);
    });
  }

  // Deal des Tages: fester Rabatt auf einen Shop-Artikel, einmal pro Tag kaufbar, täglich wechselnd
  const ALL_SHOP = Object.values(SHOP).flat();
  let dealDay = store.get("dealDay", "");
  let dealBought = store.get("dealBought", "");
  function todaysDeal() {
    // deterministisch aus dem Datum: gleicher Deal den ganzen Tag
    const seed = [...todayKey()].reduce((a, c) => a + c.charCodeAt(0), 0);
    const pool = ALL_SHOP.filter((it) => it.price >= 300); // keine Mini-Items
    return pool[seed % pool.length];
  }
  function renderDailyDeal() {
    const deal = todaysDeal();
    const r = RARITIES; // ungenutzt, nur Klarheit
    const discounted = Math.round(deal.price * 0.6); // 40 % Rabatt
    const already = dealBought === todayKey();
    $("dailyDeal").innerHTML = "";
    const card = document.createElement("div"); card.className = "shop-item"; card.style.width = "100%"; card.style.maxWidth = "320px"; card.style.margin = "0 auto";
    card.innerHTML = `<div class="icon">${deal.icon}</div><div class="title">${deal.title}</div>
      <div class="desc">${deal.desc}</div>
      <div style="font-weight:800;"><span style="text-decoration:line-through;color:#94a3b8;">${fmt(deal.price)}</span> → <span style="color:#22c55e;">${fmt(discounted)} 🪙</span> <span style="color:#f59e0b;">-40%</span></div>`;
    const b = document.createElement("button");
    if (already) { b.textContent = "Heute schon gekauft"; b.className = "owned"; b.disabled = true; }
    else b.textContent = `Für ${fmt(discounted)} kaufen`;
    b.addEventListener("click", () => {
      if (dealBought === todayKey()) return;
      if (coins < discounted) { toast("Zu teuer."); return; }
      // Rabatt anwenden: temporär Preis senken, Item über buyShopItem geben
      const realPrice = deal.price; const tmp = { ...deal, price: discounted };
      buyShopItem(tmp);
      dealBought = todayKey(); store.set("dealBought", dealBought);
      renderDailyDeal();
    });
    card.appendChild(b); $("dailyDeal").appendChild(card);
  }
  renderTraderBuy(); renderDailyDeal();

