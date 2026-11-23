'use strict';

const ACTION_LIMITS = Object.freeze({
    channelDelete: 'maxChannelDeletions',
    roleDelete: 'maxRoleDeletions',
    ban: 'maxBans',
    kick: 'maxKicks'
});

function getActionThreshold(policy, action) {
    const key = ACTION_LIMITS[action];
    if (!key || !policy) return null;
    const value = Number(policy[key]);
    if (!Number.isInteger(value) || value < 1 || value > 50) return null;
    return value;
}

function isWhitelisted(executorId, roleIds = [], policy = {}) {
    if (!executorId) return true;
    const users = Array.isArray(policy.whitelistedUsers) ? policy.whitelistedUsers : [];
    const roles = Array.isArray(policy.whitelistedRoles) ? policy.whitelistedRoles : [];
    if (users.includes(String(executorId))) return true;
    return Array.isArray(roleIds) && roleIds.some(roleId => roles.includes(String(roleId)));
}

function isRecentAuditEntry(entry, targetId, now = Date.now(), maxAgeMs = 15000) {
    if (!entry || !entry.target || String(entry.target.id) !== String(targetId)) return false;
    const created = Number(entry.createdTimestamp || entry.createdAt?.getTime?.() || 0);
    return created > 0 && now >= created && now - created <= maxAgeMs;
}

module.exports = { ACTION_LIMITS, getActionThreshold, isWhitelisted, isRecentAuditEntry };
