// Public Spotify link metadata only. No Spotify Web API credentials or Premium account required.
'use strict';
const SPOTIFY_HOSTS = new Set(['open.spotify.com', 'play.spotify.com']);
function parseSpotifyUrl(input) {
    if (typeof input !== 'string') return null;
    const value = input.trim();
    const uriMatch = value.match(/^spotify:(track|album|playlist):([A-Za-z0-9]+)$/i);
    if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2], url: 'https://open.spotify.com/' + uriMatch[1].toLowerCase() + '/' + uriMatch[2] };
    let url;
    try { url = new URL(value); } catch (_) { return null; }
    if (url.protocol !== 'https:' || !SPOTIFY_HOSTS.has(url.hostname.toLowerCase())) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const typeIndex = parts.findIndex(part => ['track', 'album', 'playlist'].includes(part.toLowerCase()));
    if (typeIndex < 0 || !parts[typeIndex + 1]) return null;
    const type = parts[typeIndex].toLowerCase(), id = parts[typeIndex + 1];
    if (!/^[A-Za-z0-9]+$/.test(id)) return null;
    return { type, id, url: 'https://open.spotify.com/' + type + '/' + id };
}
async function resolveSpotifyUrl(input) {
    const parsed = parseSpotifyUrl(input);
    if (!parsed) return null;
    if (parsed.type !== 'track') {
        const error = new Error('Spotify album and playlist contents are not available without Spotify Web API access. Paste an individual Spotify track link, or use a YouTube/SoundCloud playlist link instead.');
        error.code = 'SPOTIFY_COLLECTION_UNAVAILABLE';
        throw error;
    }
    const endpoint = 'https://open.spotify.com/oembed?url=' + encodeURIComponent(parsed.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
        const response = await fetch(endpoint, { headers: { Accept: 'application/json' }, signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || typeof data.title !== 'string' || !data.title.trim()) {
            const error = new Error('Spotify could not provide public metadata for this track. Try searching its title instead.');
            error.status = response.status;
            error.code = 'SPOTIFY_METADATA_UNAVAILABLE';
            throw error;
        }
        const title = data.title.trim().slice(0, 240);
        return { type: 'track', tracks: [{ id: parsed.id, title, artist: '', album: '', durationMs: 0, artwork: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null, spotifyUrl: parsed.url, query: title }] };
    } finally { clearTimeout(timeout); }
}
module.exports = { parseSpotifyUrl, resolveSpotifyUrl };
