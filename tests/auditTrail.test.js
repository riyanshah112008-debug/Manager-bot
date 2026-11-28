'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const AuditEvent = require('../src/models/AuditEvent');
const { recordAuditEvent, getAuditTrail, sanitizeChanges, normalizeActor, normalizeIp } = require('../src/utils/auditTrail');

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
    assert.deepEqual(clean.nested, { deep: true });
    assert.deepEqual(clean.list, [1, 2, 3]);
});

test('audit metadata handles empty and invalid payloads', () => {
    assert.equal(sanitizeChanges(null), null);
    assert.equal(sanitizeChanges('text'), null);
    assert.equal(sanitizeChanges([]), null);
    assert.deepEqual(sanitizeChanges({}), null);
});

test('actor data is reduced to a whitelisted identity before persisting', () => {
    const actor = normalizeActor({
        id: 'user-1',
        username: 'owner',
        globalName: 'Owner Name',
        discriminator: '1234',
        avatar: 'a_1a2b3c4d5e6f7g8h',
        email: 'secret@example.com',
        mfa_enabled: true,
        flags: 4242
    });
    assert.deepEqual(Object.keys(actor).sort(), ['actorAvatar', 'actorGlobalName', 'actorId', 'actorUsername']);
    assert.equal(actor.actorId, 'user-1');
    assert.equal(actor.actorUsername, 'owner');
    assert.equal(actor.actorGlobalName, 'Owner Name');
    assert.equal(actor.actorAvatar, 'https://cdn.discordapp.com/avatars/user-1/a_1a2b3c4d5e6f7g8h.gif?size=64');
    assert.equal(JSON.stringify(actor).includes('secret@example.com'), false);
    assert.equal(JSON.stringify(actor).includes('1234'), false);
    assert.deepEqual(normalizeActor(null), { actorId: null, actorUsername: null, actorGlobalName: null, actorAvatar: null });
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
            actor: { id: 'user-1', username: 'owner', globalName: 'Owner Name', email: 'secret@example.com' },
            action: 'welcome.update',
            targetType: 'channel',
            targetId: 'channel-1',
            summary: 'Updated welcome settings',
            changes: { token: 'leak', color: '#FFF' },
            req: { ip: '10.0.0.1', headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' } }
        });
        assert.equal(ok, true);
        assert.equal(captured.length, 1);
        const entry = captured[0];
        assert.equal(entry.guildId, 'guild-1');
        assert.equal(entry.actorId, 'user-1');
        assert.equal(entry.actorUsername, 'owner');
        assert.equal(entry.actorGlobalName, 'Owner Name');
        assert.equal(entry.email, undefined);
        assert.equal(JSON.stringify(entry).includes('secret@example.com'), false);
        assert.equal(entry.changes.token, '[redacted]');
        assert.equal(entry.changes.color, '#FFF');
        assert.equal(entry.ip, '10.0.0.1');
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

test('nested audit values are retained within limits and redact secrets recursively', () => {
    const clean = sanitizeChanges({
        logging: { enabled: true, channelId: 'channel-1', webhookToken: 'never-store', filters: ['join', 'leave'] },
        rewards: [{ level: 5, roleId: 'role-1' }, { level: 10, roleId: 'role-2' }],
        oversized: Array.from({ length: 20 }, (_, index) => index)
    });
    assert.deepEqual(clean.logging, {
        enabled: true,
        channelId: 'channel-1',
        webhookToken: '[redacted]',
        filters: ['join', 'leave']
    });
    assert.deepEqual(clean.rewards, [{ level: 5, roleId: 'role-1' }, { level: 10, roleId: 'role-2' }]);
    assert.equal(clean.oversized.length, 13);
    assert.equal(clean.oversized[12], '[truncated]');
});

test('audit client IP ignores spoofable forwarded headers and uses trusted req.ip', () => {
    assert.equal(normalizeIp({ ip: '10.0.0.2', headers: { 'x-forwarded-for': '198.51.100.99, 10.0.0.2' } }), '10.0.0.2');
    assert.equal(normalizeIp({ headers: { 'x-forwarded-for': '198.51.100.99' }, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
});
