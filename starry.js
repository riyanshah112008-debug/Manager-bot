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
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini & Caching
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const blacklistedUsers = new Set();

module.exports = (client) => {

    // Load Premium Module 
    require('./premium.js')(client);
    // ==========================================
    // 👑 MULTI-OWNER VERIFICATION HELPER
    // ==========================================
    client.isOwner = (userId) => {
        const owners = (process.env.OWNER_ID || '').split(',').map(id => id.trim());
        return owners.includes(userId);
    };

    // ==========================================
    // 💎 PREMIUM MODERATION DM ENGINE (REPAIRED)
    // ==========================================
    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A', appealLink = null) => {
        // Discord strictly prohibits DMing bots. Immediately abort to prevent API errors.
        if (member.user.bot) {
            console.log(`[Mod DM] Skipped DMing ${member.user.tag} because they are a bot.`);
            return false;
        }

        const actionType = action.toLowerCase();
        const isGuildPremium = typeof client.isPremium === 'function' ? client.isPremium(guild.id) : false;

        // --- FREE TIER FALLBACK ---
        if (!isGuildPremium) {
            const basicEmbed = new EmbedBuilder()
                .setColor('#2F3136')
                .setTitle(`Moderation Notice: ${actionType.toUpperCase()}`)
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
                console.error(`🚨 [DM FAILED - FREE TIER] Target: ${member.user.tag} | Reason:`, err.message);
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
            .setDescription(`Hello **${member.user.username}**, you have received a formal moderation action in **${guild.name}**.\n\nPlease review the details below.`)
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
        if (['ban', 'timeout'].includes(actionType) && appealLink) row.addComponents(new ButtonBuilder().setLabel('Submit Appeal').setURL(appealLink).setStyle(ButtonStyle.Link).setEmoji('⚖️'));
        if (actionType !== 'ban') row.addComponents(new ButtonBuilder().setLabel('Read Server Rules').setURL('https://discord.com').setStyle(ButtonStyle.Link).setEmoji('📜'));
        if (row.components.length > 0) components.push(row);

        try { 
            await member.send({ embeds: [modEmbed], components: components }); 
            return true; 
        } catch (error) { 
            console.error(`🚨 [DM FAILED - PREMIUM TIER] Target: ${member.user.tag} | Reason:`, error.message);
            return false; 
        }
    };

    client.on('clientReady', () => { 
        console.log('✅ Starry Protocol Module Loaded (Powered by Gemini!)'); 
    });
    // ==========================================
    // 🛠️ UTILITIES & HELPER FUNCTIONS
    // ==========================================
    const generateServerDump = async (guild) => {
        await guild.members.fetch();
        let dump = `=================================================\n             SERVER DUMP: ${guild.name.toUpperCase()} \n=================================================\n\n[SERVER INFO]\n- Server ID     : ${guild.id}\n- Total Members : ${guild.memberCount}\n- Owner ID      : ${guild.ownerId}\n\n=================================================\n                 CHANNELS \n=================================================\n\n`;
        const getTypeName = (type) => [0, 2, 4, 5, 15].includes(type) ? ['📝 TEXT ', '🔊 VOICE', '📁 CAT  ', '📢 ANN  ', '💬 FORUM'][[0, 2, 4, 5, 15].indexOf(type)] : '📄 MISC ';
        const categories = guild.channels.cache.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
        const textAndVoice = guild.channels.cache.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
        
        categories.forEach(cat => {
            dump += `[📁 ${cat.name.toUpperCase()}] (ID: ${cat.id})\n`;
            textAndVoice.filter(c => c.parentId === cat.id).forEach(c => dump += `   ├─ [${getTypeName(c.type)}] ${c.name} (ID: ${c.id})\n`);
            dump += `\n`;
        });
        return Buffer.from(dump, 'utf-8');
    };

    // ==========================================
    // 1. BUMP TRACKERS & BASIC SETUP
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        // Disboard Bump Tracker
        if (message.author.id === '302050872383242240') {
            if (message.embeds.length > 0 && message.embeds[0].description?.includes('Bump done')) {
                const bumpEmbed = new EmbedBuilder().setColor('#3BA55C').setTitle('📈 Server Bumped!').setDescription('Thank you for bumping the server! You can bump us again in 2 hours.');
                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }

        // Discardia / Discadia Bump Tracker
        const lowerName = message.author.username.toLowerCase();
        if (lowerName.includes('discardia') || lowerName.includes('discadia')) {
            const embed = message.embeds[0];
            if (embed && ((embed.description?.toLowerCase().includes('bump')) || (embed.title?.toLowerCase().includes('bump')))) {
                const bumpEmbed = new EmbedBuilder().setColor('#5865F2').setTitle('🚀 Server Bumped on Discardia!').setDescription('Thank you for boosting our server! We will remind you when it is time to bump again.');
                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }

        // ==========================================
        // 2. OWNER-ONLY DEVELOPER COMMANDS
        // ==========================================
        const text = message.content.toLowerCase();
        const isOwner = client.isOwner(message.author.id);

        const notOwnerMsg = "❌ **Access Denied:** You are not recognized as the bot owner!";

        if (text === '.dev') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            try {
                await message.author.send(`💻 **Starry Developer Commands (Owner-Only):**\n\n\`.servers\` - Lists all servers.\n\`.serverdump\` - Full text data dump.\n\`.sysinfo\` - Bot stats.\n\`.eval <code>\` - Run raw JavaScript.\n\`.broadcast <msg>\` - Send message to ALL servers.\n\`.leaveserver <ID>\` - Remotely force leave.\n\`.blacklist <ID>\` - Block a user.\n\`.emergencyleave\` - Force leave current server.\n\`.restart\` - Kills the bot process.\n\`.setstatus <text>\` - Changes status.`);
                return message.reply('📬 Check your DMs!').catch(() => {});
            } catch (err) { return message.reply('❌ I couldn\'t DM you!').catch(() => {}); }
        }

        if (text === '.sysinfo') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            return message.reply(`📊 **Starry System Info:**\n- **RAM Usage:** ${memory} MB\n- **Uptime:** ${(process.uptime() / 3600).toFixed(2)} Hours\n- **Ping:** ${client.ws.ping}ms`).catch(()=>{});
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
                if (channel) { channel.send(`📢 **Message from Starry's Developer:**\n\n${announcement}`).catch(()=>{}); successCount++; }
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
            await message.reply('I am leaving this server now. Goodbye! 👋').catch(() => {});
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
    // 3. INTERACTIVE BUTTON & MODAL DEV PANEL
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (interaction.user.id !== process.env.OWNER_ID) {
            if (interaction.isRepliable()) return interaction.reply({ content: '❌ **Access Denied:** You are not recognized as the bot owner!', ephemeral: true });
            return;
        }

        if (interaction.isChatInputCommand() && interaction.commandName === 'devpanel') {
            const embed = new EmbedBuilder().setTitle('💻 Starry Developer Control Panel').setDescription('Click a button below to execute an owner-only developer command. Buttons with a **📝** will open a pop-up text box for input.').setColor('#5865F2').setFooter({ text: 'Powered by Starry Protocol • Owner Access Only' });
            
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
                new ButtonBuilder().setCustomId('dev_leaveserver_btn').setLabel('Leave Server by ID').setStyle(ButtonStyle.Danger).setEmoji('📝'),
                new ButtonBuilder().setCustomId('dev_emergencyleave').setLabel('Leave Current Server').setStyle(ButtonStyle.Danger).setEmoji('⚠️')
            );
            const row4 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('dev_restart').setLabel('Reboot Bot').setStyle(ButtonStyle.Danger).setEmoji('🔄'));
            
            return interaction.reply({ embeds: [embed], components: [row1, row2, row3, row4], ephemeral: true });
        }

        if (interaction.isButton()) {
            const id = interaction.customId;
            if (id === 'dev_sysinfo') {
                const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                return interaction.reply({ content: `📊 **Starry System Info:**\n- **RAM Usage:** ${memory} MB\n- **Uptime:** ${(process.uptime() / 3600).toFixed(2)} Hours\n- **Ping:** ${client.ws.ping}ms`, ephemeral: true });
            }
            if (id === 'dev_servers') {
                let serverList = `🌐 **Starry is in ${client.guilds.cache.size} servers:**\n\n`;
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
            if (id === 'dev_restart') { await interaction.reply({ content: '🔄 **Initiating remote reboot...**', ephemeral: true }); process.exit(1); }
            if (id === 'dev_emergencyleave') { if (!interaction.guild) return interaction.reply({ content: 'Not in a server!', ephemeral: true }); await interaction.reply({ content: 'I am leaving this server now. Goodbye! 👋', ephemeral: true }); return interaction.guild.leave(); }

            // Modals
            if (id === 'dev_eval_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_eval').setTitle('Execute JavaScript').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('eval_code').setLabel('Code to evaluate').setStyle(TextInputStyle.Paragraph).setRequired(true))));
            if (id === 'dev_broadcast_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_broadcast').setTitle('Global Server Broadcast').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('broadcast_msg').setLabel('Announcement Message').setStyle(TextInputStyle.Paragraph).setRequired(true))));
            if (id === 'dev_status_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_status').setTitle('Change Bot Status').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('status_text').setLabel('New Status Text').setStyle(TextInputStyle.Short).setRequired(true))));
            if (id === 'dev_blacklist_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_blacklist').setTitle('Toggle User Blacklist').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target_id').setLabel('Discord User ID').setStyle(TextInputStyle.Short).setRequired(true))));
            if (id === 'dev_leaveserver_btn') return interaction.showModal(new ModalBuilder().setCustomId('modal_leave').setTitle('Force Leave Server').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server_id').setLabel('Discord Server ID').setStyle(TextInputStyle.Short).setRequired(true))));
        }

        if (interaction.isModalSubmit()) {
            const id = interaction.customId;
            if (id === 'modal_eval') { await interaction.deferReply({ ephemeral: true }); try { let evaled = eval(interaction.fields.getTextInputValue('eval_code')); if (typeof evaled !== "string") evaled = require("util").inspect(evaled); return interaction.editReply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``); } catch (err) { return interaction.editReply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``); } }
            if (id === 'modal_broadcast') { await interaction.deferReply({ ephemeral: true }); const msg = interaction.fields.getTextInputValue('broadcast_msg'); let count = 0; client.guilds.cache.forEach(guild => { const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages')); if (channel) { channel.send(`📢 **Message from Starry's Developer:**\n\n${msg}`).catch(()=>{}); count++; } }); return interaction.editReply(`✅ Broadcast sent to ${count} servers!`); }
            if (id === 'modal_status') { client.user.setActivity(interaction.fields.getTextInputValue('status_text'), { type: 4 }); return interaction.reply({ content: '✅ Status updated!', ephemeral: true }); }
            if (id === 'modal_blacklist') { const targetId = interaction.fields.getTextInputValue('target_id').trim(); if (blacklistedUsers.has(targetId)) { blacklistedUsers.delete(targetId); return interaction.reply({ content: `✅ Removed \`${targetId}\` from the blacklist.`, ephemeral: true }); } else { blacklistedUsers.add(targetId); return interaction.reply({ content: `🚫 Added \`${targetId}\` to the blacklist.`, ephemeral: true }); } }
            if (id === 'modal_leave') { const guildToLeave = client.guilds.cache.get(interaction.fields.getTextInputValue('server_id').trim()); if (!guildToLeave) return interaction.reply({ content: '❌ Not in a server with that ID.', ephemeral: true }); await guildToLeave.leave(); return interaction.reply({ content: `✅ Successfully left **${guildToLeave.name}**.`, ephemeral: true }); }
        }
    });
    // ==========================================
    // 4. AI & IMAGE GENERATION ROUTER
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content || blacklistedUsers.has(message.author.id)) return;

        const text = message.content.toLowerCase();
        const isImagine = text.startsWith('.imagine ');
        const mentionsBot = message.mentions.has(client.user.id);
        const hasName = text.includes('starry');
        const isOwner = message.author.id === process.env.OWNER_ID;
        let isReplyToBot = false;

        if (message.reference) {
            const refMsg = await message.channel.messages.fetch(message.reference.messageId).catch(()=>null);
            if (refMsg && refMsg.author.id === client.user.id) isReplyToBot = true;
        }

        if (!isImagine && !mentionsBot && !hasName && !isReplyToBot) return;

        if (!isOwner && (!message.guild || (typeof client.isPremium === 'function' && !client.isPremium(message.guild.id)))) {
            return message.reply('❌ **Starry AI is a Premium feature!** Use `.premium` to learn how to upgrade your server.').catch(() => {});
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
            if (!imagePrompt) return message.reply('Please tell me what to draw!').catch(() => {});
            const replyMsg = await message.reply('🎨 Painting your picture...').catch(() => null);
            if (!replyMsg) return;
            try {
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&nologo=true`;
                await message.reply({ content: `🖼️ **${imagePrompt}**\nGenerated by ${message.author}`, files: [{ attachment: imageUrl, name: imagePrompt.replace(/\s+/g, '_') + '.png' }] }).catch(() => {});
                return await replyMsg.delete().catch(() => {});
            } catch (error) { return replyMsg.edit('❌ Trouble drawing that.').catch(() => {}); }
        }

        if (!process.env.GEMINI_API_KEY) return message.reply("❌ **Setup Error:** I cannot read your `GEMINI_API_KEY`!");
        await message.channel.sendTyping().catch(() => {});

        // ==========================================
        // 5. GEMINI EXECUTION & NLP MODERATION
        // ==========================================
        try {
            const prompt = `[SYSTEM INSTRUCTION]\nYou are Starry, a helpful Discord bot. \nRULE 1: To moderate: [CMD:KICK|ID:123|REASON:spam] (Supported: KICK, BAN, UNBAN, CLEAR, TIMEOUT, UNTIMEOUT).\nRULE 2: To manage roles: [CMD:GIVEROLE|USER_ID:123|ROLE_ID:456] (Supported: GIVEROLE, REMOVEROLE, CREATEROLE, DELETEROLE, LISTROLES).\nRULE 3: To manage channels: [CMD:CHANNELALLOW|CHANNEL_ID:123|ROLE_ID:456] (Supported: CHANNELALLOW, CHANNELDENY, USERALLOW, USERDENY). \nRULE 4: To create channels: [CMD:CREATECHANNEL|NAME:chat|ROLE_ID:123] (Omit ROLE_ID if the channel should be public).\nRULE 5: For commands: [RUN:.imagine penguin]\nRULE 6: Keep casual chat highly concise and direct. Shorter text ensures faster API response times!\n\n[USER MESSAGE]\n${message.author.username} says: ${message.content}`;
            const isCodingRequest = /(code|script|c\+\+|vb|vbscript|javascript|python|html|css|debug|error|function|api)/i.test(message.content);
            let selectedModel = isCodingRequest ? 'gemini-3.5-flash' : 'gemini-3.1-flash-lite';
            let fallbackModel = isCodingRequest ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';

            let geminiResponse;
            let attempts = 0;
            while (attempts < 4) {
                try {
                    geminiResponse = await ai.models.generateContent({ model: selectedModel, contents: prompt });
                    break; 
                } catch (apiError) {
                    attempts++;
                    if (apiError.status === 503 && attempts < 4) {
                        if (attempts === 3) selectedModel = fallbackModel;
                        await new Promise(resolve => setTimeout(resolve, attempts * 2000));
                    } else throw apiError; 
                }
            }

            let replyText = geminiResponse.text || "";
            let functionName = null; let args = {};

            const runMatch = replyText.match(/\[.*?RUN:(.*?)\]/i);
            if (runMatch) {
                message.content = runMatch[1].trim(); replyText = replyText.replace(runMatch[0], '').trim();
                client.emit('messageCreate', message); if (replyText.length === 0) return;
            }

            const cmdMatch = replyText.match(/\[.*?CMD:(KICK|BAN|UNBAN|CLEAR|TIMEOUT|UNTIMEOUT|GIVEROLE|REMOVEROLE|CREATEROLE|DELETEROLE|LISTROLES|LISTSERVERROLES|CHANNELALLOW|CHANNELDENY|USERALLOW|USERDENY|CREATECHANNEL)(?:\|(.*?))?\]/i);
            if (cmdMatch) {
                const action = cmdMatch[1].toUpperCase(); const params = (cmdMatch[2] || '').split('|');
                const getParam = (key) => (params.find(p => p.toUpperCase().startsWith(key)) || '').split(':')[1]?.trim() || '';

                if (action === 'CLEAR') { functionName = 'clear_messages'; args.amount = parseInt(getParam('AMOUNT')) || 0; }
                else if (action === 'TIMEOUT') { functionName = 'timeout_member'; args.userId = getParam('ID'); args.minutes = parseInt(getParam('MINUTES')) || 1; args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'UNTIMEOUT') { functionName = 'untimeout_member'; args.userId = getParam('ID'); }
                else if (action === 'UNBAN') { functionName = 'unban_member'; args.userId = getParam('ID'); }
                else if (action === 'KICK' || action === 'BAN') { functionName = action.toLowerCase() + '_member'; args.userId = getParam('ID'); args.reason = getParam('REASON') || "AI Moderation"; }
                else if (action === 'GIVEROLE' || action === 'REMOVEROLE') { functionName = action === 'GIVEROLE' ? 'give_role' : 'remove_role'; args.userId = getParam('USER_ID'); args.roleId = getParam('ROLE_ID'); }
                else if (action === 'CREATEROLE') { functionName = 'create_role'; args.roleName = getParam('NAME'); args.permissions = getParam('PERMISSIONS'); }
                else if (action === 'DELETEROLE') { functionName = 'delete_role'; args.roleId = getParam('ROLE_ID'); }
                else if (action === 'LISTROLES') { functionName = 'list_roles'; args.userId = getParam('USER_ID') || getParam('ID'); }
                else if (action === 'LISTSERVERROLES') { functionName = 'list_server_roles'; }
                else if (action === 'CHANNELALLOW' || action === 'CHANNELDENY') { functionName = action.toLowerCase(); args.channelId = getParam('CHANNEL_ID'); args.roleId = getParam('ROLE_ID'); }
                else if (action === 'USERALLOW' || action === 'USERDENY') { functionName = action.toLowerCase(); args.channelId = getParam('CHANNEL_ID'); args.userId = getParam('USER_ID'); }
                else if (action === 'CREATECHANNEL') { functionName = 'create_channel'; args.channelName = getParam('NAME'); args.roleId = getParam('ROLE_ID'); }

                replyText = replyText.replace(cmdMatch[0], '').trim();
                const rogueRunMatch = replyText.match(/\(RUN:.*?\)/i); if (rogueRunMatch) replyText = replyText.replace(rogueRunMatch[0], '').trim();
            }
            // Moderation Action Execution
            if (functionName) {
                const permErr = "❌ Missing permissions.";
                const hasPerm = (perm) => message.member && message.member.permissions.has(perm) && message.guild.members.me.permissions.has(perm);

                if (['channel_allow', 'channel_deny', 'user_allow', 'user_deny', 'create_channel'].includes(functionName)) {
                    if (!hasPerm(PermissionFlagsBits.ManageChannels)) return message.reply(permErr);
                    if (functionName === 'create_channel') {
                        let overwrites = [];
                        if (args.roleId) { overwrites = [{ id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: args.roleId.replace(/\D/g, ''), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }]; }
                        const nc = await message.guild.channels.create({ name: args.channelName || 'new-channel', type: 0, permissionOverwrites: overwrites });
                        return message.reply(`✅ Created <#${nc.id}>!`);
                    }
                    const channel = args.channelId ? (message.guild.channels.cache.get(args.channelId.replace(/\D/g, '')) || message.channel) : message.channel;
                    const allow = functionName.includes('allow');
                    const targetId = (args.roleId || args.userId || '').replace(/\D/g, '');
                    await channel.permissionOverwrites.edit(targetId, { ViewChannel: allow, SendMessages: allow });
                    return message.reply(`✅ Permissions updated for <#${channel.id}>.`);
                }

                if (['give_role', 'remove_role', 'create_role', 'delete_role'].includes(functionName)) {
                    if (!hasPerm(PermissionFlagsBits.ManageRoles)) return message.reply(permErr);
                    if (functionName === 'create_role') { const newRole = await message.guild.roles.create({ name: args.roleName || 'New Role' }); return message.reply(`✅ Created role **${newRole.name}**!`); }
                    if (functionName === 'delete_role') { const role = message.guild.roles.cache.get((args.roleId||'').replace(/\D/g, '')); if (!role) return; await role.delete(); return message.reply(`✅ Role deleted.`); }
                    const member = await message.guild.members.fetch((args.userId||'').replace(/\D/g, '')).catch(()=>null);
                    const role = message.guild.roles.cache.get((args.roleId||'').replace(/\D/g, ''));
                    if (!member || !role) return message.reply("❌ User or Role not found.");
                    if (functionName === 'give_role') { await member.roles.add(role); return message.reply(`✅ Role assigned!`); }
                    else { await member.roles.remove(role); return message.reply(`✅ Role removed!`); }
                }

                if (functionName === "clear_messages" && hasPerm(PermissionFlagsBits.ManageMessages)) {
                    await message.channel.bulkDelete(Math.min(args.amount || 0, 100) + 1, true).catch(()=>{});
                    return message.channel.send(`🧹 Cleared ${args.amount} messages!`).then(m => setTimeout(()=>m.delete(), 3000));
                }

                const tId = (args.userId||'').replace(/\D/g, '');
                if (functionName === "unban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                    await message.guild.members.unban(tId).catch(()=>{}); return message.reply("✅ Unbanned.");
                }

                // --- 💎 AI MODERATION WITH PREMIUM DMS INJECTED HERE ---
                const tMember = await message.guild.members.fetch(tId).catch(()=>null);
                if (!tMember || !tMember.manageable) return message.reply("❌ Cannot moderate this user.");

                if (functionName === "timeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    const dmSent = await client.sendPremiumModDM(tMember, message.member, 'timeout', args.reason, `${args.minutes} minutes`, message.guild, caseId);
                    await tMember.timeout(args.minutes * 60 * 1000, args.reason).catch(()=>{}); 
                    return message.reply(`✅ Timed out <@${tId}> for ${args.minutes}m. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                }
                if (functionName === "untimeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    await tMember.timeout(null).catch(()=>{}); return message.reply(`✅ Removed timeout from <@${tId}>.`);
                }
                if (functionName === "kick_member" && hasPerm(PermissionFlagsBits.KickMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    const dmSent = await client.sendPremiumModDM(tMember, message.member, 'kick', args.reason, null, message.guild, caseId);
                    await tMember.kick(args.reason).catch(()=>{}); 
                    return message.reply(`👢 Kicked <@${tId}>. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                }
                if (functionName === "ban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                    const caseId = Math.floor(Math.random() * 90000) + 10000;
                    const dmSent = await client.sendPremiumModDM(tMember, message.member, 'ban', args.reason, 'Permanent', message.guild, caseId, 'https://discord.com');
                    await tMember.ban({ reason: args.reason }).catch(() => {});
                    return message.reply(`🔨 Banned <@${tId}>. ${dmSent ? '*(User Notified)*' : '*(DMs Closed)*'}`);
                }
            }

            // Text Chunker
            if (replyText && replyText.trim().length > 0) {
                const cleanedText = replyText.trim();
                const textChunks = cleanedText.match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) await message.reply(chunk).catch(console.error); 
            } else if (!functionName && !runMatch) {
                await message.reply("⚠️ **Debug Error:** Processed prompt successfully, but text output was empty!").catch(console.error);
            }
        } catch (error) {
            console.error("Gemini AI error:", error);
                        if (error.status === 429) {
                const ownerIds = (process.env.OWNER_ID || '').split(',').map(id => id.trim());
                for (const ownerId of ownerIds) {
                    try { 
                        const owner = await client.users.fetch(ownerId); 
                        await owner.send(`⚠️ **API Quota Exhausted!**\nStarry hit the rate limit.\n**Location:** ${message.guild ? message.guild.name : 'DMs'}\n**Triggered by:** ${message.author.username}`); 
                    } catch (dmError) { 
                        console.error(`Failed to DM owner ${ownerId}.`); 
                    }
                }
                return message.reply("⏳ **Starry is taking a quick breather!** We hit the free-tier rate limit. Try again in a minute!").catch(console.error);
            }

    }); 
};
