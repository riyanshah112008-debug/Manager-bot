const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, AttachmentBuilder } = require('discord.js');
const PDFDocument = require('pdfkit');

let ServerBackup;
try { ServerBackup = require('../models/ServerBackup'); } catch(e) {
    console.error('⚠️ Could not load ServerBackup model:', e.message);
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        const cleanContent = message.content.trim().toLowerCase();

        // Check if author is Admin or Server Owner
        const isOwner = message.author.id === message.guild.ownerId;
        const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);

        // ==========================================
        // 💾 COMMAND: .backup (and .backup export pdf)
        // ==========================================
        if (cleanContent === '.backup' || cleanContent.startsWith('.backup export') || cleanContent.startsWith('.backup pdf')) {
            if (!isAdmin && !isOwner) return message.reply('❌ Admins or Server Owner only.');
            if (!ServerBackup) return message.reply('❌ Backup database model not found.');

            const msg = await message.reply('💾 **Scanning server architecture and generating backup data & PDF report...**');
            const guild = message.guild;

            try {
                const fetchedRoles = await guild.roles.fetch();
                const fetchedChannels = await guild.channels.fetch();

                const rolesData = fetchedRoles
                    .filter(r => !r.managed && r.name !== '@everyone' && r.id !== guild.id)
                    .map(r => ({
                        id: r.id, name: r.name, color: r.hexColor, hoist: r.hoist, 
                        permissions: r.permissions ? r.permissions.bitfield.toString() : '0', 
                        position: r.position
                    }));

                const getOverwrites = (channel) => channel.permissionOverwrites.cache.map(ow => ({
                    id: ow.id, type: ow.type, 
                    allow: ow.allow ? ow.allow.bitfield.toString() : '0', 
                    deny: ow.deny ? ow.deny.bitfield.toString() : '0'
                }));

                const categoriesData = fetchedChannels
                    .filter(c => c && c.type === ChannelType.GuildCategory)
                    .map(c => ({ id: c.id, name: c.name, overwrites: getOverwrites(c) }));

                const channelsData = fetchedChannels
                    .filter(c => c && c.type !== ChannelType.GuildCategory)
                    .map(c => ({
                        id: c.id, name: c.name, type: c.type, parentId: c.parentId, 
                        topic: c.topic || '', nsfw: c.nsfw || false, 
                        rateLimitPerUser: c.rateLimitPerUser || 0, 
                        userLimit: c.userLimit || 0, overwrites: getOverwrites(c)
                    }));

                await ServerBackup.findOneAndUpdate(
                    { guildId: guild.id },
                    { timestamp: Date.now(), roles: rolesData, categories: categoriesData, channels: channelsData },
                    { upsert: true }
                );

                // --- GENERATE PDF REPORT ---
                const doc = new PDFDocument({ margin: 50 });
                const buffers = [];
                doc.on('data', chunk => buffers.push(chunk));
                
                doc.fontSize(22).fillColor('#2c3e50').text(`Server Architecture Backup`, { align: 'center' });
                doc.fontSize(12).fillColor('#7f8c8d').text(`Guild Name: ${guild.name} (ID: ${guild.id})`, { align: 'center' });
                doc.text(`Backup Date: ${new Date().toLocaleString()}`, { align: 'center' });
                doc.moveDown(2);

                doc.fontSize(16).fillColor('#2980b9').text(`1. Roles Overview (${rolesData.length} Saved)`);
                doc.fontSize(10).fillColor('#333333');
                rolesData.forEach((r) => doc.text(`• [Pos: ${r.position}] ${r.name} (Color: ${r.color})`));
                doc.moveDown(1.5);

                doc.fontSize(16).fillColor('#2980b9').text(`2. Categories Overview (${categoriesData.length} Saved)`);
                doc.fontSize(10).fillColor('#333333');
                categoriesData.forEach((c) => doc.text(`📁 Category: ${c.name}`));
                doc.moveDown(1.5);

                doc.fontSize(16).fillColor('#2980b9').text(`3. Channels Overview (${channelsData.length} Saved)`);
                doc.fontSize(10).fillColor('#333333');
                channelsData.forEach((ch) => doc.text(`💬 [#${ch.type}] ${ch.name} (Topic: ${ch.topic || 'None'})`));

                doc.end();

                doc.on('end', async () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    const attachment = new AttachmentBuilder(pdfBuffer, { name: `Server_Backup_${guild.id}.pdf` });

                    const embed = new EmbedBuilder()
                        .setColor('#3498db')
                        .setTitle('✅ Server Backup & PDF Report Complete')
                        .setDescription(`Successfully saved snapshot to database and compiled PDF report!\n\n**Roles Saved:** ${rolesData.length}\n**Categories Saved:** ${categoriesData.length}\n**Channels Saved:** ${channelsData.length}`)
                        .setTimestamp();

                    return msg.edit({ content: '', embeds: [embed], files: [attachment] });
                });

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
                .setDescription('**WARNING:** This will reconstruct missing channels and overwrite current permissions with backup data.\n\nAre you sure you want to proceed?');

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
                            console.error(`⚠️ Could not create role ${bRole.name}:`, e.message);
                            continue; 
                        }
                    } else { 
                        await existing.setPermissions(safePerms).catch(() => {}); 
                    }
                    if (existing) roleMap.set(bRole.id, existing.id);
                }

                // Helper: Safe Overwrites Converter (Prevents BigInt crash on empty strings)
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
                            console.error(`⚠️ Could not create category ${bCat.name}:`, e.message);
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
                        } catch (e) {
                            console.error(`⚠️ Could not create channel ${bChan.name}:`, e.message);
                        }
                    } else {
                        await existing.permissionOverwrites.set(mappedOverwrites).catch(() => {});
                        if (newParentId && existing.parentId !== newParentId) {
                            await existing.setParent(newParentId).catch(() => {});
                        }
                    }
                }

                await message.channel.send('✅ **RESTORE COMPLETE!**\nAll missing channels and roles have been regenerated!');
            } catch (err) {
                console.error('❌ Restore Execution Error:', err);
                await message.channel.send(`❌ **Restore Failed:** \`${err.message}\``);
            }
        }
    });
};
