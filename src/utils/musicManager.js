const { Kazagumo } = require('kazagumo');
const { Connectors } = require('shoukaku');
const KazagumoSpotify = require('kazagumo-spotify');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

const EPHEMERAL_FLAG = MessageFlags ? MessageFlags.Ephemeral : 64;

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
        name: 'Node-2-Ajieblogs-v4',
        url: 'lavalink-v4.ajieblogs.eu.org:80',
        auth: 'https://dsc.gg/ajidevserver',
        secure: false,
        retryAmount: 50,
        retryDelay: 3000
    },
    {
        name: 'Node-3-Serenetia-SSL',
        url: 'lavalink.serenetia.com:443',
        auth: 'https://seretia.link/discord',
        secure: true,
        retryAmount: 50,
        retryDelay: 3000
    },
    {
        name: 'Node-4-DevamOp-SSL',
        url: 'lavalink.devamop.in:443',
        auth: 'DevamOp',
        secure: true,
        retryAmount: 50,
        retryDelay: 3000
    }
];

function buildNowPlayingComponents() {
    // Row 1: Primary Transport Controls (4 buttons - fits mobile without wrapping)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pause').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Loop').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger)
    );

    // Row 2: Queue & Volume Controls (4 buttons - fits mobile without wrapping)
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dj_vol_down').setEmoji('🔉').setLabel('Vol -').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_vol_up').setEmoji('🔊').setLabel('Vol +').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_shuffle').setEmoji('🔀').setLabel('Shuffle').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_queue').setEmoji('📜').setLabel('Queue').setStyle(ButtonStyle.Secondary)
    );

    // Row 3: Voice Channel Security (2 buttons)
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dj_lock').setEmoji('🔒').setLabel('Lock VC').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('dj_unlock').setEmoji('🔓').setLabel('Unlock VC').setStyle(ButtonStyle.Success)
    );

    // Row 4: High-Fidelity Audio DSP Filters (Dropdown)
    const filterRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('music_filter').setPlaceholder('🎧 Select Audio Filter / Sound FX...').addOptions([
            { label: 'Clear Filters', description: 'Removes all active audio effects (Default)', value: 'clear', emoji: '🚫' },
            { label: 'Bassboost', description: 'Deep, heavy bass enhancement', value: 'bassboost', emoji: '🎸' },
            { label: '8D Audio', description: '360° rotating spatial surround sound', value: '8d', emoji: '🌀' },
            { label: 'Nightcore', description: 'Sped up tempo + higher pitch aesthetic', value: 'nightcore', emoji: '✨' },
            { label: 'Daycore / Slowed', description: 'Slowed down tempo + deeper tone', value: 'daycore', emoji: '🌅' },
            { label: 'Vaporwave', description: 'Slowed reverb + retro cassette feel', value: 'vaporwave', emoji: '🪩' },
            { label: 'Treble Boost', description: 'Crisp, crystal clear high frequencies', value: 'treble', emoji: '🔊' },
            { label: 'Pop & Vocal Clarity', description: 'Enhanced vocals and clean acoustic profile', value: 'pop', emoji: '📻' }
        ])
    );

    return [row1, row2, row3, filterRow];
}

