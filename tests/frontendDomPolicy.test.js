'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

function listPublicFiles(pattern) {
    const out = execFileSync('git', ['ls-files', pattern], { cwd: REPO_ROOT, encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
}

function readPublic(rel) {
    return execFileSync('cat', [rel], { cwd: REPO_ROOT, encoding: 'utf8' });
}

const SINK_PATTERN = /\\.innerHTML\\s*=|\\.outerHTML\\s*=|document\\.write\\s*\\(|insertAdjacentHTML\\s*\\(/;

// Reviewed safe call sites. Every entry is either a fully static template or a
// renderer whose interpolations are wrapped in esc()/httpsUrl()/Number()/String().
// New sinks must NOT be added here lightly: prefer createElement + textContent.
const SAFE_SITES = {
    'public/workspace.js': [
        'function shell(){document.body.innerHTML=\'<canvas id="starry-ambient"',
                                        'card.innerHTML=(author?\'<div class="discord-embed-author">',
        '$("#commandList").innerHTML=items.length?items.map(command=>',
                'host.innerHTML=\'<div class="support-list-empty">No conversa',
        'host.innerHTML=items.map(x=>\'<button class="support-thread ',
        '$("#supportMessages").innerHTML=\'<div class="support-empty">',
        '$("#supportMessages").innerHTML=(c.messages||[]).map(m=>',
                        '$("#levelStats").innerHTML=[["Members tracked",st.membersTracked||0]',
        '$("#levelLeaderboard").innerHTML=\'<h3>Top XP members</h3>\'',
        '$("#economyStats").innerHTML=[["Members tracked",st.membersTracked||0]',
        '$("#economyLeaderboard").innerHTML=(d.leaderboard||[]).map((u,i)=>',
                        '$("#boosterInfo").innerHTML=\'<b>\'',
                                'sel.innerHTML=(installedGuilds.length?\'<optgroup label="ST',
        'else document.body.innerHTML=\'<div class="empty status bad">\''
    ]
};

test('public scripts contain no high-risk DOM sinks', () => {
    for (const file of listPublicFiles('public/*.js')) {
        const content = readPublic(file);
        assert.ok(!HIGH_RISK_PATTERN.test(content), `${file} must not use outerHTML, document.write or insertAdjacentHTML.`);
    }
});

test('public scripts do not write HTML through executable DOM sinks', () => {\n    for (const file of listPublicFiles('public/*.js')) {\n        const content = readPublic(file);\n        assert.ok(!SINK_PATTERN.test(content), `${file} must use createElement/textContent or the sanitized mountMarkup helper instead of HTML string sinks.`);\n    }\n});\n
test('every dashboard page loads security-utils.js before workspace.js', () => {
    const pages = listPublicFiles('public/*.html');
    assert.ok(pages.length > 20, 'Expected to scan the dashboard HTML pages.');
    for (const page of pages) {
        const content = readPublic(page);
        if (!content.includes('workspace.js')) continue;
        const secIdx = content.indexOf('security-utils.js');
        const wsIdx = content.indexOf('workspace.js');
        assert.ok(secIdx !== -1, `${page} must load security-utils.js.`);
        assert.ok(secIdx < wsIdx, `${page} must load security-utils.js before workspace.js.`);
    }
});

test('security-utils exposes the shared sanitizers', () => {
    const utils = readPublic('public/security-utils.js');
    for (const symbol of ['escapeHtml', 'safeSetAttr', 'httpsUrl', 'discordInviteUrl', 'window.StarrySecurity']) {
        assert.ok(utils.includes(symbol), `security-utils.js must export ${symbol}.`);
    }
    assert.ok(
        utils.includes('SAFE_ATTRS'),
        'safeSetAttr must enforce an attribute whitelist.'
    );
});
