const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User'); 

const HUG_GIFS = [
    'https://cdn.nekos.life/hug/hug_001.gif', 'https://cdn.nekos.life/hug/hug_002.gif',
    'https://cdn.nekos.life/hug/hug_003.gif', 'https://cdn.nekos.life/hug/hug_004.gif',
    'https://cdn.nekos.life/hug/hug_005.gif', 'https://cdn.nekos.life/hug/hug_006.gif',
    'https://cdn.nekos.life/hug/hug_007.gif', 'https://cdn.nekos.life/hug/hug_008.gif',
    'https://cdn.nekos.life/hug/hug_009.gif', 'https://cdn.nekos.life/hug/hug_010.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_001.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_002.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_003.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_004.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_005.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_006.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_007.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_008.gif',
    'https://purrbot.site/img/sfw/hug/gif/hug_009.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_010.gif'
];

async function handleCommand(context, isSlash) {
    let target;
    const guildId = context.guildId || 'DM';
    const authorId = isSlash ? context.user.id : context.author.id;
    const authorName = isSlash ? context.user.username : context.author.username;

    if (isSlash) {
        await context.deferReply(); 
        target = context.options.getUser('target');
    } else {
        if (context.reference && context.reference.messageId) {
            try {
                const refMsg = await context.channel.messages.fetch(context.reference.messageId);
                target = refMsg.author;
            } catch (err) {}
        } else if (context.mentions && context.mentions.users.size > 0) {
            target = context.mentions.users.first();
        }
        if (!target) return context.reply('❌ Please reply to a message or mention a user to hug them!');
    }

    if (target.id === authorId) {
        const errReply = "❌ You can't hug yourself!";
        return isSlash ? context.editReply(errReply) : context.reply(errReply);
    }

    let targetDoc;
    try {
        // Direct MongoDB injection (Bypasses strict schema blocks to GUARANTEE count increases)
        await User.collection.updateOne({ userId: authorId, guildId }, { $inc: { hugsGiven: 1 } }, { upsert: true });
        targetDoc = await User.collection.findOneAndUpdate(
            { userId: target.id, guildId },
            { $inc: { hugsReceived: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
    } catch (err) { console.error('DB Hug Error:', err); }

    const count = targetDoc?.value?.hugsReceived || 1;
    const randomGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
    
    const embed = new EmbedBuilder()
        .setColor('#FF9494')
        .setDescription(`**${authorName}** hugs **${target.username}**.\n*${target.username} has received ${count} hugs.*`)
        .setImage(randomGif);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('social_hug_back') 
            .setLabel('Hug back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🤗')
    );

    const components = target.bot ? [] : [row];
    let response = isSlash ? await context.editReply({ embeds: [embed], components }) : await context.reply({ embeds: [embed], components });

    if (components.length === 0) return;

    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
        if (i.user.id === authorId) {
            return i.reply({ content: 'You can\'t hug yourself back!', ephemeral: true });
        }

        await i.deferReply(); 
        let backTargetDoc;
        try {
            await User.collection.updateOne({ userId: i.user.id, guildId }, { $inc: { hugsGiven: 1 } }, { upsert: true });
            backTargetDoc = await User.collection.findOneAndUpdate(
                { userId: authorId, guildId },
                { $inc: { hugsReceived: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (err) {}

        const backCount = backTargetDoc?.value?.hugsReceived || 1;
        const returnGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
        const returnEmbed = new EmbedBuilder()
            .setColor('#FF9494')
            .setDescription(`**${i.user.username}** hugs **${authorName}** back.\n*${authorName} has received ${backCount} hugs.*`)
            .setImage(returnGif);

        row.components[0].setDisabled(true);
        if (isSlash) await context.editReply({ components: [row] }).catch(() => {});
        else await response.edit({ components: [row] }).catch(() => {});
        await i.editReply({ embeds: [returnEmbed] });
    });

    collector.on('end', () => {
        if (row.components[0].data.disabled) return;
        row.components[0].setDisabled(true);
        if (isSlash) context.editReply({ components: [row] }).catch(() => {});
        else response.edit({ components: [row] }).catch(() => {});
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Give someone a warm anime hug!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addUserOption(option => option.setName('target').setDescription('The user you want to hug').setRequired(true)),

    // Explicit prefix binding
    name: '.hug',
    aliases: ['hug'],
    description: 'Give someone a warm anime hug!',

    execute: async (interaction) => { await handleCommand(interaction, true); },
    run: async (client, message, args) => {
        const msg = message?.author ? message : client;
        await handleCommand(msg, false);
    }
};
