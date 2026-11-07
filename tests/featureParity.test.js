'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

// Chest Drop was removed as a complete feature, not merely hidden from help.
for (const retiredPath of [
    'src/commands/economy/chest.js',
    'src/commands/economy/chest-setup.js',
    'src/commands/economy/chest-toggle.js',
    'src/commands/economy/chestdrop.js',
    'src/models/ChestChannel.js',
    'src/modules/chestDrop.js'
]) {
    assert.equal(exists(retiredPath), false, `Retired Chest Drop file still exists: ${retiredPath}`);
}

const commandHandler = read('src/modules/commandHandler.js');
const index = read('src/index.js');
const setup = read('src/modules/masterSetupText.js');
const help = read('src/utils/helpHelper.js');
const pulse = read('src/modules/serverPulse.js');
const premium = read('src/utils/premiumHelper.js');
const booster = read('src/commands/bundles/boosterCommands.js');
const legacy = read('public/legacy-console.html');

for (const [label, source] of [
    ['command handler', commandHandler],
    ['startup registry', index],
    ['master setup', setup],
    ['help catalogue', help],
    ['server pulse', pulse],
    ['premium catalogue', premium],
    ['booster perks', booster],
    ['legacy website', legacy]
]) {
    for (const retiredToken of [
        'chestdrop', 'ChestChannel', 'chestChannelsCache',
        'claim_chest', 'claim_wild_chest', 'pulse_drop',
        'chest-setup', 'chest-toggle', 'chest-drops'
    ]) {
        assert.equal(source.includes(retiredToken), false, `${label} still references ${retiredToken}`);
    }
}

assert.match(legacy, /location\.replace\('\/dashboard\.html'\)/);
assert.match(legacy, /href="\/dashboard\.html"/);

// Dashboard API contract: every main workspace feature endpoint has a backend route.
const workspace = read('public/workspace.js');
const dashboardServer = read('src/modules/dashboardServer.js');
const supportDesk = read('src/modules/supportDesk.js');
const apiSuffixes = [
    '/commands', '/multibot', '/welcome', '/events', '/leveling',
    '/economy', '/settings', '/embed/send', '/music/control',
    '/music/play', '/music/search', '/mod/action', '/booster-roles'
];
for (const suffix of apiSuffixes) {
    assert.ok(workspace.includes(suffix), `Workspace no longer calls ${suffix}`);
    assert.ok(dashboardServer.includes(`/api/guild/:id${suffix}`), `Backend route missing for ${suffix}`);
}

for (const route of [
    "app.get('/api/support/conversations'",
    "app.post('/api/support/conversations'",
    "app.get('/api/support/conversations/:conversationId'",
    "app.post('/api/support/conversations/:conversationId/messages'",
    "app.patch('/api/support/conversations/:conversationId'"
]) {
    assert.ok(supportDesk.includes(route), `Support API route missing: ${route}`);
}

for (const action of ['pause', 'skip', 'stop', 'volume', 'filter', 'loop', 'autoplay', 'toggle247']) {
    assert.ok(dashboardServer.includes(`action === '${action}'`), `Dashboard music action is not implemented: ${action}`);
}

assert.match(workspace, /Choose valid start and end dates/);
assert.match(workspace, /start\.toISOString\(\)/);
console.log('✅ Chest Drop removal and dashboard/backend feature-contract tests passed.');
