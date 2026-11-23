'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isWhitelisted, getActionLimit, shouldRespond } = require('../src/utils/antiNukePolicy');

const policy = {
    enabled: true,
    maxChannelDeletions: 3,
    maxRoleDeletions: 2,
    maxBans: 2,
    maxKicks: 4,
    blockWebhookCreation: true,
    whitelistedUsers: ['123456789012345678'],
    whitelistedRoles: ['234567890123456789']
};

test('configured thresholds are bounded and resolved per audit action', () => {
    assert.equal(getActionLimit(policy, 'channelDelete'), 3);
    assert.equal(getActionLimit(policy, 'roleDelete'), 2);
    assert.equal(getActionLimit(policy, 'unknown'), null);
    assert.equal(getActionLimit({ ...policy, maxBans: 999 }, 'memberBan'), null);
});

test('whitelisted users and roles bypass response actions', () => {
    assert.equal(isWhitelisted(policy, '123456789012345678'), true);
    assert.equal(isWhitelisted(policy, '9', ['234567890123456789']), true);
    assert.equal(isWhitelisted(policy, '9', []), false);
});

test('threshold action fails closed for disabled, owner and whitelisted actors', () => {
    assert.equal(shouldRespond({ ...policy, enabled: false }, 'channelDelete', 10), false);
    assert.equal(shouldRespond(policy, 'channelDelete', 3, true), false);
    assert.equal(shouldRespond(policy, 'channelDelete', 3, false, [], '123456789012345678'), false);
    assert.equal(shouldRespond(policy, 'channelDelete', 2), false);
    assert.equal(shouldRespond(policy, 'channelDelete', 3), true);
});

test('webhook creation blocking is immediate when enabled', () => {
    assert.equal(shouldRespond(policy, 'webhookCreate', 1), true);
    assert.equal(shouldRespond({ ...policy, blockWebhookCreation: false }, 'webhookCreate', 1), false);
});
