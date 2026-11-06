-- Credit contracts stay separate from operational transactions and debt reports.
CREATE TABLE goods_credits (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, version INTEGER NOT NULL,
 author_id TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL
);
CREATE TABLE goods_credit_operations (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), record_json TEXT NOT NULL
);
