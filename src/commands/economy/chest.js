const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('chest')
        .setDescription('Claim your timed loot chest for free XP and Credits!'),

    async execute(interaction, client) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        let userData = await User.findOne({ userId, guildId });
        if (!userData) userData = new User({ userId, guildId });

        // Cooldown check (2 Hours)
        const cooldown = 2 * 60 * 60 * 1000;
        if (userData.lastChestClaim && (Date.now() - userData.lastChestClaim < cooldown)) {
            const remaining = cooldown - (Date.now() - userData.lastChestClaim);
            const minutes = Math.floor(remaining / 60000);
            return interaction.editReply(`⏳ You must wait **${minutes} minutes** before claiming another chest!`);
        }

        // Chest Rarities & Weight distribution
        const rarities = [
            { name: 'Common', color: '#95a5a6', minXp: 100, maxXp: 300, minCred: 20, maxCred: 50, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 50 },
            { name: 'Uncommon', color: '#2ecc71', minXp: 300, maxXp: 800, minCred: 50, maxCred: 120, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 30 },
            { name: 'Rare', color: '#3498db', minXp: 800, maxXp: 1800, minCred: 120, maxCred: 250, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 13 },
            { name: 'Epic', color: '#9b59b6', minXp: 1800, maxXp: 3500, minCred: 250, maxCred: 500, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 5 },
            { name: 'Legendary', color: '#f1c40f', minXp: 3500, maxXp: 7000, minCred: 500, maxCred: 1200, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 2 }
        ];

        // Randomly select rarity based on weights
        const roll = Math.random() * 100;
        let cumulative = 0;
        let selectedRarity = rarities[0];

        for (const r of rarities) {
            cumulative += r.chance;
            if (roll <= cumulative) {
                selectedRarity = r;
                break;
            }
        }

        // Calculate Rewards + Prestige Boost
        const prestigeBonus = 1 + (userData.prestige * 0.15); // +15% per Prestige
        const rawXp = Math.floor(Math.random() * (selectedRarity.maxXp - selectedRarity.minXp + 1)) + selectedRarity.minXp;
        const rawCred = Math.floor(Math.random() * (selectedRarity.maxCred - selectedRarity.minCred + 1)) + selectedRarity.minCred;

        const finalXp = Math.floor(rawXp * prestigeBonus);
        const finalCred = Math.floor(rawCred * prestigeBonus);

        // Update DB
        userData.xp += finalXp;
        userData.credits += finalCred;
        userData.lastChestClaim = new Date();
        await userData.save();

        // Match Screenshot Visual Layout
        const embed = new EmbedBuilder()
            .setColor(selectedRarity.color)
            .setThumbnail(selectedRarity.img)
            .setTitle(`💰 ${selectedRarity.name} Chest Claimed!`)
            .setDescription(
                `<@${userId}> claimed the ${selectedRarity.name.toLowerCase()} chest!\n` +
                `✨ **${finalXp.toLocaleString()} XP!**\n` +
                `💳 **+${finalCred.toLocaleString()} Credits** ${userData.prestige > 0 ? `*(👑 +${userData.prestige * 15}% Prestige Bonus)*` : ''}\n\n` +
                `🛍️ *Spend your credits in the **/shop** for exclusive roles!* 🛍️`
            )
            .setFooter({ text: 'Starry Loot Engine', iconURL: client.user.displayAvatarURL() });

        return interaction.editReply({ embeds: [embed] });
    }
};
