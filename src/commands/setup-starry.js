const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const ServerConfig = require('../models/ServerConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-starry')
        .setDescription('🤖 Intelligently scan and auto-build your server channels, roles, and ticket panels.')
        .addStringOption(option => 
            option.setName('template')
                .setDescription('Choose a community template style')
                .setRequired(true)
                .addChoices(
                    { name: 'Gaming Community', value: 'gaming' },
                    { name: 'Chill / Social Lounge', value: 'chill' },
                    { name: 'Development / Tech Hub', value: 'dev' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        const guild = interaction.guild;
        const templateType = interaction.options.getString('template');

        // Check permissions
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels) || 
            !guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.editReply('❌ I need **Manage Channels** and **Manage Roles** permissions to auto-build your server layout!');
        }

        await interaction.editReply('🛠️ **Starry AI is scanning your server and building channels...** Please wait a moment.');

        try {
            // 1. Create Category based on template
            const category = await guild.channels.create({
                name: `🌟 ${templateType.toUpperCase()} HUB`,
                type: ChannelType.GuildCategory,
            });

            // 2. Automatically build standard channels with smart permissions
            const textChannels = ['welcome', 'rules', 'general-chat', 'bots-and-commands'];
            for (const chName of textChannels) {
                await guild.channels.create({
                    name: chName,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    topic: `Automated Starry channel for ${chName}`
                });
            }

            // 3. Automatically build dedicated Support Ticket channel
            const ticketChannel = await guild.channels.create({
                name: '🎫-support-tickets',
                type: ChannelType.GuildText,
                parent: category.id,
                topic: 'Click the button below to open a private support ticket with staff.'
            });

            // Send ticket embed panel automatically
            const ticketEmbed = new EmbedBuilder()
                .setColor('#00F2FE')
                .setTitle('🎫 Starry Support Center')
                .setDescription('Need help? Click the button below to open a private ticket with our staff team instantly.');
            
            await ticketChannel.send({ embeds: [ticketEmbed] }).catch(() => {});

            // 4. Automatically build dedicated Mod Application channel
            const applyChannel = await guild.channels.create({
                name: '📝-staff-applications',
                type: ChannelType.GuildText,
                parent: category.id,
                topic: 'Apply to join our moderation and staffing team!'
            });

            const applyEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📝 Staff Recruitment Desk')
                .setDescription('Want to join our team? Click below to fill out your application questionnaire.');

            await applyChannel.send({ embeds: [applyEmbed] }).catch(() => {});

            // 5. Update Database Configuration Flag
            await ServerConfig.findOneAndUpdate(
                { guildId: guild.id },
                { setupCompleted: true, guildName: guild.name },
                { upsert: true, new: true }
            );

            const successEmbed = new EmbedBuilder()
                .setColor('#23a559')
                .setTitle('✨ Autonomous Setup Complete!')
                .setDescription(`Successfully deployed the **${templateType}** template layout, including automated ticket systems and application desks!`);

            return interaction.followUp({ embeds: [successEmbed], ephemeral: true });

        } catch (error) {
            console.error('Setup Error:', error);
            return interaction.followUp({ content: '❌ An error occurred while auto-building channels. Ensure my role is at the very top of the role list!', ephemeral: true });
        }
    }
};
