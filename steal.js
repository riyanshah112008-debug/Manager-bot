const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = (client) => {
    const PREFIX = '.';

    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith(PREFIX + 'steal')) {
            // 1. Permission Fallback Check
            const managePerms = PermissionsBitField.Flags.ManageGuildExpressions || PermissionsBitField.Flags.ManageEmojisAndStickers;
            
            if (!message.member.permissions.has(managePerms)) {
                return message.reply('❌ You need the **Manage Expressions** permission to steal emojis!').catch(() => {});
            }
            if (!message.guild.members.me.permissions.has(managePerms)) {
                return message.reply('❌ I need the **Manage Expressions** permission in this server to upload them!').catch(() => {});
            }

            // 2. Find the target message (the one they replied to, or their own message)
            let targetMessage = message;
            if (message.reference) {
                targetMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            }
            
            if (!targetMessage) targetMessage = message;

            const itemsToSteal = [];

            // 3. Extract Stickers
            if (targetMessage.stickers.size > 0) {
                targetMessage.stickers.forEach(sticker => {
                    itemsToSteal.push({
                        id: sticker.id,
                        name: sticker.name,
                        url: sticker.url,
                        type: 'sticker'
                    });
                });
            }

            // 4. Extract Custom Emojis (Animated and Static)
            const emojiRegex = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
            let match;
            const contentToScan = targetMessage.content + " " + message.content; 
            
            while ((match = emojiRegex.exec(contentToScan)) !== null) {
                const isAnimated = match[0].startsWith('<a:');
                const name = match[1];
                const id = match[2];
                const extension = isAnimated ? 'gif' : 'png';
                
                // Prevent adding duplicates
                if (!itemsToSteal.find(item => item.id === id)) {
                    itemsToSteal.push({
                        id: id,
                        name: name,
                        url: `https://cdn.discordapp.com/emojis/${id}.${extension}`,
                        type: 'emoji'
                    });
                }
            }

            if (itemsToSteal.length === 0) {
                return message.reply('❌ I could not find any custom emojis or stickers in that message to steal!').catch(() => {});
            }

            // 5. The Paginated UI Logic
            let currentIndex = 0;

            const generateEmbed = (index) => {
                const item = itemsToSteal[index];
                return new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle(`Emoji & Sticker Stealer (${index + 1}/${itemsToSteal.length})`)
                    .setDescription(`**Name:** \`${item.name}\`\n**Type:** ${item.type === 'emoji' ? '🎨 Custom Emoji' : '🏷️ Sticker'}\n\n*Click the Steal button below to add this to the server!*`)
                    .setImage(item.url)
                    .setFooter({ text: 'Powered by Starry UI' });
            };

            const generateButtons = (index) => {
                const row = new ActionRowBuilder();
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('steal_prev')
                        .setLabel('◀ Prev')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(index === 0),
                    new ButtonBuilder()
                        .setCustomId('steal_add')
                        .setLabel('📥 Steal')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('steal_next')
                        .setLabel('Next ▶')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(index === itemsToSteal.length - 1)
                );
                return row;
            };

            // 6. Send the initial Interactive Message
            const replyMsg = await message.reply({ 
                embeds: [generateEmbed(0)], 
                components: [generateButtons(0)] 
            }).catch(() => null);

            if (!replyMsg) return;

            // 7. Listen for button clicks (Timeout after 2 minutes)
            const collector = replyMsg.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 120000 
            });

            collector.on('collect', async (interaction) => {
                // Only the person who typed .steal can click the buttons
                if (interaction.user.id !== message.author.id) {
                    return interaction.reply({ content: '❌ You cannot use this menu!', ephemeral: true });
                }

                if (interaction.customId === 'steal_prev') {
                    currentIndex--;
                    await interaction.update({ embeds: [generateEmbed(currentIndex)], components: [generateButtons(currentIndex)] });
                } 
                else if (interaction.customId === 'steal_next') {
                    currentIndex++;
                    await interaction.update({ embeds: [generateEmbed(currentIndex)], components: [generateButtons(currentIndex)] });
                } 
                else if (interaction.customId === 'steal_add') {
                    const item = itemsToSteal[currentIndex];
                    try {
                        if (item.type === 'emoji') {
                            const addedEmoji = await message.guild.emojis.create({ attachment: item.url, name: item.name });
                            await interaction.reply({ content: `✅ Successfully stole ${addedEmoji} as **${addedEmoji.name}**!`, ephemeral: true });
                        } else {
                            const addedSticker = await message.guild.stickers.create({ file: item.url, name: item.name, tags: 'stolen' });
                            await interaction.reply({ content: `✅ Successfully stole sticker as **${addedSticker.name}**!`, ephemeral: true });
                        }
                    } catch (error) {
                        if (error.code === 30008) {
                            await interaction.reply({ content: '❌ The server has reached the maximum emoji limit!', ephemeral: true });
                        } else if (error.code === 50035) {
                            await interaction.reply({ content: '❌ The file size is too large for Discord.', ephemeral: true });
                        } else {
                            await interaction.reply({ content: '❌ Failed to steal. Discord rejected the request.', ephemeral: true });
                        }
                    }
                }
            });

            collector.on('end', () => {
                // Remove buttons after time expires
                replyMsg.edit({ components: [] }).catch(() => {});
            });
        }
    });
};
