'use strict';

const NOTIFICATION_KEYS = Object.freeze([
    'memberJoins', 'memberLeaves', 'giveawayResults', 'securityAlerts'
]);

function validateGuildNotifications(payload, guild) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { valid: false, error: 'Notification settings must be an object.' };
    }
    const allowed = new Set([
        'enabled', ...NOTIFICATION_KEYS,
        'memberChannelId', 'staffChannelId', 'giveawayChannelId', 'staffRoleId'
    ]);
    if (Object.keys(payload).some(key => !allowed.has(key))) {
        return { valid: false, error: 'Unknown notification setting.' };
    }
    for (const key of ['enabled', ...NOTIFICATION_KEYS]) {
        if (payload[key] !== undefined && typeof payload[key] !== 'boolean') {
            return { valid: false, error: key + ' must be true or false.' };
        }
    }
    for (const key of ['memberChannelId', 'staffChannelId', 'giveawayChannelId']) {
        if (payload[key] !== undefined) {
            if (typeof payload[key] !== 'string') return { valid: false, error: key + ' must be a channel ID.' };
            if (payload[key]) {
                const channel = guild?.channels?.cache?.get(payload[key]);
                if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
                    return { valid: false, error: 'Choose a text channel from this server for ' + key + '.' };
                }
            }
        }
    }
    if (payload.staffRoleId !== undefined) {
        if (typeof payload.staffRoleId !== 'string') return { valid: false, error: 'Staff role must be a role ID.' };
        if (payload.staffRoleId) {
            const role = guild?.roles?.cache?.get(payload.staffRoleId);
            if (!role || role.managed || role.id === guild.id) {
                return { valid: false, error: 'Choose a regular staff role from this server.' };
            }
        }
    }
    return { valid: true };
}

function resolveNotificationTarget(settings, type) {
    if (!settings || settings.enabled === false) return null;
    const enabledKey = {
        memberJoin: 'memberJoins',
        memberLeave: 'memberLeaves',
        giveawayResult: 'giveawayResults',
        securityAlert: 'securityAlerts'
    }[type];
    if (!enabledKey || settings[enabledKey] !== true) return null;
    const channelKey = type === 'memberJoin' || type === 'memberLeave'
        ? 'memberChannelId'
        : type === 'giveawayResult' ? 'giveawayChannelId' : 'staffChannelId';
    const channelId = settings[channelKey];
    if (typeof channelId !== 'string' || !channelId) return null;
    return {
        channelId,
        staffRoleId: type === 'securityAlert' ? String(settings.staffRoleId || '') : ''
    };
}

module.exports = { NOTIFICATION_KEYS, validateGuildNotifications, resolveNotificationTarget };
