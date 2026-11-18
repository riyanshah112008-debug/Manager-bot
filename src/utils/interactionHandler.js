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
    if (isExpiredInteractionError(error) || !logger || typeof logger.error !== 'function') return;
    const safeDetails = {
        handler: key,
        name: typeof error?.name === 'string' ? error.name.slice(0, 80) : 'Error',
        code: typeof error?.code === 'string' || typeof error?.code === 'number'
            ? String(error.code).slice(0, 40)
            : undefined,
        status: Number.isInteger(error?.status) ? error.status : undefined
    };
    try {
        logger.error('[Interaction] Handler failed', safeDetails);
    } catch (_) {
        // A custom logger must never prevent interaction dispatch or crash the process.
    }
}

async function sendFailureResponse(interaction, error) {
    if (!interaction || typeof interaction.isRepliable !== 'function' || !interaction.isRepliable()) return;
    const payload = {
        content: isExpiredInteractionError(error)
            ? 'This interaction is no longer valid. Please open a fresh panel and try again.'
            : 'The action could not be completed. Please try again.',
        flags: MessageFlags.Ephemeral
    };
    try {
        if (interaction.deferred && !interaction.replied && typeof interaction.editReply === 'function') {
            await interaction.editReply(payload);
        } else if (!interaction.replied && typeof interaction.reply === 'function') {
            await interaction.reply(payload);
        }
    } catch (replyError) {
        report(console, 'dispatcher:fallback', replyError);
    }
}

async function dispatch(state, interaction) {
    const orderedHandlers = Array.from(state.handlers.entries()).sort((a, b) =>
        (b[1].priority - a[1].priority) || (a[1].sequence - b[1].sequence)
    );
    for (const [key, entry] of orderedHandlers) {
        try {
            await entry.handler(interaction);
        } catch (error) {
            report(entry.logger, key, error);
            await sendFailureResponse(interaction, error);
            return;
        }

        // First handler to acknowledge owns this interaction. Do not let other
        // modules race a second reply, modal, or deferred update.
        if (isAcknowledged(interaction)) return;
    }
}

function registerInteractionHandler(client, key, handler, options = {}) {
    if (!client || typeof client.on !== 'function') throw new TypeError('A Discord client is required.');
    if (typeof key !== 'string' || !key.trim()) throw new TypeError('An interaction handler key is required.');
    if (typeof handler !== 'function') throw new TypeError('An interaction handler callback is required.');

    let state = clients.get(client);
    if (!state) {
        state = { handlers: new Map(), listener: null, nextSequence: 0 };
        state.listener = interaction => { void dispatch(state, interaction); };
        clients.set(client, state);
        client.on(Events.InteractionCreate, state.listener);
    }
    if (state.handlers.has(key)) return state.handlers.get(key).dispose;

    const entry = {
        handler,
        logger: options.logger || console,
        priority: Number.isFinite(options.priority) ? options.priority : 0,
        sequence: state.nextSequence++
    };
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
