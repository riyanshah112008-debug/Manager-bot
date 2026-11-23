'use strict';

const { spawnSync } = require('node:child_process');

const suites = [
  ['Persistent component collector policy', '--test', 'tests/persistentComponentPolicy.test.js'],
  ['Global interaction guard', '--test', 'tests/interactionHandler.test.js'],
  ['Global interaction guard syntax', '--check', 'src/utils/interactionHandler.js'],
  ['Whisper Vault module', '--test', 'tests/whisperVault.test.js'],
  ['Whisper Vault module syntax', '--check', 'src/modules/confession.js'],
  ['Discord snowflake validation', 'tests/discordSnowflake.test.js'],
  ['Birthday role cleanup', 'tests/birthdayRoleCleanup.test.js'],
  ['Dashboard origins', 'tests/dashboardOrigins.test.js'],
  ['Premium order access control', '--test', 'tests/paymentOrderAccess.test.js'],
  ['Spotify token vault', '--test', 'tests/spotifyTokenVault.test.js'],
  ['Spotify OAuth state and PKCE', '--test', 'tests/spotifyOAuthState.test.js'],
  ['Spotify manager syntax', '--check', 'src/modules/spotifyManager.js'],
  ['Spotify dashboard route syntax', '--check', 'src/modules/dashboardServer.js'],
  ['Spotify authorization launcher syntax', '--check', 'src/utils/spotifyAuthorization.js'],
  ['Spotify command syntax', '--check', 'src/commands/music/spotify.js'],
  ['Spotify controller syntax', '--check', 'src/modules/musicController.js'],
  ['Spotify dashboard page syntax', '--check', 'public/workspace.js'],
  ['Anti-Nuke policy', '--test', 'tests/antiNukePolicy.test.js'],
  ['Guild notification policy', '--test', 'tests/guildNotificationPolicy.test.js'],
  ['Spotify OAuth redirect URI', '--test', 'tests/spotifyOAuthRedirect.test.js'],
  ['Verification', 'tests/verification.test.js'],
  ['Music player resolver', 'tests/musicPlayerResolver.test.js'],
  ['Music playback lifecycle', '--test', 'tests/musicPlaybackLifecycle.test.js'],
  ['Music 24/7 and automatic mastering', '--test', 'tests/musicStayConnected.test.js'],
  ['Music 24/7 command syntax', '--check', 'src/commands/music/stay.js'],
  ['Music native engine syntax', '--check', 'src/utils/nativeAudioEngine.js'],
  ['Music manager syntax', '--check', 'src/utils/musicManager.js'],
  ['Music controller syntax', '--check', 'src/modules/musicController.js'],
  ['AI vision', 'tests/aiVision.test.js'],
  ['Bot avatar', 'tests/botAvatar.test.js'],
  ['Bot Studio', 'tests/botStudio.test.js'],
  ['Color blend', 'tests/colorBlend.test.js'],
  ['Media permissions', 'tests/mediaPerms.test.js'],
  ['Owner prefix policy', 'tests/ownerPrefixPolicy.test.js'],
  ['Unknown prefix command guard', '--test', 'tests/unknownPrefixCommand.test.js'],
  ['AFK prefix dispatcher', '--test', 'tests/afkPrefixDispatcher.test.js'],
  ['AFK command handler syntax', '--check', 'src/modules/afk.js'],
  ['AFK dispatcher syntax', '--check', 'src/modules/commandHandler.js'],
  ['Emoji and sticker steal input', '--test', 'tests/stealInput.test.js'],
  ['Emoji and sticker steal module syntax', '--check', 'src/modules/steal.js'],
  ['Tickets', 'tests/tickets.test.js'],
  ['Command execution contract', 'tests/commandExecutionContract.test.js'],
  ['Prefix reply notification policy', '--test', 'tests/prefixReplyNotifications.test.js'],
  ['Phone database browser syntax', '--check', 'public/phone-database.js'],
  ['Phone sync', 'tests/phoneSync.test.js'],
  ['Phone sync module syntax', '--check', 'src/modules/phoneSync.js'],
  ['Reaction-role reliability', '--test', 'tests/reactionRoleReliability.test.js'],
  ['Reaction-role reconciliation', '--test', 'tests/reactionRoleReconciliation.test.js'],
  ['Music audio profiles', '--test', 'tests/musicAudioProfiles.test.js'],
  ['Premium audio quality policy', '--test', 'tests/audioQuality.test.js'],
  ['Leveling control panel', '--test', 'tests/levelingControlPanel.test.js'],
  ['Logging control panel', '--test', 'tests/loggingControlPanel.test.js'],
  ['Leveling module syntax', '--check', 'src/modules/leveling.js'],
  ['Suspicious-account monitor syntax', '--check', 'src/modules/susAccount.js'],
  ['Suspicious-member monitoring policy', '--test', 'tests/susAccountMonitoring.test.js'],
  ['Slash command deployment syntax', '--check', 'deploy-commands.js']
];

const timeoutMs = Number(process.env.TEST_SUITE_TIMEOUT_MS) || 60000;
const repetitions = Number.parseInt(process.env.STARRY_TEST_REPETITIONS || '1', 10);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
  throw new Error('STARRY_TEST_REPETITIONS must be an integer from 1 to 10.');
}

let passed = 0;
for (let pass = 1; pass <= repetitions; pass += 1) {
  for (const [name, ...args] of suites) {
    console.log('\n===== START: ' + name + ' (pass ' + pass + '/' + repetitions + ') =====');
    const started = Date.now();
    const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, STARRY_DISABLE_STREAM_RESOLVER: '1' }, timeout: timeoutMs, windowsHide: true });
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    if (result.error || result.status !== 0) {
      if (result.error && result.error.code === 'ETIMEDOUT') console.error('\nFAILED: ' + name + ' exceeded ' + (timeoutMs / 1000) + 's during pass ' + pass + '.');
      else { console.error('\nFAILED: ' + name + ' (pass=' + pass + ', exit=' + result.status + ', signal=' + (result.signal || 'none') + ')'); if (result.error) console.error(result.error); }
      process.exit(1);
    }
    passed += 1;
    console.log('===== PASS: ' + name + ' (' + elapsed + 's; pass ' + pass + '/' + repetitions + ') =====');
  }
}
console.log('\nAll ' + passed + ' deterministic suite executions passed across ' + repetitions + ' complete pass(es).');
