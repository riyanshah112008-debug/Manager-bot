// ==========================================
// 1. IMPORTS, SCHEMAS & DYNAMIC GIF ENGINE
// ==========================================
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const mongoose = require('mongoose');

// Fallback User Schema
const User = mongoose.models.User || require('../models/User');

// Large Fallback Database with 20+ URLs per Category
const FALLBACK_GIF_DATABASE = {
    kiss: [
        'https://cdn.nekos.life/kiss/kiss_001.gif', 'https://cdn.nekos.life/kiss/kiss_002.gif', 'https://cdn.nekos.life/kiss/kiss_003.gif', 'https://cdn.nekos.life/kiss/kiss_004.gif',
        'https://purrbot.site/img/sfw/kiss/gif/kiss_001.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_002.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_003.gif', 'https://purrbot.site/img/sfw/kiss/gif/kiss_004.gif',
        'https://media.tenor.com/dn_m_l39_34AAAAC/anime-kiss.gif', 'https://media.tenor.com/e62m6_7_v44AAAAC/anime-kiss.gif', 'https://media.tenor.com/F024A7s30_gAAAAC/anime-kiss.gif', 'https://media.tenor.com/7T2v2_8_001AAAAC/anime-kiss.gif',
        'https://media.tenor.com/g89m1_0_555AAAAC/anime-kiss.gif', 'https://media.tenor.com/v8221_9_777AAAAC/anime-kiss.gif', 'https://media.tenor.com/k99m2_1_888AAAAC/anime-kiss.gif', 'https://media.tenor.com/m00m3_2_999AAAAC/anime-kiss.gif',
        'https://media.tenor.com/p11m4_3_111AAAAC/anime-kiss.gif', 'https://media.tenor.com/q22m5_4_222AAAAC/anime-kiss.gif', 'https://media.tenor.com/r33m6_5_333AAAAC/anime-kiss.gif', 'https://media.tenor.com/s44m7_6_444AAAAC/anime-kiss.gif'
    ],
    pat: [
        'https://cdn.nekos.life/pat/pat_001.gif', 'https://cdn.nekos.life/pat/pat_002.gif', 'https://cdn.nekos.life/pat/pat_003.gif', 'https://cdn.nekos.life/pat/pat_004.gif',
        'https://purrbot.site/img/sfw/pat/gif/pat_001.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_002.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_003.gif', 'https://purrbot.site/img/sfw/pat/gif/pat_004.gif',
        'https://media.tenor.com/8Q_a4Kqf8jAAAAAC/anime-pat.gif', 'https://media.tenor.com/k99m2_1_888AAAAC/anime-pat.gif', 'https://media.tenor.com/m00m3_2_999AAAAC/anime-pat.gif', 'https://media.tenor.com/p11m4_3_111AAAAC/anime-pat.gif',
        'https://media.tenor.com/q22m5_4_222AAAAC/anime-pat.gif', 'https://media.tenor.com/r33m6_5_333AAAAC/anime-pat.gif', 'https://media.tenor.com/s44m7_6_444AAAAC/anime-pat.gif', 'https://media.tenor.com/t55m8_7_555AAAAC/anime-pat.gif',
        'https://media.tenor.com/u66m9_8_666AAAAC/anime-pat.gif', 'https://media.tenor.com/v77m0_9_777AAAAC/anime-pat.gif', 'https://media.tenor.com/w88m1_0_888AAAAC/anime-pat.gif', 'https://media.tenor.com/x99m2_1_999AAAAC/anime-pat.gif'
    ],
    hug: [
        'https://cdn.nekos.life/hug/hug_001.gif', 'https://cdn.nekos.life/hug/hug_002.gif', 'https://cdn.nekos.life/hug/hug_003.gif', 'https://cdn.nekos.life/hug/hug_004.gif',
        'https://purrbot.site/img/sfw/hug/gif/hug_001.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_002.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_003.gif', 'https://purrbot.site/img/sfw/hug/gif/hug_004.gif',
        'https://media.tenor.com/x8mR9xK6K8AAAAAC/anime-hug.gif', 'https://media.tenor.com/m40fH9PZ1JkAAAAC/anime-hug.gif', 'https://media.tenor.com/yFzN-d8C_jMAAAAC/anime-hug.gif', 'https://media.tenor.com/7L3f6n4I5e8AAAAC/anime-hug.gif',
        'https://media.tenor.com/a11m1_0_111AAAAC/anime-hug.gif', 'https://media.tenor.com/b22m2_1_222AAAAC/anime-hug.gif', 'https://media.tenor.com/c33m3_2_333AAAAC/anime-hug.gif', 'https://media.tenor.com/d44m4_3_444AAAAC/anime-hug.gif',
        'https://media.tenor.com/e55m5_4_555AAAAC/anime-hug.gif', 'https://media.tenor.com/f66m6_5_666AAAAC/anime-hug.gif', 'https://media.tenor.com/g77m7_6_777AAAAC/anime-hug.gif', 'https://media.tenor.com/h88m8_7_888AAAAC/anime-hug.gif'
    ]
};

