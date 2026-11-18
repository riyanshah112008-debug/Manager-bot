'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const paths = [
 'src/utils/contextHelper.js',
 'src/utils/aiEngine.js',
 'src/modules/steal.js',
 'src/modules/socialActions.js',
 'src/commands/bundles/mediaCommands.js',
 'src/commands/bundles/economyCommands.js',
 'src/commands/bundles/systemCommands.js',
 'src/commands/bundles/utilityCommands.js',
 'src/commands/music/queue.js'
];
test('long-lived component panels do not use finite one-year or maximum-int timer expiry', () => {
 for (const path of paths) {
  const source = fs.readFileSync(path, 'utf8');
  assert.doesNotMatch(source, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/, path + ' still sets a finite long-lived collector timeout');
 }
});
test('temporary setup and modal workflows keep their explicit short safety windows', () => {
 const setup = fs.readFileSync('src/commands/setup-starry.js', 'utf8');
 const queue = fs.readFileSync('src/commands/music/queue.js', 'utf8');
 assert.match(setup, /time:\s*120000/);
 assert.match(queue, /time:\s*30000/);
});
