"""Termux-side Firestore -> SQLite sync agent (Python standard library only).

This is an opt-in client. It requires Firebase Anonymous Auth to be enabled,
the repository Firestore rules to be published, and project/API-key settings.
It never contains an Admin SDK key and never acknowledges before SQLite commit.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlite_store import SQLiteDocumentStore

IDENTITY_ROOT = "https://identitytoolkit.googleapis.com/v1"
SECURE_TOKEN_ROOT = "https://securetoken.googleapis.com/v1"
FIRESTORE_ROOT = "https://firestore.googleapis.com/v1"


class SyncError(RuntimeError):
    pass


def _request(url: str, *, method: str = "GET", body: dict | None = None,
             bearer: str | None = None) -> tuple[int, Any]:
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
    if bearer:
        headers["Authorization"] = "Bearer " + bearer
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            detail = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            detail = {}
        return exc.code, detail
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SyncError("network request failed; pending operations remain queued") from exc


def _decode_value(value: dict) -> Any:
    if "nullValue" in value:
        return None
    if "stringValue" in value:
        return value["stringValue"]
    if "booleanValue" in value:
        return value["booleanValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "timestampValue" in value:
        return value["timestampValue"]
    if "arrayValue" in value:
        return [_decode_value(item) for item in value["arrayValue"].get("values", [])]
    if "mapValue" in value:
        return _decode_fields(value["mapValue"].get("fields", {}))
    return None


def _decode_fields(fields: dict) -> dict:
    return {key: _decode_value(value) for key, value in fields.items()}


class FirestorePhoneSync:
    def __init__(self, project_id: str, api_key: str, database_path: str,
                 auth_path: str | None = None, batch_size: int = 50):
        if not project_id or not api_key:
            raise ValueError("FIREBASE_PROJECT_ID and FIREBASE_WEB_API_KEY are required")
        if not 1 <= batch_size <= 100:
            raise ValueError("batch_size must be between 1 and 100")
        self.project_id = project_id
        self.api_key = api_key
        self.batch_size = batch_size
        self.store = SQLiteDocumentStore(database_path)
        default_auth = Path.home() / ".config" / "manager-bot" / "firebase-auth.json"
        self.auth_path = Path(auth_path) if auth_path else default_auth
        self.auth_path.parent.mkdir(parents=True, exist_ok=True)
        self.auth = self._load_auth()

    def _load_auth(self) -> dict:
        try:
            return json.loads(self.auth_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _save_auth(self) -> None:
        temp = self.auth_path.with_suffix(".tmp")
        temp.write_text(json.dumps(self.auth), encoding="utf-8")
        try:
            os.chmod(temp, 0o600)
        except OSError:
            pass
        temp.replace(self.auth_path)
        try:
            os.chmod(self.auth_path, 0o600)
        except OSError:
            pass

    def _sign_in(self) -> None:
        url = IDENTITY_ROOT + "/accounts:signUp?key=" + urllib.parse.quote(self.api_key)
        status, data = _request(url, method="POST", body={"returnSecureToken": True})
        if status != 200 or not data.get("idToken") or not data.get("localId"):
            raise SyncError("Firebase anonymous sign-in failed; check that Anonymous Auth is enabled")
        self.auth = {
            "uid": data["localId"],
            "idToken": data["idToken"],
            "refreshToken": data.get("refreshToken"),
            "expiresAt": int(time.time()) + int(data.get("expiresIn", 3600)) - 60,
        }
        self._save_auth()
        print("Paired Firebase device UID:", self.auth["uid"])
        print("Set this UID as PHONE_DB_DEVICE_UID in the trusted bot runtime.")

    def _token(self) -> str:
        if not self.auth.get("refreshToken"):
            self._sign_in()
        if int(self.auth.get("expiresAt", 0)) <= int(time.time()):
            url = SECURE_TOKEN_ROOT + "/v1/token?key=" + urllib.parse.quote(self.api_key)
            status, data = _request(url, method="POST", body={
                "grant_type": "refresh_token",
                "refresh_token": self.auth["refreshToken"],
            })
            if status != 200 or not data.get("id_token"):
                self.auth = {}
                self._sign_in()
            else:
                self.auth.update({
                    "idToken": data["id_token"],
                    "refreshToken": data.get("refresh_token", self.auth["refreshToken"]),
                    "expiresAt": int(time.time()) + int(data.get("expires_in", 3600)) - 60,
                })
                self._save_auth()
        return self.auth["idToken"]

    def _query_pending(self, token: str) -> list[dict]:
        url = (FIRESTORE_ROOT + "/projects/" + urllib.parse.quote(self.project_id, safe="")
               + "/databases/(default)/documents:runQuery")
        query = {
            "structuredQuery": {
                "from": [{"collectionId": "relayOperations"}],
                "where": {"compositeFilter": {
                    "op": "AND",
                    "filters": [
                        {"fieldFilter": {"field": {"fieldPath": "deviceUid"},
                         "op": "EQUAL", "value": {"stringValue": self.auth["uid"]}}},
                        {"fieldFilter": {"field": {"fieldPath": "status"},
                         "op": "EQUAL", "value": {"stringValue": "pending"}}},
                    ],
                }},
                "orderBy": [{"field": {"fieldPath": "createdAt"}, "direction": "ASCENDING"}],
                "limit": self.batch_size,
            }
        }
        status, rows = _request(url, method="POST", body=query, bearer=token)
        if status != 200 or not isinstance(rows, list):
            raise SyncError("Firestore pending-operation query failed (" + str(status) + ")")
        return [row["document"] for row in rows if isinstance(row, dict) and row.get("document")]

    def _acknowledge(self, token: str, document_name: str) -> None:
        query = urllib.parse.urlencode([
            ("updateMask.fieldPaths", "status"),
            ("updateMask.fieldPaths", "acknowledgedAt"),
        ])
        url = FIRESTORE_ROOT + "/" + document_name + "?" + query
        now = datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
        status, _ = _request(url, method="PATCH", body={"fields": {
            "status": {"stringValue": "acknowledged"},
            "acknowledgedAt": {"timestampValue": now},
        }}, bearer=token)
        if status != 200:
            raise SyncError("Firestore acknowledgement failed (" + str(status) + ")")

    def sync_once(self) -> int:
        token = self._token()
        documents = self._query_pending(token)
        applied = 0
        for document in documents:
            fields = _decode_fields(document.get("fields", {}))
            if fields.get("schemaVersion") != 1:
                raise SyncError("unsupported relay schema version; operation left pending")
            operation = {
                "operation_id": fields.get("operationId"),
                "collection": fields.get("collection"),
                "record_id": fields.get("recordId"),
                "operation": fields.get("operation"),
                "payload": fields.get("payload"),
            }
            # This transaction commits the record and idempotency marker together.
            self.store.apply_remote_operation(operation)
            # Acknowledge only after SQLite reports a successful commit.
            self._acknowledge(token, document["name"])
            applied += 1
        return applied

    def close(self) -> None:
        self.store.close()


def main() -> None:
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "manager-bot-96c07")
    api_key = os.environ.get("FIREBASE_WEB_API_KEY")
    database_path = os.environ.get(
        "PHONE_SQLITE_PATH",
        str(Path.home() / "manager-bot-data" / "manager-bot.sqlite3"),
    )
    if not api_key:
        raise SystemExit("Set FIREBASE_WEB_API_KEY to the Web API key from Firebase Project settings.")
    client = FirestorePhoneSync(project_id, api_key, database_path)
    try:
        count = client.sync_once()
        print("Sync complete; acknowledged", count, "operation(s).")
        print("SQLite integrity:", client.store.integrity_check())
    finally:
        client.close()


if __name__ == "__main__":
    main()
