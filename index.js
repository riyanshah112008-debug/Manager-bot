require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
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

// ==========================================
// 3. BOT READY EVENT
// ==========================================
client.once('ready', () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
});

// ==========================================
// 4. MODULE LOADERS (Based on your system logs)
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
loadModule('Starry Protocol', './starry.js'); // The new developer terminal!

// ==========================================
// 5. LOGIN TO DISCORD
// ==========================================
client.login(process.env.TOKEN);
