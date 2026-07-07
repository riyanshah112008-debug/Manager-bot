const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../ignoredChannels.json');

// Helper function to read the current settings
function readSettings() {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Helper function to save settings
function saveSettings(settings) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
}

module.exports = {
    name: 'ignore',
    description: 'Turn off automod filters for a specific channel',
    execute(message, args) {
        // Check if the user has administrator permissions
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ You need Administrator permissions to use this command.');
        }

        // Target type: 'links', 'emojis', or 'all'
        const type = args[0]?.toLowerCase();
        if (!type || !['links', 'emojis', 'all', 'status'].includes(type)) {
            return message.reply('🔹 **Usage:** `.ignore <links/emojis/all/status> [#channel]`');
        }

        // Target channel: Mentioned channel, or the current channel if none mentioned
        const channel = message.mentions.channels.first() || message.channel;
        const channelId = channel.id;
        const settings = readSettings();

        if (!settings[channelId]) {
            settings[channelId] = { links: false, emojis: false };
        }

        // Handle the check/status view
        if (type === 'status') {
            const linkStatus = settings[channelId].links ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
            const emojiStatus = settings[channelId].emojis ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
            return message.reply(`📢 **Automod Status for ${channel}:**\n🔗 Links: ${linkStatus}\n😀 Emojis: ${emojiStatus}`);
        }

        // Toggle the settings
        if (type === 'links') {
            settings[channelId].links = !settings[channelId].links;
            saveSettings(settings);
            return message.reply(`${settings[channelId].links ? '🚫' : '✅'} Automod **links** filter is now **${settings[channelId].links ? 'DISABLED' : 'ENABLED'}** in ${channel}.`);
        }

        if (type === 'emojis') {
            settings[channelId].emojis = !settings[channelId].emojis;
            saveSettings(settings);
            return message.reply(`${settings[channelId].emojis ? '🚫' : '✅'} Automod **emojis** filter is now **${settings[channelId].emojis ? 'DISABLED' : 'ENABLED'}** in ${channel}.`);
        }

        if (type === 'all') {
            const currentState = !(settings[channelId].links && settings[channelId].emojis);
            settings[channelId].links = currentState;
            settings[channelId].emojis = currentState;
            saveSettings(settings);
            return message.reply(`${currentState ? '🚫' : '✅'} **All** Automod filters are now **${currentState ? 'DISABLED' : 'ENABLED'}** in ${channel}.`);
        }
    }
};
              
