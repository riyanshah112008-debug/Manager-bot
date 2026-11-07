const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const ServerSettings = require('../models/ServerSettings');

const ACTION_WINDOW_MS = 10_000;
const AUDIT_MATCH_WINDOW_MS = 8_000;
const PUNISHMENT_COOLDOWN_MS = 60_000;
const recentActions = new Map();
const punishedUntil = new Map();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getAntiNukeSettings(guild) {
    const settings = await ServerSettings.findOne({ guildId: guild.id });
    const config = settings?.antinuke;
    if (!config || config.enabled !== true) return null;
    return config;
}

async function findExecutor(guild, auditType, targetId, channelId = null) {
    // Discord audit-log entries can arrive shortly after the gateway event.
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await delay(350);
        try {
            const logs = await guild.fetchAuditLogs({ type: auditType, limit: 6 });
            const now = Date.now();
            const entry = logs.entries.find(candidate => {
                const age = now - candidate.createdTimestamp;
                if (age < 0 || age > AUDIT_MATCH_WINDOW_MS) return false;
                if (auditType === AuditLogEvent.WebhookCreate) {
                    return String(candidate.extra?.channel?.id || '') === String(channelId || '');
                }
                return String(candidate.target?.id || '') === String(targetId || '');
            });
            if (entry?.executor) return entry.executor;
        } catch (error) {
            if (attempt === 2) {
                console.warn('[Anti-Nuke] Could not inspect audit logs for guild', guild.id, error.message);
            }
        }
    }
    return null;
}

async function isWhitelisted(guild, executor, settings) {
    if (!executor?.id || executor.id === guild.ownerId) return true;
    if ((settings.whitelistedUsers || []).map(String).includes(String(executor.id))) return true;

    const allowedRoles = new Set((settings.whitelistedRoles || []).map(String));
    if (!allowedRoles.size) return false;

    const member = await guild.members.fetch(executor.id).catch(() => null);
    return Boolean(member && member.roles.cache.some(role => allowedRoles.has(role.id)));
}

function recordAction(guildId, executorId, actionType) {
    const key = guildId + ':' + executorId;
    const now = Date.now();
    const actions = (recentActions.get(key) || []).filter(item => now - item.at <= ACTION_WINDOW_MS);
    actions.push({ type: actionType, at: now });
    recentActions.set(key, actions);
    return actions.filter(item => item.type === actionType).length;
}

async function punishExecutor(guild, executor, settings, reason) {
    const key = guild.id + ':' + executor.id;
    const now = Date.now();
    if ((punishedUntil.get(key) || 0) > now) return;
    punishedUntil.set(key, now + PUNISHMENT_COOLDOWN_MS);

    const member = await guild.members.fetch(executor.id).catch(() => null);
    if (!member || member.id === guild.ownerId || member.id === guild.client.user?.id) return;

    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ModerateMembers) &&
        !botMember?.permissions.has(PermissionFlagsBits.KickMembers) &&
        !botMember?.permissions.has(PermissionFlagsBits.BanMembers) &&
        !botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        console.warn('[Anti-Nuke] Bot lacks permissions to punish executor in guild', guild.id);
        return;
    }

    const requestedAction = String(settings.action || 'quarantine').toLowerCase();
    try {
        if (requestedAction === 'quarantine' && settings.quarantineRoleId) {
            const role = await guild.roles.fetch(settings.quarantineRoleId).catch(() => null);
            if (role && role.editable && member.manageable) {
                await member.roles.add(role, reason);
                console.warn('[Anti-Nuke] Quarantined executor', executor.id, 'in guild', guild.id);
                return;
            }
        }

        if ((requestedAction === 'timeout' || requestedAction === 'quarantine') && member.moderatable) {
            await member.timeout(10 * 60 * 1000, reason);
            console.warn('[Anti-Nuke] Timed out executor', executor.id, 'in guild', guild.id);
            return;
        }
        if (requestedAction === 'kick' && member.kickable) {
            await member.kick(reason);
            console.warn('[Anti-Nuke] Kicked executor', executor.id, 'from guild', guild.id);
            return;
        }
        if (requestedAction === 'ban' && member.bannable) {
            await member.ban({ reason });
            console.warn('[Anti-Nuke] Banned executor', executor.id, 'from guild', guild.id);
            return;
        }
        if (member.moderatable) {
            await member.timeout(10 * 60 * 1000, reason + ' (fallback timeout)');
            console.warn('[Anti-Nuke] Applied fallback timeout to executor', executor.id, 'in guild', guild.id);
            return;
        }
        console.warn('[Anti-Nuke] Could not punish executor due to role hierarchy or missing permissions:', executor.id, guild.id);
    } catch (error) {
        console.error('[Anti-Nuke] Punishment failed in guild', guild.id, error.message);
    }
}

