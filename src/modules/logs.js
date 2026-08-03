// ==========================================
// 📜 STARRY SUPREME AUDIT LOG ENGINE (PART 1 OF 2)
// File Path: logs.js
// ==========================================
const { 
    EmbedBuilder, 
    Events, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    AttachmentBuilder, 
    AuditLogEvent
} = require('discord.js');
const mongoose = require('mongoose');

// 🗄️ MONGOOSE LOG SETTINGS SCHEMA
const logSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    logChannel: { type: String, default: null }
});

const LogSettings = mongoose.models.LogSettings || mongoose.model('LogSettings', logSettingsSchema);

const setLogsCommand = new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('Configure the server audit log channel in MongoDB')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('The default channel where audit logs should be sent')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

module.exports = (client) => {

    // Smart Channel Resolver: Uses client.getLogChannel if available, else MongoDB fallback
    async function resolveLogChannel(guild, type = 'misc') {
        if (!guild) return null;

        if (typeof client.getLogChannel === 'function') {
            const smartChannel = client.getLogChannel(guild, type);
            if (smartChannel) return smartChannel;
        }

        try {
            const config = await LogSettings.findOne({ guildId: guild.id });
            if (!config || !config.logChannel) return null;
            return guild.channels.cache.get(config.logChannel) || null;
        } catch (err) {
            return null;
        }
    }

    if (client.commands && typeof client.commands.set === 'function') {
        client.commands.set('setlogs', { data: setLogsCommand, execute: handleSetLogs });
    }

    async function handleSetLogs(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [6] });
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
            .setDescription(`Fallback audit logs will now be saved and sent to ${channel}.`)
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

    client.on(Events.GuildMemberAdd, async (member) => {
        const logChannel = await resolveLogChannel(member.guild, 'access');
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

    client.on(Events.GuildMemberRemove, async (member) => {
        const logChannel = await resolveLogChannel(member.guild, 'access');
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

    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        const logChannel = await resolveLogChannel(newMember.guild, 'members');
        if (!logChannel) return;

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;
        const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
        const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

        if (addedRoles.size > 0 || removedRoles.size > 0) {
            const roleChannel = await resolveLogChannel(newMember.guild, 'roles') || logChannel;
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
            return roleChannel.send({ embeds: [embed] }).catch(() => {});
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
            const modChannel = await resolveLogChannel(newMember.guild, 'moderate') || logChannel;
            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL({ dynamic: true }) })
                .setTitle('⏰ Member Timed Out')
                .setDescription(`**User:** ${newMember.user}\n**Until:** <t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F>`)
                .setFooter({ text: `User ID: ${newMember.id}` })
                .setTimestamp();

            return modChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });

    // ==========================================
    // 🎙️ 3. VOICE CHANNEL AUDIT LOGS
    // ==========================================
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const guild = newState.guild || oldState.guild;
        const logChannel = await resolveLogChannel(guild, 'voice');
        if (!logChannel || !newState.member) return;

        const user = newState.member.user;

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
    // 💬 4. MESSAGE AUDIT LOGS (INCLUDES SELF-PURGE)
    // ==========================================

    // SINGLE MESSAGE DELETE (User & Self-Purge/Bot Messages)
    client.on(Events.MessageDelete, async (message) => {
        if (!message.guild) return;

        const logChannel = await resolveLogChannel(message.guild, 'messages');
        if (!logChannel) return;

        // Prevent logging deletions happening inside the log channel itself
        if (message.channel.id === logChannel.id) return;

        const isBotMessage = message.author?.bot;
        const authorTag = message.author 
            ? `${message.author.tag} ${isBotMessage ? '🤖 [Bot/Self-Purge]' : ''}` 
            : 'Unknown Author (Uncached)';
        
        const authorAvatar = message.author 
            ? message.author.displayAvatarURL({ dynamic: true }) 
            : message.guild.iconURL({ dynamic: true });

        const embed = new EmbedBuilder()
            .setColor(isBotMessage ? '#7289DA' : '#ED4245')
            .setAuthor({ name: authorTag, iconURL: authorAvatar })
            .setTitle(isBotMessage ? `🤖 Self-Purge / Bot Message Deleted in #${message.channel.name}` : `🗑️ Message Deleted in #${message.channel.name}`)
            .setDescription(message.content ? message.content : '*[No text content / Attachment or Embed only]*')
            .addFields(
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Author', value: message.author ? `${message.author}` : '`Unknown`', inline: true },
                { name: 'Type', value: isBotMessage ? '`🤖 Bot / Self-Purge`' : '`👤 User Message`', inline: true }
            )
            .setFooter({ text: `User ID: ${message.author?.id || 'N/A'} | Message ID: ${message.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    // MESSAGE EDIT LOGS
    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        if (newMessage.partial) {
            try { await newMessage.fetch(); } catch (e) { return; }
        }

        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const logChannel = await resolveLogChannel(newMessage.guild, 'messages');
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

    // 🧹 SUPREME BULK DELETE / PURGE TRANSCRIPT ENGINE
    client.on(Events.MessageDeleteBulk, async (messages, channel) => {
        if (!channel || !channel.guild) return;

        const logChannel = await resolveLogChannel(channel.guild, 'messages');
        if (!logChannel) return;

        // Prevent logging if purge occurred inside the log channel
        if (channel.id === logChannel.id) return;

        const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        // Fetch Audit Log to identify who triggered the purge
        let executorTag = 'Unknown Staff / Bot Command';
        let executorMention = '`Unknown`';
        try {
            await new Promise(r => setTimeout(r, 1000));
            const fetchedLogs = await channel.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MessageBulkDelete
            }).catch(() => null);

            const bulkLog = fetchedLogs?.entries.first();
            if (bulkLog && (Date.now() - bulkLog.createdTimestamp) < 15000) {
                executorTag = `${bulkLog.executor.tag} (${bulkLog.executor.id})`;
                executorMention = `<@${bulkLog.executor.id}> (\`${bulkLog.executor.tag}\`)`;
            }
        } catch (e) {}

        // Format Professional Text Transcript Header
        let transcriptText = `====================================================================================================\n`;
        transcriptText += `                           STARRY SUPREME AUDIT LOG - PURGE TRANSCRIPT                             \n`;
        transcriptText += `====================================================================================================\n`;
        transcriptText += `Server         : ${channel.guild.name} (ID: ${channel.guild.id})\n`;
        transcriptText += `Channel        : #${channel.name} (ID: ${channel.id})\n`;
        transcriptText += `Purged Count   : ${sortedMessages.length} Messages\n`;
        transcriptText += `Triggered By   : ${executorTag}\n`;
        transcriptText += `Generated At   : ${new Date().toUTCString()}\n`;
        transcriptText += `====================================================================================================\n\n`;

        // Append Each Deleted Message to Transcript
        sortedMessages.forEach((msg, index) => {
            const timeStr = new Date(msg.createdTimestamp).toUTCString();
            const authorTag = msg.author ? `${msg.author.tag} (ID: ${msg.author.id}) ${msg.author.bot ? '[BOT]' : '[USER]'}` : 'Unknown Author';
            const contentStr = msg.content ? msg.content : '[No Text Content / Attachment or Embed Only]';

            transcriptText += `----------------------------------------------------------------------------------------------------\n`;
            transcriptText += `[${String(index + 1).padStart(2, '0')}] MSG ID: ${msg.id} | TIME: ${timeStr}\n`;
            transcriptText += `AUTHOR : ${authorTag}\n`;
            transcriptText += `CONTENT:\n${contentStr}\n`;

            if (msg.attachments && msg.attachments.size > 0) {
                const attachmentUrls = msg.attachments.map(a => a.url).join('\n         ');
                transcriptText += `ATTACHMENTS:\n         ${attachmentUrls}\n`;
            }

            if (msg.embeds && msg.embeds.length > 0) {
                transcriptText += `EMBEDS : [${msg.embeds.length} Embedded Card(s) Present]\n`;
            }
            transcriptText += `----------------------------------------------------------------------------------------------------\n\n`;
        });

        const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');
        const transcriptFile = new AttachmentBuilder(transcriptBuffer, { 
            name: `${channel.guild.name.replace(/[^a-zA-Z0-9]/g, '_')}_PurgeLog_${channel.name}_${Date.now()}.txt` 
        });

        const purgeEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle(`🧹 Bulk Messages Deleted / Purged in #${channel.name}`)
            .setDescription(`A total of **${sortedMessages.length}** messages (including user and self-purged bot messages) were purged from <#${channel.id}>.\nFull details have been compiled into the attached transcript file.`)
            .addFields(
                { name: '📍 Channel', value: `${channel} (\`#${channel.name}\`)`, inline: true },
                { name: '👤 Triggered By', value: executorMention, inline: true },
                { name: '📊 Total Messages', value: `\`${sortedMessages.length}\` Messages`, inline: true }
            )
            .setFooter({ text: `Channel ID: ${channel.id}` })
            .setTimestamp();

        await logChannel.send({ 
            embeds: [purgeEmbed], 
            files: [transcriptFile] 
        }).catch(console.error);
    });

    // ==========================================
    // 🔗 5. INVITE LOGS
    // ==========================================
    client.on(Events.InviteCreate, async (invite) => {
        const logChannel = await resolveLogChannel(invite.guild, 'access');
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
        const logChannel = await resolveLogChannel(invite.guild, 'access');
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
        const logChannel = await resolveLogChannel(channel.guild, 'channels');
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
        const logChannel = await resolveLogChannel(channel.guild, 'channels');
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
        const logChannel = await resolveLogChannel(newChannel.guild, 'channels');
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
        const logChannel = await resolveLogChannel(role.guild, 'roles');
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
        const logChannel = await resolveLogChannel(role.guild, 'roles');
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
        const logChannel = await resolveLogChannel(newRole.guild, 'roles');
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
        const logChannel = await resolveLogChannel(ban.guild, 'moderate');
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
        const logChannel = await resolveLogChannel(ban.guild, 'moderate');
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
        const logChannel = await resolveLogChannel(newGuild, 'misc');
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
        const logChannel = await resolveLogChannel(emoji.guild, 'misc');
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#23A559')
            .setTitle('😃 Custom Emoji Created')
            .setDescription(`**Emoji:** ${emoji} (\`:${emoji.name}:\`)`)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

    client.on(Events.GuildEmojiDelete, async (emoji) => {
        const logChannel = await resolveLogChannel(emoji.guild, 'misc');
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor('#DA373C')
            .setTitle('🗑️ Custom Emoji Deleted')
            .setDescription(`**Emoji Name:** \`:${emoji.name}:\``)
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    });

};

module.exports.LogSettings = LogSettings;
module.exports.setLogsData = setLogsCommand;
