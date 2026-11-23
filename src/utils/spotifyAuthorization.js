'use strict';

const SpotifyOAuthState = require('../models/SpotifyOAuthState');
const { createSpotifyOAuthState } = require('./spotifyOAuthState');

async function createSpotifyAuthorizationUrl(userId, redirectUri, spotifyManager) {
    if (typeof userId !== 'string' || !/^\d{17,20}$/.test(userId)) {
        throw new Error('A valid Discord user ID is required to connect Spotify.');
    }
    if (!spotifyManager || typeof spotifyManager.getOAuthUrl !== 'function') {
        throw new Error('Spotify account service is unavailable.');
    }

    const authState = createSpotifyOAuthState();
    await SpotifyOAuthState.create({
        stateHash: authState.stateHash,
        userId,
        codeVerifier: authState.codeVerifier,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    return spotifyManager.getOAuthUrl(redirectUri, authState.state, authState.codeChallenge);
}

module.exports = { createSpotifyAuthorizationUrl };
