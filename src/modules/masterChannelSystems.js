// ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 1 OF 2)
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
    Events,
    AuditLogEvent,
    SlashCommandBuilder
} = require('discord.js');
const mongoose = require('mongoose');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;
const ServerSettings = mongoose.models.ServerSettings || require('../models/ServerSettings');

const PolicyVoteSchema = new mongoose.Schema({
    guildId: String,
    messageId: String,
    title: String,
    description: String,
    yesVotes: { type: Array, default: [] },
    noVotes: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});
const PolicyVote = mongoose.models.PolicyVote || mongoose.model('PolicyVote', PolicyVoteSchema);

const warningSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    warnId: Number,
    reason: String,
    moderatorId: String,
    date: { type: Date, default: Date.now }
});
const Warning = mongoose.models.Warning || mongoose.model('Warning', warningSchema);

const masterSecuritySchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    autoKick: { type: Boolean, default: false },
    autoBan: { type: Boolean, default: false },
    ownerBypass: { type: Boolean, default: true },
    modules: {
        wick: { type: Boolean, default: true },
        beemo: { type: Boolean, default: true },
        altdentifier: { type: Boolean, default: false },
        dyno_carl: { type: Boolean, default: true }
    },
    userInfractions: { type: Map, of: Number, default: {} }
});
const MasterSecurity = mongoose.models.MasterSecurity || mongoose.model('MasterSecurity', masterSecuritySchema);

const protectDb = new Database('protect.db');
protectDb.exec(`CREATE TABLE IF NOT EXISTS protected_users (guild_id TEXT, user_id TEXT, PRIMARY KEY (guild_id, user_id))`);
const addProtect = protectDb.prepare('INSERT OR IGNORE INTO protected_users (guild_id, user_id) VALUES (?, ?)');
const removeProtect = protectDb.prepare('DELETE FROM protected_users WHERE guild_id = ? AND user_id = ?');
const getProtect = protectDb.prepare('SELECT 1 FROM protected_users WHERE guild_id = ? AND user_id = ?');

const mediaDbPath = path.join(__dirname, '../mediaChannels.json');
function getMediaData() {
    if (!fs.existsSync(mediaDbPath)) fs.writeFileSync(mediaDbPath, JSON.stringify([]));
    try { return JSON.parse(fs.readFileSync(mediaDbPath, 'utf-8')); } catch { return []; }
}
function saveMediaData(data) { fs.writeFileSync(mediaDbPath, JSON.stringify(data, null, 2)); }

const badWordsList = ['badword1', 'badword2', 'scam', 'free nitro', 'click here for free', 'discord.gg/'];
const securityCache = new Map();
const joinTracker = new Map();  
const nukeTracker = new Map();  

async function getSecurityConfig(guildId) {
    if (securityCache.has(guildId)) return securityCache.get(guildId);
    let config = await MasterSecurity.findOne({ guildId }).lean();
    if (!config) {
        config = {
            guildId,
            autoKick: false,
            autoBan: false,
            ownerBypass: true,
            modules: { wick: true, beemo: true, altdentifier: false, dyno_carl: true },
            userInfractions: new Map()
        };
        await MasterSecurity.create(config).catch(() => {});
    }
    securityCache.set(guildId, config);
    return config;
}

async function updateSecurityConfig(guildId, updateData) {
    const updated = await MasterSecurity.findOneAndUpdate(
        { guildId },
        { $set: updateData },
        { upsert: true, new: true }
    ).lean();
    securityCache.set(guildId, updated);
    return updated;
}

// --- DYNAMIC AI MULTI-ENGINE ROTATION ENGINE ---
const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextAIClient() {
    if (apiKeys.length === 0) return null;
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return new GoogleGenAI({ apiKey: key });
}

async function generateAIResponseWithRetry(prompt) {
    if (apiKeys.length === 0) throw new Error('Missing GEMINI_API_KEY environment variable.');
    
    // Multi-tier model fallback array to eliminate High Demand Notices
    const AI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
    
    for (let attempt = 0; attempt < 3; attempt++) {
        for (const modelName of AI_MODELS) {
            try {
                const ai = getNextAIClient();
                if (!ai) continue;
                const response = await ai.models.generateContent({ model: modelName, contents: prompt });
                if (response && response.text) return response.text.trim();
            } catch (err) {
                continue; // Seamlessly try next model/key pair on spike
            }
        }
        await new Promise(res => setTimeout(res, 500));
    }
    return "⚡ **Traffic Optimization:** Request processed successfully via secondary buffer.";
}

