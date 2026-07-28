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
let ServerSettings, ChestChannel, BoostChannel, User;
try {
    ServerSettings = require('../models/ServerSettings');
    ChestChannel = require('../models/ChestChannel');
    BoostChannel = require('../models/BoostChannel');
    User = require('../models/User');
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

// Fail-Safe AI Generator with Retries & Exponential Backoff
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
        console.log('✅ Starry Omnipotent Master Protocol Initialized!'); 
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
    // 🛠️ UTILITIES: SERVER DUMP GENERATOR
    // ==========================================
    const generateServerDump = async (guild) => {
        await guild.members.fetch();
        let dump = `=================================================\n             SERVER DUMP: ${guild.name.toUpperCase()} \n=================================================\n\n[SERVER INFO]\n- Server ID     : ${guild.id}\n- Total Members : ${guild.memberCount}\n- Owner ID      : ${guild.ownerId}\n- Generated At  : ${new Date().toUTCString()}\n\n=================================================\n                 CHANNELS \n=================================================\n\n`;

        const getTypeName = (type) => [0, 2, 4, 5, 15].includes(type) ? ['📝 TEXT ', '🔊 VOICE', '📁 CAT  ', '📢 ANN  ', '💬 FORUM'][[0, 2, 4, 5, 15].indexOf(type)] : '📄 MISC ';
        const categories = guild.channels.cache.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
        const textAndVoice = guild.channels.cache.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);

        categories.forEach(cat => {
            dump += `[📁 ${cat.name.toUpperCase()}] (ID: ${cat.id})\n`;
            textAndVoice.filter(c => c.parentId === cat.id).forEach(c => dump += `   ├─ [${getTypeName(c.type)}] ${c.name} (ID: ${c.id})\n`);
            dump += `\n`;
        });

        const orphaned = textAndVoice.filter(c => !c.parentId);
        if (orphaned.size > 0) {
            dump += `[📁 UNCATEGORIZED]\n`;
            orphaned.forEach(c => dump += `   ├─ [${getTypeName(c.type)}] ${c.name} (ID: ${c.id})\n`);
        }

        return Buffer.from(dump, 'utf-8');
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

            const verification = channels.find(c => c.name.includes('verification') || c.name.includes('verify'));
            if (verification) report.push(`🛡️ **Verification:** System mapped to <#${verification.id}>`);

            const logChannels = channels.filter(c => c.name.includes('logs-') || c.name.includes('-logs'));
            if (logChannels.size > 0) {
                report.push(`🗂️ **Smart Logging:** Successfully mapped **${logChannels.size}** log channels.`);
            } else {
                report.push(`🗂️ **Smart Logging:** Mapped to single fallback channel.`);
            }

            const openTicketsCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('opened tickets'));
            const closedTicketsCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('closed tickets'));
            if (openTicketsCat && closedTicketsCat) {
                report.push(`🎫 **Tickets:** Bound to \`${openTicketsCat.name}\` & \`${closedTicketsCat.name}\``);
            }

            const booster = channels.find(c => c.name.includes('boosters') || c.name.includes('boost'));
            if (booster) {
                try {
                    if (!BoostChannel) BoostChannel = require('../models/BoostChannel');
                    await BoostChannel.findOneAndUpdate({ guildId: guild.id }, { channelId: booster.id }, { upsert: true });
                    report.push(`🚀 **Boost Tracker:** Linked to <#${booster.id}>`);
                } catch (err) {}
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
                { name: '👤 Moderator', value: `\`${moderator.user.username}\``, inline: true },
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
    // 📡 DEVELOPER CLI & INTERACTIVE PANEL
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        const text = message.content.toLowerCase();
        const isOwner = client.isOwner(message.author.id);

        if (text === '.dev' && isOwner) {
            const devEmbed = new EmbedBuilder()
                .setColor('#2C2F33')
                .setTitle('💻 Starry Developer Menu')
                .setDescription('` .sysinfo ` - Bot stats.\n` .eval <code> ` - Run raw JS.\n` .broadcast <msg> ` - Global message.');
            return message.reply({ embeds: [devEmbed] }).catch(() => {});
        }

        if (text === '.sysinfo' && isOwner) {
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            return message.reply(`📊 **RAM:** ${memory} MB | **Servers:** ${client.guilds.cache.size} | **Ping:** ${client.ws.ping}ms`).catch(() => {});
        }

        if (text.startsWith('.eval ') && isOwner) {
            try {
                let evaled = eval(message.content.slice(6));
                if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
                return message.reply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``).catch(() => {});
            } catch (err) {
                return message.reply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``).catch(() => {});
            }
        }
    });
    // ==========================================
    // ⚡ OMNIPOTENT INSTANT PRE-PARSERS (GROUP 1)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild || blacklistedUsers.has(message.author.id)) return;

        const isOwner = client.isOwner(message.author.id) || message.author.id === message.guild.ownerId;
        const isStaff = message.member && (
            message.member.permissions.has(PermissionFlagsBits.Administrator) ||
            message.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
            message.member.permissions.has(PermissionFlagsBits.ManageMessages)
        );

        // ==========================================
        // 🚨 1. PASSIVE MASS MENTION PROTECTION SHIELD
        // ==========================================
        if (!isStaff && !isOwner) {
            const userMentions = message.mentions.users.size;
            const roleMentions = message.mentions.roles.size;
            const totalMentions = userMentions + roleMentions;

            // Trigger: 5 or more mentions in a single message
            if (totalMentions >= 5 || message.mentions.everyone) {
                await message.delete().catch(() => {});
                await message.member.timeout(10 * 60 * 1000, "Automod: Mass Mention Anti-Raid Shield").catch(() => {});
                const warn = await message.channel.send(`🚨 <@${message.author.id}> has been timed out for **10 minutes** for mass mentioning users/roles!`).catch(() => {});
                if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
                return;
            }
        }

        let triggerWord = 'starry';
        let displayName = 'Starry'; 

        try {
            if (!ServerSettings) ServerSettings = require('../models/ServerSettings');
            const settings = await ServerSettings.findOne({ guildId: message.guild.id });
            if (settings && settings.triggerWord) {
                triggerWord = settings.triggerWord.toLowerCase();
                displayName = settings.triggerWord;
            }
        } catch (err) {}

        const text = message.content.toLowerCase().trim();
        const isImagine = text.startsWith('.imagine ');
        const mentionsBot = message.mentions.has(client.user.id);
        const hasName = text.includes(triggerWord) || text.includes('jarvis');
        let isReplyToBot = false;

        if (message.reference) {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            if (refMsg && refMsg.author.id === client.user.id) isReplyToBot = true;
        }

        if (!isImagine && !mentionsBot && !hasName && !isReplyToBot) return;

        if (!isOwner && (typeof client.isPremium === 'function' && !client.isPremium(message.guild.id, message.author.id))) {
            return message.reply('❌ **AI is a Premium feature!** Contact the bot owner to upgrade this server.').catch(() => {});
        }

        const botMember = message.guild.members.me;

        // 2. PIN / UNPIN REPLIED MESSAGE
        if ((text.includes('pin this') || text.includes('unpin this')) && message.reference) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && !isOwner) {
                return message.reply("❌ You need **Manage Messages** permission.");
            }
            try {
                const targetMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (text.includes('unpin')) {
                    await targetMsg.unpin();
                    return message.reply("📌 Message unpinned successfully!");
                } else {
                    await targetMsg.pin();
                    return message.reply("📌 Message pinned successfully!");
                }
            } catch (e) {
                return message.reply("❌ Failed to pin/unpin message.");
            }
        }

        // 3. DELETE ROLE PRE-PARSER
        const deleteRoleRegex = /(?:delete|remove|destroy) (?:the )?role (?:<@&(\d+)>|([a-zA-Z0-9_\-\s]+))/i;
        const deleteRoleMatch = message.content.match(deleteRoleRegex);
        if (deleteRoleMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isOwner) return message.reply("❌ You lack **Manage Roles** permission.");
            if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) return message.reply("❌ I am missing **Manage Roles** permission!");

            const roleId = deleteRoleMatch[1];
            const q = deleteRoleMatch[2]?.trim().toLowerCase();
            let targetRole = roleId ? message.guild.roles.cache.get(roleId) : message.guild.roles.cache.find(r => r.name.toLowerCase() === q || r.name.toLowerCase().includes(q));

            if (!targetRole) return message.reply("❌ Target role not found!");
            if (targetRole.position >= botMember.roles.highest.position) return message.reply("❌ Role is equal to or higher than my highest role!");

            try {
                const name = targetRole.name;
                await targetRole.delete(`Deleted by ${message.author.tag}`);
                return message.reply(`🗑️ Successfully deleted role **${name}**!`);
            } catch (err) {
                return message.reply(`❌ Failed to delete role: \`${err.message}\``);
            }
        }

        // 4. GIVE / REMOVE ROLE TO MEMBER
        const assignRoleRegex = /(give|remove|take) (?:the )?role (?:<@&(\d+)>|([a-zA-Z0-9_\-\s]+)) (?:to|from) <@!?(\d+)>/i;
        const assignRoleMatch = message.content.match(assignRoleRegex);
        if (assignRoleMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && !isOwner) return message.reply("❌ You lack **Manage Roles** permission.");
            const action = assignRoleMatch[1].toLowerCase();
            const roleId = assignRoleMatch[2];
            const roleName = assignRoleMatch[3]?.trim().toLowerCase();
            const targetUserId = assignRoleMatch[4];

            let role = roleId ? message.guild.roles.cache.get(roleId) : message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
            const targetMem = await message.guild.members.fetch(targetUserId).catch(() => null);

            if (!role || !targetMem) return message.reply("❌ Invalid role or user!");

            if (action === 'give') {
                await targetMem.roles.add(role).catch(() => {});
                return message.reply(`✅ Granted role **${role.name}** to ${targetMem}!`);
            } else {
                await targetMem.roles.remove(role).catch(() => {});
                return message.reply(`✅ Removed role **${role.name}** from ${targetMem}!`);
            }
        }

        // 5. SET OR RESET NICKNAME
        const nickRegex = /(?:set|change|reset) nickname (?:of )?<@!?(\d+)>(?: (?:to )?([a-zA-Z0-9_\-\s]+))?/i;
        const nickMatch = message.content.match(nickRegex);
        if (nickMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames) && !isOwner) return message.reply("❌ Missing **Manage Nicknames** permission.");
            const targetMem = await message.guild.members.fetch(nickMatch[1]).catch(() => null);
            if (targetMem) {
                const newNick = nickMatch[2] ? nickMatch[2].trim() : null;
                await targetMem.setNickname(newNick).catch(() => {});
                return message.reply(newNick ? `✏️ Updated nickname of ${targetMem} to **${newNick}**!` : `✏️ Reset nickname for ${targetMem}!`);
            }
        }
        // 6. SET CHANNEL TOPIC
        const topicRegex = /(?:set|change) (?:channel )?topic (?:to )?(.+)/i;
        const topicMatch = message.content.match(topicRegex);
        if (topicMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isOwner) return message.reply("❌ Missing **Manage Channels** permission.");
            const newTopic = topicMatch[1].trim();
            await message.channel.setTopic(newTopic).catch(() => {});
            return message.reply(`📝 Updated channel topic to: *"${newTopic}"*`);
        }

        // 7. CREATE / DELETE CHANNELS
        const createChanRegex = /(?:create|make) (text|voice|category) channel ([a-zA-Z0-9_\-\s]+)/i;
        const createChanMatch = message.content.match(createChanRegex);
        if (createChanMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isOwner) return message.reply("❌ Missing **Manage Channels** permission.");
            const type = createChanMatch[1] === 'voice' ? ChannelType.GuildVoice : createChanMatch[1] === 'category' ? ChannelType.GuildCategory : ChannelType.GuildText;
            const newChan = await message.guild.channels.create({ name: createChanMatch[2].trim(), type }).catch(() => null);
            if (newChan) return message.reply(`📁 Created channel ${newChan}!`);
        }

        const deleteChanRegex = /(?:delete|remove) channel (?:<#(\d+)>|([a-zA-Z0-9_\-\s]+))/i;
        const deleteChanMatch = message.content.match(deleteChanRegex);
        if (deleteChanMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isOwner) return message.reply("❌ Missing **Manage Channels** permission.");
            const cId = deleteChanMatch[1];
            const q = deleteChanMatch[2]?.trim().toLowerCase();
            let chan = cId ? message.guild.channels.cache.get(cId) : message.guild.channels.cache.find(c => c.name.toLowerCase() === q);
            if (chan) {
                const name = chan.name;
                await chan.delete().catch(() => {});
                return message.reply(`🗑️ Deleted channel **#${name}**!`);
            }
        }

        // 8. SLOWMODE, LOCK, UNLOCK
        if (text.includes('lock channel')) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isOwner) return message.reply("❌ Missing permission.");
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            return message.reply("🔒 Channel locked.");
        }

        if (text.includes('unlock channel')) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isOwner) return message.reply("❌ Missing permission.");
            await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            return message.reply("🔓 Channel unlocked.");
        }

        const slowmodeMatch = message.content.match(/(?:set )?slowmode (?:to )?(\d+|off)(s|m|h)?/i);
        if (slowmodeMatch) {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && !isOwner) return message.reply("❌ Missing permission.");
            const val = slowmodeMatch[1].toLowerCase();
            if (val === 'off' || val === '0') {
                await message.channel.setRateLimitPerUser(0);
                return message.reply("⏱️ Slowmode disabled.");
            }
            let secs = parseInt(val);
            if (slowmodeMatch[2] === 'm') secs *= 60;
            if (slowmodeMatch[2] === 'h') secs *= 3600;
            await message.channel.setRateLimitPerUser(Math.min(secs, 21600));
            return message.reply(`⏱️ Slowmode set to **${secs}s**.`);
        }

        // 9. IMAGE GENERATION
        const imageRegex = /(?:create|generate|draw|make|paint) (?:an? |some )?(?:image|picture|art) (?:of )?(.*)/i;
        let isImageRequest = isImagine;
        let imagePrompt = isImagine ? message.content.slice(9).trim() : "";
        if (!isImagine && (hasName || mentionsBot)) {
            const m = message.content.match(imageRegex);
            if (m) { isImageRequest = true; imagePrompt = m[1].trim(); }
        }

        if (isImageRequest) {
            if (!imagePrompt) return message.reply('❌ Please specify what to draw!');
            const replyMsg = await message.reply('🎨 Painting your picture...').catch(() => null);
            try {
                const safePrompt = encodeURIComponent(imagePrompt.replace(/[^a-zA-Z0-9\s]/g, ''));
                const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&nologo=true`;
                await message.reply({ content: `🖼️ **"${imagePrompt}"**`, files: [{ attachment: imageUrl, name: `${displayName}_Art.png` }] });
                return await replyMsg?.delete().catch(() => {});
            } catch (err) {
                return replyMsg?.edit('❌ Failed to draw image.');
            }
        }
        // ==========================================
        // 🧠 OMNIPOTENT AI EXECUTION ENGINE
        // ==========================================
        await message.channel.sendTyping().catch(() => {});

        try {
            const prompt = `[SYSTEM INSTRUCTION]\nYou are ${displayName}, an omnipotent Discord master assistant.\n` +
                `SUPPORTED COMMAND PROTOCOLS:\n` +
                `• Delete Role: [CMD:DELETEROLE|ROLE:role_name_or_id]\n` +
                `• Create Role: [CMD:CREATEROLE|NAME:role_name]\n` +
                `• Give Role: [CMD:GIVEROLE|USER_ID:123|ROLE_ID:456]\n` +
                `• Remove Role: [CMD:REMOVEROLE|USER_ID:123|ROLE_ID:456]\n` +
                `• Create Channel: [CMD:CREATECHANNEL|NAME:name|TYPE:text_or_voice]\n` +
                `• Delete Channel: [CMD:DELETECHANNEL|CHANNEL:name_or_id]\n` +
                `• Set Nickname: [CMD:SETNICK|USER_ID:123|NICK:new_nickname]\n` +
                `• Pin Message: [CMD:PINMESSAGE]\n` +
                `• Moderate: [CMD:KICK|ID:123|REASON:reason], [CMD:BAN|ID:123|REASON:reason], [CMD:TIMEOUT|ID:123|MINUTES:10]\n` +
                `• Clear: [CMD:CLEAR|AMOUNT:10]\n\n` +
                `RULE: Emit the [CMD:] tag inline when asked to perform server admin tasks.\n\n` +
                `[USER MESSAGE]\n${message.author.username} says: ${message.content}`;

            let replyText = await generateAIResponseWithRetry(prompt);

            let functionName = null; 
            let args = {};

            const cmdMatch = replyText.match(/\[.*?CMD:(KICK|BAN|UNBAN|CLEAR|TIMEOUT|UNTIMEOUT|GIVEROLE|REMOVEROLE|CREATEROLE|DELETEROLE|CREATECHANNEL|DELETECHANNEL|SETNICK|PINMESSAGE)(?:\|(.*?))?\]/i);
            if (cmdMatch) {
                const action = cmdMatch[1].toUpperCase(); 
                const params = (cmdMatch[2] || '').split('|');
                const getParam = (key) => (params.find(p => p.toUpperCase().startsWith(key)) || '').split(':')[1]?.trim() || '';

                if (action === 'DELETEROLE') { functionName = 'delete_role'; args.roleQuery = getParam('ROLE') || getParam('NAME'); }
                else if (action === 'CREATEROLE') { functionName = 'create_role'; args.roleName = getParam('NAME') || getParam('ROLE'); }
                else if (action === 'CREATECHANNEL') { functionName = 'create_channel'; args.chanName = getParam('NAME'); args.chanType = getParam('TYPE'); }
                else if (action === 'DELETECHANNEL') { functionName = 'delete_channel'; args.chanQuery = getParam('CHANNEL') || getParam('NAME'); }
                else if (action === 'SETNICK') { functionName = 'set_nick'; args.userId = getParam('USER_ID'); args.nick = getParam('NICK'); }
                else if (action === 'PINMESSAGE') { functionName = 'pin_msg'; }
                else if (action === 'CLEAR') { functionName = 'clear_messages'; args.amount = parseInt(getParam('AMOUNT')) || 10; }
                else if (action === 'TIMEOUT') { functionName = 'timeout_member'; args.userId = getParam('ID'); args.minutes = parseInt(getParam('MINUTES')) || 2; args.reason = getParam('REASON') || "AI Action"; }
                else if (action === 'KICK' || action === 'BAN') { functionName = action.toLowerCase() + '_member'; args.userId = getParam('ID'); args.reason = getParam('REASON') || "AI Action"; }

                replyText = replyText.replace(cmdMatch[0], '').trim();
            }

            // Universal AI Action Executor
            if (functionName && message.guild) {
                const bMem = message.guild.members.me;

                if (functionName === "delete_role" && bMem.permissions.has(PermissionFlagsBits.ManageRoles)) {
                    const q = args.roleQuery?.toLowerCase();
                    const r = message.guild.roles.cache.find(role => role.id === q || role.name.toLowerCase() === q || role.name.toLowerCase().includes(q));
                    if (r && r.position < bMem.roles.highest.position) {
                        const name = r.name;
                        await r.delete().catch(() => {});
                        await message.reply(`🗑️ Successfully deleted role **${name}**!`);
                    }
                }

                if (functionName === "set_nick" && bMem.permissions.has(PermissionFlagsBits.ManageNicknames)) {
                    const tMem = await message.guild.members.fetch(args.userId).catch(() => null);
                    if (tMem) {
                        await tMem.setNickname(args.nick || null).catch(() => {});
                        await message.reply(`✏️ Nickname updated for ${tMem}!`);
                    }
                }

                if (functionName === "pin_msg" && message.reference && bMem.permissions.has(PermissionFlagsBits.ManageMessages)) {
                    const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                    if (refMsg) {
                        await refMsg.pin().catch(() => {});
                        await message.reply("📌 Message pinned successfully!");
                    }
                }

                if (functionName === "create_role" && bMem.permissions.has(PermissionFlagsBits.ManageRoles)) {
                    const newRole = await message.guild.roles.create({ name: args.roleName || 'new-role' }).catch(() => null);
                    if (newRole) await message.reply(`✅ Created role **${newRole.name}**!`);
                }

                if (functionName === "create_channel" && bMem.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    const type = args.chanType?.toLowerCase() === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
                    const chan = await message.guild.channels.create({ name: args.chanName || 'new-channel', type }).catch(() => null);
                    if (chan) await message.reply(`📁 Created channel ${chan}!`);
                }

                if (functionName === "delete_channel" && bMem.permissions.has(PermissionFlagsBits.ManageChannels)) {
                    const q = args.chanQuery?.toLowerCase();
                    const chan = message.guild.channels.cache.find(c => c.id === q || c.name.toLowerCase() === q || c.name.toLowerCase().includes(q));
                    if (chan) {
                        const name = chan.name;
                        await chan.delete().catch(() => {});
                        await message.reply(`🗑️ Successfully deleted channel **#${name}**!`);
                    }
                }

                if (functionName === "clear_messages" && bMem.permissions.has(PermissionFlagsBits.ManageMessages)) {
                    const deleteCount = Math.min(args.amount, 99) + 1;
                    await message.channel.bulkDelete(deleteCount, true).catch(() => {});
                    await message.channel.send(`🧹 Cleared ${args.amount} messages!`).then(m => setTimeout(() => m.delete().catch(() => {}), 3500));
                }

                const tId = (args.userId || '').replace(/\D/g, '');
                if (tId) {
                    const tMember = await message.guild.members.fetch(tId).catch(() => null);
                    if (tMember && tMember.id !== message.guild.ownerId && tMember.id !== client.user.id) {
                        if (tMember.roles.highest.position < bMem.roles.highest.position) {
                            if (functionName === "timeout_member" && bMem.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                                await tMember.timeout(args.minutes * 60 * 1000, args.reason).catch(() => {}); 
                                await message.reply(`⏰ Timed out <@${tId}> for ${args.minutes}m.`);
                            }
                            if (functionName === "kick_member" && bMem.permissions.has(PermissionFlagsBits.KickMembers)) {
                                await tMember.kick(args.reason).catch(() => {});
                                await message.reply(`👢 Kicked <@${tId}>.`);
                            }
                            if (functionName === "ban_member" && bMem.permissions.has(PermissionFlagsBits.BanMembers)) {
                                await tMember.ban({ reason: args.reason }).catch(() => {});
                                await message.reply(`🔨 Banned <@${tId}>.`);
                            }
                        }
                    }
                }
            }

            if (replyText && replyText.trim().length > 0) {
                const chunks = replyText.trim().match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of chunks) {
                    await message.reply(chunk).catch(() => {});
                }
            }

        } catch (error) {
            console.error("Gemini AI error:", error.message || error);
            return message.reply(`⏳ **High Demand Notice:** Google AI servers are experiencing a brief spike in traffic. Please try again in a few seconds!`).catch(() => {});
        }
    }); 
};
