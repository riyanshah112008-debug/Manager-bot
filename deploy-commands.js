require('dotenv').config();
const { 
    REST, 
    Routes, 
    PermissionFlagsBits, 
    ApplicationCommandType, 
    SlashCommandBuilder, 
    ChannelType 
} = require('discord.js');

const ADMIN = PermissionFlagsBits.Administrator.toString();
const MANAGE_MESSAGES = PermissionFlagsBits.ManageMessages.toString();
const MANAGE_ROLES = PermissionFlagsBits.ManageRoles.toString();
const MANAGE_GUILD = PermissionFlagsBits.ManageGuild.toString();
const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels.toString();
const MODERATE_MEMBERS = PermissionFlagsBits.ModerateMembers.toString();

const autoroleOptions = [
    { name: 'sticky_roles', type: 5, required: false, description: 'Enable or disable restoring previous roles on rejoin' }
];

for (let i = 1; i <= 24; i++) {
    autoroleOptions.push({ name: `role${i}`, type: 8, required: false, description: `Select role #${i} to add to the autorole list` });
}

const autoroleCommandDef = {
    name: 'autorole',
    description: 'Set up multiple autoroles for when members join',
    default_member_permissions: ADMIN,
    options: autoroleOptions
};

// ==========================================
// INITIALIZE COMMANDS ARRAY
// ==========================================
const commands = [
    // ================= TELEMETRY =================
    { name: 'telemetry', description: '📡 Bot Owner Only: Receive an immediate telemetry report in your DMs.', default_member_permissions: '8' },

    // ================= MUSIC & VOICE AI =================
    { name: 'callstarry', description: '📞 Call Starry for a private 1-on-1 human-like AI voice call! (Premium Only)' },
    { name: 'djpanel', description: '🎛️ Post the ultimate interactive Starry DJ & Voice Control Hub', default_member_permissions: '16' },
    { name: 'play', description: 'Play a song from SoundCloud or Spotify', options: [{ name: 'song', type: 3, required: true, description: 'Song name, SoundCloud URL, or Spotify URL' }] },
    { name: 'pause', description: 'Pause the currently playing song' },
    { name: 'resume', description: 'Resume the paused song' },
    { name: 'skip', description: 'Skip the current song' },
    { name: 'stop', description: 'Stop the music and clear the queue' },
    { name: 'queue', description: 'View and interactively manage the current music queue' },
    { name: 'volume', description: 'Change the music volume', options: [{ name: 'amount', type: 4, required: true, description: 'Volume from 1 to 100', min_value: 1, max_value: 100 }] },
    { name: 'autoplay', description: 'Toggles automatic music playback (Premium Only)' },

    // ================= SECURITY & VERIFICATION =================
    { name: 'verify-setup', description: 'Set up the server verification panel (Admins Only)', default_member_permissions: '8', options: [{ name: 'channel', type: 7, required: true, description: 'The channel to send the verification panel' }, { name: 'role', type: 8, required: true, description: 'The role to give users when they verify' }] }
];

// Safely Load Combined /social Master Command Payload
try {
    const { socialCommandPayload } = require('./src/modules/socialActions');
    if (socialCommandPayload) commands.push(socialCommandPayload);
} catch (err) {
    console.warn('⚠️ Could not load socialCommandPayload:', err.message);
}

// Safely Load Consolidated /mod and /automod Master Payloads
try {
    const { modMasterPayload, autoModMasterPayload } = require('./src/modules/moderation');
    if (modMasterPayload) commands.push(modMasterPayload);
    if (autoModMasterPayload) commands.push(autoModMasterPayload);
} catch (err) {
    console.warn('⚠️ Could not load master moderation payloads:', err.message);
}

// ==========================================
// GIVEAWAY SLASH COMMAND BUILDERS
// ==========================================
commands.push(
    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎉 Start a supreme giveaway with animated media banners!')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the giveaway (e.g. 10s, 10m, 2h, 1d)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('The prize being given away')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Number of winners (default: 1)')
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Target channel for the giveaway (default: current channel)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('reroll')
        .setDescription('🔄 Reroll a new winner for a concluded giveaway!')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The Message ID of the giveaway to reroll')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Number of winners to reroll (default: 1)')
                .setRequired(false)
        )
        .toJSON()
);

