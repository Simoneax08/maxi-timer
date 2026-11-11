  // ================= Supabase: Konto, Belohnungen, Tagesrangliste =================
  // Alle Kontostände und Belohnungen kommen vom Server (RPC-Funktionen aus supabase/schema.sql).
  // Der Browser darf nicht direkt in die Tabellen schreiben.
  const SUPA_URL = "https://pknlztebsrhesoqdltkk.supabase.co";
  const SUPA_KEY = "sb_publishable_CBl9B4dl5ko3A17XBoIUVg_CJ1SDQaA";
  let sb = null;
  try { if (window.supabase && window.supabase.createClient) sb = window.supabase.createClient(SUPA_URL, SUPA_KEY); } catch (e) {}
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
    if (u.length < 3) { setInfo(info, false, "Name mind. 3 Zeichen."); return; }
    if (p.length < 6) { setInfo(info, false, "Passwort mind. 6 Zeichen."); return; }
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
      const prizes = ["100.000", "50.000", "20.000"];
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
      el.innerHTML = rest.length ? rest.map((r, i) => `<div class="lb-row${isMe(r) ? " lb-me" : ""}"><span class="lb-rank">#${i + 4}</span><span class="lb-name">${escapeHtml(r.username || "?")}</span><span class="lb-coins">🎲 ${fmt(r.wagered || 0)}</span></div>`).join("") : "";
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
      }
    } catch (e) {}
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
  initAuth();
})();
