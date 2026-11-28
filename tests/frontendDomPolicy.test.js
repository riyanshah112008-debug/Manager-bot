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

const SINK_PATTERN = /\.innerHTML\s*=|\.outerHTML\s*=|document\.write\s*\(|insertAdjacentHTML\s*\(/;
const HIGH_RISK_PATTERN = /\.outerHTML\s*=|document\.write\s*\(|insertAdjacentHTML\s*\(/;

// Reviewed safe call sites. Every entry is either a fully static template or a
// renderer whose interpolations are wrapped in esc()/httpsUrl()/Number()/String().
// New sinks must NOT be added here lightly: prefer createElement + textContent.
const SAFE_SITES = {
    'public/workspace.js': [
        'function shell(){document.body.innerHTML=\'<canvas id="starry-ambient"',
        '$("#clusterStats").innerHTML=summary.map(([k,v])',
        '$("#physicalBots").innerHTML=(stats.physicalBots||[]).map(bot=>',
        '$("#virtualNodes").innerHTML=(stats.virtualNodes||[]).map(node=>',
        '$("#virtualNodes").innerHTML=\'<div class="empty">Cluster details are unav',
        'card.innerHTML=(author?\'<div class="discord-embed-author">',
        '$("#commandList").innerHTML=items.length?items.map(command=>',
        '$("#commandCategory").innerHTML=\'<option value="">All categories</option>\'',
        'host.innerHTML=\'<div class="support-list-empty">No conversa',
        'host.innerHTML=items.map(x=>\'<button class="support-thread ',
        '$("#supportMessages").innerHTML=\'<div class="support-empty">',
        '$("#supportMessages").innerHTML=(c.messages||[]).map(m=>',
        'list.innerHTML=\'<div class="empty">No scheduled events yet.',
        'list.innerHTML=d.events.map(e=>',
        '$("#levelStats").innerHTML=[["Members tracked",st.membersTracked||0]',
        '$("#levelLeaderboard").innerHTML=\'<h3>Top XP members</h3>\'',
        '$("#economyStats").innerHTML=[["Members tracked",st.membersTracked||0]',
        '$("#economyLeaderboard").innerHTML=(d.leaderboard||[]).map((u,i)=>',
        'host.innerHTML=\'<div class="empty">Searching connected musi',
        'host.innerHTML=(d.tracks||[]).map(t=>',
        '$("#boosterInfo").innerHTML=\'<b>\'',
        'host.innerHTML=pageHeader("Add Starry to "',
        'sel.innerHTML=\'<option value="">No servers available</opti',
        '$("#workspace").innerHTML=pageHeader("No servers found"',
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

test('innerHTML only appears at reviewed safe call sites', () => {
    for (const file of listPublicFiles('public/*.js')) {
        const content = readPublic(file);
        const allowlist = SAFE_SITES[file] || [];
        for (const allowlisted of allowlist) {
            assert.ok(
                content.includes(allowlisted),
                `${file}: allowlisted site no longer matches (stale entry, remove it): ${allowlisted}`
            );
        }
        for (const line of content.split('\n')) {
            if (!SINK_PATTERN.test(line)) continue;
            if (HIGH_RISK_PATTERN.test(line)) continue;
            const covered = allowlist.some(site => line.includes(site));
            assert.ok(
                covered,
                `${file}: unreviewed dynamic innerHTML sink: ${line.slice(0, 160)}\nConvert it to createElement + textContent or add it to the reviewed allowlist in tests/frontendDomPolicy.test.js.`
            );
        }
    }
});

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
