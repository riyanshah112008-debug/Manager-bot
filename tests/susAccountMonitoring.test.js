'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { _internals } = require('../src/modules/susAccount');

const DAY_MS = 24 * 60 * 60 * 1000;
const JOINED_AT = Date.parse('2026-01-01T00:00:00.000Z');


function permissionSet(allowed) {
    const values = new Set(allowed);
    return {
        has(permission) {
            return Array.isArray(permission)
                ? permission.every(value => values.has(value))
                : values.has(permission);
        }
    };
}

function makePrivateChannelFixture(overrides = {}) {
    const guild = { id: '12345678901234567', roles: { cache: new Map() } };
    const everyone = { id: guild.id, permissions: permissionSet([]) };
    const staff = {
        id: '12345678901234568',
        guild,
        permissions: permissionSet([])
    };
    const otherRole = {
        id: '12345678901234569',
        managed: false,
        permissions: permissionSet([])
    };
    const bot = {
        id: '12345678901234570',
        roles: { cache: new Map() }
    };
    guild.roles.everyone = everyone;
    guild.roles.cache.set(everyone.id, everyone);
    guild.roles.cache.set(staff.id, staff);
    guild.roles.cache.set(otherRole.id, otherRole);

    const access = new Map([
        [everyone.id, permissionSet(overrides.everyoneCanView ? [PermissionFlagsBits.ViewChannel] : [])],
        [staff.id, permissionSet(overrides.staffCanView === false ? [] : [PermissionFlagsBits.ViewChannel])],
        [otherRole.id, permissionSet(overrides.otherRoleCanView ? [PermissionFlagsBits.ViewChannel] : [])],
        [bot.id, permissionSet([
            ...(overrides.botCanView === false ? [] : [PermissionFlagsBits.ViewChannel]),
            ...(overrides.botCanSend === false ? [] : [PermissionFlagsBits.SendMessages]),
            ...(overrides.botCanEmbed === false ? [] : [PermissionFlagsBits.EmbedLinks])
        ])]
    ]);
    const overwrites = new Map();
    if (overrides.directMemberCanView) {
        overwrites.set('member', {
            type: 1,
            id: '12345678901234571',
            allow: permissionSet([PermissionFlagsBits.ViewChannel])
        });
    }
    const channel = {
        guildId: guild.id,
        type: ChannelType.GuildText,
        isTextBased: () => true,
        permissionsFor: subject => access.get(subject.id) || permissionSet([]),
        permissionOverwrites: { cache: overwrites }
    };
    return { guild, everyone, staff, otherRole, bot, channel };
}

test('suspicious-account alerts require a private staff channel', () => {
    const fixture = makePrivateChannelFixture();
    assert.equal(_internals.isPrivateStaffChannel(
        fixture.channel, fixture.guild, fixture.staff, fixture.bot
    ), true);
});

test('public alert channels are rejected', () => {
    const fixture = makePrivateChannelFixture({ everyoneCanView: true });
    assert.equal(_internals.isPrivateStaffChannel(
        fixture.channel, fixture.guild, fixture.staff, fixture.bot
    ), false);
});

test('alert channel must be visible to the selected staff role', () => {
    const fixture = makePrivateChannelFixture({ staffCanView: false });
    assert.equal(_internals.isPrivateStaffChannel(
        fixture.channel, fixture.guild, fixture.staff, fixture.bot
    ), false);
});

test('alert channel must grant Starry the required send permissions', () => {
    const fixture = makePrivateChannelFixture({ botCanSend: false });
    assert.equal(_internals.isPrivateStaffChannel(
        fixture.channel, fixture.guild, fixture.staff, fixture.bot
    ), false);
});

test('alert channel rejects unrelated role visibility', () => {
    const fixture = makePrivateChannelFixture({ otherRoleCanView: true });
    assert.equal(_internals.isPrivateStaffChannel(
        fixture.channel, fixture.guild, fixture.staff, fixture.bot
    ), false);
});

test('alert channel rejects direct non-bot member visibility overrides', () => {
    const fixture = makePrivateChannelFixture({ directMemberCanView: true });
    assert.equal(_internals.isPrivateStaffChannel(
        fixture.channel, fixture.guild, fixture.staff, fixture.bot
    ), false);
});

test('alert channel cannot be reused across guilds', () => {
    const fixture = makePrivateChannelFixture();
    const otherGuild = { ...fixture.guild, id: '12345678901234572' };
    assert.equal(_internals.isPrivateStaffChannel(
        fixture.channel, otherGuild, fixture.staff, fixture.bot
    ), false);
});

test('missing alert channel never falls back to the public system channel', async () => {
    const fixture = makePrivateChannelFixture();
    const guild = {
        ...fixture.guild,
        systemChannel: fixture.channel,
        channels: { cache: new Map(), fetch: async () => null },
        members: { me: fixture.bot, fetchMe: async () => fixture.bot }
    };
    assert.equal(await _internals.safeChannel(guild, '', fixture.staff.id), null);
});

