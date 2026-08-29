// ==========================================
// 🎭 STARRY & FLAVI SOCIAL & ANIME ACTIONS MODULE
// File Path: src/commands/socialActions.js
// 1-Year Responsive Interaction & Fixed Comma Prefix (,)
// ==========================================
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../config');
const { ONE_YEAR_MS } = require('../utils/contextHelper');

const EPHEMERAL_FLAG = MessageFlags ? MessageFlags.Ephemeral : 6;

const User = mongoose.models.User || (function() {
    try {
        return require('../models/User');
    } catch (e) {
        const userSchema = new mongoose.Schema({
            userId: { type: String, required: true },
            guildId: { type: String, required: true }
        }, { strict: false });
        return mongoose.models.User || mongoose.model('User', userSchema);
    }
})();

function getRandomIndex(arrayLength) {
    if (!arrayLength || arrayLength <= 0) return 0;
    return crypto.randomInt(0, arrayLength);
}

const GIF_DATABASE = {
    kiss: ['https://media.tenor.com/dn_m_R3A7pAAAAAC/anime-kiss.gif', 'https://media.tenor.com/gU212bx3424AAAAC/kiss-anime.gif'],
    pat: ['https://media.tenor.com/E6f12CmgB_QAAAAC/head-pat-anime.gif', 'https://media.tenor.com/Y7233_L2-EAAAAAC/anime-pat.gif'],
    hug: ['https://media.tenor.com/0PIf-R3635AAAAAC/hug-anime.gif', 'https://media.tenor.com/kCZ9T_hn2M0AAAAC/hug-anime.gif'],
    slap: ['https://media.tenor.com/Ws6dm1ZW2z8AAAAC/anime-slap.gif', 'https://media.tenor.com/E3B1E2se2RMAAAAC/slap-anime.gif'],
    cuddle: ['https://media.tenor.com/P5e5d36eR3MAAAAC/anime-cuddle.gif'],
    bite: ['https://media.tenor.com/O613x3z-s7IAAAAC/anime-bite.gif'],
    poke: ['https://media.tenor.com/39D7Mh9Q0e0AAAAC/anime-poke.gif'],
    punch: ['https://media.tenor.com/p_A3m8_0m4AAAAAC/anime-punch.gif'],
    tickle: ['https://media.tenor.com/8499n8a2G4IAAAAC/anime-tickle.gif'],
    feed: ['https://media.tenor.com/EF29x13G8LIAAAAC/anime-feed.gif'],
    lick: ['https://media.tenor.com/4kC5S9lD2pUAAAAC/anime-lick.gif'],
    highfive: ['https://media.tenor.com/M5b-e4wD41gAAAAC/anime-high-five.gif'],
    wave: ['https://media.tenor.com/m2K-I_eX7JMAAAAC/anime-wave.gif'],
    sleep: ['https://media.tenor.com/7L3f6n4I5e8AAAAC/anime-sleep.gif'],
    wakeup: ['https://media.tenor.com/yFzN-d8C_jMAAAAC/anime-wakeup.gif'],
    cry: ['https://media.tenor.com/m40fH9PZ1JkAAAAC/anime-cry.gif'],
    laugh: ['https://media.tenor.com/8Q_a4Kqf8jAAAAAC/anime-laugh.gif'],
    dance: ['https://media.tenor.com/x8mR9xK6K8AAAAAC/anime-dance.gif'],
    blush: ['https://media.tenor.com/82N7l4aL1w0AAAAC/anime-blush.gif'],
    pout: ['https://media.tenor.com/C5uB0v452WIAAAAC/anime-pout.gif'],
    smile: ['https://media.tenor.com/3P6I362mP2AAAAAC/anime-smile.gif'],
    bored: ['https://media.tenor.com/6Uq4vA5C_mUAAAAC/anime-bored.gif']
};

async function fetchSafeAnimeGif(actionKey) {
    try {
        const response = await fetch(`https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(actionKey)}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.url) return data.url;
        }
    } catch (err) {}
    const fallbackList = GIF_DATABASE[actionKey] || GIF_DATABASE.hug;
    const idx = getRandomIndex(fallbackList.length);
    return fallbackList[idx];
}

const ACTION_CONFIG = {
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

const socialCommandBuilder = new SlashCommandBuilder()
    .setName('social')
    .setDescription('🎭 Perform anime social actions or express emotions!')
    .setContexts([0, 1, 2])
    .setIntegrationTypes([0, 1]);

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

async function executeSocialAction(actionKey, context, isSlash) {
    const configData = ACTION_CONFIG[actionKey];
    if (!configData) return;

    const authorUser = isSlash ? context.user : context.author;
    const authorIdStr = String(authorUser.id);
    const authorName = authorUser.username;

    let target = null;

    if (configData.requiresTarget) {
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
            const reqMsg = `❌ Please mention a user or reply to a message to ${actionKey} them!`;
            return isSlash 
                ? context.reply({ content: reqMsg, flags: [EPHEMERAL_FLAG] }) 
                : context.reply(reqMsg);
        }

        if (String(target.id) === authorIdStr) {
            const errReply = `❌ You can't ${actionKey} yourself! Mention someone else.`;
            return isSlash 
                ? context.reply({ content: errReply, flags: [EPHEMERAL_FLAG] }) 
                : context.reply(errReply);
        }
    }

    if (isSlash && !context.deferred && !context.replied) {
        await context.deferReply().catch(() => {});
    }

    const randomGif = await fetchSafeAnimeGif(actionKey);

    let descriptionText = `**${authorName}** ${configData.verb}`;
    if (target) {
        descriptionText += ` **${target.username}**!`;
    }

    const embed = new EmbedBuilder()
        .setColor(configData.color)
        .setDescription(descriptionText)
        .setImage(randomGif)
        .setFooter({ text: '1-Year Responsive Interaction • Prefix: ,' });

    const components = [];
    if (target && !target.bot) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`social_${actionKey}_back_${target.id}_${authorIdStr}`)
                .setLabel(`${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)} back`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(configData.emoji)
        );
        components.push(row);
    }

    if (isSlash) {
        await context.editReply({ embeds: [embed], components }).catch(() => {});
    } else {
        await context.reply({ embeds: [embed], components }).catch(() => {});
    }
}

