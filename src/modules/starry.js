// ==========================================
// 1. IMPORTS, INITIALIZATION & KEY ROTATION
// ==========================================
const { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ChannelType
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

// Safely require MongoDB models with fallback handling
let ServerSettings, ChestChannel, BoostChannel;
try {
    ServerSettings = require('../models/ServerSettings');
    ChestChannel = require('../models/ChestChannel');
    BoostChannel = require('../models/BoostChannel');
} catch (e) {
    // Models loaded dynamically if needed
}

// Multi-API Key Support (Comma-separated in process.env.GEMINI_API_KEY)
const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextAIClient() {
    if (apiKeys.length === 0) return null;
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return new GoogleGenAI({ apiKey: key });
}

// Preferred Models Fallback Chain
const AI_MODELS = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp',
    'gemini-1.0-pro'
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
                const isRateLimit = errStatus === 429 || errStatus === 503 || (err.message && err.message.includes('high demand'));

                if (isRateLimit && attempt < 3) {
                    await sleep(attempt * 1000);
                    continue;
                }
                break;
            }
        }
    }

    throw lastError || new Error('All AI models are currently busy.');
}

const blacklistedUsers = new Set();

module.exports = (client) => {

    client.on('clientReady', () => { 
        console.log('✅ Starry Protocol Module Loaded (Powered by upgraded Gemini Engine!)'); 
    });

    // ==========================================
    // 🛡️ 1. AUTOMOD ENGINE: ANTI-MASS PING DETECTOR
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || !message.member) return;

        // Count raw text pings using regex to prevent workaround via role/user formatting
        const rawPingMatches = message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || [];
        const userMentionCount = message.mentions.users.size;
        const roleMentionCount = message.mentions.roles.size;
        const everyoneMention = message.mentions.everyone ? 1 : 0;
        
        // Use highest count calculated between API parsing and raw text parsing
        const totalPings = Math.max(
            userMentionCount + roleMentionCount + everyoneMention,
            rawPingMatches.length
        );

        // Trigger AutoMod if mentions are 5 or more
        const PING_LIMIT = 5;

        if (totalPings >= PING_LIMIT) {
            const botMember = message.guild.members.me;

            // Delete the mass-ping message immediately
            if (botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.delete().catch(() => {});
            }

            // Timeout the offending user for 10 minutes
            const durationMs = 10 * 60 * 1000;
            const caseId = Math.floor(Math.random() * 90000) + 10000;
            const reason = `Automated Anti-Mass Ping (${totalPings} mentions in single message)`;

            if (
                botMember.permissions.has(PermissionFlagsBits.ModerateMembers) &&
                message.member.roles.highest.position < botMember.roles.highest.position &&
                message.author.id !== message.guild.ownerId
            ) {
                // Send DM Notice
                const dmSent = await client.sendPremiumModDM(
                    message.member,
                    botMember,
                    'timeout',
                    reason,
                    '10 minutes',
                    message.guild,
                    caseId
                );

                await message.member.timeout(durationMs, reason).catch(() => {});

                // Send public warning alert in channel
                const warningMsg = await message.channel.send(
                    `🛡️ **AutoMod Triggered:** <@${message.author.id}> was timed out for **10 minutes** due to Mass Mentioning (${totalPings} pings)! ${dmSent ? '*(User Notified)*' : ''}`
                ).catch(() => null);

                if (warningMsg) {
                    setTimeout(() => warningMsg.delete().catch(() => {}), 6000);
                }

                // Log to moderation log channel
                const modLogChannel = client.getLogChannel(message.guild, 'moderate');
                if (modLogChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#ED4245')
                        .setTitle('🛡️ AutoMod Action: Anti-Mass Ping')
                        .addFields(
                            { name: 'Offender', value: `<@${message.author.id}> (\`${message.author.id}\`)`, inline: true },
                            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                            { name: 'Total Mentions', value: `\`${totalPings}\``, inline: true },
                            { name: 'Action Taken', value: '`Message Deleted + 10m Timeout`', inline: true },
                            { name: 'Case ID', value: `\`#${caseId}\``, inline: true }
                        )
                        .setTimestamp();

                    await modLogChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }
        }
    });
    // ==========================================
    // 🔄 FORCE COMMAND REGISTRATION WITH DISCORD
    // ==========================================
    client.on('ready', async () => {
        try {
            console.log('🔄 Forcing Slash Command Sync with Discord API...');

            await client.application.commands.create({
                name: 'setup-starry',
                description: '🧠 MASTER COMMAND: Scans your server and links EVERY feature to the correct channels.',
                default_member_permissions: '8' // Administrator
            });

            await client.application.commands.create({
                name: 'ahelp',
                description: 'Displays the complete Admin & Moderation Command Menu',
                default_member_permissions: '8192' 
            });

            console.log('✅ Master commands successfully registered with Discord API!');
        } catch (err) {
            console.error('❌ Failed to register commands:', err);
        }
    });

    // ==========================================
    // 👑 MULTI-OWNER VERIFICATION HELPER
    // ==========================================
    client.isOwner = (userId) => {
        const defaultOwners = ['1465049039153135639', '1257676837249617971'];
        const envOwners = (process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(id => id.length > 0);
        const allOwners = [...new Set([...defaultOwners, ...envOwners])];
        return allOwners.includes(userId);
    };

    // ==========================================
    // 🧭 UNIVERSAL SMART LOG ROUTING ENGINE
    // ==========================================
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

        let channel = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name))
        );
        if (channel) return channel;

        channel = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildText && (
                c.name === 'logs-server' ||
                c.name === 'server-logs' ||
                c.name === 'mod-logs' ||
                c.name === 'bot-logs' ||
                c.name === 'system-logs' ||
                c.name === 'logs' ||
                c.name === 'general-logs'
            )
        );

        return channel || null;
    };

    // ==========================================
    // 🧠 MASTER COMMAND: /setup-starry
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setup-starry') return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Only Administrators can run `/setup-starry`.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🧠 Starry Master Configuration Engine')
            .setDescription(
                '**Initiate Global Server Sync?**\n\n' +
                'My brain will scan your channels and automatically configure:\n' +
                '🛡️ **Security:** Verification & Logs\n' +
                '👋 **Community:** Welcomes, Starboard & Suggestions\n' +
                '🎫 **Support:** Tickets, Appeals & Applications\n' +
                '🎁 **Economy:** Loot Chests & Boosts\n\n' +
                '*This will wire my internal systems directly into your server layout.*'
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('master_confirm').setLabel('SYNC SERVER').setStyle(ButtonStyle.Success).setEmoji('🧠'),
            new ButtonBuilder().setCustomId('master_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        const filter = i => i.user.id === interaction.user.id;

        try {
            const confirmation = await response.awaitMessageComponent({ filter, time: 30000 });
            if (confirmation.customId === 'master_cancel') {
                return confirmation.update({ content: '🚫 Master sync aborted.', embeds: [], components: [] });
            }

            await confirmation.update({ content: '🧠 **SCANNING NEURAL NETWORK (CHANNELS)...**', embeds: [], components: [] });

            const guild = interaction.guild;
            const channels = guild.channels.cache;
            let report = [];

            try {
                if (!ServerSettings) ServerSettings = require('../models/ServerSettings');
                await ServerSettings.findOneAndUpdate({ guildId: guild.id }, { triggerWord: 'Starry' }, { upsert: true });
                report.push(`⚙️ **Identity:** Trigger word set to \`Starry\``);
            } catch (err) {}

            const welcome = channels.find(c => c.name.includes('welcome'));
            if (welcome) report.push(`👋 **Welcomes:** Linked to <#${welcome.id}>`);

            const starboard = channels.find(c => c.name.includes('starboard'));
            if (starboard) report.push(`⭐ **Starboard:** Linked to <#${starboard.id}>`);

            const suggestions = channels.find(c => c.name.includes('suggestions') || c.name.includes('ideas'));
            if (suggestions) report.push(`💡 **Suggestions:** Linked to <#${suggestions.id}>`);

            const logChannels = channels.filter(c => c.name.includes('logs-') || c.name.includes('-logs'));
            if (logChannels.size > 0) {
                report.push(`🗂️ **Smart Logging:** Successfully mapped **${logChannels.size}** log channels.`);
            }

            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ Neural Sync Complete')
                .setDescription(`I have successfully scanned the server, identified the purpose of each channel, and linked my systems!\n\n${report.join('\n')}`)
                .setFooter({ text: 'Starry Master Brain', iconURL: client.user.displayAvatarURL() });

            await interaction.followUp({ embeds: [successEmbed], ephemeral: true });

        } catch (e) {
            console.error('Master Sync Error:', e);
            await interaction.editReply({ content: '⚠️ Command timed out or encountered an error. Setup aborted.', embeds: [], components: [] }).catch(() => {});
        }
    });
    // ==========================================
    // 💎 PREMIUM MODERATION DM ENGINE
    // ==========================================
    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A', appealLink = null) => {
        if (!member || !member.user || member.user.bot) return false;

        const actionType = action.toLowerCase();
        const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guild.id, member.id) : false;

        if (!isGuildPremium) {
            const basicEmbed = new EmbedBuilder()
                .setColor('#2F3136')
                .setTitle(`⚠️ Moderation Notice: ${actionType.toUpperCase()}`)
                .setDescription(`You have received a moderation action in **${guild.name}**.`)
                .addFields(
                    { name: 'Action', value: actionType.toUpperCase(), inline: true },
                    { name: 'Reason', value: reason || 'No reason provided.', inline: true }
                )
                .setFooter({ text: `${guild.name} • Upgrade server to Premium for enhanced notices.` })
                .setTimestamp();
            try { 
                await member.send({ embeds: [basicEmbed] }); 
                return true; 
            } catch (err) { 
                return false; 
            }
        }

        let embedColor, actionTitle, actionEmoji, durationDisplay;
        switch(actionType) {
            case 'ban': embedColor = '#ED4245'; actionTitle = 'Server Ban Notice'; actionEmoji = '🔨'; durationDisplay = duration ? `\`${duration}\`` : '`Permanent`'; break;
            case 'kick': embedColor = '#FEE75C'; actionTitle = 'Server Kick Notice'; actionEmoji = '👢'; durationDisplay = '`Immediate`'; break;
            case 'timeout': embedColor = '#5865F2'; actionTitle = 'Server Timeout Notice'; actionEmoji = '⏱️'; durationDisplay = duration ? `\`${duration}\`` : '`Unknown`'; break;
            default: embedColor = '#95A5A6'; actionTitle = 'Moderation Notice'; actionEmoji = '🛡️'; durationDisplay = '`N/A`';
        }

        const modEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: `${guild.name} | Security & Moderation`, iconURL: guild.iconURL({ dynamic: true }) })
            .setTitle(`${actionEmoji} ${actionTitle}`)
            .setDescription(`Hello **${member.user.username}**, you have received a formal moderation action in **${guild.name}**.\n\nPlease review the details below carefully.`)
            .addFields(
                { name: '👤 Moderator', value: `\`${moderator.user ? moderator.user.username : 'Starry AutoMod'}\``, inline: true },
                { name: '🛡️ Action', value: `\`${actionType.charAt(0).toUpperCase() + actionType.slice(1)}\``, inline: true },
                { name: '🏷️ Case ID', value: `\`#${caseId}\``, inline: true },
                { name: '📝 Reason for Action', value: `>>> ${reason || 'No specific reason was provided.'}`, inline: false },
                { name: '⏳ Duration', value: durationDisplay, inline: true },
                { name: '📅 Time of Action', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
            )
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
            .setFooter({ text: `💎 Premium Automated Notice`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const components = [];
        const row = new ActionRowBuilder();
        if (['ban', 'timeout'].includes(actionType) && appealLink) {
            row.addComponents(new ButtonBuilder().setLabel('Submit Appeal').setURL(appealLink).setStyle(ButtonStyle.Link).setEmoji('⚖️'));
        }
        if (actionType !== 'ban') {
            row.addComponents(new ButtonBuilder().setLabel('Read Server Rules').setURL('https://discord.com').setStyle(ButtonStyle.Link).setEmoji('📜'));
        }
        if (row.components.length > 0) components.push(row);

        try { 
            await member.send({ embeds: [modEmbed], components: components }); 
            return true; 
        } catch (error) { 
            return false; 
        }
    };

    // ==========================================
    // 📡 DEVELOPER CLI TEXT COMMANDS
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        const text = message.content.toLowerCase();
        const isOwner = client.isOwner(message.author.id);
        const notOwnerMsg = "❌ **Access Denied:** You are not recognized as a bot owner!";

        if (text === '.dev') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const devEmbed = new EmbedBuilder()
                .setColor('#2C2F33')
                .setTitle('💻 Starry Developer Menu')
                .setDescription('**Owner-Only Text Commands:**\n\n` .sysinfo ` - Bot stats.\n` .eval <code> ` - Run raw JS.\n` .broadcast <msg> ` - Global broadcast.')
                .setFooter({ text: 'Starry Developer CLI' });
            try {
                await message.author.send({ embeds: [devEmbed] });
                return message.reply('📬 Sent the developer CLI guide to your DMs!').catch(() => {});
            } catch (err) { return message.reply('❌ I couldn\'t DM you!').catch(() => {}); }
        }

        if (text === '.sysinfo') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            return message.reply(`📊 **Starry System Info:**\n- **RAM Usage:** ${memory} MB\n- **Uptime:** ${(process.uptime() / 3600).toFixed(2)} Hours\n- **Ping:** ${client.ws.ping}ms\n- **Servers:** ${client.guilds.cache.size}`).catch(()=>{});
        }
    });
    // ==========================================
    // 🤖 AI & NLP MODERATION ENGINE
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        let triggerWord = 'starry';
        let displayName = 'Starry'; 

        if (message.guild) {
            try {
                if (!ServerSettings) ServerSettings = require('../models/ServerSettings');
                const settings = await ServerSettings.findOne({ guildId: message.guild.id });
                if (settings && settings.triggerWord) {
                    triggerWord = settings.triggerWord.toLowerCase();
                    displayName = settings.triggerWord;
                }
            } catch (err) {}
        }

        const text = message.content.toLowerCase().trim();
        const mentionsBot = message.mentions.has(client.user.id);
        const hasName = text.includes(triggerWord);
        const isOwner = client.isOwner(message.author.id);
        let isReplyToBot = false;

        if (message.reference) {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(()=>null);
            if (refMsg && refMsg.author.id === client.user.id) isReplyToBot = true;
        }

        if (!mentionsBot && !hasName && !isReplyToBot) return;

        if (!isOwner && (!message.guild || (typeof client.isPremium === 'function' && !client.isPremium(message.guild.id, message.author.id)))) {
            return message.reply('❌ **AI is a Premium feature!** Contact the bot owner to upgrade this server.').catch(() => {});
        }

        await message.channel.sendTyping().catch(() => {});

        try {
            const prompt = `[SYSTEM INSTRUCTION]\nYou are ${displayName}, a helpful Discord AI companion.\nKeep responses concise and direct.\n\n[USER MESSAGE]\n${message.author.username} says: ${message.content}`;
            let replyText = await generateAIResponseWithRetry(prompt);

            if (replyText && replyText.trim().length > 0) {
                const textChunks = replyText.trim().match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) {
                    await message.reply(chunk).catch(() => {});
                }
            }
        } catch (error) {
            console.error("Gemini AI error:", error.message || error);
            return message.reply(`⏳ **High Demand Notice:** Google AI servers are currently experiencing a temporary traffic spike. Please try again in a few seconds!`).catch(() => {});
        }
    }); 
};
// ==========================================
// 🔧 0. CRITICAL AUDIO ENGINE FIX & IMPORTS
// ==========================================
process.env.FFMPEG_PATH = require('ffmpeg-static');

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Collection, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
const express = require('express');
const cors = require('cors'); 
const https = require('https'); 
const mongoose = require('mongoose'); 
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const fs = require('fs');
const path = require('path');
const KazagumoSpotify = require('kazagumo-spotify');

