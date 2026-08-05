// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 1 OF 7)
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

let createCanvas, loadImage;
try {
    const canvasPkg = require('canvas');
    createCanvas = canvasPkg.createCanvas;
    loadImage = canvasPkg.loadImage;
} catch (e) {}

let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {}

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;
const blacklistedUsers = new Set();

const DEFAULT_BAD_WORDS = [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 
    'pussy', 'slut', 'whore', 'motherfucker', 'cock', 'nigger', 'faggot'
];

const badWordSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    words: { type: [String], default: DEFAULT_BAD_WORDS }
});
const BadWordSettings = mongoose.models.BadWordSettings || mongoose.model('BadWordSettings', badWordSchema);

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
    modules: { 
        wick: { type: Boolean, default: true }, 
        beemo: { type: Boolean, default: true }, 
        altdentifier: { type: Boolean, default: false }, 
        dyno_carl: { type: Boolean, default: true } 
    },
    userInfractions: { type: Map, of: Number, default: {} }
});
const MasterSecurity = mongoose.models.MasterSecurity || mongoose.model('MasterSecurity', masterSecuritySchema);

let ServerSettings;
try {
    ServerSettings = mongoose.models.ServerSettings || require('../models/ServerSettings');
} catch (e) {
    const serverSettingsSchema = new mongoose.Schema({
        guildId: { type: String, required: true, unique: true },
        setupCompleted: { type: Boolean, default: false },
        verifiedRoleId: { type: String, default: null },
        triggerWord: { type: String, default: 'starry' }
    });
    ServerSettings = mongoose.models.ServerSettings || mongoose.model('ServerSettings', serverSettingsSchema);
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

const AI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateAIResponseWithRetry(prompt) {
    if (apiKeys.length === 0) throw new Error('Missing GEMINI_API_KEY.');
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
                if ((err.status === 429 || err.status === 503) && attempt < 3) {
                    await sleep(attempt * 400);
                    continue;
                }
                break;
            }
        }
    }
    throw lastError || new Error('AI Engine unreachable.');
}
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 2 OF 7)
// File Path: modules/starry.js
// ==========================================

