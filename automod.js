const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'ignoredChannels.json');

// 👑 YOUR MASTER KEY: Paste your exact Discord User ID inside the quotes below
const OWNER_ID = '1465049039153135639'; 

module.exports = (client) => {
  // Regex patterns
  const linkPattern = /https?:\/\/\S+/g;
  const emojiPattern = /<a?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  // 🛡️ THE GIF/MEDIA WHITELIST
  // Automod will ignore links if they come from these safe websites
  const allowedDomains = [
      'tenor.com',
      'giphy.com',
      'discord.com',
      'discordapp.com',
      'discordapp.net',
      'media.discordapp.net',
      'cdn.discordapp.com'
  ];

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

    // Added .trim() to prevent mobile ghost spaces from breaking commands
    const content = message.content.trim().toLowerCase();
    const isIgnoreCmd = content.startsWith('.ignore');
    const isUnignoreCmd = content.startsWith('.unignore');
    const isAutomodCmd = content.startsWith('.automod');

    // ==========================================
    // 1. COMMANDS: .AUTOMOD, .IGNORE, .UNIGNORE
    // ==========================================
    if (isIgnoreCmd || isUnignoreCmd || isAutomodCmd) {
      try {
        const member = message.member || await message.guild.members.fetch(message.author.id);
        
        // 👑 THE MASTER KEY GUARD
        const isAdmin = member.permissions.has('Administrator');
        const isOwner = message.author.id === OWNER_ID;

        if (!isAdmin && !isOwner) {
          return message.reply('❌ You need **Administrator** permissions to use this command.');
        }

        const args = message.content.trim().split(/\s+/).slice(1); 
        const settings = readSettings();
        const guildId = message.guild.id;

        // --- SERVER-WIDE TOGGLE (.automod) ---
        if (isAutomodCmd) {
          const action = args[0]?.toLowerCase();

          if (!action || !['enable', 'disable', 'status'].includes(action)) {
            return message.reply('🔹 **Usage:** `.automod <enable/disable/status>`');
          }

          if (!settings[guildId]) {
            settings[guildId] = { automodEnabled: false };
          }

          if (action === 'status') {
            const isEnabled = settings[guildId].automodEnabled !== false;
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

        // --- CHANNEL TOGGLES (.ignore / .unignore) ---
        const type = args[0]?.toLowerCase();

        if (!type || !['links', 'emojis', 'all', 'status'].includes(type)) {
          return message.reply(`🔹 **Usage:** \`${isIgnoreCmd ? '.ignore' : '.unignore'} <links/emojis/all/status> [#channel]\``);
        }

        const channel = message.mentions.channels.first() || message.channel;
        const channelId = channel.id;

        if (!settings[channelId]) {
          settings[channelId] = { links: false, emojis: false };
        }

        if (type === 'status') {
          const linkStatus = settings[channelId].links ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
          const emojiStatus = settings[channelId].emojis ? '❌ Ignored (No Filter)' : '✅ Active (Filtering)';
          return message.reply(`📢 **Automod Status for <#${channelId}>:**\n🔗 Links: ${linkStatus}\n😀 Emojis: ${emojiStatus}`);
        }

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
      return; 
    }

    // ==========================================
    // 2. THE AUTOMOD FILTER
    // ==========================================
    if (content.startsWith('.')) return;

    let channelSettings = { links: false, emojis: false };
    let isServerEnabled = true; 

    try {
        const settings = readSettings();
        if (settings[message.guild.id] && settings[message.guild.id].automodEnabled === false) {
            isServerEnabled = false;
        }
        if (settings[message.channel.id]) {
            channelSettings = settings[message.channel.id];
        }
    } catch (e) {
        console.error("Error loading automod settings:", e);
    }

    // 🛑 THE NEW GUARD
    if (!isServerEnabled) return;

    // Grab all links from the message
    const rawLinks = message.content.match(linkPattern) || [];
    
    // Filter out the safe domains (GIFs, Discord media, etc.)
    const links = rawLinks.filter(link => {
        const url = link.toLowerCase();
        
        // Check if any of our safe domains are inside the URL
        const isSafeDomain = allowedDomains.some(domain => url.includes(domain));
        const isGifFile = url.endsWith('.gif');
        
        // If it is NOT safe, keep it in the list of illegal links to be punished
        return !isSafeDomain && !isGifFile;
    });

    const emojis = message.content.match(emojiPattern) || [];
    
    // Trigger spam flags based on remaining illegal content
    const isLinkSpam = !channelSettings.links && links.length >= 1;
    const isEmojiSpam = !channelSettings.emojis && emojis.length >= 5;

    if (isLinkSpam || isEmojiSpam) {
      try {
        await message.delete();
      } catch (err) {
        console.warn("Automod lacked permissions to delete message.");
      }

      if (isLinkSpam) {
        try {
          await message.member.timeout(10 * 60 * 1000, "Automod: Link Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 10 minutes for link spam.`);
        } catch (error) {
          await message.channel.send(`⚠️ I deleted a spam link from ${message.author.toString()}, but I cannot time them out because they possess Admin/Moderation powers.`);
        }
      } else if (isEmojiSpam) {
        try {
          await message.member.timeout(2 * 60 * 1000, "Automod: Emoji Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 2 minutes for emoji spam.`);
        } catch (error) {
          await message.channel.send(`⚠️ I deleted emoji spam from ${message.author.toString()}, but I cannot time them out because they possess Admin/Moderation powers.`);
        }
      }
    }
  });
};
            
