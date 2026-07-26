const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User'); 

const KISS_GIFS = [
    'https://cdn.nekos.life/kiss/kiss_001.gif',
    'https://cdn.nekos.life/kiss/kiss_002.gif',
    'https://cdn.nekos.life/kiss/kiss_003.gif',
    'https://cdn.nekos.life/kiss/kiss_004.gif',
    'https://cdn.nekos.life/kiss/kiss_005.gif',
    'https://cdn.nekos.life/kiss/kiss_006.gif',
    'https://cdn.nekos.life/kiss/kiss_007.gif',
    'https://cdn.nekos.life/kiss/kiss_008.gif',
    'https://cdn.nekos.life/kiss/kiss_009.gif',
    'https://cdn.nekos.life/kiss/kiss_010.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_001.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_002.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_003.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_004.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_005.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_006.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_007.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_008.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_009.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_010.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('Give someone a sweet anime kiss!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to kiss')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply(); 
        
        const target = interaction.options.getUser('target');
        const guildId = interaction.guildId || 'DM';

        let targetStats;
        try {
            await User.findOneAndUpdate({ userId: interaction.user.id, guildId }, { $inc: { kissesGiven: 1 } }, { upsert: true });
            targetStats = await User.findOneAndUpdate({ userId: target.id, guildId }, { $inc: { kissesReceived: 1 } }, { upsert: true, new: true });
        } catch (err) { console.error('DB Kiss Error:', err); }

        const count = targetStats?.kissesReceived || 1;
        const randomGif = KISS_GIFS[Math.floor(Math.random() * KISS_GIFS.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#FFB6C1')
            .setDescription(`**${interaction.user.username}** kisses **${target.username}**.\n*${target.username} has received ${count} kisses.*`)
            .setImage(randomGif);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('social_kiss_back') 
                .setLabel('Kiss back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💋')
        );

        const components = (target.id === interaction.user.id || target.bot) ? [] : [row];
        const response = await interaction.editReply({ embeds: [embed], components: components });

        if (components.length === 0) return;

        // Increased timeout to 5 minutes
        const collector = response.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async (i) => {
            // Anyone can kiss back except the original sender
            if (i.user.id === interaction.user.id) {
                return i.reply({ content: "You can't kiss yourself back!", ephemeral: true });
            }

            await i.deferReply(); 
            let backTargetStats;
            try {
                await User.findOneAndUpdate({ userId: i.user.id, guildId }, { $inc: { kissesGiven: 1 } }, { upsert: true });
                backTargetStats = await User.findOneAndUpdate({ userId: interaction.user.id, guildId }, { $inc: { kissesReceived: 1 } }, { upsert: true, new: true });
            } catch (err) {}

            const backCount = backTargetStats?.kissesReceived || 1;
            const returnGif = KISS_GIFS[Math.floor(Math.random() * KISS_GIFS.length)];
            const returnEmbed = new EmbedBuilder()
                .setColor('#FFB6C1')
                .setDescription(`**${i.user.username}** kisses **${interaction.user.username}** back.\n*${interaction.user.username} has received ${backCount} kisses.*`)
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
