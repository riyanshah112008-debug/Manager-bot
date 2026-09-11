// ==========================================
// 🛡️ Starry SUPREME MASTER ENGINE - INDEX.JS
// 150+ Commands • Multi-Bot Clustering • Fixed Comma Prefix (,) • 1-Year Interaction Lifetime
// ==========================================

require('dotenv').config();

// 🌐 Modern Dual-Stack Happy Eyeballs (Auto-selects working IPv4/IPv6 on mobile/cellular networks)
const net = require('net');
try {
    if (typeof net.setDefaultAutoSelectFamily === 'function') {
        net.setDefaultAutoSelectFamily(true);
    }
} catch (e) {}

// 🔧 Polyfill for older / 32-bit Node.js versions
if (!Promise.withResolvers) {
    Promise.withResolvers = function () {
        let resolve, reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };
}

try {
    process.env.FFMPEG_PATH = require('ffmpeg-static') || 'ffmpeg';
} catch (e) {
    process.env.FFMPEG_PATH = 'ffmpeg';
}
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Collection, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');
const express = require('express');
const cors = require('cors'); 
const https = require('https'); 
const mongoose = require('mongoose'); 
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const KazagumoSpotify = require('kazagumo-spotify');

// ==========================================
// 🔋 TERMUX WAKE LOCK HELPERS
// ==========================================
let lastWakeLockTime = 0;
function acquireWakeLock(forceLog = false) {
    try {
        child_process.exec('termux-wake-lock', (err) => {
            if (!err) {
                const now = Date.now();
                if (forceLog || now - lastWakeLockTime > 300000) {
                    console.log('🔋 [Termux] Wake lock active & refreshed (termux-wake-lock)');
                    lastWakeLockTime = now;
                }
            }
        });
    } catch (e) {}
}

function releaseWakeLock() {
    try {
        child_process.execSync('termux-wake-unlock', { stdio: 'ignore' });
        console.log('🔌 [Termux] Wake lock released (termux-wake-unlock)');
    } catch (e) {}
}

const config = require('./config');
const multiBot = require('./modules/multiBot');
const commandRegistry = require('./modules/commandHandler');
const { ONE_YEAR_MS, EPHEMERAL_FLAG } = require('./utils/contextHelper');

// Safely Require Bump Engine & Model
let bumpEngine = null;
let ServerListing = null;
try {
    bumpEngine = require('./modules/bumpEngine');
    ServerListing = bumpEngine.ServerListing || mongoose.models.ServerListing;
} catch (e) {
    try {
        bumpEngine = require('../modules/bumpEngine');
        ServerListing = bumpEngine.ServerListing || mongoose.models.ServerListing;
    } catch (err) {}
}

const app = express();
const port = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

