// Server-only Firestore relay for the phone SQLite workspace.
// This is a transport foundation, not a production bot-data migration.
'use strict';

const crypto = require('crypto');
const admin = require('firebase-admin');

const COLLECTION = 'starryPhoneSyncUsers';
const SCHEMA_VERSION = 1;
const MAX_BATCH = 20;
const MAX_PAYLOAD_BYTES = 4096;
const DEVICE_ID_RE = /^[a-f0-9-]{36}$/i;
const OPERATION_ID_RE = /^[a-f0-9--]{36}$/i;
const ALLOWED_ENTITY_TYPES = new Set(['phone_test_records']);

let firestore = null;
let initializationError = null;

function getFirestore() {
    if (firestore) return firestore;
    if (initializationError) throw initializationError;

    try {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
        if (!raw || !projectId) {
            throw new Error('Firestore relay is not configured on the server.');
        }

        let serviceAccount;
        try {
            serviceAccount = JSON.parse(raw);
        } catch (_) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
        }
        if (!serviceAccount.client_email || !serviceAccount.private_key) {
            throw new Error('Firebase service account is missing required fields.');
        }

        const app = admin.apps.length
            ? admin.app()
            : admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId
            });
        firestore = app.firestore();
        return firestore;
    } catch (error) {
        initializationError = error;
        throw error;
    }
}

function validId(value, pattern = DEVICE_ID_RE) {
    return typeof value === 'string' && pattern.test(value);
}

function validateOperation(operation) {
    if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        throw new Error('Each operation must be an object.');
    }
    if (!validId(operation.operationId, OPERATION_ID_RE)) {
        throw new Error('Operation ID must be a UUID.');
    }
    if (!ALLOWED_ENTITY_TYPES.has(operation.entityType)) {
        throw new Error('This sync foundation only accepts phone_test_records.');
    }
    if (typeof operation.entityId !== 'string' || !operation.entityId.trim() || operation.entityId.length > 160) {
        throw new Error('Entity ID must be 1–160 characters.');
    }
    if (!['upsert', 'delete'].includes(operation.operation)) {
        throw new Error('Unsupported operation type.');
    }
    if (operation.operation === 'upsert') {
        if (!operation.payload || typeof operation.payload !== 'object' || Array.isArray(operation.payload)) {
            throw new Error('Upsert payload must be a JSON object.');
        }
        const bytes = Buffer.byteLength(JSON.stringify(operation.payload), 'utf8');
        if (bytes > MAX_PAYLOAD_BYTES) throw new Error('Each payload must be 4 KB or smaller.');
    }
    return {
        operationId: operation.operationId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        operation: operation.operation,
        payload: operation.operation === 'upsert' ? operation.payload : null,
        baseRevision: Number.isSafeInteger(operation.baseRevision) && operation.baseRevision >= 0
            ? operation.baseRevision : 0,
        schemaVersion: SCHEMA_VERSION
    };
}

