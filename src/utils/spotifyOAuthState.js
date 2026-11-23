'use strict';

const crypto = require('crypto');

function createSpotifyState() {
    return crypto.randomBytes(32).toString('hex');
}

function hashSpotifyState(state) {
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/i.test(state)) {
        throw new TypeError('Invalid Spotify OAuth state.');
    }
    return crypto.createHash('sha256').update(state, 'utf8').digest('hex');
}

module.exports = { createSpotifyState, hashSpotifyState };
