# JSON store consumer audit

## Original persistence boundary

`src/utils/database.js` is a synchronous JSON-file store backed by `src/data/starry-store.json`. Its API cannot be swapped for asynchronous MongoDB calls without migrating callers and awaiting every read/write.

## Confirmed consumers and branch migration status

| Consumer | Original use | Branch status |
| --- | --- | --- |
| `src/modules/mediaPermsEngine.js` | Guild media-permission settings | Migrated to MongoDB `ServerSettings.mediaPerms`; local JSON fallback removed |
| `src/modules/commandHandler.js` | Guild prefix lookup/update | Migrated to MongoDB-backed prefix lookup; setter now updates the shared in-process cache only |
| `src/utils/automodHelper.js` | Server AutoMod status | Migrated to MongoDB `AutomodGuild`; JSON fallback removed |
| `src/commands/moderation/automod.js` | Guild AutoMod configuration | Migrated to MongoDB `ServerSettings.automod` |
| `src/modules/musicController.js` | Music request-channel configuration | MongoDB `MusicController` is now the persistent source; local JSON hydration/writes removed |

## Additional JSON-file modules migrated

- `src/modules/giveaway.js`: individual giveaway records are stored in the shared Mongo repository.
- `src/modules/voiceManager.js`: per-guild hub channel and active temporary-channel IDs are stored in MongoDB.
- `src/modules/susAccount.js`: suspicious-account settings are stored in MongoDB and cached in process memory.

## Shared storage behavior

- `src/models/BotRecord.js` provides a unique `namespace + recordId` key, schema version, record revision, and relay publication revision.
- `src/utils/mongoStore.js` provides asynchronous get, put, patch, remove, and list operations.
- Compare-and-set writes reject stale revisions.
- Remove creates a tombstone instead of deleting the record, so the offline phone can receive deletions.
- The generic record index is created before the primary Discord client logs in.
- Startup now requires a reachable `MONGO_URI`; these Mongo-only features do not silently fall back to JSON.

## Phone synchronization boundary

- `src/utils/phoneSyncPublisher.js` publishes unrelayed MongoDB revisions to Firestore using deterministic operation IDs.
- The existing phone receiver commits each operation to SQLite and records its operation ID before acknowledging Firestore.
- This branch currently implements server-to-phone download only. A secure phone-to-server uploader and conflict-validation endpoint are still required before local phone edits can be considered synchronized.
- Do not place service-account private keys, Discord tokens, payment secrets, or premium/security authority in SQLite or Firestore.

## Remaining retirement work

The legacy JSON module and old JSON files are intentionally retained as a recovery artifact. No old records are imported. Before removing the module, search the working branch for any additional imports and verify the GitHub Actions checks. Production cutover and deletion of old data require separate explicit approval.
