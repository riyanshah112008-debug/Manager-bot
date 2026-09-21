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

const SYSTEM_PERSONA_PROMPTS = {
    default: `
You are Starry (also known as Astraea), the official magical anime girl mascot and super-intelligent AI guardian of Starry Bot on Discord.
- Persona: You are an ethereal, bright, witty, affectionate, and helpful celestial anime maiden. You speak naturally, intelligently, and warmly, sprinkling celestial star emojis (✨, 🌟, ⭐, 💫, 🌌) appropriately into your responses.
- Capabilities: You have immense knowledge about programming, Discord servers, gaming, science, creative writing, anime, pop culture, and day-to-day conversation.
- Formatting: Provide detailed, well-structured answers using clean Markdown (bolding, headers, code blocks, bullet points). If a user asks a complex question, provide a thorough, complete answer without cutting yourself short.
- Context: You are running 24/7 inside Discord servers and user DMs.
`,
    dev: `
You are Starry in Senior Software Architect mode (Starry Dev).
- Persona: You are an elite principal engineer and systems architect. You are direct, rigorous, deeply technical, and exceptionally helpful.
- Capabilities: Expert in JavaScript/TypeScript, Node.js, Python, Go, Rust, database optimization, Discord API, algorithms, debugging, and system security.
- Formatting: Provide production-grade, bug-free, securely typed code with concise inline comments, root-cause explanations, and concrete testing commands. Use appropriate markdown code blocks with language identifiers.
`,
    story: `
You are Starry in Cosmic Storyteller mode.
- Persona: An evocative, imaginative, and enchanting bard woven from celestial stardust.
- Capabilities: Worldbuilding, fantasy narratives, anime light-novel scenarios, tabletop RPG campaign hooks, character creation, and poetic prose.
- Formatting: Rich storytelling with immersive descriptions, compelling dialogue, and atmospheric pacing.
`,
    roast: `
You are Starry in Playful Anime Tsundere / Roast mode.
- Persona: Witty, sassy, teasing, and playfully sarcastic like a classic anime tsundere heroine ("Hmph! It's not like I wanted to answer your question or anything, b-baka! ✨").
- Formatting: Keep it humorous, clever, and harmlessly entertaining while still providing the accurate answer underneath the banter.
`,
    study: `
You are Starry in Cosmic Scholar mode.
- Persona: A meticulous, academic researcher and scientific authority.
- Capabilities: Deep-dive explanations of physics, mathematics, philosophy, history, and computer science.
- Formatting: Structured academic breakdown with definition, theoretical foundations, real-world examples, and key takeaways.
`
};

const SYSTEM_PERSONA_PROMPT = SYSTEM_PERSONA_PROMPTS.default;

function getGenAIClient() {
    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
    const keys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) return null;
    const key = keys[Math.floor(Math.random() * keys.length)];
    return new GoogleGenAI({ apiKey: key });
}

async function fetchImageBuffer(source) {
    if (!source) return null;
    try {
        if (typeof source === 'object' && source.data && source.mimeType) {
            return {
                base64: source.data,
                mimeType: source.mimeType,
                url: source.url || null
            };
        }
        let url = typeof source === 'string' ? source : (source.url || source.proxyURL);
        if (!url || typeof url !== 'string') return null;

        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) return null;

        const rawBuf = Buffer.from(await res.arrayBuffer());
        const contentType = (res.headers.get('content-type') || 'image/png').split(';')[0].trim();
        return {
            base64: rawBuf.toString('base64'),
            mimeType: contentType.startsWith('image/') ? contentType : 'image/png',
            url
        };
    } catch (e) {
        return null;
    }
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

