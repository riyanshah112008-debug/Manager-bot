'use strict';

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { createDjRecommendations } = require('../../utils/aiMusicDj');

const EPHEMERAL = MessageFlags?.Ephemeral ?? 64;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dj')
        .setDescription('✨ Ask Starry AI DJ to curate music for your mood')
        .addStringOption(option => option
            .setName('mood')
            .setDescription('Mood, genre, activity, or artists you like')
            .setMaxLength(240)
            .setRequired(true))
        .addIntegerOption(option => option
            .setName('tracks')
            .setDescription('Number of songs to queue (1–8)')
            .setMinValue(1)
            .setMaxValue(8)
            .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply({ flags: [EPHEMERAL] });
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) return interaction.editReply('Join a voice channel first, then ask Starry DJ to curate your music.');
        const manager = client.manager;
        if (!manager || typeof manager.search !== 'function') {
            return interaction.editReply('The music search engine is temporarily unavailable. Please try again shortly.');
        }

        try {
            const mood = interaction.options.getString('mood', true);
            const count = interaction.options.getInteger('tracks') || 5;
            const recommendations = await createDjRecommendations(mood, { limit: count });
            let player = manager.getPlayer(interaction.guildId);
            if (!player) {
                player = await manager.createPlayer({
                    guildId: interaction.guildId,
                    voiceId: voiceChannel.id,
                    textId: interaction.channelId,
                    deaf: true
                });
            } else if (player.voiceId !== voiceChannel.id) {
                player.setVoiceChannel(voiceChannel.id);
            }

            const queued = [];
            for (const recommendation of recommendations) {
                try {
                    const result = await manager.search('ytmsearch:' + recommendation.query, { requester: interaction.user });
                    const track = result?.tracks?.[0];
                    if (!track) continue;
                    player.queue.add(track);
                    queued.push({ title: track.title || recommendation.query, artist: track.author || 'Unknown artist', reason: recommendation.reason });
                } catch (_) {}
            }
            if (queued.length && !player.playing && !player.paused) await player.play();

            const embed = new EmbedBuilder()
                .setColor('#8B5CF6')
                .setTitle('✨ Starry AI DJ')
                .setDescription(queued.length
                    ? 'Curated for **' + mood.slice(0, 180) + '**\n\n' + queued.map((track, index) => '**' + (index + 1) + '. ' + track.title.slice(0, 90) + '** — ' + track.artist.slice(0, 70) + (track.reason ? '\n*' + track.reason + '*' : '')).join('\n\n')
                    : 'I could not resolve those recommendations into playable tracks. Try a different mood or artist.')
                .setFooter({ text: 'AI recommendations • playback uses your configured music sources' });
            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[AI DJ] Recommendation failed:', error.message);
            return interaction.editReply('AI DJ could not create a mix right now. Please try again in a moment.');
        }
    }
};