// ==========================================
// ECONOMY, XP & MASTER MANAGEMENT
// ==========================================
commands.push(
    { name: 'chest', description: 'Claim your timed loot chest for free XP and Credits!' },
    { name: 'shop', description: 'Open the server shop to buy exclusive roles with your Credits!' },
    { name: 'prestige', description: 'Reset your level to gain Prestige 👑 and permanent bonus multipliers!' },
    { name: 'pet', description: 'Manage your virtual pets!', options: [{ name: 'status', description: 'Check your active pet and its happiness level', type: 1 }, { name: 'equip', description: 'Equip a different pet from your inventory', type: 1, options: [{ name: 'name', description: 'The exact name of the pet you want to equip', type: 3, required: true }] }] },
    { name: 'shop-admin', description: 'Manage the server economy shop (Admins Only)', default_member_permissions: '8', options: [{ name: 'add-role', description: 'Add a role to the shop', type: 1, options: [{ name: 'role', description: 'The role to sell', type: 8, required: true }, { name: 'price', description: 'Price in credits', type: 10, required: true }, { name: 'description', description: 'Item description', type: 3, required: true }] }, { name: 'add-pet', description: 'Add a pet to the shop', type: 1, options: [{ name: 'name', description: 'Name of the pet', type: 3, required: true }, { name: 'price', description: 'Price in credits', type: 10, required: true }, { name: 'description', description: 'Pet description', type: 3, required: true }, { name: 'emoji', description: 'Emoji for the pet', type: 3, required: true }] }] },
    { name: 'chest-setup', description: 'Enable or disable automatic chest drops in a channel (Admins Only)', default_member_permissions: '8', options: [{ name: 'enable', description: 'Enable chest drops in a specific channel', type: 1, options: [{ name: 'channel', description: 'Select the channel', type: 7, required: true }] }, { name: 'disable', description: 'Disable chest drops in a specific channel', type: 1, options: [{ name: 'channel', description: 'Select the channel', type: 7, required: true }] }] },
    
    // Updated /setup-starry with prompt parameter
    { 
        name: 'setup-starry', 
        description: '🧠 AI MASTER COMMAND: Scans, builds, & configures custom server layout + infrastructure.', 
        default_member_permissions: '8',
        options: [
            {
                name: 'prompt',
                type: 3, // String
                required: false,
                description: 'Describe your server theme (e.g., "Anime Chill Server", "Cyberpunk Gaming Community")'
            }
        ]
    },
    
    { name: 'ahelp', description: 'Displays the complete Admin & Moderation Command Menu', default_member_permissions: '8192' },
    { name: 'emergency-lockdown', description: '🚨 EMERGENCY: Freezes the entire server. Nobody can type or join VC. (Admins Only)', default_member_permissions: '8' },
    { name: 'emergency-secure', description: '🛡️ EMERGENCY: Strips all dangerous permissions from all roles. (Admins Only)', default_member_permissions: '8' },
    { name: 'emergency-unban', description: '🏥 EMERGENCY: Unbans every single user in the server ban list. (Admins Only)', default_member_permissions: '8' },
    { name: 'emergency-nuke', description: '⚠️ EMERGENCY: Deletes all channels except General. (Admins Only)', default_member_permissions: '8' },
    { name: 'set-name', description: 'Change the bot\'s trigger word/name for this server (Admins Only)', default_member_permissions: '8', options: [{ name: 'name', description: 'The new trigger word (e.g., Jarvis, HelperBot)', type: 3, required: true }] },
    { name: 'boost-setup', description: 'Set the channel for server boost announcements (Admins Only)', default_member_permissions: '8', options: [{ name: 'channel', type: 7, required: true, description: 'The channel to send boost messages in' }] },
    { name: 'setup-server', description: 'Automatically generates a professional server layout (Roles, Categories, Channels)!', default_member_permissions: '8' },
    { name: 'modpanel', description: 'Open the interactive moderation dashboard', default_member_permissions: MODERATE_MEMBERS, options: [{ name: 'user', type: 6, required: true, description: 'The user to moderate' }] },
    { name: 'devpanel', description: '💻 Open the interactive developer control panel with clickable buttons' },
    autoroleCommandDef
);

