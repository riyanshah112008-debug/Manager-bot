require('dotenv').config(); // Ensure your .env has TOKEN and CLIENT_ID
const { REST, Routes } = require('discord.js');

const commands = [
    // Music
    { name: 'play', description: 'Play a song', options: [{ name: 'song', type: 3, required: true, description: 'Song name/URL' }] },
    
    // Protection & Security
    { name: 'protect', description: 'Protect a user', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'unprotect', description: 'Remove protection', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'sussetup', description: 'Config auto-sus account protection', options: [
        { name: 'enabled', type: 5, required: true },
        { name: 'threshold', type: 4, required: true },
        { name: 'action', type: 3, required: true, choices: [{name: 'Warn', value: 'warn'}, {name: 'Kick', value: 'kick'}, {name: 'Ban', value: 'ban'}] }
    ]},

    // Reaction Roles
    { name: 'rr', description: 'Reaction role manager', options: [
        { name: 'spawn', type: 1, description: 'Create panel', options: [{name: 'channel', type: 7, required: true}, {name: 'title', type: 3, required: true}, {name: 'text', type: 3, required: true}] },
        { name: 'add', type: 1, description: 'Add role', options: [{name: 'channel', type: 7, required: true}, {name: 'message_id', type: 3, required: true}, {name: 'role', type: 8, required: true}, {name: 'emoji', type: 3, required: true}] }
    ]},

    // Moderation
    { name: 'warn', description: 'Warn user', options: [{ name: 'target', type: 6, required: true }, { name: 'reason', type: 3, required: true }] },
    { name: 'warnings', description: 'Check warnings', options: [{ name: 'target', type: 6, required: true }] },
    { name: 'delwarn', description: 'Remove warn', options: [{ name: 'id', type: 4, required: true }] },
    { name: 'role', description: 'Manage roles', options: [
        { name: 'create', type: 1, options: [{name: 'name', type: 3, required: true}, {name: 'color', type: 3}] },
        { name: 'delete', type: 1, options: [{name: 'role', type: 8, required: true}] },
        { name: 'give', type: 1, options: [{name: 'user', type: 6, required: true}, {name: 'role', type: 8, required: true}] },
        { name: 'remove', type: 1, options: [{name: 'user', type: 6, required: true}, {name: 'role', type: 8, required: true}] }
    ]},

    // Utility & Misc
    { name: 'whois', description: 'User info', options: [{ name: 'target', type: 6 }] },
    { name: 'translate', description: 'Translate text', options: [{name: 'language', type: 3, required: true}, {name: 'text', type: 3, required: true}] },
    { name: 'setupvc', description: 'Setup Join-to-create VC', options: [{name: 'channel', type: 7, required: true}]},
    { name: 'setupstats', description: 'Create stat channels' },
    { name: 'tod', description: 'Play Truth or Dare', options: [{name: 'choice', type: 3, required: true, choices: [{name: 'Truth', value: 'truth'}, {name: 'Dare', value: 'dare'}]}]},
    { name: 'Steal Emojis', type: 3 } // Context Menu Command
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🔄 Registering commands...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Success! Starry is ready to go.');
    } catch (e) { console.error(e); }
})();
                                                                      
