'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isExecutableCommand } = require('../src/utils/prefixCommandGuard');

test('unknown prefix content is rejected before command properties are accessed', () => {
    assert.equal(isExecutableCommand(undefined), false);
    assert.equal(isExecutableCommand(null), false);
    assert.equal(isExecutableCommand({}), false);
});

test('registered prefix commands remain executable', () => {
    const command = { name: 'ping', execute: async () => undefined };
    assert.equal(isExecutableCommand(command), true);
});

test('the natural-mention ask fallback is an executable command', () => {
    const askCommand = { name: 'ask', execute: async () => undefined };
    assert.equal(isExecutableCommand(askCommand), true);
});
