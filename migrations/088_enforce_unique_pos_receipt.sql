-- Migration 088 — Enforce unique receipt_number per tenant on pos.transactions
--
-- Background: migration 066 created a NON-unique partial index on
-- (tenant_id, receipt_number), so the ``SELECT count(*) + 1`` receipt-
-- numbering pattern used by ``pos/commit.py`` could produce duplicate
-- receipts under concurrent commits. The service layer's receipt format
-- (``R{YYYYMMDD}-{tenant}-{transaction_id}``) is already deterministic
-- via the auto-increment transaction id, but we still want the DB to
-- reject any accidental duplicate going forward.
--
-- Idempotent: DROP INDEX IF EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS.
-- Rollback:
--     DROP INDEX IF EXISTS pos.idx_pos_txn_receipt_unique;
--     CREATE INDEX IF NOT EXISTS idx_pos_txn_receipt
--         ON pos.transactions (tenant_id, receipt_number)
--         WHERE receipt_number IS NOT NULL;

DROP INDEX IF EXISTS pos.idx_pos_txn_receipt;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_txn_receipt_unique
    ON pos.transactions (tenant_id, receipt_number)
    WHERE receipt_number IS NOT NULL;

COMMENT ON INDEX pos.idx_pos_txn_receipt_unique IS
    'Enforces unique receipt numbers per tenant. Partial (receipt_number IS NOT NULL) '
    'so multiple in-flight draft transactions (receipt_number=NULL) are still allowed.';
