'use strict';

const PUBLIC_SERVER_PROJECTION = 'guildId name description iconUrl inviteLink memberCount tags bumps lastBump -_id';

function buildPublicServerFilter() {
    return { isListed: true, isNsfw: false };
}

function safeDiscordInvite(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
        if (url.hostname === 'discord.gg' && /^\/[A-Za-z0-9-]+\/?$/.test(url.pathname)) return url.href;
        if ((url.hostname === 'discord.com' || url.hostname === 'www.discord.com') &&
            /^\/invite\/[A-Za-z0-9-]+\/?$/.test(url.pathname)) return url.href;
    } catch (_) {}
    return null;
}

function safeDiscordIcon(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value);
        if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
            (url.hostname === 'cdn.discordapp.com' || url.hostname === 'media.discordapp.net')) {
            return url.href;
        }
    } catch (_) {}
    return null;
}

function safeCount(value) {
    const count = Number(value);
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function toPublicServerListing(record) {
    const item = record && typeof record === 'object' ? record : {};
    const tags = Array.isArray(item.tags)
        ? item.tags.filter(tag => typeof tag === 'string').slice(0, 20).map(tag => tag.slice(0, 32))
        : [];
    const lastBumpDate = item.lastBump ? new Date(item.lastBump) : null;

    return {
        guildId: typeof item.guildId === 'string' && /^\d{17,20}$/.test(item.guildId) ? item.guildId : '',
        name: typeof item.name === 'string' ? item.name.slice(0, 100) : '',
        description: typeof item.description === 'string' ? item.description.slice(0, 500) : '',
        iconUrl: safeDiscordIcon(item.iconUrl),
        inviteLink: safeDiscordInvite(item.inviteLink),
        memberCount: safeCount(item.memberCount),
        tags,
        bumps: safeCount(item.bumps),
        lastBump: lastBumpDate && Number.isFinite(lastBumpDate.getTime()) ? lastBumpDate.toISOString() : null
    };
}

module.exports = {
    PUBLIC_SERVER_PROJECTION,
    buildPublicServerFilter,
    toPublicServerListing,
    safeDiscordInvite,
    safeDiscordIcon
};
