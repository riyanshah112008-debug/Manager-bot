// ==========================================
// 🔧 0. CRITICAL AUDIO ENGINE FIX
// ==========================================
process.env.FFMPEG_PATH = require('ffmpeg-static');

const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const express = require('express');
const https = require('https'); 
const mongoose = require('mongoose'); 
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. WEB SERVER (KEEPS RENDER ALIVE)
// ==========================================
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Starry Bot is alive and running!'));
app.get('/health', (req, res) => res.status(200).send('awake'));

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web server listening on port ${port}`);

    // Self-ping every 14 minutes to prevent Render from sleeping
    setInterval(() => {
        const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://manager-bot-hglf.onrender.com';
        https.get(`${appUrl}/health`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).on('error', (err) => {
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
client.prefixCommands = new Collection(); // Stores commands like .ignore
// ==========================================
// 2.5 LAVALINK MUSIC ENGINE SETUP
// ==========================================
const KazagumoSpotify = require('kazagumo-spotify');

const Nodes = [
    {
        name: 'Jirayu Public Node', 
        url: process.env.LAVALINK_URL || 'lavalink.jirayu.net:13592', 
        auth: process.env.LAVALINK_AUTH || 'youshallnotpass', 
        secure: false
    },
    {
        name: 'AjieDev EU Node', 
        url: 'lava-v4.ajieblogs.eu.org:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    }
];

client.manager = new Kazagumo({
    defaultSearchEngine: "spotify", // Keeps Spotify as your main search engine!
    plugins: [
        new KazagumoSpotify({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            playlistPageLimit: 2, 
            albumPageLimit: 1,
            searchMarket: 'IN',
            searchPrefix: 'ytmsearch:' // <--- THE FIX: Bridges the audio from YouTube Music!
        })
    ],
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes);

// --- Lavalink Node Events ---
client.manager.shoukaku.on('ready', (name) => console.log(`[Lavalink] Connected to node: ${name}`));
client.manager.shoukaku.on('error', (name, error) => console.error(`[Lavalink] Node ${name} error:`, error));

// --- Music Player Events ---
client.manager.on('playerStart', (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) channel.send(`🎶 Now playing: **${track.title}**`);
});

client.manager.on('playerException', (player, data) => {
    console.error(`[Lavalink] Track crashed:`, data);
    const channel = client.channels.cache.get(player.textId);
    if (channel) channel.send('⚠️ **Stream dropped!** The public node blocked this track. Try adding "lyrics" to your search.');
    player.skip(); 
});

client.manager.on('playerClosed', (player, data) => {
    console.error(`[Lavalink] Voice connection closed unexpectedly:`, data);
});

// === AUTOPLAY LOGIC (Upgraded for YouTube Music) ===
client.manager.on('playerEmpty', async player => {
    const channel = client.channels.cache.get(player.textId);
    const autoplay = player.data.get('autoplay');

    if (autoplay) {
        // Look at the last song that just played
        const previousTrack = player.queue.previous[player.queue.previous.length - 1];
        
        if (previousTrack) {
            // Search YouTube Music for more songs by that same artist
            let result = await client.manager.search(`ytmsearch:${previousTrack.author} songs`);

            if (result && result.tracks.length) {
                // Filter out the exact song we just listened to so it doesn't repeat
                const tracks = result.tracks.filter(t => t.title !== previousTrack.title);
                const nextTrack = tracks.length ? tracks[0] : result.tracks[0];
                
                player.queue.add(nextTrack);
                if (!player.playing && !player.paused) player.play();
                
                // Optional: Announce the auto-played track
                if (channel) channel.send(`📻 **Autoplay:** Up next is **${nextTrack.title}**`);
                return;
            }
        }
    }
    
    // If autoplay is off or fails, end normally
    if (channel) channel.send('📭 The queue has ended.');
});

// ==========================================
// 3. GLOBAL ERROR CATCHERS
// ==========================================
client.on(Events.Error, err => console.error('❌ Discord Client Error:', err));
client.on(Events.Warn, warn => console.warn('⚠️ Discord Warning:', warn));
client.on(Events.ShardError, err => console.error('❌ WebSocket/Network Error:', err));
process.on('unhandledRejection', error => console.error('❌ Unhandled Promise Rejection:', error.stack || error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error.stack || error));

// ==========================================
// 4. BOT READY & DYNAMIC COMMAND HANDLERS
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
    console.log('ℹ️ Slash commands are deployed with `npm run deploy` (or DEPLOY_COMMANDS_ON_STARTUP=true).');
});

// --- A. Dynamic Prefix Command Loader ---
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('name' in command && 'execute' in command) {
            client.prefixCommands.set(command.name, command);
            console.log(`✅ Loaded Prefix Command: .${command.name}`);
        }
    }
}

// --- C. Slash Command Loader (for Music in subfolder) ---
const musicCommandsPath = path.join(__dirname, 'commands', 'music');
if (fs.existsSync(musicCommandsPath)) {
    const musicFiles = fs.readdirSync(musicCommandsPath).filter(file => file.endsWith('.js'));
    for (const file of musicFiles) {
        const filePath = path.join(musicCommandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Loaded Slash Command: /${command.data.name}`);
        }
    }
}

