const { REST, Routes } = require('discord.js');

const commands = [
    { name: 'play', description: 'Play a song', options: [{ name: 'song', type: 3, required: true, description: 'Song name/URL' }] },
    { name: 'protect', description: 'Protect a user', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'unprotect', description: 'Remove protection', options: [{ name: 'user', type: 6, required: true }] },
    { name: 'sussetup', description: 'Config auto-sus account protection', options: [
        { name: 'enabled', type: 5, required: true },
        { name: 'threshold', type: 4, required: true },
        { name: 'action', type: 3, required: true, choices: [{name: 'warn', value: 'warn'}, {name: 'kick', value: 'kick'}, {name: 'ban', value: 'ban'}] }
    ]},
    { name: 'rr', description: 'Reaction role manager', options: [
        { name: 'spawn', type: 1, description: 'Create panel', options: [{name: 'channel', type: 7, required: true}, {name: 'title', type: 3, required: true}, {name: 'text', type: 3, required: true}] },
        { name: 'add', type: 1, description: 'Add role', options: [{name: 'channel', type: 7, required: true}, {name: 'message_id', type: 3, required: true}, {name: 'role', type: 8, required: true}, {name: 'emoji', type: 3, required: true}] }
    ]},
    { name: 'warn', description: 'Warn user', options: [{ name: 'target', type: 6, required: true }, { name: 'reason', type: 3, required: true }] },
    { name: 'warnings', description: 'Check warnings', options: [{ name: 'target', type: 6, required: true }] },
    { name: 'delwarn', description: 'Remove warn', options: [{ name: 'id', type: 4, required: true }] },
    { name: 'role', description: 'Manage roles', options: [
        { name: 'create', type: 1, description: 'Create a role', options: [{name: 'name', type: 3, required: true}, {name: 'color', type: 3, description: 'Hex color'}] },
        { name: 'delete', type: 1, description: 'Delete a role', options: [{name: 'role', type: 8, required: true}] },
        { name: 'give', type: 1, description: 'Give a role', options: [{name: 'user', type: 6, required: true}, {name: 'role', type: 8, required: true}] },
        { name: 'remove', type: 1, description: 'Remove a role', options: [{name: 'user', type: 6, required: true}, {name: 'role', type: 8, required: true}] }
    ]},
    { name: 'whois', description: 'User info', options: [{ name: 'target', type: 6, description: 'User to lookup' }] },
    { name: 'translate', description: 'Translate text', options: [{name: 'language', type: 3, required: true}, {name: 'text', type: 3, required: true}] },
    { name: 'setupvc', description: 'Setup Join-to-create VC', options: [{name: 'channel', type: 7, required: true}]},
    { name: 'setupstats', description: 'Create stat channels' },
    { name: 'tod', description: 'Play Truth or Dare', options: [{name: 'choice', type: 3, required: true, choices: [{name: 'truth', value: 'truth'}, {name: 'dare', value: 'dare'}]}]},
    { name: 'activatepremium', description: 'Activate Premium for a server', options: [{name: 'server_id', description: 'Server ID', type: 3, required: true}] },
    { name: 'removepremium', description: 'Remove Premium from a server', options: [{name: 'server_id', description: 'Server ID', type: 3, required: true}] },
    { name: 'premiumcheck', description: 'Check Premium status of this server' },
    // Fixed: Name must be lowercase with no spaces. Changed type to 1 (ChatInput) because context menus are tricky to deploy in bulk.
    { name: 'steal_emoji', description: 'Steal an emoji' } 
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🔄 Syncing commands GLOBALLY across all servers...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Success! Commands are registered globally.');
    } catch (e) { 
        console.error('❌ Discord API Rejected the payload:', e); 
    }
})();
                                                                  