app.get('/api/servers', async (req, res) => {
    try {
        if (!ServerListing) return res.json([]);
        const servers = await ServerListing.find({ isListed: true }).sort({ lastBump: -1 }).limit(50);
        res.json(servers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch servers' });
    }
});

app.get('/api/multibot/stats', (req, res) => {
    try {
        const stats = multiBot.getClusterStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', (req, res) => res.status(200).send('awake'));
app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web Dashboard & Server listening on port ${port}`);
    if (process.env.RENDER_EXTERNAL_URL) {
        setInterval(() => {
            https.get(`${process.env.RENDER_EXTERNAL_URL}/health`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).on('error', () => {});
        }, 840000);
    }
});

// Create Primary Bot Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
    failIfNotExists: false,
    rest: {
        timeout: 30000,
        retries: 5
    },
    ws: {
        large_threshold: 50
    }
}); 

client.setMaxListeners(50);
client.commands = new Collection(); 
client.prefixCommands = new Collection();
client.aliases = new Collection();
client.verifyMap = new Map(); 
client.voiceCalls = new Map();
client.vcLocks = new Map();

// Mount Starry Enterprise Web Dashboard & Payment Suite
const { setupDashboardRoutes } = require('./modules/dashboardServer');
setupDashboardRoutes(app, client);

// Initialize 24/7 Global Public Tunnel
const { startTunnel } = require('./utils/tunnelManager');
startTunnel(port).catch(() => {});

// Automatically acquire Termux Wake Lock on client initialization
acquireWakeLock();

// Global Mass Ping AutoMod
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;

    const rawPings = (message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || []).length;
    const parsedPings = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
    const totalPings = Math.max(rawPings, parsedPings);

    if (totalPings >= 5) {
        const botMember = message.guild.members.me;
        if (!botMember) return;

        if (message.author.id === message.guild.ownerId) return;
        if (message.member.roles.highest.position >= botMember.roles.highest.position) return;

        try {
            if (message.channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ManageMessages)) {
                await message.delete();
            }
        } catch (err) {}

        if (botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            await message.member.timeout(10 * 60 * 1000, `Mass Ping AutoMod (${totalPings} mentions)`).catch(() => {});
            
            const warn = await message.channel.send(`🛡️ **AutoMod:** <@${message.author.id}> was timed out for 10 minutes for mass mentioning (${totalPings} pings)!`).catch(() => null);
            if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
        }
    }
});

// Verification Web Routes
app.get('/verify', (req, res) => {
    const token = req.query.token;
    if (!client.verifyMap.has(token)) return res.send('<h1 style="color:red; text-align:center; font-family:sans-serif; margin-top:50px;">❌ Invalid or Expired Link. Please generate a new one in Discord.</h1>');
    res.send(`
        <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="background-color:#2b2d31; color:white; font-family:sans-serif; text-align:center; padding-top:10vh;">
            <img src="https://i.imgur.com/13w1J4L.png" width="100" style="border-radius:50%; margin-bottom:20px;">
            <h2>Starry Security Protocol</h2>
            <p style="color:#b5bac1; margin-bottom:40px;">To protect our server from automated bots, please verify you are human.</p>
            <form action="/verify" method="POST">
                <input type="hidden" name="token" value="${token}">
                <button type="submit" style="padding:15px 40px; font-size:18px; font-weight:bold; background-color:#23a559; color:white; border:none; border-radius:8px; cursor:pointer; box-shadow: 0 4px 15px rgba(35,165,89,0.4);">
                    I am human (Verify)
                </button>
            </form>
        </body></html>
    `);
});

app.post('/verify', async (req, res) => {
    const token = req.body.token;
    const data = client.verifyMap.get(token);
    if (!data) return res.send('<h1 style="color:red; text-align:center; font-family:sans-serif;">❌ Token expired or invalid.</h1>');
    try {
        const guild = client.guilds.cache.get(data.guildId);
        if (!guild) return res.send('<h1 style="color:red; text-align:center; font-family:sans-serif;">❌ Server not found.</h1>');
        const member = await guild.members.fetch(data.userId);
        await member.roles.add(data.roleId);
        client.verifyMap.delete(token); 
        res.send(`<body style="background-color:#2b2d31; color:white; font-family:sans-serif; text-align:center; padding-top:20vh;"><h1 style="color:#23a559; font-size:50px; margin-bottom:10px;">✅ Success!</h1><h3>You are now verified. You may close this tab and return to Discord.</h3></body>`);
    } catch (error) {
        console.error('Web Verification Error:', error);
        res.send('<h1 style="color:red; text-align:center; font-family:sans-serif;">❌ Error assigning role. Ensure bot role is higher than verification role!</h1>');
    }
});

// ==========================================
// 🎵 LAVALINK & KAZAGUMO MUSIC CLUSTER
// ==========================================
const { createMusicManager } = require('./utils/musicManager');
createMusicManager(client);


client.on(Events.Error, err => console.error('❌ Discord Client Error:', err));
client.on(Events.Warn, warn => console.warn('⚠️ Discord Warning:', warn));
client.on(Events.ShardError, err => console.error('❌ WebSocket/Network Error:', err));
client.on(Events.ShardDisconnect, (event, id) => {
    console.warn(`⚠️ Gateway Shard #${id} Disconnected (Code: ${event?.code || 'N/A'}). Attempting automatic reconnection...`);
    acquireWakeLock();
});
client.on(Events.ShardReconnecting, (id) => console.log(`🔄 Gateway Shard #${id} Reconnecting to Discord...`));
client.on(Events.ShardResume, (id, replayedEvents) => console.log(`✅ Gateway Shard #${id} Resumed connection successfully (${replayedEvents} events synced).`));

process.on('unhandledRejection', error => console.error('❌ Unhandled Promise Rejection:', error.stack || error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error.stack || error));

// ==========================================
// 🛡️ HIGH-RELIABILITY RECOVERY & HEALTH WATCHDOG
// ==========================================
mongoose.set('bufferTimeoutMS', 6000);

let isReconnectingMongo = false;
let mongoDisconnectedSince = null;
let mongoReconnectInterval = null;

async function attemptMongoReconnect() {
    if (isReconnectingMongo || mongoose.connection.readyState === 1) return;
    isReconnectingMongo = true;
    console.log('🔄 [MongoDB Watchdog] Actively attempting to reconnect to MongoDB...');
    try {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close().catch(() => {});
        }
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            heartbeatFrequencyMS: 10000
        });
        console.log('🍃 [MongoDB Watchdog] Reconnected to MongoDB successfully!');
        mongoDisconnectedSince = null;
        if (mongoReconnectInterval) {
            clearInterval(mongoReconnectInterval);
            mongoReconnectInterval = null;
        }
    } catch (err) {
        console.warn(`⚠️ [MongoDB Watchdog] Reconnect attempt failed: ${err.message}. Will retry...`);
    } finally {
        isReconnectingMongo = false;
    }
}

