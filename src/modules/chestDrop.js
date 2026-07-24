                    // Calculate Rewards
                    const prestigeBonus = 1 + ((userData.prestige || 0) * 0.15);
                    const rawXp = Math.floor(Math.random() * (selectedRarity.maxXp - selectedRarity.minXp + 1)) + selectedRarity.minXp;
                    const rawCred = Math.floor(Math.random() * (selectedRarity.maxCred - selectedRarity.minCred + 1)) + selectedRarity.minCred;

                    const finalXp = Math.floor(rawXp * prestigeBonus);
                    const baseCred = Math.floor(rawCred * prestigeBonus);
                    
                    // 🐾 THE PET BONUS: Up to 35% extra credits based on Happiness!
                    let petBonusCred = 0;
                    if (userData.activePet && userData.petHappiness > 0) {
                        petBonusCred = Math.floor(baseCred * (userData.petHappiness / 100) * 0.35);
                    }
                    
                    const finalCred = baseCred + petBonusCred;

                    // Update DB
                    userData.xp = (userData.xp || 0) + finalXp;
                    userData.credits = (userData.credits || 0) + finalCred;
                    await userData.save();

                    // 3. Edit the original message to show the winner
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
