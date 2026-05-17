-- Migration 0006: Sync Prisma schema with production database
-- Adds columns/tables present in schema.prisma but missing from prior migrations.
-- Fixes banking tables created with snake_case columns in migration 0004.
-- All statements use IF NOT EXISTS / DO $$ blocks — safe to run multiple times.

-- ============================================================
-- 1. ledgers: add tdsApplicable  ← CRITICAL (fixes P2022 on findMany)
-- ============================================================
ALTER TABLE "ledgers" ADD COLUMN IF NOT EXISTS "tdsApplicable" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2. vouchers: add Phase-8 e-Invoice / TDS / cheque fields
-- ============================================================
ALTER TABLE "vouchers"
  ADD COLUMN IF NOT EXISTS "irnQrCode"          TEXT,
  ADD COLUMN IF NOT EXISTS "irnGeneratedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "eWayBillValidUntil"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tdsSection"          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "tdsRate"             DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "tdsAmount"           DECIMAL(15,2);

-- Cheque / bank fields: migration 0004 may have added these as snake_case.
-- Rename snake_case → camelCase if they exist; otherwise ADD the camelCase column.
DO $$
BEGIN
  -- chequeNo
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='cheque_no') THEN
    ALTER TABLE "vouchers" RENAME COLUMN cheque_no TO "chequeNo";
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='chequeNo') THEN
    ALTER TABLE "vouchers" ADD COLUMN "chequeNo" TEXT;
  END IF;

  -- chequeDated
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='cheque_dated') THEN
    ALTER TABLE "vouchers" RENAME COLUMN cheque_dated TO "chequeDated";
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='chequeDated') THEN
    ALTER TABLE "vouchers" ADD COLUMN "chequeDated" DATE;
  END IF;

  -- bankName (vouchers — not the same as ledgers.bankName)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='bank_name') THEN
    ALTER TABLE "vouchers" RENAME COLUMN bank_name TO "bankName";
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='bankName') THEN
    ALTER TABLE "vouchers" ADD COLUMN "bankName" TEXT;
  END IF;

  -- chequeStatus
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='cheque_status') THEN
    ALTER TABLE "vouchers" RENAME COLUMN cheque_status TO "chequeStatus";
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='chequeStatus') THEN
    ALTER TABLE "vouchers" ADD COLUMN "chequeStatus" TEXT DEFAULT 'ISSUED';
  END IF;

  -- clearanceDate
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='clearance_date') THEN
    ALTER TABLE "vouchers" RENAME COLUMN clearance_date TO "clearanceDate";
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vouchers' AND column_name='clearanceDate') THEN
    ALTER TABLE "vouchers" ADD COLUMN "clearanceDate" DATE;
  END IF;
END $$;

-- ============================================================
-- 3. cost_centres table
-- ============================================================
CREATE TABLE IF NOT EXISTS "cost_centres" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cost_centres_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cost_centres_companyId_name_key"
  ON "cost_centres"("companyId", "name");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name='cost_centres_companyId_fkey') THEN
    ALTER TABLE "cost_centres"
      ADD CONSTRAINT "cost_centres_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 4. voucher_entries: add costCentreId FK
-- ============================================================
ALTER TABLE "voucher_entries" ADD COLUMN IF NOT EXISTS "costCentreId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name='voucher_entries_costCentreId_fkey') THEN
    ALTER TABLE "voucher_entries"
      ADD CONSTRAINT "voucher_entries_costCentreId_fkey"
      FOREIGN KEY ("costCentreId") REFERENCES "cost_centres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. gstr2a_imports table
-- ============================================================
CREATE TABLE IF NOT EXISTS "gstr2a_imports" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "returnPeriod"  VARCHAR(7) NOT NULL,
  "supplierGstin" VARCHAR(15) NOT NULL,
  "invoiceNo"     TEXT NOT NULL,
  "invoiceDate"   DATE NOT NULL,
  "taxableValue"  DECIMAL(15,2) NOT NULL,
  "cgst"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgst"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igst"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "uploadedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gstr2a_imports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gstr2a_imports_companyId_returnPeriod_supplierGstin_invoiceNo_key"
  ON "gstr2a_imports"("companyId", "returnPeriod", "supplierGstin", "invoiceNo");