async function sendSocialHelpMenu(context) {
    const prefix = config.DEFAULT_PREFIX || ',';
    const embed = new EmbedBuilder()
        .setColor('#FF79C6')
        .setTitle('🎭 Starry & Flavi Social Actions Menu')
        .setDescription(`Express feelings or interact with friends using high-quality animated anime GIFs!\n\n*Works via prefix commands (\`${prefix}hug @user\`) OR slash commands (\`/social action hug\`).*\n*Interaction timing up to 1 Year!*`)
        .addFields(
            { 
                name: '🫂 Targeted Member Actions (Requires Mention/Reply)', 
                value: '`kiss`, `pat`, `hug`, `slap`, `cuddle`, `bite`, `poke`, `punch`, `tickle`, `feed`, `lick`, `highfive`, `wave`', 
                inline: false 
            },
            { 
                name: '🎭 Solo Expressions & Feelings', 
                value: '`sleep`, `wakeup`, `cry`, `laugh`, `dance`, `blush`, `pout`, `smile`, `bored`', 
                inline: false 
            },
            { 
                name: '💡 Usage Examples', 
                value: `• \`${prefix}hug @user\` — Hug a friend\n• Reply to a message with \`${prefix}kiss\` — Kiss sender\n• \`${prefix}sleep\` — Express sleeping\n• \`/social action highfive target:@user\``, 
                inline: false 
            }
        )
        .setFooter({ text: 'Starry & Flavi Interactive Engine • 1-Year Responsive Buttons' })
        .setTimestamp();

    return context.reply({ embeds: [embed] });
}

module.exports = (client) => {
    // 1. Slash Command /social Handler
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand() && interaction.commandName === 'social') {
            const group = interaction.options.getSubcommandGroup(false);
            const subCommand = interaction.options.getSubcommand(false);
            const targetAction = subCommand || group;

            if (targetAction) {
                await executeSocialAction(targetAction, interaction, true);
            }
            return;
        }

        // 2. Button "Action Back" Handler (Global 1-Year Lifetime)
        if (interaction.isButton() && interaction.customId.startsWith('social_')) {
            const parts = interaction.customId.split('_');
            const actionKey = parts[1];
            const allowedUserId = parts[3];
            const originalAuthorId = parts[4];

            if (interaction.user.id !== allowedUserId) {
                return interaction.reply({ 
                    content: `❌ Only <@${allowedUserId}> can use this button to action back!`, 
                    flags: [EPHEMERAL_FLAG] 
                }).catch(() => {});
            }

            const configData = ACTION_CONFIG[actionKey];
            if (!configData) return;

            await interaction.deferReply().catch(() => {});

            const returnGif = await fetchSafeAnimeGif(actionKey);

            const returnEmbed = new EmbedBuilder()
                .setColor(configData.color)
                .setDescription(`**${interaction.user.username}** ${configData.verb} **<@${originalAuthorId}>** back!`)
                .setImage(returnGif)
                .setFooter({ text: '1-Year Responsive Interaction' });

            await interaction.editReply({ embeds: [returnEmbed] }).catch(() => {});
        }
    });

    // 3. Prefix Commands (,hug, ,kiss, ,slap, etc.)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || !message.guild) return;
        const prefix = config.DEFAULT_PREFIX || ',';

        const content = message.content.toLowerCase().trim();
        const firstWord = content.split(/\s+/)[0];

        if (firstWord === `${prefix}social` || firstWord === 'social') {
            return sendSocialHelpMenu(message);
        }

        for (const actionKey of Object.keys(ACTION_CONFIG)) {
            if (firstWord === `${prefix}${actionKey}`) {
                await executeSocialAction(actionKey, message, false);
                break;
            }
        }
    });
};

module.exports.data = socialCommandBuilder;
module.exports.execute = async function(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const subCommand = interaction.options.getSubcommand(false);
    const targetAction = subCommand || group;
    if (targetAction) {
        await executeSocialAction(targetAction, interaction, true);
    }
};
module.exports.socialCommandPayload = socialCommandBuilder.toJSON();
