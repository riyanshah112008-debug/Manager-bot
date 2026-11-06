# Database migration: phone-hosted SQLite foundation

## Status
Planning and inventory only. This document does not change runtime database behavior and does not migrate or delete any records.

## Verified repository baseline (main)

- The bot starts from src/index.js and currently imports Mongoose.
- mongoose is a production dependency; no SQLite driver is currently listed in package.json.
- src/models/ contains 34 JavaScript model files. Several other modules also define Mongoose schemas inline.
- The bot checks mongoose.connection.readyState directly in multiple modules. Replacing Mongoose is therefore not a one-file change.
- src/utils/database.js is a JSON-file store at src/data/starry-store.json, with a legacy JSON migration path. Its save is debounced by 100 ms and written to a temporary file before rename. It is not SQLite and is not a remote database.
- The JSON store covers a subset of bot data; Mongoose models cover many additional domains.
- Runtime data under src/data/ is ignored by Git. Repository inspection cannot reveal live MongoDB or runtime JSON records.
- There is no sqlite or better-sqlite3 dependency in the current package manifest.

## Target architecture

The Android phone is the authoritative SQLite data owner. The remote Discord bot remains the Gateway/runtime process. The phone must not expose an unauthenticated database port to the public internet.

Recommended transport is an outbound-polling relay:

1. The remote bot writes an operation to a durable cloud outbox (Firestore is a candidate, subject to confirming the existing Firebase project and security rules).
2. The phone's Termux sync agent makes outbound HTTPS requests to claim pending operations.
3. The agent validates the operation, applies it transactionally to local SQLite, and records its idempotency key.
4. The phone acknowledges only after the SQLite transaction commits.
5. The relay marks the operation complete only after a valid acknowledgement.
6. On restart or reconnection, the agent resumes pending work. Duplicate delivery is safe because operation IDs are idempotent.
7. For operations queued while the phone is offline, the remote bot must persist them in the cloud outbox; RAM-only buffering is prohibited for durable writes.

This avoids requiring a stable public IP, inbound port forwarding, or a permanently reachable Android device. It also means a phone outage delays authoritative database operations; the bot must report this state rather than pretending a write succeeded.

## Required reliability properties

- At-least-once delivery plus idempotent application; never rely on exactly-once network delivery.
- Stable UUID operation IDs, creation timestamps, schema version, entity type, operation type, and payload.
- Explicit states: pending, leased, acknowledged, failed/dead-letter.
- Lease expiry and retry with bounded exponential backoff.
- Acknowledge after commit only; never delete an outbox item before acknowledgement.
- SQLite transactions, foreign-key enforcement, WAL mode, busy timeout, and periodic integrity checks.
- A durable backup/export path independent of the phone's primary SQLite file.
- Authenticated device identity, TLS, request signing or scoped credentials, replay protection, and rate limits.
- No secrets or full database contents in logs.
- Conflict policy documented per entity before enabling two-way writes.

## Migration phases

### Phase 0 — inventory (in progress)
- Enumerate every Mongoose model and inline schema.
- Find every model import, query, aggregation, transaction, and direct readyState dependency.
- Map each feature to its source of truth and classify data sensitivity/retention.
- Identify all JSON-store consumers and fields.

### Phase 1 — protocol and local database
- Define versioned entity schemas and a migration registry.
- Implement the SQLite schema and repository layer on the phone.
- Implement the Termux sync agent and authenticated relay protocol.
- Add tests for idempotency, crash recovery, duplicate delivery, stale leases, and offline restart.
- Keep the existing MongoDB and JSON stores unchanged during this phase.

### Phase 2 — shadow migration
- Export MongoDB collections from an authorized running environment; do not infer or fabricate data from GitHub.
- Import into SQLite with deterministic IDs and preserve timestamps.
- Compare source/destination document counts and checksums per collection.
- Run read-only shadow comparisons before any feature reads from SQLite.

### Phase 3 — controlled cutover
- Migrate one low-risk feature at a time behind a feature flag.
- Verify read/write parity, restart behavior, and phone-offline behavior.
- Keep rollback snapshots and the original MongoDB backup until sign-off.
- Do not remove Mongoose or MongoDB until all 34 model files, inline schemas, and call sites have been migrated and verified.

## Current blockers / facts to confirm before implementation

- Whether the Firebase project has Firestore enabled (Firebase Hosting alone is not a database or durable queue).
- Which remote runtime will host the Discord Gateway process and whether it has durable storage. If it does not, the relay/outbox must be external and durable.
- How the phone will run Termux reliably with battery optimization disabled and a wake lock; Android may still terminate background work.
- How the user can export MongoDB data. GitHub access does not grant access to MongoDB Atlas or hosting environment variables.
- Whether the user can run a one-time export command from the current runtime, without sharing credentials in chat.

## Safety rules

- Never commit MongoDB URIs, Discord tokens, Firebase service-account keys, relay secrets, or encryption keys.
- Never ask the user to paste secrets into chat.
- Do not add a public unauthenticated endpoint to the phone.
- Do not silently drop queued operations when the phone is unavailable.
- Do not claim a migration is complete until record counts, checksums, and feature tests pass.
- Do not remove MongoDB collections or dependencies as part of the foundation work.