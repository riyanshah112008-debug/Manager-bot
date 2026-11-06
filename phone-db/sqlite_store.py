"""Phone-side SQLite document store and durable synchronization outbox.

Uses only Python's standard library so it can run in Termux without a native
Node SQLite addon. This module is a local foundation; it does not expose a
network listener or connect to a cloud relay.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


class SQLiteDocumentStore:
    def __init__(self, database_path: str | Path):
        self.path = str(database_path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(
            self.path, timeout=15, isolation_level=None, check_same_thread=False
        )
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA foreign_keys = ON")
        self.connection.execute("PRAGMA journal_mode = WAL")
        self.connection.execute("PRAGMA synchronous = FULL")
        self.connection.execute("PRAGMA busy_timeout = 15000")
        self._create_schema()

    @contextmanager
    def _transaction(self):
        self.connection.execute('BEGIN IMMEDIATE')
        try:
            yield
        except Exception:
            self.connection.rollback()
            raise
        else:
            self.connection.commit()

    def _create_schema(self) -> None:
        self.connection.executescript("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS records (
                collection TEXT NOT NULL,
                record_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL,
                deleted INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
                PRIMARY KEY (collection, record_id)
            );
            CREATE INDEX IF NOT EXISTS idx_records_updated
                ON records(collection, updated_at);
            CREATE TABLE IF NOT EXISTS outbox (
                operation_id TEXT PRIMARY KEY,
                collection TEXT NOT NULL,
                record_id TEXT NOT NULL,
                operation TEXT NOT NULL CHECK (operation IN ('put', 'delete')),
                payload TEXT,
                created_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_outbox_created
                ON outbox(created_at);
            CREATE TABLE IF NOT EXISTS applied_operations (
                operation_id TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
        """)
        self.connection.execute(
            "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(1, ?)",
            (_now(),),
        )

    @staticmethod
    def _validate_key(collection: str, record_id: str) -> None:
        if not isinstance(collection, str) or not collection.strip() or len(collection) > 120:
            raise ValueError("collection must be a non-empty string of at most 120 characters")
        if not isinstance(record_id, str) or not record_id.strip() or len(record_id) > 200:
            raise ValueError("record_id must be a non-empty string of at most 200 characters")

    def get_record(self, collection: str, record_id: str) -> dict | None:
        self._validate_key(collection, record_id)
        row = self.connection.execute(
            "SELECT payload FROM records WHERE collection=? AND record_id=? AND deleted=0",
            (collection, record_id),
        ).fetchone()
        return json.loads(row["payload"]) if row else None

    def put_record(self, collection: str, record_id: str, payload: dict) -> str:
        self._validate_key(collection, record_id)
        if not isinstance(payload, dict):
            raise ValueError("payload must be a JSON object")
        operation_id = str(uuid.uuid4())
        now = _now()
        encoded = _json(payload)
        with self._transaction():
            self.connection.execute("""
                INSERT INTO records(collection, record_id, payload, version, updated_at, deleted)
                VALUES(?, ?, ?, 1, ?, 0)
                ON CONFLICT(collection, record_id) DO UPDATE SET
                    payload=excluded.payload,
                    version=records.version + 1,
                    updated_at=excluded.updated_at,
                    deleted=0
            """, (collection, record_id, encoded, now))
            self.connection.execute("""
                INSERT INTO outbox(operation_id, collection, record_id, operation, payload, created_at)
                VALUES(?, ?, ?, 'put', ?, ?)
            """, (operation_id, collection, record_id, encoded, now))
        return operation_id

    def delete_record(self, collection: str, record_id: str) -> str:
        self._validate_key(collection, record_id)
        operation_id = str(uuid.uuid4())
        now = _now()
        with self._transaction():
            self.connection.execute("""
                INSERT INTO records(collection, record_id, payload, version, updated_at, deleted)
                VALUES(?, ?, '{}', 1, ?, 1)
                ON CONFLICT(collection, record_id) DO UPDATE SET
                    version=records.version + 1,
                    updated_at=excluded.updated_at,
                    deleted=1
            """, (collection, record_id, now))
            self.connection.execute("""
                INSERT INTO outbox(operation_id, collection, record_id, operation, payload, created_at)
                VALUES(?, ?, ?, 'delete', NULL, ?)
            """, (operation_id, collection, record_id, now))
        return operation_id

    def list_pending(self, limit: int = 100) -> list[dict]:
        if not isinstance(limit, int) or limit < 1 or limit > 1000:
            raise ValueError("limit must be between 1 and 1000")
        rows = self.connection.execute("""
            SELECT operation_id, collection, record_id, operation, payload, created_at, attempts
            FROM outbox ORDER BY created_at, operation_id LIMIT ?
        """, (limit,)).fetchall()
        return [
            {**dict(row), "payload": json.loads(row["payload"]) if row["payload"] else None}
            for row in rows
        ]

    def acknowledge(self, operation_ids: Iterable[str]) -> int:
        ids = list(dict.fromkeys(operation_ids))
        if not ids:
            return 0
        if len(ids) > 1000 or any(not isinstance(item, str) for item in ids):
            raise ValueError("operation_ids must contain at most 1000 strings")
        with self._transaction():
            cursor = self.connection.executemany(
                "DELETE FROM outbox WHERE operation_id=?", ((item,) for item in ids)
            )
        return cursor.rowcount

    def record_delivery_failure(self, operation_id: str, error: str) -> bool:
        cursor = self.connection.execute("""
            UPDATE outbox SET attempts=attempts+1, last_error=?
            WHERE operation_id=?
        """, (str(error)[:500], operation_id))
        return cursor.rowcount == 1

    def apply_remote_operation(self, operation: dict) -> bool:
        """Apply one relay operation once; returns False for an already-applied ID."""
        required = ("operation_id", "collection", "record_id", "operation")
        if not isinstance(operation, dict) or any(not operation.get(k) for k in required):
            raise ValueError("operation is missing required fields")
        op_id = str(operation["operation_id"])
        collection, record_id = str(operation["collection"]), str(operation["record_id"])
        self._validate_key(collection, record_id)
        kind = operation["operation"]
        if kind not in ("put", "delete"):
            raise ValueError("unsupported operation")
        payload = operation.get("payload")
        if kind == "put" and not isinstance(payload, dict):
            raise ValueError("put operation requires an object payload")
        now = _now()
        with self._transaction():
            exists = self.connection.execute(
                "SELECT 1 FROM applied_operations WHERE operation_id=?", (op_id,)
            ).fetchone()
            if exists:
                return False
            if kind == "put":
                self.connection.execute("""
                    INSERT INTO records(collection, record_id, payload, version, updated_at, deleted)
                    VALUES(?, ?, ?, 1, ?, 0)
                    ON CONFLICT(collection, record_id) DO UPDATE SET
                        payload=excluded.payload,
                        version=records.version + 1,
                        updated_at=excluded.updated_at,
                        deleted=0
                """, (collection, record_id, _json(payload), now))
            else:
                self.connection.execute("""
                    INSERT INTO records(collection, record_id, payload, version, updated_at, deleted)
                    VALUES(?, ?, '{}', 1, ?, 1)
                    ON CONFLICT(collection, record_id) DO UPDATE SET
                        version=records.version + 1,
                        updated_at=excluded.updated_at,
                        deleted=1
                """, (collection, record_id, now))
            self.connection.execute(
                "INSERT INTO applied_operations(operation_id, applied_at) VALUES(?, ?)",
                (op_id, now),
            )
        return True

    def integrity_check(self) -> str:
        row = self.connection.execute("PRAGMA integrity_check").fetchone()
        return row[0] if row else "unknown"

    def close(self) -> None:
        self.connection.close()
