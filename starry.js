const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini instead of Groq
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const blacklistedUsers = new Set();

module.exports = (client) => {
    client.on('ready', () => { console.log('✅ Starry Protocol Module Loaded (Powered by Gemini!)'); });
    client.on('messageCreate', async (message) => {
        if (blacklistedUsers.has(message.author.id)) return;
        if (message.author.id === '302050872383242240') {
            if (message.embeds.length > 0 && message.embeds[0].description && message.embeds[0].description.includes('Bump done')) {
                const bumpEmbed = new EmbedBuilder().setColor('#3BA55C').setTitle('📈 Server Bumped!').setDescription('Thank you for bumping the server! You can bump us again in 2 hours.');
                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }
        if (message.author.bot || !message.content) return;

        const text = message.content.toLowerCase();
        
        // REPLACE THIS WITH YOUR ACTUAL DISCORD USER ID
        const myOwnerId = '1465049039153135639';

        if (text === '.dev') {
            if (message.author.id !== myOwnerId) return;
            try {
                await message.author.send(`💻 **Starry Developer Commands (Owner-Only):**\n\n\`.servers\` - Lists all servers the bot is in.\n\`.serverdump\` - Full text data dump.\n\`.sysinfo\` - Bot stats.\n\`.eval <code>\` - Run raw JavaScript.\n\`.broadcast <msg>\` - Send message to ALL servers.\n\`.leaveserver <ID>\` - Remotely force leave.\n\`.blacklist <ID>\` - Block a user.\n\`.emergencyleave\` - Force leave current server.\n\`.restart\` - Kills the bot process.\n\`.setstatus <text>\` - Changes status.`);
                return message.reply('📬 Check your DMs! Sent the updated advanced developer commands over.').catch(() => {});
            } catch (err) { return message.reply('❌ I couldn\'t DM you! Make sure your DMs are open.').catch(() => {}); }
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
                blacklistedUsers.delete(targetId); return message.reply(`✅ Removed \`${targetId}\` from the blacklist.`).catch(()=>{});
            } else {
                blacklistedUsers.add(targetId); return message.reply(`🚫 Added \`${targetId}\` to the blacklist.`).catch(()=>{});
            }
        }
        if (text.startsWith('.leaveserver ')) {
            if (message.author.id !== myOwnerId) return;
            const guildToLeave = client.guilds.cache.get(message.content.split(' ')[1]);
            if (!guildToLeave) return message.reply('❌ I am not in a server with that ID.').catch(()=>{});
            await guildToLeave.leave(); return message.reply(`✅ Successfully left **${guildToLeave.name}**.`).catch(()=>{});
        }
        if (text.startsWith('.broadcast ')) {
            if (message.author.id !== myOwnerId) return;
            const announcement = message.content.slice(11).trim();
            if (!announcement) return message.reply('❌ What do you want to broadcast?');
            let successCount = 0;
            client.guilds.cache.forEach(guild => {
                const channel = guild.systemChannel || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me).has('SendMessages'));
                if (channel) { channel.send(`📢 **Message from Starry's Developer:**\n\n${announcement}`).catch(()=>{}); successCount++; }
            });
            return message.reply(`✅ Broadcast successfully sent to ${successCount} servers!`).catch(()=>{});
        }
        if (text.startsWith('.eval ')) {
            if (message.author.id !== myOwnerId) return;
            try {
                let evaled = eval(message.content.slice(6));
                if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
                return message.reply(`✅ **Output:**\n\`\`\`js\n${evaled.slice(0, 1900)}\n\`\`\``).catch(()=>{});
            } catch (err) { return message.reply(`❌ **Error:**\n\`\`\`xl\n${err}\n\`\`\``).catch(()=>{}); }
        }
        if (text === '.emergencyleave' && message.author.id === myOwnerId) {
            await message.reply('I am leaving this server now. Goodbye! 👋').catch(() => {});
            return message.guild.leave();
        }
                if (text === '.serverdump') {
            if (message.author.id !== myOwnerId) return;
            await message.reply('🗄️ Compiling a neatly organized server dump...').catch(() => {});
            try {
                const guild = message.guild; 
                await guild.members.fetch();
                
                let dump = `=================================================\n`;
                dump += `             SERVER DUMP: ${guild.name.toUpperCase()} \n`;
                dump += `=================================================\n\n`;
                dump += `[SERVER INFO]\n`;
                dump += `- Server ID     : ${guild.id}\n`;
                dump += `- Total Members : ${guild.memberCount}\n`;
                dump += `- Owner ID      : ${guild.ownerId}\n\n`;

                dump += `=================================================\n`;
                dump += `                 CHANNELS \n`;
                dump += `=================================================\n\n`;
                
                // Helper function to turn Discord's number types into readable tags
                const getTypeName = (type) => {
                    if (type === 0) return '📝 TEXT ';
                    if (type === 2) return '🔊 VOICE';
                    if (type === 4) return '📁 CAT  ';
                    if (type === 5) return '📢 ANN  ';
                    if (type === 15) return '💬 FORUM';
                    return '📄 MISC ';
                };

                const categories = guild.channels.cache.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
                const textAndVoice = guild.channels.cache.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);

                // Print channels that don't belong to any category first
                const noCategory = textAndVoice.filter(c => !c.parentId);
                if (noCategory.size > 0) {
                    dump += `[NO CATEGORY]\n`;
                    noCategory.forEach(c => {
                        dump += `   ├─ [${getTypeName(c.type)}] ${c.name} (ID: ${c.id})\n`;
                    });
                    dump += `\n`;
                }

                // Print categories and their child channels neatly indented
                categories.forEach(cat => {
                    dump += `[📁 ${cat.name.toUpperCase()}] (ID: ${cat.id})\n`;
                    const children = textAndVoice.filter(c => c.parentId === cat.id);
                    children.forEach(c => {
                        dump += `   ├─ [${getTypeName(c.type)}] ${c.name} (ID: ${c.id})\n`;
                    });
                    dump += `\n`;
                });

                dump += `=================================================\n`;
                dump += `                   ROLES \n`;
                dump += `=================================================\n\n`;
                
                const sortedRoles = guild.roles.cache.sort((a, b) => b.position - a.position);
                
                // Find the longest role name so we can align the IDs perfectly
                const maxLen = Math.max(...sortedRoles.map(r => r.name.length));
                
                sortedRoles.forEach(r => {
                    const paddedName = r.name.padEnd(maxLen + 3, ' ');
                    dump += `- ${paddedName} (ID: ${r.id}) [${r.members.size} Members]\n`;
                });

                // Remove emojis/special characters from the filename so it downloads safely
                const safeName = guild.name.replace(/[^a-zA-Z0-9]/g, '_');
                const buffer = Buffer.from(dump, 'utf-8');
                
                return await message.channel.send({ 
                    content: `✅ **Organized Dump Complete:**`, 
                    files: [{ attachment: buffer, name: `${safeName}_Dump.txt` }] 
                }).catch(() => {});
            } catch (err) { 
                console.error(err);
                return message.reply('❌ Failed to gather data.').catch(() => {}); 
            }
        }

        if (text === '.servers') {
            if (message.author.id !== myOwnerId) return;
            let serverList = `🌐 **Starry is in ${client.guilds.cache.size} servers:**\n\n`;
            client.guilds.cache.sort((a, b) => b.memberCount - a.memberCount).forEach(g => { serverList += `🔹 **${g.name}** (${g.memberCount} members)\n`; });
            return message.reply(serverList).catch(() => {});
        }
        if (text === '.restart') {
            if (message.author.id !== myOwnerId) return;
            await message.reply('🔄 **Initiating remote reboot...**').catch(() => {}); process.exit(1);
        }
        if (text.startsWith('.setstatus ')) {
            if (message.author.id !== myOwnerId) return;
            client.user.setActivity(message.content.slice(11).trim(), { type: 4 });
            return message.reply(`✅ Status updated!`).catch(() => {});
        }
        if (text.startsWith('.imagine ')) {
            const imagePrompt = message.content.slice(9).trim();
            if (!imagePrompt) return message.reply('Please tell me what to draw!').catch(() => {});
            const replyMsg = await message.reply('🎨 Painting your picture...').catch(() => null);
            if (!replyMsg) return;
            try {
                const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1024&height=1024&nologo=true`;
                await message.reply({ content: `🖼️ **${imagePrompt}**\nGenerated by ${message.author}`, files: [{ attachment: imageUrl, name: imagePrompt.replace(/\s+/g, '_') + '.png' }] }).catch(() => {});
                return await replyMsg.delete().catch(() => {});
            } catch (error) { return replyMsg.edit('❌ Trouble drawing that.').catch(() => {}); }
        }

        const mentionsBot = message.mentions.has(client.user.id);
        if (!mentionsBot && !text.includes('starry') && !(message.reference && (await message.channel.messages.fetch(message.reference.messageId).catch(()=>{}))?.author.id === client.user.id)) return;

        await message.channel.sendTyping().catch(() => {});

        try {
            // Updated Prompt Structure for Gemini
            const prompt = `[SYSTEM INSTRUCTION]
You are Starry, a helpful Discord bot. 
RULE 1: To moderate, output EXACTLY: [CMD:KICK|ID:123|REASON:spam] (Supported: KICK, BAN, UNBAN, CLEAR, TIMEOUT, UNTIMEOUT).
RULE 2: To manage roles: [CMD:GIVEROLE|USER_ID:123|ROLE_ID:456] (Supported: GIVEROLE, REMOVEROLE, CREATEROLE, DELETEROLE, LISTROLES).
RULE 3: To manage channels: [CMD:CHANNELALLOW|CHANNEL_ID:123|ROLE_ID:456] (Supported: CHANNELALLOW, CHANNELDENY, USERALLOW, USERDENY, CREATECHANNEL). Omit CHANNEL_ID for current channel.
RULE 4: For commands: [RUN:.imagine penguin]
RULE 5: Casual chat requires natural text.

[USER MESSAGE]
${message.author.username} says: ${message.content}`;

            // Gemini 2.5 Flash Generation
            const geminiResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });

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

            if (functionName) {
                const permErr = "❌ Missing permissions.";
                const hasPerm = (perm) => message.member.permissions.has(perm) && message.guild.members.me.permissions.has(perm);
                
                if (['channel_allow', 'channel_deny', 'user_allow', 'user_deny', 'create_channel'].includes(functionName)) {
                    if (!hasPerm(PermissionFlagsBits.ManageChannels)) return message.reply(permErr);
                    
                    if (functionName === 'create_channel') {
                        let overwrites = [];
                        if (args.roleId) overwrites = [{ id: message.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: args.roleId.replace(/\D/g, ''), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }];
                        const nc = await message.guild.channels.create({ name: args.channelName || 'new-channel', type: 0, permissionOverwrites: overwrites });
                        return message.reply(`✅ Created ${nc}!`);
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
                    await tMember.timeout(args.minutes * 60000, args.reason).catch(()=>{}); return message.reply("✅ Timed out.");
                }
                if (functionName === "untimeout_member" && hasPerm(PermissionFlagsBits.ModerateMembers)) {
                    await tMember.timeout(null).catch(()=>{}); return message.reply("✅ Timeout removed.");
                }
                if (functionName === "kick_member" && hasPerm(PermissionFlagsBits.KickMembers)) {
                    await tMember.kick(args.reason).catch(()=>{}); return message.reply("✅ Kicked.");
                }
                if (functionName === "ban_member" && hasPerm(PermissionFlagsBits.BanMembers)) {
                    await tMember.ban({reason: args.reason}).catch(()=>{}); return message.reply("✅ Banned.");
                }
            }

            if (replyText.length > 0) return message.reply(replyText.length > 2000 ? replyText.slice(0, 1995) + "..." : replyText).catch(()=>{});

        } catch (error) { 
            console.error("Gemini AI Error:", error);
            return message.reply("❌ My AI core experienced a glitch processing that request.").catch(()=>{}); 
        }
    });
};
