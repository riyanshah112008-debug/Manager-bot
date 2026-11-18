'use strict';

const { Events, MessageFlags } = require('discord.js');

const registrations = new WeakMap();

function isAcknowledged(interaction) {
    return Boolean(interaction && (interaction.deferred || interaction.replied));
}

function isExpiredInteractionError(error) {
    const message = String(error && error.message || '');
    return Boolean(error && (error.code === 10062 || error.code === 40060)) ||
        /unknown interaction|already been acknowledged/i.test(message);
}

function registerInteractionHandler(client, key, handler, options = {}) {
    if (!client || typeof client.on !== 'function') throw new TypeError('A Discord client is required.');
    if (typeof key !== 'string' || !key.trim()) throw new TypeError('An interaction handler key is required.');
    if (typeof handler !== 'function') throw new TypeError('An interaction handler callback is required.');

    let clientRegistrations = registrations.get(client);
    if (!clientRegistrations) {
        clientRegistrations = new Map();
        registrations.set(client, clientRegistrations);
    }
    if (clientRegistrations.has(key)) return clientRegistrations.get(key).dispose;

    const logger = options.logger || console;
    const listener = async interaction => {
        try {
            await handler(interaction);
        } catch (error) {
            if (!isExpiredInteractionError(error)) {
                if (logger && typeof logger.error === 'function') logger.error('[Interaction:' + key + '] Handler failed', error);
            }
            if (!isAcknowledged(interaction) && interaction &&
                typeof interaction.isRepliable === 'function' && interaction.isRepliable()) {
                const payload = {
                    content: isExpiredInteractionError(error)
                        ? 'This interaction is no longer valid. Please open a fresh panel and try again.'
                        : 'The action could not be completed. Please try again.',
                    flags: MessageFlags.Ephemeral
                };
                try {
                    await interaction.reply(payload);
                } catch (replyError) {
                    if (!isExpiredInteractionError(replyError) && logger && typeof logger.error === 'function') {
                        logger.error('[Interaction:' + key + '] Could not send fallback', replyError);
                    }
                }
            }
        }
    };

    client.on(Events.InteractionCreate, listener);
    const dispose = () => {
        if (typeof client.off === 'function') client.off(Events.InteractionCreate, listener);
        clientRegistrations.delete(key);
    };
    clientRegistrations.set(key, { listener, dispose });
    return dispose;
}

function safeDeferUpdate(interaction) {
    if (!interaction || isAcknowledged(interaction) || typeof interaction.deferUpdate !== 'function') return Promise.resolve(false);
    return interaction.deferUpdate().then(() => true).catch(() => false);
}

function safeDeferReply(interaction, options = {}) {
    if (!interaction || isAcknowledged(interaction) || typeof interaction.deferReply !== 'function') return Promise.resolve(false);
    return interaction.deferReply(options).then(() => true).catch(() => false);
}

function safeShowModal(interaction, modal) {
    if (!interaction || isAcknowledged(interaction) || typeof interaction.showModal !== 'function') return Promise.resolve(false);
    return interaction.showModal(modal).then(() => true).catch(() => false);
}

module.exports = {
    registerInteractionHandler,
    isAcknowledged,
    isExpiredInteractionError,
    safeDeferUpdate,
    safeDeferReply,
    safeShowModal
};
