const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const BumpSystem = require('../../models/BumpSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bump-setup')
        .setDescription('Configure the auto-bump reminder system.')
        .addRoleOption(option => 
            option.setName('ping_role')
            .setDescription('The role to ping when the 2-hour cooldown is over.')
            .setRequired(false))
        .addChannelOption(option =>
            option.setName('channel')
            .setDescription('The channel to send the reminder in.')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const pingRole = interaction.options.getRole('ping_role');
        const channel = interaction.options.getChannel('channel');

        // Fetch or create database entry
        let bumpData = await BumpSystem.findOne({ guildId: interaction.guild.id });
        if (!bumpData) bumpData = new BumpSystem({ guildId: interaction.guild.id });

        // Update preferences
        if (pingRole) bumpData.pingRoleId = pingRole.id;
        if (channel) bumpData.reminderChannelId = channel.id;

        await bumpData.save();

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Bump Reminders Configured')
            .setDescription('The auto-bumper system has been updated!')
            .addFields(
                { name: 'Reminder Channel', value: bumpData.reminderChannelId ? `<#${bumpData.reminderChannelId}>` : '`Not Set (Defaults to Bump Channel)`', inline: true },
                { name: 'Role to Ping', value: bumpData.pingRoleId ? `<@&${bumpData.pingRoleId}>` : '`None`', inline: true }
            );

        return interaction.editReply({ embeds: [embed] });
    }
};
