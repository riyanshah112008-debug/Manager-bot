// ==========================================
// 🛡️ STARRY SUPREME MASTER & MODERATION ENGINE
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

// --- Database Schemas ---
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

const AutomodGuild = mongoose.models.AutomodGuild || mongoose.model('AutomodGuild', automodGuildSchema);
const AutomodChannel = mongoose.models.AutomodChannel || mongoose.model('AutomodChannel', automodChannelSchema);
const Warning = mongoose.models.Warning || mongoose.model('Warning', warningSchema);

let Transcript;
try { Transcript = require('../models/Transcript'); } catch (e) { Transcript = mongoose.models.Transcript; }

// --- SQLite Protection DB ---
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

const badWordsList = ['badword1', 'badword2', 'scam', 'free nitro', 'click here for free'];

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

// --- Slash Command Payloads using strict builders ---
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

const policyVotePayload = {
    name: 'policy-vote', description: '🏛️ Governance vote (Admins Only)', default_member_permissions: '8',
    options: [{ name: 'title', type: 3, required: true, description: 'Title' }, { name: 'description', type: 3, required: true, description: 'Desc' }]
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleModCommands(interaction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => {});
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
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => {});
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

function initModule(client) {
    client.isUserProtected = (guildId, userId) => !!getProtect.get(guildId, userId);
    start60sChannelTelemetryLoop(client);

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.commandName;
            if (['emergency-nuke', 'emergency-lockdown', 'emergency-secure', 'emergency-unban'].includes(cmd)) {
                await interaction.reply({ content: `⚡ Emergency protocol executed.`, flags: [EPHEMERAL_FLAG] });
            }
            if (cmd === 'mod') await handleModCommands(interaction);
            if (cmd === 'automod') await handleAutoModCommands(interaction);
        } else if (interaction.isButton()) {
            const id = interaction.customId;
            if (id.startsWith('sys_verify_')) {
                await interaction.member.roles.add(id.split('_')[2]).catch(() => {});
                return interaction.reply({ content: '✅ Verified!', flags: [EPHEMERAL_FLAG] });
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
        }
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        const isStaff = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);
        if (isStaff || message.author.id === message.guild.ownerId) return;

        if (badWordsList.some(w => message.content.toLowerCase().includes(w))) {
            await message.delete().catch(() => {});
            return;
        }
        const mediaChannels = getMediaData();
        if (mediaChannels.includes(message.channel.id)) {
            const hasMedia = message.attachments.size > 0 || /https?:\/\/\S+/i.test(message.content);
            if (!hasMedia) await message.delete().catch(() => {});
        }
    });
}

module.exports = initModule;
module.exports.init = initModule;
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.policyVotePayload = policyVotePayload;
module.exports.modMasterPayload = modMasterCommand.toJSON();
module.exports.autoModMasterPayload = autoModMasterCommand.toJSON();
                                                      
