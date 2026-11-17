'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const {
    isSfwTextChannel,
    hasChannelReadAccess,
    canPublishCrossChannelSummary
} = require('../src/utils/aiChannelAccess');

function permissionSet(...allowed) {
    return { has: permission => allowed.includes(permission) };
}

function textChannel({ nsfw = false, permissions = permissionSet(
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory
) } = {}) {
    return {
        id: '123456789012345678',
        nsfw,
        isTextBased: () => true,
        permissionsFor: () => permissions
    };
}

test('SFW channel guard rejects NSFW and non-text channels', () => {
    assert.equal(isSfwTextChannel(textChannel()), true);
    assert.equal(isSfwTextChannel(textChannel({ nsfw: true })), false);
    assert.equal(isSfwTextChannel({ isTextBased: () => true, nsfw: false, parent: { nsfw: true } }), false);
    assert.equal(isSfwTextChannel({ isTextBased: () => false, nsfw: false }), false);
});

test('channel read access requires ViewChannel and ReadMessageHistory', () => {
    const member = { id: 'member' };
    assert.equal(hasChannelReadAccess(textChannel(), member), true);
    assert.equal(hasChannelReadAccess(textChannel({ permissions: permissionSet(PermissionFlagsBits.ViewChannel) }), member), false);
    assert.equal(hasChannelReadAccess(textChannel({ permissions: permissionSet(PermissionFlagsBits.ReadMessageHistory) }), member), false);
    assert.equal(hasChannelReadAccess(textChannel(), null), false);
});

test('NSFW channels are never eligible for AI catch-up access', () => {
    assert.equal(hasChannelReadAccess(textChannel({ nsfw: true }), { id: 'member' }), false);
});

test('public catch-up from another channel requires ManageGuild or Administrator', () => {
    assert.equal(canPublishCrossChannelSummary({
        isPublic: true,
        targetChannelId: 'private-channel',
        outputChannelId: 'public-channel',
        memberPermissions: permissionSet()
    }), false);
    assert.equal(canPublishCrossChannelSummary({
        isPublic: true,
        targetChannelId: 'private-channel',
        outputChannelId: 'public-channel',
        memberPermissions: permissionSet(PermissionFlagsBits.ManageGuild)
    }), true);
    assert.equal(canPublishCrossChannelSummary({
        isPublic: true,
        targetChannelId: 'private-channel',
        outputChannelId: 'public-channel',
        memberPermissions: permissionSet(PermissionFlagsBits.Administrator)
    }), true);
});

test('same-channel and private catch-up do not require cross-channel publication privileges', () => {
    assert.equal(canPublishCrossChannelSummary({
        isPublic: true,
        targetChannelId: 'same-channel',
        outputChannelId: 'same-channel',
        memberPermissions: permissionSet()
    }), true);
    assert.equal(canPublishCrossChannelSummary({
        isPublic: false,
        targetChannelId: 'private-channel',
        outputChannelId: 'public-channel',
        memberPermissions: permissionSet()
    }), true);
});