// ==========================================
// ROLES, SETUP & UTILITIES
// ==========================================
commands.push(
    { name: 'role', description: 'Manage server roles', default_member_permissions: MANAGE_ROLES, options: [{ name: 'create', type: 1, description: 'Create a role', options: [{ name: 'name', type: 3, required: true, description: 'Role name' }, { name: 'color', type: 3, required: false, description: 'Hex color, for example #FF0000' }] }, { name: 'delete', type: 1, description: 'Delete a role', options: [{ name: 'role', type: 8, required: true, description: 'Role to delete' }] }, { name: 'give', type: 1, description: 'Give a role to a member', options: [{ name: 'user', type: 6, required: true, description: 'Member' }, { name: 'role', type: 8, required: true, description: 'Role to give' }] }, { name: 'remove', type: 1, description: 'Remove a role from a member', options: [{ name: 'user', type: 6, required: true, description: 'Member' }, { name: 'role', type: 8, required: true, description: 'Role to remove' }] }] },
    { name: 'rr', description: 'Manage reaction-role panels', default_member_permissions: ADMIN, options: [{ name: 'spawn', type: 1, description: 'Create a reaction-role panel', options: [{ name: 'channel', type: 7, required: true, description: 'Channel for the panel' }, { name: 'title', type: 3, required: true, description: 'Panel title' }, { name: 'text', type: 3, required: true, description: 'Panel text' }] }, { name: 'add', type: 1, description: 'Add a role to a panel', options: [{ name: 'channel', type: 7, required: true, description: 'Channel containing the panel' }, { name: 'message_id', type: 3, required: true, description: 'Panel message ID' }, { name: 'role', type: 8, required: true, description: 'Role to assign' }, { name: 'emoji', type: 3, required: true, description: 'Reaction emoji' }] }] },

    // ================= SETUP, UTILITIES & PREMIUM =================
    { name: 'setlogs', description: 'Set the server log channel', default_member_permissions: ADMIN, options: [{ name: 'channel', type: 7, required: true, description: 'Channel for logs' }] },
    { name: 'setlevelchannel', description: 'Set a specific channel for level-up notifications', default_member_permissions: ADMIN, options: [{ name: 'channel', type: 7, required: true, description: 'The channel to send level-up alerts to' }] },
    { name: 'setupvc', description: 'Configure a join-to-create voice channel', default_member_permissions: MANAGE_CHANNELS, options: [{ name: 'channel', type: 7, required: true, description: 'Voice channel to use as the hub' }] },
    { name: 'setupstats', description: 'Create live server-stat channels', default_member_permissions: ADMIN },
    { name: 'setupwelcome', description: 'Set the welcome-message channel', default_member_permissions: MANAGE_GUILD, options: [{ name: 'channel', type: 7, required: true, description: 'Welcome channel' }] },
    { name: 'setupgoodbye', description: 'Set the goodbye-message channel', default_member_permissions: MANAGE_GUILD, options: [{ name: 'channel', type: 7, required: true, description: 'Goodbye channel' }] },
    { name: 'setupcount', description: 'Set up the counting game', default_member_permissions: ADMIN, options: [{ name: 'channel', type: 7, required: true, description: 'Counting-game channel' }] },
    { name: 'ticketsetup', description: 'Create the support-ticket panel', default_member_permissions: MANAGE_CHANNELS },
    { name: 'applysetup', description: 'Create the application panel', default_member_permissions: MANAGE_CHANNELS },
    { name: 'toggleleveling', description: 'Enable or disable the leveling system', default_member_permissions: ADMIN, options: [{ name: 'state', type: 3, required: false, description: 'Desired state; omit to toggle', choices: [{ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }] }] },
    { name: 'rank', description: 'Show a member’s rank', options: [{ name: 'target', type: 6, required: false, description: 'Member; defaults to you' }] },
    { name: 'messages', description: 'Show a member’s message count', options: [{ name: 'target', type: 6, required: false, description: 'Member; defaults to you' }] },
    { name: 'leaderboard', description: '🏆 Display top server rankings for Reputation and XP' },
    { name: 'rep', description: '+1 Give reputation to a helpful server member', options: [{ name: 'user', type: 6, required: true, description: 'Member receiving reputation' }] },
    { name: 'checkrep', description: "⭐ Check your or another member's total reputation score", options: [{ name: 'user', type: 6, required: false, description: 'Member; defaults to you' }] },
    { name: 'afk', description: 'Set your AFK status', options: [{ name: 'reason', type: 3, required: false, description: 'AFK reason' }] },
    { name: 'tod', description: 'Play Truth or Dare', options: [{ name: 'choice', type: 3, required: true, description: 'Choose Truth or Dare', choices: [{ name: 'Truth', value: 'truth' }, { name: 'Dare', value: 'dare' }] }] },
    { name: 'whois', description: 'Show detailed information about a user', options: [{ name: 'target', type: 6, required: false, description: 'User; defaults to you' }] },
    { name: 'translate', description: 'Translate text into another language', options: [{ name: 'language', type: 3, required: true, description: 'Target language or language code' }, { name: 'text', type: 3, required: true, description: 'Text to translate' }] },
    { name: 'steal', description: 'Import one or more custom emojis', default_member_permissions: MANAGE_GUILD, options: [{ name: 'emojis', type: 3, required: true, description: 'Custom emoji(s) or emoji URL(s)' }] },
    { name: 'help', description: 'Show the bot command list' },
    { name: 'ping', description: 'Check bot latency' },
    { name: 'Steal Emojis', type: ApplicationCommandType.Message },

    // ================= PREMIUM & TRACKER =================
    { 
        name: 'activatepremium', 
        description: 'Activate Premium for a server or user with optional duration', 
        options: [
            { name: 'server_id', type: 3, required: false, description: 'Server ID or User ID (Leave blank for current server)' },
            { name: 'duration', type: 3, required: false, description: 'Duration (e.g. 7d, 30d, 90d, 1y, lifetime). Default: Lifetime' }
        ] 
    },
    { name: 'deactivatepremium', description: 'Deactivate Premium for a server', options: [{ name: 'server_id', type: 3, required: false, description: 'Server ID or User ID' }] },
    { name: 'removepremium', description: 'Alias for deactivating Premium', options: [{ name: 'server_id', type: 3, required: false, description: 'Server ID or User ID' }] },
    { name: 'premiumcheck', description: 'Check whether this server has Premium' },
    { 
        name: 'tracker', 
        description: 'Manage the 14-day inactivity tracker and historical scraper', 
        default_member_permissions: MANAGE_GUILD, 
        options: [
            { 
                name: 'setup', 
                description: 'Setup the 14-day inactivity log channel & preview embeds', 
                type: 1, 
                options: [{ name: 'channel', type: 7, required: true, description: 'The channel to send 14-day inactivity alerts to' }] 
            }, 
            { 
                name: 'scrape', 
                description: 'Premium: Scrape historical messages into MongoDB', 
                type: 1, 
                options: [
                    { name: 'private_channel', type: 7, required: true, description: 'The private channel for the live scraping dashboard' },
                    { name: 'after_days', type: 4, required: false, description: 'Fetch data only from last X days (e.g. 7, 30, 90). Leave blank for full scrape.', min_value: 1 }
                ] 
            }
        ] 
    },

    // ================= SERVER DIRECTORY COMMANDS =================
    { name: 'set-listing', description: 'Configure how your server appears on the Starry Server Web List!', default_member_permissions: ADMIN, options: [{ name: 'description', type: 3, required: true, description: 'A short description of your server (Max 150 chars)' }, { name: 'tags', type: 3, required: false, description: 'Comma-separated tags (e.g., Gaming, Anime, Chill)' }] },
    { name: 'bump', description: 'Bump this server to the top of the Starry Global Web List!' },
    { name: 'autobump', description: '💎 Premium: Enable or disable 24/7 automatic bumping every 2 hours!', default_member_permissions: ADMIN },
    { name: 'bump-setup', description: 'Configure the auto-bump reminder system.', default_member_permissions: ADMIN, options: [{ name: 'ping_role', type: 8, required: false, description: 'The role to ping when the 2-hour cooldown is over' }, { name: 'channel', type: 7, required: false, description: 'The channel to send the reminder in' }] }
);