let gatewayAbnormalCount = 0;
let watchdogCycle = 0;

setInterval(() => {
    watchdogCycle++;

    // 1. Maintain Termux Wake Lock Continuously (Every ~60s)
    if (watchdogCycle % 4 === 0) {
        acquireWakeLock();
    }

    // 2. Check MongoDB Connection Health
    if (mongoose.connection.readyState !== 1) {
        if (!mongoDisconnectedSince) mongoDisconnectedSince = Date.now();
        const downtime = Math.round((Date.now() - mongoDisconnectedSince) / 1000);
        console.warn(`⚠️ [Watchdog] MongoDB not ready (readyState: ${mongoose.connection.readyState}, down for ${downtime}s). Triggering active reconnect...`);
        attemptMongoReconnect();

        if (downtime > 60) {
            console.error('🛑 [Watchdog] MongoDB disconnected for >60s. Restarting process to clear dead network sockets...');
            process.exit(1);
        }
    }

    // 3. Check Primary Discord Gateway WebSocket & Zombie Heartbeat State
    // Provide a 3-minute startup grace period for Discord heartbeat cycles and shard latency negotiation
    if (client.ws && client.isReady() && client.uptime > 180000) {
        const isNotReady = client.ws.status !== 0;
        const ping = client.ws.ping;
        const shard = client.ws.shards?.first();
        const lastPing = shard?.lastPingTimestamp || 0;
        const timeSinceLastPing = lastPing > 0 ? (Date.now() - lastPing) : 0;

        // True Zombie socket detection:
        // - WebSocket status is not ready (status !== 0)
        // - Ping is abnormally astronomical (>30000ms)
        // - Heartbeat ACK missing for >120s (Discord heartbeat interval is ~41.25s)
        const isZombiePing = (ping > 30000);
        const isHeartbeatStale = (lastPing > 0 && timeSinceLastPing > 120000);

        if (isNotReady || isZombiePing || isHeartbeatStale) {
            gatewayAbnormalCount++;
            console.warn(`⚠️ [Watchdog] Gateway abnormal (status: ${client.ws.status}, ping: ${ping}ms, lastPingAck: ${Math.round(timeSinceLastPing / 1000)}s ago) [Check ${gatewayAbnormalCount}/6]`);
            
            if (gatewayAbnormalCount >= 6) {
                console.error('🛑 [Watchdog] Gateway stuck in dead/disconnected state for >90s. Initiating recovery restart...');
                gatewayAbnormalCount = 0;
                process.exit(1);
            }
        } else {
            gatewayAbnormalCount = 0;
        }
    } else {
        // Startup grace period active or bot not ready yet
        gatewayAbnormalCount = 0;
    }

    // 4. Check Multi-Bot Cluster Worker Nodes
    try {
        const instances = multiBot?.instances;
        if (instances && instances.size > 1) {
            for (const [id, info] of instances.entries()) {
                if (info.isPrimary || !info.client) continue;
                const worker = info.client;
                if (worker.ws && worker.isReady() && worker.uptime > 180000) {
                    const wStatus = worker.ws.status;
                    const wPing = worker.ws.ping;
                    if (wStatus !== 0 || (wPing > 30000)) {
                        console.warn(`⚠️ [Watchdog] Worker Bot [${info.name}] socket jitter (status: ${wStatus}, ping: ${wPing}ms).`);
                    }
                }
            }
        }
    } catch (e) {}
}, 15000);

