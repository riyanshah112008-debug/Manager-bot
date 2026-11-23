'use strict';

const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const ServerSettings = require('../models/ServerSettings');

const WINDOW_MS = 10_000;
const counters = new Map();
const punished = new Map();

function thresholdFor(policy, action) {
    if (policy.panicLockdown) return 1;
    if (action === AuditLogEvent.ChannelDelete) return policy.maxChannelDeletions || 3;
    if (action === AuditLogEvent.RoleDelete) return policy.maxRoleDeletions || 3;
    if (action === AuditLogEvent.MemberBanAdd) return policy.maxBans || 3;
    if (action === AuditLogEvent.MemberKick) return policy.maxKicks || 3;
    if (action === AuditLogEvent.WebhookCreate && policy.blockWebhookCreation) return 1;
    return Number.POSITIVE_INFINITY;
}

function isWhitelisted(member, policy) {
    if (!member) return false;
    const users = Array.isArray(policy.whitelistedUsers) ? policy.whitelistedUsers : [];
    const roles = Array.isArray(policy.whitelistedRoles) ? policy.whitelistedRoles : [];
    return users.includes(member.id) || member.roles.cache.some(role => roles.includes(role.id));
}

async function writeSecurityLog(client, guild, content) {
    try {
        const channel = await client.getLogChannel?.(guild, 'moderate');
        if (channel?.isTextBased() && typeof channel.send === 'function') {
            await channel.send({ content, allowedMentions: { parse: [], users: [] } });
        }
    } catch (_) {}
}

async function enforce(client, guild, executorId, policy, reason) {
    if (!executorId || executorId === client.user?.id || executorId === guild.ownerId) return;
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member || isWhitelisted(member, policy)) return;
    const botMember = guild.members.me || await guild.members.fetch(client.user.id).catch(() => null);
    if (!botMember || member.roles.highest.position >= botMember.roles.highest.position) return;

    const action = policy.action || 'quarantine';
    try {
        if (action === 'quarantine') {
            const role = policy.quarantineRoleId ? guild.roles.cache.get(policy.quarantineRoleId) : null;
            if (!role || role.managed || role.position >= botMember.roles.highest.position ||
                !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                await writeSecurityLog(client, guild, '⚠️ Anti-Nuke detected suspicious activity, but could not quarantine the executor because the configured role or bot permissions are invalid.');
                return;
            }
            await member.roles.add(role, reason);
        } else if (action === 'timeout') {
            if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) return;
            await member.timeout(10 * 60 * 1000, reason);
        } else if (action === 'kick') {
            if (!botMember.permissions.has(PermissionFlagsBits.KickMembers)) return;
            await member.kick(reason);
        } else if (action === 'ban') {
            if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) return;
            await member.ban({ reason, deleteMessageSeconds: 0 });
        }
        await writeSecurityLog(client, guild, '🛡️ Anti-Nuke response: <@' + member.id + '> was ' + action + 'ed after suspicious server activity.');
    } catch (error) {
        console.error('[Anti-Nuke] Enforcement failed:', error.message);
        await writeSecurityLog(client, guild, '⚠️ Anti-Nuke detected suspicious activity but enforcement failed. Check Starry permissions and role hierarchy.');
    }
}

module.exports = function setupAntiNukeEngine(client) {
    if (client.antiNukeEngineInitialized) return;
    client.antiNukeEngineInitialized = true;
    client.antiNukeReady = true;

    client.on('guildAuditLogEntryCreate', async (entry, guild) => {
        try {
            if (!guild || !entry?.executorId) return;
            const settings = await ServerSettings.findOne({ guildId: guild.id }).select('antinuke').lean();
            const policy = settings?.antinuke;
            if (!policy?.enabled) return;

            const action = entry.action;
            const supported = [
                AuditLogEvent.ChannelDelete,
                AuditLogEvent.RoleDelete,
                AuditLogEvent.MemberBanAdd,
                AuditLogEvent.MemberKick,
                AuditLogEvent.WebhookCreate
            ];
            if (!supported.includes(action)) return;
            if (action === AuditLogEvent.WebhookCreate && !policy.blockWebhookCreation) return;

            const botMember = guild.members.me;
            if (!botMember?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
                await writeSecurityLog(client, guild, '⚠️ Anti-Nuke is configured but Starry is missing View Audit Log permission.');
                return;
            }

            if (action === AuditLogEvent.WebhookCreate && policy.blockWebhookCreation) {
                const webhookId = entry.targetId;
                if (webhookId && botMember.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
                    const webhooks = await guild.fetchWebhooks().catch(() => null);
                    const webhook = webhooks?.get(webhookId);
                    if (webhook) await webhook.delete('Starry Anti-Nuke: webhook creation blocked').catch(() => {});
                }
            }

            const key = guild.id + ':' + entry.executorId + ':' + action;
            const now = Date.now();
            let bucket = counters.get(key);
            if (!bucket || now - bucket.startedAt > WINDOW_MS) bucket = { startedAt: now, count: 0 };
            bucket.count += 1;
            counters.set(key, bucket);
            if (bucket.count < thresholdFor(policy, action)) return;

            const penaltyKey = key + ':' + Math.floor(now / WINDOW_MS);
            if (punished.has(penaltyKey)) return;
            punished.set(penaltyKey, now);
            for (const [storedKey, timestamp] of counters) if (now - timestamp.startedAt > WINDOW_MS * 2) counters.delete(storedKey);
            for (const [storedKey, timestamp] of punished) if (now - timestamp > WINDOW_MS * 2) punished.delete(storedKey);

            await enforce(client, guild, entry.executorId, policy,
                'Starry Anti-Nuke: suspicious audit activity reached the configured threshold (' + bucket.count + ').');
        } catch (error) {
            console.error('[Anti-Nuke] Audit event handler failed:', error.message);
        }
    });

    client.on('guildMemberAdd', async member => {
        try {
            if (!member?.user?.bot || member.id === client.user?.id) return;
            const settings = await ServerSettings.findOne({ guildId: member.guild.id }).select('antinuke').lean();
            const policy = settings?.antinuke;
            if (!policy?.enabled || !policy.blockUnapprovedBots) return;
            if (isWhitelisted(member, policy)) return;
            const botMember = member.guild.members.me;
            if (!botMember?.permissions.has(PermissionFlagsBits.KickMembers) ||
                member.roles.highest.position >= botMember.roles.highest.position) {
                await writeSecurityLog(client, member.guild, '⚠️ An unapproved bot joined, but Starry could not remove it. Check Kick Members permission and role hierarchy.');
                return;
            }
            await member.kick('Starry Anti-Nuke: bot is not on the trusted bot whitelist');
            await writeSecurityLog(client, member.guild, '🛡️ Starry removed an unapproved bot account: ' + member.user.tag + '.');
        } catch (error) {
            console.error('[Anti-Nuke] Unapproved bot guard failed:', error.message);
        }
    });
};