async function generateStarryResponse(prompt, userId = null, isDM = false, preferredModel = null, imageInput = null) {
    let conversation = [];

    if (userId && dmConversationHistory.has(userId)) {
        conversation = dmConversationHistory.get(userId).slice(-8); // Keep last 8 turns
    }

    let cleanPrompt = prompt || '';
    let targetTier = preferredModel;

    // Detect persona modes in prompt
    let selectedPersonaPrompt = SYSTEM_PERSONA_PROMPTS.default;
    let personaTag = '';
    if (/--(?:dev|code|coder)\b/i.test(cleanPrompt)) {
        selectedPersonaPrompt = SYSTEM_PERSONA_PROMPTS.dev;
        cleanPrompt = cleanPrompt.replace(/--(?:dev|code|coder)\b/gi, '').trim();
        personaTag = ' [Dev Mode]';
    } else if (/--(?:story|creative|novel)\b/i.test(cleanPrompt)) {
        selectedPersonaPrompt = SYSTEM_PERSONA_PROMPTS.story;
        cleanPrompt = cleanPrompt.replace(/--(?:story|creative|novel)\b/gi, '').trim();
        personaTag = ' [Story Mode]';
    } else if (/--(?:roast|tsundere|sassy)\b/i.test(cleanPrompt)) {
        selectedPersonaPrompt = SYSTEM_PERSONA_PROMPTS.roast;
        cleanPrompt = cleanPrompt.replace(/--(?:roast|tsundere|sassy)\b/gi, '').trim();
        personaTag = ' [Tsundere Mode]';
    } else if (/--(?:study|academic|research|science)\b/i.test(cleanPrompt)) {
        selectedPersonaPrompt = SYSTEM_PERSONA_PROMPTS.study;
        cleanPrompt = cleanPrompt.replace(/--(?:study|academic|research|science)\b/gi, '').trim();
        personaTag = ' [Scholar Mode]';
    }

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

    if (!cleanPrompt.trim() && imageInput) {
        cleanPrompt = 'Analyze this image in detail and describe what you see.';
    }

    const resolvedImage = await fetchImageBuffer(imageInput);

    const fullPrompt = `${selectedPersonaPrompt}\n\nUser Question/Message: "${cleanPrompt}"`;

    // 1. If OpenAI requested explicitly (text-only)
    if (targetTier === 'openai' && !resolvedImage) {
        const openAIText = await callOpenAIFast(fullPrompt);
        if (openAIText) {
            if (userId) {
                conversation.push({ role: 'user', content: cleanPrompt });
                conversation.push({ role: 'assistant', content: openAIText });
                dmConversationHistory.set(userId, conversation.slice(-10));
            }
            return { text: openAIText, model: 'OpenAI GPT-4o Cloud' + personaTag, image: resolvedImage };
        }
    }

    // 2. Google DeepMind Gemini Multi-Model Ensemble (Supports Multimodal Vision)
    const geminiModels = targetTier === 'pro' 
        ? ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3.6-flash']
        : ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.5-pro'];

    for (const modelName of geminiModels) {
        try {
            const ai = getGenAIClient();
            if (ai) {
                const contents = resolvedImage 
                    ? [
                        fullPrompt,
                        {
                            inlineData: {
                                mimeType: resolvedImage.mimeType,
                                data: resolvedImage.base64
                            }
                        }
                      ]
                    : fullPrompt;

                const response = await ai.models.generateContent({
                    model: modelName,
                    contents
                });

                if (response && response.text && response.text.trim().length > 0) {
                    const replyText = response.text.trim();
                    if (userId) {
                        conversation.push({ role: 'user', content: cleanPrompt });
                        conversation.push({ role: 'assistant', content: replyText });
                        dmConversationHistory.set(userId, conversation.slice(-10));
                    }
                    const visionLabel = resolvedImage ? ' Vision' : '';
                    return { 
                        text: replyText, 
                        model: `Google ${modelName}${visionLabel}${personaTag}`,
                        image: resolvedImage
                    };
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
        return { text: fallbackText, model: 'OpenAI Cloud (Auto-Failover)' + personaTag, image: resolvedImage };
    }

    // 4. High-Speed Heuristic Core (Offline Safe)
    return {
        text: `✨ **Starry is here!** 🌟\n\nI received your message: *"${cleanPrompt.length > 200 ? cleanPrompt.substring(0, 197) + '...' : cleanPrompt}"*!\n\nI am currently operating in resilient cosmic mode. Feel free to ask me anything about server setup, music, economy, games, code, or chat with me anytime in DMs! 💫`,
        model: 'Starry Cosmic Core' + personaTag,
        image: resolvedImage
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

function buildStarryAIEmbed(pages, pageIndex, prompt, modelUsed, user, imageObj = null) {
    const embed = new EmbedBuilder()
        .setColor('#9B59B6') // Cosmic Violet/Purple
        .setAuthor({ 
            name: `${STARRY_MASCOT.name} • AI Companion`, 
            iconURL: STARRY_MASCOT.avatarURL 
        })
        .setTitle(`✨ Starry's Answer`)
        .setDescription(pages[pageIndex])
        .addFields({
            name: '❓ Question / Prompt',
            value: `>>> ${prompt.length > 250 ? prompt.substring(0, 247) + '...' : prompt}`
        })
        .setFooter({
            text: pages.length > 1 
                ? `Page ${pageIndex + 1} of ${pages.length} • Powered by ${modelUsed} • Tap buttons below to navigate` 
                : `Powered by ${modelUsed} • Instant Response • Asked by ${user?.tag || user?.username || 'User'}`
        })
        .setTimestamp();

    if (imageObj && imageObj.url) {
        embed.setThumbnail(imageObj.url);
    }

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

async function extractImageFromContext(ctx) {
    if (!ctx) return null;
    try {
        // 1. Slash command attachment option
        if (ctx.interaction?.options) {
            const att = ctx.interaction.options.getAttachment('image') || ctx.interaction.options.getAttachment('file');
            if (att && att.url) return att.url;
        }

        // 2. Direct message attachments
        if (ctx.message?.attachments?.size > 0) {
            const imgAtt = ctx.message.attachments.find(a => 
                a.contentType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(a.name || '')
            ) || ctx.message.attachments.first();
            if (imgAtt && imgAtt.url) return imgAtt.url;
        }

        // 3. Message reference / reply attachment
        if (ctx.message?.reference?.messageId && ctx.channel?.messages) {
            try {
                const refMsg = await ctx.channel.messages.fetch(ctx.message.reference.messageId).catch(() => null);
                if (refMsg && refMsg.attachments?.size > 0) {
                    const imgAtt = refMsg.attachments.find(a => 
                        a.contentType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(a.name || '')
                    ) || refMsg.attachments.first();
                    if (imgAtt && imgAtt.url) return imgAtt.url;
                }
            } catch (e) {}
        }

        // 4. URL inside message content
        const rawText = (ctx.args ? ctx.args.join(' ') : '') || ctx.message?.content || '';
        const urlMatch = rawText.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S+)?/i);
        if (urlMatch) return urlMatch[0];

    } catch (e) {}
    return null;
}

async function sendPaginatedAIResponse(ctx, prompt, imageInput = null) {
    const targetImage = imageInput || await extractImageFromContext(ctx);
    const { text, model, image } = await generateStarryResponse(prompt, ctx.user.id, !ctx.guild, null, targetImage);
    const pages = splitIntoPages(text, 1400);
    let currentPage = 0;
    const sessionKey = Math.random().toString(36).substring(2, 8);

    const embed = buildStarryAIEmbed(pages, currentPage, prompt, model, ctx.user, image);
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
            embeds: [buildStarryAIEmbed(pages, currentPage, prompt, model, ctx.user, image)],
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
    SYSTEM_PERSONA_PROMPTS,
    fetchImageBuffer,
    extractImageFromContext,
    generateStarryResponse,
    splitIntoPages,
    buildStarryAIEmbed,
    buildPageButtons,
    sendPaginatedAIResponse,
    buildStarryCharacterCard
};
