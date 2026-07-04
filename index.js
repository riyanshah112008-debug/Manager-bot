const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const express = require('express');
const https = require('https'); // 1. Imported for self-ping

// ==========================================
// 1. WEB SERVER (KEEPS RENDER ALIVE)
// ==========================================
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Starry Bot is alive and running!'));

// 2. Dedicated lightweight endpoint for the ping
app.get('/health', (req, res) => res.status(200).json({ status: 'awake' }));

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web server listening on port ${port}`);
    
    // 3. Self-ping every 14 minutes (840,000 milliseconds)
    setInterval(() => {
        // Render automatically provides this environment variable. 
        // If testing locally, it falls back to a placeholder.
        const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://YOUR-APP-NAME.onrender.com';
        
        https.get(`${appUrl}/health`).on('error', (err) => {
            console.error('⚠️ Self-ping failed:', err.message);
        });
    }, 840000); 
});

// ==========================================
// 2. DISCORD CLIENT INITIALIZATION
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
}); 

// Increase Max Listeners to prevent memory leak crashes
client.setMaxListeners(30);

// Create a collection to store older Slash Commands 
client.commands = new Collection(); 

// ==========================================
// 3. BOT READY & DEPLOY COMMANDS
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);

    // ---------------------------------------------------------
    // FIX: DISABLED TO PREVENT STARTUP LAG & RATE LIMITING
    // ---------------------------------------------------------
    console.log('⏩ Skipped command registration to speed up boot time.');
});

// ==========================================
// 4. INTERACTION LISTENER (FOR LEGACY COMMANDS)
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
// 5. MASTER MODULE LOADER
// ==========================================
const loadModule = (name, filePath) => {
    try {
        require(filePath)(client);
        console.log(`✅ ${name} Module Loaded`);
    } catch (err) {
        console.error(`❌ Failed to load ${name}:`, err.message);
    }
};

// Loading all features in the exact, clean order
loadModule('Moderation', './moderation.js');
loadModule('Automod', './automod.js');
loadModule('Premium', './premium.js');
loadModule('Translator', './translator.js');
loadModule('Reaction Roles', './reactionRoles.js'); 
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
loadModule('Message Purger', './clear.js');
loadModule('Bump Tracker', './bumpTracker.js');
loadModule('Server Stats', './serverStats.js');
loadModule('AFK System', './afk.js');
loadModule('Server Logs', './logs.js'); 
loadModule('Giveaway', './giveaway.js'); 
loadModule('Counting Game', './count.js');
loadModule('Advanced Mod & Security', './advancedMod.js');
loadModule('Interactive Mod Panel', './modPanel.js');
loadModule('Reputation System', './rep.js');
loadModule('Voice Channel Manager', './voiceManager.js');
loadModule('Emoji Stealer', './steal.js');
loadModule('Welcome System', './welcome.js');
loadModule('User Protection', './protect.js');
loadModule('Goodbye System', './goodbye.js');
const banCommand = require('./ban.js');

// ==========================================
// 6. LOGIN TO DISCORD
// ==========================================
if (!process.env.TOKEN) {
    console.error("🛑 CRITICAL ERROR: The TOKEN is missing from the Environment Variables!");
    process.exit(1);
}

// --- DIAGNOSTIC CHECK ---
console.log(`🔍 TOKEN DEBUG: The first 5 characters Render sees are: "${process.env.TOKEN.substring(0, 5)}"`);
console.log(`🔍 TOKEN DEBUG: Total length of the token string is: ${process.env.TOKEN.length} characters`);
// ------------------------

client.login(process.env.TOKEN);
