const { StarryAudioEngine } = require('./nativeAudioEngine');

function playerVoiceId(player) {
    return player?.voiceId || player?.voiceChannel?.id || player?.connection?.joinConfig?.channelId || null;
}

function isActiveMusicPlayer(player) {
    if (!player || player.destroyed) return false;
    const queueLength = Array.isArray(player.queue) ? player.queue.length : Number(player.queue?.length || 0);
    return Boolean(
        player.currentTrack ||
        player.queue?.current ||
        player.playing ||
        player.paused ||
        player.isPlaying ||
        queueLength > 0
    );
}

function selectActiveMusicPlayer(candidates, guildVoiceId = null) {
    const unique = [];
    const seen = new Set();
    for (const candidate of candidates || []) {
        if (!candidate?.player || seen.has(candidate.player)) continue;
        seen.add(candidate.player);
        unique.push(candidate);
    }

    const active = unique.filter(candidate => isActiveMusicPlayer(candidate.player));
    if (guildVoiceId) {
        const matching = active.find(candidate => playerVoiceId(candidate.player) === guildVoiceId);
        if (matching) return matching.player;
    }

    const connected = active.find(candidate => playerVoiceId(candidate.player));
    return (connected || active[0] || unique[0])?.player || null;
}

function getActiveMusicPlayer(guildId, client) {
    if (!guildId) return null;
    const candidates = [];
    const add = (player, botClient = client) => {
        if (player) candidates.push({ player, botClient });
    };

    try { add(client?.multiBot?.getPlayerForGuild?.(guildId)); } catch (_) {}
    try { add(StarryAudioEngine.getPlayer(guildId, client)); } catch (_) {}
    try { add(client?.manager?.getPlayer?.(guildId)); } catch (_) {}

    const workers = client?.multiBot?.instances;
    if (workers && typeof workers.values === 'function') {
        for (const info of workers.values()) {
            const workerClient = info?.client;
            if (!workerClient) continue;
            try { add(workerClient.manager?.getPlayer?.(guildId), workerClient); } catch (_) {}
            try { add(StarryAudioEngine.getPlayer(guildId, workerClient), workerClient); } catch (_) {}
        }
    }

    const primaryGuild = client?.guilds?.cache?.get(guildId);
    const guildVoiceId = primaryGuild?.members?.me?.voice?.channelId || null;
    const selected = selectActiveMusicPlayer(candidates, guildVoiceId);
    if (selected) return selected;

    return null;
}

module.exports = {
    getActiveMusicPlayer,
    isActiveMusicPlayer,
    selectActiveMusicPlayer
};
