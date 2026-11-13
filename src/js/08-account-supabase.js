  // ================= Supabase: Konto, Belohnungen, Tagesrangliste =================
  // Alle Kontostände und Belohnungen kommen vom Server (RPC-Funktionen aus supabase/schema.sql).
  // Der Browser darf nicht direkt in die Tabellen schreiben.
  const SUPA_URL = "https://pknlztebsrhesoqdltkk.supabase.co";
  const SUPA_KEY = "sb_publishable_CBl9B4dl5ko3A17XBoIUVg_CJ1SDQaA";
  let sb = null;
  try {
    if (window.supabase && window.supabase.createClient) sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
  } catch (e) {}
  // Die Bibliothek nicht mehr global verfuegbar machen (kein window.supabase.createClient in der Konsole)
  try { delete window.supabase; } catch (e) { window.supabase = undefined; }
  let authUserId = null, authUsername = null;
  const emailFor = (u) => u.toLowerCase().replace(/[^a-z0-9_]/g, "") + "@maxi-timer.local";
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  const ERR_TEXT = {
    username_taken: "Name schon vergeben.",
    bad_username: "Name muss 3 bis 16 Zeichen haben.",
    insufficient: "Nicht genug Coins.",
    already_claimed: "Heute schon geholt. Komm morgen wieder.",
    already_redeemed: "Diesen Code hast du schon eingelöst.",
    invalid_code: "Ungültiger Code.",
    not_logged_in: "Bitte einloggen."
  };
  function errText(e) {
    const m = (e && e.message) || "";
    for (const k in ERR_TEXT) if (m.includes(k)) return ERR_TEXT[k];
    return "Fehler: " + m;
  }
  function setInfo(el, ok, text) { if (!el) return; el.style.color = ok ? "#22c55e" : (ok === false ? "#ef4444" : ""); el.textContent = text; }

  // Serienaufrufe: jede Server-Aktion wartet auf die vorherige, damit Stände nicht durcheinanderlaufen
  let chain = Promise.resolve();
  function queued(fn) { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; }

  // Gastwerte parken, bevor der Konto-Stand geladen wird. Beim Ausloggen kommen sie zurück.
  function parkGuest() {
    if (accountMode) return;
    store.set("guestCoins", coins); store.set("guestLevel", level); store.set("guestPrestige", prestige);
  }
  function restoreGuest() {
    store.set("coins", store.get("guestCoins", 100));
    store.set("level", store.get("guestLevel", 1));
    store.set("prestige", store.get("guestPrestige", 0));
  }
  // Hinweis über den Reload hinweg (z. B. nach Login)
  function flash(msg) { try { sessionStorage.setItem("flash", msg); } catch (e) {} }
  function showFlash() {
    let msg = null;
    try { msg = sessionStorage.getItem("flash"); sessionStorage.removeItem("flash"); } catch (e) {}
    if (msg) setTimeout(() => toast(msg), 600);
  }

  // Anzeige aus Server-Stand + noch nicht gesendeten Änderungen
  function applyServerTotal(S) { coins = Number(S) + pendingWin - pendingWager; showCoins(); renderAuth(); }

  async function refreshCoinsFromServer() {
    const { data } = await sb.from("profiles").select("coins").eq("id", authUserId).single();
    if (data) applyServerTotal(data.coins);
  }

  // Sendet gesammelte Einsätze und Gewinne. Der Server prüft, ob der Kontostand reicht.
  function flushAccount() {
    return queued(async () => {
      if (!sb || !authUserId) return true;
      const w = Math.round(pendingWager), g = Math.round(pendingWin);
      if (!w && !g) return true;
      const { data, error } = await sb.rpc("apply_delta", { p_wagered: w, p_won: g });
      if (error) {
        if ((error.message || "").includes("insufficient")) {
          // Die gemeldeten Änderungen sind ungültig: verwerfen und Server-Stand übernehmen
          pendingWager -= w; pendingWin -= g;
          await refreshCoinsFromServer();
        }
        return false;
      }
      pendingWager -= w; pendingWin -= g;
      applyServerTotal(data);
      return true;
    });
  }

  function pushProgress() {
    return queued(async () => {
      if (!sb || !authUserId) return;
      try {
        await sb.rpc("save_progress", {
          p_level: Math.floor(level), p_prestige: Math.floor(prestige),
          p_best_win: Math.round(stats.biggestWin || 0)
        });
      } catch (e) {}
    });
  }

  function renderAuth() {
    const on = !!authUserId;
    const name = authUsername || "?";
    if ($("authLoggedOut")) $("authLoggedOut").classList.toggle("hidden", on);
    if ($("authLoggedIn")) $("authLoggedIn").classList.toggle("hidden", !on);
    if (on) {
      if ($("authName")) $("authName").textContent = name;
      if ($("acctAvatar")) $("acctAvatar").textContent = name.charAt(0).toUpperCase();
      if ($("acctLevel")) $("acctLevel").textContent = level;
      if ($("acctCoins")) $("acctCoins").textContent = fmt(coins);
      if ($("acctPrestige")) $("acctPrestige").textContent = prestige;
    }
    if ($("userBadge")) {
      $("userBadge").classList.toggle("hidden", !on);
      if ($("userBadgeName")) $("userBadgeName").textContent = name;
    }
  }

  async function doRegister() {
    const info = $("authInfo");
    if (!sb) { setInfo(info, false, "Keine Verbindung zum Server."); return; }
    const u = ($("authUser").value || "").trim(), p = $("authPass").value || "";
    if (!/^[A-Za-z0-9_]{3,16}$/.test(u)) { setInfo(info, false, "Name: 3 bis 16 Zeichen, nur Buchstaben, Zahlen und _."); return; }
    if (p.length < 8) { setInfo(info, false, "Passwort mind. 8 Zeichen."); return; }
    setInfo(info, null, "Erstelle Account...");
    try {
      const { data, error } = await sb.auth.signUp({ email: emailFor(u), password: p });
      if (error) { setInfo(info, false, /registered|exists|already/i.test(error.message) ? "Name schon vergeben." : ("Fehler: " + error.message)); return; }
      if (!data.session) {
        const si = await sb.auth.signInWithPassword({ email: emailFor(u), password: p });
        if (si.error) { setInfo(info, false, "Account erstellt, aber Login blockiert (E-Mail-Bestätigung aktiv)."); return; }
      }
      parkGuest();
      const { error: initErr } = await sb.rpc("init_account", { p_username: u }); // Startbonus 2000 kommt vom Server
      if (initErr) throw initErr;
      await pushProgress();
      store.set("coins", 2000); // Konto startet mit 2000, der Gastbestand bleibt geparkt
      flash("Willkommen! +2000 Startbonus. Du bist in der Rangliste.");
      location.reload();
    } catch (e) { setInfo(info, false, errText(e)); }
  }

  async function doLogin() {
    const info = $("authInfo");
    if (!sb) { setInfo(info, false, "Keine Verbindung zum Server."); return; }
    const u = ($("authUser").value || "").trim(), p = $("authPass").value || "";
    if (!u || !p) { setInfo(info, false, "Name und Passwort eingeben."); return; }
    setInfo(info, null, "Logge ein...");
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email: emailFor(u), password: p });
      if (error) { setInfo(info, false, "Falscher Name oder Passwort."); return; }
      const uid = data.user.id;
      const { error: initErr } = await sb.rpc("init_account", { p_username: u });
      if (initErr) throw initErr;
      const { data: prof } = await sb.from("profiles").select("username,coins,level,prestige").eq("id", uid).single();
      if (!prof) throw new Error("Profil nicht gefunden.");
      parkGuest();
      store.set("coins", Number(prof.coins));
      store.set("level", prof.level || 1);
      store.set("prestige", prof.prestige || 0);
      flash("Eingeloggt. Viel Glück.");
      location.reload();
    } catch (e) { setInfo(info, false, errText(e)); }
  }

  async function doLogout() {
    await flushAccount();
    await pushProgress();
    try { if (sb) await sb.auth.signOut(); } catch (e) {}
    restoreGuest();
    flash("Ausgeloggt. Dein Konto-Stand bleibt gespeichert.");
    location.reload();
  }

  function claimDailyLogin() {
    const info = $("dailyLoginInfo");
    if (!accountMode) { setInfo(info, false, "Zum Abholen bitte einloggen."); return; }
    queued(async () => {
      try {
        const S = await sb.rpc("claim_daily_login");
        if (S.error) throw S.error;
        applyServerTotal(S.data);
        setInfo(info, true, "+500 Coins! Bis morgen.");
        sfx.win(); rain("🪙", "#f59e0b", 16);
      } catch (e) { setInfo(info, false, errText(e)); }
    });
  }

  function redeemCode(code, info) {
    queued(async () => {
      try {
        const S = await sb.rpc("redeem_code", { p_code: code });
        if (S.error) throw S.error;
        applyServerTotal(S.data);
        if ($("redeemInput")) $("redeemInput").value = "";
        setInfo(info, true, "🎉 Code eingelöst! Coins sind gutgeschrieben.");
        sfx.win(); rain("🪙", "#f59e0b", 24);
      } catch (e) { setInfo(info, false, errText(e)); sfx.lose(); }
    });
  }

  // Tagesrangliste: Umsatz heute (Summe aller Einsätze), Platz 1 bis 3 bekommen Preise um Mitternacht (Wien)
  async function loadLeaderboard() {
    const el = $("lbList"); if (!el) return;
    if (!sb) { el.textContent = "Keine Verbindung zum Server."; return; }
    el.textContent = "Lade...";
    try {
      const { data, error } = await sb.rpc("leaderboard_today");
      if (error) { el.textContent = "Fehler beim Laden."; return; }
      const pod = $("lbPodium");
      if (!data || !data.length) { el.textContent = "Heute noch keine Einsätze. Sei der Erste!"; if (pod) pod.innerHTML = ""; return; }
      const isMe = (r) => authUsername && r.username && r.username.toLowerCase() === authUsername.toLowerCase();
      const top3 = data.slice(0, 3);
      const prizes = ["1.000.000", "500.000", "250.000", "100.000", "50.000"];
      if (pod) {
        // Podium: Reihenfolge 2 - 1 - 3 fürs Layout
        const order = [1, 0, 2].filter((i) => top3[i]);
        pod.innerHTML = order.map((i) => {
          const r = top3[i];
          const medal = ["🥇", "🥈", "🥉"][i];
          return `<div class="lb-pod${i === 0 ? " gold" : ""}${isMe(r) ? " lb-me" : ""}"><div class="pod-medal">${medal}</div><div class="pod-name">${escapeHtml(r.username || "?")}</div><div class="pod-coins">🎲 ${fmt(r.wagered || 0)}</div><div class="pod-prize">Preis ${prizes[i]}</div></div>`;
        }).join("");
      }
      const rest = data.slice(3);
      el.innerHTML = rest.length ? rest.map((r, i) => `<div class="lb-row${isMe(r) ? " lb-me" : ""}"><span class="lb-rank">#${i + 4}</span><span class="lb-name">${escapeHtml(r.username || "?")}</span><span class="lb-coins">🎲 ${fmt(r.wagered || 0)}</span>${i + 3 < 5 ? `<span class="lb-prize">Preis ${prizes[i + 3]}</span>` : ""}</div>`).join("") : "";
    } catch (e) { el.textContent = "Fehler: " + e.message; }
  }

  async function initAuth() {
    showFlash();
    if (!sb) return;
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session && data.session.user) {
        authUserId = data.session.user.id;
        accountMode = true;
        const { data: prof } = await sb.from("profiles").select("username,coins,level,prestige").eq("id", authUserId).single();
        if (prof) {
          authUsername = prof.username;
          level = prof.level || 1; prestige = prof.prestige || 0;
          store.set("level", level); store.set("prestige", prestige);
          applyServerTotal(prof.coins);
        }
        renderAuth();
        loadLeaderboard();
        chatSetAccess(); chatLoad(); chatConnect();
      }
    } catch (e) {}
  }

  // ---------- Live-Chat (nur eingeloggt, 200 Zeichen, 1 Nachricht alle 2 Sek.) ----------
  const chatPanel = $("chatPanel"), chatMsgs = $("chatMsgs"), chatInput = $("chatInput"), chatSend = $("chatSend"), chatHint = $("chatHint");
  let chatLast = 0, chatReady = false, chatLastId = 0;
  function chatAddMsg(r) {
    if (!chatMsgs) return;
    if (r.kind === "rain") { chatMsgs.appendChild(chatRainCard(r)); chatMsgs.scrollTop = chatMsgs.scrollHeight; chatRainTick(); return; }
    if (r.kind === "rain_end") { const e = document.createElement("div"); e.className = "chat-rain-end"; e.textContent = r.body || ""; chatMsgs.appendChild(e); chatMsgs.scrollTop = chatMsgs.scrollHeight; return; }
    const row = document.createElement("div");
    row.className = "chat-msg" + (authUsername && r.username === authUsername ? " me" : "");
    const time = document.createElement("span"); time.className = "chat-time";
    const dt = r.created_at ? new Date(r.created_at) : new Date();
    time.textContent = dt.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
    const who = document.createElement("b"); who.textContent = (r.username || "?") + ": ";
    const txt = document.createElement("span"); txt.textContent = r.body || "";
    row.append(time, " ", who, txt);
    chatMsgs.appendChild(row);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }
  // Goldene Rain-Karte im Chat: Countdown, Joinen und Spenden direkt hier
  function chatRainCard(r) {
    const m = r.meta || {};
    const card = document.createElement("div");
    card.className = "chat-rain";
    card.dataset.round = m.round_id || ""; card.dataset.closes = m.closes_at || 0;
    card.innerHTML = '<div class="cr-title">🌧️ RAKEBACK RAIN</div><div class="cr-body"></div><div class="cr-timer"></div><div class="cr-actions"><input class="cr-don" type="number" min="1" placeholder="Spende"><button class="cr-donate">💸</button><button class="cr-join">Joinen</button></div>';
    card.querySelector(".cr-body").textContent = r.body || "";
    card.querySelector(".cr-join").addEventListener("click", () => rainJoinNow(m.round_id));
    card.querySelector(".cr-donate").addEventListener("click", () => {
      const inp = card.querySelector(".cr-don");
      rainDonateNow(m.round_id, Math.floor(Number(inp.value) || 0), inp);
    });
    return card;
  }
  function chatRainTick() {
    document.querySelectorAll(".chat-rain").forEach((c) => {
      const left = Math.max(0, Math.floor((Number(c.dataset.closes) - (Date.now() + rainOffset)) / 1000));
      const open = left > 0;
      c.querySelector(".cr-timer").textContent = open ? `Joinen noch ${rainFmt(left)}` : "Beendet";
      c.classList.toggle("ended", !open);
      c.querySelectorAll("button,input").forEach((el) => { el.disabled = !open || !sb || !authUserId; });
    });
  }
  function chatSetAccess() {
    const on = accountMode && !!authUserId;
    if (chatInput) chatInput.disabled = !on;
    if (chatSend) chatSend.disabled = !on;
    if (chatHint) chatHint.textContent = on ? "" : "🔒 Login nötig";
    if (!on && chatMsgs) chatMsgs.innerHTML = '<div class="chat-hint">Zum Chatten bitte einloggen.</div>';
  }
  async function chatLoad() {
    if (!sb || !accountMode) return;
    const { data, error } = await sb.from("chat_messages").select("id,username,body,created_at,kind,meta").order("id", { ascending: false }).limit(50);
    if (error || !chatMsgs) return;
    chatMsgs.innerHTML = "";
    (data || []).slice().sort((x, y) => Number(x.id) - Number(y.id)).forEach((r) => { chatLastId = Math.max(chatLastId, Number(r.id) || 0); chatAddMsg(r); });
  }
  function chatConnect() {
    if (chatReady || !sb) return;
    chatReady = true;
    sb.channel("chat-room").on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => { if (Number(p.new.id) > chatLastId) { chatLastId = Number(p.new.id); chatAddMsg(p.new); } }).subscribe();
  }
  async function chatSendMsg() {
    const body = (chatInput.value || "").trim();
    if (!body || !accountMode) return;
    if (body.length > 200) { chatHint.textContent = "Max. 200 Zeichen."; return; }
    if (Date.now() - chatLast < 2000) { chatHint.textContent = "Kurz warten..."; return; }
    chatLast = Date.now();
    const { error } = await sb.rpc("post_chat", { p_body: body });
    if (error) { chatHint.textContent = errText(error); return; }
    chatInput.value = ""; chatHint.textContent = "";
    await chatLoad(); // sofort sichtbar, auch ohne Realtime (doppelte werden über die ID verhindert)
  }
  if (chatPanel) {
    $("chatToggle").addEventListener("click", () => {
      chatPanel.classList.toggle("collapsed");
      if (!chatPanel.classList.contains("collapsed")) chatMsgs.scrollTop = chatMsgs.scrollHeight;
    });
    chatSend.addEventListener("click", chatSendMsg);
    chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") chatSendMsg(); });
    chatSetAccess();
  }

  if ($("authLoginBtn")) $("authLoginBtn").addEventListener("click", doLogin);
  if ($("authRegBtn")) $("authRegBtn").addEventListener("click", doRegister);
  if ($("authLogoutBtn")) $("authLogoutBtn").addEventListener("click", doLogout);
  if ($("dailyLoginBtn")) $("dailyLoginBtn").addEventListener("click", claimDailyLogin);
  if ($("lbRefresh")) $("lbRefresh").addEventListener("click", () => { sfx.click(); loadLeaderboard(); });
  // Regelmäßig Einsätze/Gewinne senden und Fortschritt speichern
  setInterval(async () => {
    if (!accountMode || !authUserId) return;
    await flushAccount();
    if (syncDirty) { syncDirty = false; await pushProgress(); }
  }, 3000);
  // Beim Schließen: best effort, der Browser kann die Anfrage abbrechen
  window.addEventListener("beforeunload", () => { if (accountMode) flushAccount(); });
  loadLeaderboard();
  // ---------- Rakeback Rain (Logik liegt auf dem Server, schema.sql Abschnitt 15) ----------
  let rainData = null, rainOffset = 0;
  const rainSecs = (ms) => Math.max(0, Math.floor((ms - (Date.now() + rainOffset)) / 1000));
  const rainFmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const RAIN_ERR = { round_closed: "Die Runde ist schon zu.", no_wager: "Du hast seit dem letzten Join noch nicht gewettet.", already_joined: "Du bist schon dabei.", insufficient: "Zu wenig Coins.", bad_values: "Ungültiger Betrag." };
  const rainErr = (e) => { const m = (e && e.message) || ""; const k = Object.keys(RAIN_ERR).find((x) => m.includes(x)); return k ? RAIN_ERR[k] : "Das hat nicht geklappt."; };
  function renderRain() {
    const badge = $("rainBadge"); if (!badge) return;
    const d = rainData, timer = $("rainTimer"), info = $("rainInfo"), join = $("rainJoinBtn"), don = $("rainDonateBtn"), inp = $("rainDonate");
    if (!sb || !authUserId || !d) {
      badge.textContent = "Login nötig"; badge.className = "rain-badge";
      timer.textContent = ""; $("rainPool").textContent = "";
      info.textContent = "Logg dich ein, um mitzuspielen.";
      join.disabled = true; don.disabled = true; inp.disabled = true; return;
    }
    $("rainPool").textContent = `Pot: ${fmt(d.pool)} Coins`;
    if (d.open) {
      badge.textContent = "LIVE"; badge.className = "rain-badge live";
      timer.textContent = `Joinen noch ${rainFmt(rainSecs(d.closes_at))}`;
      join.disabled = d.joined || d.my_wager <= 0;
      join.textContent = d.joined ? "✅ Dabei" : "🌧️ Joinen";
      don.disabled = false; inp.disabled = false;
      info.textContent = d.joined ? "Du bist dabei. Auszahlung nach Ende der Runde."
        : d.my_wager > 0 ? `Deine Basis: ${fmt(d.my_wager)} Coins Einsatz seit dem letzten Join.`
        : "Du hast seit dem letzten Join noch nicht gewettet.";
    } else {
      badge.textContent = "Bald"; badge.className = "rain-badge";
      timer.textContent = `Nächster Rain in ${rainFmt(rainSecs(d.next_at))}`;
      join.disabled = true; join.textContent = "🌧️ Joinen"; don.disabled = true; inp.disabled = true;
      info.textContent = "Ein Rain startet alle 10 Minuten und ist 3 Minuten offen.";
    }
  }
  async function rainPoll() {
    if (!sb || !authUserId) { rainData = null; renderRain(); return; }
    const { data, error } = await sb.rpc("rain_status");
    if (error || !data) return;
    rainOffset = Number(data.server_now) - Date.now();
    rainData = data; renderRain();
    if (data.payout_round && data.payout > 0 && data.payout_round !== store.get("rainSeen", 0)) {
      store.set("rainSeen", data.payout_round);
      await refreshCoinsFromServer();
      toast(`🌧️ Rain: +${fmt(data.payout)} Coins!`); rain("🌧️", "#60a5fa", 30);
    }
  }
  if ($("rainJoinBtn")) {
    $("rainJoinBtn").addEventListener("click", async () => {
      if (!rainData || !rainData.open) return;
      await flushAccount();
      const { error } = await sb.rpc("rain_join", { p_round: rainData.round_id });
      if (error) toast(rainErr(error)); else { sfx.win(); toast("🌧️ Du bist dabei!"); }
      rainPoll();
    });
    $("rainDonateBtn").addEventListener("click", async () => {
      if (!rainData || !rainData.open) return;
      const amt = Math.floor(Number($("rainDonate").value) || 0);
      if (amt < 1) { toast("Betrag eingeben."); return; }
      if (amt > coins) { toast("Zu wenig Coins."); return; }
      await flushAccount();
      const { error } = await sb.rpc("rain_donate", { p_round: rainData.round_id, p_amount: amt });
      if (error) toast(rainErr(error));
      else { sfx.coin(); $("rainDonate").value = ""; toast(`💸 ${fmt(amt)} Coins in den Pot`); }
      await refreshCoinsFromServer(); rainPoll();
    });
  }
  async function rainJoinNow(roundId) {
    if (!sb || !authUserId || !roundId) return;
    await flushAccount();
    const { error } = await sb.rpc("rain_join", { p_round: Number(roundId) });
    if (error) toast(rainErr(error)); else { sfx.win(); toast("🌧️ Du bist dabei!"); }
    rainPoll();
  }
  async function rainDonateNow(roundId, amt, inp) {
    if (!sb || !authUserId || !roundId) return;
    if (amt < 1) { toast("Betrag eingeben."); return; }
    if (amt > coins) { toast("Zu wenig Coins."); return; }
    await flushAccount();
    const { error } = await sb.rpc("rain_donate", { p_round: Number(roundId), p_amount: amt });
    if (error) toast(rainErr(error)); else { sfx.coin(); if (inp) inp.value = ""; toast(`💸 ${fmt(amt)} Coins in den Pot`); }
    await refreshCoinsFromServer(); rainPoll();
  }
  setInterval(chatRainTick, 1000);
  setInterval(renderRain, 1000);
  setInterval(rainPoll, 5000);
  rainPoll();
  initAuth();
})();
