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
// This logic checks whether your folder is named lowercase 'logs' or uppercase 'Logs'
let logsDir = './Logs';
if (!fs.existsSync(path.join(__dirname, 'Logs'))) {
    if (fs.existsSync(path.join(__dirname, 'logs'))) {
        logsDir = './logs';
    }
}

try {
    const logsCommand = require(`${logsDir}/logs.js`);
    client.commands.set(logsCommand.data.name, logsCommand);

    const messageDeleteEvent = require(`${logsDir}/messageDelete.js`);
    client.on(messageDeleteEvent.name, (...args) => messageDeleteEvent.execute(...args));
    
    console.log('✅ Logs Command & Event Loaded Successfully');
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

// FIX: Match these paths EXACTLY to your filenames on GitHub (Check for Capital Letters!)
loadModule('Reaction Roles', './reactionRoles.js'); 
loadModule('Canvas Image Gen', './imageGen.js'); 

loadModule('Music', './music.js');
loadModule('Help', './help.js');
//loadModule('AI', './ai.js');  <-- Added slashes to disable it!
loadModule('Leveling', './leveling.js');

loadModule('Starry Protocol', './starry.js');

// ==========================================
// 7. LOGIN TO DISCORD
// ==========================================
client.login(process.env.TOKEN);
    
