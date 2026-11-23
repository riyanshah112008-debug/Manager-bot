'use strict';

const { AuditLogEvent, PermissionsBitField } = require('discord.js');
const ServerSettings = require('../models/ServerSettings');
const config = require('../config');
const { shouldRespond } = require('../utils/antiNukePolicy');

const AUDIT_WINDOW_MS = 10_000;
const RESPONSE_COOLDOWN_MS = 60_000;
const auditBuckets = new Map();
const responseCooldowns = new Map();

const AUDIT_ACTIONS = new Map([
    [AuditLogEvent.ChannelDelete, 'channelDelete'],
    [AuditLogEvent.RoleDelete, 'roleDelete'],
    [AuditLogEvent.MemberBanAdd, 'memberBan'],
    [AuditLogEvent.MemberKick, 'memberKick'],
    [AuditLogEvent.WebhookCreate, 'webhookCreate']
]);

async function loadPolicy(guildId) {
    const settings = await ServerSettings.findOne({ guildId }).select('antinuke').lean();
    return settings?.antinuke || null;
}

function getRecentActionCount(guildId, executorId, actionKey, now = Date.now()) {
    const key = [guildId, executorId, actionKey].join(':');
    const recent = (auditBuckets.get(key) || []).filter(timestamp => now - timestamp <= AUDIT_WINDOW_MS);
    recent.push(now);
    auditBuckets.set(key, recent);
    return recent.length;
}

function isOwner(client, userId, guild) {
    if (guild?.ownerId === userId) return true;
    return typeof config.isBotOwner === 'function'
        ? config.isBotOwner(userId, client)
        : (config.BOT_OWNERS || []).includes(userId);
}

async function applyConfiguredResponse(guild, executor, policy, reason) {
    const action = policy.action || 'quarantine';
    const botMember = guild.members.me;
    if (!botMember) return false;

    if (action === 'timeout') {
        if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers) || !executor.moderatable) return false;
        await executor.timeout(10 * 60 * 1000, reason);
        return true;
    }
    if (action === 'kick') {
        if (!botMember.permissions.has(PermissionsBitField.Flags.KickMembers) || !executor.kickable) return false;
        await executor.kick(reason);
        return true;
    }
    if (action === 'ban') {
        if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers) || !executor.bannable) return false;
        await executor.ban({ reason });
        return true;
    }
    if (action === 'quarantine') {
        const roleId = String(policy.quarantineRoleId || '');
        const role = roleId ? guild.roles.cache.get(roleId) : null;
        if (!role || role.managed || role.id === guild.id) return false;
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) return false;
        if (role.position >= botMember.roles.highest.position || executor.roles.highest.position >= botMember.roles.highest.position) return false;
        await executor.roles.add(role, reason);
        return true;
    }
    return false;
}

async function handleAuditEntry(client, entry, guild) {
    if (!entry || !guild || !entry.executorId || entry.executorId === client.user?.id) return;
    const actionKey = AUDIT_ACTIONS.get(entry.action);
    if (!actionKey) return;

    let policy;
    try {
        policy = await loadPolicy(guild.id);
    } catch (error) {
        console.error('[AntiNuke] Could not load server policy; enforcement skipped:', error.message);
        return;
    }
    if (!policy?.enabled) return;
    if (actionKey === 'webhookCreate' && policy.blockWebhookCreation !== true) return;

    let executor;
    try {
        executor = await guild.members.fetch(entry.executorId);
    } catch (_) {
        return;
    }
    const roleIds = executor.roles.cache.map(role => role.id);
    const owner = isOwner(client, entry.executorId, guild);
    const count = actionKey === 'webhookCreate' ? 1 : getRecentActionCount(guild.id, entry.executorId, actionKey);
    if (!shouldRespond(policy, actionKey, count, owner, roleIds, entry.executorId)) return;

    const cooldownKey = guild.id + ':' + entry.executorId;
    const now = Date.now();
    if ((responseCooldowns.get(cooldownKey) || 0) > now) return;
    responseCooldowns.set(cooldownKey, now + RESPONSE_COOLDOWN_MS);

    const reason = 'Starry Anti-Nuke: ' + actionKey + ' protection threshold reached';
    try {
        const applied = await applyConfiguredResponse(guild, executor, policy, reason);
        if (!applied) {
            console.warn('[AntiNuke] Could not apply configured response; verify bot permissions, role hierarchy and quarantine role.');
        } else {
            console.warn('[AntiNuke] Applied ' + (policy.action || 'quarantine') + ' to executor ' + entry.executorId + ' in guild ' + guild.id);
        }
    } catch (error) {
        console.error('[AntiNuke] Enforcement action failed:', error.message);
    }
}

async function handleBotJoin(client, member) {
    if (!member?.guild || !member.user?.bot || member.user.id === client.user?.id) return;
    let policy;
    try {
        policy = await loadPolicy(member.guild.id);
    } catch (error) {
        console.error('[AntiNuke] Could not load bot-add policy:', error.message);
        return;
    }
    if (!policy?.enabled || policy.blockUnapprovedBots !== true) return;

    // Give Discord's audit log a brief moment to record the bot-add executor.
    await new Promise(resolve => setTimeout(resolve, 900));
    let entry;
    try {
        const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 });
        entry = logs.entries.find(item =>
            item.target?.id === member.id &&
            Date.now() - item.createdTimestamp < 15_000
        );
    } catch (_) {
        return;
    }
    if (!entry?.executorId) return;

    let inviter;
    try {
        inviter = await member.guild.members.fetch(entry.executorId);
    } catch (_) {
        return;
    }
    const roleIds = inviter.roles.cache.map(role => role.id);
    if (isOwner(client, inviter.id, member.guild) || policy.whitelistedUsers?.includes(inviter.id) ||
        roleIds.some(id => policy.whitelistedRoles?.includes(id))) return;

    try {
        if (member.kickable) {
            await member.kick('Starry Anti-Nuke: unapproved bot invitation');
        }
    } catch (error) {
        console.error('[AntiNuke] Could not remove unapproved bot:', error.message);
    }
    const cooldownKey = member.guild.id + ':' + inviter.id;
    if ((responseCooldowns.get(cooldownKey) || 0) > Date.now()) return;
    responseCooldowns.set(cooldownKey, Date.now() + RESPONSE_COOLDOWN_MS);
    try {
        await applyConfiguredResponse(
            member.guild,
            inviter,
            policy,
            'Starry Anti-Nuke: invited an unapproved bot'
        );
    } catch (error) {
        console.error('[AntiNuke] Bot inviter response failed:', error.message);
    }
}

module.exports = function initAntiNuke(client) {
    client.on('guildAuditLogEntryCreate', (entry, guild) => {
        handleAuditEntry(client, entry, guild).catch(error => {
            console.error('[AntiNuke] Audit event handler failed:', error.message);
        });
    });
    client.on('guildMemberAdd', member => {
        handleBotJoin(client, member).catch(error => {
            console.error('[AntiNuke] Bot join handler failed:', error.message);
        });
    });
};

module.exports.handleAuditEntry = handleAuditEntry;
module.exports.handleBotJoin = handleBotJoin;
module.exports.applyConfiguredResponse = applyConfiguredResponse;
