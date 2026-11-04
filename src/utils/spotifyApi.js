// Spotify Web API metadata resolver for Starry.
// Uses only backend-held app credentials. It never streams Spotify audio.
'use strict';

const API = 'https://api.spotify.com/v1';
let cachedToken = null;
let tokenExpiresAt = 0;

function parseSpotifyUrl(input) {
    if (typeof input !== 'string') return null;
    const value = input.trim();
    const uriMatch = value.match(/^spotify:(track|album|playlist):([A-Za-z0-9]+)$/i);
    if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] };
    let url;
    try { url = new URL(value); } catch (_) { return null; }
    if (!['open.spotify.com', 'play.spotify.com'].includes(url.hostname.toLowerCase())) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const typeIndex = parts.findIndex(part => ['track', 'album', 'playlist'].includes(part.toLowerCase()));
    if (typeIndex < 0 || !parts[typeIndex + 1]) return null;
    const id = parts[typeIndex + 1].split('?')[0];
    if (!/^[A-Za-z0-9]+$/.test(id)) return null;
    return { type: parts[typeIndex].toLowerCase(), id };
}

async function getAppAccessToken() {
    const now = Date.now();
    if (cachedToken && tokenExpiresAt > now + 60000) return cachedToken;
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        const error = new Error('Spotify is not configured on the Starry backend yet.');
        error.code = 'SPOTIFY_NOT_CONFIGURED';
        throw error;
    }
    const basic = Buffer.from(clientId + ':' + clientSecret).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + basic,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
        const error = new Error(data.error_description || data.error?.message || 'Spotify rejected the app credentials.');
        error.status = response.status;
        error.code = 'SPOTIFY_AUTH_FAILED';
        throw error;
    }
    cachedToken = data.access_token;
    tokenExpiresAt = now + Math.max(60, Number(data.expires_in) || 3600) * 1000;
    return cachedToken;
}

async function spotifyGet(pathname) {
    const token = await getAppAccessToken();
    const response = await fetch(API + pathname, {
        headers: { Authorization: 'Bearer ' + token }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error?.message || 'Spotify metadata request failed.');
        error.status = response.status;
        error.code = response.status === 429 ? 'SPOTIFY_RATE_LIMITED' : 'SPOTIFY_API_ERROR';
        throw error;
    }
    return data;
}

function cleanTrack(track) {
    if (!track || !track.name) return null;
    return {
        id: track.id || null,
        uri: track.uri || (track.id ? 'spotify:track:' + track.id : null),
        title: track.name,
        artist: Array.isArray(track.artists) ? track.artists.map(a => a.name).filter(Boolean).join(', ') : '',
        album: track.album?.name || '',
        durationMs: Number(track.duration_ms) || 0,
        artwork: track.album?.images?.[0]?.url || track.images?.[0]?.url || null,
        spotifyUrl: track.external_urls?.spotify || null,
        query: [track.name, ...(track.artists || []).map(a => a.name)].filter(Boolean).join(' ')
    };
}

async function searchTracks(query, limit = 10) {
    const q = String(query || '').trim();
    if (!q) return [];
    const safeLimit = Math.min(10, Math.max(1, Number(limit) || 10));
    const data = await spotifyGet('/search?' + new URLSearchParams({ q, type: 'track', limit: String(safeLimit) }));
    return (data.tracks?.items || []).map(cleanTrack).filter(Boolean);
}

async function getPlaylistTracks(id, maxTracks = 50) {
    const tracks = [];
    let offset = 0;
    const limit = 50;
    while (tracks.length < maxTracks) {
        const data = await spotifyGet('/playlists/' + encodeURIComponent(id) + '/items?' + new URLSearchParams({
            limit: String(Math.min(limit, maxTracks - tracks.length)),
            offset: String(offset)
        }));
        const items = Array.isArray(data.items) ? data.items : [];
        for (const entry of items) {
            const track = cleanTrack(entry.item || entry.track);
            if (track) tracks.push(track);
        }
        if (!data.next || !items.length) break;
        offset += items.length;
    }
    return tracks;
}

async function getAlbumTracks(id, maxTracks = 50) {
    const data = await spotifyGet('/albums/' + encodeURIComponent(id) + '/tracks?' + new URLSearchParams({ limit: '50' }));
    const album = await spotifyGet('/albums/' + encodeURIComponent(id));
    return (data.items || []).slice(0, maxTracks).map(track => cleanTrack({
        ...track,
        album: { name: album.name, images: album.images },
        external_urls: track.external_urls || album.external_urls
    })).filter(Boolean);
}

async function resolveSpotifyUrl(input, options = {}) {
    const parsed = parseSpotifyUrl(input);
    if (!parsed) return null;
    const maxTracks = Math.min(50, Math.max(1, Number(options.maxTracks) || 25));
    if (parsed.type === 'track') {
        const track = cleanTrack(await spotifyGet('/tracks/' + encodeURIComponent(parsed.id)));
        if (!track) throw new Error('Spotify did not return track metadata for this link.');
        return { type: 'track', tracks: [track] };
    }
    if (parsed.type === 'playlist') {
        const tracks = await getPlaylistTracks(parsed.id, maxTracks);
        if (!tracks.length) {
            throw new Error('Spotify returned no readable playlist items. In Development Mode, playlist contents may be limited to playlists you own or collaborate on.');
        }
        return { type: 'playlist', tracks };
    }
    const tracks = await getAlbumTracks(parsed.id, maxTracks);
    if (!tracks.length) throw new Error('Spotify returned no playable tracks for this album.');
    return { type: 'album', tracks };
}

module.exports = {
    parseSpotifyUrl,
    getAppAccessToken,
    searchTracks,
    resolveSpotifyUrl
};
