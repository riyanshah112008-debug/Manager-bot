// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE - INDEX.JS (PART 1/7)
// ==========================================

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
const fs = require('fs');
const path = require('path');
const KazagumoSpotify = require('kazagumo-spotify');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

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

app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Starry | Global Server List</title>
        <style>
            body { margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1e1f22; color: #dcddde; display: flex; flex-direction: column; align-items: center; }
            header { width: 100%; background-color: #2b2d31; padding: 20px 0; text-align: center; border-bottom: 2px solid #5865F2; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
            h1 { margin: 0; color: #fff; font-size: 2.5rem; }
            h1 span { color: #5865F2; }
            .container { width: 90%; max-width: 1200px; margin-top: 40px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; margin-bottom: 50px; }
            .card { background-color: #2b2d31; border-radius: 12px; width: 320px; padding: 20px; box-shadow: 0 8px 15px rgba(0,0,0,0.2); transition: transform 0.2s; display: flex; flex-direction: column; align-items: center; text-align: center; border: 1px solid transparent; }
            .card:hover { transform: translateY(-5px); border-bottom: 1px solid #5865F2; }
            .icon { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; background-color: #1e1f22; border: 2px solid #5865F2; }
            .name { font-size: 1.4rem; font-weight: bold; color: #fff; margin: 0 0 10px 0; }
            .desc { font-size: 0.95rem; color: #b5bac1; margin-bottom: 15px; height: 60px; overflow: hidden; }
            .stats { display: flex; gap: 15px; font-size: 0.9rem; font-weight: bold; color: #949ba4; margin-bottom: 15px; }
            .tags { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; margin-bottom: 20px; }
            .tag { background-color: #1e1f22; padding: 4px 10px; border-radius: 16px; font-size: 0.8rem; color: #5865F2; }
            .join-btn { background-color: #5865F2; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; width: 80%; transition: background 0.2s; }
            .join-btn:hover { background-color: #4752c4; }
            .bump-time { font-size: 0.8rem; color: #80848e; margin-top: 15px; }
        </style>
    </head>
    <body>
        <header>
            <h1><span>Starry</span> Global Network</h1>
            <p>Discover the best communities across Discord</p>
        </header>
        <div class="container" id="server-list">
            <p style="font-size: 1.2rem;">Loading servers...</p>
        </div>
        <script>
            async function loadServers() {
                try {
                    const res = await fetch('/api/servers');
                    const servers = await res.json();
                    const container = document.getElementById('server-list');
                    container.innerHTML = '';
                    if(!servers || servers.length === 0) { container.innerHTML = '<p>No servers bumped yet. Add Starry and run /bump!</p>'; return; }
                    servers.forEach(s => {
                        const defaultIcon = 'https://cdn.discordapp.com/embed/avatars/0.png';
                        const timeAgo = s.lastBump ? new Date(s.lastBump).toLocaleString() : 'Recently';
                        let tagsHtml = (s.tags || []).map(function(t) { return '<span class="tag">' + t + '</span>'; }).join('');
                        container.innerHTML += '<div class="card">' +
                            '<img src="' + (s.iconUrl || defaultIcon) + '" class="icon" alt="Icon">' +
                            '<h2 class="name">' + s.name + '</h2>' +
                            '<p class="desc">' + s.description + '</p>' +
                            '<div class="stats"><span>👥 ' + s.memberCount + ' Members</span><span>🚀 ' + (s.bumps || 0) + ' Bumps</span></div>' +
                            '<div class="tags">' + tagsHtml + '</div>' +
                            '<a href="' + s.inviteLink + '" target="_blank" class="join-btn">Join Server</a>' +
                            '<span class="bump-time">Last bumped: ' + timeAgo + '</span>' +
                            '</div>';
                    });
                } catch(e) {
                    document.getElementById('server-list').innerHTML = '<p>Error loading servers. Check back later!</p>';
                }
            }
            loadServers();
        </script>
    </body>
    </html>
    `;
    res.send(html);
});
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE - INDEX.JS (PART 2/7)
// ==========================================

app.use(express.static(path.join(__dirname, '../')));

app.get('/health', (req, res) => res.status(200).send('awake'));
app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web Dashboard & Server listening on port ${port}`);
    setInterval(() => {
        const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://manager-bot-1-6167.onrender.com';
        https.get(`${appUrl}/health`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).on('error', (err) => console.error('⚠️ Self-ping failed:', err.message));
    }, 840000); 
});

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
client.vcLocks = new Map();

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
        res.send('<h1 style="color:red; text-align:center; font-family:sans-serif;">❌ Error assigning role. Ensure my bot role is higher than the verification role!</h1>');
    }
});
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE - INDEX.JS (PART 3/7)
// ==========================================

// UPGRADED MULTI-NODE LAVALINK CLUSTER WITH ZERO-MUSIC-LOSS FAILOVER
const Nodes = [
    {
        name: 'Node-1-Jirayu-Primary',
        url: 'lavalink.jirayu.net:13592',
        auth: 'youshallnotpass',
        secure: false,
        retryAmount: 50,
        retryDelay: 3000
    },
    {
        name: 'Node-2-NyxBot-SG',
        url: 'sg1-nodelink.nyxbot.app:3000',
        auth: 'nyxbot.app/support',
        secure: false,
        retryAmount: 50,
        retryDelay: 3000
    },
    {
        name: 'Node-3-AjieDev-v4',
        url: 'lava-v4.ajieblogs.eu.org:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true,
        retryAmount: 50,
        retryDelay: 3000
    },
    {
        name: 'Node-4-Lavalink-PPA',
        url: 'lavalink.muy5.tech:443',
        auth: 'youshallnotpass',
        secure: true,
        retryAmount: 50,
        retryDelay: 3000
    },
    {
        name: 'Node-5-G3V-UK',
        url: 'lava.g3v.co.uk:9008',
        auth: 'lavalinklol',
        secure: false,
        retryAmount: 50,
        retryDelay: 3000
    },
    {
        name: 'Node-6-Serenetia-v4',
        url: 'lavalinkv4.serenetia.com:80',
        auth: 'https://seretia.link/discord',
        secure: false,
        retryAmount: 50,
        retryDelay: 3000
    }
];

client.manager = new Kazagumo({
    defaultSearchEngine: "spotify",
    searchFallbacks: { 
        spotify: "spsearch", 
        soundcloud: "scsearch", 
        youtube: "ytsearch" 
    },
    plugins: [
        new KazagumoSpotify({ 
            clientId: process.env.SPOTIFY_CLIENT_ID || 'dummy_id', 
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'dummy_secret', 
            playlistPageLimit: 3, 
            albumPageLimit: 2, 
            searchMarket: 'IN', 
            searchPrefix: 'ytsearch:' 
        })
    ],
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes, {
    moveOnDisconnect: true,
    resume: true,
    resumeTimeout: 60,
    reconnectTries: 50,
    reconnectInterval: 3000,
    restTimeout: 10000,
    voiceConnectionTimeout: 15000,
    linkInitializers: true,
    nodeResolver: (nodes) => {
        const readyNodes = Array.from(nodes.values()).filter(node => node.state === 1);
        if (!readyNodes.length) return null;
        return readyNodes.reduce((prev, current) => {
            const prevLoad = prev.stats?.cpu?.lavalinkLoad || 0;
            const currentLoad = current.stats?.cpu?.lavalinkLoad || 0;
            return prevLoad < currentLoad ? prev : current;
        });
    }
});

client.manager.shoukaku.on('ready', (name) => {
    console.log(`✅ [Lavalink Active] Node Connected: ${name}`);
});

client.manager.shoukaku.on('error', (name, error) => {
    console.warn(`⚠️ [Lavalink Failover] Node [${name}] error, failover routing active...`);
});

client.manager.shoukaku.on('disconnect', (name, count) => {
    console.warn(`⚠️ [Lavalink] Node [${name}] disconnected! Auto-migrating active players... (Retry: ${count})`);
});
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE - INDEX.JS (PART 4/7)
// ==========================================

client.manager.on('playerStart', async (player, track) => {
    player.data.set('previousTrack', track);

    const channel = client.channels.cache.get(player.textId);
    const interaction = player.data.get('interaction');
    player.data.delete('interaction');

    try {
        const guild = client.guilds.cache.get(player.guildId);
        if (guild && client.vcLocks && client.vcLocks.get(guild.id)) {
            const voiceChannel = guild.channels.cache.get(player.voiceId);
            if (voiceChannel) {
                await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
            }
        }
    } catch (lockErr) {}

    const formatTime = (ms) => {
        if (!ms) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    };

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setAuthor({ name: 'Now Playing', iconURL: 'https://i.imgur.com/13w1J4L.png' })
        .setTitle(track.title)
        .setURL(track.uri)
        .setThumbnail(track.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
        .setDescription(
            `ℹ️ **Song Details**\n▶️ **Status:** Playing\n⚙️ **Loop:** ${player.loop === 'none' ? 'Off' : player.loop === 'track' ? 'Track' : 'Queue'}\n🕒 **Duration:** ${track.isStream ? '🔴 LIVE' : formatTime(track.length)}\n👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}\n🌐 **Source:** ${track.sourceName ? track.sourceName.charAt(0).toUpperCase() + track.sourceName.slice(1) : 'Unknown'}\n🔠 **Queue:** ${player.queue.length} songs in queue\n\n⚙️ **Playback & Filters**\nUse the interactive controls below to manage your audio session.`
        )
        .setFooter({ text: 'Starry Music Player • Use /help for commands', iconURL: client.user.displayAvatarURL() });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pause/Resume').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Loop').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dj_vol_down').setEmoji('🔉').setLabel('-10%').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_vol_up').setEmoji('🔊').setLabel('+10%').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_lock').setEmoji('🔒').setLabel('Lock VC').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('dj_unlock').setEmoji('🔓').setLabel('Unlock VC').setStyle(ButtonStyle.Success)
    );

    const filterRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('music_filter').setPlaceholder('Select audio filter...').addOptions([
            { label: 'Clear Filters', description: 'Removes all audio effects', value: 'clear', emoji: '🚫' },
            { label: 'Bassboost', description: 'Boosts low frequencies', value: 'bassboost', emoji: '🎸' },
            { label: '8D Audio', description: 'Rotates sound 360°', value: '8d', emoji: '🌀' },
            { label: 'Nightcore', description: 'Faster + higher pitch', value: 'nightcore', emoji: '✨' },
            { label: 'Daycore', description: 'Slower + lower pitch', value: 'daycore', emoji: '🌅' },
            { label: 'Vaporwave', description: 'Slowed + reverb style', value: 'vaporwave', emoji: '🪩' },
            { label: 'Karaoke', description: 'Reduces vocal volume', value: 'karaoke', emoji: '🎤' },
            { label: 'Tremolo', description: 'Modulates volume', value: 'tremolo', emoji: '🌊' },
            { label: 'Vibrato', description: 'Modulates pitch', value: 'vibrato', emoji: '〰️' }
        ])
    );

    const messageData = { embeds: [embed], components: [row1, row2, filterRow] };

    try {
        if (interaction) {
            await interaction.editReply(messageData);
        } else if (channel) {
            const msg = await channel.send(messageData);
            player.data.set('nowPlayingMessage', msg);
        }
    } catch (e) {
        if (channel) {
            const msg = await channel.send(messageData).catch(() => {});
            if (msg) player.data.set('nowPlayingMessage', msg);
        }
    }
});

// FIXED: Changed player.queue.size to player.queue.length
client.manager.on('playerException', (player) => {
    try {
        if (player.queue.length > 0) player.skip();
        else player.destroy();
    } catch (e) {}
});

client.manager.on('playerEmpty', async player => {
    const channel = client.channels.cache.get(player.textId);
    const isAutoplay = player.data.get('autoplay');

    if (isAutoplay) {
        const previousTrack = player.data.get('previousTrack');
        if (previousTrack) {
            try {
                if (channel) {
                    await channel.send('📻 **Autoplay Active:** Fetching recommended songs...').catch(() => {});
                }

                const searchQuery = `https://www.youtube.com/watch?v=${previousTrack.identifier}&list=RD${previousTrack.identifier}`;
                let result = await client.manager.search(searchQuery, { requester: previousTrack.requester });

                if (!result || !result.tracks || !result.tracks.length) {
                    const fallbackQuery = `ytsearch:${previousTrack.author || ''} ${previousTrack.title} related`;
                    result = await client.manager.search(fallbackQuery, { requester: previousTrack.requester });
                }

                if (result && result.tracks && result.tracks.length > 0) {
                    const nextTrack = result.tracks.find(t => t.identifier !== previousTrack.identifier) || result.tracks[0];
                    player.queue.add(nextTrack);
                    await player.play();
                    return;
                }
            } catch (err) {
                console.error('❌ Autoplay Recommendation Error:', err.message || err);
            }
        }
    }

    if (channel) channel.send('📭 The queue has ended.');
});
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE - INDEX.JS (PART 5/7)
// ==========================================

client.on(Events.Error, err => console.error('❌ Discord Client Error:', err));
client.on(Events.Warn, warn => console.warn('⚠️ Discord Warning:', warn));
client.on(Events.ShardError, err => console.error('❌ WebSocket/Network Error:', err));
process.on('unhandledRejection', error => console.error('❌ Unhandled Promise Rejection:', error.stack || error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error.stack || error));

client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);

    try {
        if (client.manager && typeof client.manager.init === 'function') {
            await client.manager.init(client.user.id);
            console.log('🎵 Kazagumo Multi-Node Music Manager successfully initialized!');
        }
    } catch (lavalinkErr) {
        console.error('❌ Lavalink Initialization Failed:', lavalinkErr.message);
    }

    try {
        console.log("🔄 Auto-deploying updated command payload to Discord...");
        let deploy = null;
        try { deploy = require('../deploy-commands.js'); } catch (e1) {
            try { deploy = require('./deploy-commands.js'); } catch (e2) {
                try { deploy = require('../../deploy-commands.js'); } catch (e3) {}
            }
        }
        if (deploy && typeof deploy.deployCommands === 'function') {
            await deploy.deployCommands();
        } else {
            console.warn("⚠️ Could not locate deploy-commands.js module.");
        }
    } catch (err) {
        console.warn("⚠️ Automatic command deployment skipped or encountered error:", err.message);
    }
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const PREFIX = '.'; 
    if (!message.content.startsWith(PREFIX)) return;
    if (message.content.startsWith('.<:') || message.content.startsWith('.<a:')) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;
    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try { 
        if (typeof command.run === 'function') {
            await command.run(client, message, args);
        } else {
            await command.execute(message, args, client);
        }
    } catch (error) { 
        console.error(`❌ Error executing prefix command ${commandName}:`, error); 
    }
});
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE - INDEX.JS (PART 6/7)
// ==========================================

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.guild && !interaction.isChatInputCommand() && !interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isContextMenuCommand()) return;

    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        const moduleHandledCommands = [
            'setup-starry', 'policy-vote', 'social', 'devpanel',
            'emergency-nuke', 'emergency-lockdown', 'emergency-secure', 'emergency-unban',
            'automod', 'mod', 'moderate', 'verify-setup',
            'bump', 'bump-setup', 'autobump', 'set-listing',
            'ticketsetup', 'applysetup', 'setupcount', 'countstats', 'countreset',
            'whois', 'steal', 'Steal Emojis', 'setwelcome', 'setgoodbye',
            'setupwelcome', 'setupgoodbye', 'translate', 'clear', 'confessionsetup','tod'
        ];
        if (moduleHandledCommands.includes(interaction.commandName)) {
            return; 
        }
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        if (!customId.startsWith('dj_') && !customId.startsWith('music_')) return;

        const member = interaction.member;
        const voiceChannel = member?.voice?.channel;
        const player = client.manager ? client.manager.getPlayer(interaction.guild.id) : null;

        await interaction.deferUpdate().catch(() => {});

        if (!voiceChannel && customId !== 'dj_refresh_panel') {
            return interaction.followUp({ content: '❌ You must be connected to a voice channel to use these controls!', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        if (!player) {
            return interaction.followUp({ content: '❌ No active music session playing in this server.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        try {
            if (customId === 'music_pause') {
                player.pause(!player.paused);
            } else if (customId === 'music_skip') {
                player.skip();
            } else if (customId === 'music_stop') {
                player.destroy();
            } else if (customId === 'music_loop') {
                const modes = ['none', 'track', 'queue'];
                const nextMode = modes[(modes.indexOf(player.loop) + 1) % modes.length];
                player.setLoop(nextMode);
            } else if (customId === 'dj_vol_down') {
                const newVol = Math.max(0, player.volume - 10);
                player.setVolume(newVol);
            } else if (customId === 'dj_vol_up') {
                const newVol = Math.min(100, player.volume + 10);
                player.setVolume(newVol);
            } else if (customId === 'dj_lock' && voiceChannel) {
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false }).catch(() => {});
            } else if (customId === 'dj_unlock' && voiceChannel) {
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null }).catch(() => {});
            } else if (customId === 'music_filter' && interaction.isStringSelectMenu()) {
                const filterValue = interaction.values[0];
                if (filterValue === 'clear') {
                    await player.shoukaku.clearFilters();
                } else if (filterValue === 'bassboost') {
                    await player.shoukaku.setEqualizer([{ band: 0, gain: 0.2 }, { band: 1, gain: 0.15 }]);
                } else if (filterValue === 'nightcore') {
                    await player.shoukaku.setTimescale({ speed: 1.2, pitch: 1.2, rate: 1.0 });
                } else if (filterValue === 'vaporwave') {
                    await player.shoukaku.setTimescale({ speed: 0.85, pitch: 0.8, rate: 1.0 });
                } else if (filterValue === '8d') {
                    await player.shoukaku.setRotation({ rotationHz: 0.2 });
                }
            }
        } catch (err) {
            console.error('❌ Panel Interaction Execution Error:', err);
        }
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
        console.error(`❌ Error executing /${interaction.commandName}:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '⚠️ An error occurred while executing this command.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        } else {
            await interaction.followUp({ content: '⚠️ An error occurred while executing this command.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }
    }
});
// ==========================================
// 🛡️ STARRY SUPREME MASTER ENGINE - INDEX.JS (PART 7/7)
// ==========================================

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
    { name: 'Anonymous Confession System', fn: () => require('./modules/confession.js')(client, app) }
];

{ name: 'Truth or Dare', fn: () => require('./modules/truthOrDare.js')(client, app) },

function loadSlashCommands() {
    const commandsPath = path.join(__dirname, 'commands');

    if (!fs.existsSync(commandsPath)) {
        console.warn('⚠️ No "commands" directory found.');
        return;
    }

    const entries = fs.readdirSync(commandsPath);

    for (const item of entries) {
        const fullPath = path.join(commandsPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            const commandFiles = fs.readdirSync(fullPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(fullPath, file);
                const command = require(filePath);
                if (command?.data?.name) {
                    client.commands.set(command.data.name, command);
                }
            }
        } 
        else if (item.endsWith('.js')) {
            const command = require(fullPath);
            if (command?.data?.name) {
                client.commands.set(command.data.name, command);
            }
        }
    }
    console.log(`✅ Successfully loaded ${client.commands.size} slash command handlers into client.commands`);
}

async function startBot() {
    if (!process.env.MONGO_URI || !process.env.TOKEN) {
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

        loadSlashCommands();

        for (const mod of MODULE_INITIALIZERS) {
            try {
                await Promise.resolve(mod.fn());
                console.log(`✅ ${mod.name} Module Loaded`);
            } catch (err) {
                console.error(`❌ Error loading ${mod.name}:`, err.message);
            }
        }

        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error("🛑 FATAL BOOTSTRAP ERROR:\n", error.stack || error);
        process.exit(1);
    }
}

const shutdownHandler = async (signal) => {
    console.log(`⚠️ Received ${signal}. Gracefully shutting down Starry...`);
    try {
        if (mongoose.connection.readyState === 1) await mongoose.connection.close();
        if (client) client.destroy();
        console.log("👋 Clean shutdown completed.");
        process.exit(0);
    } catch (err) {
        console.error("Error during graceful shutdown:", err);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdownHandler('SIGINT'));
process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

startBot();
