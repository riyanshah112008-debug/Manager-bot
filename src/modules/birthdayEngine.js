const { EmbedBuilder } = require('discord.js');
const Birthday = require('../models/Birthday');
const ServerSettings = require('../models/ServerSettings');

let scheduler = null;
let running = false;

function dateInZone(timeZone, date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return { year: values.year, month: Number(values.month), day: Number(values.day), key: values.year + '-' + values.month + '-' + values.day };
}

async function announceBirthdays(client) {
    if (running || !client?.isReady?.()) return;
    running = true;
    try {
        const configs = await ServerSettings.find({ 'birthdays.enabled': true, 'birthdays.channelId': { $ne: '' } }).select('guildId birthdays').lean();
        for (const config of configs) {
            const settings = config.birthdays || {};
            const channel = client.channels.cache.get(settings.channelId);
            if (!channel?.isTextBased?.() || typeof channel.send !== 'function') continue;
            let today;
            try { today = dateInZone(settings.timezone || 'UTC'); } catch (_) { continue; }
            const entries = await Birthday.find({
                guildId: config.guildId, month: today.month, day: today.day,
                lastAnnouncedDate: { $ne: today.key }
            }).limit(100).lean();
            for (const entry of entries) {
                const user = await client.users.fetch(entry.userId).catch(() => null);
                const member = await client.guilds.cache.get(config.guildId)?.members.fetch(entry.userId).catch(() => null);
                const mention = member ? member.toString() : '<@' + entry.userId + '>';
                const raw = settings.message || '🎂 Happy birthday {user}! Everyone wish them a wonderful day! 🎉';
                const content = raw.replace(/\{user\}/gi, mention).replace(/\{username\}/gi, user?.username || 'friend').replace(/\{server\}/gi, client.guilds.cache.get(config.guildId)?.name || 'our server');
                const role = settings.mentionRoleId ? '<@&' + settings.mentionRoleId + '> ' : '';
                const embed = new EmbedBuilder().setColor('#F472B6').setTitle('🎂 Birthday Celebration!').setDescription(content).setFooter({ text: 'Starry Birthday System' }).setTimestamp();
                try {
                    await channel.send({ content: role + mention, embeds: [embed], allowedMentions: { users: [entry.userId], roles: settings.mentionRoleId ? [settings.mentionRoleId] : [] } });
                    await Birthday.updateOne({ _id: entry._id, lastAnnouncedDate: { $ne: today.key } }, { $set: { lastAnnouncedDate: today.key } });
                } catch (error) {
                    console.warn('[Birthday] Could not announce in guild ' + config.guildId + ':', error.message);
                }
            }
        }
    } catch (error) {
        console.warn('[Birthday] Scheduler pass failed:', error.message);
    } finally {
        running = false;
    }
}

function startBirthdayScheduler(client) {
    if (scheduler) return;
    scheduler = setInterval(() => announceBirthdays(client), 60 * 1000);
    if (typeof scheduler.unref === 'function') scheduler.unref();
    announceBirthdays(client).catch(() => {});
}

module.exports = { startBirthdayScheduler, announceBirthdays, dateInZone };
