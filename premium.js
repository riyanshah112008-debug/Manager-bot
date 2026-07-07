const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ==========================================
// SIMPLE JSON DATABASE FOR PREMIUM
// ==========================================
const dbPath = path.join(__dirname, 'premiumData.json');

function getPremiumData() {
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ servers: [] }));
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function savePremiumData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ==========================================
// MODULE EXPORT
// ==========================================
module.exports = (client) => {
    
    // Global helper so other files (like Starry.js) can check if a server is premium
    client.isPremium = (guildId) => {
        const data = getPremiumData();
        return data.servers.includes(guildId);
    };

    client.on("interactionCreate", async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const isOwner = interaction.user.id === process.env.OWNER_ID;
        const premiumData = getPremiumData();

        // --- /premiumcheck ---
        if (interaction.commandName === "premiumcheck") {
            if (!interaction.guild) {
                return interaction.reply({ content: "❌ Use this command in a server.", ephemeral: true });
            }

            const isPrem = client.isPremium(interaction.guild.id);
            const embed = new EmbedBuilder()
                .setColor(isPrem ? "#FFD700" : "#2b2d31")
                .setTitle("⭐ Premium Status")
                .setDescription(isPrem 
                    ? "✅ **Premium is ACTIVE for this server!** All advanced features and Starry AI are unlocked." 
                    : "❌ **Premium is NOT active.** Upgrade to unlock Starry AI and advanced protections.")
                .setTimestamp();
                
            return interaction.reply({ embeds: [embed] });
        }

        // --- /activatepremium ---
        if (interaction.commandName === "activatepremium") {
            if (!isOwner) {
                return interaction.reply({ content: "❌ Only the bot owner can use this command.", ephemeral: true });
            }

            const targetServer = interaction.options.getString("server_id");
            
            if (!premiumData.servers.includes(targetServer)) {
                premiumData.servers.push(targetServer);
                savePremiumData(premiumData); // Save it to the JSON file
                return interaction.reply(`✅ **SUCCESS:** Premium has been enabled for server \`${targetServer}\`!`);
            }
            
            return interaction.reply({ content: "⚠️ That server already has Premium activated.", ephemeral: true });
        }

        // --- /removepremium ---
        if (interaction.commandName === "removepremium") {
            if (!isOwner) {
                return interaction.reply({ content: "❌ Only the bot owner can use this command.", ephemeral: true });
            }

            const targetServer = interaction.options.getString("server_id");
            
            if (premiumData.servers.includes(targetServer)) {
                // Filter out the removed server
                premiumData.servers = premiumData.servers.filter(id => id !== targetServer);
                savePremiumData(premiumData); // Save the updated list
                return interaction.reply(`❌ **REVOKED:** Premium has been removed for server \`${targetServer}\`.`);
            }
            
            return interaction.reply({ content: "⚠️ That server does not currently have Premium.", ephemeral: true });
        }
    });
};
                                
