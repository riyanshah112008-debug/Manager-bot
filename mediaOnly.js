const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'mediaChannels.json');

module.exports = (client) => {
    const PREFIX = '.';

    // ==========================================
    // 1. REGISTER SLASH COMMAND
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'mediaonly',
                description: 'Manage Media-Only mode for the current channel (Admin Only)',
                default_member_permissions: '8',
                options: [
                    {
                        name: 'action',
                        description: 'Enable, disable, or check status',
                        type: 3, 
                        required: true,
                        choices: [
                            { name: 'Enable', value: 'enable' },
                            { name: 'Disable', value: 'disable' },
                            { name: 'Status', value: 'status' }
                        ]
                    }
                ]
            });
            console.log('✅ Media-Only Module Loaded');
        } catch (err) {}
    });

    function getMediaData() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveMediaData(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    // ==========================================
    // 2. HANDLE SLASH COMMANDS (/mediaonly)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'mediaonly') return;

        const action = interaction.options.getString('action');
        let channels = getMediaData();
        const channelId = interaction.channel.id;

        if (action === 'status') {
            const isEnabled = channels.includes(channelId);
            return interaction.reply({ content: `📢 **Media-Only Status for <#${channelId}>:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}` }).catch(() => {});
        }

        if (action === 'enable') {
            if (!channels.includes(channelId)) {
                channels.push(channelId);
                saveMediaData(channels);
            }
            return interaction.reply({ content: '✅ Media-Only mode **enabled**. Only images, videos, and links are allowed here!' }).catch(() => {});
        }

        if (action === 'disable') {
            channels = channels.filter(id => id !== channelId);
            saveMediaData(channels);
            return interaction.reply({ content: '🚫 Media-Only mode **disabled**. Text is now allowed here.' }).catch(() => {});
        }
    });

    // ==========================================
    // 3. HANDLE PREFIX COMMANDS & ENFORCEMENT
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
                return message.reply('🔹 **Usage:** `.mediaonly <enable/disable/status>`').catch(() => {});
            }

            let channels = getMediaData();
            const channelId = message.channel.id;

            if (action === 'status') {
                const isEnabled = channels.includes(channelId);
                return message.reply(`📢 **Media-Only Status for <#${channelId}>:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`).catch(() => {});
            }

            if (action === 'enable') {
                if (!channels.includes(channelId)) {
                    channels.push(channelId);
                    saveMediaData(channels);
                }
                return message.reply('✅ Media-Only mode **enabled**. Only images, videos, and links are allowed here!').catch(() => {});
            }

            if (action === 'disable') {
                channels = channels.filter(id => id !== channelId);
                saveMediaData(channels);
                return message.reply('🚫 Media-Only mode **disabled**. Text is now allowed here.').catch(() => {});
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
