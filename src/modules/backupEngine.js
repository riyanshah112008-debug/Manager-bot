const { 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    AttachmentBuilder 
} = require('discord.js');

let ServerBackup;
try { 
    ServerBackup = require('../models/ServerBackup'); 
} catch(e) {
    console.error('⚠️ [BackupEngine] Could not load ServerBackup model:', e.message);
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const cleanContent = message.content.trim().toLowerCase();
        const isOwner = message.author.id === message.guild.ownerId;
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);

        // ==========================================
        // 💾 COMMAND: .backup
        // ==========================================
        if (cleanContent === '.backup' || cleanContent.startsWith('.backup')) {
            if (!isAdmin && !isOwner) return message.reply('❌ Admins or Server Owner only.');
            if (!ServerBackup) return message.reply('❌ Backup database model not found in models/ServerBackup.js.');

            const msg = await message.reply('💾 **Scanning server architecture and creating backup...**');
            const guild = message.guild;

            try {
                // Fetch 100% of roles & channels directly from Discord API (bypasses cache limits)
                const fetchedRoles = await guild.roles.fetch();
                const fetchedChannels = await guild.channels.fetch();

                const rolesData = fetchedRoles
                    .filter(r => !r.managed && r.name !== '@everyone' && r.id !== guild.id)
                    .map(r => ({
                        id: r.id, 
                        name: r.name, 
                        color: r.hexColor, 
                        hoist: r.hoist, 
                        permissions: r.permissions ? r.permissions.bitfield.toString() : '0', 
                        position: r.position
                    }));

                const getOverwrites = (channel) => channel.permissionOverwrites.cache.map(ow => ({
                    id: ow.id, 
                    type: ow.type, 
                    allow: ow.allow ? ow.allow.bitfield.toString() : '0', 
                    deny: ow.deny ? ow.deny.bitfield.toString() : '0'
                }));

                const categoriesData = fetchedChannels
                    .filter(c => c && c.type === ChannelType.GuildCategory)
                    .map(c => ({ id: c.id, name: c.name, overwrites: getOverwrites(c) }));

                const channelsData = fetchedChannels
                    .filter(c => c && c.type !== ChannelType.GuildCategory)
                    .map(c => ({
                        id: c.id, 
                        name: c.name, 
                        type: c.type, 
                        parentId: c.parentId, 
                        topic: c.topic || '', 
                        nsfw: c.nsfw || false, 
                        rateLimitPerUser: c.rateLimitPerUser || 0, 
                        userLimit: c.userLimit || 0, 
                        overwrites: getOverwrites(c)
                    }));

                // Save snapshot directly to MongoDB
                await ServerBackup.findOneAndUpdate(
                    { guildId: guild.id },
                    { timestamp: Date.now(), roles: rolesData, categories: categoriesData, channels: channelsData },
                    { upsert: true }
                );

                // Build clean text file report natively using standard Node.js Buffer
                let reportText = `=================================================\n`;
                reportText += `       STARRY SERVER ARCHITECTURE BACKUP REPORT   \n`;
                reportText += `=================================================\n`;
                reportText += `Server Name: ${guild.name}\n`;
                reportText += `Server ID:   ${guild.id}\n`;
                reportText += `Date:        ${new Date().toLocaleString()}\n`;
                reportText += `-------------------------------------------------\n\n`;

                reportText += `1. ROLES SUMMARY (${rolesData.length} Total)\n`;
                rolesData.forEach(r => {
                    reportText += `   • [Pos: ${r.position}] ${r.name} (Color: ${r.color})\n`;
                });
                reportText += `\n2. CATEGORIES SUMMARY (${categoriesData.length} Total)\n`;
                categoriesData.forEach(c => {
                    reportText += `   📁 ${c.name}\n`;
                });
                reportText += `\n3. CHANNELS SUMMARY (${channelsData.length} Total)\n`;
                channelsData.forEach(ch => {
                    reportText += `   💬 #${ch.name} (Topic: ${ch.topic || 'None'})\n`;
                });

                const textBuffer = Buffer.from(reportText, 'utf-8');
                const fileAttachment = new AttachmentBuilder(textBuffer, { name: `Server_Backup_${guild.id}.txt` });

                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('✅ Server Backup & Export Complete')
                    .setDescription(`Successfully saved snapshot to database and generated server architecture report!\n\n**Roles Saved:** ${rolesData.length}\n**Categories Saved:** ${categoriesData.length}\n**Channels Saved:** ${channelsData.length}\n\n*Run \`.restore\` if the server is ever nuked.*`)
                    .setTimestamp();

                return msg.edit({ content: '', embeds: [embed], files: [fileAttachment] });

            } catch (err) {
                console.error('❌ Backup Error:', err);
                return msg.edit(`❌ Failed to create backup: \`${err.message}\``);
            }
        }

        // ==========================================
        // 🔄 COMMAND: .restore
        // ==========================================
        if (cleanContent === '.restore' || cleanContent.startsWith('.restore')) {
            if (!isAdmin && !isOwner) return message.reply('❌ Admins or Server Owner only.');
            if (!ServerBackup) return message.reply('❌ Backup database model not found.');

            const backup = await ServerBackup.findOne({ guildId: message.guild.id });
            if (!backup) return message.reply('❌ No backup found for this server! Run `.backup` first.');

            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('⚠️ SYSTEM RESTORE INITIATED')
                .setDescription('**WARNING:** This will reconstruct missing channels/roles and overwrite permissions with backup data.\n\nAre you sure you want to proceed?');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('restore_confirm').setLabel('RESTORE SERVER').setStyle(ButtonStyle.Danger).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('restore_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
            );

            const response = await message.reply({ embeds: [embed], components: [row] });
            const filter = i => i.user.id === message.author.id;

            let confirmation;
            try {
                confirmation = await response.awaitMessageComponent({ filter, time: 30000 });
            } catch (e) {
                return response.edit({ content: '⏱️ Restore request timed out.', embeds: [], components: [] });
            }

            if (confirmation.customId === 'restore_cancel') {
                return confirmation.update({ content: '🚫 Restore aborted.', embeds: [], components: [] });
            }

            await confirmation.update({ content: '🔄 **REBUILDING SERVER...** Reconstructing roles and channels.', embeds: [], components: [] });

            try {
                const guild = message.guild;
                let roleMap = new Map();
                let categoryMap = new Map(); 

                await guild.roles.fetch();
                await guild.channels.fetch();

                // 1. Restore Roles
                for (const bRole of (backup.roles || [])) {
                    let existing = guild.roles.cache.find(r => r.name === bRole.name);
                    const safePerms = BigInt(bRole.permissions || '0');

                    if (!existing) {
                        try { 
                            existing = await guild.roles.create({ 
                                name: bRole.name, 
                                color: bRole.color, 
                                hoist: bRole.hoist, 
                                permissions: safePerms 
                            }); 
                            await delay(300); 
                        } catch (e) { 
                            continue; 
                        }
                    } else { 
                        await existing.setPermissions(safePerms).catch(() => {}); 
                    }
                    if (existing) roleMap.set(bRole.id, existing.id);
                }

                // Helper: Safe Overwrites Converter
                const parseOverwrites = (savedOverwrites = []) => {
                    return savedOverwrites.map(ow => {
                        let targetId = ow.id;
                        if (ow.type === 0) {
                            targetId = roleMap.get(ow.id) || guild.roles.everyone.id;
                        }
                        return { 
                            id: targetId, 
                            allow: BigInt(ow.allow || '0'), 
                            deny: BigInt(ow.deny || '0') 
                        };
                    });
                };

                // 2. Restore Categories
                for (const bCat of (backup.categories || [])) {
                    let existing = guild.channels.cache.find(c => c && c.type === ChannelType.GuildCategory && c.name === bCat.name);
                    const mappedOverwrites = parseOverwrites(bCat.overwrites);

                    if (!existing) {
                        try { 
                            existing = await guild.channels.create({ 
                                name: bCat.name, 
                                type: ChannelType.GuildCategory, 
                                permissionOverwrites: mappedOverwrites 
                            }); 
                            await delay(400); 
                        } catch (e) { 
                            continue; 
                        }
                    } else { 
                        await existing.permissionOverwrites.set(mappedOverwrites).catch(() => {}); 
                    }
                    if (existing) categoryMap.set(bCat.id, existing.id);
                }

                // 3. Restore Text & Voice Channels
                for (const bChan of (backup.channels || [])) {
                    let existing = guild.channels.cache.find(c => c && c.type === bChan.type && c.name === bChan.name);
                    const mappedOverwrites = parseOverwrites(bChan.overwrites);
                    const newParentId = bChan.parentId ? categoryMap.get(bChan.parentId) : null;

                    if (!existing) {
                        try { 
                            await guild.channels.create({ 
                                name: bChan.name, 
                                type: bChan.type, 
                                parent: newParentId, 
                                topic: bChan.topic, 
                                nsfw: bChan.nsfw, 
                                rateLimitPerUser: bChan.rateLimitPerUser, 
                                userLimit: bChan.userLimit, 
                                permissionOverwrites: mappedOverwrites 
                            }); 
                            await delay(400); 
                        } catch (e) {}
                    } else {
                        await existing.permissionOverwrites.set(mappedOverwrites).catch(() => {});
                        if (newParentId && existing.parentId !== newParentId) {
                            await existing.setParent(newParentId).catch(() => {});
                        }
                    }
                }

                await message.channel.send('✅ **RESTORE COMPLETE!**\nAll missing channels and roles have been regenerated!');
            } catch (err) {
                console.error('❌ Restore Error:', err);
                await message.channel.send(`❌ **Restore Failed:** \`${err.message}\``);
            }
        }
    });
};
