-- Phase 7: Banking — BankStatement + BankTransaction tables + Voucher cheque fields
-- Applied directly via SQL (Prisma db push blocked by pgvector extension on local PostgreSQL)

-- Add 5 nullable cheque fields to vouchers table
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS cheque_no TEXT,
  ADD COLUMN IF NOT EXISTS cheque_dated DATE,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS cheque_status TEXT DEFAULT 'ISSUED',
  ADD COLUMN IF NOT EXISTS clearance_date DATE;

-- Create bank_statements table
CREATE TABLE IF NOT EXISTS bank_statements (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  ledger_id TEXT NOT NULL,
  bank TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  uploaded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  CONSTRAINT bank_statements_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS bank_statements_company_id_ledger_id_idx
  ON bank_statements(company_id, ledger_id);

ALTER TABLE bank_statements
  ADD CONSTRAINT bank_statements_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE bank_statements
  ADD CONSTRAINT bank_statements_ledger_id_fkey
    FOREIGN KEY (ledger_id) REFERENCES ledgers(id);

-- Create bank_transactions table
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  statement_id TEXT NOT NULL,
  tx_date DATE NOT NULL,
  description TEXT NOT NULL,
  debit_amount DECIMAL(15,2),
  credit_amount DECIMAL(15,2),
  balance DECIMAL(15,2),
  match_status TEXT NOT NULL DEFAULT 'UNMATCHED',
  matched_voucher_id TEXT,
  confidence TEXT,
  CONSTRAINT bank_transactions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS bank_transactions_company_id_statement_id_idx
  ON bank_transactions(company_id, statement_id);

CREATE INDEX IF NOT EXISTS bank_transactions_company_id_match_status_idx
  ON bank_transactions(company_id, match_status);

ALTER TABLE bank_transactions
  ADD CONSTRAINT bank_transactions_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE bank_transactions
  ADD CONSTRAINT bank_transactions_statement_id_fkey
    FOREIGN KEY (statement_id) REFERENCES bank_statements(id) ON DELETE CASCADE;

ALTER TABLE bank_transactions
  ADD CONSTRAINT bank_transactions_matched_voucher_id_fkey
    FOREIGN KEY (matched_voucher_id) REFERENCES vouchers(id);
