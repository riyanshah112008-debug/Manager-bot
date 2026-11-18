'use strict';

const { Events, MessageFlags } = require('discord.js');
const clients = new WeakMap();

function isAcknowledged(interaction) {
    return Boolean(interaction && (interaction.deferred || interaction.replied));
}

function isExpiredInteractionError(error) {
    const message = String(error && error.message || '');
    return Boolean(error && (error.code === 10062 || error.code === 40060)) ||
        /unknown interaction|already been acknowledged/i.test(message);
}

function report(logger, key, error) {
    if (!isExpiredInteractionError(error) && logger && typeof logger.error === 'function') {
        logger.error('[Interaction:' + key + '] Handler failed', error);
    }
}

async function dispatch(state, interaction) {
    const tasks = [];
    for (const [key, entry] of state.handlers) {
        try {
            tasks.push(Promise.resolve(entry.handler(interaction)).catch(error => {
                report(entry.logger, key, error);
                return error;
            }));
        } catch (error) {
            report(entry.logger, key, error);
            tasks.push(Promise.resolve(error));
        }
    }

    const outcomes = await Promise.all(tasks);
    const failed = outcomes.find(value => value instanceof Error);
    if (failed && !isAcknowledged(interaction) && interaction &&
        typeof interaction.isRepliable === 'function' && interaction.isRepliable()) {
        try {
            await interaction.reply({
                content: isExpiredInteractionError(failed)
                    ? 'This interaction is no longer valid. Please open a fresh panel and try again.'
                    : 'The action could not be completed. Please try again.',
                flags: MessageFlags.Ephemeral
            });
        } catch (replyError) {
            if (!isExpiredInteractionError(replyError)) {
                report(console, 'dispatcher:fallback', replyError);
            }
        }
    }
}

function registerInteractionHandler(client, key, handler, options = {}) {
    if (!client || typeof client.on !== 'function') throw new TypeError('A Discord client is required.');
    if (typeof key !== 'string' || !key.trim()) throw new TypeError('An interaction handler key is required.');
    if (typeof handler !== 'function') throw new TypeError('An interaction handler callback is required.');

    let state = clients.get(client);
    if (!state) {
        state = { handlers: new Map(), listener: null };
        state.listener = interaction => { void dispatch(state, interaction); };
        clients.set(client, state);
        client.on(Events.InteractionCreate, state.listener);
    }
    if (state.handlers.has(key)) return state.handlers.get(key).dispose;

    const entry = { handler, logger: options.logger || console };
    const dispose = () => {
        if (state.handlers.get(key) !== entry) return;
        state.handlers.delete(key);
        if (state.handlers.size === 0) {
            if (typeof client.off === 'function') client.off(Events.InteractionCreate, state.listener);
            clients.delete(client);
        }
    };
    entry.dispose = dispose;
    state.handlers.set(key, entry);
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
