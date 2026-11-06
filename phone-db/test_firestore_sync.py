import tempfile
import unittest
from pathlib import Path

from firestore_sync import _decode_fields
from sqlite_store import SQLiteDocumentStore


class FirestoreSyncTests(unittest.TestCase):
    def test_decode_firestore_nested_values(self):
        fields = {
            "name": {"stringValue": "phone"},
            "enabled": {"booleanValue": True},
            "count": {"integerValue": "12"},
            "nested": {"mapValue": {"fields": {"value": {"doubleValue": 2.5}}}},
            "items": {"arrayValue": {"values": [{"stringValue": "a"}, {"nullValue": None}]}},
        }
        self.assertEqual(_decode_fields(fields), {
            "name": "phone", "enabled": True, "count": 12,
            "nested": {"value": 2.5}, "items": ["a", None],
        })

    def test_remote_operation_is_idempotent_in_sqlite(self):
        with tempfile.TemporaryDirectory() as directory:
            store = SQLiteDocumentStore(Path(directory) / "phone.sqlite3")
            operation = {
                "operation_id": "relay-op-1",
                "collection": "guild_settings",
                "record_id": "guild-1",
                "operation": "put",
                "payload": {"prefix": "!"},
            }
            self.assertTrue(store.apply_remote_operation(operation))
            self.assertFalse(store.apply_remote_operation(operation))
            self.assertEqual(store.get_record("guild_settings", "guild-1"), {"prefix": "!"})
            self.assertEqual(store.integrity_check(), "ok")
            store.close()


if __name__ == "__main__":
    unittest.main()
