'use strict';

const crypto = require('crypto');

function getKey() {
    const secret = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY ||
        process.env.SESSION_ENCRYPTION_KEY ||
        process.env.SPOTIFY_CLIENT_SECRET ||
        process.env.CLIENT_SECRET ||
        process.env.DISCORD_CLIENT_SECRET;
    if (!secret) throw new Error('Spotify token encryption is not configured.');
    return crypto.createHash('sha256').update('starry-spotify-token-v1:' + secret).digest();
}

function encryptToken(value) {
    if (!value) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(':');
}

function decryptToken(value) {
    if (!value) return '';
    // Existing plaintext tokens remain readable during a one-time migration.
    if (typeof value !== 'string' || !value.startsWith('v1:')) return String(value);
    const [version, ivHex, tagHex, dataHex] = value.split(':');
    if (version !== 'v1' || !ivHex || !tagHex || !dataHex) throw new Error('Stored Spotify token is malformed.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final()
    ]).toString('utf8');
}

module.exports = { encryptToken, decryptToken };
