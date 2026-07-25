const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('🤗 Give someone a warm anime hug (Works in DMs too!)')
        .setContexts([0, 1, 2]) // 0: Guild, 1: Bot DM, 2: Private Channel
        .setIntegrationTypes([0, 1]) // 0: Guild Install, 1: User Install
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to hug')
                .setRequired(true)
        ),

    async execute(interaction) {
        // We defer the reply so the bot has a second to fetch the API without timing out
        await interaction.deferReply();
        const target = interaction.options.getUser('target');

        try {
            // Fetch a random, guaranteed-working hug GIF from the API
            const response = await fetch('https://api.waifu.pics/sfw/hug');
            const data = await response.json();

            const embed = new EmbedBuilder()
                .setColor('#FF9494')
                .setDescription(`🤗 **${interaction.user.username}** gave **${target.username}** a big warm hug!`)
                .setImage(data.url);

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching hug gif:', error);
            // Fallback in case the API ever goes down
            return interaction.editReply(`🤗 **${interaction.user.username}** gave **${target.username}** a big warm hug! *(Image failed to load)*`);
        }
    }
};
