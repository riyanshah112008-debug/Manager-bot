// ==========================================
// 🧠 STARRY SUPREME AI PROTOCOL & SYSTEM ENGINE
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
    ChannelType,
    MessageFlags
} = require('discord.js');
const { GoogleGenAI } = require('@google/genai');
const { provisionMasterServerStructure } = require('./masterChannelSystems');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// Safely Require MongoDB Models
let ServerSettings, ChestChannel, BoostChannel;
try {
    ServerSettings = require('../models/ServerSettings');
    ChestChannel = require('../models/ChestChannel');
    BoostChannel = require('../models/BoostChannel');
} catch (e) {
    // Models loaded dynamically if needed
}

// Multi-API Key Support (Comma-separated process.env.GEMINI_API_KEY)
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

// Fail-Safe Generator with Retries & Exponential Backoff
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
        console.log('✅ Supreme Starry Protocol & AI Engine Loaded (500+ Lines Active)'); 
    });

    // ==========================================
    // 🛡️ 1. AUTOMOD ENGINE: ANTI-MASS PING DETECTOR
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || !message.member) return;

        const rawPingMatches = message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || [];
        const userMentionCount = message.mentions.users.size;
        const roleMentionCount = message.mentions.roles.size;
        const everyoneMention = message.mentions.everyone ? 1 : 0;
        
        const totalPings = Math.max(
            userMentionCount + roleMentionCount + everyoneMention,
            rawPingMatches.length
        );

        const PING_LIMIT = 5;

        if (totalPings >= PING_LIMIT) {
            const botMember = message.guild.members.me;

            if (botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.delete().catch(() => {});
            }

            const durationMs = 10 * 60 * 1000;
            const caseId = Math.floor(Math.random() * 90000) + 10000;
            const reason = `Automated Anti-Mass Ping (${totalPings} mentions in single message)`;

            if (
                botMember.permissions.has(PermissionFlagsBits.ModerateMembers) &&
                message.member.roles.highest.position < botMember.roles.highest.position &&
                message.author.id !== message.guild.ownerId
            ) {
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

                const warningMsg = await message.channel.send(
                    `🛡️ **AutoMod Triggered:** <@${message.author.id}> was timed out for **10 minutes** due to Mass Mentioning (${totalPings} pings)! ${dmSent ? '*(User Notified)*' : ''}`
                ).catch(() => null);

                if (warningMsg) {
                    setTimeout(() => warningMsg.delete().catch(() => {}), 6000);
                }

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
    // 🎵 MUSIC & VOICE CONTROL INTERACTION ENGINE
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        const customId = interaction.customId;

        // Music & DJ Panel Controls
        if (['music_pause', 'music_skip', 'music_stop', 'music_loop', 'dj_vol_down', 'dj_vol_up', 'dj_lock', 'dj_unlock'].includes(customId)) {
            const guild = interaction.guild;
            if (!guild) return;

            const member = interaction.member;
            const voiceChannel = member?.voice?.channel;
            const player = client.manager ? client.manager.getPlayer(guild.id) : null;

            if (!voiceChannel && customId !== 'dj_refresh_panel') {
                return interaction.reply({ content: '❌ You must be connected to a voice channel to use music controls!', flags: [EPHEMERAL_FLAG] });
            }

            if (!player) {
                return interaction.reply({ content: '❌ No active audio player found in this server!', flags: [EPHEMERAL_FLAG] });
            }

            await interaction.deferUpdate().catch(() => {});

            try {
                if (customId === 'music_pause') {
                    player.pause(!player.paused);
                } else if (customId === 'music_skip') {
                    player.skip();
                } else if (customId === 'music_stop') {
                    player.destroy();
                } else if (customId === 'music_loop') {
                    const nextLoop = player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none';
                    player.setLoop(nextLoop);
                } else if (customId === 'dj_vol_down') {
                    const newVol = Math.max(10, player.volume - 10);
                    player.setVolume(newVol);
                } else if (customId === 'dj_vol_up') {
                    const newVol = Math.min(100, player.volume + 10);
                    player.setVolume(newVol);
                } else if (customId === 'dj_lock') {
                    await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
                } else if (customId === 'dj_unlock') {
                    await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
                }
            } catch (err) {
                console.error('Music Control Error:', err);
            }
        }
    });

    // ==========================================
    // 🧠 MASTER SETUP ENGINE ROUTER (/setup-starry)
    // ==========================================
    const handleStarrySetup = async (interaction) => {
        if (!interaction.guild) return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Only Administrators can run `/setup-starry`.', flags: [EPHEMERAL_FLAG] });
        }

        const botMember = interaction.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) || 
            !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: '❌ I need **Manage Channels** and **Manage Roles** permissions to build your server layout!', flags: [EPHEMERAL_FLAG] });
        }

        await interaction.deferReply();

        const rawPrompt = interaction.options ? interaction.options.getString('prompt') : null;
        const ownerPrompt = rawPrompt && rawPrompt.trim().length > 0 ? rawPrompt.trim() : null;

        try {
            await interaction.editReply({ 
                content: ownerPrompt 
                    ? `🧠 **Starry Neural AI Active...**\nBuilding custom themed infrastructure for: *"${ownerPrompt}"* + Security Protocol...` 
                    : `🛡️ **Starry Infrastructure Engine Active...**\nBuilding pure Security, Governance, Incident Management & Protocol channels...` 
            });

            // Hand off directly to masterChannelSystems provisioner
            const result = await provisionMasterServerStructure(interaction, client, ownerPrompt);

            const reportEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✨ Autonomous Server Setup Complete!')
                .setDescription(ownerPrompt 
                    ? `Server successfully configured for theme **"${ownerPrompt}"** with full security infrastructure!` 
                    : `Pure High-Security, Governance & Protocol Infrastructure Deployed! (No general, lounge, or gaming channels created)`)
                .addFields(
                    { name: '🛡️ Security Gatekeeper', value: `Created **${result.verifiedRole}** role. Unverified members are isolated to \`#verify-here\`.`, inline: false },
                    { name: '📁 Infrastructure Built', value: `Deployed **${result.totalCategories} Categories** & **${result.totalChannels} Security Channels**.`, inline: false }
                )
                .setFooter({ text: 'Starry Master Protocol • High-Security Architecture', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            return interaction.editReply({ content: null, embeds: [reportEmbed] });

        } catch (error) {
            console.error('❌ Starry Setup Error:', error);
            return interaction.editReply({ content: `❌ Setup failed: \`${error.message}\`. Ensure my bot role has Administrator permissions!` });
        }
    };

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === 'setup-starry') {
            await handleStarrySetup(interaction);
        }
    });

    client.on('starrySetup', handleStarrySetup);
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

        try { 
            await member.send({ embeds: [modEmbed] }); 
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
                .setDescription('**Owner-Only Text Commands:**\n\n` .sysinfo ` - Bot stats.\n` .eval <code> ` - Run raw JS.')
                .setFooter({ text: 'Starry Developer CLI' });
            try {
                await message.author.send({ embeds: [devEmbed] });
                return message.reply('📬 Sent developer CLI guide to your DMs!').catch(() => {});
            } catch (err) { return message.reply('❌ Could not DM you!').catch(() => {}); }
        }

        if (text === '.sysinfo') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            return message.reply(`📊 **Starry System Info:**\n- **RAM:** ${memory} MB\n- **Uptime:** ${(process.uptime() / 3600).toFixed(2)} Hours\n- **Ping:** ${client.ws.ping}ms\n- **Servers:** ${client.guilds.cache.size}`).catch(()=>{});
        }

        if (text.startsWith('.eval ')) {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            try {
                let evaled = eval(message.content.slice(6));
                if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
                return message.reply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``).catch(()=>{});
            } catch (err) { return message.reply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``).catch(()=>{}); }
        }
    });
                               // ==========================================
    // 🎛️ INTERACTIVE DEV PANEL (UI)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton() && ['social_hug_back', 'social_kiss_back', 'social_pat_back'].includes(interaction.customId)) {
            return; 
        }

        const isDevCommand = interaction.isChatInputCommand() && interaction.commandName === 'devpanel';
        const isDevButton = interaction.isButton() && interaction.customId.startsWith('dev_');
        const isDevModal = interaction.isModalSubmit() && interaction.customId.startsWith('modal_');

        if (isDevCommand || isDevButton || isDevModal) {
            if (!client.isOwner(interaction.user.id)) {
                if (interaction.isRepliable()) return interaction.reply({ content: '❌ **Access Denied:** You are not recognized as a bot owner!', flags: [EPHEMERAL_FLAG] });
                return;
            }
        }

        if (isDevCommand) {
            const embed = new EmbedBuilder()
                .setTitle('💻 Starry Developer Control Panel')
                .setDescription('Select an operation below.')
                .setColor('#5865F2')
                .setFooter({ text: 'Powered by Starry Protocol • Authorized Personnel Only' });

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_sysinfo').setLabel('System Info').setStyle(ButtonStyle.Primary).setEmoji('📊'),
                new ButtonBuilder().setCustomId('dev_servers').setLabel('Server List').setStyle(ButtonStyle.Primary).setEmoji('🌐')
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_eval_btn').setLabel('Eval JS').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                new ButtonBuilder().setCustomId('dev_broadcast_btn').setLabel('Broadcast').setStyle(ButtonStyle.Success).setEmoji('📢')
            );

            return interaction.reply({ embeds: [embed], components: [row1, row2], flags: [EPHEMERAL_FLAG] });
        }

        if (interaction.isButton() && interaction.customId.startsWith('dev_')) {
            const id = interaction.customId;
            if (id === 'dev_sysinfo') {
                const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                return interaction.reply({ content: `📊 **Starry System Info:**\n- **RAM:** ${memory} MB\n- **Uptime:** ${(process.uptime() / 3600).toFixed(2)} Hours\n- **Ping:** ${client.ws.ping}ms`, flags: [EPHEMERAL_FLAG] });
            }
            if (id === 'dev_servers') {
                let serverList = `🌐 **Starry is in ${client.guilds.cache.size} servers:**\n\n`;                
                client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount).forEach(g => { serverList += `🔹 **${g.name}** (${g.memberCount} members)\n`; });
                return interaction.reply({ content: serverList.slice(0, 1999), flags: [EPHEMERAL_FLAG] });
            }
            if (id === 'dev_eval_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_eval').setTitle('Execute JavaScript').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('eval_code').setLabel('Code to evaluate').setStyle(TextInputStyle.Paragraph).setRequired(true))));
            if (id === 'dev_broadcast_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_broadcast').setTitle('Global Server Broadcast').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('broadcast_msg').setLabel('Announcement Message').setStyle(TextInputStyle.Paragraph).setRequired(true))));
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_')) {
            const id = interaction.customId;
            if (id === 'modal_eval') { 
                await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }); 
                try { 
                    let evaled = eval(interaction.fields.getTextInputValue('eval_code')); 
                    if (typeof evaled !== "string") evaled = require("util").inspect(evaled); 
                    return interaction.editReply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``); 
                } catch (err) { 
                    return interaction.editReply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``); 
                } 
            }
            if (id === 'modal_broadcast') { 
                await interaction.deferReply({ flags: [EPHEMERAL_FLAG] }); 
                const msg = interaction.fields.getTextInputValue('broadcast_msg'); 
                let count = 0; 
                client.guilds.cache.forEach(guild => { 
                    const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages')); 
                    if (channel) { channel.send(`📢 **System Announcement:**\n\n>>> ${msg}`).catch(()=>{}); count++; } 
                }); 
                return interaction.editReply(`✅ Broadcast sent to ${count} servers!`); 
            }
        }
    });
       // ==========================================
    // 🤖 AI & NLP PRE-PARSER MODERATION ENGINE
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
        const isImagine = text.startsWith('.imagine ');
        const mentionsBot = message.mentions.has(client.user.id);
        const hasName = text.includes(triggerWord) || text.includes('jarvis');
        const isOwner = client.isOwner(message.author.id);
        let isReplyToBot = false;

        if (message.reference) {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(()=>null);
            if (refMsg && refMsg.author.id === client.user.id) isReplyToBot = true;
        }

        if (!isImagine && !mentionsBot && !hasName && !isReplyToBot) return;

        const botMember = message.guild ? message.guild.members.me : null;

        // A. TIMEOUT PRE-PARSER
        const timeoutRegex = /timeout\s+<@!?(\d+)>\s*(?:for\s*)?(\d+)\s*(m|min|mins|minute|minutes|h|hr|hours|d|day|days)?/i;
        const timeoutMatch = message.content.match(timeoutRegex);

        if (timeoutMatch && message.guild) {
            if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) || !botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return message.reply("❌ You or I lack **Moderate Members** permission.");
            }
            const targetId = timeoutMatch[1];
            const amount = parseInt(timeoutMatch[2]) || 1;
            const unit = (timeoutMatch[3] || 'm').toLowerCase();
            let durationMs = amount * 60 * 1000;
            if (unit.startsWith('h')) durationMs = amount * 60 * 60 * 1000;
            if (unit.startsWith('d')) durationMs = amount * 24 * 60 * 60 * 1000;

            const tMember = await message.guild.members.fetch(targetId).catch(() => null);
            if (!tMember) return message.reply("❌ Target member not found in server.");

            if (tMember.id === message.guild.ownerId) return message.reply("❌ I cannot moderate the **Server Owner**!");
            if (tMember.id === client.user.id) return message.reply("❌ I cannot moderate **myself**!");

            if (tMember.roles.highest.position >= botMember.roles.highest.position) {
                return message.reply(`❌ Cannot moderate **${tMember.user.tag}** because their role is higher than or equal to mine!`);
            }

            const caseId = Math.floor(Math.random() * 90000) + 10000;
            const dmSent = await client.sendPremiumModDM(tMember, message.member, 'timeout', 'Direct Staff Command', `${amount} ${unit}`, message.guild, caseId);

            await tMember.timeout(durationMs, `Requested by ${message.author.tag}`).catch(() => {});
            return message.reply(`⏰ Timed out <@${targetId}> for ${amount} ${unit}. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
        }

        // B. CREATE ROLE PRE-PARSER
        const createRoleRegex = /(?:create|make|add) (?:a |an )?(?:role|role named) ([\w\s\-_]+)/i;
        const roleMatch = message.content.match(createRoleRegex);

        if (roleMatch && message.guild) {
            const roleName = roleMatch[1].trim();
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return message.reply('❌ Missing **Manage Roles** permission.');
            }
            try {
                const newRole = await message.guild.roles.create({ name: roleName, reason: `Requested by ${message.author.tag}` });
                return message.reply(`✅ Successfully created role **${newRole.name}**!`);
            } catch (err) {
                return message.reply(`❌ Failed to create role: \`${err.message}\``);
            }
        }

        // C. CLEAR / PURGE PRE-PARSER
        const clearRegex = /(?:clear|purge|delete)\s+(\d+)\s*(?:messages)?/i;
        const clearMatch = message.content.match(clearRegex);

        if (clearMatch && message.guild) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) || !botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('❌ Missing **Manage Messages** permission.');
            }
            const count = parseInt(clearMatch[1]);
            if (count <= 0) return message.reply('❌ Please specify a valid number of messages to clear.');
            const deleteCount = Math.min(count, 99) + 1;
            await message.channel.bulkDelete(deleteCount, true).catch(() => {});
            return message.channel.send(`🧹 Successfully cleared ${count} messages!`).then(m => setTimeout(() => m.delete().catch(() => {}), 3500));
                }
                        // ==========================================
        // D. POLLINATIONS AI IMAGE GENERATOR
        // ==========================================
        const imageRegex = /(?:create|generate|draw|make|paint) (?:an? |some )?(?:image|picture|drawing|art|photo) (?:of )?(.*)/i;
        let isImageRequest = isImagine;
        let imagePrompt = "";

        if (isImagine) {
            imagePrompt = message.content.slice(9).trim();
        } else if (hasName || mentionsBot) {
            const match = message.content.match(imageRegex);
            if (match) { isImageRequest = true; imagePrompt = match[1].trim(); }
        }

        if (isImageRequest) {
            if (!imagePrompt) return message.reply('❌ Please tell me what to draw!').catch(() => {});
            const replyMsg = await message.reply('🎨 Painting your picture... Please wait.').catch(() => null);
            if (!replyMsg) return;
            try {
                const safePrompt = encodeURIComponent(imagePrompt.replace(/[^a-zA-Z0-9\s]/g, ''));
                const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&nologo=true`;
                await message.reply({ 
                    content: `🖼️ **"${imagePrompt}"**\nGenerated by ${message.author}`, 
                    files: [{ attachment: imageUrl, name: `${displayName}_AI_Art.png` }] 
                }).catch(() => {});
                return await replyMsg.delete().catch(() => {});
            } catch (error) { 
                return replyMsg.edit('❌ I had trouble drawing that. Try a simpler prompt.').catch(() => {}); 
            }
        }

        // ==========================================
        // E. CONVERSATIONAL GEMINI NLP RESPONSE ENGINE
        // ==========================================
        await message.channel.sendTyping().catch(() => {});

        try {
            const prompt = `[SYSTEM INSTRUCTION]\nYou are ${displayName}, a helpful Discord AI companion.\nRULE 1: To moderate: [CMD:KICK|ID:123|REASON:spam] (Supported: KICK, BAN, UNBAN, CLEAR, TIMEOUT, UNTIMEOUT).\nRULE 2: To manage roles: [CMD:CREATEROLE|NAME:role_name] or [CMD:GIVEROLE|USER_ID:123|ROLE_ID:456].\nRULE 3: Keep responses concise and direct.\n\n[USER MESSAGE]\n${message.author.username} says: ${message.content}`;

            let replyText = await generateAIResponseWithRetry(prompt);

            let functionName = null; 
            let args = {};

            const cmdMatch = replyText.match(/\[.*?CMD:(KICK|BAN|UNBAN|CLEAR|TIMEOUT|UNTIMEOUT|GIVEROLE|REMOVEROLE|CREATEROLE|DELETEROLE)(?:\|(.*?))?\]/i);
            if (cmdMatch) {
                const action = cmdMatch[1].toUpperCase(); 
                const params = (cmdMatch[2] || '').split('|');
                const getParam = (key) => (params.find(p => p.toUpperCase().startsWith(key)) || '').split(':')[1]?.trim() || '';

                if (action === 'CREATEROLE') { functionName = 'create_role'; args.roleName = getParam('NAME') || getParam('ROLE'); }
                else if (action === 'CLEAR') { functionName = 'clear_messages'; args.amount = parseInt(getParam('AMOUNT')) || 10; }
                else if (action === 'TIMEOUT') { functionName = 'timeout_member'; args.userId = getParam('ID'); args.minutes = parseInt(getParam('MINUTES')) || 2; args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'UNTIMEOUT') { functionName = 'untimeout_member'; args.userId = getParam('ID'); }
                else if (action === 'UNBAN') { functionName = 'unban_member'; args.userId = getParam('ID'); }
                else if (action === 'KICK' || action === 'BAN') { functionName = action.toLowerCase() + '_member'; args.userId = getParam('ID'); args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'GIVEROLE' || action === 'REMOVEROLE') { functionName = action === 'GIVEROLE' ? 'give_role' : 'remove_role'; args.userId = getParam('USER_ID'); args.roleId = getParam('ROLE_ID'); }

                replyText = replyText.replace(cmdMatch[0], '').trim();
            }

            if (functionName) {
                const botMember = message.guild ? message.guild.members.me : null;
                const hasPerm = (perm) => message.member && message.member.permissions.has(perm) && botMember.permissions.has(perm);

                if (functionName === "create_role" && hasPerm(PermissionFlagsBits.ManageRoles)) {
                    const newRole = await message.guild.roles.create({ name: args.roleName || 'new-role' }).catch(() => null);
                    if (newRole) await message.reply(`✅ Created role **${newRole.name}**!`);
                }

                if (functionName === "clear_messages" && hasPerm(PermissionFlagsBits.ManageMessages)) {
                    const deleteCount = Math.min(args.amount, 99) + 1;
                    await message.channel.bulkDelete(deleteCount, true).catch(() => {});
                    await message.channel.send(`🧹 Successfully cleared ${args.amount} messages!`).then(m => setTimeout(() => m.delete().catch(() => {}), 3500));
                }

                const tId = (args.userId || '').replace(/\D/g, '');
                if (tId && message.guild) {
                    const tMember = await message.guild.members.fetch(tId).catch(() => null);

                    if (tMember && tMember.id !== message.guild.ownerId && tMember.id !== client.user.id) {
                        const isHigher = tMember.roles.highest.position >= botMember.roles.highest.position;

                        if (!isHigher) {
                            if (functionName === "timeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                                const caseId = Math.floor(Math.random() * 90000) + 10000;
                                const dmSent = await client.sendPremiumModDM(tMember, message.member, 'timeout', args.reason, `${args.minutes} minutes`, message.guild, caseId);
                                await tMember.timeout(args.minutes * 60 * 1000, args.reason).catch(() => {}); 
                                await message.reply(`⏰ Timed out <@${tId}> for ${args.minutes}m. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                            }

                            if (functionName === "kick_member" && hasPerm(PermissionFlagsBits.KickMembers)) {
                                const caseId = Math.floor(Math.random() * 90000) + 10000;
                                const dmSent = await client.sendPremiumModDM(tMember, message.member, 'kick', args.reason, null, message.guild, caseId);
                                await tMember.kick(args.reason).catch(() => {});
                                await message.reply(`👢 Kicked <@${tId}>. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                            }

                            if (functionName === "ban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                                const caseId = Math.floor(Math.random() * 90000) + 10000;
                                const dmSent = await client.sendPremiumModDM(tMember, message.member, 'ban', args.reason, 'Permanent', message.guild, caseId, 'https://discord.com');
                                await tMember.ban({ reason: args.reason }).catch(() => {});
                                await message.reply(`🔨 Banned <@${tId}>. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                            }
                        }
                    }
                }
            }

            if (replyText && replyText.trim().length > 0) {
                const textChunks = replyText.trim().match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) {
                    await message.reply(chunk).catch(() => {});
                }
            }

        } catch (error) {
            console.error("Gemini AI error:", error.message || error);
            return message.reply(`⏳ **High Demand Notice:** Google AI servers are experiencing a temporary traffic spike. Please try again in a few seconds!`).catch(() => {});
        }
    }); 
};
