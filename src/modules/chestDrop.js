const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');

// Memory bank to track how many messages have been sent in each channel
const messageTracker = new Map();

module.exports = (client) => {
    client.on(Events.MessageCreate, async message => {
        // Ignore bots and DM messages
        if (message.author.bot || !message.guild) return;

        const channelId = message.channel.id;
        const currentCount = messageTracker.get(channelId) || 0;
        const newCount = currentCount + 1;
        
        // Randomly spawn a chest every 30 to 70 messages to keep it unpredictable
        const spawnThreshold = Math.floor(Math.random() * 40) + 30;

        if (newCount >= spawnThreshold) {
            // Reset the message tracker for this specific channel
            messageTracker.set(channelId, 0);

            // 1. Create the "Unclaimed" Chest Alert
            const dropEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🎁 A wild Loot Chest appeared!')
                .setDescription('Be the first to click the key below to claim its contents!')
                .setThumbnail('https://i.imgur.com/8QJ8zuz.png'); // Feel free to swap this URL for a "closed chest" image!

            // The Emoji Reaction Button
            const claimButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('claim_chest')
                    .setEmoji('🗝️')
                    .setStyle(ButtonStyle.Success)
            );

            // Send the chest to the chat
            const chestMessage = await message.channel.send({ embeds: [dropEmbed], components: [claimButton] });

            // 2. Create a high-speed collector that only accepts ONE click
            const collector = chestMessage.createMessageComponentCollector({ max: 1, time: 60000 }); // Expires in 60 seconds

            collector.on('collect', async interaction => {
                if (interaction.customId === 'claim_chest') {
                    // Instantly pause the interaction so it doesn't show an error to the user
                    await interaction.deferUpdate();

                    const userId = interaction.user.id;
                    const guildId = interaction.guild.id;

                    // Fetch user from DB
                    let userData = await User.findOne({ userId, guildId });
                    if (!userData) userData = new User({ userId, guildId });

                    // Chest Rarities & Weight distribution
                    const rarities = [
                        { name: 'Common', color: '#95a5a6', minXp: 100, maxXp: 300, minCred: 20, maxCred: 50, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 50 },
                        { name: 'Uncommon', color: '#2ecc71', minXp: 300, maxXp: 800, minCred: 50, maxCred: 120, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 30 },
                        { name: 'Rare', color: '#3498db', minXp: 800, maxXp: 1800, minCred: 120, maxCred: 250, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 13 },
                        { name: 'Epic', color: '#9b59b6', minXp: 1800, maxXp: 3500, minCred: 250, maxCred: 500, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 5 },
                        { name: 'Legendary', color: '#f1c40f', minXp: 3500, maxXp: 7000, minCred: 500, maxCred: 1200, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 2 }
                    ];

                    // Spin the wheel
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

                    // Calculate Rewards
                    const prestigeBonus = 1 + ((userData.prestige || 0) * 0.15);
                    const rawXp = Math.floor(Math.random() * (selectedRarity.maxXp - selectedRarity.minXp + 1)) + selectedRarity.minXp;
                    const rawCred = Math.floor(Math.random() * (selectedRarity.maxCred - selectedRarity.minCred + 1)) + selectedRarity.minCred;

                    const finalXp = Math.floor(rawXp * prestigeBonus);
                    const finalCred = Math.floor(rawCred * prestigeBonus);

                    // Update DB
                    userData.xp = (userData.xp || 0) + finalXp;
                    userData.credits = (userData.credits || 0) + finalCred;
                    await userData.save();

                    // 3. Edit the original message to show the winner and remove the button
                    const claimedEmbed = new EmbedBuilder()
                        .setColor(selectedRarity.color)
                        .setThumbnail(selectedRarity.img)
                        .setTitle(`💰 ${selectedRarity.name} Chest Claimed!`)
                        .setDescription(
                            `<@${userId}> claimed the ${selectedRarity.name.toLowerCase()} chest!\n` +
                            `✨ **${finalXp.toLocaleString()} XP!**\n` +
                            `💳 **+${finalCred.toLocaleString()} Credits** ${(userData.prestige || 0) > 0 ? `*(👑 +${(userData.prestige * 15)}% Prestige Bonus)*` : ''}\n\n` +
                            `🛍️ *Spend your credits in the **/shop** for exclusive roles!* 🛍️`
                        )
                        .setFooter({ text: 'Starry Loot Engine', iconURL: client.user.displayAvatarURL() });

                    await chestMessage.edit({ embeds: [claimedEmbed], components: [] });
                }
            });

            // 4. Handle expired chests (if no one clicks it for 60 seconds)
            collector.on('end', collected => {
                if (collected.size === 0) {
                    const expiredEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('💨 The chest vanished...')
                        .setDescription('Nobody claimed the chest in time! Keep chatting to find another one.');
                    chestMessage.edit({ embeds: [expiredEmbed], components: [] }).catch(() => {});
                }
            });
        } else {
            // Just update the message count and wait for the next message
            messageTracker.set(channelId, newCount);
        }
    });
};
