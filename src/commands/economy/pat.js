const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// 20 Reliable, Direct CDN Anime Pat GIFs (These won't get blocked by Discord)
const PAT_GIFS = [
    'https://cdn.nekos.life/pat/pat_001.gif',
    'https://cdn.nekos.life/pat/pat_002.gif',
    'https://cdn.nekos.life/pat/pat_003.gif',
    'https://cdn.nekos.life/pat/pat_004.gif',
    'https://cdn.nekos.life/pat/pat_005.gif',
    'https://cdn.nekos.life/pat/pat_006.gif',
    'https://cdn.nekos.life/pat/pat_007.gif',
    'https://cdn.nekos.life/pat/pat_008.gif',
    'https://cdn.nekos.life/pat/pat_009.gif',
    'https://cdn.nekos.life/pat/pat_010.gif',
    'https://cdn.nekos.life/pat/pat_011.gif',
    'https://cdn.nekos.life/pat/pat_012.gif',
    'https://cdn.nekos.life/pat/pat_013.gif',
    'https://cdn.nekos.life/pat/pat_014.gif',
    'https://cdn.nekos.life/pat/pat_015.gif',
    'https://cdn.nekos.life/pat/pat_016.gif',
    'https://cdn.nekos.life/pat/pat_017.gif',
    'https://cdn.nekos.life/pat/pat_018.gif',
    'https://cdn.nekos.life/pat/pat_019.gif',
    'https://cdn.nekos.life/pat/pat_020.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pat')
        .setDescription('✋ Give someone a gentle anime headpat (Works in DMs too!)')
        .setContexts([0, 1, 2]) // 0: Guild, 1: Bot DM, 2: Private Channel
        .setIntegrationTypes([0, 1]) // 0: Guild Install, 1: User Install
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to pat')
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const randomGif = PAT_GIFS[Math.floor(Math.random() * PAT_GIFS.length)];

        const embed = new EmbedBuilder()
            .setColor('#A7C7E7') // A soft pastel blue
            .setDescription(`✋ **${interaction.user.username}** gave **${target.username}** a gentle headpat!`)
            .setImage(randomGif);

        return interaction.reply({ embeds: [embed] });
    }
};
