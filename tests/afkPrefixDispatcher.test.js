'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('AFK prefix commands are handled only by the dedicated AFK module', () => {
    const source = fs.readFileSync('src/modules/commandHandler.js', 'utf8');
    const parse = source.indexOf("const commandKey = args.shift()?.toLowerCase();");
    const dedicatedGuard = source.indexOf("if (commandKey === 'afk') return;", parse);
    const registryLookup = source.indexOf("const resolvedName =", parse);
    assert.notEqual(parse, -1, 'prefix command parser must exist');
    assert.notEqual(dedicatedGuard, -1, 'generic dispatcher must skip AFK');
    assert.ok(dedicatedGuard > parse && dedicatedGuard < registryLookup,
        'AFK must be skipped before generic command lookup/execution');
});
