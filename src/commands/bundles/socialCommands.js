// ==========================================
// 🎭 FLAVI-STYLE SUPREME SOCIAL & ANIME ACTIONS (26 COMMANDS)
// File Path: src/commands/bundles/socialCommands.js
// 1-Year Interactive Action Back Buttons & High-Quality Anime GIFs
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

let User;
try {
    User = require('../../models/User');
} catch (e) {
    User = mongoose.models.User;
}

const FALLBACK_GIFS = {
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

const ACTION_CONFIG = {
    kiss: { verb: 'kisses', emoji: '💋', color: '#FFB6C1', requiresTarget: true },
    pat: { verb: 'pets', emoji: '⭐', color: '#A7C7E7', requiresTarget: true },
    hug: { verb: 'hugs', emoji: '🤗', color: '#FF9494', requiresTarget: true },
    slap: { verb: 'slaps', emoji: '✋', color: '#E74C3C', requiresTarget: true },
    cuddle: { verb: 'cuddles with', emoji: '🥺', color: '#F39C12', requiresTarget: true },
    bite: { verb: 'bites', emoji: '🦷', color: '#9B59B6', requiresTarget: true },
    poke: { verb: 'pokes', emoji: '👉', color: '#3498DB', requiresTarget: true },
    punch: { verb: 'punches', emoji: '🥊', color: '#C0392B', requiresTarget: true },
    tickle: { verb: 'tickles', emoji: '🤏', color: '#1ABC9C', requiresTarget: true },
    feed: { verb: 'feeds', emoji: '🍱', color: '#2ECC71', requiresTarget: true },
    lick: { verb: 'licks', emoji: '👅', color: '#E91E63', requiresTarget: true },
    highfive: { verb: 'highfives', emoji: '🙌', color: '#F1C40F', requiresTarget: true },
    wave: { verb: 'waves at', emoji: '👋', color: '#34495E', requiresTarget: true },
    sleep: { verb: 'is sleeping zzz...', emoji: '😴', color: '#2C3E50', requiresTarget: false },
    wakeup: { verb: 'just woke up!', emoji: '⏰', color: '#E67E22', requiresTarget: false },
    cry: { verb: 'is crying...', emoji: '😭', color: '#3498DB', requiresTarget: false },
    laugh: { verb: 'is laughing hysterically!', emoji: '😆', color: '#F1C40F', requiresTarget: false },
    dance: { verb: 'is dancing happily!', emoji: '💃', color: '#9B59B6', requiresTarget: false },
    blush: { verb: 'is blushing deeply...', emoji: '😳', color: '#FFB6C1', requiresTarget: false },
    pout: { verb: 'is pouting!', emoji: '😤', color: '#E74C3C', requiresTarget: false },
    smile: { verb: 'smiles warmly!', emoji: '😊', color: '#2ECC71', requiresTarget: false },
    bored: { verb: 'is feeling super bored...', emoji: '🥱', color: '#95A5A6', requiresTarget: false }
};

async function fetchGif(actionKey) {
    try {
        const res = await fetch(`https://api.otakugifs.xyz/gif?reaction=${actionKey}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.url) return data.url;
        }
    } catch (e) {}
    const list = FALLBACK_GIFS[actionKey] || FALLBACK_GIFS.hug;
    return list[Math.floor(Math.random() * list.length)];
}

async function runSocialAction(ctx, actionKey) {
    const configData = ACTION_CONFIG[actionKey];
    if (!configData) return;

    let target = null;
    if (configData.requiresTarget) {
        if (ctx.message?.reference?.messageId) {
            try {
                const refMsg = await ctx.channel.messages.fetch(ctx.message.reference.messageId);
                target = refMsg.author;
            } catch (e) {}
        } else if (ctx.message?.mentions?.users?.size > 0) {
            target = ctx.message.mentions.users.first();
        } else if (ctx.args[0]) {
            const rawId = ctx.args[0].replace(/[^0-9]/g, '');
            target = await ctx.client.users.fetch(rawId).catch(() => null);
        }

        if (!target) {
            return ctx.reply(`❌ Mention someone or reply to a message to ${actionKey} them!\n*Usage: \`,${actionKey} @user\`*`);
        }
        if (target.id === ctx.user.id) {
            return ctx.reply(`❌ You cannot ${actionKey} yourself! Mention someone else.`);
        }
    }

    const gifUrl = await fetchGif(actionKey);
    let desc = `**${ctx.user.username}** ${configData.verb}`;
    if (target) desc += ` **${target.username}**!`;

    const embed = new EmbedBuilder()
        .setColor(configData.color)
        .setDescription(desc)
        .setImage(gifUrl)
        .setFooter({ text: 'Social Anime Engine • Prefix: ,' })
        .setTimestamp();

    const components = [];
    if (target && !target.bot) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`social_${actionKey}_back_${target.id}_${ctx.user.id}`)
                .setLabel(`${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)} back`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(configData.emoji)
        );
        components.push(row);
    }

    const replyMsg = await ctx.reply({ embeds: [embed], components });

    if (components.length > 0 && replyMsg) {
        // High Timing 1-Year Collector (31536000000 ms)
        const collector = replyMsg.createMessageComponentCollector({ time: ONE_YEAR_MS });
        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: `❌ Only ${target} can click to action back!`, ephemeral: true });
            }

            const returnGif = await fetchGif(actionKey);
            const returnEmbed = new EmbedBuilder()
                .setColor(configData.color)
                .setDescription(`**${i.user.username}** ${configData.verb} **${ctx.user.username}** back!`)
                .setImage(returnGif)
                .setFooter({ text: 'Social Anime Engine • 1-Year Response' })
                .setTimestamp();

            await i.reply({ embeds: [returnEmbed] });
        });
    }
}