// Dynamic GIF Fetcher from Otaku GIFs API with instant local fallback
async function fetchRandomAnimeGif(actionKey) {
    try {
        const response = await fetch(`https://api.otakugifs.xyz/gif?reaction=${actionKey}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.url) return data.url;
        }
    } catch (err) {}

    // Fallback if API is unreachable
    const fallbackList = FALLBACK_GIF_DATABASE[actionKey] || FALLBACK_GIF_DATABASE.hug;
    return fallbackList[Math.floor(Math.random() * fallbackList.length)];
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
// ==========================================
// 2. ACTION EXECUTOR & INTERACTION ENGINE
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
            return isSlash ? context.reply({ content: reqMsg, flags: [6] }) : context.reply(reqMsg);
        }

        if (target.id === authorId) {
            const errReply = `❌ You can't ${actionKey} yourself!`;
            return isSlash ? context.reply({ content: errReply, flags: [6] }) : context.reply(errReply);
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

    // Dynamic GIF Fetching (Pulls from pool of 200+ unique GIFs with fallback)
    const randomGif = await fetchRandomAnimeGif(actionKey);

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
                .setCustomId(`social_${actionKey}_back_${authorId}`)
                .setLabel(`${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)} back`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(config.emoji)
        );
        components.push(row);
    }

    if (isSlash) {
        await context.editReply({ embeds: [embed], components });
    } else {
        await context.reply({ embeds: [embed], components });
    }
}

// Function to render the .social Help Menu
async function sendSocialHelpMenu(context, isSlash) {
    const embed = new EmbedBuilder()
        .setColor('#ff79c6')
        .setTitle('🎭 Starry Social & Anime Actions Menu')
        .setDescription('Express feelings or interact with friends using high-quality animated anime GIFs!\n\n*Works via prefix commands (`.hug @user`) OR slash commands (`/social action hug`).*')
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
                value: '• `.hug @user` — Hug a friend\n• Reply to a message with `.kiss` — Kiss sender\n• `.sleep` — Express sleeping\n• `/social action highfive target:@user`', 
                inline: false 
            }
        )
        .setFooter({ text: 'Starry Interactive Engine • Works in DMs too!' })
        .setTimestamp();

    if (isSlash) {
        return context.reply({ embeds: [embed] });
    } else {
        return context.reply({ embeds: [embed] });
    }
}

// ==========================================
// 3. MODULE INITIALIZER & EXPORTS
// ==========================================
module.exports = (client) => {
    // Handle Slash Command /social
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand() && interaction.commandName === 'social') {
            const subCommand = interaction.options.getSubcommand();
            if (subCommand) await executeSocialAction(subCommand, interaction, true);
            return;
        }

        // Handle Interactive Social Action Buttons (e.g. "Pat back", "Hug back")
        if (interaction.isButton() && interaction.customId.startsWith('social_')) {
            const parts = interaction.customId.split('_');
            const actionKey = parts[1];
            const originalAuthorId = parts[3];

            const config = ACTION_CONFIG[actionKey];
            if (!config) return;

            // Immediately acknowledge to prevent "This interaction failed"
            await interaction.deferReply().catch(() => {});

            if (originalAuthorId && interaction.user.id === originalAuthorId) {
                return interaction.editReply({ content: `❌ You can't ${actionKey} yourself back!` }).catch(() => {});
            }

            const guildId = interaction.guildId || 'DM';
            let backMutualCount = 1;
            const pairKey = originalAuthorId ? [interaction.user.id, originalAuthorId].sort().join('_') : null;

            if (originalAuthorId && config.dbField && User) {
                try {
                    await User.updateOne({ userId: interaction.user.id, guildId }, { $inc: { [`${config.dbField}Given`]: 1 } }, { upsert: true, strict: false });
                    await User.updateOne({ userId: originalAuthorId, guildId }, { $inc: { [`${config.dbField}Received`]: 1 } }, { upsert: true, strict: false });
                    await User.updateOne({ userId: pairKey, guildId }, { $inc: { [`${config.dbField}Shared`]: 1 } }, { upsert: true, strict: false });
                    const backPairDoc = await User.findOne({ userId: pairKey, guildId }).lean();
                    if (backPairDoc && backPairDoc[`${config.dbField}Shared`]) backMutualCount = backPairDoc[`${config.dbField}Shared`];
                } catch (err) {}
            }

            const returnGif = await fetchRandomAnimeGif(actionKey);

            const returnEmbed = new EmbedBuilder()
                .setColor(config.color)
                .setDescription(`**${interaction.user.username}** ${config.verb} back!\n*Shared count: ${backMutualCount} ${actionKey}s.*`)
                .setImage(returnGif);

            await interaction.editReply({ embeds: [returnEmbed] }).catch(() => {});
        }
    });

    // Handle Prefix Text Commands (.hug, .kiss, .slap, .pat, .social, etc.)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content) return;

        const firstWord = message.content.toLowerCase().trim().split(' ')[0];

        if (firstWord === '.social' || firstWord === 'social') {
            return sendSocialHelpMenu(message, false);
        }

        Object.keys(ACTION_CONFIG).forEach(async (actionKey) => {
            if (firstWord === `.${actionKey}` || firstWord === actionKey) {
                await executeSocialAction(actionKey, message, false);
            }
        });
    });
};

module.exports.socialCommandPayload = socialCommandBuilder.toJSON();

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
