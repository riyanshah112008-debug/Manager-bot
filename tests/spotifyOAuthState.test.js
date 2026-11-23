'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createSpotifyOAuthState, hashSpotifyOAuthState } = require('../src/utils/spotifyOAuthState');

test('OAuth state is random, URL-safe and stored as a hash', () => {
    const first = createSpotifyOAuthState();
    const second = createSpotifyOAuthState();
    assert.match(first.state, /^[A-Za-z0-9_-]{40,64}$/);
    assert.notEqual(first.state, second.state);
    assert.equal(first.stateHash, hashSpotifyOAuthState(first.state));
    assert.notEqual(first.stateHash, first.state);
});

test('PKCE challenge uses SHA-256 and base64url encoding', () => {
    const state = createSpotifyOAuthState();
    const expected = crypto.createHash('sha256').update(state.codeVerifier).digest('base64url');
    assert.equal(state.codeChallenge, expected);
    assert.ok(state.codeVerifier.length >= 43 && state.codeVerifier.length <= 128);
});

test('invalid and short OAuth states are rejected', () => {
    for (const value of ['', 'user-id', 'a'.repeat(39), 'a'.repeat(65), null, 123]) {
        assert.throws(() => hashSpotifyOAuthState(value));
    }
});
