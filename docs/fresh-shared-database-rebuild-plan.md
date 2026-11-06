# Fresh Shared Database Rebuild

## Safety boundary

All changes are isolated on `database/fresh-shared-storage`. This branch is not merged or deployed. Existing hosting, production databases, JSON files, and secrets are untouched. No old application records are imported. The old data is intentionally preserved until the new system is tested and cutover is separately approved.

## Target architecture

- MongoDB is the authoritative database for all bot clients.
- All three Discord clients share the process-wide Mongoose connection and canonical model registry.
- `BotRecord` provides namespaced records with optimistic revision checks.
- MongoDB tombstones preserve deletion state until the phone replica has received it.
- Firestore is a transport relay only. The server publishes versioned MongoDB state to the configured phone device.
- Phone SQLite is an offline replica with a durable local outbox and idempotent remote-apply ledger.
- Payment, premium entitlement, bot tokens, service-account credentials, and security state remain server-authoritative and must not be copied to the phone.

## Implemented on this branch

### Shared MongoDB foundation
- Canonical models added for ChestGuild, WelcomeSettings, GoodbyeSettings, MasterSecurity, PolicyVote, and BotRecord.
- Duplicate inline schemas for the canonicalized models removed from their feature modules.
- `mongoStore` provides asynchronous get, put, patch, remove, and list operations with revision-checked writes.
- Delete operations now create tombstones instead of hard-deleting records, allowing a disconnected phone to receive deletions later.
- The generic BotRecord unique index is explicitly created during startup.
- Bot startup now refuses to log in to Discord until `MONGO_URI` is configured and MongoDB is reachable. This prevents the new Mongo-only paths from silently falling back to local JSON.

### Feature migrations
- Media-permissions settings now read/write MongoDB ServerSettings only.
- Guild prefix lookup no longer falls back to the JSON store; prefix mutation remains a cache operation after its caller persists ServerSettings.
- AutoMod settings and status now persist through MongoDB models only.
- Music-controller configuration no longer hydrates from or writes to the local JSON store.
- Giveaways are stored as individual MongoDB records.
- Temporary voice-channel hub settings and active-channel IDs are stored in MongoDB.
- Suspicious-account settings are stored in MongoDB and loaded into a process cache.

### Phone download relay
- Added a publisher that scans BotRecord revisions not yet published to the relay.
- Relay operation IDs are deterministic per namespace, record ID, and revision, so retries are idempotent.
- A revision is marked published only after Firestore confirms the operation exists. A concurrent newer write remains pending for the next pass.
- Tombstones are published as delete operations.
- Publisher starts only when both `FIREBASE_SERVICE_ACCOUNT_JSON` and `PHONE_DB_DEVICE_UID` exist on the trusted server. Missing relay configuration does not block MongoDB or bot startup.
- Existing phone receiver applies relay operations to SQLite before acknowledging them.

## Required server configuration

Set these only in the trusted hosting environment, never in Git or phone SQLite:

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | Required authoritative MongoDB connection string for the fresh database |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional server-only Firebase service account JSON used by the relay publisher |
| `PHONE_DB_DEVICE_UID` | Optional Firebase anonymous-auth UID paired with the phone |

The phone receiver separately needs the Firebase project ID, Firebase Web API key, and local SQLite path. The Web API key is not an Admin credential; the service-account private key must never be copied to the phone.

## Verification added

- Existing model and disconnected-storage tests remain in `test:db-models`.
- Added MongoDB integration coverage for read/write, concurrent compare-and-set, patch, list, and tombstone deletion.
- Added deterministic relay-operation ID tests.
- Added GitHub Actions workflow with a disposable MongoDB service and a separate Python/SQLite job.
- Existing Firestore relay tests are included in CI.

The workflow has been committed but its run result must be checked on GitHub before treating the tests as passing. No local runtime or live MongoDB test has been claimed.

## Scope status — read before cutover

This branch is a substantial migration foundation, **not yet a complete replacement of every JSON-backed feature**.

- The five direct consumers listed in `docs/json-store-consumer-audit.md` have been addressed in their respective feature paths: media permissions, command prefix resolution, AutoMod configuration, and music-controller configuration.
- Giveaway, temporary voice-channel, and suspicious-account settings have been moved from their standalone JSON files to MongoDB.
- `src/utils/database.js` and `src/data/starry-store.json` are intentionally still present. Other feature domains in that store (including warnings, tickets, verification, moderation logs, AFK, welcome/goodbye, autorole, reminders, sticky messages, social stats, counting, and server listings) have **not** all been migrated. Do not delete or disable the JSON store yet.
- Firestore delivery currently supports **MongoDB-to-phone download and phone acknowledgements only**. The SQLite outbox can record local edits, but there is no trusted phone-to-server upload/validation path. Do not assume offline phone edits reach MongoDB.
- The three Discord clients share the process Mongoose connection, but background initializers must remain primary-client-only to avoid duplicate timers and scheduled jobs.
- CI definitions and tests have been added. Until GitHub Actions reports green, test status is pending. No production MongoDB connection, phone device sync, or end-to-end restart/offline test has been performed from this environment.

This is intentionally conservative: incomplete features are left visible and the old JSON data remains recoverable. A fresh database can be provisioned separately, but this branch must not be merged or deployed until the remaining migrations and bidirectional sync are completed and CI is green.

## Important remaining boundary

The current phone transport is **server-to-phone download**. The SQLite schema already records local pending operations, but a secure phone-to-server uploader and conflict-validation endpoint are not yet wired. Do not treat local SQLite edits as synchronized to MongoDB until that second direction is implemented and tested.

The legacy JSON store file and old local JSON data are retained as a recovery artifact. They are not imported into the fresh database. Review remaining call sites before deleting or retiring the module.

## Cutover requirements

1. Provision a fresh MongoDB database; do not import old application data.
2. Configure `MONGO_URI` and verify indexes.
3. Configure Firestore relay variables only when the phone download mirror is required.
4. Confirm the GitHub Actions MongoDB, Firestore, and SQLite jobs pass.
5. Test restart recovery, offline phone catch-up, duplicate relay delivery, concurrent writes, and tombstone propagation.
6. Complete and test phone-to-server upload before enabling offline edits as synchronized data.
7. Obtain explicit approval before merge, deployment, hosting restart, or any destructive cleanup.

No production cutover is part of this branch.
