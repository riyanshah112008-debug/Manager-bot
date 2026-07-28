// ==========================================
// 1. IMPORTS, SCHEMAS & GIF DATABASE
// ==========================================
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const mongoose = require('mongoose');

// Fallback User Schema in case models/User.js is loaded dynamically
const User = mongoose.models.User || require('../models/User');

const GIF_DATABASE = {
    kiss: [
        'https://cdn.nekos.life/kiss/kiss_001.gif', 'https://cdn.nekos.life/kiss/kiss_002.gif',
        'https://purrbot.site/img/sfw/kiss/gif/kiss_001.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_002.gif'
    ],
    pat: [
        'https://cdn.nekos.life/pat/pat_001.gif', 'https://cdn.nekos.life/pat/pat_002.gif',
        'https://purrbot.site/img/sfw/pat/gif/pat_001.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_002.gif'
    ],
    hug: [
        'https://cdn.nekos.life/hug/hug_001.gif', 'https://cdn.nekos.life/hug/hug_002.gif',
        'https://purrbot.site/img/sfw/hug/gif/hug_001.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_002.gif'
    ],
    slap: [
        'https://cdn.nekos.life/slap/slap_001.gif', 'https://purrbot.site/img/sfw/slap/gif/slap_001.gif'
    ],
    cuddle: [
        'https://cdn.nekos.life/cuddle/cuddle_001.gif', 'https://purrbot.site/img/sfw/cuddle/gif/cuddle_001.gif'
    ],
    bite: [
        'https://purrbot.site/img/sfw/bite/gif/bite_001.gif', 'https://purrbot.site/img/sfw/bite/gif/bite_002.gif'
    ],
    poke: [
        'https://cdn.nekos.life/poke/poke_001.gif', 'https://purrbot.site/img/sfw/poke/gif/poke_001.gif'
    ],
    punch: [
        'https://purrbot.site/img/sfw/punch/gif/punch_001.gif'
    ],
    tickle: [
        'https://cdn.nekos.life/tickle/tickle_001.gif', 'https://purrbot.site/img/sfw/tickle/gif/tickle_001.gif'
    ],
    feed: [
        'https://cdn.nekos.life/feed/feed_001.gif', 'https://purrbot.site/img/sfw/feed/gif/feed_001.gif'
    ],
    lick: [
        'https://cdn.nekos.life/lick/lick_001.gif', 'https://purrbot.site/img/sfw/lick/gif/lick_001.gif'
    ],
    highfive: [
        'https://purrbot.site/img/sfw/highfive/gif/highfive_001.gif'
    ],
    wave: [
        'https://purrbot.site/img/sfw/wave/gif/wave_001.gif'
    ],
    sleep: [
        'https://purrbot.site/img/sfw/sleep/gif/sleep_001.gif', 'https://media.tenor.com/7L3f6n4I5e8AAAAC/anime-sleep.gif'
    ],
    wakeup: [
        'https://media.tenor.com/yFzN-d8C_jMAAAAC/anime-wakeup.gif'
    ],
    cry: [
        'https://purrbot.site/img/sfw/cry/gif/cry_001.gif', 'https://media.tenor.com/m40fH9PZ1JkAAAAC/anime-cry.gif'
    ],
    laugh: [
        'https://purrbot.site/img/sfw/laugh/gif/laugh_001.gif', 'https://media.tenor.com/8Q_a4Kqf8jAAAAAC/anime-laugh.gif'
    ],
    dance: [
        'https://purrbot.site/img/sfw/dance/gif/dance_001.gif', 'https://media.tenor.com/x8mR9xK6K8AAAAAC/anime-dance.gif'
    ],
    blush: [
        'https://purrbot.site/img/sfw/blush/gif/blush_001.gif'
    ],
    pout: [
        'https://purrbot.site/img/sfw/pout/gif/pout_001.gif'
    ],
    smile: [
        'https://purrbot.site/img/sfw/smile/gif/smile_001.gif'
    ],
    bored: [
        'https://media.tenor.com/6Uq4vA5C_mUAAAAC/anime-bored.gif'
    ]
};

