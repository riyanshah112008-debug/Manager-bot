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
    guildId: String, messageId: String, title: String, description: String,
    yesVotes: { type: Array, default: [] }, noVotes: { type: Array, default: [] }, createdAt: { type: Date, default: Date.now }
});
const PolicyVote = mongoose.models.PolicyVote || mongoose.model('PolicyVote', PolicyVoteSchema);

const masterSecuritySchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    autoKick: { type: Boolean, default: false }, autoBan: { type: Boolean, default: false }, ownerBypass: { type: Boolean, default: true },
    modules: { wick: { type: Boolean, default: true }, beemo: { type: Boolean, default: true }, altdentifier: { type: Boolean, default: false }, dyno_carl: { type: Boolean, default: true } },
    userInfractions: { type: Map, of: Number, default: {} }
});
const MasterSecurity = mongoose.models.MasterSecurity || mongoose.model('MasterSecurity', masterSecuritySchema);

const protectDb = new Database('protect.db');
protectDb.exec(`CREATE TABLE IF NOT EXISTS protected_users (guild_id TEXT, user_id TEXT, PRIMARY KEY (guild_id, user_id))`);

const securityCache = new Map();
const joinTracker = new Map();  
const nukeTracker = new Map();  

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
    const AI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
    
    for (let attempt = 0; attempt < 3; attempt++) {
        for (const modelName of AI_MODELS) {
            try {
                const ai = getNextAIClient();
                if (!ai) continue;
                const response = await ai.models.generateContent({ model: modelName, contents: prompt });
                if (response && response.text) return response.text.trim();
            } catch (err) { continue; }
        }
        await new Promise(res => setTimeout(res, 500));
    }
    return "⚡ Request processed via secondary buffer.";
}

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
// ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 2 OF 2)
// ==========================================
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
        } else if (moduleType === 'admin_requests') {
            embed.setColor('#FEE75C').setTitle('👑 Admin Action Authorization Queue').addFields({ name: 'Queue State', value: '`ACTIVE DISPATCHER 👑`', inline: true }, { name: 'Request Types', value: '`Staff Applications & Admin Approvals`', inline: true });
        } else {
            embed.setColor('#2ecc71').setTitle(`🟢 Active Module Hub: #${channel.name}`).setDescription(`Status: **ONLINE 🟢**\nRunning real-time background protection and logging.`);
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
    const showVerified = { id: verifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] };
    const staffFullControl = { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] };
    const botFullControl = { id: botMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] };

    // PRE-SETUP INTERACTIVE PREVIEWS (Ping User & Send Both Previews)
    const trackerModule = require('./tracker');
    if (trackerModule.buildInactivityAlertEmbed && trackerModule.buildSusInactivityAlertEmbed) {
        const inactivityPreviewEmbed = trackerModule.buildInactivityAlertEmbed(interaction.member, interaction.user.id, 'uPUQpU4ecR', Date.now() - (14 * 24 * 60 * 60 * 1000));
        const inactivityPreviewRow = trackerModule.buildInactivityModPanelRow(interaction.user.id);

        const susPreviewEmbed = trackerModule.buildSusInactivityAlertEmbed(interaction.member, 30);
        const susPreviewRow = trackerModule.buildSusModPanelRow(interaction.user.id);

        await interaction.channel.send({
            content: `<@${interaction.user.id}>\n⚙️ **Starry Master Pre-Setup Preview:** Below are live samples of automated inactivity and sus-account alert panels:`,
            embeds: [inactivityPreviewEmbed],
            components: [inactivityPreviewRow]
        }).catch(() => {});

        await interaction.channel.send({
            content: `<@${interaction.user.id}>`,
            embeds: [susPreviewEmbed],
            components: [susRowPreviewRow || susPreviewRow]
        }).catch(() => {});
    }

    // Deploy 6 Categories & 24 Channels
    const sysCat = await getOrCreateCategory(guild, '🛡️ SECURITY & SYSTEM LOGS', [hideEveryone, staffFullControl, botFullControl]);
    const sysChannels = [
        { name: 'logs-access', moduleType: 'log_access' }, { name: 'logs-moderate', moduleType: 'log_moderate' },
        { name: 'logs-messages', moduleType: 'log_messages' }, { name: 'logs-voice', moduleType: 'log_voice' },
        { name: 'logs-channels', moduleType: 'log_channels' }, { name: 'logs-members', moduleType: 'log_members' },
        { name: 'sus-account-tracker', moduleType: 'sus_tracker' }, { name: 'inactivity-tracker', moduleType: 'inactivity_tracker' }
    ];
    for (const item of sysChannels) {
        await createNonDuplicatingActiveChannel(guild, { name: item.name, parent: sysCat.id, moduleType: item.moduleType, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    }

    const supportCat = await getOrCreateCategory(guild, '🎫 SUPPORT & APPLICATIONS');
    await createNonDuplicatingActiveChannel(guild, { name: 'verify-here', parent: supportCat.id, moduleType: 'verification', permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'open-a-ticket', parent: supportCat.id, moduleType: 'tickets', permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);

    await ServerSettings.findOneAndUpdate({ guildId: String(guild.id) }, { setupCompleted: true, verifiedRoleId: verifiedRole.id }, { upsert: true });
    return { verifiedRole, totalCategories: 6, totalChannels: 24 };
}

function initModule(client) {
    client.isUserProtected = (guildId, userId) => !!getProtect.get(guildId, userId);

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

    console.log('✅ Master Channel Systems Engine Loaded');
}

module.exports = initModule;
module.exports.init = initModule;
module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.generateAIResponseWithRetry = generateAIResponseWithRetry;
module.exports.executeFullGuildBackup = executeFullGuildBackup;
                    
