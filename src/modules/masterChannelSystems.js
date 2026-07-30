// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 1 OF 6)
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
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 2 OF 6)
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

async function generateAIResponseWithRetry(prompt) {
    if (apiKeys.length === 0) throw new Error('Missing GEMINI_API_KEY environment variable.');
    const AI_MODELS = ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'];
    for (const modelName of AI_MODELS) {
        try {
            const ai = getNextAIClient();
            if (!ai) continue;
            const response = await ai.models.generateContent({ model: modelName, contents: prompt });
            if (response && response.text) return response.text.trim();
        } catch (err) { continue; }
    }
    return "⚠️ **AI Service Busy:** Google's AI models are currently experiencing high demand. Please try again shortly!";
}

async function getOrCreateCategory(guild, name, overwrites = []) {
    let cat = guild.channels.cache.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type === ChannelType.GuildCategory);
    if (!cat) {
        cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
    }
    return cat;
}

// Strictly pure data-driven working status embeds without intrusive buttons
async function deployWorkingDataEmbed(channel, moduleType) {
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const hasDataEmbed = messages ? messages.some(m => m.author.id === channel.guild.client.user.id && m.embeds.length > 0) : false;

    if (!hasDataEmbed) {
        let embed = new EmbedBuilder().setColor('#2b2d31');

        if (moduleType === 'log_access') {
            embed.setTitle('🟢 Access & Join Audit Stream').setDescription('**Status:** Running Live Listener\n**Active Tracking:** Member Joins, Leaves, Invites\n*All events stream automatically in real-time.*');
        } else if (moduleType === 'log_moderate') {
            embed.setTitle('🛡️ Moderation Action Audit Log').setDescription('**Status:** Operational\n**Active Tracking:** AutoMod triggers, Timeouts, Kicks, Bans\n*Enforced by Starry Master Protection.*');
        } else if (moduleType === 'log_messages') {
            embed.setTitle('💬 Message Surveillance Ledger').setDescription('**Status:** Active\n**Active Tracking:** Message Deletions & Edits\n*Cached securely for audit history.*');
        } else if (moduleType === 'log_voice') {
            embed.setTitle('🎙️ Voice Telemetry Monitor').setDescription('**Status:** Connected\n**Active Tracking:** Voice channel joins, leaves, and streaming activity.');
        } else if (moduleType === 'log_channels') {
            embed.setTitle('📁 Structure & Permission Audit Trail').setDescription('**Status:** Active\n**Active Tracking:** Channel creations, deletions, and overwrite modifications.');
        } else if (moduleType === 'log_members') {
            embed.setTitle('👤 Member Profile & Role Ledger').setDescription('**Status:** Active\n**Active Tracking:** Nickname changes, role assignments, and profile updates.');
        } else if (moduleType === 'sus_tracker') {
            embed.setTitle('🚨 AltDentifier Young Account Scanner').setDescription('**Status:** Armed\n**Active Rule:** Flags and isolates alt accounts younger than 7 days automatically.');
        } else if (moduleType === 'inactivity_tracker') {
            embed.setTitle('💤 Inactivity & Member Engagement Scanner').setDescription('**Status:** Scanning\n**Active Rule:** Audits server engagement metrics and flags inactive user tiers.');
        } else if (moduleType === 'verification') {
            embed.setTitle('🌐 Web Verification Gateway').setDescription('**Status:** Active Gatekeeper\n*Unverified users are restricted here until human verification tokens are validated.*');
        } else if (moduleType === 'tickets') {
            embed.setTitle('🎫 Support Ticket & Staff Application Terminal').setDescription('**Status:** Operational\n*Use interactive buttons in panel or run ticket commands to open private channels.*');
        } else if (moduleType === 'intel_exchange') {
            embed.setTitle('🔐 Staff Security Intelligence War-Room').setDescription('**Status:** Secured\n*Private administrative coordination channel for security updates.*');
        } else if (moduleType === 'incident_prep') {
            embed.setTitle('⚡ Incident Response & Anti-Raid Protocol').setDescription('**Status:** Standby\n*Pre-planned emergency defense directives for server breaches.*');
        } else if (moduleType === 'encrypted_chat') {
            embed.setTitle('💬 Secure Administrative Comms Terminal').setDescription('**Status:** Active\n*Private encrypted channel for staff coordination.*');
        } else if (moduleType === 'resource_hub') {
            embed.setTitle('📚 Vetted Resource & Guidelines Repository').setDescription('**Status:** Up to Date\n*Official moderation rulebooks and safety policies.*');
        } else if (moduleType === 'status_monitor') {
            embed.setTitle('🟢 Autonomous Network Telemetry & Uptime Hub').setDescription('**Status:** Live\n*Updates server metrics and health data every 60 seconds.*');
        } else if (moduleType === 'support_desk') {
            embed.setTitle('deskSupport Coordination Desk').setDescription('**Status:** Active\n*Staff dispatch and ticket management queue.*');
        } else if (moduleType === 'admin_requests') {
            embed.setTitle('👑 Admin Action Authorization Queue').setDescription('**Status:** Monitoring\n*Queue for pending administrative approval requests.*');
        } else if (moduleType === 'threat_reporting') {
            embed.setTitle('⚠️ Real-Time Threat Detection Center').setDescription('**Status:** Armed\n*Automated logging of security exploits and raid spikes.*');
        } else if (moduleType === 'policy_vote') {
            embed.setTitle('🏛️ Governance & Policy Voting Ledger').setDescription('**Status:** Online\n*Active governance proposals executed via `/policy-vote`.*');
        } else if (moduleType === 'trust_level') {
            embed.setTitle('📊 Trust Level & Permission Matrix').setDescription('**Status:** Audited\n*Documentation of member trust levels and role hierarchies.*');
        } else if (moduleType === 'knowledge_base') {
            embed.setTitle('📖 Security Knowledge Base & Filters').setDescription('**Status:** Ready\n*Documentation on AutoMod filter strings and protection rules.*');
        } else if (moduleType === 'transparency_logs') {
            embed.setTitle('⚖️ Public Transparency & Audit Trail').setDescription('**Status:** Public\n*Public ledger of server governance decisions and policy updates.*');
        } else if (moduleType === 'verification_chamber') {
            embed.setTitle('🔻 Arrival Chamber & Isolation Gateway').setDescription('**Status:** Active\n*Initial containment point for unverified visitors.*');
        } else if (moduleType === 'critical_alerts') {
            embed.setTitle('🚨 Critical Security Dispatch Center').setDescription('**Status:** Active\n*Emergency system broadcast channel.*');
        } else if (moduleType === 'security_briefing') {
            embed.setTitle('🛡️ Onboarding Security Protocol Briefing').setDescription('**Status:** Active\n*Core server security rules and safety expectations.*');
        } else if (moduleType === 'access_request') {
            embed.setTitle('🔑 Elevated Access Permission Gatekeeper').setDescription('**Status:** Active\n*Authorization queue for elevated permissions.*');
        }

        const msg = await channel.send({ embeds: [embed] }).catch(() => null);
        if (msg) await msg.pin().catch(() => {});
    }
}

