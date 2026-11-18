'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const guard = require('../src/utils/interactionHandler');

test('registration is idempotent per client and key', async () => {
 const client = new EventEmitter(); let calls = 0;
 guard.registerInteractionHandler(client, 'test', async () => { calls++; });
 guard.registerInteractionHandler(client, 'test', async () => { calls += 100; });
 client.emit('interactionCreate', {});
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(calls, 1);
});
test('dispose permits clean re-registration', async () => {
 const client = new EventEmitter(); let calls = 0;
 const dispose = guard.registerInteractionHandler(client, 'test', async () => { calls++; });
 dispose();
 guard.registerInteractionHandler(client, 'test', async () => { calls += 2; });
 client.emit('interactionCreate', {});
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(calls, 2);
});
test('handler failures receive one ephemeral fallback only when unacknowledged', async () => {
 const client = new EventEmitter(); const replies = [];
 guard.registerInteractionHandler(client, 'test', async () => { throw new Error('failure'); }, { logger: { error() {} } });
 client.emit('interactionCreate', { deferred: false, replied: false, isRepliable: () => true, reply: async p => replies.push(p) });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(replies.length, 1);
 assert.equal(replies[0].flags, 64);
});
test('already acknowledged interactions are not replied to twice', async () => {
 const client = new EventEmitter(); let replies = 0;
 guard.registerInteractionHandler(client, 'test', async () => { throw new Error('failure'); }, { logger: { error() {} } });
 client.emit('interactionCreate', { deferred: true, replied: false, isRepliable: () => true, reply: async () => replies++ });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(replies, 0);
});
test('Discord expired and duplicate acknowledgement errors are classified', () => {
 assert.equal(guard.isExpiredInteractionError({ code: 10062 }), true);
 assert.equal(guard.isExpiredInteractionError({ code: 40060 }), true);
 assert.equal(guard.isExpiredInteractionError(new Error('Unknown interaction')), true);
 assert.equal(guard.isExpiredInteractionError(new Error('database unavailable')), false);
});
test('safe acknowledgement helpers are idempotent and never throw', async () => {
 let calls = 0;
 const interaction = {
  deferred: false, replied: false,
  deferUpdate: async () => { calls++; interaction.deferred = true; },
  deferReply: async () => { calls++; interaction.deferred = true; },
  showModal: async () => { calls++; interaction.replied = true; }
 };
 assert.equal(await guard.safeDeferUpdate(interaction), true);
 assert.equal(await guard.safeDeferReply(interaction), false);
 assert.equal(await guard.safeShowModal(interaction, {}), false);
 assert.equal(calls, 1);
 assert.equal(guard.isAcknowledged(interaction), true);
});
