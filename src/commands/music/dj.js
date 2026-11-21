'use strict';

const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require('discord.js');
const { createMusicDJPlan } = require('../../utils/openAIMusicDJ');
const { StarryAudioEngine } = require('../../utils/nativeAudioEngine');
const { applyPremiumVoiceBitrate } = require('../../utils/musicManager');
const { setStayConnected } = require('../../utils/musicStayConnected');

const EPHEMERAL_FLAG = MessageFlags?.Ephemeral ?? 64;
const MAX_TRACKS = 5;

function isLavalinkReady(manager) {
    return Boolean(
        manager?.shoukaku?.nodes &&
        Array.from(manager.shoukaku.nodes.values()).some(node => node.state === 1)
    );
}

function uniqueTracks(tracks) {
    const seen = new Set();
    return (tracks || []).filter(track => {
        const key = String(track?.identifier || track?.uri || track?.url || track?.title || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

module.exports = {
    category: 'Music',
    nativeInteraction: true,
    timeout: 60_000,
    data: new SlashCommandBuilder()
        .setName('dj')
        .setDescription('🎧 Let Starry AI DJ build and continuously play a mix for your mood.')
        .addStringOption(option => option
            .setName('request')
            .setDescription('Describe a mood, genre, activity, era, artist, or mix.')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(400)),

    async execute(interaction, client) {
        const request = interaction.options.getString('request', true).trim();
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: 'Join a voice channel first, then ask Starry DJ to build your mix.',
                flags: [EPHEMERAL_FLAG]
            });
        }

        const botMember = interaction.guild?.members?.me;
        const permissions = voiceChannel.permissionsFor(botMember);
        if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions?.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({
                content: 'Starry needs Connect and Speak permissions in your voice channel.',
                flags: [EPHEMERAL_FLAG]
            });
        }

        await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });
        const plan = await createMusicDJPlan({ request, limit: MAX_TRACKS });
        if (!plan) {
            return interaction.editReply({
                content: 'AI DJ is not available yet. Configure OPENAI_API_KEY on the Starry backend (and optionally OPENAI_MUSIC_MODEL), then try again. Regular /play and autoplay continue working without it.'
            });
        }

        const manager = client.manager;
        const requester = interaction.user;
        const queued = [];
        const errors = [];
        const useLavalink = isLavalinkReady(manager);

        if (useLavalink) {
            try {
                let player = manager.getPlayer(interaction.guildId);
                if (player?.voiceId && player.voiceId !== voiceChannel.id) {
                    return interaction.editReply('Starry is already playing in another voice channel. Join that channel first.');
                }
                if (!player) {
                    player = await manager.createPlayer({
                        guildId: interaction.guildId,
                        voiceId: voiceChannel.id,
                        textId: interaction.channelId,
                        deaf: true
                    });
                }
                for (const recommendation of plan.recommendations) {
                    try {
                        const result = await manager.search(`ytmsearch:${recommendation.search_query}`, { requester });
                        const track = result?.tracks?.[0];
                        if (track) queued.push(track);
                        else errors.push(recommendation.search_query);
                    } catch (_) {
                        errors.push(recommendation.search_query);
                    }
                    if (queued.length >= MAX_TRACKS) break;
                }
                if (!queued.length) {
                    return interaction.editReply('Starry could not resolve any tracks from that mix. Try a more specific mood, artist or genre.');
                }

                setStayConnected(player, true);
                player.data.set('djMode', true);
                player.data.set('djRequest', request);
                player.data.set('autoplay', true);
                player.data.set('activeFilter', player.data.get('activeFilter') || 'empowering');
                player.autoplay = true;
                for (const track of uniqueTracks(queued)) player.queue.add(track);
                if (!player.playing && !player.paused) await player.play();
            } catch (error) {
                console.warn('[Starry AI DJ] Lavalink setup failed:', error.message || error);
                return interaction.editReply('The music engine could not start the AI mix. Please try /dj again in a moment.');
            }
        } else {
            let player;
            try {
                player = StarryAudioEngine.getOrCreatePlayer(client, interaction.guildId, voiceChannel, interaction.channel);
                setStayConnected(player, true);
                player.djRequest = request;
                player.djMode = true;
                await player.connect();
                for (const recommendation of plan.recommendations) {
                    try {
                        const result = await StarryAudioEngine.search(recommendation.search_query, requester);
                        const track = result?.tracks?.[0];
                        if (track) queued.push(track);
                        else errors.push(recommendation.search_query);
                    } catch (_) {
                        errors.push(recommendation.search_query);
                    }
                    if (queued.length >= MAX_TRACKS) break;
                }
                if (!queued.length) {
                    return interaction.editReply('Starry could not resolve any tracks from that mix. Try a more specific mood, artist or genre.');
                }
                const seen = new Set(player.queue.map(track => track.identifier || track.url || track.title));
                for (const track of queued) {
                    const key = track.identifier || track.url || track.title;
                    if (key && !seen.has(key)) {
                        seen.add(key);
                        player.queue.push(track);
                    }
                }
                if (!player.currentTrack) player.playNext().catch(error => console.warn('[Starry AI DJ] Native start error:', error.message || error));
            } catch (error) {
                console.warn('[Starry AI DJ] Native engine setup failed:', error.message || error);
                return interaction.editReply('The music engine could not start the AI mix. Please try /dj again in a moment.');
            }
        }

        applyPremiumVoiceBitrate({ guildId: interaction.guildId, voiceId: voiceChannel.id }, client).catch(() => {});
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🎧 Starry AI DJ • ${plan.mood || 'Your mix'}`)
            .setDescription(`${plan.summary}\n\n${queued.map((track, index) => `**${index + 1}.** ${track.title || track.name || 'Recommended track'} — ${track.author || track.artist || 'Artist'}`).join('\n')}\n\n**AI autoplay + 24/7 stay-connected are enabled.** Starry will keep the mix going with verified provider results. Use `/stay` to disable stay-connected or `/stop` to leave.`)
            .setFooter({ text: `Requested by ${requester.tag} • Manual Equalizer remains available` });
        return interaction.editReply({ embeds: [embed] });
    }
};
