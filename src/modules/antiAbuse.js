const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// Track recent text messages per guild/member. Media-only posts are deliberately
// excluded: sharing images, GIFs, stickers, or embeds is not rapid text spam.
const userMessageLog = new Map();
const WINDOW_MS = 5000;
const MESSAGE_THRESHOLD = 5;
const MAX_TRACKED_USERS = 10000;
const badWordsList = [
    'badword1', 'badword2', 'scam', 'free nitro', 'click here for free'
];

const MEDIA_EXTENSION = /\.(?:png|jpe?g|gif|webp|avif|bmp|tiff?)(?:$|[?#])/i;

function hasMediaAttachment(message) {
    return message.attachments?.some(attachment => {
        const contentType = String(attachment.contentType || '').toLowerCase();
        const name = String(attachment.name || attachment.url || '');
        return contentType.startsWith('image/') || MEDIA_EXTENSION.test(name);
    }) || message.embeds?.some(embed =>
        Boolean(embed.image?.url || embed.thumbnail?.url || embed.type === 'gifv')
    );
}

function shouldCountForRateLimit(message) {
    if (!message || hasMediaAttachment(message)) return false;
    const content = typeof message.content === 'string' ? message.content.trim() : '';
    return content.length > 0;
}

function recordTextMessage(guildId, userId, now = Date.now()) {
    const key = `${guildId}:${userId}`;
    const recent = (userMessageLog.get(key) || []).filter(timestamp => now - timestamp < WINDOW_MS);
    recent.push(now);
    if (userMessageLog.size >= MAX_TRACKED_USERS && !userMessageLog.has(key)) {
        const oldestKey = userMessageLog.keys().next().value;
        if (oldestKey) userMessageLog.delete(oldestKey);
    }
    userMessageLog.set(key, recent);
    return recent.length;
}

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (!message.guild || !message.member || message.author?.bot || message.webhookId) return;

        // Staff bypass; optional chaining also handles uncached/partial members safely.
        if (message.member.permissions?.has(PermissionsBitField.Flags.Administrator)) return;

        const content = String(message.content || '').toLowerCase();
        const containsBadWord = badWordsList.some(word => content.includes(word));
        if (containsBadWord) {
            await message.delete().catch(() => {});
            const warningEmbed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🛑 Inappropriate Content Blocked')
                .setDescription(`<@${message.author.id}>, your message was removed for containing restricted words.`);
            const warningMsg = await message.channel.send({ embeds: [warningEmbed] }).catch(() => null);
            if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => {}), 5000);
            return;
        }

        // Do not count normal image/GIF posts or empty messages toward text-spam limits.
        if (!shouldCountForRateLimit(message)) return;

        const count = recordTextMessage(message.guild.id, message.author.id);
        if (count < MESSAGE_THRESHOLD) return;

        userMessageLog.delete(`${message.guild.id}:${message.author.id}`);

        const botMember = message.guild.members.me;
        const canModerate = botMember?.permissions?.has(PermissionsBitField.Flags.ModerateMembers);
        const hierarchyAllows = botMember && message.member.manageable &&
            message.member.roles.highest.position < botMember.roles.highest.position;
        if (!canModerate || !hierarchyAllows) return;

        try {
            await message.member.timeout(5 * 60 * 1000, 'Anti-Abuse: Rapid text message spam');
            if (message.channel?.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ManageMessages)) {
                const recentMessages = await message.channel.messages.fetch({ limit: 10 }).catch(() => null);
                const userMessages = recentMessages?.filter(candidate =>
                    candidate.author?.id === message.author.id && !hasMediaAttachment(candidate)
                );
                if (userMessages?.size) await message.channel.bulkDelete(userMessages, true).catch(() => {});
            }
            await message.channel.send(`🔨 **AutoMod:** <@${message.author.id}> was timed out for 5 minutes due to rapid text-message spam.`).catch(() => {});
        } catch (error) {
            console.error(`[Anti-Abuse] Failed to enforce text-spam timeout in guild ${message.guild.id}:`, error.message);
        }
    });
};

module.exports.hasMediaAttachment = hasMediaAttachment;
module.exports.shouldCountForRateLimit = shouldCountForRateLimit;
module.exports.recordTextMessage = recordTextMessage;
module.exports.userMessageLog = userMessageLog;
