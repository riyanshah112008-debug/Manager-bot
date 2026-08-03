// ==========================================
// 🧠 STARRY SUPREME MASTER AI & MODERATION ENGINE (PART 1 OF 2)
// File Path: modules/starry.js
// ==========================================
const { 
    PermissionFlagsBits, 
    PermissionsBitField,
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    MessageFlags,
    SlashCommandBuilder,
    AttachmentBuilder
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const mongoose = require('mongoose');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Safe Canvas Package Import with Fallback
let createCanvas, loadImage;
try {
    const canvasPkg = require('canvas');
    createCanvas = canvasPkg.createCanvas;
    loadImage = canvasPkg.loadImage;
} catch (e) {
    console.warn('⚠️ Canvas package not available. Goodbye banners will use rich embed fallbacks.');
}

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// ==========================================
// 1. MONGOOSE SCHEMAS & MODELS
// ==========================================
let ServerSettings, ChestChannel, BoostChannel, MasterSecurity, PolicyVote, CountGuild;

try { ServerSettings = mongoose.models.ServerSettings || require('../models/ServerSettings'); } catch (e) {
    try { ServerSettings = mongoose.models.ServerSettings || require('./models/ServerSettings'); } catch (err) {}
}

const welcomeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }
});
const WelcomeSettings = mongoose.models.WelcomeSettings || mongoose.model('WelcomeSettings', welcomeSchema);

const goodbyeSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }
});
const GoodbyeSettings = mongoose.models.GoodbyeSettings || mongoose.model('GoodbyeSettings', goodbyeSchema);

const masterSecuritySchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    autoKick: { type: Boolean, default: false },
    autoBan: { type: Boolean, default: false },
    ownerBypass: { type: Boolean, default: true },
    modules: { wick: { type: Boolean, default: true }, beemo: { type: Boolean, default: true }, altdentifier: { type: Boolean, default: false }, dyno_carl: { type: Boolean, default: true } },
    userInfractions: { type: Map, of: Number, default: {} }
});
MasterSecurity = mongoose.models.MasterSecurity || mongoose.model('MasterSecurity', masterSecuritySchema);

// SQLite Protection Database
const protectDb = new Database('protect.db');
protectDb.exec(`CREATE TABLE IF NOT EXISTS protected_users (guild_id TEXT, user_id TEXT, PRIMARY KEY (guild_id, user_id))`);

const securityCache = new Map();
const blacklistedUsers = new Set();

// ==========================================
// 2. GEMINI MULTI-KEY AI ENGINE
// ==========================================
const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextAIClient() {
    if (apiKeys.length === 0) return null;
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return new GoogleGenAI({ apiKey: key });
}

const AI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateAIResponseWithRetry(prompt) {
    if (apiKeys.length === 0) throw new Error('Missing GEMINI_API_KEY environment variable.');
    let lastError = null;

    for (const modelName of AI_MODELS) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const ai = getNextAIClient();
                if (!ai) continue;
                const response = await ai.models.generateContent({ model: modelName, contents: prompt });
                if (response?.text?.trim().length > 0) return response.text.trim();
            } catch (err) {
                lastError = err;
                if ((err.status === 429 || err.status === 503) && attempt < 3) {
                    await sleep(attempt * 400);
                    continue;
                }
                break;
            }
        }
    }
    throw lastError || new Error('AI Engine temporarily unreachable.');
}

