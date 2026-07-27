const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
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

        // BAN
        .addSubcommand(sub => sub
            .setName('ban')
            .setDescription('Ban a user from the server')
            .addUserOption(opt => opt.setName('target').setDescription('The user to ban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban'))
            .addIntegerOption(opt => opt.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7))
        )

        // UNBAN
        .addSubcommand(sub => sub
            .setName('unban')
            .setDescription('Unban a user by ID')
            .addStringOption(opt => opt.setName('userid').setDescription('The ID of the user to unban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban'))
        )

        // KICK
        .addSubcommand(sub => sub
            .setName('kick')
            .setDescription('Kick a member from the server')
            .addUserOption(opt => opt.setName('target').setDescription('The member to kick').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the kick'))
        )

        // TIMEOUT
        .addSubcommand(sub => sub
            .setName('timeout')
            .setDescription('Timeout/Mute a member')
            .addUserOption(opt => opt.setName('target').setDescription('The member to timeout').setRequired(true))
            .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the timeout'))
        )

        // UNTIMEOUT
        .addSubcommand(sub => sub
            .setName('untimeout')
            .setDescription('Remove timeout from a member')
            .addUserOption(opt => opt.setName('target').setDescription('The member to untimeout').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for untimeout'))
        )

        // PURGE / CLEAR
        .addSubcommand(sub => sub
            .setName('purge')
            .setDescription('Delete/Clear bulk messages from a channel')
            .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
            .addUserOption(opt => opt.setName('target').setDescription('Filter messages by target user'))
        )

        // WARN
        .addSubcommand(sub => sub
            .setName('warn')
            .setDescription('Warn a user')
            .addUserOption(opt => opt.setName('target').setDescription('The user to warn').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setRequired(true))
        )

        // WARNINGS
        .addSubcommand(sub => sub
            .setName('warnings')
            .setDescription('View warnings for a user')
            .addUserOption(opt => opt.setName('target').setDescription('The user to inspect').setRequired(true))
        )

        // CLEAR WARNS
        .addSubcommand(sub => sub
            .setName('clearwarns')
            .setDescription('Clear all warnings for a user')
            .addUserOption(opt => opt.setName('target').setDescription('The user to clear warnings for').setRequired(true))
        )

        // MOD PANEL
        .addSubcommand(sub => sub
            .setName('panel')
            .setDescription('Open an interactive Moderation Control Panel for a user')
            .addUserOption(opt => opt.setName('target').setDescription('The member to moderate').setRequired(true))
        )

        // LOCKDOWN
        .addSubcommand(sub => sub
            .setName('lockdown')
            .setDescription('Lock a text channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lock').addChannelTypes(ChannelType.GuildText))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for lockdown'))
        )

        // UNLOCK
        .addSubcommand(sub => sub
            .setName('unlock')
            .setDescription('Unlock a text channel')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock').addChannelTypes(ChannelType.GuildText))
        )

        // NICKNAME
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

        const checkUserPerm = (requiredPerm) => {
            if (isOwner) return true;
            return member.permissions.has(requiredPerm);
        };

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
                case 'ban': {
                    if (!checkUserPerm(PermissionFlagsBits.BanMembers)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetUser = options.getUser('target');
                    const reason = options.getString('reason') || 'No reason provided';
                    const deleteDays = options.getInteger('delete_days') || 0;
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (targetMember && !canModerate(targetMember)) return interaction.editReply({ content: '❌ Cannot ban due to role hierarchy.' });
                    if (targetMember && !targetMember.bannable && !isOwner) return interaction.editReply({ content: '❌ Bot lacks permission.' });

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

                case 'unban': {
                    if (!checkUserPerm(PermissionFlagsBits.BanMembers)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const userId = options.getString('userid');
                    const reason = options.getString('reason') || 'No reason provided';

                    try {
                        await guild.members.unban(userId, `${reason} | By: ${user.tag}`);
                    } catch (err) {
                        return interaction.editReply({ content: `❌ Failed to unban ID \`${userId}\`.` });
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

                case 'kick': {
                    if (!checkUserPerm(PermissionFlagsBits.KickMembers)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetUser = options.getUser('target');
                    const reason = options.getString('reason') || 'No reason provided';
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (!targetMember) return interaction.editReply({ content: '❌ User not in server.' });
                    if (!canModerate(targetMember)) return interaction.editReply({ content: '❌ Hierarchy protection triggered.' });

                    await targetMember.kick(`${reason} | By: ${user.tag}`);

                    const embed = new EmbedBuilder()
                        .setTitle('🥾 Member Kicked')
                        .setColor('#ffa502')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag}`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'timeout': {
                    if (!checkUserPerm(PermissionFlagsBits.ModerateMembers)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetUser = options.getUser('target');
                    const durationMins = options.getInteger('duration');
                    const reason = options.getString('reason') || 'No reason provided';
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (!targetMember) return interaction.editReply({ content: '❌ User not in server.' });
                    if (!canModerate(targetMember)) return interaction.editReply({ content: '❌ Hierarchy protection triggered.' });

                    await targetMember.timeout(durationMins * 60 * 1000, `${reason} | By: ${user.tag}`);

                    const embed = new EmbedBuilder()
                        .setTitle('⏰ Member Timed Out')
                        .setColor('#eccc68')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag}`, inline: true },
                            { name: 'Duration', value: `${durationMins}m`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'untimeout': {
                    if (!checkUserPerm(PermissionFlagsBits.ModerateMembers)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetUser = options.getUser('target');
                    const reason = options.getString('reason') || 'No reason provided';
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (!targetMember) return interaction.editReply({ content: '❌ User not in server.' });

                    await targetMember.timeout(null, `${reason} | By: ${user.tag}`);

                    const embed = new EmbedBuilder()
                        .setTitle('🔊 Timeout Removed')
                        .setColor('#70a1ff')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag}`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'purge': {
                    if (!checkUserPerm(PermissionFlagsBits.ManageMessages)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const amount = options.getInteger('amount');
                    const targetFilter = options.getUser('target');
                    const channel = interaction.channel;

                    const fetched = await channel.messages.fetch({ limit: amount });
                    const toDelete = targetFilter ? fetched.filter(m => m.author.id === targetFilter.id) : fetched;
                    const deleted = await channel.bulkDelete(toDelete, true);

                    const embed = new EmbedBuilder()
                        .setTitle('🧹 Messages Cleared')
                        .setColor('#70a1ff')
                        .addFields(
                            { name: 'Deleted Count', value: `${deleted.size} messages`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'warn': {
                    if (!checkUserPerm(PermissionFlagsBits.ModerateMembers)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetUser = options.getUser('target');
                    const reason = options.getString('reason');

                    await targetUser.send(`⚠️ You were warned in **${guild.name}** for: ${reason}`).catch(() => null);

                    const embed = new EmbedBuilder()
                        .setTitle('⚠️ User Warned')
                        .setColor('#eccc68')
                        .addFields(
                            { name: 'Target', value: `${targetUser.tag}`, inline: true },
                            { name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}`, inline: true },
                            { name: 'Reason', value: reason }
                        )
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'warnings': {
                    const targetUser = options.getUser('target');
                    const embed = new EmbedBuilder()
                        .setTitle(`📋 Warnings for ${targetUser.tag}`)
                        .setColor('#70a1ff')
                        .setDescription(`Displaying active warnings logged for <@${targetUser.id}>.`)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'clearwarns': {
                    if (!checkUserPerm(PermissionFlagsBits.ModerateMembers)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetUser = options.getUser('target');

                    const embed = new EmbedBuilder()
                        .setTitle('🧹 Warnings Cleared')
                        .setColor('#2ed573')
                        .setDescription(`Cleared all active warnings for <@${targetUser.id}>.`)
                        .addFields({ name: 'Moderator', value: `${user.tag} ${isOwner ? '👑 *(Owner)*' : ''}` })
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'panel': {
                    if (!checkUserPerm(PermissionFlagsBits.ModerateMembers)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetUser = options.getUser('target');
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    const embed = new EmbedBuilder()
                        .setTitle(`🛡️ Moderation Control Panel`)
                        .setColor('#5f27cd')
                        .setThumbnail(targetUser.displayAvatarURL())
                        .addFields(
                            { name: 'Target User', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                            { name: 'Joined Server', value: targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : 'Not in server', inline: true },
                            { name: 'Roles', value: targetMember ? `${targetMember.roles.cache.size - 1}` : 'N/A', inline: true }
                        )
                        .setFooter({ text: `Requested by ${user.tag}`, iconURL: user.displayAvatarURL() });

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`mod_warn_${targetUser.id}`).setLabel('Warn').setStyle(ButtonStyle.Warning),
                        new ButtonBuilder().setCustomId(`mod_timeout_${targetUser.id}`).setLabel('Timeout').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId(`mod_kick_${targetUser.id}`).setLabel('Kick').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId(`mod_ban_${targetUser.id}`).setLabel('Ban').setStyle(ButtonStyle.Danger)
                    );

                    return interaction.editReply({ embeds: [embed], components: [row] });
                }

                case 'lockdown': {
                    if (!checkUserPerm(PermissionFlagsBits.ManageChannels)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetChannel = options.getChannel('channel') || interaction.channel;
                    const reason = options.getString('reason') || 'No reason provided';

                    await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: `Lockdown: ${reason}` });

                    const embed = new EmbedBuilder()
                        .setTitle('🔒 Channel Locked')
                        .setColor('#ff4757')
                        .addFields({ name: 'Channel', value: `${targetChannel}`, inline: true }, { name: 'Reason', value: reason })
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'unlock': {
                    if (!checkUserPerm(PermissionFlagsBits.ManageChannels)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetChannel = options.getChannel('channel') || interaction.channel;

                    await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });

                    const embed = new EmbedBuilder()
                        .setTitle('🔓 Channel Unlocked')
                        .setColor('#2ed573')
                        .addFields({ name: 'Channel', value: `${targetChannel}`, inline: true })
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }

                case 'nick': {
                    if (!checkUserPerm(PermissionFlagsBits.ManageNicknames)) return interaction.editReply({ content: '❌ Permission denied.' });
                    const targetUser = options.getUser('target');
                    const newNick = options.getString('nickname') || null;
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

                    if (!targetMember) return interaction.editReply({ content: '❌ User not in server.' });
                    if (!canModerate(targetMember)) return interaction.editReply({ content: '❌ Hierarchy protection triggered.' });

                    await targetMember.setNickname(newNick);

                    const embed = new EmbedBuilder()
                        .setTitle('🏷️ Nickname Updated')
                        .setColor('#1e90ff')
                        .addFields({ name: 'Target', value: `${targetUser.tag}`, inline: true }, { name: 'New Nickname', value: newNick ? `\`${newNick}\`` : '*Reset*', inline: true })
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
