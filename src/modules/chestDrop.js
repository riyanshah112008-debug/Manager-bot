const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const ChestChannel = require('../models/ChestChannel');

// Memory bank to track the precise time of the last drop per channel
const chestTimers = new Map();

module.exports = (client) => {
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot || !message.guild) return;

        // 1. BOOT UP THE MEMORY CACHE (Only runs once)
        if (!client.chestChannelsCache) {
            client.chestChannelsCache = new Set();
            const channels = await ChestChannel.find();
            channels.forEach(c => client.chestChannelsCache.add(c.channelId));
        }

        const channelId = message.channel.id;

        // 2. 🛑 SECURITY CHECK: If this channel isn't enabled by an Admin, ignore the message!
        if (!client.chestChannelsCache.has(channelId)) return;

        const now = Date.now();
        
        // 3. Start the timer if it hasn't started yet
        if (!chestTimers.has(channelId)) {
            chestTimers.set(channelId, { 
                lastDrop: now, 
                cooldown: Math.floor(Math.random() * 10000) + 30000 // Random 30s to 40s
            });
            return;
        }

        const channelData = chestTimers.get(channelId);
        const timePassed = now - channelData.lastDrop;

        console.log(`[Chest System - ${message.channel.name}] ${Math.floor(timePassed / 1000)}s passed. Target: ${Math.floor(channelData.cooldown / 1000)}s`);

        // 4. Drop the chest if enough time has passed!
        if (timePassed >= channelData.cooldown) {
            
            // Reset the timer for the next drop
            channelData.lastDrop = now;
            channelData.cooldown = Math.floor(Math.random() * 10000) + 30000; // Random 30s to 40s
            chestTimers.set(channelId, channelData);

            const dropEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🎁 A wild Loot Chest appeared!')
                .setDescription('Be the first to click the key below to claim its contents!')
                .setThumbnail('https://i.imgur.com/8QJ8zuz.png'); 

            const claimButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claim_chest').setEmoji('🗝️').setStyle(ButtonStyle.Success)
            );

            const chestMessage = await message.channel.send({ embeds: [dropEmbed], components: [claimButton] });
            const collector = chestMessage.createMessageComponentCollector({ max: 1, time: 60000 }); 

            collector.on('collect', async interaction => {
                if (interaction.customId === 'claim_chest') {
                    await interaction.deferUpdate(); 

                    const userId = interaction.user.id;
                    const guildId = interaction.guild.id;

                    let userData = await User.findOne({ userId, guildId });
                    if (!userData) userData = new User({ userId, guildId });

                    const rarities = [
                        { name: 'Common', color: '#95a5a6', minXp: 100, maxXp: 300, minCred: 20, maxCred: 50, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 50 },
                        { name: 'Uncommon', color: '#2ecc71', minXp: 300, maxXp: 800, minCred: 50, maxCred: 120, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 30 },
                        { name: 'Rare', color: '#3498db', minXp: 800, maxXp: 1800, minCred: 120, maxCred: 250, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 13 },
                        { name: 'Epic', color: '#9b59b6', minXp: 1800, maxXp: 3500, minCred: 250, maxCred: 500, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 5 },
                        { name: 'Legendary', color: '#f1c40f', minXp: 3500, maxXp: 7000, minCred: 500, maxCred: 1200, img: 'https://i.imgur.com/8QJ8zuz.png', chance: 2 }
                    ];

                    const roll = Math.random() * 100;
                    let cumulative = 0;
                    let selectedRarity = rarities[0];
                    for (const r of rarities) {
                        cumulative += r.chance;
                        if (roll <= cumulative) { selectedRarity = r; break; }
                    }

                    const prestigeBonus = 1 + ((userData.prestige || 0) * 0.15);
                    const rawXp = Math.floor(Math.random() * (selectedRarity.maxXp - selectedRarity.minXp + 1)) + selectedRarity.minXp;
                    const rawCred = Math.floor(Math.random() * (selectedRarity.maxCred - selectedRarity.minCred + 1)) + selectedRarity.minCred;

                    const finalXp = Math.floor(rawXp * prestigeBonus);
                    const baseCred = Math.floor(rawCred * prestigeBonus);
                    
                    let petBonusCred = 0;
                    if (userData.activePet && userData.petHappiness > 0) {
                        petBonusCred = Math.floor(baseCred * (userData.petHappiness / 100) * 0.35);
                    }
                    const finalCred = baseCred + petBonusCred;

                    userData.xp = (userData.xp || 0) + finalXp;
                    userData.credits = (userData.credits || 0) + finalCred;
                    await userData.save();

                    const claimedEmbed = new EmbedBuilder()
                        .setColor(selectedRarity.color)
                        .setThumbnail(selectedRarity.img)
                        .setTitle(`💰 ${selectedRarity.name} Chest Claimed!`)
                        .setDescription(
                            `<@${userId}> claimed the ${selectedRarity.name.toLowerCase()} chest!\n` +
                            `✨ **${finalXp.toLocaleString()} XP!**\n` +
                            `💳 **+${finalCred.toLocaleString()} Credits** ` +
                            `${petBonusCred > 0 ? `*(🐾 +${petBonusCred} from pet bonus)*` : ''}\n\n` +
                            `🛍️ *Spend your credits in the **/shop** for exclusive roles and pets!* 🛍️`
                        )
                        .setFooter({ text: 'Starry Loot Engine', iconURL: client.user.displayAvatarURL() });

                    await chestMessage.edit({ embeds: [claimedEmbed], components: [] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    const expiredEmbed = new EmbedBuilder().setColor('#ff0000').setTitle('💨 The chest vanished...').setDescription('Nobody claimed the chest in time! Keep chatting to find another one.');
                    chestMessage.edit({ embeds: [expiredEmbed], components: [] }).catch(() => {});
                }
            });
        }
    });
};
