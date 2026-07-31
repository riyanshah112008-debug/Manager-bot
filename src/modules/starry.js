// ==========================================
// 🧠 STARRY SUPREME AI PROTOCOL ENGINE (PART 4 OF 8)
// ==========================================
const { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    MessageFlags 
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const { provisionMasterServerStructure } = require('./masterChannelSystems');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// Safely Require Mongoose Models
let ServerSettings, ChestChannel, BoostChannel;
try {
    ServerSettings = require('../models/ServerSettings');
    ChestChannel = require('../models/ChestChannel');
    BoostChannel = require('../models/BoostChannel');
} catch (e) {}

// Multi-API Key Support (Comma-separated GEMINI_API_KEY / GOOGLE_AI_KEY)
const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextAIClient() {
    if (apiKeys.length === 0) return null;
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return new GoogleGenAI({ apiKey: key });
}

// ⚡ HIGH-AVAILABILITY 24/7 AI MODELS
const AI_MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateAIResponseWithRetry(prompt) {
    if (apiKeys.length === 0) {
        throw new Error('Missing GEMINI_API_KEY environment variable.');
    }

    let lastError = null;

    for (const modelName of AI_MODELS) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const ai = getNextAIClient();
                if (!ai) continue;
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: prompt
                });

                if (response && response.text && response.text.trim().length > 0) {
                    return response.text.trim();
                }
            } catch (err) {
                lastError = err;
                const errStatus = err.status || err.statusCode || (err.message && err.message.includes('503') ? 503 : 0);
                if ((errStatus === 429 || errStatus === 503) && attempt < 3) {
                    await sleep(attempt * 1000);
                    continue;
                }
                break;
            }
        }
    }

    throw lastError || new Error('AI Engine temporarily unreachable.');
}

