'use strict';

const PUBLIC_SERVER_PROJECTION = 'guildId name description iconUrl inviteLink memberCount tags bumps lastBump -_id';

function directoryInputError(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function normalizeSearchTerm(value) {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value !== 'string') throw directoryInputError('Search query must be text.');
    const term = value.trim();
    if (term.length > 80) throw directoryInputError('Search query must be 80 characters or fewer.');
    return term;
}

function escapeRegexLiteral(value) {
    return value.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
}

function buildPublicServerFilter(searchValue) {
    const filter = { isListed: true, isNsfw: false };
    const term = normalizeSearchTerm(searchValue);
    if (term) {
        const literal = escapeRegexLiteral(term);
        filter.$or = [
            { name: { $regex: literal, $options: 'i' } },
            { tags: { $in: [term.toLowerCase()] } },
            { description: { $regex: literal, $options: 'i' } }
        ];
    }
    return filter;
}

function normalizeDirectoryInteger(value, fallback, maximum, label) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string' || !/^\d{1,6}$/.test(value)) {
        throw directoryInputError(label + ' must be a positive integer.');
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        throw directoryInputError(label + ' must be a positive integer.');
    }
    return Math.min(parsed, maximum);
}

function normalizeDirectoryPagination(pageValue, limitValue) {
    const page = normalizeDirectoryInteger(pageValue, 1, 1000, 'Page');
    const limit = normalizeDirectoryInteger(limitValue, 12, 50, 'Limit');
    return { page, limit, skip: (page - 1) * limit };
}

function normalizeRecentlyBumpedLimit(value) {
    return normalizeDirectoryInteger(value, 6, 12, 'Limit');
}

function normalizeDirectorySort(value) {
    if (value === undefined || value === null || value === '' || value === 'bumped') return { lastBump: -1 };
    if (value === 'members') return { memberCount: -1 };
    if (value === 'newest') return { _id: -1 };
    throw directoryInputError('Sort must be bumped, members, or newest.');
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
    normalizeSearchTerm,
    escapeRegexLiteral,
    normalizeDirectoryPagination,
    normalizeRecentlyBumpedLimit,
    normalizeDirectorySort,
    toPublicServerListing,
    safeDiscordInvite,
    safeDiscordIcon
};
