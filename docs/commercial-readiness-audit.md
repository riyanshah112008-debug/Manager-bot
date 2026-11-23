# Starry Commercial Readiness Audit

Inventory generated from main at commit d6458bfa11f6507cc4f860627f7019a30678512a on 2026-11-23.

## Scope inventory

| Code area | Files |
|---|---:|
| Commands | 63 |
| Modules | 77 |
| Utilities | 31 |
| Data models | 34 |
| Browser JS | 5 |
| Existing dedicated test files | 33 |
| Files with a name-matched test candidate | 28 of 210 |

Name matching is a navigation aid only. It does not prove behavior coverage, sufficient assertions, or that the test is passing. Rows without a candidate are explicit test gaps.

## Repeated verification policy

The commercial-readiness workflow runs:
1. Syntax validation for every JavaScript file under src and public, plus deploy-commands.js, ten times.
2. The complete deterministic runner ten times, repeating every listed suite on every pass.
3. A production dependency audit, failing on high or critical advisories.
4. Gitleaks over full Git history.
5. CodeQL JavaScript/TypeScript analysis with the security-extended query suite.
6. CodeRabbit path-specific rules for routes, modules, commands, data models, utilities, browser code, tests and workflows.

Ten repeated passes measure repeatability of existing checks; they do not create ten different tests for every feature. Features without dedicated behavioral tests remain release blockers.

## Existing test suites

- `tests/afkPrefixDispatcher.test.js`
- `tests/aiVision.test.js`
- `tests/audioQuality.test.js`
- `tests/audioStreaming.test.js`
- `tests/birthdayRoleCleanup.test.js`
- `tests/botAvatar.test.js`
- `tests/botStudio.test.js`
- `tests/colorBlend.test.js`
- `tests/commandExecutionContract.test.js`
- `tests/dashboardOrigins.test.js`
- `tests/discordSnowflake.test.js`
- `tests/interactionHandler.test.js`
- `tests/levelingControlPanel.test.js`
- `tests/loggingControlPanel.test.js`
- `tests/mediaPerms.test.js`
- `tests/musicAudioProfiles.test.js`
- `tests/musicPlaybackLifecycle.test.js`
- `tests/musicPlayerResolver.test.js`
- `tests/musicStayConnected.test.js`
- `tests/ownerPrefixPolicy.test.js`
- `tests/paymentOrderAccess.test.js`
- `tests/persistentComponentPolicy.test.js`
- `tests/phoneSync.test.js`
- `tests/prefixReplyNotifications.test.js`
- `tests/reactionRoleReconciliation.test.js`
- `tests/reactionRoleReliability.test.js`
- `tests/spotifyOAuthRedirect.test.js`
- `tests/stealInput.test.js`
- `tests/susAccountMonitoring.test.js`
- `tests/tickets.test.js`
- `tests/unknownPrefixCommand.test.js`
- `tests/verification.test.js`
- `tests/whisperVault.test.js`

## Feature inventory and test candidates