test('account age accepts Date-valued scanner timestamps', () => {
    assert.equal(_internals.daysBetween(JOINED_AT, new Date(JOINED_AT + (3 * DAY_MS))), 3);
});

test('inactivity alert nonce is stable for one membership and changes after rejoin', () => {
    const first = _internals.buildInactivityAlertNonce('12345678901234567', '12345678901234568', JOINED_AT);
    const retry = _internals.buildInactivityAlertNonce('12345678901234567', '12345678901234568', JOINED_AT);
    const rejoin = _internals.buildInactivityAlertNonce('12345678901234567', '12345678901234568', JOINED_AT + DAY_MS);
    assert.equal(first, retry);
    assert.notEqual(first, rejoin);
    assert.equal(first.length, 24);
});

test('inactivity threshold is not reached one millisecond early', () => {
    assert.equal(_internals.hasReachedInactivityThreshold(JOINED_AT, 14, JOINED_AT + (14 * DAY_MS) - 1), false);
});

test('inactivity threshold is reached at exactly the configured number of days', () => {
    assert.equal(_internals.hasReachedInactivityThreshold(JOINED_AT, 14, JOINED_AT + (14 * DAY_MS)), true);
});

test('custom inactivity windows use their configured duration', () => {
    assert.equal(_internals.hasReachedInactivityThreshold(JOINED_AT, 7, JOINED_AT + (7 * DAY_MS)), true);
    assert.equal(_internals.hasReachedInactivityThreshold(JOINED_AT, 30, JOINED_AT + (14 * DAY_MS)), false);
});

test('invalid dates and out-of-range thresholds never trigger inactivity alerts', () => {
    assert.equal(_internals.hasReachedInactivityThreshold('not-a-date', 14, JOINED_AT + (30 * DAY_MS)), false);
    assert.equal(_internals.hasReachedInactivityThreshold(JOINED_AT, 0, JOINED_AT + (30 * DAY_MS)), false);
    assert.equal(_internals.hasReachedInactivityThreshold(JOINED_AT, 91, JOINED_AT + (100 * DAY_MS)), false);
    assert.equal(_internals.hasReachedInactivityThreshold(JOINED_AT, 1.5, JOINED_AT + (30 * DAY_MS)), false);
});

test('invalid account-created timestamps do not produce a negative or NaN age', () => {
    assert.equal(_internals.daysBetween('not-a-date', JOINED_AT), 0);
    assert.equal(_internals.daysBetween(JOINED_AT, JOINED_AT - DAY_MS), 0);
});

test('locked Mongoose release includes current 8.24.x query-sanitization fixes', () => {
    const mongoose = require('mongoose');
    const [major, minor, patch] = mongoose.version.split('.').map(Number);
    const isAtLeastPatched = major > 8 ||
        (major === 8 && (minor > 24 || (minor === 24 && patch >= 7)));
    assert.equal(isAtLeastPatched, true, `Mongoose ${mongoose.version} is below the patched 8.24.7 release`);
});

test('a rejoin starts a new membership window', () => {
    const rejoinedAt = JOINED_AT + (30 * DAY_MS);
    assert.equal(_internals.isSameMembership(JOINED_AT, rejoinedAt), false);
});

test('the same membership is recognized across identical join timestamps', () => {
    assert.equal(_internals.isSameMembership(JOINED_AT, new Date(JOINED_AT)), true);
});

test('fresh pending inactivity claims are not stolen by another scanner', () => {
    const now = JOINED_AT + (30 * DAY_MS);
    assert.equal(_internals.isClaimRecoverable('pending', new Date(now - (5 * 60 * 1000)), now), false);
});

test('abandoned pending inactivity claims become recoverable', () => {
    const now = JOINED_AT + (30 * DAY_MS);
    assert.equal(_internals.isClaimRecoverable('pending', new Date(now - (11 * 60 * 1000)), now), true);
    assert.equal(_internals.isClaimRecoverable('pending', null, now), true);
});

test('delivered inactivity alerts cannot be reclaimed', () => {
    assert.equal(_internals.isClaimRecoverable('sent', null, JOINED_AT), false);
});

test('server ID validation accepts Discord snowflakes only', () => {
    assert.equal(_internals.isValidDiscordSnowflake('12345678901234567'), true);
    assert.equal(_internals.isValidDiscordSnowflake('12345678901234567890'), true);
    assert.equal(_internals.isValidDiscordSnowflake('1234567890123456'), false);
    assert.equal(_internals.isValidDiscordSnowflake('123456789012345678901'), false);
    assert.equal(_internals.isValidDiscordSnowflake('1234567890123456x'), false);
    assert.equal(_internals.isValidDiscordSnowflake({ $ne: null }), false);
});
