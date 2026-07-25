const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// 25 Unique Anime Kiss GIFs
const KISS_GIFS = [
    'https://media.tenor.com/gzaT07Fk4UoAAAAC/anime-kiss.gif',
    'https://media.tenor.com/F02Ep3b_dIgAAAAC/anime-kiss.gif',
    'https://media.tenor.com/etSTc3aWspcAAAAC/anime-kiss.gif',
    'https://media.tenor.com/lYHV1vwa-FkAAAAC/anime-kiss.gif',
    'https://media.tenor.com/I8kWjuAtX-QAAAAC/anime-kiss.gif',
    'https://media.tenor.com/I9Z44UqA4UIAAAAC/anime-kiss.gif',
    'https://media.tenor.com/PZc3XgM-a5IAAAAC/anime-kiss.gif',
    'https://media.tenor.com/1Gj23LpA7WMAAAAC/anime-kiss.gif',
    'https://media.tenor.com/QfL2Piv3K3wAAAAC/anime-kiss.gif',
    'https://media.tenor.com/h5e17uVzL7MAAAAC/anime-kiss.gif',
    'https://media.tenor.com/nEID0Jro6V8AAAAC/anime-kiss.gif',
    'https://media.tenor.com/5J3mEaWpCMAAAAAC/anime-kiss.gif',
    'https://media.tenor.com/dpv2qQf-J8cAAAAC/anime-kiss.gif',
    'https://media.tenor.com/7sZ60E5g56IAAAAC/anime-kiss.gif',
    'https://media.tenor.com/X8B2hH861u8AAAAC/anime-kiss.gif',
    'https://media.tenor.com/WOV8L_k8F0YAAAAC/anime-kiss.gif',
    'https://media.giphy.com/media/G3va39rn8E4A8/giphy.gif',
    'https://media.giphy.com/media/bm2O3nXTcKJeU/giphy.gif',
    'https://media.giphy.com/media/Fq1yAOHgP153q/giphy.gif',
    'https://media.giphy.com/media/11k3oaUjSlzEQ/giphy.gif',
    'https://media.giphy.com/media/wOtkVwroWEjpK/giphy.gif',
    'https://media.giphy.com/media/12VXIxKaIEarL2/giphy.gif',
    'https://media.giphy.com/media/KmeIYo9IGBoGY/giphy.gif',
    'https://media.giphy.com/media/flqH15r2B4U9O/giphy.gif',
    'https://media.tenor.com/_qE8iNq_pW8AAAAC/anime-kiss.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('💋 Give someone a sweet anime kiss (Works in DMs too!)')
        // 🚨 UPGRADED: Modern DM and Context Handling
        .setContexts([0, 1, 2]) // 0: Guild, 1: Bot DM, 2: Private Channel
        .setIntegrationTypes([0, 1]) // 0: Guild Install, 1: User Install
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to kiss')
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const randomGif = KISS_GIFS[Math.floor(Math.random() * KISS_GIFS.length)];

        const embed = new EmbedBuilder()
            .setColor('#FFB6C1')
            .setDescription(`💋 **${interaction.user.username}** kissed **${target.username}**!`)
            .setImage(randomGif);

        return interaction.reply({ embeds: [embed] });
    }
};
