const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User'); 

const HUG_GIFS = [
    'https://cdn.nekos.life/hug/hug_001.gif',
    'https://cdn.nekos.life/hug/hug_002.gif',
    'https://cdn.nekos.life/hug/hug_003.gif',
    'https://cdn.nekos.life/hug/hug_004.gif',
    'https://cdn.nekos.life/hug/hug_005.gif',
    'https://cdn.nekos.life/hug/hug_006.gif',
    'https://cdn.nekos.life/hug/hug_007.gif',
    'https://cdn.nekos.life/hug/hug_008.gif',
    'https://cdn.nekos.life/hug/hug_009.gif',
    'https://cdn.nekos.life/hug/hug_010.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_001.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_002.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_003.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_004.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_005.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_006.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_007.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_008.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_009.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_010.gif'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Give someone a warm anime hug!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user you want to hug')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply(); 
        
        const target = interaction.options.getUser('target');
        const guildId = interaction.guildId || 'DM';

        let targetStats;
        try {
            await User.findOneAndUpdate({ userId: interaction.user.id, guildId }, { $inc: { hugsGiven: 1 } }, { upsert: true });
            targetStats = await User.findOneAndUpdate({ userId: target.id, guildId }, { $inc: { hugsReceived: 1 } }, { upsert: true, new: true });
        } catch (err) { console.error('DB Hug Error:', err); }

        const count = targetStats?.hugsReceived || 1;
        const randomGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#FF9494')
            .setDescription(`**${interaction.user.username}** hugs **${target.username}**.\n*${target.username} has received ${count} hugs.*`)
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

        // Increased timeout to 5 minutes so it doesn't disable too fast
        const collector = response.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async (i) => {
            // Now ANYONE can click the button, except the original sender
            if (i.user.id === interaction.user.id) {
                return i.reply({ content: "You can't hug yourself back!", ephemeral: true });
            }

            await i.deferReply(); 
            let backTargetStats;
            try {
                await User.findOneAndUpdate({ userId: i.user.id, guildId }, { $inc: { hugsGiven: 1 } }, { upsert: true });
                backTargetStats = await User.findOneAndUpdate({ userId: interaction.user.id, guildId }, { $inc: { hugsReceived: 1 } }, { upsert: true, new: true });
            } catch (err) {}

            const backCount = backTargetStats?.hugsReceived || 1;
            const returnGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
            const returnEmbed = new EmbedBuilder()
                .setColor('#FF9494')
                .setDescription(`**${i.user.username}** hugs **${interaction.user.username}** back.\n*${interaction.user.username} has received ${backCount} hugs.*`)
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
