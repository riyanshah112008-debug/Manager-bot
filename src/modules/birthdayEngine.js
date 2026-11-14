const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Birthday = require('../models/Birthday');
const ServerSettings = require('../models/ServerSettings');

let scheduler = null;
let running = false;

function dateInZone(timeZone, date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return { year: values.year, month: Number(values.month), day: Number(values.day), key: values.year + '-' + String(values.month).padStart(2, '0') + '-' + String(values.day).padStart(2, '0') };
}

async function ensureBirthdayRole(guild, settings) {
    if (settings.autoRoleEnabled === false) return null;
    let role = settings.roleId ? guild.roles.cache.get(settings.roleId) : null;
    if (role) return role;
    const name = String(settings.roleName || '🎂 Birthday Star').trim().slice(0, 100) || '🎂 Birthday Star';
    role = guild.roles.cache.find(candidate => candidate.name === name && !candidate.managed) || null;
    if (role) {
        await ServerSettings.updateOne({ guildId: guild.id }, { $set: { 'birthdays.roleId': role.id } });
        settings.roleId = role.id;
        return role;
    }
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error('Starry needs Manage Roles permission to create the birthday role.');
    role = await guild.roles.create({
        name,
        color: /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(settings.roleColor || '') ? settings.roleColor : '#F472B6',
        hoist: false,
        mentionable: false,
        reason: 'Starry automatic birthday celebration role'
    });
    await ServerSettings.updateOne({ guildId: guild.id }, { $set: { 'birthdays.roleId': role.id } });
    settings.roleId = role.id;
    return role;
}

// Remove a tracked birthday role before its database record is changed or deleted.
// Transient Discord API failures must leave the tracking fields intact so cleanup can retry.
async function removeBirthdayRoleAssignment(guild, entry, reason = 'Birthday celebration ended') {
    if (!entry?.birthdayRoleId) return;

    let role = guild.roles.cache.get(entry.birthdayRoleId) || null;
    if (!role && typeof guild.roles.fetch === 'function') {
        try {
            role = await guild.roles.fetch(entry.birthdayRoleId);
        } catch (error) {
            if (Number(error?.code) !== 10011 && Number(error?.status) !== 404) throw error;
        }
    }

    let member = null;
    try {
        member = await guild.members.fetch(entry.userId);
    } catch (error) {
        if (Number(error?.code) !== 10007 && Number(error?.status) !== 404) throw error;
    }

    if (member && role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role, reason);
    }

    const filter = entry._id ? { _id: entry._id } : { guildId: guild.id, userId: entry.userId };
    await Birthday.updateOne(filter, { $set: { birthdayRoleGrantedDate: '', birthdayRoleId: '' } });
}

async function removeExpiredBirthdayRoles(guild, todayKey) {
    const expired = await Birthday.find({
        guildId: guild.id,
        birthdayRoleGrantedDate: { $ne: '', $lt: todayKey },
        birthdayRoleId: { $ne: '' }
    }).limit(500).lean();
    for (const entry of expired) {
        try {
            await removeBirthdayRoleAssignment(guild, entry, 'Birthday celebration ended');
        } catch (error) {
            console.warn('[Birthday] Could not remove temporary birthday role; cleanup will retry:', error.message);
        }
    }
}

async function announceBirthdays(client) {
    if (running || !client?.isReady?.()) return;
    running = true;
    try {
        const configs = await ServerSettings.find({ $or: [{ 'birthdays.enabled': true }, { 'birthdays.roleId': { $ne: '' } }] }).select('guildId birthdays').lean();
        for (const config of configs) {
            const settings = config.birthdays || {};
            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) continue;
            let today;
            try { today = dateInZone(settings.timezone || 'Asia/Kolkata'); } catch (_) { continue; }
            await removeExpiredBirthdayRoles(guild, today.key);
            if (!settings.enabled || !settings.channelId) continue;
            const channel = guild.channels.cache.get(settings.channelId);
            if (!channel?.isTextBased?.() || typeof channel.send !== 'function') continue;
            const entries = await Birthday.find({
                guildId: config.guildId, month: today.month, day: today.day,
                lastAnnouncedDate: { $ne: today.key }
            }).limit(100).lean();
            if (!entries.length) continue;
            let birthdayRole = null;
            if (settings.autoRoleEnabled !== false) {
                try { birthdayRole = await ensureBirthdayRole(guild, settings); }
                catch (error) { console.warn('[Birthday] Role setup failed in guild ' + guild.id + ':', error.message); }
            }
            for (const entry of entries) {
                const member = await guild.members.fetch(entry.userId).catch(() => null);
                if (!member) {
                    await Birthday.updateOne({ _id: entry._id }, { $set: { lastAnnouncedDate: today.key } });
                    continue;
                }
                if (birthdayRole) {
                    try {
                        if (!member.roles.cache.has(birthdayRole.id)) await member.roles.add(birthdayRole, 'Birthday celebration');
                        await Birthday.updateOne({ _id: entry._id }, { $set: { birthdayRoleGrantedDate: today.key, birthdayRoleId: birthdayRole.id } });
                    } catch (error) { console.warn('[Birthday] Could not assign birthday role to ' + entry.userId + ':', error.message); }
                }
                const raw = settings.message || '🎂 Happy birthday {user}! We hope your day is full of joy, laughter and lovely surprises. 💖';
                const content = raw.replace(/\{user\}/gi, member.toString()).replace(/\{username\}/gi, member.displayName || member.user.username).replace(/\{server\}/gi, guild.name);
                const rolePing = settings.mentionRoleId ? '<@&' + settings.mentionRoleId + '> ' : '';
                const embed = new EmbedBuilder().setColor(settings.roleColor || '#F472B6').setTitle('🎂 A little birthday magic!').setDescription(content).setFooter({ text: 'Made with love by Starry ✨' }).setTimestamp();
                try {
                    await channel.send({
                        content: rolePing + member.toString(),
                        embeds: [embed],
                        allowedMentions: { users: [entry.userId], roles: settings.mentionRoleId ? [settings.mentionRoleId] : [] }
                    });
                    await Birthday.updateOne({ _id: entry._id, lastAnnouncedDate: { $ne: today.key } }, { $set: { lastAnnouncedDate: today.key } });
                } catch (error) { console.warn('[Birthday] Could not announce in guild ' + config.guildId + ':', error.message); }
            }
        }
    } catch (error) {
        console.warn('[Birthday] Scheduler pass failed:', error.message);
    } finally { running = false; }
}

function startBirthdayScheduler(client) {
    if (scheduler) return;
    scheduler = setInterval(() => announceBirthdays(client), 60 * 1000);
    if (typeof scheduler.unref === 'function') scheduler.unref();
    announceBirthdays(client).catch(() => {});
}

module.exports = { startBirthdayScheduler, announceBirthdays, dateInZone, ensureBirthdayRole, removeExpiredBirthdayRoles, removeBirthdayRoleAssignment };
