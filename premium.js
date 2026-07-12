const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const mongoose = require('mongoose');

// 🗄️ 1. Define the Permanent Premium Schema for MongoDB
const PremiumSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    isPremium: { type: Boolean, default: true },
    activatedAt: { type: Date, default: Date.now }
});

const PremiumModel = mongoose.model('PremiumGuilds', PremiumSchema);

module.exports = (client) => {
    // 🧠 2. Initialize a fast local cache
    const premiumCache = new Set();

    // 📥 3. Wait for MongoDB to connect before loading the cache!
    mongoose.connection.once('open', async () => {
        try {
            const premiumGuilds = await PremiumModel.find({ isPremium: true });
            premiumGuilds.forEach(g => premiumCache.add(g.guildId));
            console.log(`💎 Loaded ${premiumCache.size} Premium servers from MongoDB!`);
        } catch (err) {
            console.error('❌ Failed to load premium servers from DB:', err);
        }
    });

    // 🔗 4. Attach a fast check function to the client object
    client.isPremium = (guildId) => {
        return premiumCache.has(guildId);
    };

    // =====================================================================
    // 💎 5. GLOBAL PREMIUM MODERATION DM SYSTEM
    // =====================================================================
    /**
     * Sends a DM to a user before a mod action. Automatically scales quality based on Premium status.
     * Usage anywhere in your bot: await client.sendPremiumModDM(member, mod, 'ban', 'reason', 'Permanent', guild, '1042', 'appeal_url');
     */
    client.sendPremiumModDM = async (member, moderator, action, reason, duration, guild, caseId = 'N/A', appealLink = null) => {
        const actionType = action.toLowerCase();
        const isGuildPremium = client.isPremium(guild.id);

        // --- FREE TIER FALLBACK ---
        // If the server isn't premium, send a clean but basic DM without the advanced Zendesk layout or buttons
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

        // --- PREMIUM TIER EMBED (Wick-Killer Layout) ---
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
            row.addComponents(new ButtonBuilder().setLabel('Read Server Rules').setURL('https://discord.com').setStyle(ButtonStyle.Link).setEmoji('📜')); // Replace with your default rules link
        }

        if (row.components.length > 0) components.push(row);

        try {
            await member.send({ embeds: [modEmbed], components: components });
            return true; 
        } catch (error) {
            return false; // Silently fails if user has DMs disabled
        }
    };

    // =====================================================================
    // --- COMMAND HANDLING ---
    // =====================================================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName, options, guildId, user } = interaction;

        // --- CHECK PREMIUM ---
        if (commandName === 'premiumcheck') {
            const enabled = premiumCache.has(guildId);
            return interaction.reply({
                content: enabled
                    ? '💎 **Premium is active on this server.**'
                    : 'ℹ️ **Premium is not active on this server.**',
                ephemeral: true
            });
        }

        // --- ACTIVATE PREMIUM ---
        if (commandName === 'activatepremium') {
            try {
                // 👑 MULTI-OWNER CHECK: Verified against client.isOwner()
                const isOwner = typeof client.isOwner === 'function' ? client.isOwner(user.id) : user.id === process.env.OWNER_ID;
                if (!isOwner) {
                    return interaction.reply({ content: '❌ Only Bot Owners can manage Premium activation.', ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });

                const targetGuildId = options.getString('server_id') || guildId;

                // Save permanently to MongoDB
                await PremiumModel.findOneAndUpdate(
                    { guildId: targetGuildId },
                    { isPremium: true },
                    { upsert: true, new: true }
                );

                // Update memory cache instantly
                premiumCache.add(targetGuildId);

                return interaction.editReply({ content: `✅ **SUCCESS:** Premium has been enabled for server \`${targetGuildId}\`!` });
            } catch (error) {
                console.error('Premium Command Error:', error);
                return interaction.editReply({ content: '❌ An error occurred processing the premium command.' }).catch(()=>{});
            }
        }

        // --- DEACTIVATE PREMIUM ---
        if (commandName === 'deactivatepremium' || commandName === 'removepremium') {
            try {
                // 👑 MULTI-OWNER CHECK: Verified against client.isOwner()
                const isOwner = typeof client.isOwner === 'function' ? client.isOwner(user.id) : user.id === process.env.OWNER_ID;
                if (!isOwner) {
                    return interaction.reply({ content: '❌ Only Bot Owners can manage Premium activation.', ephemeral: true });
                }

                await interaction.deferReply({ ephemeral: true });

                const targetGuildId = options.getString('server_id') || guildId;

                // Remove permanently from MongoDB
                await PremiumModel.deleteOne({ guildId: targetGuildId });

                // Remove from memory cache instantly
                premiumCache.delete(targetGuildId);

                return interaction.editReply({ content: `🛑 **SUCCESS:** Premium status has been removed from server \`${targetGuildId}\`.` });
            } catch (error) {
                console.error('Premium Command Error:', error);
                return interaction.editReply({ content: '❌ An error occurred processing the premium command.' }).catch(()=>{});
            }
        }
    });
};
