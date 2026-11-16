'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PermissionFlagsBits } = require('discord.js');
const {
    isDiscordSnowflake,
    isSafeLevelRewardRole,
    validateLevelRewardConfiguration
} = require('../src/utils/levelRewardSecurity');

const permissions = (...granted) => ({
    has(permission) {
        return granted.includes(permission);
    }
});

const makeRole = (id, position, granted = [], managed = false) => ({
    id,
    position,
    managed,
    permissions: permissions(...granted)
});

const makeMember = (id, position, granted = []) => ({
    id,
    roles: { highest: { position } },
    permissions: permissions(...granted)
});

const makeGuild = (roles, ownerId = '10000000000000001') => ({
    id: '10000000000000000',
    ownerId,
    roles: { cache: new Map(roles.map(role => [role.id, role])) }
});

const reward = roleId => [{ level: 5, roleId }];

test('Discord snowflake validation accepts only 17–20 decimal digits', () => {
    assert.equal(isDiscordSnowflake('10000000000000001'), true);
    assert.equal(isDiscordSnowflake('10000000000000000001'), true);
    assert.equal(isDiscordSnowflake('1234567890123456'), false);
    assert.equal(isDiscordSnowflake('123456789012345678901'), false);
    assert.equal(isDiscordSnowflake('1000000000000000x'), false);
    assert.equal(isDiscordSnowflake(10000000000000001), false);
});

test('Manage Guild alone cannot configure role rewards', () => {
    const role = makeRole('10000000000000003', 4);
    const guild = makeGuild([role]);
    const actor = makeMember('10000000000000002', 8, [PermissionFlagsBits.ManageGuild]);
    const bot = makeMember('10000000000000004', 10, [PermissionFlagsBits.ManageRoles]);

    const result = validateLevelRewardConfiguration({ guild, actor, botMember: bot, rewards: reward(role.id) });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
});

test('Manage Roles users cannot configure reward roles at or above their own hierarchy', () => {
    const role = makeRole('10000000000000003', 6);
    const guild = makeGuild([role]);
    const actor = makeMember('10000000000000002', 5, [PermissionFlagsBits.ManageRoles]);
    const bot = makeMember('10000000000000004', 10, [PermissionFlagsBits.ManageRoles]);

    const result = validateLevelRewardConfiguration({ guild, actor, botMember: bot, rewards: reward(role.id) });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
});

test('Administrator and moderation-capable reward roles are rejected', () => {
    const actor = makeMember('10000000000000002', 9, [PermissionFlagsBits.ManageRoles]);
    const bot = makeMember('10000000000000004', 10, [PermissionFlagsBits.ManageRoles]);

    for (const flag of [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.BanMembers]) {
        const role = makeRole('10000000000000003', 4, [flag]);
        const guild = makeGuild([role]);
        const result = validateLevelRewardConfiguration({ guild, actor, botMember: bot, rewards: reward(role.id) });
        assert.equal(result.ok, false);
        assert.equal(result.status, 400);
        assert.equal(isSafeLevelRewardRole(role, bot), false);
    }
});

test('safe roles below both actor and bot can be configured', () => {
    const role = makeRole('10000000000000003', 4);
    const guild = makeGuild([role]);
    const actor = makeMember('10000000000000002', 8, [PermissionFlagsBits.ManageRoles]);
    const bot = makeMember('10000000000000004', 10, [PermissionFlagsBits.ManageRoles]);

    const result = validateLevelRewardConfiguration({ guild, actor, botMember: bot, rewards: reward(role.id) });
    assert.deepEqual(result, { ok: true });
    assert.equal(isSafeLevelRewardRole(role, bot), true);
});

test('guild owner can configure safe roles below Starry but cannot grant dangerous permissions', () => {
    const ownerId = '10000000000000001';
    const safeRole = makeRole('10000000000000003', 8);
    const guild = makeGuild([safeRole], ownerId);
    const owner = makeMember(ownerId, 1, []);
    const bot = makeMember('10000000000000004', 10, [PermissionFlagsBits.ManageRoles]);

    assert.equal(validateLevelRewardConfiguration({ guild, actor: owner, botMember: bot, rewards: reward(safeRole.id) }).ok, true);

    const adminRole = makeRole('10000000000000005', 8, [PermissionFlagsBits.Administrator]);
    guild.roles.cache.set(adminRole.id, adminRole);
    assert.equal(validateLevelRewardConfiguration({ guild, actor: owner, botMember: bot, rewards: reward(adminRole.id) }).ok, false);
});

test('runtime assignment rejects managed, privileged, and above-bot roles', () => {
    const bot = makeMember('10000000000000004', 10, [PermissionFlagsBits.ManageRoles]);
    assert.equal(isSafeLevelRewardRole(makeRole('10000000000000003', 4, [], true), bot), false);
    assert.equal(isSafeLevelRewardRole(makeRole('10000000000000003', 11), bot), false);
    assert.equal(isSafeLevelRewardRole(makeRole('10000000000000003', 4, [PermissionFlagsBits.Administrator]), bot), false);
    assert.equal(isSafeLevelRewardRole(makeRole('10000000000000003', 4), makeMember('10000000000000004', 10, [])), false);
});

test('empty reward list can safely clear existing rewards without Manage Roles', () => {
    const result = validateLevelRewardConfiguration({ rewards: [] });
    assert.deepEqual(result, { ok: true });
});

test('both XP assignment paths and both configuration paths use the shared security guard', () => {
    const leveling = fs.readFileSync('src/modules/leveling.js', 'utf8');
    const dashboard = fs.readFileSync('src/modules/dashboardServer.js', 'utf8');
    assert.equal((leveling.match(/isSafeLevelRewardRole\\(rewardRole, botMember\\)/g) || []).length, 2);
    assert.ok(leveling.includes('validateLevelRewardConfiguration({ guild: interaction.guild'));
    assert.ok(dashboard.includes('validateLevelRewardConfiguration({ guild, actor, botMember, rewards })'));
    assert.ok(dashboard.includes('isDiscordSnowflake(value)'));
});