// Import ServerListing model safely from bumpEngine
const bumpEngine = require('./modules/bumpEngine');
const ServerListing = bumpEngine.ServerListing || mongoose.models.ServerListing;

// ==========================================
// 1. WEB SERVER & DASHBOARD HOSTING
// ==========================================
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

app.get('/api/servers', async (req, res) => {
    try {
        if (!ServerListing) return res.json([]);
        const servers = await ServerListing.find({ isListed: true }).sort({ lastBump: -1 }).limit(50);
        res.json(servers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch servers' });
    }
});

app.get('/health', (req, res) => res.status(200).send('awake'));

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web Dashboard & Server listening on port ${port}`);
});

// ==========================================
// 2. DISCORD CLIENT INITIALIZATION
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
}); 

client.setMaxListeners(50);
client.commands = new Collection(); 
client.prefixCommands = new Collection();
client.verifyMap = new Map(); 
client.voiceCalls = new Map();

// Global Anti-Mass Mention Gatekeeper
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;

    const rawPings = (message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || []).length;
    const parsedPings = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
    const totalPings = Math.max(rawPings, parsedPings);

    if (totalPings >= 5) {
        const botMember = message.guild.members.me;

        if (message.author.id === message.guild.ownerId) return;
        if (message.member.roles.highest.position >= botMember.roles.highest.position) return;

        if (botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await message.delete().catch(() => {});
        }

        if (botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            await message.member.timeout(10 * 60 * 1000, `Mass Ping AutoMod (${totalPings} mentions)`).catch(() => {});
            
            const warn = await message.channel.send(`🛡️ **AutoMod:** <@${message.author.id}> was timed out for 10 minutes for mass mentioning (${totalPings} pings)!`).catch(() => null);
            if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
        }
    }
});
// ==========================================
// 3. 24/7 MULTI-NODE LAVALINK MUSIC ENGINE SETUP
// ==========================================
const Nodes = [
    {
        name: 'Jirayu-Node-v4',
        url: 'lavalink.jirayu.net:13592',
        auth: 'youshallnotpass',
        secure: false,
        retryAmount: 5,
        retryDelay: 5000
    },
    {
        name: 'Lavalink-v4-Primary',
        url: 'lava-v4.ajiehospitality.com:443',
        auth: 'https://discord.gg/vM3e3U389y',
        secure: true,
        retryAmount: 3,
        retryDelay: 5000
    }
];

client.manager = new Kazagumo({
    defaultSearchEngine: "youtube",
    searchFallbacks: { soundcloud: "scsearch", youtube: "ytsearch" },
    plugins: [
        new KazagumoSpotify({ 
            clientId: process.env.SPOTIFY_CLIENT_ID || 'dummy_id', 
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'dummy_secret', 
            playlistPageLimit: 2, 
            searchMarket: 'IN', 
            searchPrefix: 'ytsearch:' 
        })
    ],
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes, {
    voiceConnectionTimeout: 30000,
    linkInitializers: true,
    reconnectTries: 5,
    restTimeout: 10000
});

client.manager.shoukaku.on('ready', (name) => console.log(`[Lavalink] Connected to node: ${name}`));
client.manager.shoukaku.on('error', () => {}); 
client.manager.shoukaku.on('disconnect', () => {});

// ==========================================
// 4. GLOBAL ERROR CATCHERS & COMMAND LOADER
// ==========================================
client.on(Events.Error, err => console.error('❌ Discord Client Error:', err));
client.on(Events.Warn, warn => console.warn('⚠️ Discord Warning:', warn));
client.on(Events.ShardError, err => console.error('❌ WebSocket/Network Error:', err));
process.on('unhandledRejection', error => console.error('❌ Unhandled Promise Rejection:', error.stack || error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error.stack || error));

client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
});

// ==========================================
// 5. INTERACTION ENGINE
// ==========================================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.guild && !interaction.isChatInputCommand()) return;

    const moduleCommands = [
        'premiumcheck', 'activatepremium', 'deactivatepremium', 'removepremium', 
        'setlogs', 'tracker', 'set-listing', 'bump-setup', 'bump', 'autobump',
        'setup-starry', 'ahelp', 'setupwelcome', 'modpanel',
        'rep', 'checkrep', 'leaderboard', 'social'
    ];
    if (interaction.isChatInputCommand() && moduleCommands.includes(interaction.commandName)) {
        return; 
    }

    const command = client.commands.get(interaction.commandName);
    if (command) {
        try {
            await command.execute(interaction, client);
        } catch (err) {
            console.error(`❌ Error in /${interaction.commandName}:`, err);
        }
    }
});
// ==========================================
// 6. RESILIENT MASTER MODULE LOADER
// ==========================================
const loadModule = (name, filePath) => {
    try { 
        // Resolve absolute path to prevent 'Cannot find module' crashes
        const absolutePath = path.resolve(__dirname, filePath);
        
        if (!fs.existsSync(absolutePath)) {
            console.log(`⚠️ Optional module skipped: ${name} (File not present at ${filePath})`);
            return;
        }

        const mod = require(absolutePath);
        if (typeof mod === 'function') {
            mod(client, app);
            console.log(`✅ ${name} Module Loaded`); 
        } else {
            console.log(`✅ ${name} Module Loaded (Object Export)`);
        }
    } catch (err) { 
        console.error(`❌ Failed to load ${name}:`, err.message); 
    }
};

async function startBot() {
    if (!process.env.MONGO_URI || !process.env.TOKEN) {
        console.error("🛑 CRITICAL ERROR: MONGO_URI or TOKEN missing!");
        process.exit(1);
    }
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🍃 Successfully connected to MongoDB Cloud!');

        const mods = [
            ['Moderation', './modules/moderation.js'], 
            ['Automod', './modules/automod.js'], 
            ['Media Only', './modules/mediaOnly.js'],
            ['Premium', './modules/premium.js'], 
            ['Translator', './modules/translator.js'], 
            ['Reaction Roles', './modules/reactionRoles.js'],
            ['Help', './modules/help.js'], 
            ['Leveling', './modules/leveling.js'], 
            ['Starry Protocol', './modules/starry.js'],
            ['Boost Tracker', './modules/boostTracker.js'], 
            ['Truth or Dare', './modules/truthOrDare.js'], 
            ['Support Tickets', './modules/tickets.js'],
            ['Admin Help Text Trigger', './modules/ahelpText.js'], 
            ['Warnings DB', './modules/warnings.js'], 
            ['Tracker', './modules/tracker.js'],
            ['Sus Account Detector', './modules/susAccount.js'], 
            ['Whois Lookup', './modules/whois.js'], 
            ['Emoji Blocker', './modules/emojiBlocker.js'],
            ['Message Purger', './modules/clear.js'], 
            ['Master Setup Engine', './modules/masterSetupText.js'], 
            ['Server Stats', './modules/serverStats.js'], 
            ['AFK System', './modules/afk.js'], 
            ['Server Logs', './modules/logs.js'], 
            ['Giveaway', './modules/giveaway.js'], 
            ['Counting Game', './modules/count.js'], 
            ['Advanced Mod & Security', './modules/advancedMod.js'], 
            ['Interactive Mod Panel', './modules/modPanel.js'], 
            ['Reputation System', './modules/rep.js'], 
            ['Voice Channel Manager', './modules/voiceManager.js'], 
            ['Emoji Stealer', './modules/steal.js'], 
            ['Welcome System', './modules/welcome.js'], 
            ['User Protection', './modules/protect.js'], 
            ['Goodbye System', './modules/goodbye.js'], 
            ['Server Backup Engine', './modules/backupEngine.js'], 
            ['Role Manager', './modules/roleManager.js'], 
            ['Anti-Abuse', './modules/antiAbuse.js'], 
            ['Random Chest Drops', './modules/chestDrop.js'], 
            ['Autorole & Sticky Roles', './modules/autorole.js'], 
            ['Verification System', './modules/verification.js'], 
            ['Auto Bump Engine', './modules/bumpEngine.js'], 
            ['Network Telemetry Engine', './modules/telemetryEngine.js'],
            ['Social Actions Engine', './modules/socialActions.js']
        ];
        
        // Dynamically load every module safely without breaking start sequence
        mods.forEach(([name, filePath]) => loadModule(name, filePath));

        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error("🛑 FATAL BOOTSTRAP ERROR:\n", error.stack || error);
        process.exit(1);
    }
}

startBot();
