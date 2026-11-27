// ==========================================
// 🛡️ STARRY AUDIT TRAIL UTIL
// File Path: src/utils/auditTrail.js
// Records structured dashboard configuration changes. Never throws and never stores secrets.
// ==========================================
const AuditEvent = require('../models/AuditEvent');

const SENSITIVE_KEY_PATTERN = /(token|secret|password|passwd|authorization|cookie|session|credential|key)/i;
const MAX_SUMMARY_LENGTH = 500;
const MAX_METADATA_KEYS = 24;

const redactValue = (value) => {
    if (typeof value === 'string') return value.length > 200 ? value.slice(0, 200) + '…' : value;
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') return Array.isArray(value) ? `[${value.length} items]` : '[object]';
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    return String(value).slice(0, 200);
};

const sanitizeChanges = (changes) => {
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
    const clean = {};
    let kept = 0;
    for (const [key, value] of Object.entries(changes)) {
        if (kept >= MAX_METADATA_KEYS) { clean.__truncated = true; break; }
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            clean[key] = '[redacted]';
            kept += 1;
            continue;
        }
        clean[key] = redactValue(value);
        kept += 1;
    }
    return Object.keys(clean).length ? clean : null;
};

const normalizeActor = (actor) => {
    if (!actor || typeof actor !== 'object') return { actorId: null, actorTag: null };
    const id = actor.id ? String(actor.id) : null;
    const tag = actor.tag ? String(actor.tag).slice(0, 120) : (actor.username ? String(actor.username).slice(0, 120) : null);
    return { actorId: id, actorTag: tag };
};

const normalizeIp = (req) => {
    if (!req || typeof req !== 'object') return null;
    const forwarded = req.headers && req.headers['x-forwarded-for'];
    const raw = typeof forwarded === 'string' && forwarded.length
        ? forwarded.split(',')[0].trim()
        : (req.ip || req.socket?.remoteAddress || null);
    return raw ? String(raw).slice(0, 64) : null;
};

async function recordAuditEvent(event) {
    try {
        const options = event || {};
        if (!options.guildId || !options.action) return false;
        const actor = normalizeActor(options.actor);
        const summary = options.summary ? String(options.summary).slice(0, MAX_SUMMARY_LENGTH) : null;
        await AuditEvent.create({
            guildId: String(options.guildId),
            actorId: actor.actorId,
            actorTag: actor.actorTag,
            action: String(options.action).slice(0, 120),
            targetType: options.targetType ? String(options.targetType).slice(0, 60) : null,
            targetId: options.targetId ? String(options.targetId).slice(0, 120) : null,
            summary,
            changes: sanitizeChanges(options.changes),
            success: options.success !== false,
            source: options.source ? String(options.source).slice(0, 40) : 'dashboard',
            ip: normalizeIp(options.req)
        });
        return true;
    } catch (error) {
        console.warn('Audit trail write deferred:', error.message);
        return false;
    }
}

async function getAuditTrail(guildId, options = {}) {
    if (!guildId) return [];
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const query = { guildId: String(guildId) };
    if (options.action) query.action = String(options.action).slice(0, 120);
    if (options.actorId) query.actorId = String(options.actorId).slice(0, 120);
    return AuditEvent.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
    recordAuditEvent,
    getAuditTrail,
    sanitizeChanges,
    SENSITIVE_KEY_PATTERN
};
