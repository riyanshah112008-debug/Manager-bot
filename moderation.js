const { PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// A JSON file to save the toggle states so they survive Render restarts
const settingsPath = path.join(__dirname, 'punishmentSettings.json');

// Helper functions to read and write settings
function readPunishSettings() {
    try {
        if (!fs.existsSync(settingsPath)) {
            fs.writeFileSync(settingsPath, JSON.stringify({}));
        }
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (err) {
        console.error("Error reading punishment settings:", err);
        return {};
    }
}

function savePunishSettings(settings) {
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (err) {
        console.error("Error writing punishment settings:", err);
    }
}

module.exports = (client) => {
    const PREFIX = '.';

    // ==========================================
    // 1. MODERATION ACTIONS (Your original functions)
    // ==========================================
    client.autoKick = async function(member, reason = "Automated Kick") {
        if (!member.kickable) return false;
        
        try {
            await member.kick(reason);
            console.log(`[AutoMod] Kicked ${member.user.tag}: ${reason}`);
            return true;
        } catch (error) {
            console.error("Kick error:", error);
            return false;
        }
    };

    client.autoBan = async function(member, reason = "Automated Ban") {
        if (!member.bannable) return false;
        
        try {
            await member.ban({ reason: reason });
            console.log(`[AutoMod] Banned ${member.user.tag}: ${reason}`);
            return true;
        } catch (error) {
            console.error("Ban error:", error);
            return false;
        }
    };

    // ==========================================
    // 2. DISCORD SLASH COMMAND SYNC (MODULAR)
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'autokick',
                description: 'Enable or disable the autokick system for this server',
                default_member_permissions: '8', // Admin only
                options: [
                    {
                        name: 'action',
                        description: 'Enable, disable, or check status',
                        type: 3, // STRING
                        required: true,
                        choices: [
                            { name: 'Enable', value: 'enable' },
                            { name: 'Disable', value: 'disable' },
                            { name: 'Status', value: 'status' }
                        ]
                    }
                ]
            });

            await client.application.commands.create({
                name: 'autoban',
                description: 'Enable or disable the autoban system for this server',
                default_member_permissions: '8', // Admin only
                options: [
                    {
                        name: 'action',
                        description: 'Enable, disable, or check status',
                        type: 3, // STRING
                        required: true,
                        choices: [
                            { name: 'Enable', value: 'enable' },
                            { name: 'Disable', value: 'disable' },
                            { name: 'Status', value: 'status' }
                        ]
                    }
                ]
            });
            console.log('✅ Autokick/Autoban Slash Commands Added');
        } catch (error) {
            console.error('❌ Failed to add punish slash commands:', error);
        }
    });

    // ==========================================
    // 3. SLASH COMMAND LOGIC
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'autokick' || interaction.commandName === 'autoban') {
            const action = interaction.options.getString('action');
            const guildId = interaction.guildId;
            const type = interaction.commandName; // 'autokick' or 'autoban'
            
            const settings = readPunishSettings();
            if (!settings[guildId]) settings[guildId] = { autokick: false, autoban: false };

            if (action === 'status') {
                const status = settings[guildId][type] ? '🟢 Enabled' : '🔴 Disabled';
                return interaction.reply({ content: `📢 **${type} Status:** ${status}`, ephemeral: true });
            }

            const newState = action === 'enable';
            settings[guildId][type] = newState;
            savePunishSettings(settings);

            return interaction.reply({ content: `✅ **${type}** has been **${newState ? 'ENABLED' : 'DISABLED'}** for this server.`, ephemeral: true });
        }
    });

    // ==========================================
    // 4. PREFIX COMMAND LOGIC
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const args = message.content.trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const guildId = message.guild.id;

        if (command === PREFIX + 'autokick' || command === PREFIX + 'autoban') {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('❌ You need **Administrator** permissions to use this command.');
            }

            const action = args[0]?.toLowerCase();
            const type = command.replace(PREFIX, ''); // Gets 'autokick' or 'autoban'

            if (!action || !['enable', 'disable', 'status'].includes(action)) {
                return message.reply(`🔹 **Usage:** \`${command} <enable/disable/status>\``);
            }

            const settings = readPunishSettings();
            if (!settings[guildId]) settings[guildId] = { autokick: false, autoban: false };

            if (action === 'status') {
                const status = settings[guildId][type] ? '🟢 Enabled' : '🔴 Disabled';
                return message.reply(`📢 **${type} Status:** ${status}`);
            }

            const newState = action === 'enable';
            settings[guildId][type] = newState;
            savePunishSettings(settings);

            return message.reply(`✅ **${type}** has been **${newState ? 'ENABLED' : 'DISABLED'}** for this server.`);
        }
    });

    // ==========================================
    // 5. SUS PROFILE DETECTION (WITH SYSTEM GUARDS)
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        const guildId = member.guild.id;
        
        // 🛑 Read current server settings
        const settings = readPunishSettings();
        const isAutobanEnabled = settings[guildId] ? settings[guildId].autoban : false;
        const isAutokickEnabled = settings[guildId] ? settings[guildId].autokick : false;

        // If both systems are completely disabled, stop processing immediately to save memory
        if (!isAutobanEnabled && !isAutokickEnabled) return;

        // 1. Calculate how many days old the account is
        const accountAgeMs = Date.now() - member.user.createdAt.getTime();
        const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

        // 2. Check if they have a custom avatar
        const hasNoAvatar = member.user.avatarURL() === null;

        // 3. Check for scam keywords in their name
        const susKeywords = ["nitro", "free", "gift", "scam", "steam", "promo"];
        const lowerCaseName = member.user.username.toLowerCase();
        const hasSusName = susKeywords.some(keyword => lowerCaseName.includes(keyword));

        // --- THE PUNISHMENT LOGIC ---
        
        // BAN TRIGGER: Name has scam keywords OR (account is less than 1 day old AND has no avatar)
        if (isAutobanEnabled) {
            if (hasSusName || (accountAgeDays < 1 && hasNoAvatar)) {
                await client.autoBan(member, "Auto-Banned: Suspicious profile detected (Anti-Scam/Raid)");
                return; // Stop here so we don't also try to kick them
            }
        }

        // KICK TRIGGER: Account is just really new (under 3 days old)
        if (isAutokickEnabled) {
            if (accountAgeDays < 3) {
                await client.autoKick(member, "Auto-Kicked: Account is too new. Please try joining again in a few days.");
                return;
            }
        }
    });
};
                           
