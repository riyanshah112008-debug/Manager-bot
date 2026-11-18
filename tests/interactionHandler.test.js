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

test('all modules share exactly one client interaction listener', async () => {
 const client = new EventEmitter(); const seen = [];
 guard.registerInteractionHandler(client, 'first', async () => { seen.push('first'); });
 guard.registerInteractionHandler(client, 'second', async () => { seen.push('second'); });
 guard.registerInteractionHandler(client, 'third', async () => { seen.push('third'); });
 assert.equal(client.listenerCount('interactionCreate'), 1);
 client.emit('interactionCreate', {});
 await new Promise(resolve => setImmediate(resolve));
 assert.deepEqual(seen.sort(), ['first', 'second', 'third']);
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

test('the first handler that acknowledges owns the interaction', async () => {
 const client = new EventEmitter(); const calls = [];
 guard.registerInteractionHandler(client, 'owner', async interaction => {
  calls.push('owner');
  await interaction.deferUpdate();
 });
 guard.registerInteractionHandler(client, 'duplicate', async () => { calls.push('duplicate'); });
 const interaction = {
  deferred: false, replied: false,
  deferUpdate: async () => { interaction.deferred = true; }
 };
 client.emit('interactionCreate', interaction);
 await new Promise(resolve => setImmediate(resolve));
 assert.deepEqual(calls, ['owner']);
});

test('a failure after defer edits the deferred reply instead of replying twice', async () => {
 const client = new EventEmitter(); let edits = 0; let replies = 0;
 guard.registerInteractionHandler(client, 'deferred-failure', async () => {
  throw new Error('database unavailable');
 }, { logger: { error() {} } });
 client.emit('interactionCreate', {
  deferred: true, replied: false,
  isRepliable: () => true,
  editReply: async payload => { edits++; assert.match(payload.content, /could not be completed/i); },
  reply: async () => { replies++; }
 });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(edits, 1);
 assert.equal(replies, 0);
});

test('a throwing logger cannot break dispatch and logs contain no raw error text', async () => {
 const client = new EventEmitter(); const replies = [];
 guard.registerInteractionHandler(client, 'safe-log', async () => {
  throw Object.assign(new Error('interaction token: secret-token'), { code: 500 });
 }, { logger: { error() { throw new Error('logger failed'); } } });
 client.emit('interactionCreate', {
  deferred: false, replied: false,
  isRepliable: () => true,
  reply: async payload => replies.push(payload)
 });
 await new Promise(resolve => setImmediate(resolve));
 assert.equal(replies.length, 1);
});
