// Server-only Firestore REST relay for the phone SQLite workspace.
// Uses Node's built-in crypto/fetch; no Firebase credential is sent to the browser.
'use strict';

const crypto = require('crypto');
const { isDeepStrictEqual } = require('node:util');

const COLLECTION = 'starryPhoneSyncUsers';
const SCHEMA_VERSION = 1;
const MAX_BATCH = 20;
const MAX_PAYLOAD_BYTES = 4096;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ENTITY_TYPES = new Set(['phone_test_records']);

let tokenCache = null;

function base64url(value) {
    return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function validId(value) {
    return typeof value === 'string' && UUID_RE.test(value);
}

function encodeValue(value) {
    if (value === null || value === undefined) return { nullValue: 'NULL_VALUE' };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? { integerValue: String(value) }
            : { doubleValue: value };
    }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
    if (typeof value === 'object') {
        const fields = {};
        for (const [key, item] of Object.entries(value)) fields[key] = encodeValue(item);
        return { mapValue: { fields } };
    }
    throw new Error('Unsupported Firestore value.');
}

function decodeValue(value) {
    if (!value || typeof value !== 'object') return null;
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('nullValue' in value) return null;
    if ('timestampValue' in value) return value.timestampValue;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
    if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
    return null;
}

function decodeFields(fields) {
    return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

function serviceConfig() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
    if (!raw || !projectId) throw new Error('Firestore relay is not configured on the server.');
    let account;
    try { account = JSON.parse(raw); } catch (_) { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.'); }
    if (!account.client_email || !account.private_key) throw new Error('Firebase service account is missing required fields.');
    return { account, projectId };
}

async function getAccessToken(account) {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.value;
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(JSON.stringify({
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    }));
    const unsigned = header + '.' + claims;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const assertion = unsigned + '.' + signer.sign(account.private_key, 'base64url');
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) throw new Error('Could not authenticate with the Firebase service account.');
    tokenCache = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
    return tokenCache.value;
}

async function firestoreRequest(path, { method = 'GET', body, query = '' } = {}) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[\x00-\x1F]/.test(path) || !path.split('/').slice(1).every(part => part === '' || /^[A-Za-z0-9_:-]+$/.test(part))) {
        throw new Error('Invalid Firestore document path.');
    }
    if (typeof query !== 'string' || (query && !/^\?[A-Za-z0-9_=&%-]*$/.test(query))) throw new Error('Invalid Firestore query parameters.');
    const { account, projectId } = serviceConfig();
    const token = await getAccessToken(account);
    const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/databases/(default)/documents';
    const response = await fetch(base + path + query, {
        method,
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error?.message || 'Firestore request failed.');
        error.status = response.status;
        error.code = data.error?.status;
        throw error;
    }
    return data;
}

function validateOperation(operation) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        throw new Error('Each operation must be an object.');
    }
    if (!validId(operation.operationId)) throw new Error('Operation ID must be a UUID v4.');
    if (!ALLOWED_ENTITY_TYPES.has(operation.entityType)) {
        throw new Error('This sync foundation only accepts phone_test_records.');
    }
    if (typeof operation.entityId !== 'string' || !operation.entityId.trim() || operation.entityId.length > 160 || /[\x00-\x1F]/.test(operation.entityId)) {
        throw new Error('Entity ID must be 1–160 printable characters.');
    }
    if (!['upsert', 'delete'].includes(operation.operation)) throw new Error('Unsupported operation type.');
    const baseRevision = operation.baseRevision === undefined ? 0 : operation.baseRevision;
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) throw new Error('Base revision must be a non-negative safe integer.');
    let safePayload = null;
    if (operation.operation === 'upsert') {
        if (!operation.payload || typeof operation.payload !== 'object' || Array.isArray(operation.payload)) {
            throw new Error('Upsert payload must be a JSON object.');
        }
        let serialized;
        try { serialized = JSON.stringify(operation.payload); } catch (_) {
            throw new Error('Upsert payload must contain valid JSON values only.');
        }
        if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
            throw new Error('Each payload must be 4 KB or smaller.');
        }
        safePayload = JSON.parse(serialized);
    }
    return {
        operationId: operation.operationId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        operation: operation.operation,
        payload: safePayload,
        baseRevision,
        schemaVersion: SCHEMA_VERSION
    };
}

