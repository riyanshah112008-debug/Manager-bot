'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validateOperation } = require('../src/modules/phoneSync');

const valid = {
    operationId: crypto.randomUUID(),
    entityType: 'phone_test_records',
    entityId: 'android-test-001',
    operation: 'upsert',
    payload: { message: 'relay contract test' },
    baseRevision: 0
};

const normalized = validateOperation(valid);
assert.equal(normalized.operationId, valid.operationId);
assert.equal(normalized.schemaVersion, 1);
assert.deepEqual(normalized.payload, valid.payload);

assert.throws(() => validateOperation({ ...valid, entityType: 'guild_settings' }), /phone_test_records/);
assert.throws(() => validateOperation({ ...valid, operation: 'execute' }), /Unsupported operation/);
assert.throws(() => validateOperation({ ...valid, operationId: 'not-a-uuid' }), /UUID/);
assert.throws(() => validateOperation({ ...valid, payload: 'not-an-object' }), /JSON object/);
assert.throws(() => validateOperation({ ...valid, payload: { data: 'x'.repeat(5000) } }), /4 KB/);
assert.equal(validateOperation({ ...valid, operation: 'delete', payload: null }).payload, null);

process.stdout.write('Phone sync relay contract tests passed.\n');
