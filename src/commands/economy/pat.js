const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');

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
    'https://purrbot.site/img/sfw/pat/gif/pat_001.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_002.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_003.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_004.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_005.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_006.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_007.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_008.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_009.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_010.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pat')
        .setDescription('Give someone a gentle anime headpat!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to pat')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply(); 
        
        const target = interaction.options.getUser('target');
        const guildId = interaction.guildId || 'DM';

        let targetStats;
        try {
            await User.findOneAndUpdate({ userId: interaction.user.id, guildId }, { $inc: { patsGiven: 1 } }, { upsert: true });
            targetStats = await User.findOneAndUpdate({ userId: target.id, guildId }, { $inc: { patsReceived: 1 } }, { upsert: true, new: true });
        } catch (err) { console.error('DB Pat Error:', err); }

        const count = targetStats?.patsReceived || 1;
        const randomGif = PAT_GIFS[Math.floor(Math.random() * PAT_GIFS.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#A7C7E7')
            .setDescription(`**${interaction.user.username}** pets **${target.username}**.\n*${target.username} has received ${count} pats.*`)
            .setImage(randomGif);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('social_pat_back') 
                .setLabel('Pat back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⭐')
        );

        const components = (target.id === interaction.user.id || target.bot) ? [] : [row];
        const response = await interaction.editReply({ embeds: [embed], components: components });

        if (components.length === 0) return;

        // Increased timeout to 5 minutes
        const collector = response.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async (i) => {
            // Anyone can pat back except the original sender
            if (i.user.id === interaction.user.id) {
                return i.reply({ content: "You can't pat yourself back!", ephemeral: true });
            }

            await i.deferReply(); 
            let backTargetStats;
            try {
                await User.findOneAndUpdate({ userId: i.user.id, guildId }, { $inc: { patsGiven: 1 } }, { upsert: true });
                backTargetStats = await User.findOneAndUpdate({ userId: interaction.user.id, guildId }, { $inc: { patsReceived: 1 } }, { upsert: true, new: true });
            } catch (err) {}

            const backCount = backTargetStats?.patsReceived || 1;
            const returnGif = PAT_GIFS[Math.floor(Math.random() * PAT_GIFS.length)];
            const returnEmbed = new EmbedBuilder()
                .setColor('#A7C7E7')
                .setDescription(`**${i.user.username}** pets **${interaction.user.username}** back.\n*${interaction.user.username} has received ${backCount} pats.*`)
                .setImage(returnGif);

            row.components[0].setDisabled(true);
            await interaction.editReply({ components: [row] }).catch(() => {});
            await i.editReply({ embeds: [returnEmbed] });
        });

        collector.on('end', () => {
            if (row.components[0].data.disabled) return;
            row.components[0].setDisabled(true);
            interaction.editReply({ components: [row] }).catch(() => {});
        });
    }
};
