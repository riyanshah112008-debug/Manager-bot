// ==========================================
// 🛡️ STARRY AUDIT EVENT MODEL
// File Path: src/models/AuditEvent.js
// Structured trail of who changed what, when, and how — separate from Discord event/moderation logs.
// Actor data is a strict whitelist: never persist a full Discord profile.
// ==========================================
const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    actorId: { type: String, default: null },
    actorUsername: { type: String, default: null },
    actorGlobalName: { type: String, default: null },
    actorAvatar: { type: String, default: null },
    action: { type: String, required: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    summary: { type: String, default: null },
    changes: { type: mongoose.Schema.Types.Mixed, default: null },
    success: { type: Boolean, default: true },
    source: { type: String, default: 'dashboard' },
    ip: { type: String, default: null }
}, { timestamps: true });

auditEventSchema.index({ guildId: 1, createdAt: -1 });
// Retention: audit entries age out automatically instead of growing forever.
auditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.models.AuditEvent || mongoose.model('AuditEvent', auditEventSchema);