const blacklistedUsers = new Set();
// ==========================================
// 🧠 STARRY SUPREME AI PROTOCOL ENGINE (PART 5 OF 8)
// ==========================================
module.exports = (client) => {

    client.on('clientReady', () => { 
        console.log('🚀 Supreme Starry AI Protocol Engine Active (Single Dispatcher & Fast Local Execution)'); 
    });

    // AutoMod Anti-Mass Ping
    async function handleAutoModPing(message) {
        if (!message.guild || message.author.bot || !message.member) return false;

        const rawPingMatches = message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || [];
        const userMentionCount = message.mentions.users.size;
        const roleMentionCount = message.mentions.roles.size;
        const everyoneMention = message.mentions.everyone ? 1 : 0;
        const totalPings = Math.max(userMentionCount + roleMentionCount + everyoneMention, rawPingMatches.length);

        if (totalPings >= 5) {
            const botMember = message.guild.members.me;

            if (botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.delete().catch(() => {});
            }

            const durationMs = 10 * 60 * 1000;
            const caseId = Math.floor(Math.random() * 90000) + 10000;
            const reason = `Automated Anti-Mass Ping (${totalPings} mentions in single message)`;

            if (
                botMember.permissions.has(PermissionFlagsBits.ModerateMembers) &&
                message.member.roles.highest.position < botMember.roles.highest.position &&
                message.author.id !== message.guild.ownerId
            ) {
                const dmSent = await client.sendPremiumModDM(message.member, botMember, 'timeout', reason, '10 minutes', message.guild, caseId);
                await message.member.timeout(durationMs, reason).catch(() => {});
                const warningMsg = await message.channel.send(`🛡️ **AutoMod Triggered:** <@${message.author.id}> was timed out for **10 minutes** due to Mass Mentioning (${totalPings} pings)! ${dmSent ? '*(User Notified)*' : ''}`).catch(() => null);
                if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => {}), 6000);
            }
            return true;
        }
        return false;
    }

    client.isOwner = (userId) => {
        const defaultOwners = ['1465049039153135639', '1257676837249617971'];
        const envOwners = (process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
        return [...new Set([...defaultOwners, ...envOwners])].includes(userId);
    };

    client.getLogChannel = (guild, logType = 'misc') => {
        if (!guild || !guild.channels) return null;
        const typeMap = {
            'access': ['logs-access', 'user-invite-logs', 'invite-logs', 'join-logs'],
            'moderate': ['logs-moderate', 'mod-logs', 'warning-logs', 'audit-logs', 'automod-logs'],
            'messages': ['logs-messages', 'message-logs', 'chat-logs'],
            'voice': ['logs-voice', 'voice-logs', 'vc-logs'],
            'channels': ['logs-channels', 'channel-logs'],
            'members': ['logs-members', 'member-logs', 'user-logs'],
            'roles': ['logs-roles', 'role-logs'],
            'misc': ['logs-misc', 'bot-logs']
        };

        const targetNames = typeMap[logType.toLowerCase()] || typeMap['misc'];
        let channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name)));
        if (channel) return channel;

        return guild.channels.cache.find(c => c.type === ChannelType.GuildText && ['logs-server', 'server-logs', 'mod-logs', 'system-logs', 'logs'].includes(c.name)) || null;
    };

    // DJ Music Interaction Handler
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        const customId = interaction.customId;

        if (['music_pause', 'music_skip', 'music_stop', 'music_loop', 'dj_vol_down', 'dj_vol_up', 'dj_lock', 'dj_unlock'].includes(customId)) {
            const guild = interaction.guild;
            if (!guild) return;

            const member = interaction.member;
            const voiceChannel = member?.voice?.channel;
            const player = client.manager ? client.manager.getPlayer(guild.id) : null;

            if (!voiceChannel) return interaction.reply({ content: '❌ You must be connected to a voice channel to use music controls!', flags: [EPHEMERAL_FLAG] });
            if (!player) return interaction.reply({ content: '❌ No active audio player found in this server!', flags: [EPHEMERAL_FLAG] });

            await interaction.deferUpdate().catch(() => {});

            try {
                if (customId === 'music_pause') player.pause(!player.paused);
                else if (customId === 'music_skip') player.skip();
                else if (customId === 'music_stop') player.destroy();
                else if (customId === 'music_loop') player.setLoop(player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none');
                else if (customId === 'dj_vol_down') player.setVolume(Math.max(10, player.volume - 10));
                else if (customId === 'dj_vol_up') player.setVolume(Math.min(100, player.volume + 10));
                else if (customId === 'dj_lock') await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
                else if (customId === 'dj_unlock') await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
            } catch (err) {}
        }
    });

    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A') => {
        if (!member || !member.user || member.user.bot) return false;
        const actionType = action.toLowerCase();
        let embedColor = actionType === 'ban' ? '#ED4245' : actionType === 'kick' ? '#FEE75C' : '#5865F2';

        const modEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: `${guild.name} | Security & Moderation`, iconURL: guild.iconURL({ dynamic: true }) })
            .setTitle(`🛡️ Moderation Notice: ${actionType.toUpperCase()}`)
            .setDescription(`Hello **${member.user.username}**, you received a moderation action in **${guild.name}**.`)
            .addFields(
                { name: '👤 Moderator', value: `\`${moderator.user ? moderator.user.username : 'Starry AutoMod'}\``, inline: true },
                { name: '🛡️ Action', value: `\`${actionType}\``, inline: true },
                { name: '🏷️ Case ID', value: `\`#${caseId}\``, inline: true },
                { name: '📝 Reason', value: `>>> ${reason || 'No reason provided.'}`, inline: false }
            )
            .setTimestamp();

        try { await member.send({ embeds: [modEmbed] }); return true; } catch (err) { return false; }
    };
