const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const ServerBackup = require('../models/ServerBackup');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        // ==========================================
        // 💾 COMMAND: .backup
        // ==========================================
        if (message.content.toLowerCase() === '.backup') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Admins only.');

            const msg = await message.reply('💾 **Scanning server architecture and creating backup...**');
            const guild = message.guild;

            try {
                // 1. Backup Roles (Ignore everyone, bot roles, and managed roles)
                const rolesData = guild.roles.cache
                    .filter(r => !r.managed && r.name !== '@everyone' && r.id !== guild.id)
                    .map(r => ({
                        id: r.id, name: r.name, color: r.hexColor, hoist: r.hoist, 
                        permissions: r.permissions.bitfield.toString(), position: r.position
                    }));

                // Helper to map permissions safely
                const getOverwrites = (channel) => channel.permissionOverwrites.cache.map(ow => ({
                    id: ow.id, type: ow.type, allow: ow.allow.bitfield.toString(), deny: ow.deny.bitfield.toString()
                }));

                // 2. Backup Categories
                const categoriesData = guild.channels.cache
                    .filter(c => c.type === ChannelType.GuildCategory)
                    .map(c => ({ id: c.id, name: c.name, overwrites: getOverwrites(c) }));

                // 3. Backup Channels
                const channelsData = guild.channels.cache
                    .filter(c => c.type !== ChannelType.GuildCategory)
                    .map(c => ({
                        id: c.id, name: c.name, type: c.type, parentId: c.parentId, 
                        topic: c.topic, nsfw: c.nsfw, rateLimitPerUser: c.rateLimitPerUser, 
                        userLimit: c.userLimit, overwrites: getOverwrites(c)
                    }));

                // 4. Save to MongoDB
                await ServerBackup.findOneAndUpdate(
                    { guildId: guild.id },
                    { timestamp: Date.now(), roles: rolesData, categories: categoriesData, channels: channelsData },
                    { upsert: true }
                );

                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('✅ Server Backup Complete')
                    .setDescription(`Successfully saved a snapshot of the server!\n\n**Roles Saved:** ${rolesData.length}\n**Categories Saved:** ${categoriesData.length}\n**Channels Saved:** ${channelsData.length}\n\n*Run \`.restore\` if the server is ever nuked.*`)
                    .setTimestamp();

                return msg.edit({ content: '', embeds: [embed] });
            } catch (err) {
                console.error(err);
                return msg.edit('❌ Failed to create backup.');
            }
        }

        // ==========================================
        // 🔄 COMMAND: .restore
        // ==========================================
        if (message.content.toLowerCase() === '.restore') {
            if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Admins only.');

            const backup = await ServerBackup.findOne({ guildId: message.guild.id });
            if (!backup) return message.reply('❌ No backup found for this server! Run `.backup` first.');

            const embed = new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle('⚠️ SYSTEM RESTORE INITIATED')
                .setDescription('**WARNING:** This will reconstruct missing channels and overwrite current permissions with the backup data.\n\nAre you sure you want to proceed?');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('restore_confirm').setLabel('RESTORE SERVER').setStyle(ButtonStyle.Danger).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('restore_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
            );

            const response = await message.reply({ embeds: [embed], components: [row] });
            const filter = i => i.user.id === message.author.id;

            try {
                const confirmation = await response.awaitMessageComponent({ filter, time: 30000 });
                if (confirmation.customId === 'restore_cancel') return confirmation.update({ content: '🚫 Restore aborted.', embeds: [], components: [] });

                await confirmation.update({ content: '🔄 **REBUILDING SERVER...** This may take a few minutes.', embeds: [], components: [] });
                
                const guild = message.guild;
                let roleMap = new Map(); // Maps old Role IDs to New Role IDs
                let categoryMap = new Map(); // Maps old Category IDs to New Category IDs

                // --- 1. RESTORE ROLES ---
                for (const bRole of backup.roles) {
                    let existing = guild.roles.cache.find(r => r.name === bRole.name);
                    if (!existing) {
                        try {
                            existing = await guild.roles.create({
                                name: bRole.name, color: bRole.color, hoist: bRole.hoist,
                                permissions: BigInt(bRole.permissions), position: bRole.position
                            });
                            await delay(300);
                        } catch (e) { continue; }
                    } else {
                        // Overwrite existing permissions to match backup
                        await existing.setPermissions(BigInt(bRole.permissions)).catch(()=>{});
                    }
                    roleMap.set(bRole.id, existing.id);
                }

                // Helper: Convert saved Overwrites to correct new IDs
                const parseOverwrites = (savedOverwrites) => {
                    return savedOverwrites.map(ow => {
                        let targetId = ow.id;
                        if (ow.type === 0) targetId = roleMap.get(ow.id) || guild.roles.cache.find(r => r.name === '@everyone').id;
                        return { id: targetId, allow: BigInt(ow.allow), deny: BigInt(ow.deny) };
                    });
                };

                // --- 2. RESTORE CATEGORIES ---
                for (const bCat of backup.categories) {
                    let existing = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === bCat.name);
                    const mappedOverwrites = parseOverwrites(bCat.overwrites);
                    
                    if (!existing) {
                        try {
                            existing = await guild.channels.create({ name: bCat.name, type: ChannelType.GuildCategory, permissionOverwrites: mappedOverwrites });
                            await delay(400);
                        } catch (e) { continue; }
                    } else {
                        await existing.permissionOverwrites.set(mappedOverwrites).catch(()=>{});
                    }
                    categoryMap.set(bCat.id, existing.id);
                }

                // --- 3. RESTORE CHANNELS ---
                for (const bChan of backup.channels) {
                    let existing = guild.channels.cache.find(c => c.type === bChan.type && c.name === bChan.name);
                    const mappedOverwrites = parseOverwrites(bChan.overwrites);
                    const newParentId = bChan.parentId ? categoryMap.get(bChan.parentId) : null;

                    if (!existing) {
                        try {
                            await guild.channels.create({
                                name: bChan.name, type: bChan.type, parent: newParentId,
                                topic: bChan.topic, nsfw: bChan.nsfw, rateLimitPerUser: bChan.rateLimitPerUser,
                                userLimit: bChan.userLimit, permissionOverwrites: mappedOverwrites
                            });
                            await delay(400);
                        } catch (e) {}
                    } else {
                        await existing.permissionOverwrites.set(mappedOverwrites).catch(()=>{});
                        if (newParentId && existing.parentId !== newParentId) await existing.setParent(newParentId).catch(()=>{});
                    }
                }

                await message.channel.send('✅ **RESTORE COMPLETE!**\nAll missing channels and roles have been regenerated, and permissions have been overwritten to match the backup!');

            } catch (e) {
                await response.edit({ content: '⚠️ Command timed out or error occurred.', embeds: [], components: [] });
            }
        }
    });
};
