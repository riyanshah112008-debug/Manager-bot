'use strict';

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function buildProxyTarget(originalUrl, backendUrl) {
    const backend = backendUrl instanceof URL ? backendUrl : new URL(backendUrl);

    if (backend.protocol !== 'https:' || backend.username || backend.password) {
        throw new TypeError('Backend URL must use HTTPS and contain no embedded credentials.');
    }

    if (
        typeof originalUrl !== 'string' ||
        !originalUrl.startsWith('/') ||
        originalUrl.startsWith('//') ||
        originalUrl.includes('\\') ||
        CONTROL_CHARACTERS.test(originalUrl)
    ) {
        throw new TypeError('Proxy path must be a same-origin absolute path.');
    }

    const target = new URL(originalUrl, backend.origin);
    if (target.origin !== backend.origin) {
        throw new TypeError('Proxy path escaped the configured backend origin.');
    }

    return target;
}

module.exports = { buildProxyTarget };
