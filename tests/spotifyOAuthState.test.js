'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSpotifyState, hashSpotifyState } = require('../src/utils/spotifyOAuthState');

test('Spotify state is random, opaque and 256 bits long', () => {
    const first = createSpotifyState();
    const second = createSpotifyState();
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.notEqual(first, second);
    assert.notEqual(first, '123456789012345678');
});

test('Spotify state is stored as a one-way SHA-256 digest', () => {
    const state = createSpotifyState();
    const digest = hashSpotifyState(state);
    assert.match(digest, /^[a-f0-9]{64}$/);
    assert.notEqual(digest, state);
    assert.equal(hashSpotifyState(state), digest);
});

test('malformed or non-string OAuth state is rejected', () => {
    assert.throws(() => hashSpotifyState('user-discord-id'), TypeError);
    assert.throws(() => hashSpotifyState(''), TypeError);
    assert.throws(() => hashSpotifyState(null), TypeError);
});
