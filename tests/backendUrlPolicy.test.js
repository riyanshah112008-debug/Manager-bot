'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
// Assembled from fragments so this policy file never contains the suspended
// host as one literal string and cannot match itself during the repo scan.
const OLD_RENDER_HOST = ['manager-bot-1-6167', '.onrender', '.com'].join('');
const NEW_RENDER_ORIGIN = 'https://starry-il8g.onrender.com';
const SERVER_JS = 'src/modules/dashboardServer.js';
const BRIDGE_JS = 'public/firebase-bridge.js';
const WORKSPACE_JS = 'public/workspace.js';

function grepRepo(args) {
    try {
        return execFileSync('git', ['grep', '-I', ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    } catch (error) {
        if (error.status === 1) return '';
        throw error;
    }
}

test('no suspended Render service URL remains in the repository', () => {
    const matches = grepRepo(['-F', OLD_RENDER_HOST]);
    assert.equal(matches, '', 'Stale Render URL found:\n' + matches);
});

test('the website bridge targets the new Render backend by default', () => {
    assert.ok(
        grepRepo(['-F', `"${NEW_RENDER_ORIGIN}"`, '--', BRIDGE_JS]),
        'firebase-bridge.js must default to the new Render origin.'
    );
    assert.equal(
        grepRepo(['-F', 'YOUR-NEW-SERVICE', '--', BRIDGE_JS]),
        '',
        'firebase-bridge.js must not keep a placeholder backend.'
    );
});

test('trusted dashboard origins include the new Render website origin', () => {
    const { DEFAULT_DASHBOARD_ORIGINS, getDashboardOrigins } = require('../src/utils/dashboardOrigins');
    assert.ok(DEFAULT_DASHBOARD_ORIGINS.includes(NEW_RENDER_ORIGIN));
    assert.ok(getDashboardOrigins({}).has(NEW_RENDER_ORIGIN));
});

test('OAuth login and callback build URLs from the same backend origin', () => {
    assert.ok(
        grepRepo(['-F', 'const redirectUri = process.env.DISCORD_REDIRECT_URI || `${publicBase}/auth/callback`;', '--', SERVER_JS]),
        'Login must derive the Discord redirect_uri from the same publicBase used by the callback.'
    );
    assert.ok(
        grepRepo(['-F', "const frontendBase = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || publicBase).replace(/\\/+$/, '');", '--', SERVER_JS]),
        'The callback must return users to the host that served the callback when no frontend URL is configured.'
    );
    assert.equal(
        grepRepo(['-F', "|| 'https://manager-bot-96c07.web.app'", '--', SERVER_JS]),
        '',
        'The OAuth callback must not fall back to a hardcoded Firebase origin.'
    );
    assert.ok(
        grepRepo(['-F', 'redirectUriMismatch', '--', SERVER_JS]),
        '/auth/status must report a stale DISCORD_REDIRECT_URI host mismatch.'
    );
});

test('dashboard server never touches the filesystem from request input', () => {
    assert.equal(
        grepRepo(['-E', "require\\('(node:)?fs'\\)", '--', SERVER_JS]),
        '',
        'dashboardServer.js must not import fs.'
    );
    assert.equal(
        grepRepo(['-E', '\\bfs\\.[a-zA-Z]+\\(', '--', SERVER_JS]),
        '',
        'dashboardServer.js must not call fs APIs with dynamically built paths.'
    );
    assert.equal(
        grepRepo(['-E', '\\bpath\\.(join|resolve)\\([^)]*(req\\.|params\\.|query\\.|body\\.)', '--', SERVER_JS]),
        '',
        'dashboardServer.js must never build paths from request input.'
    );
});

test('path traversal payloads stay opaque data in the audit trail', async () => {
    const AuditEvent = require('../src/models/AuditEvent');
    const { getAuditTrail } = require('../src/utils/auditTrail');
    const captured = [];
    const originalFind = AuditEvent.find;
    AuditEvent.find = (query) => {
        captured.push(query);
        return {
            sort: () => ({
                limit: () => ({
                    lean: async () => []
                })
            })
        };
    };
    try {
        assert.deepEqual(await getAuditTrail('../../etc/passwd'), []);
        assert.deepEqual(await getAuditTrail('..%2F..'), []);
        assert.deepEqual(captured, [{ guildId: '../../etc/passwd' }, { guildId: '..%2F..' }]);
    } finally {
        AuditEvent.find = originalFind;
    }
});

test('dashboard renderers touched by this PR never assign raw HTML', () => {
    assert.equal(
        grepRepo(['-E', 'function (loadAudit|renderAuthError|renderPage)\\(.*innerHTML', '--', WORKSPACE_JS]),
        '',
        'Audit log, auth error and page renderers must not write innerHTML; use textContent or the inert DOMParser mount.'
    );
    assert.ok(
        grepRepo(['-F', 'host.replaceChildren(...Array.from(parsed.body.childNodes))', '--', WORKSPACE_JS]),
        'Markup must be mounted through the inert DOMParser helper.'
    );
});

test('feedback and status messages render through textContent, not HTML', () => {
    assert.equal(
        grepRepo(['-F', '.innerHTML=status(', '--', WORKSPACE_JS]),
        '',
        'Status/feedback messages must use writeStatus/prependStatus/appendStatus (textContent), never innerHTML.'
    );
    assert.equal(
        grepRepo(['-F', 'insertAdjacentHTML', '--', WORKSPACE_JS]),
        '',
        'Status/feedback messages must not be injected via insertAdjacentHTML.'
    );
});

test('dynamic URLs in the dashboard shell are scheme-validated', () => {
    assert.ok(
        grepRepo(['-F', 'httpsUrl, discordInviteUrl } = window.StarrySecurity', '--', WORKSPACE_JS]),
        'The dashboard shell must take URL validators from the shared security module.'
    );
    assert.ok(
        grepRepo(['-F', 'httpsUrl(t.artwork,', '--', WORKSPACE_JS]),
        'Remote artwork must pass the https validator before reaching src attributes.'
    );
    assert.ok(
        grepRepo(['-F', 'httpsUrl(user.avatar,', '--', WORKSPACE_JS]),
        'Discord avatars must pass the https validator before reaching src attributes.'
    );
    assert.ok(
        grepRepo(['-F', 'const invite=discordInviteUrl(server.inviteUrl);', '--', WORKSPACE_JS]),
        'Invite links must pass the strict Discord allowlist before reaching href attributes.'
    );
    assert.equal(
        grepRepo(['-E', "href=\"'\\\\\\+esc\\(invite\\)", '--', WORKSPACE_JS]),
        '',
        'Unvalidated invite URLs must never be interpolated into href attributes.'
    );
});
