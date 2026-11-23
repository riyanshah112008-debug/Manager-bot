'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptToken, decryptToken, isEncryptedToken } = require('../src/utils/spotifyTokenVault');

test('Spotify tokens are authenticated-encrypted at rest', () => {
    const old = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'test-only-key-with-more-than-thirty-two-characters';
    try {
        const plain = 'spotify-refresh-token-test-value';
        const encrypted = encryptToken(plain);
        assert.ok(isEncryptedToken(encrypted));
        assert.ok(!encrypted.includes(plain));
        assert.equal(decryptToken(encrypted), plain);
    } finally {
        if (old === undefined) delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
        else process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = old;
    }
});

test('Spotify token decryption fails closed after ciphertext tampering', () => {
    const old = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'test-only-key-with-more-than-thirty-two-characters';
    try {
        const encrypted = encryptToken('secret');
        const changed = encrypted.slice(0, -2) + 'ff';
        assert.throws(() => decryptToken(changed));
    } finally {
        if (old === undefined) delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
        else process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = old;
    }
});

test('legacy plaintext records can be read for controlled migration', () => {
    assert.equal(decryptToken('legacy-token'), 'legacy-token');
    assert.equal(isEncryptedToken('legacy-token'), false);
});

test('encryption requires a dedicated strong key', () => {
    const old = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    try {
        assert.throws(() => encryptToken('secret'), /SPOTIFY_TOKEN_ENCRYPTION_KEY/);
    } finally {
        if (old !== undefined) process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = old;
    }
});
