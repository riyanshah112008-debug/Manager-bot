'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptToken, decryptToken } = require('../src/utils/spotifyTokenVault');

test('Spotify tokens are encrypted at rest and can be decrypted', () => {
    const previous = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'test-only-random-key-for-starry-token-vault';
    try {
        const original = 'spotify-access-refresh-token-secret';
        const encrypted = encryptToken(original);
        assert.match(encrypted, /^v1:/);
        assert.notEqual(encrypted, original);
        assert.equal(decryptToken(encrypted), original);
        assert.equal(decryptToken('legacy-plaintext-token'), 'legacy-plaintext-token');
        assert.equal(encryptToken(''), '');
        assert.throws(() => decryptToken(encrypted.slice(0, -2) + 'aa'));
    } finally {
        if (previous === undefined) delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
        else process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = previous;
    }
});
