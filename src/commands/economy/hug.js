const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// 20 Reliable, Direct CDN Anime Hug GIFs (These won't get blocked by Discord)
const HUG_GIFS = [
    'https://cdn.nekos.life/hug/hug_001.gif',
    'https://cdn.nekos.life/hug/hug_002.gif',
    'https://cdn.nekos.life/hug/hug_003.gif',
    'https://cdn.nekos.life/hug/hug_004.gif',
    'https://cdn.nekos.life/hug/hug_005.gif',
    'https://cdn.nekos.life/hug/hug_006.gif',
    'https://cdn.nekos.life/hug/hug_007.gif',
    'https://cdn.nekos.life/hug/hug_008.gif',
    'https://cdn.nekos.life/hug/hug_009.gif',
    'https://cdn.nekos.life/hug/hug_010.gif',
    'https://cdn.nekos.life/hug/hug_011.gif',
    'https://cdn.nekos.life/hug/hug_012.gif',
    'https://cdn.nekos.life/hug/hug_013.gif',
    'https://cdn.nekos.life/hug/hug_014.gif',
    'https://cdn.nekos.life/hug/hug_015.gif',
    'https://cdn.nekos.life/hug/hug_016.gif',
    'https://cdn.nekos.life/hug/hug_017.gif',
    'https://cdn.nekos.life/hug/hug_018.gif',
    'https://cdn.nekos.life/hug/hug_019.gif',
    'https://cdn.nekos.life/hug/hug_020.gif'
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
