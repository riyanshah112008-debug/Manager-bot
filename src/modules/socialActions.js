// ==========================================
// 🎭 Starry SOCIAL & ANIME ACTIONS MODULE
// File Path: src/modules/socialActions.js
// 1-Year Responsive Interaction • MongoDB Shared Count Tracking
// Direct Fast-CDN Animated Anime GIFs
// ==========================================
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder,
    MessageFlags 
} = require('discord.js');
const mongoose = require('mongoose');
const config = require('../config');
const { ONE_YEAR_MS } = require('../utils/contextHelper');
const { getSocialGif, ANIME_GIFS } = require('../utils/animeGifs');
const { incrementSocialCount, getSocialCount } = require('../models/SocialStats');

const EPHEMERAL_FLAG = MessageFlags ? MessageFlags.Ephemeral : 64;

const ACTION_CONFIG = {
    highfive: { verb: 'highfives', noun: 'highfives', emoji: '🙌', color: '#F1C40F', group: 'action', requiresTarget: true },
    hug: { verb: 'hugs', noun: 'hugs', emoji: '🤗', color: '#FF9494', group: 'action', requiresTarget: true },
    kiss: { verb: 'kisses', noun: 'kisses', emoji: '💋', color: '#FFB6C1', group: 'action', requiresTarget: true },
    pat: { verb: 'pets', noun: 'pats', emoji: '⭐', color: '#A7C7E7', group: 'action', requiresTarget: true },
    slap: { verb: 'slaps', noun: 'slaps', emoji: '✋', color: '#E74C3C', group: 'action', requiresTarget: true },
    cuddle: { verb: 'cuddles with', noun: 'cuddles', emoji: '🥺', color: '#F39C12', group: 'action', requiresTarget: true },
    bite: { verb: 'bites', noun: 'bites', emoji: '🦷', color: '#9B59B6', group: 'action', requiresTarget: true },
    poke: { verb: 'pokes', noun: 'pokes', emoji: '👉', color: '#3498DB', group: 'action', requiresTarget: true },
    punch: { verb: 'punches', noun: 'punches', emoji: '🥊', color: '#C0392B', group: 'action', requiresTarget: true },
    tickle: { verb: 'tickles', noun: 'tickles', emoji: '🤏', color: '#1ABC9C', group: 'action', requiresTarget: true },
    feed: { verb: 'feeds', noun: 'meals', emoji: '🍱', color: '#2ECC71', group: 'action', requiresTarget: true },
    lick: { verb: 'licks', noun: 'licks', emoji: '👅', color: '#E91E63', group: 'action', requiresTarget: true },
    wave: { verb: 'waves at', noun: 'waves', emoji: '👋', color: '#34495E', group: 'action', requiresTarget: true },
    handhold: { verb: 'holds hands with', noun: 'handholds', emoji: '🤝', color: '#FFD700', group: 'action', requiresTarget: true },
    bonk: { verb: 'bonks', noun: 'bonks', emoji: '🔨', color: '#E67E22', group: 'action', requiresTarget: true },
    yeet: { verb: 'yeets', noun: 'yeets', emoji: '🚀', color: '#9B59B6', group: 'action', requiresTarget: true },
    boop: { verb: 'boops', noun: 'boops', emoji: '👉', color: '#1ABC9C', group: 'action', requiresTarget: true },
    
    sleep: { verb: 'is sleeping zzz...', noun: 'naps', emoji: '😴', color: '#2C3E50', group: 'express', requiresTarget: false },
    wakeup: { verb: 'just woke up!', noun: 'wakeups', emoji: '⏰', color: '#E67E22', group: 'express', requiresTarget: false },
    cry: { verb: 'is crying...', noun: 'cries', emoji: '😭', color: '#3498DB', group: 'express', requiresTarget: false },
    laugh: { verb: 'is laughing hysterically!', noun: 'laughs', emoji: '😆', color: '#F1C40F', group: 'express', requiresTarget: false },
    dance: { verb: 'is dancing happily!', noun: 'dances', emoji: '💃', color: '#9B59B6', group: 'express', requiresTarget: false },
    blush: { verb: 'is blushing deeply...', noun: 'blushes', emoji: '😳', color: '#FFB6C1', group: 'express', requiresTarget: false },
    pout: { verb: 'is pouting!', noun: 'pouts', emoji: '😤', color: '#E74C3C', group: 'express', requiresTarget: false },
    smile: { verb: 'smiles warmly!', noun: 'smiles', emoji: '😊', color: '#2ECC71', group: 'express', requiresTarget: false },
    stare: { verb: 'stares intently...', noun: 'stares', emoji: '👀', color: '#95A5A6', group: 'express', requiresTarget: false },
    cheer: { verb: 'is cheering excitedly!', noun: 'cheers', emoji: '🎉', color: '#F39C12', group: 'express', requiresTarget: false }
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
            target = context.options?.getUser ? context.options.getUser('target') : null;
        } else {
            if (context.reference && context.reference.messageId) {
                try {
                    const refMsg = await context.channel.messages.fetch(context.reference.messageId);
                    target = refMsg.author;
                } catch (err) {}
            } else if (context.mentions && context.mentions.users && context.mentions.users.size > 0) {
                target = context.mentions.users.first();
            }
        }

        if (!target) {
            const reqMsg = `❌ Please mention a user or reply to a message to ${actionKey} them!\n*Example: \`,${actionKey} @user\`*`;
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

    const randomGif = getSocialGif(actionKey);

    // Save and increment count in MongoDB database
    const targetIdStr = target ? String(target.id) : null;
    const totalCount = await incrementSocialCount(authorIdStr, targetIdStr, actionKey);

    let descriptionText = `**${authorName}** ${configData.verb}`;
    if (target) {
        descriptionText += ` **${target.username}**!\n\n✨ That's **${totalCount}** ${configData.noun || actionKey}s shared together! ${configData.emoji}`;
    } else {
        descriptionText += `\n\n✨ Personal ${actionKey} count: **${totalCount}** ${configData.emoji}`;
    }

    const embed = new EmbedBuilder()
        .setColor(configData.color)
        .setDescription(descriptionText)
        .setImage(randomGif)
        .setFooter({ text: `Social Actions Engine • Total: ${totalCount} • Prefix: ,` });

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

    if (isSlash && (context.deferred || context.replied)) {
        await context.editReply({ embeds: [embed], components }).catch(() => {});
    } else {
        await context.reply({ embeds: [embed], components }).catch(() => {});
    }
}

