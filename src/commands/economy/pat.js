const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 20 Reliable, Direct CDN Anime Pat GIFs
const PAT_GIFS = [
    'https://cdn.nekos.life/pat/pat_001.gif', 'https://cdn.nekos.life/pat/pat_002.gif',
    'https://cdn.nekos.life/pat/pat_003.gif', 'https://cdn.nekos.life/pat/pat_004.gif',
    'https://cdn.nekos.life/pat/pat_005.gif', 'https://cdn.nekos.life/pat/pat_006.gif',
    'https://cdn.nekos.life/pat/pat_007.gif', 'https://cdn.nekos.life/pat/pat_008.gif',
    'https://cdn.nekos.life/pat/pat_009.gif', 'https://cdn.nekos.life/pat/pat_010.gif',
    'https://cdn.nekos.life/pat/pat_011.gif', 'https://cdn.nekos.life/pat/pat_012.gif',
    'https://cdn.nekos.life/pat/pat_013.gif', 'https://cdn.nekos.life/pat/pat_014.gif',
    'https://cdn.nekos.life/pat/pat_015.gif', 'https://cdn.nekos.life/pat/pat_016.gif',
    'https://cdn.nekos.life/pat/pat_017.gif', 'https://cdn.nekos.life/pat/pat_018.gif',
    'https://cdn.nekos.life/pat/pat_019.gif', 'https://cdn.nekos.life/pat/pat_020.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pat')
        .setDescription('✋ Give someone a gentle anime headpat (Works in DMs too!)')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to pat')
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const randomGif = PAT_GIFS[Math.floor(Math.random() * PAT_GIFS.length)];

        const embed = new EmbedBuilder()
            .setColor('#A7C7E7')
            .setDescription(`✋ **${interaction.user.username}** gave **${target.username}** a gentle headpat!`)
            .setImage(randomGif);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('social_pat_back')
                .setLabel('Pat back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⭐')
        );

        const components = (target.id === interaction.user.id || target.bot) ? [] : [row];
        const response = await interaction.reply({ embeds: [embed], components: components });

        if (components.length === 0) return;

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: 'Only the person who received the pat can pat back!', ephemeral: true });
            }

            const returnGif = PAT_GIFS[Math.floor(Math.random() * PAT_GIFS.length)];
            const returnEmbed = new EmbedBuilder()
                .setColor('#A7C7E7')
                .setDescription(`⭐ **${target.username}** gave **${interaction.user.username}** a headpat back!`)
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
