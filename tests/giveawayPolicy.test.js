'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGiveawayDuration, validateGiveawayInput, MAX_DURATION_MS } = require('../src/utils/giveawayPolicy');

test('giveaway duration parser supports supported time units', () => {
    assert.equal(parseGiveawayDuration('30s'), 30000);
    assert.equal(parseGiveawayDuration('5m'), 300000);
    assert.equal(parseGiveawayDuration('2h'), 7200000);
    assert.equal(parseGiveawayDuration('1d'), 86400000);
    assert.equal(parseGiveawayDuration('1w'), 604800000);
});

test('giveaway duration parser rejects malformed, zero and overlong values', () => {
    for (const value of ['', '0m', '1.5h', '-1h', '1000000w', '1 month', null, 60]) {
        assert.equal(parseGiveawayDuration(value), null);
    }
    assert.equal(parseGiveawayDuration('30d'), MAX_DURATION_MS);
    assert.equal(parseGiveawayDuration('31d'), null);
});

test('giveaway request validation enforces prize and winner bounds', () => {
    assert.equal(validateGiveawayInput({ prize: 'Nitro', duration: '1h', winners: 1 }).valid, true);
    assert.equal(validateGiveawayInput({ prize: '', duration: '1h', winners: 1 }).valid, false);
    assert.equal(validateGiveawayInput({ prize: 'x'.repeat(201), duration: '1h', winners: 1 }).valid, false);
    assert.equal(validateGiveawayInput({ prize: 'Nitro', duration: '1h', winners: 0 }).valid, false);
    assert.equal(validateGiveawayInput({ prize: 'Nitro', duration: '1h', winners: 11 }).valid, false);
});
