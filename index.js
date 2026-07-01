require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. WEB SERVER (KEEPS RENDER ALIVE)
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('Starry Bot is alive and running!'));
app.listen(10000, () => console.log('🌐 Web server listening on port 10000'));

// ==========================================
// 2. DISCORD CLIENT INITIALIZATION
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // Required for your Music module
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Create a collection to store our Slash Commands
client.commands = new Collection();

// ==========================================
// 3. AUTOMATIC CASE-INSENSITIVE LOGS MODULE LOADER
// ==========================================
let logsDir = './Logs';
if (!fs.existsSync(path.join(__dirname, 'Logs'))) {
    if (fs.existsSync(path.join(__dirname, 'logs'))) {
        logsDir = './logs';
    }
}

try {
    const logsCommand = require(`${logsDir}/logs.js`);
    client.commands.set(logsCommand.data.name, logsCommand);
    console.log(`✅ Loaded main logs command.`);

    // Safely load all event listeners and FORCE it to tell us if it worked!
    const loadLogEvent = (fileName) => {
        const filePath = path.join(__dirname, logsDir, fileName);
        if (fs.existsSync(filePath)) {
            const event = require(`${logsDir}/${fileName}`);
            client.on(event.name, (...args) => event.execute(...args));
            console.log(`✅ Log Event Connected: ${fileName}`);
        } else {
            console.log(`❌ WARNING: Could not find exactly '${fileName}' in your logs folder! Check your spelling/capital letters on GitHub.`);
        }
    };

    loadLogEvent('messageDelete.js');
    loadLogEvent('messageUpdate.js');
    loadLogEvent('guildMemberUpdate.js');
    loadLogEvent('guildMemberAdd.js');
    loadLogEvent('guildMemberRemove.js');

    console.log('✅ Logs Framework Booted Up');
} catch (error) {
    console.error('❌ Failed to load Logs module:', error.message);
}

// ==========================================
// 4. BOT READY & DEPLOY COMMANDS
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);

    try {
        console.log('⏳ Pushing slash commands to Discord...');
        const commandsData = client.commands.map(cmd => cmd.data.toJSON());
        await client.application.commands.set(commandsData);
        console.log('✅ Slash commands registered successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
});

// ==========================================
// 5. INTERACTION LISTENER (RUNS THE COMMANDS)
// ==========================================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        const replyPayload = { content: 'There was an error executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyPayload);
        } else {
            await interaction.reply(replyPayload);
        }
    }
});

// ==========================================
// 6. MODULE LOADERS
// ==========================================
const loadModule = (name, filePath) => {
    try {
        require(filePath)(client);
        console.log(`✅ ${name} Module Loaded`);
    } catch (err) {
        console.error(`❌ Failed to load ${name}:`, err.message);
    }
};

// Loading all features in the exact order
loadModule('Moderation', './moderation.js');
loadModule('Automod', './automod.js');
loadModule('Premium', './premium.js');
loadModule('Translator', './translator.js');

// Matches exact GitHub filenames
loadModule('Reaction Roles', './reactionRoles.js'); 
loadModule('Canvas Image Gen', './imageGen.js'); 

loadModule('Music', './music.js');
loadModule('Help', './help.js');
loadModule('Leveling', './leveling.js');

loadModule('Starry Protocol', './starry.js');
loadModule('Link Blocker', './linkBlocker.js');
loadModule('Truth or Dare', './truthOrDare.js');
loadModule('Support Tickets', './tickets.js');
loadModule('Warnings DB', './warnings.js');
loadModule('Invite Tracker', './inviteTracker.js');
loadModule('Sus Account Detector', './susAccount.js');
loadModule('Whois Lookup', './whois.js');
loadModule('Emoji Blocker', './emojiBlocker.js');
loadModule('Staff Application', './modApply.js');
loadModule('Message Purger', './clear.js');
loadModule('Bump Tracker', './bumpTracker.js');
loadModule('Server Stats', './serverStats.js');
loadModule('AFK System', './afk.js');
loadModule('Server Logs', './logs.js');
// ==========================================
// 7. LOGIN TO DISCORD
// ==========================================
client.login(process.env.TOKEN);
