// ==========================================
// 🔧 0. CRITICAL AUDIO ENGINE FIX
// ==========================================
process.env.FFMPEG_PATH = require('ffmpeg-static');

const { Client, GatewayIntentBits, Partials, Collection, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

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

app.use(express.urlencoded({ extended: true })); // Required for Web Verification Forms

app.get('/', (req, res) => res.send('Starry Bot is alive and running!'));
app.get('/health', (req, res) => res.status(200).send('awake'));

app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Web server listening on port ${port}`);

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
client.prefixCommands = new Collection();

// ==========================================
// 2.2 SECURE WEB VERIFICATION ROUTES
// ==========================================
client.verifyMap = new Map(); // Memory bank for secure tokens

app.get('/verify', (req, res) => {
    const token = req.query.token;
    if (!client.verifyMap.has(token)) {
        return res.send('<h1 style="color:red; text-align:center; font-family:sans-serif; margin-top:50px;">❌ Invalid or Expired Link. Please generate a new one in Discord.</h1>');
    }

    res.send(`
        <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
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
        </body>
        </html>
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
        client.verifyMap.delete(token); // Destroy the one-time token
        
        res.send(`
            <body style="background-color:#2b2d31; color:white; font-family:sans-serif; text-align:center; padding-top:20vh;">
                <h1 style="color:#23a559; font-size:50px; margin-bottom:10px;">✅ Success!</h1>
                <h3>You are now verified. You may close this tab and return to Discord.</h3>
            </body>
        `);
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
    defaultSearchEngine: "spotify",
    plugins: [
        new KazagumoSpotify({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            playlistPageLimit: 2, 
            albumPageLimit: 1,
            searchMarket: 'IN',
            searchPrefix: 'ytmsearch:' 
        })
    ],
    send: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    }
}, new Connectors.DiscordJS(client), Nodes);

client.manager.shoukaku.on('ready', (name) => console.log(`[Lavalink] Connected to node: ${name}`));
client.manager.shoukaku.on('error', (name, error) => console.error(`[Lavalink] Node ${name} error:`, error));

client.manager.on('playerStart', async (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (!channel) return;

    const formatTime = (ms) => {
        if (!ms) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    };

    const duration = track.isStream ? '🔴 LIVE' : formatTime(track.length);
    const requester = track.requester ? `<@${track.requester.id}>` : 'Unknown';
    const source = track.sourceName ? track.sourceName.charAt(0).toUpperCase() + track.sourceName.slice(1) : 'Unknown';
    const loopStatus = player.loop === 'none' ? 'Off' : player.loop === 'track' ? 'Track' : 'Queue';

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setAuthor({ name: 'Now Playing', iconURL: 'https://i.imgur.com/13w1J4L.png' })
        .setTitle(track.title)
        .setURL(track.uri)
        .setThumbnail(track.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
        .setDescription(
            `**ℹ️ Song Details**\n` +
            `▶️ **Status:** Playing\n` +
            `⚙️ **Loop:** ${loopStatus}\n` +
            `🕒 **Duration:** ${duration}\n` +
            `👤 **Requester:** ${requester}\n` +
            `🌐 **Source:** ${source}\n` +
            `🔠 **Queue:** ${player.queue.length} songs in queue\n\n` +
            `**⚙️ Playback & Filters**\n` +
            `Use the interactive controls below to manage your audio session.`
        )
        .setFooter({ text: 'Starry Music Player • Use /help for commands', iconURL: client.user.displayAvatarURL() });

    const playbackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pause/Resume').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Loop').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger)
    );

    const filterRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('music_filter')
            .setPlaceholder('Select audio filter...')
            .addOptions([
                { label: 'Clear Filters', description: 'Removes all audio effects', value: 'clear', emoji: '🚫' },
                { label: 'Karaoke', description: 'Reduces vocal volume', value: 'karaoke', emoji: '🎤' },
                { label: 'Timescale', description: 'Changes speed and pitch', value: 'timescale', emoji: '⏱️' },
                { label: 'Tremolo', description: 'Modulates volume', value: 'tremolo', emoji: '🌊' },
                { label: 'Vibrato', description: 'Modulates pitch', value: 'vibrato', emoji: '〰️' },
                { label: '3D', description: '3D audio rotation effect', value: '3d', emoji: '🌀' },
                { label: 'Distortion', description: 'Distorts the audio', value: 'distortion', emoji: '📢' },
                { label: 'Channel Mix', description: 'Mixes left and right channels', value: 'channelmix', emoji: '🎛️' },
                { label: 'Low Pass', description: 'Filters out high frequencies', value: 'lowpass', emoji: '🔈' },
                { label: 'Bassboost', description: 'Boosts the low frequencies', value: 'bassboost', emoji: '🎸' },
                { label: 'Nightcore', description: 'Speeds up track and raises pitch', value: 'nightcore', emoji: '✨' },
                { label: 'Daycore', description: 'Slows down track and lowers pitch', value: 'daycore', emoji: '🌅' }
            ])
    );

    const msg = await channel.send({ embeds: [embed], components: [playbackRow, filterRow] });
    player.data.set('nowPlayingMessage', msg);
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

