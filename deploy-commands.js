require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { REST, Routes } = require('discord.js');

const commands = [
    // ================= MUSIC =================
    { name: 'play', description: 'Play a song', options: [{ name: 'song', type: 3, required: true, description: 'Song name or URL to play' }] },
        { name: 'pause', description: 'Pause the currently playing song' },
    { name: 'resume', description: 'Resume the paused song' },
    { name: 'skip', description: 'Skip the current song' },
    { name: 'stop', description: 'Stop the music and clear the queue' },
    { name: 'queue', description: 'View the upcoming songs in the queue' },
    
    // ================= MODERATION =================
    { name: 'kick', description: 'Kick a member from the server', options: [{ name: 'target', type: 6, required: true, description: 'The user to kick' }, { name: 'reason', type: 3, required: false, description: 'Reason for kicking' }] },
    { name: 'ban', description: 'Ban a member from the server', options: [{ name: 'target', type: 6, required: true, description: 'The user to ban' }, { name: 'reason', type: 3, required: false, description: 'Reason for banning' }] },
    { name: 'timeout', description: 'Timeout a user', options: [{ name: 'target', type: 6, required: true, description: 'User to timeout' }, { name: 'minutes', type: 4, required: true, description: 'Duration in minutes' }, { name: 'reason', type: 3, required: false, description: 'Reason for timeout' }]},
    { name: 'untimeout', description: 'Remove a timeout from a user', options: [{ name: 'target', type: 6, required: true, description: 'User to remove timeout from' }]},
    { name: 'purge', description: 'Delete multiple messages', options: [{ name: 'amount', type: 4, required: true, description: 'Number of messages to delete' }]},
    { name: 'lock', description: 'Lock a channel', options: [{ name: 'channel', type: 7, required: false, description: 'Channel to lock' }]},
    { name: 'unlock', description: 'Unlock a channel', options: [{ name: 'channel', type: 7, required: false, description: 'Channel to unlock' }]},
         { 
        name: 'modpanel', 
        description: 'Open the interactive moderation dashboard', 
        options: [{ name: 'user', type: 6, required: true, description: 'The user to moderate' }] 
    },
    
    // ================= WARNINGS =================
    { name: 'warn', description: 'Warn user', options: [{ name: 'target', type: 6, required: true, description: 'User to warn' }, { name: 'reason', type: 3, required: true, description: 'Reason for the warning' }] },
    { name: 'warnings', description: 'Check warnings', options: [{ name: 'target', type: 6, required: true, description: 'User to check' }] },
    { name: 'delwarn', description: 'Remove warn', options: [{ name: 'id', type: 4, required: true, description: 'Warning ID to delete' }] },

    // ================= ROLES =================
    { name: 'role', description: 'Manage roles', options: [
        { name: 'create', type: 1, description: 'Create a role', options: [{name: 'name', type: 3, required: true, description: 'Name of the role'}, {name: 'color', type: 3, description: 'Hex color for the role'}] },
        { name: 'delete', type: 1, description: 'Delete a role', options: [{name: 'role', type: 8, required: true, description: 'Role to delete'}] },
        { name: 'give', type: 1, description: 'Give a role', options: [{name: 'user', type: 6, required: true, description: 'User to give role to'}, {name: 'role', type: 8, required: true, description: 'Role to give'}] },
        { name: 'remove', type: 1, description: 'Remove a role', options: [{name: 'user', type: 6, required: true, description: 'User to remove role from'}, {name: 'role', type: 8, required: true, description: 'Role to remove'}] }
    ]},
    { name: 'rr', description: 'Reaction role manager', options: [
        { name: 'spawn', type: 1, description: 'Create a reaction role panel', options: [{name: 'channel', type: 7, required: true, description: 'Channel to spawn the panel'}, {name: 'title', type: 3, required: true, description: 'Title of the panel'}, {name: 'text', type: 3, required: true, description: 'Text for the panel'}] },
        { name: 'add', type: 1, description: 'Add a role to the panel', options: [{name: 'channel', type: 7, required: true, description: 'Channel where panel is located'}, {name: 'message_id', type: 3, required: true, description: 'Message ID of the panel'}, {name: 'role', type: 8, required: true, description: 'Role to give'}, {name: 'emoji', type: 3, required: true, description: 'Emoji to react with'}] }
    ]},

    // ================= PROTECTION / SETUP =================
    { name: 'protect', description: 'Protect a user', options: [{ name: 'user', type: 6, required: true, description: 'The user to protect' }] },
    { name: 'unprotect', description: 'Remove protection', options: [{ name: 'user', type: 6, required: true, description: 'The user to unprotect' }] },
    { name: 'sussetup', description: 'Config auto-sus account protection', options: [
        { name: 'enabled', type: 5, required: true, description: 'Enable or disable the module' },
        { name: 'threshold', type: 4, required: true, description: 'Account age threshold in days' },
        { name: 'action', type: 3, required: true, description: 'Action to take', choices: [{name: 'warn', value: 'warn'}, {name: 'kick', value: 'kick'}, {name: 'ban', value: 'ban'}] }
    ]},

    // ================= LOGGING & UTILS =================
    { name: 'setlogs', description: 'Set the channel for server logs', options: [{ name: 'channel', type: 7, required: true, description: 'The channel to send logs to' }] },
    { name: 'whois', description: 'User info', options: [{ name: 'target', type: 6, description: 'User to lookup' }] },
    { name: 'translate', description: 'Translate text', options: [{name: 'language', type: 3, required: true, description: 'Language to translate to'}, {name: 'text', type: 3, required: true, description: 'Text to translate'}] },
    { name: 'setupvc', description: 'Setup Join-to-create VC', options: [{name: 'channel', type: 7, required: true, description: 'Channel to act as the hub'}]},
    { name: 'setupstats', description: 'Create stat channels' },
    { name: 'setupwelcome', description: 'Setup welcome messages', options: [{name: 'channel', type: 7, required: true, description: 'Welcome channel'}] },
    { name: 'setupgoodbye', description: 'Setup goodbye messages', options: [{name: 'channel', type: 7, required: true, description: 'Goodbye channel'}] },
    { name: 'ticketsetup', description: 'Setup support tickets', options: [{name: 'channel', type: 7, required: true, description: 'Channel to spawn ticket panel'}] },

    // ================= FUN & ENGAGEMENT =================
    { name: 'tod', description: 'Play Truth or Dare', options: [{name: 'choice', type: 3, required: true, description: 'Truth or Dare?', choices: [{name: 'truth', value: 'truth'}, {name: 'dare', value: 'dare'}]}]},
    { name: 'afk', description: 'Set your AFK status', options: [{name: 'reason', type: 3, required: false, description: 'Reason for being AFK'}]},
    { name: 'rank', description: 'Check your current level', options: [{name: 'user', type: 6, required: false, description: 'User to check'}]},
    { name: 'leaderboard', description: 'View the server leveling leaderboard' },
    
    // ================= PREMIUM =================
    { name: 'activatepremium', description: 'Activate Premium for a server', options: [{name: 'server_id', description: 'Server ID to activate', type: 3, required: true}] },
    { name: 'removepremium', description: 'Remove Premium from a server', options: [{name: 'server_id', description: 'Server ID to remove', type: 3, required: true}] },
    { name: 'premiumcheck', description: 'Check Premium status of this server' },

    // ================= MISC =================
    { name: 'steal_emoji', description: 'Steal an emoji' },
    { name: 'help', description: 'View all bot commands' },
    { name: 'ping', description: 'Check bot latency' }
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🔄 Syncing commands GLOBALLY across all servers...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Success! All commands are registered globally.');
    } catch (e) { 
        console.error('❌ Discord API Rejected the payload:', e); 
    }
})();
    
