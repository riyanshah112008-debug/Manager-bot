const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User'); 

// 20 Unbreakable, direct .gif links
const HUG_GIFS = [
    'https://c.tenor.com/kKvrHj-SAvMAAAAC/tenor.gif',
    'https://c.tenor.com/xIuXbMtA38sAAAAC/tenor.gif',
    'https://c.tenor.com/9e1aE_x4Nc4AAAAC/tenor.gif',
    'https://c.tenor.com/J7eIlqcG_2cAAAAC/tenor.gif',
    'https://c.tenor.com/8-aB6iM1H-0AAAAC/tenor.gif',
    'https://c.tenor.com/n7g1bQY1Y3UAAAAC/tenor.gif',
    'https://c.tenor.com/X-L1s6T3-2wAAAAC/tenor.gif',
    'https://c.tenor.com/vi4kI35Z0JMAAAAC/tenor.gif',
    'https://c.tenor.com/X5nB-41Kav4AAAAC/tenor.gif',
    'https://c.tenor.com/B94vXzYqE70AAAAC/tenor.gif',
    'https://c.tenor.com/qF7mO4nnL0sAAAAC/tenor.gif',
    'https://c.tenor.com/a97qP5P45hUAAAAC/tenor.gif',
    'https://c.tenor.com/z2QaiBZCLCQAAAAC/tenor.gif',
    'https://c.tenor.com/OxaEbqjG2OQAAAAC/tenor.gif',
    'https://c.tenor.com/1T1B8HcWalQAAAAC/tenor.gif',
    'https://c.tenor.com/FncA-A6L6sIAAAAC/tenor.gif',
    'https://c.tenor.com/xgopH8Z_00oAAAAC/tenor.gif',
    'https://c.tenor.com/H7i6GcgO7P8AAAAC/tenor.gif',
    'https://c.tenor.com/wO_3tT7P-w4AAAAC/tenor.gif',
    'https://c.tenor.com/34mH2wE8G-YAAAAC/tenor.gif'
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
        // Stop the Discord timeout error instantly
        await interaction.deferReply(); 
        
        const target = interaction.options.getUser('target');
        const guildId = interaction.guildId || 'DM';

        let targetStats;
        try {
            await User.findOneAndUpdate({ userId: interaction.user.id, guildId }, { $inc: { hugsGiven: 1 } }, { upsert: true });
            targetStats = await User.findOneAndUpdate({ userId: target.id, guildId }, { $inc: { hugsReceived: 1 } }, { upsert: true, new: true });
        } catch (err) { console.error('DB Hug Track Error:', err); }

        const count = targetStats?.hugsReceived || 1;
        const randomGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
        
        // Formatted to exactly match the sleek style you requested
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

        const collector = response.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: 'Only the person who was hugged can hug back!', ephemeral: true });
            }

            await i.deferReply(); 
            let backTargetStats;
            try {
                await User.findOneAndUpdate({ userId: target.id, guildId }, { $inc: { hugsGiven: 1 } }, { upsert: true });
                backTargetStats = await User.findOneAndUpdate({ userId: interaction.user.id, guildId }, { $inc: { hugsReceived: 1 } }, { upsert: true, new: true });
            } catch (err) {}

            const backCount = backTargetStats?.hugsReceived || 1;
            const returnGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
            const returnEmbed = new EmbedBuilder()
                .setColor('#FF9494')
                .setDescription(`**${target.username}** hugs **${interaction.user.username}** back.\n*${interaction.user.username} has received ${backCount} hugs.*`)
                .setImage(returnGif);

            row.components[0].setDisabled(true);
            await interaction.editReply({ components: [row] }).catch(() => {});
            await i.editReply({ embeds: [returnEmbed] });
        });

        collector.on('end', () => {
            row.components[0].setDisabled(true);
            interaction.editReply({ components: [row] }).catch(() => {});
        });
    }
};
