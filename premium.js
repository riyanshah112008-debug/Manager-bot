const { EmbedBuilder, PermissionsBitField } = require('discord.js');
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
    // --- COMMAND HANDLING ---
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
                if (user.id !== process.env.OWNER_ID) {
                    return interaction.reply({ content: '❌ Only the global Bot Owner can manage Premium activation.', ephemeral: true });
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
                if (user.id !== process.env.OWNER_ID) {
                    return interaction.reply({ content: '❌ Only the global Bot Owner can manage Premium activation.', ephemeral: true });
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
