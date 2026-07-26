const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User'); 

const KISS_GIFS = [
    'https://cdn.nekos.life/kiss/kiss_001.gif', 'https://cdn.nekos.life/kiss/kiss_002.gif',
    'https://cdn.nekos.life/kiss/kiss_003.gif', 'https://cdn.nekos.life/kiss/kiss_004.gif',
    'https://cdn.nekos.life/kiss/kiss_005.gif', 'https://cdn.nekos.life/kiss/kiss_006.gif',
    'https://cdn.nekos.life/kiss/kiss_007.gif', 'https://cdn.nekos.life/kiss/kiss_008.gif',
    'https://cdn.nekos.life/kiss/kiss_009.gif', 'https://cdn.nekos.life/kiss/kiss_010.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_001.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_002.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_003.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_004.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_005.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_006.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_007.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_008.gif',
    'https://purrbot.site/img/sfw/kiss/gif/kiss_009.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_010.gif'
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
        if (!target) return context.reply('❌ Please reply to a message or mention a user to kiss them!');
    }

    if (target.id === authorId) {
        const errReply = "❌ You can't kiss yourself!";
        return isSlash ? context.editReply(errReply) : context.reply(errReply);
    }

    const pairKey = [authorId, target.id].sort().join('_');
    let pairDoc;

    try {
        await User.collection.updateOne({ userId: authorId, guildId }, { $inc: { kissesGiven: 1 } }, { upsert: true });
        await User.collection.updateOne({ userId: target.id, guildId }, { $inc: { kissesReceived: 1 } }, { upsert: true });
        
        pairDoc = await User.collection.findOneAndUpdate(
            { userId: pairKey, guildId },
            { $inc: { kissesShared: 1 } },
            { upsert: true, returnDocument: 'after' }
        );
    } catch (err) { console.error('DB Kiss Error:', err); }

    const mutualCount = pairDoc?.value?.kissesShared || 1;
    const randomGif = KISS_GIFS[Math.floor(Math.random() * KISS_GIFS.length)];
    
    const embed = new EmbedBuilder()
        .setColor('#FFB6C1')
        .setDescription(`**${authorName}** kisses **${target.username}**.\n*You two have shared ${mutualCount} kisses.*`)
        .setImage(randomGif);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('social_kiss_back') 
            .setLabel('Kiss back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💋')
    );

    const components = target.bot ? [] : [row];
    let response = isSlash ? await context.editReply({ embeds: [embed], components }) : await context.reply({ embeds: [embed], components });

    if (components.length === 0) return;

    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
        if (i.user.id === authorId) {
            return i.reply({ content: 'You can\'t kiss yourself back!', ephemeral: true });
        }

        await i.deferReply(); 
        let backPairDoc;
        try {
            await User.collection.updateOne({ userId: i.user.id, guildId }, { $inc: { kissesGiven: 1 } }, { upsert: true });
            await User.collection.updateOne({ userId: authorId, guildId }, { $inc: { kissesReceived: 1 } }, { upsert: true });
            
            backPairDoc = await User.collection.findOneAndUpdate(
                { userId: pairKey, guildId },
                { $inc: { kissesShared: 1 } },
                { upsert: true, returnDocument: 'after' }
            );
        } catch (err) {}

        const backMutualCount = backPairDoc?.value?.kissesShared || 1;
        const returnGif = KISS_GIFS[Math.floor(Math.random() * KISS_GIFS.length)];
        const returnEmbed = new EmbedBuilder()
            .setColor('#FFB6C1')
            .setDescription(`**${i.user.username}** kisses **${authorName}** back.\n*You two have shared ${backMutualCount} kisses.*`)
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

async function universalExecute(...args) {
    const arg1 = args[0];
    const arg2 = args[1];
    if (arg1 && typeof arg1.isChatInputCommand === 'function' && arg1.isChatInputCommand()) return await handleCommand(arg1, true);
    const message = (arg1 && arg1.author) ? arg1 : ((arg2 && arg2.author) ? arg2 : null);
    if (message) return await handleCommand(message, false);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kiss')
        .setDescription('Give someone a sweet anime kiss!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addUserOption(option => option.setName('target').setDescription('The user you want to kiss').setRequired(true)),
    name: 'kiss',
    aliases: ['.kiss', 'kiss'],
    description: 'Give someone a sweet anime kiss!',
    execute: universalExecute,
    run: universalExecute
};
