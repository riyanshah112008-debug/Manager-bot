'use strict';

const SPOTIFY_CALLBACK_PATH = '/api/spotify/callback';

function getSpotifyRedirectUri(publicBaseUrl) {
    const configured = process.env.SPOTIFY_REDIRECT_URI;
    if (typeof configured === 'string' && configured.trim()) return configured.trim();

    const base = typeof publicBaseUrl === 'string' ? publicBaseUrl.trim() : '';
    if (!base) {
        throw new Error('Spotify OAuth is not configured. Set SPOTIFY_REDIRECT_URI to the exact callback URL registered in Spotify Developer Dashboard.');
    }

    let parsed;
    try {
        parsed = new URL(base);
    } catch (_) {
        throw new Error('Spotify OAuth base URL must be a valid absolute URL.');
    }

    if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new Error('Spotify OAuth base URL must use HTTPS (HTTP is only suitable for local development).');
    }

    return parsed.origin + SPOTIFY_CALLBACK_PATH;
}

module.exports = { SPOTIFY_CALLBACK_PATH, getSpotifyRedirectUri };
