'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getSpotifyRedirectUri, SPOTIFY_CALLBACK_PATH } = require('../src/utils/spotifyOAuth');

test('uses the exact configured Spotify callback URI', () => {
    const previous = process.env.SPOTIFY_REDIRECT_URI;
    process.env.SPOTIFY_REDIRECT_URI = 'https://starry.example/api/spotify/callback';
    try {
        assert.equal(getSpotifyRedirectUri('https://other.example'), 'https://starry.example/api/spotify/callback');
    } finally {
        if (previous === undefined) delete process.env.SPOTIFY_REDIRECT_URI;
        else process.env.SPOTIFY_REDIRECT_URI = previous;
    }
});

test('builds one canonical callback from Render base URL', () => {
    const previous = process.env.SPOTIFY_REDIRECT_URI;
    delete process.env.SPOTIFY_REDIRECT_URI;
    try {
        assert.equal(getSpotifyRedirectUri('https://starry-service.onrender.com/'), 'https://starry-service.onrender.com' + SPOTIFY_CALLBACK_PATH);
    } finally {
        if (previous !== undefined) process.env.SPOTIFY_REDIRECT_URI = previous;
    }
});

test('rejects missing or invalid base URL rather than generating a mismatched callback', () => {
    const previous = process.env.SPOTIFY_REDIRECT_URI;
    delete process.env.SPOTIFY_REDIRECT_URI;
    try {
        assert.throws(() => getSpotifyRedirectUri(''), /SPOTIFY_REDIRECT_URI/);
        assert.throws(() => getSpotifyRedirectUri('not-a-url'), /valid absolute URL/);
    } finally {
        if (previous !== undefined) process.env.SPOTIFY_REDIRECT_URI = previous;
    }
});
