(() => {
  "use strict";
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#primary-nav");
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const isOpen = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
      nav.classList.toggle("open", !isOpen);
    });
    nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation");
      nav.classList.remove("open");
    }));
  }

  document.querySelectorAll(".faq-question").forEach(button => {
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      const answer = button.nextElementSibling;
      button.setAttribute("aria-expanded", String(!expanded));
      if (answer) answer.hidden = expanded;
    });
  });

  const year = document.querySelector("#current-year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Show safe, actionable OAuth diagnostics without ever exposing secrets or tokens.
  function showAuthMessage(message) {
    const panel = document.querySelector("#landing-auth-message");
    if (!panel) return;
    panel.textContent = message;
    panel.hidden = !message;
  }

  const authErrors = {
    discord_authorization_denied: "Discord authorization was cancelled. Choose Sign in and approve Starry to continue.",
    oauth_state_invalid: "Discord returned an invalid or expired sign-in check. Start again from this website.",
    no_code: "Discord did not return a sign-in response. Please try again.",
    oauth_not_configured: "Starry's Discord OAuth client secret is not configured on the backend. The site owner must add it in Render.",
    token_failed: "Discord rejected the OAuth token exchange. Check the Discord client ID, secret and exact callback URL in the backend settings.",
    profile_failed: "Starry could not retrieve your Discord profile. Please try again in a moment.",
    guilds_failed: "Starry could not retrieve your Discord server list. Please try again.",
    session_store_unavailable: "Sign-in reached Starry, but its MongoDB session store is disconnected. The backend needs its database connection restored.",
    session_store_failed: "Discord approved the sign-in, but Starry could not save your session. The backend session database needs attention.",
    oauth_error: "Starry could not finish sign-in. Check the backend logs for the OAuth callback error."
  };

  const queryError = new URLSearchParams(window.location.search).get("error");
  if (queryError) showAuthMessage(authErrors[queryError] || "Sign-in could not be completed. Please try again.");

  async function checkAuthService() {
    try {
      const response = await fetch("/auth/status", { cache: "no-store", headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("Auth status unavailable");
      const status = await response.json();
      if (!status.oauthConfigured) {
        showAuthMessage("Discord sign-in is not fully configured on the Starry backend. The site owner must check the OAuth client ID, client secret and callback URL in Render.");
      } else if (!status.mongoConfigured || !status.mongoConnected) {
        showAuthMessage("Discord sign-in is configured, but Starry's session database is not connected. The backend needs its MongoDB connection restored.");
      }
    } catch (_) {
      if (!queryError) showAuthMessage("Starry's sign-in service could not be reached. Please retry later; the website itself is still available.");
    }
  }

  // The landing page uses the same Render-backed OAuth session as the dashboard.
  async function loadDiscordProfile() {
    const login = document.querySelector("#landing-login");
    const profile = document.querySelector("#landing-profile");
    const avatar = document.querySelector("#landing-avatar");
    const username = document.querySelector("#landing-username");
    if (!login || !profile) return;

    try {
      const response = await fetch("/auth/user", { cache: "no-store", headers: { "Accept": "application/json" } });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.authenticated || !data.user) return;
      const user = data.user;
      if (avatar) {
        avatar.src = user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
        avatar.onerror = () => { avatar.src = "https://cdn.discordapp.com/embed/avatars/0.png"; };
      }
      if (username) username.textContent = user.globalName || user.username || "Discord user";
      login.hidden = true;
      profile.hidden = false;
      document.querySelectorAll('a[href="/auth/login"]').forEach(link => {
        link.href = "/dashboard.html";
        if (link.textContent.toLowerCase().includes("dashboard")) return;
        link.textContent = "Open dashboard →";
      });
    } catch (error) {
      console.warn("Starry could not load the Discord profile yet:", error);
    }
  }

  const logout = document.querySelector("#landing-logout");
  if (logout) logout.addEventListener("click", async () => {
    logout.disabled = true;
    logout.textContent = "Signing out…";
    try { await fetch("/auth/logout", { method: "POST", cache: "no-store" }); } catch (_) {}
    try { localStorage.removeItem("starry_dashboard_session"); } catch (_) {}
    try { sessionStorage.removeItem("starry_dashboard_session"); } catch (_) {}
    window.location.reload();
  });

  loadDiscordProfile();
  checkAuthService();

  // A session can be captured from the OAuth return URL before this script runs.
  // Re-check once after the browser has restored local storage on navigation.
  window.addEventListener("pageshow", () => loadDiscordProfile());
})();