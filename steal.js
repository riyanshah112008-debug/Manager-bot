const { PermissionsBitField, parseEmoji } = require('discord.js');

module.exports = (client) => {
    const PREFIX = '.';

    client.on('messageCreate', async message => {
        if (message.author.bot || !message.guild) return;

        if (message.content.startsWith(PREFIX + 'steal')) {
            // 1. Check Permissions (Manage Guild Expressions is the new v14 perm for Emojis/Stickers)
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
                return message.reply('❌ You need the **Manage Expressions** permission to steal emojis!').catch(() => {});
            }
            if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
                return message.reply('❌ I need the **Manage Expressions** permission in this server to upload them!').catch(() => {});
            }

            const args = message.content.slice((PREFIX + 'steal').length).trim().split(/ +/);
            const rawEmoji = args[0];
            const customName = args[1]; // Optional: Users can type `.steal <emoji> newName`

            // 2. CHECK FOR STICKERS (If the user is replying to a message with a sticker)
            if (message.reference) {
                try {
                    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    if (repliedMessage.stickers.size > 0) {
                        const sticker = repliedMessage.stickers.first();
                        const name = customName || sticker.name;
                        
                        const addedSticker = await message.guild.stickers.create({
                            file: sticker.url,
                            name: name,
                            tags: sticker.tags || 'stolen'
                        });
                        return message.reply(`✅ Successfully stole the sticker and named it **${addedSticker.name}**!`).catch(() => {});
                    }
                } catch (err) {
                    console.error("Sticker Steal Error:", err);
                }
            }

            // 3. CHECK FOR EMOJIS
            if (!rawEmoji) {
                return message.reply('❌ Please provide an emoji to steal, or reply to a message containing a sticker!').catch(() => {});
            }

            const parsedEmoji = parseEmoji(rawEmoji);

            if (parsedEmoji && parsedEmoji.id) {
                const extension = parsedEmoji.animated ? 'gif' : 'png';
                const url = `https://cdn.discordapp.com/emojis/${parsedEmoji.id}.${extension}`;
                const name = customName || parsedEmoji.name || 'stolen_emoji';

                try {
                    const addedEmoji = await message.guild.emojis.create({ attachment: url, name: name });
                    return message.reply(`✅ Successfully stole ${addedEmoji} and named it **${addedEmoji.name}**!`).catch(() => {});
                } catch (error) {
                    if (error.code === 30008) {
                        return message.reply('❌ This server has reached its maximum number of emojis!').catch(() => {});
                    }
                    if (error.code === 50035) {
                        return message.reply('❌ The file size for this emoji is too large for Discord to accept.').catch(() => {});
                    }
                    console.error("Emoji Steal Error:", error.message);
                    return message.reply('❌ Failed to steal the emoji. Discord might be blocking the request.').catch(() => {});
                }
            } else {
                return message.reply('❌ That doesn\'t look like a valid custom emoji! *(Note: Default Discord emojis like 🍎 cannot be stolen)*').catch(() => {});
            }
        }
    });
};
