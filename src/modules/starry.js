// ==========================================
// 🧠 STARRY SUPREME UNIFIED ENGINE (PART 1 OF 8)
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

// Safely Require Mongoose Models
let ServerSettings, ChestChannel, BoostChannel, MasterSecurity, PolicyVote;
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
// ==========================================
// 🧠 STARRY SUPREME UNIFIED ENGINE (PART 2 OF 8)
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
// 🧠 STARRY SUPREME UNIFIED ENGINE (PART 3 OF 8)
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
// 🧠 STARRY SUPREME UNIFIED ENGINE (PART 4 OF 8)
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
    // 🛡️ FAIL-SAFE PREVENT MULTIPLE REGISTRATIONS ON THE SAME CLIENT
    if (client.starryEngineInitialized) {
        console.log('⚠️ Starry Engine already initialized. Skipping duplicate registration.');
        return;
    }
    client.starryEngineInitialized = true;

    console.log('🚀 Supreme Starry Unified Engine Active (Single Pipeline & Merged Master System Capabilities)');

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
    };
    // ==========================================
// 🧠 STARRY SUPREME UNIFIED ENGINE (PART 5 OF 8)
// ==========================================
    // UI & Slash Command Listener
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton() && ['music_pause', 'music_skip', 'music_stop', 'music_loop', 'dj_vol_down', 'dj_vol_up', 'dj_lock', 'dj_unlock'].includes(interaction.customId)) {
            const guild = interaction.guild;
            if (!guild) return;
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
            .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
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
    // ==========================================
// 🧠 STARRY SUPREME UNIFIED ENGINE (PART 6 OF 8)
// ==========================================
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

        // 2. DELETE CATEGORY DIRECTLY
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
// 🧠 STARRY SUPREME UNIFIED ENGINE (PART 7 OF 8)
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
// 🧠 STARRY SUPREME UNIFIED ENGINE (PART 8 OF 8)
// ==========================================

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
        if (localHandled) return; // Action handled locally! Stop execution immediately!

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
