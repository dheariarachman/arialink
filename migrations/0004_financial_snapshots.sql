-- Add versioned final positions without rewriting any confirmed closing.
ALTER TABLE daily_closings ADD COLUMN snapshot_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE daily_closings ADD COLUMN financial_revision INTEGER;
ALTER TABLE daily_closings ADD COLUMN financial_json TEXT;

CREATE TABLE financial_state (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO financial_state(id) VALUES (1);

-- Track freshness only: no new per-edit history is stored for debt/receivables.
CREATE TRIGGER financial_insert_revision AFTER INSERT ON records
WHEN NEW.kind IN ('balance','cash','debt') OR
 (NEW.kind='transaction' AND json_type(NEW.payload,'$.credit')='object') BEGIN
 UPDATE financial_state SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER financial_update_revision AFTER UPDATE ON records
WHEN OLD.kind IN ('balance','cash','debt') OR NEW.kind IN ('balance','cash','debt') OR
 (OLD.kind='transaction' AND json_type(OLD.payload,'$.credit')='object') OR
 (NEW.kind='transaction' AND json_type(NEW.payload,'$.credit')='object') BEGIN
 UPDATE financial_state SET revision=revision+1 WHERE id=1;
END;
