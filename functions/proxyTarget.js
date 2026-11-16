'use strict';

function resolveProxyTarget(requestTarget, backend) {
    const base = backend instanceof URL ? backend : new URL(String(backend || ''));
    if (!['http:', 'https:'].includes(base.protocol) || !base.hostname || base.username || base.password) {
        throw new Error('Configured backend URL is invalid.');
    }
    if (typeof requestTarget !== 'string' || !requestTarget.startsWith('/')) {
        throw new Error('Proxy request target must be a relative path.');
    }

    const target = new URL(requestTarget, base.origin);
    if (target.origin !== base.origin || target.username || target.password) {
        throw new Error('Proxy request target must stay on the configured backend origin.');
    }
    return target;
}

module.exports = { resolveProxyTarget };
