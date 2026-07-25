const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PAT_GIFS = [
    'https://i.imgur.com/2gJNp1y.gif',
    'https://i.imgur.com/5IUu6TZ.gif',
    'https://i.imgur.com/ovvwW9W.gif',
    'https://i.imgur.com/uR1g1a4.gif',
    'https://i.imgur.com/e7G8i1g.gif',
    'https://i.imgur.com/vH90uPi.gif'
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
