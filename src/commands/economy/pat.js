const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const User = require('../models/User');

function getGif() {
    return new Promise((resolve) => {
        https.get('https://api.waifu.pics/sfw/pat', (res) => {
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

function trackPat(userId, guildId, isGiven) {
    if (!userId) return;
    const updateField = isGiven ? { patsGiven: 1 } : { patsReceived: 1 };
    User.findOneAndUpdate(
        { userId: userId, guildId: guildId },
        { $inc: updateField },
        { upsert: true, new: true }
    ).catch(err => console.error('DB Pat Track Error:', err));
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
        await interaction.deferReply();
        const target = interaction.options.getUser('target');
        const guildId = interaction.guildId || 'DM';

        const gifUrl = await getGif();
        trackPat(interaction.user.id, guildId, true);
        trackPat(target.id, guildId, false);

        const embed = new EmbedBuilder()
            .setColor('#A7C7E7')
            .setDescription(`✋ **${interaction.user.username}** gave **${target.username}** a gentle headpat!`)
            .setImage(gifUrl);

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

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: 'Only the person who received the pat can pat back!', ephemeral: true });
            }

            trackPat(target.id, guildId, true);
            trackPat(interaction.user.id, guildId, false);

            const returnGif = await getGif();
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
