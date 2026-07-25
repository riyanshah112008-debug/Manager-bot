const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('💋 Give someone a sweet anime kiss (Works in DMs too!)')
        .setContexts([0, 1, 2]) // 0: Guild, 1: Bot DM, 2: Private Channel
        .setIntegrationTypes([0, 1]) // 0: Guild Install, 1: User Install
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to kiss')
                .setRequired(true)
        ),

    async execute(interaction) {
        // We defer the reply so the bot has a second to fetch the API without timing out
        await interaction.deferReply();
        const target = interaction.options.getUser('target');

        try {
            // Fetch a random, guaranteed-working kiss GIF from the API
            const response = await fetch('https://api.waifu.pics/sfw/kiss');
            const data = await response.json();

            const embed = new EmbedBuilder()
                .setColor('#FFB6C1')
                .setDescription(`💋 **${interaction.user.username}** kissed **${target.username}**!`)
                .setImage(data.url);

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching kiss gif:', error);
            // Fallback in case the API ever goes down
            return interaction.editReply(`💋 **${interaction.user.username}** kissed **${target.username}**! *(Image failed to load)*`);
        }
    }
};
