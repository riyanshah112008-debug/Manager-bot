const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../../models/User');

const PAT_GIFS = [
    'https://cdn.nekos.life/pat/pat_001.gif', 'https://cdn.nekos.life/pat/pat_002.gif',
    'https://cdn.nekos.life/pat/pat_003.gif', 'https://cdn.nekos.life/pat/pat_004.gif',
    'https://cdn.nekos.life/pat/pat_005.gif', 'https://cdn.nekos.life/pat/pat_006.gif',
    'https://cdn.nekos.life/pat/pat_007.gif', 'https://cdn.nekos.life/pat/pat_008.gif',
    'https://cdn.nekos.life/pat/pat_009.gif', 'https://cdn.nekos.life/pat/pat_010.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_001.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_002.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_003.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_004.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_005.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_006.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_007.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_008.gif',
    'https://purrbot.site/img/sfw/pat/gif/pat_009.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_010.gif'
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
        if (!target) return context.reply('❌ Please reply to a message or mention a user to pat them!');
    }

    if (target.id === authorId) {
        const errReply = "❌ You can't pat yourself!";
        return isSlash ? context.editReply(errReply) : context.reply(errReply);
    }

    const pairKey = [authorId, target.id].sort().join('_');
    let mutualCount = 1;

    try {
        await User.updateOne({ userId: authorId, guildId }, { $inc: { patsGiven: 1 } }, { upsert: true, strict: false });
        await User.updateOne({ userId: target.id, guildId }, { $inc: { patsReceived: 1 } }, { upsert: true, strict: false });
        
        await User.updateOne({ userId: pairKey, guildId }, { $inc: { patsShared: 1 } }, { upsert: true, strict: false });
        const pairDoc = await User.findOne({ userId: pairKey, guildId }).lean();
        if (pairDoc && pairDoc.patsShared) mutualCount = pairDoc.patsShared;
    } catch (err) { console.error('DB Pat Error:', err); }

    const randomGif = PAT_GIFS[Math.floor(Math.random() * PAT_GIFS.length)];
    
    const embed = new EmbedBuilder()
        .setColor('#A7C7E7')
        .setDescription(`**${authorName}** pets **${target.username}**.\n*You two have shared ${mutualCount} pats.*`)
        .setImage(randomGif);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('social_pat_back') 
            .setLabel('Pat back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⭐')
    );

    const components = target.bot ? [] : [row];
    let response = isSlash ? await context.editReply({ embeds: [embed], components }) : await context.reply({ embeds: [embed], components });

    if (components.length === 0) return;

    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
        if (i.user.id === authorId) {
            return i.reply({ content: 'You can\'t pat yourself back!', ephemeral: true });
        }

        await i.deferReply(); 
        let backMutualCount = 1;

        try {
            await User.updateOne({ userId: i.user.id, guildId }, { $inc: { patsGiven: 1 } }, { upsert: true, strict: false });
            await User.updateOne({ userId: authorId, guildId }, { $inc: { patsReceived: 1 } }, { upsert: true, strict: false });
            
            await User.updateOne({ userId: pairKey, guildId }, { $inc: { patsShared: 1 } }, { upsert: true, strict: false });
            const backPairDoc = await User.findOne({ userId: pairKey, guildId }).lean();
            if (backPairDoc && backPairDoc.patsShared) backMutualCount = backPairDoc.patsShared;
        } catch (err) {}

        const returnGif = PAT_GIFS[Math.floor(Math.random() * PAT_GIFS.length)];
        const returnEmbed = new EmbedBuilder()
            .setColor('#A7C7E7')
            .setDescription(`**${i.user.username}** pets **${authorName}** back.\n*You two have shared ${backMutualCount} pats.*`)
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
        .setName('pat')
        .setDescription('Give someone a gentle anime headpat!')
        .setContexts([0, 1, 2])
        .setIntegrationTypes([0, 1])
        .addUserOption(option => option.setName('target').setDescription('The user you want to pat').setRequired(true)),
    name: 'pat',
    aliases: ['.pat', 'pat'],
    description: 'Give someone a gentle anime headpat!',
    execute: universalExecute,
    run: universalExecute
};
