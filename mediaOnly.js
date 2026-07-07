const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'mediaChannels.json');

module.exports = (client) => {
    const PREFIX = '.';

    function getMediaData() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveMediaData(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    // ==========================================
    // 1. HANDLE SLASH COMMANDS (/mediaonly)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'mediaonly') return;

        const action = interaction.options.getString('action');
        // Let them specify a channel, otherwise default to the current one
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const channelId = targetChannel.id;
        
        let channels = getMediaData();

        if (action === 'status') {
            const isEnabled = channels.includes(channelId);
            return interaction.reply({ content: `📢 **Media-Only Status for <#${channelId}>:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`, ephemeral: true }).catch(() => {});
        }

        if (action === 'enable') {
            if (!channels.includes(channelId)) {
                channels.push(channelId);
                saveMediaData(channels);
            }
            return interaction.reply({ content: `✅ Media-Only mode **enabled** in <#${channelId}>. Only images, videos, and links are allowed there now!` }).catch(() => {});
        }

        if (action === 'disable') {
            channels = channels.filter(id => id !== channelId);
            saveMediaData(channels);
            return interaction.reply({ content: `🚫 Media-Only mode **disabled** in <#${channelId}>. Text is now allowed again.` }).catch(() => {});
        }
    });

    // ==========================================
    // 2. HANDLE PREFIX COMMANDS & ENFORCEMENT
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // --- A. PREFIX COMMAND FALLBACK ---
        if (message.content.toLowerCase().startsWith(PREFIX + 'mediaonly')) {
            if (!message.member.permissions.has('Administrator')) {
                return message.reply('❌ You need **Administrator** permissions to use this command.').catch(() => {});
            }

            const args = message.content.trim().split(/\s+/).slice(1);
            const action = args[0]?.toLowerCase();
            
            if (!['enable', 'disable', 'status'].includes(action)) {
                return message.reply('🔹 **Usage:** `.mediaonly <enable/disable/status> [#channel]`').catch(() => {});
            }

            // Let them tag a channel, otherwise default to current
            const targetChannel = message.mentions.channels.first() || message.channel;
            const channelId = targetChannel.id;
            let channels = getMediaData();

            if (action === 'status') {
                const isEnabled = channels.includes(channelId);
                return message.reply(`📢 **Media-Only Status for <#${channelId}>:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`).catch(() => {});
            }

            if (action === 'enable') {
                if (!channels.includes(channelId)) {
                    channels.push(channelId);
                    saveMediaData(channels);
                }
                return message.reply(`✅ Media-Only mode **enabled** in <#${channelId}>. Only images, videos, and links are allowed there now!`).catch(() => {});
            }

            if (action === 'disable') {
                channels = channels.filter(id => id !== channelId);
                saveMediaData(channels);
                return message.reply(`🚫 Media-Only mode **disabled** in <#${channelId}>. Text is now allowed again.`).catch(() => {});
            }
            return;
        }

        // --- B. ENFORCE MEDIA-ONLY RULES ---
        const channels = getMediaData();
        if (!channels.includes(message.channel.id)) return;
        
        // Admins completely bypass the media filter
        if (message.member.permissions.has('Administrator')) return;

        const hasAttachment = message.attachments.size > 0;
        const hasSticker = message.stickers.size > 0;
        const hasLink = /https?:\/\/\S+/i.test(message.content);

        // If they send plain text without any media, delete it!
        if (!hasAttachment && !hasSticker && !hasLink) {
            await message.delete().catch(() => {});
            const warning = await message.channel.send(`⚠️ <@${message.author.id}>, this is a **Media-Only** channel. You must attach an image, video, sticker, or link!`).catch(() => {});
            
            // Delete the warning after 5 seconds to keep the chat clean
            if (warning) setTimeout(() => warning.delete().catch(() => {}), 5000);
        }
    });
};
                