client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as Primary Bot: ${client.user.tag}`);
    acquireWakeLock();

    try {
        if (client.manager && typeof client.manager.init === 'function') {
            await client.manager.init(client.user.id);
            console.log('🎵 Kazagumo Multi-Node Music Manager successfully initialized!');
        }
    } catch (lavalinkErr) {
        console.error('❌ Lavalink Initialization Failed:', lavalinkErr.message);
    }

    // Initialize 150+ Master Commands Registry & Unified Dispatcher
    commandRegistry.init(client);

    try {
        console.log("🔄 Auto-deploying updated command payload to Discord...");
        let deploy = null;
        try { deploy = require('../deploy-commands.js'); } catch (e1) {
            try { deploy = require('./deploy-commands.js'); } catch (e2) {
                try { deploy = require('../../deploy-commands.js'); } catch (e3) {}
            }
        }
        if (deploy && typeof deploy.deployCommands === 'function') {
            await deploy.deployCommands(client);
        }
    } catch (err) {
        console.warn("⚠️ Automatic command deployment skipped or encountered error:", err.message);
    }
});

// 🌟 Multilingual Welcome & Setup Card on Server Join
client.on(Events.GuildCreate, async (guild) => {
    try {
        if (!guild || !guild.available) return;
        const isPrimary = !multiBot?.primaryClient || (client.user?.id === multiBot.primaryClient?.user?.id);
        if (!isPrimary) return; // Only primary bot posts the server greeting

        const { createWelcomeSetupCard } = require('./utils/i18n');
        let targetChannel = guild.systemChannel;

        if (!targetChannel || !targetChannel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
            targetChannel = guild.channels.cache.find(c => 
                c.isTextBased() && 
                c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)
            );
        }

        if (targetChannel) {
            const welcomePayload = createWelcomeSetupCard(guild, 'en', client.user);
            await targetChannel.send(welcomePayload).catch(() => {});
            console.log(`🌐 [i18n] Dispatched multilingual setup greeting to "${guild.name}" (#${targetChannel.name})`);
        }
    } catch (e) {
        console.error('⚠️ Error sending server join setup greeting:', e.message);
    }
});


