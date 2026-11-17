'use strict';

const { PermissionFlagsBits } = require('discord.js');

function isSfwTextChannel(channel) {
    return Boolean(
        channel &&
        typeof channel.isTextBased === 'function' &&
        channel.isTextBased() &&
        channel.nsfw !== true
    );
}

function hasChannelReadAccess(channel, member) {
    if (!isSfwTextChannel(channel) || !member || typeof channel.permissionsFor !== 'function') {
        return false;
    }

    try {
        const permissions = channel.permissionsFor(member);
        return Boolean(
            permissions &&
            permissions.has(PermissionFlagsBits.ViewChannel) &&
            permissions.has(PermissionFlagsBits.ReadMessageHistory)
        );
    } catch (_) {
        return false;
    }
}

function canPublishCrossChannelSummary({ isPublic, targetChannelId, outputChannelId, memberPermissions }) {
    if (!isPublic || String(targetChannelId) === String(outputChannelId)) return true;
    if (!memberPermissions || typeof memberPermissions.has !== 'function') return false;

    return Boolean(
        memberPermissions.has(PermissionFlagsBits.ManageGuild) ||
        memberPermissions.has(PermissionFlagsBits.Administrator)
    );
}

module.exports = {
    isSfwTextChannel,
    hasChannelReadAccess,
    canPublishCrossChannelSummary
};
