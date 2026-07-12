const { PermissionsBitField } = require('discord.js');
const mongoose = require('mongoose');

// 🗄️ MONGODB SCHEMAS FOR PERMANENT SETTINGS
const AutomodGuild = mongoose.models.AutomodGuild || mongoose.model('AutomodGuild', new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true } // Defaults to true, but saves permanently when turned off
}));

const AutomodChannel = mongoose.models.AutomodChannel || mongoose.model('AutomodChannel', new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    links: { type: Boolean, default: false },
    emojis: { type: Boolean, default: false }
}));

const OWNER_ID = '1465049039153135639'; 

module.exports = (client) => {
    // 🧠 FAST MEMORY CACHES (Prevents database spam)
    const guildCache = new Map();
    const channelCache = new Map();

    const linkPattern = /https?:\/\/\S+/g;
    const emojiPattern = /<a?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

    const allowedDomains = [
        'tenor.com', 'giphy.com', 'discord.com', 'discordapp.com', 
        'discordapp.net', 'media.discordapp.net', 'cdn.discordapp.com'
    ];

    client.on('clientReady', async () => {
        try {
            const gSettings = await AutomodGuild.find();
            gSettings.forEach(s => guildCache.set(s.guildId, s.enabled));
            
            const cSettings = await AutomodChannel.find();
            cSettings.forEach(s => channelCache.set(s.channelId, { links: s.links, emojis: s.emojis }));
            console.log('✅ Automod Module Loaded (MongoDB Synced & Staff Bypass Active)');
        } catch (err) {}
    });

    // ==========================================
    // 1. HANDLE SLASH COMMANDS
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        
        const isOwner = typeof client.isOwner === 'function' ? client.isOwner(interaction.user.id) : interaction.user.id === OWNER_ID;
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        
        if (['automod', 'ignore', 'unignore'].includes(interaction.commandName) && !isAdmin && !isOwner) {
            return interaction.reply({ content: '❌ You need **Administrator** permissions.', ephemeral: true }).catch(()=>{});
        }

        const guildId = interaction.guildId;

        if (interaction.commandName === 'automod') {
            const action = interaction.options.getString('action');
            
            if (action === 'status') {
                const isEnabled = guildCache.has(guildId) ? guildCache.get(guildId) : true;
                return interaction.reply(`📢 **Server-Wide Automod Status:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`).catch(()=>{});
            }

            const targetState = action === 'enable';
            await AutomodGuild.findOneAndUpdate({ guildId }, { enabled: targetState }, { upsert: true });
            guildCache.set(guildId, targetState);
            
            return interaction.reply(`${targetState ? '✅' : '🚫'} Automod has been **${action.toUpperCase()}D** for this entire server.`).catch(()=>{});
        }

        if (interaction.commandName === 'ignore' || interaction.commandName === 'unignore') {
            const type = interaction.options.getString('type');
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const channelId = channel.id;

            let cSettings = channelCache.get(channelId) || { links: false, emojis: false };

            if (type === 'status' && interaction.commandName === 'ignore') {
                return interaction.reply(`📢 **Automod Status for <#${channelId}>:**\n🔗 Links: ${cSettings.links ? '❌ Ignored' : '✅ Active'}\n😀 Emojis: ${cSettings.emojis ? '❌ Ignored' : '✅ Active'}`).catch(()=>{});
            }

            const targetState = interaction.commandName === 'ignore';
            if (type === 'links' || type === 'all') cSettings.links = targetState;
            if (type === 'emojis' || type === 'all') cSettings.emojis = targetState;
            
            await AutomodChannel.findOneAndUpdate({ channelId }, { links: cSettings.links, emojis: cSettings.emojis }, { upsert: true });
            channelCache.set(channelId, cSettings);

            const typeName = type === 'all' ? '**All** Automod filters are' : `Automod **${type}** filter is`;
            return interaction.reply(`${targetState ? '🚫' : '✅'} ${typeName} now **${targetState ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`).catch(()=>{});
        }
    });

    // ==========================================
    // 2. SPAM FILTER & STAFF BYPASS SHIELD
    // ==========================================
    client.on("messageCreate", async (message) => {
        if (message.author.bot || !message.guild) return;

        // 🛡️ STAFF BYPASS SHIELD: Admins and Mods are completely immune to Automod!
        const isStaff = message.member && (
            message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
            message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
            message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)
        );
        const isOwner = typeof client.isOwner === 'function' ? client.isOwner(message.author.id) : message.author.id === OWNER_ID;
        
        if (isStaff || isOwner || message.author.id === message.guild.ownerId) return;

        // Ignore prefix commands
        if (message.content.startsWith('.')) return;

        // Check if Automod is toggled off for the server
        const isServerEnabled = guildCache.has(message.guild.id) ? guildCache.get(message.guild.id) : true;
        if (!isServerEnabled) return;

        // Check if the channel is ignored
        const channelSettings = channelCache.get(message.channel.id) || { links: false, emojis: false };

        const rawLinks = message.content.match(linkPattern) || [];
        const links = rawLinks.filter(link => {
            const url = link.toLowerCase();
            const isSafeDomain = allowedDomains.some(domain => url.includes(domain));
            return !isSafeDomain && !url.endsWith('.gif');
        });

        const emojis = message.content.match(emojiPattern) || [];

        const isLinkSpam = !channelSettings.links && links.length >= 1;
        const isEmojiSpam = !channelSettings.emojis && emojis.length >= 5;

        if (isLinkSpam || isEmojiSpam) {
            try { await message.delete(); } catch (err) {}

            if (isLinkSpam) {
                try {
                    await message.member.timeout(10 * 60 * 1000, "Automod: Link Spam");
                    await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 10 minutes for link spam.`);
                } catch (error) {}
            } else if (isEmojiSpam) {
                try {
                    await message.member.timeout(2 * 60 * 1000, "Automod: Emoji Spam");
                    await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 2 minutes for emoji spam.`);
                } catch (error) {}
            }
        }
    });
};