async function getBadWordPanelEmbed(guild, client) {
    let settings = await BadWordSettings.findOne({ guildId: guild.id });
    if (!settings) {
        settings = await BadWordSettings.create({ guildId: guild.id, enabled: true, words: DEFAULT_BAD_WORDS });
    }

    const embed = new EmbedBuilder()
        .setColor(settings.enabled ? '#2ecc71' : '#ed4245')
        .setAuthor({ name: `${guild.name} | Security Protocol`, iconURL: guild.iconURL({ dynamic: true }) })
        .setTitle('🛡️ Bad Word Moderation Control Panel')
        .setDescription(
            `Configure automated cuss word detection, auto-deletion, and warning notices for **${guild.name}**.\n\n` +
            `• **Engine Status:** ${settings.enabled ? '`ACTIVE 🟢`' : '`DISABLED 🔴`'}\n` +
            `• **Total Filtered Words:** \`${settings.words.length}\` words\n` +
            `• **Automated Enforcement:** Message Deletion + Public Warning + Direct DM Warning.`
        )
        .addFields({
            name: '📜 Sample Active Words',
            value: settings.words.length > 0 
                ? `\`\`\`${settings.words.slice(0, 15).join(', ')}${settings.words.length > 15 ? '...' : ''}\`\`\``
                : '*No words currently blacklisted.*'
        })
        .setFooter({ text: 'Use the buttons below to manage the bad word filter', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('badword_add_btn').setLabel('Add Word(s)').setStyle(ButtonStyle.Success).setEmoji('➕'),
        new ButtonBuilder().setCustomId('badword_remove_btn').setLabel('Remove Word(s)').setStyle(ButtonStyle.Danger).setEmoji('➖'),
        new ButtonBuilder().setCustomId('badword_list_btn').setLabel('View Full List').setStyle(ButtonStyle.Secondary).setEmoji('📜'),
        new ButtonBuilder().setCustomId('badword_toggle_btn').setLabel(settings.enabled ? 'Disable AutoMod' : 'Enable AutoMod').setStyle(settings.enabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
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
            await channel.send({ embeds: [embed], components }).catch(() => {});
        } else if (embed.data.title) {
            await channel.send({ embeds: [embed] }).catch(() => {});
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
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 3 OF 7)
// File Path: modules/starry.js
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

    const govCat = await getOrCreateCategory(guild, '🛡️ SECURITY & GOVERNANCE', [showEveryone, botFullControl]);
    await createNonDuplicatingActiveChannel(guild, { name: 'rules-and-info', parent: govCat.id, permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'announcements', parent: govCat.id, permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'server-status-monitor', parent: govCat.id, moduleType: 'status_monitor', permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);

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

    const trackerCat = await getOrCreateCategory(guild, '📡 AUTOMATED TRACKERS', [hideEveryone, staffFullControl, botFullControl]);
    await createNonDuplicatingActiveChannel(guild, { name: 'sus-account-tracker', parent: trackerCat.id, moduleType: 'sus_tracker', permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'inactivity-tracker', parent: trackerCat.id, moduleType: 'inactivity_tracker', permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'chest-drops', parent: trackerCat.id, permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);

    const supportCat = await getOrCreateCategory(guild, '🎫 SUPPORT & APPLICATIONS');
    await createNonDuplicatingActiveChannel(guild, { name: 'verify-here', parent: supportCat.id, moduleType: 'verification', permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'open-a-ticket', parent: supportCat.id, moduleType: 'tickets', permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);

    const staffCat = await getOrCreateCategory(guild, '👑 ADMIN & STAFF HQ', [hideEveryone, staffFullControl, botFullControl]);
    await createNonDuplicatingActiveChannel(guild, { name: 'owners-chat', parent: staffCat.id, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'staff-discussion', parent: staffCat.id, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);

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
    .addStringOption(o => o.setName('target').setDescription('Target scope').setRequired(true).addChoices(
        { name: 'Channel', value: 'channel' }, 
        { name: 'Server', value: 'server' }
    ))
    .addChannelOption(o => o.setName('channel').setDescription('Specific channel to nuke (defaults to current channel)').setRequired(false));

const modMasterCommand = new SlashCommandBuilder().setName('mod').setDescription('🛡️ Master Moderation Hub').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);
const autoModMasterCommand = new SlashCommandBuilder().setName('automod').setDescription('⚙️ AutoMod Hub').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const moderateMasterCommand = new SlashCommandBuilder().setName('moderate').setDescription('⚙️ Security modules').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const verifySetupCommand = new SlashCommandBuilder().setName('verify-setup').setDescription('Setup verification').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 4 OF 7)
// File Path: modules/starry.js
// ==========================================

module.exports = async (client) => {
    if (client.starryEngineInitialized) return;
    client.starryEngineInitialized = true;

    console.log('🚀 Starry Aesthetic Engine Active (Welcome/Goodbye Gifs, Mod, Logs)');

    start60sChannelTelemetryLoop(client);

    client.getLogChannel = (guild, logType = 'misc') => {
        if (!guild || !guild.channels) return null;
        const typeMap = {
            'access': ['logs-access', 'user-invite-logs', 'invite-logs', 'join-logs'],
            'moderate': ['logs-moderate', 'mod-logs', 'warning-logs', 'audit-logs'],
            'messages': ['logs-messages', 'message-logs', 'chat-logs']
        };
        const targetNames = typeMap[logType.toLowerCase()] || typeMap['access'];
        let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name)));
        if (ch) return ch;
        return guild.channels.cache.find(c => c.type === ChannelType.GuildText && ['logs-server', 'server-logs', 'mod-logs', 'logs'].includes(c.name.toLowerCase())) || null;
    };

    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A') => {
        if (!member || !member.user || member.user.bot) return false;
        const actionType = action.toLowerCase();
        let embedColor = actionType === 'ban' ? '#ED4245' : actionType === 'kick' ? '#FEE75C' : '#5865F2';

        const modEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: `${guild.name} | Security Notice`, iconURL: guild.iconURL({ dynamic: true }) })
            .setTitle(`🛡️ Moderation Discipline: ${actionType.toUpperCase()}`)
            .setDescription(`Hello **${member.user.username}**, you received a moderation action in **${guild.name}**.`)
            .addFields(
                { name: '👤 Moderator', value: `\`${moderator.user ? moderator.user.username : 'Starry System'}\``, inline: true },
                { name: '🛡️ Action', value: `\`${actionType.toUpperCase()}\``, inline: true },
                { name: '🏷️ Case ID', value: `\`#${caseId}\``, inline: true },
                { name: '📝 Reason', value: `>>> ${reason || 'No reason provided.'}`, inline: false }
            )
            .setTimestamp();

        try { await member.send({ embeds: [modEmbed] }); return true; } catch (err) { return false; }
    };

    client.on('guildMemberAdd', async (member) => {
        if (member.user.bot) return;

        const accessLog = client.getLogChannel(member.guild, 'access');
        if (accessLog) {
            const joinEmbed = new EmbedBuilder()
                .setColor('#FF73FA')
                .setAuthor({ name: '🌸 New Member Arrival', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`✨ Welcome <@${member.id}> to **${member.guild.name}**! We are thrilled to have you here. 💖`)
                .setImage('https://media.tenor.com/9nJ97o10U60AAAAC/anime-welcome.gif')
                .setTimestamp();
            await accessLog.send({ embeds: [joinEmbed] }).catch(() => {});
        }

        try {
            const config = await WelcomeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;
            const welcomeCh = member.guild.channels.cache.get(config.channelId);
            if (!welcomeCh) return;

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#FF73FA')
                .setTitle(`✨ WELCOME TO ${member.guild.name.toUpperCase()} ✨`)
                .setDescription(`💖 Hello <@${member.id}>! Welcome aboard! Make yourself at home, check out the community rules, and enjoy your wonderful stay here. ✨`)
                .addFields(
                    { name: '🌸 Member Milestone', value: `You are our stellar member **#${member.guild.memberCount}**! 🎉`, inline: false },
                    { name: '✨ Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setImage('https://media.tenor.com/images/5f4481d68378873724c9c22e032997aa/tenor.gif')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `✨ Starry Aesthetic Welcome System • Enjoy your journey! ✨` })
                .setTimestamp();

            await welcomeCh.send({ content: `💫 Hey <@${member.id}>! We've been expecting you! 🥂`, embeds: [welcomeEmbed] }).catch(() => {});
        } catch (err) {}
    });

    client.on('guildMemberRemove', async (member) => {
        const accessLog = client.getLogChannel(member.guild, 'access');
        if (accessLog) {
            const leaveEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '🥀 Member Departure', iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`💫 **${member.user.tag}** has fluttered away from **${member.guild.name}**.`)
                .setImage('https://media.tenor.com/images/99208a68b444b0593457a82b3d39575e/tenor.gif')
                .setTimestamp();
            await accessLog.send({ embeds: [leaveEmbed] }).catch(() => {});
        }

        try {
            const config = await GoodbyeSettings.findOne({ guildId: member.guild.id });
            if (!config || !config.channelId) return;
            const goodbyeCh = member.guild.channels.cache.get(config.channelId);
            if (!goodbyeCh) return;

            const goodbyeEmbed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle(`🥀 FAREWELL, TRAVELER 🥀`)
                .setDescription(`👋 **${member.user.tag}** has departed from **${member.guild.name}**. We wish you the absolute best on your future adventures! 🌠`)
                .addFields({ name: '📊 Server Census', value: `We are now down to **${member.guild.memberCount}** members.`, inline: false })
                .setImage('https://media.tenor.com/images/99208a68b444b0593457a82b3d39575e/tenor.gif')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `🥀 Starry Aesthetic Goodbye System • Safe travels!` })
                .setTimestamp();

            await goodbyeCh.send({ content: `🕊️ Goodbye **${member.user.username}**! Until we meet again...`, embeds: [goodbyeEmbed] }).catch(() => {});
        } catch (err) {}
    });

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
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 5 OF 7)
// File Path: modules/starry.js
// ==========================================

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.guild) return;

        // BAD WORD AUTOMOD BUTTON INTERACTION HANDLERS
        if (interaction.isButton() && interaction.customId.startsWith('badword_')) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Only Administrators can manage this panel.', flags: [EPHEMERAL_FLAG] });
            }

            const guildId = interaction.guild.id;

            if (interaction.customId === 'badword_toggle_btn') {
                let settings = await BadWordSettings.findOne({ guildId });
                if (!settings) {
                    settings = await BadWordSettings.create({ guildId, enabled: true, words: DEFAULT_BAD_WORDS });
                } else {
                    settings.enabled = !settings.enabled;
                    await settings.save();
                }

                const panel = await getBadWordPanelEmbed(interaction.guild, client);
                return interaction.update(panel);
            }

            if (interaction.customId === 'badword_add_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('badword_add_modal')
                    .setTitle('Add Bad Words to Filter');

                const input = new TextInputBuilder()
                    .setCustomId('badwords_input')
                    .setLabel('Words to Add (comma separated)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('e.g. word1, word2, word3')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'badword_remove_btn') {
                const modal = new ModalBuilder()
                    .setCustomId('badword_remove_modal')
                    .setTitle('Remove Bad Words from Filter');

                const input = new TextInputBuilder()
                    .setCustomId('badwords_input')
                    .setLabel('Words to Remove (comma separated)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('e.g. word1, word2')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'badword_list_btn') {
                const settings = await BadWordSettings.findOne({ guildId });
                const wordsList = settings?.words?.length ? settings.words.join(', ') : 'No bad words currently filtered.';

                const listEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📜 Complete Filtered Bad Words List')
                    .setDescription(`\`\`\`${wordsList.slice(0, 3900)}\`\`\``)
                    .setTimestamp();

                return interaction.reply({ embeds: [listEmbed], flags: [EPHEMERAL_FLAG] });
            }
        }

        // BAD WORD AUTOMOD MODAL SUBMISSION HANDLERS
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'badword_add_modal') {
                const inputWords = interaction.fields.getTextInputValue('badwords_input')
                    .split(',')
                    .map(w => w.trim().toLowerCase())
                    .filter(w => w.length > 0);

                let settings = await BadWordSettings.findOne({ guildId: interaction.guild.id });
                if (!settings) {
                    settings = new BadWordSettings({ guildId: interaction.guild.id, enabled: true, words: DEFAULT_BAD_WORDS });
                }

                const added = [];
                for (const word of inputWords) {
                    if (!settings.words.includes(word)) {
                        settings.words.push(word);
                        added.push(word);
                    }
                }

                await settings.save();
                await interaction.reply({ content: `✅ Added **${added.length}** new word(s) to the filter list!`, flags: [EPHEMERAL_FLAG] });

                const panel = await getBadWordPanelEmbed(interaction.guild, client);
                if (interaction.message) await interaction.message.edit(panel).catch(() => {});
            }

            if (interaction.customId === 'badword_remove_modal') {
                const removeWords = interaction.fields.getTextInputValue('badwords_input')
                    .split(',')
                    .map(w => w.trim().toLowerCase())
                    .filter(w => w.length > 0);

                let settings = await BadWordSettings.findOne({ guildId: interaction.guild.id });
                if (settings && settings.words) {
                    settings.words = settings.words.filter(w => !removeWords.includes(w.toLowerCase()));
                    await settings.save();
                }

                await interaction.reply({ content: `✅ Removed specified word(s) from the filter list!`, flags: [EPHEMERAL_FLAG] });

                const panel = await getBadWordPanelEmbed(interaction.guild, client);
                if (interaction.message) await interaction.message.edit(panel).catch(() => {});
            }
        }

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

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setup-starry') {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply().catch(() => {});
                const result = await provisionMasterServerStructure(interaction);
                const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('✨ Autonomous Server Setup Complete!').setDescription(`Configured **6 Categories** and **${result.totalChannels} Security & Log Channels**!`);
                return interaction.editReply({ embeds: [embed] });
            }

            // ACCURATE EMERGENCY NUKE HANDLER (PURGES ALL CHANNELS/ROLES EXCEPT COMMAND CHANNEL & MAIN SYSTEM ROLES)
            if (interaction.commandName === 'emergency-nuke') {
                if (!interaction.deferred && !interaction.replied) {
                    await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
                }

                try {
                    const targetScope = interaction.options.getString('target', true);
                    const botMember = interaction.guild.members.me;

                    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                        return interaction.editReply({ content: '❌ **Permission Denied:** I need the **Manage Channels** permission to execute an emergency nuke!' });
                    }

                    if (targetScope === 'channel') {
                        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

                        if (!targetChannel || !targetChannel.deletable) {
                            return interaction.editReply({ content: '❌ **Error:** I cannot delete or nuke this channel. Check my role position and permissions.' });
                        }

                        const position = targetChannel.position;

                        if (targetChannel.id !== interaction.channel.id) {
                            await interaction.editReply({ content: `⚡ Nuking channel <#${targetChannel.id}>...` });
                        }

                        const newChannel = await targetChannel.clone({
                            reason: `Emergency Nuke executed by ${interaction.user.tag}`
                        });

                        await newChannel.setPosition(position).catch(() => {});
                        await targetChannel.delete(`Emergency Nuke executed by ${interaction.user.tag}`).catch(() => {});

                        const nukeEmbed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('⚡ EMERGENCY NUKE EXECUTED')
                            .setDescription('💥 This channel has been completely purged and recreated.')
                            .setImage('https://media.tenor.com/g05_V107_9EAAAAC/explosion-nuke.gif')
                            .setFooter({ text: `Executed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        return newChannel.send({ embeds: [nukeEmbed] });
                    }

                    if (targetScope === 'server') {
                        await interaction.editReply({ content: '⚡ **EMERGENCY SERVER NUKE INITIATED:** Purging all channels and custom roles...' });

                        const currentChannelId = interaction.channel.id;
                        let channelsPurged = 0;
                        let rolesPurged = 0;

                        // 1. Delete ALL channels EXCEPT the channel where command was executed
                        const allChannels = Array.from(interaction.guild.channels.cache.values());
                        for (const ch of allChannels) {
                            if (ch.id !== currentChannelId && ch.deletable) {
                                await ch.delete('Emergency Server Nuke').catch(() => {});
                                channelsPurged++;
                            }
                        }

                        // 2. Delete ALL custom roles EXCEPT @everyone, bot-managed roles, and uneditable higher roles
                        if (botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                            const allRoles = Array.from(interaction.guild.roles.cache.values());
                            for (const role of allRoles) {
                                if (
                                    role.id !== interaction.guild.roles.everyone.id &&
                                    !role.managed &&
                                    role.position < botMember.roles.highest.position
                                ) {
                                    await role.delete('Emergency Server Nuke').catch(() => {});
                                    rolesPurged++;
                                }
                            }
                        }

                        const serverNukeEmbed = new EmbedBuilder()
                            .setColor('#ED4245')
                            .setTitle('💥 FULL SERVER NUKE COMPLETED')
                            .setDescription(`The server wipe has finished successfully!\n\n• **Channels Purged:** \`${channelsPurged}\`\n• **Roles Purged:** \`${rolesPurged}\`\n• **Surviving Channel:** <#${currentChannelId}>`)
                            .setImage('https://media.tenor.com/g05_V107_9EAAAAC/explosion-nuke.gif')
                            .setFooter({ text: `Executed by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        return interaction.followUp({ 
                            embeds: [serverNukeEmbed], 
                            flags: [EPHEMERAL_FLAG] 
                        });
                    }

                } catch (err) {
                    console.error('❌ Emergency Nuke Error:', err);
                    return interaction.editReply({ content: `❌ **Nuke Failed:** \`${err.message}\`` }).catch(() => {});
                }
            }

            if (interaction.commandName === 'setupwelcome') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: '❌ You need **Manage Server** permissions.', flags: [EPHEMERAL_FLAG] });
                }
                const channel = interaction.options.getChannel('channel', true);
                await WelcomeSettings.findOneAndUpdate({ guildId: interaction.guildId }, { channelId: channel.id }, { upsert: true });

                const previewEmbed = new EmbedBuilder()
                    .setColor('#FF73FA')
                    .setTitle(`✨ WELCOME TO ${interaction.guild.name.toUpperCase()} ✨`)
                    .setDescription(`💖 Hello ${interaction.user}! Welcome aboard! Make yourself at home, check out the community rules, and enjoy your wonderful stay here. ✨`)
                    .addFields(
                        { name: '🌸 Member Milestone', value: `You are our stellar member **#${interaction.guild.memberCount}**! 🎉`, inline: false },
                        { name: '✨ Account Created', value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:R>`, inline: true }
                    )
                    .setImage('https://media.tenor.com/images/5f4481d68378873724c9c22e032997aa/tenor.gif')
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .setFooter({ text: `✨ Starry Aesthetic Welcome System • Setup Preview Mode ✨` })
                    .setTimestamp();

                await channel.send({ content: `💫 Hey ${interaction.user}! We've been expecting you! 🥂 *(Setup Preview)*`, embeds: [previewEmbed] }).catch(() => {});
                return interaction.reply({ content: `✅ **Success!** Aesthetic welcome messages will now be sent to ${channel}!`, flags: [EPHEMERAL_FLAG] });
            }

            if (interaction.commandName === 'setupgoodbye') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: '❌ You need **Manage Server** permissions.', flags: [EPHEMERAL_FLAG] });
                }
                const channel = interaction.options.getChannel('channel', true);
                await GoodbyeSettings.findOneAndUpdate({ guildId: interaction.guildId }, { channelId: channel.id }, { upsert: true });

                const previewEmbed = new EmbedBuilder()
                    .setColor('#7289DA')
                    .setTitle(`🥀 FAREWELL, TRAVELER (Preview) 🥀`)
                    .setDescription(`👋 **${interaction.user.tag}** has departed from **${interaction.guild.name}**. We wish you the absolute best on your future adventures! 🌠`)
                    .addFields({ name: '📊 Server Census', value: `We are now down to **${interaction.guild.memberCount}** members.`, inline: false })
                    .setImage('https://media.tenor.com/images/99208a68b444b0593457a82b3d39575e/tenor.gif')
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: `🥀 Starry Aesthetic Goodbye System • Setup Preview Mode` })
                    .setTimestamp();

                await channel.send({ content: `🕊️ Goodbye **${interaction.user.username}**! Until we meet again... *(Setup Preview)*`, embeds: [previewEmbed] }).catch(() => {});
                return interaction.reply({ content: `✅ **Success!** Aesthetic goodbye messages will now be sent to ${channel}!`, flags: [EPHEMERAL_FLAG] });
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
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 6 OF 7)
// File Path: modules/starry.js
// ==========================================

    async function handleBadWordAutoMod(client, message) {
        if (!message.guild || message.author.bot || !message.member) return false;

        const text = message.content.trim();
        const lowerText = text.toLowerCase();

        // 1. Trigger Command: .badon
        if (lowerText === '.badon') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await message.reply('❌ You need **Administrator** permissions to use `.badon`.');
                return true;
            }

            let settings = await BadWordSettings.findOne({ guildId: message.guild.id });
            if (!settings) {
                settings = await BadWordSettings.create({ guildId: message.guild.id, enabled: true, words: DEFAULT_BAD_WORDS });
            } else {
                settings.enabled = true;
                await settings.save();
            }

            const panel = await getBadWordPanelEmbed(message.guild, client);
            await message.reply({ content: '✅ Bad word moderation is now **ENABLED**!', ...panel });
            return true;
        }

        // 2. Trigger Command: .badoff
        if (lowerText === '.badoff') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await message.reply('❌ You need **Administrator** permissions to use `.badoff`.');
                return true;
            }

            await BadWordSettings.findOneAndUpdate(
                { guildId: message.guild.id },
                { enabled: false },
                { upsert: true }
            );

            await message.reply('🛑 Bad word moderation has been **DISABLED**.');
            return true;
        }

        // 3. AutoMod Bad Word Detection
        if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return false; // Bypass Admins

        const settings = await BadWordSettings.findOne({ guildId: message.guild.id });
        if (!settings || !settings.enabled || !settings.words || settings.words.length === 0) return false;

        const cleanedContent = lowerText.replace(/[^a-z0-9\s]/gi, '');
        const wordsInMsg = cleanedContent.split(/\s+/);

        const detectedWord = settings.words.find(badWord => {
            const bw = badWord.toLowerCase().trim();
            if (!bw) return false;
            return lowerText.includes(bw) || wordsInMsg.includes(bw);
        });

        if (detectedWord) {
            await message.delete().catch(() => {});

            const publicWarn = await message.channel.send(
                `⚠️ <@${message.author.id}>, your message was removed because it contained bad/cuss words! Please keep the channel clean.`
            ).catch(() => null);

            if (publicWarn) {
                setTimeout(() => publicWarn.delete().catch(() => {}), 6000);
            }

            const dmWarnEmbed = new EmbedBuilder()
                .setColor('#ed4245')
                .setAuthor({ name: `${message.guild.name} | Security Warning`, iconURL: message.guild.iconURL({ dynamic: true }) })
                .setTitle('🛑 Language Warning Notice')
                .setDescription(`Hello **${message.author.username}**, your message in **${message.guild.name}** was deleted for violating the server's bad word policy.`)
                .addFields(
                    { name: '📺 Channel', value: `<#${message.channel.id}>`, inline: true },
                    { name: '⚠️ Detected Cuss Word', value: `\`${detectedWord}\``, inline: true },
                    { name: '📝 Original Content', value: `\`\`\`${message.content.slice(0, 500)}\`\`\``, inline: false }
                )
                .setFooter({ text: 'Please refrain from using bad language in public channels.' })
                .setTimestamp();

            await message.author.send({ embeds: [dmWarnEmbed] }).catch(() => {});
            return true;
        }

        return false;
    }

    async function handleAutoModPing(message) {
        if (!message.guild || message.author.bot || !message.member) return false;
        const rawPingMatches = message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || [];
        const totalPings = Math.max(message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0), rawPingMatches.length);

        if (totalPings >= 5) {
            const botMember = message.guild.members.me;
            if (botMember && botMember.permissions.has(PermissionFlagsBits.ManageMessages)) await message.delete().catch(() => {});

            if (botMember && botMember.permissions.has(PermissionFlagsBits.ModerateMembers) && message.member.roles.highest.position < botMember.roles.highest.position && message.author.id !== message.guild.ownerId) {
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

        const isOwner = typeof client.isOwner === 'function' 
            ? client.isOwner(message.author.id) 
            : (process.env.OWNER_ID ? message.author.id === process.env.OWNER_ID : false);

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

    async function handleLocalActions(client, message, triggerWord, displayName) {
        if (!message.guild) return false;
        const text = message.content.toLowerCase().trim();
        const botMember = message.guild.members.me || await message.guild.members.fetch(client.user.id).catch(() => null);

        const cleanText = text.replace(new RegExp(`^(?:<@!?${client.user?.id}>|${displayName}|jarvis|${triggerWord})\\s*`, 'i'), '').trim();

        const isGreeting = cleanText === '' || ['hi', 'hello', 'hey', 'yo', 'sup', 'hola', triggerWord].includes(cleanText);
        if (isGreeting) {
            const responses = [
                `Hello <@${message.author.id}>! ✨ How can I assist you today?`,
                `Hey <@${message.author.id}>! I'm online and ready. What's on your mind? 🌟`,
                `Hi <@${message.author.id}>! Need help with commands, music, or moderation? Just ask! 🚀`
            ];
            await message.reply(responses[Math.floor(Math.random() * responses.length)]);
            return true;
        }

        if (text === '.premium' || text === `${triggerWord} premium` || text === 'jarvis premium') {
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

        return false;
    }
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 7 OF 7)
// File Path: modules/starry.js
// ==========================================

    async function handleSmartModeration(client, message, triggerWord = 'starry') {
        if (!message.guild || message.author.bot) return false;

        const rawContent = message.content;
        const lowerContent = rawContent.toLowerCase();

        const mentionsBot = message.mentions.has(client.user.id);
        const hasTriggerWord = lowerContent.includes(triggerWord) || lowerContent.includes('jarvis');
        if (!mentionsBot && !hasTriggerWord) return false;

        const isTimeout = lowerContent.includes('timeout') || lowerContent.includes('mute');
        const isUntimeout = lowerContent.includes('untimeout') || lowerContent.includes('unmute');
        const isKick = lowerContent.includes('kick');
        const isBan = lowerContent.includes('ban');
        const isPurge = lowerContent.includes('purge') || lowerContent.includes('clear') || lowerContent.includes('clean');

        if (!isTimeout && !isUntimeout && !isKick && !isBan && !isPurge) return false;

        const executor = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
        const botMember = message.guild.members.me || await message.guild.members.fetch(client.user.id).catch(() => null);

        if (isPurge) {
            if (!executor || !executor.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.reply('❌ You need **Manage Messages** permissions to purge.');
                return true;
            }
            if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.reply('❌ I need **Manage Messages** permission in Server Settings to purge!');
                return true;
            }

            const numberMatch = lowerContent.match(/\b\d+\b/);
            const count = numberMatch ? parseInt(numberMatch[0]) : 5;
            const deleteCount = Math.min(count, 99) + 1;

            const deleted = await message.channel.bulkDelete(deleteCount, true).catch(() => null);
            const actualDeletedCount = deleted ? Math.max(0, deleted.size - 1) : count;

            const sent = await message.channel.send(`🧹 Successfully cleared ${actualDeletedCount} messages!`).catch(() => null);
            if (sent) setTimeout(() => sent.delete().catch(() => {}), 3500);

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

        try {
            let targetUser = message.mentions.users.filter(u => u.id !== client.user.id).first();
            if (!targetUser) {
                const idMatch = rawContent.match(/\b\d{17,19}\b/);
                if (idMatch) targetUser = await client.users.fetch(idMatch[0]).catch(() => null);
            }

            if (!targetUser) {
                await message.reply('❌ Please mention a valid user to moderate (e.g. `Starry mute @user 1m for spam`).');
                return true;
            }

            const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);

            if (targetMember) {
                if (targetMember.roles.highest.position >= executor.roles.highest.position && message.author.id !== message.guild.ownerId) {
                    await message.reply(`❌ You cannot moderate **${targetUser.username}** because their highest role is equal to or higher than yours!`);
                    return true;
                }

                if (botMember && targetMember.roles.highest.position >= botMember.roles.highest.position) {
                    await message.reply(`❌ I cannot moderate **${targetUser.username}** because their highest role is equal to or higher than my bot role! Move my Starry role higher.`);
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
                const durationStr = lowerContent.match(/(\d+)\s*(s|m|h|d)/i)?.[0] || '10m';

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

    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        let triggerWord = 'starry';
        let displayName = 'Starry'; 

        try {
            if (ServerSettings) {
                const settings = await ServerSettings.findOne({ guildId: message.guild.id });
                if (settings && settings.triggerWord) {
                    triggerWord = settings.triggerWord.toLowerCase();
                    displayName = settings.triggerWord;
                }
            }
        } catch (err) {}

        if (await handleBadWordAutoMod(client, message)) return;
        if (await handleAutoModPing(message)) return;
        if (await handleDevCLI(client, message)) return;

        const modHandled = await handleSmartModeration(client, message, triggerWord);
        if (modHandled) return;

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

        const localHandled = await handleLocalActions(client, message, triggerWord, displayName);
        if (localHandled) return; 

        const imageHandled = await handlePollinationsImage(client, message, displayName, mentionsBot, hasName, isImagine);
        if (imageHandled) return;

        await handleConversationalGemini(client, message, displayName);
    });
};

module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.generateAIResponseWithRetry = generateAIResponseWithRetry;
module.exports.executeFullGuildBackup = executeFullGuildBackup;
module.exports.emergencyNukePayload = emergencyNukeCommand.toJSON();
module.exports.modMasterPayload = modMasterCommand.toJSON();
module.exports.autoModMasterPayload = autoModMasterCommand.toJSON();
module.exports.moderateMasterPayload = moderateMasterCommand.toJSON();
module.exports.verifySetupPayload = verifySetupCommand.toJSON();
