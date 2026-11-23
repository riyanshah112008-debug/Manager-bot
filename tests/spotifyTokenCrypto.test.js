'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const originalKey = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
const { encryptToken, decryptToken, PREFIX } = require('../src/utils/spotifyTokenCrypto');

test('Spotify tokens encrypt and decrypt with authenticated encryption', () => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
    const plaintext = 'spotify-access-token-example';
    const ciphertext = encryptToken(plaintext);
    assert.notEqual(ciphertext, plaintext);
    assert.ok(ciphertext.startsWith(PREFIX));
    assert.equal(decryptToken(ciphertext), plaintext);
});

test('encrypting the same token uses a fresh IV', () => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);
    const first = encryptToken('same-token');
    const second = encryptToken('same-token');
    assert.notEqual(first, second);
    assert.equal(decryptToken(first), 'same-token');
    assert.equal(decryptToken(second), 'same-token');
});

test('legacy plaintext values remain readable for migration', () => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'c'.repeat(64);
    assert.equal(decryptToken('legacy-plaintext-token'), 'legacy-plaintext-token');
    assert.equal(decryptToken(''), '');
    assert.equal(decryptToken(null), '');
});

test('tampered ciphertext is rejected', () => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'd'.repeat(64);
    const ciphertext = encryptToken('sensitive');
    const tampered = ciphertext.slice(0, -2) + (ciphertext.endsWith('00') ? '11' : '00');
    assert.throws(() => decryptToken(tampered));
});

test('missing and malformed encryption keys fail closed', () => {
    delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    assert.throws(() => encryptToken('token'), /SPOTIFY_TOKEN_ENCRYPTION_KEY/);
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'too-short';
    assert.throws(() => encryptToken('token'), /32 random bytes/);
});

test('restore the caller environment', () => {
    if (originalKey === undefined) delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    else process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = originalKey;
});