const commands = [];

// Build all individual action commands
Object.keys(ACTION_CONFIG).forEach(key => {
    commands.push({
        name: key,
        category: 'Social',
        description: `Perform ${key} anime interaction or express emotion.`,
        usage: ACTION_CONFIG[key].requiresTarget ? `,${key} <@user>` : `,${key}`,
        async execute(ctx) {
            await runSocialAction(ctx, key);
        }
    });
});

// 23. SOCIAL MASTER HUB
commands.push({
    name: 'social',
    aliases: ['socials', 'actions'],
    category: 'Social',
    description: 'Display full animated anime social actions menu.',
    usage: ',social',
    async execute(ctx) {
        const prefix = config.DEFAULT_PREFIX || ',';
        const targeted = Object.keys(ACTION_CONFIG).filter(k => ACTION_CONFIG[k].requiresTarget).map(k => `\`${prefix}${k}\``).join(', ');
        const solo = Object.keys(ACTION_CONFIG).filter(k => !ACTION_CONFIG[k].requiresTarget).map(k => `\`${prefix}${k}\``).join(', ');

        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.SOCIAL)
            .setTitle('🎭 Starry & Flavi Social Actions Menu')
            .setDescription('Express feelings and interact with members using high-quality anime GIFs!\n\n*All action response buttons feature persistent 1-year interaction timing!*')
            .addFields(
                { name: '👥 Targeted Actions (Mention/Reply to User)', value: targeted, inline: false },
                { name: '✨ Solo Feelings & Expressions', value: solo, inline: false },
                { name: '💡 Example Usage', value: `• \`${prefix}hug @friend\`\n• \`${prefix}kiss\` (replying to a message)\n• \`${prefix}sleep\`\n• \`${prefix}dance\``, inline: false }
            )
            .setFooter({ text: 'Social Actions Engine • Prefix: ,' })
            .setTimestamp();

        return ctx.reply({ embeds: [embed] });
    }
});

