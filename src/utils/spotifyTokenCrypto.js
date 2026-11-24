'use strict';

const crypto = require('crypto');

const PREFIX = 'enc:v1:';
const AAD = Buffer.from('starry-spotify-token-v1', 'utf8');

function getKey() {
    const raw = String(process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY || '').trim();
    if (!raw) throw new Error('SPOTIFY_TOKEN_ENCRYPTION_KEY is required to store Spotify credentials securely.');
    const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('SPOTIFY_TOKEN_ENCRYPTION_KEY must be 32 random bytes encoded as 64 hexadecimal characters or base64.');
    return key;
}

function encryptToken(value) {
    if (value === undefined || value === null || value === '') return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv, { authTagLength: 16 });
    cipher.setAAD(AAD);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    return PREFIX + [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
}

function decryptToken(value) {
    if (value === undefined || value === null || value === '') return '';
    const stored = String(value);
    // Existing installations may contain plaintext tokens. Read them for
    // backwards compatibility; every subsequent token write is encrypted.
    if (!stored.startsWith(PREFIX)) return stored;
    const parts = stored.slice(PREFIX.length).split(':');
    if (parts.length !== 3 || parts.some(part => !/^[a-f0-9]+$/i.test(part))) {
        throw new Error('Stored Spotify credentials are invalid. Reconnect your Spotify account.');
    }
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');
    if (iv.length !== 12 || tag.length !== 16) throw new Error('Stored Spotify credentials are invalid. Reconnect your Spotify account.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv, { authTagLength: 16 });
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encryptToken, decryptToken, PREFIX };
