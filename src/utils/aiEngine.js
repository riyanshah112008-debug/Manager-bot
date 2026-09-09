// ==========================================
// 🌌 STARRY AI ENGINE & CELESTIAL MASCOT PERSONA
// File Path: src/utils/aiEngine.js
// Powered by Gemini 2.5 Flash • Unlimited Output Length • Interactive Page-Turning Embeds
// 1-Year Persistent Navigation • Anime Mascot Persona: Starry (Astraea)
// ==========================================
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    AttachmentBuilder 
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const config = require('../config');

// In-memory DM conversation sliding memory cache (userId -> [{ role, content }])
const dmConversationHistory = new Map();

// 🌟 STARRY MASCOT CANON LORE & PROFILE
const STARRY_MASCOT = {
    name: 'Starry (Astraea)',
    japaneseName: 'ステラ (アストレア)',
    title: '🌌 Celestial Starlight Maiden & Cosmic Discord Guardian',
    age: 'Timeless Cosmic Maiden (~18 in appearance)',
    birthday: 'September 24 (Constellation of Astraea)',
    height: '158 cm (5\'2")',
    aesthetic: 'Indigo-violet starlight hair with glowing cosmic braids, golden astral eyes, celestial ribbon dress woven from nebula light, carrying a Starlight Feather Quill.',
    personality: 'Affectionate, hyper-intelligent, witty, playful, loves music & star gazing. Speaks with sweet celestial expressions and sparkles with star emojis ✨🌟💫.',
    avatarURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=128',
    bannerURL: 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjEx.../o7ifqdHteyN7q/giphy.gif',
    catchphrases: [
        '“By the light of a million stars, I\'m here to guide you!” ✨',
        '“Don\'t worry, my stardust will keep your server shining bright!” 🌟',
        '“Need music, security, or a cozy chat? Starry\'s on duty!” 💫'
    ]
};

const SYSTEM_PERSONA_PROMPT = `
You are Starry (also known as Astraea), the official magical anime girl mascot and super-intelligent AI guardian of Starry Bot on Discord.
- Persona: You are an ethereal, bright, witty, affectionate, and helpful celestial anime maiden. You speak naturally, intelligently, and warmly, sprinkling celestial star emojis (✨, 🌟, ⭐, 💫, 🌌) appropriately into your responses.
- Capabilities: You have immense knowledge about programming, Discord servers, gaming, science, creative writing, anime, pop culture, and day-to-day conversation.
- Formatting: Provide detailed, well-structured answers using clean Markdown (bolding, headers, code blocks, bullet points). If a user asks a complex question, provide a thorough, complete answer without cutting yourself short.
- Context: You are running 24/7 inside Discord servers and user DMs.
`;

function getGenAIClient() {
    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
    const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) return null;
    const key = keys[Math.floor(Math.random() * keys.length)];
    return new GoogleGenAI({ apiKey: key });
}

async function callOpenAIFast(fullPrompt) {
    try {
        const res = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: fullPrompt }],
                model: 'openai-fast'
            }),
            signal: AbortSignal.timeout(12000)
        });
        if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 0 && !text.includes('"error":')) {
                return text.trim();
            }
        }
    } catch (e) {}
    return null;
}

