// ==========================================
// 🌐 STARRY PUBLIC URL MANAGER
// Render provides a public URL itself; localtunnel is only for local hosting.
// ==========================================
const localtunnel = require('localtunnel');

let activeTunnel = null;
let publicDomainUrl = 'https://manager-bot-1-6167.onrender.com';
let isConnecting = false;
let reconnectTimer = null;

function getRenderUrl() {
    if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, '');
    }
    if (process.env.RENDER_EXTERNAL_HOSTNAME) {
        return `https://${process.env.RENDER_EXTERNAL_HOSTNAME.trim().replace(/\/+$/, '')}`;
    }
    return null;
}

async function startTunnel(port = 10000) {
    // Do not create a second public tunnel in Render. It can fail/reconnect
    // indefinitely and can accidentally override the canonical OAuth URL.
    if (process.env.RENDER === 'true' || process.env.RENDER === '1' || getRenderUrl()) {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (activeTunnel) {
            try { activeTunnel.close(); } catch (_) {}
            activeTunnel = null;
        }

        const renderUrl = getRenderUrl();
        if (renderUrl) {
            publicDomainUrl = renderUrl;
            global.PUBLIC_WEB_URL = renderUrl;
            process.env.PUBLIC_WEB_URL = renderUrl;
            console.log(`🌐 [Starry Public URL] Using Render URL: ${renderUrl}`);
            return renderUrl;
        }

        console.warn('ℹ️ [Starry Public URL] Render detected; waiting for RENDER_EXTERNAL_URL. Localtunnel is disabled.');
        return null;
    }

    if (isConnecting) return publicDomainUrl;
    isConnecting = true;

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    try {
        if (activeTunnel) {
            try { activeTunnel.close(); } catch (_) {}
            activeTunnel = null;
        }

        activeTunnel = await localtunnel({
            port,
            subdomain: 'starry-bot'
        });

        publicDomainUrl = activeTunnel.url;
        global.PUBLIC_WEB_URL = publicDomainUrl;
        process.env.PUBLIC_WEB_URL = publicDomainUrl;
        isConnecting = false;

        console.log(`🌐 [Starry Public Domain] Live local tunnel: ${publicDomainUrl}`);

        activeTunnel.on('close', () => scheduleReconnect(port, 10000));
        activeTunnel.on('error', () => scheduleReconnect(port, 15000));
        return publicDomainUrl;
    } catch (error) {
        try {
            activeTunnel = await localtunnel({ port });
            publicDomainUrl = activeTunnel.url;
            global.PUBLIC_WEB_URL = publicDomainUrl;
            process.env.PUBLIC_WEB_URL = publicDomainUrl;
            isConnecting = false;
            console.log(`🌐 [Starry Public Domain Fallback]: ${publicDomainUrl}`);
            activeTunnel.on('close', () => scheduleReconnect(port, 10000));
            activeTunnel.on('error', () => scheduleReconnect(port, 15000));
            return publicDomainUrl;
        } catch (fallbackError) {
            isConnecting = false;
            scheduleReconnect(port, 20000);
            console.warn('⚠️ [Starry Public URL] Localtunnel unavailable; will retry:', fallbackError.message);
            return null;
        }
    }
}

function scheduleReconnect(port, delayMs) {
    if (reconnectTimer || process.env.RENDER === 'true' || process.env.RENDER === '1' || getRenderUrl()) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startTunnel(port).catch(error => {
            console.warn('⚠️ [Starry Public URL] Reconnect failed:', error.message);
        });
    }, delayMs);
}

function getPublicUrl() {
    // Explicit public URLs are useful for custom domains and verification proxies.
    for (const key of ['VERIFY_URL', 'PUBLIC_VERIFY_URL', 'PUBLIC_URL', 'CUSTOM_DOMAIN', 'GG_DOMAIN']) {
        const value = process.env[key];
        if (value && value.trim()) return value.trim().replace(/\/+$/, '');
    }

    // Render's assigned service URL must take precedence over any stale tunnel URL.
    const renderUrl = getRenderUrl();
    if (renderUrl) return renderUrl;

    if (global.PUBLIC_WEB_URL && typeof global.PUBLIC_WEB_URL === 'string' &&
        !global.PUBLIC_WEB_URL.includes('localhost') && !global.PUBLIC_WEB_URL.includes('127.0.0.1')) {
        return global.PUBLIC_WEB_URL.trim().replace(/\/+$/, '');
    }
    if (process.env.PUBLIC_WEB_URL && typeof process.env.PUBLIC_WEB_URL === 'string' &&
        !process.env.PUBLIC_WEB_URL.includes('localhost') && !process.env.PUBLIC_WEB_URL.includes('127.0.0.1')) {
        return process.env.PUBLIC_WEB_URL.trim().replace(/\/+$/, '');
    }

    return publicDomainUrl;
}

module.exports = {
    startTunnel,
    getPublicUrl
};
