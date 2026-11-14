'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { serializeByKey, withDiscordRetry, isTransientDiscordError } = require('../src/modules/reactionRoleReliability');

test('transient Discord failures are retried and eventually succeed', async () => {
  let calls = 0;
  const result = await withDiscordRetry(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error('temporary outage'), { status: 503 });
    return 'ok';
  }, { delayMs: 0 });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('Undici socket disconnects are retried', async () => {
  let calls = 0;
  const result = await withDiscordRetry(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error('socket closed'), { code: 'UND_ERR_SOCKET' });
    return 'recovered';
  }, { delayMs: 0 });
  assert.equal(result, 'recovered');
  assert.equal(calls, 2);
});

test('permission and validation errors are not retried', async () => {
  let calls = 0;
  const error = Object.assign(new Error('Missing Permissions'), { status: 403, code: 50013 });
  await assert.rejects(
    withDiscordRetry(async () => { calls += 1; throw error; }, { delayMs: 0 }),
    /Missing Permissions/
  );
  assert.equal(calls, 1);
  assert.equal(isTransientDiscordError(error), false);
});

test('operations for the same member execute sequentially', async () => {
  const order = [];
  await Promise.all([
    serializeByKey('guild:user', async () => {
      order.push('first-start');
      await new Promise(resolve => setTimeout(resolve, 10));
      order.push('first-end');
    }),
    serializeByKey('guild:user', async () => {
      order.push('second-start');
      order.push('second-end');
    })
  ]);
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start', 'second-end']);
});

test('different members are not serialized behind each other', async () => {
  let completed = 0;
  await Promise.all([
    serializeByKey('guild:user-a', async () => { await new Promise(r => setTimeout(r, 10)); completed += 1; }),
    serializeByKey('guild:user-b', async () => { completed += 1; })
  ]);
  assert.equal(completed, 2);
});
