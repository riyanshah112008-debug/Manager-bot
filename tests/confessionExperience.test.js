'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const confession = require('../src/modules/confession');

test('confession text is trimmed, bounded, and strips invisible control characters', () => {
  assert.equal(confession._test.clean('  hello\u200B world  ', 20), 'hello world');
  assert.equal(confession._test.clean('abcdef', 3), 'abc');
});

test('public confession content neutralizes mass mentions and role/user pings', () => {
  const safe = confession._test.publicText('@everyone @here <@12345678901234567> <@&12345678901234567>');
  assert.equal(safe.includes('@everyone'), false);
  assert.equal(safe.includes('@here'), false);
  assert.equal(safe.includes('<@'), false);
});

test('confession panel exposes working, versioned interaction IDs', () => {
  const row = confession._test.panelRow().toJSON();
  assert.deepEqual(row.components.map(component => component.custom_id), [
    'starry_confess:open',
    'starry_confess:rules'
  ]);
});

test('published confession cards expose anonymous reply and report actions', () => {
  const row = confession._test.postRow(42).toJSON();
  assert.deepEqual(row.components.map(component => component.custom_id), [
    'starry_confess:reply:42',
    'starry_confess:report:42'
  ]);
});

test('confession commands are exported for global registration', () => {
  assert.equal(confession.confessionSetupPayload.name, 'confessionsetup');
  assert.equal(confession.confessPayload.name, 'confess');
  assert.equal(confession.confessionPayload.name, 'confession');
});

test('public confession embed never adds an author identity', () => {
  const embed = confession._test.confessionEmbed(7, 'Life', 'A private thought').toJSON();
  assert.equal(embed.author.name, '💌  CONFESSION  #7');
  assert.equal(JSON.stringify(embed).includes('userId'), false);
  assert.equal(embed.description.includes('A private thought'), true);
});
