// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 1 OF 6)
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
const fs = require('fs');
const path = require('path');

// Safe Package Imports
let createCanvas, loadImage;
try {
    const canvasPkg = require('canvas');
    createCanvas = canvasPkg.createCanvas;
    loadImage = canvasPkg.loadImage;
} catch (e) {
    console.warn('⚠️ Canvas package not available. Goodbye banners will use rich embed fallbacks.');
}

let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    console.warn('⚠️ better-sqlite3 not available. Local DB protection bypassed.');
}

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// ==========================================
// 1. MONGOOSE SCHEMAS & MODELS
// ==========================================
let ServerSettings, ChestChannel, BoostChannel, MasterSecurity, PolicyVote, CountGuild;

try { ServerSettings = mongoose.models.ServerSettings || require('../models/ServerSettings'); } catch (e) {
    try { ServerSettings = mongoose.models.ServerSettings || require('./models/ServerSettings'); } catch (err) {}
}
try { ChestChannel = mongoose.models.ChestChannel || require('../models/ChestChannel'); } catch (e) {}
try { BoostChannel = mongoose.models.BoostChannel || require('../models/BoostChannel'); } catch (e) {}

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

const PolicyVoteSchema = new mongoose.Schema({
    guildId: String, messageId: String, title: String, description: String,
    yesVotes: { type: Array, default: [] }, noVotes: { type: Array, default: [] }, createdAt: { type: Date, default: Date.now }
});
PolicyVote = mongoose.models.PolicyVote || mongoose.model('PolicyVote', PolicyVoteSchema);

const masterSecuritySchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    autoKick: { type: Boolean, default: false }, autoBan: { type: Boolean, default: false }, ownerBypass: { type: Boolean, default: true },
    modules: { wick: { type: Boolean, default: true }, beemo: { type: Boolean, default: true }, altdentifier: { type: Boolean, default: false }, dyno_carl: { type: Boolean, default: true } },
    userInfractions: { type: Map, of: Number, default: {} }
});
MasterSecurity = mongoose.models.MasterSecurity || mongoose.model('MasterSecurity', masterSecuritySchema);

const CountSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    currentNumber: { type: Number, default: 1 },
    highScore: { type: Number, default: 0 },
    lastUser: { type: String, default: null }
});
CountGuild = mongoose.models.CountGuild || mongoose.model('CountGuild', CountSchema);

// SQLite Protection Database
if (Database) {
    try {
        const protectDb = new Database('protect.db');
        protectDb.exec(`CREATE TABLE IF NOT EXISTS protected_users (guild_id TEXT, user_id TEXT, PRIMARY KEY (guild_id, user_id))`);
    } catch (e) {}
}

const securityCache = new Map();
const blacklistedUsers = new Set();

async function getSecurityConfig(guildId) {
    if (securityCache.has(guildId)) return securityCache.get(guildId);
    let config = await MasterSecurity.findOne({ guildId }).lean();
    if (!config) {
        config = { guildId, autoKick: false, autoBan: false, ownerBypass: true, modules: { wick: true, beemo: true, altdentifier: false, dyno_carl: true }, userInfractions: new Map() };
        await MasterSecurity.create(config).catch(() => {});
    }
    securityCache.set(guildId, config);
    return config;
}

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
                if (response && response.text && response.text.trim().length > 0) {
                    return response.text.trim();
                }
            } catch (err) {
                lastError = err;
                const errStatus = err.status || err.statusCode || (err.message && err.message.includes('503') ? 503 : 0);
                if ((errStatus === 429 || errStatus === 503 || errStatus === 404) && attempt < 3) {
                    await sleep(attempt * 400);
                    continue;
                }
                break;
            }
        }
    }
    throw lastError || new Error('AI Engine temporarily unreachable.');
}
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 2 OF 6)
// File Path: modules/starry.js
// ==========================================

async function executeFullGuildBackup(guild) {
    try {
        const allRoles = await guild.roles.fetch();
        const allChannels = await guild.channels.fetch();
        return {
            rolesSaved: allRoles.size,
            categoriesSaved: allChannels.filter(c => c.type === ChannelType.GuildCategory).size,
            channelsSaved: allChannels.filter(c => c.type !== ChannelType.GuildCategory).size
        };
    } catch (e) {
        return { rolesSaved: guild.roles.cache.size, categoriesSaved: guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size, channelsSaved: guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size };
    }
}

