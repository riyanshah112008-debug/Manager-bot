'use strict';

function isStayConnected(player) {
    if (!player) return false;
    if (typeof player.is247 === 'boolean') return player.is247;
    return Boolean(player.data?.get?.('stayConnected'));
}

function setStayConnected(player, enabled) {
    if (!player) return false;
    const active = Boolean(enabled);

    if (typeof player.is247 === 'boolean') {
        player.is247 = active;
        player.autoplay = active;
        return active;
    }

    if (player.data && typeof player.data.set === 'function') {
        player.data.set('stayConnected', active);
        player.data.set('autoplay', active);
        player.autoplay = active;
        if (!active) player.data.set('isBufferingAutoplay', false);
        return active;
    }

    return false;
}

module.exports = { isStayConnected, setStayConnected };
