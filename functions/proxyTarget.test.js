'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProxyTarget } = require('./proxyTarget');

test('keeps normal request paths on the configured HTTPS backend', () => {
    const target = buildProxyTarget('/api/status?ready=1', 'https://backend.example');
    assert.equal(target.origin, 'https://backend.example');
    assert.equal(target.pathname, '/api/status');
    assert.equal(target.search, '?ready=1');
});

test('rejects scheme-relative external URLs', () => {
    assert.throws(
        () => buildProxyTarget('//attacker.example/collect', 'https://backend.example'),
        /same-origin/
    );
});

test('rejects backslash authority tricks', () => {
    assert.throws(
        () => buildProxyTarget('/\\\\attacker.example/collect', 'https://backend.example'),
        /same-origin/
    );
});

test('rejects absolute external URLs', () => {
    assert.throws(
        () => buildProxyTarget('https://attacker.example/collect', 'https://backend.example'),
        /same-origin/
    );
});

test('rejects control characters in request paths', () => {
    assert.throws(
        () => buildProxyTarget('/api/\r\ncollect', 'https://backend.example'),
        /same-origin/
    );
});

test('rejects non-HTTPS backend configuration', () => {
    assert.throws(
        () => buildProxyTarget('/api/status', 'http://backend.example'),
        /HTTPS/
    );
});

test('rejects backend URLs containing embedded credentials', () => {
    assert.throws(
        () => buildProxyTarget('/api/status', 'https://user:password@backend.example'),
        /credentials/
    );
});
