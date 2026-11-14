'use strict';

const { spawnSync } = require('node:child_process');

const suites = [
  ['Discord snowflake validation', 'tests/discordSnowflake.test.js'],
  ['Birthday role cleanup', 'tests/birthdayRoleCleanup.test.js'],
  ['Dashboard origins', 'tests/dashboardOrigins.test.js'],
  ['Verification', 'tests/verification.test.js'],
  ['Music player resolver', 'tests/musicPlayerResolver.test.js'],
  ['Music playback lifecycle', '--test', 'tests/musicPlaybackLifecycle.test.js'],
  ['AI vision', 'tests/aiVision.test.js'],
  ['Bot avatar', 'tests/botAvatar.test.js'],
  ['Bot Studio', 'tests/botStudio.test.js'],
  ['Color blend', 'tests/colorBlend.test.js'],
  ['Media permissions', 'tests/mediaPerms.test.js'],
  ['Owner prefix policy', 'tests/ownerPrefixPolicy.test.js'],
  ['Tickets', 'tests/tickets.test.js'],
  ['Command execution contract', 'tests/commandExecutionContract.test.js'],
  ['Phone database browser syntax', '--check', 'public/phone-database.js'],
  ['Phone sync', 'tests/phoneSync.test.js'],
  ['Phone sync module syntax', '--check', 'src/modules/phoneSync.js'],
  ['Reaction-role reliability', '--test', 'tests/reactionRoleReliability.test.js'],
  ['Reaction-role reconciliation', '--test', 'tests/reactionRoleReconciliation.test.js'],
  ['Music audio profiles', '--test', 'tests/musicAudioProfiles.test.js']
];

const timeoutMs = Number(process.env.TEST_SUITE_TIMEOUT_MS) || 60000;
let passed = 0;

for (const [name, ...args] of suites) {
  console.log('\n===== START: ' + name + ' =====');
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', timeout: timeoutMs, windowsHide: true });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  if (result.error || result.status !== 0) {
    if (result.error && result.error.code === 'ETIMEDOUT') console.error('\nFAILED: ' + name + ' exceeded ' + (timeoutMs / 1000) + 's and was terminated.');
    else { console.error('\nFAILED: ' + name + ' (exit=' + result.status + ', signal=' + (result.signal || 'none') + ')'); if (result.error) console.error(result.error); }
    process.exit(1);
  }
  passed += 1;
  console.log('===== PASS: ' + name + ' (' + elapsed + 's) =====');
}
console.log('\nAll ' + passed + ' deterministic verification suites passed.');
