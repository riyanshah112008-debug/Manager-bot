'use strict';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[character]);

const safeHttpsUrl = (value, fallback = '', allowedHosts = []) => {
    try {
        const parsed = new URL(String(value ?? '').trim());
        if (parsed.protocol !== 'https:') return fallback;
        if (allowedHosts.length && !allowedHosts.includes(parsed.hostname.toLowerCase())) return fallback;
        return parsed.toString();
    } catch {
        return fallback;
    }
};

module.exports = { escapeHtml, safeHttpsUrl };