// ==========================================
// 🧠 STARRY SUPREME AI PROTOCOL ENGINE (PART 6 OF 8)
// ==========================================

    // Helper: Smart Emojiless Normalizer for Category Matching
    function cleanCategoryName(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ⚡ INSTANT LOCAL PRE-PARSER ENGINE (<50ms EXECUTION)
    async function handleLocalActions(client, message) {
        if (!message.guild) return false;
        const text = message.content.toLowerCase().trim();
        const botMember = message.guild.members.me;

        // 1. BULK DELETE CHANNELS IN A CATEGORY
        const bulkDelRegex = /(?:delete|remove|purge)\s+(?:all\s+)?(?:the\s+)?channels\s+in\s+(.+)$/i;
        const bulkMatch = message.content.match(bulkDelRegex);

        if (bulkMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await message.reply("❌ You or I lack **Manage Channels** permission.");
                return true;
            }

            let rawSearch = bulkMatch[1].trim();
            if (rawSearch.toLowerCase().endsWith('category')) {
                rawSearch = rawSearch.slice(0, -8).trim();
            }

            const cleanSearch = cleanCategoryName(rawSearch);

            const targetCategory = message.guild.channels.cache.find(c => {
                if (c.type !== ChannelType.GuildCategory) return false;
                const cleanCatName = cleanCategoryName(c.name);
                return cleanCatName === cleanSearch || cleanCatName.includes(cleanSearch) || cleanSearch.includes(cleanCatName);
            });

            if (!targetCategory) {
                await message.reply(`❌ Could not find category matching **"${rawSearch}"**.`);
                return true; // Stop execution locally, DO NOT fall back to Gemini AI!
            }

            const childChannels = message.guild.channels.cache.filter(c => c.parentId === targetCategory.id);
            let deletedCount = 0;
            for (const [, ch] of childChannels) {
                await ch.delete().catch(() => {});
                deletedCount++;
            }

            await message.reply(`🗑️ Successfully deleted **${deletedCount} channels** in category **${targetCategory.name}**!`);
            return true;
        }

        // 2. DELETE A CATEGORY DIRECTLY
        const delCatRegex = /(?:delete|remove)\s+(?:the\s+)?category\s+(.+)$/i;
        const delCatMatch = message.content.match(delCatRegex);

        if (delCatMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await message.reply("❌ You or I lack **Manage Channels** permission.");
                return true;
            }

            const rawSearch = delCatMatch[1].trim();
            const cleanSearch = cleanCategoryName(rawSearch);

            const targetCategory = message.guild.channels.cache.find(c => {
                if (c.type !== ChannelType.GuildCategory) return false;
                const cleanCatName = cleanCategoryName(c.name);
                return cleanCatName === cleanSearch || cleanCatName.includes(cleanSearch);
            });

            if (!targetCategory) {
                await message.reply(`❌ Could not find category **"${rawSearch}"**.`);
                return true;
            }

            const name = targetCategory.name;
            await targetCategory.delete().catch(() => {});
            await message.reply(`🗑️ Successfully deleted category **${name}**.`);
            return true;
        }

        // 3. VOICE CHANNEL CREATION
        const voiceChanRegex = /(?:create|make|add)\s+(?:a\s+)?voice\s+channel\s+(?:named\s+)?([a-zA-Z0-9_\-\s]+)$/i;
        const voiceMatch = message.content.match(voiceChanRegex);

        if (voiceMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await message.reply("❌ You or I lack **Manage Channels** permission.");
                return true;
            }
            const vName = voiceMatch[1].trim();
            try {
                const vChan = await message.guild.channels.create({ name: vName, type: ChannelType.GuildVoice });
                await message.reply(`🔊 Successfully created voice channel **${vChan.name}**!`);
            } catch (err) {
                await message.reply(`❌ Failed to create voice channel: \`${err.message}\``);
            }
            return true;
        }

        // 4. TEXT CHANNEL CREATION
        const textChanRegex = /(?:create|make|add)\s+(?:a\s+)?(?:text\s+)?channel\s+(?:named\s+)?([a-zA-Z0-9_\-\s]+)$/i;
        const textMatch = message.content.match(textChanRegex);

        if (textMatch && !text.includes('voice') && !text.includes('role') && !text.includes('category')) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await message.reply("❌ You or I lack **Manage Channels** permission.");
                return true;
            }
            const cName = textMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
            try {
                const tChan = await message.guild.channels.create({ name: cName, type: ChannelType.GuildText });
                await message.reply(`✨ Successfully created text channel <#${tChan.id}>!`);
            } catch (err) {
                await message.reply(`❌ Failed to create text channel: \`${err.message}\``);
            }
            return true;
        }

        // 5. CREATE CATEGORY
        const createCatRegex = /(?:create|make|add)\s+(?:a\s+)?category\s+(?:named\s+)?([a-zA-Z0-9_\-\s]+)$/i;
        const catMatch = message.content.match(createCatRegex);

        if (catMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await message.reply("❌ You or I lack **Manage Channels** permission.");
                return true;
            }
            const catName = catMatch[1].trim();
            try {
                const newCat = await message.guild.channels.create({ name: catName, type: ChannelType.GuildCategory });
                await message.reply(`📁 Successfully created category **${newCat.name}**!`);
            } catch (err) {
                await message.reply(`❌ Failed to create category: \`${err.message}\``);
            }
            return true;
        }

        // 6. CLEAR MESSAGES PRE-PARSER
        const clearRegex = /(?:clear|purge|delete)\s+(\d+)\s*(?:messages)?$/i;
        const clearMatch = message.content.match(clearRegex);

        if (clearMatch && !text.includes('channel') && !text.includes('category')) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) || !botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.reply('❌ Missing **Manage Messages** permission.');
                return true;
            }
            const count = parseInt(clearMatch[1]);
            if (count <= 0) { await message.reply('❌ Please specify a valid number of messages to clear.'); return true; }
            const deleteCount = Math.min(count, 99) + 1;
            await message.channel.bulkDelete(deleteCount, true).catch(() => {});
            const sent = await message.channel.send(`🧹 Successfully cleared ${count} messages!`);
            setTimeout(() => sent.delete().catch(() => {}), 3500);
            return true;
        }

        return false;
    }
