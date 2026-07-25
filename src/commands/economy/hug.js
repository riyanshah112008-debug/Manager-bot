const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const HUG_GIFS = [
    'https://cdn.nekos.life/hug/hug_001.gif', 'https://cdn.nekos.life/hug/hug_002.gif',
    'https://cdn.nekos.life/hug/hug_003.gif', 'https://cdn.nekos.life/hug/hug_004.gif',
    'https://cdn.nekos.life/hug/hug_005.gif', 'https://cdn.nekos.life/hug/hug_006.gif',
    'https://cdn.nekos.life/hug/hug_007.gif', 'https://cdn.nekos.life/hug/hug_008.gif',
    'https://cdn.nekos.life/hug/hug_009.gif', 'https://cdn.nekos.life/hug/hug_010.gif',
    'https://cdn.nekos.life/hug/hug_011.gif', 'https://cdn.nekos.life/hug/hug_012.gif',
    'https://cdn.nekos.life/hug/hug_013.gif', 'https://cdn.nekos.life/hug/hug_014.gif',
    'https://cdn.nekos.life/hug/hug_015.gif', 'https://cdn.nekos.life/hug/hug_016.gif',
    'https://cdn.nekos.life/hug/hug_017.gif', 'https://cdn.nekos.life/hug/hug_018.gif',
    'https://cdn.nekos.life/hug/hug_019.gif', 'https://cdn.nekos.life/hug/hug_020.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('🤗 Give someone a warm anime hug (Works in DMs too!)')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
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

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('social_hug_back') // Matched with starry.js bypass
                .setLabel('Hug back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🤗')
        );

        const components = (target.id === interaction.user.id || target.bot) ? [] : [row];
        const response = await interaction.reply({ embeds: [embed], components: components });

        if (components.length === 0) return;

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: 'Only the person who was hugged can hug back!', ephemeral: true });
            }

            const returnGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
            const returnEmbed = new EmbedBuilder()
                .setColor('#FF9494')
                .setDescription(`🤗 **${target.username}** hugged **${interaction.user.username}** back!`)
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
