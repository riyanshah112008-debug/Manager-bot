# Starry database migration: browser SQLite and secure relay

## Status

**Foundation only; no production cutover or live synchronization has occurred.**

The public/phone-database.html page and public/phone-database.js module provide a browser-held SQLite database using SQLite WASM (sql.js), with its exported database file persisted in IndexedDB. The page can create local records, maintain a local outbox, run SQLite integrity checks, and export a .sqlite backup.

This is a browser-managed SQLite file, not Android's shared/native SQLite database and not OPFS. It belongs to the browser profile on that device. Browser storage can be cleared by the user or reclaimed by the browser. Export backups regularly.

**The page is not connected to Starry's live bot, MongoDB, Firestore, or a cloud synchronization endpoint.** Its outbox currently records local operations only. Do not enter production data or treat the local test page as a migrated database.

## User constraints

- Phone browser only.
- No APK, Termux, PC setup, or friend-hosted runtime.
- Keep hosting on the existing remote service.
- One shared data model for all Starry bot clients.
- Phone-owned SQLite is the intended data owner.
- Do not expose database ports or service-account credentials to the browser.
- Never delete or overwrite legacy data before verified export, counts, checksums, and rollback approval.

## Verified main-branch baseline before this change

- src/index.js imports Mongoose and uses MongoDB connection state.
- mongoose is a production dependency.
- src/utils/database.js stores several domains in src/data/starry-store.json.
- The JSON store includes guild settings, warnings, tickets, verification, moderation logs, AFK, welcome/goodbye, autorole, giveaways, reminders, sticky messages, social stats, music request channels, counting, and server listings.
- src/models/ contains 34 model files, with additional inline Mongoose schemas and direct model consumers.
- Runtime JSON data is ignored by Git; GitHub inspection cannot establish live record counts or contents.
- Firebase Hosting configuration deploys static hosting only. Hosting success does not prove Firestore is enabled or configured.
- The old migration branch used a Termux phone agent. That is incompatible with the user's current no-Termux requirement and must not be treated as the target design.

## Target architecture

### 1. Phone browser database

- The browser hosts the SQLite WASM database and a durable local outbox.
- Every local mutation writes the record and an outbox operation in one SQLite transaction.
- Operations have stable UUIDs, entity type and ID, operation type, schema version, base revision, payload, and creation timestamp.
- Repeated delivery must be safe through idempotency keys.
- The user can export a .sqlite backup from the browser.
- This current foundation is local-only. It does not yet pair a device, authenticate sync requests, or exchange data with the bot.

### 2. Render-hosted authenticated API

- The browser must use the existing authenticated Discord dashboard session to pair and synchronize.
- The API must validate the session, device identity, permissions, CSRF/origin policy, request size, schema version, entity allowlist, and operation payload.
- Use short-lived, scoped device credentials or WebCrypto device identity; never put Discord bot tokens, MongoDB URIs, Firebase service-account keys, or relay secrets in browser code or local storage.
- Enforce replay protection, rate limits, idempotency, and audit logging.
- A browser must never write directly to the bot's authoritative data store using broad credentials.

### 3. Durable relay

- Firestore may be used as a server-only durable transport queue after the Firebase project, Firestore database, service account, retention, and security configuration are verified.
- Render holds the service-account credential; the browser does not.
- The phone polls outbound over HTTPS. No inbound phone port, public database listener, or always-on Android process is required.
- Server-originated operations remain pending until the phone commits them locally and acknowledges them.
- Phone-originated operations are validated by the Render API before being placed in the relay.
- Use at-least-once delivery, lease expiry, bounded exponential backoff, dead-letter states, and acknowledgements only after local commit.
- Do not promise synchronization while the browser is closed. Android may suspend or terminate browser background work; reliable sync is foreground while the page is open, with background sync best-effort.

### 4. Shared bot data access

- All Starry bot clients must use one canonical entity contract and one shared operation/event identity scheme.
- Do not let each bot maintain an independent copy of guild configuration or counters.
- During transition, existing MongoDB and JSON stores remain read/write compatible until each domain is migrated and validated.
- Define per-domain behavior when the phone is offline. Security-sensitive configuration changes must not be reported as durably committed if the phone has not accepted them.
- Mongoose and legacy JSON are not removed by this foundation.

## Required sync operation envelope

Each operation must include:

- operationId: UUID and idempotency key.
- schemaVersion: explicit integer.
- deviceId and authenticated owner identity.
- entityType, entityId, and operation (upsert or delete).
- baseRevision and monotonic entity revision.
- payload (validated against the entity schema; omitted for a tombstone).
- createdAt, delivery attempts, lease metadata, and state.

Conflicts must be explicit. Do not silently use last-write-wins for moderation, permissions, payments, security settings, or other sensitive domains. Use compare-and-set revisions and a documented per-entity conflict policy.

## Migration sequence

### Phase 0 — inventory and contracts

- Inventory all 34 Mongoose model files, inline schemas, imports, queries, aggregation pipelines, transactions, and direct mongoose.connection.readyState dependencies.
- Inventory every JSON store and consumer.
- Define entity schemas, ownership, access control, retention, and conflict rules.
- Record baseline counts and checksums from authorized live data sources, not from GitHub.

### Phase 1 — local browser SQLite foundation

- Delivered in this branch: browser page, SQLite WASM initialization, IndexedDB file persistence, records table, local outbox, integrity check, and export.
- Remaining: browser compatibility testing on the target Android device, quota/error handling validation, and user-facing backup/restore testing.
- No live data is imported at this phase.

### Phase 2 — authenticated relay and pairing

- Implement a Render API using the existing Discord login/session system.
- Add one-time pairing challenge and device identity.
- Implement server-side Firestore adapter, leases, acknowledgements, retries, replay protection, and dead-letter handling.
- Add browser foreground polling and upload of local outbox operations.
- Test unauthorized owner/device access, duplicate operations, expired leases, malformed payloads, replay, and interrupted requests.

### Phase 3 — shadow migration

- Export each legacy domain from the actual running data source using authorized hosting access.
- Import into a staging SQLite database with deterministic IDs and preserved timestamps.
- Compare per-domain record counts and canonical checksums.
- Run read-only shadow comparisons; investigate every mismatch.
- Keep the old stores intact and retain restorable backups.

### Phase 4 — controlled cutover

- Migrate one low-risk domain at a time behind a feature flag.
- Verify all three bot clients read and write the same canonical records.
- Verify phone offline behavior, browser restart recovery, duplicate delivery, conflict resolution, and rollback.
- Only switch the authoritative read/write path after all checks pass.
- Remove MongoDB/JSON paths only after every model and consumer is migrated and sign-off is recorded.

## Current blockers

1. No authenticated browser-to-Render sync API exists.
2. No device pairing or device identity protocol exists.
3. No server-only Firestore relay is configured or verified for this design.
4. The bot runtime still depends on MongoDB models and JSON-file storage.
5. The local browser page is not yet linked into the authenticated dashboard navigation.
6. Android device persistence, browser quota behavior, and real-device backup/restore have not been tested.
7. No production data export, record-count comparison, checksum comparison, or live phone pairing has been completed.

## Safety and release rules

- Do not merge a MongoDB-authoritative phone-replica design as the final architecture.
- Do not claim two-way sync until both directions, acknowledgements, retries, and conflict handling pass integration tests.
- Do not claim production migration until verified source/destination counts and checksums match.
- Do not remove MongoDB, legacy JSON stores, or old collections during the foundation work.
- Do not deploy Firestore rules or change Firebase project settings without a separate verified configuration review.
- Never commit credentials or ask the user to paste secrets into chat.