// Module Initializers (Background systems)
const MODULE_INITIALIZERS = [
    { name: 'Automod', fn: () => require('./modules/automod.js')(client, app) },
    { name: 'Premium', fn: () => require('./modules/premium.js')(client, app) },
    { name: 'Translator', fn: () => require('./modules/translator.js')(client, app) },
    { name: 'Reaction Roles', fn: () => require('./modules/reactionRoles.js')(client, app) },
    { name: 'Help', fn: () => require('./modules/help.js')(client, app) },
    { name: 'Leveling', fn: () => require('./modules/leveling.js')(client, app) },
    { name: 'Starry Protocol', fn: () => require('./modules/starry.js')(client, app) },
    { name: 'Boost Tracker', fn: () => require('./modules/boostTracker.js')(client, app) },
    { name: 'Truth or Dare', fn: () => require('./modules/truthOrDare.js')(client, app) },
    { name: 'Support Tickets', fn: () => {
        try { return require('./modules/tickets.js')(client, app); } catch (e) {
            return require('./modules/ticket.js')(client, app);
        }
    }},
    { name: 'Admin Help Text Trigger', fn: () => require('./modules/ahelpText.js')(client, app) },
    { name: 'Tracker', fn: () => require('./modules/tracker.js')(client, app) },
    { name: 'Sus Account Detector', fn: () => require('./modules/susAccount.js')(client, app) },
    { name: 'Whois Lookup', fn: () => require('./modules/whois.js')(client, app) },
    { name: 'Emoji Blocker', fn: () => require('./modules/emojiBlocker.js')(client, app) },
    { name: 'Master Setup Engine', fn: () => require('./modules/masterSetupText.js')(client, app) },
    { name: 'Server Stats', fn: () => require('./modules/serverStats.js')(client, app) },
    { name: 'AFK System', fn: () => require('./modules/afk.js')(client, app) },
    { name: 'Server Logs', fn: () => require('./modules/logs.js')(client, app) },
    { name: 'Giveaway', fn: () => require('./modules/giveaway.js')(client, app) },
    { name: 'Counting Game', fn: () => require('./modules/count.js')(client, app) },
    { name: 'Advanced Mod & Security', fn: () => require('./modules/advancedMod.js')(client, app) },
    { name: 'Interactive Mod Panel', fn: () => require('./modules/modPanel.js')(client, app) },
    { name: 'Reputation System', fn: () => require('./modules/rep.js')(client, app) },
    { name: 'Voice Channel Manager', fn: () => require('./modules/voiceManager.js')(client, app) },
    { name: 'Emoji Stealer', fn: () => require('./modules/steal.js')(client, app) },
    { name: 'Welcome System', fn: () => require('./modules/welcome.js')(client, app) },
    { name: 'Goodbye System', fn: () => require('./modules/goodbye.js')(client, app) },
    { name: 'Embed Visuality Studio', fn: () => require('./modules/embedVisuality.js')(client, app) },
    { name: 'Server Backup Engine', fn: () => require('./modules/backupEngine.js')(client, app) },
    { name: 'Role Manager', fn: () => require('./modules/roleManager.js')(client, app) },
    { name: 'Anti-Abuse', fn: () => require('./modules/antiAbuse.js')(client, app) },
    { name: 'Random Chest Drops', fn: () => require('./modules/chestDrop.js')(client, app) },
    { name: 'Autorole & Sticky Roles', fn: () => require('./modules/autorole.js')(client, app) },
    { name: 'Verification System', fn: () => require('./modules/verification.js')(client, app) },
    { name: 'Network Telemetry Engine', fn: () => require('./modules/telemetryEngine.js')(client, app) },
    { name: 'Social Actions Engine', fn: () => require('./modules/socialActions.js')(client, app) },
    { name: 'Anonymous Confession System', fn: () => require('./modules/confession.js')(client, app) },
    { name: 'Nitro & Giveaway Claim Sniffer', fn: () => require('./modules/nitroClaimDetector.js')(client, app) },
    { name: 'Developer DM Control Panel', fn: () => require('./modules/devPanel.js')(client, app) },
    { name: 'Starry Pop Mascot Engine', fn: () => require('./modules/starryPop.js')(client, app) },
    { name: 'Starlight Reminder Engine', fn: () => { const { initReminderWorker } = require('./modules/reminderEngine.js'); initReminderWorker(client); } },
    { name: 'Celestial Starboard Engine', fn: () => { const { initStarboard } = require('./modules/starboardEngine.js'); initStarboard(client); } },
    { name: 'Dynamic Orbit Voice Engine', fn: () => { const { initTempVoice } = require('./modules/tempVoice.js'); initTempVoice(client); } },
    { name: 'Pinned Channel Sticky Notice Engine', fn: () => { const { initSticky } = require('./modules/stickyEngine.js'); initSticky(client); } },
    { name: 'Antigravity CLI Auto-Updater', fn: () => {
        const { exec } = require('child_process');
        const runAgyUpdate = () => {
            exec('agy update -y', (err, stdout) => {
                if (!err && stdout && stdout.includes('Update completed')) {
                    console.log('✨ [Antigravity Engine] Successfully updated to the latest Antigravity CLI version!');
                }
            });
        };
        setTimeout(runAgyUpdate, 15000);
        setInterval(runAgyUpdate, 6 * 60 * 60 * 1000);
    }}
];

const { cleanToken, maskToken, verifyDiscordToken } = require('./utils/tokenSanitizer');

