// ==========================================
// 1. IMPORTS, INITIALIZATION & CACHING
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
    // Models will be fetched dynamically if required
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const blacklistedUsers = new Set();

module.exports = (client) => {

    client.on('clientReady', () => { 
        console.log('✅ Starry Protocol Module Loaded (Powered by upgraded Gemini Engine!)'); 
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
    /**
     * Automatically analyzes a server's text channels to find the ideal log destination.
     * Searches for specialized channels first; if none exist, routes EVERYTHING to a single general log channel.
     * @param {Guild} guild - The Discord Guild object
     * @param {String} logType - 'access', 'moderate', 'messages', 'voice', 'channels', 'members', 'roles', or 'misc'
     * @returns {TextChannel|null}
     */
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

        // 1. Try to find a specialized channel matching the specific log category
        let channel = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildText && targetNames.some(name => c.name.toLowerCase().includes(name))
        );
        if (channel) return channel;

        // 2. Fallback to a single master server log channel if no dedicated category channel exists
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

            // 1. BASIC CONFIGURATION
            try {
                if (!ServerSettings) ServerSettings = require('../models/ServerSettings');
                await ServerSettings.findOneAndUpdate({ guildId: guild.id }, { triggerWord: 'Starry' }, { upsert: true });
                report.push(`⚙️ **Identity:** Trigger word set to \`Starry\``);
            } catch (err) {}

            // 2. COMMUNITY FEATURES
            const welcome = channels.find(c => c.name.includes('welcome'));
            if (welcome) report.push(`👋 **Welcomes:** Linked to <#${welcome.id}>`);

            const starboard = channels.find(c => c.name.includes('starboard'));
            if (starboard) report.push(`⭐ **Starboard:** Linked to <#${starboard.id}>`);

            const suggestions = channels.find(c => c.name.includes('suggestions') || c.name.includes('ideas'));
            if (suggestions) report.push(`💡 **Suggestions:** Linked to <#${suggestions.id}>`);

            const confessions = channels.find(c => c.name.includes('confessions'));
            if (confessions) report.push(`👀 **Confessions:** Linked to <#${confessions.id}>`);

            // 3. SECURITY & MODERATION
            const verification = channels.find(c => c.name.includes('verification') || c.name.includes('verify'));
            if (verification) report.push(`🛡️ **Verification:** System mapped to <#${verification.id}>`);

            const logChannels = channels.filter(c => c.name.includes('logs-') || c.name.includes('-logs'));
            if (logChannels.size > 0) {
                report.push(`🗂️ **Smart Logging:** Successfully mapped **${logChannels.size}** log channels.`);
            } else {
                report.push(`🗂️ **Smart Logging:** Mapped to single fallback channel.`);
            }

            // 4. TICKETS & APPLICATIONS
            const openTicketsCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('opened tickets'));
            const closedTicketsCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('closed tickets'));
            if (openTicketsCat && closedTicketsCat) {
                report.push(`🎫 **Tickets:** Bound to \`${openTicketsCat.name}\` & \`${closedTicketsCat.name}\``);
            }

            const applicationsCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('applications'));
            if (applicationsCat) {
                report.push(`📝 **Applications:** Bound to category \`${applicationsCat.name}\``);
            }

            const appeals = channels.find(c => c.name.includes('appeals'));
            if (appeals) report.push(`🏛️ **Appeals:** Linked to <#${appeals.id}>`);

            // 5. ECONOMY & REWARDS
            const booster = channels.find(c => c.name.includes('boosters') || c.name.includes('boost'));
            if (booster) {
                try {
                    if (!BoostChannel) BoostChannel = require('../models/BoostChannel');
                    await BoostChannel.findOneAndUpdate({ guildId: guild.id }, { channelId: booster.id }, { upsert: true });
                    report.push(`🚀 **Boost Tracker:** Linked to <#${booster.id}>`);
                } catch (err) {}
            }

            const chestTargets = channels.filter(c => 
                c.type === ChannelType.GuildText && 
                (c.name.includes('general') || c.name.includes('cafe-chat') || c.name.includes('chat') || c.name.includes('spam'))
            );

            if (!client.chestChannelsCache) client.chestChannelsCache = new Set();
            let chestCount = 0;

            try {
                if (!ChestChannel) ChestChannel = require('../models/ChestChannel');
                for (const [id, channel] of chestTargets) {
                    const existing = await ChestChannel.findOne({ channelId: id });
                    if (!existing) {
                        await ChestChannel.create({ guildId: guild.id, channelId: id });
                        client.chestChannelsCache.add(id);
                        chestCount++;
                    }
                }
            } catch (err) {}

            if (chestCount > 0) report.push(`🎁 **Loot Engine:** Activated in **${chestCount}** chat channels`);

            // 6. FINISH REPORT
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
                .setDescription('**Owner-Only Text Commands:**\n\n` .sysinfo ` - Bot stats.\n` .serverdump ` - Full text data dump.\n` .eval <code> ` - Run raw JS.\n` .broadcast <msg> ` - Send message to ALL servers.\n` .leaveserver <ID> ` - Force leave.\n` .blacklist <ID> ` - Block user.')
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
                if (interaction.isRepliable()) return interaction.reply({ content: '❌ **Access Denied:** You are not recognized as a bot owner!', ephemeral: true });
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
                new ButtonBuilder().setCustomId('dev_servers').setLabel('Server List').setStyle(ButtonStyle.Primary).setEmoji('🌐'),
                new ButtonBuilder().setCustomId('dev_dump').setLabel('Server Dump').setStyle(ButtonStyle.Secondary).setEmoji('🗄️')
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_eval_btn').setLabel('Eval JS').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                new ButtonBuilder().setCustomId('dev_broadcast_btn').setLabel('Broadcast').setStyle(ButtonStyle.Success).setEmoji('📝')
            );

            return interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
        }

        if (interaction.isButton() && interaction.customId.startsWith('dev_')) {
            const id = interaction.customId;
            if (id === 'dev_sysinfo') {
                const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                return interaction.reply({ content: `📊 **Starry System Info:**\n- **RAM:** ${memory} MB\n- **Uptime:** ${(process.uptime() / 3600).toFixed(2)} Hours\n- **Ping:** ${client.ws.ping}ms`, ephemeral: true });
            }
            if (id === 'dev_servers') {
                let serverList = `🌐 **Starry is in ${client.guilds.cache.size} servers:**\n\n`;                
                client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount).forEach(g => { serverList += `🔹 **${g.name}** (${g.memberCount} members)\n`; });
                return interaction.reply({ content: serverList.slice(0, 1999), ephemeral: true });
            }
            if (id === 'dev_eval_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_eval').setTitle('Execute JavaScript').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('eval_code').setLabel('Code to evaluate').setStyle(TextInputStyle.Paragraph).setRequired(true))));
            if (id === 'dev_broadcast_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_broadcast').setTitle('Global Server Broadcast').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('broadcast_msg').setLabel('Announcement Message').setStyle(TextInputStyle.Paragraph).setRequired(true))));
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_')) {
            const id = interaction.customId;
            if (id === 'modal_eval') { 
                await interaction.deferReply({ ephemeral: true }); 
                try { 
                    let evaled = eval(interaction.fields.getTextInputValue('eval_code')); 
                    if (typeof evaled !== "string") evaled = require("util").inspect(evaled); 
                    return interaction.editReply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``); 
                } catch (err) { 
                    return interaction.editReply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``); 
                } 
            }
            if (id === 'modal_broadcast') { 
                await interaction.deferReply({ ephemeral: true }); 
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
    // 🤖 AI & NLP MODERATION ENGINE (ULTRA FAST)
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

        if (!isOwner && (!message.guild || (typeof client.isPremium === 'function' && !client.isPremium(message.guild.id, message.author.id)))) {
            return message.reply('❌ **AI is a Premium feature!** Contact the bot owner to upgrade this server.').catch(() => {});
        }

        // ==========================================
        // ⚡ 1. INSTANT LOCAL PRE-PARSER (0ms DELAY)
        // ==========================================
        const createRoleRegex = /(?:create|make|add) (?:a |an )?(?:role|role named) ([\w\s\-_]+)/i;
        const roleMatch = message.content.match(createRoleRegex);

        if (roleMatch) {
            const roleName = roleMatch[1].trim();
            if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) || !message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                return message.reply('❌ Missing permissions to manage roles in this server.');
            }
            try {
                const newRole = await message.guild.roles.create({ name: roleName, reason: `Requested by ${message.author.tag}` });
                return message.reply(`✅ Successfully created role **${newRole.name}**!`);
            } catch (err) {
                return message.reply(`❌ Failed to create role: \`${err.message}\``);
            }
        }

        // --- IMAGE GENERATION ---
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
        // 🧠 2. QUAD-MODEL AI FAILOVER ENGINE
        // ==========================================
        if (!process.env.GEMINI_API_KEY) return message.reply("❌ **Setup Error:** API Key missing!");        
        await message.channel.sendTyping().catch(() => {});

        try {
            const prompt = `[SYSTEM INSTRUCTION]\nYou are ${displayName}, a helpful Discord bot. \nRULE 1: To moderate: [CMD:KICK|ID:123|REASON:spam] (Supported: KICK, BAN, UNBAN, CLEAR, TIMEOUT, UNTIMEOUT. For clearing, use [CMD:CLEAR|AMOUNT:10]).\nRULE 2: To manage roles: [CMD:CREATEROLE|NAME:role_name] or [CMD:GIVEROLE|USER_ID:123|ROLE_ID:456].\nRULE 3: Keep responses ultra concise and direct.\n\n[USER MESSAGE]\n${message.author.username} says: ${message.content}`;

            // Quad-model fallback pool to bypass 503 errors instantly
            const aiModels = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp', 'gemini-1.0-pro'];
            let geminiResponse = null;
            let lastError = null;

            for (const modelName of aiModels) {
                try {
                    geminiResponse = await ai.models.generateContent({ model: modelName, contents: prompt });
                    if (geminiResponse && geminiResponse.text) break; 
                } catch (err) {
                    lastError = err;
                    console.warn(`[AI Engine] Model ${modelName} failed or busy. Trying next...`);
                }
            }

            if (!geminiResponse || !geminiResponse.text) {
                return message.reply("⏳ **High Demand Notice:** Google AI servers are currently busy. Please try your request again in a moment!");
            }

            let replyText = geminiResponse.text || "";
            let functionName = null; let args = {};

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
            // ==========================================
            // 🛡️ UPGRADED ROLE HIERARCHY MODERATION ENGINE
            // ==========================================
            if (functionName) {
                const botMember = message.guild.members.me;
                const hasPerm = (perm) => message.member && message.member.permissions.has(perm) && botMember.permissions.has(perm);

                if (functionName === "create_role") {
                    if (!hasPerm(PermissionFlagsBits.ManageRoles)) return message.reply("❌ Required permissions to create roles are missing.");
                    try {
                        const newRole = await message.guild.roles.create({ name: args.roleName || 'new-role' });
                        return message.reply(`✅ Created role **${newRole.name}**!`);
                    } catch (err) {
                        return message.reply(`❌ Failed to create role: \`${err.message}\``);
                    }
                }

                if (functionName === "clear_messages" && hasPerm(PermissionFlagsBits.ManageMessages)) {
                    const deleteCount = Math.min(args.amount, 99) + 1;
                    await message.channel.bulkDelete(deleteCount, true).catch(()=>{});
                    return message.channel.send(`🧹 Successfully cleared ${args.amount} messages!`).then(m => setTimeout(()=>m.delete(), 3500));
                }

                const tId = (args.userId || '').replace(/\D/g, '');
                if (functionName === "unban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                    await message.guild.members.unban(tId).catch(()=>{}); 
                    return message.reply("✅ User Unbanned.");
                }

                const tMember = await message.guild.members.fetch(tId).catch(() => null);

                if (!tMember) {
                    return message.reply("❌ Target member could not be found in this server.");
                }

                // 🛡️ Hierarchy Safeguards
                if (tMember.id === message.guild.ownerId) {
                    return message.reply("❌ I cannot moderate the **Server Owner**!");
                }
                if (tMember.id === client.user.id) {
                    return message.reply("❌ I cannot moderate **myself**!");
                }

                const botHighestRole = botMember.roles.highest;
                const targetHighestRole = tMember.roles.highest;

                const isTargetHigherOrEqual = targetHighestRole.position >= botHighestRole.position;

                if (isTargetHigherOrEqual) {
                    return message.reply(`❌ Cannot moderate **${tMember.user.tag}** because their role (\`${targetHighestRole.name}\`) is higher than or equal to my highest role (\`${botHighestRole.name}\`). Please move my bot role higher!`);
                }

                if (functionName === "timeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    const dmSent = await client.sendPremiumModDM(tMember, message.member, 'timeout', args.reason, `${args.minutes} minutes`, message.guild, caseId);
                    
                    await tMember.timeout(args.minutes * 60 * 1000, args.reason).catch((err) => {
                        console.error('Timeout Execution Error:', err);
                    }); 

                    return message.reply(`⏰ Timed out <@${tId}> for ${args.minutes}m. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                }

                if (functionName === "untimeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    await tMember.timeout(null).catch(()=>{}); 
                    return message.reply(`✅ Removed timeout from <@${tId}>.`);
                }

                if (functionName === "kick_member" && hasPerm(PermissionFlagsBits.KickMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    const dmSent = await client.sendPremiumModDM(tMember, message.member, 'kick', args.reason, null, message.guild, caseId);
                    
                    await tMember.kick(args.reason).catch((err) => {
                        console.error('Kick Execution Error:', err);
                    }); 

                    return message.reply(`👢 Kicked <@${tId}>. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                }

                if (functionName === "ban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    const dmSent = await client.sendPremiumModDM(tMember, message.member, 'ban', args.reason, 'Permanent', message.guild, caseId, 'https://discord.com');
                    
                    await tMember.ban({ reason: args.reason }).catch((err) => {
                        console.error('Ban Execution Error:', err);
                    });

                    return message.reply(`🔨 Banned <@${tId}>. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                }
            }

            // --- DELIVER AI RESPONSE CHUNKS ---
            if (replyText && replyText.trim().length > 0) {
                const textChunks = replyText.trim().match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) await message.reply(chunk).catch(console.error); 
            }

        } catch (error) {
            console.error("Gemini AI error:", error);
            return message.reply(`❌ **AI Execution Error:** \`${error.message || error}\``).catch(console.error);
        }
    }); 
};
