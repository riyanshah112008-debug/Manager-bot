'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canAccessPremiumOrder } = require('../src/utils/paymentOrderAccess');

const session = (id, guilds = []) => ({ user: { id }, guilds });

test('only the order owner can read a user order', () => {
    const order = { ownerUserId: 'user-a', guildId: null };
    assert.equal(canAccessPremiumOrder(order, session('user-a')), true);
    assert.equal(canAccessPremiumOrder(order, session('user-b')), false);
});

test('guild owner and administrators can read a guild order', () => {
    const order = { userId: null, guildId: 'guild-a' };
    assert.equal(canAccessPremiumOrder(order, session('owner', [{ id: 'guild-a', owner: true }])), true);
    assert.equal(canAccessPremiumOrder(order, session('admin', [{ id: 'guild-a', permissions: '8' }])), true);
    assert.equal(canAccessPremiumOrder(order, session('member', [{ id: 'guild-a', permissions: '0' }])), false);
});

test('bot owners can audit orders and missing identities are denied', () => {
    const order = { userId: 'user-a', guildId: null };
    assert.equal(canAccessPremiumOrder(order, session('bot-owner'), ['bot-owner']), true);
    assert.equal(canAccessPremiumOrder(order, null), false);
    assert.equal(canAccessPremiumOrder(order, session('user-b')), false);
});

test('legacy order shape remains readable during migration', () => {
    const order = { userId: 'legacy-user', guildId: null };
    assert.equal(canAccessPremiumOrder(order, session('legacy-user')), true);
    assert.equal(canAccessPremiumOrder(order, session('different-user')), false);
});

test('malformed guild permissions fail closed', () => {
    const order = { ownerUserId: null, guildId: 'guild-a' };
    assert.equal(canAccessPremiumOrder(order, session('invalid', [{ id: 'guild-a', permissions: 'not-a-number' }])), false);
});

test('members without Manage Server or Administrator cannot read a guild order', () => {
    const order = { ownerUserId: null, guildId: 'guild-a' };
    for (const permissions of ['0', '1', '2', '4', '16', '64', '128']) {
        assert.equal(canAccessPremiumOrder(order, session('member', [{ id: 'guild-a', permissions }])), false);
    }
});
