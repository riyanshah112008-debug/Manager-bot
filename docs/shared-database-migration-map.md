# Shared database migration map

## Status
**Audit artifact only — no runtime storage changes.** This is a working inventory based on repository source inspection. It is not a claim that all call sites, live records, or production settings have been verified. Update it as the model/query audit is completed.

## Non-negotiable target
All three Discord bot clients use **one logical shared database**. They must not receive separate database files or duplicate guild/user records.

- One phone-owned SQLite database file.
- Separate normalized tables for independent domains; not one giant JSON blob/table.
- One shared repository/data-access layer used by every bot client.
- Guild configuration is keyed by `guildId`.
- Guild-scoped user state is keyed by `(guildId, userId)`.
- Truly global user preferences/integrations are keyed by `userId`.
- Bot identity is optional audit metadata (`actorBotId` / `sourceBotId`), not a partition key for shared state.
- Per-client gateway/runtime state remains in memory per Discord client.

## Existing multibot design
`src/modules/multiBot.js` constructs one `MultiBotManager`, shares command/prefix-command/alias collections, and applies shared event hooks to primary and worker clients. Each client retains its own verification map, voice-call map, voice-channel locks, role, presence and gateway state.

The current manager loads worker bot credentials from the Mongoose `MultiBotToken` collection and environment variables. Those credentials are operational secrets and must not be copied into ordinary SQLite rows, Firestore relay payloads, logs, or migration exports. A separate protected credential strategy is required.

Because shared event hooks execute on multiple clients, writes caused by Discord events need idempotency keys. Use the Discord event ID plus domain/action identity where available; otherwise define a deterministic deduplication key before migrating that feature. Without this, three clients can award XP, create moderation records, or process the same event more than once.

## Mongoose model inventory (34 files)
This table is a domain grouping, not a finalized SQL schema. Several model files define more than one Mongoose model or embed nested subdocuments.

| Domain | Existing model files | Candidate logical key |
|---|---|---|
| Guild configuration and telemetry | `ServerSettings`, `AutomodSchema`, `AutoroleSchema`, `GuildTrackerSettings`, `GuildTelemetry`, `BoostChannel` | `guildId` plus feature/channel key |
| Moderation and security | `ModCase`, `VoiceModerationConfig`, `ExecutionLock`, `NitroClaim` | guild + case/incident/claim ID; lock key |
| User progression and activity | `User`, `UserActivity`, `UserSettings` | guild + user for progression; user for global settings |
| Roles, rewards and economy | `BoosterRole`, `ColorRole`, `ShopItem`, `ChestChannel`, `RaidBoss` | guild + resource/user ID |
| Music and voice | `MusicController`, `TempVoiceConfig` | guild + channel/controller ID |
| Community features | `SocialStats`, `StickyMessage`, `StarboardConfig`, `Tag`, `AstralPortal` | guild + feature-specific ID |
| Support and records | `SupportConversation`, `Transcript`, `ServerBackup` | conversation/transcript/backup ID and guild |
| Scheduled/background work | `Reminder`, `ChannelScrapeState` | task ID; guild/channel key |
| Authentication and billing | `OAuthSession`, `PaymentOrder` | token hash; order ID |
| External integrations | `UserSpotify` | global user ID |
| Multibot configuration | `MultiBotToken` | bot ID; credentials stored separately |

Known schema details that affect relational design:

- `User` has a unique compound index on `(userId, guildId)`.
- `UserActivity` has a unique compound index on `(guildId, userId)`.
- `Tag` is unique on `(guildId, name)`.
- `ColorRole` and `BoosterRole` are unique on `(guildId, userId)`.
- `SocialStats` uses a pair/action uniqueness constraint.
- `StarboardConfig` also defines a separate `StarboardMessage` model, unique by `(guildId, originalMessageId)`.
- `AutomodSchema` and `AutoroleSchema` define multiple models; `StarboardConfig` defines more than one model. They must not be represented as one table merely because they share a source file.
- `RaidBoss`, `AstralPortal`, `Transcript`, and `VoiceModerationConfig` contain nested data that needs explicit child-table vs JSON-column decisions.
- `OAuthSession` has expiring token data; `PaymentOrder` has mixed payment details. Both require retention and access-control decisions.

