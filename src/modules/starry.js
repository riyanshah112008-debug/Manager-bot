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

// Safely require MongoDB models
let ServerSettings, ChestChannel, BoostChannel;
try {
    ServerSettings = require('../models/ServerSettings');
    ChestChannel = require('../models/ChestChannel');
    BoostChannel = require('../models/BoostChannel');
} catch (e) {}

// Multi-API Key Support
const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextAIClient() {
    if (apiKeys.length === 0) return null;
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return new GoogleGenAI({ apiKey: key });
}

const AI_MODELS = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp',
    'gemini-1.0-pro'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateAIResponseWithRetry(prompt) {
    if (apiKeys.length === 0) throw new Error('Missing GEMINI_API_KEY environment variable.');
    let lastError = null;

    for (const modelName of AI_MODELS) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const ai = getNextAIClient();
                const response = await ai.models.generateContent({ model: modelName, contents: prompt });
                if (response?.text?.trim().length > 0) return response.text.trim();
            } catch (err) {
                lastError = err;
                const errStatus = err.status || err.statusCode || (err.message?.includes('503') ? 503 : 0);
                if ((errStatus === 429 || errStatus === 503) && attempt < 3) {
                    await sleep(attempt * 1000);
                    continue;
                }
                break;
            }
        }
    }
    throw lastError || new Error('All AI models busy.');
}

const blacklistedUsers = new Set();

module.exports = (client) => {

    client.on('clientReady', () => { 
        console.log('✅ Starry Protocol Engine Ready & Active!'); 
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

            // Delete mass-ping message immediately
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

                if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => {}), 6000);

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
                default_member_permissions: '8'
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

    client.isOwner = (userId) => {
        const defaultOwners = ['1465049039153135639', '1257676837249617971'];
        const envOwners = (process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(Boolean);
        return [...new Set([...defaultOwners, ...envOwners])].includes(userId);
    };

    client.getLogChannel = (guild, logType = 'misc') => {
        if (!guild || !guild.channels) return null;
        const typeMap = {
            'access': ['logs-access', 'user-invite-logs', 'invite-logs', 'join-logs'],
            'moderate': ['logs-moderate', 'mod-logs', 'warning-logs', 'audit-logs', 'automod-logs'],
            'messages': ['logs-messages', 'message-logs', 'chat-logs'],
            'voice': ['logs-voice', 'voice-logs', 'vc-logs'],
            'misc': ['logs-misc', 'bot-logs']
        };
        const targetNames = typeMap[logType.toLowerCase()] || typeMap['misc'];
        return guild.channels.cache.find(c => c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name)))
            || guild.channels.cache.find(c => c.type === ChannelType.GuildText && ['logs-server', 'server-logs', 'mod-logs', 'bot-logs', 'logs'].includes(c.name.toLowerCase()))
            || null;
    };

    // ==========================================
    // 🧠 MASTER COMMAND: /setup-starry (DEFERRED FIX)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setup-starry') return;

        // Immediate Deferral prevents "Application Did Not Respond"
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.editReply({ content: '❌ Only Administrators can run `/setup-starry`.' });
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

        const response = await interaction.editReply({ embeds: [embed], components: [row] });
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
            if (logChannels.size > 0) report.push(`🗂️ **Smart Logging:** Successfully mapped **${logChannels.size}** log channels.`);

            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ Neural Sync Complete')
                .setDescription(`I have successfully scanned the server, identified the purpose of each channel, and linked my systems!\n\n${report.join('\n')}`)
                .setFooter({ text: 'Starry Master Brain', iconURL: client.user.displayAvatarURL() });

            await interaction.followUp({ embeds: [successEmbed], ephemeral: true });

        } catch (e) {
            await interaction.editReply({ content: '⚠️ Command timed out or encountered an error.', embeds: [], components: [] }).catch(() => {});
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
    // 🎛️ INTERACTIVE DEV PANEL & AI ENGINE
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton() && ['social_hug_back', 'social_kiss_back', 'social_pat_back'].includes(interaction.customId)) return;

        const isDevCommand = interaction.isChatInputCommand() && interaction.commandName === 'devpanel';
        if (isDevCommand) {
            if (!client.isOwner(interaction.user.id)) {
                return interaction.reply({ content: '❌ **Access Denied:** Owner only.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle('💻 Starry Developer Control Panel')
                .setDescription('Select an operation below.')
                .setColor('#5865F2');

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_sysinfo').setLabel('System Info').setStyle(ButtonStyle.Primary).setEmoji('📊'),
                new ButtonBuilder().setCustomId('dev_servers').setLabel('Server List').setStyle(ButtonStyle.Primary).setEmoji('🌐')
            );
            return interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
        }
    });

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

        if (!mentionsBot && !hasName) return;

        if (!isOwner && (!message.guild || (typeof client.isPremium === 'function' && !client.isPremium(message.guild.id, message.author.id)))) {
            return message.reply('❌ **AI is a Premium feature!** Contact the bot owner to upgrade this server.').catch(() => {});
        }

        await message.channel.sendTyping().catch(() => {});

        try {
            const prompt = `[SYSTEM INSTRUCTION]\nYou are ${displayName}, a helpful Discord AI companion.\nKeep responses concise and direct.\n\n[USER MESSAGE]\n${message.author.username} says: ${message.content}`;
            let replyText = await generateAIResponseWithRetry(prompt);

            if (replyText && replyText.trim().length > 0) {
                const textChunks = replyText.trim().match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) await message.reply(chunk).catch(() => {});
            }
        } catch (error) {
            return message.reply(`⏳ Google AI servers are experiencing temporary high demand. Please try again shortly!`).catch(() => {});
        }
    }); 
};
