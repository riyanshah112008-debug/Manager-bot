'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const store = require('../src/utils/mongoStore');

test('Mongo storage refuses operations while the primary database is disconnected', async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    await assert.rejects(
        store.get('guild-settings', 'guild-1'),
        error => error.code === 'MONGO_NOT_CONNECTED'
    );

    await assert.rejects(
        store.put('guild-settings', 'guild-1', { prefix: '!' }),
        error => error.code === 'MONGO_NOT_CONNECTED'
    );
});

test('Mongo storage validates keys and payloads before attempting database writes', async () => {
    await assert.rejects(
        store.get('', 'guild-1'),
        error => error instanceof TypeError
    );

    await assert.rejects(
        store.put('guild-settings', '', { prefix: '!' }),
        error => error instanceof TypeError
    );

    await assert.rejects(
        store.put('guild-settings', 'guild-1', []),
        error => error instanceof TypeError
    );
});
