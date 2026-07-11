const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const blacklistedUsers = new Set();

module.exports = (client) => {
    client.on('ready', () => { 
        console.log('✅ Starry Protocol Module Loaded (Powered by Gemini!)'); 
    });

    // ==========================================
    // 1. BUMP TRACKERS & BASIC SETUP
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content) return;
        if (blacklistedUsers.has(message.author.id)) return;

        // Disboard Bump Tracker
        if (message.author.id === '302050872383242240') {
            if (message.embeds.length > 0 && message.embeds[0].description && message.embeds[0].description.includes('Bump done')) {
                const bumpEmbed = new EmbedBuilder().setColor('#3BA55C').setTitle('📈 Server Bumped!').setDescription('Thank you for bumping the server! You can bump us again in 2 hours.');
                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }

        // Discardia / Discadia Bump Tracker
        if (message.author.username.toLowerCase().includes('discardia') || message.author.username.toLowerCase().includes('discadia')) {
            const embed = message.embeds[0];
            if (embed && ((embed.description && embed.description.toLowerCase().includes('bump')) || (embed.title && embed.title.toLowerCase().includes('bump')))) {
                const bumpEmbed = new EmbedBuilder().setColor('#5865F2').setTitle('🚀 Server Bumped on Discardia!').setDescription('Thank you for boosting our server! We will remind you when it is time to bump again.');
                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }
        // ==========================================
        // 2. OWNER-ONLY DEVELOPER COMMANDS
        // ==========================================
        const text = message.content.toLowerCase();
        const isOwner = message.author.id === process.env.OWNER_ID;
        const notOwnerMsg = "❌ **Access Denied:** You are not recognized as the bot owner! Ensure your exact Discord ID is pasted into the `OWNER_ID` variable on Render.";

        if (text === '.dev') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            try {
                await message.author.send(`💻 **Starry Developer Commands (Owner-Only):**\n\n\`.servers\` - Lists all servers.\n\`.serverdump\` - Full text data dump.\n\`.sysinfo\` - Bot stats.\n\`.eval <code>\` - Run raw JavaScript.\n\`.broadcast <msg>\` - Send message to ALL servers.\n\`.leaveserver <ID>\` - Remotely force leave.\n\`.blacklist <ID>\` - Block a user.\n\`.emergencyleave\` - Force leave current server.\n\`.restart\` - Kills the bot process.\n\`.setstatus <text>\` - Changes status.`);
                return message.reply('📬 Check your DMs!').catch(() => {});
            } catch (err) { return message.reply('❌ I couldn\'t DM you! Make sure your DMs are open.').catch(() => {}); }
        }

        if (text === '.sysinfo') {
            if (!isOwner) return message.reply(notOwnerMsg).catch(()=>{});
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const uptime = (process.uptime() / 3600).toFixed(2);
            return message.reply(`📊 **Starry System Info:**\n- **RAM Usage:** ${memory} MB\n- **Uptime:** ${uptime} Hours\n- **Ping:** ${client.ws.ping}ms`).catch(()=>{});
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
                const channel = guild.channels.cache.find(c => 
                    c.type === 0 && 
                    (c.name.toLowerCase().includes('general') || c.name.toLowerCase().includes('chat') || c.name.toLowerCase().includes('main')) && 
                    c.permissionsFor(guild.members.me).has('SendMessages')
                ) || guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));

                if (channel) { 
                    channel.send(`📢 **Message from Starry's Developer:**\n\n${announcement}`).catch(()=>{}); 
                    successCount++; 
                }
            });
            return message.reply(`✅ Broadcast successfully sent to the general chat of ${successCount} servers!`).catch(()=>{});
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
                const guild = message.guild; 
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

                const buffer = Buffer.from(dump, 'utf-8');
                return message.reply({ content: `✅ **Dump Complete:**`, files: [{ attachment: buffer, name: `${guild.name.replace(/[^a-zA-Z0-9]/g, '_')}_Dump.txt` }] }).catch(()=>{});
            } catch (err) {
                return message.reply(`❌ Failed to compile dump: ${err.message}`).catch(()=>{});
            }
        }
    });
    // ==========================================
    // 3. SLASH COMMAND PANEL (/devpanel)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'devpanel') return;

        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '❌ **Access Denied:** You are not recognized as the bot owner!', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        try {
            if (sub === 'sysinfo') {
                const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
                const uptime = (process.uptime() / 3600).toFixed(2);
                return interaction.reply({ content: `📊 **Starry System Info:**\n- **RAM Usage:** ${memory} MB\n- **Uptime:** ${uptime} Hours\n- **Ping:** ${client.ws.ping}ms`, ephemeral: true });
            }
            if (sub === 'servers') {
                let serverList = `🌐 **Starry is in ${client.guilds.cache.size} servers:**\n\n`;
                client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount).forEach(g => { serverList += `🔹 **${g.name}** (${g.memberCount} members)\n`; });
                return interaction.reply({ content: serverList.slice(0, 1999), ephemeral: true });
            }
            if (sub === 'serverdump') {
                await interaction.deferReply({ ephemeral: true });
                const guild = interaction.guild;
                if (!guild) return interaction.editReply('❌ Must be used inside a server.');
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

                const buffer = Buffer.from(dump, 'utf-8');
                return interaction.editReply({ content: `✅ **Dump Complete:**`, files: [{ attachment: buffer, name: `${guild.name.replace(/[^a-zA-Z0-9]/g, '_')}_Dump.txt` }] });
            }
            if (sub === 'restart') {
                await interaction.reply({ content: '🔄 **Initiating remote reboot...**', ephemeral: true });
                process.exit(1);
            }
            if (sub === 'emergencyleave') {
                if (!interaction.guild) return interaction.reply({ content: 'Not in a server!', ephemeral: true });
                await interaction.reply({ content: 'I am leaving this server now. Goodbye! 👋', ephemeral: true });
                return interaction.guild.leave();
            }
            if (sub === 'broadcast') {
                await interaction.deferReply({ ephemeral: true });
                const msg = interaction.options.getString('message');
                let count = 0;
                client.guilds.cache.forEach(guild => {
                    const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));
                    if (channel) { channel.send(`📢 **Message from Starry's Developer:**\n\n${msg}`).catch(()=>{}); count++; }
                });
                return interaction.editReply(`✅ Broadcast sent to ${count} servers!`);
            }
            if (sub === 'eval') {
                await interaction.deferReply({ ephemeral: true });
                try {
                    let evaled = eval(interaction.options.getString('code'));
                    if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
                    return interaction.editReply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``);
                } catch (err) { return interaction.editReply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``); }
            }
            if (sub === 'blacklist') {
                const targetId = interaction.options.getString('user_id');
                if (blacklistedUsers.has(targetId)) {
                    blacklistedUsers.delete(targetId); return interaction.reply({ content: `✅ Removed \`${targetId}\` from the blacklist.`, ephemeral: true });
                } else {
                    blacklistedUsers.add(targetId); return interaction.reply({ content: `🚫 Added \`${targetId}\` to the blacklist.`, ephemeral: true });
                }
            }
            if (sub === 'leaveserver') {
                const guildToLeave = client.guilds.cache.get(interaction.options.getString('server_id'));
                if (!guildToLeave) return interaction.reply({ content: '❌ Not in that server.', ephemeral: true });
                await guildToLeave.leave();
                return interaction.reply({ content: `✅ Left **${guildToLeave.name}**.`, ephemeral: true });
            }
            if (sub === 'setstatus') {
                client.user.setActivity(interaction.options.getString('status_text'), { type: 4 });
                return interaction.reply({ content: '✅ Status updated!', ephemeral: true });
            }
        } catch (err) {
            console.error(err);
            if (interaction.deferred) interaction.editReply('❌ Error executing command.');
            else interaction.reply({ content: '❌ Error executing command.', ephemeral: true });
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

        // Premium Check (Owners bypass this)
        if (!isOwner && (!message.guild || (typeof client.isPremium === 'function' && !client.isPremium(message.guild.id)))) {
            return message.reply('❌ **Starry AI is a Premium feature!** Use `.premium` to learn how to upgrade your server.').catch(() => {});
        }

        // Natural Language Image Router
        const imageRegex = /(?:create|generate|draw|make|paint) (?:an? |some )?(?:image|picture|drawing|art|photo) (?:of )?(.*)/i;
        let isImageRequest = isImagine;
        let imagePrompt = "";

        if (isImagine) {
            imagePrompt = message.content.slice(9).trim();
        } else if (hasName || mentionsBot) {
            const match = message.content.match(imageRegex);
            if (match) {
                isImageRequest = true;
                imagePrompt = match[1].trim(); 
            }
        }

        // Image Execution via Pollinations
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

        if (!process.env.GEMINI_API_KEY) {
            return message.reply("❌ **Setup Error:** I cannot read your `GEMINI_API_KEY`! Make sure your main file uses `require('dotenv').config();`.");
        }

        await message.channel.sendTyping().catch(() => {});
        // ==========================================
        // 5. GEMINI EXECUTION & MODERATION
        // ==========================================
        try {
            const prompt = `[SYSTEM INSTRUCTION]\nYou are Starry, a helpful Discord bot. \nRULE 1: To moderate: [CMD:KICK|ID:123|REASON:spam] (Supported: KICK, BAN, UNBAN, CLEAR, TIMEOUT, UNTIMEOUT).\nRULE 2: To manage roles: [CMD:GIVEROLE|USER_ID:123|ROLE_ID:456] (Supported: GIVEROLE, REMOVEROLE, CREATEROLE, DELETEROLE, LISTROLES).\nRULE 3: To manage channels: [CMD:CHANNELALLOW|CHANNEL_ID:123|ROLE_ID:456] (Supported: CHANNELALLOW, CHANNELDENY, USERALLOW, USERDENY). \nRULE 4: To create channels: [CMD:CREATECHANNEL|NAME:chat|ROLE_ID:123] (Omit ROLE_ID if the channel should be public).\nRULE 5: For commands: [RUN:.imagine penguin]\nRULE 6: Keep casual chat highly concise and direct. Shorter text ensures faster API response times!\n\n[USER MESSAGE]\n${message.author.username} says: ${message.content}`;

            const isCodingRequest = /(code|script|c\+\+|vb|vbscript|javascript|python|html|css|debug|error|function|api)/i.test(message.content);
            let selectedModel = isCodingRequest ? 'gemini-3.5-flash' : 'gemini-3.1-flash-lite';
            let fallbackModel = isCodingRequest ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';

            let geminiResponse;
            let attempts = 0;
            const maxAttempts = 4; 

            // Single, clean auto-retry loop with exponential backoff
            while (attempts < maxAttempts) {
                try {
                    geminiResponse = await ai.models.generateContent({
                        model: selectedModel, 
                        contents: prompt 
                    });
                    break; 
                } catch (apiError) {
                    attempts++;
                    if (apiError.status === 503 && attempts < maxAttempts) {
                        const waitTime = attempts * 2000; 
                        if (attempts === maxAttempts - 1) selectedModel = fallbackModel;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    } else {
                        throw apiError; 
                    }
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
                        if (args.roleId) {
                            overwrites = [
                                { id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, 
                                { id: args.roleId.replace(/\D/g, ''), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                            ];
                        }
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
                    if (functionName === 'create_role') {
                        const newRole = await message.guild.roles.create({ name: args.roleName || 'New Role' });
                        return message.reply(`✅ Created role **${newRole.name}**!`);
                    }
                    if (functionName === 'delete_role') {
                        const role = message.guild.roles.cache.get((args.roleId||'').replace(/\D/g, ''));
                        if (!role) return; await role.delete(); return message.reply(`✅ Role deleted.`);
                    }
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

                const tMember = await message.guild.members.fetch(tId).catch(()=>null);
                if (!tMember || !tMember.manageable) return message.reply("❌ Cannot moderate this user.");

                if (functionName === "timeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    await tMember.timeout(args.minutes * 60 * 1000, args.reason).catch(()=>{}); 
                    return message.reply(`✅ Timed out <@${tId}> for ${args.minutes}m.`);
                }
                if (functionName === "untimeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    await tMember.timeout(null).catch(()=>{}); 
                    return message.reply(`✅ Removed timeout from <@${tId}>.`);
                }
                if (functionName === "kick_member" && hasPerm(PermissionFlagsBits.KickMembers)) {
                    await tMember.kick(args.reason).catch(()=>{}); 
                    return message.reply(`👢 Kicked <@${tId}>.`);
                }
                if (functionName === "ban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                    await tMember.ban({ reason: args.reason }).catch(() => {});
                    return message.reply(`🔨 banned <@${tId}>.`);
                }
            }

            // Text Chunker (Bypasses 2000 character limit)
            if (replyText && replyText.trim().length > 0) {
                const cleanedText = replyText.trim();
                const textChunks = cleanedText.match(/[\s\S]{1,1950}/g) || [];
                for (const chunk of textChunks) {
                    await message.reply(chunk).catch(console.error); 
                }
            } else if (!functionName && !runMatch) {
                await message.reply("⚠️ **Debug Error:** Processed prompt successfully, but text output was empty!").catch(console.error);
            }
        } catch (error) {
            console.error("Gemini AI error:", error);
            if (error.status === 429) {
                if (process.env.OWNER_ID) {
                    try {
                        const owner = await client.users.fetch(process.env.OWNER_ID);
                        await owner.send(`⚠️ **API Quota Exhausted!**\nStarry hit the rate limit.\n**Location:** ${message.guild ? message.guild.name : 'DMs'}\n**Triggered by:** ${message.author.username}`);
                    } catch (dmError) {
                        console.error("Failed to DM the bot owner.", dmError);
                    }
                }
                return message.reply("⏳ **Starry is taking a quick breather!** We hit the free-tier rate limit. Try again in a minute!").catch(console.error);
            }
            return message.reply(`❌ **AI Crash Report:** \`${error.message || error}\``).catch(console.error);
        }
    }); 
};
