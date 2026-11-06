'use strict';

const mongoose = require('mongoose');
const BotRecord = require('../models/BotRecord');

const SCHEMA_VERSION = 1;
const MAX_CAS_RETRIES = 5;

class StorageError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
    }
}

function assertKey(namespace, recordId) {
    if (typeof namespace !== 'string' || !namespace.trim()) {
        throw new TypeError('namespace must be a non-empty string');
    }
    if (typeof recordId !== 'string' || !recordId.trim()) {
        throw new TypeError('recordId must be a non-empty string');
    }
    if (namespace.length > 120 || recordId.length > 200) {
        throw new RangeError('storage key exceeds its maximum length');
    }
}

function normalizeData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new TypeError('record data must be a plain object');
    }
    let serialized;
    try {
        serialized = JSON.stringify(data);
    } catch {
        throw new TypeError('record data must be JSON-serializable');
    }
    if (serialized === undefined) throw new TypeError('record data must be JSON-serializable');
    return JSON.parse(serialized);
}

function assertConnected() {
    if (mongoose.connection.readyState !== 1) {
        throw new StorageError('MongoDB is not connected; storage operation was not attempted.', 'MONGO_NOT_CONNECTED');
    }
}

function toResult(document) {
    if (!document) return null;
    return {
        namespace: document.namespace,
        recordId: document.recordId,
        schemaVersion: document.schemaVersion,
        revision: document.revision,
        data: document.data,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
    };
}

async function get(namespace, recordId) {
    assertKey(namespace, recordId);
    assertConnected();
    const document = await BotRecord.findOne({ namespace, recordId }).lean();
    if (document?.data?._deleted === true) return null;
    return toResult(document);
}

async function put(namespace, recordId, data, options = {}) {
    assertKey(namespace, recordId);
    assertConnected();
    const normalized = normalizeData(data);
    const filter = { namespace, recordId };
    const hasExpectedRevision = Object.prototype.hasOwnProperty.call(options, 'expectedRevision');

    if (hasExpectedRevision) {
        if (!Number.isInteger(options.expectedRevision) || options.expectedRevision < 0) {
            throw new TypeError('expectedRevision must be a non-negative integer');
        }
        filter.revision = options.expectedRevision;
    }

    try {
        const document = await BotRecord.findOneAndUpdate(
            filter,
            {
                $set: { data: normalized, schemaVersion: SCHEMA_VERSION },
                $setOnInsert: { namespace, recordId },
                $inc: { revision: 1 }
            },
            {
                new: true,
                upsert: !hasExpectedRevision || options.expectedRevision === 0,
                setDefaultsOnInsert: true,
                runValidators: true
            }
        ).lean();

        if (!document) {
            throw new StorageError('Record revision changed; reload before saving.', 'REVISION_CONFLICT');
        }
        return toResult(document);
    } catch (error) {
        if (error && error.code === 11000) {
            throw new StorageError('Record was created or changed by another writer; reload before saving.', 'REVISION_CONFLICT');
        }
        throw error;
    }
}

async function patch(namespace, recordId, changes, options = {}) {
    assertKey(namespace, recordId);
    const normalizedChanges = normalizeData(changes);

    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
        const current = await get(namespace, recordId);
        if (!current) return null;

        if (options.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
            throw new StorageError('Record revision changed; reload before saving.', 'REVISION_CONFLICT');
        }

        const nextData = { ...current.data, ...normalizedChanges };
        try {
            return await put(namespace, recordId, nextData, { expectedRevision: current.revision });
        } catch (error) {
            if (error.code !== 'REVISION_CONFLICT' || attempt === MAX_CAS_RETRIES - 1) throw error;
        }
    }
    throw new StorageError('Record could not be updated after repeated concurrent writes.', 'REVISION_CONFLICT');
}

async function remove(namespace, recordId, options = {}) {
    assertKey(namespace, recordId);
    const current = await get(namespace, recordId);
    if (!current) return false;
    const expectedRevision = options.expectedRevision === undefined ? current.revision : options.expectedRevision;
    if (current.revision !== expectedRevision) {
        throw new StorageError('Record revision changed; reload before deleting.', 'REVISION_CONFLICT');
    }
    // Keep a tombstone so offline replicas receive deletions after reconnecting.
    await put(namespace, recordId, { _deleted: true }, { expectedRevision });
    return true;
}

async function list(namespace, options = {}) {
    if (typeof namespace !== 'string' || !namespace.trim()) {
        throw new TypeError('namespace must be a non-empty string');
    }
    assertConnected();
    const limit = options.limit === undefined ? 500 : options.limit;
    if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
        throw new RangeError('limit must be an integer between 1 and 5000');
    }

    const query = BotRecord.find({ namespace, 'data._deleted': { $ne: true } }).sort({ recordId: 1 }).limit(limit);
    if (options.afterRecordId) query.where('recordId').gt(String(options.afterRecordId));
    const documents = await query.lean();
    return documents.map(toResult);
}

module.exports = {
    get,
    put,
    patch,
    remove,
    list,
    StorageError
};