const ACTION_CONFIG = {
    // Group 1: action (Targeted Interactions)
    kiss: { verb: 'kisses', emoji: '💋', color: '#FFB6C1', group: 'action', dbField: 'kisses', requiresTarget: true },
    pat: { verb: 'pets', emoji: '⭐', color: '#A7C7E7', group: 'action', dbField: 'pats', requiresTarget: true },
    hug: { verb: 'hugs', emoji: '🤗', color: '#FF9494', group: 'action', dbField: 'hugs', requiresTarget: true },
    slap: { verb: 'slaps', emoji: '✋', color: '#E74C3C', group: 'action', dbField: 'slaps', requiresTarget: true },
    cuddle: { verb: 'cuddles with', emoji: '🥺', color: '#F39C12', group: 'action', dbField: 'cuddles', requiresTarget: true },
    bite: { verb: 'bites', emoji: '🦷', color: '#9B59B6', group: 'action', dbField: 'bites', requiresTarget: true },
    poke: { verb: 'pokes', emoji: '👉', color: '#3498DB', group: 'action', dbField: 'pokes', requiresTarget: true },
    punch: { verb: 'punches', emoji: '🥊', color: '#C0392B', group: 'action', dbField: 'punches', requiresTarget: true },
    tickle: { verb: 'tickles', emoji: '🤏', color: '#1ABC9C', group: 'action', dbField: 'tickles', requiresTarget: true },
    feed: { verb: 'feeds', emoji: '🍱', color: '#2ECC71', group: 'action', dbField: 'feeds', requiresTarget: true },
    lick: { verb: 'licks', emoji: '👅', color: '#E91E63', group: 'action', dbField: 'licks', requiresTarget: true },
    highfive: { verb: 'highfives', emoji: '🙌', color: '#F1C40F', group: 'action', dbField: 'highfives', requiresTarget: true },
    wave: { verb: 'waves at', emoji: '👋', color: '#34495E', group: 'action', dbField: 'waves', requiresTarget: true },
    
    // Group 2: express (Solo Expressions)
    sleep: { verb: 'is sleeping zzz...', emoji: '😴', color: '#2C3E50', group: 'express', requiresTarget: false },
    wakeup: { verb: 'just woke up!', emoji: '⏰', color: '#E67E22', group: 'express', requiresTarget: false },
    cry: { verb: 'is crying...', emoji: '😭', color: '#3498DB', group: 'express', requiresTarget: false },
    laugh: { verb: 'is laughing hysterically!', emoji: '😆', color: '#F1C40F', group: 'express', requiresTarget: false },
    dance: { verb: 'is dancing happily!', emoji: '💃', color: '#9B59B6', group: 'express', requiresTarget: false },
    blush: { verb: 'is blushing deeply...', emoji: '😳', color: '#FFB6C1', group: 'express', requiresTarget: false },
    pout: { verb: 'is pouting!', emoji: '😤', color: '#E74C3C', group: 'express', requiresTarget: false },
    smile: { verb: 'smiles warmly!', emoji: '😊', color: '#2ECC71', group: 'express', requiresTarget: false },
    bored: { verb: 'is feeling super bored...', emoji: '🥱', color: '#95A5A6', group: 'express', requiresTarget: false }
};
// ==========================================
// 2. BUILD MASTER SLASH COMMAND /social
// ==========================================
const socialCommandBuilder = new SlashCommandBuilder()
    .setName('social')
    .setDescription('🎭 Perform anime social actions or express emotions!')
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]);

// Subcommand Group 1: Action (Targeted)
socialCommandBuilder.addSubcommandGroup(group => {
    group.setName('action').setDescription('Targeted social actions with other members');
    Object.keys(ACTION_CONFIG).filter(k => ACTION_CONFIG[k].group === 'action').forEach(actionKey => {
        group.addSubcommand(sub => 
            sub.setName(actionKey)
               .setDescription(`${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)} another user`)
               .addUserOption(opt => opt.setName('target').setDescription('Target member').setRequired(true))
        );
    });
    return group;
});

// Subcommand Group 2: Express (Solo)
socialCommandBuilder.addSubcommandGroup(group => {
    group.setName('express').setDescription('Express individual feelings or emotions');
    Object.keys(ACTION_CONFIG).filter(k => ACTION_CONFIG[k].group === 'express').forEach(actionKey => {
        group.addSubcommand(sub => 
            sub.setName(actionKey)
               .setDescription(`Express ${actionKey}`)
        );
    });
    return group;
});