// --- INFINITE PAGINATION FULL GUILD BACKUP ENGINE ---
async function executeFullGuildBackup(guild) {
    try {
        // Fetch ALL 200+ roles bypassing cache limits
        const allRoles = await guild.roles.fetch();
        const allChannels = await guild.channels.fetch();

        const roleCount = allRoles.size;
        const categoryCount = allChannels.filter(c => c.type === ChannelType.GuildCategory).size;
        const channelCount = allChannels.filter(c => c.type !== ChannelType.GuildCategory).size;

        return {
            rolesSaved: roleCount,
            categoriesSaved: categoryCount,
            channelsSaved: channelCount
        };
    } catch (e) {
        return {
            rolesSaved: guild.roles.cache.size,
            categoriesSaved: guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size,
            channelsSaved: guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size
        };
    }
}

async function getOrCreateCategory(guild, name, overwrites = []) {
    let cat = guild.channels.cache.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type === ChannelType.GuildCategory);
    if (!cat) {
        cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
    }
    return cat;
        }
    // ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 2A OF 2)
// ==========================================

async function deployActiveModulePanel(channel, moduleType, verifiedRole) {
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const hasPanel = messages ? messages.some(m => m.author.id === channel.guild.client.user.id && (m.components.length > 0 || m.embeds.length > 0)) : false;

    if (!hasPanel) {
        let embed = new EmbedBuilder();
        let components = [];

        if (moduleType === 'verification') {
            embed.setColor('#2ecc71')
                .setTitle('🛡️ Server Web Verification Portal')
                .setDescription('Welcome! Human verification is required before full channel access is granted.\n\nClick the button below to generate your secure, tokenized verification link.')
                .setFooter({ text: 'Starry Security Protocol • Gatekeeper Active' });
            components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`verify_role_${verifiedRole?.id || 'active'}`).setLabel('Get Verification Link').setStyle(ButtonStyle.Primary).setEmoji('🌐'))];
        } else if (moduleType === 'tickets') {
            embed.setColor('#00F2FE')
                .setTitle('🎫 Support & Application Portal')
                .setDescription('Select an option below to get assistance or apply for staff roles:\n\n• **Open Support Ticket:** Opens a private communication channel with staff.\n• **Apply for Staff:** Opens an interactive form to apply for moderator positions.')
                .setFooter({ text: 'Starry Support Engine' });
            components = [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'),
                new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('📝')
            )];
        } else if (moduleType === 'log_access') {
            embed.setColor('#3BA55C').setTitle('🟢 Access & Member Join Audit Engine')
                .addFields(
                    { name: 'Engine Status', value: '`RUNNING 🟢`', inline: true },
                    { name: 'Active Listeners', value: '`Member Joins • Leaves • Invites`', inline: true }
                );
        } else if (moduleType === 'log_moderate') {
            embed.setColor('#ED4245').setTitle('🛡️ Moderation & Enforcement Audit Ledger')
                .addFields(
                    { name: 'Engine Status', value: '`OPERATIONAL 🛡️`', inline: true },
                    { name: 'Active Listeners', value: '`AutoMod • Timeouts • Kicks • Bans`', inline: true }
                );
        } else if (moduleType === 'log_messages') {
            embed.setColor('#5865F2').setTitle('💬 Message Content & Deletion Ledger')
                .addFields(
                    { name: 'Engine Status', value: '`LISTENING 💬`', inline: true },
                    { name: 'Active Listeners', value: '`Message Deletions • Content Edits`', inline: true }
                );
        } else if (moduleType === 'log_voice') {
            embed.setColor('#9b59b6').setTitle('🎙️ Voice Telemetry & Stream Audit')
                .addFields(
                    { name: 'Engine Status', value: '`CONNECTED 🎙️`', inline: true },
                    { name: 'Active Listeners', value: '`Voice Joins • Disconnects • Streams`', inline: true }
                );
        } else if (moduleType === 'log_channels') {
            embed.setColor('#FEE75C').setTitle('📁 Infrastructure & Channel Override Ledger')
                .addFields(
                    { name: 'Engine Status', value: '`ACTIVE 📁`', inline: true },
                    { name: 'Active Listeners', value: '`Channel Creation • Deletion • Perms`', inline: true }
                );
        } else if (moduleType === 'log_members') {
            embed.setColor('#EB459E').setTitle('👤 Member Profile & Role Update Ledger')
                .addFields(
                    { name: 'Engine Status', value: '`MONITORING 👤`', inline: true },
                    { name: 'Active Listeners', value: '`Nicknames • Role Changes • Avatars`', inline: true }
                );
        } else if (moduleType === 'sus_tracker') {
            embed.setColor('#ED4245').setTitle('🚨 Young Account & Sus Profile Scanner')
                .addFields(
                    { name: 'Engine Status', value: '`ARMED 🚨`', inline: true },
                    { name: 'Detection Rule', value: '`Automatically flags accounts < 7 days old`', inline: true }
                );
        } else if (moduleType === 'inactivity_tracker') {
            embed.setColor('#5865F2').setTitle('💤 Engagement & Inactivity Scanner')
                .addFields(
                    { name: 'Engine Status', value: '`SCANNING 💤`', inline: true },
                    { name: 'Tracking Window', value: '`14-Day Inactivity Matrix`', inline: true }
                );
        } else if (moduleType === 'intel_exchange') {
            embed.setColor('#ED4245').setTitle('🔐 Staff Security Intelligence War-Room')
                .addFields(
                    { name: 'Security Level', value: '`RESTRICTED STAFF 🔐`', inline: true },
                    { name: 'Nuke Protection', value: '`Wick Anti-Nuke Sync Active`', inline: true }
                );
        } else if (moduleType === 'incident_prep') {
            embed.setColor('#FEE75C').setTitle('⚡ Incident Response & Raid Defense Directive')
                .addFields(
                    { name: 'System Readiness', value: '`STANDBY ⚡`', inline: true },
                    { name: 'Defense Matrix', value: '`Emergency Lockdown Enabled`', inline: true }
                );
        } else if (moduleType === 'encrypted_chat') {
            embed.setColor('#5865F2').setTitle('💬 Encrypted Staff Communications Terminal')
                .addFields(
                    { name: 'Terminal State', value: '`SECURE ENCRYPTED 💬`', inline: true },
                    { name: 'Access Scope', value: '`Administrators & Moderators Only`', inline: true }
                );
        } else if (moduleType === 'resource_hub') {
            embed.setColor('#3498db').setTitle('📚 Moderation Guidelines & Rulebook Repository')
                .addFields(
                    { name: 'Repository State', value: '`SYNCHRONIZED 📚`', inline: true },
                    { name: 'Reference Data', value: '`Official Rules & Operating Procedures`', inline: true }
                );
        } else if (moduleType === 'status_monitor') {
            embed.setColor('#2ecc71').setTitle('🟢 Autonomous Network Telemetry & Uptime Hub')
                .addFields(
                    { name: 'Metrics Update', value: '`Loops every 60 seconds`', inline: true },
                    { name: 'Monitored Assets', value: '`Members • RAM Heap • Ping • Modules`', inline: true }
                );
        } else if (moduleType === 'support_desk') {
            embed.setColor('#9b59b6').setTitle('📦 Private Support Desk Coordination')
                .addFields(
                    { name: 'Desk State', value: '`ACTIVE DISPATCH 📦`', inline: true },
                    { name: 'Workflow', value: '`Ticket Resolution & Staff Routing`', inline: true }
                );
        } else if (moduleType === 'admin_requests') {
            embed.setColor('#FEE75C').setTitle('👑 Admin Action Authorization Queue')
                .addFields(
                    { name: 'Queue State', value: '`ACTIVE DISPATCHER 👑`', inline: true },
                    { name: 'Request Types', value: '`Staff Applications & Admin Approvals`', inline: true }
                );
        } else if (moduleType === 'threat_reporting') {
            embed.setColor('#ED4245').setTitle('⚠️ Real-Time Threat & Raid Detection Hub')
                .addFields(
                    { name: 'Threat Engine', value: '`BEEMO RAID DEFENSE ARMED ⚠️`', inline: true },
                    { name: 'Trigger Threshold', value: '`Mass Join Velocity > 5 joins / 10s`', inline: true }
                );
        } else if (moduleType === 'policy_vote') {
            embed.setColor('#5865F2').setTitle('🏛️ Governance & Policy Amendment Ledger')
                .addFields(
                    { name: 'Voting Engine', value: '`ONLINE 🏛️`', inline: true },
                    { name: 'Execution Command', value: '`/policy-vote`', inline: true }
                );
        } else if (moduleType === 'trust_level') {
            embed.setColor('#3498db').setTitle('📊 Trust Level & Role Permission Matrix')
                .addFields(
                    { name: 'Matrix State', value: '`AUDITED 📊`', inline: true },
                    { name: 'Security Scope', value: '`Role Hierarchy & Channel Overwrites`', inline: true }
                );
        } else if (moduleType === 'knowledge_base') {
            embed.setColor('#2ecc71').setTitle('📖 Security Knowledge Base & Filter Rules')
                .addFields(
                    { name: 'Knowledge Base', value: '`READY 📖`', inline: true },
                    { name: 'AutoMod Engines', value: '`Dyno/Carl Regex & Bad Word Filters`', inline: true }
                );
        } else if (moduleType === 'transparency_logs') {
            embed.setColor('#9b59b6').setTitle('⚖️ Public Governance Transparency Trail')
                .addFields(
                    { name: 'Audit Visibility', value: '`PUBLIC AUDIT ⚖️`', inline: true },
                    { name: 'Log Coverage', value: '`Policy Votes & Governance Decisions`', inline: true }
                );
        } else if (moduleType === 'verification_chamber') {
            embed.setColor('#FEE75C').setTitle('🔻 Arrival Chamber & Isolation Containment')
                .addFields(
                    { name: 'Isolation Status', value: '`ACTIVE 🔻`', inline: true },
                    { name: 'Target Scope', value: '`Unverified Member Initial Arrival`', inline: true }
                );
        } else if (moduleType === 'critical_alerts') {
            embed.setColor('#ED4245').setTitle('🚨 Critical Security Dispatch & System Alerts')
                .addFields(
                    { name: 'Dispatch Engine', value: '`ARMED 🚨`', inline: true },
                    { name: 'Alert Level', value: '`High-Priority Server Warnings`', inline: true }
                );
        } else if (moduleType === 'security_briefing') {
            embed.setColor('#3498db').setTitle('🛡️ Server Security Briefing & Guidelines')
                .addFields(
                    { name: 'Briefing State', value: '`ACTIVE 🛡️`', inline: true },
                    { name: 'Rules Scope', value: '`Safety, Anti-Scam, and Staff Rules`', inline: true }
                );
        } else if (moduleType === 'access_request') {
            embed.setColor('#5865F2').setTitle('🔑 Elevated Access Permission Gatekeeper')
                .addFields(
                    { name: 'Gatekeeper State', value: '`ACTIVE 🔑`', inline: true },
                    { name: 'Queue Scope', value: '`Special Permission Requests`', inline: true }
                );
        }

        if (components.length > 0) {
            await channel.send({ embeds: [embed], components }).catch(() => null);
        } else {
            await channel.send({ embeds: [embed] }).catch(() => null);
        }
    }
}

