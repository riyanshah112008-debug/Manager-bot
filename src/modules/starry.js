// ==========================================
// 🧠 STARRY SUPREME AI PROTOCOL ENGINE
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

// Safely Require Models
let ServerSettings;
try {
    ServerSettings = require('../models/ServerSettings');
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
    'gemini-2.0-flash-exp'
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
                if (response && response.text && response.text.trim().length > 0) {
                    return response.text.trim();
                }
            } catch (err) {
                lastError = err;
                if (attempt < 3) { await sleep(attempt * 1000); continue; }
                break;
            }
        }
    }
    throw lastError || new Error('All AI models are currently busy.');
}
    const blacklistedUsers = new Set();

module.exports = (client) => {

    client.on('clientReady', () => { 
        console.log('✅ Supreme Starry AI Engine Active!'); 
    });

    // Anti-Mass Mention AutoMod Pre-Gatekeeper
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot || !message.member) return;

        const rawPingMatches = message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || [];
        const userMentionCount = message.mentions.users.size;
        const roleMentionCount = message.mentions.roles.size;
        const everyoneMention = message.mentions.everyone ? 1 : 0;
        
        const totalPings = Math.max(userMentionCount + roleMentionCount + everyoneMention, rawPingMatches.length);
        if (totalPings >= 5) {
            const botMember = message.guild.members.me;

            if (botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await message.delete().catch(() => {});
            }

            if (botMember.permissions.has(PermissionFlagsBits.ModerateMembers) &&
                message.member.roles.highest.position < botMember.roles.highest.position &&
                message.author.id !== message.guild.ownerId) {

                await message.member.timeout(10 * 60 * 1000, `AutoMod Mass Ping (${totalPings} mentions)`).catch(() => {});
                
                const warningMsg = await message.channel.send(`🛡️ **AutoMod:** <@${message.author.id}> was timed out for 10 minutes for mass mentioning (${totalPings} pings)!`).catch(() => null);
                if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => {}), 6000);
            }
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
            'access': ['logs-access', 'join-logs'],
            'moderate': ['logs-moderate', 'mod-logs'],
            'messages': ['logs-messages', 'chat-logs'],
            'voice': ['logs-voice', 'vc-logs'],
            'channels': ['logs-channels'],
            'members': ['logs-members'],
            'misc': ['logs-misc', 'bot-logs']
        };
        const targetNames = typeMap[logType.toLowerCase()] || typeMap['misc'];
        return guild.channels.cache.find(c => c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name))) || null;
    };
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
            // Premium Moderation DM Engine
    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A') => {
        if (!member || !member.user || member.user.bot) return false;
        const basicEmbed = new EmbedBuilder()
            .setColor('#2F3136')
            .setTitle(`⚠️ Moderation Notice: ${action.toUpperCase()}`)
            .setDescription(`You received a moderation action in **${guild.name}**.`)
            .addFields(
                { name: 'Action', value: action.toUpperCase(), inline: true },
                { name: 'Reason', value: reason || 'No reason provided.', inline: true }
            )
            .setFooter({ text: `${guild.name}` })
            .setTimestamp();
        try { await member.send({ embeds: [basicEmbed] }); return true; } catch (err) { return false; }
    };

    // Developer CLI Text Commands (.dev, .sysinfo, .eval)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;
        const text = message.content.toLowerCase();
        const isOwner = client.isOwner(message.author.id);

        if (text === '.dev') {
            if (!isOwner) return message.reply("❌ **Access Denied:** Owner command only.").catch(()=>{});
            return message.reply('💻 **Developer Commands:** `.sysinfo`, `.eval <code>`').catch(()=>{});
        }

        if (text === '.sysinfo') {
            if (!isOwner) return message.reply("❌ Access Denied.").catch(()=>{});
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            return message.reply(`📊 **RAM:** ${memory} MB | **Uptime:** ${(process.uptime() / 3600).toFixed(2)}h | **Ping:** ${client.ws.ping}ms`).catch(()=>{});
        }

        if (text.startsWith('.eval ')) {
            if (!isOwner) return message.reply("❌ Access Denied.").catch(()=>{});
            try {
                let evaled = eval(message.content.slice(6));
                if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
                return message.reply(`\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``).catch(()=>{});
            } catch (err) { return message.reply(`\`\`\`xl\n${err}\n\`\`\``).catch(()=>{}); }
        }
    });
        // Developer Control Panel Interactivity
    client.on('interactionCreate', async (interaction) => {
        const isDevCommand = interaction.isChatInputCommand() && interaction.commandName === 'devpanel';
        const isDevButton = interaction.isButton() && interaction.customId.startsWith('dev_');
        const isDevModal = interaction.isModalSubmit() && interaction.customId.startsWith('modal_');

        if (isDevCommand || isDevButton || isDevModal) {
            if (!client.isOwner(interaction.user.id)) {
                if (interaction.isRepliable()) return interaction.reply({ content: '❌ **Access Denied:** Owner only!', flags: [EPHEMERAL_FLAG] });
                return;
            }
        }

        if (isDevCommand) {
            const embed = new EmbedBuilder().setTitle('💻 Starry Developer Panel').setDescription('Select an operation below.').setColor('#5865F2');
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_sysinfo').setLabel('System Info').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('dev_servers').setLabel('Server List').setStyle(ButtonStyle.Primary)
            );
            return interaction.reply({ embeds: [embed], components: [row1], flags: [EPHEMERAL_FLAG] });
        }

        if (interaction.isButton() && interaction.customId.startsWith('dev_')) {
            if (interaction.customId === 'dev_sysinfo') {
                const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                return interaction.reply({ content: `📊 **RAM:** ${memory} MB | **Uptime:** ${(process.uptime() / 3600).toFixed(2)}h`, flags: [EPHEMERAL_FLAG] });
            }
            if (interaction.customId === 'dev_servers') {
                return interaction.reply({ content: `🌐 Active in **${client.guilds.cache.size}** servers.`, flags: [EPHEMERAL_FLAG] });
            }
        }
    });
        // AI NLP Chat Engine & Art Generator
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        let triggerWord = 'starry';
        if (message.guild) {
            try {
                if (!ServerSettings) ServerSettings = require('../models/ServerSettings');
                const settings = await ServerSettings.findOne({ guildId: message.guild.id });
                if (settings && settings.triggerWord) triggerWord = settings.triggerWord.toLowerCase();
            } catch (err) {}
        }

        const text = message.content.toLowerCase().trim();
        const isImagine = text.startsWith('.imagine ');
        const mentionsBot = message.mentions.has(client.user.id);
        const hasName = text.includes(triggerWord);

        if (!isImagine && !mentionsBot && !hasName) return;

        // Image Generation
        if (isImagine) {
            const promptStr = message.content.slice(9).trim();
            if (!promptStr) return message.reply('❌ Please specify what to draw!').catch(() => {});
            
            const replyMsg = await message.reply('🎨 Painting your picture...').catch(() => null);
            try {
                const safePrompt = encodeURIComponent(promptStr.replace(/[^a-zA-Z0-9\s]/g, ''));
                const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&nologo=true`;
                await message.reply({ content: `🖼️ **"${promptStr}"**`, files: [{ attachment: imageUrl, name: 'Starry_Art.png' }] }).catch(() => {});
                return await replyMsg?.delete().catch(() => {});
            } catch (err) {
                return replyMsg?.edit('❌ Failed to generate image.').catch(() => {});
            }
        }

        // Conversational AI Response
        await message.channel.sendTyping().catch(() => {});
        try {
            const aiPrompt = `You are Starry, a Discord AI Assistant. Answer concisely:\nUser: ${message.author.username}\nMessage: ${message.content}`;
            const replyText = await generateAIResponseWithRetry(aiPrompt);
            return message.reply(replyText.slice(0, 1950)).catch(() => {});
        } catch (err) {
            return message.reply('⏳ AI servers are experiencing high demand. Please retry in a few seconds.').catch(() => {});
        }
    });
};
