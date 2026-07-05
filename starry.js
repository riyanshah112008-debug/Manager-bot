const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Groq } = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const aiCooldowns = new Set();
const blacklistedUsers = new Set(); // 🚫 Temporary Blacklist Memory

module.exports = (client) => {
    
    client.on('ready', () => {
        console.log('✅ Starry Protocol Module Loaded');
    });

    client.on('messageCreate', async (message) => {

        // ==========================================
        // 0. DISBOARD BUMP TRACKER & BLACKLIST CHECK
        // ==========================================
        if (blacklistedUsers.has(message.author.id)) return; 

        if (message.author.id === '302050872383242240') { 
            if (message.embeds.length > 0 && message.embeds[0].description && message.embeds[0].description.includes('Bump done')) {
                const bumpEmbed = new EmbedBuilder()
                    .setColor('#3BA55C') 
                    .setTitle('📈 Server Bumped!')
                    .setDescription('Thank you for bumping the server! You can bump us again in 2 hours.');

                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }

        if (message.author.bot || !message.content) return;

        const text = message.content.toLowerCase();
        const myOwnerId = '1465049039153135639'; 

        // ==========================================
        // OWNER-ONLY: DEVELOPER TOOLS 
        // ==========================================
        if (text === '.dev') {
            if (message.author.id !== myOwnerId) return;
            try {
                await message.author.send(
                    `💻 **Starry Developer Commands (Owner-Only):**\n\n` +
                    `\`.servers\` - Lists all servers the bot is in.\n` +
                    `\`.serverdump\` - Full text data dump of the current server.\n` +
                    `\`.sysinfo\` - Shows RAM, Uptime, and Ping.\n` +
                    `\`.eval <code>\` - Executes raw JavaScript code (DANGEROUS).\n` +
                    `\`.broadcast <msg>\` - Sends a message to ALL servers.\n` +
                    `\`.leaveserver <ID>\` - Remotely forces the bot to leave a server.\n` +
                    `\`.blacklist <ID>\` - Toggles a user on/off the ignore list.\n` +
                    `\`.emergencyleave\` - Forces the bot to leave the current server.\n` +
                    `\`.restart\` - Kills the bot process (Render revives it).\n` +
                    `\`.setstatus <text>\` - Changes the bot's playing status.`
                );
                return message.reply('📬 Check your DMs! Sent the updated advanced developer commands over.').catch(() => {});
            } catch (err) {
                return message.reply('❌ I couldn\'t DM you! Please make sure your DMs are open.').catch(() => {});
            }
        }

        if (text === '.sysinfo') {
            if (message.author.id !== myOwnerId) return;
            const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const uptime = (process.uptime() / 3600).toFixed(2);
            return message.reply(`📊 **Starry System Info:**\n- **RAM Usage:** ${memory} MB\n- **Uptime:** ${uptime} Hours\n- **Ping:** ${client.ws.ping}ms`).catch(()=>{});
        }

        if (text.startsWith('.blacklist ')) {
            if (message.author.id !== myOwnerId) return;
            const targetId = message.content.split(' ')[1];
            if (!targetId) return message.reply('❌ Please provide a User ID.');
            if (blacklistedUsers.has(targetId)) {
                blacklistedUsers.delete(targetId);
                return message.reply(`✅ Removed \`${targetId}\` from the blacklist. They can talk to me again.`).catch(()=>{});
            } else {
                blacklistedUsers.add(targetId);
                return message.reply(`🚫 Added \`${targetId}\` to the blacklist. I will now ignore them globally.`).catch(()=>{});
            }
        }

        if (text.startsWith('.leaveserver ')) {
            if (message.author.id !== myOwnerId) return;
            const targetId = message.content.split(' ')[1];
            const guildToLeave = client.guilds.cache.get(targetId);
            if (!guildToLeave) return message.reply('❌ I am not in a server with that ID.').catch(()=>{});
            await guildToLeave.leave();
            return message.reply(`✅ Successfully sniped and left **${guildToLeave.name}**.`).catch(()=>{});
        }

        if (text.startsWith('.broadcast ')) {
            if (message.author.id !== myOwnerId) return;
            const announcement = message.content.slice(11).trim();
            if (!announcement) return message.reply('❌ What do you want to broadcast?');
            let successCount = 0;
            client.guilds.cache.forEach(guild => {
                const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));
                if (channel) {
                    channel.send(`📢 **Message from Starry's Developer:**\n\n${announcement}`).catch(()=>{});
                    successCount++;
                }
            });
            return message.reply(`✅ Broadcast successfully sent to ${successCount} servers!`).catch(()=>{});
        }

        if (text.startsWith('.eval ')) {
            if (message.author.id !== myOwnerId) return;
            const code = message.content.slice(6);
            try {
                let evaled = eval(code);
                if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
                return message.reply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``).catch(()=>{});
            } catch (err) {
                return message.reply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``).catch(()=>{});
            }
        }

        if (text === '.emergencyleave') {
            if (message.author.id === myOwnerId) {
                await message.reply('I am leaving this server now. Goodbye! 👋').catch(() => {});
                return message.guild.leave(); 
            } else {
                return;
            }
        }

        if (text === '.serverdump') {
            if (message.author.id !== myOwnerId) return;
            await message.reply('🗄️ Gathering all server data... This might take a moment.').catch(() => {});
            try {
                const guild = message.guild;
                await guild.members.fetch(); 
                let dump = `=== SERVER DUMP: ${guild.name} ===\n`;
                dump += `Server ID: ${guild.id}\nOwner ID: ${guild.ownerId}\nTotal Members: ${guild.memberCount}\nCreated: ${guild.createdAt.toUTCString()}\n\n`;
                dump += `=== CHANNELS ===\n`;
                guild.channels.cache.sort((a, b) => a.position - b.position).forEach(c => {
                    const type = c.type === 0 ? 'Text' : c.type === 2 ? 'Voice' : c.type === 4 ? 'Category' : 'Other';
                    dump += `[${type}] ${c.name} (ID: ${c.id})\n`;
                });
                dump += `\n=== ROLES ===\n`;
                guild.roles.cache.sort((a, b) => b.position - a.position).forEach(r => { dump += `${r.name} (ID: ${r.id})\n`; });
                dump += `\n=== MEMBERS ===\n`;
                guild.members.cache.sort((a, b) => a.joinedTimestamp - b.joinedTimestamp).forEach(m => {
                    dump += `${m.user.tag} (ID: ${m.id}) - Joined: ${m.joinedAt ? m.joinedAt.toUTCString() : 'Unknown'}\n`;
                });
                const buffer = Buffer.from(dump, 'utf-8');
                return await message.channel.send({ content: `✅ **Server Data Dump Complete:**`, files: [{ attachment: buffer, name: `${guild.name.replace(/\s+/g, '_')}_Dump.txt` }] }).catch(() => {});
            } catch (err) {
                return message.reply('❌ Failed to gather server data.').catch(() => {});
            }
        }

        if (text === '.servers') {
            if (message.author.id !== myOwnerId) return;
            let serverList = `🌐 **Starry is currently deployed in ${client.guilds.cache.size} servers:**\n\n`;
            client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount).forEach(g => {
                serverList += `🔹 **${g.name}** (${g.memberCount} members)\n`;
            });
            return message.reply(serverList).catch(() => {});
        }

        if (text === '.restart') {
            if (message.author.id !== myOwnerId) return;
            await message.reply('🔄 **Initiating remote reboot...**\nGoing offline. Render will automatically revive me in ~2 minutes.').catch(() => {});
            process.exit(1); 
        }

        if (text.startsWith('.setstatus ')) {
            if (message.author.id !== myOwnerId) return;
            const newStatus = message.content.slice(11).trim();
            if (!newStatus) return message.reply('❌ You need to provide a status text!').catch(() => {});
            client.user.setActivity(newStatus, { type: 4 }); 
            return message.reply(`✅ Starry's status successfully updated to: **${newStatus}**`).catch(() => {});
        }

        // ==========================================
        // 1. IMAGE GENERATOR (.imagine)
        // ==========================================
        if (text.startsWith('.imagine ')) {
            const imagePrompt = message.content.slice(9).trim();
            if (!imagePrompt) return message.reply('Please tell me what to draw!').catch(() => {});

            const replyMsg = await message.reply('🎨 Painting your picture...').catch(() => null);
            if (!replyMsg) return; 

            try {
                const safePrompt = encodeURIComponent(imagePrompt);
                const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=1024&nologo=true`;
                const cleanFileName = imagePrompt.replace(/\s+/g, '_') + '.png';

                await message.reply({ 
                    content: `🖼️ **${imagePrompt}**\nGenerated by ${message.author}`, 
                    files: [{ attachment: imageUrl, name: cleanFileName }] 
                }).catch(() => {});

                return await replyMsg.delete().catch(() => {});
            } catch (error) {
                return replyMsg.edit('❌ Trouble drawing that.').catch(() => {});
            }
        }

        // ==========================================
        // 2. TEXT CONVERSATION & CUSTOM MODERATION
        // ==========================================
        const mentionsBot = message.mentions.has(client.user.id);
        const containsName = text.includes('starry');

        let isReplyToBot = false;
        if (message.reference) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMessage.author.id === client.user.id) isReplyToBot = true;
            } catch (err) {}
        }

        if (!mentionsBot && !containsName && !isReplyToBot) return;

        if (aiCooldowns.has(message.author.id)) return;
        aiCooldowns.add(message.author.id);
        setTimeout(() => aiCooldowns.delete(message.author.id), 4000);

        await message.channel.sendTyping().catch(() => {});

        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: `You are Starry, a helpful, playful Discord bot. 
                        
                        RULE 1 (Core Moderation): For kick, ban, unban, clear, timeout, or untimeout, output EXACTLY:
                        [CMD:KICK|ID:123456789012345678|REASON:spam]
                        [CMD:BAN|ID:123456789012345678|REASON:rules]
                        [CMD:UNBAN|ID:123456789012345678]
                        [CMD:CLEAR|AMOUNT:10]
                        [CMD:TIMEOUT|ID:123456789012345678|MINUTES:1|REASON:spam]
                        [CMD:UNTIMEOUT|ID:123456789012345678]

                        RULE 2 (Role Management - USERS ONLY): To manage roles on users, use these. NEVER use these for channels.
                        - Assign a role: [CMD:GIVEROLE|USER_ID:123|ROLE_ID:456]
                        - Remove a role: [CMD:REMOVEROLE|USER_ID:123|ROLE_ID:456]
                        - Create a role: [CMD:CREATEROLE|NAME:RoleNameHere]
                        - Create a role with perms: [CMD:CREATEROLE|NAME:RoleNameHere|PERMISSIONS:Administrator,ManageChannels]
                        - Delete a role: [CMD:DELETEROLE|ROLE_ID:456]
                        - List a user's roles: [CMD:LISTROLES|USER_ID:123]
                        
                        RULE 3 (Channel Management - CHANNELS ONLY): To add/remove permissions or CREATE channels:
                        - Add role to channel: [CMD:CHANNELALLOW|CHANNEL_ID:123|ROLE_ID:456]
                        - Remove role from channel: [CMD:CHANNELDENY|CHANNEL_ID:123|ROLE_ID:456]
                        - Add user to channel: [CMD:USERALLOW|CHANNEL_ID:123|USER_ID:456]
                        - Remove user from channel: [CMD:USERDENY|CHANNEL_ID:123|USER_ID:456]
                        - Create a text channel: [CMD:CREATECHANNEL|NAME:channel-name]
                        - Create a private channel for a role: [CMD:CREATECHANNEL|NAME:channel-name|ROLE_ID:456]
                        *CRUCIAL:* If the user says "this channel" or does not specify a channel, omit the CHANNEL_ID entirely (e.g. [CMD:CHANNELDENY|ROLE_ID:456]).

                        RULE 4 (Server Commands & Images): If the user asks for real server actions or to GENERATE AN IMAGE, output a RUN block:
                        - Generate an Image: [RUN:.imagine A wizard penguin]
                        - Giveaways: [RUN:.giveaway 10m Discord Nitro] 
                        - Lock Channel: [RUN:.lock]
                        - Unlock Channel: [RUN:.unlock]
                        
                        RULE 5 (Casual Chat): If the user asks a general question, do NOT use CMD or RUN blocks. Just reply naturally in text!` 
                    },
                    { role: "user", content: `${message.author.username} says: ${message.content}` }
                ],
                model: "llama-3.1-8b-instant"
            });

            let replyText = chatCompletion.choices[0].message.content || "";
            let functionName = null;
            let args = {};

            const runMatch = replyText.match(/\[.*?RUN:(.*?)\]/i);
            if (runMatch) {
                const simulatedCommand = runMatch[1].trim(); 
                replyText = replyText.replace(runMatch[0], '').trim();
                message.content = simulatedCommand;
                client.emit('messageCreate', message);
                if (replyText.length === 0) return;
            }

            const cmdMatch = replyText.match(/\[.*?CMD:(KICK|BAN|UNBAN|CLEAR|TIMEOUT|UNTIMEOUT|GIVEROLE|REMOVEROLE|CREATEROLE|DELETEROLE|LISTROLES|LISTSERVERROLES|CHANNELALLOW|CHANNELDENY|USERALLOW|USERDENY|CREATECHANNEL)(?:\|(.*?))?\]/i);

            if (cmdMatch) {
                const action = cmdMatch[1].toUpperCase();
                const params = (cmdMatch[2] || '').split('|');

                if (action === 'CLEAR') {
                    functionName = 'clear_messages';
                    const amtMatch = params.find(p => p.toUpperCase().startsWith('AMOUNT:'));
                    args.amount = amtMatch ? parseInt(amtMatch.substring(7)) : 0;
                } else if (action === 'TIMEOUT') {
                    functionName = 'timeout_member';
                    const idMatch = params.find(p => p.toUpperCase().startsWith('ID:'));
                    const minMatch = params.find(p => p.toUpperCase().startsWith('MINUTES:'));
                    const reasonMatch = params.find(p => p.toUpperCase().startsWith('REASON:'));
                    args.userId = idMatch ? idMatch.substring(3).trim() : "";
                    args.minutes = minMatch ? parseInt(minMatch.substring(8).trim()) : 1;
                    args.reason = reasonMatch ? reasonMatch.substring(7).trim() : "Moderated by Starry AI";
                } else if (action === 'UNTIMEOUT') {
                    functionName = 'untimeout_member';
                    const idMatch = params.find(p => p.toUpperCase().startsWith('ID:'));
                    args.userId = idMatch ? idMatch.substring(3).trim() : "";
                } else if (action === 'UNBAN') {
                    functionName = 'unban_member';
                    const idMatch = params.find(p => p.toUpperCase().startsWith('ID:'));
                    args.userId = idMatch ? idMatch.substring(3).trim() : "";
                } else if (action === 'KICK' || action === 'BAN') {
                    functionName = action === 'KICK' ? 'kick_member' : 'ban_member';
                    const idMatch = params.find(p => p.toUpperCase().startsWith('ID:'));
                    const reasonMatch = params.find(p => p.toUpperCase().startsWith('REASON:'));
                    args.userId = idMatch ? idMatch.substring(3).trim() : "";
                    args.reason = reasonMatch ? reasonMatch.substring(7).trim() : "Moderated by Starry AI";
                } else if (action === 'GIVEROLE' || action === 'REMOVEROLE') {
                    functionName = action === 'GIVEROLE' ? 'give_role' : 'remove_role';
                    const uidMatch = params.find(p => p.toUpperCase().startsWith('USER_ID:'));
                    const ridMatch = params.find(p => p.toUpperCase().startsWith('ROLE_ID:'));
                    args.userId = uidMatch ? uidMatch.substring(8).trim() : "";
                    args.roleId = ridMatch ? ridMatch.substring(8).trim() : "";
                } else if (action === 'CREATEROLE') {
                    functionName = 'create_role';
                    const nameMatch = params.find(p => p.toUpperCase().startsWith('NAME:'));
                    const permMatch = params.find(p => p.toUpperCase().startsWith('PERMISSIONS:'));
                    args.roleName = nameMatch ? nameMatch.substring(5).trim() : "";
                    args.permissions = permMatch ? permMatch.substring(12).trim() : "";
                } else if (action === 'DELETEROLE') {
                    functionName = 'delete_role';
                    const ridMatch = params.find(p => p.toUpperCase().startsWith('ROLE_ID:'));
                    args.roleId = ridMatch ? ridMatch.substring(8).trim() : "";
                } else if (action === 'LISTROLES') {
                    functionName = 'list_roles';
                    const uidMatch = params.find(p => p.toUpperCase().startsWith('USER_ID:') || p.toUpperCase().startsWith('ID:'));
                    args.userId = uidMatch ? uidMatch.split(':')[1].trim() : "";
                } else if (action === 'LISTSERVERROLES') {
                    functionName = 'list_server_roles';
                } else if (action === 'CHANNELALLOW' || action === 'CHANNELDENY') {
                    functionName = action === 'CHANNELALLOW' ? 'channel_allow' : 'channel_deny';
                    const cidMatch = params.find(p => p.toUpperCase().startsWith('CHANNEL_ID:'));
                    const ridMatch = params.find(p => p.toUpperCase().startsWith('ROLE_ID:'));
                    args.channelId = cidMatch ? cidMatch.substring(11).trim() : "";
                    args.roleId = ridMatch ? ridMatch.substring(8).trim() : "";
                } else if (action === 'USERALLOW' || action === 'USERDENY') {
                    functionName = action === 'USERALLOW' ? 'user_allow' : 'user_deny';
                    const cidMatch = params.find(p => p.toUpperCase().startsWith('CHANNEL_ID:'));
                    const uidMatch = params.find(p => p.toUpperCase().startsWith('USER_ID:'));
                    args.channelId 