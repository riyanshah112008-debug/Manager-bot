'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const index = read('src/index.js');
const dashboard = read('src/modules/dashboardServer.js');
const dispatcher = read('src/modules/commandHandler.js');
const musicCommands = read('src/commands/bundles/musicCommands.js');
const musicController = read('src/modules/musicController.js');
const playerResolver = read('src/utils/musicPlayerResolver.js');
const workspace = read('public/workspace.js');
const systemCommands = read('src/commands/bundles/systemCommands.js');

assert.equal((index.match(/new Client\(/g) || []).length, 1,
    'Starry must create exactly one Discord.js client');
assert.doesNotMatch(index, /BOT_TOKENS|TOKEN_\d+|multiBot|initAll\(/i,
    'Startup must not load secondary bot tokens or initialize workers');
assert.doesNotMatch(dispatcher, /multiBot|multibot|s2,|s3,|workerClient|registerEventHook/i,
    'Command dispatch must not route commands to secondary bots');
assert.doesNotMatch(dashboard, /multiBot|multibot|workerClient|Worker bot/i,
    'Dashboard APIs and music playback must use the primary Starry client only');
assert.doesNotMatch(musicCommands + musicController + playerResolver, /multiBot|multibot|workerClient/i,
    'Music commands and controls must not delegate to worker bots');
assert.doesNotMatch(workspace, /multiBot|multibot|workerToken|addWorker|Worker routing/i,
    'Dashboard must not expose worker-token or cluster controls');
assert.doesNotMatch(systemCommands, /name:\s*['"]multibot['"]|Multi-Bot|worker node/i,
    'The multi-bot prefix command must not be registered');

for (const removed of [
    'src/modules/multiBot.js',
    'src/models/MultiBotToken.js',
    'public/multibot.html'
]) {
    assert.equal(fs.existsSync(path.join(root, removed)), false,
        removed + ' must be removed from the repository');
}

console.log('Single-bot architecture checks passed.');
