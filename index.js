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

// 🔴 THE NEW API CONNECTION
try {
    const translatorAPI = require('./translator.js');
    translatorAPI(app); // Passing 'app' (Express) instead of 'client' (Discord.js)
    console.log('✅ Translator API Endpoint Loaded');
} catch (err) {
    console.error('❌ Failed to load Translator API:', err);
}
// Canva and reaction roles

try {
    require('./reactionRoles.js')(client);
    console.log('✅ Reaction Roles Module Loaded');
} catch (err) {
    console.error('❌ Failed to load Reaction Roles:', err);
}

try {
    require('./imageGen.js')(client);
    console.log('✅ Canvas Image Gen Module Loaded');
} catch (err) {
    console.error('❌ Failed to load Canvas Image Gen:', err);
}


// 4. LOGIN TO DISCORD
// ==========================================
client.once('ready', () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
});

// Uses the DISCORD_TOKEN environment variable you set in Render
client.login(process.env.DISCORD_TOKEN);
