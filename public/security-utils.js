(() => {
"use strict";
const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const httpsUrl = (value, fallback = "") => {
    const v = String(value ?? "").trim();
    return /^https:\/\//i.test(v) ? v : fallback;
};
const discordInviteUrl = value => {
    const v = String(value ?? "").trim();
    return /^https:\/\/([\w-]+\.)*(discord\.gg|discord(app)?\.com)(\/|$)/.test(v) ? v : "";
};
const SAFE_ATTRS = new Set([
    "class", "id", "type", "name", "value", "placeholder", "min", "max", "step",
    "role", "title", "alt", "href", "src", "target", "rel", "hidden",
    "aria-label", "data-page", "data-nav-label", "data-control", "data-guild-id",
    "data-emoji", "data-support-id", "data-cancel-event", "data-music-query",
    "data-worker-role", "data-remove-worker", "data-reward-row",
    "data-reward-level", "data-reward-role", "data-remove-reward"
]);
const safeSetAttr = (el, attr, value) => {
    const name = String(attr).toLowerCase();
    if (!SAFE_ATTRS.has(name)) throw new Error("Attribute not allowed by safeSetAttr: " + name);
    let finalValue = String(value ?? "");
    if (name === "href" || name === "src") {
        const ok = /^https:\/\//i.test(finalValue) || finalValue.startsWith("/") || finalValue.startsWith("#");
        if (!ok) finalValue = "";
    }
    el.setAttribute(name, finalValue);
    return el;
};
window.StarrySecurity = Object.freeze({ escapeHtml, httpsUrl, discordInviteUrl, safeSetAttr });
})();