function operationPath(userId, operationId) {
    return '/' + COLLECTION + '/' + encodeURIComponent(userId) + '/operations/' + encodeURIComponent(operationId);
}

function operationCollectionPath(userId) {
    return '/' + COLLECTION + '/' + encodeURIComponent(userId) + '/operations';
}

function documentBody(data) {
    const fields = {};
    for (const [key, value] of Object.entries(data)) fields[key] = encodeValue(value);
    return { fields };
}

async function createOperation(userId, operation) {
    const path = operationCollectionPath(userId);
    try {
        await firestoreRequest(path, {
            method: 'POST',
            query: '?documentId=' + encodeURIComponent(operation.operationId),
            body: documentBody(operation)
        });
        return 'created';
    } catch (error) {
        if (error.status !== 409 && error.code !== 'ALREADY_EXISTS') throw error;
        const existing = await firestoreRequest(operationPath(userId, operation.operationId));
        const fields = decodeFields(existing.fields);
        if (fields.deviceId === operation.deviceId &&
            fields.direction === operation.direction &&
            fields.entityId === operation.entityId &&
            fields.entityType === operation.entityType &&
            fields.operation === operation.operation &&
            isDeepStrictEqual(fields.payload ?? null, operation.payload ?? null) &&
            Number(fields.baseRevision || 0) === Number(operation.baseRevision || 0)) return 'duplicate';
        return 'conflict';
    }
}

