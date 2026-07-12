// ==========================================
// 🔧 0. CRITICAL AUDIO ENGINE FIX
// ==========================================
// This MUST be at the very top. It loads the engine before the player boots up!
process.env.FFMPEG_PATH = require('ffmpeg-static');

const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const express = require('express');
const https = require('https'); 
const mongoose = require('mongoose'); 
const { Player } = require('discord-player'); 

// ==========================================
// 1. WEB SERVER (KEEPS RENDER ALIVE)
// ==========================================
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Starry Bot is alive and running!'));
app.get('/health', (req, res) => res.status(200).send('awake'));

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web server listening on port ${port}`);

    setInterval(() => {
        const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://manager-bot-hglf.onrender.com';
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        https.get(`${appUrl}/health`, options).on('error', (err) => {
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

client.setMaxListeners(50);
client.commands = new Collection(); 

// ==========================================
// 2.5 MUSIC PLAYER & SPOTIFY SETUP
// ==========================================
const player = new Player(client, { 
    ffmpegPath: process.env.FFMPEG_PATH,
    useUniversalBridge: true,  // 🔧 CRITICAL FIX: Enables SoundCloud/Spotify bridging
    enableBlockedExtractors: false,  // Block YouTube completely
    skipFFmpegCheck: false
});
client.player = player;

console.log('🎵 Discord Player initialized with universal bridge enabled');

// ==========================================
// 3. GLOBAL ERROR CATCHERS
// ==========================================
client.on(Events.Error, err => console.error('❌ Discord Client Error:', err));
client.on(Events.Warn, warn => console.warn('⚠️ Discord Warning:', warn));
client.on(Events.ShardError, err => console.error('❌ WebSocket/Network Error:', err));
process.on('unhandledRejection', error => console.error('❌ Unhandled Promise Rejection:', error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error));

// ==========================================
// 4. BOT READY & INTERACTION LISTENER
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
    console.log('ℹ️ Slash commands are deployed with `npm run deploy` (or DEPLOY_COMMANDS_ON_STARTUP=true).');
});

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

loadModule('Moderation', './moderation.js');
loadModule('Automod', './automod.js');
loadModule('Media Only', './mediaOnly.js');
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
loadModule('Role Manager', './roleManager.js');
loadModule('Anti-Abuse', './antiAbuse.js');
loadModule('Inactivity Tracker ', './inactivityTracker.js');
// ==========================================
// 6. CONNECT TO MONGODB
// ==========================================
if (!process.env.MONGO_URI) {
    console.error("🛑 CRITICAL ERROR: The MONGO_URI is missing from the Environment Variables!");
    process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🍃 Successfully connected to MongoDB Cloud!'))
    .catch((err) => console.error('❌ MongoDB Connection Error:', err));
// ==========================================
// 7. LOGIN TO DISCORD
// ==========================================
if (!process.env.TOKEN) {
    console.error("🛑 CRITICAL ERROR: The TOKEN is missing from the Environment Variables!");
    process.exit(1);
}

console.log('DEPLOY_COMMANDS_ON_STARTUP =', process.env.DEPLOY_COMMANDS_ON_STARTUP);

if (process.env.DEPLOY_COMMANDS_ON_STARTUP === 'true') {
    console.log("🔄 Auto-deploying commands...");
    const { deployCommands } = require('./deploy-commands.js');
    deployCommands().catch(err => console.error("❌ Auto-deploy failed:", err));
} // <--- THIS WAS THE MISSING BRACKET

client.login(process.env.TOKEN).catch(err => {
    console.error("🛑 DISCORD LOGIN FAILED:", err.message || err);
});
