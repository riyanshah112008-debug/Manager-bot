// ==========================================
// 🎵 STARRY DEDICATED MUSIC CONTROLLER SYSTEM
// File Path: src/modules/musicController.js
// Interactive Request Channel • Real-time Status Synchronization • Direct Song Requests
// ==========================================
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const MusicController = require('../models/MusicController');
const { StarryAudioEngine, formatTime } = require('../utils/nativeAudioEngine');

const EPHEMERAL_FLAG = (MessageFlags && MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 64;
const BANNER_PATH = path.join(__dirname, '../assets/mascot/starry_music_banner.jpg');

class MusicControllerEngine {
    constructor() {
        this.cache = new Map(); // guildId -> { channelId, messageId, bannerUrl }
        this.updateTimeouts = new Map();
        this.initialized = false;
    }

    async init(client) {
        if (this.initialized) return;
        try {
            const configs = await MusicController.find({}).lean();
            for (const cfg of configs) {
                this.cache.set(cfg.guildId, {
                    channelId: cfg.channelId,
                    messageId: cfg.messageId,
                    bannerUrl: cfg.bannerUrl || ''
                });
            }
            this.initialized = true;
            console.log(`🎵 [Music Controller] Loaded ${this.cache.size} dedicated request channels into RAM cache.`);
        } catch (err) {
            console.warn('⚠️ [Music Controller Init Notice]:', err.message || err);
        }
    }

    isRequestChannel(guildId, channelId) {
        if (!guildId || !channelId) return false;
        const config = this.cache.get(guildId);
        return config && config.channelId === channelId;
    }

    getConfig(guildId) {
        return this.cache.get(guildId) || null;
    }

    buildComponents(player) {
        const isPlaying = !!(player && player.currentTrack);
        const isPaused = !!(player && player.paused);
        const isAutoplay = !!(player && player.autoplay);

        // Row 1: Playback Navigation
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ctrl_vol_down')
                .setEmoji('🔉')
                .setLabel('Down')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_previous')
                .setEmoji('⏮️')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_pause_resume')
                .setEmoji(isPaused ? '▶️' : '⏸️')
                .setLabel(isPaused ? 'Resume' : 'Pause')
                .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('ctrl_skip')
                .setEmoji('⏭️')
                .setLabel('Skip')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_vol_up')
                .setEmoji('🔊')
                .setLabel('Up')
                .setStyle(ButtonStyle.Secondary)
        );

        // Row 2: Queue & Session Options
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ctrl_shuffle')
                .setEmoji('🔀')
                .setLabel('Shuffle')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_autoplay')
                .setEmoji('🔄')
                .setLabel('AutoPlay')
                .setStyle(isAutoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_stop')
                .setEmoji('⏹️')
                .setLabel('Stop')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('ctrl_dashboard')
                .setEmoji('🎛️')
                .setLabel('Dashboard')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_queue')
                .setEmoji('📜')
                .setLabel('Queue')
                .setStyle(ButtonStyle.Secondary)
        );

        // Row 3: Curation & Connection Controls
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ctrl_like')
                .setEmoji('❤️')
                .setLabel('Like')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_dislike')
                .setEmoji('👎')
                .setLabel('Not for me')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_block')
                .setEmoji('🚫')
                .setLabel('Block')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_next_up')
                .setEmoji('🔮')
                .setLabel("What's next?")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_connect')
                .setEmoji('▶️')
                .setLabel('Connect Bot')
                .setStyle(ButtonStyle.Success)
        );

        // Row 4: Audio DSP Filter Dropdown
        const filterMenu = new StringSelectMenuBuilder()
            .setCustomId('ctrl_filter')
            .setPlaceholder('🎧 Select Audio Filter / Sound FX...')
            .addOptions([
                { label: 'Empowering Master (Hi-Fi)', description: 'Default dynamic warmth & vocal presence', value: 'empowering', emoji: '👑' },
                { label: 'True Vibration Bass', description: 'Deep physical vibrating sub-bass (Vocals intact)', value: 'bassboost', emoji: '📳' },
                { label: 'Deep 808 Sub-Bass', description: 'Sub-bass emphasis for EDM, Rap & Phonk', value: 'deepbass', emoji: '🔊' },
                { label: 'Earthquake Vibration', description: 'Maximum physical rumble (Air vibration)', value: 'vibrate', emoji: '🌋' },
                { label: 'Flat / Pure Neutral', description: 'Raw uncolored original studio sound', value: 'flat', emoji: '🚫' },
                { label: '8D Spatial Audio', description: '360° rotating spatial surround sound', value: '8d', emoji: '🌀' },
                { label: 'Pop & Vocal Clarity', description: 'Enhanced vocal presence and acoustic sheen', value: 'pop', emoji: '📻' },
                { label: 'Treble Boost', description: 'Crisp, crystal clear high frequencies', value: 'treble', emoji: '🔊' },
                { label: 'Nightcore', description: 'Sped up tempo + higher pitch aesthetic', value: 'nightcore', emoji: '✨' },
                { label: 'Daycore / Slowed', description: 'Slowed down tempo + deeper tone', value: 'daycore', emoji: '🌅' },
                { label: 'Vaporwave', description: 'Slowed reverb + retro cassette feel', value: 'vaporwave', emoji: '🪩' }
            ]);

        const row4 = new ActionRowBuilder().addComponents(filterMenu);

        // Row 5: Premium, Vote & Links
        const row5 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ctrl_premium')
                .setEmoji('⭐')
                .setLabel('Premium')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('ctrl_vote')
                .setEmoji('👍')
                .setLabel('Vote')
                .setStyle(ButtonStyle.Secondary)
        );

        return [row1, row2, row3, row4, row5];
    }

    buildEmbed(player, client) {
        const track = player?.currentTrack;

        if (track) {
            const filterName = (player.filter === 'clear' || !player.filter || player.filter === 'empowering')
                ? 'Empowering Master (Hi-Fi)'
                : player.filter.toUpperCase();

            const fallbackThumb = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80';
            const trackThumb = (track.thumbnail && !track.thumbnail.includes('imgur.com')) 
                ? track.thumbnail 
                : fallbackThumb;

            return new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('Music Controller')
                .setDescription(
                    `▶️ **[${(track.title || 'Audio Track').substring(0, 75)}](${track.url || 'https://discord.gg'})**\n\n` +
                    `👤 **Artist:** \`${track.author || 'Featured Artist'}\`\n` +
                    `🕒 **Duration:** \`${formatTime(track.duration)}\` | 🔊 **Volume:** \`${player.volume}%\`\n` +
                    `👤 **Requester:** ${track.requester ? `<@${track.requester.id}>` : 'Unknown'}\n` +
                    `🌐 **Source:** \`${track.source || 'Studio Master'}\` | 🎛️ **Master:** \`${filterName}\`\n` +
                    `🔠 **Queue:** \`${player.queue.length}\` songs in queue\n\n` +
                    `*Send any song name or link in this channel to add to queue!*`
                )
                .setImage(trackThumb)
                .setFooter({ 
                    text: `Starry Controller System • Bot: ${client?.user?.tag || 'Starry'}`,
                    iconURL: client?.user?.displayAvatarURL() || undefined
                });
        }

        // Idle / Waiting for music State
        return new EmbedBuilder()
            .setColor('#2B2D31')
            .setTitle('Music Controller')
            .setDescription(
                `Waiting for music...\n` +
                `Send the name or link of a music`
            )
            .setImage('attachment://starry_music_banner.jpg')
            .setFooter({ 
                text: 'Starry Controller System',
                iconURL: client?.user?.displayAvatarURL() || undefined
            });
    }

    async update(guildId, client) {
        if (!guildId || !client) return;

        // Throttle updates to avoid hitting Discord rate limits
        if (this.updateTimeouts.has(guildId)) {
            clearTimeout(this.updateTimeouts.get(guildId));
        }

        const timeout = setTimeout(async () => {
            this.updateTimeouts.delete(guildId);
            await this._performUpdate(guildId, client).catch(() => {});
        }, 300);

        this.updateTimeouts.set(guildId, timeout);
    }

    async _performUpdate(guildId, client) {
        const config = this.cache.get(guildId);
        if (!config || !config.channelId || !config.messageId) return;

        try {
            const channel = client.channels.cache.get(config.channelId) || 
                await client.channels.fetch(config.channelId).catch(() => null);
            if (!channel) return;

            const player = StarryAudioEngine.getPlayer(guildId);
            const embed = this.buildEmbed(player, client);
            const components = this.buildComponents(player);

            const message = await channel.messages.fetch(config.messageId).catch(() => null);
            if (message) {
                // If idle and banner needed, ensure attachment is referenced
                const editPayload = { embeds: [embed], components };
                await message.edit(editPayload).catch(() => {});
            } else {
                // Message was deleted, redeploy controller message
                const files = fs.existsSync(BANNER_PATH) ? [BANNER_PATH] : [];
                const newMsg = await channel.send({
                    embeds: [embed],
                    components,
                    files
                }).catch(() => null);

                if (newMsg) {
                    config.messageId = newMsg.id;
                    this.cache.set(guildId, config);
                    await MusicController.updateOne({ guildId }, { messageId: newMsg.id }).catch(() => {});
                }
            }
        } catch (err) {
            // Ignore transient network errors
        }
    }

    async setupChannel(guild, user, client) {
        // 1. Check if controller already exists
        let config = this.cache.get(guild.id);
        let channel = null;

        if (config && config.channelId) {
            channel = guild.channels.cache.get(config.channelId) || 
                await guild.channels.fetch(config.channelId).catch(() => null);
        }

        // 2. If channel doesn't exist, create it
        if (!channel) {
            channel = await guild.channels.create({
                name: '🎵・starry-music',
                type: ChannelType.GuildText,
                topic: '🎵 Starry Dedicated Music Controller — Send any song name or link to play instantly!',
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });
        }

        // 3. Purge existing bot messages in channel to guarantee a clean layout
        try {
            const msgs = await channel.messages.fetch({ limit: 25 }).catch(() => null);
            if (msgs && msgs.size > 0) {
                await channel.bulkDelete(msgs, true).catch(() => {});
            }
        } catch (e) {}

        // 4. Build embed and controller components
        const player = StarryAudioEngine.getPlayer(guild.id);
        const embed = this.buildEmbed(player, client);
        const components = this.buildComponents(player);
        const files = fs.existsSync(BANNER_PATH) ? [BANNER_PATH] : [];

        const controllerMessage = await channel.send({
            embeds: [embed],
            components,
            files
        });

        // 5. Persist configuration in database and memory
        const newConfig = {
            guildId: guild.id,
            channelId: channel.id,
            messageId: controllerMessage.id,
            bannerUrl: ''
        };

        await MusicController.findOneAndUpdate(
            { guildId: guild.id },
            newConfig,
            { upsert: true, new: true }
        );

        this.cache.set(guild.id, newConfig);
        return { channel, message: controllerMessage };
    }

    async handleSongRequest(message, client) {
        if (!message.guild || message.author.bot) return;

        const content = message.content.trim();
        if (!content) return;

        // Allow prefix command bypasses (e.g. ,setup, ,deletecontroller)
        if (content.startsWith(',') || content.startsWith('.')) return;

        // Instantly delete user message to keep the channel clean
        message.delete().catch(() => {});

        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            const temp = await message.channel.send({
                content: `❌ **${message.author}**, you must be connected to a voice channel first to request songs!`
            }).catch(() => null);
            if (temp) setTimeout(() => temp.delete().catch(() => {}), 4000);
            return;
        }

        // Check if track/artist is blocked in this server
        const dbConfig = await MusicController.findOne({ guildId: message.guild.id }).lean().catch(() => null);
        if (dbConfig && dbConfig.blockedTracks && dbConfig.blockedTracks.length > 0) {
            const lower = content.toLowerCase();
            const isBlocked = dbConfig.blockedTracks.some(b => lower.includes(b.query.toLowerCase()));
            if (isBlocked) {
                const temp = await message.channel.send({
                    content: `🚫 **This track or query is blocked in this server!**`
                }).catch(() => null);
                if (temp) setTimeout(() => temp.delete().catch(() => {}), 4000);
                return;
            }
        }

        // Get or initialize player
        const player = StarryAudioEngine.getOrCreatePlayer(client, message.guild.id, voiceChannel, message.channel);
        player.connect().catch(() => {});

        // Resolve track or playlist
        try {
            const result = await StarryAudioEngine.search(content, message.author);
            if (!result || !result.tracks || result.tracks.length === 0) {
                const temp = await message.channel.send({
                    content: `❌ No audio results found for: \`${content.substring(0, 50)}\``
                }).catch(() => null);
                if (temp) setTimeout(() => temp.delete().catch(() => {}), 4000);
                return;
            }

            if (result.type === 'PLAYLIST') {
                for (const t of result.tracks) {
                    player.queue.push(t);
                }
                if (!player.currentTrack) {
                    await player.playNext();
                }

                const temp = await message.channel.send({
                    content: `📚 **Enqueued Playlist:** \`${(result.playlistName || 'Playlist').substring(0, 45)}\` (**${result.tracks.length}** tracks) • ${message.author}`
                }).catch(() => null);
                if (temp) setTimeout(() => temp.delete().catch(() => {}), 4000);
            } else {
                const track = result.tracks[0];
                player.queue.push(track);
                if (!player.currentTrack) {
                    await player.playNext();
                }

                const temp = await message.channel.send({
                    content: `🎵 **Added to Queue:** \`${track.title.substring(0, 55)}\` • ${message.author}`
                }).catch(() => null);
                if (temp) setTimeout(() => temp.delete().catch(() => {}), 3500);
            }

            // Sync controller embed
            await this.update(message.guild.id, client);

        } catch (err) {
            console.error('❌ [Music Controller Request Error]:', err);
            const temp = await message.channel.send({
                content: `⚠️ Failed to resolve song: \`${err.message || 'Stream error'}\``
            }).catch(() => null);
            if (temp) setTimeout(() => temp.delete().catch(() => {}), 4000);
        }
    }

    async handleButtonInteraction(interaction, client) {
        const customId = interaction.customId;
        const guildId = interaction.guild?.id;
        if (!guildId) return false;

        const player = StarryAudioEngine.getPlayer(guildId);
        const voiceChannel = interaction.member?.voice?.channel;

        // 1. Connect Bot
        if (customId === 'ctrl_connect') {
            if (!voiceChannel) {
                return interaction.reply({ 
                    content: '❌ You must be connected to a voice channel first!', 
                    flags: [EPHEMERAL_FLAG] 
                }).catch(() => {});
            }
            const p = StarryAudioEngine.getOrCreatePlayer(client, guildId, voiceChannel, interaction.channel);
            await p.connect().catch(() => {});
            await this.update(guildId, client);
            return interaction.reply({ 
                content: `👋 **Connected to voice channel:** <#${voiceChannel.id}>`, 
                flags: [EPHEMERAL_FLAG] 
            }).catch(() => {});
        }

        // 2. Queue Viewer
        if (customId === 'ctrl_queue') {
            if (!player || (!player.currentTrack && player.queue.length === 0)) {
                return interaction.reply({ content: '❌ Queue is currently empty.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
            }
            const current = player.currentTrack;
            const tracks = player.queue.slice(0, 10);
            let qList = tracks.map((t, idx) => `\`${idx + 1}.\` **${(t.title || 'Track').substring(0, 55)}** (\`${formatTime(t.duration)}\`)`).join('\n');
            if (!qList) qList = '*No upcoming songs.*';

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle(`🎵 Current Music Queue • ${player.queue.length} Tracks`)
                .setDescription(`▶️ **Now Playing:**\n**${current ? current.title : 'None'}**\n\n📜 **Upcoming Tracks:**\n${qList}`)
                .setFooter({ text: 'Starry Controller System' });

            return interaction.reply({ embeds: [embed], flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 3. What's Next
        if (customId === 'ctrl_next_up') {
            const nextTrack = player?.queue[0];
            if (!nextTrack) {
                return interaction.reply({ 
                    content: '🔮 **What\'s Next:** *No upcoming tracks in queue.* Send a song name in this channel to add more!', 
                    flags: [EPHEMERAL_FLAG] 
                }).catch(() => {});
            }
            return interaction.reply({ 
                content: `🔮 **What's Next:** \`${nextTrack.title}\` by \`${nextTrack.author || 'Artist'}\` (\`${formatTime(nextTrack.duration)}\`)`, 
                flags: [EPHEMERAL_FLAG] 
            }).catch(() => {});
        }

        // 4. Premium & Vote & Dashboard
        if (customId === 'ctrl_premium') {
            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setTitle('⭐ Starry Music Premium')
                .setDescription(
                    `Unlock the ultimate high-fidelity audio experience across all your servers!\n\n` +
                    `✨ **Features:**\n` +
                    `• **Physical Vibration Sub-Bass DSP** & 24/7 Mode\n` +
                    `• **Dedicated Worker Tokens** for 0s lag\n` +
                    `• **Spotify, SoundCloud & Web Resolution** with zero delay\n` +
                    `• **Global Autoplay Engine** with studio mastering\n\n` +
                    `Use \`,premium\` to view your tier or redeem an activation license.`
                )
                .setFooter({ text: 'Starry Premium System' });
            return interaction.reply({ embeds: [embed], flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        if (customId === 'ctrl_vote') {
            return interaction.reply({ 
                content: '🌟 **Thank you for supporting Starry!**\nVote for us on top bot listings to earn free rewards, stardust, and bonus playtime!', 
                flags: [EPHEMERAL_FLAG] 
            }).catch(() => {});
        }

        if (customId === 'ctrl_dashboard') {
            const host = process.env.PUBLIC_DOMAIN || 'http://localhost:10000';
            return interaction.reply({ 
                content: `🎛️ **Web Audio Dashboard:**\nAccess your live audio control panel at: ${host}`, 
                flags: [EPHEMERAL_FLAG] 
            }).catch(() => {});
        }

        // Active Player Guards
        if (!player || !player.currentTrack) {
            return interaction.reply({ content: '❌ No active music session playing right now.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be connected to a voice channel to use controller buttons!', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 5. Volume Down
        if (customId === 'ctrl_vol_down') {
            const newVol = Math.max(0, player.volume - 10);
            player.setVolume(newVol);
            await this.update(guildId, client);
            return interaction.reply({ content: `🔉 **Volume decreased to:** \`${newVol}%\``, flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 6. Volume Up
        if (customId === 'ctrl_vol_up') {
            const newVol = Math.min(200, player.volume + 10);
            player.setVolume(newVol);
            await this.update(guildId, client);
            return interaction.reply({ content: `🔊 **Volume increased to:** \`${newVol}%\``, flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 7. Pause / Resume
        if (customId === 'ctrl_pause_resume') {
            if (player.paused) {
                player.pause(false);
                await this.update(guildId, client);
                return interaction.reply({ content: '▶️ **Resumed audio playback!**', flags: [EPHEMERAL_FLAG] }).catch(() => {});
            } else {
                player.pause(true);
                await this.update(guildId, client);
                return interaction.reply({ content: '⏸️ **Paused audio playback!**', flags: [EPHEMERAL_FLAG] }).catch(() => {});
            }
        }

        // 8. Skip
        if (customId === 'ctrl_skip') {
            const skipped = player.currentTrack;
            player.skip();
            await this.update(guildId, client);
            return interaction.reply({ content: `⏭️ **Skipped:** \`${skipped.title.substring(0, 50)}\``, flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 9. Previous
        if (customId === 'ctrl_previous') {
            if (player.previous()) {
                await this.update(guildId, client);
                return interaction.reply({ content: '⏮️ **Playing previous song from history!**', flags: [EPHEMERAL_FLAG] }).catch(() => {});
            }
            return interaction.reply({ content: '❌ No previous song found in history.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 10. Shuffle
        if (customId === 'ctrl_shuffle') {
            player.shuffle();
            await this.update(guildId, client);
            return interaction.reply({ content: `🔀 **Shuffled ${player.queue.length} songs in queue!**`, flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 11. Autoplay
        if (customId === 'ctrl_autoplay') {
            player.autoplay = !player.autoplay;
            await this.update(guildId, client);
            return interaction.reply({ 
                content: `📻 **Autoplay Smart Stream is now: ${player.autoplay ? '🟢 ON' : '🔴 OFF'}**`, 
                flags: [EPHEMERAL_FLAG] 
            }).catch(() => {});
        }

        // 12. Stop
        if (customId === 'ctrl_stop') {
            player.stop();
            await this.update(guildId, client);
            return interaction.reply({ content: '⏹️ **Stopped music playback and cleared the queue.**', flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 13. Like Track
        if (customId === 'ctrl_like') {
            const track = player.currentTrack;
            try {
                const embed = new EmbedBuilder()
                    .setColor('#E91E63')
                    .setTitle(`❤️ Liked Track: ${track.title}`)
                    .setURL(track.url || 'https://discord.gg')
                    .setDescription(`👤 **Artist:** \`${track.author || 'Artist'}\`\n🕒 **Duration:** \`${formatTime(track.duration)}\`\n🌐 **Server:** \`${interaction.guild.name}\``)
                    .setThumbnail(track.thumbnail || null);
                await interaction.user.send({ embeds: [embed] }).catch(() => {});
                await MusicController.updateOne(
                    { guildId },
                    { $push: { likedTracks: { title: track.title, author: track.author, url: track.url, addedBy: interaction.user.id } } }
                ).catch(() => {});
                return interaction.reply({ content: `❤️ **Saved "${track.title}" to your Liked Songs and DMs!**`, flags: [EPHEMERAL_FLAG] }).catch(() => {});
            } catch (e) {
                return interaction.reply({ content: `❤️ Liked **${track.title}**!`, flags: [EPHEMERAL_FLAG] }).catch(() => {});
            }
        }

        // 14. Dislike / Not for me
        if (customId === 'ctrl_dislike') {
            const track = player.currentTrack;
            player.skip();
            await this.update(guildId, client);
            return interaction.reply({ content: `👎 **Skipped "${track.title}" (Marked: Not for me)**`, flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 15. Block Track
        if (customId === 'ctrl_block') {
            const track = player.currentTrack;
            await MusicController.updateOne(
                { guildId },
                { $push: { blockedTracks: { query: track.title, blockedBy: interaction.user.id } } }
            ).catch(() => {});
            player.skip();
            await this.update(guildId, client);
            return interaction.reply({ content: `🚫 **Blocked "${track.title}" from playing on this server.**`, flags: [EPHEMERAL_FLAG] }).catch(() => {});
        }

        // 16. DSP Filter Dropdown
        if (customId === 'ctrl_filter') {
            const selected = interaction.values[0] || 'empowering';
            await player.setFilter(selected);
            await this.update(guildId, client);
            return interaction.reply({ 
                content: `🎧 **Updated Audio DSP Filter:** \`${selected.toUpperCase()}\``, 
                flags: [EPHEMERAL_FLAG] 
            }).catch(() => {});
        }

        return false;
    }
}

const instance = new MusicControllerEngine();
module.exports = instance;
