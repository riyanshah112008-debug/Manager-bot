require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const express = require('express');

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
// 3. LOAD COMMANDS & EVENTS FROM "Logs"
// ==========================================
try {
    // Import the command and add it to our collection
    const logsCommand = require('./Logs/logs.js');
    client.commands.set(logsCommand.data.name, logsCommand);

    // Import the event and attach it to the client
    const messageDeleteEvent = require('./Logs/messageDelete.js');
    client.on(messageDeleteEvent.name, (...args) => messageDeleteEvent.execute(...args));
    
    console.log('✅ Logs Command & Event Loaded');
} catch (error) {
    console.error('❌ Failed to load Logs module:', error);
}

// ==========================================
// 4. BOT READY & DEPLOY COMMANDS
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);

    try {
        console.log('⏳ Pushing slash commands to Discord...');
        
        // Grab the JSON data from all commands in our collection
        const commandsData = client.commands.map(cmd => cmd.data.toJSON());
        
        // Push the commands to Discord globally
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
    // If it's not a slash command, ignore it
    if (!interaction.isChatInputCommand()) return;

    // Find the command in our collection
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        // Run the execute function inside logs.js
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
// 6. MODULE LOADERS (Based on your system logs)
// ==========================================
const loadModule = (name, path) => {
    try {
        require(path)(client);
        console.log(`✅ ${name} Module Loaded`);
    } catch (err) {
        console.error(`❌ Failed to load ${name}:`, err);
    }
};

// Loading all features in the exact order from your previous successful boots
loadModule('Moderation', './moderation.js');
loadModule('Automod', './automod.js');
loadModule('Premium', './premium.js');
loadModule('Translator', './translator.js');
loadModule('Reaction Roles', './reactionroles.js');
loadModule('Canvas Image Gen', './canvasimagegen.js');

loadModule('Music', './music.js');
loadModule('Help', './help.js');
loadModule('AI', './ai.js');
loadModule('Leveling', './leveling.js');
loadModule('Starry Protocol', './starry.js');

// ==========================================
// 7. LOGIN TO DISCORD
// ==========================================
client.login(process.env.TOKEN);
