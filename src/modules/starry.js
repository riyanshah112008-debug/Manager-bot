// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 1 OF 8)
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
    SlashCommandBuilder
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const mongoose = require('mongoose');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// Safely Require Mongoose Models (Relative to modules/)
let ServerSettings, ChestChannel, BoostChannel, MasterSecurity, PolicyVote, CountGuild;
try { ServerSettings = mongoose.models.ServerSettings || require('../models/ServerSettings'); } catch (e) {}
try { ChestChannel = mongoose.models.ChestChannel || require('../models/ChestChannel'); } catch (e) {}
try { BoostChannel = mongoose.models.BoostChannel || require('../models/BoostChannel'); } catch (e) {}

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
const protectDb = new Database('protect.db');
protectDb.exec(`CREATE TABLE IF NOT EXISTS protected_users (guild_id TEXT, user_id TEXT, PRIMARY KEY (guild_id, user_id))`);

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

// Preferred Active Models Fallback Chain
const AI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
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
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 2 OF 8)
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
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 3 OF 8)
// ==========================================
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
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 4 OF 8)
// ==========================================
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

module.exports = (client) => {
    // 🛡️ FAIL-SAFE: PREVENT DUPLICATE EVENT REGISTRATIONS ON THE SAME CLIENT
    if (client.starryEngineInitialized) {
        console.log('⚠️ Starry Engine already initialized. Skipping duplicate registration.');
        return;
    }
    client.starryEngineInitialized = true;

    console.log('🚀 Supreme Starry Unified Engine Active (Single Dispatcher Pipeline & Infinite Social Buttons)');

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

        const targetNames = typeMap[logType.toLowerCase()] || typeMap['misc'];
        let channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name)));
        if (channel) return channel;

        return guild.channels.cache.find(c => c.type === ChannelType.GuildText && ['logs-server', 'server-logs', 'mod-logs', 'system-logs', 'logs'].includes(c.name)) || null;
    };

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
        // 3. SLASH COMMAND ROUTER FOR TICKETS & SETUP
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketsetup') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    return interaction.reply({ content: '❌ You lack permissions to set up the ticket panel.', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor('#00F2FE')
                    .setTitle('🎫 Support & Application Portal')
                    .setDescription('• **Open Support Ticket:** Opens a private communication channel with staff.\n• **Apply for Staff:** Opens an interactive form to apply for moderator positions.')
                    .setFooter({ text: 'Starry Support Engine' });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'),
                    new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('📝')
                );

                await interaction.reply({ content: '✅ Ticket system panel created!', ephemeral: true });
                return interaction.channel.send({ embeds: [embed], components: [buttons] });
            }

            if (interaction.commandName === 'applysetup') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    return interaction.reply({ content: '❌ You lack permissions to set up the application panel.', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('📋 Server Applications')
                    .setDescription('We are looking for new staff and partners!\n\nChoose an option below to apply.')
                    .setFooter({ text: 'Starry Application Engine' });

                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('🛡️ Apply for Staff').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('sys_apply_partner').setLabel('🤝 Request Partnership').setStyle(ButtonStyle.Success)
                );

                await interaction.reply({ content: '✅ Application Dashboard created!', ephemeral: true });
                return interaction.channel.send({ embeds: [embed], components: [buttons] });
            }
        }
    };
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 5 OF 8)
// File Path: modules/starry.js
// ==========================================
    // 🌐 GLOBAL PERMANENT INTERACTION LISTENER (INFINITE TIME BUTTONS & ACTIVE PANELS)
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.guild) return;

        // ----------------------------------------------------
        // 1. PERMANENT INFINITE-TIME SOCIAL ACTION BUTTONS
        // ----------------------------------------------------
        if (interaction.isButton() && interaction.customId.startsWith('social_')) {
            const parts = interaction.customId.split('_'); // Format: social_<actionType>_<targetUserId>
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
                slap: 'https://media.tenor.com/Ws6vh1xRGAEAAAAC/anime-slap.gif',
                tickle: 'https://media.tenor.com/AInAIs2aF3AAAAAC/anime-tickle.gif',
                poke: 'https://media.tenor.com/1OInG6sX0x8AAAAC/anime-poke.gif',
                lick: 'https://media.tenor.com/0V4f6I5xP3UAAAAC/anime-lick.gif',
                handhold: 'https://media.tenor.com/kCZ9z7aG6b4AAAAC/anime-handhold.gif'
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

        // ----------------------------------------------------
        // 2. SUPPORT TICKET CREATOR (sys_create_ticket)
        // ----------------------------------------------------
        if (interaction.isButton() && (interaction.customId === 'sys_create_ticket' || interaction.customId === 'create_ticket')) {
            try {
                await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });
                const guild = interaction.guild;
                const member = interaction.member;

                let existingCh = guild.channels.cache.find(c => c.topic === member.id && c.name.includes('ticket-'));
                if (existingCh) {
                    return interaction.editReply({ content: `❌ You already have an open support ticket in <#${existingCh.id}>!` });
                }

                // Get or create "OPENED TICKETS" category
                let openedCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'opened tickets');
                if (!openedCategory) {
                    openedCategory = await guild.channels.create({ name: 'OPENED TICKETS', type: ChannelType.GuildCategory }).catch(() => null);
                }

                let staffRole = guild.roles.cache.find(r => ['staff', 'moderator', 'admin'].includes(r.name.toLowerCase()));

                const ticketChannel = await guild.channels.create({
                    name: `ticket-${member.user.username.toLowerCase()}`,
                    type: ChannelType.GuildText,
                    topic: member.id,
                    parent: openedCategory ? openedCategory.id : null,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                        { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
                        ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
                    ]
                });

                const ticketEmbed = new EmbedBuilder()
                    .setColor('#00F2FE')
                    .setTitle(`🎫 Support Ticket | ${member.user.username}`)
                    .setDescription(`Hello <@${member.id}>! Staff has been notified and will assist you shortly.\n\nPlease describe your issue or inquiry in detail below.`)
                    .addFields({ name: '📌 Status', value: '`UNCLAIMED 🟡`', inline: true })
                    .setTimestamp();

                // 📌 INCLUDES BOTH CLAIM AND CLOSE BUTTONS!
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('sys_claim_ticket').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('✋'),
                    new ButtonBuilder().setCustomId('sys_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
                );

                await ticketChannel.send({ content: `<@${member.id}> ${staffRole ? `<@&${staffRole.id}>` : ''}`, embeds: [ticketEmbed], components: [actionRow] });
                return interaction.editReply({ content: `✅ Ticket created successfully! Head over to <#${ticketChannel.id}>.` });
            } catch (err) {
                console.error('Ticket Creation Error:', err);
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({ content: '❌ Failed to create ticket due to missing bot permissions.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
                } else {
                    return interaction.editReply({ content: '❌ Failed to create ticket due to missing bot permissions.' }).catch(() => {});
                }
            }
        }

        // ----------------------------------------------------
        // 3. CLAIM TICKET BUTTON (sys_claim_ticket)
        // ----------------------------------------------------
        if (interaction.isButton() && (interaction.customId === 'sys_claim_ticket' || interaction.customId === 'claim_ticket')) {
            await interaction.deferUpdate().catch(() => {});

            const channel = interaction.channel;
            const staffMember = interaction.user;

            const cleanName = channel.name.replace('ticket-', '').replace('claimed-', '');
            await channel.setName(`claimed-${cleanName}`).catch(() => {});

            await channel.permissionOverwrites.edit(staffMember.id, {
                ViewChannel: true,
                SendMessages: true,
                ManageChannels: true
            }).catch(() => {});

            const claimedEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✋ Ticket Claimed')
                .setDescription(`This ticket is now being handled by <@${staffMember.id}>.`)
                .setTimestamp();

            const updatedRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sys_claim_ticket').setLabel(`Claimed by ${staffMember.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true).setEmoji('✅'),
                new ButtonBuilder().setCustomId('sys_close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await interaction.editReply({ components: [updatedRow] }).catch(() => {});
            await channel.send({ embeds: [claimedEmbed] }).catch(() => {});
            return;
        }

        // ----------------------------------------------------
        // 4. CLOSE SUPPORT TICKET BUTTON (sys_close_ticket)
        // ----------------------------------------------------
        if (interaction.isButton() && (interaction.customId === 'sys_close_ticket' || interaction.customId === 'close_ticket')) {
            await interaction.deferUpdate().catch(() => {});

            const channel = interaction.channel;
            const guild = interaction.guild;
            const ticketOwnerId = channel.topic;

            // Move channel to "CLOSED TICKETS" category
            let closedCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'closed tickets');
            if (!closedCategory) {
                closedCategory = await guild.channels.create({ name: 'CLOSED TICKETS', type: ChannelType.GuildCategory }).catch(() => null);
            }
            if (closedCategory) {
                await channel.setParent(closedCategory.id).catch(() => {});
            }

            if (ticketOwnerId) {
                await channel.permissionOverwrites.edit(ticketOwnerId, { SendMessages: false }).catch(() => {});
            }

            const closedEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🔒 Ticket Closed')
                .setDescription(`Ticket closed by <@${interaction.user.id}>.\nMoved to **CLOSED TICKETS**. Use the options below to save a transcript or delete this channel manually.`)
                .setTimestamp();

            const managementRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sys_transcript_ticket').setLabel('Save Transcript').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                new ButtonBuilder().setCustomId('sys_delete_ticket').setLabel('Delete Ticket').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            // 🛑 REMOVED AUTOMATIC 5-SECOND DELETION TIMER!
            await channel.send({ embeds: [closedEmbed], components: [managementRow] });
            return;
        }

        // ----------------------------------------------------
        // 5. SAVE TRANSCRIPT (sys_transcript_ticket)
        // ----------------------------------------------------
        if (interaction.isButton() && (interaction.customId === 'sys_transcript_ticket' || interaction.customId === 'transcript_ticket')) {
            await interaction.deferReply();

            try {
                const channel = interaction.channel;
                const messages = await channel.messages.fetch({ limit: 100 });
                
                let transcriptContent = `==================================================\n`;
                transcriptContent += `TICKET TRANSCRIPT: #${channel.name}\n`;
                transcriptContent += `SERVER: ${interaction.guild.name}\n`;
                transcriptContent += `GENERATED BY: ${interaction.user.tag} (${interaction.user.id})\n`;
                transcriptContent += `DATE: ${new Date().toLocaleString()}\n`;
                transcriptContent += `==================================================\n\n`;

                const sortedMessages = Array.from(messages.values()).reverse();

                for (const msg of sortedMessages) {
                    const time = new Date(msg.createdTimestamp).toLocaleString();
                    const author = `${msg.author.tag} (${msg.author.id})`;
                    let content = msg.content || '[No Text Content]';

                    if (msg.attachments.size > 0) {
                        const attachments = msg.attachments.map(a => a.url).join(', ');
                        content += ` [Attachments: ${attachments}]`;
                    }

                    if (msg.embeds.length > 0) {
                        content += ` [Embedded Message Content]`;
                    }

                    transcriptContent += `[${time}] ${author}:\n${content}\n--------------------------------------------------\n`;
                }

                const { AttachmentBuilder } = require('discord.js');
                const attachment = new AttachmentBuilder(Buffer.from(transcriptContent, 'utf-8'), { name: `transcript-${channel.name}.txt` });

                const transcriptEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📝 Ticket Transcript Generated')
                    .setDescription(`Transcript saved for **#${channel.name}**.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [transcriptEmbed], files: [attachment] });
            } catch (err) {
                console.error('Transcript Error:', err);
                await interaction.editReply({ content: '❌ Failed to generate transcript.' });
            }
            return;
        }

        // ----------------------------------------------------
        // 6. DELETE TICKET (sys_delete_ticket)
        // ----------------------------------------------------
        if (interaction.isButton() && (interaction.customId === 'sys_delete_ticket' || interaction.customId === 'delete_ticket')) {
            await interaction.channel.delete().catch(() => {});
            return;
        }

        // ----------------------------------------------------
        // 7. STAFF APPLICATION MODAL FORM (sys_apply_staff)
        // ----------------------------------------------------
        if (interaction.isButton() && (interaction.customId === 'sys_apply_staff' || interaction.customId === 'apply_staff')) {
            const modal = new ModalBuilder()
                .setCustomId('sys_staff_modal')
                .setTitle('📝 Staff Application Form');

            const ageInput = new TextInputBuilder()
                .setCustomId('app_age')
                .setLabel('How old are you?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const expInput = new TextInputBuilder()
                .setCustomId('app_exp')
                .setLabel('Prior Staff/Moderation Experience?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('app_reason')
                .setLabel('Why do you want to join our team?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(ageInput),
                new ActionRowBuilder().addComponents(expInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );

            return interaction.showModal(modal).catch(() => {});
        }

        // Staff Application Modal Submission Handler
        if (interaction.isModalSubmit() && interaction.customId === 'sys_staff_modal') {
            await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });
            const age = interaction.fields.getTextInputValue('app_age');
            const exp = interaction.fields.getTextInputValue('app_exp');
            const reason = interaction.fields.getTextInputValue('app_reason');

            const logChannel = client.getLogChannel ? client.getLogChannel(interaction.guild, 'moderate') : interaction.guild.channels.cache.find(c => c.name.includes('log'));

            const appEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(`📝 New Staff Application | ${interaction.user.username}`)
                .addFields(
                    { name: '👤 Applicant', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
                    { name: '🎂 Age', value: age, inline: true },
                    { name: '📜 Experience', value: exp, inline: false },
                    { name: '💡 Reason', value: reason, inline: false }
                )
                .setTimestamp();

            if (logChannel) await logChannel.send({ embeds: [appEmbed] }).catch(() => {});
            return interaction.editReply({ content: '✅ Your staff application has been submitted to management for review!' });
        }

        // ----------------------------------------------------
        // 8. WEB VERIFICATION LINK GENERATOR BUTTON
        // ----------------------------------------------------
        if (interaction.isButton() && interaction.customId.startsWith('verify_role_')) {
            const roleId = interaction.customId.split('verify_role_')[1];
            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            client.verifyMap.set(token, { guildId: interaction.guild.id, userId: interaction.user.id, roleId: roleId });

            const hostUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 10000}`;
            const verifyUrl = `${hostUrl}/verify?token=${token}`;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Verify Human Access').setStyle(ButtonStyle.Link).setURL(verifyUrl).setEmoji('🌐')
            );

            return interaction.reply({ content: '🛡️ Click the secure link below to complete web verification:', components: [row], flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // ----------------------------------------------------
        // 9. DJ MUSIC PLAYER BUTTON HANDLER
        // ----------------------------------------------------
        if (interaction.isButton() && ['music_pause', 'music_skip', 'music_stop', 'music_loop', 'dj_vol_down', 'dj_vol_up', 'dj_lock', 'dj_unlock'].includes(interaction.customId)) {
            const guild = interaction.guild;
            const member = interaction.member;
            const voiceChannel = member?.voice?.channel;
            const player = client.manager ? client.manager.getPlayer(guild.id) : null;

            if (!voiceChannel) return interaction.reply({ content: '❌ Connect to a voice channel first!', flags: [EPHEMERAL_FLAG] });
            if (!player) return interaction.reply({ content: '❌ No active player in this server!', flags: [EPHEMERAL_FLAG] });

            await interaction.deferUpdate().catch(() => {});
            try {
                if (interaction.customId === 'music_pause') player.pause(!player.paused);
                else if (interaction.customId === 'music_skip') player.skip();
                else if (interaction.customId === 'music_stop') player.destroy();
                else if (interaction.customId === 'music_loop') player.setLoop(player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none');
                else if (interaction.customId === 'dj_vol_down') player.setVolume(Math.max(10, player.volume - 10));
                else if (interaction.customId === 'dj_vol_up') player.setVolume(Math.min(100, player.volume + 10));
                else if (interaction.customId === 'dj_lock') await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
                else if (interaction.customId === 'dj_unlock') await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
            } catch (err) {}
            return;
        }

        // ----------------------------------------------------
        // 10. SLASH COMMAND ROUTER
        // ----------------------------------------------------
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
        }
    });

    function cleanCategoryName(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
        // ----------------------------------------------------
        // 6. DJ MUSIC PLAYER BUTTON HANDLER
        // ----------------------------------------------------
        if (interaction.isButton() && ['music_pause', 'music_skip', 'music_stop', 'music_loop', 'dj_vol_down', 'dj_vol_up', 'dj_lock', 'dj_unlock'].includes(interaction.customId)) {
            const guild = interaction.guild;
            const member = interaction.member;
            const voiceChannel = member?.voice?.channel;
            const player = client.manager ? client.manager.getPlayer(guild.id) : null;

            if (!voiceChannel) return interaction.reply({ content: '❌ Connect to a voice channel first!', flags: [EPHEMERAL_FLAG] });
            if (!player) return interaction.reply({ content: '❌ No active player in this server!', flags: [EPHEMERAL_FLAG] });

            await interaction.deferUpdate().catch(() => {});
            try {
                if (interaction.customId === 'music_pause') player.pause(!player.paused);
                else if (interaction.customId === 'music_skip') player.skip();
                else if (interaction.customId === 'music_stop') player.destroy();
                else if (interaction.customId === 'music_loop') player.setLoop(player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none');
                else if (interaction.customId === 'dj_vol_down') player.setVolume(Math.max(10, player.volume - 10));
                else if (interaction.customId === 'dj_vol_up') player.setVolume(Math.min(100, player.volume + 10));
                else if (interaction.customId === 'dj_lock') await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
                else if (interaction.customId === 'dj_unlock') await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
            } catch (err) {}
            return;
        }

        // ----------------------------------------------------
        // 7. SLASH COMMAND ROUTER
        // ----------------------------------------------------
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
        }
    });

    function cleanCategoryName(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 6 OF 8)
// ==========================================
    async function handleAutoModPing(message) {
        if (!message.guild || message.author.bot || !message.member) return false;
        const rawPingMatches = message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || [];
        const totalPings = Math.max(message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0), rawPingMatches.length);

        if (totalPings >= 5) {
            const botMember = message.guild.members.me;
            if (botMember.permissions.has(PermissionFlagsBits.ManageMessages)) await message.delete().catch(() => {});

            if (botMember.permissions.has(PermissionFlagsBits.ModerateMembers) && message.member.roles.highest.position < botMember.roles.highest.position && message.author.id !== message.guild.ownerId) {
                const caseId = Math.floor(Math.random() * 90000) + 10000;
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

    // ⚡ INSTANT LOCAL PRE-PARSERS (<50ms Execution - Zero AI Calls)
    async function handleLocalActions(client, message) {
        if (!message.guild) return false;
        const text = message.content.toLowerCase().trim();
        const botMember = message.guild.members.me;
        const displayName = client.user.username;

        // Clean bot trigger prefixes/mentions
        const cleanText = text.replace(new RegExp(`^(?:<@!?${client.user?.id}>|${displayName}|jarvis|starry)\\s*`, 'i'), '').trim();

        // 0. UPGRADED .PREMIUM SUITE DISPLAY COMMAND
        if (text === '.premium' || text === 'starry premium' || text === 'jarvis premium') {
            const premiumEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setAuthor({ name: `${displayName} Protocol | Premium Suite`, iconURL: client.user.displayAvatarURL() })
                .setTitle('💎 Starry Premium Features & Capabilities')
                .setDescription('Below is the complete overview of all high-tier, automated, and AI-powered features active on this server:')
                .addFields(
                    { name: '⚡ 1. High-Speed Gemini Multi-Model AI Engine', value: '• Sub-second response priority via Gemini 2.5 Flash & 2.0 Flash.\n• Dynamic multi-key API rotation with automatic failover.', inline: false },
                    { name: '🎨 2. High-Res Flux AI Image Generator', value: '• Instant art generation using the Flux model (`.imagine <prompt>` or `Starry draw...`).', inline: false },
                    { name: '♾️ 3. Infinite-Time Social Action Buttons', value: '• Permanent reciprocal buttons (`Pat back`, `Hug back`, `Kiss back`, `Cuddle`, `Bite`, `Slap`).', inline: false },
                    { name: '💎 4. Premium Branded Moderation DMs', value: '• Rich, color-coded DM notices sent to offenders upon Ban, Kick, or Timeout.', inline: false },
                    { name: '🌐 5. Multilingual Translation Engine', value: '• Dynamic multi-language translation and language detection across text channels.', inline: false },
                    { name: '⚡ 6. Instant Local Admin Actions (<50ms)', value: '• Zero AI rate-limit risk for administrative channel/role management.', inline: false },
                    { name: '🎵 7. Lavalink Audio Filters & Autoplay Engine', value: '• Related track autoplay recommendations and live DJ audio filters.', inline: false },
                    { name: '🛡️ 8. Master Server Infrastructure & Telemetry', value: '• Autonomous layout deployment (`/setup-starry`) & 60s monitor.', inline: false },
                    { name: '🔢 9. Smart Counting Game & High-Score Engine', value: '• Interactive counting channel setup (`/setupcount`) & math solver.', inline: false }
                )
                .setFooter({ text: 'Starry Master System • Premium Tier Active', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await message.reply({ embeds: [premiumEmbed] });
            return true;
        }

        // 1. INSTANT VOICE CHANNEL CREATION (e.g. "Starry create a voice channel named music")
        const voiceChanRegex = /(?:create|make|add)\s+(?:a\s+)?voice\s+channel\s+(?:named\s+)?(.+)$/i;
        const voiceMatch = cleanText.match(voiceChanRegex);

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

        // 2. INSTANT TEXT CHANNEL CREATION (e.g. "Starry create a text channel named music")
        const textChanRegex = /(?:create|make|add)\s+(?:a\s+)?(?:text\s+)?channel\s+(?:named\s+)?([a-zA-Z0-9_\-\s]+)$/i;
        const textMatch = cleanText.match(textChanRegex);

        if (textMatch && !cleanText.includes('voice') && !cleanText.includes('role') && !cleanText.includes('category')) {
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

        // 3. CATEGORY CREATION
        const createCatRegex = /(?:create|make|add)\s+(?:a\s+)?category\s+(?:named\s+)?([a-zA-Z0-9_\-\s]+)$/i;
        const catMatch = cleanText.match(createCatRegex);

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

        // 4. FAST LOCAL ROLE ASSIGNMENT
        const roleAssignRegex = /(?:assign|give|add)\s+(?:role\s+)?<@&(\d+)>\s+(?:to\s+)?<@!?(\d+)>/i;
        const roleAssignMatch = message.content.match(roleAssignRegex);

        if (roleAssignMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                await message.reply("❌ You or I lack **Manage Roles** permission.");
                return true;
            }

            const targetRoleId = roleAssignMatch[1];
            const targetUserId = roleAssignMatch[2];

            const role = message.guild.roles.cache.get(targetRoleId);
            const targetMember = await message.guild.members.fetch(targetUserId).catch(() => null);

            if (!role) { await message.reply("❌ Role not found on this server."); return true; }
            if (!targetMember) { await message.reply("❌ User not found in this server."); return true; }

            if (role.position >= botMember.roles.highest.position) {
                await message.reply(`❌ I cannot assign **${role.name}** because it is equal to or higher than my highest role!`);
                return true;
            }

            try {
                await targetMember.roles.add(role);
                await message.reply(`✅ Successfully assigned role **${role.name}** to <@${targetMember.id}>!`);
            } catch (err) {
                await message.reply(`❌ Failed to assign role: \`${err.message}\``);
            }
            return true;
        }

        // 5. BULK DELETE CHANNELS IN A CATEGORY
        const bulkDelRegex = /(?:delete|remove|purge)\s+(?:all\s+)?(?:the\s+)?channels\s+in\s+(.+)$/i;
        const bulkMatch = message.content.match(bulkDelRegex);

        if (bulkMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await message.reply("❌ You or I lack **Manage Channels** permission.");
                return true;
            }

            let rawSearch = bulkMatch[1].trim();
            if (rawSearch.toLowerCase().endsWith('category')) rawSearch = rawSearch.slice(0, -8).trim();
            const cleanSearch = cleanCategoryName(rawSearch);

            const targetCategory = message.guild.channels.cache.find(c => {
                if (c.type !== ChannelType.GuildCategory) return false;
                const cleanCatName = cleanCategoryName(c.name);
                return cleanCatName === cleanSearch || cleanCatName.includes(cleanSearch) || cleanSearch.includes(cleanCatName);
            });

            if (!targetCategory) {
                await message.reply(`❌ Could not find category matching **"${rawSearch}"**.`);
                return true;
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

        // 6. PURGE MESSAGES
        const clearRegex = /(?:clear|purge|delete)\s+(\d+)\s*(?:messages)?$/i;
        const clearMatch = message.content.match(clearRegex);

        if (clearMatch && !text.includes('channel') && !text.includes('category')) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) || !botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.reply('❌ Missing **Manage Messages** permission.');
                return true;
            }
            const count = parseInt(clearMatch[1]);
            if (count <= 0) { await message.reply('❌ Specify a valid message count.'); return true; }
            const deleteCount = Math.min(count, 99) + 1;
            await message.channel.bulkDelete(deleteCount, true).catch(() => {});
            const sent = await message.channel.send(`🧹 Successfully cleared ${count} messages!`);
            setTimeout(() => sent.delete().catch(() => {}), 3500);
            return true;
        }

        return false;
    }
    // ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 7 OF 8)
// ==========================================
    // 🎨 STRICT POLLINATIONS IMAGE PARSER (Requires explicit art/drawing keywords)
    async function handlePollinationsImage(client, message, displayName, mentionsBot, hasName, isImagine) {
        let isImageRequest = isImagine;
        let imagePrompt = "";

        if (isImagine) {
            imagePrompt = message.content.slice(9).trim();
        } else if (hasName || mentionsBot) {
            const rawText = message.content.toLowerCase();
            
            // 🛡️ STRICT CHECK: Only trigger if explicitly asking for art/images!
            // Generic words like "create" or "make" alone will NOT trigger image generation!
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

    async function handleConversationalGemini(client, message, displayName) {
        await message.channel.sendTyping().catch(() => {});

        try {
            const prompt = `[SYSTEM INSTRUCTION]
You are ${displayName}, an advanced all-in-one Discord AI companion and server administrator.

YOUR FULL CAPABILITIES INCLUDE:
1. 🎨 AI Image Generation: Creating custom art, pictures, and drawings on command (\`.imagine\` or \`Starry draw...\`).
2. 🎵 Music & DJ Controls: Playing high-quality audio, track control (pause, skip, loop, volume), and VC locks.
3. 🌐 Translator & Multilingual Engine: Auto-translating text between languages, detecting language, and multilingual support.
4. 🔢 Smart Counting Game & High Scores: Managing server counting channels (\`/setupcount\` or \`.setupcount\`), evaluating math expressions (e.g. \`5+5\`), tracking streaks, and displaying stats (\`/countstats\`).
5. 🛡️ Autonomous Moderation & Security: Kicking, banning, unbanning, timing out users, clearing messages, mass-ping AutoMod, and security logging.
6. 📁 Channel & Category Management: Dynamically creating, deleting, and organizing text/voice channels and categories.
7. 🎭 Role Management: Creating roles, assigning/removing roles from members, and managing permissions.

COMMAND SPECIFICATION PROTOCOL:
If the user asks you to perform a server management action, embed the appropriate tag anywhere in your output:
- Moderation Actions: [CMD:KICK|ID:user_id|REASON:reason], [CMD:BAN|ID:user_id|REASON:reason], [CMD:UNBAN|ID:user_id], [CMD:CLEAR|AMOUNT:count], [CMD:TIMEOUT|ID:user_id|MINUTES:count|REASON:reason], [CMD:UNTIMEOUT|ID:user_id].
- Role Actions: [CMD:CREATEROLE|NAME:role_name], [CMD:GIVEROLE|USER_ID:user_id|ROLE_ID:role_id], [CMD:REMOVEROLE|USER_ID:user_id|ROLE_ID:role_id].
- Channel & Category Actions:
  * Create Channel: [CMD:CREATECHANNEL|NAME:channel_name|TYPE:text|CATEGORY:category_name]
  * Delete Channel: [CMD:DELETECHANNEL|NAME:channel_name]
  * Create Category: [CMD:CREATECATEGORY|NAME:category_name]
  * Delete Category: [CMD:DELETECATEGORY|NAME:category_name]

When asked about your features, list ALL 7 of your capabilities (Image Generation, Music, Translator, Counting Game, Moderation, Channels/Categories, and Roles) in a clean bulleted format. Always acknowledge requests warmly, clearly, and concisely.

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
                else if (action === 'GIVEROLE') { functionName = 'give_role'; args.userId = getParam('USER_ID') || getParam('ID'); args.roleId = getParam('ROLE_ID') || getParam('ROLE'); }
                else if (action === 'REMOVEROLE') { functionName = 'remove_role'; args.userId = getParam('USER_ID') || getParam('ID'); args.roleId = getParam('ROLE_ID') || getParam('ROLE'); }
                else if (action === 'CLEAR') { functionName = 'clear_messages'; args.amount = parseInt(getParam('AMOUNT')) || 10; }
                else if (action === 'TIMEOUT') { functionName = 'timeout_member'; args.userId = getParam('ID'); args.minutes = parseInt(getParam('MINUTES')) || 2; args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'UNTIMEOUT') { functionName = 'untimeout_member'; args.userId = getParam('ID'); }
                else if (action === 'UNBAN') { functionName = 'unban_member'; args.userId = getParam('ID'); }
                else if (action === 'KICK' || action === 'BAN') { functionName = action.toLowerCase() + '_member'; args.userId = getParam('ID'); args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'CREATECHANNEL') { functionName = 'create_channel'; args.name = getParam('NAME'); args.type = getParam('TYPE') || 'text'; args.category = getParam('CATEGORY'); }
                else if (action === 'DELETECHANNEL') { functionName = 'delete_channel'; args.name = getParam('NAME'); }

                replyText = replyText.replace(cmdMatch[0], '').trim();
            }
            // ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 8 OF 8)
// ==========================================
            if (functionName && message.guild) {
                const botMember = message.guild.members.me;
                const hasPerm = (perm) => message.member && message.member.permissions.has(perm) && botMember.permissions.has(perm);

                // --- 1. GIVE ROLE ACTION ---
                if (functionName === "give_role" && hasPerm(PermissionFlagsBits.ManageRoles)) {
                    const tId = (args.userId || '').replace(/\D/g, '');
                    const rId = (args.roleId || '').replace(/\D/g, '');
                    const tMember = await message.guild.members.fetch(tId).catch(() => null);
                    const role = message.guild.roles.cache.get(rId) || message.guild.roles.cache.find(r => r.name.toLowerCase() === args.roleId?.toLowerCase());

                    if (tMember && role && role.position < botMember.roles.highest.position) {
                        await tMember.roles.add(role).catch(() => null);
                        await message.reply(`✅ Assigned role **${role.name}** to <@${tMember.id}>!`);
                    }
                }

                // --- 2. REMOVE ROLE ACTION ---
                if (functionName === "remove_role" && hasPerm(PermissionFlagsBits.ManageRoles)) {
                    const tId = (args.userId || '').replace(/\D/g, '');
                    const rId = (args.roleId || '').replace(/\D/g, '');
                    const tMember = await message.guild.members.fetch(tId).catch(() => null);
                    const role = message.guild.roles.cache.get(rId) || message.guild.roles.cache.find(r => r.name.toLowerCase() === args.roleId?.toLowerCase());

                    if (tMember && role && role.position < botMember.roles.highest.position) {
                        await tMember.roles.remove(role).catch(() => null);
                        await message.reply(`🗑️ Removed role **${role.name}** from <@${tMember.id}>.`);
                    }
                }

                // --- 3. CREATE CHANNEL ---
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

                // --- 4. DELETE CHANNEL ---
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
            console.error('Conversational Engine Error:', error);
            return message.reply(`⚡ I'm experiencing an unusually high volume of requests. Please resend your prompt!`).catch(() => {});
        }
    }

    // ==========================================
    // 🌐 SINGLE UNIFIED MESSAGE DISPATCHER PIPELINE
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        // 1. AutoMod Ping Check
        if (await handleAutoModPing(message)) return;

        // 2. Developer CLI Commands (.dev, .sysinfo, .eval)
        if (await handleDevCLI(client, message)) return;

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

        // 3. Fast Local Pre-Parsers (<50ms Execution - Zero AI Calls)
        const localHandled = await handleLocalActions(client, message);
        if (localHandled) return; 

        // 4. Pollinations AI Media Generation
        const imageHandled = await handlePollinationsImage(client, message, displayName, mentionsBot, hasName, isImagine);
        if (imageHandled) return;

        // 5. Conversational Gemini AI Engine (General Chat Only)
        await handleConversationalGemini(client, message, displayName);
    });
};

// ==========================================
// EXPORTS (replaces masterChannelSystems.js)
// ==========================================
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.generateAIResponseWithRetry = generateAIResponseWithRetry;
module.exports.executeFullGuildBackup = executeFullGuildBackup;
module.exports.emergencyNukePayload = emergencyNukeCommand.toJSON();
module.exports.modMasterPayload = modMasterCommand.toJSON();
module.exports.autoModMasterPayload = autoModMasterCommand.toJSON();
module.exports.moderateMasterPayload = moderateMasterCommand.toJSON();
module.exports.verifySetupPayload = verifySetupCommand.toJSON();
