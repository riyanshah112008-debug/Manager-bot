(function () {
  "use strict";

  const DB_NAME = "starry-phone-sqlite";
  const DB_VERSION = 1;
  const DB_KEY = "primary";
  let sqlite = null;
  let database = null;
  let writeQueue = Promise.resolve();

  const byId = (id) => document.getElementById(id);
  const setText = (id, value) => { const node = byId(id); if (node) node.textContent = String(value); };

  function openStorage() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("This browser does not support IndexedDB."));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("sqliteFiles")) {
          request.result.createObjectStore("sqliteFiles");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open browser storage."));
    });
  }

  async function loadBytes(storage) {
    return new Promise((resolve, reject) => {
      const tx = storage.transaction("sqliteFiles", "readonly");
      const request = tx.objectStore("sqliteFiles").get(DB_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not read local database."));
    });
  }

  async function saveBytes(storage, bytes) {
    return new Promise((resolve, reject) => {
      const tx = storage.transaction("sqliteFiles", "readwrite");
      tx.objectStore("sqliteFiles").put(bytes, DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Could not save local database."));
      tx.onabort = () => reject(tx.error || new Error("Local database save was aborted."));
    });
  }

  function initializeSchema(db) {
    db.run("PRAGMA foreign_keys = ON;");
    db.run("CREATE TABLE IF NOT EXISTS records (entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, payload_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted_at TEXT, PRIMARY KEY(entity_type, entity_id));");
    db.run("CREATE TABLE IF NOT EXISTS outbox (operation_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, operation TEXT NOT NULL CHECK(operation IN ('upsert','delete')), payload_json TEXT, base_revision INTEGER, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','acknowledged','failed')), attempts INTEGER NOT NULL DEFAULT 0);");
    db.run("CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(status, created_at);");
    db.run("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    db.run("CREATE TABLE IF NOT EXISTS applied_operations (operation_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");
    db.run("INSERT OR IGNORE INTO metadata(key,value) VALUES('schema_version','1');");
  }

  function runWrite(callback) {
    const task = writeQueue.then(async () => {
      const before = database.export();
      try {
        database.run("BEGIN IMMEDIATE;");
        const result = callback(database);
        database.run("COMMIT;");
        await saveBytes(sqlite.storage, database.export());
        return result;
      } catch (error) {
        try { database.run("ROLLBACK;"); } catch (_) {}
        try {
          database.close();
          database = new sqlite.SQL.Database(before);
        } catch (_) {}
        throw error;
      }
    });
    writeQueue = task.catch(() => {});
    return task;
  }

  function queryRows(sql, params) {
    const statement = database.prepare(sql);
    try {
      statement.bind(params || []);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  }

  function refresh() {
    const rows = queryRows("SELECT entity_type, entity_id, payload_json, revision, updated_at FROM records WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 30");
    const pending = queryRows("SELECT COUNT(*) AS count FROM outbox WHERE status='pending'")[0].count;
    setText("record-count", queryRows("SELECT COUNT(*) AS count FROM records WHERE deleted_at IS NULL")[0].count);
    setText("pending-count", pending);
    const list = byId("records-list");
    list.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No local records yet.";
      list.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const item = document.createElement("article");
      item.className = "record";
      const heading = document.createElement("strong");
      heading.textContent = row.entity_type + " / " + row.entity_id + " · revision " + row.revision;
      const body = document.createElement("pre");
      body.className = "muted small";
      body.textContent = row.payload_json;
      item.append(heading, body);
      list.appendChild(item);
    }
  }

  async function saveRecord(entityType, entityId, payload) {
    if (entityType !== "phone_test_records") {
      throw new Error("Cloud sync is currently limited to phone_test_records test data.");
    }
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(payload);
    const operationId = crypto.randomUUID();
    return runWrite((db) => {
      const current = queryRows("SELECT revision FROM records WHERE entity_type=? AND entity_id=?", [entityType, entityId])[0];
      const revision = current ? Number(current.revision) + 1 : 1;
      const upsert = db.prepare("INSERT INTO records(entity_type,entity_id,payload_json,revision,updated_at,deleted_at) VALUES(?,?,?,?,?,NULL) ON CONFLICT(entity_type,entity_id) DO UPDATE SET payload_json=excluded.payload_json,revision=excluded.revision,updated_at=excluded.updated_at,deleted_at=NULL");
      try { upsert.run([entityType, entityId, payloadJson, revision, now]); } finally { upsert.free(); }
      const outbox = db.prepare("INSERT INTO outbox(operation_id,entity_type,entity_id,operation,payload_json,base_revision,created_at,status,attempts) VALUES(?,?,?,?,?,?,?,'pending',0)");
      try { outbox.run([operationId, entityType, entityId, "upsert", payloadJson, current ? Number(current.revision) : 0, now]); } finally { outbox.free(); }
      return { revision, operationId };
    });
  }

  async function ensureDeviceId() {
    const row = queryRows("SELECT value FROM metadata WHERE key='device_id'")[0];
    if (row && row.value) return row.value;
    const id = crypto.randomUUID();
    await runWrite((db) => {
      const statement = db.prepare("INSERT OR IGNORE INTO metadata(key,value) VALUES('device_id',?)");
      try { statement.run([id]); } finally { statement.free(); }
    });
    return queryRows("SELECT value FROM metadata WHERE key='device_id'")[0].value;
  }

  async function applyRemoteOperation(operation) {
    if (!operation || operation.schemaVersion !== 1 || operation.entityType !== "phone_test_records") {
      throw new Error("Received an unsupported cloud operation.");
    }
    return runWrite((db) => {
      const already = queryRows("SELECT operation_id FROM applied_operations WHERE operation_id=?", [operation.operationId])[0];
      if (already) return false;
      const current = queryRows("SELECT revision FROM records WHERE entity_type=? AND entity_id=?", [operation.entityType, operation.entityId])[0];
      const currentRevision = current ? Number(current.revision) : 0;
      if (currentRevision !== Number(operation.baseRevision || 0)) {
        throw new Error("Revision conflict for " + operation.entityId + ". Local data was kept unchanged.");
      }
      const now = new Date().toISOString();
      if (operation.operation === "upsert") {
        if (!operation.payload || typeof operation.payload !== "object" || Array.isArray(operation.payload)) {
          throw new Error("Cloud upsert payload is invalid.");
        }
        const statement = db.prepare("INSERT INTO records(entity_type,entity_id,payload_json,revision,updated_at,deleted_at) VALUES(?,?,?,?,?,NULL) ON CONFLICT(entity_type,entity_id) DO UPDATE SET payload_json=excluded.payload_json,revision=excluded.revision,updated_at=excluded.updated_at,deleted_at=NULL");
        try { statement.run([operation.entityType, operation.entityId, JSON.stringify(operation.payload), currentRevision + 1, now]); } finally { statement.free(); }
      } else if (operation.operation === "delete") {
        const statement = db.prepare("INSERT INTO records(entity_type,entity_id,payload_json,revision,updated_at,deleted_at) VALUES(?,?, '{}',?,?,?) ON CONFLICT(entity_type,entity_id) DO UPDATE SET revision=excluded.revision,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at");
        try { statement.run([operation.entityType, operation.entityId, currentRevision + 1, now, now]); } finally { statement.free(); }
      } else {
        throw new Error("Unsupported cloud operation.");
      }
      const applied = db.prepare("INSERT INTO applied_operations(operation_id,applied_at) VALUES(?,?)");
      try { applied.run([operation.operationId, now]); } finally { applied.free(); }
      return true;
    });
  }

  async function syncNow() {
    const button = byId("sync-button");
    button.disabled = true;
    setText("sync-result", "Checking secure connection…");
    try {
      const deviceId = await ensureDeviceId();
      const health = await fetch("/api/phone-sync/status", { headers: { "Accept": "application/json" } });
      const healthData = await health.json().catch(() => ({}));
      if (!health.ok || !healthData.configured) {
        throw new Error(healthData.error || "Starry cloud sync is not configured yet.");
      }

      const pending = queryRows("SELECT operation_id,entity_type,entity_id,operation,payload_json,base_revision FROM outbox WHERE status='pending' AND entity_type='phone_test_records' ORDER BY created_at LIMIT 20");
      if (pending.length) {
        const response = await fetch("/api/phone-sync/push", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            deviceId,
            schemaVersion: 1,
            operations: pending.map(row => ({
              operationId: row.operation_id,
              entityType: row.entity_type,
              entityId: row.entity_id,
              operation: row.operation,
              payload: row.payload_json ? JSON.parse(row.payload_json) : null,
              baseRevision: Number(row.base_revision) || 0
            }))
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || "Could not upload local operations.");
        var uploadedCount = (data.acknowledged || []).length;
        var conflictCount = (data.conflicts || []).length;
        await runWrite((db) => {
          const update = db.prepare("UPDATE outbox SET status='acknowledged',attempts=attempts+1 WHERE operation_id=?");
          try { for (const id of data.acknowledged || []) update.run([id]); } finally { update.free(); }
        });
      }

      const pulled = await fetch("/api/phone-sync/pull?deviceId=" + encodeURIComponent(deviceId), { headers: { "Accept": "application/json" } });
      const pulledData = await pulled.json().catch(() => ({}));
      if (!pulled.ok || !pulledData.success) throw new Error(pulledData.error || "Could not download cloud operations.");
      const appliedIds = [];
      for (const operation of pulledData.operations || []) {
        await applyRemoteOperation(operation);
        appliedIds.push(operation.operationId);
      }
      if (appliedIds.length) {
        const ack = await fetch("/api/phone-sync/ack", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ deviceId, operationIds: appliedIds })
        });
        const ackData = await ack.json().catch(() => ({}));
        if (!ack.ok || !ackData.success) throw new Error(ackData.error || "Local changes saved, but cloud acknowledgement failed. Retry sync.");
      }

      refresh();
      setText("sync-result", "Secure relay connected. Uploaded " + (typeof uploadedCount === "number" ? uploadedCount : 0) + " test operation(s)" + ((typeof conflictCount === "number" && conflictCount) ? "; " + conflictCount + " conflict(s) need attention" : "") + "; downloaded " + appliedIds.length + ". Test records only.");
    } catch (error) {
      setText("sync-result", error.message || "Sync failed. Your local database is unchanged.");
    } finally {
      button.disabled = false;
    }
  }

  async function integrityCheck() {
    await writeQueue;
    const result = queryRows("PRAGMA integrity_check")[0];
    return result ? Object.values(result)[0] : "No integrity result";
  }

  function exportBackup() {
    const bytes = database.export();
    const blob = new Blob([bytes], { type: "application/vnd.sqlite3" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "starry-phone-backup.sqlite";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function start() {
    const storage = await openStorage();
    const SQL = await window.initSqlJs({
      locateFile: (file) => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/" + file
    });
    const bytes = await loadBytes(storage);
    database = bytes ? new SQL.Database(new Uint8Array(bytes)) : new SQL.Database();
    sqlite = { SQL, storage };
    initializeSchema(database);
    await saveBytes(storage, database.export());

    setText("engine-state", "SQLite WASM ready");
    setText("db-status", "Local database ready");
    for (const id of ["integrity-button","export-button","refresh-button","save-button","sync-button"]) byId(id).disabled = false;
    refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    byId("record-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const type = byId("entity-type").value.trim();
      const id = byId("entity-id").value.trim();
      const result = byId("form-result");
      try {
        if (!type || !id) throw new Error("Record type and ID are required.");
        const payload = JSON.parse(byId("record-json").value);
        const saved = await saveRecord(type, id, payload);
        result.textContent = "Saved locally. Revision " + saved.revision + ". Select Sync now to upload this test record.";
        refresh();
      } catch (error) {
        result.textContent = error.message || "Could not save record.";
      }
    });
    byId("refresh-button").addEventListener("click", refresh);
    byId("sync-button").addEventListener("click", syncNow);
    byId("integrity-button").addEventListener("click", async () => {
      try { setText("health-result", "Integrity: " + await integrityCheck()); }
      catch (error) { setText("health-result", "Integrity check failed: " + error.message); }
    });
    byId("export-button").addEventListener("click", exportBackup);
    start().catch((error) => {
      setText("engine-state", "Unavailable");
      setText("db-status", "Local database failed");
      setText("health-result", error.message || "Could not initialize the browser database.");
      console.error("[Starry Phone DB]", error);
    });
  });
})();