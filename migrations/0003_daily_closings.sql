-- A revision changes in the same transaction as every balance/cash write.
-- Closing confirmation can therefore reject a stale review in one SQL statement.
CREATE TABLE balance_state (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0,
 history_started_at TEXT NOT NULL
);
INSERT INTO balance_state(id,history_started_at) VALUES (1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));

CREATE TABLE balance_history (
 revision INTEGER PRIMARY KEY, record_id TEXT NOT NULL, kind TEXT NOT NULL,
 before_payload TEXT, after_payload TEXT NOT NULL,
 before_deleted INTEGER NOT NULL, after_deleted INTEGER NOT NULL,
 record_version INTEGER NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL,
 changed_at TEXT NOT NULL
);
CREATE TRIGGER balance_insert_history AFTER INSERT ON records
WHEN NEW.kind IN ('balance','cash') BEGIN
 UPDATE balance_state SET revision=revision+1 WHERE id=1;
 INSERT INTO balance_history
 SELECT revision,NEW.id,NEW.kind,NULL,NEW.payload,1,NEW.deleted,NEW.version,
 NEW.author_id,(SELECT name FROM users WHERE id=NEW.author_id),NEW.updated_at
 FROM balance_state WHERE id=1;
END;
CREATE TRIGGER balance_update_history AFTER UPDATE ON records
WHEN NEW.kind IN ('balance','cash') BEGIN
 UPDATE balance_state SET revision=revision+1 WHERE id=1;
 INSERT INTO balance_history
 SELECT revision,NEW.id,NEW.kind,OLD.payload,NEW.payload,OLD.deleted,NEW.deleted,NEW.version,
 NEW.author_id,(SELECT name FROM users WHERE id=NEW.author_id),NEW.updated_at
 FROM balance_state WHERE id=1;
END;

CREATE TABLE daily_closings (
 id TEXT PRIMARY KEY, business_date TEXT NOT NULL UNIQUE,
 closed_at TEXT NOT NULL, author_id TEXT NOT NULL REFERENCES users(id), author_name TEXT NOT NULL,
 source_revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
 total INTEGER NOT NULL CHECK(total>=0), explanation TEXT,
 previous_id TEXT REFERENCES daily_closings(id)
);
CREATE INDEX daily_closings_date ON daily_closings(business_date DESC);
-- Closing records have no edit/delete API; protect their permanence in storage too.
CREATE TRIGGER daily_closing_no_update BEFORE UPDATE ON daily_closings BEGIN
 SELECT RAISE(ABORT,'Closing records are immutable');
END;
CREATE TRIGGER daily_closing_no_delete BEFORE DELETE ON daily_closings BEGIN
 SELECT RAISE(ABORT,'Closing records are immutable');
END;
