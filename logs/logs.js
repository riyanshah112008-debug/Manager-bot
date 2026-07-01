const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getConfig, saveConfig } = require('./logManager'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Manage the server logging system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set the channel where logs will be sent.')
                .addChannelOption(option => 
                    option.setName('channel')
                    .setDescription('The channel to send logs to.')
                    .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Turn off server logging.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        // Load the current configuration
        let config = getConfig();
        if (!config[guildId]) {
            config[guildId] = {};
        }

        // Handle the "/logs set" command
        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel');
            
            // Save the chosen channel ID to your logManager
            config[guildId].logChannel = channel.id;
            saveConfig(config);

            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Logs Configured')
                .setDescription(`All server logs will now be sent to ${channel}.`);

            return interaction.reply({ embeds: [embed] });
        }

        // Handle the "/logs disable" command
        if (subcommand === 'disable') {
            // Remove the channel ID to stop logging
            config[guildId].logChannel = null;
            saveConfig(config);

            const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('🚫 Logs Disabled')
                .setDescription('The logging system has been completely turned off.');

            return interaction.reply({ embeds: [embed] });
        }
    }
}; // <-- This is the single, clean closing bracket that fixes your crash!
