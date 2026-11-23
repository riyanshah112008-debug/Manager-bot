'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canAccessPremiumOrder } = require('../src/utils/paymentOrderAccess');

const session = (id, guilds = []) => ({ user: { id }, guilds });

test('only the order owner can read a user order', () => {
    const order = { userId: 'user-a', guildId: null };
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
