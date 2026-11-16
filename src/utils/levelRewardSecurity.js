'use strict';

const { PermissionFlagsBits } = require('discord.js');

const DANGEROUS_ROLE_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ManageThreads,
    PermissionFlagsBits.ManageEvents,
    PermissionFlagsBits.ManageGuildExpressions,
    PermissionFlagsBits.ManageEmojisAndStickers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.MentionEveryone,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.DeafenMembers,
    PermissionFlagsBits.MoveMembers
].filter(flag => typeof flag === 'bigint' && flag !== 0n);

function hasPermission(target, permission) {
    return Boolean(target?.permissions?.has?.(permission));
}

function isDiscordSnowflake(value) {
    return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

function hasDangerousRolePermissions(role) {
    return DANGEROUS_ROLE_PERMISSIONS.some(permission => hasPermission(role, permission));
}

// Re-check at assignment time too, so legacy or manually inserted reward records
// cannot grant privileged roles after configuration validation is added.
function isSafeLevelRewardRole(role, botMember) {
    if (!role || role.managed || !botMember) return false;
    if (!hasPermission(botMember, PermissionFlagsBits.ManageRoles)) return false;

    const botHighest = botMember.roles?.highest;
    if (!botHighest || !Number.isFinite(role.position) || !Number.isFinite(botHighest.position)) return false;
    if (role.position >= botHighest.position) return false;

    return !hasDangerousRolePermissions(role);
}

function validateLevelRewardConfiguration({ guild, actor, botMember, rewards } = {}) {
    if (!Array.isArray(rewards)) {
        return { ok: false, status: 400, error: 'Level rewards must be an array.' };
    }
    // Clearing rewards only removes future grants and is safe for Manage Server admins.
    if (rewards.length === 0) return { ok: true };
    if (!guild || !actor || !botMember) {
        return { ok: false, status: 403, error: 'Could not verify the member and bot role hierarchy. Please retry.' };
    }

    const isGuildOwner = guild.ownerId === actor.id;
    const canManageRoles = hasPermission(actor, PermissionFlagsBits.ManageRoles) ||
        hasPermission(actor, PermissionFlagsBits.Administrator);
    if (!isGuildOwner && !canManageRoles) {
        return { ok: false, status: 403, error: 'Manage Roles permission is required to configure level reward roles.' };
    }
    if (!hasPermission(botMember, PermissionFlagsBits.ManageRoles)) {
        return { ok: false, status: 403, error: 'Starry needs Manage Roles permission before reward roles can be configured.' };
    }

    const seenLevels = new Set();
    for (const item of rewards) {
        const level = Number(item?.level);
        const roleId = typeof item?.roleId === 'string' ? item.roleId : '';
        if (!Number.isInteger(level) || level < 1 || level > 10000 ||
            !isDiscordSnowflake(roleId) || seenLevels.has(level)) {
            return { ok: false, status: 400, error: 'Each reward needs a unique level from 1 to 10000 and a valid Discord role ID.' };
        }
        seenLevels.add(level);

        const role = guild.roles?.cache?.get(roleId);
        if (!role || role.id === guild.id || role.managed) {
            return { ok: false, status: 400, error: 'Each reward must use an unmanaged role from this server.' };
        }
        if (!isSafeLevelRewardRole(role, botMember)) {
            return { ok: false, status: 400, error: 'Level reward roles must be below Starry’s highest role and cannot grant Administrator or server-management/moderation permissions.' };
        }

        const actorHighest = actor.roles?.highest;
        if (!isGuildOwner && (!actorHighest || !Number.isFinite(actorHighest.position) || role.position >= actorHighest.position)) {
            return { ok: false, status: 403, error: 'You can only configure reward roles below your highest role.' };
        }
    }

    return { ok: true };
}

module.exports = {
    isDiscordSnowflake,
    isSafeLevelRewardRole,
    validateLevelRewardConfiguration
};
