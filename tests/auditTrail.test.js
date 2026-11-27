'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const AuditEvent = require('../src/models/AuditEvent');
const { recordAuditEvent, getAuditTrail, sanitizeChanges } = require('../src/utils/auditTrail');

test('sensitive fields are redacted from audit metadata', () => {
    const clean = sanitizeChanges({
        token: 'super-secret-token',
        clientSecret: 'hidden',
        password: 'hunter2',
        sessionId: 'abc',
        color: '#FF73FA'
    });
    assert.equal(clean.token, '[redacted]');
    assert.equal(clean.clientSecret, '[redacted]');
    assert.equal(clean.password, '[redacted]');
    assert.equal(clean.sessionId, '[redacted]');
    assert.equal(clean.color, '#FF73FA');
});

test('audit metadata is truncated to bounded values', () => {
    const clean = sanitizeChanges({
        description: 'x'.repeat(500),
        nested: { deep: true },
        list: [1, 2, 3]
    });
    assert.equal(clean.description.length, 201);
    assert.ok(clean.description.endsWith('…'));
    assert.equal(clean.nested, '[object]');
    assert.equal(clean.list, '[3 items]');
});

test('audit metadata handles empty and invalid payloads', () => {
    assert.equal(sanitizeChanges(null), null);
    assert.equal(sanitizeChanges('text'), null);
    assert.equal(sanitizeChanges([]), null);
    assert.deepEqual(sanitizeChanges({}), null);
});

test('audit entries require a guild and an action', async () => {
    assert.equal(await recordAuditEvent({ action: 'settings.update' }), false);
    assert.equal(await recordAuditEvent({ guildId: '123' }), false);
    assert.equal(await recordAuditEvent(null), false);
});

test('audit entries are recorded without secrets and never throw', async () => {
    const captured = [];
    const originalCreate = AuditEvent.create;
    AuditEvent.create = async (payload) => { captured.push(payload); return payload; };
    try {
        const ok = await recordAuditEvent({
            guildId: 'guild-1',
            actor: { id: 'user-1', tag: 'owner#1' },
            action: 'welcome.update',
            targetType: 'channel',
            targetId: 'channel-1',
            summary: 'Updated welcome settings',
            changes: { token: 'leak', color: '#FFF' },
            req: { headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' } }
        });
        assert.equal(ok, true);
        assert.equal(captured.length, 1);
        const entry = captured[0];
        assert.equal(entry.guildId, 'guild-1');
        assert.equal(entry.actorId, 'user-1');
        assert.equal(entry.actorTag, 'owner#1');
        assert.equal(entry.changes.token, '[redacted]');
        assert.equal(entry.changes.color, '#FFF');
        assert.equal(entry.ip, '203.0.113.10');
        assert.equal(entry.success, true);

        AuditEvent.create = async () => { throw new Error('database offline'); };
        const failed = await recordAuditEvent({ guildId: 'guild-1', action: 'settings.update' });
        assert.equal(failed, false);
    } finally {
        AuditEvent.create = originalCreate;
    }
});

test('audit trail queries require a guild', async () => {
    assert.deepEqual(await getAuditTrail(''), []);
    assert.deepEqual(await getAuditTrail(null), []);
});
