const { PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

// 👑 THE MASTER KEY: Paste your personal Discord User ID here
const OWNER_ID = '1465049039153135639'; 

const settingsPath = path.join(__dirname, 'punishmentSettings.json');

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
    // 1. MODERATION ACTIONS
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
    // 2. DISCORD SLASH COMMAND SYNC
    // ==========================================
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'autokick',
                description: 'Enable or disable the autokick system for this server',
                // Removed default_member_permissions so the Owner can always see it
                options: [
                    {
                        name: 'action',
                        description: 'Enable, disable, or check status',
                        type: 3, 
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
                // Removed default_member_permissions so the Owner can always see it
                options: [
                    {
                        name: 'action',
                        description: 'Enable, disable, or check status',
                        type: 3, 
                        required: true,
                        choices: [
                            { name: 'Enable', value: 'enable' },
                            { name: 'Disable', value: 'disable' },
                            { name: 'Status', value: 'status' }
                        ]
                    }
                ]
            });
            console.log('✅ Autokick/Autoban Slash Commands Added (Owner Bypass Enabled)');
        } catch (error) {
            console.error('❌ Failed to add punish slash commands:', error);
        }
    });

    // ==========================================
    // 3. SLASH COMMAND LOGIC (With Master Key)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'autokick' || interaction.commandName === 'autoban') {
            
            // 👑 THE GUARD: Check if the user is an Admin OR the Bot Owner
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
            const isOwner = interaction.user.id === OWNER_ID;

            if (!isAdmin && !isOwner) {
                return interaction.reply({ content: '❌ You need **Administrator** permissions to use this command.', ephemeral: true });
            }

            const action = interaction.options.getString('action');
            const guildId = interaction.guildId;
            const type = interaction.commandName; 
            
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
    // 4. PREFIX COMMAND LOGIC (With Master Key)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const args = message.content.trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const guildId = message.guild.id;

        if (command === PREFIX + 'autokick' || command === PREFIX + 'autoban') {
            
            // 👑 THE GUARD: Check if the user is an Admin OR the Bot Owner
            const isAdmin = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
            const isOwner = message.author.id === OWNER_ID;

            if (!isAdmin && !isOwner) {
                return message.reply('❌ You need **Administrator** permissions to use this command.');
            }

            const action = args[0]?.toLowerCase();
            const type = command.replace(PREFIX, ''); 

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
    // 5. SUS PROFILE DETECTION
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        const guildId = member.guild.id;
        
        const settings = readPunishSettings();
        const isAutobanEnabled = settings[guildId] ? settings[guildId].autoban : false;
        const isAutokickEnabled = settings[guildId] ? settings[guildId].autokick : false;

        if (!isAutobanEnabled && !isAutokickEnabled) return;

        const accountAgeMs = Date.now() - member.user.createdAt.getTime();
        const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
        const hasNoAvatar = member.user.avatarURL() === null;
        const susKeywords = ["nitro", "free", "gift", "scam", "steam", "promo"];
        const lowerCaseName = member.user.username.toLowerCase();
        const hasSusName = susKeywords.some(keyword => lowerCaseName.includes(keyword));

        if (isAutobanEnabled) {
            if (hasSusName || (accountAgeDays < 1 && hasNoAvatar)) {
                await client.autoBan(member, "Auto-Banned: Suspicious profile detected (Anti-Scam/Raid)");
                return; 
            }
        }

        if (isAutokickEnabled) {
            if (accountAgeDays < 3) {
                await client.autoKick(member, "Auto-Kicked: Account is too new. Please try joining again in a few days.");
                return;
            }
        }
    });
};
            
