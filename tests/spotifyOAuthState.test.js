'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSpotifyOAuthState, verifySpotifyOAuthState } = require('../src/utils/spotifyOAuthState');

const userId = '123456789012345678';
const secret = 'test-secret-that-is-long-enough-for-hmac-state-signing';

test('Spotify OAuth state is bound to the authenticated Discord user', () => {
    const state = createSpotifyOAuthState(userId, secret, 'abcdefghijklmnopqrstuvwxyz012345');
    assert.equal(verifySpotifyOAuthState(state, state, secret), userId);
});

test('Spotify OAuth state rejects a different browser cookie value', () => {
    const state = createSpotifyOAuthState(userId, secret, 'abcdefghijklmnopqrstuvwxyz012345');
    assert.equal(verifySpotifyOAuthState(state, state + 'x', secret), null);
});

test('Spotify OAuth state rejects a modified signature and wrong secret', () => {
    const state = createSpotifyOAuthState(userId, secret, 'abcdefghijklmnopqrstuvwxyz012345');
    const parts = state.split('.');
    parts[2] = 'A'.repeat(parts[2].length);
    assert.equal(verifySpotifyOAuthState(parts.join('.'), parts.join('.'), secret), null);
    assert.equal(verifySpotifyOAuthState(state, state, secret + '-wrong'), null);
});

test('Spotify OAuth state refuses malformed Discord IDs and weak signing secrets', () => {
    assert.throws(() => createSpotifyOAuthState('not-a-discord-id', secret), /Discord user ID/);
    assert.throws(() => createSpotifyOAuthState(userId, 'short'), /at least 32 characters/);
});
