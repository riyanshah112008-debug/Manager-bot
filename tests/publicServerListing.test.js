'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    PUBLIC_SERVER_PROJECTION,
    buildPublicServerFilter,
    toPublicServerListing,
    safeDiscordInvite,
    safeDiscordIcon
} = require('../src/utils/publicServerListing');

assert.deepEqual(buildPublicServerFilter(), { isListed: true, isNsfw: false });
assert.match(PUBLIC_SERVER_PROJECTION, /guildId name description iconUrl inviteLink memberCount tags bumps lastBump/);
assert.equal(PUBLIC_SERVER_PROJECTION.includes('ownerId'), false);
assert.equal(PUBLIC_SERVER_PROJECTION.includes('isNsfw'), false);
assert.equal(PUBLIC_SERVER_PROJECTION.includes('__v'), false);

const result = toPublicServerListing({
    guildId: '123456789012345678',
    name: '<untrusted server>',
    description: 'Safe community',
    iconUrl: 'https://cdn.discordapp.com/icons/123456789012345678/abc.png',
    inviteLink: 'https://discord.gg/example',
    memberCount: '125',
    tags: ['gaming', 'community', '<script>'],
    bumps: 7,
    lastBump: new Date('2026-11-09T00:00:00.000Z'),
    ownerId: '999999999999999999',
    isNsfw: true,
    isListed: true,
    __v: 4
});

assert.deepEqual(Object.keys(result), [
    'guildId', 'name', 'description', 'iconUrl', 'inviteLink',
    'memberCount', 'tags', 'bumps', 'lastBump'
]);
assert.equal(result.guildId, '123456789012345678');
assert.equal(result.memberCount, 125);
assert.equal(result.tags.length, 3);
assert.equal(result.ownerId, undefined);
assert.equal(result.isNsfw, undefined);
assert.equal(result.inviteLink, 'https://discord.gg/example');
assert.equal(result.iconUrl, 'https://cdn.discordapp.com/icons/123456789012345678/abc.png');
assert.equal(safeDiscordInvite('javascript:alert(1)'), null);
assert.equal(safeDiscordInvite('https://example.com/invite/abc'), null);
assert.equal(safeDiscordIcon('https://example.com/avatar.png'), null);

const source = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
assert.ok(source.includes("app.get('/api/servers', publicApiLimiter"));
assert.ok(source.includes('ServerListing.find(buildPublicServerFilter())'));
assert.ok(source.includes("app.get('/api/multibot/stats', publicApiLimiter"));

process.stdout.write('Public server listing security tests passed.\n');
