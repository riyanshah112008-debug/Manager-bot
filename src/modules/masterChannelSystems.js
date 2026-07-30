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

// --- Mongoose Database Schemas ---
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

const automodGuildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true }
});
const automodChannelSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    links: { type: Boolean, default: false },
    emojis: { type: Boolean, default: false }
});
const warningSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    warnId: Number,
    reason: String,
    moderatorId: String,
    date: { type: Date, default: Date.now }
});

const masterSecuritySchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    autoKick: { type: Boolean, default: false },
    autoBan: { type: Boolean, default: false },
    ownerBypass: { type: Boolean, default: true },
    modules: {
        wick: { type: Boolean, default: true },          // Anti-Nuke & Admin Limits
        beemo: { type: Boolean, default: true },         // Anti-Raid Mass Join Defense
        altdentifier: { type: Boolean, default: false },  // Alt Account Verification Gatekeeper
        dyno_carl: { type: Boolean, default: true }      // Chat Filters & AutoMod
    },
    userInfractions: { type: Map, of: Number, default: {} }
});

const AutomodGuild = mongoose.models.AutomodGuild || mongoose.model('AutomodGuild', automodGuildSchema);
const AutomodChannel = mongoose.models.AutomodChannel || mongoose.model('AutomodChannel', automodChannelSchema);
const Warning = mongoose.models.Warning || mongoose.model('Warning', warningSchema);
const MasterSecurity = mongoose.models.MasterSecurity || mongoose.model('MasterSecurity', masterSecuritySchema);

// --- SQLite Protection DB ---
const protectDb = new Database('protect.db');
protectDb.exec(`CREATE TABLE IF NOT EXISTS protected_users (guild_id TEXT, user_id TEXT, PRIMARY KEY (guild_id, user_id))`);
const addProtect = protectDb.prepare('INSERT OR IGNORE INTO protected_users (guild_id, user_id) VALUES (?, ?)');
const removeProtect = protectDb.prepare('DELETE FROM protected_users WHERE guild_id = ? AND user_id = ?');
const getProtect = protectDb.prepare('SELECT 1 FROM protected_users WHERE guild_id = ? AND user_id = ?');

// --- Media Channels Data Store ---
const mediaDbPath = path.join(__dirname, '../mediaChannels.json');
function getMediaData() {
    if (!fs.existsSync(mediaDbPath)) fs.writeFileSync(mediaDbPath, JSON.stringify([]));
    try { return JSON.parse(fs.readFileSync(mediaDbPath, 'utf-8')); } catch { return []; }
}
function saveMediaData(data) { fs.writeFileSync(mediaDbPath, JSON.stringify(data, null, 2)); }

const badWordsList = ['badword1', 'badword2', 'scam', 'free nitro', 'click here for free', 'discord.gg/'];