CREATE INDEX IF NOT EXISTS "gstr2a_imports_companyId_returnPeriod_idx"
  ON "gstr2a_imports"("companyId", "returnPeriod");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name='gstr2a_imports_companyId_fkey') THEN
    ALTER TABLE "gstr2a_imports"
      ADD CONSTRAINT "gstr2a_imports_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 6. einvoice_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS "einvoice_logs" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "voucherId"    TEXT NOT NULL,
  "attempt"      INTEGER NOT NULL DEFAULT 1,
  "status"       TEXT NOT NULL,
  "errorCode"    TEXT,
  "errorMsg"     TEXT,
  "requestJson"  JSONB,
  "responseJson" JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "einvoice_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "einvoice_logs_companyId_voucherId_idx"
  ON "einvoice_logs"("companyId", "voucherId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name='einvoice_logs_companyId_fkey') THEN
    ALTER TABLE "einvoice_logs"
      ADD CONSTRAINT "einvoice_logs_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name='einvoice_logs_voucherId_fkey') THEN
    ALTER TABLE "einvoice_logs"
      ADD CONSTRAINT "einvoice_logs_voucherId_fkey"
      FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 7. notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "entityId"       TEXT,
  "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recipientEmail" TEXT NOT NULL,
  "metadata"       JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_companyId_type_sentAt_idx"
  ON "notifications"("companyId", "type", "sentAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name='notifications_companyId_fkey') THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 8. bank_statements: create with camelCase OR rename from snake_case
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='bank_statements') THEN
    CREATE TABLE "bank_statements" (
      "id"         TEXT NOT NULL,
      "companyId"  TEXT NOT NULL,
      "ledgerId"   TEXT NOT NULL,
      "bank"       TEXT NOT NULL,
      "fromDate"   DATE NOT NULL,
      "toDate"     DATE NOT NULL,
      "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "uploadedBy" TEXT NOT NULL,
      "rowCount"   INTEGER NOT NULL,
      CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "bank_statements_companyId_ledgerId_idx"
      ON "bank_statements"("companyId", "ledgerId");
    ALTER TABLE "bank_statements"
      ADD CONSTRAINT "bank_statements_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "bank_statements"
      ADD CONSTRAINT "bank_statements_ledgerId_fkey"
      FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ELSE
    -- Table existed from migration 0004 with snake_case columns — rename each
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='company_id') THEN
      ALTER TABLE "bank_statements" RENAME COLUMN company_id TO "companyId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='ledger_id') THEN
      ALTER TABLE "bank_statements" RENAME COLUMN ledger_id TO "ledgerId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='from_date') THEN
      ALTER TABLE "bank_statements" RENAME COLUMN from_date TO "fromDate";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='to_date') THEN
      ALTER TABLE "bank_statements" RENAME COLUMN to_date TO "toDate";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='uploaded_at') THEN
      ALTER TABLE "bank_statements" RENAME COLUMN uploaded_at TO "uploadedAt";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='uploaded_by') THEN
      ALTER TABLE "bank_statements" RENAME COLUMN uploaded_by TO "uploadedBy";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_statements' AND column_name='row_count') THEN
      ALTER TABLE "bank_statements" RENAME COLUMN row_count TO "rowCount";
    END IF;
    -- Drop old snake_case index, add camelCase index
    DROP INDEX IF EXISTS "bank_statements_company_id_ledger_id_idx";
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='bank_statements' AND indexname='bank_statements_companyId_ledgerId_idx') THEN
      CREATE INDEX "bank_statements_companyId_ledgerId_idx" ON "bank_statements"("companyId", "ledgerId");
    END IF;
    -- Fix FK constraints
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_statements_company_id_fkey') THEN
      ALTER TABLE "bank_statements" DROP CONSTRAINT "bank_statements_company_id_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_statements_companyId_fkey') THEN
      ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_statements_ledger_id_fkey') THEN
      ALTER TABLE "bank_statements" DROP CONSTRAINT "bank_statements_ledger_id_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_statements_ledgerId_fkey') THEN
      ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_ledgerId_fkey"
        FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 9. bank_transactions: create with camelCase OR rename from snake_case
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='bank_transactions') THEN
    CREATE TABLE "bank_transactions" (
      "id"               TEXT NOT NULL,
      "companyId"        TEXT NOT NULL,
      "statementId"      TEXT NOT NULL,
      "txDate"           DATE NOT NULL,
      "description"      TEXT NOT NULL,
      "debitAmount"      DECIMAL(15,2),
      "creditAmount"     DECIMAL(15,2),
      "balance"          DECIMAL(15,2),
      "matchStatus"      TEXT NOT NULL DEFAULT 'UNMATCHED',
      "matchedVoucherId" TEXT,
      "confidence"       TEXT,
      CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "bank_transactions_companyId_statementId_idx"
      ON "bank_transactions"("companyId", "statementId");
    CREATE INDEX "bank_transactions_companyId_matchStatus_idx"
      ON "bank_transactions"("companyId", "matchStatus");
    ALTER TABLE "bank_transactions"
      ADD CONSTRAINT "bank_transactions_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "bank_transactions"
      ADD CONSTRAINT "bank_transactions_statementId_fkey"
      FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "bank_transactions"
      ADD CONSTRAINT "bank_transactions_matchedVoucherId_fkey"
      FOREIGN KEY ("matchedVoucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ELSE
    -- Rename snake_case columns from migration 0004
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='company_id') THEN
      ALTER TABLE "bank_transactions" RENAME COLUMN company_id TO "companyId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='statement_id') THEN
      ALTER TABLE "bank_transactions" RENAME COLUMN statement_id TO "statementId";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='tx_date') THEN
      ALTER TABLE "bank_transactions" RENAME COLUMN tx_date TO "txDate";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='debit_amount') THEN
      ALTER TABLE "bank_transactions" RENAME COLUMN debit_amount TO "debitAmount";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='credit_amount') THEN
      ALTER TABLE "bank_transactions" RENAME COLUMN credit_amount TO "creditAmount";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='match_status') THEN
      ALTER TABLE "bank_transactions" RENAME COLUMN match_status TO "matchStatus";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bank_transactions' AND column_name='matched_voucher_id') THEN
      ALTER TABLE "bank_transactions" RENAME COLUMN matched_voucher_id TO "matchedVoucherId";
    END IF;
    -- Fix indexes
    DROP INDEX IF EXISTS "bank_transactions_company_id_statement_id_idx";
    DROP INDEX IF EXISTS "bank_transactions_company_id_match_status_idx";
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='bank_transactions' AND indexname='bank_transactions_companyId_statementId_idx') THEN
      CREATE INDEX "bank_transactions_companyId_statementId_idx" ON "bank_transactions"("companyId", "statementId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='bank_transactions' AND indexname='bank_transactions_companyId_matchStatus_idx') THEN
      CREATE INDEX "bank_transactions_companyId_matchStatus_idx" ON "bank_transactions"("companyId", "matchStatus");
    END IF;
    -- Fix FK constraints
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_transactions_company_id_fkey') THEN
      ALTER TABLE "bank_transactions" DROP CONSTRAINT "bank_transactions_company_id_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_transactions_companyId_fkey') THEN
      ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_transactions_statement_id_fkey') THEN
      ALTER TABLE "bank_transactions" DROP CONSTRAINT "bank_transactions_statement_id_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_transactions_statementId_fkey') THEN
      ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_statementId_fkey"
        FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_transactions_matched_voucher_id_fkey') THEN
      ALTER TABLE "bank_transactions" DROP CONSTRAINT "bank_transactions_matched_voucher_id_fkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='bank_transactions_matchedVoucherId_fkey') THEN
      ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedVoucherId_fkey"
        FOREIGN KEY ("matchedVoucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
