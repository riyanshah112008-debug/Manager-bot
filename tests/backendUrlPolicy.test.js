'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const OLD_RENDER_HOST = 'manager-bot-1-6167.onrender.com';
const NEW_RENDER_ORIGIN = 'https://starry-il8g.onrender.com';
const SCAN_DIRS = ['public', 'src', 'tools'];
const SCAN_ROOT_FILES = ['deploy-commands.js', 'dashboard.js', 'dashboard.html', 'render.yaml', 'firebase.json', 'FIREBASE_DEPLOY.md'];

function listFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(full);
        return /\.(js|html|css|json|md|yaml|yml|txt|py)$/i.test(entry.name) ? [full] : [];
    });
}

test('no suspended Render service URL remains in the repository', () => {
    const files = [
        ...SCAN_DIRS.flatMap(dir => listFiles(path.join(REPO_ROOT, dir))),
        ...SCAN_ROOT_FILES.map(name => path.join(REPO_ROOT, name)).filter(p => fs.existsSync(p))
    ];
    assert(files.length > 100, 'Expected to scan a meaningful number of files.');
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        assert.ok(!content.includes(OLD_RENDER_HOST), `Stale Render URL found in ${path.relative(REPO_ROOT, file)}`);
    }
});

test('the website bridge targets the new Render backend by default', () => {
    const bridge = fs.readFileSync(path.join(REPO_ROOT, 'public/firebase-bridge.js'), 'utf8');
    assert.ok(bridge.includes(`"${NEW_RENDER_ORIGIN}"`), 'firebase-bridge.js must default to the new Render origin.');
    assert.ok(!bridge.includes('YOUR-NEW-SERVICE'), 'firebase-bridge.js must not keep a placeholder backend.');
});

test('trusted dashboard origins include the new Render website origin', () => {
    const { DEFAULT_DASHBOARD_ORIGINS, getDashboardOrigins } = require('../src/utils/dashboardOrigins');
    assert.ok(DEFAULT_DASHBOARD_ORIGINS.includes(NEW_RENDER_ORIGIN));
    assert.ok(getDashboardOrigins({}).has(NEW_RENDER_ORIGIN));
});

test('OAuth login and callback build URLs from the same backend origin', () => {
    const server = fs.readFileSync(path.join(REPO_ROOT, 'src/modules/dashboardServer.js'), 'utf8');
    assert.ok(
        server.includes('const redirectUri = process.env.DISCORD_REDIRECT_URI || `${publicBase}/auth/callback`;'),
        'Login must derive the Discord redirect_uri from the same publicBase used by the callback.'
    );
    assert.ok(
        server.includes('const frontendBase = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || publicBase).replace(/\\/+$/, \'\');'),
        'The callback must return users to the host that served the callback when no frontend URL is configured.'
    );
    assert.ok(
        !server.includes("|| 'https://manager-bot-96c07.web.app'"),
        'The OAuth callback must not fall back to a hardcoded Firebase origin.'
    );
    assert.ok(
        server.includes('redirectUriMismatch'),
        '/auth/status must report a stale DISCORD_REDIRECT_URI host mismatch.'
    );
});
