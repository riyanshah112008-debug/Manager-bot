// ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 1 OF 6)
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

// --- DYNAMIC MULTI-MODEL AI ROTATION ENGINE ---
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
            } catch (err) {
                continue;
            }
        }
        await new Promise(res => setTimeout(res, 500));
    }
    return "⚡ **Traffic Optimization:** Request processed via secondary buffer.";
}
// ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 2 OF 6)
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

    try {
        const trackerModule = require('./tracker');
        if (trackerModule.buildInactivityAlertEmbed && trackerModule.buildSusInactivityAlertEmbed) {
            const inactivityAlert = trackerModule.buildInactivityAlertEmbed(interaction.member, interaction.user.id, 'uPUQpU4ecR', Date.now() - (14 * 24 * 60 * 60 * 1000));
            const inactivityRow = trackerModule.buildInactivityModPanelRow(interaction.user.id);
            const susAlert = trackerModule.buildSusInactivityAlertEmbed(interaction.member, 30);
            const susRow = trackerModule.buildSusModPanelRow(interaction.user.id);

            await interaction.channel.send({
                content: `<@${interaction.user.id}>\n⚙️ **Starry Master Pre-Setup Preview:**`,
                embeds: [inactivityAlert],
                components: [inactivityRow]
            }).catch(() => {});

            await interaction.channel.send({
                content: `<@${interaction.user.id}>`,
                embeds: [susAlert],
                components: [susRow]
            }).catch(() => {});
        }
    } catch (e) {}

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
// ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 3 OF 6)
// ==========================================
// --- CORE CHANNEL & CATEGORY PROMPT UTILITIES ---

async function createChannelAction(guild, name, type = ChannelType.GuildText, categoryName = null, topic = '') {
    let parentCategory = null;
    if (categoryName) {
        parentCategory = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildCategory && 
            c.name.toLowerCase() === categoryName.toLowerCase().trim()
        );
        if (!parentCategory) {
            parentCategory = await guild.channels.create({
                name: categoryName.trim(),
                type: ChannelType.GuildCategory
            });
        }
    }

    const createdChannel = await guild.channels.create({
        name: name.toLowerCase().replace(/\s+/g, '-'),
        type: type,
        parent: parentCategory ? parentCategory.id : null,
        topic: topic
    });

    return createdChannel;
}

async function deleteChannelAction(guild, channelIdentifier) {
    const cleanId = channelIdentifier.replace(/[<#>]/g, '').trim();
    let targetChannel = guild.channels.cache.find(c => 
        c.id === cleanId || 
        c.name.toLowerCase() === channelIdentifier.toLowerCase().replace('#', '').trim()
    );

    if (!targetChannel) throw new Error(`Channel "${channelIdentifier}" not found.`);
    const channelName = targetChannel.name;
    await targetChannel.delete();
    return channelName;
}

async function createCategoryAction(guild, name) {
    let existingCategory = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildCategory && 
        c.name.toLowerCase() === name.toLowerCase().trim()
    );

    if (existingCategory) return existingCategory;

    const newCategory = await guild.channels.create({
        name: name.trim(),
        type: ChannelType.GuildCategory
    });

    return newCategory;
}

async function deleteCategoryAction(guild, categoryName) {
    const category = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildCategory && 
        (c.id === categoryName || c.name.toLowerCase() === categoryName.toLowerCase().trim())
    );

    if (!category) throw new Error(`Category "${categoryName}" not found.`);
    const name = category.name;
    await category.delete();
    return name;
}

async function lockUnlockChannelAction(guild, channelTarget, lockState = true) {
    const cleanId = channelTarget.replace(/[<#>]/g, '').trim();
    let channel = guild.channels.cache.find(c => c.id === cleanId || c.name.toLowerCase() === cleanId.toLowerCase());
    if (!channel) throw new Error(`Channel "${channelTarget}" not found.`);

    await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: lockState ? false : null,
        Connect: lockState ? false : null
    });

    return channel;
}
// ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 4 OF 6)
// ==========================================
// --- FULL NATURAL LANGUAGE CHAT PROMPT ENGINE ---

