const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ChannelType 
} = require('discord.js');

// Bot Owners with absolute moderation bypass
const BOT_OWNERS = ['1465049039153135639', '1257676837249617971'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription('Supreme all-in-one moderation command suite')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

        // Subcommand: BAN
        .addSubcommand(sub => sub
            .setName('ban')
            .setDescription('Ban a user from the server')
            .addUserOption(opt => opt.setName('target').setDescription('The user to ban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban'))
            .addIntegerOption(opt => opt.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7))
        )

        // Subcommand: UNBAN
        .addSubcommand(sub => sub
            .setName('unban')
            .setDescription('Unban a user by ID')
            .addStringOption(opt => opt.setName('userid').setDescription('The ID of the user to unban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban'))
        )

        // Subcommand: KICK
        .addSubcommand(sub => sub
            .setName('kick')
            .setDescription('Kick a member from the server')
            .addUserOption(opt => opt.setName('target').setDescription('The member to kick').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the kick'))
        )

        // Subcommand: TIMEOUT
        .addSubcommand(sub => sub
            .setName('timeout')
            .setDescription('Timeout/Mute a member')
            .addUserOption(opt => opt.setName('target').setDescription('The member to timeout').setRequired(true))
            .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the timeout'))
        )

        // Subcommand: UNTIMEOUT
        .addSubcommand(sub => sub
            .setName('untimeout')
            .setDescription('Remove timeout from a member')
            .addUserOption(opt => opt.setName('target').setDescription('The member to untimeout').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for untimeout'))
        )

        // Subcommand: PURGE
        .addSubcommand(sub => sub
            .setName('purge')
            .setDescription('Delete messages from a channel')
            .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
            .addUserOption(opt => opt.setName('target').setDescription('Filter messages by target user'))
        )

        // Subcommand: LOCKDOWN
        .addSubcommand(sub => sub
            .setName('lockdown')
            .setDescription('Lock a text channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock (defaults to current)').addChannelTypes(ChannelType.GuildText))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for lockdown'))
        )

        // Subcommand: UNLOCK
        .addSubcommand(sub => sub
            .setName('unlock')
            .setDescription('Unlock a text channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock (defaults to current)').addChannelTypes(ChannelType.GuildText))
        )

        // Subcommand: NICKNAME
        .addSubcommand(sub => sub
            .setName('nick')
            .setDescription('Change a user\'s nickname')
            .addUserOption(opt => opt.setName('target').setDescription('The member to nick').setRequired(true))
            .addStringOption(opt => opt.setName('nickname').setDescription('New nickname (leave blank to reset)'))
        ),

    async execute(interaction) {
        const { guild, member, options, user } = interaction;
        const subcommand = options.getSubcommand();
        const isOwner = BOT_OWNERS.includes(user.id);

        // Helper to check user permissions (Bypassed by Bot Owners)
        const checkUserPerm = (requiredPerm) => {
            if (isOwner) return true;
            return member.permissions.has(requiredPerm);
        };

        // Helper for role hierarchy checks (Bypassed by Bot Owners)
        const canModerate = (targetMember) => {
            if (isOwner) return true;
            if (!targetMember) return true;
            if (targetMember.id === user.id) return false;
            if (targetMember.roles.highest.position >= member.roles.highest.position) return false;
            return true;
        };

        await interaction.deferReply({ ephemeral: true });

        try {
            switch (subcommand) {
                // --- BAN ---
                case 'ban': {
                    if (!checkUserPerm(PermissionFlagsBits.BanMembers)) {
                        return interaction.editReply({ content: '❌ You need `Ban Members` permission.' });
                    }
                    const targetUser = options.getUser('target');
                    const reason = options.getString('reason') || 'No reason provided';
                    const deleteDays = options.getInteger('delete_days') || 0;
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (targetMember && !canModerate(targetMember)) {
                        return interaction.editReply({ content: '❌ You cannot ban this user due to role hierarchy.' });
                    }
                    if (targetMember && !targetMember.bannable && !isOwner) {
                        return interaction.editReply({ content: '❌ Bot lacks permission to ban this member.' });
                    }

                    await guild.members.ban(targetUser.id, { reason: `${reason} | By: ${user.tag}`, deleteMessageSeconds: deleteDays * 86400 });

                    const embed = new EmbedBuilder()
                        .setTitle('🔨 User Banned')
                        .setColor('#ff4757')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                // --- UNBAN ---
                case 'unban': {
                    if (!checkUserPerm(PermissionFlagsBits.BanMembers)) {
                        return interaction.editReply({ content: '❌ You need `Ban Members` permission.' });
                    }
                    const userId = options.getString('userid');
                    const reason = options.getString('reason') || 'No reason provided';

                    try {
                        await guild.members.unban(userId, `${reason} | By: ${user.tag}`);
                    } catch (err) {
                        return interaction.editReply({ content: `❌ Failed to unban ID \`${userId}\`. Verify the user ID.` });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('🔓 User Unbanned')
                        .setColor('#2ed573')
                        .addFields(
                            { name: 'User ID', value: `\`${userId}\``, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                // --- KICK ---
                case 'kick': {
                    if (!checkUserPerm(PermissionFlagsBits.KickMembers)) {
                        return interaction.editReply({ content: '❌ You need `Kick Members` permission.' });
                    }
                    const targetUser = options.getUser('target');
                    const reason = options.getString('reason') || 'No reason provided';
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (!targetMember) return interaction.editReply({ content: '❌ User is not in this server.' });
                    if (!canModerate(targetMember)) return interaction.editReply({ content: '❌ Cannot kick user due to role hierarchy.' });
                    if (!targetMember.kickable && !isOwner) return interaction.editReply({ content: '❌ Bot lacks permission to kick this member.' });

                    await targetMember.kick(`${reason} | By: ${user.tag}`);

                    const embed = new EmbedBuilder()
                        .setTitle('🥾 Member Kicked')
                        .setColor('#ffa502')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                // --- TIMEOUT ---
                case 'timeout': {
                    if (!checkUserPerm(PermissionFlagsBits.ModerateMembers)) {
                        return interaction.editReply({ content: '❌ You need `Moderate Members` permission.' });
                    }
                    const targetUser = options.getUser('target');
                    const durationMins = options.getInteger('duration');
                    const reason = options.getString('reason') || 'No reason provided';
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (!targetMember) return interaction.editReply({ content: '❌ User is not in this server.' });
                    if (!canModerate(targetMember)) return interaction.editReply({ content: '❌ Cannot timeout user due to role hierarchy.' });

                    await targetMember.timeout(durationMins * 60 * 1000, `${reason} | By: ${user.tag}`);

                    const embed = new EmbedBuilder()
                        .setTitle('⏰ Member Timed Out')
                        .setColor('#eccc68')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag}`, inline: true },
                            { name: 'Duration', value: `${durationMins} minutes`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                // --- UNTIMEOUT ---
                case 'untimeout': {
                    if (!checkUserPerm(PermissionFlagsBits.ModerateMembers)) {
                        return interaction.editReply({ content: '❌ You need `Moderate Members` permission.' });
                    }
                    const targetUser = options.getUser('target');
                    const reason = options.getString('reason') || 'No reason provided';
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (!targetMember) return interaction.editReply({ content: '❌ User is not in this server.' });

                    await targetMember.timeout(null, `${reason} | By: ${user.tag}`);

                    const embed = new EmbedBuilder()
                        .setTitle('🔊 Timeout Removed')
                        .setColor('#70a1ff')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag}`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                // --- PURGE ---
                case 'purge': {
                    if (!checkUserPerm(PermissionFlagsBits.ManageMessages)) {
                        return interaction.editReply({ content: '❌ You need `Manage Messages` permission.' });
                    }
                    const amount = options.getInteger('amount');
                    const targetFilter = options.getUser('target');
                    const channel = interaction.channel;

                    const fetched = await channel.messages.fetch({ limit: amount });
                    const toDelete = targetFilter ? fetched.filter(m => m.author.id === targetFilter.id) : fetched;
                    const deleted = await channel.bulkDelete(toDelete, true);

                    const embed = new EmbedBuilder()
                        .setTitle('🧹 Messages Purged')
                        .setColor('#70a1ff')
                        .addFields(
                            { name: 'Deleted Count', value: `${deleted.size} messages`, inline: true },
                            { name: 'Channel', value: `${channel}`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                // --- LOCKDOWN ---
                case 'lockdown': {
                    if (!checkUserPerm(PermissionFlagsBits.ManageChannels)) {
                        return interaction.editReply({ content: '❌ You need `Manage Channels` permission.' });
                    }
                    const targetChannel = options.getChannel('channel') || interaction.channel;
                    const reason = options.getString('reason') || 'No reason provided';

                    await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: `Lockdown by ${user.tag}: ${reason}` });

                    const embed = new EmbedBuilder()
                        .setTitle('🔒 Channel Locked')
                        .setColor('#ff4757')
                        .addFields(
                            { name: 'Channel', value: `${targetChannel}`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                // --- UNLOCK ---
                case 'unlock': {
                    if (!checkUserPerm(PermissionFlagsBits.ManageChannels)) {
                        return interaction.editReply({ content: '❌ You need `Manage Channels` permission.' });
                    }
                    const targetChannel = options.getChannel('channel') || interaction.channel;

                    await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }, { reason: `Unlocked by ${user.tag}` });

                    const embed = new EmbedBuilder()
                        .setTitle('🔓 Channel Unlocked')
                        .setColor('#2ed573')
                        .addFields(
                            { name: 'Channel', value: `${targetChannel}`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                // --- NICKNAME ---
                case 'nick': {
                    if (!checkUserPerm(PermissionFlagsBits.ManageNicknames)) {
                        return interaction.editReply({ content: '❌ You need `Manage Nicknames` permission.' });
                    }
                    const targetUser = options.getUser('target');
                    const newNick = options.getString('nickname') || null;
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (!targetMember) return interaction.editReply({ content: '❌ User is not in this server.' });
                    if (!canModerate(targetMember)) return interaction.editReply({ content: '❌ Cannot change nickname due to role hierarchy.' });

                    await targetMember.setNickname(newNick, `Changed by ${user.tag}`);

                    const embed = new EmbedBuilder()
                        .setTitle('🏷️ Nickname Updated')
                        .setColor('#1e90ff')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag}`, inline: true },
                            { name: 'New Nickname', value: newNick ? `\`${newNick}\`` : '*Reset*', inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                default:
                    return interaction.editReply({ content: '❌ Unknown subcommand.' });
            }
        } catch (error) {
            console.error(`Error in /mod ${subcommand}:`, error);
            return interaction.editReply({ content: `❌ An error occurred: \`${error.message}\`` });
        }
    }
};
