  // ================= Supabase: Login + Leaderboard + Belohnungen =================
  const SUPA_URL = "https://pknlztebsrhesoqdltkk.supabase.co";
  const SUPA_KEY = "sb_publishable_CBl9B4dl5ko3A17XBoIUVg_CJ1SDQaA";
  let sb = null;
  try { if (window.supabase && window.supabase.createClient) sb = window.supabase.createClient(SUPA_URL, SUPA_KEY); } catch (e) {}
  let authUserId = null, authUsername = null;
  const emailFor = (u) => u.toLowerCase().replace(/[^a-z0-9_]/g, "") + "@maxi-timer.local";
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

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

  async function pushProfile() {
    if (!sb || !authUserId) return;
    try {
      await sb.from("profiles").update({
        coins: coins, level: level, prestige: prestige,
        best_win: stats.biggestWin || 0, updated_at: new Date().toISOString()
      }).eq("id", authUserId);
    } catch (e) {}
  }

  async function doRegister() {
    const info = $("authInfo");
    if (!sb) { info.style.color = "#ef4444"; info.textContent = "Keine Verbindung zum Server."; return; }
    const u = ($("authUser").value || "").trim(), p = $("authPass").value || "";
    if (u.length < 3) { info.style.color = "#ef4444"; info.textContent = "Name mind. 3 Zeichen."; return; }
    if (p.length < 6) { info.style.color = "#ef4444"; info.textContent = "Passwort mind. 6 Zeichen."; return; }
    info.style.color = ""; info.textContent = "Erstelle Account...";
    try {
      const { data, error } = await sb.auth.signUp({ email: emailFor(u), password: p });
      if (error) { info.style.color = "#ef4444"; info.textContent = /registered|exists|already/i.test(error.message) ? "Name schon vergeben." : ("Fehler: " + error.message); return; }
      if (!data.session) {
        const si = await sb.auth.signInWithPassword({ email: emailFor(u), password: p });
        if (si.error) { info.style.color = "#ef4444"; info.textContent = "Account erstellt, aber Login blockiert (E-Mail-Bestätigung aktiv)."; return; }
      }
      authUserId = (data.user && data.user.id) || null; authUsername = u;
      await sb.from("profiles").upsert({ id: authUserId, username: u, coins: coins, level: level, prestige: prestige, best_win: stats.biggestWin || 0, updated_at: new Date().toISOString() });
      setCoins(coins + 2000); // Willkommensbonus
      info.style.color = "#22c55e"; info.textContent = "Willkommen! +2000 Bonus. Du bist in der Rangliste.";
      sfx.win(); rain("🎉", "#f59e0b", 24);
      renderAuth(); await pushProfile(); loadLeaderboard();
    } catch (e) { info.style.color = "#ef4444"; info.textContent = "Fehler: " + e.message; }
  }

  async function doLogin() {
    const info = $("authInfo");
    if (!sb) { info.style.color = "#ef4444"; info.textContent = "Keine Verbindung zum Server."; return; }
    const u = ($("authUser").value || "").trim(), p = $("authPass").value || "";
    if (!u || !p) { info.style.color = "#ef4444"; info.textContent = "Name und Passwort eingeben."; return; }
    info.style.color = ""; info.textContent = "Logge ein...";
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email: emailFor(u), password: p });
      if (error) { info.style.color = "#ef4444"; info.textContent = "Falscher Name oder Passwort."; return; }
      authUserId = data.user.id; authUsername = u;
      const { data: prof } = await sb.from("profiles").select("*").eq("id", authUserId).single();
      if (prof) { authUsername = prof.username || u; if ((prof.coins || 0) > coins) setCoins(prof.coins); }
      else { await sb.from("profiles").insert({ id: authUserId, username: u, coins: coins, level: level, prestige: prestige, best_win: stats.biggestWin || 0 }); }
      info.style.color = "#22c55e"; info.textContent = "Eingeloggt. Viel Glück.";
      renderAuth(); await pushProfile(); loadLeaderboard();
    } catch (e) { info.style.color = "#ef4444"; info.textContent = "Fehler: " + e.message; }
  }

  async function doLogout() {
    await pushProfile();
    try { if (sb) await sb.auth.signOut(); } catch (e) {}
    authUserId = null; authUsername = null; renderAuth();
    if ($("authInfo")) { $("authInfo").style.color = ""; $("authInfo").textContent = "Ausgeloggt."; }
  }

  function claimDailyLogin() {
    const info = $("dailyLoginInfo");
    const today = new Date().toISOString().slice(0, 10);
    if (store.get("lastLoginBonus", "") === today) { info.style.color = "#ef4444"; info.textContent = "Heute schon geholt. Komm morgen wieder."; return; }
    store.set("lastLoginBonus", today);
    setCoins(coins + 500);
    info.style.color = "#22c55e"; info.textContent = "+500 Coins! Bis morgen.";
    sfx.win(); rain("🪙", "#f59e0b", 16); pushProfile();
  }

  async function loadLeaderboard() {
    const el = $("lbList"); if (!el) return;
    if (!sb) { el.textContent = "Keine Verbindung zum Server."; return; }
    el.textContent = "Lade...";
    try {
      const { data, error } = await sb.from("profiles").select("username,coins,level").order("coins", { ascending: false }).limit(20);
      if (error) { el.textContent = "Fehler beim Laden."; return; }
      const pod = $("lbPodium");
      if (!data || !data.length) { el.textContent = "Noch keine Spieler. Sei der Erste!"; if (pod) pod.innerHTML = ""; return; }
      const isMe = (r) => authUsername && r.username && r.username.toLowerCase() === authUsername.toLowerCase();
      const top3 = data.slice(0, 3);
      const prizes = ["100.000", "50.000", "20.000"];
      if (pod) {
        // Podium: Reihenfolge 2 - 1 - 3 fürs Layout
        const order = [1, 0, 2].filter((i) => top3[i]);
        pod.innerHTML = order.map((i) => {
          const r = top3[i];
          const medal = ["🥇", "🥈", "🥉"][i];
          return `<div class="lb-pod${i === 0 ? " gold" : ""}${isMe(r) ? " lb-me" : ""}"><div class="pod-medal">${medal}</div><div class="pod-name">${escapeHtml(r.username || "?")}</div><div class="pod-coins">🪙 ${fmt(r.coins || 0)}</div><div class="pod-prize">Preis ${prizes[i]}</div></div>`;
        }).join("");
      }
      const rest = data.slice(3);
      el.innerHTML = rest.length ? rest.map((r, i) => `<div class="lb-row${isMe(r) ? " lb-me" : ""}"><span class="lb-rank">#${i + 4}</span><span class="lb-name">${escapeHtml(r.username || "?")}</span><span class="lb-coins">🪙 ${fmt(r.coins || 0)}</span></div>`).join("") : "";
    } catch (e) { el.textContent = "Fehler: " + e.message; }
  }

  async function initAuth() {
    if (!sb) return;
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session && data.session.user) {
        authUserId = data.session.user.id;
        const { data: prof } = await sb.from("profiles").select("username,coins").eq("id", authUserId).single();
        if (prof) { authUsername = prof.username; if ((prof.coins || 0) > coins) setCoins(prof.coins); }
        renderAuth();
      }
    } catch (e) {}
  }

  if ($("authLoginBtn")) $("authLoginBtn").addEventListener("click", doLogin);
  if ($("authRegBtn")) $("authRegBtn").addEventListener("click", doRegister);
  if ($("authLogoutBtn")) $("authLogoutBtn").addEventListener("click", doLogout);
  if ($("dailyLoginBtn")) $("dailyLoginBtn").addEventListener("click", claimDailyLogin);
  if ($("lbRefresh")) $("lbRefresh").addEventListener("click", () => { sfx.click(); loadLeaderboard(); });
  setInterval(() => { if (syncDirty && authUserId) { syncDirty = false; pushProfile(); } }, 8000);
  window.addEventListener("beforeunload", () => { if (authUserId) pushProfile(); });
  initAuth();
})();
