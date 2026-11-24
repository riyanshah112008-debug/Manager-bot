'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Static, fixed repository paths: no caller-controlled path fragments.
const dashboard = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'dashboardServer.js'), 'utf8');
const antiNuke = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'antiNukeEngine.js'), 'utf8');
const giveaway = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'giveaway.js'), 'utf8');
const spotifyCrypto = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'spotifyTokenCrypto.js'), 'utf8');
const spotifyManager = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'spotifyManager.js'), 'utf8');
const musicController = fs.readFileSync(path.join(__dirname, '..', 'src', 'modules', 'musicController.js'), 'utf8');

test('Guild middleware validates IDs before Discord cache access or Mongo queries', () => {
    const expectedGuildGuard = String.raw`if (!/^\d{17,20}$/.test(guildId))`;
    assert.ok(dashboard.includes(expectedGuildGuard));
    assert.equal((dashboard.match(/A valid Discord guild ID is required\./g) || []).length, 2);
});

test('User-controlled Mongo query objects are rejected recursively', () => {
    assert.match(dashboard, /function hasUnsafeMongoKeys\(value, depth = 0\)/);
    assert.match(dashboard, /key\.startsWith\('\$'\)/);
    assert.match(dashboard, /key\.includes\('\.'\)/);
    assert.match(dashboard, /hasUnsafeMongoKeys\(payload\)/);
    assert.match(dashboard, /A valid Discord user ID is required\./);
});

test('Legacy Spotify redirect endpoint cannot redirect to a supplied URL', () => {
    const start = dashboard.indexOf("app.get('/api/spotify/login'");
    const end = dashboard.indexOf("app.get('/api/spotify/callback'", start);
    assert.ok(start >= 0 && end > start);
    const route = dashboard.slice(start, end);
    assert.match(route, /status\(410\)/);
    assert.doesNotMatch(route, /res\.redirect\(/);
    assert.match(dashboard, /assertSpotifyAuthorizationUrl\(authorization\.authorizeUrl\)/);
    assert.match(dashboard, /assertDiscordAuthorizationUrl\(authUrl\.href\)/);
});

test('Discord OAuth callback URL never falls back to the incoming Host header', () => {
    const start = dashboard.indexOf("app.get('/auth/login'");
    const end = dashboard.indexOf("app.get('/auth/callback'", start);
    assert.ok(start >= 0 && end > start);
    const route = dashboard.slice(start, end);
    assert.match(route, /getTrustedDiscordCallbackUri\(\)/);
    const helperStart = dashboard.indexOf('function getTrustedDiscordCallbackUri()');
    const helperEnd = dashboard.indexOf('// Short-lived cache backed by MongoDB', helperStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart);
    const helper = dashboard.slice(helperStart, helperEnd);
    assert.match(helper, /parsed\.origin !== base\.origin/);
    assert.doesNotMatch(dashboard, /req\.get\('host'\)/);
    assert.doesNotMatch(dashboard, /x-forwarded-proto/);
});

test('Spotify token encryption uses authenticated GCM with a fixed tag length', () => {
    assert.match(spotifyCrypto, /createCipheriv\('aes-256-gcm',[\s\S]{0,120}authTagLength: 16/);
    assert.match(spotifyCrypto, /createDecipheriv\('aes-256-gcm',[\s\S]{0,120}authTagLength: 16/);
    assert.match(spotifyCrypto, /decipher\.setAuthTag\(tag\)/);
    assert.match(spotifyCrypto, /iv\.length !== 12 \|\| tag\.length !== 16/);
});

test('Anti-Nuke verifies effective restriction and retries failed enforcement', () => {
    assert.match(antiNuke, /member\.roles\.remove\(dangerousRoleIds/);
    assert.match(antiNuke, /if \(enforced\) punished\.set\(penaltyKey/);
    assert.match(antiNuke, /const inFlight = new Set\(\)/);
    assert.match(antiNuke, /hasDestructivePermissions\(refreshed\)/);
    assert.match(dashboard, /The quarantine role must not grant administrator/);
});

test('Giveaway persistence uses fixed paths and atomic replacement', () => {
    assert.ok(giveaway.includes("const dbPath = 'src/modules/giveaways.json';"));
    assert.ok(giveaway.includes("const temporaryDbPath = 'src/modules/giveaways.json.tmp';"));
    assert.ok(giveaway.includes("fs.renameSync(temporaryDbPath, dbPath)"));
    assert.equal(giveaway.includes("path.join("), false);
});

test('Giveaway creates only after its entry reaction is confirmed', () => {
    assert.match(giveaway, /await message\.react\('🎉'\);/);
    assert.match(giveaway, /No active record was saved/);
    assert.match(giveaway, /return \{ success: true, message: .*giveaway: record \}/);
});

test('Giveaway rerolls persist a selected draw until the announcement succeeds', () => {
    assert.match(giveaway, /current\.pendingReroll =/);
    assert.match(giveaway, /starry-reroll:/);
    assert.match(giveaway, /current\.rerollHistory\.push/);
    assert.match(giveaway, /delete current\.pendingReroll/);
});

test('Giveaway completion persists a stable draw and publication checkpoints', () => {
    assert.match(giveaway, /current\.processingResult = draw/);
    assert.match(giveaway, /messageEdited: false/);
    assert.match(giveaway, /announcementSent: false/);
    assert.match(giveaway, /current\.status = 'completed'/);
    assert.match(giveaway, /checkGiveaways\(targetMessageId = null\)/);
    assert.doesNotMatch(giveaway, /saveGiveaways\(giveaways\)/);
});

test('Spotify controller acknowledges before network work and handles lookup errors', () => {
    assert.match(musicController, /await interaction\.deferReply\(\{ flags: \[EPHEMERAL_FLAG\] \}\)/);
    assert.match(musicController, /data = await spotifyManager\.getUserPlaylists\(interaction\.user\.id\)/);
    assert.match(musicController, /Spotify library is temporarily unavailable/);
});

test('Spotify refresh updates only the originally linked account record', () => {
    assert.match(spotifyManager, /UserSpotify\.findOneAndUpdate\([\s\S]*?\{ userId: String\(userDoc\.userId\), spotifyId: String\(userDoc\.spotifyId\) \}/);
    assert.match(spotifyManager, /if \(!updated\) return null/);
});
