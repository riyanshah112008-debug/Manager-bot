const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// ==========================================
// 1. RENDER HEARTBEAT SERVER
// ==========================================
// This tiny web server gives UptimeRobot a URL to ping every 5 minutes.
const app = express();
app.get('/', (req, res) => res.send('Manager Bot is awake and running 24/7!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Web server listening on port ${PORT}`);
});

// ==========================================
// 2. DISCORD CLIENT INITIALIZATION
// ==========================================
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates 
    ],
    ws: {
        properties: {
            os: 'windows' 
        }
    }
});

// ==========================================
// 3. LOAD YOUR MODULES
// ==========================================
// This passes the single Discord connection to your individual bot files.

try {
    require('./automod.js')(client);
    console.log('✅ Automod Module Loaded');
} catch (err) {
    console.error('❌ Failed to load Automod Module:', err);
}

try {
    require('./premium.js')(client);
    console.log('✅ Premium Module Loaded');
} catch (err) {
    console.error('❌ Failed to load Premium Module:', err);
}

// Added the Translator module here!
try {
    require('./translator.js')(client);
    console.log('✅ Translator Module Loaded');
} catch (err) {
    console.error('❌ Failed to load Translator Module:', err);
}

// ==========================================
// 4. LOGIN TO DISCORD
// ==========================================
client.once('ready', () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
});

// Uses the DISCORD_TOKEN environment variable you set in Render
client.login(process.env.DISCORD_TOKEN);
