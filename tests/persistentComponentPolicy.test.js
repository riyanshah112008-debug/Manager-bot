'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('long-lived component panels do not use finite one-year or maximum-int timer expiry', () => {
 const contextHelper = fs.readFileSync('src/utils/contextHelper.js', 'utf8');
 const aiEngine = fs.readFileSync('src/utils/aiEngine.js', 'utf8');
 const steal = fs.readFileSync('src/modules/steal.js', 'utf8');
 const socialActions = fs.readFileSync('src/modules/socialActions.js', 'utf8');
 const mediaCommands = fs.readFileSync('src/commands/bundles/mediaCommands.js', 'utf8');
 const economyCommands = fs.readFileSync('src/commands/bundles/economyCommands.js', 'utf8');
 const systemCommands = fs.readFileSync('src/commands/bundles/systemCommands.js', 'utf8');
 const utilityCommands = fs.readFileSync('src/commands/bundles/utilityCommands.js', 'utf8');
 const musicQueue = fs.readFileSync('src/commands/music/queue.js', 'utf8');

 assert.doesNotMatch(contextHelper, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
 assert.doesNotMatch(aiEngine, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
 assert.doesNotMatch(steal, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
 assert.doesNotMatch(socialActions, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
 assert.doesNotMatch(mediaCommands, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
 assert.doesNotMatch(economyCommands, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
 assert.doesNotMatch(systemCommands, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
 assert.doesNotMatch(utilityCommands, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
 assert.doesNotMatch(musicQueue, /time:\s*(?:ONE_YEAR_MS|config\.ONE_YEAR_MS\s*\|\|\s*2147483647|2147483647)/);
});

test('temporary setup and modal workflows keep their explicit short safety windows', () => {
 const setup = fs.readFileSync('src/commands/setup-starry.js', 'utf8');
 const queue = fs.readFileSync('src/commands/music/queue.js', 'utf8');
 assert.match(setup, /time:\s*120000/);
 assert.match(queue, /time:\s*30000/);
});
