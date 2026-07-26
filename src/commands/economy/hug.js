const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

module.exports = {
    name: '.hug', // Registered exactly as a prefix command
    aliases: ['hug'], 
    description: 'Give someone a warm anime hug!',
    
    // Using standard message execution for Prefix Commands
    async execute(message, args) {
        let target;

        // 1. Check if user is replying to a message (Nekotina style)
        if (message.reference && message.reference.messageId) {
            try {
                const refMsg = await message.channel.messages.fetch(message.reference.messageId);
                target = refMsg.author;
            } catch (err) {}
        } 
        // 2. Fallback to @mentions
        else if (message.mentions.users.size > 0) {
            target = message.mentions.users.first();
        }

        if (!target) return message.reply('❌ Please reply to a message or mention a user to hug them!');
        if (target.id === message.author.id) return message.reply("❌ You can't hug yourself!");

        const guildId = message.guildId || 'DM';

        let targetStats;
        try {
            // Force strict:false so DB guarantees the count increases even if schema is missing the field
            await User.findOneAndUpdate({ userId: message.author.id, guildId }, { $inc: { hugsGiven: 1 } }, { upsert: true, strict: false });
            targetStats = await User.findOneAndUpdate({ userId: target.id, guildId }, { $inc: { hugsReceived: 1 } }, { upsert: true, new: true, strict: false });
        } catch (err) { console.error('DB Hug Error:', err); }

        const count = targetStats?.hugsReceived || 1;
        const randomGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#FF9494')
            .setDescription(`**${message.author.username}** hugs **${target.username}**.\n*${target.username} has received ${count} hugs.*`)
            .setImage(randomGif);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('social_hug_back') 
                .setLabel('Hug back')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🤗')
        );

        const components = target.bot ? [] : [row];
        const response = await message.reply({ embeds: [embed], components: components });

        if (components.length === 0) return;

        const collector = response.createMessageComponentCollector({ time: 300000 }); // 5 minutes

        collector.on('collect', async (i) => {
            // Anyone can click, except the original sender
            if (i.user.id === message.author.id) {
                return i.reply({ content: 'You can\'t hug yourself back!', ephemeral: true });
            }

            await i.deferReply(); 
            let backTargetStats;
            try {
                await User.findOneAndUpdate({ userId: i.user.id, guildId }, { $inc: { hugsGiven: 1 } }, { upsert: true, strict: false });
                backTargetStats = await User.findOneAndUpdate({ userId: message.author.id, guildId }, { $inc: { hugsReceived: 1 } }, { upsert: true, new: true, strict: false });
            } catch (err) {}

            const backCount = backTargetStats?.hugsReceived || 1;
            const returnGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
            const returnEmbed = new EmbedBuilder()
                .setColor('#FF9494')
                .setDescription(`**${i.user.username}** hugs **${message.author.username}** back.\n*${message.author.username} has received ${backCount} hugs.*`)
                .setImage(returnGif);

            row.components[0].setDisabled(true);
            await response.edit({ components: [row] }).catch(() => {});
            await i.editReply({ embeds: [returnEmbed] });
        });

        collector.on('end', () => {
            if (row.components[0].data.disabled) return;
            row.components[0].setDisabled(true);
            response.edit({ components: [row] }).catch(() => {});
        });
    }
};
