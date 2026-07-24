const { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Safely load the Chest model for the new crash-proof chest system
let ChestModel;
try { ChestModel = require('../models/Chest'); } catch(e) {}

// ==========================================
// 🚀 INITIALIZATION & CACHING
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const blacklistedUsers = new Set();

module.exports = (client) => {

    client.on('clientReady', () => { 
        console.log('✅ Starry Protocol Module Loaded (Powered by Gemini 1.5 Flash!)'); 
    });

    // ==========================================
    // 🚀 FORCE COMMAND REGISTRATION
    // ==========================================
    client.on('ready', async () => {
        try {
            console.log('🔄 Forcing Slash Command Sync with Discord API...');
            await client.application.commands.create({
                name: 'setup-starry',
                description: '🧠 MASTER COMMAND: Scans your server and links EVERY feature to the correct channels.',
                default_member_permissions: '8' // Admins only
            });
            await client.application.commands.create({
                name: 'ahelp',
                description: 'Displays the complete Admin & Moderation Command Menu',
                default_member_permissions: '8192' 
            });
            console.log('✅ Commands successfully pushed to Discord!');
        } catch (err) {
            console.error('❌ Failed to register commands:', err);
        }
    });

    // ==========================================
    // 👑 MULTI-OWNER VERIFICATION HELPER
    // ==========================================
    client.isOwner = (userId) => {
        const owners = (process.env.OWNER_ID || '').split(',').map(id => id.trim());
        return owners.includes(userId);
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

        let channel = guild.channels.cache.find(c => c.type === 0 && targetNames.some(name => c.name.includes(name)));
        if (channel) return channel;

        channel = guild.channels.cache.find(c => 
            c.type === 0 && (c.name === 'logs-server' || c.name === 'server-logs' || c.name === 'mod-logs' || c.name === 'bot-logs' || c.name === 'system-logs' || c.name === 'logs')
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
    // 💎 PREMIUM MODERATION DM ENGINE
    // ==========================================
    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A', appealLink = null) => {
        if (member.user.bot) return false;

        const actionType = action.toLowerCase();
        const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guild.id) : false;

        // --- FREE TIER FALLBACK ---
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

        // --- PREMIUM TIER EMBED ---
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
    // 📡 TRACKERS & TEXT COMMANDS
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        // --- SERVER BUMP TRACKERS ---
        if (message.author.id === '302050872383242240') { // Disboard
            if (message.embeds.length > 0 && message.embeds[0].description?.includes('Bump done')) {
                const bumpEmbed = new EmbedBuilder().setColor('#3BA55C').setTitle('📈 Server Bumped!').setDescription('Thank you for bumping the server! You can bump us again in 2 hours.');
                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }

        const lowerName = message.author.username.toLowerCase();
        if (lowerName.includes('discardia') || lowerName.includes('discadia')) {
            const embed = message.embeds[0];
            if (embed && ((embed.description?.toLowerCase().includes('bump')) || (embed.title?.toLowerCase().includes('bump')))) {
                const bumpEmbed = new EmbedBuilder().setColor('#5865F2').setTitle('🚀 Server Bumped on Discardia!').setDescription('Thank you for boosting our server! We will remind you when it is time to bump again.');
                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }

        // --- DEVELOPER-ONLY TEXT COMMANDS ---
        const text = message.content.toLowerCase();
        const isOwner = client.isOwner(message.author.id);
        const notOwnerMsg = "❌ **Access Denied:** You are not recognized as a bot owner!";

        if (text === '.dev') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const devEmbed = new EmbedBuilder()
                .setColor('#2C2F33')
                .setTitle('💻 Starry Developer Menu')
                .setDescription('**Owner-Only Text Commands:**\n\n` .servers ` - Lists all servers.\n` .serverdump ` - Full text data dump.\n` .sysinfo ` - Bot stats.\n` .eval <code> ` - Run raw JavaScript.\n` .broadcast <msg> ` - Send message to ALL servers.\n` .leaveserver <ID> ` - Remotely force leave.\n` .blacklist <ID> ` - Block a user.\n` .emergencyleave ` - Force leave current server.\n` .restart ` - Kills the bot process.\n` .setstatus <text> ` - Changes status.')
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
        if (text.startsWith('.blacklist ')) {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const targetId = message.content.split(' ')[1];
            if (!targetId) return message.reply('❌ Please provide a User ID.');
            if (blacklistedUsers.has(targetId)) {
                blacklistedUsers.delete(targetId); return message.reply(`✅ Removed \`${targetId}\` from the blacklist.`).catch(()=>{});
            } else {
                blacklistedUsers.add(targetId); return message.reply(`🚫 Added \`${targetId}\` to the blacklist.`).catch(()=>{});
            }
        }

        if (text.startsWith('.leaveserver ')) {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const guildToLeave = client.guilds.cache.get(message.content.split(' ')[1]);
            if (!guildToLeave) return message.reply('❌ I am not in a server with that ID.').catch(()=>{});
            await guildToLeave.leave(); return message.reply(`✅ Successfully left **${guildToLeave.name}**.`).catch(()=>{});
        }

        if (text.startsWith('.broadcast ')) {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const announcement = message.content.slice(11).trim();
            if (!announcement) return message.reply('❌ What do you want to broadcast?');
            let successCount = 0;
            client.guilds.cache.forEach(guild => {
                const channel = guild.channels.cache.find(c => c.type === 0 && (c.name.toLowerCase().includes('general') || c.name.toLowerCase().includes('chat') || c.name.toLowerCase().includes('main')) && c.permissionsFor(guild.members.me).has('SendMessages')) || guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));
                if (channel) { channel.send(`📢 **System Announcement from Starry's Developer:**\n\n>>> ${announcement}`).catch(()=>{}); successCount++; }
            });
            return message.reply(`✅ Broadcast successfully sent to ${successCount} servers!`).catch(()=>{});
        }

        if (text.startsWith('.eval ')) {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            try {
                let evaled = eval(message.content.slice(6));
                if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
                return message.reply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``).catch(()=>{});
            } catch (err) { return message.reply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``).catch(()=>{}); }
        }

        if (text === '.emergencyleave') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            await message.reply('🚨 Initiating Emergency Leave sequence. Goodbye! 👋').catch(() => {});
            return message.guild.leave();
        }

        if (text === '.serverdump') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            await message.reply('🗄️ Compiling a neatly organized server dump...').catch(() => {});
            try {
                const buffer = await generateServerDump(message.guild);
                return message.reply({ content: `✅ **Dump Complete:**`, files: [{ attachment: buffer, name: `${message.guild.name.replace(/[^a-zA-Z0-9]/g, '_')}_Dump.txt` }] }).catch(()=>{});
            } catch (err) { return message.reply(`❌ Failed to compile dump: ${err.message}`).catch(()=>{}); }
        }
    });
    // ==========================================
    // 🎛️ INTERACTIVE BUTTONS, MODALS & GAMES
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        
      ====================================================
        // 🛑 STOP: EVERYTHING BELOW THIS POINT IS DEVELOPER ONLY 
        // ====================================================
        if (!client.isOwner(interaction.user.id)) {
            // Ignore non-dev interactions (like normal server buttons). If they explicitly typed /devpanel, tell them no.
            if (interaction.isChatInputCommand() && interaction.commandName === 'devpanel') {
                return interaction.reply({ content: '❌ **Access Denied:** You are not recognized as a bot owner!', ephemeral: true });
            }
            return;
        }

        // --- DASHBOARD RENDER ---
        if (interaction.isChatInputCommand() && interaction.commandName === 'devpanel') {
            const embed = new EmbedBuilder()
                .setTitle('💻 Starry Developer Control Panel')
                .setDescription('Select an operation below. Buttons with a **📝** will open a secure pop-up for parameter input.')
                .setColor('#5865F2')
                .setFooter({ text: 'Powered by Starry Protocol • Authorized Personnel Only' });

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_sysinfo').setLabel('System Info').setStyle(ButtonStyle.Primary).setEmoji('📊'),
                new ButtonBuilder().setCustomId('dev_servers').setLabel('Server List').setStyle(ButtonStyle.Primary).setEmoji('🌐'),
                new ButtonBuilder().setCustomId('dev_dump').setLabel('Server Dump').setStyle(ButtonStyle.Secondary).setEmoji('🗄️')
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_eval_btn').setLabel('Eval JS').setStyle(ButtonStyle.Secondary).setEmoji('📝'),
                new ButtonBuilder().setCustomId('dev_broadcast_btn').setLabel('Broadcast').setStyle(ButtonStyle.Success).setEmoji('📝'),
                new ButtonBuilder().setCustomId('dev_status_btn').setLabel('Set Status').setStyle(ButtonStyle.Secondary).setEmoji('📝')
            );
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_blacklist_btn').setLabel('Blacklist User').setStyle(ButtonStyle.Danger).setEmoji('📝'),
                new ButtonBuilder().setCustomId('dev_leaveserver_btn').setLabel('Leave Server (ID)').setStyle(ButtonStyle.Danger).setEmoji('📝'),
                new ButtonBuilder().setCustomId('dev_emergencyleave').setLabel('Leave Current').setStyle(ButtonStyle.Danger).setEmoji('⚠️')
            );
            const row4 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dev_restart').setLabel('Reboot Bot Process').setStyle(ButtonStyle.Danger).setEmoji('🔄')
            );

            return interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4], ephemeral: true });
        }

        // --- DEV BUTTON HANDLING ---
        if (interaction.isButton() && interaction.customId.startsWith('dev_')) {
            const id = interaction.customId;
            if (id === 'dev_sysinfo') {
                const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                return interaction.reply({ content: `📊 **Starry System Info:**\n- **RAM Usage:** ${memory} MB\n- **Uptime:** ${(process.uptime() / 3600).toFixed(2)} Hours\n- **Ping:** ${client.ws.ping}ms`, ephemeral: true });
            }
            if (id === 'dev_servers') {
                let serverList = `🌐 **Starry is currently in ${client.guilds.cache.size} servers:**\n\n`;                
                client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount).forEach(g => { serverList += `🔹 **${g.name}** (${g.memberCount} members)\n`; });
                return interaction.reply({ content: serverList.slice(0, 1999), ephemeral: true });
            }
            if (id === 'dev_dump') {
                await interaction.deferReply({ ephemeral: true });
                if (!interaction.guild) return interaction.editReply('❌ Must be used inside a server.');
                try {
                    const buffer = await generateServerDump(interaction.guild);
                    return interaction.editReply({ content: `✅ **Dump Complete:**`, files: [{ attachment: buffer, name: `${interaction.guild.name.replace(/[^a-zA-Z0-9]/g, '_')}_Dump.txt` }] });
                } catch (err) { return interaction.editReply(`❌ Dump failed: ${err.message}`); }
            }
            if (id === 'dev_restart') { 
                await interaction.reply({ content: '🔄 **Initiating remote reboot...**', ephemeral: true }); 
                process.exit(1); 
            }
            if (id === 'dev_emergencyleave') { 
                if (!interaction.guild) return interaction.reply({ content: '❌ Not inside a server!', ephemeral: true }); 
                await interaction.reply({ content: 'Leaving this server. Goodbye! 👋', ephemeral: true }); 
                return interaction.guild.leave(); 
            }

            // Trigger Modals
            if (id === 'dev_eval_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_eval').setTitle('Execute JavaScript').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('eval_code').setLabel('Code to evaluate').setStyle(TextInputStyle.Paragraph).setRequired(true))));
            if (id === 'dev_broadcast_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_broadcast').setTitle('Global Server Broadcast').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('broadcast_msg').setLabel('Announcement Message').setStyle(TextInputStyle.Paragraph).setRequired(true))));
            if (id === 'dev_status_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_status').setTitle('Change Bot Status').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('status_text').setLabel('New Status Text').setStyle(TextInputStyle.Short).setRequired(true))));
            if (id === 'dev_blacklist_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_blacklist').setTitle('Toggle User Blacklist').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target_id').setLabel('Discord User ID').setStyle(TextInputStyle.Short).setRequired(true))));
            if (id === 'dev_leaveserver_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_leave').setTitle('Force Leave Server').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server_id').setLabel('Discord Server ID').setStyle(TextInputStyle.Short).setRequired(true))));
        }

        // --- DEV MODAL SUBMIT HANDLING ---
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
            if (id === 'modal_status') { 
                client.user.setActivity(interaction.fields.getTextInputValue('status_text'), { type: 4 }); 
                return interaction.reply({ content: '✅ Status updated!', ephemeral: true }); 
            }
            if (id === 'modal_blacklist') { 
                const targetId = interaction.fields.getTextInputValue('target_id').trim(); 
                if (blacklistedUsers.has(targetId)) { 
                    blacklistedUsers.delete(targetId); 
                    return interaction.reply({ content: `✅ Removed \`${targetId}\` from the blacklist.`, ephemeral: true }); 
                } else { 
                    blacklistedUsers.add(targetId); 
                    return interaction.reply({ content: `🚫 Added \`${targetId}\` to the blacklist.`, ephemeral: true }); 
                } 
            }
            if (id === 'modal_leave') { 
                const guildToLeave = client.guilds.cache.get(interaction.fields.getTextInputValue('server_id').trim()); 
                if (!guildToLeave) return interaction.reply({ content: '❌ Not in a server with that ID.', ephemeral: true }); 
                await guildToLeave.leave(); 
                return interaction.reply({ content: `✅ Successfully left **${guildToLeave.name}**.`, ephemeral: true }); 
            }
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
                const ServerSettings = require('../models/ServerSettings'); 
                const settings = await ServerSettings.findOne({ guildId: message.guild.id });
                if (settings && settings.triggerWord) {
                    triggerWord = settings.triggerWord.toLowerCase();
                    displayName = settings.triggerWord;
                }
            } catch (err) { }
        }

        const text = message.content.toLowerCase();
        const isImagine = text.startsWith('.imagine ');
        const mentionsBot = message.mentions.has(client.user.id);
        const hasName = text.includes(triggerWord);
        const isOwner = client.isOwner(message.author.id);
        let isReplyToBot = false;

        if (message.reference) {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(()=>null);
            if (refMsg && refMsg.author.id === client.user.id) isReplyToBot = true;
        }

        if (!isImagine && !mentionsBot && !hasName && !isReplyToBot) return;

        if (!isOwner && (!message.guild || (typeof client.isPremium === 'function' && !client.isPremium(message.guild.id)))) {
            return message.reply('❌ **AI is a Premium feature!** Use `.premium` to learn how to upgrade your server.').catch(() => {});
        }

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

        if (!process.env.GEMINI_API_KEY) return message.reply("❌ **Setup Error:** API Key missing!");        
        await message.channel.sendTyping().catch(() => {});

        try {
            // Updated Prompt to teach her how to use Colors!
            const prompt = `[SYSTEM INSTRUCTION]\nYou are ${displayName}, a helpful Discord bot. \nRULE 1: To moderate: [CMD:KICK|ID:123|REASON:spam] (Supported: KICK, BAN, UNBAN, CLEAR, TIMEOUT, UNTIMEOUT. For clearing, use [CMD:CLEAR|AMOUNT:10]).\nRULE 2: To manage roles: [CMD:GIVEROLE|USER_ID:123|ROLE_ID:456] (Supported: GIVEROLE, REMOVEROLE, DELETEROLE). To create a role: [CMD:CREATEROLE|NAME:RoleName|COLOR:#hexcode]\nRULE 3: To manage channels: [CMD:CHANNELALLOW|CHANNEL_ID:123|ROLE_ID:456] (Supported: CHANNELALLOW, CHANNELDENY, USERALLOW, USERDENY). \nRULE 4: To create channels: [CMD:CREATECHANNEL|NAME:chat|ROLE_ID:123] (Omit ROLE_ID if public).\nRULE 5: To check for inactive users (0 messages): [CMD:CHECK_INACTIVE]\nRULE 6: Keep casual chat highly concise. Shorter text ensures faster API response times!\n\n[USER MESSAGE]\n${message.author.username} says: ${message.content}`;
            
            const isCodingRequest = /(code|script|c\+\+|vb|javascript|python|html|css|debug|error|function|api)/i.test(message.content);
            const selectedModel = isCodingRequest ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

            // Use the correct Generative AI syntax
            const model = genAI.getGenerativeModel({ model: selectedModel });
            const result = await model.generateContent(prompt);
            let replyText = result.response.text() || "";
            
            let functionName = null; let args = {};

            const cmdMatch = replyText.match(/\[.*?CMD:(KICK|BAN|UNBAN|CLEAR|TIMEOUT|UNTIMEOUT|GIVEROLE|REMOVEROLE|CREATEROLE|DELETEROLE|LISTROLES|LISTSERVERROLES|CHANNELALLOW|CHANNELDENY|USERALLOW|USERDENY|CREATECHANNEL|CHECK_INACTIVE)(?:\|(.*?))?\]/i);
            if (cmdMatch) {
                const action = cmdMatch[1].toUpperCase(); 
                const params = (cmdMatch[2] || '').split('|');
                const getParam = (key) => (params.find(p => p.toUpperCase().startsWith(key)) || '').split(':')[1]?.trim() || '';

                if (action === 'CLEAR') { 
                    functionName = 'clear_messages'; 
                    let rawAmount = parseInt(getParam('AMOUNT'));
                    if (isNaN(rawAmount)) {
                        const match = (cmdMatch[2] || '').match(/\d+/);
                        rawAmount = match ? parseInt(match[0]) : 0;
                    }
                    args.amount = rawAmount; 
                }
                else if (action === 'TIMEOUT') { functionName = 'timeout_member'; args.userId = getParam('ID'); args.minutes = parseInt(getParam('MINUTES')) || 1; args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'UNTIMEOUT') { functionName = 'untimeout_member'; args.userId = getParam('ID'); }
                else if (action === 'UNBAN') { functionName = 'unban_member'; args.userId = getParam('ID'); }
                else if (action === 'KICK' || action === 'BAN') { functionName = action.toLowerCase() + '_member'; args.userId = getParam('ID'); args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'GIVEROLE' || action === 'REMOVEROLE') { functionName = action === 'GIVEROLE' ? 'give_role' : 'remove_role'; args.userId = getParam('USER_ID'); args.roleId = getParam('ROLE_ID'); }
                else if (action === 'CREATEROLE') { functionName = 'create_role'; args.roleName = getParam('NAME'); args.color = getParam('COLOR'); }
                else if (action === 'DELETEROLE') { functionName = 'delete_role'; args.roleId = getParam('ROLE_ID'); }
                else if (action === 'CHANNELALLOW' || action === 'CHANNELDENY') { functionName = action.toLowerCase(); args.channelId = getParam('CHANNEL_ID'); args.roleId = getParam('ROLE_ID'); }
                else if (action === 'USERALLOW' || action === 'USERDENY') { functionName = action.toLowerCase(); args.channelId = getParam('CHANNEL_ID'); args.userId = getParam('USER_ID'); }
                else if (action === 'CREATECHANNEL') { functionName = 'create_channel'; args.channelName = getParam('NAME'); args.roleId = getParam('ROLE_ID'); }
                else if (action === 'CHECK_INACTIVE') { functionName = 'check_inactive'; }

                replyText = replyText.replace(cmdMatch[0], '').trim();
            }

            if (functionName) {
                const permErr = "❌ I or you lack the necessary permissions to execute this command.";
                const hasPerm = (perm) => message.member && message.member.permissions.has(perm) && message.guild.members.me.permissions.has(perm);

                if (['channel_allow', 'channel_deny', 'user_allow', 'user_deny', 'create_channel'].includes(functionName)) {
                    if (!hasPerm(PermissionFlagsBits.ManageChannels)) return message.reply(permErr);
                    if (functionName === 'create_channel') {
                        let overwrites = [];
                        if (args.roleId) { 
                            const cleanRoleId = args.roleId.replace(/\D/g, '');
                            overwrites = [{ id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: cleanRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }]; 
                        }
                        const nc = await message.guild.channels.create({ name: args.channelName || 'new-channel', type: 0, permissionOverwrites: overwrites });
                        return message.reply(`✅ Successfully created <#${nc.id}>!`);
                    }
                    const cleanChannelId = args.channelId ? args.channelId.replace(/\D/g, '') : null;
                    const channel = cleanChannelId ? (message.guild.channels.cache.get(cleanChannelId) || message.channel) : message.channel;
                    const allow = functionName.includes('allow');
                    const targetId = (args.roleId || args.userId || '').replace(/\D/g, '');
                    await channel.permissionOverwrites.edit(targetId, { ViewChannel: allow, SendMessages: allow });
                    return message.reply(`✅ Permissions safely updated for <#${channel.id}>.`);
                }

                if (['give_role', 'remove_role', 'create_role', 'delete_role'].includes(functionName)) {
                    if (!hasPerm(PermissionFlagsBits.ManageRoles)) return message.reply(permErr);
                    
                    if (functionName === 'create_role') { 
                        let roleColor = args.color ? args.color.replace(/[^a-fA-F0-9]/g, '') : null;
                        if (roleColor && roleColor.length === 6) roleColor = `#${roleColor}`;
                        else roleColor = null;

                        const newRole = await message.guild.roles.create({ 
                            name: args.roleName || 'New Role',
                            color: roleColor 
                        }); 
                        return message.reply(`✅ Created the role <@&${newRole.id}>!`); 
                    }

                    if (functionName === 'delete_role') { 
                        const role = message.guild.roles.cache.get((args.roleId||'').replace(/\D/g, '')); 
                        if (!role) return message.reply("❌ Role not found."); 
                        await role.delete(); return message.reply(`✅ Role deleted successfully.`); 
                    }
                    const member = await message.guild.members.fetch((args.userId||'').replace(/\D/g, '')).catch(()=>null);
                    const role = message.guild.roles.cache.get((args.roleId||'').replace(/\D/g, ''));
                    if (!member || !role) return message.reply("❌ Required User or Role could not be found.");
                    if (functionName === 'give_role') { await member.roles.add(role); return message.reply(`✅ Role assigned!`); }
                    else { await member.roles.remove(role); return message.reply(`✅ Role removed!`); }
                }

                if (functionName === "clear_messages" && hasPerm(PermissionFlagsBits.ManageMessages)) {
                    if (args.amount <= 0) return message.reply(`❌ Please specify how many messages to clear.`);
                    const deleteCount = Math.min(args.amount, 99) + 1;
                    await message.channel.bulkDelete(deleteCount, true).catch(()=>{});
                    return message.channel.send(`🧹 Successfully cleared ${args.amount} messages!`).then(m => setTimeout(()=>m.delete(), 3500));
                }

                if (functionName === 'check_inactive') {
                    if (!hasPerm(PermissionFlagsBits.ModerateMembers)) return message.reply("❌ You need Moderate Members permissions to scan the tracker database.");
                    const gCache = client.trackerCache ? client.trackerCache[message.guild.id] : null;
                    if (!gCache || Object.keys(gCache).length === 0) return message.reply("📊 **Inactivity Scan:** The tracking database is empty.");
                    
                    let inactiveList = [];
                    for (const userId in gCache) {
                        const s = gCache[userId].stats;
                        if ((s.msgs + s.media + s.links + s.voice + s.reacts + s.invites) === 0) inactiveList.push(`<@${userId}>`);
                    }
                    if (inactiveList.length === 0) return message.reply("✅ **Inactivity Scan:** Everyone currently tracked by the database has been active!");
                    else return message.reply(`⚠️ **Inactivity Scan:** Found **${inactiveList.length}** tracked users with 0 interactions:\n\n${inactiveList.join(', ').substring(0, 1900)}`);
                }

                const tId = (args.userId||'').replace(/\D/g, '');
                if (functionName === "unban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                    await message.guild.members.unban(tId).catch(()=>{}); return message.reply("✅ User Unbanned.");
                }

                const tMember = await message.guild.members.fetch(tId).catch(()=>null);
                if (!tMember || !tMember.manageable) return message.reply("❌ Cannot moderate this user due to role hierarchy.");

                if (functionName === "timeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    if (typeof client.sendPremiumModDM === 'function') await client.sendPremiumModDM(tMember, message.member, 'timeout', args.reason, `${args.minutes} minutes`, message.guild, caseId);
                    await tMember.timeout(args.minutes * 60 * 1000, args.reason).catch(()=>{}); 
                    return message.reply(`✅ Timed out <@${tId}> for ${args.minutes}m.`);
                }
                if (functionName === "untimeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    await tMember.timeout(null).catch(()=>{}); return message.reply(`✅ Removed timeout from <@${tId}>.`);
                }
                if (functionName === "kick_member" && hasPerm(PermissionFlagsBits.KickMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    if (typeof client.sendPremiumModDM === 'function') await client.sendPremiumModDM(tMember, message.member, 'kick', args.reason, null, message.guild, caseId);
                    await tMember.kick(args.reason).catch(()=>{}); 
                    return message.reply(`👢 Kicked <@${tId}>.`);
                }
                if (functionName === "ban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    if (typeof client.sendPremiumModDM === 'function') await client.sendPremiumModDM(tMember, message.member, 'ban', args.reason, 'Permanent', message.guild, caseId, 'https://discord.com');
                    await tMember.ban({ reason: args.reason }).catch(() => {});
                    return message.reply(`🔨 Banned <@${tId}>.`);
                }
            }

            if (replyText && replyText.trim().length > 0) {
                const cleanedText = replyText.trim();
                const textChunks = cleanedText.match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) await message.reply(chunk).catch(console.error); 
            } else if (!functionName) {
                await message.reply("⚠️ **Debug Error:** Processed prompt successfully, but text output was empty!").catch(console.error);
            }

        } catch (error) {
            console.error("Gemini AI error:", error);
            if (error.status === 429) {
                return message.reply("⏳ **I'm taking a quick breather!** We hit the free-tier rate limit. Try again in a minute!").catch(console.error);
            }
            return message.reply(`❌ **AI Crash Report:** \`${error.message || error}\``).catch(console.error);
        }
    }); 
};
