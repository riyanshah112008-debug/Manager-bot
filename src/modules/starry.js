// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 1 OF 4)
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
    AttachmentBuilder,
    AuditLogEvent
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const mongoose = require('mongoose');

const EPHEMERAL_FLAG = MessageFlags ? MessageFlags.Ephemeral : 6;
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
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 2 OF 4)
// File Path: modules/starry.js
// ==========================================

function createWickLogEmbed({ title, emoji, color, target, moderator, reason, duration, expiresAt, caseId, extraFields = [], guild }) {
    const embed = new EmbedBuilder()
        .setColor(color || '#ED4245')
        .setAuthor({ 
            name: `${emoji ? emoji + ' ' : ''}${title}`, 
            iconURL: target?.displayAvatarURL ? target.displayAvatarURL({ dynamic: true }) : (guild?.iconURL({ dynamic: true }) || null)
        });

    if (target) {
        const targetTag = target.tag || (target.user ? target.user.tag : target.username || 'Unknown User');
        const targetId = target.id || 'N/A';
        embed.addFields({ name: '👤 Target User', value: `<@${targetId}> (\`${targetTag}\`)\n**User ID:** \`${targetId}\``, inline: false });
    }

    if (moderator) {
        const modTag = moderator.tag || (moderator.user ? moderator.user.tag : moderator.username || 'System Automation');
        const modId = moderator.id || 'N/A';
        embed.addFields({ name: '🛡️ Moderator', value: `<@${modId}> (\`${modTag}\`)\n**Moderator ID:** \`${modId}\``, inline: false });
    }

    if (caseId) embed.addFields({ name: '🏷️ Case ID', value: `\`#${caseId}\``, inline: true });
    if (duration) embed.addFields({ name: '⏳ Duration', value: `\`${duration}\``, inline: true });
    if (expiresAt) {
        const timestamp = Math.floor(new Date(expiresAt).getTime() / 1000);
        embed.addFields({ name: '⏰ Until', value: `<t:${timestamp}:F> (<t:${timestamp}:R>)`, inline: true });
    }
    if (reason) embed.addFields({ name: '📝 Reason', value: `>>> ${reason}`, inline: false });

    for (const field of extraFields) embed.addFields(field);

    embed.setFooter({ text: `Starry Security Engine`, iconURL: guild?.iconURL({ dynamic: true }) || null });
    embed.setTimestamp();
    return embed;
}

async function deployActiveModulePanel(channel, moduleType, verifiedRole) {
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    const existingMsg = messages ? messages.find(m => m.author.id === channel.guild.client.user.id && (m.components.length > 0 || m.embeds.length > 0)) : null;

    let embed = new EmbedBuilder().setColor('#2b2d31');
    let components = [];

    if (moduleType === 'verification') {
        embed.setColor('#2ecc71').setTitle('🛡️ Server Web Verification Portal').setDescription('Welcome! Human verification is required before full channel access is granted.\n\nClick the button below to generate your secure verification link.');
        components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`verify_role_${verifiedRole?.id || 'active'}`).setLabel('Get Verification Link').setStyle(ButtonStyle.Primary).setEmoji('🌐'))];
    } else if (moduleType === 'tickets') {
        // UNIFIED 3-BUTTON MASTER PANEL
        embed.setColor('#00F2FE')
            .setTitle('🎫 Support, Staff & Partnership Portal')
            .setDescription(
                'Welcome! Choose an option below to proceed:\n\n' +
                '• **📩 Open Support Ticket:** Opens a private channel with staff.\n' +
                '• **🛡️ Apply for Staff:** Opens moderator & staff application form.\n' +
                '• **🤝 Request Partnership:** Opens server partnership request form.'
            )
            .setFooter({ text: 'Starry Master System' });

        components = [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sys_create_ticket').setLabel('Open Support Ticket').setStyle(ButtonStyle.Primary).setEmoji('📩'),
            new ButtonBuilder().setCustomId('sys_apply_staff').setLabel('Apply for Staff').setStyle(ButtonStyle.Success).setEmoji('🛡️'),
            new ButtonBuilder().setCustomId('sys_apply_partner').setLabel('Request Partnership').setStyle(ButtonStyle.Secondary).setEmoji('🤝')
        )];
    } else if (moduleType === 'status_monitor') {
        embed.setColor('#2ecc71').setTitle('🟢 Autonomous Network Telemetry & Uptime Hub').addFields({ name: 'Metrics Update', value: '`Loops every 60 seconds`', inline: true }, { name: 'Monitored Assets', value: '`Members • RAM Heap • Ping • Modules`', inline: true });
    }

    if (existingMsg) {
        // Remote auto-updater: upgrades 2-button panels to 3-button panels dynamically
        if (components.length > 0) {
            await existingMsg.edit({ embeds: [embed], components }).catch(() => {});
        }
    } else {
        if (components.length > 0) {
            await channel.send({ embeds: [embed], components }).catch(() => {});
        } else if (embed.data.title) {
            await channel.send({ embeds: [embed] }).catch(() => {});
        }
    }
}
// ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 3 OF 4)
// File Path: modules/starry.js
// ==========================================

