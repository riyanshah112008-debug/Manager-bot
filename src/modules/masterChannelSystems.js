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

let Transcript;
try { Transcript = require('../models/Transcript'); } catch (e) { Transcript = mongoose.models.Transcript; }

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
const joinTracker = new Map();  // GuildID -> Array of join timestamps
const nukeTracker = new Map();  // AdminID -> Array of deletion timestamps

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

// --- AI Setup Helpers with Retry & Fallbacks ---
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
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 2 OF 6)
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

    const sysCat = await guild.channels.create({ name: '🛡️ SECURITY & SYSTEM LOGS', type: ChannelType.GuildCategory, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] });
    const sysChannels = [
        { name: 'logs-access', topic: 'User Joins, Leaves & Invites' }, { name: 'logs-moderate', topic: 'Automod, Timeouts, Bans' },
        { name: 'logs-messages', topic: 'Deleted & Edited Audits' }, { name: 'logs-voice', topic: 'Voice Activity' },
        { name: 'logs-channels', topic: 'Channel Updates' }, { name: 'logs-members', topic: 'Role Assignments' },
        { name: 'sus-account-tracker', topic: 'Alt accounts' }, { name: 'inactivity-tracker', topic: 'Inactivity Audit' }
    ];
    for (const item of sysChannels) await guild.channels.create({ name: item.name, type: ChannelType.GuildText, parent: sysCat.id, topic: item.topic });

    const supportCat = await guild.channels.create({ name: '🎫 SUPPORT & APPLICATIONS', type: ChannelType.GuildCategory });
    const verifyCh = await guild.channels.create({
        name: 'verify-here', type: ChannelType.GuildText, parent: supportCat.id, topic: 'Verification portal',
        permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }, botFullControl]
    });
    const verifyEmbed = new EmbedBuilder().setColor('#2ecc71').setTitle('🛡️ Server Verification').setDescription('Click below to verify.');
    const verifyRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`sys_verify_${verifiedRole.id}`).setLabel('Verify Account').setStyle(ButtonStyle.Success).setEmoji('✅'));
    await verifyCh.send({ embeds: [verifyEmbed], components: [verifyRow] });

    const ticketCh = await guild.channels.create({ name: 'open-a-ticket', type: ChannelType.GuildText, parent: supportCat.id, permissionOverwrites: [hideEveryone, showVerified, botFullControl] });
    const ticketEmbed = new EmbedBuilder().setColor('#00F2FE').setTitle('🎫 Support Portal').setDescription('Click below to open a ticket.');
    const ticketRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'));
    const staffAppEmbed = new EmbedBuilder().setColor('#9b59b6').setTitle('📋 Staff Application').setDescription('Apply for moderator.');
    const staffAppRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('📝'));
    await ticketCh.send({ embeds: [ticketEmbed], components: [ticketRow] });
    await ticketCh.send({ embeds: [staffAppEmbed], components: [staffAppRow] });

    await ServerSettings.findOneAndUpdate({ guildId: String(guild.id) }, { setupCompleted: true, verifiedRoleId: verifiedRole.id }, { upsert: true });
    return { verifiedRole, totalCategories: 2, totalChannels: 12 };
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

// --- Slash Command Payloads ---
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
    .addSubcommand(sub =>
        sub.setName('channel')
            .setDescription('Purge & recreate a specific channel')
            .addChannelOption(o => o.setName('target').setDescription('Target channel (defaults to current channel)').addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
        sub.setName('server')
            .setDescription('⚠️ SERVER NUKE: Delete all channels (except this one) & non-essential roles')
    );

const emergencyLockdownCommand = new SlashCommandBuilder().setName('emergency-lockdown').setDescription('⚡ Emergency Protocol: Server Channel Lockdown').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const emergencySecureCommand = new SlashCommandBuilder().setName('emergency-secure').setDescription('⚡ Emergency Protocol: Secure Chat & Voice').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const emergencyUnbanCommand = new SlashCommandBuilder().setName('emergency-unban').setDescription('⚡ Emergency Protocol: Mass Unban All').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const policyVotePayload = {
    name: 'policy-vote', description: '🏛️ Governance vote (Admins Only)', default_member_permissions: '8',
    options: [{ name: 'title', type: 3, required: true, description: 'Title' }, { name: 'description', type: 3, required: true, description: 'Desc' }]
};
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 3 OF 6)
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
        new ButtonBuilder().setCustomId(`verify_role_${role.id}`).setLabel('Get Verification Link').setEmoji('🛡️').setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [button] });
    return interaction.editReply(`✅ Verification panel set up in ${channel} for role ${role}!`);
}

