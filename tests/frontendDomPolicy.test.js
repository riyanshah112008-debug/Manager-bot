'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');

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

test('shared security sanitizers enforce escaping, URL schemes and attribute allowlist', () => {
    const source = readPublic('public/security-utils.js');
    const window = {};
    vm.runInNewContext(source, { window });
    const security = window.StarrySecurity;
    assert.equal(security.escapeHtml('<img src=x onerror="alert(1)"> & \'x\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;x&#39;');
    assert.equal(security.httpsUrl('https://example.com/image.png'), 'https://example.com/image.png');
    assert.equal(security.httpsUrl('javascript:alert(1)', '/fallback.png'), '/fallback.png');
    assert.equal(security.discordInviteUrl('https://discord.gg/starry'), 'https://discord.gg/starry');
    assert.equal(security.discordInviteUrl('javascript:alert(1)'), '');
    const attributes = {};
    const element = { setAttribute(name, value) { attributes[name] = value; } };
    assert.equal(security.safeSetAttr(element, 'href', 'javascript:alert(1)'), element);
    assert.equal(attributes.href, '');
    assert.throws(() => security.safeSetAttr(element, 'onclick', 'alert(1)'), /not allowed/);
});
