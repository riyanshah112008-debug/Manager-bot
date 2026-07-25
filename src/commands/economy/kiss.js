const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const KISS_GIFS = [
    'https://i.imgur.com/u38XxAD.gif',
    'https://i.imgur.com/eBfdfuJ.gif',
    'https://i.imgur.com/buv50ov.gif',
    'https://i.imgur.com/y4u84Y5.gif',
    'https://i.imgur.com/Za8bcwK.gif',
    'https://i.imgur.com/s42cmG8.gif'
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