async function startBot() {
    let sourceVar = 'DISCORD_TOKEN';
    let rawToken = process.env.DISCORD_TOKEN;
    if (!rawToken && process.env.BOT_TOKEN) {
        rawToken = process.env.BOT_TOKEN;
        sourceVar = 'BOT_TOKEN';
    } else if (!rawToken && process.env.TOKEN) {
        rawToken = process.env.TOKEN;
        sourceVar = 'TOKEN';
    }

    const primaryToken = cleanToken(rawToken);
    if (!process.env.MONGO_URI || !primaryToken) {
        console.error("🛑 CRITICAL ERROR: MONGO_URI or TOKEN missing!");
        console.error(`- MONGO_URI: ${process.env.MONGO_URI ? 'Present' : 'MISSING'}`);
        console.error(`- Bot Token (${sourceVar}): ${primaryToken ? 'Present' : 'MISSING'}`);
        process.exit(1);
    }

    console.log(`🔑 Bot Token detected from ${sourceVar}: ${maskToken(primaryToken)}`);

    // Pre-flight REST verification with Discord API
    console.log('📡 Verifying bot token with Discord REST API...');
    const preflight = await verifyDiscordToken(primaryToken);
    if (!preflight.valid) {
        console.error('🛑 DISCORD TOKEN VERIFICATION FAILED!');
        console.error(`Status: ${preflight.status || 'Network/Fetch error'}`);
        console.error(`Response from Discord: ${preflight.error || preflight.networkError}`);
        console.error(`Masked token in environment: ${maskToken(primaryToken)}`);
        console.error('------------------------------------------------------------------');
        console.error('👉 ACTION REQUIRED ON RENDER DASHBOARD:');
        console.error('1. Open https://dashboard.render.com and select your service.');
        console.error('2. Go to the "Environment" tab.');
        console.error('3. Ensure DISCORD_TOKEN is set strictly to your bot token string');
        console.error('   without "DISCORD_TOKEN=" in the value box and without quotes.');
        console.error('------------------------------------------------------------------');
    } else {
        console.log(`✨ Discord Token Verified! Bot identity: ${preflight.bot.username}#${preflight.bot.discriminator || '0'} (ID: ${preflight.bot.id})`);
    }

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            heartbeatFrequencyMS: 10000
        });
        console.log('🍃 Successfully connected to MongoDB Cloud!');

        const { initLanguageCache } = require('./utils/i18n');
        await initLanguageCache(client).catch(() => {});

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB connection lost. Triggering active auto-reconnect engine...');
            if (!mongoDisconnectedSince) mongoDisconnectedSince = Date.now();
            if (!mongoReconnectInterval) {
                mongoReconnectInterval = setInterval(attemptMongoReconnect, 5000);
            }
            attemptMongoReconnect();
        });
        mongoose.connection.on('reconnected', () => {
            console.log('🍃 MongoDB reconnected successfully.');
            mongoDisconnectedSince = null;
            if (mongoReconnectInterval) {
                clearInterval(mongoReconnectInterval);
                mongoReconnectInterval = null;
            }
            // Refresh language cache after reconnection
            const { initLanguageCache } = require('./utils/i18n');
            initLanguageCache(client).catch(() => {});
        });
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB Connection Error:', err.message);
        });

        try {
            const bumpModule = require('./modules/bumpEngine.js');
            if (typeof bumpModule === 'function') {
                bumpModule(client, app);
                console.log('✅ Registered Directory API Endpoints with Express Web Server!');
            }
        } catch (e) {
            console.error('⚠️ Could not load bumpEngine API routes:', e.message);
        }

        // Initialize Background Modules
        for (const mod of MODULE_INITIALIZERS) {
            try {
                await Promise.resolve(mod.fn());
                console.log(`✅ ${mod.name} Module Loaded`);
            } catch (err) {
                console.error(`❌ Error loading ${mod.name}:`, err.message);
            }
        }

        // Connect Primary Client & Boot Multi-Bot Cluster
        await client.login(primaryToken);
        await multiBot.initAll(client, primaryToken);

    } catch (error) {
        console.error("🛑 FATAL BOOTSTRAP ERROR:\n", error.stack || error);
        process.exit(1);
    }
}

const shutdownHandler = async (signal) => {
    console.log(`⚠️ Received ${signal}. Gracefully shutting down Starry Bot...`);
    try {
        releaseWakeLock();
        if (mongoose.connection.readyState === 1) await mongoose.connection.close();
        if (client) client.destroy();
        for (const [id, info] of multiBot.instances.entries()) {
            if (info.client && !info.isPrimary) {
                try { info.client.destroy(); } catch (e) {}
            }
        }
        console.log("👋 Clean shutdown completed.");
        process.exit(0);
    } catch (err) {
        console.error("Error during graceful shutdown:", err);
        releaseWakeLock();
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdownHandler('SIGINT'));
process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
process.on('exit', () => releaseWakeLock());

startBot();
