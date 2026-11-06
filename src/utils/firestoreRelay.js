'use strict';

const COLLECTION = 'relayOperations';
const MAX_DOCUMENT_BYTES = 700 * 1024;

function validateOperation(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('operation must be an object');
    }
    const allowed = ['put', 'delete'];
    for (const key of ['operationId', 'deviceUid', 'collection', 'recordId']) {
        if (typeof input[key] !== 'string' || !input[key].trim()) {
            throw new TypeError(key + ' must be a non-empty string');
        }
    }
    if (input.operationId.length > 128 || input.deviceUid.length > 128 ||
        input.collection.length > 120 || input.recordId.length > 200) {
        throw new RangeError('operation identifier exceeds its maximum length');
    }
    if (!allowed.includes(input.operation)) throw new TypeError('unsupported operation');
    if (input.operation === 'put' && (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload))) {
        throw new TypeError('put operations require an object payload');
    }
    if (input.operation === 'delete' && input.payload != null) {
        throw new TypeError('delete operations cannot contain a payload');
    }
    const document = {
        schemaVersion: 1,
        operationId: input.operationId,
        deviceUid: input.deviceUid,
        collection: input.collection,
        recordId: input.recordId,
        operation: input.operation,
        payload: input.operation === 'put' ? input.payload : null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        acknowledgedAt: null
    };
    if (Buffer.byteLength(JSON.stringify(document), 'utf8') > MAX_DOCUMENT_BYTES) {
        throw new RangeError('operation is too large for the relay');
    }
    return document;
}

function createFirestoreRelay({ firestore, clock = () => new Date() }) {
    if (!firestore || typeof firestore.collection !== 'function') {
        throw new TypeError('a Firestore instance is required');
    }
    const operations = firestore.collection(COLLECTION);

    return {
        async enqueue(input) {
            const document = validateOperation(input);
            document.createdAt = clock().toISOString();
            const ref = operations.doc(document.operationId);
            return firestore.runTransaction(async transaction => {
                const existing = await transaction.get(ref);
                if (existing.exists) {
                    const previous = existing.data();
                    const same = previous.deviceUid === document.deviceUid &&
                        previous.collection === document.collection &&
                        previous.recordId === document.recordId &&
                        previous.operation === document.operation;
                    if (!same) throw new Error('operationId collision; refusing to overwrite relay data');
                    return { operationId: document.operationId, created: false, status: previous.status };
                }
                transaction.create(ref, document);
                return { operationId: document.operationId, created: true, status: 'pending' };
            });
        }
    };
}

function createAdminFirestoreFromEnv(env = process.env) {
    const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(raw);
    } catch {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON');
    }
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('Firebase service account JSON is missing required fields');
    }
    const admin = require('firebase-admin');
    const appName = 'manager-bot-firestore-relay';
    const existing = admin.apps.find(app => app.name === appName);
    const app = existing || admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    }, appName);
    return app.firestore();
}

module.exports = {
    COLLECTION,
    createFirestoreRelay,
    createAdminFirestoreFromEnv,
    validateOperation
};
