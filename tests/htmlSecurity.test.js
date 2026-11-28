'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, safeHttpsUrl } = require('../src/utils/htmlSecurity');

test('HTML output escapes every markup-significant character', () => {
    assert.equal(
        escapeHtml('<img src=x onerror="alert(1)"> & \'quoted\''),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;'
    );
});

test('HTML output safely handles nullish and non-string values', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(42), '42');
});

test('safe HTTPS URLs reject script, data, and insecure schemes', () => {
    const fallback = 'https://cdn.discordapp.com/embed/avatars/0.png';
    for (const value of ['javascript:alert(1)', 'data:text/html,evil', 'http://cdn.discordapp.com/a.png', 'not a URL']) {
        assert.equal(safeHttpsUrl(value, fallback, ['cdn.discordapp.com']), fallback);
    }
});

test('safe HTTPS URLs enforce the allowed host list', () => {
    const fallback = 'https://cdn.discordapp.com/embed/avatars/0.png';
    assert.equal(
        safeHttpsUrl('https://attacker.example/image.svg', fallback, ['cdn.discordapp.com']),
        fallback
    );
    assert.equal(
        safeHttpsUrl('https://cdn.discordapp.com/icons/123/avatar.png', fallback, ['cdn.discordapp.com']),
        'https://cdn.discordapp.com/icons/123/avatar.png'
    );
});

test('safe HTTPS URLs allow only explicitly configured HTTPS hosts', () => {
    assert.equal(
        safeHttpsUrl('https://media.discordapp.net/image.png', '', ['cdn.discordapp.com', 'media.discordapp.net']),
        'https://media.discordapp.net/image.png'
    );
});
