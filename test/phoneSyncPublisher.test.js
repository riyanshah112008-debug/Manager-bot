'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeOperationId } = require('../src/utils/phoneSyncPublisher');

test('phone relay operation IDs are deterministic for one record revision', () => {
    const first = makeOperationId('guild_settings', 'guild-1', 7);
    const second = makeOperationId('guild_settings', 'guild-1', 7);
    assert.equal(first, second);
    assert.match(first, /^[a-f0-9]{64}$/);
});

test('phone relay operation IDs change when a record revision changes', () => {
    assert.notEqual(
        makeOperationId('guild_settings', 'guild-1', 7),
        makeOperationId('guild_settings', 'guild-1', 8)
    );
});

test('phone relay operation IDs isolate namespaces and record IDs', () => {
    const base = makeOperationId('guild_settings', 'guild-1', 1);
    assert.notEqual(base, makeOperationId('user_settings', 'guild-1', 1));
    assert.notEqual(base, makeOperationId('guild_settings', 'guild-2', 1));
});
