'use strict';

const DEFAULT_DASHBOARD_ORIGINS = Object.freeze([
    'https://manager-bot-96c07.web.app',
    'https://manager-bot-96c07.firebaseapp.com'
]);

function getDashboardOrigins(env = process.env) {
    return new Set([
        ...DEFAULT_DASHBOARD_ORIGINS,
        env.CORS_ORIGINS,
        env.FRONTEND_URL,
        env.PUBLIC_URL,
        env.RENDER_EXTERNAL_URL
    ]
        .flatMap(value => String(value || '').split(','))
        .map(value => value.trim().replace(/\/+$/, ''))
        .filter(Boolean));
}

module.exports = { DEFAULT_DASHBOARD_ORIGINS, getDashboardOrigins };