client.manager.on('playerEmpty', async player => {
    const channel = client.channels.cache.get(player.textId);
    const autoplay = player.data.get('autoplay');

    if (autoplay) {
        const previousTrack = player.queue.previous[player.queue.previous.length - 1];
        if (previousTrack) {
            let result = await client.manager.search(`ytmsearch:${previousTrack.author} songs`);
            if (result && result.tracks.length) {
                const tracks = result.tracks.filter(t => t.title !== previousTrack.title);
                const nextTrack = tracks.length ? tracks[0] : result.tracks[0];
                player.queue.add(nextTrack);
                if (!player.playing && !player.paused) player.play();
                if (channel) channel.send(`📻 **Autoplay:** Up next is **${nextTrack.title}**`);
                return;
            }
        }
    }
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
    console.log('ℹ️ Slash commands are deployed with `npm run deploy`.');
});

// Load Prefix Commands
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

// Load Music Slash Commands
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

// Load Moderation Slash Commands
const modCommandsPath = path.join(__dirname, 'commands', 'moderation');
if (fs.existsSync(modCommandsPath)) {
    const modFiles = fs.readdirSync(modCommandsPath).filter(file => file.endsWith('.js'));
    for (const file of modFiles) {
        const filePath = path.join(modCommandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Loaded Slash Command: /${command.data.name}`);
        }
    }
}

// 🔥 Load Economy Slash Commands (Chest, Prestige, Shop)
const ecoCommandsPath = path.join(__dirname, 'commands', 'economy');
if (fs.existsSync(ecoCommandsPath)) {
    const ecoFiles = fs.readdirSync(ecoCommandsPath).filter(file => file.endsWith('.js'));
    for (const file of ecoFiles) {
        const filePath = path.join(ecoCommandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Loaded Slash Command: /${command.data.name}`);
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

    try {
        await command.execute(message, args, client);
    } catch (error) {
        console.error(`❌ Error executing prefix command ${commandName}:`, error);
        message.reply('There was an error trying to execute that command!').catch(() => {});
    }
});

