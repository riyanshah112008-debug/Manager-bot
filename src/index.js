// ==========================================
// 🛡️ Starry SUPREME MASTER ENGINE - INDEX.JS
// 150+ Commands • Multi-Bot Clustering • Fixed Comma Prefix (,) • 1-Year Interaction Lifetime
// ==========================================

require('dotenv').config();

// 🌐 Auto-Adaptive In-Process DNS Cache & Resilient Network Resolver
const dns = require('dns');
try {
    if (typeof dns.setDefaultResultOrder === 'function') {
        dns.setDefaultResultOrder('ipv4first');
    }
    const origLookup = dns.lookup;
    const dnsCache = new Map();

    dns.lookup = function(hostname, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        origLookup(hostname, options, (err, address, family) => {
            if (!err && address) {
                dnsCache.set(hostname, { address, family, timestamp: Date.now() });
                return callback(null, address, family);
            }
            // If DNS lookup threw transient ENOTFOUND/timeout, fall back to memory cache
            const cached = dnsCache.get(hostname);
            if (cached && (Date.now() - cached.timestamp < 3600000)) {
                return callback(null, cached.address, cached.family);
            }
            return callback(err, address, family);
        });
    };
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
function acquireWakeLock() {
    try {
        child_process.exec('termux-wake-lock', (err) => {
            if (!err) {
                console.log('🔋 [Termux] Wake lock acquired (termux-wake-lock active)');
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
        large_threshold: 50,
        properties: {
            os: 'android',
            browser: 'Discord Android',
            device: 'Discord Android'
        }
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

// 🛡️ High-Reliability Gateway Health Watchdog
setInterval(() => {
    if (client.isReady() && client.ws && client.ws.status !== 0) {
        console.warn(`⚠️ [Watchdog] Gateway WebSocket status abnormal (${client.ws.status}). Monitoring connection...`);
    }
}, 60000);

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
    { name: 'Developer DM Control Panel', fn: () => require('./modules/devPanel.js')(client, app) }
];

async function startBot() {
    const primaryToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.TOKEN;
    if (!process.env.MONGO_URI || !primaryToken) {
        console.error("🛑 CRITICAL ERROR: MONGO_URI or TOKEN missing!");
        process.exit(1);
    }
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🍃 Successfully connected to MongoDB Cloud!');

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