| Type | Source file | Candidate test suite(s) | Assessment |
|---|---|---|---|
| Browser feature | `public/ambient-3d.js` | — | NO MATCHED SUITE — coverage gap |
| Browser feature | `public/firebase-bridge.js` | — | NO MATCHED SUITE — coverage gap |
| Browser feature | `public/landing.js` | — | NO MATCHED SUITE — coverage gap |
| Browser feature | `public/phone-database.js` | `phonesync` | Name-matched candidate only |
| Browser feature | `public/workspace.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/assetCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/boosterCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/colorCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/economyCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/gameCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/mediaCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/moderationCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/musicCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/socialCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/systemCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/bundles/utilityCommands.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/economy/pet.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/economy/prestige.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/economy/shop-admin.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/economy/shop.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/economy/telemetry.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/game/raid.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/giveaway.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/automod-badge.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/automod.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/autorole.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/boost-setup.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/botavatar.js` | `botavatar` | Name-matched candidate only |
| Command | `src/commands/moderation/emergency-lockdown.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/emergency-nuke.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/emergency-secure.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/emergency-unban.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/help-admin.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/mod.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/set-name.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/setup-server.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/swtmmod.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/vcmod.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/moderation/verify-setup.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/autoplay.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/callstarry.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/djpanel.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/loop.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/musicsetup.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/nowplaying.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/pause.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/play.js` | `musicplaybacklifecycle`, `musicplayerresolver` | Name-matched candidate only |
| Command | `src/commands/music/queue.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/resume.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/search.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/setup.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/skip.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/spotify.js` | `spotifyoauthredirect` | Name-matched candidate only |
| Command | `src/commands/music/stay.js` | `musicstayconnected` | Name-matched candidate only |
| Command | `src/commands/music/stop.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/summon.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/music/volume.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/setup-starry.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/socialActions.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/utility/birthday.js` | `birthdayrolecleanup` | Name-matched candidate only |
| Command | `src/commands/utility/catchup.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/utility/chronos.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/utility/codeStudio.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/utility/gazette.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/utility/pentest.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/utility/portal.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/utility/pulse.js` | — | NO MATCHED SUITE — coverage gap |
| Command | `src/commands/utility/spark.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/AstralPortal.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/AutomodSchema.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/AutoroleSchema.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/Birthday.js` | `birthdayrolecleanup` | Name-matched candidate only |
| Data model | `src/models/BoostChannel.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/BoosterRole.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/ChannelScrapeState.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/ColorRole.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/ExecutionLock.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/GuildTelemetry.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/GuildTrackerSettings.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/ModCase.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/MultiBotToken.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/MusicController.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/NitroClaim.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/OAuthSession.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/PaymentOrder.js` | `paymentorderaccess` | Name-matched candidate only |
| Data model | `src/models/RaidBoss.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/Reminder.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/ServerBackup.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/ServerSettings.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/ShopItem.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/SocialStats.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/StarboardConfig.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/StickyMessage.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/SupportConversation.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/Tag.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/TempVoiceConfig.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/Transcript.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/User.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/UserActivity.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/UserSettings.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/UserSpotify.js` | — | NO MATCHED SUITE — coverage gap |
| Data model | `src/models/VoiceModerationConfig.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/advancedMod.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/afk.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/ahelpText.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/antiAbuse.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/astralPortal.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/astralRaidEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/automod.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/autorole.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/backupEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/birthdayEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/boostTracker.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/boosterRoleEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/botStudio.js` | `botstudio` | Name-matched candidate only |
| Module | `src/modules/bumpEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/chatCatchup.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/chatSpark.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/colorRoleEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/commandHandler.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/confession.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/count.js` | `susaccountmonitoring` | Name-matched candidate only |
| Module | `src/modules/cyberSec.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/dashboardServer.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/devCouncil.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/devPanel.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/embedVisuality.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/emojiBlocker.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/giveaway.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/goodbye.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/help.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/leveling.js` | `levelingcontrolpanel` | Name-matched candidate only |
| Module | `src/modules/linkBlocker.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/logs.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/masterChannelSystems.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/masterSetupText.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/mediaPermsEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/modApply.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/modPanel.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/multiBot.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/music.js` | `musicaudioprofiles`, `musicplaybacklifecycle`, `musicplayerresolver`, `musicstayconnected` | Name-matched candidate only |
| Module | `src/modules/musicController.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/musicEqualizer.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/nativeAutoMod.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/nitroClaimDetector.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/petSystem.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/phoneSync.js` | `phonesync` | Name-matched candidate only |
| Module | `src/modules/premium.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/reactionRoleReconciler.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/reactionRoleReconciliation.js` | `reactionrolereconciliation` | Name-matched candidate only |
| Module | `src/modules/reactionRoleReliability.js` | `reactionrolereliability` | Name-matched candidate only |
| Module | `src/modules/reactionRoles.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/reminderEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/rep.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/roleManager.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/serverChronos.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/serverGazette.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/serverPulse.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/serverStats.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/socialActions.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/spotifyManager.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/starboardEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/starry.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/starryPop.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/steal.js` | `stealinput` | Name-matched candidate only |
| Module | `src/modules/stickyEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/supportDesk.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/susAccount.js` | `susaccountmonitoring` | Name-matched candidate only |
| Module | `src/modules/telemetryEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/tempVoice.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/tickets.js` | `tickets` | Name-matched candidate only |
| Module | `src/modules/tracker.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/translator.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/truthOrDare.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/verification.js` | `verification` | Name-matched candidate only |
| Module | `src/modules/voiceManager.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/voiceModerator.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/welcome.js` | — | NO MATCHED SUITE — coverage gap |
| Module | `src/modules/whois.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/aiEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/animeGifs.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/audioFilterPipeline.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/audioQuality.js` | `audioquality` | Name-matched candidate only |
| Utility | `src/utils/automodHelper.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/botAvatarHelper.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/colorBlendEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/commandExecutionContract.js` | `commandexecutioncontract` | Name-matched candidate only |
| Utility | `src/utils/contextHelper.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/dashboardOrigins.js` | `dashboardorigins` | Name-matched candidate only |
| Utility | `src/utils/database.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/discordSnowflake.js` | `discordsnowflake` | Name-matched candidate only |
| Utility | `src/utils/helpHelper.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/i18n.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/interactionHandler.js` | `interactionhandler` | Name-matched candidate only |
| Utility | `src/utils/loggingPolicy.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/musicManager.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/musicPlayerResolver.js` | `musicplayerresolver` | Name-matched candidate only |
| Utility | `src/utils/musicSearchHelper.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/musicStayConnected.js` | `musicstayconnected` | Name-matched candidate only |
| Utility | `src/utils/nativeAudioEngine.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/paymentHelper.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/paymentOrderAccess.js` | `paymentorderaccess` | Name-matched candidate only |
| Utility | `src/utils/prefixCommandGuard.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/prefixReplyPolicy.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/premiumHelper.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/spotifyApi.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/spotifyOAuth.js` | `spotifyoauthredirect` | Name-matched candidate only |
| Utility | `src/utils/streamResolverClient.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/tokenSanitizer.js` | — | NO MATCHED SUITE — coverage gap |
| Utility | `src/utils/tunnelManager.js` | — | NO MATCHED SUITE — coverage gap |

## Live staging checks required before commercial release

- Discord OAuth: state replay, callback mismatch, expiry/renewal, logout and cross-user/guild authorization.
- MongoDB: disconnect, timeouts, duplicate-key races, index creation and recovery.
- Commands: permission bypass, bot role hierarchy, missing member/guild/cache state, retries and concurrent dispatch.
- Moderation: raid bursts, false-positive boundaries, partial bot permissions and audit-log failure.
- Music: node reconnect, queue concurrency, unsupported sources, provider throttling and stream cleanup.
- Website: XSS, CSRF/origin boundaries, session leakage, authorization, cache isolation and abusive requests.
- Payments (currently disabled): Razorpay signature, amount/currency mismatch, duplicate/replayed webhook, refund, delayed event and entitlement reconciliation.

Do not accept real payments until dedicated live test-account cases above have passed.
