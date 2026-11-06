# Firestore relay protocol (phase 1)

## Status and safety boundary

This is a transport adapter and security-rules proposal, not a live sync deployment. It does not replace MongoDB, change bot model reads/writes, export data, or connect the phone. The bot only writes an outbox document when a future caller explicitly invokes the adapter. No secret belongs in Git.

## Firestore document

Collection: `relayOperations`; document ID: stable operation UUID.

Fields:
- `schemaVersion`: integer (currently 1)
- `operationId`: stable UUID/string
- `deviceUid`: Firebase Authentication UID of the paired phone
- `collection`, `recordId`: validated logical keys
- `operation`: `put` or `delete`
- `payload`: JSON object for put, null for delete
- `status`: `pending` then `acknowledged`
- `createdAt`: ISO timestamp
- `acknowledgedAt`: Firestore timestamp, set by the phone only after SQLite commit

The server adapter uses Firebase Admin SDK and a service account held only in the runtime secret `FIREBASE_SERVICE_ACCOUNT_JSON`. Admin SDK writes bypass Firestore client rules. Duplicate operation IDs are idempotent; conflicting reuse is rejected.

## Client authorization

The intended phone client signs in with Firebase Authentication (anonymous sign-in is sufficient for initial device pairing). Firestore rules scope reads and acknowledgement updates to documents whose `deviceUid` equals the authenticated UID. The phone must query with that exact UID filter. Client create/delete and payload mutation are denied. Never place an Admin service-account key on the phone.

Before enabling the phone client:
1. Enable Firebase Authentication > Sign-in method > Anonymous in project `manager-bot-96c07`.
2. Publish the checked-in `firestore.rules` to the same Firebase project.
3. Obtain the Firebase Web API key from Project settings; it is public project configuration, not a service-account secret.
4. Pair the phone and record its authenticated UID as the target `deviceUid` in the bot runtime configuration.
5. Deploy the phone sync agent only after its query and acknowledgement tests pass.

Do not use Test mode. Do not grant broad authenticated-user access to the whole database. The rules intentionally permit only owner-scoped reads and acknowledgement-only updates.

## Delivery semantics

The phone must:
1. Query pending operations for its UID, in bounded batches.
2. Validate schema version and all fields.
3. Apply the operation in a single SQLite transaction, recording `operationId` in the applied-operation table.
4. Commit SQLite.
5. Update only `status='acknowledged'` and `acknowledgedAt=server timestamp` in Firestore.
6. Treat duplicate delivery as success only when the operation ID is already recorded locally.

If the process crashes before the local commit, the operation remains pending. If it crashes after commit but before acknowledgement, it will be delivered again and SQLite idempotency prevents duplicate application. Never acknowledge before commit.

## Remaining implementation

- Add the Termux phone client: Firebase Auth REST sign-in, Firestore REST query, SQLite apply, then owner-scoped acknowledgement.
- Add a bot feature adapter that emits operations for explicitly migrated data domains. Do not wire global Mongoose writes to this relay yet.
- Add pairing UX, retries/backoff, dead-letter monitoring, backups, and reconciliation.
- Add Firebase Authentication and Firestore configuration to the user's Firebase project; repository files alone do not publish rules or enable sign-in providers.

## Operational limits

Firestore Spark quota is limited. Monitor document count, reads, writes, deletes, and egress. This queue is not a replacement for backups. Configure retention/cleanup only after acknowledged records have been reconciled and backed up. Do not store Discord tokens, passwords, OAuth session tokens, or other secrets in operation payloads.
