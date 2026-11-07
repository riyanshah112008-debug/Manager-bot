'use strict';

const assert = require('node:assert/strict');
const { usesNativeInteraction } = require('../src/utils/commandExecutionContract');

// A SlashCommandBuilder definition does not imply that the handler wants the
// raw Discord interaction. Most Starry handlers consume CommandContext.
const contextCommands = [
    { name: 'catchup', data: {} },
    { name: 'chronos', data: {} },
    { name: 'code-studio', data: {} },
    { name: 'vcmod', data: {} },
    { name: 'pulse', data: {} },
    { name: 'spark', data: {} }
];

for (const command of contextCommands) {
    assert.equal(
        usesNativeInteraction(command),
        false,
        `/${command.name} must receive CommandContext`
    );
}

// Native handlers must opt in explicitly.
assert.equal(
    usesNativeInteraction({ name: 'botavatar', data: {}, nativeInteraction: true }),
    true,
    'botavatar must receive the raw Discord interaction'
);
assert.equal(
    usesNativeInteraction({ name: 'unmarked', data: {} }),
    false,
    'unmarked commands must default to CommandContext'
);

console.log('✅ Command execution contract regression tests passed.');