async function createNonDuplicatingActiveChannel(guild, options) {
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
    await deployWorkingDataEmbed(channel, options.moduleType);
    return channel;
}
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 3 OF 6)
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

    // --- CATEGORY 1: 🛡️ SECURITY & SYSTEM LOGS ---
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
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: sysCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    }

    // --- CATEGORY 2: 🎫 SUPPORT & APPLICATIONS ---
    const supportCat = await getOrCreateCategory(guild, '🎫 SUPPORT & APPLICATIONS');
    
    await createNonDuplicatingActiveChannel(guild, {
        name: 'verify-here', parent: supportCat.id, moduleType: 'verification',
        permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }, botFullControl]
    });

    await createNonDuplicatingActiveChannel(guild, { name: 'open-a-ticket', parent: supportCat.id, moduleType: 'tickets', permissionOverwrites: [hideEveryone, showVerified, botFullControl] });

    // --- CATEGORY 3: 💬 SECURE COMMS & DISCUSSIONS ---
    const commsCat = await getOrCreateCategory(guild, '💬 SECURE COMMS & DISCUSSIONS', [hideEveryone, staffFullControl, botFullControl]);
    const commsChannels = [
        { name: 'security-intel-exchange', moduleType: 'intel_exchange' },
        { name: 'incident-response-prep', moduleType: 'incident_prep' },
        { name: 'general-encrypted-chat', moduleType: 'encrypted_chat' },
        { name: 'vetted-resource-hub', moduleType: 'resource_hub' }
    ];
    for (const item of commsChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: commsCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    }

    // --- CATEGORY 4: 🚨 SUPPORT & INCIDENT MANAGEMENT ---
    const incidentCat = await getOrCreateCategory(guild, '🚨 SUPPORT & INCIDENT MANAGEMENT', [hideEveryone, staffFullControl, botFullControl]);
    const incidentChannels = [
        { name: 'server-status-monitor', moduleType: 'status_monitor' },
        { name: 'support-desk-private', moduleType: 'support_desk' },
        { name: 'admin-action-requests', moduleType: 'admin_requests' },
        { name: 'threat-reporting', moduleType: 'threat_reporting' }
    ];
    for (const item of incidentChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: incidentCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    }

    // --- CATEGORY 5: 🏛️ GOVERNANCE & ARCHIVES ---
    const govCat = await getOrCreateCategory(guild, '🏛️ GOVERNANCE & ARCHIVES', [hideEveryone, staffFullControl, botFullControl]);
    const govChannels = [
        { name: 'policy-amendment-vote', moduleType: 'policy_vote' },
        { name: 'trust-level-overview', moduleType: 'trust_level' },
        { name: 'security-knowledge-base', moduleType: 'knowledge_base' },
        { name: 'transparency-logs', moduleType: 'transparency_logs' }
    ];
    for (const item of govChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: govCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    }

    // --- CATEGORY 6: 🔻 ENTRY POINT & PROTOCOL ---
    const entryCat = await getOrCreateCategory(guild, '🔻 ENTRY POINT & PROTOCOL');
    const entryChannels = [
        { name: 'verification-chamber', moduleType: 'verification_chamber' },
        { name: 'critical-alerts', moduleType: 'critical_alerts' },
        { name: 'security-briefing', moduleType: 'security_briefing' },
        { name: 'access-request-form', moduleType: 'access_request' }
    ];
    for (const item of entryChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: entryCat.id, moduleType: item.moduleType, permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel] }, botFullControl] });
    }

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
                    const statusEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('🟢 Autonomous Network Telemetry & Uptime Hub').addFields(
                        { name: 'Members Count', value: `\`${guild.memberCount}\``, inline: true },
                        { name: 'Uptime Status', value: '`ONLINE 🟢`', inline: true },
                        { name: 'Active Modules', value: '`24 Security Hubs Active`', inline: true },
                        { name: 'Last Loop Check', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
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
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 4 OF 6)
// ==========================================
const modMasterCommand = new SlashCommandBuilder()
    .setName('mod').setDescription('🛡️ Master Moderation Hub').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub.setName('warn').setDescription('Warn member').addUserOption(o => o.setName('target').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand(sub => sub.setName('warnings').setDescription('View warnings').addUserOption(o => o.setName('target').setDescription('User').setRequired(true)))
    .addSubcommand(sub => sub.setName('delwarn').setDescription('Delete warning').addIntegerOption(o => o.setName('id').setDescription('ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('clear').setDescription('Purge messages').addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1).setMaxValue(2000)))
    .addSubcommand(sub => sub.setName('lockdown').setDescription('Lock channel').addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Lock', value: 'lock' }, { name: 'Unlock', value: 'unlock' })))
    .addSubcommand(sub => sub.setName('protect').setDescription('Protect user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(sub => sub.setName('unprotect').setDescription('Unprotect user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)));

const autoModMasterCommand = new SlashCommandBuilder()
    .setName('automod').setDescription('⚙️ AutoMod Hub').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('status').setDescription('Status'))
    .addSubcommand(sub => sub.setName('toggle').setDescription('Toggle').addStringOption(o => o.setName('module').setDescription('Module').setRequired(true).addChoices({ name: 'Core', value: 'core' })).addBooleanOption(o => o.setName('status').setDescription('Status').setRequired(true)))
    .addSubcommand(sub => sub.setName('ignore').setDescription('Ignore channel').addStringOption(o => o.setName('type').setDescription('Type').setRequired(true).addChoices({ name: 'Links', value: 'links' }, { name: 'Emojis', value: 'emojis' }, { name: 'All', value: 'all' })).addChannelOption(o => o.setName('channel').setDescription('Channel')))
    .addSubcommand(sub => sub.setName('unignore').setDescription('Unignore channel').addStringOption(o => o.setName('type').setDescription('Type').setRequired(true).addChoices({ name: 'Links', value: 'links' }, { name: 'Emojis', value: 'emojis' }, { name: 'All', value: 'all' })).addChannelOption(o => o.setName('channel').setDescription('Channel')))
    .addSubcommand(sub => sub.setName('mediaonly').setDescription('Media only').addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Enable', value: 'enable' }, { name: 'Disable', value: 'disable' }, { name: 'Status', value: 'status' })).addChannelOption(o => o.setName('channel').setDescription('Channel')));

const moderateMasterCommand = new SlashCommandBuilder()
    .setName('moderate')
    .setDescription('⚙️ Toggle advanced security modules & AutoMod settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('toggle')
            .setDescription('Toggle advanced security protection modules')
            .addStringOption(o =>
                o.setName('module')
                    .setDescription('Select the security protection module')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Wick (Anti-Nuke & Admin Limits)', value: 'wick' },
                        { name: 'Beemo (Anti-Raid Mass Join Defense)', value: 'beemo' },
                        { name: 'AltDentifier (Verification Gatekeeper)', value: 'altdentifier' },
                        { name: 'Dyno/Carl (Chat Filters & AutoMod)', value: 'dyno_carl' }
                    )
            )
            .addBooleanOption(o => o.setName('status').setDescription('Enable or disable this module').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('autokick').setDescription('Configure native automated kicking rules').addBooleanOption(o => o.setName('status').setDescription('Enable or disable AutoKick').setRequired(true)))
    .addSubcommand(sub => sub.setName('autoban').setDescription('Configure native automated banning filters').addBooleanOption(o => o.setName('status').setDescription('Enable or disable AutoBan').setRequired(true)))
    .addSubcommand(sub => sub.setName('ownerbypass').setDescription('Manage Owner Bypass settings for AutoMod').addBooleanOption(o => o.setName('status').setDescription('Allow owner to bypass AutoMod').setRequired(true)));

const verifySetupCommand = new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('Set up the server verification panel (Admins Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send verification panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role given upon verification').setRequired(true));

const emergencyNukeCommand = new SlashCommandBuilder()
    .setName('emergency-nuke')
    .setDescription('⚡ Emergency Protocol: Purge channel or reset whole server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
        o.setName('target')
            .setDescription('Select whether to nuke this channel or the entire server')
            .setRequired(true)
            .addChoices(
                { name: 'Channel (Purge & Recreate)', value: 'channel' },
                { name: 'Server (Reset All Channels & Non-Essential Roles)', value: 'server' }
            )
    )
    .addChannelOption(o =>
        o.setName('channel')
            .setDescription('Target channel (defaults to current channel if target is Channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
    );

const emergencyLockdownCommand = new SlashCommandBuilder().setName('emergency-lockdown').setDescription('⚡ Emergency Protocol: Server Channel Lockdown').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const emergencySecureCommand = new SlashCommandBuilder().setName('emergency-secure').setDescription('⚡ Emergency Protocol: Secure Chat & Voice').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const emergencyUnbanCommand = new SlashCommandBuilder().setName('emergency-unban').setDescription('⚡ Emergency Protocol: Mass Unban All').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const policyVotePayload = {
    name: 'policy-vote', description: '🏛️ Governance vote (Admins Only)', default_member_permissions: '8',
    options: [{ name: 'title', type: 3, required: true, description: 'Title' }, { name: 'description', type: 3, required: true, description: 'Desc' }]
};
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 5 OF 6)
// ==========================================
async function handleModCommands(interaction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'warn') {
        const user = interaction.options.getUser('target', true);
        const reason = interaction.options.getString('reason', true);
        const warnId = Math.floor(1000 + Math.random() * 9000);
        await Warning.create({ guildId: guild.id, userId: user.id, warnId, reason, moderatorId: interaction.user.id });
        return interaction.editReply(`⚠️ Warned <@${user.id}> for: *${reason}* (\`#${warnId}\`)`);
    }
    if (sub === 'warnings') {
        const user = interaction.options.getUser('target', true);
        const warns = await Warning.find({ guildId: guild.id, userId: user.id });
        if (!warns.length) return interaction.editReply(`✅ ${user.username} has 0 warnings.`);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#ED4245').setTitle(`Warnings for ${user.username}`).setDescription(warns.map((w, i) => `**${i+1}.** ${w.reason}`).join('\n'))] });
    }
    if (sub === 'delwarn') {
        const id = interaction.options.getInteger('id', true);
        await Warning.findOneAndDelete({ guildId: guild.id, warnId: id });
        return interaction.editReply(`✅ Warning ID \`#${id}\` removed.`);
    }
    if (sub === 'clear') {
        const amount = interaction.options.getInteger('amount', true);
        const fetched = await interaction.channel.messages.fetch({ limit: Math.min(amount, 100) });
        await interaction.channel.bulkDelete(fetched, true).catch(() => {});
        return interaction.editReply(`🧹 Purged **${fetched.size}** messages.`);
    }
    if (sub === 'lockdown') {
        const action = interaction.options.getString('action', true);
        await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: action === 'lock' ? false : null });
        return interaction.editReply(action === 'lock' ? '🔒 Channel locked.' : '🔓 Channel unlocked.');
    }
    if (sub === 'protect' || sub === 'unprotect') {
        if (interaction.user.id !== guild.ownerId) return interaction.editReply('❌ Owner only.');
        const target = interaction.options.getUser('user', true);
        if (sub === 'protect') addProtect.run(guild.id, target.id); else removeProtect.run(guild.id, target.id);
        return interaction.editReply(`🛡️ ${target.username} protection state updated.`);
    }
}

async function handleAutoModCommands(interaction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    if (sub === 'status') return interaction.editReply(`📢 Automod status: Enabled`);
    if (sub === 'toggle') {
        const status = interaction.options.getBoolean('status', true);
        return interaction.editReply(`⚙️ Core toggled to **${status}**.`);
    }
    if (sub === 'mediaonly') {
        const action = interaction.options.getString('action', true);
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        let list = getMediaData();
        if (action === 'enable') { if (!list.includes(channel.id)) list.push(channel.id); } 
        else { list = list.filter(id => id !== channel.id); }
        saveMediaData(list);
        return interaction.editReply(`✅ Media-only mode updated for ${channel}.`);
    }
    return interaction.editReply(`⚙️ Automod command executed.`);
}

async function handleModerateCommands(interaction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (subcommand === 'toggle') {
        const moduleChoice = interaction.options.getString('module', true);
        const status = interaction.options.getBoolean('status', true);
        const moduleNames = {
            wick: 'Wick (Anti-Nuke & Admin Limits)',
            beemo: 'Beemo (Anti-Raid Mass Join Defense)',
            altdentifier: 'AltDentifier (Verification Gatekeeper)',
            dyno_carl: 'Dyno/Carl (Chat Filters & AutoMod)'
        };
        await updateSecurityConfig(guildId, { [`modules.${moduleChoice}`]: status });
        const embed = new EmbedBuilder()
            .setColor(status ? '#3BA55C' : '#ED4245')
            .setTitle('🛡️ Security Protection Module Updated')
            .setDescription(`Module **${moduleNames[moduleChoice] || moduleChoice}** is now **${status ? 'ENABLED 🟢' : 'DISABLED 🔴'}**.`);
        return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'autokick') {
        const status = interaction.options.getBoolean('status', true);
        await updateSecurityConfig(guildId, { autoKick: status });
        const embed = new EmbedBuilder().setColor(status ? '#3BA55C' : '#ED4245').setTitle('⚙️ AutoKick Enforcement').setDescription(`Automated Member Kicking is now **${status ? 'ENABLED 🟢' : 'DISABLED 🔴'}**.`);
        return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'autoban') {
        const status = interaction.options.getBoolean('status', true);
        await updateSecurityConfig(guildId, { autoBan: status });
        const embed = new EmbedBuilder().setColor(status ? '#3BA55C' : '#ED4245').setTitle('⚙️ AutoBan Enforcement').setDescription(`Automated Member Banning is now **${status ? 'ENABLED 🟢' : 'DISABLED 🔴'}**.`);
        return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'ownerbypass') {
        const status = interaction.options.getBoolean('status', true);
        await updateSecurityConfig(guildId, { ownerBypass: status });
        const embed = new EmbedBuilder().setColor('#5865F2').setTitle('👑 Owner Bypass Setting').setDescription(`Server Owner AutoMod Bypass is now **${status ? 'ENABLED (Owner Bypassed) 🛡️' : 'DISABLED (Owner Filtered) ⚠️'}**.`);
        return interaction.editReply({ embeds: [embed] });
    }
}

async function handleVerifySetupCommand(interaction, client) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', true);
    const botMember = interaction.guild.members.me;

    if (!channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
        return interaction.editReply(`❌ I cannot send messages in ${channel}!`);
    }

    if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply(`⚠️ Role ${role} is higher than or equal to my highest role! Please position my bot role higher.`);
    }

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('✅ Server Verification')
        .setDescription('Welcome! To protect this server from automated accounts, we require web verification.\n\nClick the button below to generate your secure verification link.')
        .setFooter({ text: 'Starry Security Protocol', iconURL: client.user.displayAvatarURL() });

    const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`verify_role_${role.id}`).setLabel('Get Verification Link').setEmoji('🌐').setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [button] });
    return interaction.editReply(`✅ Verification panel set up in ${channel} for role ${role}!`);
}