// ==========================================
// 🧠 STARRY SUPREME AI PROTOCOL ENGINE (PART 7 OF 8)
// ==========================================
    async function handlePollinationsImage(client, message, displayName, mentionsBot, hasName, isImagine) {
        const imageRegex = /(?:create|generate|draw|make|paint) (?:an? |some )?(?:image|picture|drawing|art|photo) (?:of )?(.*)/i;
        let isImageRequest = isImagine;
        let imagePrompt = "";

        if (isImagine) {
            imagePrompt = message.content.slice(9).trim();
        } else if (hasName || mentionsBot) {
            const match = message.content.match(imageRegex);
            if (match) { isImageRequest = true; imagePrompt = match[1].trim(); }
        }

        if (isImageRequest) {
            if (!imagePrompt) { await message.reply('❌ Please tell me what to draw!').catch(() => {}); return true; }
            const replyMsg = await message.reply('🎨 Painting your picture... Please wait.').catch(() => null);
            if (!replyMsg) return true;
            try {
                const safePrompt = encodeURIComponent(imagePrompt.replace(/[^a-zA-Z0-9\s]/g, ''));
                const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&nologo=true`;
                await message.reply({ content: `🖼️ **"${imagePrompt}"**\nGenerated by ${message.author}`, files: [{ attachment: imageUrl, name: `${displayName}_AI_Art.png` }] }).catch(() => {});
                await replyMsg.delete().catch(() => {});
            } catch (error) { 
                await replyMsg.edit('❌ I had trouble drawing that. Try a simpler prompt.').catch(() => {}); 
            }
            return true;
        }
        return false;
    }

    async function handleConversationalGemini(client, message, displayName) {
        await message.channel.sendTyping().catch(() => {});

        try {
            const prompt = `[SYSTEM INSTRUCTION]
You are ${displayName}, an advanced Discord AI companion equipped with full autonomous moderation, channel, category, and role management capabilities.

COMMAND SPECIFICATION PROTOCOL:
If the user asks you to perform a server management action, embed the appropriate tag anywhere in your output:
- Moderation Actions: [CMD:KICK|ID:user_id|REASON:reason], [CMD:BAN|ID:user_id|REASON:reason], [CMD:UNBAN|ID:user_id], [CMD:CLEAR|AMOUNT:count], [CMD:TIMEOUT|ID:user_id|MINUTES:count|REASON:reason], [CMD:UNTIMEOUT|ID:user_id].
- Role Actions: [CMD:CREATEROLE|NAME:role_name], [CMD:GIVEROLE|USER_ID:user_id|ROLE_ID:role_id], [CMD:REMOVEROLE|USER_ID:user_id|ROLE_ID:role_id].
- Channel & Category Actions:
  * Create Channel: [CMD:CREATECHANNEL|NAME:channel_name|TYPE:text|CATEGORY:category_name]
  * Delete Channel: [CMD:DELETECHANNEL|NAME:channel_name]
  * Create Category: [CMD:CREATECATEGORY|NAME:category_name]
  * Delete Category: [CMD:DELETECATEGORY|NAME:category_name]

Always acknowledge the action warmly, clearly, and concisely.

[USER MESSAGE]
${message.author.username} says: ${message.content}`;

            let replyText = await generateAIResponseWithRetry(prompt);

            let functionName = null; 
            let args = {};

            const cmdMatch = replyText.match(/\[.*?CMD:(KICK|BAN|UNBAN|CLEAR|TIMEOUT|UNTIMEOUT|GIVEROLE|REMOVEROLE|CREATEROLE|DELETEROLE|CREATECHANNEL|DELETECHANNEL|CREATECATEGORY|DELETECATEGORY)(?:\|(.*?))?\]/i);
            if (cmdMatch) {
                const action = cmdMatch[1].toUpperCase(); 
                const params = (cmdMatch[2] || '').split('|');
                const getParam = (key) => (params.find(p => p.toUpperCase().startsWith(key)) || '').split(':')[1]?.trim() || '';

                if (action === 'CREATEROLE') { functionName = 'create_role'; args.roleName = getParam('NAME') || getParam('ROLE'); }
                else if (action === 'CLEAR') { functionName = 'clear_messages'; args.amount = parseInt(getParam('AMOUNT')) || 10; }
                else if (action === 'TIMEOUT') { functionName = 'timeout_member'; args.userId = getParam('ID'); args.minutes = parseInt(getParam('MINUTES')) || 2; args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'UNTIMEOUT') { functionName = 'untimeout_member'; args.userId = getParam('ID'); }
                else if (action === 'UNBAN') { functionName = 'unban_member'; args.userId = getParam('ID'); }
                else if (action === 'KICK' || action === 'BAN') { functionName = action.toLowerCase() + '_member'; args.userId = getParam('ID'); args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'CREATECHANNEL') { functionName = 'create_channel'; args.name = getParam('NAME'); args.type = getParam('TYPE') || 'text'; args.category = getParam('CATEGORY'); }
                else if (action === 'DELETECHANNEL') { functionName = 'delete_channel'; args.name = getParam('NAME'); }

                replyText = replyText.replace(cmdMatch[0], '').trim();
            }

            if (functionName && message.guild) {
                const botMember = message.guild.members.me;
                const hasPerm = (perm) => message.member && message.member.permissions.has(perm) && botMember.permissions.has(perm);

                if (functionName === "create_channel" && hasPerm(PermissionFlagsBits.ManageChannels)) {
                    let parentCategory = null;
                    if (args.category) {
                        parentCategory = message.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === args.category.toLowerCase());
                    }
                    const chType = (args.type || '').toLowerCase() === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
                    const createdCh = await message.guild.channels.create({
                        name: (args.name || 'new-channel').toLowerCase().replace(/\s+/g, '-'),
                        type: chType,
                        parent: parentCategory ? parentCategory.id : null
                    }).catch(() => null);

                    if (createdCh) await message.reply(`✨ Successfully created channel <#${createdCh.id}>!`);
                }

                if (functionName === "delete_channel" && hasPerm(PermissionFlagsBits.ManageChannels)) {
                    const cleanName = (args.name || '').replace(/[<#>]/g, '').trim().toLowerCase();
                    const targetCh = message.guild.channels.cache.find(c => c.id === cleanName || c.name.toLowerCase() === cleanName);
                    if (targetCh) {
                        const deletedName = targetCh.name;
                        await targetCh.delete().catch(() => null);
                        await message.reply(`🗑️ Successfully deleted channel **#${deletedName}**.`);
                    }
                }
            }

            if (replyText && replyText.trim().length > 0) {
                const textChunks = replyText.trim().match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) {
                    await message.reply(chunk).catch(() => {});
                }
            }

        } catch (error) {
            return message.reply(`⏳ **Notice:** System currently processing high traffic. Please try again in a few seconds!`).catch(() => {});
        }
    }