async function sendSocialHelpMenu(context) {
    const prefix = config.DEFAULT_PREFIX || ',';
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('social_select_action')
        .setPlaceholder('🎭 Select a social action to view preview & details...')
        .addOptions([
            { label: 'Highfive', description: 'Highfive a friend 🙌', value: 'highfive', emoji: '🙌' },
            { label: 'Hug', description: 'Give someone a warm hug 🤗', value: 'hug', emoji: '🤗' },
            { label: 'Kiss', description: 'Blow a sweet kiss 💋', value: 'kiss', emoji: '💋' },
            { label: 'Pat', description: 'Gently pat someone on the head ⭐', value: 'pat', emoji: '⭐' },
            { label: 'Slap', description: 'Slap someone ✋', value: 'slap', emoji: '✋' },
            { label: 'Cuddle', description: 'Snuggle up and cuddle 🥺', value: 'cuddle', emoji: '🥺' },
            { label: 'Handhold', description: 'Hold hands 🤝', value: 'handhold', emoji: '🤝' },
            { label: 'Bonk', description: 'Bonk on the head 🔨', value: 'bonk', emoji: '🔨' },
            { label: 'Bite', description: 'Playfully bite 🦷', value: 'bite', emoji: '🦷' },
            { label: 'Poke', description: 'Poke someone 👉', value: 'poke', emoji: '👉' },
            { label: 'Punch', description: 'Playful punch 🥊', value: 'punch', emoji: '🥊' },
            { label: 'Dance', description: 'Dance happily 💃', value: 'dance', emoji: '💃' },
            { label: 'Cry', description: 'Cry your heart out 😭', value: 'cry', emoji: '😭' },
            { label: 'Blush', description: 'Blush deeply 😳', value: 'blush', emoji: '😳' },
            { label: 'Smile', description: 'Smile warmly 😊', value: 'smile', emoji: '😊' },
            { label: 'Sleep', description: 'Sleep zzz... 😴', value: 'sleep', emoji: '😴' }
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor('#FF79C6')
        .setTitle('🎭 Starry Anime Social Actions')
        .setDescription(`Express feelings or interact with friends using animated anime GIFs!\nAll shared actions (hugs, kisses, pats, highfives) are saved and tracked in the database!\n\n**Direct Command Examples:**\n• \`${prefix}highfive @user\` — Highfive someone\n• \`${prefix}hug @user\` — Hug a friend\n• \`${prefix}kiss @user\` — Kiss someone\n• \`${prefix}slap @user\` — Slap someone\n• \`${prefix}pat @user\` — Pat someone\n• \`${prefix}dance\` — Dance solo\n\n*Select an action from the dropdown menu to preview:*`)
        .setFooter({ text: 'Starry Social Suite • Prefix: ,' })
        .setTimestamp();

    const replyMsg = await context.reply({ embeds: [embed], components: [row] });
    
    if (replyMsg && typeof replyMsg.createMessageComponentCollector === 'function') {
        const collector = replyMsg.createMessageComponentCollector({ time: ONE_YEAR_MS });
        collector.on('collect', async (i) => {
            if (i.customId === 'social_select_action') {
                const selectedAction = i.values[0];
                const conf = ACTION_CONFIG[selectedAction];
                if (conf) {
                    const sampleGif = getSocialGif(selectedAction);
                    const previewEmbed = new EmbedBuilder()
                        .setColor(conf.color)
                        .setTitle(`${conf.emoji} Action Preview: ${selectedAction.toUpperCase()}`)
                        .setDescription(`**Usage:** \`${prefix}${selectedAction} ${conf.requiresTarget ? '@user' : ''}\`\n**Verb:** \`${conf.verb}\`\n**Action Type:** ${conf.group === 'action' ? '👥 Targeted Member Action' : '🎭 Solo Expression'}\n\n*Shared interactions are counted and stored in MongoDB!*`)
                        .setImage(sampleGif)
                        .setFooter({ text: `Prefix: ${prefix} • Starry Social Engine` });
                    await i.reply({ embeds: [previewEmbed], flags: [EPHEMERAL_FLAG] });
                }
            }
        });
    }
}

module.exports = (client) => {
    // Interactive button listener for social back buttons
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        const customId = interaction.customId;
        if (!customId.startsWith('social_')) return;

        const parts = customId.split('_');
        if (parts.length >= 5 && parts[2] === 'back') {
            const actionKey = parts[1];
            const targetId = parts[3];
            const originalAuthorId = parts[4];

            if (interaction.user.id !== targetId) {
                return interaction.reply({
                    content: `❌ Only <@${targetId}> can action back!`,
                    flags: [EPHEMERAL_FLAG]
                });
            }

            await interaction.deferReply().catch(() => {});
            const configData = ACTION_CONFIG[actionKey] || { verb: 'actions back at', emoji: '✨', color: '#9B59B6', noun: actionKey };
            const backGif = getSocialGif(actionKey);

            // Increment count in MongoDB
            const backCount = await incrementSocialCount(interaction.user.id, originalAuthorId, actionKey);

            const backEmbed = new EmbedBuilder()
                .setColor(configData.color)
                .setDescription(`**${interaction.user.username}** ${configData.verb} <@${originalAuthorId}> back!\n\n✨ That's **${backCount}** ${configData.noun || actionKey}s shared together! ${configData.emoji}`)
                .setImage(backGif)
                .setFooter({ text: `Social Engine • Total: ${backCount} • 1-Year Responsive Interaction` })
                .setTimestamp();

            await interaction.editReply({ embeds: [backEmbed] });
        }
    });
};

module.exports.socialCommandPayload = socialCommandBuilder.toJSON();
module.exports.executeSocialAction = executeSocialAction;
module.exports.sendSocialHelpMenu = sendSocialHelpMenu;
module.exports.ACTION_CONFIG = ACTION_CONFIG;
