'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveNotificationTarget } = require('../src/utils/guildNotificationPolicy');

test('member events use the member channel only when enabled', () => {
    const settings = { enabled: true, memberJoins: true, memberChannelId: 'members' };
    assert.deepEqual(resolveNotificationTarget(settings, 'memberJoin'), { channelId: 'members', staffRoleId: '' });
    assert.equal(resolveNotificationTarget({ ...settings, memberJoins: false }, 'memberJoin'), null);
});

test('security and giveaway notifications use dedicated destinations', () => {
    const settings = { enabled: true, securityAlerts: true, staffChannelId: 'staff', staffRoleId: 'mods', giveawayResults: true, giveawayChannelId: 'giveaways' };
    assert.deepEqual(resolveNotificationTarget(settings, 'securityAlert'), { channelId: 'staff', staffRoleId: 'mods' });
    assert.deepEqual(resolveNotificationTarget(settings, 'giveawayResult'), { channelId: 'giveaways', staffRoleId: '' });
});

test('disabled master switch and unknown event types never send notifications', () => {
    const settings = { enabled: false, memberJoins: true, memberChannelId: 'members' };
    assert.equal(resolveNotificationTarget(settings, 'memberJoin'), null);
    assert.equal(resolveNotificationTarget({ enabled: true }, 'unrecognized'), null);
});
