'use strict';

const ServerSettings = require('../models/ServerSettings');
const { resolveNotificationTarget } = require('./guildNotificationPolicy');

async function notifyGuild(client, guildId, type, payload = {}) {
    const settings = await ServerSettings.findOne({ guildId }).select('notifications').lean();
    const target = resolveNotificationTarget(settings?.notifications, type);
    if (!target) return false;

    const guild = client?.guilds?.cache?.get(String(guildId));
    const channel = guild?.channels?.cache?.get(target.channelId);
    if (!channel || !channel.isTextBased?.() || typeof channel.send !== 'function') return false;

    const contentParts = [];
    if (type === 'securityAlert' && target.staffRoleId) contentParts.push('<@&' + target.staffRoleId + '>');
    if (typeof payload.content === 'string' && payload.content.trim()) {
        contentParts.push(payload.content.trim().slice(0, 1800));
    }
    const embeds = Array.isArray(payload.embeds) ? payload.embeds.slice(0, 3) : [];
    if (!contentParts.length && !embeds.length) return false;

    await channel.send({
        content: contentParts.join(' '),
        embeds,
        allowedMentions: {
            parse: [],
            roles: type === 'securityAlert' && target.staffRoleId ? [target.staffRoleId] : [],
            users: []
        }
    });
    return true;
}

module.exports = { notifyGuild };
