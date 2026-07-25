const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const User = require('../models/User'); // Change to './models/User' if your commands are in the root folder

function getGif() {
    return new Promise((resolve) => {
        https.get('https://api.waifu.pics/sfw/hug', (res) => {
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

// Background DB tracker (Non-blocking)
function trackHug(userId, guildId, isGiven) {
    if (!userId) return;
    const updateField = isGiven ? { hugsGiven: 1 } : { hugsReceived: 1 };
    User.findOneAndUpdate(
        { userId: userId, guildId: guildId },
        { $inc: updateField },
        { upsert: true, new: true }
    ).catch(err => console.error('DB Hug Track Error:', err));
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
        await interaction.deferReply();
        const target = interaction.options.getUser('target');
        const guildId = interaction.guildId || 'DM';
        
        // Fetch GIF and fire-and-forget DB update simultaneously to prevent timeouts
        const gifUrl = await getGif();
        trackHug(interaction.user.id, guildId, true);
        trackHug(target.id, guildId, false);

        const embed = new EmbedBuilder()
            .setColor('#FF9494')
            .setDescription(`🤗 **${interaction.user.username}** gave **${target.username}** a big warm hug!`)
            .setImage(gifUrl);

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

            trackHug(target.id, guildId, true);
            trackHug(interaction.user.id, guildId, false);

            const returnGif = await getGif();
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
