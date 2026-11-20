'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PermissionFlagsBits } = require('discord.js');
const config = require('../src/config');
const nativeAutoMod = require('../src/modules/nativeAutoMod');
const command = require('../src/commands/moderation/automod-badge');

const { getActorAccess, canPerformAction, buildBadgeEmbed } = command._internals;

function permissionSet(...granted) {
    return { has: flag => granted.includes(flag) };
}

const progress = {
    hasBadge: false,
    totalStarryRules: 0,
    target: 100,
    remaining: 100,
    totalGuilds: 1,
    eligibleGuilds: 1,
    totalSlotsAvailable: 6,
    estimatedGuildsNeeded: 20
};

function fakeClient() {
    return {
        user: {
            id: 'bot-id',
            username: 'Starry',
            discriminator: '0',
            displayAvatarURL: () => 'https://example.test/starry.png'
        }
    };
}

test('AutoMod badge panel and deployment actions use separate authorization scopes', () => {
    const originalIsBotOwner = config.isBotOwner;
    config.isBotOwner = userId => userId === 'bot-owner';
    try {
        const member = getActorAccess({
            user: { id: 'member' },
            member: { permissions: permissionSet() }
        }, fakeClient());
        const admin = getActorAccess({
            user: { id: 'admin' },
            member: { permissions: permissionSet(PermissionFlagsBits.ManageGuild) }
        }, fakeClient());
        const owner = getActorAccess({
            user: { id: 'bot-owner' },
            member: { permissions: permissionSet() }
        }, fakeClient());

        assert.equal(canPerformAction(member, 'open'), false);
        assert.equal(canPerformAction(admin, 'open'), true);
        assert.equal(canPerformAction(owner, 'open'), true);

        assert.equal(canPerformAction(admin, 'deploy_all'), false,
            'a guild administrator must not mutate AutoMod rules in every connected server');
        assert.equal(canPerformAction(owner, 'deploy_all'), true);

        assert.equal(canPerformAction(owner, 'deploy_here'), false,
            'bot ownership alone does not grant authority to change an arbitrary guild');
        assert.equal(canPerformAction(admin, 'deploy_here'), true);
    } finally {
        config.isBotOwner = originalIsBotOwner;
    }
});

test('AutoMod badge UI only exposes deployment buttons within the actor authorization scope', () => {
    const client = fakeClient();
    const adminPayload = buildBadgeEmbed(progress, client, client.user, {
        isBotOwner: false,
        canManageGuild: true
    });
    const adminIds = adminPayload.components[0].components
        .map(component => component.data.custom_id)
        .filter(Boolean);
    assert.deepEqual(adminIds.sort(), ['ambadge_deploy_here', 'ambadge_refresh'].sort());

    const ownerPayload = buildBadgeEmbed(progress, client, client.user, {
        isBotOwner: true,
        canManageGuild: false
    });
    const ownerIds = ownerPayload.components[0].components
        .map(component => component.data.custom_id)
        .filter(Boolean);
    assert.deepEqual(ownerIds.sort(), ['ambadge_deploy_all', 'ambadge_refresh'].sort());
});

test('unauthorized prefix invocation is rejected before reading cluster-wide AutoMod statistics', async () => {
    const originalGetBadgeProgress = nativeAutoMod.getBadgeProgress;
    let progressCalls = 0;
    let replyPayload = null;
    nativeAutoMod.getBadgeProgress = async () => {
        progressCalls += 1;
        return progress;
    };

    try {
        const client = fakeClient();
        await command.execute({
            user: { id: 'ordinary-member' },
            author: { id: 'ordinary-member' },
            member: { permissions: permissionSet() },
            guild: { id: 'guild-id' },
            client,
            reply: async payload => {
                replyPayload = payload;
                return null;
            }
        }, []);

        assert.equal(progressCalls, 0);
        assert.match(replyPayload?.content || '', /Manage Server/);
    } finally {
        nativeAutoMod.getBadgeProgress = originalGetBadgeProgress;
    }
});

test('prefix command metadata declares Manage Server for the shared dispatcher', () => {
    assert.ok(command.permissions.includes(PermissionFlagsBits.ManageGuild));
});
