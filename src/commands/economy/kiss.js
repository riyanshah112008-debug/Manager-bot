const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 20 Reliable, Direct CDN Anime Kiss GIFs
const KISS_GIFS = [
    'https://cdn.nekos.life/kiss/kiss_001.gif', 'https://cdn.nekos.life/kiss/kiss_002.gif',
    'https://cdn.nekos.life/kiss/kiss_003.gif', 'https://cdn.nekos.life/kiss/kiss_004.gif',
    'https://cdn.nekos.life/kiss/kiss_005.gif', 'https://cdn.nekos.life/kiss/kiss_006.gif',
    'https://cdn.nekos.life/kiss/kiss_007.gif', 'https://cdn.nekos.life/kiss/kiss_008.gif',
    'https://cdn.nekos.life/kiss/kiss_009.gif', 'https://cdn.nekos.life/kiss/kiss_010.gif',
    'https://cdn.nekos.life/kiss/kiss_011.gif', 'https://cdn.nekos.life/kiss/kiss_012.gif',
    'https://cdn.nekos.life/kiss/kiss_013.gif', 'https://cdn.nekos.life/kiss/kiss_014.gif',
    'https://cdn.nekos.life/kiss/kiss_015.gif', 'https://cdn.nekos.life/kiss/kiss_016.gif',
    'https://cdn.nekos.life/kiss/kiss_017.gif', 'https://cdn.nekos.life/kiss/kiss_018.gif',
    'https://cdn.nekos.life/kiss/kiss_019.gif', 'https://cdn.nekos.life/kiss/kiss_020.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('💋 Give someone a sweet anime kiss (Works in DMs too!)')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
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

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('social_kiss_back')
                .setLabel('Kiss back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💋')
        );

        const components = (target.id === interaction.user.id || target.bot) ? [] : [row];
        const response = await interaction.reply({ embeds: [embed], components: components });

        if (components.length === 0) return;

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: 'Only the person who was kissed can kiss back!', ephemeral: true });
            }

            const returnGif = KISS_GIFS[Math.floor(Math.random() * KISS_GIFS.length)];
            const returnEmbed = new EmbedBuilder()
                .setColor('#FFB6C1')
                .setDescription(`💋 **${target.username}** kissed **${interaction.user.username}** back!`)
                .setImage(returnGif);

            row.components[0].setDisabled(true);
            await interaction.editReply({ components: [row] }).catch(() => {});
            await i.reply({ embeds: [returnEmbed] });
        });

        collector.on('end', () => {
            row.components[0].setDisabled(true);
            interaction.editReply({ components: [row] }).catch(() => {});
        });
    }
};