// Helper: Duration Parser (e.g., 30s, 2m, 1h, 1d)
function parseDuration(text) {
    const match = text.match(/(\d+)\s*(s|m|h|d)/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

function cleanCategoryName(str) {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F800}-\u{1F8FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ==========================================
// 3. MAIN MODULE EXPORT
// ==========================================
module.exports = async (client) => {
    if (client.starryEngineInitialized) {
        console.log('⚠️ Starry Engine already initialized. Skipping duplicate registration.');
        return;
    }
    client.starryEngineInitialized = true;

    console.log('🚀 Supreme Starry Unified Engine Active (Text Mod, Audit Logs, Welcome & Goodbye Loaded)');

    // Owner ID Checker Helper
    client.isOwner = (userId) => {
        const defaultOwners = ['1465049039153135639', '1257676837249617971'];
        const envOwners = (process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
        return [...new Set([...defaultOwners, ...envOwners])].includes(userId);
    };

    // Centralized Audit Log Channel Finder
    client.getLogChannel = (guild, logType = 'misc') => {
        if (!guild || !guild.channels) return null;
        const typeMap = {
            'access': ['logs-access', 'user-invite-logs', 'invite-logs', 'join-logs'],
            'moderate': ['logs-moderate', 'mod-logs', 'warning-logs', 'audit-logs', 'automod-logs'],
            'messages': ['logs-messages', 'message-logs', 'chat-logs'],
            'members': ['logs-members', 'member-logs', 'user-logs']
        };
        const targetNames = typeMap[logType.toLowerCase()] || typeMap['access'];
        let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name)));
        if (ch) return ch;
        return guild.channels.cache.find(c => c.type === ChannelType.GuildText && ['logs-server', 'server-logs', 'mod-logs', 'logs'].includes(c.name.toLowerCase())) || null;
    };

    // Premium DM Notice Dispatcher
    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A') => {
        if (!member || !member.user || member.user.bot) return false;
        const actionType = action.toLowerCase();
        let embedColor = actionType === 'ban' ? '#ED4245' : actionType === 'kick' ? '#FEE75C' : '#5865F2';

        const modEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: `${guild.name} | Security & Moderation Notice`, iconURL: guild.iconURL({ dynamic: true }) })
            .setTitle(`🛡️ Moderation Action: ${actionType.toUpperCase()}`)
            .setDescription(`Hello **${member.user.username}**, you have received a moderation discipline in **${guild.name}**.`)
            .addFields(
                { name: '👤 Moderator', value: `\`${moderator.user ? moderator.user.username : 'Starry Engine'}\``, inline: true },
                { name: '🛡️ Action Taken', value: `\`${actionType.toUpperCase()}\``, inline: true },
                { name: '🏷️ Case ID', value: `\`#${caseId}\``, inline: true },
                { name: '⏳ Duration', value: `\`${duration || 'Permanent / Instant'}\``, inline: true },
                { name: '📝 Reason', value: `>>> ${reason || 'No reason provided.'}`, inline: false }
            )
            .setTimestamp();

        try { await member.send({ embeds: [modEmbed] }); return true; } catch (err) { return false; }
    };

    // ------------------------------------------
    // A. MEMBER JOIN & LEAVE LISTENERS (WELCOME & GOODBYE)
    // ------------------------------------------
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;

        // 1. Audit Log Entry
        const accessLog = client.getLogChannel(member.guild, 'access');
        if (accessLog) {
            const joinEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: '🟢 Member Joined', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`Welcome <@${member.id}> (**${member.user.tag}**) to **${member.guild.name}**!`)
                .addFields(
                    { name: '👤 User Mention', value: `<@${member.id}>`, inline: true },
                    { name: '🆔 User ID', value: `\`${member.id}\``, inline: true },
                    { name: '📊 Total Members', value: `\`${member.guild.memberCount}\``, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            await accessLog.send({ embeds: [joinEmbed] }).catch(() => {});
        }

        // 2. Custom Welcome Channel Card
        try {
            const config = await WelcomeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;
            const welcomeCh = member.guild.channels.cache.get(config.channelId);
            if (!welcomeCh) return;

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`✨ Welcome to ${member.guild.name} ✨`)
                .setDescription(`Hello <@${member.id}>, we are so glad you joined us! Be sure to read the rules and enjoy your stay.`)
                .addFields(
                    { name: '👤 Member Count', value: `You are member **#${member.guild.memberCount}**!`, inline: true },
                    { name: '📆 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `Enjoy your stay in ${member.guild.name}!` })
                .setTimestamp();

            await welcomeCh.send({ content: `Hey <@${member.id}>! 👋`, embeds: [welcomeEmbed] }).catch(() => {});
        } catch (err) {
            console.error('Welcome Card Error:', err);
        }
    });

    client.on('guildMemberRemove', async (member) => {
        // 1. Audit Log Entry
        const accessLog = client.getLogChannel(member.guild, 'access');
        if (accessLog) {
            const leaveEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '🔴 Member Left', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`<@${member.id}> (**${member.user.tag}**) has left **${member.guild.name}**.`)
                .addFields(
                    { name: '🆔 User ID', value: `\`${member.id}\``, inline: true },
                    { name: '📊 Remaining Members', value: `\`${member.guild.memberCount}\``, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            await accessLog.send({ embeds: [leaveEmbed] }).catch(() => {});
        }

        // 2. Custom Goodbye Banner / Fallback
        try {
            const config = await GoodbyeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;
            const goodbyeCh = member.guild.channels.cache.get(config.channelId);
            if (!goodbyeCh) return;

            const bgPath = path.join(__dirname, 'goodbye_bg.png');
            if (createCanvas && fs.existsSync(bgPath)) {
                const canvas = createCanvas(1024, 450);
                const ctx = canvas.getContext('2d');
                const background = await loadImage(bgPath);
                ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

                ctx.font = '36px sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.fillText(member.user.username, 512, 380);

                ctx.beginPath();
                ctx.arc(512, 140, 90, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();

                const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
                ctx.drawImage(avatar, 422, 50, 180, 180);

                const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'goodbye-image.png' });
                const embed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('👋 Someone left...')
                    .setDescription(`**${member.user.tag}** has left the server. We are now down to **${member.guild.memberCount}** members.`)
                    .setImage('attachment://goodbye-image.png');

                await goodbyeCh.send({ embeds: [embed], files: [attachment] }).catch(() => {});
            } else {
                const fallbackEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('👋 Someone left...')
                    .setDescription(`**${member.user.tag}** has left the server. We are now down to **${member.guild.memberCount}** members.`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

                await goodbyeCh.send({ embeds: [fallbackEmbed] }).catch(() => {});
            }
        } catch (err) {
            console.error('Goodbye Card Error:', err);
        }
    });
    // ==========================================
// 🧠 STARRY SUPREME MASTER AI & MODERATION ENGINE (PART 2 OF 2)
// File Path: modules/starry.js
// ==========================================

    // ------------------------------------------
    // B. AUDIT LOGGING FOR DELETED & PURGED MESSAGES
    // ------------------------------------------
    client.on('messageDelete', async (message) => {
        try {
            if (!message.guild || message.partial) return;
            const logChannel = client.getLogChannel(message.guild, 'messages');
            if (!logChannel || logChannel.id === message.channel.id) return;

            const author = message.author ? `${message.author} (\`${message.author.tag}\`)` : 'Unknown User';
            const deleteEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '🗑️ Message Deleted', iconURL: message.author?.displayAvatarURL({ dynamic: true }) || message.guild.iconURL({ dynamic: true }) })
                .setDescription(`A message by ${author} was deleted in <#${message.channel.id}>.`)
                .addFields(
                    { name: '📝 Content', value: message.content ? `>>> ${message.content.slice(0, 1000)}` : '*[No text content or contains attachments/embeds]*', inline: false },
                    { name: '📺 Channel', value: `<#${message.channel.id}>`, inline: true },
                    { name: '🆔 Message ID', value: `\`${message.id}\``, inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [deleteEmbed] }).catch(() => {});
        } catch (err) {}
    });

    client.on('messageDeleteBulk', async (messages) => {
        try {
            const firstMsg = messages.first();
            if (!firstMsg || !firstMsg.guild) return;
            const logChannel = client.getLogChannel(firstMsg.guild, 'messages') || client.getLogChannel(firstMsg.guild, 'moderate');
            if (!logChannel) return;

            const bulkEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setAuthor({ name: '🧹 Bulk Message Delete (Purge)', iconURL: firstMsg.guild.iconURL({ dynamic: true }) })
                .setDescription(`**${messages.size} messages** were purged/deleted in <#${firstMsg.channel.id}>.`)
                .addFields(
                    { name: '📺 Channel', value: `<#${firstMsg.channel.id}>`, inline: true },
                    { name: '📊 Total Messages Deleted', value: `\`${messages.size}\``, inline: true }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [bulkEmbed] }).catch(() => {});
        } catch (err) {}
    });

    // ------------------------------------------
    // C. INTERACTION ROUTER (/setupwelcome & /setupgoodbye)
    // ------------------------------------------
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.guild || !interaction.isChatInputCommand()) return;

        // Slash Command: /setupwelcome
        if (interaction.commandName === 'setupwelcome') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ You need **Manage Server** permissions to do this.', flags: [EPHEMERAL_FLAG] });
            }
            const channel = interaction.options.getChannel('channel', true);
            await WelcomeSettings.findOneAndUpdate({ guildId: interaction.guildId }, { channelId: channel.id }, { upsert: true });

            const previewEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`✨ Welcome to ${interaction.guild.name} ✨`)
                .setDescription(`Hello ${interaction.user}, welcome! Be sure to read the rules and enjoy your stay.`)
                .addFields(
                    { name: '👤 Member Count', value: `You are member **#${interaction.guild.memberCount}**!`, inline: true },
                    { name: '📆 Account Created', value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `Starry Welcome System • Preview Mode` })
                .setTimestamp();

            await channel.send({ content: `Hey ${interaction.user}! 👋 *(Setup Preview)*`, embeds: [previewEmbed] }).catch(() => {});
            return interaction.reply({ content: `✅ **Success!** Welcome messages will now be sent to ${channel}!`, flags: [EPHEMERAL_FLAG] });
        }

        // Slash Command: /setupgoodbye
        if (interaction.commandName === 'setupgoodbye') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ You need **Manage Server** permissions to do this.', flags: [EPHEMERAL_FLAG] });
            }
            const channel = interaction.options.getChannel('channel', true);
            await GoodbyeSettings.findOneAndUpdate({ guildId: interaction.guildId }, { channelId: channel.id }, { upsert: true });

            return interaction.reply({ content: `✅ **Success!** Goodbye messages will now be sent to ${channel}!`, flags: [EPHEMERAL_FLAG] });
        }
    });

    // ------------------------------------------
    // D. INSTANT LOCAL ACTIONS (<10ms EXECUTION)
    // ------------------------------------------
    async function handleLocalActions(client, message) {
        if (!message.guild) return false;
        const text = message.content.toLowerCase().trim();
        const botMember = message.guild.members.me || await message.guild.members.fetch(client.user.id).catch(() => null);
        const displayName = client.user.username;

        const cleanText = text.replace(new RegExp(`^(?:<@!?${client.user?.id}>|${displayName}|jarvis|starry)\\s*`, 'i'), '').trim();

        // Greeting
        const isGreeting = cleanText === '' || ['hi', 'hello', 'hey', 'yo', 'sup', 'hola', 'starry'].includes(cleanText);
        if (isGreeting) {
            const responses = [
                `Hello <@${message.author.id}>! ✨ How can I assist you today?`,
                `Hey <@${message.author.id}>! I'm online and ready. What's on your mind? 🌟`,
                `Hi <@${message.author.id}>! Need help with commands, music, or moderation? Just ask! 🚀`
            ];
            await message.reply(responses[Math.floor(Math.random() * responses.length)]);
            return true;
        }

        // Fast Message Purge
        const clearRegex = /(?:clear|purge|delete)\s+(\d+)\s*(?:messages)?$/i;
        const clearMatch = message.content.match(clearRegex);

        if (clearMatch && !text.includes('channel') && !text.includes('category')) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) || !botMember?.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.reply('❌ Missing **Manage Messages** permissions.');
                return true;
            }
            const count = parseInt(clearMatch[1]);
            if (count <= 0) { await message.reply('❌ Specify a valid message count.'); return true; }
            const deleteCount = Math.min(count, 99) + 1;
            
            const deleted = await message.channel.bulkDelete(deleteCount, true).catch(() => null);
            const actualDeletedCount = deleted ? Math.max(0, deleted.size - 1) : count;

            const sent = await message.channel.send(`🧹 Successfully cleared ${actualDeletedCount} messages!`);
            setTimeout(() => sent.delete().catch(() => {}), 3500);

            const logChannel = client.getLogChannel(message.guild, 'messages') || client.getLogChannel(message.guild, 'moderate');
            if (logChannel) {
                const purgeEmbed = new EmbedBuilder()
                    .setColor('#FEE75C')
                    .setAuthor({ name: '🧹 Channel Messages Purged', iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                    .addFields(
                        { name: '👤 Moderator', value: `${message.author} (\`${message.author.tag}\`)`, inline: true },
                        { name: '📺 Channel', value: `<#${message.channel.id}>`, inline: true },
                        { name: '📊 Amount Deleted', value: `\`${actualDeletedCount}\` messages`, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [purgeEmbed] }).catch(() => {});
            }

            return true;
        }

        return false;
    }

    // ------------------------------------------
    // E. SMART NATURAL LANGUAGE TEXT MODERATION ENGINE
    // ------------------------------------------
    async function handleSmartModeration(client, message) {
        if (!message.guild || message.author.bot) return false;

        const rawContent = message.content;
        const lowerContent = rawContent.toLowerCase();

        const mentionsBot = message.mentions.has(client.user.id);
        const hasTriggerWord = lowerContent.includes('starry');
        if (!mentionsBot && !hasTriggerWord) return false;

        const isTimeout = lowerContent.includes('timeout') || lowerContent.includes('mute');
        const isUntimeout = lowerContent.includes('untimeout') || lowerContent.includes('unmute');
        const isKick = lowerContent.includes('kick');
        const isBan = lowerContent.includes('ban');

        if (!isTimeout && !isUntimeout && !isKick && !isBan) return false;

        try {
            let targetUser = message.mentions.users.filter(u => u.id !== client.user.id).first();
            if (!targetUser) {
                const idMatch = rawContent.match(/\b\d{17,19}\b/);
                if (idMatch) targetUser = await client.users.fetch(idMatch[0]).catch(() => null);
            }

            if (!targetUser) {
                await message.reply('❌ Please mention a valid user to moderate (e.g. `Starry mute @user 1m for saying n word`).');
                return true;
            }

            const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
            const executor = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
            const botMember = message.guild.members.me || await message.guild.members.fetch(client.user.id).catch(() => null);

            if (!executor) return false;

            if (targetMember) {
                if (targetMember.roles.highest.position >= executor.roles.highest.position && message.author.id !== message.guild.ownerId) {
                    await message.reply(`❌ You cannot moderate **${targetUser.username}** because their highest role is equal to or higher than yours!`);
                    return true;
                }

                if (botMember && targetMember.roles.highest.position >= botMember.roles.highest.position) {
                    await message.reply(`❌ I cannot moderate **${targetUser.username}** because their highest role is equal to or higher than my bot role in Server Settings! Move my Starry role higher.`);
                    return true;
                }
            }

            let reason = 'No reason provided';
            if (lowerContent.includes('for ')) {
                reason = rawContent.substring(rawContent.toLowerCase().indexOf('for ') + 4).trim();
            }

            const caseId = Math.floor(Math.random() * 90000) + 10000;

            // Timeout / Mute
            if (isTimeout && !isUntimeout) {
                if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers) || !botMember?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                    await message.reply('❌ Missing `Moderate Members` permissions.');
                    return true;
                }
                if (!targetMember) {
                    await message.reply('❌ That user is not currently in this server!');
                    return true;
                }

                const durationMs = parseDuration(lowerContent) || (10 * 60 * 1000);
                const durationStr = lowerContent.match(/(\d+)\s*(s|m|h|d)/i)?[0] || '10m';

                // Send DM notice
                await client.sendPremiumModDM(targetMember, executor, 'Timeout', reason, durationStr, message.guild, caseId);

                await targetMember.timeout(durationMs, `${reason} | Executed by ${message.author.tag}`);
                const embed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('⏰ Member Timed Out')
                    .setDescription(`**Target:** ${targetMember} (\`${targetUser.tag}\`)\n**Duration:** \`${durationStr}\`\n**Reason:** ${reason}\n**Case ID:** \`#${caseId}\``)
                    .setFooter({ text: `Moderator: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                const logChannel = client.getLogChannel(message.guild, 'moderate');
                if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});
                return true;
            }

            // Kick
            if (isKick) {
                if (!executor.permissions.has(PermissionFlagsBits.KickMembers) || !botMember?.permissions.has(PermissionFlagsBits.KickMembers)) {
                    await message.reply('❌ Missing `Kick Members` permissions.');
                    return true;
                }
                if (!targetMember) return true;

                await client.sendPremiumModDM(targetMember, executor, 'Kick', reason, null, message.guild, caseId);

                await targetMember.kick(`${reason} | Executed by ${message.author.tag}`);
                const embed = new EmbedBuilder()
                    .setColor('#DA373C')
                    .setTitle('🚪 Member Kicked')
                    .setDescription(`**Target:** \`${targetUser.tag}\`\n**Reason:** ${reason}\n**Case ID:** \`#${caseId}\``)
                    .setFooter({ text: `Moderator: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                const logChannel = client.getLogChannel(message.guild, 'moderate');
                if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});
                return true;
            }

            // Ban
            if (isBan) {
                if (!executor.permissions.has(PermissionFlagsBits.BanMembers) || !botMember?.permissions.has(PermissionFlagsBits.BanMembers)) {
                    await message.reply('❌ Missing `Ban Members` permissions.');
                    return true;
                }

                if (targetMember) {
                    await client.sendPremiumModDM(targetMember, executor, 'Ban', reason, null, message.guild, caseId);
                }

                await message.guild.members.ban(targetUser.id, { reason: `${reason} | Executed by ${message.author.tag}` });
                const embed = new EmbedBuilder()
                    .setColor('#ED4245')
                    .setTitle('🔨 Member Banned')
                    .setDescription(`**Target:** \`${targetUser.tag}\`\n**Reason:** ${reason}\n**Case ID:** \`#${caseId}\``)
                    .setFooter({ text: `Moderator: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                await message.reply({ embeds: [embed] });

                const logChannel = client.getLogChannel(message.guild, 'moderate');
                if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});
                return true;
            }

        } catch (err) {
            console.error('❌ Moderation Error:', err);
            await message.reply(`❌ Action failed: \`${err.message}\``).catch(() => {});
            return true;
        }

        return false;
    }

    // ------------------------------------------
    // F. UNIFIED DISPATCHER PIPELINE
    // ------------------------------------------
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        // 1. Process Smart Moderation First
        const modHandled = await handleSmartModeration(client, message);
        if (modHandled) return;

        // 2. Process Local Fast Actions
        const localHandled = await handleLocalActions(client, message);
        if (localHandled) return;
    });
};
            
            
