const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'ignoredChannels.json');

module.exports = (client) => {
  // Regex patterns
  const linkPattern = /https?:\/\/\S+/g;
  const emojiPattern = /<a?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  // Helper functions for JSON storage
  function readSettings() {
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}));
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error("File System Error (Read):", err);
      return {};
    }
  }

  function saveSettings(settings) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
    } catch (err) {
      console.error("File System Error (Write):", err);
    }
  }

  client.on("messageCreate", async (message) => {
    // Ignore bots and messages outside of guilds
    if (message.author.bot || !message.guild) return;

    const content = message.content.toLowerCase();
    const isIgnoreCmd = content.startsWith('.ignore');
    const isUnignoreCmd = content.startsWith('.unignore');
    const isAutomodCmd = content.startsWith('.automod');

    // ==========================================
    // 1. COMMANDS: .AUTOMOD, .IGNORE, .UNIGNORE
    // ==========================================
          // ==========================================
        // 👑 THE MASTER KEY GUARD
        // ==========================================
        const isAdmin = member.permissions.has('Administrator');
        
        // PASTE YOUR 18-DIGIT NUMBER HERE INSIDE THE QUOTES
        const isOwner = message.author.id === '1465049039153135639'; 

        if (!isAdmin && !isOwner) {
          return message.reply('❌ You need **Administrator** permissions to use this command.');
        }
    
    
    if (isIgnoreCmd || isUnignoreCmd || isAutomodCmd) {
      try {
        const member = message.member || await message.guild.members.fetch(message.author.id);
        
        // Security Check: Only Admins can modify automod
        if (!member.permissions.has('Administrator')) {
          return message.reply('❌ You need Administrator permissions to use this command.');
        }

        const args = message.content.split(/\s+/).slice(1); 
        const settings = readSettings();
        const guildId = message.guild.id;

        // --- NEW: SERVER-WIDE TOGGLE (.automod) ---
        if (isAutomodCmd) {
          const action = args[0]?.toLowerCase();

          if (!action || !['enable', 'disable', 'status'].includes(action)) {
            return message.reply('🔹 **Usage:** `.automod <enable/disable/status>`');
          }

          // Initialize guild configuration if it doesn't exist
          if (!settings[guildId]) {
            settings[guildId] = { automodEnabled: true };
          }

          if (action === 'status') {
            const isEnabled = settings[guildId].automodEnabled !== false; // Defaults to true
            return message.reply(`📢 **Server-Wide Automod Status:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`);
          }

          if (action === 'enable') {
            settings[guildId].automodEnabled = true;
            saveSettings(settings);
            return message.reply('✅ Automod has been **ENABLED** for this entire server.');
          }

          if (action === 'disable') {
            settings[guildId].automodEnabled = false;
            saveSettings(settings);
            return message.reply('🚫 Automod has been **DISABLED** for this entire server.');
          }
          return;
        }

        // --- EXISTING: CHANNEL TOGGLES (.ignore / .unignore) ---
        const type = args[0]?.toLowerCase();

        if (!type || !['links', 'emojis', 'all', 'status'].includes(type)) {
          return message.reply(`🔹 **Usage:** \`${isIgnoreCmd ? '.ignore' : '.unignore'} <links/emojis/all/status> [#channel]\``);
        }

        const channel = message.mentions.channels.first() || message.channel;
        const channelId = channel.id;

        // Initialize channel if it doesn't exist in the JSON
        if (!settings[channelId]) {
          settings[channelId] = { links: false, emojis: false };
        }

        if (type === 'status') {
          const linkStatus = settings[channelId].links ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
          const emojiStatus = settings[channelId].emojis ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
          return message.reply(`📢 **Automod Status for <#${channelId}>:**\n🔗 Links: ${linkStatus}\n😀 Emojis: ${emojiStatus}`);
        }

        // Determine if we are disabling (ignore = true) or enabling (unignore = false)
        const targetState = isIgnoreCmd ? true : false;

        if (type === 'links') {
          settings[channelId].links = targetState;
          saveSettings(settings);
          return message.reply(`${targetState ? '🚫' : '✅'} Automod **links** filter is now **${targetState ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`);
        }

        if (type === 'emojis') {
          settings[channelId].emojis = targetState;
          saveSettings(settings);
          return message.reply(`${targetState ? '🚫' : '✅'} Automod **emojis** filter is now **${targetState ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`);
        }

        if (type === 'all') {
          settings[channelId].links = targetState;
          settings[channelId].emojis = targetState;
          saveSettings(settings);
          return message.reply(`${targetState ? '🚫' : '✅'} **All** Automod filters are now **${targetState ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`);
        }
      } catch (err) {
        console.error("Command Error:", err);
        return message.reply(`❌ Command Error: \`${err.message}\``);
      }
      return; // Stop processing so the command itself doesn't trigger the filter
    }

    // ==========================================
    // 2. THE AUTOMOD FILTER
    // ==========================================
    
    // Safety check: Completely ignore ANY command (messages starting with a dot) 
    if (content.startsWith('.')) return;

    let channelSettings = { links: false, emojis: false };
    let isServerEnabled = true; // Default behavior is enabled

    try {
        const settings = readSettings();
        
        // Check the new Server-Wide status
        if (settings[message.guild.id] && settings[message.guild.id].automodEnabled === false) {
            isServerEnabled = false;
        }

        // Load channel specific settings
        if (settings[message.channel.id]) {
            channelSettings = settings[message.channel.id];
        }
    } catch (e) {
        console.error("Error loading automod settings:", e);
    }

    // 🛑 THE NEW GUARD: Stop execution immediately if the entire server is disabled
    if (!isServerEnabled) return;

    // --- Filter out GIF URLs from the matched links ---
    const rawLinks = message.content.match(linkPattern) || [];
    const links = rawLinks.filter(link => {
        const url = link.toLowerCase();
        // Ignore links from common GIF sites or links that end directly in .gif
        return !url.includes('tenor.com') && 
               !url.includes('giphy.com') && 
               !url.endsWith('.gif');
    });

    const emojis = message.content.match(emojiPattern) || [];

    // Check if spam exists AND if the filter is currently active for this channel
    // channelSettings.links === true means it is IGNORED.
    const isLinkSpam = !channelSettings.links && links.length >= 1;
    const isEmojiSpam = !channelSettings.emojis && emojis.length >= 5;

    if (isLinkSpam || isEmojiSpam) {
      // 1. Attempt to delete the message
      try {
        await message.delete();
      } catch (err) {
        console.warn("Automod lacked permissions to delete message.");
      }

      // 2. Apply punishments based on the violation
      if (isLinkSpam) {
        try {
          // Timeout for 10 minutes (600,000 ms)
          await message.member.timeout(10 * 60 * 1000, "Automod: Link Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 10 minutes for link spam.`);
        } catch (error) {
          await message.channel.send(`⚠️ I deleted a spam link from ${message.author.toString()}, but I cannot time them out because they possess Admin/Moderation powers.`);
        }
      } else if (isEmojiSpam) {
        try {
          // Timeout for 2 minutes (120,000 ms)
          await message.member.timeout(2 * 60 * 1000, "Automod: Emoji Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 2 minutes for emoji spam.`);
        } catch (error) {
          await message.channel.send(`⚠️ I deleted emoji spam from ${message.author.toString()}, but I cannot time them out because they possess Admin/Moderation powers.`);
        }
      }
    }
  });
};
