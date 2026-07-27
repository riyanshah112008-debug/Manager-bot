const mongoose = require('mongoose');

// 🗄️ Fetch the exact same MongoDB schema used in automod.js
const AutomodChannel = mongoose.models.AutomodChannel || mongoose.model('AutomodChannel', new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    links: { type: Boolean, default: false },
    emojis: { type: Boolean, default: false }
}));

module.exports = {
    name: 'ignore',
    description: 'Turn off automod filters for a specific channel',
    async execute(message, args) {
        // Check if the user has administrator permissions
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ You need **Administrator** permissions to use this command.');
        }

        // Target type: 'links', 'emojis', or 'all'
        const type = args[0]?.toLowerCase();
        if (!type || !['links', 'emojis', 'all', 'status'].includes(type)) {
            return message.reply('🔹 **Usage:** `.ignore <links/emojis/all/status> [#channel]`');
        }

        // Target channel: Mentioned channel, or the current channel if none mentioned
        const channel = message.mentions.channels.first() || message.channel;
        const channelId = channel.id;

        // 🍃 Fetch current settings from MongoDB (instead of a local JSON file)
        let channelData = await AutomodChannel.findOne({ channelId });
        
        // If the channel isn't in the database yet, create a default entry for it
        if (!channelData) {
            channelData = new AutomodChannel({ channelId, links: false, emojis: false });
        }

        // Handle the check/status view
        if (type === 'status') {
            const linkStatus = channelData.links ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
            const emojiStatus = channelData.emojis ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
            return message.reply(`📢 **Automod Status for ${channel}:**\n🔗 Links: ${linkStatus}\n😀 Emojis: ${emojiStatus}`);
        }

        // Toggle the settings in memory
        if (type === 'links') {
            channelData.links = !channelData.links;
        } else if (type === 'emojis') {
            channelData.emojis = !channelData.emojis;
        } else if (type === 'all') {
            const newState = !(channelData.links && channelData.emojis);
            channelData.links = newState;
            channelData.emojis = newState;
        }

        // 💾 Save the new settings permanently to MongoDB
        await channelData.save();

        // Send the confirmation message
        if (type === 'links') {
            return message.reply(`${channelData.links ? '🚫' : '✅'} Automod **links** filter is now **${channelData.links ? 'DISABLED' : 'ENABLED'}** in ${channel}.`);
        } else if (type === 'emojis') {
            return message.reply(`${channelData.emojis ? '🚫' : '✅'} Automod **emojis** filter is now **${channelData.emojis ? 'DISABLED' : 'ENABLED'}** in ${channel}.`);
        } else if (type === 'all') {
            return message.reply(`${channelData.links ? '🚫' : '✅'} **All** Automod filters are now **${channelData.links ? 'DISABLED' : 'ENABLED'}** in ${channel}.`);
        }
    }
};
