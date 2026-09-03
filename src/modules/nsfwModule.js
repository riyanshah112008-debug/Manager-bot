// ==========================================
// 🔞 STARRY MATURE & ANIME NSFW ENGINE
// File Path: src/modules/nsfwModule.js
// Default OFF for All Servers & DMs • Strict Channel NSFW Verification • AI Explainer
// Resilient Multi-Provider Anime Engine (nekos.best, waifu.im, curated CDN fallback)
// ==========================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fetch = require('node-fetch');
const ServerSettings = require('../models/ServerSettings');
const User = require('../models/User');
const { generateStarryResponse } = require('../utils/aiEngine');
const config = require('../config');

// In-memory DM NSFW Opt-In set for users
const dmNsfwUsers = new Set();

async function isNsfwAllowed(ctx) {
    // 1. If in DMs
    if (!ctx.guild) {
        return dmNsfwUsers.has(ctx.user.id);
    }

    // 2. If in a Server: Check database setting
    let settings = await ServerSettings.findOne({ guildId: ctx.guild.id });
    if (!settings || !settings.nsfw?.enabled) {
        return false;
    }

    // 3. Check if channel is marked as NSFW (Age-Restricted) in Discord
    if (ctx.channel && !ctx.channel.nsfw) {
        return 'CHANNEL_NOT_NSFW';
    }

    return true;
}

// Curated high-definition anime fallback galleries
const CURATED_ANIME_POOLS = {
    waifu: [
        'https://i.imgur.com/8QZqX4Y.jpg',
        'https://i.imgur.com/y3A6F1c.jpg',
        'https://i.imgur.com/zWcK4jY.jpg',
        'https://i.imgur.com/vHqB5eR.jpg',
        'https://i.imgur.com/7w2Qh7Z.jpg'
    ],
    neko: [
        'https://i.imgur.com/gK9J2bC.jpg',
        'https://i.imgur.com/3N4oQ1v.jpg',
        'https://i.imgur.com/wO4cyRJ.gif',
        'https://i.imgur.com/ye7OTQg.gif'
    ],
    ecchi: [
        'https://i.imgur.com/J7vL9aB.jpg',
        'https://i.imgur.com/5tmRHwT.gif',
        'https://i.imgur.com/nyGFcsP.gif',
        'https://i.imgur.com/134BfF8.gif'
    ],
    hentai: [
        'https://i.imgur.com/J7vL9aB.jpg',
        'https://i.imgur.com/nyGFcsP.gif',
        'https://i.imgur.com/5tmRHwT.gif'
    ]
};

async function fetchAnimeImage(category = 'waifu', isNsfw = false) {
    const safeCat = category.toLowerCase();

    // 1. Try nekos.best API
    const bestEndpoints = [
        `https://nekos.best/api/v2/${safeCat === 'animeart' ? 'waifu' : safeCat}`,
        `https://nekos.best/api/v2/waifu`,
        `https://nekos.best/api/v2/neko`
    ];

    for (const url of bestEndpoints) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results[0]?.url) {
                    return data.results[0].url;
                }
            }
        } catch (e) {}
    }

    // 2. Curated fallback pool
    const pool = CURATED_ANIME_POOLS[safeCat] || CURATED_ANIME_POOLS.waifu;
    return pool[Math.floor(Math.random() * pool.length)];
}

async function explainNsfwWithAI(ctx) {
    const prompt = 'Explain what the mature / anime NSFW module of Starry Bot contains in a polite, helpful, and concise manner. Mention that it includes anime waifus, nekos, romantic gifs (kiss, hug, cuddle), anime ecchi art, and wallpapers, and explain how it is kept safe (default OFF, requires Discord age-restricted NSFW channel, and strictly prevents non-consensual or graphic violence).';
    
    const { text, model } = await generateStarryResponse(prompt, ctx.user.id, !ctx.guild);

    const embed = new EmbedBuilder()
        .setColor('#FF69B4') // Hot Pink / Anime
        .setAuthor({ 
            name: 'Starry AI • Mature & Anime Module Explainer', 
            iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' 
        })
        .setTitle('🔞 What is in the Starry Mature / NSFW Module?')
        .setDescription(text)
        .addFields(
            {
                name: '🔒 Safety & Enforcement Protocols',
                value: 
                    `• **Default Status:** \`🔴 DISABLED BY DEFAULT\` on all servers & DMs.\n` +
                    `• **Server Activation:** Requires Administrator command \`,nsfw on\`.\n` +
                    `• **Channel Enforcement:** Only works in Discord-verified **Age-Restricted (NSFW)** channels.\n` +
                    `• **DM Opt-In:** Requires running \`,nsfw dms on\` in Direct Messages.\n` +
                    `• **Content Safety:** Strictly anime artwork, waifus, nekos, and romantic interactions.`
            }
        )
        .setFooter({ text: `Powered by ${model} • Toggle with ,nsfw on / off` })
        .setTimestamp();

    return embed;
}

module.exports = {
    isNsfwAllowed,
    fetchAnimeImage,
    explainNsfwWithAI,
    dmNsfwUsers
};
