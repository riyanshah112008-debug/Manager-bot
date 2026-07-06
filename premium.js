const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const PREFIX = '.';
    const premiumFilePath = path.join(__dirname, 'premium.json');
    let premiumData = { servers: [] };

    // ==========================================
    // 1. GLOBAL PREMIUM ENGINE
    // ==========================================
    function loadPremium() {
        if (fs.existsSync(premiumFilePath)) {
            premiumData = JSON.parse(fs.readFileSync(premiumFilePath, 'utf8'));
        } else {
            fs.writeFileSync(premiumFilePath, JSON.stringify(premiumData, null, 2));
        }
    }

    function savePremium() {
        fs.writeFileSync(premiumFilePath, JSON.stringify(premiumData, null, 2));
        // Keep the global cache synced instantly
        client.premiumServers = new Set(premiumData.servers); 
    }

    loadPremium();

    // 🌟 ATTACH TO CLIENT: Now ANY file can instantly check premium status
    client.premiumServers = new Set(premiumData.servers);
    client.isPremium = (guildId) => client.premiumServers.has(guildId);

    // ==========================================
    // 2. ANTI-RAID (PREMIUM ONLY)
    // ==========================================
    const raidTracker = new Map();

    function antiRaid(message) {
        if (!message.guild || message.author.bot) return;
        // Do not kick administrators
        if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return; 

        const key = `${message.guild.id}-${message.author.id}`;
        const now = Date.now();

        if (!raidTracker.has(key)) raidTracker.set(key, []);

        const timestamps = raidTracker.get(key);
        timestamps.push(now);

        // Keep only messages from the last 5 seconds
        const recent = timestamps.filter((t) => now - t < 5000);
        raidTracker.set(key, recent);

        if (recent.length > 5) {
            message.member.kick('Anti-Raid: Spamming messages too quickly').catch(() => {});
            message.channel.send(`🛡️ **Anti-Raid:** Kicked <@${message.author.id}> for spamming.`).catch(() => {});
            raidTracker.delete(key);
        }
    }

    // ==========================================
    // 3. COMMAND HANDLER
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const guildId = message.guild?.id;
        
        // Run Premium Anti-Raid if the server has premium
        if (guildId && client.isPremium(guildId)) {
            antiRaid(message);
        }

        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        // Pulling Owner ID securely from .env instead of config.json
        const isOwner = message.author.id === process.env.OWNER_ID; 

        // --- PUBLIC COMMANDS ---
        if (command === 'premiumcheck') {
            if (!guildId) return message.reply('❌ Use this command in a server.').catch(() => {});
            
            const embed = new EmbedBuilder()
                .setColor(client.isPremium(guildId) ? '#FFD700' : '#2b2d31')
                .setTitle('⭐ Premium Status')
                .setDescription(client.isPremium(guildId) 
                    ? '✅ **Premium is ACTIVE for this server!** All advanced features and Starry AI are unlocked.' 
                    : '❌ **Premium is NOT active.** Upgrade to unlock Starry AI and advanced protections.')
                .setTimestamp();
                
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        if (command === 'premium') {
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('⭐ Starry Premium Features')
                .setDescription('Upgrade your server to unlock the full power of Starry!')
                .addFields(
                    { name: '✨ Starry AI', value: 'Chat naturally with Starry and generate stunning AI images!' },
                    { name: '🛡️ Advanced Anti-Raid', value: 'Instant spam detection and auto-kicks for raiders.' },
                    { name: '🎵 24/7 High-Quality Music', value: 'Uninterrupted audio features.' },
                    { name: '⚡ Maximum Processing Speed', value: 'Priority command routing.' }
                )
                .setFooter({ text: 'Contact the bot owner to activate Premium.' })
                .setTimestamp();
                
            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        // --- OWNER ONLY COMMANDS ---
        if (command === 'activatepremium') {
            if (!isOwner) return message.reply('❌ Only the bot owner can use this command.').catch(() => {});

            const targetServer = args[0];
            if (!targetServer) return message.reply('🔹 **Usage:** `.activatepremium <Server_ID>`').catch(() => {});

            if (!premiumData.servers.includes(targetServer)) {
                premiumData.servers.push(targetServer);
                savePremium();
                return message.reply(`✅ **SUCCESS:** Premium has been enabled for server \`${targetServer}\`!`).catch(() => {});
            } else {
                return message.reply('⚠️ That server already has Premium activated.').catch(() => {});
            }
        }

        if (command === 'removepremium') {
            if (!isOwner) return message.reply('❌ Only the bot owner can use this command.').catch(() => {});

            const targetServer = args[0];
            if (!targetServer) return message.reply('🔹 **Usage:** `.removepremium <Server_ID>`').catch(() => {});

            if (premiumData.servers.includes(targetServer)) {
                premiumData.servers = premiumData.servers.filter((id) => id !== targetServer);
                savePremium();
                return message.reply(`❌ **REVOKED:** Premium has been removed for server \`${targetServer}\`.`).catch(() => {});
            } else {
                return message.reply('⚠️ That server does not currently have Premium.').catch(() => {});
            }
        }
    });
};
          
