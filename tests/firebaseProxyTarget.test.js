'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { resolveProxyTarget } = require('../functions/proxyTarget');

test('relative API paths resolve against the configured backend origin', () => {
    const target = resolveProxyTarget('/api/health?check=1', new URL('https://backend.example/base'));
    assert.equal(target.origin, 'https://backend.example');
    assert.equal(target.pathname, '/api/health');
    assert.equal(target.search, '?check=1');
});

test('protocol-relative request targets cannot replace the backend host', () => {
    assert.throws(
        () => resolveProxyTarget('//attacker.example/collect', new URL('https://backend.example')),
        /relative path/
    );
});

test('absolute request targets are rejected before credentials can be forwarded', () => {
    assert.throws(
        () => resolveProxyTarget('https://attacker.example/collect', new URL('https://backend.example')),
        /relative path/
    );
});

test('backslash-based authority overrides cannot change the upstream origin', () => {
    assert.throws(
        () => resolveProxyTarget('/\\\\attacker.example/collect', new URL('https://backend.example')),
        /configured backend origin/
    );
});

test('backend URLs containing user information are rejected', () => {
    assert.throws(
        () => resolveProxyTarget('/api/health', new URL('https://user:pass@backend.example')),
        /Configured backend URL/
    );
});

test('empty, non-string, and non-path request targets are rejected', () => {
    for (const value of ['', 'api/health', null, undefined, 4]) {
        assert.throws(() => resolveProxyTarget(value, new URL('https://backend.example')));
    }
});

test('proxy function uses the origin-locked resolver before forwarding headers', () => {
    const source = fs.readFileSync('functions/index.js', 'utf8');
    assert.ok(source.includes('target = resolveProxyTarget(req.originalUrl, backend)'));
    assert.ok(source.indexOf('target = resolveProxyTarget(req.originalUrl, backend)') <
        source.indexOf('const value = req.get(name)'));
});
