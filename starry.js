const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Groq } = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const aiCooldowns = new Set();

module.exports = (client) => {
    client.on('messageCreate', async (message) => {

        // ==========================================
        // 0. DISBOARD BUMP TRACKER
        // ==========================================
        if (message.author.id === '302050872383242240') { 
            if (message.embeds.length > 0 && message.embeds[0].description && message.embeds[0].description.includes('Bump done')) {
                const bumpEmbed = new EmbedBuilder()
                    .setColor('#3BA55C') 
                    .setTitle('📈 Server Bumped!')
                    .setDescription('Thank you for bumping the server! You can bump us again in 2 hours.');

                return message.channel.send({ embeds: [bumpEmbed] }).catch(() => {});
            }
        }

        // ==========================================
        // Ignore ALL OTHER bots or empty messages
        // ==========================================
        if (message.author.bot || !message.content) return;

        const text = message.content.toLowerCase();

        // ==========================================
        // CONFIG: OWNER ID SETUP
        // ==========================================
        const myOwnerId = '1465049039153135639'; // <--- PASTE YOUR DISCORD ID HERE

        // ==========================================
        // OWNER-ONLY: DEVELOPER TOOLS (.dev & LEAVE/DUMP)
        // ==========================================
        if (text === '.dev') {
            if (message.author.id !== myOwnerId) return;
            try {
                await message.author.send(
                    `💻 **Starry Developer Commands (Owner-Only):**\n\n` +
                    `\`.emergencyleave\` - Forces the bot to leave the current server.\n` +
                    `\`.serverdump\` - Generates a full text data dump file of channels, roles, and members.\n` +
                    `\`.dev\` - Sends you this private developer command checklist.`
                );
                return message.reply('📬 Check your DMs! Sent the developer commands over.').catch(() => {});
            } catch (err) {
                return message.reply('❌ I couldn\'t DM you! Please make sure your DMs are open.').catch(() => {});
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
                dump += `Server ID: ${guild.id}\n`;
                dump += `Owner ID: ${guild.ownerId}\n`;
                dump += `Total Members: ${guild.memberCount}\n`;
                dump += `Created: ${guild.createdAt.toUTCString()}\n\n`;

                dump += `=== CHANNELS ===\n`;
                guild.channels.cache.sort((a, b) => a.position - b.position).forEach(c => {
                    const type = c.type === 0 ? 'Text' : c.type === 2 ? 'Voice' : c.type === 4 ? 'Category' : 'Other';
                    dump += `[${type}] ${c.name} (ID: ${c.id})\n`;
                });
                
                dump += `\n=== ROLES ===\n`;
                guild.roles.cache.sort((a, b) => b.position - a.position).forEach(r => {
                    dump += `${r.name} (ID: ${r.id})\n`;
                });
                
                dump += `\n=== MEMBERS ===\n`;
                guild.members.cache.sort((a, b) => a.joinedTimestamp - b.joinedTimestamp).forEach(m => {
                    dump += `${m.user.tag} (ID: ${m.id}) - Joined: ${m.joinedAt ? m.joinedAt.toUTCString() : 'Unknown'}\n`;
                });

                const buffer = Buffer.from(dump, 'utf-8');
                return await message.channel.send({
                    content: `✅ **Server Data Dump Complete:**`,
                    files: [{ attachment: buffer, name: `${guild.name.replace(/\s+/g, '_')}_Dump.txt` }]
                }).catch(() => {});
            } catch (err) {
                console.error("Dump Error:", err);
                return message.reply('❌ Failed to gather server data.').catch(() => {});
            }
        }
        // ==========================================
        // NEW DEV TOOLS (.servers, .restart, .setstatus)
        // ==========================================
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
            process.exit(1); // This fatally kills the Node.js process, triggering Render's auto-restart
        }

        if (text.startsWith('.setstatus ')) {
            if (message.author.id !== myOwnerId) return;
            
            const newStatus = message.content.slice(11).trim();
            if (!newStatus) return message.reply('❌ You need to provide a status text!').catch(() => {});
            
            // Sets a custom playing status
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
                console.error("Image Gen Error:", error);
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

            // UNIVERSAL COMMAND EXECUTOR
            const runMatch = replyText.match(/\[.*?RUN:(.*?)\]/i);
            if (runMatch) {
                const simulatedCommand = runMatch[1].trim(); 
                replyText = replyText.replace(runMatch[0], '').trim();

                message.content = simulatedCommand;
                client.emit('messageCreate', message);

                if (replyText.length === 0) return;
            }

            // NATIVE MODERATION EXECUTOR
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
                    args.channelId = cidMatch ? cidMatch.substring(11).trim() : "";
                    args.userId = uidMatch ? uidMatch.substring(8).trim() : "";
                } else if (action === 'CREATECHANNEL') {
                    functionName = 'create_channel';
                    const nameMatch = params.find(p => p.toUpperCase().startsWith('NAME:'));
                    const ridMatch = params.find(p => p.toUpperCase().startsWith('ROLE_ID:'));
                    args.channelName = nameMatch ? nameMatch.substring(5).trim() : "";
                    args.roleId = ridMatch ? ridMatch.substring(8).trim() : "";
                }

                replyText = replyText.replace(cmdMatch[0], '').trim();

                const rogueRunMatch = replyText.match(/\(RUN:.*?\)/i);
                if (rogueRunMatch) replyText = replyText.replace(rogueRunMatch[0], '').trim();
              }

                    if (functionName) {
                // ==========================================
                // CHANNEL PERMISSIONS EXECUTION
                // ==========================================
                if (functionName === 'create_channel') {
                    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply("❌ You need `Manage Channels` permission to do this!").catch(()=>{});
                    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply("❌ I need `Manage Channels` permissions in my server settings to do this!").catch(()=>{});
                    if (!args.channelName) return message.reply("❌ Please provide a name for the new channel!").catch(()=>{});

                    let permissionOverwrites = [];
                    
                    if (args.roleId) {
                        const cleanRoleId = String(args.roleId).replace(/\D/g, '');
                        const targetRole = message.guild.roles.cache.get(cleanRoleId);
                        if (targetRole) {
                            permissionOverwrites = [
                                {
                                    id: message.guild.id, // @everyone
                                    deny: [PermissionFlagsBits.ViewChannel],
                                },
                                {
                                    id: targetRole.id,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                                }
                            ];
                        }
                    }

                    const newChannel = await message.guild.channels.create({
                        name: args.channelName,
                        type: 0,
                        permissionOverwrites: permissionOverwrites,
                        reason: `Created by ${message.author.tag} via Starry AI`
                    });

                    return message.reply(`✅ Created the channel ${newChannel}!`).catch(()=>{});
                }

                if (['channel_allow', 'channel_deny', 'user_allow', 'user_deny'].includes(functionName)) {
                    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply("❌ You need `Manage Channels` permission to do this!").catch(()=>{});
                    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) return message.reply("❌ I need `Manage Channels` permissions in my server settings to do this!").catch(()=>{});

                    const cleanChannelId = String(args.channelId).replace(/\D/g, '');
                    const targetChannel = cleanChannelId ? (message.guild.channels.cache.get(cleanChannelId) || message.channel) : message.channel;

                    if (functionName === 'channel_allow' || functionName === 'channel_deny') {
                        const cleanRoleId = String(args.roleId).replace(/\D/g, '');
                        const targetRole = message.guild.roles.cache.get(cleanRoleId);

                        if (!targetRole) return message.reply("❌ I couldn't find that role. Make sure you @mention it!").catch(()=>{});

                        if (functionName === 'channel_allow') {
                            await targetChannel.permissionOverwrites.edit(targetRole.id, { ViewChannel: true, SendMessages: true });
                            return message.reply(`✅ The **${targetRole.name}** role has been added to ${targetChannel} (Allowed to view and speak).`).catch(()=>{});
                        } else {
                            await targetChannel.permissionOverwrites.edit(targetRole.id, { ViewChannel: false });
                            return message.reply(`✅ The **${targetRole.name}** role has been removed from ${targetChannel} (Denied viewing).`).catch(()=>{});
                        }
                    } else if (functionName === 'user_allow' || functionName === 'user_deny') {
                        const cleanUserId = String(args.userId).replace(/\D/g, '');
                        const targetMember = await message.guild.members.fetch(cleanUserId).catch(() => null);

                        if (!targetMember) return message.reply("❌ I couldn't find that user. Make sure you @mention them!").catch(()=>{});

                        if (functionName === 'user_allow') {
                            await targetChannel.permissionOverwrites.edit(targetMember.id, { ViewChannel: true, SendMessages: true });
                            return message.reply(`✅ **${targetMember.user.username}** has been added to ${targetChannel} (Allowed to view and speak).`).catch(()=>{});
                        } else {
                            await targetChannel.permissionOverwrites.edit(targetMember.id, { ViewChannel: false });
                            return message.reply(`✅ **${targetMember.user.username}** has been removed from ${targetChannel} (Denied viewing).`).catch(()=>{});
                        }
                    }
                }

                // ==========================================
                // ROLE EXECUTION LOGIC
                // ==========================================
                if (functionName === 'list_roles') {
                    const cleanUserId = String(args.userId).replace(/\D/g, '');
                    if (!cleanUserId) return message.reply("❌ Please provide a valid user to check roles for!").catch(()=>{});

                    const targetMember = await message.guild.members.fetch(cleanUserId).catch(() => null);
                    if (!targetMember) return message.reply("❌ I couldn't find that user in the server.").catch(()=>{});

                    const roles = targetMember.roles.cache
                        .filter(r => r.name !== '@everyone')
                        .map(r => `<@&${r.id}>`)
                        .join(', ');

                    if (!roles) return message.reply(`**${targetMember.user.username}** has no custom roles.`).catch(()=>{});

                    const embed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle(`Roles for ${targetMember.user.username}`)
                        .setDescription(roles);

                    return message.reply({ embeds: [embed] }).catch(()=>{});
                }

                if (functionName === 'list_server_roles') {
                    const roles = message.guild.roles.cache
                        .filter(r => r.name !== '@everyone')
                        .sort((a, b) => b.position - a.position)
                        .map(r => `${r.name}`)
                        .join(', ');

                    if (!roles) return message.reply("This server has no custom roles.").catch(()=>{});

                    let description = roles;
                    if (description.length > 4096) description = description.slice(0, 4093) + '...';

                    const embed = new EmbedBuilder()
                        .setColor('#2b2d31')
                        .setTitle(`Roles in ${message.guild.name}`)
                        .setDescription(description);

                    return message.reply({ embeds: [embed] }).catch(()=>{});
                }

                // Check general moderation permissions
                if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && functionName === 'clear_messages') {
                    return message.reply(`❌ Sorry, you don't have permission to clear messages!`).catch(()=>{});
                }
                if (!message.member.permissions.has(PermissionFlagsBits.KickMembers) && functionName === 'kick_member') {
                    return message.reply(`❌ Sorry, you don't have permission to kick members!`).catch(()=>{});
                }
                if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) && (functionName === 'ban_member' || functionName === 'unban_member')) {
                    return message.reply(`❌ Sorry, you don't have permission to manage bans!`).catch(()=>{});
                }
                if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) && (functionName === 'timeout_member' || functionName === 'untimeout_member')) {
                    return message.reply(`❌ Sorry, you don't have permission to manage timeouts!`).catch(()=>{});
                }

                // Check Role Permissions
                if (['give_role', 'remove_role', 'create_role', 'delete_role'].includes(functionName)) {
                    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
                         return message.reply(`❌ Sorry, you don't have permission to manage roles!`).catch(()=>{});
                    }
                    if (!message.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
                         return message.reply(`❌ I need the \`Manage Roles\` permission in my server settings to do this!`).catch(()=>{});
                    }
                }

                if (functionName === 'create_role') {
                    if (!args.roleName) return message.reply("❌ Invalid role name provided.").catch(()=>{});
                    
                    let permsArray = [];
                    if (args.permissions) {
                        const requested = args.permissions.split(',');
                        for (const p of requested) {
                            const cleanP = p.trim();
                            const validKey = Object.keys(PermissionFlagsBits).find(key => key.toLowerCase() === cleanP.toLowerCase());
                            if (validKey) permsArray.push(PermissionFlagsBits[validKey]);
                        }
                    }

                    const newRole = await message.guild.roles.create({ 
                        name: args.roleName, 
                        permissions: permsArray.length > 0 ? permsArray : [],
                        reason: `Created by ${message.author.tag} via Starry AI` 
                    });
                    
                    return message.reply(`✅ Created the role **${newRole.name}**${permsArray.length > 0 ? ' with custom permissions' : ''}!`).catch(()=>{});
                }

                if (functionName === 'delete_role') {
                    const cleanRoleId = String(args.roleId).replace(/\D/g, '');
                    const role = message.guild.roles.cache.get(cleanRoleId);

                    if (!role) return message.reply("❌ I couldn't find that role. Make sure you @mention it!").catch(()=>{});
                    if (message.guild.members.me.roles.highest.position <= role.position) return message.reply("❌ I can't delete a role that is higher than my own!").catch(()=>{});

                    const roleName = role.name;
                    await role.delete(`Deleted by ${message.author.tag} via Starry AI`);
                    return message.reply(`✅ Poof! The **${roleName}** role was deleted.`).catch(()=>{});
                }

                if (functionName === 'give_role' || functionName === 'remove_role') {
                    const cleanUserId = String(args.userId).replace(/\D/g, '');
                    const cleanRoleId = String(args.roleId).replace(/\D/g, '');

                    const targetMember = await message.guild.members.fetch(cleanUserId).catch(() => null);
                    const targetRole = message.guild.roles.cache.get(cleanRoleId);

                    if (!targetMember) return message.reply("❌ I couldn't find that user. Ensure you tagged them correctly.").catch(()=>{});
                    if (!targetRole) return message.reply("❌ I couldn't find that role. Ensure you tagged it correctly.").catch(()=>{});
                    if (message.guild.members.me.roles.highest.position <= targetRole.position) return message.reply("❌ I can't assign/remove a role that is higher than my own!").catch(()=>{});

                    if (functionName === 'give_role') {
                        if (targetMember.roles.cache.has(targetRole.id)) return message.reply(`⚠️ **${targetMember.user.username}** already has the **${targetRole.name}** role.`).catch(()=>{});
                        await targetMember.roles.add(targetRole);
                        return message.reply(`✅ Assigned the **${targetRole.name}** role to **${targetMember.user.username}**!`).catch(()=>{});
                    } else {
                        if (!targetMember.roles.cache.has(targetRole.id)) return message.reply(`⚠️ **${targetMember.user.username}** doesn't have the **${targetRole.name}** role.`).catch(()=>{});
                        await targetMember.roles.remove(targetRole);
                        return message.reply(`✅ Removed the **${targetRole.name}** role from **${targetMember.user.username}**!`).catch(()=>{});
                    }
                }

                // ==========================================
                // ORIGINAL MODERATION LOGIC
                // ==========================================
                if (functionName === "clear_messages") {
                    const amount = Math.min(args.amount || 0, 100);
                    if (amount <= 0) return message.reply("❌ Please specify a valid number of messages to clear.").catch(()=>{});
                    await message.channel.bulkDelete(amount + 1, true).catch(()=>{});
                    const modLog = await message.channel.send(`🧹 Cleared ${amount} messages!`).catch(()=>{});
                    if (modLog) setTimeout(() => modLog.delete().catch(() => {}), 4000);
                    return;
                }

                const rawId = args.userId || "";
                const targetId = String(rawId).replace(/\D/g, ''); 

                if (!targetId || targetId.length < 15) return message.reply("❌ Please provide a valid Discord ID!").catch(()=>{});

                if (functionName === "unban_member") {
                    try {
                        await message.guild.members.unban(targetId);
                        return message.reply(`✅ Successfully unbanned the user with ID **${targetId}**.`).catch(()=>{});
                    } catch (err) {
                        return message.reply("❌ Discord blocked the unban! Are you sure they are actually banned?").catch(()=>{});
                    }
                }

                const targetMember = await message.guild.members.fetch(targetId).catch(() => null);

                if (!targetMember) return message.reply("❌ I couldn't find that member in the server. Did they already leave?").catch(()=>{});
                if (!targetMember.manageable) return message.reply("❌ I cannot moderate this user. Their role is higher than mine!").catch(()=>{});

                if (functionName === "timeout_member") {
                    try {
                        const durationMs = (args.minutes || 1) * 60 * 1000;
                        await targetMember.timeout(durationMs, args.reason);
                        return message.reply(`✅ Successfully timed out **${targetMember.user.tag}** for ${args.minutes} minute(s).`).catch(()=>{});
                    } catch (err) {
                        return message.reply("❌ Discord blocked the timeout! Check my permissions.").catch(()=>{});
                    }
                }

                if (functionName === "untimeout_member") {
                    try {
                        await targetMember.timeout(null, "Timeout removed by Starry AI");
                        return message.reply(`✅ Successfully removed the timeout for **${targetMember.user.tag}**.`).catch(()=>{});
                    } catch (err) {
                        return message.reply("❌ Discord blocked the action! Check my permissions.").catch(()=>{});
                    }
                }

                if (functionName === "kick_member") {
                    try {
                        await targetMember.kick(args.reason);
                        return message.reply(`✅ Successfully kicked **${targetMember.user.tag}**.`).catch(()=>{});
                    } catch (err) {
                        return message.reply("❌ Discord blocked the kick! Check my permissions.").catch(()=>{});
                    }
                }

                if (functionName === "ban_member") {
                    try {
                        await targetMember.ban({ reason: args.reason });
                        return message.reply(`✅ Successfully banned **${targetMember.user.tag}**.`).catch(()=>{});
                    } catch (err) {
                        return message.reply("❌ Discord blocked the ban! Check my permissions.").catch(()=>{});
                    }
                }
            }

            if (replyText.length > 0) {
                return message.reply(replyText.length > 2000 ? replyText.slice(0, 1995) + "..." : replyText).catch(()=>{});
            }

        } catch (error) {
            console.error("Groq Error:", error.message);
            return message.reply("❌ An internal error occurred while trying to process that command.").catch(()=>{});
        }
    });
};
                    
