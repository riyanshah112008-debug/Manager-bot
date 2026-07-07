const { Events, EmbedBuilder } = require('discord.js');
const { getConfig } = require('./logManager');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        // 1. If the bot just woke up and doesn't remember the message, safely fetch the new data
        if (newMessage.partial) {
            try {
                await newMessage.fetch();
            } catch (error) {
                return; // Ignore if it fails to fetch
            }
        }

        // 2. Ignore bot edits or DMs using the safe newMessage data
        if (!newMessage.guild || newMessage.author?.bot) return;

        // 3. Ignore if the text didn't change (e.g., Discord just generating a link preview)
        if (oldMessage.content === newMessage.content) return;

        // 4. Verify log channel is set up
        const config = getConfig();
        const logChannelId = config[newMessage.guild.id]?.logChannel;
        if (!logChannelId) return;

        const logChannel = newMessage.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        // 5. Safely handle the "Before" text just in case the bot forgot it during a restart
        const beforeText = oldMessage.partial || !oldMessage.content 
            ? '*[Unknown - Message sent while bot was offline or restarting]*' 
            : oldMessage.content;
            
        const afterText = newMessage.content || '*[Empty]*';

        // 6. Build the embed (Always use newMessage for the author info!)
        const embed = new EmbedBuilder()
            .setColor('Blue')
            .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
            .setTitle(`✏️ Message edited in #${newMessage.channel.name}`)
            .setDescription(`**Before:**\n${beforeText}\n\n**After:**\n${afterText}`)
            .setFooter({ text: `ID: ${newMessage.author.id}` })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
