'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('backup is opt-in and never scheduled for an unset or manual server', () => {
  const engine = read('src/modules/backupEngine.js');
  assert.match(engine, /ServerSettings\.find\(\{\s*'backup\.enabled': true,\s*'backup\.mode': 'automatic'\s*\}\)/);
  assert.match(engine, /enabled:\s*\{\s*type:\s*Boolean,\s*default:\s*false\s*\}/);
  assert.match(engine, /mode:\s*\{\s*type:\s*String,\s*enum:\s*\['unset', 'manual', 'automatic'\],\s*default:\s*'unset'\s*\}/);
});

test('backup command asks admins to choose and supports changing the choice', () => {
  const commands = read('src/commands/bundles/systemCommands.js');
  assert.match(commands, /mode === 'unset' \|\| \['setup', 'mode'\]\.includes/);
  assert.match(commands, /buildBackupChoiceComponents\(guildId, ctx\.user\.id\)/);
  assert.match(commands, /No backup will run automatically until you choose/);
  assert.match(commands, /!\/\^\\d\{17,20\}\$\//);
});

test('legacy placeholder backup helper is removed; real export engine remains', () => {
  const legacy = read('src/modules/starry.js');
  const engine = read('src/modules/backupEngine.js');
  assert.doesNotMatch(legacy, /executeFullGuildBackup/);
  assert.match(engine, /async function createBackupAttachment\(guild\)/);
});
