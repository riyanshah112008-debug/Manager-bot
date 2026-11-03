(() => {
  "use strict";

  const RENDER_BACKEND = "https://manager-bot-1-6167.onrender.com";
  const isFirebaseHost = /(^|\\.)web\\.app$/i.test(location.hostname) ||
    /(^|\\.)firebaseapp\\.com$/i.test(location.hostname);
  const backendOrigin = isFirebaseHost ? RENDER_BACKEND : location.origin;
  const sessionKey = "starry_dashboard_session";

  // OAuth returns the short-lived session in the URL. Store it for this tab,
  // then immediately remove it from the visible URL.
  try {
    const params = new URLSearchParams(location.search);
    const session = params.get("session");
    if (session) {
      sessionStorage.setItem(sessionKey, session);
      params.delete("session");
      const cleanQuery = params.toString();
      history.replaceState({}, document.title,
        location.pathname + (cleanQuery ? "?" + cleanQuery : "") + location.hash);
    }
  } catch (_) {}

  function isBackendPath(pathname) {
    return pathname.startsWith("/api/") ||
      pathname.startsWith("/auth/") ||
      pathname === "/setup" ||
      pathname.startsWith("/verify") ||
      pathname === "/vote" ||
      pathname === "/health" ||
      pathname === "/ping";
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    let rawUrl = typeof input === "string" ? input :
      (input instanceof URL ? input.href : input.url);

    let parsed;
    try { parsed = new URL(rawUrl, location.href); }
    catch (_) { return nativeFetch(input, init); }

    if (parsed.origin !== location.origin || !isBackendPath(parsed.pathname)) {
      return nativeFetch(input, init);
    }

    const target = backendOrigin + parsed.pathname + parsed.search + parsed.hash;
    const headers = new Headers(
      (init && init.headers) || (input instanceof Request ? input.headers : undefined)
    );

    try {
      const token = sessionStorage.getItem(sessionKey);
      if (token) headers.set("Authorization", "Bearer " + token);
    } catch (_) {}

    const requestInput = input instanceof Request ? new Request(target, input) : target;
    return nativeFetch(requestInput, { ...(init || {}), headers, mode: "cors" });
  };

  function rewriteBackendLinks(root) {
    (root || document).querySelectorAll("a[href], form[action]").forEach((element) => {
      const attr = element.tagName === "FORM" ? "action" : "href";
      const value = element.getAttribute(attr);
      if (!value || !value.startsWith("/")) return;
      const parsed = new URL(value, location.origin);
      if (isBackendPath(parsed.pathname)) {
        element.setAttribute(attr, backendOrigin + parsed.pathname + parsed.search + parsed.hash);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => rewriteBackendLinks());
  document.addEventListener("click", (event) => {
    const link = event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    const parsed = new URL(link.href, location.href);
    if (parsed.origin === location.origin && isBackendPath(parsed.pathname)) {
      event.preventDefault();
      location.href = backendOrigin + parsed.pathname + parsed.search + parsed.hash;
    }
  }, true);
})();
