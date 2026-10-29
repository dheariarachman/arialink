-- Expand record kinds while retaining every record, version, tombstone and retry marker.
CREATE TABLE records_with_debts (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('transaction','balance','cash','debt')),
 payload TEXT NOT NULL, version INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
 author_id TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL, last_mutation TEXT NOT NULL
);
INSERT INTO records_with_debts(id,kind,payload,version,deleted,author_id,updated_at,last_mutation)
 SELECT id,kind,payload,version,deleted,author_id,updated_at,last_mutation FROM records;
DROP TABLE records;
ALTER TABLE records_with_debts RENAME TO records;
