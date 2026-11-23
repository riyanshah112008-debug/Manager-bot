'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getActionThreshold, isWhitelisted, isRecentAuditEntry } = require('../src/utils/antiNukePolicy');

test('each destructive action reads its own configured threshold', () => {
    const policy = { maxChannelDeletions: 4, maxRoleDeletions: 2, maxBans: 5, maxKicks: 3 };
    assert.equal(getActionThreshold(policy, 'channelDelete'), 4);
    assert.equal(getActionThreshold(policy, 'roleDelete'), 2);
    assert.equal(getActionThreshold(policy, 'ban'), 5);
    assert.equal(getActionThreshold(policy, 'kick'), 3);
});

test('invalid thresholds fail closed', () => {
    assert.equal(getActionThreshold({ maxBans: 0 }, 'ban'), null);
    assert.equal(getActionThreshold({ maxBans: 51 }, 'ban'), null);
    assert.equal(getActionThreshold({ maxBans: 'bad' }, 'ban'), null);
    assert.equal(getActionThreshold({}, 'unknown'), null);
});

test('user and role whitelists protect trusted executors', () => {
    const policy = { whitelistedUsers: ['trusted'], whitelistedRoles: ['trusted-role'] };
    assert.equal(isWhitelisted('trusted', [], policy), true);
    assert.equal(isWhitelisted('member', ['trusted-role'], policy), true);
    assert.equal(isWhitelisted('member', ['other-role'], policy), false);
    assert.equal(isWhitelisted(null, [], policy), true);
});

test('audit events must match the target and be recent', () => {
    const now = Date.now();
    assert.equal(isRecentAuditEntry({ target: { id: 'target' }, createdTimestamp: now - 1000 }, 'target', now), true);
    assert.equal(isRecentAuditEntry({ target: { id: 'other' }, createdTimestamp: now - 1000 }, 'target', now), false);
    assert.equal(isRecentAuditEntry({ target: { id: 'target' }, createdTimestamp: now - 30000 }, 'target', now), false);
});
