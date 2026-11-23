'use strict';

const {
    Events,
    AuditLogEvent,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const ServerSettings = require('../models/ServerSettings');
const config = require('../config');
const { getActionThreshold, isWhitelisted, isRecentAuditEntry } = require('../utils/antiNukePolicy');
const { notifyGuild } = require('../utils/guildNotifications');

const WINDOW_MS = 10000;
const auditCounts = new Map();

async function getPolicy(guildId) {
    if (!guildId) return null;
    const row = await ServerSettings.findOne({ guildId }).select('antinuke').lean();
    return row?.antinuke || null;
}

async function findAuditEntry(guild, type, targetId) {
    try {
        const logs = await guild.fetchAuditLogs({ type, limit: 6 });
        const now = Date.now();
        return logs.entries.find(entry => isRecentAuditEntry(entry, targetId, now)) || null;
    } catch (error) {
        console.warn('[AntiNuke] Audit log lookup failed:', error.message);
        return null;
    }
}

async function isTrustedExecutor(guild, executorId, policy) {
    if (!executorId || executorId === guild.ownerId || config.isBotOwner(executorId)) return true;
    const member = await guild.members.fetch(executorId).catch(() => null);
    return isWhitelisted(executorId, member?.roles?.cache?.map(role => role.id) || [], policy);
}

function recordAction(guildId, executorId, action, now = Date.now()) {
    const key = [guildId, executorId, action].join(':');
    const current = (auditCounts.get(key) || []).filter(timestamp => now - timestamp <= WINDOW_MS);
    current.push(now);
    auditCounts.set(key, current);
    return current.length;
}

async function executeResponse(guild, executorId, policy, reason) {
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const actor = await guild.members.fetch(executorId).catch(() => null);
    if (!botMember || !actor || actor.id === guild.ownerId || actor.id === botMember.id) return false;
    if (actor.roles.highest.position >= botMember.roles.highest.position) return false;

    const action = ['quarantine', 'timeout', 'kick', 'ban'].includes(policy.action) ? policy.action : 'timeout';
    try {
        if (action === 'quarantine') {
            const role = guild.roles.cache.get(policy.quarantineRoleId || '');
            if (role && role.editable && role.position < botMember.roles.highest.position && role.position < actor.roles.highest.position) {
                await actor.roles.add(role, reason);
                return true;
            }
            if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers) || !actor.moderatable) return false;
            await actor.timeout(60 * 60 * 1000, reason + ' (quarantine role unavailable; timeout fallback)');
            return true;
        }
        if (action === 'timeout') {
            if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers) || !actor.moderatable) return false;
            await actor.timeout(60 * 60 * 1000, reason);
            return true;
        }
        if (action === 'kick') {
            if (!botMember.permissions.has(PermissionFlagsBits.KickMembers) || !actor.kickable) return false;
            await actor.kick(reason);
            return true;
        }
        if (action === 'ban') {
            if (!botMember.permissions.has(PermissionFlagsBits.BanMembers) || !actor.bannable) return false;
            await guild.members.ban(executorId, { reason });
            return true;
        }
    } catch (error) {
        console.warn('[AntiNuke] Response action failed:', error.message);
    }
    return false;
}

async function handleDestructiveEvent(guild, type, targetId, action) {
    let policy;
    try {
        policy = await getPolicy(guild.id);
    } catch (error) {
        console.warn('[AntiNuke] Policy lookup failed; no punitive action taken:', error.message);
        return;
    }
    if (!policy || policy.enabled !== true) return;

    const threshold = getActionThreshold(policy, action);
    if (!threshold) return;
    const entry = await findAuditEntry(guild, type, targetId);
    const executorId = entry?.executor?.id;
    if (!executorId || await isTrustedExecutor(guild, executorId, policy)) return;

    const actor = await guild.members.fetch(executorId).catch(() => null);
    const roleIds = actor?.roles?.cache?.map(role => role.id) || [];
    if (isWhitelisted(executorId, roleIds, policy)) return;

    const count = recordAction(guild.id, executorId, action);
    if (count < threshold) return;

    const reason = 'Starry Anti-Nuke: ' + count + ' suspicious ' + action + ' events within ' + (WINDOW_MS / 1000) + ' seconds.';
    const punished = await executeResponse(guild, executorId, policy, reason);
    const embed = new EmbedBuilder()
        .setColor(punished ? '#ED4245' : '#F1C40F')
        .setTitle(punished ? 'Starry Anti-Nuke Response Executed' : 'Starry Anti-Nuke Alert')
        .setDescription([
            '**Actor:** <@' + executorId + '>',
            '**Detected activity:** ' + action,
            '**Threshold:** ' + threshold,
            '**Recent events:** ' + count,
            '**Response:** ' + (punished ? policy.action : 'No action completed; check bot permissions and role hierarchy.')
        ].join('\n'))
        .setTimestamp();
    await notifyGuild(guild.client, guild.id, 'securityAlert', { embeds: [embed] }).catch(() => {});
    auditCounts.set([guild.id, executorId, action].join(':'), []);
}

async function handleBotJoin(member) {
    if (!member.user?.bot) return;
    let policy;
    try { policy = await getPolicy(member.guild.id); } catch (_) { return; }
    if (!policy || policy.enabled !== true || policy.blockUnapprovedBots !== true) return;

    const entry = await findAuditEntry(member.guild, AuditLogEvent.BotAdd, member.id);
    const executorId = entry?.executor?.id;
    const allowedIds = Array.isArray(policy.whitelistedUsers) ? policy.whitelistedUsers : [];
    if (member.id === member.guild.client.user.id || allowedIds.includes(member.id)) return;
    if (!executorId || executorId === member.guild.ownerId || config.isBotOwner(executorId) || allowedIds.includes(executorId)) return;

    const executor = await member.guild.members.fetch(executorId).catch(() => null);
    if (isWhitelisted(executorId, executor?.roles?.cache?.map(role => role.id) || [], policy)) return;
    if (!member.kickable) return;

    await member.kick('Starry Anti-Nuke: bot additions are restricted to trusted administrators.').catch(() => {});
    const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('Unapproved bot blocked')
        .setDescription('Starry removed an unapproved bot addition. Inviter: <@' + executorId + '>.')
        .setTimestamp();
    await notifyGuild(member.client, member.guild.id, 'securityAlert', { embeds: [embed] }).catch(() => {});
}

module.exports = client => {
    client.on(Events.ChannelDelete, channel => {
        if (channel.guild) handleDestructiveEvent(channel.guild, AuditLogEvent.ChannelDelete, channel.id, 'channelDelete');
    });
    client.on(Events.GuildRoleDelete, role => {
        handleDestructiveEvent(role.guild, AuditLogEvent.RoleDelete, role.id, 'roleDelete');
    });
    client.on(Events.GuildBanAdd, ban => {
        handleDestructiveEvent(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id, 'ban');
    });
    client.on(Events.GuildMemberRemove, member => {
        handleDestructiveEvent(member.guild, AuditLogEvent.MemberKick, member.id, 'kick');
    });
    client.on(Events.GuildMemberAdd, handleBotJoin);
    console.log('🛡️ Audit-log Anti-Nuke monitor loaded.');
};

module.exports.getPolicy = getPolicy;
module.exports.recordAction = recordAction;
module.exports.executeResponse = executeResponse;