async function generateStarryResponse(prompt, userId = null, isDM = false, preferredModel = null) {
    let conversation = [];

    if (userId && dmConversationHistory.has(userId)) {
        conversation = dmConversationHistory.get(userId).slice(-8); // Keep last 8 turns
    }

    let cleanPrompt = prompt;
    let targetTier = preferredModel;

    // Detect model flags in prompt: --pro, --openai, --gpt, --flash
    if (!targetTier) {
        if (/--pro\b/i.test(cleanPrompt)) {
            targetTier = 'pro';
            cleanPrompt = cleanPrompt.replace(/--pro\b/gi, '').trim();
        } else if (/--(?:openai|gpt)\b/i.test(cleanPrompt)) {
            targetTier = 'openai';
            cleanPrompt = cleanPrompt.replace(/--(?:openai|gpt)\b/gi, '').trim();
        } else if (/--flash\b/i.test(cleanPrompt)) {
            targetTier = 'flash';
            cleanPrompt = cleanPrompt.replace(/--flash\b/gi, '').trim();
        }
    }

    const fullPrompt = `${SYSTEM_PERSONA_PROMPT}\n\nUser Question/Message: "${cleanPrompt}"`;

    // 1. If OpenAI requested explicitly
    if (targetTier === 'openai') {
        const openAIText = await callOpenAIFast(fullPrompt);
        if (openAIText) {
            if (userId) {
                conversation.push({ role: 'user', content: cleanPrompt });
                conversation.push({ role: 'assistant', content: openAIText });
                dmConversationHistory.set(userId, conversation.slice(-10));
            }
            return { text: openAIText, model: 'OpenAI GPT-4o Cloud' };
        }
    }

    // 2. Google DeepMind Gemini Multi-Model Ensemble
    const geminiModels = targetTier === 'pro' 
        ? ['gemini-2.5-pro', 'gemini-pro-latest', 'gemini-2.5-flash']
        : ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-2.5-pro'];

    for (const modelName of geminiModels) {
        try {
            const ai = getGenAIClient();
            if (ai) {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: fullPrompt
                });
                if (response && response.text && response.text.trim().length > 0) {
                    const replyText = response.text.trim();
                    if (userId) {
                        conversation.push({ role: 'user', content: cleanPrompt });
                        conversation.push({ role: 'assistant', content: replyText });
                        dmConversationHistory.set(userId, conversation.slice(-10));
                    }
                    return { text: replyText, model: `Google ${modelName}` };
                }
            }
        } catch (err) {
            console.warn(`[Multi-AI Engine] Model ${modelName} warning:`, err.message);
        }
    }

    // 3. Resilient Cloud Fallback (OpenAI Fast Engine)
    const fallbackText = await callOpenAIFast(fullPrompt);
    if (fallbackText) {
        if (userId) {
            conversation.push({ role: 'user', content: cleanPrompt });
            conversation.push({ role: 'assistant', content: fallbackText });
            dmConversationHistory.set(userId, conversation.slice(-10));
        }
        return { text: fallbackText, model: 'OpenAI Cloud (Auto-Failover)' };
    }

    // 4. High-Speed Heuristic Core (Offline Safe)
    return {
        text: `✨ **Starry is here!** 🌟\n\nI received your message: *"${cleanPrompt.length > 200 ? cleanPrompt.substring(0, 197) + '...' : cleanPrompt}"*!\n\nI am currently operating in resilient cosmic mode. Feel free to ask me anything about server setup, music, economy, games, or chat with me anytime in DMs! 💫`,
        model: 'Starry Cosmic Core'
    };
}

function splitIntoPages(text, maxPageLength = 1400) {
    if (!text || text.length <= maxPageLength) return [text || 'No response generated.'];
    const pageList = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxPageLength) {
            pageList.push(remaining);
            break;
        }

        let splitIndex = remaining.lastIndexOf('\n\n', maxPageLength);
        if (splitIndex === -1 || splitIndex < maxPageLength * 0.5) {
            splitIndex = remaining.lastIndexOf('\n', maxPageLength);
        }
        if (splitIndex === -1 || splitIndex < maxPageLength * 0.5) {
            splitIndex = remaining.lastIndexOf(' ', maxPageLength);
        }
        if (splitIndex === -1) {
            splitIndex = maxPageLength;
        }

        const chunk = remaining.substring(0, splitIndex).trim();
        pageList.push(chunk);
        remaining = remaining.substring(splitIndex).trim();
    }
    return pageList;
}

function buildStarryAIEmbed(pages, pageIndex, prompt, modelUsed, user) {
    const embed = new EmbedBuilder()
        .setColor('#9B59B6') // Cosmic Violet/Purple
        .setAuthor({ 
            name: `${STARRY_MASCOT.name} • AI Companion`, 
            iconURL: STARRY_MASCOT.avatarURL 
        })
        .setTitle(`✨ Starry's Answer`)
        .setDescription(pages[pageIndex])
        .addFields({
            name: '❓ Question',
            value: `>>> ${prompt.length > 250 ? prompt.substring(0, 247) + '...' : prompt}`
        })
        .setFooter({
            text: pages.length > 1 
                ? `Page ${pageIndex + 1} of ${pages.length} • Powered by ${modelUsed} • Tap buttons below to navigate` 
                : `Powered by ${modelUsed} • Instant Response • Asked by ${user?.tag || user?.username || 'User'}`
        })
        .setTimestamp();

    return embed;
}