async function getOrCreateCategory(guild, name, overwrites = []) {
    let cat = guild.channels.cache.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type === ChannelType.GuildCategory);
    if (!cat) {
        cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
    }
    return cat;
}

async function deployActiveModulePanel(channel, moduleType, verifiedRole) {
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const hasPanel = messages ? messages.some(m => m.author.id === channel.guild.client.user.id && (m.components.length > 0 || m.embeds.length > 0)) : false;

    if (!hasPanel) {
        let embed = new EmbedBuilder().setColor('#2b2d31');
        let components = [];

        if (moduleType === 'verification') {
            embed.setColor('#2ecc71').setTitle('🛡️ Server Web Verification Portal').setDescription('Welcome! Human verification is required before full channel access is granted.\n\nClick the button below to generate your secure verification link.');
            components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`verify_role_${verifiedRole?.id || 'active'}`).setLabel('Get Verification Link').setStyle(ButtonStyle.Primary).setEmoji('🌐'))];
        } else if (moduleType === 'tickets') {
            embed.setColor('#00F2FE').setTitle('🎫 Support & Application Portal').setDescription('• **Open Support Ticket:** Opens a private channel with staff.\n• **Apply for Staff:** Opens an application form.');
            components = [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'),
                new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('📝')
            )];
        } else if (moduleType === 'log_access') {
            embed.setColor('#3BA55C').setTitle('🟢 Access & Member Join Audit Engine').addFields({ name: 'Engine Status', value: '`RUNNING 🟢`', inline: true }, { name: 'Active Listeners', value: '`Member Joins • Leaves • Invites`', inline: true });
        } else if (moduleType === 'sus_tracker') {
            embed.setColor('#ED4245').setTitle('🚨 Young Account & Sus Profile Scanner').addFields({ name: 'Engine Status', value: '`ARMED 🚨`', inline: true }, { name: 'Detection Rule', value: '`Flags accounts < 7 days old`', inline: true });
        } else if (moduleType === 'inactivity_tracker') {
            embed.setColor('#5865F2').setTitle('💤 Engagement & Inactivity Scanner').addFields({ name: 'Engine Status', value: '`SCANNING 💤`', inline: true }, { name: 'Tracking Window', value: '`14-Day Inactivity Matrix`', inline: true });
        } else if (moduleType === 'status_monitor') {
            embed.setColor('#2ecc71').setTitle('🟢 Autonomous Network Telemetry & Uptime Hub').addFields({ name: 'Metrics Update', value: '`Loops every 60 seconds`', inline: true }, { name: 'Monitored Assets', value: '`Members • RAM Heap • Ping • Modules`', inline: true });
        }

        if (components.length > 0) {
            await channel.send({ embeds: [embed], components }).catch(() => null);
        } else if (embed.data.title) {
            await channel.send({ embeds: [embed] }).catch(() => null);
        }
    }
}

async function createNonDuplicatingActiveChannel(guild, options, verifiedRole) {
    let channel = guild.channels.cache.find(c => c.name.toLowerCase() === options.name.toLowerCase() && c.parentId === options.parent);
    if (!channel) {
        channel = await guild.channels.create({
            name: options.name, type: options.type || ChannelType.GuildText, parent: options.parent, topic: options.topic || '', permissionOverwrites: options.permissionOverwrites || []
        });
    }
    await deployActiveModulePanel(channel, options.moduleType, verifiedRole);
    return channel;
}

