// ==========================================
// 🔧 0. CRITICAL AUDIO ENGINE FIX
// ==========================================
process.env.FFMPEG_PATH = require('ffmpeg-static');

const { Client, GatewayIntentBits, Partials, Collection, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const cors = require('cors'); 
const https = require('https'); 
const mongoose = require('mongoose'); 
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const fs = require('fs');
const path = require('path');
const ServerListing = require('./models/ServerListing'); 

// ==========================================
// 1. WEB SERVER & DASHBOARD HOSTING
// ==========================================
const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

app.get('/api/servers', async (req, res) => {
    try {
        const servers = await ServerListing.find().sort({ lastBump: -1 }).limit(50);
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
                    if(servers.length === 0) { container.innerHTML = '<p>No servers bumped yet. Add Starry and run /bump!</p>'; return; }
                    servers.forEach(s => {
                        const defaultIcon = 'https://cdn.discordapp.com/embed/avatars/0.png';
                        const timeAgo = new Date(s.lastBump).toLocaleString();
                        let tagsHtml = s.tags.map(t => \`<span class="tag">\${t}</span>\`).join('');
                        container.innerHTML += \`
                            <div class="card">
                                <img src="\${s.iconUrl || defaultIcon}" class="icon" alt="Icon">
                                <h2 class="name">\${s.name}</h2>
                                <p class="desc">\${s.description}</p>
                                <div class="stats"><span>👥 \${s.memberCount} Members</span><span>🚀 \${s.bumps} Bumps</span></div>
                                <div class="tags">\${tagsHtml}</div>
                                <a href="\${s.inviteLink}" target="_blank" class="join-btn">Join Server</a>
                                <span class="bump-time">Last bumped: \${timeAgo}</span>
                            </div>\`;
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

app.get('/health', (req, res) => res.status(200).send('awake'));

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web Dashboard & Server listening on port ${port}`);
    setInterval(() => {
        const appUrl = process.env.RENDER_EXTERNAL_URL || 'https://manager-bot-hglf.onrender.com';
        https.get(`${appUrl}/health`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).on('error', (err) => console.error('⚠️ Self-ping failed:', err.message));
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
// 2.5 LAVALINK MUSIC ENGINE SETUP
// ==========================================
const KazagumoSpotify = require('kazagumo-spotify');

const Nodes = [
    { name: 'Serenetia SSL', url: 'lavalinkv4.serenetia.com:443', auth: 'https://dsc.gg/ajidevserver', secure: true }
];


client.manager = new Kazagumo({
    defaultSearchEngine: "spotify",
    plugins: [
        new KazagumoSpotify({ clientId: process.env.SPOTIFY_CLIENT_ID, clientSecret: process.env.SPOTIFY_CLIENT_SECRET, playlistPageLimit: 2, albumPageLimit: 1, searchMarket: 'IN', searchPrefix: 'ytmsearch:' })
    ],
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes, {
    voiceConnectionTimeout: 30000 // Gives Jirayu 30 seconds to connect instead of 15
});

client.manager.shoukaku.on('ready', (name) => console.log(`[Lavalink] Connected to node: ${name}`));
client.manager.shoukaku.on('error', (name, error) => console.error(`[Lavalink] Node ${name} error:`, error));

client.manager.on('playerStart', async (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (!channel) return;

    try {
        const guild = client.guilds.cache.get(player.guildId);
        if (guild && client.vcLocks && client.vcLocks.get(guild.id)) {
            const voiceChannel = guild.channels.cache.get(player.voiceId);
            if (voiceChannel) {
                await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
                if (channel) await channel.send('🔒 **Voice channel locked!** Auto-lock is active for this session. Use `/vclock` to disable.').catch(() => {});
            }
        }
    } catch (lockErr) {
        console.error('[Voice Lock Error]:', lockErr);
    }

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
            `**ℹ️ Song Details**\n▶️ **Status:** Playing\n⚙️ **Loop:** ${player.loop === 'none' ? 'Off' : player.loop === 'track' ? 'Track' : 'Queue'}\n🕒 **Duration:** ${track.isStream ? '🔴 LIVE' : formatTime(track.length)}\n👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}\n🌐 **Source:** ${track.sourceName ? track.sourceName.charAt(0).toUpperCase() + track.sourceName.slice(1) : 'Unknown'}\n🔠 **Queue:** ${player.queue.length} songs in queue\n\n**⚙️ Playback & Filters**\nUse the interactive controls below to manage your audio session.`
        )
        .setFooter({ text: 'Starry Music Player • Use /help for commands', iconURL: client.user.displayAvatarURL() });

    const playbackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pause/Resume').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Loop').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger)
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

    const msg = await channel.send({ embeds: [embed], components: [playbackRow, filterRow] });
    player.data.set('nowPlayingMessage', msg);
});

client.manager.on('playerException', (player, data) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) channel.send('⚠️ **Stream dropped!** The public node blocked this track.');
    player.skip(); 
});

client.manager.on('playerEmpty', async player => {
    const channel = client.channels.cache.get(player.textId);
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
// 4. BOT READY & UNIVERSAL COMMAND LOADER
// ==========================================
client.once(Events.ClientReady, async () => {
    console.log(`🚀 Successfully logged in as ${client.user.tag}`);
    console.log('ℹ️ Slash commands are deployed with `npm run deploy`.');
});

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const rootFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of rootFiles) {
        const command = require(path.join(commandsPath, file));
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Loaded Slash Command: /${command.data.name}`);
        } else if ('name' in command && 'execute' in command) {
            client.prefixCommands.set(command.name, command);
            console.log(`✅ Loaded Prefix Command: .${command.name}`);
        }
    }
    const folders = fs.readdirSync(commandsPath).filter(f => fs.statSync(path.join(commandsPath, f)).isDirectory());
    for (const folder of folders) {
        const folderPath = path.join(commandsPath, folder);
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const command = require(path.join(folderPath, file));
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`✅ Loaded Slash Command: /${command.data.name}`);
            } else if ('name' in command && 'execute' in command) {
                client.prefixCommands.set(command.name, command);
                console.log(`✅ Loaded Prefix Command: .${command.name}`);
            }
        }
    }
}

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const PREFIX = '.'; 
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.prefixCommands.get(commandName);
    if (!command) return;
    try { await command.execute(message, args, client); } 
    catch (error) { console.error(`❌ Error executing prefix command ${commandName}:`, error); }
});

// ==========================================
// 5. INTERACTION ENGINE
// ==========================================
client.on(Events.InteractionCreate, async interaction => {
    // 🛡️ DM Guard
    if (!interaction.guild && !interaction.isChatInputCommand()) return;

    // 🎛️ DJ PANEL HANDLER
    if (interaction.isButton() && interaction.customId.startsWith('dj_')) {
        const member = interaction.member;
        const voiceChannel = member.voice?.channel;
        const action = interaction.customId;

        if (!voiceChannel && action !== 'dj_refresh_panel') {
            return interaction.reply({ content: '❌ You must be connected to a voice channel to use these controls!', ephemeral: true });
        }
        if (action !== 'dj_refresh_panel' && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ You need **Manage Channels** permission to execute this VC action!', ephemeral: true });
        }

        try {
            if (action === 'dj_lock') {
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
                return interaction.reply({ content: '🔒 Voice channel has been **locked**. No new users can join.', ephemeral: true });
            }
            if (action === 'dj_unlock') {
                await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
                return interaction.reply({ content: '🔓 Voice channel has been **unlocked**. Users can join freely.', ephemeral: true });
            }
            if (action === 'dj_limit_plus') {
                let newLimit = voiceChannel.userLimit + 5;
                if (newLimit > 99) newLimit = 99;
                await voiceChannel.setUserLimit(newLimit);
                return interaction.reply({ content: `➕ Voice channel member limit increased to **${newLimit}**`, ephemeral: true });
            }
            if (action === 'dj_limit_minus') {
                let newLimit = voiceChannel.userLimit - 5;
                if (newLimit < 0) newLimit = 0;
                await voiceChannel.setUserLimit(newLimit);
                return interaction.reply({ content: `➖ Voice channel member limit decreased to **${newLimit === 0 ? 'Unlimited' : newLimit}**`, ephemeral: true });
            }
            if (action === 'dj_reset_limit') {
                await voiceChannel.setUserLimit(0);
                return interaction.reply({ content: '🔄 Voice channel member limit reset to **Unlimited**.', ephemeral: true });
            }
            if (action === 'dj_shuffle') {
                const player = client.manager.getPlayer(interaction.guild.id);
                if (!player || !player.queue.size) return interaction.reply({ content: '❌ There are no songs in the queue to shuffle.', ephemeral: true });
                player.queue.shuffle();
                return interaction.reply({ content: '🔀 The music queue has been **shuffled**!', ephemeral: true });
            }
            if (action === 'dj_loop') {
                const player = client.manager.getPlayer(interaction.guild.id);
                if (!player) return interaction.reply({ content: '❌ No active music player found.', ephemeral: true });
                const nextLoop = player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none';
                player.setLoop(nextLoop);
                return interaction.reply({ content: `🔁 Music loop mode changed to: **${nextLoop.toUpperCase()}**`, ephemeral: true });
            }
            if (action === 'dj_vol_up' || action === 'dj_vol_down') {
                const player = client.manager.getPlayer(interaction.guild.id);
                if (!player) return interaction.reply({ content: '❌ No active music player found.', ephemeral: true });
                let newVol = player.volume + (action === 'dj_vol_up' ? 10 : -10);
                if (newVol > 100) newVol = 100;
                if (newVol < 0) newVol = 0;
                await player.setVolume(newVol);
                return interaction.reply({ content: `🔊 Volume adjusted to **${newVol}%**`, ephemeral: true });
            }
            if (action === 'dj_clear_queue') {
                const player = client.manager.getPlayer(interaction.guild.id);
                if (!player || !player.queue.size) return interaction.reply({ content: '❌ The queue is already empty.', ephemeral: true });
                player.queue.clear();
                return interaction.reply({ content: '🗑️ The music queue has been **cleared**!', ephemeral: true });
            }
            if (action === 'dj_refresh_panel') {
                if (!voiceChannel) return interaction.reply({ content: '❌ Join a voice channel to refresh panel stats for it!', ephemeral: true });
                const vcName = voiceChannel.name;
                const vcLimit = voiceChannel.userLimit === 0 ? 'Unlimited' : voiceChannel.userLimit;
                const vcStatus = voiceChannel.permissionsFor(interaction.guild.roles.everyone).has('Connect') ? '🔓 Unlocked' : '🔒 Locked';
                const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setDescription(`Complete master command center for voice channel security, moderation, and music playback.\n\n🎙️ **Active VC:** \`${vcName}\`\n🔒 **Access Status:** ${vcStatus}\n👥 **Member Capacity:** \`${voiceChannel.members.size} / ${vcLimit}\``);
                await interaction.update({ embeds: [updatedEmbed] });
                return;
            }
        } catch (err) {
            console.error('DJ Panel Error:', err);
            return interaction.reply({ content: '❌ Failed to execute action. Verify my bot permissions.', ephemeral: true });
        }
    }

    // 🛍️ SHOP PURCHASE HANDLER
    if (interaction.isStringSelectMenu() && interaction.customId === 'shop_buy_menu') {
        await interaction.deferReply({ ephemeral: true });
        const itemId = interaction.values[0];
        const User = require('./models/User');
        const ShopItem = require('./models/ShopItem');
        const item = await ShopItem.findById(itemId);
        if (!item) return interaction.editReply('❌ That item no longer exists in the shop!');
        let userData = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        if (!userData || userData.credits < item.price) return interaction.editReply(`❌ You do not have enough credits! You need 💳 **${item.price.toLocaleString()} Credits**.`);
        
        if (item.type === 'role') {
            const role = interaction.guild.roles.cache.get(item.roleId);
            if (!role) return interaction.editReply('❌ That role was deleted from the server settings.');
            if (interaction.member.roles.cache.has(role.id)) return interaction.editReply('✅ You already own this role!');
            userData.credits -= item.price;
            await userData.save();
            await interaction.member.roles.add(role);
            return interaction.editReply(`🎉 Success! You purchased the **${role.name}** role!`);
        }
        if (item.type === 'pet') {
            if (userData.inventory.includes(item.name)) return interaction.editReply(`✅ You already own the **${item.name}** pet!`);
            userData.credits -= item.price;
            userData.inventory.push(item.name);
            userData.activePet = item.name; 
            userData.petHappiness = 50; 
            await userData.save();
            return interaction.editReply(`🐾 **Adoption Successful!** You now own a **${item.name}**!`);
        }
    }

    // 🎛️ MUSIC UI CONTROLS
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (!interaction.customId.startsWith('music_')) return;
        const player = client.manager.getPlayer(interaction.guild.id);
        if (!player) return interaction.reply({ content: '❌ No music is currently playing.', ephemeral: true });
        if (interaction.member.voice.channelId !== player.voiceId) return interaction.reply({ content: '❌ You must be in my voice channel to use these controls!', ephemeral: true });

        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'music_pause': player.pause(!player.paused); return interaction.reply({ content: `⏯️ Music **${player.paused ? 'Paused' : 'Resumed'}**.`, ephemeral: true });
                case 'music_skip': player.skip(); return interaction.reply({ content: '⏭️ Skipped track.', ephemeral: true });
                case 'music_stop': player.destroy(); return interaction.reply({ content: '⏹️ Playback stopped.', ephemeral: true });
                case 'music_loop': const nl = player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none'; player.setLoop(nl); return interaction.reply({ content: `🔁 Loop set to: **${nl.toUpperCase()}**`, ephemeral: true });
            }
        }
        if (interaction.isStringSelectMenu() && interaction.customId === 'music_filter') {
            const filter = interaction.values[0];
            await interaction.deferReply({ ephemeral: true });
            if (filter === 'clear') { player.shoukaku.clearFilters(); return interaction.editReply('🚫 Filters cleared.'); }
            else if (filter === 'bassboost') { player.shoukaku.setFilters({ equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.6 }, { band: 2, gain: 0.4 }] }); return interaction.editReply('🎸 **Bassboost** applied!'); }
            else if (filter === '8d') { player.shoukaku.setFilters({ rotation: { rotationHz: 0.2 } }); return interaction.editReply('🌀 **8D Audio** applied!'); }
            else if (filter === 'nightcore') { player.shoukaku.setFilters({ timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 } }); return interaction.editReply('✨ **Nightcore** applied!'); }
            else if (filter === 'daycore') { player.shoukaku.setFilters({ timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 } }); return interaction.editReply('🌅 **Daycore** applied!'); }
            else if (filter === 'vaporwave') { player.shoukaku.setFilters({ timescale: { speed: 0.85, pitch: 0.8, rate: 1.0 }, tremolo: { frequency: 14.0, depth: 0.3 } }); return interaction.editReply('🪩 **Vaporwave** applied!'); }
            else if (filter === 'karaoke') { player.shoukaku.setFilters({ karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 } }); return interaction.editReply('🎤 **Karaoke** applied!'); }
            else if (filter === 'tremolo') { player.shoukaku.setFilters({ tremolo: { frequency: 4.0, depth: 0.5 } }); return interaction.editReply('🌊 **Tremolo** applied!'); }
            else if (filter === 'vibrato') { player.shoukaku.setFilters({ vibrato: { frequency: 4.0, depth: 0.5 } }); return interaction.editReply('〰️ **Vibrato** applied!'); }
        }
    }
    // 💻 SLASH COMMAND HANDLER & RECURRING TELEMETRY
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'telemetry') {
        const botOwners = ['1465049039153135639', '1257676837249617971']; 
        if (process.env.OWNER_ID) botOwners.push(process.env.OWNER_ID);
        if (!botOwners.includes(interaction.user.id)) return interaction.reply({ content: '❌ Access Denied.', ephemeral: true });

        await interaction.deferReply(); 

        const buildTelemetryEmbed = async (statusText, statusColor) => {
            const GuildTelemetry = require('./models/GuildTelemetry');
            const allData = await GuildTelemetry.find({}).catch(() => []);
            const totalServers = client.guilds.cache.size;
            const totalGlobalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

            let globalJoins = 0, globalVc = 0, globalWarns = 0, globalKicks = 0, globalBans = 0, globalAutomod = 0;
            allData.forEach(t => {
                globalJoins += t.joinsThisHour || 0;
                globalVc += t.totalVcSeconds || 0;
                globalWarns += t.modStats?.warns || 0;
                globalKicks += t.modStats?.kicks || 0;
                globalBans += t.modStats?.bans || 0;
                globalAutomod += t.modStats?.automodTriggers || 0;
            });

            const topServers = [...client.guilds.cache.values()]
                .sort((a, b) => b.memberCount - a.memberCount)
                .slice(0, 5)
                .map(g => {
                    const owner = client.users.cache.get(g.ownerId) || g.members.cache.get(g.ownerId)?.user;
                    const ownerTag = owner ? owner.tag : 'Unknown/Uncached';
                    return `**${g.name}**\n👑 Owner: ${ownerTag} (\`${g.ownerId}\`)\n👥 ${g.memberCount.toLocaleString()} Members`;
                }).join('\n\n');

            return new EmbedBuilder()
                .setColor(statusColor)
                .setTitle('🌐 Starry Global Network Intelligence')
                .setDescription(statusText)
                .addFields(
                    { name: '🌍 Ecosystem', value: `• **${totalServers}** Active Servers\n• **${totalGlobalMembers.toLocaleString()}** Total Users`, inline: true },
                    { name: '👥 Network Joins', value: `• **${globalJoins}** (Past Hour)`, inline: true },
                    { name: '🎙️ Voice Tracking', value: `• **${(globalVc / 3600).toFixed(1)}** Hours Globally`, inline: true },
                    { name: '🛡️ Global Enforcements', value: `Warns: **${globalWarns}** | Kicks: **${globalKicks}** | Bans: **${globalBans}** | AutoMod: **${globalAutomod}**`, inline: false },
                    { name: '🏆 Top 5 Servers in Network', value: topServers || 'No data', inline: false }
                )
                .setFooter({ text: 'Starry Central Command • Auto Scheduled', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
        };

        try {
            const firstEmbed = await buildTelemetryEmbed('🔴 **LIVE** — Active 3-Min Refresh Cycle (Updating every 15s)', '#23a559');
            const msg = await interaction.editReply({ embeds: [firstEmbed] });

            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            (async () => {
                while (true) {
                    const activeStartTime = Date.now();
                    const threeMinutes = 3 * 60 * 1000;

                    while (Date.now() - activeStartTime < threeMinutes) {
                        await sleep(15000);
                        try {
                            const liveEmbed = await buildTelemetryEmbed('🔴 **LIVE** — Active 3-Min Refresh Cycle (Updating every 15s)', '#23a559');
                            await msg.edit({ embeds: [liveEmbed] });
                        } catch (err) {
                            if (err.code === 10008) return;
                            console.error('Telemetry Edit Error:', err);
                        }
                    }

                    try {
                        const nextRunTime = Math.floor((Date.now() + (10 * 60 * 1000)) / 1000);
                        const pausedEmbed = await buildTelemetryEmbed(
                            `⏸️ **PAUSED** — Resting for 10 minutes.\nNext 3-min live update cycle starts <t:${nextRunTime}:R>!`, 
                            '#FEE75C'
                        );
                        await msg.edit({ embeds: [pausedEmbed] });
                    } catch (err) {
                        if (err.code === 10008) return;
                    }

                    await sleep(10 * 60 * 1000);
                }
            })();

            return;
        } catch (error) {
            console.error('Telemetry Schedule Error:', error);
            return interaction.editReply({ content: '❌ Failed to initialize telemetry dashboard.' });
        }
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return interaction.reply({ content: `❌ **Command file not found!**`, ephemeral: true }).catch(console.error);

    const botOwners = ['1465049039153135639', '1257676837249617971']; 
    if (process.env.OWNER_ID) botOwners.push(process.env.OWNER_ID);
    if (command.ownerOnly && !botOwners.includes(interaction.user.id)) return interaction.reply({ content: '❌ Access Denied: Not bot owner.', ephemeral: true });

    try { await command.execute(interaction, client); } 
    catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: 'Error executing command!', ephemeral: true }).catch(() => {});
        else await interaction.reply({ content: 'Error executing command!', ephemeral: true }).catch(() => {});
    }
});

