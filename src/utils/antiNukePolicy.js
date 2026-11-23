'use strict';

const AUDIT_LIMITS = Object.freeze({
    channelDelete: 'maxChannelDeletions',
    roleDelete: 'maxRoleDeletions',
    memberBan: 'maxBans',
    memberKick: 'maxKicks'
});

function isWhitelisted(policy, userId, roleIds = []) {
    if (!policy || !userId) return false;
    const users = Array.isArray(policy.whitelistedUsers) ? policy.whitelistedUsers : [];
    const roles = Array.isArray(policy.whitelistedRoles) ? policy.whitelistedRoles : [];
    return users.includes(String(userId)) || roleIds.some(roleId => roles.includes(String(roleId)));
}

function getActionLimit(policy, actionKey) {
    const field = AUDIT_LIMITS[actionKey];
    if (!field || !policy) return null;
    const value = Number(policy[field]);
    return Number.isInteger(value) && value >= 1 && value <= 50 ? value : null;
}

function shouldRespond(policy, actionKey, actionCount, actorIsOwner = false, roleIds = [], actorId = '') {
    if (!policy || policy.enabled !== true || actorIsOwner || isWhitelisted(policy, actorId, roleIds)) return false;
    if (actionKey === 'webhookCreate') return policy.blockWebhookCreation === true;
    const limit = getActionLimit(policy, actionKey);
    return Boolean(limit && Number.isInteger(actionCount) && actionCount >= limit);
}

module.exports = { AUDIT_LIMITS, isWhitelisted, getActionLimit, shouldRespond };