function setupPhoneSyncRoutes(app, { requireAuth }) {
    const authenticated = (req, res, next) => requireAuth(req, res, next);

    app.get('/api/phone-sync/status', authenticated, (req, res) => {
        try {
            getFirestore();
            res.set('Cache-Control', 'no-store');
            res.json({ success: true, configured: true, schemaVersion: SCHEMA_VERSION, scope: 'phone_test_records' });
        } catch (_) {
            res.set('Cache-Control', 'no-store');
            res.status(503).json({
                success: false,
                configured: false,
                error: 'Phone sync is not configured on the Starry server yet.'
            });
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
            const db = getFirestore();
            const userRef = db.collection(COLLECTION).doc(userId);
            const ack = [];
            const conflicts = [];

            for (const operation of validated) {
                const operationRef = userRef.collection('operations').doc(operation.operationId);
                await db.runTransaction(async transaction => {
                    const existing = await transaction.get(operationRef);
                    if (existing.exists) {
                        const saved = existing.data();
                        if (saved.deviceId !== deviceId || saved.entityId !== operation.entityId ||
                            saved.entityType !== operation.entityType || saved.operation !== operation.operation) {
                            throw new Error('IDEMPOTENCY_KEY_REUSE');
                        }
                        ack.push(operation.operationId);
                        return;
                    }
                    transaction.create(operationRef, {
                        ...operation,
                        ownerId: userId,
                        deviceId,
                        direction: 'phone_to_cloud',
                        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                        acknowledgedAt: null
                    });
                    ack.push(operation.operationId);
                }).catch(error => {
                    if (error.message === 'IDEMPOTENCY_KEY_REUSE') conflicts.push(operation.operationId);
                    else throw error;
                });
            }

            res.json({ success: true, acknowledged: ack, conflicts, accepted: ack.length - conflicts.length });
        } catch (error) {
            const status = /payload|operation|UUID|device|schema|batch|entity|unsupported|characters|4 KB/i.test(error.message) ? 400 : 503;
            console.error('[Phone Sync] Push failed:', error.message);
            res.status(status).json({ success: false, error: status === 400 ? error.message : 'Phone sync is temporarily unavailable.' });
        }
    });

    app.get('/api/phone-sync/pull', authenticated, async (req, res) => {
        try {
            const userId = req.session?.user?.id;
            const deviceId = String(req.query.deviceId || '');
            if (!userId) return res.status(401).json({ success: false, error: 'Authenticated Discord user required.' });
            if (!validId(deviceId)) return res.status(400).json({ success: false, error: 'A valid device ID is required.' });

            const db = getFirestore();
            const snapshot = await db.collection(COLLECTION).doc(userId)
                .collection('operations')
                .where('direction', '==', 'cloud_to_phone')
                .where('deviceId', '==', deviceId)
                .where('acknowledgedAt', '==', null)
                .limit(MAX_BATCH)
                .get();
            const operations = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    operationId: doc.id,
                    entityType: data.entityType,
                    entityId: data.entityId,
                    operation: data.operation,
                    payload: data.payload || null,
                    baseRevision: data.baseRevision || 0,
                    schemaVersion: data.schemaVersion || SCHEMA_VERSION
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
            if (!Array.isArray(operationIds) || operationIds.length > 100 ||
                operationIds.some(id => !validId(id, OPERATION_ID_RE))) {
                return res.status(400).json({ success: false, error: 'Acknowledgement must contain at most 100 valid operation IDs.' });
            }

            const db = getFirestore();
            const userRef = db.collection(COLLECTION).doc(userId);
            let acknowledged = 0;
            for (let i = 0; i < operationIds.length; i += 400) {
                const batch = db.batch();
                const ids = operationIds.slice(i, i + 400);
                const refs = ids.map(id => userRef.collection('operations').doc(id));
                const docs = await Promise.all(refs.map(ref => ref.get()));
                docs.forEach((doc, index) => {
                    if (doc.exists && doc.data().direction === 'cloud_to_phone' && doc.data().deviceId === deviceId) {
                        batch.update(refs[index], { acknowledgedAt: admin.firestore.FieldValue.serverTimestamp() });
                        acknowledged++;
                    }
                });
                await batch.commit();
            }
            res.json({ success: true, acknowledged });
        } catch (error) {
            console.error('[Phone Sync] Acknowledgement failed:', error.message);
            res.status(503).json({ success: false, error: 'Phone sync is temporarily unavailable.' });
        }
    });
}

// Server-side helper for bot modules to queue a change for one paired phone.
// Pairing and production entity allowlists are deliberately not enabled in this foundation.
async function queuePhoneSyncOperation({ ownerId, deviceId, operation }) {
    if (typeof ownerId !== 'string' || !ownerId || !validId(deviceId)) {
        throw new Error('Valid ownerId and deviceId are required.');
    }
    const validated = validateOperation(operation);
    const db = getFirestore();
    const ref = db.collection(COLLECTION).doc(ownerId).collection('operations').doc(validated.operationId);
    await ref.create({
        ...validated,
        ownerId,
        deviceId,
        direction: 'cloud_to_phone',
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        acknowledgedAt: null
    });
    return validated.operationId;
}

module.exports = { setupPhoneSyncRoutes, queuePhoneSyncOperation, validateOperation };
