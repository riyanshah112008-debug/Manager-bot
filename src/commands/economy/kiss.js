const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const KISS_GIFS = [
    'https://media1.tenor.com/m/gzaT07Fk4UoAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/F02Ep3b_dIgAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/etSTc3aWspcAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/lYHV1vwa-FkAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/I8kWjuAtX-QAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/I9Z44UqA4UIAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/PZc3XgM-a5IAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/1Gj23LpA7WMAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/QfL2Piv3K3wAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/h5e17uVzL7MAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/nEID0Jro6V8AAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/5J3mEaWpCMAAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/dpv2qQf-J8cAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/7sZ60E5g56IAAAAC/anime-kiss.gif',
    'https://media1.tenor.com/m/X8B2hH861u8AAAAC/anime-kiss.gif'
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
