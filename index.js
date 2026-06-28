require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// ==========================================
// 1. RENDER HEARTBEAT SERVER
// ==========================================
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
        GatewayIntentBits.GuildVoiceStates, 
        GatewayIntentBits.GuildMembers 
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

// 🛡️ NEW: LOAD THE MODERATION MODULE
try {
    require('./moderation.js')(client);
    console.log('✅ Moderation Module Loaded');
} catch (err) { console.error('❌ Failed to load Moderation:', err); }

try {
    require('./automod.js')(client);
    console.log('✅ Automod Module Loaded');
} catch (err) { console.error('❌ Failed to load Automod:', err); }

try {
    require('./premium.js')(client);
    console.log('✅ Premium Module Loaded');
} catch (err) { console.error('❌ Failed to load Premium:', err); }

try {
    // We must pass both 'client' (for Discord) and 'app' (for the web server)
    require('./translator.js')(client, app);
    console.log('✅ Translator Module Loaded');
} catch (err) { console.error('❌ Failed to load Translator:', err); }

try {
    require('./reactionRoles.js')(client);
    console.log('✅ Reaction Roles Module Loaded');
} catch (err) { console.error('❌ Failed to load Reaction Roles:', err); }

try {
    require('./imageGen.js')(client);
    console.log('✅ Canvas Image Gen Module Loaded');
} catch (err) { console.error('❌ Failed to load Canvas:', err); }

try {
    require('./music.js')(client);
    console.log('✅ Music Module Loaded');
} catch (err) { console.error('❌ Failed to load Music:', err); }

try {
    require('./help.js')(client);
    console.log('✅ Help Module Loaded');
} catch (err) { console.error('❌ Failed to load Help:', err); }
        
// ==========================================
// ANTI-CRASH SYSTEM
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// ==========================================
// 4. LEVELING UP SYSTEM
// ==========================================
try {
    require('./leveling.js')(client);
    console.log('✅ Leveling Module Loaded');
} catch (err) { console.error('❌ Failed to load Leveling:', err); }


// ==========================================
// 4. LOGIN TO DISCORD
// ==========================================
client.once('clientReady', () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);

