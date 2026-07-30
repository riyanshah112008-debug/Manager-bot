// ==========================================
// 🔧 0. CRITICAL AUDIO ENGINE FIX & IMPORTS
// ==========================================
process.env.FFMPEG_PATH = require('ffmpeg-static');

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
const { Player } = require('discord-player');
const fs = require('fs');
const path = require('path');
const KazagumoSpotify = require('kazagumo-spotify');

// EPHEMERAL RESPONSE FLAG (BITFIELD 6)
const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// Import ServerListing model safely from bumpEngine
const bumpEngine = require('./modules/bumpEngine');
const ServerListing = bumpEngine.ServerListing || mongoose.models.ServerListing;

// ==========================================
// 1. WEB SERVER & DASHBOARD HOSTING
// ==========================================
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

app.get('/', (req, res) => {
    res.send('<!DOCTYPE html><html><head><title>Starry | Global Network</title></head><body style="background:#1e1f22;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;"><h1>Starry Global Network</h1><p>Discover communities across Discord</p></body></html>');
});

app.use(express.static(path.join(__dirname, '../')));
app.get('/health', (req, res) => res.status(200).send('awake'));
app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web Dashboard & Server listening on port ${port}`);
    setInterval(() => {
        const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://manager-bot-1-6167.onrender.com';
        https.get(`${appUrl}/health`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).on('error', () => {});
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
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
}); 

client.setMaxListeners(50);
client.commands = new Collection(); 
client.prefixCommands = new Collection();
client.verifyMap = new Map(); 
client.voiceCalls = new Map();

// 🎵 Initialize Discord-Player instance so music.js operates without crashing
client.player = new Player(client, {
    ytdlOptions: { quality: 'highestaudio', highWaterMark: 1 << 25 }
});

// Global Anti-Mass Mention Pre-Gatekeeper (With Message Deletion Fix)
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot || !message.member) return;

    const rawPings = (message.content.match(/<@!?\d+>|<@&\d+>|@everyone|@here/g) || []).length;
    const parsedPings = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
    const totalPings = Math.max(rawPings, parsedPings);

    if (totalPings >= 5) {
        const botMember = message.guild.members.me;
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
// ==========================================
// 3. LAVALINK & 4. ERROR CATCHERS & 5. INTERACTION ENGINE
// ==========================================
const Nodes = [
    { name: 'Jirayu-Node-v4', url: 'lavalink.jirayu.net:13592', auth: 'youshallnotpass', secure: false, retryAmount: 5, retryDelay: 5000 },
    { name: 'Node-v4-Primary-SSL', url: 'lava-v4.ajiehospitality.com:443', auth: 'https://discord.gg/vM3e3U389y', secure: true, retryAmount: 3, retryDelay: 5000 }
];

client.manager = new Kazagumo({
    defaultSearchEngine: "youtube",
    searchFallbacks: { soundcloud: "scsearch", youtube: "ytsearch" },
    plugins: [
        new KazagumoSpotify({ clientId: process.env.SPOTIFY_CLIENT_ID || 'dummy_id', clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'dummy_secret' })
    ],
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes);

client.on(Events.Error, err => console.error('❌ Discord Client Error:', err));
process.on('unhandledRejection', error => console.error('❌ Unhandled Promise Rejection:', error.stack || error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error.stack || error));

client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
    try {
        const deploy = require('../deploy-commands.js');
        if (deploy && typeof deploy.deployCommands === 'function') await deploy.deployCommands();
    } catch (err) {}
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.guild && !interaction.isChatInputCommand()) return;

    if (interaction.isChatInputCommand()) {
        const moduleHandledCommands = [
            'setup-starry', 'policy-vote', 'social', 'devpanel',
            'emergency-nuke', 'emergency-lockdown', 'emergency-secure', 'emergency-unban',
            'automod', 'mod', 'play', 'pause', 'resume', 'skip', 'stop', 'queue', 'volume', 'djpanel'
        ];
        if (moduleHandledCommands.includes(interaction.commandName)) return; 
    }

    if (interaction.isButton() && (interaction.customId.startsWith('dj_') || interaction.customId.startsWith('music_'))) {
        await interaction.deferUpdate().catch(() => {});
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) {
        return interaction.reply({ content: '❌ This command is not recognized.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
    }

    try { 
        await command.execute(interaction, client); 
    } catch (error) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '⚠️ An error occurred while executing this command.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        } else {
            await interaction.followUp({ content: '⚠️ An error occurred while executing this command.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }
    }
});

const MODULE_INITIALIZERS = [
    { name: 'Music Engine', fn: () => require('./modules/music.js')(client) },
    { name: 'Automod', fn: () => require('./modules/automod.js')(client, app) },
    { name: 'Premium', fn: () => require('./modules/premium.js')(client, app) },
    { name: 'Translator', fn: () => require('./modules/translator.js')(client, app) },
    { name: 'Reaction Roles', fn: () => require('./modules/reactionRoles.js')(client, app) },
    { name: 'Help', fn: () => require('./modules/help.js')(client, app) },
    { name: 'Leveling', fn: () => require('./modules/leveling.js')(client, app) },
    { name: 'Starry Protocol', fn: () => require('./modules/starry.js')(client, app) },
    { name: 'Boost Tracker', fn: () => require('./modules/boostTracker.js')(client, app) },
    { name: 'Truth or Dare', fn: () => require('./modules/truthOrDare.js')(client, app) },
    { name: 'Support Tickets', fn: () => require('./modules/tickets.js')(client, app) },
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
    { name: 'Master Channel Systems', fn: () => require('./modules/masterChannelSystems.js')(client, app) }
];

async function startBot() {
    if (!process.env.MONGO_URI || !process.env.TOKEN) process.exit(1);
    await mongoose.connect(process.env.MONGO_URI);
    for (const mod of MODULE_INITIALIZERS) {
        try { mod.fn(); } catch (e) {}
    }
    await client.login(process.env.TOKEN);
}
startBot();
                                             