// 24. TRUTH OR DARE (TORD)
commands.push({
    name: 'tord',
    aliases: ['truthordare', 'tod'],
    category: 'Social',
    description: 'Play interactive Truth or Dare with friends.',
    usage: ',tord',
    async execute(ctx) {
        const TRUTHS = [
            'What is the most embarrassing thing you have ever done?',
            'What is a secret you have never told anyone on Discord?',
            'Who in this server would you date if you had to pick?',
            'What is your biggest fear?',
            'What is the biggest lie you have ever told your parents?'
        ];

        const DARES = [
            'Send the last photo in your camera roll into this channel!',
            'Change your Discord nickname to "Supreme Potato" for 24 hours!',
            'Send a voice note singing your favorite song!',
            'Confess your love to a random member in this server!',
            'Send an embarrassing meme to your direct messages!'
        ];

        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.PRIMARY)
            .setTitle('🎲 Truth or Dare!')
            .setDescription('Click below to choose your challenge!\n*Buttons remain active with 1-Year lifetime.*')
            .setFooter({ text: `Requested by ${ctx.user.tag}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tod_truth').setLabel('Truth').setStyle(ButtonStyle.Primary).setEmoji('🗣️'),
            new ButtonBuilder().setCustomId('tod_dare').setLabel('Dare').setStyle(ButtonStyle.Danger).setEmoji('🔥'),
            new ButtonBuilder().setCustomId('tod_random').setLabel('Random').setStyle(ButtonStyle.Secondary).setEmoji('🎲')
        );

        const replyMsg = await ctx.reply({ embeds: [embed], components: [row] });

        // 1-Year Collector
        const collector = replyMsg.createMessageComponentCollector({ time: ONE_YEAR_MS });
        collector.on('collect', async (i) => {
            let choice = i.customId;
            if (choice === 'tod_random') choice = Math.random() > 0.5 ? 'tod_truth' : 'tod_dare';

            const isTruth = choice === 'tod_truth';
            const list = isTruth ? TRUTHS : DARES;
            const prompt = list[Math.floor(Math.random() * list.length)];

            const resEmbed = new EmbedBuilder()
                .setColor(isTruth ? '#3498DB' : '#E74C3C')
                .setTitle(isTruth ? '🗣️ TRUTH Challenge' : '🔥 DARE Challenge')
                .setDescription(`**${i.user.username}**, here is your challenge:\n\n>>> **${prompt}**`)
                .setFooter({ text: 'Truth or Dare • 1-Year Interactive' })
                .setTimestamp();

            await i.reply({ embeds: [resEmbed] });
        });
    }
});

// 25. COINFLIP
commands.push({
    name: 'coinflip',
    aliases: ['flip', 'cf'],
    category: 'Social',
    description: 'Flip a coin (Heads or Tails).',
    usage: ',coinflip',
    async execute(ctx) {
        const isHeads = Math.random() >= 0.5;
        const result = isHeads ? 'HEADS 🪙' : 'TAILS 🪙';
        const embed = new EmbedBuilder()
            .setColor(config.EMBED_COLORS.PRIMARY)
            .setTitle('🪙 Coin Flip Result')
            .setDescription(`The coin flipped and landed on: **${result}**!`)
            .setFooter({ text: `Flipped by ${ctx.user.username}` })
            .setTimestamp();
        return ctx.reply({ embeds: [embed] });
    }
});

// 26. ROLL
commands.push({
    name: 'roll',
    aliases: ['dice'],
    category: 'Social',
    description: 'Roll a random number/dice (e.g. ,roll 100).',
    usage: ',roll [max number]',
    async execute(ctx) {
        const max = parseInt(ctx.args[0]) || 6;
        const roll = Math.floor(Math.random() * max) + 1;
        return ctx.reply(`🎲 **${ctx.user.username} rolled a \`${roll}\` (out of ${max})!**`);
    }
});

module.exports = commands;