function setupPhoneSyncRoutes(app, { requireAuth }) {
    const authenticated = (req, res, next) => requireAuth(req, res, next);

    app.get('/api/phone-sync/status', authenticated, async (req, res) => {
        try {
            serviceConfig();
            // Verify the configured Firestore database is reachable, not merely that OAuth credentials parse.
            await firestoreRequest('', { query: '?pageSize=1' });
            res.set('Cache-Control', 'no-store');
            res.json({ success: true, configured: true, schemaVersion: SCHEMA_VERSION, scope: 'phone_test_records' });
        } catch (_) {
            res.set('Cache-Control', 'no-store');
            res.status(503).json({ success: false, configured: false, error: 'Phone sync is not configured on the Starry server yet.' });
        }
    });

    app.post('/api/phone-sync/push', authenticated, async (req, res) => {
        try {
            const userId = req.session?.user?.id;
            const { deviceId, schemaVersion, operations } = req.body || {};
            if (!userId) return res.status(401).json({ success: false, error: 'Authenticated Discord user required.' });
            if (!validId(deviceId)) return res.status(400).json({ success: false, error: 'A valid device ID is required.' });
            if (schemaVersion !== SCHEMA_VERSION) return res.status(409).json({ success: false, error: 'Phone database schema version is not supported.' });
            if (!Array.isArray(operations) || operations.length < 1 || operations.length > MAX_BATCH) {
                return res.status(400).json({ success: false, error: 'Send between 1 and 20 operations per batch.' });
            }
            const validated = operations.map(validateOperation);
            const ack = [];
            const conflicts = [];
            for (const operation of validated) {
                const result = await createOperation(userId, {
                    ...operation,
                    ownerId: userId,
                    deviceId,
                    direction: 'phone_to_cloud',
                    receivedAt: new Date().toISOString(),
                    acknowledgedAt: null
                });
                if (result === 'conflict') conflicts.push(operation.operationId);
                else ack.push(operation.operationId);
            }
            res.json({ success: true, acknowledged: ack, conflicts, accepted: ack.length });
        } catch (error) {
            const status = /payload|operation|UUID|device|schema|batch|entity|unsupported|characters|revision|4 KB/i.test(error.message) ? 400 : 503;
            console.error('[Phone Sync] Push failed:', error.message);
            res.status(status).json({ success: false, error: status === 400 ? error.message : 'Phone sync is temporarily unavailable.' });
        }
    });

    app.post('/api/phone-sync/pull', authenticated, async (req, res) => {
        try {
            const userId = req.session?.user?.id;
            const deviceId = String(req.body?.deviceId || '');
            if (!userId) return res.status(401).json({ success: false, error: 'Authenticated Discord user required.' });
            if (!validId(deviceId)) return res.status(400).json({ success: false, error: 'A valid device ID is required.' });
            const query = {
                structuredQuery: {
                    from: [{ collectionId: 'operations' }],
                    where: {
                        compositeFilter: {
                            op: 'AND',
                            filters: [
                                { fieldFilter: { field: { fieldPath: 'direction' }, op: 'EQUAL', value: encodeValue('cloud_to_phone') } },
                                { fieldFilter: { field: { fieldPath: 'deviceId' }, op: 'EQUAL', value: encodeValue(deviceId) } },
                                { fieldFilter: { field: { fieldPath: 'acknowledgedAt' }, op: 'EQUAL', value: encodeValue(null) } }
                            ]
                        }
                    },
                    limit: MAX_BATCH
                }
            };
            const result = await firestoreRequest('/' + COLLECTION + '/' + encodeURIComponent(userId) + ':runQuery', { method: 'POST', body: query });
            const operations = (Array.isArray(result) ? result : []).filter(row => row.document).map(row => {
                const fields = decodeFields(row.document.fields);
                return {
                    operationId: row.document.name.split('/').pop(),
                    entityType: fields.entityType,
                    entityId: fields.entityId,
                    operation: fields.operation,
                    payload: fields.payload || null,
                    baseRevision: fields.baseRevision || 0,
                    schemaVersion: fields.schemaVersion || SCHEMA_VERSION
                };
            });
            res.set('Cache-Control', 'no-store');
            res.json({ success: true, operations });
        } catch (error) {
            console.error('[Phone Sync] Pull failed:', error.message);
            res.status(503).json({ success: false, error: 'Phone sync is temporarily unavailable.' });
        }
    });

    app.post('/api/phone-sync/ack', authenticated, async (req, res) => {
        try {
            const userId = req.session?.user?.id;
            const { deviceId, operationIds } = req.body || {};
            if (!userId) return res.status(401).json({ success: false, error: 'Authenticated Discord user required.' });
            if (!validId(deviceId)) return res.status(400).json({ success: false, error: 'A valid device ID is required.' });
            if (!Array.isArray(operationIds) || operationIds.length > 100 || operationIds.some(id => !validId(id))) {
                return res.status(400).json({ success: false, error: 'Acknowledgement must contain at most 100 valid operation IDs.' });
            }
            let acknowledged = 0;
            for (const id of operationIds) {
                const path = operationPath(userId, id);
                const existing = await firestoreRequest(path);
                const fields = decodeFields(existing.fields);
                if (fields.direction !== 'cloud_to_phone' || fields.deviceId !== deviceId) continue;
                // Build the PATCH path from validated identifiers, never from a response-supplied URL/path.
                await firestoreRequest(path, {
                    method: 'PATCH',
                    query: '?updateMask.fieldPaths=acknowledgedAt',
                    body: documentBody({ acknowledgedAt: new Date().toISOString() })
                });
                acknowledged++;
            }
            res.json({ success: true, acknowledged });
        } catch (error) {
            console.error('[Phone Sync] Acknowledgement failed:', error.message);
            res.status(503).json({ success: false, error: 'Phone sync is temporarily unavailable.' });
        }
    });
}

async function queuePhoneSyncOperation({ ownerId, deviceId, operation }) {
    if (typeof ownerId !== 'string' || !ownerId || !validId(deviceId)) throw new Error('Valid ownerId and deviceId are required.');
    const validated = validateOperation(operation);
    const result = await createOperation(ownerId, {
        ...validated,
        ownerId,
        deviceId,
        direction: 'cloud_to_phone',
        receivedAt: new Date().toISOString(),
        acknowledgedAt: null
    });
    if (result === 'conflict') throw new Error('Operation ID already exists with different content.');
    return validated.operationId;
}

module.exports = { setupPhoneSyncRoutes, queuePhoneSyncOperation, validateOperation };
