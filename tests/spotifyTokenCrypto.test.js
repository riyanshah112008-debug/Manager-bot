'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptSpotifyToken, decryptSpotifyToken, isEncryptedSpotifyToken } = require('../src/utils/spotifyTokenCrypto');

const testKey = 'test-spotify-token-encryption-secret-32-bytes-minimum';

test('Spotify tokens are authenticated-encrypted at rest', () => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = testKey;
    const plaintext = 'spotify-access-token-secret';
    const encrypted = encryptSpotifyToken(plaintext);
    assert.notEqual(encrypted, plaintext);
    assert.equal(isEncryptedSpotifyToken(encrypted), true);
    assert.equal(decryptSpotifyToken(encrypted), plaintext);
});

test('Spotify token ciphertext tampering is rejected', () => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'test-spotify-token-encryption-secret-32-bytes-minimum';
    const encrypted = encryptSpotifyToken('secret-token');
    const parts = encrypted.split(':');
    parts[4] = (parts[4][0] === '0' ? '1' : '0') + parts[4].slice(1);
    assert.throws(() => decryptSpotifyToken(parts.join(':')));
});

test('legacy plaintext Spotify tokens remain readable for migration', () => {
    assert.equal(decryptSpotifyToken('legacy-token-value'), 'legacy-token-value');
    assert.equal(isEncryptedSpotifyToken('legacy-token-value'), false);
});