// ==========================================
// 🧠 STARRY SUPREME AI PROTOCOL ENGINE (PART 8 OF 8)
// ==========================================

    // ==========================================
    // 🌐 SINGLE UNIFIED MESSAGE DISPATCHER PIPELINE
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        // 1. AutoMod Ping Check
        if (await handleAutoModPing(message)) return;

        // Trigger Word Check
        let triggerWord = 'starry';
        let displayName = 'Starry'; 

        try {
            if (!ServerSettings) ServerSettings = require('../models/ServerSettings');
            const settings = await ServerSettings.findOne({ guildId: message.guild.id });
            if (settings && settings.triggerWord) {
                triggerWord = settings.triggerWord.toLowerCase();
                displayName = settings.triggerWord;
            }
        } catch (err) {}

        const text = message.content.toLowerCase().trim();
        const isImagine = text.startsWith('.imagine ');
        const mentionsBot = message.mentions.has(client.user.id);
        const hasName = text.includes(triggerWord) || text.includes('jarvis');
        let isReplyToBot = false;

        if (message.reference) {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(()=>null);
            if (refMsg && refMsg.author.id === client.user.id) isReplyToBot = true;
        }

        if (!isImagine && !mentionsBot && !hasName && !isReplyToBot) return;

        // 2. Fast Local Pre-Parsers (<50ms Execution - Zero AI Calls)
        const localHandled = await handleLocalActions(client, message);
        if (localHandled) return; // Action handled locally! Stop execution immediately!

        // 3. Pollinations AI Media Generation
        const imageHandled = await handlePollinationsImage(client, message, displayName, mentionsBot, hasName, isImagine);
        if (imageHandled) return;

        // 4. Conversational Gemini AI Engine (General Chat Only)
        await handleConversationalGemini(client, message, displayName);
    });
};
