// ==========================================
// 🛡️ STARRY AUDIT TRAIL UTIL
// File Path: src/utils/auditTrail.js
// Records structured dashboard configuration changes. Never throws and never stores secrets
// or full Discord profiles — actor data is reduced to a strict whitelist before persisting.
// ==========================================
const AuditEvent = require('../models/AuditEvent');

const SENSITIVE_KEY_PATTERN = /(token|secret|password|passwd|authorization|cookie|session|credential|key)/i;
const MAX_SUMMARY_LENGTH = 500;
const MAX_METADATA_KEYS = 24;
const MAX_TEXT_LENGTH = 200;
const MAX_NESTED_DEPTH = 3;
const MAX_ARRAY_ENTRIES = 12;
const DISCORD_AVATAR_BASE = 'https://cdn.discordapp.com/avatars/';

const emptyActor = () => ({ actorId: null, actorUsername: null, actorGlobalName: null, actorAvatar: null });

const buildAvatarUrl = (actorId, avatar) => {
    if (!avatar || typeof avatar !== 'string') return null;
    if (/^https?:\/\//i.test(avatar)) return avatar.slice(0, 500);
    if (!/^[a-zA-Z0-9_-]+$/.test(avatar) || !actorId) return null;
    const extension = avatar.startsWith('a_') ? 'gif' : 'png';
    return `${DISCORD_AVATAR_BASE}${actorId}/${avatar}.${extension}?size=64`;
};

// Persist only whitelisted identity fields; drop everything else (email, discriminator, flags, tokens...).
const normalizeActor = (actor) => {
    if (!actor || typeof actor !== 'object') return emptyActor();
    const actorId = actor.id ? String(actor.id) : null;
    const clip = (value) => (value ? String(value).slice(0, MAX_TEXT_LENGTH) : null);
    return {
        actorId,
        actorUsername: clip(actor.username),
        actorGlobalName: clip(actor.globalName || actor.global_name || actor.displayName),
        actorAvatar: buildAvatarUrl(actorId, actor.avatar)
    };
};

const redactValue = (value, depth = 0, seen = new WeakSet()) => {
    if (typeof value === 'string') return value.length > MAX_TEXT_LENGTH ? value.slice(0, MAX_TEXT_LENGTH) + '…' : value;
    if (value === null || value === undefined) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value !== 'object') return String(value).slice(0, MAX_TEXT_LENGTH);
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (depth >= MAX_NESTED_DEPTH) return '[max depth]';
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (Array.isArray(value)) {
        const items = value.slice(0, MAX_ARRAY_ENTRIES).map(item => redactValue(item, depth + 1, seen));
        if (value.length > MAX_ARRAY_ENTRIES) items.push('[truncated]');
        seen.delete(value);
        return items;
    }
    const clean = {};
    let kept = 0;
    for (const [key, nested] of Object.entries(value)) {
        if (kept >= MAX_METADATA_KEYS) { clean.__truncated = true; break; }
        clean[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redactValue(nested, depth + 1, seen);
        kept += 1;
    }
    seen.delete(value);
    return clean;
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

const normalizeIp = (req) => {
    if (!req || typeof req !== 'object') return null;
    const raw = req.ip || req.socket?.remoteAddress || null;
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
            ...actor,
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
    normalizeActor,
    SENSITIVE_KEY_PATTERN,
    normalizeIp
};
