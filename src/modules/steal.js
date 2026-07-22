const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = (client) => {
    const PREFIX = '.';

    const runStealUI = async (textToScan, stickers, member, guild, replyFunction) => {
        // 🔒 PREMIUM LOCK
        if (!client.isPremium(guild.id)) {
            return replyFunction({ content: '❌ **Steal Emojis** is a Premium feature! Use `.premium` to learn how to upgrade your server.', ephemeral: true });
        }

        const managePerms = PermissionsBitField.Flags.ManageGuildExpressions || PermissionsBitField.Flags.ManageEmojisAndStickers;
        if (!member.permissions.has(managePerms)) return replyFunction({ content: '❌ Missing `Manage Expressions` permission.', ephemeral: true });
        if (!guild.members.me.permissions.has(managePerms)) return replyFunction({ content: '❌ I need `Manage Expressions` permission.', ephemeral: true });

        const itemsToSteal = [];
        if (stickers && stickers.size > 0) {
            stickers.forEach(sticker => itemsToSteal.push({ id: sticker.id, name: sticker.name, url: sticker.url, type: 'sticker' }));
        }

        const emojiRegex = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;
        let match;
        while ((match = emojiRegex.exec(textToScan)) !== null) {
            if (!itemsToSteal.find(item => item.id === match[3])) {
                itemsToSteal.push({
                    id: match[3],
                    name: match[2],
                    url: `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] === 'a' ? 'gif' : 'png'}`,
                    type: 'emoji'
                });
            }
        }

        if (itemsToSteal.length === 0) return replyFunction({ content: '❌ No emojis/stickers found!', ephemeral: true });

        let currentIndex = 0;
        const generateEmbed = (index) => new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`Emoji/Sticker Stealer (${index + 1}/${itemsToSteal.length})`)
            .setDescription(`**Name:** \`${itemsToSteal[index].name}\`\n**Type:** ${itemsToSteal[index].type}`)
            .setImage(itemsToSteal[index].url);

        const generateButtons = (index) => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('steal_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
            new ButtonBuilder().setCustomId('steal_add').setLabel('📥 Steal').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('steal_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(index === itemsToSteal.length - 1)
        );

        const replyMsg = await replyFunction({ embeds: [generateEmbed(0)], components: [generateButtons(0)], fetchReply: true });
        const collector = replyMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== member.id) return interaction.reply({ content: '❌ No.', ephemeral: true });
            if (interaction.customId === 'steal_prev') { currentIndex--; await interaction.update({ embeds: [generateEmbed(currentIndex)], components: [generateButtons(currentIndex)] }); } 
            else if (interaction.customId === 'steal_next') { currentIndex++; await interaction.update({ embeds: [generateEmbed(currentIndex)], components: [generateButtons(currentIndex)] }); } 
            else if (interaction.customId === 'steal_add') {
                const item = itemsToSteal[currentIndex];
                try {
                    if (item.type === 'emoji') await guild.emojis.create({ attachment: item.url, name: item.name });
                    else await guild.stickers.create({ file: item.url, name: item.name, tags: 'stolen' });
                    await interaction.reply({ content: `✅ Stole ${item.name}!`, ephemeral: true });
                } catch (e) { await interaction.reply({ content: '❌ Error: Limit reached or file too large.', ephemeral: true }); }
            }
        });
    };

    client.on('messageCreate', async message => {
        if (message.author.bot || !message.content.startsWith(PREFIX + 'steal')) return;
        const target = message.reference ? await message.channel.messages.fetch(message.reference.messageId).catch(() => message) : message;
        await runStealUI(target.content + message.content, target.stickers, message.member, message.guild, (p) => message.reply(p));
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.guild) return;
        if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Steal Emojis') {
            await runStealUI(interaction.targetMessage.content, interaction.targetMessage.stickers, interaction.member, interaction.guild, (p) => interaction.reply(p));
        }
        if (interaction.isChatInputCommand() && interaction.commandName === 'steal') {
            await runStealUI(interaction.options.getString('emojis'), null, interaction.member, interaction.guild, (p) => interaction.reply(p));
        }
    });
};
                                                                                                       