async function handleSecurityEvent(guild, {
    auditType,
    actionType,
    targetId,
    channelId,
    limitKey,
    limitOverride,
    enabledKey,
    reason
}, client) {
    if (!guild) return;
    let settings;
    try {
        settings = await getAntiNukeSettings(guild);
    } catch (error) {
        console.error('[Anti-Nuke] Settings lookup failed for guild', guild.id, error.message);
        return;
    }
    if (!settings) return;
    if (enabledKey && settings[enabledKey] !== true) return;

    const executor = await findExecutor(guild, auditType, targetId, channelId);
    if (!executor || executor.id === client.user?.id) return;

    if (await isWhitelisted(guild, executor, settings)) return;

    const configuredLimit = Number(settings[limitKey]);
    const limit = Number.isFinite(limitOverride)
        ? limitOverride
        : (Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 3);
    const count = recordAction(guild.id, executor.id, actionType);
    if (count < limit) return;

    await punishExecutor(
        guild,
        executor,
        settings,
        reason + ' Threshold reached (' + count + ' events in ' + (ACTION_WINDOW_MS / 1000) + ' seconds).'
    );
}

module.exports = client => {
    console.log('[Anti-Nuke] Audit-log enforcement engine initialized.');

    client.on('channelDelete', channel => {
        handleSecurityEvent(channel.guild, {
            auditType: AuditLogEvent.ChannelDelete,
            actionType: 'channelDelete',
            targetId: channel.id,
            limitKey: 'maxChannelDeletions',
            reason: 'Anti-Nuke: excessive channel deletions.'
        }, client).catch(error => console.error('[Anti-Nuke] Channel-delete handler failed:', error));
    });

    client.on('roleDelete', role => {
        handleSecurityEvent(role.guild, {
            auditType: AuditLogEvent.RoleDelete,
            actionType: 'roleDelete',
            targetId: role.id,
            limitKey: 'maxRoleDeletions',
            reason: 'Anti-Nuke: excessive role deletions.'
        }, client).catch(error => console.error('[Anti-Nuke] Role-delete handler failed:', error));
    });

    client.on('guildBanAdd', ban => {
        handleSecurityEvent(ban.guild, {
            auditType: AuditLogEvent.MemberBanAdd,
            actionType: 'memberBan',
            targetId: ban.user.id,
            limitKey: 'maxBans',
            reason: 'Anti-Nuke: excessive member bans.'
        }, client).catch(error => console.error('[Anti-Nuke] Ban handler failed:', error));
    });

    client.on('guildMemberRemove', member => {
        handleSecurityEvent(member.guild, {
            auditType: AuditLogEvent.MemberKick,
            actionType: 'memberKick',
            targetId: member.id,
            limitKey: 'maxKicks',
            reason: 'Anti-Nuke: excessive member kicks.'
        }, client).catch(error => console.error('[Anti-Nuke] Kick handler failed:', error));
    });

    client.on('webhooksUpdate', channel => {
        handleSecurityEvent(channel.guild, {
            auditType: AuditLogEvent.WebhookCreate,
            actionType: 'webhookCreate',
            channelId: channel.id,
            limitKey: 'maxWebhookCreations',
            limitOverride: 1,
            enabledKey: 'blockWebhookCreation',
            reason: 'Anti-Nuke: unapproved webhook creation.'
        }, client).catch(error => console.error('[Anti-Nuke] Webhook handler failed:', error));
    });

    client.on('guildMemberAdd', async member => {
        if (!member.user?.bot) return;
        try {
            const settings = await getAntiNukeSettings(member.guild);
            if (!settings || settings.blockUnapprovedBots !== true) return;
            const executor = await findExecutor(member.guild, AuditLogEvent.BotAdd, member.id);
            if (!executor || executor.id === client.user?.id) return;
            if (await isWhitelisted(member.guild, executor, settings)) return;

            const reason = 'Anti-Nuke: bot added by a non-whitelisted administrator.';
            if (member.kickable) {
                await member.kick(reason).catch(error => {
                    console.warn('[Anti-Nuke] Could not remove unapproved bot', member.id, error.message);
                });
            } else {
                console.warn('[Anti-Nuke] Unapproved bot could not be removed due to role hierarchy:', member.id);
            }
            await punishExecutor(member.guild, executor, settings, reason);
        } catch (error) {
            console.error('[Anti-Nuke] Bot-add handler failed:', error.message);
        }
    });
};
