const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const mongoose = require('mongoose');

// 🗄️ 1. Define the Permanent Premium Schema for MongoDB
const PremiumSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    isPremium: { type: Boolean, default: true },
    activatedAt: { type: Date, default: Date.now }
});

const PremiumModel = mongoose.model('PremiumGuilds', PremiumSchema);

module.exports = async (client) => {
    // 🧠 2. Initialize a fast local cache
    const premiumCache = new Set();

    // 📥 3. Load all premium servers from MongoDB on boot
    try {
        const premiumGuilds = await PremiumModel.find({ isPremium: true });
        premiumGuilds.forEach(g => premiumCache.add(g.guildId));
        console.log(`💎 Loaded ${premiumCache.size} Premium servers from MongoDB!`);
    } catch (err) {
        console.error('❌ Failed to load premium servers from DB:', err);
    }

    // 🔗 4. Attach a fast check function to the client object
    client.isPremium = (guildId) => {
        return premiumCache.has(guildId);
    };

    // --- COMMAND HANDLING ---
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const { commandName, options, guildId, user } = interaction;

        if (commandName === 'premium') {
            try {
                const subcommand = options.getSubcommand();
                const targetGuildId = options.getString('server_id') || guildId;

                // Security check: Only the bot owner can add/remove premium servers globally
                if (user.id !== process.env.OWNER_ID) {
                    return interaction.reply({ content: '❌ Only the global Bot Owner can manage Premium activation.', ephemeral: true });
                }
                // --- ACTIVATE PREMIUM ---
                if (subcommand === 'activate') {
                    await interaction.deferReply({ ephemeral: true });

                    // Save permanently to MongoDB
                    await PremiumModel.findOneAndUpdate(
                        { guildId: targetGuildId },
                        { isPremium: true },
                        { upsert: true, new: true }
                    );

                    // Update memory cache instantly
                    premiumCache.add(targetGuildId);

                    return interaction.editReply({ content: `✅ **Server ID \`${targetGuildId}\` has been permanently upgraded to Premium!**` });
                }

                // --- DEACTIVATE PREMIUM ---
                if (subcommand === 'deactivate') {
                    await interaction.deferReply({ ephemeral: true });

                    // Remove permanently from MongoDB
                    await PremiumModel.deleteOne({ guildId: targetGuildId });

                    // Remove from memory cache instantly
                    premiumCache.delete(targetGuildId);

                    return interaction.editReply({ content: `🛑 **Premium status has been removed from Server ID \`${targetGuildId}\`.**` });
                }
                
            } catch (error) {
                console.error('Premium Command Error:', error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: '❌ An error occurred processing the premium command.', ephemeral: true }).catch(()=>{});
                } else {
                    await interaction.reply({ content: '❌ An error occurred processing the premium command.', ephemeral: true }).catch(()=>{});
                }
            }
        }
    });
};
