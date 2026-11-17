'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('../src/modules/susAccount');

const DAY_MS = 24 * 60 * 60 * 1000;
const JOINED_AT = Date.parse('2026-01-01T00:00:00.000Z');

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
