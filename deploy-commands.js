require('dotenv').config();
const { REST, Routes, PermissionFlagsBits, ApplicationCommandType } = require('discord.js');

const ADMIN = PermissionFlagsBits.Administrator.toString();
const MANAGE_MESSAGES = PermissionFlagsBits.ManageMessages.toString();
const MANAGE_ROLES = PermissionFlagsBits.ManageRoles.toString();
const MANAGE_GUILD = PermissionFlagsBits.ManageGuild.toString();
const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels.toString();
const MODERATE_MEMBERS = PermissionFlagsBits.ModerateMembers.toString();

const commands = [
    // ================= MUSIC =================
    { name: 'play', description: 'Play a song from SoundCloud or Spotify', options: [
        { name: 'song', type: 3, required: true, description: 'Song name, SoundCloud URL, or Spotify URL' }
    ] },
    { name: 'pause', description: 'Pause the currently playing song' },
    { name: 'resume', description: 'Resume the paused song' },
    { name: 'skip', description: 'Skip the current song' },
    { name: 'stop', description: 'Stop the music and clear the queue' },
    { name: 'queue', description: 'View the current music queue' },
    { name: 'volume', description: 'Change the music volume', options: [
        { name: 'amount', type: 4, required: true, description: 'Volume from 1 to 100', min_value: 1, max_value: 100 }
    ] },

    // ================= UNIFIED MODERATION =================
    {
        name: 'moderate',
        description: 'Configure moderation and protection modules',
        default_member_permissions: ADMIN,
        options: [
            {
                name: 'toggle', type: 1, description: 'Enable or disable a moderation module', options: [
                    { name: 'module', type: 3, required: true, description: 'Module to configure', choices: [
                        { name: 'Wick anti-nuke', value: 'wick' },
                        { name: 'Beemo anti-raid', value: 'beemo' },
                        { name: 'AltDentifier', value: 'altdentifier' },
                        { name: 'Dyno/Carl automod', value: 'dyno' }
                    ] },
                    { name: 'status', type: 5, required: true, description: 'Whether the module should be enabled' }
                ]
            },
            {
                name: 'autokick', type: 1, description: 'Configure automatic kicks for new accounts', options: [
                    { name: 'enabled', type: 5, required: true, description: 'Enable or disable automatic kicks' },
                    { name: 'account_age', type: 4, required: false, description: 'Minimum account age in days', min_value: 0 }
                ]
            },
            {
                name: 'autoban', type: 1, description: 'Enable or disable automatic bans', options: [
                    { name: 'enabled', type: 5, required: true, description: 'Enable or disable automatic bans' }
                ]
            },
            {
                name: 'ownerbypass', type: 1, description: 'Configure owner immunity', options: [
                    { name: 'bypass', type: 5, required: true, description: 'Whether server owners bypass protection checks' }
                ]
            }
        ]
    },
    { name: 'modpanel', description: 'Open the interactive moderation dashboard', default_member_permissions: MODERATE_MEMBERS, options: [
        { name: 'user', type: 6, required: true, description: 'The user to moderate' }
    ] },
    { name: 'lockdown', description: 'Lock or unlock the current channel', default_member_permissions: ADMIN, options: [
        { name: 'action', type: 3, required: true, description: 'Lock or unlock the channel', choices: [
            { name: 'Lock', value: 'lock' }, { name: 'Unlock', value: 'unlock' }
        ] }
    ] },
    { name: 'clear', description: 'Delete up to 100 recent messages', default_member_permissions: MANAGE_MESSAGES, options: [
        { name: 'amount', type: 4, required: true, description: 'Number of messages to delete', min_value: 1, max_value: 100 }
    ] },
    // ================= DEVELOPER PANEL =================
    {
        name: 'devpanel',
        description: '💻 Developer-only control panel',
        options: [
            { name: 'sysinfo', type: 1, description: 'View bot system stats' },
            { name: 'servers', type: 1, description: 'List all servers the bot is in' },
            { name: 'serverdump', type: 1, description: 'Get a text file dump of the current server' },
            { name: 'restart', type: 1, description: 'Reboot the bot process' },
            { name: 'emergencyleave', type: 1, description: 'Force the bot to leave the current server' },
            { 
                name: 'broadcast', 
                type: 1, 
                description: 'Send a message to all servers', 
                options: [
                    { name: 'message', type: 3, required: true, description: 'Message to send' }
                ] 
            },
            { 
                name: 'eval', 
                type: 1, 
                description: 'Run raw JavaScript code', 
                options: [
                    { name: 'code', type: 3, required: true, description: 'JS code to execute' }
                ] 
            },
            { 
                name: 'blacklist', 
                type: 1, 
                description: 'Toggle user blacklist', 
                options: [
                    { name: 'user_id', type: 3, required: true, description: 'Discord User ID' }
                ] 
            },
            { 
                name: 'leaveserver', 
                type: 1, 
                description: 'Force leave a specific server', 
                options: [
                    { name: 'server_id', type: 3, required: true, description: 'Discord Server ID' }
                ] 
            },
            { 
                name: 'setstatus', 
                type: 1, 
                description: 'Change bot status', 
                options: [
                    { name: 'status_text', type: 3, required: true, description: 'New status text' }
                ] 
            }
        ]
    },   // <--- ✅ Added the crucial missing comma right here!

    // ================= WARNINGS =================
    { name: 'warn', description: 'Warn a member', default_member_permissions: MANAGE_MESSAGES, options: [
        { name: 'target', type: 6, required: true, description: 'Member to warn' },
        { name: 'reason', type: 3, required: true, description: 'Reason for the warning' }
    ] },
    { name: 'warnings', description: 'View a member’s warnings', default_member_permissions: MANAGE_MESSAGES, options: [
        { name: 'target', type: 6, required: true, description: 'Member whose warnings should be shown' }
    ] },
    { name: 'delwarn', description: 'Delete a warning by its ID', default_member_permissions: MANAGE_MESSAGES, options: [
        { name: 'id', type: 4, required: true, description: 'Warning ID' }
    ] },
    // ================= AUTOMOD =================
    { name: 'automod', description: 'Configure the server-wide automod switch', default_member_permissions: ADMIN, options: [
        { name: 'action', type: 3, required: true, description: 'Automod action', choices: [
            { name: 'Enable', value: 'enable' }, { name: 'Disable', value: 'disable' }, { name: 'Status', value: 'status' }
        ] }
    ] },
    { name: 'ignore', description: 'Disable automod filters in a channel', default_member_permissions: ADMIN, options: [
        { name: 'type', type: 3, required: true, description: 'Filter to ignore', choices: [
            { name: 'Links', value: 'links' }, { name: 'Emojis', value: 'emojis' }, { name: 'All', value: 'all' }, { name: 'Status', value: 'status' }
        ] },
        { name: 'channel', type: 7, required: false, description: 'Channel; defaults to the current channel' }
    ] },
    { name: 'unignore', description: 'Re-enable automod filters in a channel', default_member_permissions: ADMIN, options: [
        { name: 'type', type: 3, required: true, description: 'Filter to re-enable', choices: [
            { name: 'Links', value: 'links' }, { name: 'Emojis', value: 'emojis' }, { name: 'All', value: 'all' }
        ] },
        { name: 'channel', type: 7, required: false, description: 'Channel; defaults to the current channel' }
    ] },
    { name: 'mediaonly', description: 'Configure media-only mode for a channel', default_member_permissions: ADMIN, options: [
        { name: 'action', type: 3, required: true, description: 'Media-only action', choices: [
            { name: 'Enable', value: 'enable' }, { name: 'Disable', value: 'disable' }, { name: 'Status', value: 'status' }
        ] },
        { name: 'channel', type: 7, required: false, description: 'Channel; defaults to the current channel' }
    ] },
    { name: 'sussetup', description: 'Configure suspicious-account protection', default_member_permissions: ADMIN, options: [
        { name: 'enabled', type: 5, required: true, description: 'Enable or disable the module' },
        { name: 'threshold', type: 4, required: true, description: 'Account-age threshold in days', min_value: 0 },
        { name: 'action', type: 3, required: true, description: 'Action to take', choices: [
            { name: 'Warn', value: 'warn' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' }
        ] }
    ] },
    { name: 'protect', description: 'Protect a member from staff actions', options: [
        { name: 'user', type: 6, required: true, description: 'Member to protect' }
    ] },
    { name: 'unprotect', description: 'Remove a member’s protection', options: [
        { name: 'user', type: 6, required: true, description: 'Member to unprotect' }
    ] },

    // ================= ROLES =================
    { name: 'role', description: 'Manage server roles', default_member_permissions: MANAGE_ROLES, options: [
        { name: 'create', type: 1, description: 'Create a role', options: [
            { name: 'name', type: 3, required: true, description: 'Role name' },
            { name: 'color', type: 3, required: false, description: 'Hex color, for example #FF0000' }
        ] },
        { name: 'delete', type: 1, description: 'Delete a role', options: [
            { name: 'role', type: 8, required: true, description: 'Role to delete' }
        ] },
        { name: 'give', type: 1, description: 'Give a role to a member', options: [
            { name: 'user', type: 6, required: true, description: 'Member' },
            { name: 'role', type: 8, required: true, description: 'Role to give' }
        ] },
        { name: 'remove', type: 1, description: 'Remove a role from a member', options: [
            { name: 'user', type: 6, required: true, description: 'Member' },
            { name: 'role', type: 8, required: true, description: 'Role to remove' }
        ] }
    ] },
    { name: 'rr', description: 'Manage reaction-role panels', default_member_permissions: ADMIN, options: [
        { name: 'spawn', type: 1, description: 'Create a reaction-role panel', options: [
            { name: 'channel', type: 7, required: true, description: 'Channel for the panel' },
            { name: 'title', type: 3, required: true, description: 'Panel title' },
            { name: 'text', type: 3, required: true, description: 'Panel text' }
        ] },
        { name: 'add', type: 1, description: 'Add a role to a panel', options: [
            { name: 'channel', type: 7, required: true, description: 'Channel containing the panel' },
            { name: 'message_id', type: 3, required: true, description: 'Panel message ID' },
            { name: 'role', type: 8, required: true, description: 'Role to assign' },
            { name: 'emoji', type: 3, required: true, description: 'Reaction emoji' }
        ] }
    ] },
    // ================= SETUP / SERVER FEATURES =================
    { name: 'setlogs', description: 'Set the server log channel', default_member_permissions: ADMIN, options: [
        { name: 'channel', type: 7, required: true, description: 'Channel for logs' }
    ] },
    { name: 'setupvc', description: 'Configure a join-to-create voice channel', default_member_permissions: MANAGE_CHANNELS, options: [
        { name: 'channel', type: 7, required: true, description: 'Voice channel to use as the hub' }
    ] },
    { name: 'setupstats', description: 'Create live server-stat channels', default_member_permissions: ADMIN },
    { name: 'setupwelcome', description: 'Set the welcome-message channel', default_member_permissions: MANAGE_GUILD, options: [
        { name: 'channel', type: 7, required: true, description: 'Welcome channel' }
    ] },
    { name: 'setupgoodbye', description: 'Set the goodbye-message channel', default_member_permissions: MANAGE_GUILD, options: [
        { name: 'channel', type: 7, required: true, description: 'Goodbye channel' }
    ] },
    { name: 'setupcount', description: 'Set up the counting game', default_member_permissions: ADMIN, options: [
        { name: 'channel', type: 7, required: true, description: 'Counting-game channel' }
    ] },
    { name: 'ticketsetup', description: 'Create the support-ticket panel', default_member_permissions: MANAGE_CHANNELS },
    { name: 'applysetup', description: 'Create the application panel', default_member_permissions: MANAGE_CHANNELS },
    { name: 'giveaway', description: 'Start a giveaway', default_member_permissions: ADMIN, options: [
        { name: 'duration', type: 3, required: true, description: 'Duration, for example 10m, 2h, or 1d' },
        { name: 'winners', type: 4, required: true, description: 'Number of winners', min_value: 1 },
        { name: 'prize', type: 3, required: true, description: 'Giveaway prize' }
    ] },
    // ================= LEVELING / COMMUNITY =================
    { name: 'toggleleveling', description: 'Enable or disable the leveling system', default_member_permissions: ADMIN, options: [
        { name: 'state', type: 3, required: false, description: 'Desired state; omit to toggle', choices: [
            { name: 'On', value: 'on' }, { name: 'Off', value: 'off' }
        ] }
    ] },
    { name: 'rank', description: 'Show a member’s rank', options: [
        { name: 'target', type: 6, required: false, description: 'Member; defaults to you' }
    ] },
    { name: 'messages', description: 'Show a member’s message count', options: [
        { name: 'target', type: 6, required: false, description: 'Member; defaults to you' }
    ] },
    { name: 'leaderboard', description: 'Show the server leaderboard' },
    { name: 'rep', description: 'Give reputation to a member', options: [
        { name: 'user', type: 6, required: true, description: 'Member receiving reputation' }
    ] },
    { name: 'checkrep', description: 'Show a member’s reputation', options: [
        { name: 'user', type: 6, required: false, description: 'Member; defaults to you' }
    ] },
    { name: 'afk', description: 'Set your AFK status', options: [
        { name: 'reason', type: 3, required: false, description: 'AFK reason' }
    ] },
    { name: 'tod', description: 'Play Truth or Dare', options: [
        { name: 'choice', type: 3, required: true, description: 'Choose Truth or Dare', choices: [
            { name: 'Truth', value: 'truth' }, { name: 'Dare', value: 'dare' }
        ] }
    ] },

    // ================= UTILITIES =================
    { name: 'whois', description: 'Show detailed information about a user', options: [
        { name: 'target', type: 6, required: false, description: 'User; defaults to you' }
    ] },
    { name: 'translate', description: 'Translate text into another language', options: [
        { name: 'language', type: 3, required: true, description: 'Target language or language code' },
        { name: 'text', type: 3, required: true, description: 'Text to translate' }
    ] },
    { name: 'steal', description: 'Import one or more custom emojis', default_member_permissions: MANAGE_GUILD, options: [
        { name: 'emojis', type: 3, required: true, description: 'Custom emoji(s) or emoji URL(s)' }
    ] },
    { name: 'help', description: 'Show the bot command list' },
    { name: 'ping', description: 'Check bot latency' },

    // Message context-menu command handled by steal.js
    { name: 'Steal Emojis', type: ApplicationCommandType.Message },

    // ================= PREMIUM =================
    { name: 'activatepremium', description: 'Activate Premium for a server', options: [
        { name: 'server_id', type: 3, required: true, description: 'Server ID to activate' }
    ] },
    { name: 'deactivatepremium', description: 'Deactivate Premium for a server', options: [
        { name: 'server_id', type: 3, required: true, description: 'Server ID to deactivate' }
    ] },
    { name: 'removepremium', description: 'Alias for deactivating Premium', options: [
        { name: 'server_id', type: 3, required: true, description: 'Server ID to deactivate' }
    ] },
    { name: 'premiumcheck', description: 'Check whether this server has Premium' }
];

async function deployCommands() {
    const token = process.env.TOKEN;
    const clientId = process.env.CLIENT_ID;

    // Hardcoded fallback so you don't have to rely entirely on the .env file during testing
    const guildId = process.env.GUILD_ID || 'PASTE_YOUR_SERVER_ID_HERE';

    if (!token || !clientId) {
        throw new Error('TOKEN and CLIENT_ID must be set before deploying commands.');
    }

    const rest = new REST({ version: '10' }).setToken(token);

    // Now it guarantees it routes as a Guild Command if a guild ID is provided above
    const route = guildId !== 'PASTE_YOUR_SERVER_ID_HERE'
        ? Routes.applicationGuildCommands(clientId, guildId)
        : Routes.applicationCommands(clientId);

    console.log(`🔄 Syncing ${commands.length} commands ${guildId !== 'PASTE_YOUR_SERVER_ID_HERE' ? `to guild ${guildId}` : 'globally'}...`);
    const result = await rest.put(route, { body: commands });
    console.log(`✅ Registered ${result.length} commands successfully.`);
    return result;
}

if (require.main === module) {
    deployCommands().catch((error) => {
        console.error('❌ Discord rejected the command payload:', error);
        process.exitCode = 1;
    });
}

module.exports = { commands, deployCommands };
