'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

for (const retiredPath of [
    'src/modules/multiBot.js',
    'src/models/MultiBotToken.js',
    'public/multibot.html'
]) {
    assert.equal(fs.existsSync(path.join(root, retiredPath)), false,
        `Retired multi-bot component must be deleted: ${retiredPath}`);
}

const index = read('src/index.js');
assert.match(index, /createMusicManager\(client\)/,
    'The primary client must retain its own music manager');
assert.match(index, /commandRegistry\.init\(client\)/,
    'The single client must initialize the command registry');
assert.doesNotMatch(index, /require\(['"]\.\/modules\/multiBot['"]\)|\.initAll\(/,
    'Startup must not load or initialize a multi-client cluster');

const commandHandler = read('src/modules/commandHandler.js');
assert.doesNotMatch(commandHandler, /client\.multiBot|getMusicWorker|registerEventHook|isPrimaryBotClient|s[23],play/i,
    'Prefix and interaction dispatch must not route to secondary bots');

const musicCommands = read('src/commands/bundles/musicCommands.js');
assert.doesNotMatch(musicCommands, /multiBot|workerClient|getMusicWorker|s[23],play/i,
    'Music commands must only use the one Starry client');

const dashboard = read('src/modules/dashboardServer.js');
assert.doesNotMatch(dashboard, /\/api\/guild\/[^\n]*multibot|client\.multiBot|getMusicWorker/i,
    'The dashboard must not expose worker management or delegated playback');

const help = read('src/utils/helpHelper.js');
const systems = read('src/commands/bundles/systemCommands.js');
const premium = read('src/utils/premiumHelper.js');
assert.doesNotMatch(help + systems + premium, /multibot|multi-bot|Multi-Bot Worker/i,
    'Commands, help and premium catalog must not advertise multi-bot features');

console.log('Single-bot architecture checks passed.');
