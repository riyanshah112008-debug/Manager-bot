'use strict';

const crypto = require('node:crypto');

function createSpotifyOAuthState() {
    const state = crypto.randomBytes(32).toString('base64url');
    const codeVerifier = crypto.randomBytes(64).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const stateHash = hashSpotifyOAuthState(state);
    return { state, stateHash, codeVerifier, codeChallenge };
}

function hashSpotifyOAuthState(state) {
    if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{40,64}$/.test(state)) {
        throw new Error('Invalid Spotify OAuth state.');
    }
    return crypto.createHash('sha256').update(state, 'utf8').digest('hex');
}

module.exports = { createSpotifyOAuthState, hashSpotifyOAuthState };