// --- B. Interaction Handler (Commands, Buttons, Menus) ---
client.on(Events.InteractionCreate, async interaction => {

    // ==========================================
    // 🛍️ DYNAMIC SHOP PURCHASE HANDLER
    // ==========================================
    if (interaction.isStringSelectMenu() && interaction.customId === 'shop_buy_menu') {
        await interaction.deferReply({ ephemeral: true });

        const itemId = interaction.values[0];
        const User = require('./models/User');
        const ShopItem = require('./models/ShopItem');

        // Fetch item from database using the ID
        const item = await ShopItem.findById(itemId);
        if (!item) return interaction.editReply('❌ That item no longer exists in the shop!');

        let userData = await User.findOne({ userId: interaction.user.id, guildId: interaction.guild.id });
        if (!userData || userData.credits < item.price) {
            return interaction.editReply(`❌ You do not have enough credits! You need 💳 **${item.price.toLocaleString()} Credits**.`);
        }

        // --- HANDLE ROLE PURCHASES ---
        if (item.type === 'role') {
            const role = interaction.guild.roles.cache.get(item.roleId);
            if (!role) return interaction.editReply('❌ That role was deleted from the server settings. Contact an admin!');
            if (interaction.member.roles.cache.has(role.id)) return interaction.editReply('✅ You already own this role!');
            
            userData.credits -= item.price;
            await userData.save();
            await interaction.member.roles.add(role);
            return interaction.editReply(`🎉 Success! You purchased the **${role.name}** role!`);
        }
        
        // --- HANDLE PET PURCHASES ---
        if (item.type === 'pet') {
            if (userData.inventory.includes(item.name)) return interaction.editReply(`✅ You already own the **${item.name}** pet!`);
            
            userData.credits -= item.price;
            userData.inventory.push(item.name);
            userData.activePet = item.name; // Auto-equips the new pet
            userData.petHappiness = 50; // Starts halfway happy!
            await userData.save();
            
            return interaction.editReply(`🐾 **Adoption Successful!** You are now the proud owner of a **${item.name}**!\n\n*(Tip: Talk in chat to keep its happiness meter high!)*`);
        }
    }

    // ==========================================
    // 🎛️ MUSIC UI BUTTON & MENU HANDLER
    // ==========================================
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (!interaction.customId.startsWith('music_')) return;

        const player = client.manager.getPlayer(interaction.guild.id);
        if (!player) return interaction.reply({ content: '❌ No music is currently playing.', ephemeral: true });

        if (interaction.member.voice.channelId !== player.voiceId) {
            return interaction.reply({ content: '❌ You must be in my voice channel to use these controls!', ephemeral: true });
        }

        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'music_pause':
                    player.pause(!player.paused);
                    return interaction.reply({ content: `⏯️ Music has been **${player.paused ? 'Paused' : 'Resumed'}**.`, ephemeral: true });
                case 'music_skip':
                    player.skip();
                    return interaction.reply({ content: '⏭️ Skipped to the next track.', ephemeral: true });
                case 'music_stop':
                    player.destroy();
                    return interaction.reply({ content: '⏹️ Playback stopped and queue cleared.', ephemeral: true });
                case 'music_loop':
                    const nextLoop = player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none';
                    player.setLoop(nextLoop);
                    return interaction.reply({ content: `🔁 Loop mode set to: **${nextLoop.toUpperCase()}**`, ephemeral: true });
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'music_filter') {
            const filter = interaction.values[0];
            await interaction.deferReply({ ephemeral: true });

            if (filter === 'clear') {
                player.shoukaku.clearFilters();
                return interaction.editReply('🚫 All audio filters cleared.');
            } else if (filter === 'karaoke') {
                player.shoukaku.setFilters({ karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 } });
                return interaction.editReply('🎤 Karaoke filter applied!');
            } else if (filter === 'timescale') {
                player.shoukaku.setFilters({ timescale: { speed: 1.1, pitch: 1.1, rate: 1.0 } });
                return interaction.editReply('⏱️ Timescale filter applied!');
            } else if (filter === 'tremolo') {
                player.shoukaku.setFilters({ tremolo: { frequency: 4.0, depth: 0.5 } });
                return interaction.editReply('🌊 Tremolo filter applied!');
            } else if (filter === 'vibrato') {
                player.shoukaku.setFilters({ vibrato: { frequency: 4.0, depth: 0.5 } });
                return interaction.editReply('〰️ Vibrato filter applied!');
            } else if (filter === '3d') {
                player.shoukaku.setFilters({ rotation: { rotationHz: 0.2 } });
                return interaction.editReply('🌀 3D audio filter applied!');
            } else if (filter === 'distortion') {
                player.shoukaku.setFilters({ distortion: { sinOffset: 0.2, sinScale: 0.9, cosOffset: 0.2, cosScale: 0.9, tanOffset: 0.2, tanScale: 0.9, offset: 0, scale: 1 } });
                return interaction.editReply('📢 Distortion filter applied!');
            } else if (filter === 'channelmix') {
                player.shoukaku.setFilters({ channelMix: { leftToLeft: 0.5, leftToRight: 0.5, rightToLeft: 0.5, rightToRight: 0.5 } });
                return interaction.editReply('🎛️ Channel Mix filter applied!');
            } else if (filter === 'lowpass') {
                player.shoukaku.setFilters({ lowPass: { smoothing: 20.0 } });
                return interaction.editReply('🔈 Low Pass filter applied!');
            } else if (filter === 'bassboost') {
                player.shoukaku.setFilters({ equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.6 }, { band: 2, gain: 0.4 }] });
                return interaction.editReply('🎸 Bassboost applied!');
            } else if (filter === 'nightcore') {
                player.shoukaku.setFilters({ timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 } });
                return interaction.editReply('✨ Nightcore applied!');
            } else if (filter === 'daycore') {
                player.shoukaku.setFilters({ timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 } });
                return interaction.editReply('🌅 Daycore applied!');
            }
        }
    }

    // ==========================================
    // 💻 STANDARD COMMAND HANDLER
    // ==========================================
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    const botOwners = ['1465049039153135639', '1257676837249617971']; 
    if (command.ownerOnly && !botOwners.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Access Denied: You are not recognized as a bot owner!', ephemeral: true });
    }

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`❌ Error executing ${interaction.commandName}:`, error);
        const replyPayload = { content: 'There was an error executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(replyPayload).catch(() => {});
        else await interaction.reply(replyPayload).catch(() => {});
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

        loadModule('Moderation', './modules/moderation.js');
        loadModule('Automod', './modules/automod.js');
        loadModule('Media Only', './modules/mediaOnly.js');
        loadModule('Premium', './modules/premium.js');
        loadModule('Translator', './modules/translator.js');
        loadModule('Reaction Roles', './modules/reactionRoles.js'); 
        loadModule('Help', './modules/help.js');
        loadModule('Leveling', './modules/leveling.js');
        loadModule('Starry Protocol', './modules/starry.js');
        loadModule('Boost Tracker', './modules/boostTracker.js');

        loadModule('Truth or Dare', './modules/truthOrDare.js');
        loadModule('Support Tickets', './modules/tickets.js');
        loadModule('Admin Help Text Trigger', './modules/ahelpText.js');

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
        loadModule('Random Chest Drops', './modules/chestDrop.js');

        loadModule('Autorole & Sticky Roles', './modules/autorole.js');
        loadModule('Verification System', './modules/verification.js');

        if (fs.existsSync('./modules/modApply.js')) {
            loadModule('Mod Apply', './modules/modApply.js'); 
        }

        console.log('DEPLOY_COMMANDS_ON_STARTUP =', process.env.DEPLOY_COMMANDS_ON_STARTUP);
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
