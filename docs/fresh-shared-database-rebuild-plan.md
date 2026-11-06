# Fresh Shared Database Rebuild Plan

## Scope and safety

This work is isolated on `database/fresh-shared-storage`. It is not merged or deployed. The existing hosting process and production data must remain untouched while this work is prepared and tested.

The requested target is a fresh application database. Do not import old application records. Preserve existing source data until the replacement has passed tests and the owner explicitly approves cutover.

## Target architecture

- MongoDB is the authoritative server-side database for bot state.
- All three Discord bot clients use the same shared Mongoose connection and model definitions.
- Firestore is a synchronization relay, not the source of truth.
- Phone SQLite is an offline replica with a durable local outbox.
- Phone synchronization is opportunistic: it catches up when the phone is online.
- Sensitive credentials and payment secrets remain on trusted server infrastructure and are never copied to SQLite or relay documents.

## Audit findings

1. `src/index.js` establishes a Mongoose connection.
2. `src/utils/database.js` still maintains a JSON-backed store for multiple bot features, so the application currently has split persistence.
3. `src/utils/firestoreRelay.js` exists, but the earlier repository audit found no production call site connecting it to writes from the main database layer.
4. Additional JSON-backed feature stores exist in modules such as giveaways, temporary voice channels, and suspicious-account settings.
5. Some Mongoose models are declared inline in feature modules, and duplicate declarations exist for at least ChestGuild, WelcomeSettings, GoodbyeSettings, and MasterSecurity.
6. Multiple Discord clients run in one process and share a Mongoose connection. Background jobs and event listeners must not be initialized indiscriminately once per client.

## Implementation sequence

### Stage 1 — Shared persistence foundation
- Inventory every JSON/file-backed store and every inline Mongoose model.
- Define canonical model files and eliminate duplicate schema definitions without changing feature behavior.
- Introduce a single storage/service boundary using the existing Mongoose connection.
- Keep compatibility adapters while features are migrated; do not delete old files yet.
- Add tests for model registration, shared-client access, and data operations.

### Stage 2 — Fresh database provisioning
- Document required collections, indexes, uniqueness constraints, and retention rules.
- Use a new database name or explicitly empty new collections.
- Do not copy old application records.
- Keep bot tokens, service credentials, and payment secrets out of application records.

### Stage 3 — Durable server outbox and Firestore relay
- Record each committed change with a UUID, entity key, revision, operation type, and timestamp.
- Publish retryably to Firestore from the trusted server.
- Acknowledge only after the phone has durably applied the operation.
- Make replay idempotent and retain tombstones for deletions.
- Ensure relay rules restrict each phone identity to its own permitted records and acknowledgements.

### Stage 4 — Phone SQLite replica
- Maintain local entity revisions, applied-operation IDs, and an upload outbox.
- Permit offline reads and supported offline edits.
- On reconnect, pull server changes and submit queued phone edits for server validation.
- Reject or surface stale/conflicting edits; do not use blind last-write-wins.

### Stage 5 — Feature migration and cutover
- Move each feature from JSON persistence to the shared storage service.
- Keep payment, premium entitlement, security, and bot-generated records server-authoritative.
- Test restart recovery, duplicate delivery, network interruption, concurrent edits, and all three bot clients.
- Only cut over after explicit owner approval.

## Required safeguards

- No production deploy, merge, hosting restart, or destructive database operation as part of this branch preparation.
- No migration of old application records into the fresh database.
- No secrets in Git, Firestore relay payloads, or phone SQLite.
- No deletion of legacy JSON files until the replacement is verified and cutover is approved.
- MongoDB transactions may be used only if the selected deployment supports them (for example, a replica set); otherwise the outbox design must preserve durable ordering without assuming transaction support.
