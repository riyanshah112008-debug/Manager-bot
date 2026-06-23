const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'ignoredChannels.json');

module.exports = (client) => {
  const linkPattern = /https?:\/\/\S+/g;
  const emojiPattern = /<a?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  // Helper functions to manage the save file safely
  function readSettings() {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  function saveSettings(settings) {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
  }

  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    // Convert message to lowercase to prevent mobile auto-capitalize bugs (e.g., .Ignore)
    const content = message.content.toLowerCase();

    // ==========================================
    // 1. THE .IGNORE COMMAND
    // ==========================================
    if (content.startsWith('.ignore')) {
      try {
        // Fetch the member securely to prevent "null cache" crashes
        const member = message.member || await message.guild.members.fetch(message.author.id);
        
        if (!member.permissions.has('Administrator')) {
          return message.reply('❌ You need Administrator permissions to use this command.');
        }

        // Split securely ignoring double-spaces
        const args = message.content.split(/\s+/).slice(1); 
        const type = args[0]?.toLowerCase();

        if (!type || !['links', 'emojis', 'all', 'status'].includes(type)) {
          return message.reply('🔹 **Usage:** `.ignore <links/emojis/all/status> [#channel]`');
        }

        const channel = message.mentions.channels.first() || message.channel;
        const channelId = channel.id;
        const settings = readSettings();

        if (!settings[channelId]) {
          settings[channelId] = { links: false, emojis: false };
        }

        if (type === 'status') {
          const linkStatus = settings[channelId].links ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
          const emojiStatus = settings[channelId].emojis ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
          return message.reply(`📢 **Automod Status for <#${channelId}>:**\n🔗 Links: ${linkStatus}\n😀 Emojis: ${emojiStatus}`);
        }

        if (type === 'links') {
          settings[channelId].links = !settings[channelId].links;
          saveSettings(settings);
          return message.reply(`${settings[channelId].links ? '🚫' : '✅'} Automod **links** filter is now **${settings[channelId].links ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`);
        }

        if (type === 'emojis') {
          settings[channelId].emojis = !settings[channelId].emojis;
          saveSettings(settings);
          return message.reply(`${settings[channelId].emojis ? '🚫' : '✅'} Automod **emojis** filter is now **${settings[channelId].emojis ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`);
        }

        if (type === 'all') {
          const currentState = !(settings[channelId].links && settings[channelId].emojis);
          settings[channelId].links = currentState;
          settings[channelId].emojis = currentState;
          saveSettings(settings);
          return message.reply(`${currentState ? '🚫' : '✅'} **All** Automod filters are now **${currentState ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`);
        }
      } catch (err) {
        // If it crashes, it will print exactly why in Discord now
        console.error("IGNORE COMMAND ERROR:", err);
        return message.reply(`❌ An error occurred: \`${err.message}\``);
      }
      return; // Stops execution so the command doesn't trigger automod
    }

    // ==========================================
    // 2. THE AUTOMOD FILTER
    // ==========================================
    
    // Ignore all other commands (like .play) so they don't get caught
    if (content.startsWith('.')) return;

    // Load current channel settings safely
    let channelSettings = { links: false, emojis: false };
    try {
        const settings = readSettings();
        if (settings[message.channel.id]) {
            channelSettings = settings[message.channel.id];
        }
    } catch (e) {
        console.error("Error loading automod settings:", e);
    }

    const links = message.content.match(linkPattern) || [];
    const emojis = message.content.match(emojiPattern) || [];

    const isLinkSpam = !channelSettings.links && links.length >= 1;
    const isEmojiSpam = !channelSettings.emojis && emojis.length >= 5;

    if (isLinkSpam || isEmojiSpam) {
      try {
        await message.delete();

        if (isLinkSpam) {
          await message.member.timeout(5 * 60 * 1000, "Automod: Link Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 5 minutes for link spam.`);
        } else if (isEmojiSpam) {
          await message.member.timeout(2 * 60 * 1000, "Automod: Emoji Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 2 minutes for emoji spam.`);
        }
      } catch (error) {
        console.log("Automod caught an admin or lacked timeout permissions.");
      }
    }
  });
};
        
