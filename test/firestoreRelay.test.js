'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    createFirestoreRelay, validateOperation, toFirestoreValue, fromFirestoreFields
} = require('../src/utils/firestoreRelay');

const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccount = {
    project_id: 'test-project',
    client_email: 'relay@test-project.iam.gserviceaccount.com',
    private_key: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    token_uri: 'https://oauth2.googleapis.com/token'
};

function response(status, body) {
    return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

test('validates and normalizes put/delete operations', () => {
    const doc = validateOperation({
        operationId: 'op-1', deviceUid: 'device-1',
        collection: 'guild_settings', recordId: 'guild-1',
        operation: 'put', payload: { enabled: true }
    });
    assert.equal(doc.status, 'pending');
    assert.equal(doc.schemaVersion, 1);
    assert.deepEqual(doc.payload, { enabled: true });
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

test('Firestore values round-trip nested JSON data', () => {
    const original = { enabled: true, count: 3, score: 1.5, nothing: null, list: ['a', 2], nested: { ok: false } };
    const encoded = Object.fromEntries(Object.entries(original).map(([key, value]) => [key, toFirestoreValue(value)]));
    assert.deepEqual(fromFirestoreFields(encoded), original);
    assert.throws(() => toFirestoreValue(Number.NaN), /finite/);
});

test('enqueues a durable document using service-account OAuth', async () => {
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
        calls.push({ url, options });
        if (url === serviceAccount.token_uri) return response(200, { access_token: 'test-access', expires_in: 3600 });
        if (options.method === 'POST') {
            const body = JSON.parse(options.body);
            assert.equal(body.fields.deviceUid.stringValue, 'phone-uid');
            assert.equal(body.fields.status.stringValue, 'pending');
            return response(200, { name: 'projects/test-project/databases/(default)/documents/relayOperations/op-1' });
        }
        return response(404, { error: { status: 'NOT_FOUND' } });
    };
    const relay = createFirestoreRelay({
        serviceAccount, projectId: 'test-project', fetchImpl,
        clock: () => new Date('2026-11-06T00:00:00.000Z')
    });
    const result = await relay.enqueue({
        operationId: 'op-1', deviceUid: 'phone-uid',
        collection: 'warnings', recordId: 'warning-1',
        operation: 'put', payload: { reason: 'test' }
    });
    assert.deepEqual(result, { operationId: 'op-1', created: true, status: 'pending' });
    assert.equal(calls.length, 3);
    assert.equal(calls[1].options.headers.authorization, 'Bearer test-access');
});

test('rejects invalid credentials and conflicting existing operation IDs', async () => {
    assert.throws(() => createFirestoreRelay({ serviceAccount: {}, projectId: 'p' }), /credentials/);
    const fetchImpl = async (url) => {
        if (url === serviceAccount.token_uri) return response(200, { access_token: 'token', expires_in: 3600 });
        return response(200, { fields: {
            deviceUid: { stringValue: 'phone-uid' },
            collection: { stringValue: 'warnings' },
            recordId: { stringValue: 'w1' },
            operation: { stringValue: 'put' },
            payload: { mapValue: { fields: { reason: { stringValue: 'different' } } } },
            status: { stringValue: 'pending' }
        }});
    };
    const relay = createFirestoreRelay({ serviceAccount, projectId: 'test-project', fetchImpl });
    await assert.rejects(() => relay.enqueue({
        operationId: 'collision', deviceUid: 'phone-uid',
        collection: 'warnings', recordId: 'w1', operation: 'put',
        payload: { reason: 'original' }
    }), /collision/);
});