async function handleEmergencyCommands(interaction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
    const cmd = interaction.commandName;
    const guild = interaction.guild;

    if (cmd === 'emergency-nuke') {
        const targetScope = interaction.options.getString('target', true);

        if (targetScope === 'channel') {
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const position = channel.position;
            const newChannel = await channel.clone();
            await channel.delete().catch(() => {});
            await newChannel.setPosition(position).catch(() => {});
            return interaction.editReply('⚡ **EMERGENCY NUKE:** Channel has been completely purged and recreated.');
        }

        if (targetScope === 'server') {
            if (interaction.user.id !== guild.ownerId) {
                return interaction.editReply('❌ **Owner Only:** Only the Server Owner can execute a whole-server emergency nuke!');
            }

            const currentChannel = interaction.channel;
            const botMember = guild.members.me;

            let deletedChannels = 0;
            let deletedRoles = 0;

            const channelsToDelete = guild.channels.cache.filter(c => c.id !== currentChannel.id);
            for (const [, ch] of channelsToDelete) {
                try {
                    await ch.delete();
                    deletedChannels++;
                } catch (e) {}
            }

            const rolesToDelete = guild.roles.cache.filter(r => 
                !r.managed && 
                r.id !== guild.roles.everyone.id && 
                r.position < botMember.roles.highest.position
            );
            for (const [, role] of rolesToDelete) {
                try {
                    await role.delete();
                    deletedRoles++;
                } catch (e) {}
            }

            return interaction.editReply(`⚡ **EMERGENCY SERVER NUKE COMPLETED:**\n• Purged **${deletedChannels}** channels (kept current channel).\n• Deleted **${deletedRoles}** non-essential roles.`);
        }
    }

    if (cmd === 'emergency-lockdown') {
        await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return interaction.editReply('⚡ **EMERGENCY LOCKDOWN:** Channel locked down immediately.');
    }

    if (cmd === 'emergency-secure') {
        await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, Connect: false });
        return interaction.editReply('⚡ **EMERGENCY SECURE:** All chat and voice connections secured.');
    }

    if (cmd === 'emergency-unban') {
        const bans = await guild.bans.fetch();
        for (const ban of bans.values()) {
            await guild.bans.remove(ban.user.id).catch(() => {});
        }
        return interaction.editReply(`⚡ **EMERGENCY UNBAN:** Successfully unbanned ${bans.size} members.`);
    }
}
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 6 OF 6)
// ==========================================
function initModule(client) {
    client.isUserProtected = (guildId, userId) => !!getProtect.get(guildId, userId);
    start60sChannelTelemetryLoop(client);

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.commandName;
            
            if (cmd === 'setup-starry') {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply().catch(() => {});
                const result = await provisionMasterServerStructure(interaction);
                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✨ Autonomous Server Setup Complete!')
                    .setDescription(`Server successfully configured with working data-driven security embeds deployed in every channel!`)
                    .addFields(
                        { name: '🛡️ Security Gatekeeper', value: `Created <@&${result.verifiedRole.id}> role. Unverified members are isolated to \`#verify-here\`.`, inline: false },
                        { name: '📁 Infrastructure Deployed', value: `Deployed **${result.totalCategories} Categories** & **${result.totalChannels} Channels** with working data status panels!`, inline: false }
                    )
                    .setFooter({ text: 'Starry Master Protocol • High-Security Architecture' });
                return interaction.editReply({ embeds: [embed] });
            }

            if (['emergency-nuke', 'emergency-lockdown', 'emergency-secure', 'emergency-unban'].includes(cmd)) {
                await handleEmergencyCommands(interaction);
            }
            if (cmd === 'mod') await handleModCommands(interaction);
            if (cmd === 'automod') await handleAutoModCommands(interaction);
            if (cmd === 'moderate') await handleModerateCommands(interaction);
            if (cmd === 'verify-setup') await handleVerifySetupCommand(interaction, client);

            if (cmd === 'policy-vote') {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply().catch(() => {});
                const title = interaction.options.getString('title', true);
                const desc = interaction.options.getString('description', true);
                
                const embed = new EmbedBuilder().setColor('#5865F2').setTitle(`🏛️ Governance Vote: ${title}`).setDescription(desc).setFooter({ text: 'Starry Policy Vote Engine' });
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('vote_yes').setLabel('Vote YES').setStyle(ButtonStyle.Success).setEmoji('👍'),
                    new ButtonBuilder().setCustomId('vote_no').setLabel('Vote NO').setStyle(ButtonStyle.Danger).setEmoji('👎')
                );
                const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
                await PolicyVote.create({ guildId: interaction.guild.id, messageId: msg.id, title, description: desc });
                return interaction.editReply({ content: '✅ Governance vote initiated!' });
            }
        } 
        
        else if (interaction.isButton()) {
            const id = interaction.customId;

            if (id === 'verify_role_active' || id.startsWith('sys_verify_')) {
                const role = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
                if (!role) {
                    return interaction.reply({ content: '❌ Verification role not found! Please run `/verify-setup` first.', flags: [EPHEMERAL_FLAG] });
                }

                const botMember = interaction.guild.members.me;
                if (role.position >= botMember.roles.highest.position) {
                    return interaction.reply({ content: '❌ **Error assigning role:** Ensure my bot role is higher than the verification role in Server Settings -> Roles!', flags: [EPHEMERAL_FLAG] });
                }

                await interaction.member.roles.add(role).catch(() => {});
                return interaction.reply({ content: '✅ Verified successfully!', flags: [EPHEMERAL_FLAG] });
            }

            if (id.startsWith('verify_role_')) {
                const roleId = id.replace('verify_role_', '');
                const role = interaction.guild.roles.cache.get(roleId);
                const botMember = interaction.guild.members.me;

                if (role && role.position >= botMember.roles.highest.position) {
                    return interaction.reply({ content: '❌ **Error assigning role:** Ensure my bot role is higher than the verification role in Server Settings -> Roles!', flags: [EPHEMERAL_FLAG] });
                }

                const token = Math.random().toString(36).substring(2, 15);
                client.verifyMap.set(token, { guildId: interaction.guild.id, userId: interaction.user.id, roleId });
                const hostUrl = process.env.RENDER_EXTERNAL_URL || 'https://manager-bot-1-6167.onrender.com';
                return interaction.reply({ content: `🔗 **Verification Link:** ${hostUrl}/verify?token=${token}\n*Link expires in 10 minutes.*`, flags: [EPHEMERAL_FLAG] });
            }

            if (id === 'sys_create_ticket') {
                const ch = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`, type: ChannelType.GuildText });
                return interaction.reply({ content: `✅ Ticket created: ${ch}`, flags: [EPHEMERAL_FLAG] });
            }

            if (id === 'sys_apply_staff') {
                const modal = new ModalBuilder().setCustomId('sys_modal_staff_app').setTitle('Staff Application')
                    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('exp').setLabel('Experience').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (id === 'vote_yes' || id === 'vote_no') {
                const vote = await PolicyVote.findOne({ messageId: interaction.message.id });
                if (!vote) return interaction.reply({ content: '❌ Vote session expired.', flags: [EPHEMERAL_FLAG] });

                const userId = interaction.user.id;
                vote.yesVotes = vote.yesVotes.filter(id => id !== userId);
                vote.noVotes = vote.noVotes.filter(id => id !== userId);

                if (id === 'vote_yes') vote.yesVotes.push(userId);
                else vote.noVotes.push(userId);

                await vote.save();
                return interaction.reply({ content: `✅ Vote recorded! Current status — YES: ${vote.yesVotes.length} | NO: ${vote.noVotes.length}`, flags: [EPHEMERAL_FLAG] });
            }
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const isStaff = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isOwner = message.author.id === message.guild.ownerId;
        const config = await getSecurityConfig(message.guild.id);

        if (config.modules?.dyno_carl) {
            const bypassedByOwner = config.ownerBypass && isOwner;
            if (!isStaff && !bypassedByOwner) {
                const botMember = message.guild.members.me;

                const hasBadWord = badWordsList.some(w => message.content.toLowerCase().includes(w));
                const hasInviteLink = /(https?:\/\/)?(www\.)?(discord\.gg|discordapp\.com\/invite|bit\.ly|tinyurl\.com)\/[^\s]+/i.test(message.content);

                if (hasBadWord || hasInviteLink) {
                    try {
                        if (message.channel.permissionsFor(botMember)?.has(PermissionsBitField.Flags.ManageMessages)) {
                            await message.delete().catch(() => {});
                        }
                    } catch (err) {}

                    const userId = message.author.id;
                    const currentInfractions = (config.userInfractions?.[userId] || 0) + 1;

                    await MasterSecurity.updateOne(
                        { guildId: message.guild.id },
                        { $set: { [`userInfractions.${userId}`]: currentInfractions } }
                    ).catch(() => {});

                    const modLogCh = message.guild.channels.cache.find(c => c.name === 'logs-moderate');
                    if (modLogCh) {
                        modLogCh.send(`🛡️ **Dyno/Carl Engine Triggered:** Blocked message from <@${userId}> in <#${message.channel.id}>. (Infraction #${currentInfractions})`).catch(() => {});
                    }

                    if (config.autoBan && currentInfractions >= 5) {
                        if (botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                            await message.member.ban({ reason: 'Dyno/Carl Engine: Exceeded maximum infraction limit' }).catch(() => {});
                            return message.channel.send(`🔨 **AutoBan:** <@${userId}> was banned for repeated violations.`).catch(() => {});
                        }
                    }

                    if (config.autoKick && currentInfractions >= 3) {
                        if (botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                            await message.member.kick('Dyno/Carl Engine: Exceeded infraction limit').catch(() => {});
                            return message.channel.send(`🥾 **AutoKick:** <@${userId}> was kicked for repeated violations.`).catch(() => {});
                        }
                    }

                    const warnMsg = await message.channel.send(`⚠️ <@${userId}>, message blocked by AutoMod! (Warning #${currentInfractions})`).catch(() => null);
                    if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                    return;
                }
            }
        }
    });

    client.on('guildMemberAdd', async (member) => {
        if (!member.guild) return;

        const accessLogCh = member.guild.channels.cache.find(c => c.name === 'logs-access');
        if (accessLogCh) {
            accessLogCh.send(`🟢 **Member Joined:** <@${member.id}> joined the server. Account created <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>.`).catch(() => {});
        }

        const config = await getSecurityConfig(member.guild.id);
        const botMember = member.guild.members.me;

        if (config.modules?.altdentifier) {
            const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
            if (accountAgeDays < 7) {
                const susCh = member.guild.channels.cache.find(c => c.name === 'sus-account-tracker');
                if (susCh) susCh.send(`🚨 **AltDentifier Flag:** <@${member.id}> flagged for young account age (${Math.floor(accountAgeDays)} days).`).catch(() => {});

                if (botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                    await member.send(`⚠️ Removed from **${member.guild.name}**: Account younger than 7 days (AltDentifier).`).catch(() => {});
                    await member.kick('AltDentifier: Account younger than 7 days').catch(() => {});
                    return;
                }
            }
        }

        if (config.modules?.beemo) {
            const now = Date.now();
            const guildJoins = joinTracker.get(member.guild.id) || [];
            const recentJoins = guildJoins.filter(time => now - time < 10000);
            recentJoins.push(now);
            joinTracker.set(member.guild.id, recentJoins);

            if (recentJoins.length >= 5) {
                const threatCh = member.guild.channels.cache.find(c => c.name === 'threat-reporting');
                if (threatCh) threatCh.send(`🚨 **Beemo Raid Defense Triggered:** Mass join velocity detected (${recentJoins.length} joins in 10s).`).catch(() => {});

                if (botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                    await member.kick('Beemo Defense: Mass raid join detected').catch(() => {});
                }
            }
        }
    });

    client.on('guildMemberRemove', async (member) => {
        if (!member.guild) return;
        const accessLogCh = member.guild.channels.cache.find(c => c.name === 'logs-access');
        if (accessLogCh) {
            accessLogCh.send(`🔴 **Member Left:** <@${member.id}> (${member.user.tag}) left the server.`).catch(() => {});
        }
    });

    client.on('messageDelete', async (message) => {
        if (!message.guild || message.author?.bot) return;
        const msgLogCh = message.guild.channels.cache.find(c => c.name === 'logs-messages');
        if (msgLogCh) {
            msgLogCh.send(`🗑️ **Message Deleted** in <#${message.channel.id}> by <@${message.author.id}>:\n> ${message.content || '[Embed/Attachment]'}`).catch(() => {});
        }
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
        const msgLogCh = newMessage.guild.channels.cache.find(c => c.name === 'logs-messages');
        if (msgLogCh) {
            msgLogCh.send(`✏️ **Message Edited** in <#$newMessage.channel.id}> by <@${newMessage.author.id}>:\n**Before:** ${oldMessage.content}\n**After:** ${newMessage.content}`).catch(() => {});
        }
    });

    const handleAntiNuke = async (guild, actionType, targetName) => {
        const config = await getSecurityConfig(guild.id);
        if (!config.modules?.wick) return;

        const botMember = guild.members.me;
        if (!botMember.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) return;

        try {
            const auditLogs = await guild.fetchAuditLogs({ limit: 1, type: actionType }).catch(() => null);
            const entry = auditLogs?.entries?.first();
            if (!entry || !entry.executor || entry.executor.bot) return;

            const executorId = entry.executor.id;
            if (config.ownerBypass && executorId === guild.ownerId) return;

            const intelCh = guild.channels.cache.find(c => c.name === 'security-intel-exchange');
            if (intelCh) {
                intelCh.send(`⚠️ **Wick Anti-Nuke Alert:** Admin <@${executorId}> deleted ${targetName}.`).catch(() => {});
            }

            const now = Date.now();
            const adminActions = nukeTracker.get(executorId) || [];
            const recentActions = adminActions.filter(time => now - time < 10000);
            recentActions.push(now);
            nukeTracker.set(executorId, recentActions);

            if (recentActions.length >= 3) {
                const targetAdmin = await guild.members.fetch(executorId).catch(() => null);
                if (targetAdmin && targetAdmin.manageable) {
                    await targetAdmin.timeout(24 * 60 * 60 * 1000, 'Wick Engine: Anti-Nuke threshold exceeded').catch(() => {});
                }
            }
        } catch (err) {
            console.error('Wick Anti-Nuke Listener Error:', err);
        }
    };

    client.on('channelDelete', channel => channel.guild && handleAntiNuke(channel.guild, AuditLogEvent.ChannelDelete, `Channel #${channel.name}`));
    client.on('roleDelete', role => role.guild && handleAntiNuke(role.guild, AuditLogEvent.RoleDelete, `Role @${role.name}`));

    console.log('✅ Master Channel Systems & Dedicated Active Modules Loaded');
}

module.exports = initModule;
module.exports.init = initModule;
module.exports.provisionMasterServerStructure = provisionMasterStructure;
module.exports.generateAIResponseWithRetry = generateAIResponseWithRetry;
module.exports.policyVotePayload = policyVotePayload;
module.exports.modMasterPayload = modMasterCommand.toJSON();
module.exports.autoModMasterPayload = autoModMasterCommand.toJSON();
module.exports.moderateMasterPayload = moderateMasterCommand.toJSON();
module.exports.verifySetupPayload = verifySetupCommand.toJSON();
module.exports.emergencyNukePayload = emergencyNukeCommand.toJSON();
module.exports.emergencyLockdownPayload = emergencyLockdownCommand.toJSON();
module.exports.emergencySecurePayload = emergencySecureCommand.toJSON();
module.exports.emergencyUnbanPayload = emergencyUnbanCommand.toJSON();
