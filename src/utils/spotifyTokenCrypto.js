'use strict';

const crypto = require('node:crypto');

function getEncryptionKey() {
    const secret = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY ||
        process.env.SESSION_ENCRYPTION_KEY ||
        process.env.DISCORD_CLIENT_SECRET ||
        process.env.CLIENT_SECRET;
    if (typeof secret !== 'string' || secret.length < 32) {
        throw new Error('Spotify token encryption is not configured. Set SPOTIFY_TOKEN_ENCRYPTION_KEY to a stable secret of at least 32 characters.');
    }
    return crypto.createHash('sha256').update('starry-spotify-token-v1:' + secret).digest();
}

function encryptSpotifyToken(value) {
    if (!value) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return ['enc', 'v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

function isEncryptedSpotifyToken(value) {
    return typeof value === 'string' && value.startsWith('enc:v1:');
}

function decryptSpotifyToken(value) {
    if (!value || typeof value !== 'string') return '';
    // Migrate older plaintext records on the next successful refresh.
    if (!isEncryptedSpotifyToken(value)) return value;
    const parts = value.split(':');
    if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
        throw new Error('Stored Spotify token has an unsupported format. Reconnect Spotify.');
    }
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const data = Buffer.from(parts[4], 'hex');
    if (iv.length !== 12 || tag.length !== 16 || data.length === 0) {
        throw new Error('Stored Spotify token is invalid. Reconnect Spotify.');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { encryptSpotifyToken, decryptSpotifyToken, isEncryptedSpotifyToken };
