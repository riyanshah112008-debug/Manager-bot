import tempfile
import unittest
from pathlib import Path

from sqlite_store import SQLiteDocumentStore


class SQLiteDocumentStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = SQLiteDocumentStore(Path(self.temp.name) / "phone.db")

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_put_persists_and_queues_atomically(self):
        op_id = self.store.put_record("guild_settings", "guild-1", {"prefix": "!"})
        self.assertEqual(self.store.get_record("guild_settings", "guild-1"), {"prefix": "!"})
        pending = self.store.list_pending()
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["operation_id"], op_id)

    def test_delete_is_tombstoned_and_queued(self):
        self.store.put_record("users", "user-1", {"xp": 10})
        self.store.delete_record("users", "user-1")
        self.assertIsNone(self.store.get_record("users", "user-1"))
        self.assertEqual(self.store.list_pending()[-1]["operation"], "delete")

    def test_remote_operation_is_idempotent(self):
        op = {
            "operation_id": "relay-op-1",
            "collection": "users",
            "record_id": "user-2",
            "operation": "put",
            "payload": {"xp": 42},
        }
        self.assertTrue(self.store.apply_remote_operation(op))
        self.assertFalse(self.store.apply_remote_operation(op))
        self.assertEqual(self.store.get_record("users", "user-2"), {"xp": 42})

    def test_acknowledgement_only_removes_named_operations(self):
        first = self.store.put_record("users", "a", {"n": 1})
        self.store.put_record("users", "b", {"n": 2})
        self.assertEqual(self.store.acknowledge([first]), 1)
        self.assertEqual(len(self.store.list_pending()), 1)

    def test_invalid_payload_rejected(self):
        with self.assertRaises(ValueError):
            self.store.put_record("users", "a", ["not", "an", "object"])

    def test_database_integrity(self):
        self.store.put_record("users", "a", {"ok": True})
        self.assertEqual(self.store.integrity_check(), "ok")


if __name__ == "__main__":
    unittest.main()