async function getOrCreateCategory(guild, name, overwrites = []) {
    let cat = guild.channels.cache.find(c => c.name.toLowerCase() === name.toLowerCase() && c.type === ChannelType.GuildCategory);
    if (!cat) {
        cat = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
    }
    return cat;
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

    const govCat = await getOrCreateCategory(guild, '🛡️ SECURITY & GOVERNANCE', [showEveryone, botFullControl]);
    await createNonDuplicatingActiveChannel(guild, { name: 'rules-and-info', parent: govCat.id, permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'announcements', parent: govCat.id, permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);
    await createNonDuplicatingActiveChannel(guild, { name: 'server-status-monitor', parent: govCat.id, moduleType: 'status_monitor', permissionOverwrites: [showEveryone, botFullControl] }, verifiedRole);

    const supportCat = await getOrCreateCategory(guild, '🎫 SUPPORT & APPLICATIONS');
    await createNonDuplicatingActiveChannel(guild, { name: 'verify-here', parent: supportCat.id, moduleType: 'verification', permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }, { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }, botFullControl] }, verifiedRole);
    
    // Deploys the 3-button unified portal into #open-a-ticket
    await createNonDuplicatingActiveChannel(guild, { name: 'open-a-ticket', parent: supportCat.id, moduleType: 'tickets', permissionOverwrites: [hideEveryone, showVerified, botFullControl] }, verifiedRole);

    const sysCat = await getOrCreateCategory(guild, '🚨 INCIDENT & SECURITY LOGS', [hideEveryone, staffFullControl, botFullControl]);
    const sysChannels = ['logs-access', 'logs-moderate', 'logs-messages', 'logs-voice', 'logs-channels', 'logs-members'];
    for (const name of sysChannels) {
        await createNonDuplicatingActiveChannel(guild, { name, parent: sysCat.id, permissionOverwrites: [hideEveryone, staffFullControl, botFullControl] }, verifiedRole);
    }

    if (ServerSettings) {
        await ServerSettings.findOneAndUpdate({ guildId: String(guild.id) }, { setupCompleted: true, verifiedRoleId: verifiedRole.id }, { upsert: true });
    }
    return { verifiedRole: verifiedRole.name, totalCategories: 3, totalChannels: 10 };
}

const setupStarryCommand = new SlashCommandBuilder()
    .setName('setup-starry')
    .setDescription('✨ Autonomous Server Setup with 3-in-1 Support & Application Portal')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
                                                    // ==========================================
// 🧠 STARRY SUPREME MASTER AI ENGINE (PART 4 OF 4)
// File Path: modules/starry.js
// ==========================================

module.exports = async (client) => {
    if (client.starryEngineInitialized) return;
    client.starryEngineInitialized = true;

    // Dynamic routing to specific log channels
    client.getLogChannel = async (guild, logType = 'misc') => {
        if (!guild) return null;
        const typeMap = {
            'access': ['logs-access', 'join-logs'],
            'moderate': ['logs-moderate', 'mod-logs'],
            'messages': ['logs-messages', 'chat-logs'],
            'voice': ['logs-voice', 'vc-logs'],
            'channels': ['logs-channels', 'channel-logs'],
            'members': ['logs-members', 'role-logs']
        };
        const targetNames = typeMap[logType.toLowerCase()] || typeMap['access'];
        let ch = guild.channels.cache.find(c => c && c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name)));
        if (ch) return ch;
        return guild.channels.cache.find(c => c.name.includes('log')) || null;
    };

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.guild) return;

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'setup-starry') {
                await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
                try {
                    const result = await provisionMasterServerStructure(interaction);
                    const embed = new EmbedBuilder()
                        .setColor('#2ecc71')
                        .setTitle('✨ Autonomous Server Setup Complete!')
                        .setDescription(`Deployed **3-in-1 Master Portal** and standard security channels.`);
                    return interaction.editReply({ embeds: [embed] });
                } catch (err) {
                    return interaction.editReply({ content: `❌ **Setup failed:** \`${err.message}\`` });
                }
            }
        }
    });
};

module.exports.provisionMasterServerStructure = provisionMasterServerStructure;
module.exports.generateAIResponseWithRetry = generateAIResponseWithRetry;
module.exports.setupStarryPayload = setupStarryCommand.toJSON();
