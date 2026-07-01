const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'logSettings.json');

module.exports = (client) => {
    const PREFIX = '.';

    // ==========================================
    // 1. REGISTER THE SLASH COMMAND
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'setlogs',
                description: 'Set the channel where Starry will send server logs (Admin Only)',
                default_member_permissions: '8',
                options: [
                    {
                        name: 'channel',
                        description: 'The channel to send logs to',
                        type: 7, // 7 is Channel type
                        required: true
                    }
                ]
            });
            console.log('✅ Advanced Logging Module Loaded');
        } catch (err) {}
    });

    // Helper to read/write the log channel setting
    function getLogChannel(guildId) {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        return data[guildId] || null;
    }

    function setLogChannel(guildId, channelId) {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        data[guildId] = channelId;
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    // ==========================================
    // 2. HANDLE SLASH AND PREFIX COMMANDS
    // ==========================================
    
    // Slash Command Handler
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setlogs') return;

        const channel = interaction.options.getChannel('channel');
        setLogChannel(interaction.guild.id, channel.id);
        
        await interaction.reply({ 
            content: `✅ Success! All server logs will now be sent to <#${channel.id}>.`, 
            ephemeral: true 
        }).catch(() => {});
    });

    // Prefix Command Handler (.setlogs #channel)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.toLowerCase().startsWith(PREFIX + 'setlogs')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('❌ You need **Administrator** permissions to use this command.').catch(() => {});
            }

            const channel = message.mentions.channels.first();
            if (!channel) {
                return message.reply('🔹 **Usage:** `.setlogs #channel`').catch(() => {});
            }

            setLogChannel(message.guild.id, channel.id);
            return message.reply(`✅ Success! All server logs will now be sent to <#${channel.id}>.`).catch(() => {});
        }
    });

    // ==========================================
    // 3. MESSAGE DELETED LOGS
    // ==========================================
    client.on('messageDelete', async (message) => {
        if (message.author?.bot || !message.guild) return;

        const logChannelId = getLogChannel(message.guild.id);
        if (!logChannelId) return;

        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                { name: 'Message Content', value: message.content || '*[Embed, Image, or Attachment]*' }
            )
            .setFooter({ text: `User ID: ${message.author.id} • Message ID: ${message.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // ==========================================
    // 4. MESSAGE EDITED LOGS
    // ==========================================
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (oldMessage.author?.bot || !oldMessage.guild) return;
        if (oldMessage.content === newMessage.content) return; // Ignore link embeds loading

        const logChannelId = getLogChannel(oldMessage.guild.id);
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
            .setFooter({ text: `User ID: ${oldMessage.author.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // ==========================================
    // 5. MEMBER JOIN / LEAVE LOGS
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        const logChannelId = getLogChannel(member.guild.id);
        if (!logChannelId) return;
        
        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTitle('📥 Member Joined')
            .addFields(
                { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
            )
            .setFooter({ text: `User ID: ${member.user.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on('guildMemberRemove', async (member) => {
        const logChannelId = getLogChannel(member.guild.id);
        if (!logChannelId) return;
        
        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('Orange')
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTitle('📤 Member Left')
            .setFooter({ text: `User ID: ${member.user.id}` })
            .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
    });
};