// ==========================================
// DEDUPLICATION & DEPLOYMENT ENGINE
// ==========================================
const commandMap = new Map();
commands.forEach(cmd => {
    if (cmd && cmd.name) {
        commandMap.set(cmd.name, cmd);
    }
});

const finalPayload = Array.from(commandMap.values());

async function deployCommands() {
    const token = process.env.TOKEN;
    let clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!token) {
        throw new Error('🛑 CRITICAL: TOKEN environment variable must be set before deploying commands.');
    }

    if (!clientId) {
        try {
            clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf-8');
            console.log(`ℹ️ Automatically derived Client ID from Token: ${clientId}`);
        } catch (e) {
            throw new Error('🛑 Could not parse CLIENT_ID from TOKEN. Please set CLIENT_ID explicitly.');
        }
    }
    
    const rest = new REST({ version: '10' }).setToken(token);

    const isGlobal = process.argv.includes('--global');
    const isLocal = guildId && guildId !== 'PASTE_YOUR_SERVER_ID_HERE' && !isGlobal;

    try {
        if (isLocal) {
            console.log(`🧹 Clearing stale global commands to resolve duplicates...`);
            await rest.put(Routes.applicationCommands(clientId), { body: [] }); // Wipes global commands to prevent duplicates

            console.log(`⚡ [INSTANT SYNC] Deploying ${finalPayload.length} commands to Guild ID: ${guildId}`);
            const result = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: finalPayload });
            console.log(`✅ Successfully synchronized ${result.length} commands with Test Guild!`);
            return result;
        } else {
            console.log(`🌍 [GLOBAL SYNC] Deploying ${finalPayload.length} application commands globally...`);
            const result = await rest.put(Routes.applicationCommands(clientId), { body: finalPayload });
            console.log(`✅ Successfully registered ${result.length} commands globally!`);
            return result;
        }
    } catch (error) {
        console.error('❌ Discord API Rejected Command Payload:');
        if (error.rawError && error.rawError.errors) {
            console.error(JSON.stringify(error.rawError.errors, null, 2));
        } else {
            console.error(error);
        }
        throw error;
    }
}

if (require.main === module) {
    deployCommands().catch((error) => {
        process.exitCode = 1;
    });
}

module.exports = { commands: finalPayload, deployCommands };
