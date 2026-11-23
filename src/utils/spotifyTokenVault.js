'use strict';

const crypto = require('node:crypto');

const PREFIX = 'enc:v1:';

function getEncryptionKey() {
    const secret = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    if (typeof secret !== 'string' || secret.length < 32) {
        throw new Error('SPOTIFY_TOKEN_ENCRYPTION_KEY must be configured with at least 32 characters.');
    }
    return crypto.scryptSync(secret, 'starry-spotify-token-v1', 32);
}

function encryptToken(value) {
    if (typeof value !== 'string' || value.length === 0) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return PREFIX + [iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(':');
}

function decryptToken(value) {
    if (typeof value !== 'string' || value.length === 0) return '';
    // Existing records are migrated on their next successful refresh or reconnection.
    if (!value.startsWith(PREFIX)) return value;
    const parts = value.slice(PREFIX.length).split(':');
    if (parts.length !== 3 || parts.some(part => !/^[a-f0-9]+$/i.test(part))) {
        throw new Error('Stored Spotify credential has an invalid encrypted format.');
    }
    const [ivHex, tagHex, dataHex] = parts;
    if (ivHex.length !== 24 || tagHex.length !== 32 || dataHex.length % 2 !== 0) {
        throw new Error('Stored Spotify credential has invalid encryption parameters.');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final()
    ]).toString('utf8');
}

function isEncryptedToken(value) {
    return typeof value === 'string' && value.startsWith(PREFIX);
}

module.exports = { encryptToken, decryptToken, isEncryptedToken };
