const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'ignoredChannels.json');

module.exports = (client) => {
  const linkPattern = /https?:\/\/\S+/g;
  const emojiPattern = /<a?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

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
      client.on("messageCreate", async (message) => {
    // Add this exact line right here:
    console.log(`[DEBUG] Saw a message from ${message.author.username}: "${message.content}"`);

    if (message.author.bot || !message.guild) return;
    // ... rest of the code stays the same
        
    if (message.author.bot || !message.guild) return;

    const content = message.content.toLowerCase();
    
    const isIgnoreCmd = content.startsWith('.ignore');
    const isUnignoreCmd = content.startsWith('.unignore');

    // ==========================================
    // 1. THE .IGNORE AND .UNIGNORE COMMANDS
    // ==========================================
    if (isIgnoreCmd || isUnignoreCmd) {
      try {
        const member = message.member || await message.guild.members.fetch(message.author.id);
        
        if (!member.permissions.has('Administrator')) {
          return message.reply('❌ You need Administrator permissions to use this command.');
        }

        const args = message.content.split(/\s+/).slice(1); 
        const type = args[0]?.toLowerCase();

        if (!type || !['links', 'emojis', 'all', 'status'].includes(type)) {
          return message.reply(`🔹 **Usage:** \`${isIgnoreCmd ? '.ignore' : '.unignore'} <links/emojis/all/status> [#channel]\``);
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
      // Step 1: Delete the message (Works for everyone)
      try {
        await message.delete();
      } catch (err) {
        console.log("Lacked permissions to delete message.");
      }

      // Step 2: Attempt the timeout and warning
      if (isLinkSpam) {
        try {
          await message.member.timeout(5 * 60 * 1000, "Automod: Link Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 5 minutes for link spam.`);
        } catch (error) {
          // This catches the Admin rejection and still sends the warning
          await message.channel.send(`⚠️ I deleted a spam link from ${message.author.toString()}, but I cannot time them out because they are an Admin.`);
        }
      } else if (isEmojiSpam) {
        try {
          await message.member.timeout(2 * 60 * 1000, "Automod: Emoji Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 2 minutes for emoji spam.`);
        } catch (error) {
          await message.channel.send(`⚠️ I deleted emoji spam from ${message.author.toString()}, but I cannot time them out because they are an Admin.`);
        }
      }
    }
  });
};
                                                                           
