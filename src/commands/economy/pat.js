const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User'); // 👈 Fixed relative path

const PAT_GIFS = [
    'https://media1.tenor.com/m/Z71f28b2_fEAAAAC/anime-pat.gif',
    'https://media1.tenor.com/m/IZfV3-S460EAAAAC/pat-anime.gif',
    'https://media1.tenor.com/m/p7s5942rD6gAAAAC/anime-head-pat.gif',
    'https://media1.tenor.com/m/OxaEbqjG2OQAAAAC/anime-pat.gif',
    'https://media1.tenor.com/m/8-aB6iM1H-0AAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/vi4kI35Z0JMAAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/B94vXzYqE70AAAAC/anime-hug.gif',
    'https://media1.tenor.com/m/z2QaiBZCLCQAAAAC/anime-hug.gif'
];

async function trackPat(userId, guildId, isGiven) {
    if (!userId) return;
    const updateField = isGiven ? { patsGiven: 1 } : { patsReceived: 1 };
    try {
        await User.findOneAndUpdate(
            { userId: userId, guildId: guildId },
            { $inc: updateField },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('DB Pat Track Error:', err);
    }
}

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
        const guildId = interaction.guildId || 'DM';

        trackPat(interaction.user.id, guildId, true);
        trackPat(target.id, guildId, false);

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

            trackPat(target.id, guildId, true);
            trackPat(interaction.user.id, guildId, false);

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
