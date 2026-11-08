'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { validateOperation, devicePath } = require('../src/modules/phoneSync');

const valid = {
    operationId: crypto.randomUUID(),
    entityType: 'phone_test_records',
    entityId: 'android-test-001',
    operation: 'upsert',
    payload: { message: 'relay contract test' },
    baseRevision: 0
};

assert.equal(devicePath('discord-user-1', '12345678-1234-4234-8234-123456789abc'), '/starryPhoneSyncUsers/discord-user-1/devices/12345678-1234-4234-8234-123456789abc');

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
assert.throws(() => validateOperation({ ...valid, baseRevision: -1 }), /Base revision/);
assert.throws(() => validateOperation({ ...valid, baseRevision: 1.5 }), /Base revision/);
assert.throws(() => validateOperation({ ...valid, entityId: 'bad\nrecord' }), /printable/);
const circular = {};
circular.self = circular;
assert.throws(() => validateOperation({ ...valid, payload: circular }), /valid JSON values/);
assert.deepEqual(validateOperation({ ...valid, payload: { nested: [1, true, null] } }).payload, { nested: [1, true, null] });

assert.throws(() => validateOperation({ ...valid, payload: { value: Number.MAX_SAFE_INTEGER + 1 } }), /safe range/);
assert.throws(() => validateOperation({ ...valid, payload: { nested: { '': 'bad' } } }), /reserved map key/);
assert.throws(() => validateOperation({ ...valid, payload: { '__internal__': 'bad' } }), /reserved map key/);
assert.throws(() => validateOperation({ ...valid, payload: { nested: [1, { '__name__': 'bad' }] } }), /reserved map key/);
assert.equal(validateOperation({ ...valid, payload: { safe: Number.MAX_SAFE_INTEGER } }).payload.safe, Number.MAX_SAFE_INTEGER);

process.stdout.write('Phone sync relay contract tests passed.\\n');
