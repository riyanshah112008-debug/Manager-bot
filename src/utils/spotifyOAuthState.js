'use strict';

const crypto = require('node:crypto');

function signPayload(payload, secret) {
    if (typeof secret !== 'string' || secret.length < 32) {
        throw new Error('Spotify OAuth state signing secret must contain at least 32 characters.');
    }
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function createSpotifyOAuthState(userId, secret, nonce = crypto.randomBytes(24).toString('base64url')) {
    const id = String(userId || '');
    if (!/^\d{17,20}$/.test(id)) throw new TypeError('A valid Discord user ID is required.');
    if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{20,100}$/.test(nonce)) throw new TypeError('Invalid OAuth nonce.');
    const payload = id + '.' + nonce;
    return payload + '.' + signPayload(payload, secret);
}

function verifySpotifyOAuthState(state, cookieState, secret) {
    if (typeof state !== 'string' || typeof cookieState !== 'string' || state.length > 512 || cookieState.length > 512) return null;
    const left = Buffer.from(state);
    const right = Buffer.from(cookieState);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
    const parts = state.split('.');
    if (parts.length !== 3 || !/^\d{17,20}$/.test(parts[0]) || !/^[A-Za-z0-9_-]{20,100}$/.test(parts[1])) return null;
    const payload = parts[0] + '.' + parts[1];
    let expected;
    try { expected = signPayload(payload, secret); } catch (_) { return null; }
    const supplied = Buffer.from(parts[2]);
    const actual = Buffer.from(expected);
    if (supplied.length !== actual.length || !crypto.timingSafeEqual(supplied, actual)) return null;
    return parts[0];
}

module.exports = { createSpotifyOAuthState, verifySpotifyOAuthState };