// ==========================================
// 6. MASTER BOOTSTRAP SEQUENCE
// ==========================================
const loadModule = (name, filePath) => {
    try { require(filePath)(client); console.log(`✅ ${name} Module Loaded`); } 
    catch (err) { console.error(`❌ Failed to load ${name}:`, err.stack || err); }
};

async function startBot() {
    if (!process.env.MONGO_URI || !process.env.TOKEN) {
        console.error("🛑 CRITICAL ERROR: MONGO_URI or TOKEN missing!");
        process.exit(1);
    }
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🍃 Successfully connected to MongoDB Cloud!');
        const mods = [
            ['Moderation', './modules/moderation.js'], ['Automod', './modules/automod.js'], ['Media Only', './modules/mediaOnly.js'],
            ['Premium', './modules/premium.js'], ['Translator', './modules/translator.js'], ['Reaction Roles', './modules/reactionRoles.js'],
            ['Help', './modules/help.js'], ['Leveling', './modules/leveling.js'], ['Starry Protocol', './modules/starry.js'],
            ['Boost Tracker', './modules/boostTracker.js'], ['Truth or Dare', './modules/truthOrDare.js'], ['Support Tickets', './modules/tickets.js'],
            ['Admin Help Text Trigger', './modules/ahelpText.js'], ['Warnings DB', './modules/warnings.js'], ['Tracker', './modules/tracker.js'],
            ['Sus Account Detector', './modules/susAccount.js'], ['Whois Lookup', './modules/whois.js'], ['Emoji Blocker', './modules/emojiBlocker.js'],
            ['Message Purger', './modules/clear.js'], ['Master Setup Engine', './modules/masterSetupText.js'], ['Bump Tracker', './modules/bumpTracker.js'],
            ['Server Stats', './modules/serverStats.js'], ['AFK System', './modules/afk.js'], ['Server Logs', './modules/logs.js'],
            ['Giveaway', './modules/giveaway.js'], ['Counting Game', './modules/count.js'], ['Advanced Mod & Security', './modules/advancedMod.js'],
            ['Interactive Mod Panel', './modules/modPanel.js'], ['Reputation System', './modules/rep.js'], ['Voice Channel Manager', './modules/voiceManager.js'],
            ['Emoji Stealer', './modules/steal.js'], ['Welcome System', './modules/welcome.js'], ['User Protection', './modules/protect.js'],
            ['Goodbye System', './modules/goodbye.js'], ['Server Backup Engine', './modules/backupEngine.js'], ['Role Manager', './modules/roleManager.js'],
            ['Anti-Abuse', './modules/antiAbuse.js'], ['Random Chest Drops', './modules/chestDrop.js'], ['Autorole & Sticky Roles', './modules/autorole.js'],
            ['Verification System', './modules/verification.js'], ['Auto Bump Engine', './modules/bumpEngine.js'], ['Network Telemetry Engine', './modules/telemetryEngine.js']
        ];
        mods.forEach(([name, path]) => loadModule(name, path));

        if (fs.existsSync('./modules/modApply.js')) loadModule('Mod Apply', './modules/modApply.js'); 

        if (process.env.DEPLOY_COMMANDS_ON_STARTUP === 'true') {
            console.log("🔄 Auto-deploying commands...");
            const { deployCommands } = require('./deploy-commands.js');
            await deployCommands().catch(err => console.error("❌ Auto-deploy failed:\n", err.stack || err));
        }
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error("🛑 FATAL BOOTSTRAP ERROR:\n", error.stack || error);
        process.exit(1);
    }
}

startBot();