async function applyKazagumoFilter(player, filterName) {
    if (!player || !player.shoukaku) return false;
    try {
        const shoukakuPlayer = player.shoukaku;
        switch (filterName) {
            case 'bassboost':
                await shoukakuPlayer.setFilters({
                    equalizer: [
                        { band: 0, gain: 0.28 },
                        { band: 1, gain: 0.24 },
                        { band: 2, gain: 0.16 },
                        { band: 3, gain: 0.08 },
                        { band: 5, gain: -0.06 },
                        { band: 8, gain: 0.08 },
                        { band: 9, gain: 0.12 },
                        { band: 10, gain: 0.16 },
                        { band: 11, gain: 0.12 },
                        { band: 13, gain: 0.08 }
                    ]
                });
                break;
            case 'deepbass':
                await shoukakuPlayer.setFilters({
                    equalizer: [
                        { band: 0, gain: 0.34 },
                        { band: 1, gain: 0.28 },
                        { band: 2, gain: 0.18 },
                        { band: 3, gain: 0.08 },
                        { band: 5, gain: -0.08 },
                        { band: 8, gain: 0.10 },
                        { band: 9, gain: 0.14 },
                        { band: 10, gain: 0.18 },
                        { band: 11, gain: 0.14 },
                        { band: 13, gain: 0.10 }
                    ]
                });
                break;
            case 'vibrate':
                await shoukakuPlayer.setFilters({
                    equalizer: [
                        { band: 0, gain: 0.38 },
                        { band: 1, gain: 0.32 },
                        { band: 2, gain: 0.20 },
                        { band: 3, gain: 0.10 },
                        { band: 5, gain: -0.10 },
                        { band: 8, gain: 0.12 },
                        { band: 9, gain: 0.16 },
                        { band: 10, gain: 0.22 },
                        { band: 11, gain: 0.16 },
                        { band: 13, gain: 0.10 }
                    ]
                });
                break;
            case '8d':
                await shoukakuPlayer.setFilters({
                    rotation: { rotationHz: 0.2 }
                });
                break;
            case 'nightcore':
                await shoukakuPlayer.setFilters({
                    timescale: { speed: 1.25, pitch: 1.25, rate: 1.0 }
                });
                break;
            case 'daycore':
                await shoukakuPlayer.setFilters({
                    timescale: { speed: 0.85, pitch: 0.85, rate: 1.0 }
                });
                break;
            case 'vaporwave':
                await shoukakuPlayer.setFilters({
                    timescale: { speed: 0.8, pitch: 0.85, rate: 1.0 },
                    tremolo: { frequency: 4.0, depth: 0.2 }
                });
                break;
            case 'treble':
                await shoukakuPlayer.setFilters({
                    equalizer: [
                        { band: 10, gain: 0.2 },
                        { band: 11, gain: 0.25 },
                        { band: 12, gain: 0.3 },
                        { band: 13, gain: 0.35 }
                    ]
                });
                break;
            case 'pop':
                await shoukakuPlayer.setFilters({
                    equalizer: [
                        { band: 0, gain: -0.05 },
                        { band: 1, gain: -0.02 },
                        { band: 2, gain: 0.02 },
                        { band: 3, gain: 0.12 },
                        { band: 4, gain: 0.2 },
                        { band: 5, gain: 0.15 }
                    ]
                });
                break;
            case 'clear':
            default:
                await shoukakuPlayer.setFilters({});
                break;
        }
        player.data.set('activeFilter', filterName);
        return true;
    } catch (e) {
        console.warn('⚠️ Could not apply Lavalink filter:', e.message);
        return false;
    }
}

