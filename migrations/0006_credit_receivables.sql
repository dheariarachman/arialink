-- Include goods credit in future closing freshness checks. Historical snapshots
-- remain immutable; existing contracts are projected directly, never duplicated.
CREATE TRIGGER goods_credit_financial_insert AFTER INSERT ON goods_credits BEGIN
 UPDATE financial_state SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER goods_credit_financial_update AFTER UPDATE ON goods_credits BEGIN
 UPDATE financial_state SET revision=revision+1 WHERE id=1;
END;
CREATE TRIGGER goods_credit_financial_delete AFTER DELETE ON goods_credits BEGIN
 UPDATE financial_state SET revision=revision+1 WHERE id=1;
END;
UPDATE financial_state SET revision=revision+1 WHERE id=1;
