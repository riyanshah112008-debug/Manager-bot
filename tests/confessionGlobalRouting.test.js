'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isConfessionOpenButton,
    routeConfessionOpenButton
} = require('../src/utils/confessionInteraction');

function makeButton(customId, overrides = {}) {
    return {
        customId,
        replied: false,
        deferred: false,
        isButton: () => true,
        showModal: async modal => {
            overrides.shown?.push(modal);
        },
        reply: async payload => {
            overrides.replies?.push(payload);
        },
        ...overrides
    };
}

test('recognizes both current and legacy confession panel buttons', () => {
    assert.equal(isConfessionOpenButton(makeButton('starry:confession:open')), true);
    assert.equal(isConfessionOpenButton(makeButton('confess_btn_open')), true);
});

test('ignores unrelated buttons and non-button interactions', async () => {
    const unrelated = makeButton('music:pause');
    assert.equal(isConfessionOpenButton(unrelated), false);
    assert.equal(await routeConfessionOpenButton(unrelated), false);
    assert.equal(unrelated.__starryConfessionOpenHandled, undefined);

    const select = { customId: 'starry:confession:open', isButton: () => false };
    assert.equal(await routeConfessionOpenButton(select), false);
});

test('central dispatcher opens a confession modal and marks the interaction handled', async () => {
    const shown = [];
    const interaction = makeButton('confess_btn_open', { shown });
    const modal = { customId: 'starry:confession:submit' };

    assert.equal(await routeConfessionOpenButton(interaction, () => modal), true);
    assert.deepEqual(shown, [modal]);
    assert.equal(interaction.__starryConfessionOpenHandled, true);
});

test('registered confession module listener and central dispatcher share the in-flight acknowledgement', async () => {
    const confessionModule = require('../src/modules/confession');
    let moduleListener;
    const client = {
        isPrimary: false,
        on: (eventName, listener) => {
            if (eventName === 'interactionCreate') moduleListener = listener;
        }
    };
    confessionModule(client);
    assert.equal(typeof moduleListener, 'function');

    let resolveFirst;
    let calls = 0;
    const interaction = makeButton('starry:confession:open', {
        guildId: '123456789012345678',
        showModal: () => {
            calls += 1;
            return new Promise(resolve => { resolveFirst = resolve; });
        }
    });

    const moduleHandling = moduleListener(interaction);
    await Promise.resolve();
    assert.equal(calls, 1);

    const dispatcher = routeConfessionOpenButton(interaction, () => ({ customId: 'starry:confession:submit' }));
    assert.equal(await dispatcher, true);
    assert.equal(calls, 1);

    resolveFirst();
    await moduleHandling;
    assert.equal(calls, 1);
});

test('modal opening failure receives a prompt ephemeral response instead of timeout fallback', async () => {
    const replies = [];
    const interaction = makeButton('confess_btn_open', {
        showModal: async () => { throw new Error('Discord REST unavailable'); },
        replies
    });

    assert.equal(await routeConfessionOpenButton(interaction, () => ({})), true);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].flags, 64);
    assert.match(replies[0].content, /could not open the confession form/i);
});
