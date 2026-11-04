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

  // A session can be captured from the OAuth return URL before this script runs.
  // Re-check once after the browser has restored local storage on navigation.
  window.addEventListener("pageshow", () => loadDiscordProfile());
})();