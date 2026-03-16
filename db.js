import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "webcake-mcp.db");

const db = new Database(DB_PATH);

// WAL mode for better concurrent reads
db.pragma("journal_mode = WAL");

// ── Schema ──

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ── Simple key-value helpers ──

const stmtGet = db.prepare("SELECT value FROM config WHERE key = ?");
const stmtSet = db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)");
const stmtDel = db.prepare("DELETE FROM config WHERE key = ?");
const stmtAll = db.prepare("SELECT key, value FROM config");

export function getConfig(key) {
  const row = stmtGet.get(key);
  return row ? row.value : null;
}

export function setConfig(key, value) {
  stmtSet.run(key, String(value));
}

export function delConfig(key) {
  stmtDel.run(key);
}

export function getAllConfig() {
  const rows = stmtAll.all();
  const result = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export default db;
