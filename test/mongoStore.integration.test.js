'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const BotRecord = require('../src/models/BotRecord');
const store = require('../src/utils/mongoStore');
const { createPhoneSyncPublisher } = require('../src/utils/phoneSyncPublisher');

const uri = process.env.MONGO_TEST_URI;
const namespace = 'integration_' + process.pid + '_' + Date.now();

test('Mongo repository supports durable reads, CAS, patch, list and delete', { skip: !uri }, async (t) => {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    t.after(async () => {
        await BotRecord.deleteMany({ namespace });
        await mongoose.disconnect();
    });

    const first = await store.put(namespace, 'guild-a', { enabled: true, count: 1 });
    assert.equal(first.revision, 1);
    assert.deepEqual((await store.get(namespace, 'guild-a')).data, { enabled: true, count: 1 });

    const writes = await Promise.allSettled([
        store.put(namespace, 'guild-a', { enabled: false }, { expectedRevision: 1 }),
        store.put(namespace, 'guild-a', { enabled: true, count: 2 }, { expectedRevision: 1 })
    ]);
    assert.equal(writes.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(writes.filter((result) => result.status === 'rejected' && result.reason.code === 'REVISION_CONFLICT').length, 1);

    const current = await store.get(namespace, 'guild-a');
    const patched = await store.patch(namespace, 'guild-a', { label: 'synced' }, { expectedRevision: current.revision });
    assert.equal(patched.data.label, 'synced');
    assert.equal(patched.revision, current.revision + 1);

    await store.put(namespace, 'guild-b', { enabled: true });
    const rows = await store.list(namespace, { limit: 10 });
    assert.deepEqual(rows.map((row) => row.recordId), ['guild-a', 'guild-b']);

    const sent = [];
    const publisher = createPhoneSyncPublisher({
        env: { PHONE_DB_DEVICE_UID: 'test-device' },
        relay: { enqueue: async (operation) => sent.push(operation) }
    });
    assert.equal(await publisher.publishOnce(), 2);
    assert.equal(sent.length, 2);
    assert.ok(sent.every((operation) => operation.operation === 'put'));

    assert.equal(await store.remove(namespace, 'guild-a', { expectedRevision: patched.revision }), true);
    assert.equal(await store.get(namespace, 'guild-a'), null);
    assert.equal(await publisher.publishOnce(), 1);
    assert.equal(sent[2].operation, 'delete');
    assert.equal(sent[2].recordId, 'guild-a');
});
