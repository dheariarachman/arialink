-- Explicitly version the new basis; never rewrite contracts, events or closings.
ALTER TABLE financial_state ADD COLUMN credit_basis TEXT NOT NULL DEFAULT 'capital-first';
UPDATE financial_state SET revision=revision+1 WHERE id=1;
