const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');

const HUG_GIFS = [
    'https://media1.tenor.com/m/kKvrHj-SAvMAAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/xIuXbMtA38sAAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/G_RlGfqGlqcAAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/9e1aE_x4Nc4AAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/J7eIlqcG_2cAAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/8-aB6iM1H-0AAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/n7g1bQY1Y3UAAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/X-L1s6T3-2wAAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/vi4kI35Z0JMAAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/X5nB-41Kav4AAAAC/anime-hug.gif'
];

async function trackHug(userId, guildId, isGiven) {
    if (!userId) return;
    const updateField = isGiven ? { hugsGiven: 1 } : { hugsReceived: 1 };
    try {
        await User.findOneAndUpdate(
            { userId: userId, guildId: guildId },
            { $inc: updateField },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('DB Hug Track Error:', err);
    }
}

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
        await interaction.deferReply(); // Prevents Discord 3-second timeout error

        const target = interaction.options.getUser('target');
        const guildId = interaction.guildId || 'DM';

        await trackHug(interaction.user.id, guildId, true);
        await trackHug(target.id, guildId, false);

        const randomGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
        const embed = new EmbedBuilder()
            .setColor('#FF9494')
            .setDescription(`🤗 **${interaction.user.username}** gave **${target.username}** a big warm hug!`)
            .setImage(randomGif);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('social_hug_back')
                .setLabel('Hug back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🤗')
        );

        const components = (target.id === interaction.user.id || target.bot) ? [] : [row];
        const response = await interaction.editReply({ embeds: [embed], components: components });

        if (components.length === 0) return;

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: 'Only the person who was hugged can hug back!', ephemeral: true });
            }

            await trackHug(target.id, guildId, true);
            await trackHug(interaction.user.id, guildId, false);

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
