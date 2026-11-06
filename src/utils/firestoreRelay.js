'use strict';

const crypto = require('crypto');
const API_ROOT = 'https://firestore.googleapis.com/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MAX_DOCUMENT_BYTES = 700 * 1024;

function validateOperation(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('operation must be an object');
    for (const key of ['operationId', 'deviceUid', 'collection', 'recordId']) {
        if (typeof input[key] !== 'string' || !input[key].trim()) throw new TypeError(key + ' must be a non-empty string');
    }
    if (input.operationId.length > 128 || input.deviceUid.length > 128 || input.collection.length > 120 || input.recordId.length > 200) {
        throw new RangeError('operation identifier exceeds its maximum length');
    }
    if (!['put', 'delete'].includes(input.operation)) throw new TypeError('unsupported operation');
    if (input.operation === 'put' && (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload))) {
        throw new TypeError('put operations require an object payload');
    }
    if (input.operation === 'delete' && input.payload != null) throw new TypeError('delete operations cannot contain a payload');
    const document = {
        schemaVersion: 1, operationId: input.operationId, deviceUid: input.deviceUid,
        collection: input.collection, recordId: input.recordId, operation: input.operation,
        payload: input.operation === 'put' ? input.payload : null,
        status: 'pending', createdAt: new Date().toISOString(), acknowledgedAt: null
    };
    if (Buffer.byteLength(JSON.stringify(document), 'utf8') > MAX_DOCUMENT_BYTES) throw new RangeError('operation is too large for the relay');
    return document;
}

function toFirestoreValue(value) {
    if (value === null) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('Firestore payload numbers must be finite');
        return Number.isInteger(value)
            ? { integerValue: String(value) }
            : { doubleValue: value };
    }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
    if (typeof value === 'object') {
        const fields = {};
        for (const [key, child] of Object.entries(value)) fields[key] = toFirestoreValue(child);
        return { mapValue: { fields } };
    }
    throw new TypeError('unsupported Firestore payload value');
}

function fromFirestoreValue(value) {
    if ('nullValue' in value) return null;
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
    if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
    return null;
}

function fromFirestoreFields(fields) {
    return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

function base64url(input) {
    return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createFirestoreRelay({ serviceAccount, projectId, fetchImpl = globalThis.fetch, clock = () => new Date() }) {
    if (!serviceAccount || !serviceAccount.client_email || !serviceAccount.private_key) throw new TypeError('valid service account credentials are required');
    if (!projectId) throw new TypeError('Firebase project ID is required');
    if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');

    let tokenCache = null;
    async function accessToken() {
        if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.token;
        const now = Math.floor(Date.now() / 1000);
        const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
        const claims = base64url(JSON.stringify({
            iss: serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/datastore',
            aud: serviceAccount.token_uri || TOKEN_URL,
            iat: now, exp: now + 3600
        }));
        const unsigned = header + '.' + claims;
        const signer = crypto.createSign('RSA-SHA256');
        signer.update(unsigned);
        const assertion = unsigned + '.' + base64url(signer.sign(serviceAccount.private_key));
        const response = await fetchImpl(serviceAccount.token_uri || TOKEN_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion
            }).toString()
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.access_token) throw new Error('Google OAuth token request failed (' + response.status + ')');
        tokenCache = { token: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000 };
        return tokenCache.token;
    }

    async function request(url, options = {}) {
        const token = await accessToken();
        const response = await fetchImpl(url, {
            ...options,
            headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(options.headers || {}) }
        });
        const body = await response.json().catch(() => ({}));
        return { response, body };
    }

    const collectionUrl = API_ROOT + '/projects/' + encodeURIComponent(projectId) + '/databases/(default)/documents/relayOperations';
    return {
        async enqueue(input) {
            const document = validateOperation(input);
            document.createdAt = clock().toISOString();
            const docId = encodeURIComponent(document.operationId);
            const url = collectionUrl + '/' + docId;
            const existing = await request(url);
            if (existing.response.ok) {
                const previous = fromFirestoreFields(existing.body.fields);
                const same = previous.deviceUid === document.deviceUid &&
                    previous.collection === document.collection &&
                    previous.recordId === document.recordId &&
                    previous.operation === document.operation;
                if (!same) throw new Error('operationId collision; refusing to overwrite relay data');
                return { operationId: document.operationId, created: false, status: previous.status };
            }
            if (existing.response.status !== 404) throw new Error('Firestore lookup failed (' + existing.response.status + ')');
            const fields = Object.fromEntries(Object.entries(document).map(([key, value]) => [key, toFirestoreValue(value)]));
            const created = await request(collectionUrl + '?documentId=' + docId, {
                method: 'POST', body: JSON.stringify({ fields })
            });
            if (created.response.ok) return { operationId: document.operationId, created: true, status: 'pending' };
            if (created.response.status === 409) {
                const raced = await request(url);
                if (raced.response.ok) {
                    const previous = fromFirestoreFields(raced.body.fields);
                    if (previous.deviceUid === document.deviceUid && previous.collection === document.collection &&
                        previous.recordId === document.recordId && previous.operation === document.operation) {
                        return { operationId: document.operationId, created: false, status: previous.status };
                    }
                }
                throw new Error('operationId collision during concurrent enqueue');
            }
            throw new Error('Firestore enqueue failed (' + created.response.status + ')');
        }
    };
}

function createFirestoreRelayFromEnv(env = process.env, options = {}) {
    const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    let serviceAccount;
    try { serviceAccount = JSON.parse(raw); }
    catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON'); }
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('Firebase service account JSON is missing required fields');
    }
    return createFirestoreRelay({ serviceAccount, projectId: env.FIREBASE_PROJECT_ID || serviceAccount.project_id, ...options });
}

module.exports = { createFirestoreRelay, createFirestoreRelayFromEnv, validateOperation, toFirestoreValue, fromFirestoreFields };
