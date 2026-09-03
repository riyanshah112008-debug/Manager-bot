// ==========================================
// 🔞 STARRY MATURE & ANIME NSFW ENGINE
// File Path: src/modules/nsfwModule.js
// Default OFF for All Servers & DMs • Strict Channel NSFW Verification • AI Explainer
// Safe Anime Waifus, Nekos, Romantic Actions & Artwork
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

async function fetchAnimeImage(category = 'waifu', isNsfw = false) {
    const type = isNsfw ? 'nsfw' : 'sfw';
    const endpoints = [
        `https://api.waifu.pics/${type}/${category}`,
        `https://nekos.life/api/v2/img/${category === 'waifu' ? 'waifu' : category}`
    ];

    for (const url of endpoints) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                const data = await res.json();
                if (data.url) return data.url;
            }
        } catch (e) {}
    }

    // Fallback aesthetic anime URL
    return 'https://i.imgur.com/8QZqX4Y.jpg';
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