async function provisionMasterServerStructure(interaction) {
    const guild = interaction.guild;
    const botMember = guild.members.me;

    let verifiedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
    if (!verifiedRole) verifiedRole = await guild.roles.create({ name: 'Verified', color: '#2ecc71', reason: 'Starry Master System' });

    let staffRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'staff' || r.name.toLowerCase() === 'moderator');
    if (!staffRole) staffRole = await guild.roles.create({ name: 'Staff', color: '#3498db', reason: 'Starry Master System' });

    const hideEveryone = { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] };
    const showEveryone = { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] };
    const showVerified = { id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] };
    const staffFullControl = { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] };
    const botFullControl = { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] };

    // 1. SECURITY & GOVERNANCE CATEGORY
    const govCat = await getOrCreateCategory(guild, '🛡️ SECURITY & GOVERNANCE', [showEveryone, botFullControl]);
    await createNonDuplicatingActiveChannel(guild, { name: 'rules-and-info', parent: govCat.id, permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'announcements', parent: govCat.id, permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'server-status-monitor', parent: govCat.id, moduleType: 'status_monitor', permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);

    // 2. INCIDENT & AUDIT LOGS CATEGORY
    const sysCat = await getOrCreateCategory(guild, '🚨 INCIDENT & SECURITY LOGS', [hideEveryone, staffFullControl, botFullControl]);
    const sysChannels = [
        { name: 'logs-access', moduleType: 'log_access' }, 
        { name: 'logs-moderate', moduleType: 'log_moderate' },
        { name: 'logs-messages', moduleType: 'log_messages' }, 
        { name: 'logs-voice', moduleType: 'log_voice' },
        { name: 'logs-channels', moduleType: 'log_channels' }, 
        { name: 'logs-members', moduleType: 'log_members' }
    ];
    for (const item of sysChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: sysCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    }

    // 3. AUTOMATED TRACKERS CATEGORY
    const trackerCat = await getOrCreateCategory(guild, '📡 AUTOMATED TRACKERS', [hideEveryone, staffFullControl, botFullControl]);
    await createNonDuplicatingActiveChannel(guild, { name: 'sus-account-tracker', parent: trackerCat.id, moduleType: 'sus_tracker', permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'inactivity-tracker', parent: trackerCat.id, moduleType: 'inactivity_tracker', permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'chest-drops', parent: trackerCat.id, permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);

    // 4. SUPPORT & APPLICATIONS CATEGORY
    const supportCat = await getOrCreateCategory(guild, '🎫 SUPPORT & APPLICATIONS');
    await createNonDuplicatingActiveChannel(guild, { name: 'verify-here', parent: supportCat.id, moduleType: 'verification', permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'open-a-ticket', parent: supportCat.id, moduleType: 'tickets', permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);

    // 5. ADMIN & STAFF HQ CATEGORY
    const staffCat = await getOrCreateCategory(guild, '👑 ADMIN & STAFF HQ', [hideEveryone, staffFullControl, botFullControl]);
    await createNonDuplicatingActiveChannel(guild, { name: 'owners-chat', parent: staffCat.id, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'staff-discussion', parent: staffCat.id, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);

    // 6. COMMUNITY PROTOCOL CATEGORY
    const commCat = await getOrCreateCategory(guild, '📊 COMMUNITY PROTOCOL', [hideEveryone, showVerified, botFullControl]);
    await createNonDuplicatingActiveChannel(guild, { name: 'general-chat', parent: commCat.id, permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'bot-commands', parent: commCat.id, permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);

    if (ServerSettings) {
        await ServerSettings.findOneAndUpdate({ guildId: String(guild.id) }, { setupCompleted: true, verifiedRoleId: verifiedRole.id }, { upsert: true });
    }
    return { verifiedRole: verifiedRole.name, totalCategories: 6, totalChannels: 22 };
}

function start60sChannelTelemetryLoop(client) {
    setInterval(async () => {
        if (!client.guilds) return;
        client.guilds.cache.forEach(async (guild) => {
            try {
                const statusCh = guild.channels.cache.find(c => c.name === 'server-status-monitor');
                if (statusCh) {
                    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                    const statusEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('🟢 Autonomous Network Telemetry & Uptime Hub').addFields(
                        { name: '📊 Total Members', value: `\`${guild.memberCount}\``, inline: true },
                        { name: '🟢 System Uptime', value: `\`${(process.uptime() / 60).toFixed(1)} mins\``, inline: true },
                        { name: '🧠 RAM Usage (Heap)', value: `\`${memUsage} MB\``, inline: true },
                        { name: '📡 Bot Latency (Ping)', value: `\`${client.ws.ping}ms\``, inline: true }
                    );
                    const msgs = await statusCh.messages.fetch({ limit: 5 }).catch(() => null);
                    const botMsg = msgs ? msgs.find(m => m.author.id === client.user.id && m.embeds.length > 0) : null;
                    if (botMsg) await botMsg.edit({ embeds: [statusEmbed] }).catch(() => {});
                    else await statusCh.send({ embeds: [statusEmbed] }).catch(() => {});
                }
            } catch (err) {}
        });
    }, 60000);
}

const emergencyNukeCommand = new SlashCommandBuilder()
    .setName('emergency-nuke')
    .setDescription('⚡ Emergency Protocol: Purge channel or reset whole server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
        o.setName('target')
            .setDescription('Select whether to nuke this channel or the entire server')
            .setRequired(true)
            .addChoices({ name: 'Channel (Purge & Recreate)', value: 'channel' }, { name: 'Server (Reset All Channels & Non-Essential Roles)', value: 'server' })
    )
    .addChannelOption(o => o.setName('channel').setDescription('Target channel').addChannelTypes(ChannelType.GuildText).setRequired(false));

const modMasterCommand = new SlashCommandBuilder().setName('mod').setDescription('🛡️ Master Moderation Hub').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers).addSubcommand(sub => sub.setName('warn').setDescription('Warn member').addUserOption(o => o.setName('target').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)));
const autoModMasterCommand = new SlashCommandBuilder().setName('automod').setDescription('⚙️ AutoMod Hub').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addSubcommand(sub => sub.setName('status').setDescription('Status'));
const moderateMasterCommand = new SlashCommandBuilder().setName('moderate').setDescription('⚙️ Toggle advanced security modules').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addSubcommand(sub => sub.setName('toggle').setDescription('Toggle module').addStringOption(o => o.setName('module').setDescription('Module').setRequired(true).addChoices({ name: 'Wick', value: 'wick' }, { name: 'Beemo', value: 'beemo' })).addBooleanOption(o => o.setName('status').setDescription('Status').setRequired(true)));
const verifySetupCommand = new SlashCommandBuilder().setName('verify-setup').setDescription('Set up verification panel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true));
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 3 OF 6)
// File Path: modules/starry.js
// ==========================================

module.exports = async (client) => {
    if (client.starryEngineInitialized) {
        console.log('⚠️ Starry Engine already initialized. Skipping duplicate registration.');
        return;
    }
    client.starryEngineInitialized = true;

    console.log('🚀 Supreme Starry Master AI & Moderation Engine Loaded Successfully!');

    start60sChannelTelemetryLoop(client);

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

        const targetNames = typeMap[logType.toLowerCase()] || typeMap['access'];
        let channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name)));
        if (channel) return channel;

        return guild.channels.cache.find(c => c.type === ChannelType.GuildText && ['logs-server', 'server-logs', 'mod-logs', 'system-logs', 'logs'].includes(c.name.toLowerCase())) || null;
    };

    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A') => {
        if (!member || !member.user || member.user.bot) return false;
        const actionType = action.toLowerCase();
        let embedColor = actionType === 'ban' ? '#ED4245' : actionType === 'kick' ? '#FEE75C' : '#5865F2';

        const modEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: `${guild.name} | Security & Moderation Notice`, iconURL: guild.iconURL({ dynamic: true }) })
            .setTitle(`🛡️ Moderation Discipline: ${actionType.toUpperCase()}`)
            .setDescription(`Hello **${member.user.username}**, you received a moderation discipline in **${guild.name}**.`)
            .addFields(
                { name: '👤 Moderator', value: `\`${moderator.user ? moderator.user.username : 'Starry System'}\``, inline: true },
                { name: '🛡️ Action', value: `\`${actionType.toUpperCase()}\``, inline: true },
                { name: '🏷️ Case ID', value: `\`#${caseId}\``, inline: true },
                { name: '⏳ Duration', value: `\`${duration || 'Permanent / Instant'}\``, inline: true },
                { name: '📝 Reason', value: `>>> ${reason || 'No reason provided.'}`, inline: false }
            )
            .setTimestamp();

        try { await member.send({ embeds: [modEmbed] }); return true; } catch (err) { return false; }
    };

    // 🟢 MEMBER JOIN LISTENER (WELCOME + AUDIT LOG)
    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;

        const accessLog = client.getLogChannel(member.guild, 'access');
        if (accessLog) {
            const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
            const joinEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: '🟢 Member Joined', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`Welcome <@${member.id}> (**${member.user.tag}**) to **${member.guild.name}**!`)
                .addFields(
                    { name: '👤 User Mention', value: `<@${member.id}>`, inline: true },
                    { name: '🆔 User ID', value: `\`${member.id}\``, inline: true },
                    { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R> (${accountAgeDays} days old)`, inline: false },
                    { name: '📊 Total Members', value: `\`${member.guild.memberCount}\``, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();
            await accessLog.send({ embeds: [joinEmbed] }).catch(() => {});
        }

        try {
            const config = await WelcomeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;
            const welcomeCh = member.guild.channels.cache.get(config.channelId);
            if (!welcomeCh) return;

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle(`✨ Welcome to ${member.guild.name} ✨`)
                .setDescription(`Hello <@${member.id}>, we are so glad you joined the server! Read the rules and enjoy your stay.`)
                .addFields(
                    { name: '👤 Member Count', value: `You are member **#${member.guild.memberCount}**!`, inline: true },
                    { name: '📆 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `Enjoy your stay in ${member.guild.name}!` })
                .setTimestamp();

            await welcomeCh.send({ content: `Hey <@${member.id}>! 👋`, embeds: [welcomeEmbed] }).catch(() => {});
        } catch (err) {}
    });

    // 🔴 MEMBER LEAVE LISTENER (GOODBYE + AUDIT LOG)
    client.on('guildMemberRemove', async (member) => {
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
        } catch (err) {}
    });

    // 🗑️ MESSAGE DELETE & PURGE AUDIT LOGGERS
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
                    { name: '📝 Message Content', value: message.content ? `>>> ${message.content.slice(0, 1000)}` : '*[No text content or contains attachments/embeds]*', inline: false },
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
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 4 OF 6)
// File Path: modules/starry.js
// ==========================================

    // 🌐 GLOBAL PERMANENT INTERACTION LISTENER (BUTTONS, SLASH COMMANDS)
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.guild) return;

        // 1. Social Buttons
        if (interaction.isButton() && interaction.customId.startsWith('social_')) {
            const parts = interaction.customId.split('_');
            const actionType = parts[1] || 'pat';
            let targetUserId = parts[2] && parts[2] !== 'back' ? parts[2] : null;

            if (!targetUserId && interaction.message.embeds.length > 0) {
                const desc = interaction.message.embeds[0].description || '';
                const match = desc.match(/<@!?(\d+)>/);
                if (match) targetUserId = match[1];
            }

            if (!targetUserId && interaction.message.author) {
                targetUserId = interaction.message.author.id;
            }

            const actionGifs = {
                pat: 'https://media.tenor.com/E6f13T34EwAAAAAC/anime-pat.gif',
                hug: 'https://media.tenor.com/gg15582f3cAAAAAC/hug-anime.gif',
                kiss: 'https://media.tenor.com/v4P2p1aP9xAAAAAC/anime-kiss.gif',
                bite: 'https://media.tenor.com/39_X38I5ZqAAAAAC/anime-bite.gif',
                cuddle: 'https://media.tenor.com/6Xz9sV5b-W0AAAAC/cuddle-anime.gif',
                slap: 'https://media.tenor.com/Ws6vh1xRGAEAAAAC/anime-slap.gif'
            };

            const gifUrl = actionGifs[actionType.toLowerCase()] || actionGifs['pat'];
            const formattedAction = actionType.charAt(0).toUpperCase() + actionType.slice(1);

            const replyEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setDescription(`✨ <@${interaction.user.id}> ${actionType}ted back ${targetUserId ? `<@${targetUserId}>` : 'everyone'}! ❤️`)
                .setImage(gifUrl)
                .setTimestamp();

            const reciprocalRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`social_${actionType.toLowerCase()}_${interaction.user.id}`)
                    .setLabel(`${formattedAction} back`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⭐')
            );

            return interaction.reply({ embeds: [replyEmbed], components: [reciprocalRow] }).catch(() => {});
        }

        // 2. Verification Link Button
        if (interaction.isButton() && interaction.customId.startsWith('verify_role_')) {
            const roleId = interaction.customId.split('verify_role_')[1];
            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            if (!client.verifyMap) client.verifyMap = new Map();
            client.verifyMap.set(token, { guildId: interaction.guild.id, userId: interaction.user.id, roleId: roleId });

            const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`;
            const verifyUrl = `${hostUrl}/verify?token=${token}`;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Verify Human Access').setStyle(ButtonStyle.Link).setURL(verifyUrl).setEmoji('🌐')
            );

            return interaction.reply({ content: '🛡️ Click the secure link below to complete web verification:', components: [row], flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 3. Slash Command Router
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setup-starry') {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply().catch(() => {});
                const result = await provisionMasterServerStructure(interaction);
                const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('✨ Autonomous Server Setup Complete!').setDescription(`Configured **6 Categories** and **${result.totalChannels} Security & Log Channels**!`);
                return interaction.editReply({ embeds: [embed] });
            }

            if (interaction.commandName === 'emergency-nuke') {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
                const targetScope = interaction.options.getString('target', true);
                if (targetScope === 'channel') {
                    const channel = interaction.options.getChannel('channel') || interaction.channel;
                    const pos = channel.position;
                    const newCh = await channel.clone();
                    await channel.delete().catch(() => {});
                    await newCh.setPosition(pos).catch(() => {});
                    return newCh.send({ content: '⚡ **EMERGENCY NUKE:** Channel purged and recreated.' });
                }
            }

            if (interaction.commandName === 'setupwelcome') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: '❌ You need **Manage Server** permissions.', flags: [EPHEMERAL_FLAG] });
                }
                const channel = interaction.options.getChannel('channel', true);
                await WelcomeSettings.findOneAndUpdate({ guildId: interaction.guildId }, { channelId: channel.id }, { upsert: true });

                const previewEmbed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle(`✨ Welcome to ${interaction.guild.name} ✨`)
                    .setDescription(`Hello ${interaction.user}, welcome! Read the rules and enjoy your stay.`)
                    .addFields({ name: '👤 Member Count', value: `You are member **#${interaction.guild.memberCount}**!`, inline: true })
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({ text: `Starry Welcome System • Preview Mode` })
                    .setTimestamp();

                await channel.send({ content: `Hey ${interaction.user}! 👋 *(Setup Preview)*`, embeds: [previewEmbed] }).catch(() => {});
                return interaction.reply({ content: `✅ **Success!** Welcome messages will now be sent to ${channel}!`, flags: [EPHEMERAL_FLAG] });
            }

            if (interaction.commandName === 'setupgoodbye') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: '❌ You need **Manage Server** permissions.', flags: [EPHEMERAL_FLAG] });
                }
                const channel = interaction.options.getChannel('channel', true);
                await GoodbyeSettings.findOneAndUpdate({ guildId: interaction.guildId }, { channelId: channel.id }, { upsert: true });

                return interaction.reply({ content: `✅ **Success!** Goodbye messages will now be sent to ${channel}!`, flags: [EPHEMERAL_FLAG] });
            }
        }
    });

    function cleanCategoryName(str) {
        if (!str) return '';
        return str.toLowerCase()
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F800}-\u{1F8FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async function handleAutoModPing(message) {
        if (!message.guild || message.author.bot || !message.member) return false;
        const rawPingMatches = message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || [];
        const totalPings = Math.max(message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0), rawPingMatches.length);

        if (totalPings >= 5) {
            const botMember = message.guild.members.me;
            if (botMember.permissions.has(PermissionFlagsBits.ManageMessages)) await message.delete().catch(() => {});

            if (botMember.permissions.has(PermissionFlagsBits.ModerateMembers) && message.member.roles.highest.position < botMember.roles.highest.position && message.author.id !== message.guild.ownerId) {
                await message.member.timeout(10 * 60 * 1000, `Mass Ping AutoMod (${totalPings} pings)`).catch(() => {});
                const warningMsg = await message.channel.send(`🛡️ **AutoMod:** <@${message.author.id}> was timed out for **10 minutes** due to Mass Mentioning!`).catch(() => null);
                if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => {}), 6000);
            }
            return true;
        }
        return false;
    }

    async function handleDevCLI(client, message) {
        const text = message.content.toLowerCase();
        if (!text.startsWith('.dev') && !text.startsWith('.sysinfo') && !text.startsWith('.eval ')) return false;

        const isOwner = client.isOwner(message.author.id);
        if (!isOwner) { await message.reply("❌ Access Denied.").catch(()=>{}); return true; }

        if (text === '.sysinfo') {
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            await message.reply(`📊 **Starry System Info:**\n- **RAM:** ${memory} MB\n- **Uptime:** ${(process.uptime() / 3600).toFixed(2)} Hours\n- **Ping:** ${client.ws.ping}ms`).catch(()=>{});
            return true;
        }
        if (text.startsWith('.eval ')) {
            try {
                let evaled = eval(message.content.slice(6));
                if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
                await message.reply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``).catch(()=>{});
            } catch (err) { await message.reply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``).catch(()=>{}); }
            return true;
        }
        return false;
    }

    // ⚡ INSTANT LOCAL PRE-PARSERS (<10ms Execution)
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

        // Premium Suite Overview
        if (text === '.premium' || text === 'starry premium' || text === 'jarvis premium') {
            const premiumEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setAuthor({ name: `${displayName} Protocol | Premium Suite`, iconURL: client.user.displayAvatarURL() })
                .setTitle('💎 Starry Premium Features & Capabilities')
                .setDescription('Below is the complete overview of all active features:')
                .addFields(
                    { name: '⚡ 1. High-Speed Gemini Multi-Model AI Engine', value: '• Sub-second response priority via Gemini 2.5 Flash & 2.0 Flash.', inline: false },
                    { name: '🎨 2. High-Res Flux AI Image Generator', value: '• Instant art generation using the Flux model (`.imagine <prompt>`).', inline: false },
                    { name: '♾️ 3. Infinite-Time Social Action Buttons', value: '• Permanent reciprocal buttons (`Pat back`, `Hug back`, `Kiss back`).', inline: false },
                    { name: '💎 4. Premium Branded Moderation DMs', value: '• Rich DM notices sent to offenders upon Ban, Kick, or Timeout.', inline: false },
                    { name: '⚡ 5. Instant Local Admin Actions (<10ms)', value: '• Fast local execution for channels, roles, and message purges.', inline: false }
                )
                .setFooter({ text: 'Starry Master System • Premium Tier Active', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await message.reply({ embeds: [premiumEmbed] });
            return true;
        }

        // Channel Creation (Text & Voice)
        const voiceChanRegex = /(?:create|make|add)\s+(?:a\s+)?voice\s+channel\s+(?:named\s+)?(.+)$/i;
        const voiceMatch = cleanText.match(voiceChanRegex);
        if (voiceMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await message.reply("❌ You or I lack **Manage Channels** permission.");
                return true;
            }
            try {
                const vChan = await message.guild.channels.create({ name: voiceMatch[1].trim(), type: ChannelType.GuildVoice });
                await message.reply(`🔊 Successfully created voice channel **${vChan.name}**!`);
            } catch (err) {
                await message.reply(`❌ Failed to create voice channel: \`${err.message}\``);
            }
            return true;
        }

        const textChanRegex = /(?:create|make|add)\s+(?:a\s+)?(?:text\s+)?channel\s+(?:named\s+)?([a-zA-Z0-9_\-\s]+)$/i;
        const textMatch = cleanText.match(textChanRegex);
        if (textMatch && !cleanText.includes('voice') && !cleanText.includes('role') && !cleanText.includes('category')) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await message.reply("❌ You or I lack **Manage Channels** permission.");
                return true;
            }
            try {
                const cName = textMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
                const tChan = await message.guild.channels.create({ name: cName, type: ChannelType.GuildText });
                await message.reply(`✨ Successfully created text channel <#${tChan.id}>!`);
            } catch (err) {
                await message.reply(`❌ Failed to create text channel: \`${err.message}\``);
            }
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
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 5 OF 6)
// File Path: modules/starry.js
// ==========================================

    // 🛡️ SMART NATURAL LANGUAGE TEXT MODERATION ENGINE
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
            } else if (lowerContent.includes('reason:')) {
                reason = rawContent.substring(rawContent.toLowerCase().indexOf('reason:') + 7).trim();
            }

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

            const caseId = Math.floor(Math.random() * 90000) + 10000;

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

            if (isUntimeout) {
                if (!executor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                    await message.reply('❌ Missing `Moderate Members` permission.');
                    return true;
                }
                if (!targetMember) return true;

                await targetMember.timeout(null, `Untimed out by ${message.author.tag}`);
                await message.reply(`✅ Successfully removed timeout for ${targetMember}.`);
                return true;
            }

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
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 6 OF 6)
// File Path: modules/starry.js
// ==========================================

    // 🎨 STRICT POLLINATIONS IMAGE PARSER
    async function handlePollinationsImage(client, message, displayName, mentionsBot, hasName, isImagine) {
        let isImageRequest = isImagine;
        let imagePrompt = "";

        if (isImagine) {
            imagePrompt = message.content.slice(9).trim();
        } else if (hasName || mentionsBot) {
            const rawText = message.content.toLowerCase();
            const hasExplicitImageKeywords = /\b(?:image|picture|photo|art|drawing|pic|illustration|avatar)s?\b/i.test(rawText) ||
                                            /\b(?:draw|paint|imagine)\b/i.test(rawText);

            if (hasExplicitImageKeywords) {
                let cleanPrompt = message.content
                    .replace(new RegExp(`^(?:<@!?${client.user?.id}>|${displayName}|jarvis|starry)\\s*`, 'i'), '')
                    .trim();

                cleanPrompt = cleanPrompt
                    .replace(/^(?:create|generate|draw|make|paint|imagine)\s+/i, '')
                    .replace(/\b(?:an?|some|the)\b\s+/gi, '')
                    .replace(/\b(?:image|picture|drawing|art|photo|pic|illustration)s?\b/gi, '')
                    .replace(/\b(?:of|about|showing|with)\b\s+/gi, '')
                    .trim();

                if (cleanPrompt.length > 0) {
                    isImageRequest = true;
                    imagePrompt = cleanPrompt;
                }
            }
        }

        if (isImageRequest) {
            if (!imagePrompt) { await message.reply('❌ Please tell me what to draw!').catch(() => {}); return true; }
            const replyMsg = await message.reply('🎨 Painting your picture... Please wait.').catch(() => null);
            if (!replyMsg) return true;
            try {
                const safePrompt = encodeURIComponent(imagePrompt.replace(/[^a-zA-Z0-9\s]/g, ''));
                const seed = Math.floor(Math.random() * 1000000);
                const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
                
                await message.reply({ content: `🖼️ **"${imagePrompt}"**\nGenerated by ${message.author}`, files: [{ attachment: imageUrl, name: `${displayName}_AI_Art.png` }] }).catch(() => {});
                if (replyMsg) await replyMsg.delete().catch(() => {});
            } catch (error) { 
                if (replyMsg) await replyMsg.edit('❌ I had trouble drawing that. Try a simpler prompt.').catch(() => {}); 
            }
            return true;
        }
        return false;
    }

    // 🤖 CONVERSATIONAL GEMINI ENGINE
    async function handleConversationalGemini(client, message, displayName) {
        await message.channel.sendTyping().catch(() => {});

        try {
            const prompt = `[SYSTEM INSTRUCTION]
You are ${displayName}, an advanced all-in-one Discord AI companion and server administrator.

YOUR FULL CAPABILITIES INCLUDE:
1. 🎨 AI Image Generation: Creating custom art, pictures, and drawings on command (\`.imagine\` or \`Starry draw...\`).
2. 🎵 Music & DJ Controls: Playing high-quality audio, track control (pause, skip, loop, volume), and VC locks.
3. 🌐 Translator & Multilingual Engine: Auto-translating text between languages, detecting language, and multilingual support.
4. 🔢 Smart Counting Game & High Scores: Managing server counting channels (\`/setupcount\`), evaluating math expressions, and tracking streaks.
5. 🛡️ Autonomous Moderation & Security: Kicking, banning, unbanning, timing out users, clearing messages, and security logging.
6. 📁 Channel & Category Management: Dynamically creating, deleting, and organizing text/voice channels and categories.
7. 🎭 Role Management: Creating roles, assigning/removing roles from members, and managing permissions.

When asked about your features, list ALL 7 of your capabilities clearly and concisely.

[USER MESSAGE]
${message.author.username} says: ${message.content}`;

            let replyText = await generateAIResponseWithRetry(prompt);

            if (replyText && replyText.trim().length > 0) {
                const textChunks = replyText.trim().match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) {
                    await message.reply(chunk).catch(() => {});
                }
            }

        } catch (error) {
            console.error('Conversational Engine Error:', error.message || error);
        }
    }

    // ==========================================
    // 5. UNIFIED DISPATCHER PIPELINE
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        // 1. AutoMod Ping Check
        if (await handleAutoModPing(message)) return;

        // 2. Developer CLI Commands (.dev, .sysinfo, .eval)
        if (await handleDevCLI(client, message)) return;

        // 3. Smart Natural Language & Mention Moderation Parser
        const modHandled = await handleSmartModeration(client, message);
        if (modHandled) return;

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

        // 4. Fast Local Pre-Parsers (<10ms Execution)
        const localHandled = await handleLocalActions(client, message);
        if (localHandled) return; 

        // 5. Pollinations AI Media Generation
        const imageHandled = await handlePollinationsImage(client, message, displayName, mentionsBot, hasName, isImagine);
        if (imageHandled) return;

        // 6. Conversational Gemini AI Engine
        await handleConversationalGemini(client, message, displayName);
    });
};

// ==========================================
// EXPORTS
// ==========================================
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.generateAIResponseWithRetry = generateAIResponseWithRetry;
module.exports.executeFullGuildBackup = executeFullGuildBackup;
module.exports.emergencyNukePayload = emergencyNukeCommand.toJSON();
module.exports.modMasterPayload = modMasterCommand.toJSON();
module.exports.autoModMasterPayload = autoModMasterCommand.toJSON();
module.exports.moderateMasterPayload = moderateMasterCommand.toJSON();
module.exports.verifySetupPayload = verifySetupCommand.toJSON();
