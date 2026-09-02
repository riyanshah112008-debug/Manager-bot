// ==========================================
// 🎭 Starry SUPREME SOCIAL & ANIME ACTIONS (26 COMMANDS)
// File Path: src/commands/bundles/socialCommands.js
// 1-Year Interactive Action Back Buttons & High-Definition Anime GIFs
// MongoDB Database Persistence for Hugs, Kisses, Pats & Highfives Shared Together
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const mongoose = require('mongoose');
const config = require('../../config');
const { ONE_YEAR_MS } = require('../../utils/contextHelper');
const { getSocialGif } = require('../../utils/animeGifs');
const { incrementSocialCount } = require('../../models/SocialStats');

let User;
try {
    User = require('../../models/User');
} catch (e) {
    User = mongoose.models.User;
}

const ACTION_CONFIG = {
    highfive: { verb: 'highfives', noun: 'highfives', emoji: '🙌', color: '#F1C40F', requiresTarget: true },
    hug: { verb: 'hugs', noun: 'hugs', emoji: '🤗', color: '#FF9494', requiresTarget: true },
    kiss: { verb: 'kisses', noun: 'kisses', emoji: '💋', color: '#FFB6C1', requiresTarget: true },
    pat: { verb: 'pets', noun: 'pats', emoji: '⭐', color: '#A7C7E7', requiresTarget: true },
    slap: { verb: 'slaps', noun: 'slaps', emoji: '✋', color: '#E74C3C', requiresTarget: true },
    cuddle: { verb: 'cuddles with', noun: 'cuddles', emoji: '🥺', color: '#F39C12', requiresTarget: true },
    bite: { verb: 'bites', noun: 'bites', emoji: '🦷', color: '#9B59B6', requiresTarget: true },
    poke: { verb: 'pokes', noun: 'pokes', emoji: '👉', color: '#3498DB', requiresTarget: true },
    punch: { verb: 'punches', noun: 'punches', emoji: '🥊', color: '#C0392B', requiresTarget: true },
    tickle: { verb: 'tickles', noun: 'tickles', emoji: '🤏', color: '#1ABC9C', requiresTarget: true },
    feed: { verb: 'feeds', noun: 'meals', emoji: '🍱', color: '#2ECC71', requiresTarget: true },
    lick: { verb: 'licks', noun: 'licks', emoji: '👅', color: '#E91E63', requiresTarget: true },
    wave: { verb: 'waves at', noun: 'waves', emoji: '👋', color: '#34495E', requiresTarget: true },
    handhold: { verb: 'holds hands with', noun: 'handholds', emoji: '🤝', color: '#FFD700', requiresTarget: true },
    bonk: { verb: 'bonks', noun: 'bonks', emoji: '🔨', color: '#E67E22', requiresTarget: true },
    yeet: { verb: 'yeets', noun: 'yeets', emoji: '🚀', color: '#9B59B6', requiresTarget: true },
    boop: { verb: 'boops', noun: 'boops', emoji: '👉', color: '#1ABC9C', requiresTarget: true },
    
    sleep: { verb: 'is sleeping zzz...', noun: 'naps', emoji: '😴', color: '#2C3E50', requiresTarget: false },
    wakeup: { verb: 'just woke up!', noun: 'wakeups', emoji: '⏰', color: '#E67E22', requiresTarget: false },
    cry: { verb: 'is crying...', noun: 'cries', emoji: '😭', color: '#3498DB', requiresTarget: false },
    laugh: { verb: 'is laughing hysterically!', noun: 'laughs', emoji: '😆', color: '#F1C40F', requiresTarget: false },
    dance: { verb: 'is dancing happily!', noun: 'dances', emoji: '💃', color: '#9B59B6', requiresTarget: false },
    blush: { verb: 'is blushing deeply...', noun: 'blushes', emoji: '😳', color: '#FFB6C1', requiresTarget: false },
    pout: { verb: 'is pouting!', noun: 'pouts', emoji: '😤', color: '#E74C3C', requiresTarget: false },
    smile: { verb: 'smiles warmly!', noun: 'smiles', emoji: '😊', color: '#2ECC71', requiresTarget: false },
    stare: { verb: 'stares intently...', noun: 'stares', emoji: '👀', color: '#95A5A6', requiresTarget: false },
    cheer: { verb: 'is cheering excitedly!', noun: 'cheers', emoji: '🎉', color: '#F39C12', requiresTarget: false }
};

function createSocialCommand(key, configData) {
    return {
        name: key,
        aliases: [],
        category: 'Social',
        description: `${configData.verb.charAt(0).toUpperCase() + configData.verb.slice(1)} ${configData.requiresTarget ? 'a member' : 'an emotion'}`,
        usage: configData.requiresTarget ? `,${key} @user` : `,${key}`,
        async execute(ctx) {
            const author = ctx.user;
            const authorIdStr = String(author.id);
            let target = null;

            if (configData.requiresTarget) {
                target = ctx.options?.getUser ? ctx.options.getUser('target') : null;
                if (!target) {
                    if (ctx.message?.reference?.messageId) {
                        try {
                            const refMsg = await ctx.channel.messages.fetch(ctx.message.reference.messageId);
                            target = refMsg.author;
                        } catch (e) {}
                    } else if (ctx.message?.mentions?.users?.first()) {
                        target = ctx.message.mentions.users.first();
                    }
                }

                if (!target) {
                    return ctx.reply(`❌ Please mention someone or reply to their message to ${key} them!\n*Usage: \`,${key} @user\`*`);
                }

                if (String(target.id) === authorIdStr) {
                    return ctx.reply(`❌ You cannot ${key} yourself! Please mention someone else.`);
                }
            }

            const targetIdStr = target ? String(target.id) : null;
            const totalCount = await incrementSocialCount(authorIdStr, targetIdStr, key);

            const gifUrl = getSocialGif(key);
            let desc = `**${author.username}** ${configData.verb}`;
            if (target) {
                desc += ` **${target.username}**!\n\n✨ That's **${totalCount}** ${configData.noun || key}s shared together! ${configData.emoji}`;
            } else {
                desc += `\n\n✨ Personal ${key} count: **${totalCount}** ${configData.emoji}`;
            }

            const embed = new EmbedBuilder()
                .setColor(configData.color || '#FF79C6')
                .setDescription(desc)
                .setImage(gifUrl)
                .setFooter({ text: `Social Actions Engine • Total: ${totalCount} • Prefix: ,` });

            const components = [];
            if (target && !target.bot) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`social_${key}_back_${target.id}_${authorIdStr}`)
                        .setLabel(`${key.charAt(0).toUpperCase() + key.slice(1)} back`)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(configData.emoji)
                );
                components.push(row);
            }

            return ctx.reply({ embeds: [embed], components });
        }
    };
}

const commands = [
    // Social Menu Command
    {
        name: 'social',
        aliases: ['actions', 'anime'],
        category: 'Social',
        description: 'Interactive anime social actions hub or execute direct social action.',
        usage: ',social',
        async execute(ctx) {
            if (ctx.isSlash) {
                const sub = ctx.source?.options?.getSubcommand(false);
                if (sub && ACTION_CONFIG[sub]) {
                    const { executeSocialAction } = require('../socialActions');
                    return executeSocialAction(sub, ctx.source, true);
                }
            }
            const { sendSocialHelpMenu } = require('../socialActions');
            return sendSocialHelpMenu(ctx);
        }
    }
];

// Generate all individual commands
for (const [key, conf] of Object.entries(ACTION_CONFIG)) {
    commands.push(createSocialCommand(key, conf));
}

module.exports = commands;
