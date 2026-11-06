# JSON store consumer audit

## Purpose

This inventory identifies the runtime call sites that must be migrated before replacing the synchronous JSON store in src/utils/database.js. It is documentation-only and does not change persistence behavior.

## Current persistence boundary

- src/utils/database.js loads and writes src/data/starry-store.json.
- Its exported API is synchronous and returns in-memory objects immediately.
- Mongoose-backed models are already used elsewhere in the bot.
- A direct replacement with asynchronous MongoDB calls would break callers unless each call site is migrated and awaited.

## Confirmed direct consumers

| Consumer | Current API usage | Migration concern |
| --- | --- | --- |
| src/modules/mediaPermsEngine.js | getGuildSettings, updateGuildSettings | Convert reads/writes to awaited repository operations; preserve media-permissions merge behavior. |
| src/modules/commandHandler.js | getGuildSettings, updateGuildSettings | Prefix/config resolution must become async end-to-end or use a deliberate cache backed by MongoDB. |
| src/utils/automodHelper.js | getGuildSettings, updateGuildSettings | Automod settings reads and writes must be awaited and shared across all bot clients. |
| src/commands/moderation/automod.js | getGuildSettings, updateGuildSettings | Command handlers are async-capable; preserve existing configuration merge semantics. |
| src/modules/musicController.js | getAllMusicRequestChannels, setMusicRequestChannel | Startup cache hydration currently expects a synchronous object; convert initialization to an async readiness step before dependent operations. |

Other feature modules may still use their own JSON files or Mongoose models. They are separate migration units and must not be assumed covered by this list.

## Migration status

The isolated development branch now contains:

- A generic BotRecord model with a unique compound key, schema version, and monotonically increasing revision.
- An asynchronous Mongo repository with get, put, patch, remove, and list operations.
- Revision-checked writes for compare-and-set updates, including bounded retries for patches.
- Explicit failure when MongoDB is disconnected; the repository does not silently fall back to local JSON.
- Basic model and disconnected-database safety tests. These tests have been authored but have not yet been executed in a live project environment.

## Remaining safe migration order

1. Add integration tests against a disposable MongoDB database for concurrent writes, revision conflicts, missing records, serialization, and reconnect behavior.
2. Migrate the five confirmed consumers one at a time, updating every caller to await the new API.
3. Keep the old JSON store available as a disabled/unused compatibility artifact until cutover is approved; do not auto-import its contents into the fresh database.
4. Add an explicit startup readiness gate so commands do not read the repository before MongoDB is connected.
5. Only after all consumers are migrated should the old synchronous JSON store be retired.

## Multi-bot requirements

- All Discord clients in the process must share the same repository instance and Mongoose connection.
- Cache invalidation must be process-wide for the shared process; do not create per-client divergent settings caches.
- Background jobs and scheduled tasks must still start once, not once per worker client.
- MongoDB remains authoritative. Firestore relay and phone SQLite are separate synchronization layers and must not be used as a substitute for the primary write path.
