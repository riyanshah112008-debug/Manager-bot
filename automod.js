const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'ignoredChannels.json');

// 👑 YOUR MASTER KEY
const OWNER_ID = '1465049039153135639'; 

module.exports = (client) => {
  // Regex patterns
  const linkPattern = /https?:\/\/\S+/g;
  const emojiPattern = /<a?:[a-zA-Z0-9_]+:[0-9]+>|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  // 🛡️ THE GIF/MEDIA WHITELIST
  const allowedDomains = [
      'tenor.com', 'giphy.com', 'discord.com', 'discordapp.com', 
      'discordapp.net', 'media.discordapp.net', 'cdn.discordapp.com'
  ];

  function readSettings() {
    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}));
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      return {};
    }
  }

  function saveSettings(settings) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
    } catch (err) {}
  }

  // ==========================================
  // 1. REGISTER SLASH COMMANDS
  // ==========================================
  client.on('clientReady', async () => {
      try {
          await client.application.commands.create({
              name: 'automod',
              description: 'Toggle the Automod system for the server (Admin Only)',
              default_member_permissions: '8', 
              options: [{
                  name: 'action',
                  description: 'Enable, disable, or check status',
                  type: 3,
                  required: true,
                  choices: [
                      { name: 'Enable', value: 'enable' },
                      { name: 'Disable', value: 'disable' },
                      { name: 'Status', value: 'status' }
                  ]
              }]
          });

          await client.application.commands.create({
              name: 'ignore',
              description: 'Disable automod filters for a channel (Admin Only)',
              default_member_permissions: '8',
              options: [
                  {
                      name: 'type',
                      description: 'What to ignore',
                      type: 3,
                      required: true,
                      choices: [
                          { name: 'Links', value: 'links' },
                          { name: 'Emojis', value: 'emojis' },
                          { name: 'All', value: 'all' },
                          { name: 'Status', value: 'status' }
                      ]
                  },
                  { name: 'channel', description: 'The channel (defaults to current)', type: 7, required: false }
              ]
          });
          
          await client.application.commands.create({
              name: 'unignore',
              description: 'Re-enable automod filters for a channel (Admin Only)',
              default_member_permissions: '8',
              options: [
                  {
                      name: 'type',
                      description: 'What to unignore',
                      type: 3,
                      required: true,
                      choices: [
                          { name: 'Links', value: 'links' },
                          { name: 'Emojis', value: 'emojis' },
                          { name: 'All', value: 'all' }
                      ]
                  },
                  { name: 'channel', description: 'The channel (defaults to current)', type: 7, required: false }
              ]
          });

          console.log('✅ Automod Slash Commands Added');
      } catch (err) {
          console.error('❌ Failed to load Automod Slash Commands');
      }
  });

  // ==========================================
  // 2. HANDLE SLASH COMMANDS
  // ==========================================
  client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      const isOwner = interaction.user.id === OWNER_ID;
      const isAdmin = interaction.member.permissions.has('Administrator');
      
      if (['automod', 'ignore', 'unignore'].includes(interaction.commandName) && !isAdmin && !isOwner) {
          return interaction.reply({ content: '❌ You need **Administrator** permissions.', ephemeral: true }).catch(()=>{});
      }

      const settings = readSettings();
      const guildId = interaction.guild.id;

      // --- /automod ---
      if (interaction.commandName === 'automod') {
          const action = interaction.options.getString('action');
          if (!settings[guildId]) settings[guildId] = { automodEnabled: false };

          if (action === 'status') {
              const isEnabled = settings[guildId].automodEnabled !== false;
              return interaction.reply(`📢 **Server-Wide Automod Status:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`).catch(()=>{});
          }

          settings[guildId].automodEnabled = action === 'enable';
          saveSettings(settings);
          return interaction.reply(`${action === 'enable' ? '✅' : '🚫'} Automod has been **${action.toUpperCase()}D** for this entire server.`).catch(()=>{});
      }

      // --- /ignore and /unignore ---
      if (interaction.commandName === 'ignore' || interaction.commandName === 'unignore') {
          const type = interaction.options.getString('type');
          const channel = interaction.options.getChannel('channel') || interaction.channel;
          const channelId = channel.id;

          if (!settings[channelId]) settings[channelId] = { links: false, emojis: false };

          if (type === 'status' && interaction.commandName === 'ignore') {
              const linkStatus = settings[channelId].links ? '❌ Ignored' : '✅ Active';
              const emojiStatus = settings[channelId].emojis ? '❌ Ignored' : '✅ Active';
              return interaction.reply(`📢 **Automod Status for <#${channelId}>:**\n🔗 Links: ${linkStatus}\n😀 Emojis: ${emojiStatus}`).catch(()=>{});
          }

          const targetState = interaction.commandName === 'ignore';

          if (type === 'links' || type === 'all') settings[channelId].links = targetState;
          if (type === 'emojis' || type === 'all') settings[channelId].emojis = targetState;
          
          saveSettings(settings);
          const typeName = type === 'all' ? '**All** Automod filters are' : `Automod **${type}** filter is`;
          return interaction.reply(`${targetState ? '🚫' : '✅'} ${typeName} now **${targetState ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`).catch(()=>{});
      }
  });

  // ==========================================
  // 3. HANDLE PREFIX COMMANDS & SPAM FILTER
  // ==========================================
  client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim().toLowerCase();
    const isIgnoreCmd = content.startsWith('.ignore');
    const isUnignoreCmd = content.startsWith('.unignore');
    const isAutomodCmd = content.startsWith('.automod');

    // --- PREFIX LOGIC (Keeping it alive just in case!) ---
    if (isIgnoreCmd || isUnignoreCmd || isAutomodCmd) {
      try {
        const member = message.member || await message.guild.members.fetch(message.author.id);
        const isAdmin = member.permissions.has('Administrator');
        const isOwner = message.author.id === OWNER_ID;

        if (!isAdmin && !isOwner) {
          return message.reply('❌ You need **Administrator** permissions to use this command.');
        }

        const args = message.content.trim().split(/\s+/).slice(1); 
        const settings = readSettings();
        const guildId = message.guild.id;

        if (isAutomodCmd) {
          const action = args[0]?.toLowerCase();
          if (!action || !['enable', 'disable', 'status'].includes(action)) return message.reply('🔹 **Usage:** `.automod <enable/disable/status>`');
          
          if (!settings[guildId]) settings[guildId] = { automodEnabled: false };

          if (action === 'status') {
            const isEnabled = settings[guildId].automodEnabled !== false;
            return message.reply(`📢 **Server-Wide Automod Status:** ${isEnabled ? '🟢 Enabled' : '🔴 Disabled'}`);
          }
          if (action === 'enable') {
            settings[guildId].automodEnabled = true; saveSettings(settings);
            return message.reply('✅ Automod has been **ENABLED** for this entire server.');
          }
          if (action === 'disable') {
            settings[guildId].automodEnabled = false; saveSettings(settings);
            return message.reply('🚫 Automod has been **DISABLED** for this entire server.');
          }
          return;
        }

        const type = args[0]?.toLowerCase();
        if (!type || !['links', 'emojis', 'all', 'status'].includes(type)) {
          return message.reply(`🔹 **Usage:** \`${isIgnoreCmd ? '.ignore' : '.unignore'} <links/emojis/all/status> [#channel]\``);
        }

        const channel = message.mentions.channels.first() || message.channel;
        const channelId = channel.id;

        if (!settings[channelId]) settings[channelId] = { links: false, emojis: false };

        if (type === 'status') {
          const linkStatus = settings[channelId].links ? '❌ Ignored' : '✅ Active';
          const emojiStatus = settings[channelId].emojis ? '❌ Ignored' : '✅ Active';
          return message.reply(`📢 **Automod Status for <#${channelId}>:**\n🔗 Links: ${linkStatus}\n😀 Emojis: ${emojiStatus}`);
        }

        const targetState = isIgnoreCmd ? true : false;
        if (type === 'links' || type === 'all') settings[channelId].links = targetState;
        if (type === 'emojis' || type === 'all') settings[channelId].emojis = targetState;
        saveSettings(settings);
        
        const typeName = type === 'all' ? '**All** Automod filters are' : `Automod **${type}** filter is`;
        return message.reply(`${targetState ? '🚫' : '✅'} ${typeName} now **${targetState ? 'DISABLED' : 'ENABLED'}** in <#${channelId}>.`);
      } catch (err) {
        return message.reply(`❌ Command Error: \`${err.message}\``);
      }
    }

    // --- AUTOMOD SPAM FILTER ---
    if (content.startsWith('.')) return;

    let channelSettings = { links: false, emojis: false };
    let isServerEnabled = true; 

    try {
        const settings = readSettings();
        if (settings[message.guild.id] && settings[message.guild.id].automodEnabled === false) isServerEnabled = false;
        if (settings[message.channel.id]) channelSettings = settings[message.channel.id];
    } catch (e) {}

    if (!isServerEnabled) return;

    const rawLinks = message.content.match(linkPattern) || [];
    const links = rawLinks.filter(link => {
        const url = link.toLowerCase();
        const isSafeDomain = allowedDomains.some(domain => url.includes(domain));
        const isGifFile = url.endsWith('.gif');
        return !isSafeDomain && !isGifFile;
    });

    const emojis = message.content.match(emojiPattern) || [];

    const isLinkSpam = !channelSettings.links && links.length >= 1;
    const isEmojiSpam = !channelSettings.emojis && emojis.length >= 5;

    if (isLinkSpam || isEmojiSpam) {
      try { await message.delete(); } catch (err) {}

      if (isLinkSpam) {
        try {
          await message.member.timeout(10 * 60 * 1000, "Automod: Link Spam");
          await message.channel.send(`⚠️ ${message.author.toString()} has been timed out for 10 minutes for link spam.`);
        } catch (error) {
          await message.channel.send(`⚠️ I deleted a spam link from ${message.author.toString()}, but I cannot time them out because they possess Admin/Moderation powers.`).catch(() => {});
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
