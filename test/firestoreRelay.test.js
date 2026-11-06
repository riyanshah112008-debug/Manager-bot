'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirestoreRelay, validateOperation } = require('../src/utils/firestoreRelay');

function fakeFirestore() {
    const docs = new Map();
    const collection = {
        doc(id) { return { id }; }
    };
    return {
        docs,
        collection() { return collection; },
        async runTransaction(callback) {
            const tx = {
                async get(ref) {
                    return { exists: docs.has(ref.id), data: () => docs.get(ref.id) };
                },
                create(ref, data) { docs.set(ref.id, structuredClone(data)); }
            };
            return callback(tx);
        }
    };
}

test('valid put operation is normalized', () => {
    const doc = validateOperation({
        operationId: 'op-1', deviceUid: 'device-1',
        collection: 'guild_settings', recordId: 'guild-1',
        operation: 'put', payload: { enabled: true }
    });
    assert.equal(doc.status, 'pending');
    assert.equal(doc.schemaVersion, 1);
    assert.deepEqual(doc.payload, { enabled: true });
});

test('rejects invalid and oversized operations', () => {
    assert.throws(() => validateOperation({}), /operationId/);
    assert.throws(() => validateOperation({
        operationId: 'x', deviceUid: 'd', collection: 'c', recordId: 'r',
        operation: 'delete', payload: {}
    }), /cannot contain/);
    assert.throws(() => validateOperation({
        operationId: 'x', deviceUid: 'd', collection: 'c', recordId: 'r',
        operation: 'put', payload: { huge: 'x'.repeat(720 * 1024) }
    }), /too large/);
});

test('enqueue is idempotent for the same operation ID', async () => {
    const firestore = fakeFirestore();
    const relay = createFirestoreRelay({ firestore, clock: () => new Date('2026-11-06T00:00:00.000Z') });
    const operation = {
        operationId: 'stable-op', deviceUid: 'phone-uid',
        collection: 'warnings', recordId: 'warning-1',
        operation: 'put', payload: { reason: 'test' }
    };
    assert.deepEqual(await relay.enqueue(operation), {
        operationId: 'stable-op', created: true, status: 'pending'
    });
    assert.deepEqual(await relay.enqueue(operation), {
        operationId: 'stable-op', created: false, status: 'pending'
    });
    assert.equal(firestore.docs.size, 1);
    assert.equal(firestore.docs.get('stable-op').createdAt, '2026-11-06T00:00:00.000Z');
});

test('rejects operation ID collision across different records', async () => {
    const relay = createFirestoreRelay({ firestore: fakeFirestore() });
    await relay.enqueue({
        operationId: 'same', deviceUid: 'd', collection: 'c',
        recordId: 'one', operation: 'delete'
    });
    await assert.rejects(() => relay.enqueue({
        operationId: 'same', deviceUid: 'd', collection: 'c',
        recordId: 'two', operation: 'delete'
    }), /collision/);
});