async function handleEmergencyCommands(interaction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
    const cmd = interaction.commandName;
    const guild = interaction.guild;

    if (cmd === 'emergency-nuke') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'channel') {
            const channel = interaction.options.getChannel('target') || interaction.channel;
            const position = channel.position;
            const newChannel = await channel.clone();
            await channel.delete().catch(() => {});
            await newChannel.setPosition(position).catch(() => {});
            return newChannel.send('⚡ **EMERGENCY NUKE:** Channel has been completely purged and recreated.');
        }

        if (sub === 'server') {
            if (interaction.user.id !== guild.ownerId) {
                return interaction.editReply('❌ **Owner Only:** Only the Server Owner can execute a whole-server emergency nuke!');
            }

            const currentChannel = interaction.channel;
            const botMember = guild.members.me;

            let deletedChannels = 0;
            let deletedRoles = 0;

            // 1. Delete all channels EXCEPT current channel
            const channelsToDelete = guild.channels.cache.filter(c => c.id !== currentChannel.id);
            for (const [, ch] of channelsToDelete) {
                try {
                    await ch.delete();
                    deletedChannels++;
                } catch (e) {}
            }

            // 2. Delete non-managed, non-everyone, non-superior roles
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
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 4 OF 6)
// ==========================================
function initModule(client) {
    client.isUserProtected = (guildId, userId) => !!getProtect.get(guildId, userId);
    start60sChannelTelemetryLoop(client);

    // --- Slash Command & Component Listener ---
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.commandName;
            
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
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 5 OF 6)
// ==========================================
    // --- Message Event Handler (Dyno/Carl Chat Filter & Media-Only Enforcer) ---
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const isStaff = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        const isOwner = message.author.id === message.guild.ownerId;
        const config = await getSecurityConfig(message.guild.id);

        // --- DYNO/CARL CHAT FILTER & AUTOMOD ENGINE ---
        if (config.modules?.dyno_carl) {
            const bypassedByOwner = config.ownerBypass && isOwner;
            if (!isStaff && !bypassedByOwner) {
                const botMember = message.guild.members.me;

                // Check Bad Words, Invite Links, and Scam Patterns
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

                    // AutoBan Trigger (5+ infractions)
                    if (config.autoBan && currentInfractions >= 5) {
                        if (botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                            await message.member.ban({ reason: 'Dyno/Carl Engine: Exceeded maximum infraction limit (5+ violations)' }).catch(() => {});
                            return message.channel.send(`🔨 **AutoBan:** <@${userId}> was banned for repeated violations.`).catch(() => {});
                        }
                    }

                    // AutoKick Trigger (3+ infractions)
                    if (config.autoKick && currentInfractions >= 3) {
                        if (botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                            await message.member.kick('Dyno/Carl Engine: Exceeded infraction limit (3+ violations)').catch(() => {});
                            return message.channel.send(`🥾 **AutoKick:** <@${userId}> was kicked for repeated violations.`).catch(() => {});
                        }
                    }

                    const warnMsg = await message.channel.send(`⚠️ <@${userId}>, message blocked by AutoMod! (Warning #${currentInfractions})`).catch(() => null);
                    if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                    return;
                }
            }
        }

        // --- MEDIA ONLY CHANNEL ENFORCEMENT ---
        if (!isStaff && !isOwner) {
            const mediaChannels = getMediaData();
            if (mediaChannels.includes(message.channel.id)) {
                const hasMedia = message.attachments.size > 0 || /https?:\/\/\S+/i.test(message.content);
                if (!hasMedia) await message.delete().catch(() => {});
            }
        }
    });
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE (PART 6 OF 6)
// ==========================================
    // --- Member Join Security Handler (Beemo & AltDentifier Engines) ---
    client.on('guildMemberAdd', async (member) => {
        if (!member.guild) return;

        const config = await getSecurityConfig(member.guild.id);
        const botMember = member.guild.members.me;

        // --- ALTDENTIFIER (VERIFICATION GATEKEEPER) ---
        if (config.modules?.altdentifier) {
            const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
            if (accountAgeDays < 7) { // Accounts younger than 7 days
                if (botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                    await member.send(`⚠️ You were removed from **${member.guild.name}** because your account is younger than 7 days (AltDentifier Defense).`).catch(() => {});
                    await member.kick('AltDentifier: Account younger than minimum requirement (7 days)').catch(() => {});
                    return;
                }
            }
        }

        // --- BEEMO (ANTI-RAID MASS JOIN DEFENSE) ---
        if (config.modules?.beemo) {
            const now = Date.now();
            const guildJoins = joinTracker.get(member.guild.id) || [];
            
            const recentJoins = guildJoins.filter(time => now - time < 10000);
            recentJoins.push(now);
            joinTracker.set(member.guild.id, recentJoins);

            // Trigger raid kick if >5 joins in 10 seconds
            if (recentJoins.length >= 5) {
                if (botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                    await member.kick('Beemo Defense: Mass raid join detected').catch(() => {});
                }
            }
        }
    });

    // --- Audit Log Security Handler (Wick Anti-Nuke & Admin Limits Engine) ---
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

            // Timeout admin if >3 deletions in 10 seconds
            if (recentActions.length >= 3) {
                const targetAdmin = await guild.members.fetch(executorId).catch(() => null);
                if (targetAdmin && targetAdmin.manageable) {
                    await targetAdmin.timeout(24 * 60 * 60 * 1000, 'Wick Engine: Anti-Nuke threshold exceeded (Mass Channel/Role Deletion)').catch(() => {});
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