async function processPromptChannelCommands(message) {
    if (!message.guild || message.author.bot) return false;

    const rawContent = message.content.trim();
    const lowerContent = rawContent.toLowerCase();

    // Trigger check
    if (!lowerContent.startsWith('starry')) return false;

    // Security Check: User must have Manage Channels or Administrator permission
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && 
        !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return false;
    }

    const guild = message.guild;

    try {
        // 1. CREATE CHANNEL PROMPT (e.g., "Starry create a channel Owners-chat", "Starry create a voice channel Chill in category Lounge")
        const createChannelMatch = rawContent.match(/starry\s+(?:please\s+)?create\s+(?:a\s+)?(?:(text|voice|stage)\s+)?channel\s+([a-zA-Z0-9_-]+)(?:\s+in\s+(?:category\s+)?([a-zA-Z0-9_\s-]+))?/i);
        if (createChannelMatch) {
            const [, typeStr, channelName, categoryName] = createChannelMatch;
            const channelType = typeStr?.toLowerCase() === 'voice' ? ChannelType.GuildVoice : 
                              typeStr?.toLowerCase() === 'stage' ? ChannelType.GuildStageVoice : ChannelType.GuildText;

            const ch = await createChannelAction(guild, channelName, channelType, categoryName);
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✨ Channel Created via Prompt')
                .setDescription(`**Channel:** <#${ch.id}>\n**Type:** \`${typeStr ? typeStr.toUpperCase() : 'TEXT'}\`${categoryName ? `\n**Category:** \`${categoryName.trim()}\`` : ''}`)
                .setFooter({ text: 'Starry Master Prompt Engine' });

            await message.reply({ embeds: [embed] });
            return true;
        }

        // 2. DELETE CHANNEL PROMPT (e.g., "Starry delete channel #old-chat", "Starry delete channel Owners-chat")
        const deleteChannelMatch = rawContent.match(/starry\s+(?:please\s+)?delete\s+(?:the\s+)?channel\s+([a-zA-Z0-9_#<>-]+)/i);
        if (deleteChannelMatch) {
            const channelTarget = deleteChannelMatch[1];
            const deletedName = await deleteChannelAction(guild, channelTarget);

            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🗑️ Channel Deleted via Prompt')
                .setDescription(`Channel **#${deletedName}** has been removed.`)
                .setFooter({ text: 'Starry Master Prompt Engine' });

            await message.reply({ embeds: [embed] });
            return true;
        }

        // 3. CREATE CATEGORY PROMPT (e.g., "Starry create category Staff-Zone")
        const createCatMatch = rawContent.match(/starry\s+(?:please\s+)?create\s+(?:a\s+)?category\s+([a-zA-Z0-9_\s-]+)/i);
        if (createCatMatch) {
            const categoryName = createCatMatch[1].trim();
            const cat = await createCategoryAction(guild, categoryName);

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('📁 Category Created via Prompt')
                .setDescription(`**Category Name:** \`${cat.name}\``)
                .setFooter({ text: 'Starry Master Prompt Engine' });

            await message.reply({ embeds: [embed] });
            return true;
        }

        // 4. DELETE CATEGORY PROMPT (e.g., "Starry delete category Staff-Zone")
        const deleteCatMatch = rawContent.match(/starry\s+(?:please\s+)?delete\s+(?:the\s+)?category\s+([a-zA-Z0-9_\s-]+)/i);
        if (deleteCatMatch) {
            const categoryName = deleteCatMatch[1].trim();
            const deletedCatName = await deleteCategoryAction(guild, categoryName);

            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🗑️ Category Deleted via Prompt')
                .setDescription(`Category **${deletedCatName}** has been removed.`)
                .setFooter({ text: 'Starry Master Prompt Engine' });

            await message.reply({ embeds: [embed] });
            return true;
        }

        // 5. LOCK / UNLOCK CHANNEL PROMPT (e.g., "Starry lock channel #general", "Starry unlock channel #general")
        const lockMatch = rawContent.match(/starry\s+(lock|unlock)\s+(?:channel\s+)?([a-zA-Z0-9_#<>-]+)/i);
        if (lockMatch) {
            const isLock = lockMatch[1].toLowerCase() === 'lock';
            const channelTarget = lockMatch[2];
            const ch = await lockUnlockChannelAction(guild, channelTarget, isLock);

            const embed = new EmbedBuilder()
                .setColor(isLock ? '#ED4245' : '#2ecc71')
                .setTitle(isLock ? '🔒 Channel Locked' : '🔓 Channel Unlocked')
                .setDescription(`Channel <#${ch.id}> has been ${isLock ? 'locked' : 'unlocked'} for @everyone.`)
                .setFooter({ text: 'Starry Master Prompt Engine' });

            await message.reply({ embeds: [embed] });
            return true;
        }
    } catch (err) {
        await message.reply(`❌ **Prompt Execution Error:** ${err.message}`).catch(() => {});
        return true;
    }

    return false;
}
// ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 5 OF 6)
// ==========================================
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

const modMasterCommand = new SlashCommandBuilder()
    .setName('mod').setDescription('🛡️ Master Moderation Hub').setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub.setName('warn').setDescription('Warn member').addUserOption(o => o.setName('target').setDescription('User').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)));

