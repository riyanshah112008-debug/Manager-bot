'use strict';

const assert = require('node:assert/strict');
const { getDashboardOrigins } = require('../src/utils/dashboardOrigins');

const defaults = getDashboardOrigins({});
assert(defaults.has('https://manager-bot-96c07.web.app'));
assert(defaults.has('https://manager-bot-96c07.firebaseapp.com'));

const configured = getDashboardOrigins({
    CORS_ORIGINS: 'https://custom.example, https://admin.example/',
    FRONTEND_URL: 'https://frontend.example/',
    PUBLIC_URL: 'https://public.example',
    RENDER_EXTERNAL_URL: 'https://bot.example/'
});
for (const origin of [
    'https://custom.example',
    'https://admin.example',
    'https://frontend.example',
    'https://public.example',
    'https://bot.example'
]) assert(configured.has(origin), 'Expected trusted origin: ' + origin);

assert(!configured.has('https://attacker.example'));
console.log('Dashboard origin policy tests passed.');
