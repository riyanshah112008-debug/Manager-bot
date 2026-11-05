// Starry NSFW access and consent service.
const mongoose = require('mongoose');
const ServerSettings = require('../models/ServerSettings');
const UserSettings = require('../models/UserSettings');
const config = require('../config');
const dmNsfwCache = new Map();

function isStarryOwner(userId) {
    return Boolean(userId && typeof config.isBotOwner === 'function' && config.isBotOwner(String(userId)));
}

function canManageServerNsfw(userId, guild) {
    if (!guild || !userId) return false;
    return guild.ownerId === userId || isStarryOwner(userId);
}

async function readUserSettings(userId) {
    if (!userId || mongoose.connection?.readyState !== 1) return null;
    try { return await UserSettings.findOne({ userId }); }
    catch (error) { console.error('[NSFW] User preference lookup failed:', error.message); return null; }
}

async function isNsfwDmEnabled(userId) {
    if (!userId) return false;
    if (dmNsfwCache.has(userId)) return dmNsfwCache.get(userId);
    const settings = await readUserSettings(userId);
    const enabled = Boolean(settings?.nsfwDmEnabled);
    dmNsfwCache.set(userId, enabled);
    return enabled;
}

async function setNsfwDmEnabled(userId, enabled) {
    if (!userId) return false;
    const value = Boolean(enabled);
    dmNsfwCache.set(userId, value);
    if (mongoose.connection?.readyState === 1) {
        await UserSettings.findOneAndUpdate({ userId }, { $set: { nsfwDmEnabled: value } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    return value;
}

async function isSocialConsentEnabled(userId) {
    const settings = await readUserSettings(userId);
    return Boolean(settings?.nsfwSocialConsent);
}

async function setSocialConsent(userId, enabled) {
    if (!userId) return false;
    const value = Boolean(enabled);
    if (mongoose.connection?.readyState === 1) {
        await UserSettings.findOneAndUpdate({ userId }, { $set: { nsfwSocialConsent: value } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    return value;
}

async function toggleNsfwDm(userId) {
    return setNsfwDmEnabled(userId, !(await isNsfwDmEnabled(userId)));
}

async function isNsfwAllowed(ctx) {
    const userId = ctx.user?.id || ctx.author?.id;
    // The configured Starry owner can operate the suite without personal DM
    // opt-in or per-server enablement/channel configuration. Target consent remains mandatory.
    if (isStarryOwner(userId)) return true;

    const isDM = Boolean(ctx.isDM) || !ctx.guild ||
        Boolean(ctx.channel && typeof ctx.channel.isDMBased === 'function' && ctx.channel.isDMBased());
    if (isDM) return userId ? isNsfwDmEnabled(userId) : false;
    if (!ctx.guild?.id) return false;
    const settings = await ServerSettings.findOne({ guildId: ctx.guild.id }).select('nsfw').lean();
    if (!settings?.nsfw?.enabled) return false;
    if (!ctx.channel?.nsfw) return 'CHANNEL_NOT_NSFW';
    return true;
}

module.exports = {
    canManageServerNsfw, isNsfwDmEnabled, setNsfwDmEnabled, toggleNsfwDm,
    isSocialConsentEnabled, setSocialConsent, isNsfwAllowed, isStarryOwner
};
