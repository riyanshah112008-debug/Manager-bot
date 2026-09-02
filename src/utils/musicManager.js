const { Kazagumo } = require('kazagumo');
const { Connectors } = require('shoukaku');
const KazagumoSpotify = require('kazagumo-spotify');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

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
    }
];

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
        console.warn(`⚠️ [Lavalink Failover] (${client.user ? client.user.username : 'Bot'}) Node [${name}] error`);
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
            if (!ms) return '0:00';
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

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: `Now Playing • ${client.user ? client.user.username : 'Music Bot'}`, iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' })
            .setTitle(track.title)
            .setURL(track.uri)
            .setThumbnail(trackThumb)
            .setDescription(
                `ℹ️ **Song Details**\n▶️ **Status:** Playing\n⚙️ **Loop:** ${player.loop === 'none' ? 'Off' : player.loop === 'track' ? 'Track' : 'Queue'}\n🕒 **Duration:** ${track.isStream ? '🔴 LIVE' : formatTime(track.length)}\n👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}\n🌐 **Source:** ${track.sourceName ? track.sourceName.charAt(0).toUpperCase() + track.sourceName.slice(1) : 'Unknown'}\n🔠 **Queue:** ${player.queue.length} songs in queue\n\n⚙️ **Playback & Filters (1-Year Response Lifetime)**\nUse the interactive controls below to manage your audio session.`
            )
            .setFooter({ text: `Starry Music Engine • Bot: ${client.user ? client.user.tag : 'Starry'}`, iconURL: client.user ? client.user.displayAvatarURL() : undefined });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pause/Resume').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Loop').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('dj_shuffle').setEmoji('🔀').setLabel('Shuffle').setStyle(ButtonStyle.Secondary),
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
                { label: 'Vaporwave', description: 'Slowed + reverb style', value: 'vaporwave', emoji: '🪩' }
            ])
        );

        const messageData = { embeds: [embed], components: [row1, row2, filterRow] };

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
        console.warn('⚠️ [Music Player Exception]:', exception?.message || exception);
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
                        const fallbackQuery = `ytsearch:${previousTrack.author || ''} ${previousTrack.title} related`;
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

        if (channel) channel.send('📭 The queue has ended.').catch(() => {});
    });

    client.manager = manager;
    return manager;
}

module.exports = {
    Nodes,
    createMusicManager
};
