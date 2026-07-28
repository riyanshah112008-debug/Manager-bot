// ==========================================
// 1. TOP-LEVEL IMPORTS & MONGOOSE SCHEMA
// ==========================================
const { 
    EmbedBuilder, 
    Events, 
    SlashCommandBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
const mongoose = require('mongoose');

// Mongoose Schema for MongoDB Logging Configuration
const logSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    logChannel: { type: String, default: null }
});

const LogSettings = mongoose.models.LogSettings || mongoose.model('LogSettings', logSettingsSchema);

// Slash Command Schema for /setlogs
const setLogsCommand = new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('Configure the server audit log channel in MongoDB')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('The channel where audit logs should be sent')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

module.exports = (client) => {

    // Helper: Fetch configured log channel from MongoDB
    async function getLogChannel(guild) {
        if (!guild) return null;
        try {
            const config = await LogSettings.findOne({ guildId: guild.id });
            if (!config || !config.logChannel) return null;
            return guild.channels.cache.get(config.logChannel) || null;
        } catch (err) {
            return null;
        }
    }

    // Register /setlogs Command in Client Memory
    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('setlogs', { data: setLogsCommand, execute: handleSetLogs });
    }

    // Command Handler for /setlogs
    async function handleSetLogs(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        } catch (e) { return; }

        const channel = interaction.options.getChannel('channel', true);

        await LogSettings.findOneAndUpdate(
            { guildId: interaction.guildId },
            { logChannel: channel.id },
            { upsert: true, new: true }
        );

        const embed = new EmbedBuilder()
            .setColor('#23A559')
            .setTitle('⚙️ Audit Logs Channel Updated')
            .setDescription(`Audit logs will now be saved and sent to ${channel}.`)
            .setFooter({ text: 'Starry MongoDB Logger' });

        return interaction.editReply({ embeds: [embed] });
    }

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'setlogs') await handleSetLogs(interaction);
    });

    // ==========================================
    // 📥 2. MEMBER EVENTS (JOIN, LEAVE, UPDATE)
    // ==========================================

    // Member Join
    client.on(Events.GuildMemberAdd, async (member) => {
        const logChannel = await getLogChannel(member.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#23A559')
            .setAuthor({ name: '📥 Member Joined', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`${member.user} (\`${member.user.tag}\`) entered the server.`)
            .addFields(
                { name: '👤 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '👥 Member Count', value: `\`${member.guild.memberCount}\``, inline: true }
            )
            .setFooter({ text: `User ID: ${member.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // Member Leave
    client.on(Events.GuildMemberRemove, async (member) => {
        const logChannel = await getLogChannel(member.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#DA373C')
            .setAuthor({ name: '📤 Member Left', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`${member.user} (\`${member.user.tag}\`) left or was removed from the server.`)
            .addFields(
                { name: '👥 Member Count', value: `\`${member.guild.memberCount}\``, inline: true }
            )
            .setFooter({ text: `User ID: ${member.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // Member Update (Roles, Nickname, Timeout)
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        const logChannel = await getLogChannel(newMember.guild);
        if (!logChannel) return;

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
        const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

        if (addedRoles.size > 0 || removedRoles.size > 0) {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL({ dynamic: true }) })
                .setFooter({ text: `User ID: ${newMember.id}` })
                .setTimestamp();

            if (addedRoles.size > 0) {
                embed.setTitle('🛡️ Role Assigned')
                     .setDescription(`**Added to ${newMember.user}:** ${addedRoles.map(r => r.toString()).join(', ')}`);
            } else {
                embed.setTitle('🛡️ Role Removed')
                     .setDescription(`**Removed from ${newMember.user}:** ${removedRoles.map(r => r.toString()).join(', ')}`);
            }
            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        if (oldMember.nickname !== newMember.nickname) {
            const embed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL({ dynamic: true }) })
                .setTitle('🏷️ Nickname Changed')
                .setDescription(`**User:** ${newMember.user}\n**Old:** \`${oldMember.nickname || 'None'}\`\n**New:** \`${newMember.nickname || 'None'}\``)
                .setFooter({ text: `User ID: ${newMember.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL({ dynamic: true }) })
                .setTitle('⏰ Member Timed Out')
                .setDescription(`**User:** ${newMember.user}\n**Until:** <t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`)
                .setFooter({ text: `User ID: ${newMember.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });
    // ==========================================
    // 💬 3. MESSAGE AUDIT LOGS
    // ==========================================

    client.on(Events.MessageDelete, async (message) => {
        if (!message.guild || message.author?.bot) return;

        const logChannel = await getLogChannel(message.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setTitle(`🗑️ Message Deleted in #${message.channel.name}`)
            .setDescription(message.content ? message.content : '*[No text content / Attachment only]*')
            .addFields(
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Author', value: `${message.author}`, inline: true }
            )
            .setFooter({ text: `User ID: ${message.author.id} | Message ID: ${message.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (newMessage.partial) {
            try { await newMessage.fetch(); } catch (e) { return; }
        }

        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const logChannel = await getLogChannel(newMessage.guild);
        if (!logChannel) return;

        const beforeText = oldMessage.partial || !oldMessage.content 
            ? '*[Unknown / Message sent while bot was offline]*' 
            : oldMessage.content;

        const afterText = newMessage.content || '*[Empty]*';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL({ dynamic: true }) })
            .setTitle(`✏️ Message Edited in #${newMessage.channel.name}`)
            .setDescription(`**Before:**\n${beforeText}\n\n**After:**\n${afterText}\n\n[Jump to Message](${newMessage.url})`)
            .setFooter({ text: `User ID: ${newMessage.author.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.MessageDeleteBulk, async (messages) => {
        const firstMsg = messages.first();
        if (!firstMsg || !firstMsg.guild) return;

        const logChannel = await getLogChannel(firstMsg.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🧹 Bulk Messages Purged')
            .setDescription(`**${messages.size} messages** were deleted in ${firstMsg.channel}.`)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // ==========================================
    // 🎙️ 4. VOICE CHANNEL AUDIT LOGS
    // ==========================================
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const guild = newState.guild || oldState.guild;
        const logChannel = await getLogChannel(guild);
        if (!logChannel || !newState.member) return;

        const user = newState.member.user;

        // Joined VC
        if (!oldState.channelId && newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#23A559')
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setTitle('🎙️ Voice Channel Joined')
                .setDescription(`${user} joined **${newState.channel.name}**`)
                .setFooter({ text: `User ID: ${user.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        // Left VC
        if (oldState.channelId && !newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#DA373C')
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setTitle('🎙️ Voice Channel Left')
                .setDescription(`${user} left **${oldState.channel.name}**`)
                .setFooter({ text: `User ID: ${user.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        // Switched VC
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setTitle('🔄 Voice Channel Switched')
                .setDescription(`${user} moved from **${oldState.channel.name}** ➡️ **${newState.channel.name}**`)
                .setFooter({ text: `User ID: ${user.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        // Server Muted / Deafened
        if (oldState.serverMute !== newState.serverMute || oldState.serverDeaf !== newState.serverDeaf) {
            const action = newState.serverMute ? 'Muted' : newState.serverDeaf ? 'Deafened' : 'Unmuted/Undeafened';
            const embed = new EmbedBuilder()
                .setColor('#E91E63')
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setTitle(`🎙️ Staff Voice State Change: ${action}`)
                .setDescription(`${user} was server-${action.toLowerCase()} in **${newState.channel.name}**.`)
                .setFooter({ text: `User ID: ${user.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // ==========================================
    // 🔗 5. INVITE LOGS
    // ==========================================
    client.on(Events.InviteCreate, async (invite) => {
        const logChannel = await getLogChannel(invite.guild);
        if (!logChannel) return;

        const inviter = invite.inviter ? `<@${invite.inviter.id}> (\`${invite.inviter.tag}\`)` : 'Unknown';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🔗 Invite Code Created')
            .setDescription(`**Code:** \`${invite.code}\`\n**Channel:** ${invite.channel}\n**Created By:** ${inviter}`)
            .addFields(
                { name: 'Max Uses', value: invite.maxUses === 0 ? 'Infinite' : `${invite.maxUses}`, inline: true },
                { name: 'Expires', value: invite.maxAge === 0 ? 'Never' : `<t:${Math.floor((Date.now() + invite.maxAge * 1000) / 1000)}:R>`, inline: true }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.InviteDelete, async (invite) => {
        const logChannel = await getLogChannel(invite.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🗑️ Invite Code Revoked / Expired')
            .setDescription(`The invite code \`${invite.code}\` for ${invite.channel} has been deleted or expired.`)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });
    // ==========================================
    // 📁 6. CHANNEL & PERMISSION OVERWRITE LOGS
    // ==========================================
    client.on(Events.ChannelCreate, async (channel) => {
        if (!channel.guild) return;
        const logChannel = await getLogChannel(channel.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#23A559')
            .setTitle('📁 Channel Created')
            .setDescription(`**Name:** ${channel} (\`#${channel.name}\`)\n**Type:** \`${channel.type}\``)
            .setFooter({ text: `Channel ID: ${channel.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.ChannelDelete, async (channel) => {
        if (!channel.guild) return;
        const logChannel = await getLogChannel(channel.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#DA373C')
            .setTitle('🗑️ Channel Deleted')
            .setDescription(`**Name:** \`#${channel.name}\`\n**Type:** \`${channel.type}\``)
            .setFooter({ text: `Channel ID: ${channel.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
        if (!newChannel.guild) return;
        const logChannel = await getLogChannel(newChannel.guild);
        if (!logChannel) return;

        if (oldChannel.name !== newChannel.name) {
            const embed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle('✏️ Channel Name Changed')
                .setDescription(`**Channel:** ${newChannel}\n**Old Name:** \`${oldChannel.name}\`\n**New Name:** \`${newChannel.name}\``)
                .setFooter({ text: `Channel ID: ${newChannel.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }

        if (oldChannel.permissionOverwrites.cache.size !== newChannel.permissionOverwrites.cache.size ||
            !oldChannel.permissionOverwrites.cache.equals(newChannel.permissionOverwrites.cache)) {

            const embed = new EmbedBuilder()
                .setColor('#E91E63')
                .setTitle('🔒 Channel Permissions Updated')
                .setDescription(`Permission overwrites were updated for ${newChannel} (\`#${newChannel.name}\`).`)
                .setFooter({ text: `Channel ID: ${newChannel.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // ==========================================
    // 🛡️ 7. ROLE AUDIT LOGS
    // ==========================================
    client.on(Events.GuildRoleCreate, async (role) => {
        const logChannel = await getLogChannel(role.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#23A559')
            .setTitle('🛡️ Role Created')
            .setDescription(`**Role:** ${role} (\`${role.name}\`)\n**Color:** \`${role.hexColor}\``)
            .setFooter({ text: `Role ID: ${role.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.GuildRoleDelete, async (role) => {
        const logChannel = await getLogChannel(role.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#DA373C')
            .setTitle('🗑️ Role Deleted')
            .setDescription(`**Role Name:** \`${role.name}\``)
            .setFooter({ text: `Role ID: ${role.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
        const logChannel = await getLogChannel(newRole.guild);
        if (!logChannel) return;

        if (oldRole.name !== newRole.name) {
            const embed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setTitle('✏️ Role Name Changed')
                .setDescription(`**Role:** ${newRole}\n**Old:** \`${oldRole.name}\`\n**New:** \`${newRole.name}\``)
                .setFooter({ text: `Role ID: ${newRole.id}` })
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // ==========================================
    // 🔨 8. BAN & SECURITY AUDIT LOGS
    // ==========================================
    client.on(Events.GuildBanAdd, async (ban) => {
        const logChannel = await getLogChannel(ban.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#ED4245')
            .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('🔨 Member Banned')
            .setDescription(`**User:** ${ban.user}\n**Reason:** ${ban.reason || 'No reason provided.'}`)
            .setFooter({ text: `User ID: ${ban.user.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.GuildBanRemove, async (ban) => {
        const logChannel = await getLogChannel(ban.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('🔓 Member Unbanned')
            .setDescription(`**User:** ${ban.user}`)
            .setFooter({ text: `User ID: ${ban.user.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // ==========================================
    // 🌐 9. GUILD & EMOJI UPDATES
    // ==========================================
    client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
        const logChannel = await getLogChannel(newGuild);
        if (!logChannel) return;

        if (oldGuild.name !== newGuild.name) {
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🏰 Server Name Changed')
                .setDescription(`**Old Name:** \`${oldGuild.name}\`\n**New Name:** \`${newGuild.name}\``)
                .setTimestamp();

            return logChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });

    client.on(Events.GuildEmojiCreate, async (emoji) => {
        const logChannel = await getLogChannel(emoji.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#23A559')
            .setTitle('😃 Custom Emoji Created')
            .setDescription(`**Emoji:** ${emoji} (\`:${emoji.name}:\`)`)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.GuildEmojiDelete, async (emoji) => {
        const logChannel = await getLogChannel(emoji.guild);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#DA373C')
            .setTitle('🗑️ Custom Emoji Deleted')
            .setDescription(`**Emoji Name:** \`:${emoji.name}:\``)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });
};

// Module Hybrid Exports
module.exports.LogSettings = LogSettings;
module.exports.setLogsData = setLogsCommand;
