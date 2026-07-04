const { EmbedBuilder, PermissionsBitField, AuditLogEvent, Events } = require('discord.js');
const mongoose = require('mongoose');

// ==========================================
// MONGODB DATABASE SCHEMA
// ==========================================
const logSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }
});

// Check if model exists to prevent crash on restart, otherwise build it
const LogConfig = mongoose.models.LogConfig || mongoose.model('LogConfig', logSchema);

module.exports = (client) => {
    const PREFIX = '.';

    // Async helper to read the log channel setting from MongoDB
    async function getLogChannel(guildId) {
        const data = await LogConfig.findOne({ guildId: guildId });
        return data ? data.channelId : null;
    }

    // Async helper to save the log channel setting to MongoDB
    async function setLogChannel(guildId, channelId) {
        await LogConfig.findOneAndUpdate(
            { guildId: guildId },
            { channelId: channelId },
            { upsert: true, new: true } // Creates new document if it doesn't exist, updates if it does
        );
    }

    // ==========================================
    // 1. SETUP COMMANDS (SLASH & PREFIX)
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'setlogs',
                description: 'Set the channel where Starry will send server logs (Admin Only)',
                default_member_permissions: '8',
                options: [{ name: 'channel', description: 'The channel to send logs to', type: 7, required: true }]
            });
            console.log('✅ Advanced Logging & Audit Module Loaded (MongoDB Enabled)');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setlogs') return;
        const channel = interaction.options.getChannel('channel');

        await setLogChannel(interaction.guild.id, channel.id);

        await interaction.reply({ content: `✅ All server logs will now be safely saved to MongoDB and sent to <#${channel.id}>.`, ephemeral: true }).catch(() => {});
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (message.content.toLowerCase().startsWith(PREFIX + 'setlogs')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('❌ Admin only!').catch(() => {});

            const channel = message.mentions.channels.first();
            if (!channel) return message.reply('🔹 **Usage:** `.setlogs #channel`').catch(() => {});

            await setLogChannel(message.guild.id, channel.id);

            return message.reply(`✅ All server logs will now be safely saved to MongoDB and sent to <#${channel.id}>.`).catch(() => {});
        }
    });

    // ==========================================
    // 2. MESSAGE DELETIONS (TRACKING BOTS/MODS)
    // ==========================================
    client.on('messageDelete', async (message) => {
        if (!message.guild) return;
        if (message.author?.id === client.user.id) return; // Don't log when Starry deletes her own system messages

        const logChannelId = await getLogChannel(message.guild.id);
        if (!logChannelId) return;

        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        let executor = 'The User (Self-Delete)';

        // Peek into the Audit Logs to see if a Mod or Bot deleted it
        try {
            const fetchedLogs = await message.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete });
            const deletionLog = fetchedLogs.entries.first();

            // If the log is fresh (within 5 seconds) and matches the author
            if (deletionLog && deletionLog.target.id === message.author?.id && deletionLog.createdTimestamp > (Date.now() - 5000)) {
                executor = `<@${deletionLog.executor.id}>`;
            }
        } catch (err) {
            console.log("Could not fetch audit logs for deletion.");
        }

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setAuthor({ name: message.author ? message.author.tag : 'Unknown User', iconURL: message.author?.displayAvatarURL() })
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Author', value: message.author ? `<@${message.author.id}>` : 'Unknown', inline: true },
                { name: 'Deleted By', value: executor, inline: true },
                { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Message Content', value: message.content || '*[Embed, Image, or Attachment]*' }
            )
            .setFooter({ text: `Message ID: ${message.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // ==========================================
    // 3. MESSAGE EDITED LOGS
    // ==========================================
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!oldMessage.author || oldMessage.author.bot || !oldMessage.guild) return;
        if (oldMessage.content === newMessage.content) return; 

        const logChannelId = await getLogChannel(oldMessage.guild.id);
        if (!logChannelId) return;

        const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Yellow')
            .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
            .setTitle('✏️ Message Edited')
            .addFields(
                { name: 'Channel', value: `<#${oldMessage.channel.id}>`, inline: true },
                { name: 'Original', value: oldMessage.content || '*[Empty]*' },
                { name: 'Edited To', value: newMessage.content || '*[Empty]*' },
                { name: 'Jump', value: `[Click to view message](${newMessage.url})` }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // ==========================================
    // 4. MODERATOR ACTIONS (KICK, BAN, TIMEOUT)
    // ==========================================
    client.on(Events.GuildAuditLogEntryCreate, async (auditLog, guild) => {
        const logChannelId = await getLogChannel(guild.id);
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const { action, executor, target, reason, changes } = auditLog;

        // BANS
        if (action === AuditLogEvent.MemberBanAdd) {
            const embed = new EmbedBuilder()
                .setColor('DarkRed')
                .setTitle('🔨 Member Banned')
                .addFields(
                    { name: 'User', value: `<@${target.id}>`, inline: true },
                    { name: 'Banned By', value: `<@${executor.id}>`, inline: true },
                    { name: 'Reason', value: reason || 'No reason provided.' }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        // KICKS
        if (action === AuditLogEvent.MemberKick) {
            const embed = new EmbedBuilder()
                .setColor('Orange')
                .setTitle('👢 Member Kicked')
                .addFields(
                    { name: 'User', value: `<@${target.id}>`, inline: true },
                    { name: 'Kicked By', value: `<@${executor.id}>`, inline: true },
                    { name: 'Reason', value: reason || 'No reason provided.' }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        // TIMEOUTS (Member Update)
        if (action === AuditLogEvent.MemberUpdate) {
            const timeoutChange = changes.find(c => c.key === 'communication_disabled_until');
            if (timeoutChange && timeoutChange.new) {
                const embed = new EmbedBuilder()
                    .setColor('DarkVividPink')
                    .setTitle('⏱️ Member Timed Out')
                    .addFields(
                        { name: 'User', value: `<@${target.id}>`, inline: true },
                        { name: 'Timed Out By', value: `<@${executor.id}>`, inline: true },
                        { name: 'Ends At', value: `<t:${Math.floor(new Date(timeoutChange.new).getTime() / 1000)}:f>` },
                        { name: 'Reason', value: reason || 'No reason provided.' }
                    )
                    .setTimestamp();
                logChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    });

    // ==========================================
    // 5. MEMBER JOIN / LEAVE LOGS
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        const logChannelId = await getLogChannel(member.guild.id);
        if (!logChannelId) return;

        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTitle('📥 Member Joined')
            .addFields({ name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` })
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    });
};