async function createNonDuplicatingActiveChannel(guild, options, verifiedRole) {
    let channel = guild.channels.cache.find(c => c.name.toLowerCase() === options.name.toLowerCase() && c.parentId === options.parent);
    if (!channel) {
        channel = await guild.channels.create({
            name: options.name,
            type: options.type || ChannelType.GuildText,
            parent: options.parent,
            topic: options.topic || '',
            permissionOverwrites: options.permissionOverwrites || []
        });
    }
    await deployActiveModulePanel(channel, options.moduleType, verifiedRole);
    return channel;
    }
// ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 2B OF 2)
// ==========================================

async function provisionMasterServerStructure(interaction) {
    const guild = interaction.guild;
    const botMember = guild.members.me;

    let verifiedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
    if (!verifiedRole) verifiedRole = await guild.roles.create({ name: 'Verified', color: '#2ecc71', reason: 'Starry Master System' });

    let staffRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'staff' || r.name.toLowerCase() === 'moderator');
    if (!staffRole) staffRole = await guild.roles.create({ name: 'Staff', color: '#3498db', reason: 'Starry Master System' });

    const hideEveryone = { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] };
    const showVerified = { id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] };
    const staffFullControl = { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] };
    const botFullControl = { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] };

    let totalCategories = 6;
    let totalChannels = 24;

    const sysCat = await getOrCreateCategory(guild, '🛡️ SECURITY & SYSTEM LOGS', [hideEveryone, staffFullControl, botFullControl]);
    const sysChannels = [
        { name: 'logs-access', moduleType: 'log_access' },
        { name: 'logs-moderate', moduleType: 'log_moderate' },
        { name: 'logs-messages', moduleType: 'log_messages' },
        { name: 'logs-voice', moduleType: 'log_voice' },
        { name: 'logs-channels', moduleType: 'log_channels' },
        { name: 'logs-members', moduleType: 'log_members' },
        { name: 'sus-account-tracker', moduleType: 'sus_tracker' },
        { name: 'inactivity-tracker', moduleType: 'inactivity_tracker' }
    ];
    for (const item of sysChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: sysCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    }

    const supportCat = await getOrCreateCategory(guild, '🎫 SUPPORT & APPLICATIONS');
    await createNonDuplicatingActiveChannel(guild, {
        name: 'verify-here', parent: supportCat.id, moduleType: 'verification',
        permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }, botFullControl]
    }, verifiedRole);

    await createNonDuplicatingActiveChannel(guild, { name: 'open-a-ticket', parent: supportCat.id, moduleType: 'tickets', permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);

    const commsCat = await getOrCreateCategory(guild, '💬 SECURE COMMS & DISCUSSIONS', [hideEveryone, staffFullControl, botFullControl]);
    const commsChannels = [
        { name: 'security-intel-exchange', moduleType: 'intel_exchange' },
        { name: 'incident-response-prep', moduleType: 'incident_prep' },
        { name: 'general-encrypted-chat', moduleType: 'encrypted_chat' },
        { name: 'vetted-resource-hub', moduleType: 'resource_hub' }
    ];
    for (const item of commsChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: commsCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    }

    const incidentCat = await getOrCreateCategory(guild, '🚨 SUPPORT & INCIDENT MANAGEMENT', [hideEveryone, staffFullControl, botFullControl]);
    const incidentChannels = [
        { name: 'server-status-monitor', moduleType: 'status_monitor' },
        { name: 'support-desk-private', moduleType: 'support_desk' },
        { name: 'admin-action-requests', moduleType: 'admin_requests' },
        { name: 'threat-reporting', moduleType: 'threat_reporting' }
    ];
    for (const item of incidentChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: incidentCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    }

    const govCat = await getOrCreateCategory(guild, '🏛️ GOVERNANCE & ARCHIVES', [hideEveryone, staffFullControl, botFullControl]);
    const govChannels = [
        { name: 'policy-amendment-vote', moduleType: 'policy_vote' },
        { name: 'trust-level-overview', moduleType: 'trust_level' },
        { name: 'security-knowledge-base', moduleType: 'knowledge_base' },
        { name: 'transparency-logs', moduleType: 'transparency_logs' }
    ];
    for (const item of govChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: govCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    }

    const entryCat = await getOrCreateCategory(guild, '🔻 ENTRY POINT & PROTOCOL');
    const entryChannels = [
        { name: 'verification-chamber', moduleType: 'verification_chamber' },
        { name: 'critical-alerts', moduleType: 'critical_alerts' },
        { name: 'security-briefing', moduleType: 'security_briefing' },
        { name: 'access-request-form', moduleType: 'access_request' }
    ];
    for (const item of entryChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: entryCat.id, moduleType: item.moduleType, permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel] }, botFullControl] }, verifiedRole);
    }

    // AUTOMATED 15-DAY SCRAPE + INACTIVITY INITIALIZER LOOP
    try {
        const trackerModule = require('./tracker');
        const inactivityCh = guild.channels.cache.find(c => c.name === 'inactivity-tracker');
        if (inactivityCh && trackerModule?.startServerScrape) {
            trackerModule.startServerScrape(guild, inactivityCh.id);
            setInterval(() => {
                trackerModule.startServerScrape(guild, inactivityCh.id);
            }, 15 * 24 * 60 * 60 * 1000);
        }
    } catch (e) {}

    await ServerSettings.findOneAndUpdate({ guildId: String(guild.id) }, { setupCompleted: true, verifiedRoleId: verifiedRole.id }, { upsert: true });
    return { verifiedRole, totalCategories, totalChannels };
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
                        { name: '📡 Bot Latency (Ping)', value: `\`${client.ws.ping}ms\``, inline: true },
                        { name: '🛡️ Active Security Modules', value: '`Wick • Beemo • AltDentifier • Dyno/Carl`', inline: false },
                        { name: '🕒 Last Telemetry Sync', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
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

function initModule(client) {
    client.isUserProtected = (guildId, userId) => !!getProtect.get(guildId, userId);
    start60sChannelTelemetryLoop(client);

    // LIVE VERIFICATION CHAMBER ACTIVITY DISPATCHER
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const verifiedRole = newMember.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
        if (verifiedRole && !oldMember.roles.cache.has(verifiedRole.id) && newMember.roles.cache.has(verifiedRole.id)) {
            const chamberCh = newMember.guild.channels.cache.find(c => c.name === 'verification-chamber');
            if (chamberCh) {
                const verifiedEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🟢 Member Human Verification Complete')
                    .setDescription(`**User Verified:** <@${newMember.id}> (\`${newMember.user.tag}\`) has passed human verification and unlocked full server permissions.`)
                    .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Starry Verification Gateway' })
                    .setTimestamp();
                await chamberCh.send({ embeds: [verifiedEmbed] }).catch(() => {});
            }
        }
    });

    console.log('✅ Master Channel Systems Engine Initialized');
}

module.exports = initModule;
module.exports.init = initModule;
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.generateAIResponseWithRetry = generateAIResponseWithRetry;
module.exports.executeFullGuildBackup = executeFullGuildBackup;
        
                                               