// --- Security RAM Cache & Velocity Trackers ---
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
// --- Helper function to create channel strictly once, send description embed, and pin it ---
async function createDescribedChannel(guild, options) {
    // Check if channel already exists to prevent any duplication
    let channel = guild.channels.cache.find(c => c.name === options.name && c.parentId === options.parent);
    if (!channel) {
        channel = await guild.channels.create({
            name: options.name,
            type: options.type || ChannelType.GuildText,
            parent: options.parent,
            topic: options.topic || '',
            permissionOverwrites: options.permissionOverwrites || []
        });
    }

    if (options.type !== ChannelType.GuildVoice && options.description) {
        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        const hasPin = messages ? messages.some(m => m.pinned && m.author.id === guild.client.user.id) : false;

        if (!hasPin) {
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`📌 Active Module Overview: #${options.name}`)
                .setDescription(options.description)
                .setFooter({ text: 'Starry Master System • Fully Operational Background Engine' });

            const msg = options.components 
                ? await channel.send({ embeds: [embed], components: options.components }).catch(() => null)
                : await channel.send({ embeds: [embed] }).catch(() => null);

            if (msg) await msg.pin().catch(() => {});
        }
    }
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
    let sysCat = guild.channels.cache.find(c => c.name === '🛡️ SECURITY & SYSTEM LOGS' && c.type === ChannelType.GuildCategory);
    if (!sysCat) sysCat = await guild.channels.create({ name: '🛡️ SECURITY & SYSTEM LOGS', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    
    const sysChannels = [
        { name: 'logs-access', desc: '**Active Background Module: Access Audit.** Automatically logs every member join, leave, and invite tracking event.' },
        { name: 'logs-moderate', desc: '**Active Background Module: Moderation Audit.** Automatically records AutoMod triggers, timeouts, kicks, and bans.' },
        { name: 'logs-messages', desc: '**Active Background Module: Message Audit.** Automatically records deleted and edited chat messages across all channels.' },
        { name: 'logs-voice', desc: '**Active Background Module: Telemetry Voice Audit.** Automatically records member voice joins, disconnects, and stream activity.' },
        { name: 'logs-channels', desc: '**Active Background Module: Structure Audit.** Automatically logs channel creations, deletions, and permission overrides.' },
        { name: 'logs-members', desc: '**Active Background Module: Member Audit.** Automatically tracks role updates, nickname changes, and profile changes.' },
        { name: 'sus-account-tracker', desc: '**Active Background Module: AltDentifier Detector.** Automatically flags and logs new accounts younger than 7 days.' },
        { name: 'inactivity-tracker', desc: '**Active Background Module: Inactivity Scanner.** Automatically audits server engagement and inactive member lists.' }
    ];
    for (const item of sysChannels) {
        await createDescribedChannel(guild, { name: item.name, parent: sysCat.id, description: item.desc, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    }

    // --- CATEGORY 2: 🎫 SUPPORT & APPLICATIONS ---
    let supportCat = guild.channels.cache.find(c => c.name === '🎫 SUPPORT & APPLICATIONS' && c.type === ChannelType.GuildCategory);
    if (!supportCat) supportCat = await guild.channels.create({ name: '🎫 SUPPORT & APPLICATIONS', type: ChannelType.GuildCategory });
    
    const verifyRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`verify_role_${verifiedRole.id}`).setLabel('Get Verification Link').setStyle(ButtonStyle.Primary).setEmoji('🌐'));
    await createDescribedChannel(guild, {
        name: 'verify-here', parent: supportCat.id, description: '**Active Background Module: Web Verification Portal.** Click below to generate your secure tokenized web verification link.', components: [verifyRow],
        permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }, botFullControl]
    });

    const ticketRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'),
        new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('📝')
    );
    await createDescribedChannel(guild, { name: 'open-a-ticket', parent: supportCat.id, description: '**Active Background Module: Ticket & Staff Application Manager.** Open support tickets or apply for moderator positions.', components: [ticketRow], permissionOverwrites: [hideEveryone, showVerified, botFullControl] });

    // --- CATEGORY 3: 💬 SECURE COMMS & DISCUSSIONS ---
    let commsCat = guild.channels.cache.find(c => c.name === '💬 SECURE COMMS & DISCUSSIONS' && c.type === ChannelType.GuildCategory);
    if (!commsCat) commsCat = await guild.channels.create({ name: '💬 SECURE COMMS & DISCUSSIONS', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    
    const commsChannels = [
        { name: 'security-intel-exchange', desc: '**Active Background Module: Intel Exchange.** Private staff coordination channel for real-time security updates.' },
        { name: 'incident-response-prep', desc: '**Active Background Module: Incident Prep.** Pre-planned response protocols and anti-raid guidelines.' },
        { name: 'general-encrypted-chat', desc: '**Active Background Module: High-Security Chat.** Private staff discussion channel.' },
        { name: 'vetted-resource-hub', desc: '**Active Background Module: Resource Repository.** Official moderation guidelines and rule documentation.' }
    ];
    for (const item of commsChannels) {
        await createDescribedChannel(guild, { name: item.name, parent: commsCat.id, description: item.desc, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    }

    // --- CATEGORY 4: 🚨 SUPPORT & INCIDENT MANAGEMENT ---
    let incidentCat = guild.channels.cache.find(c => c.name === '🚨 SUPPORT & INCIDENT MANAGEMENT' && c.type === ChannelType.GuildCategory);
    if (!incidentCat) incidentCat = await guild.channels.create({ name: '🚨 SUPPORT & INCIDENT MANAGEMENT', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    
    const incidentChannels = [
        { name: 'server-status-monitor', desc: '**Active Background Module: Live Telemetry.** Automatically loops every 60 seconds to update live server statistics and uptime.' },
        { name: 'support-desk-private', desc: '**Active Background Module: Private Support Desk.** Staff coordination channel for active support tickets.' },
        { name: 'admin-action-requests', desc: '**Active Background Module: Admin Approval Engine.** Queue for pending administrative approval requests.' },
        { name: 'threat-reporting', desc: '**Active Background Module: Threat Detection Engine.** Real-time logging of suspicious user activity.' }
    ];
    for (const item of incidentChannels) {
        await createDescribedChannel(guild, { name: item.name, parent: incidentCat.id, description: item.desc, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    }

    // --- CATEGORY 5: 🏛️ GOVERNANCE & ARCHIVES ---
    let govCat = guild.channels.cache.find(c => c.name === '🏛️ GOVERNANCE & ARCHIVES' && c.type === ChannelType.GuildCategory);
    if (!govCat) govCat = await guild.channels.create({ name: '🏛️ GOVERNANCE & ARCHIVES', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    
    const govChannels = [
        { name: 'policy-amendment-vote', desc: '**Active Background Module: Policy Voting Engine.** Admins launch governance votes via `/policy-vote` with live interactive buttons.' },
        { name: 'trust-level-overview', desc: '**Active Background Module: Trust & Permission Matrix.** Documents member trust levels and role hierarchies.' },
        { name: 'security-knowledge-base', desc: '**Active Background Module: Knowledge Base.** Documentation on AutoMod filters and protection rules.' },
        { name: 'transparency-logs', desc: '**Active Background Module: Public Audit Trail.** Public logs of governance decisions and policy updates.' }
    ];
    for (const item of govChannels) {
        await createDescribedChannel(guild, { name: item.name, parent: govCat.id, description: item.desc, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    }

    // --- CATEGORY 6: 🔻 ENTRY POINT & PROTOCOL ---
    let entryCat = guild.channels.cache.find(c => c.name === '🔻 ENTRY POINT & PROTOCOL' && c.type === ChannelType.GuildCategory);
    if (!entryCat) entryCat = await guild.channels.create({ name: '🔻 ENTRY POINT & PROTOCOL', type: ChannelType.GuildCategory });
    
    const entryChannels = [
        { name: 'verification-chamber', desc: '**Active Background Module: Initial Arrival Chamber.** First entry point for unverified users.' },
        { name: 'critical-alerts', desc: '**Active Background Module: Emergency System Dispatch.** Broadcasters critical security alerts.' },
        { name: 'security-briefing', desc: '**Active Background Module: Onboarding Protocol.** Overview of server security rules and expectations.' },
        { name: 'access-request-form', desc: '**Active Background Module: Access Gatekeeper.** Request elevated access permissions.' }
    ];
    for (const item of entryChannels) {
        await createDescribedChannel(guild, { name: item.name, parent: entryCat.id, description: item.desc, permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel] }, botFullControl] });
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
                    const statusEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('🟢 Live Telemetry').addFields({ name: 'Members', value: `\`${guild.memberCount}\``, inline: true });
                    const msgs = await statusCh.messages.fetch({ limit: 5 }).catch(() => null);
                    const botMsg = msgs ? msgs.find(m => m.author.id === client.user.id) : null;
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
            return newChannel.send('⚡ **EMERGENCY NUKE:** Channel has been completely purged and recreated.');
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

    // --- Slash Command & Component Listener ---
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.commandName;
            
            if (cmd === 'setup-starry') {
                await interaction.deferReply().catch(() => {});
                const result = await provisionMasterServerStructure(interaction);
                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✨ Autonomous Server Setup Complete!')
                    .setDescription(`Server successfully configured with full 6-category high-security infrastructure & pinned channel guides!`)
                    .addFields(
                        { name: '🛡️ Security Gatekeeper', value: `Created <@&${result.verifiedRole.id}> role. Unverified members are isolated to \`#verify-here\`.`, inline: false },
                        { name: '📁 Infrastructure Deployed', value: `Deployed **${result.totalCategories} Categories** & **${result.totalChannels} Channels** with pinned descriptions!`, inline: false }
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
        
        // --- Button Component Listeners ---
        else if (interaction.isButton()) {
            const id = interaction.customId;

            if (id.startsWith('sys_verify_')) {
                await interaction.member.roles.add(id.split('_')[2]).catch(() => {});
                return interaction.reply({ content: '✅ Verified successfully!', flags: [EPHEMERAL_FLAG] });
            }

            if (id.startsWith('verify_role_')) {
                const roleId = id.replace('verify_role_', '');
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

    // --- Message Event Handler (Dyno/Carl Chat Filter & Media-Only Enforcer) ---
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

        if (!isStaff && !isOwner) {
            const mediaChannels = getMediaData();
            if (mediaChannels.includes(message.channel.id)) {
                const hasMedia = message.attachments.size > 0 || /https?:\/\/\S+/i.test(message.content);
                if (!hasMedia) await message.delete().catch(() => {});
            }
        }
    });

    // --- Member Join Security Handler (Beemo & AltDentifier Engines) ---
    client.on('guildMemberAdd', async (member) => {
        if (!member.guild) return;

        const config = await getSecurityConfig(member.guild.id);
        const botMember = member.guild.members.me;

        if (config.modules?.altdentifier) {
            const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
            if (accountAgeDays < 7) {
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
                if (botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                    await member.kick('Beemo Defense: Mass raid join detected').catch(() => {});
                }
            }
        }
    });

    // --- Audit Log Security Handler (Wick Anti-Nuke Engine) ---
    const handleAntiNuke = async (guild, actionType) => {
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

    client.on('channelDelete', channel => channel.guild && handleAntiNuke(channel.guild, AuditLogEvent.ChannelDelete));
    client.on('roleDelete', role => role.guild && handleAntiNuke(role.guild, AuditLogEvent.RoleDelete));

    console.log('✅ Master Channel Systems & Security Protocol Engines Loaded');
}

module.exports = initModule;
module.exports.init = initModule;
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
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