// Handler for Prefix Commands (.ignore, etc.)
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const PREFIX = '.'; 
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args, client);
    } catch (error) {
        console.error(`❌ Error executing prefix command ${commandName}:`, error);
        message.reply('There was an error trying to execute that command!').catch(() => {});
    }
});

// --- B. Slash Command Handler ---
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // ==========================================
    // 👑 MASTER GATEKEEPER (CENTRALIZED LOCK)
    // ==========================================
    // Put your actual Discord User ID inside these quotes
    const botOwners = ['1465049039153135639,1257676837249617971']; 

    if (command.ownerOnly && !botOwners.includes(interaction.user.id)) {
        return interaction.reply({ 
            content: '❌ Access Denied: You are not recognized as a bot owner!', 
            ephemeral: true 
        });
    }

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);
        const replyPayload = { content: 'There was an error executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyPayload).catch(() => {});
        } else {
            await interaction.reply(replyPayload).catch(() => {});
        }
    }
});

// ==========================================
// 5. HELPER FUNCTION TO LOAD MODULES
// ==========================================
const loadModule = (name, filePath) => {
    try {
        require(filePath)(client);
        console.log(`✅ ${name} Module Loaded`);
    } catch (err) {
        console.error(`❌ Failed to load ${name}:`, err.stack || err);
    }
};

// ==========================================
// 6. MASTER BOOTSTRAP SEQUENCE
// ==========================================
async function startBot() {
    if (!process.env.MONGO_URI) {
        console.error("🛑 CRITICAL ERROR: The MONGO_URI is missing from the Environment Variables!");
        process.exit(1);
    }
    if (!process.env.TOKEN) {
        console.error("🛑 CRITICAL ERROR: The TOKEN is missing from the Environment Variables!");
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🍃 Successfully connected to MongoDB Cloud!');

        // 3. Load modules relative to the src/ folder
        loadModule('Moderation', './modules/moderation.js');
        loadModule('Automod', './modules/automod.js');
        loadModule('Media Only', './modules/mediaOnly.js');
        loadModule('Premium', './modules/premium.js');
        loadModule('Translator', './modules/translator.js');
        loadModule('Reaction Roles', './modules/reactionRoles.js'); 
        // loadModule('Music', './modules/music.js'); // Disabled since Lavalink is global now
        loadModule('Help', './modules/help.js');
        loadModule('Leveling', './modules/leveling.js');
        loadModule('Starry Protocol', './modules/starry.js');

        loadModule('Truth or Dare', './modules/truthOrDare.js');
        loadModule('Support Tickets', './modules/tickets.js');
        loadModule('Warnings DB', './modules/warnings.js');
        loadModule('Tracker', './modules/tracker.js');
        loadModule('Sus Account Detector', './modules/susAccount.js');
        loadModule('Whois Lookup', './modules/whois.js');
        loadModule('Emoji Blocker', './modules/emojiBlocker.js');
        loadModule('Message Purger', './modules/clear.js');
        loadModule('Bump Tracker', './modules/bumpTracker.js');
        loadModule('Server Stats', './modules/serverStats.js');
        loadModule('AFK System', './modules/afk.js');
        loadModule('Server Logs', './modules/logs.js'); 
        loadModule('Giveaway', './modules/giveaway.js'); 
        loadModule('Counting Game', './modules/count.js');
        loadModule('Advanced Mod & Security', './modules/advancedMod.js');
        loadModule('Interactive Mod Panel', './modules/modPanel.js');
        loadModule('Reputation System', './modules/rep.js');
        loadModule('Voice Channel Manager', './modules/voiceManager.js');
        loadModule('Emoji Stealer', './modules/steal.js');
        loadModule('Welcome System', './modules/welcome.js');
        loadModule('User Protection', './modules/protect.js');
        loadModule('Goodbye System', './modules/goodbye.js');
        loadModule('Role Manager', './modules/roleManager.js');
        loadModule('Anti-Abuse', './modules/antiAbuse.js');
        loadModule('Autorole & Sticky Roles', './modules/autorole.js');

        if (fs.existsSync('./modules/modApply.js')) {
            loadModule('Mod Apply', './modules/modApply.js'); 
        }

        // 4. Auto-deploy slash commands if configured
        console.log('DEPLOY_COMMANDS_ON_STARTUP =', process.env.DEPLOY_COMMANDS_ON_STARTUP);
        if (process.env.DEPLOY_COMMANDS_ON_STARTUP === 'true') {
            console.log("🔄 Auto-deploying commands...");
            const { deployCommands } = require('./deploy-commands.js');
            await deployCommands().catch(err => console.error("❌ Auto-deploy failed:\n", err.stack || err));
        }

        // 5. Finally, log in to Discord
        await client.login(process.env.TOKEN);

    } catch (error) {
        console.error("🛑 FATAL BOOTSTRAP ERROR:\n", error.stack || error);
        process.exit(1);
    }
}

// Start the bot!
startBot();