function createMusicManager(client) {
    if (client.manager) return client.manager;

    const manager = new Kazagumo({
        defaultSearchEngine: "soundcloud",
        searchFallbacks: { 
            spotify: "scsearch", 
            soundcloud: "scsearch", 
            youtube: "scsearch" 
        },
        plugins: [
            new KazagumoSpotify({ 
                clientId: process.env.SPOTIFY_CLIENT_ID || 'dummy_id', 
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'dummy_secret', 
                playlistPageLimit: 5, 
                albumPageLimit: 3, 
                searchMarket: 'US', 
                searchPrefix: 'scsearch:' 
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
            const allNodes = Array.from(nodes.values());
            const readyNodes = allNodes.filter(node => node.state === 1);
            if (readyNodes.length > 0) {
                return readyNodes.reduce((prev, current) => {
                    const prevLoad = prev.stats?.cpu?.lavalinkLoad || 0;
                    const currentLoad = current.stats?.cpu?.lavalinkLoad || 0;
                    return prevLoad < currentLoad ? prev : current;
                });
            }
            return allNodes[0] || null;
        }
    });

    manager.shoukaku.on('ready', (name) => {
        console.log(`✅ [Lavalink Active] (${client.user ? client.user.username : 'Bot'}) Connected to: ${name}`);
    });

    manager.shoukaku.on('error', (name, error) => {
        console.warn(`⚠️ [Lavalink Failover] (${client.user ? client.user.username : 'Bot'}) Node [${name}] notice`);
    });

    manager.shoukaku.on('disconnect', (name, count) => {
        console.warn(`⚠️ [Lavalink] Node [${name}] disconnected (Retry: ${count})`);
    });

    // Player Start Event
    manager.on('playerStart', async (player, track) => {
        player.data.set('previousTrack', track);

        const channel = client.channels.cache.get(player.textId);
        const interaction = player.data.get('interaction');
        player.data.delete('interaction');

        try {
            const guild = client.guilds.cache.get(player.guildId);
            if (guild && client.vcLocks && client.vcLocks.get(guild.id)) {
                const voiceChannel = guild.channels.cache.get(player.voiceId);
                if (voiceChannel) {
                    await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }).catch(() => {});
                }
            }
        } catch (lockErr) {}

        const formatTime = (ms) => {
            if (!ms || isNaN(ms)) return '0:00';
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
        };

        const oldMsg = player.data.get('nowPlayingMessage');
        if (oldMsg) {
            await oldMsg.delete().catch(() => {});
            player.data.delete('nowPlayingMessage');
        }

        const fallbackThumb = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
        const trackThumb = (track.thumbnail && !track.thumbnail.includes('imgur.com'))
            ? track.thumbnail
            : (client.user?.displayAvatarURL({ dynamic: true }) || fallbackThumb);

        const activeFilter = player.data.get('activeFilter') || 'Clear';

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ 
                name: `Now Playing • ${client.user ? client.user.username : 'Music Bot'}`, 
                iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' 
            })
            .setTitle(track.title ? track.title.substring(0, 95) : 'Audio Track')
            .setURL(track.uri || 'https://discord.gg')
            .setThumbnail(trackThumb)
            .setDescription(
                `ℹ️ **Song Details**\n` +
                `▶️ **Status:** Playing | ⚙️ **Loop:** ${player.loop === 'none' ? 'Off' : player.loop === 'track' ? '🔂 Track' : '🔁 Queue'}\n` +
                `🕒 **Duration:** ${track.isStream ? '🔴 LIVE' : formatTime(track.length)} | 🔊 **Volume:** ${player.volume || 100}%\n` +
                `👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}\n` +
                `🌐 **Source:** ${track.sourceName ? track.sourceName.charAt(0).toUpperCase() + track.sourceName.slice(1) : 'Soundcloud'}\n` +
                `🔠 **Queue:** \`${player.queue.length}\` songs in queue\n\n` +
                `⚙️ **Playback & Filters (1-Year Response Lifetime)**\n` +
                `Use the interactive controls below to manage your audio session.`
            )
            .setFooter({ text: `Starry Music Engine • Bot: ${client.user ? client.user.tag : 'Starry'}`, iconURL: client.user ? client.user.displayAvatarURL() : undefined });

        const components = buildNowPlayingComponents();
        const messageData = { embeds: [embed], components };

        try {
            if (interaction) {
                await interaction.editReply(messageData).catch(() => {});
            } else if (channel) {
                const msg = await channel.send(messageData).catch(() => {});
                if (msg) player.data.set('nowPlayingMessage', msg);
            }
        } catch (e) {
            if (channel) {
                const msg = await channel.send(messageData).catch(() => {});
                if (msg) player.data.set('nowPlayingMessage', msg);
            }
        }
    });

    manager.on('playerException', async (player, track, exception) => {
        console.warn('⚠️ [Music Player Exception]:', exception?.message || exception || 'Node failover event');
        if (player && player.queue && player.queue.length > 0) {
            player.skip();
        }
    });

    manager.on('playerEmpty', async player => {
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
                    let result = await manager.search(searchQuery, { requester: previousTrack.requester });

                    if (!result || !result.tracks || !result.tracks.length) {
                        const fallbackQuery = `scsearch:${previousTrack.author || ''} ${previousTrack.title} related`;
                        result = await manager.search(fallbackQuery, { requester: previousTrack.requester });
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

        // Clean up now playing message
        const oldMsg = player.data.get('nowPlayingMessage');
        if (oldMsg) {
            await oldMsg.delete().catch(() => {});
            player.data.delete('nowPlayingMessage');
        }

        if (channel) {
            channel.send('📭 **The queue has ended.** Use `,play <song>` to queue more music!').catch(() => {});
        }
    });

    client.manager = manager;
    return manager;
}

module.exports = {
    Nodes,
    createMusicManager,
    buildNowPlayingComponents,
    applyKazagumoFilter
};
