'use strict';

const crypto = require('crypto');
const BotRecord = require('../models/BotRecord');
const { createFirestoreRelayFromEnv } = require('./firestoreRelay');

function makeOperationId(namespace, recordId, revision) {
    return crypto.createHash('sha256')
        .update(namespace + '\\0' + recordId + '\\0' + String(revision))
        .digest('hex');
}

function createPhoneSyncPublisher(options = {}) {
    const env = options.env || process.env;
    const relay = options.relay || createFirestoreRelayFromEnv(env);
    const deviceUid = env.PHONE_DB_DEVICE_UID;
    if (!deviceUid) throw new Error('PHONE_DB_DEVICE_UID is required to publish phone sync records.');

    const batchSize = Math.min(250, Math.max(1, Number(options.batchSize || 50)));
    const intervalMs = Math.max(1000, Number(options.intervalMs || 5000));
    let timer = null;
    let running = false;
    let stopped = false;

    async function publishOnce() {
        if (running || stopped) return 0;
        running = true;
        let published = 0;
        try {
            const records = await BotRecord.find({
                $expr: { $gt: ['$revision', '$relayPublishedRevision'] }
            }).sort({ updatedAt: 1, _id: 1 }).limit(batchSize).lean();

            for (const record of records) {
                const deleted = record.data?._deleted === true;
                const operationId = makeOperationId(record.namespace, record.recordId, record.revision);
                await relay.enqueue({
                    operationId,
                    deviceUid,
                    collection: record.namespace,
                    recordId: record.recordId,
                    operation: deleted ? 'delete' : 'put',
                    payload: deleted ? null : record.data
                });
                // A concurrent newer write is deliberately left pending for the next pass.
                await BotRecord.updateOne(
                    { _id: record._id, revision: record.revision },
                    { $set: { relayPublishedRevision: record.revision } }
                );
                published++;
            }
        } finally {
            running = false;
        }
        return published;
    }

    function start() {
        if (timer) return stop;
        stopped = false;
        const tick = async () => {
            try {
                const count = await publishOnce();
                if (count) console.log('[Phone Sync] Published ' + count + ' MongoDB change(s) to Firestore.');
            } catch (error) {
                console.error('[Phone Sync] Publisher pass failed; changes remain pending:', error.message);
            }
        };
        timer = setInterval(tick, intervalMs);
        if (typeof timer.unref === 'function') timer.unref();
        tick();
        return stop;
    }

    function stop() {
        stopped = true;
        if (timer) clearInterval(timer);
        timer = null;
    }

    return { start, stop, publishOnce };
}

module.exports = { createPhoneSyncPublisher, makeOperationId };