// ==========================================
// 3. ACTION EXECUTOR ENGINE
// ==========================================
async function executeSocialAction(actionKey, context, isSlash) {
    const config = ACTION_CONFIG[actionKey];
    if (!config) return;

    const guildId = context.guildId || 'DM';
    const authorId = isSlash ? context.user.id : context.author.id;
    const authorName = isSlash ? context.user.username : context.author.username;

    let target = null;

    if (config.requiresTarget) {
        if (isSlash) {
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
        }

        if (!target) {
            const reqMsg = `❌ Please reply to a message or mention a user to ${actionKey} them!`;
            return isSlash ? context.reply({ content: reqMsg, ephemeral: true }) : context.reply(reqMsg);
        }

        if (target.id === authorId) {
            const errReply = `❌ You can't ${actionKey} yourself!`;
            return isSlash ? context.reply({ content: errReply, ephemeral: true }) : context.reply(errReply);
        }
    }

    if (isSlash && !context.deferred && !context.replied) await context.deferReply();

    let mutualCount = 1;
    const pairKey = target ? [authorId, target.id].sort().join('_') : null;

    if (target && config.dbField && User) {
        try {
            await User.updateOne({ userId: authorId, guildId }, { $inc: { [`${config.dbField}Given`]: 1 } }, { upsert: true, strict: false });
            await User.updateOne({ userId: target.id, guildId }, { $inc: { [`${config.dbField}Received`]: 1 } }, { upsert: true, strict: false });
            await User.updateOne({ userId: pairKey, guildId }, { $inc: { [`${config.dbField}Shared`]: 1 } }, { upsert: true, strict: false });
            const pairDoc = await User.findOne({ userId: pairKey, guildId }).lean();
            if (pairDoc && pairDoc[`${config.dbField}Shared`]) mutualCount = pairDoc[`${config.dbField}Shared`];
        } catch (err) {}
    }

    const gifList = GIF_DATABASE[actionKey] || GIF_DATABASE.hug;
    const randomGif = gifList[Math.floor(Math.random() * gifList.length)];

    let descriptionText = `**${authorName}** ${config.verb}`;
    if (target) descriptionText += ` **${target.username}**!\n*You two have shared ${mutualCount} ${actionKey}s.*`;

    const embed = new EmbedBuilder()
        .setColor(config.color)
        .setDescription(descriptionText)
        .setImage(randomGif);

    const components = [];
    if (target && !target.bot) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`social_${actionKey}_back`)
                .setLabel(`${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)} back`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(config.emoji)
        );
        components.push(row);
    }

    let response = isSlash ? await context.editReply({ embeds: [embed], components }) : await context.reply({ embeds: [embed], components });

    if (components.length === 0) return;

    const collector = response.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i) => {
        if (i.user.id === authorId) return i.reply({ content: `You can't ${actionKey} yourself back!`, ephemeral: true });

        await i.deferReply();
        let backMutualCount = 1;

        if (config.dbField && User) {
            try {
                await User.updateOne({ userId: i.user.id, guildId }, { $inc: { [`${config.dbField}Given`]: 1 } }, { upsert: true, strict: false });
                await User.updateOne({ userId: authorId, guildId }, { $inc: { [`${config.dbField}Received`]: 1 } }, { upsert: true, strict: false });
                await User.updateOne({ userId: pairKey, guildId }, { $inc: { [`${config.dbField}Shared`]: 1 } }, { upsert: true, strict: false });
                const backPairDoc = await User.findOne({ userId: pairKey, guildId }).lean();
                if (backPairDoc && backPairDoc[`${config.dbField}Shared`]) backMutualCount = backPairDoc[`${config.dbField}Shared`];
            } catch (err) {}
        }

        const returnGif = gifList[Math.floor(Math.random() * gifList.length)];
        const returnEmbed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(`**${i.user.username}** ${config.verb} **${authorName}** back!\n*You two have shared ${backMutualCount} ${actionKey}s.*`)
            .setImage(returnGif);

        components[0].components[0].setDisabled(true);
        if (isSlash) await context.editReply({ components: [components[0]] }).catch(() => {});
        else await response.edit({ components: [components[0]] }).catch(() => {});

        await i.editReply({ embeds: [returnEmbed] });
    });
}
// ==========================================
// 4. MODULE INITIALIZER & EXPORTS
// ==========================================
module.exports = (client) => {
    // Handle Slash Command /social
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'social') return;
        const subCommand = interaction.options.getSubcommand();
        if (subCommand) await executeSocialAction(subCommand, interaction, true);
    });

    // Handle Prefix Text Commands (.hug, .kiss, .slap, .sleep, etc.)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content) return;

        const firstWord = message.content.toLowerCase().trim().split(' ')[0];

        Object.keys(ACTION_CONFIG).forEach(async (actionKey) => {
            if (firstWord === `.${actionKey}` || firstWord === actionKey) {
                await executeSocialAction(actionKey, message, false);
            }
        });
    });
};

module.exports.socialCommandPayload = socialCommandBuilder.toJSON();
