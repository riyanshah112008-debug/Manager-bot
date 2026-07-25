const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const User = require('../models/User');

function getGif() {
    return new Promise((resolve) => {
        https.get('https://api.waifu.pics/sfw/kiss', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.url);
                } catch {
                    resolve('https://i.imgur.com/13w1J4L.png');
                }
            });
        }).on('error', () => resolve('https://i.imgur.com/13w1J4L.png'));
    });
}

function trackKiss(userId, guildId, isGiven) {
    if (!userId) return;
    const updateField = isGiven ? { kissesGiven: 1 } : { kissesReceived: 1 };
    User.findOneAndUpdate(
        { userId: userId, guildId: guildId },
        { $inc: updateField },
        { upsert: true, new: true }
    ).catch(err => console.error('DB Kiss Track Error:', err));
}

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
        await interaction.deferReply();
        const target = interaction.options.getUser('target');
        const guildId = interaction.guildId || 'DM';

        const gifUrl = await getGif();
        trackKiss(interaction.user.id, guildId, true);
        trackKiss(target.id, guildId, false);

        const embed = new EmbedBuilder()
            .setColor('#FFB6C1')
            .setDescription(`💋 **${interaction.user.username}** kissed **${target.username}**!`)
            .setImage(gifUrl);

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

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: 'Only the person who was kissed can kiss back!', ephemeral: true });
            }

            trackKiss(target.id, guildId, true);
            trackKiss(interaction.user.id, guildId, false);

            const returnGif = await getGif();
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
