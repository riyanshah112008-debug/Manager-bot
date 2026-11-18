'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { CommandRegistry } = require('../src/modules/commandHandler');

async function send(client, message) {
    client.emit('messageCreate', message);
    await new Promise(resolve => setTimeout(resolve, 30));
}

function makeMessage(id, content, permissions = () => true) {
    const replies = [];
    return {
        id,
        content,
        author: { id: '999999999999999999', tag: 'Member#0001', bot: false },
        guild: { id: '123456789012345678', name: 'Test Server' },
        member: { permissions: { has: permissions } },
        channel: { id: '223456789012345678', isDMBased: () => false },
        replies,
        reply: async payload => {
            replies.push(payload);
            return { delete: async () => {} };
        }
    };
}

(async () => {
    const registry = new CommandRegistry();
    const client = new EventEmitter();
    client.isPrimary = true;
    client.user = { id: '111111111111111111', displayAvatarURL: () => 'https://example.com/avatar.png' };
    client.ws = { ping: 20 };

    let normalExecutions = 0;
    let restrictedExecutions = 0;
    registry.commands.set('testcmd', {
        name: 'testcmd',
        category: 'Utility',
        async execute() { normalExecutions += 1; }
    });
    registry.commands.set('restricted', {
        name: 'restricted',
        category: 'Moderation',
        permissions: ['ADMINISTRATOR'],
        async execute() { restrictedExecutions += 1; }
    });

    registry.registerPrefixDispatcher(client);

    const comma = makeMessage('prefix-member-comma', ',testcmd hello');
    await send(client, comma);
    assert.equal(normalExecutions, 1, 'Regular members can use comma-prefix commands');

    const dot = makeMessage('prefix-member-dot', '.testcmd hello');
    await send(client, dot);
    assert.equal(normalExecutions, 2, 'Regular members can use dot-prefix commands');

    const denied = makeMessage('prefix-member-restricted', ',restricted', () => false);
    await send(client, denied);
    assert.equal(restrictedExecutions, 0, 'Command-level permission checks still protect restricted commands');
    assert.match(String(denied.replies[0]?.content || ''), /sufficient permissions/i);

    const allowed = makeMessage('prefix-admin-restricted', ',restricted', () => true);
    allowed.author.id = '888888888888888888';
    await send(client, allowed);
    assert.equal(restrictedExecutions, 1, 'Members with the required permission can use restricted prefix commands');

    console.log('All prefix-access policy tests passed.');
    process.exit(0);
})().catch(error => {
    console.error(error);
    process.exit(1);
});
