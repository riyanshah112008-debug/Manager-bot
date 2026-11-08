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
    for (const id of ["integrity-button","export-button","refresh-button","save-button"]) byId(id).disabled = false;
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
        result.textContent = "Saved locally. Revision " + saved.revision + ". Cloud upload is not enabled.";
        refresh();
      } catch (error) {
        result.textContent = error.message || "Could not save record.";
      }
    });
    byId("refresh-button").addEventListener("click", refresh);
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