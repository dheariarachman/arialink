PRAGMA foreign_keys = ON;
CREATE TABLE users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')),
 active INTEGER NOT NULL DEFAULT 1, bootstrap_slot TEXT UNIQUE, created_at TEXT NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE records (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('transaction','balance','cash')),
 payload TEXT NOT NULL, version INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
 author_id TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL, last_mutation TEXT NOT NULL
);
CREATE TABLE mutation_receipts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), record_json TEXT NOT NULL
);
CREATE TABLE auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window INTEGER NOT NULL);