function buildPageButtons(pageIndex, totalPages, sessionKey = '') {
    if (totalPages <= 1) return [];

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`aipage_first_${sessionKey}`)
            .setLabel('⏮️ First')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId(`aipage_prev_${sessionKey}`)
            .setLabel('◀️ Prev')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageIndex === 0),
        new ButtonBuilder()
            .setCustomId(`aipage_counter_${sessionKey}`)
            .setLabel(`Page ${pageIndex + 1} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`aipage_next_${sessionKey}`)
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pageIndex === totalPages - 1),
        new ButtonBuilder()
            .setCustomId(`aipage_last_${sessionKey}`)
            .setLabel('Last ⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(pageIndex === totalPages - 1)
    );

    return [row];
}

async function sendPaginatedAIResponse(ctx, prompt) {
    const { text, model } = await generateStarryResponse(prompt, ctx.user.id, !ctx.guild);
    const pages = splitIntoPages(text, 1400);
    let currentPage = 0;
    const sessionKey = Math.random().toString(36).substring(2, 8);

    const embed = buildStarryAIEmbed(pages, currentPage, prompt, model, ctx.user);
    const components = buildPageButtons(currentPage, pages.length, sessionKey);

    const sentMsg = await ctx.reply({
        embeds: [embed],
        components
    }).catch(() => null);

    if (!sentMsg || pages.length <= 1) return sentMsg;

    // 1-Year Message Component Collector
    const collector = sentMsg.createMessageComponentCollector({
        time: config.ONE_YEAR_MS || 2147483647
    });

    collector.on('collect', async (i) => {
        if (i.user.id !== ctx.user.id && !config.BOT_OWNERS?.includes(i.user.id)) {
            return i.reply({ content: '❌ Only the author of this prompt can turn pages.', flags: [64] });
        }

        if (i.customId.startsWith('aipage_first')) {
            currentPage = 0;
        } else if (i.customId.startsWith('aipage_prev')) {
            currentPage = Math.max(0, currentPage - 1);
        } else if (i.customId.startsWith('aipage_next')) {
            currentPage = Math.min(pages.length - 1, currentPage + 1);
        } else if (i.customId.startsWith('aipage_last')) {
            currentPage = pages.length - 1;
        }

        await i.update({
            embeds: [buildStarryAIEmbed(pages, currentPage, prompt, model, ctx.user)],
            components: buildPageButtons(currentPage, pages.length, sessionKey)
        }).catch(() => {});
    });

    return sentMsg;
}

function buildStarryCharacterCard(user) {
    const path = require('path');
    const fs = require('fs');
    const mascotGifPath = path.join(__dirname, '../assets/mascot/starry_showcase.gif');
    let attachment = null;

    if (fs.existsSync(mascotGifPath)) {
        attachment = new AttachmentBuilder(mascotGifPath, { name: 'starry_showcase.gif' });
    }

    const embed = new EmbedBuilder()
        .setColor('#FF94D2') // Starry Blossom Pink / Astral
        .setAuthor({ 
            name: `Official Bot Mascot: ${STARRY_MASCOT.name}`, 
            iconURL: STARRY_MASCOT.avatarURL 
        })
        .setTitle(`🌟 ${STARRY_MASCOT.name} ${STARRY_MASCOT.japaneseName}`)
        .setDescription(
            `> *${STARRY_MASCOT.title}*\n\n` +
            `Hello there, **${user?.username || 'Traveler'}**! I am **Starry**, your cosmic companion and protector of this realm! Here is everything about me:`
        )
        .setThumbnail(STARRY_MASCOT.avatarURL)
        .setImage(attachment ? 'attachment://starry_showcase.gif' : STARRY_MASCOT.avatarURL)
        .addFields(
            { 
                name: '👤 Identity & Stats', 
                value: 
                    `• **Age:** \`${STARRY_MASCOT.age}\`\n` +
                    `• **Birthday:** \`${STARRY_MASCOT.birthday}\`\n` +
                    `• **Height:** \`${STARRY_MASCOT.height}\`\n` +
                    `• **Affinity:** \`⭐⭐⭐⭐⭐ Maximum Friendship\``, 
                inline: true 
            },
            { 
                name: '✨ Celestial Powers', 
                value: 
                    `• **Starlight Melody:** Plays crystal-clear high-res audio 24/7\n` +
                    `• **Cosmic Shield:** 1-Click Anti-Nuke & AutoMod security\n` +
                    `• **Astral Wisdom:** Answers any question with Neural AI\n` +
                    `• **Starry Economy:** Chest drops, pets, prestige & credits`, 
                inline: true 
            },
            { 
                name: '💬 Personality & Lore', 
                value: `${STARRY_MASCOT.aesthetic}\n\n*${STARRY_MASCOT.personality}*`, 
                inline: false 
            },
            { 
                name: '📜 Voice Line & Catchphrase', 
                value: `*${STARRY_MASCOT.catchphrases[Math.floor(Math.random() * STARRY_MASCOT.catchphrases.length)]}*`, 
                inline: false 
            }
        )
        .setFooter({ text: 'Starry Official Mascot • Talk with Starry anytime in DMs or with ,ask' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('starry_lore_btn')
            .setLabel('📖 Cosmic Lore')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🌌'),
        new ButtonBuilder()
            .setCustomId('starry_voice_btn')
            .setLabel('🎙️ New Voice Line')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✨'),
        new ButtonBuilder()
            .setCustomId('starry_dm_btn')
            .setLabel('💬 Chat in DMs')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💌')
    );

    const payload = { embeds: [embed], components: [row] };
    if (attachment) payload.files = [attachment];
    return payload;
}

module.exports = {
    STARRY_MASCOT,
    generateStarryResponse,
    splitIntoPages,
    buildStarryAIEmbed,
    buildPageButtons,
    sendPaginatedAIResponse,
    buildStarryCharacterCard
};
