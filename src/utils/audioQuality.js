'use strict';

const DISCORD_GUILD_BITRATE_CAPS = Object.freeze([96000, 128000, 256000, 384000]);
const FREE_ENCODER_BITRATE = 128000;
const PREMIUM_ENCODER_BITRATE = 384000;

function getDiscordGuildBitrateCap(guildTier, maximumBitrate) {
    const tier = Number.isInteger(Number(guildTier)) ? Number(guildTier) : 0;
    const tierCap = DISCORD_GUILD_BITRATE_CAPS[tier] || DISCORD_GUILD_BITRATE_CAPS[0];
    const reportedCap = Number(maximumBitrate);
    return Math.min(384000, reportedCap > 0 ? reportedCap : tierCap, tierCap);
}

function resolveAudioQuality({ premium = false, guildTier = 0, guildMaximumBitrate, channelBitrate } = {}) {
    const guildCap = getDiscordGuildBitrateCap(guildTier, guildMaximumBitrate);
    const reportedChannelCap = Number(channelBitrate);
    const channelCap = reportedChannelCap > 0 ? Math.min(reportedChannelCap, guildCap) : guildCap;
    const encoderTarget = premium ? PREMIUM_ENCODER_BITRATE : FREE_ENCODER_BITRATE;
    const bitrateKbps = Math.floor(Math.max(16000, Math.min(encoderTarget, guildCap, channelCap)) / 1000);
    return {
        bitrateKbps,
        bitrate: bitrateKbps * 1000,
        premium: Boolean(premium),
        label: `${bitrateKbps} kbps${premium ? ' • Premium' : ''}`
    };
}

module.exports = { getDiscordGuildBitrateCap, resolveAudioQuality };