## Existing JSON store
`src/utils/database.js` is a second persistence system, separate from Mongoose. It loads `src/data/starry-store.json` (or migrates `manager-store.json`), keeps an in-memory object, and writes a temporary file followed by rename after a debounced save. Its runtime data is git-ignored and cannot be inventoried from repository source.

The current store has these logical domains:

| JSON key | Candidate table/domain |
|---|---|
| `guild_settings` | guild settings |
| `warnings` | moderation warnings |
| `tickets_config`, `tickets` | ticket configuration and ticket records |
| `verification_config` | verification configuration |
| `video_verification_config`, `video_verifications` | video verification configuration and sessions |
| `moderation_logs` | moderation audit log |
| `afk` | guild-scoped user AFK state |
| `welcome_config`, `goodbye_config` | welcome/goodbye configuration |
| `autorole_config` | autorole configuration |
| `giveaways` | giveaway records |
| `reminders` | scheduled reminders |
| `sticky_messages` | sticky-message configuration |
| `social_stats` | user-pair social counters |
| `music_request_channels` | guild music request configuration |
| `counting_config` | guild counting configuration |
| `server_listings` | guild listing records |

The JSON API also exposes CRUD-style functions for these domains. All consumers and read-modify-write behavior still need to be mapped before replacing it. Do not migrate only Mongoose while leaving this store behind.

## Sensitive data boundaries
Never put these values in ordinary relay payloads, plaintext SQLite tables, logs, or public Git history:

- `MultiBotToken.token` and custom bot credentials such as `ServerSettings.premium.customBotToken`.
- `UserSpotify.accessToken` and `refreshToken`.
- OAuth session tokens or raw session credentials.
- Payment secrets or unnecessary payment-provider details.

A secret vault/encryption design must keep key material separate from the database backup. The first migration should exclude these fields until the protected-storage design is reviewed.

## Relay status and gaps
The Firestore relay work currently exists on `database/firestore-relay-protocol`, not on `main`. PR #89 was merged into the migration branch after PR #88 had already been merged into `main`; therefore the relay adapter is not currently present on `main`.

The relay adapter is a dormant transport primitive, not a database adapter:

- It can enqueue bot-to-phone `put` / `delete` operations using a service account in the trusted runtime.
- The phone sync client polls pending operations, applies them to SQLite transactionally, then acknowledges.
- No production bot model or JSON-store write is routed through it.
- Phone-originated outbox delivery back to the bot is not implemented.
- The adapter does not itself enforce a configured allowlist for the target phone UID; this should be added before any production caller is introduced.
- The one-shot phone sync path has no continuous supervisor/backoff/dead-letter workflow yet.
- No live MongoDB export/import or record parity check has occurred.

## Migration sequence
1. Finish source inventory: every model import and CRUD call, inline schema, JSON-store caller, and direct Mongoose readiness check.
2. Agree on relational keys, indexes, retention, cascade rules, and sensitive-field exclusions for every domain.
3. Complete the relay protocol (device allowlist, retry/lease/dead-letter semantics, phone-to-bot outbox, observability) and test crash/restart cases.
4. Build one SQLite schema and one shared repository contract. Every Discord client must use that same repository instance/connection boundary.
5. Export MongoDB and JSON data from their authorized runtime sources; preserve original stores and create verified backups.
6. Import into SQLite with deterministic IDs; compare per-domain counts and checksums.
7. Run shadow reads and event-deduplication tests across all three clients.
8. Cut over one low-risk domain at a time behind feature flags. Keep rollback paths until parity is proven.
9. Remove old stores only after every domain, scheduled job, dashboard path, and multibot worker has passed production verification.

## Explicit non-goals for this audit change
- No change to bot startup, command behavior, dashboard behavior, or live database writes.
- No migration or deletion of MongoDB or JSON records.
- No changes to Firebase project settings or deployment.
- No credentials, tokens, or secrets added to Git.
- No production cutover.
