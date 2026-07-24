const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-server')
        .setDescription('Automatically generates a professional server layout (Roles, Categories, Channels)!')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Strictly Admins Only

    async execute(interaction, client) {
        // 1. Send Confirmation Prompt
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle('🏗️ Server Auto-Builder')
            .setDescription(
                '**Are you sure you want to run the Server Builder?**\n\n' +
                'This will automatically create:\n' +
                '🛡️ Basic Roles (Admin, Moderator, Member)\n' +
                '📢 Information Category (Rules, Announcements)\n' +
                '💬 Community Category (General, Media, Commands)\n' +
                '🔒 Staff Category (Private Mod Chat)\n\n' +
                '*Note: This will not delete your existing channels, it just adds new ones.*'
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('build_confirm').setLabel('Yes, Build It!').setStyle(ButtonStyle.Success).setEmoji('🔨'),
            new ButtonBuilder().setCustomId('build_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        // 2. Wait for Button Click
        const filter = i => i.user.id === interaction.user.id;
        try {
            const confirmation = await response.awaitMessageComponent({ filter, time: 60000 });

            if (confirmation.customId === 'build_cancel') {
                return confirmation.update({ content: '🚫 Server build canceled.', embeds: [], components: [] });
            }

            // --- 🚀 STARTING THE BUILD PROCESS ---
            await confirmation.update({ content: '⏳ **Building your server... Please wait!**', embeds: [], components: [] });
            const guild = interaction.guild;

            // 3. Create Roles
            const adminRole = await guild.roles.create({ name: 'Admin', color: '#e74c3c', permissions: [PermissionFlagsBits.Administrator], reason: 'Auto-Setup' });
            const modRole = await guild.roles.create({ name: 'Moderator', color: '#3498db', permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers], reason: 'Auto-Setup' });
            const memberRole = await guild.roles.create({ name: 'Member', color: '#2ecc71', reason: 'Auto-Setup' });

            // 4. Create Categories & Channels

            // --- CATEGORY: INFORMATION ---
            const infoCategory = await guild.channels.create({
                name: '📌 INFORMATION',
                type: ChannelType.GuildCategory,
                position: 1
            });

            // Rules Channel (Locked for members, Admins can type)
            await guild.channels.create({
                name: '📜-rules',
                type: ChannelType.GuildText,
                parent: infoCategory.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.SendMessages] }, // @everyone can't type
                    { id: adminRole.id, allow: [PermissionFlagsBits.SendMessages] }
                ]
            });

            // Announcements Channel
            await guild.channels.create({
                name: '📢-announcements',
                type: ChannelType.GuildText,
                parent: infoCategory.id,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
                    { id: adminRole.id, allow: [PermissionFlagsBits.SendMessages] }
                ]
            });

            // --- CATEGORY: COMMUNITY ---
            const communityCategory = await guild.channels.create({
                name: '💬 COMMUNITY',
                type: ChannelType.GuildCategory,
                position: 2
            });

            await guild.channels.create({ name: '💬-general', type: ChannelType.GuildText, parent: communityCategory.id });
            await guild.channels.create({ name: '📷-media', type: ChannelType.GuildText, parent: communityCategory.id });
            await guild.channels.create({ name: '🤖-bot-commands', type: ChannelType.GuildText, parent: communityCategory.id });
            await guild.channels.create({ name: '🔊 General Voice', type: ChannelType.GuildVoice, parent: communityCategory.id });

            // --- CATEGORY: STAFF ONLY ---
            const staffCategory = await guild.channels.create({
                name: '🛡️ STAFF AREA',
                type: ChannelType.GuildCategory,
                position: 3,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // Hide from everyone
                    { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel] }, // Allow Admins
                    { id: modRole.id, allow: [PermissionFlagsBits.ViewChannel] } // Allow Mods
                ]
            });

            await guild.channels.create({ name: '🔒-staff-chat', type: ChannelType.GuildText, parent: staffCategory.id });
            await guild.channels.create({ name: '🔒 Staff Voice', type: ChannelType.GuildVoice, parent: staffCategory.id });

            // 5. Success Message!
            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ Server Built Successfully!')
                .setDescription('Starry has finished setting up your server. You can now tweak the channels and roles to your liking!\n\n**Tip:** Give yourself the new `Admin` role in Server Settings!')
                .setFooter({ text: 'Starry Auto-Builder', iconURL: client.user.displayAvatarURL() });

            await interaction.followUp({ embeds: [successEmbed], ephemeral: true });

        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: '⚠️ You took too long to confirm, or an error occurred. Please try again.', embeds: [], components: [] });
        }
    }
};
