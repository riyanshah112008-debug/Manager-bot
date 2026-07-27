const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');

// 🗄️ 1. Flexible Schema supporting both Guild and User Premium
const PremiumSchema = new mongoose.Schema({
    targetId: { type: String, required: true, unique: true }, // Can be Guild ID or User ID
    type: { type: String, enum: ['guild', 'user'], default: 'guild' },
    isPremium: { type: Boolean, default: true },
    activatedAt: { type: Date, default: Date.now }
});

const PremiumModel = mongoose.models.PremiumGuilds || mongoose.model('PremiumGuilds', PremiumSchema);

module.exports = (client) => {
    // 🧠 2. Instant Memory Cache
    const premiumCache = new Set();

    // 👑 3. Multi-Owner Authorization List
    const BOT_OWNERS = ['1465049039153135639', '1257676837249617971'];
    if (process.env.OWNER_ID && !BOT_OWNERS.includes(process.env.OWNER_ID)) {
        BOT_OWNERS.push(process.env.OWNER_ID);
    }

    // 📥 4. DB Cache Loader
    const loadPremiumCache = async () => {
        try {
            const premiumRecords = await PremiumModel.find({ isPremium: true });
            premiumCache.clear();
            premiumRecords.forEach(record => premiumCache.add(record.targetId));
            console.log(`💎 Loaded ${premiumCache.size} Premium entities into high-speed RAM cache!`);
        } catch (err) {
            console.error('❌ Failed to load premium entities from DB:', err);
        }
    };

    if (mongoose.connection.readyState === 1) {
        loadPremiumCache();
    } else {
        mongoose.connection.once('open', loadPremiumCache);
    }

    // ⚡ 5. Master Sync Fast Check
    client.isPremium = (guildId, userId = null) => {
        // Bot Owners bypass all Premium checks globally
        if (userId && BOT_OWNERS.includes(userId)) return true;
        // Check if Guild ID or User ID is in cache
        if (guildId && premiumCache.has(guildId)) return true;
        if (userId && premiumCache.has(userId)) return true;
        return false;
    };

    // =====================================================================
    // 💎 6. GLOBAL PREMIUM MODERATION DM SYSTEM
    // =====================================================================
    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A', appealLink = null) => {
        const actionType = action.toLowerCase();
        const isGuildPremium = client.isPremium(guild.id, member.id);

        if (!isGuildPremium) {
            const basicEmbed = new EmbedBuilder()
                .setColor('#2F3136')
                .setTitle(`Moderation Notice: ${actionType.toUpperCase()}`)
                .setDescription(`You have received a moderation action in **${guild.name}**.`)
                .addFields(
                    { name: 'Action', value: actionType.toUpperCase(), inline: true },
                    { name: 'Reason', value: reason || 'No reason provided.', inline: true }
                )
                .setFooter({ text: `${guild.name} • Upgrade server to Premium for enhanced moderation notices.` })
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
            case 'ban':
                embedColor = '#ED4245'; actionTitle = 'Server Ban Notice'; actionEmoji = '🔨'; durationDisplay = duration ? `\`${duration}\`` : '`Permanent`'; break;
            case 'kick':
                embedColor = '#FEE75C'; actionTitle = 'Server Kick Notice'; actionEmoji = '👢'; durationDisplay = '`Immediate`'; break;
            case 'timeout':
                embedColor = '#5865F2'; actionTitle = 'Server Timeout Notice'; actionEmoji = '⏱️'; durationDisplay = duration ? `\`${duration}\`` : '`Unknown`'; break;
            default:
                embedColor = '#95A5A6'; actionTitle = 'Moderation Notice'; actionEmoji = '🛡️'; durationDisplay = '`N/A`';
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

    // =====================================================================
    // 🎛️ 7. PREMIUM SLASH COMMAND HANDLERS
    // =====================================================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName, options, guildId, user } = interaction;

        // --- CHECK PREMIUM ---
        if (commandName === 'premiumcheck') {
            const enabled = client.isPremium(guildId, user.id);
            return interaction.reply({
                content: enabled
                    ? '💎 **Premium is ACTIVE on this server or for your account!**'
                    : 'ℹ️ **Premium is NOT active on this server.** Use `/activatepremium` if you are a bot owner.',
                ephemeral: true
            });
        }

        // --- ACTIVATE PREMIUM ---
        if (commandName === 'activatepremium') {
            if (!BOT_OWNERS.includes(user.id)) {
                return interaction.reply({ content: '❌ Only Bot Owners can manage Premium activation.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const rawInputId = options.getString('server_id');
            const targetId = rawInputId ? rawInputId.trim() : guildId;

            await PremiumModel.findOneAndUpdate(
                { targetId: targetId },
                { targetId: targetId, isPremium: true, type: 'guild' },
                { upsert: true, new: true }
            );

            premiumCache.add(targetId);

            return interaction.editReply({ content: `✅ **SUCCESS:** Premium has been activated for target ID \`${targetId}\`!` });
        }

        // --- DEACTIVATE PREMIUM ---
        if (commandName === 'deactivatepremium' || commandName === 'removepremium') {
            if (!BOT_OWNERS.includes(user.id)) {
                return interaction.reply({ content: '❌ Only Bot Owners can manage Premium activation.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            const rawInputId = options.getString('server_id');
            const targetId = rawInputId ? rawInputId.trim() : guildId;

            await PremiumModel.deleteOne({ targetId: targetId });
            premiumCache.delete(targetId);

            return interaction.editReply({ content: `🛑 **SUCCESS:** Premium status has been removed from target ID \`${targetId}\`.` });
        }
    });
};
