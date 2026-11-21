'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { StarryAudioEngine } = require('../../utils/nativeAudioEngine');
const { isStayConnected, setStayConnected } = require('../../utils/musicStayConnected');

const EPHEMERAL_FLAG = MessageFlags?.Ephemeral ?? 64;

module.exports = {
    name: 'stay',
    aliases: ['247', 'alwayson'],
    category: 'Music',
    description: 'Keep Starry in voice and continue with smart autoplay.',
    usage: 'stay',
    data: new SlashCommandBuilder()
        .setName('stay')
        .setDescription('Toggle 24/7 voice mode with automatic continuous music.'),

    async execute(context, args, client) {
        const guild = context.guild;
        if (!guild?.id) {
            return context.reply({ content: 'This command can only be used in a server.', flags: [EPHEMERAL_FLAG] });
        }

        const voiceChannel = context.member?.voice?.channel;
        let kazagumoPlayer = client.manager?.getPlayer?.(guild.id) || null;
        if (!kazagumoPlayer && client.multiBot?.instances) {
            for (const instance of client.multiBot.instances.values()) {
                const candidate = instance.client?.manager?.getPlayer?.(guild.id);
                if (candidate) { kazagumoPlayer = candidate; break; }
            }
        }

        let nativePlayer = StarryAudioEngine.getPlayer(guild.id, client);
        let player = kazagumoPlayer || nativePlayer;
        if (player && isStayConnected(player)) {
            setStayConnected(player, false);
            try {
                const controller = require('../../modules/musicController');
                await controller.update(guild.id, client).catch(() => {});
            } catch (_) {}
            return context.reply({ content: '24/7 mode disabled. Starry will no longer auto-continue after the queue ends.' });
        }

        if (!voiceChannel) {
            return context.reply({ content: 'Join a voice channel first to enable 24/7 mode.', flags: [EPHEMERAL_FLAG] });
        }
        if (!player) {
            nativePlayer = StarryAudioEngine.getOrCreatePlayer(client, guild.id, voiceChannel, context.channel);
            player = nativePlayer;
        }
        if (kazagumoPlayer && kazagumoPlayer.voiceId && kazagumoPlayer.voiceId !== voiceChannel.id) {
            return context.reply({ content: 'Starry is already active in another voice channel. Join that channel first.', flags: [EPHEMERAL_FLAG] });
        }

        setStayConnected(player, true);
        if (nativePlayer && player === nativePlayer) {
            await nativePlayer.connect();
            if (!nativePlayer.currentTrack && nativePlayer.queue.length === 0 && nativePlayer.previousTrack) {
                nativePlayer.playNext().catch(() => {});
            }
        } else if (kazagumoPlayer) {
            const { triggerAutoplayBuffer } = require('../../utils/musicManager');
            if (kazagumoPlayer.queue?.length === 0 && !kazagumoPlayer.playing) {
                triggerAutoplayBuffer(kazagumoPlayer, true).catch(() => {});
            }
        }

        try {
            const controller = require('../../modules/musicController');
            await controller.update(guild.id, client).catch(() => {});
        } catch (_) {}

        return context.reply({
            content: '24/7 mode enabled. Starry will stay in this voice channel, automatically continue with recommended music after the queue ends, and remain connected while idle. Use /stay again to disable or /stop to leave.'
        });
    }
};