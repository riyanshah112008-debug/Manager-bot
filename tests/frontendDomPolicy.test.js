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

test('public scripts do not write HTML through executable DOM sinks', () => {
    for (const file of listPublicFiles('public/*.js')) {
        const source = readPublic(file);
        assert.ok(!SINK_PATTERN.test(source), `${file} must use DOM construction or sanitized mountMarkup instead of HTML string sinks.`);
    }
});

test('dashboard markup mounting strips executable elements and unsafe attributes', () => {
    const workspace = readPublic('public/workspace.js');
    for (const token of ['new DOMParser()', 'child.remove()', 'name.startsWith("on")', 'name==="srcdoc"', 'host.replaceChildren']) {
        assert.ok(workspace.includes(token), `mountMarkup must enforce ${token}.`);
    }
});

test('every dashboard page loads security-utils.js before workspace.js', () => {
    const pages = listPublicFiles('public/*.html');
    assert.ok(pages.length > 20, 'Expected to scan the dashboard HTML pages.');
    for (const page of pages) {
        const source = readPublic(page);
        if (!source.includes('workspace.js')) continue;
        const securityIndex = source.indexOf('security-utils.js');
        const workspaceIndex = source.indexOf('workspace.js');
        assert.ok(securityIndex !== -1, `${page} must load security-utils.js.`);
        assert.ok(securityIndex < workspaceIndex, `${page} must load security-utils.js before workspace.js.`);
    }
});

test('security-utils exposes the shared sanitizers', () => {
    const source = readPublic('public/security-utils.js');
    for (const symbol of ['escapeHtml', 'safeSetAttr', 'httpsUrl', 'discordInviteUrl', 'window.StarrySecurity']) {
        assert.ok(source.includes(symbol), `security-utils.js must export ${symbol}.`);
    }
    assert.ok(source.includes('SAFE_ATTRS'), 'safeSetAttr must enforce an attribute whitelist.');
});
