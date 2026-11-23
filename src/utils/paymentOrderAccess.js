'use strict';

function canAccessPremiumOrder(order, session, botOwners = []) {
    if (!order || !session || !session.user || !session.user.id) return false;
    const userId = session.user.id;
    if (botOwners.includes(userId)) return true;
    if (order.userId && order.userId === userId) return true;
    if (!order.guildId || !Array.isArray(session.guilds)) return false;

    const guild = session.guilds.find(entry => entry && entry.id === order.guildId);
    if (!guild) return false;
    try {
        const permissions = BigInt(guild.permissions || 0);
        return Boolean(guild.owner) ||
            (permissions & BigInt(8)) === BigInt(8) ||
            (permissions & BigInt(32)) === BigInt(32);
    } catch (_) {
        return false;
    }
}

module.exports = { canAccessPremiumOrder };
