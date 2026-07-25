const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// 25 Unique Anime Hug GIFs
const HUG_GIFS = [
    'https://media.tenor.com/kKvrHj-SAvMAAAAC/anime-hug.gif',
    'https://media.tenor.com/xIuXbMtA38sAAAAC/anime-hug.gif',
    'https://media.tenor.com/G_RlGfqGlqcAAAAC/anime-hug.gif',
    'https://media.tenor.com/9e1aE_x4Nc4AAAAC/anime-hug.gif',
    'https://media.tenor.com/J7eIlqcG_2cAAAAC/anime-hug.gif',
    'https://media.tenor.com/8-aB6iM1H-0AAAAC/anime-hug.gif',
    'https://media.tenor.com/n7g1bQY1Y3UAAAAC/anime-hug.gif',
    'https://media.tenor.com/X-L1s6T3-2wAAAAC/anime-hug.gif',
    'https://media.tenor.com/vi4kI35Z0JMAAAAC/anime-hug.gif',
    'https://media.tenor.com/X5nB-41Kav4AAAAC/anime-hug.gif',
    'https://media.tenor.com/B94vXzYqE70AAAAC/anime-hug.gif',
    'https://media.tenor.com/qF7mO4nnL0sAAAAC/anime-hug.gif',
    'https://media.tenor.com/a97qP5P45hUAAAAC/anime-hug.gif',
    'https://media.tenor.com/z2QaiBZCLCQAAAAC/anime-hug.gif',
    'https://media.tenor.com/OxaEbqjG2OQAAAAC/anime-hug.gif',
    'https://media.giphy.com/media/lrr9cScdxKCE/giphy.gif',
    'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
    'https://media.giphy.com/media/3M4NpbLCTxBqU/giphy.gif',
    'https://media.giphy.com/media/wnsgren9NtITS/giphy.gif',
    'https://media.giphy.com/media/qscdhWs5o3yb6/giphy.gif',
    'https://media.giphy.com/media/143v0Z4767T15e/giphy.gif',
    'https://media.giphy.com/media/kvKFM3UWg2P04/giphy.gif',
    'https://media.giphy.com/media/u9BxQbM5bxvwY/giphy.gif',
    'https://media.giphy.com/media/Vz58J8shFW6BvqnYTm/giphy.gif',
    'https://media.giphy.com/media/svXXBgduBsJ1u/giphy.gif'
];

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
        const target = interaction.options.getUser('target');
        const randomGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];

        const embed = new EmbedBuilder()
            .setColor('#FF9494')
            .setDescription(`🤗 **${interaction.user.username}** gave **${target.username}** a big warm hug!`)
            .setImage(randomGif);

        return interaction.reply({ embeds: [embed] });
    }
};