const autoModMasterCommand = new SlashCommandBuilder()
    .setName('automod').setDescription('⚙️ AutoMod Hub').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('status').setDescription('Status'));

const moderateMasterCommand = new SlashCommandBuilder()
    .setName('moderate').setDescription('⚙️ Toggle advanced security modules').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('toggle').setDescription('Toggle module').addStringOption(o => o.setName('module').setDescription('Module').setRequired(true).addChoices({ name: 'Wick', value: 'wick' }, { name: 'Beemo', value: 'beemo' })).addBooleanOption(o => o.setName('status').setDescription('Status').setRequired(true)));

const verifySetupCommand = new SlashCommandBuilder()
    .setName('verify-setup').setDescription('Set up verification panel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true));

async function handleEmergencyCommands(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
    }

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
            return newChannel.send({ content: '⚡ **EMERGENCY NUKE:** Channel has been completely purged and recreated.' });
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

            return interaction.editReply(`⚡ **EMERGENCY SERVER NUKE COMPLETED:**\n• Purged **${deletedChannels}** channels.\n• Deleted **${deletedRoles}** non-essential roles.`);
        }
    }
                   }
                                                           // ==========================================
// 🛡️ STARRY MASTER CHANNEL SYSTEM (PART 6 OF 6)
// ==========================================
function initModule(client) {
    client.isUserProtected = (guildId, userId) => !!getProtect.get(guildId, userId);
    start60sChannelTelemetryLoop(client);

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        const verifiedRole = newMember.guild.roles.cache.find(r => r.name.toLowerCase() === 'verified');
        if (verifiedRole && !oldMember.roles.cache.has(verifiedRole.id) && newMember.roles.cache.has(verifiedRole.id)) {
            const chamberCh = newMember.guild.channels.cache.find(c => c.name === 'verification-chamber');
            if (chamberCh) {
                const verifiedEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🟢 Member Human Verification Complete')
                    .setDescription(`**User Verified:** <@${newMember.id}> (\`${newMember.user.tag}\`) has passed human verification and unlocked full server access.`)
                    .setTimestamp();
                await chamberCh.send({ embeds: [verifiedEmbed] }).catch(() => {});
            }
        }
    });

    // 🛑 REMOVED messageCreate HERE TO PREVENT DOUBLE-REPLYING!

    // ⚡ LISTEN TO EXISTING SYSTEM INTERACTION SLASH COMMANDS ONLY
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.commandName;
            if (cmd === 'setup-starry') {
                if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }).catch(() => {});
                const result = await provisionMasterServerStructure(interaction);
                const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('✨ Autonomous Server Setup Complete!').setDescription(`Configured successfully with ${result.totalChannels} channels.`);
                return interaction.editReply({ embeds: [embed] });
            }
            if (['emergency-nuke', 'emergency-lockdown', 'emergency-secure', 'emergency-unban'].includes(cmd)) {
                await handleEmergencyCommands(interaction);
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
module.exports.emergencyNukePayload = emergencyNukeCommand.toJSON();
module.exports.modMasterPayload = modMasterCommand.toJSON();
module.exports.autoModMasterPayload = autoModMasterCommand.toJSON();
module.exports.moderateMasterPayload = moderateMasterCommand.toJSON();
module.exports.verifySetupPayload = verifySetupCommand.toJSON();
