-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "stateCode" TEXT NOT NULL,
    "address" TEXT,
    "fyStart" INTEGER NOT NULL DEFAULT 4,
    "logoUrl" TEXT,
    "annualTurnover" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT,
    "uiMode" TEXT NOT NULL DEFAULT 'simple',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "nature" TEXT NOT NULL,
    "affectsGP" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "account_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "account_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ledgers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "openingBalance" DECIMAL NOT NULL DEFAULT 0,
    "drCr" TEXT NOT NULL DEFAULT 'DR',
    "gstRegType" TEXT NOT NULL DEFAULT 'UNREGISTERED',
    "creditLimit" DECIMAL,
    "creditDays" INTEGER,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "stateCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tdsApplicable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ledgers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ledgers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "account_groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "stock_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "stock_groups" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "hsnCode" TEXT NOT NULL,
    "gstRate" DECIMAL NOT NULL,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "openingQty" DECIMAL NOT NULL DEFAULT 0,
    "openingRate" DECIMAL NOT NULL DEFAULT 0,
    "reorderQty" DECIMAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "stock_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "stock_groups" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_items_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "units_of_measure" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    CONSTRAINT "units_of_measure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "godowns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "godowns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "voucher_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "voucherType" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "voucher_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_sequences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "order_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "narration" TEXT,
    "partyLedgerId" TEXT,
    "totalAmount" DECIMAL NOT NULL,
    "cgstAmount" DECIMAL NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL NOT NULL DEFAULT 0,
    "roundOff" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "irn" TEXT,
    "eWayBillNo" TEXT,
    "irnQrCode" TEXT,
    "irnGeneratedAt" DATETIME,
    "eWayBillValidUntil" DATETIME,
    "chequeNo" TEXT,
    "chequeDated" DATETIME,
    "bankName" TEXT,
    "chequeStatus" TEXT DEFAULT 'ISSUED',
    "clearanceDate" DATETIME,
    "tdsSection" TEXT,
    "tdsRate" DECIMAL,
    "tdsAmount" DECIMAL,
    "linkedVoucherId" TEXT,
    "supplierInvoiceNo" TEXT,
    "supplierInvoiceDate" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vouchers_partyLedgerId_fkey" FOREIGN KEY ("partyLedgerId") REFERENCES "ledgers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "voucher_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voucherId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "drCr" TEXT NOT NULL,
    "narration" TEXT,
    "billRef" TEXT,
    "costCentreId" TEXT,
    CONSTRAINT "voucher_entries_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "cost_centres" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "voucher_entries_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "voucher_entries_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "voucher_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voucherId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "godownId" TEXT,
    "qty" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "discountPct" DECIMAL,
    "discountAmt" DECIMAL,
    "cgstRate" DECIMAL,
    "cgstAmt" DECIMAL,
    "sgstRate" DECIMAL,
    "sgstAmt" DECIMAL,
    "igstRate" DECIMAL,
    "igstAmt" DECIMAL,
    "hsnCode" TEXT,
    "batchNo" TEXT,
    "itcEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voucher_items_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "voucher_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stock_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "voucher_items_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "godowns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "godownId" TEXT,
    "voucherItemId" TEXT,
    "purchaseDate" DATETIME NOT NULL,
    "qty" DECIMAL NOT NULL,
    "remainingQty" DECIMAL NOT NULL,
    "costRate" DECIMAL NOT NULL,
    "batchNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_batches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stock_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_batches_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "godowns" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_batches_voucherItemId_fkey" FOREIGN KEY ("voucherItemId") REFERENCES "voucher_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_consumptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "stockBatchId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_consumptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_consumptions_stockBatchId_fkey" FOREIGN KEY ("stockBatchId") REFERENCES "stock_batches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_consumptions_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gst_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "gstinSupplier" TEXT,
    "gstinRecipient" TEXT,
    "supplyType" TEXT NOT NULL,
    "returnPeriod" TEXT NOT NULL,
    "taxableValue" DECIMAL NOT NULL,
    "cgst" DECIMAL NOT NULL DEFAULT 0,
    "sgst" DECIMAL NOT NULL DEFAULT 0,
    "igst" DECIMAL NOT NULL DEFAULT 0,
    "placeOfSupply" TEXT NOT NULL,
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "gstr1Status" TEXT NOT NULL DEFAULT 'PENDING',
    "gstr3bStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gst_transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "gst_transactions_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gst_returns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "returnType" TEXT NOT NULL,
    "returnPeriod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_FILED',
    "arn" TEXT,
    "jsonData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "gst_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "gstr2a_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "returnPeriod" TEXT NOT NULL,
    "supplierGstin" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "taxableValue" DECIMAL NOT NULL,
    "cgst" DECIMAL NOT NULL DEFAULT 0,
    "sgst" DECIMAL NOT NULL DEFAULT 0,
    "igst" DECIMAL NOT NULL DEFAULT 0,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gstr2a_imports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bill_refs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "billDate" DATETIME NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "outstandingAmount" DECIMAL NOT NULL,
    "drCr" TEXT NOT NULL,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bill_refs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bill_refs_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bill_refs_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "designation" TEXT,
    "department" TEXT,
    "salaryLedgerId" TEXT,
    "pfApplicable" BOOLEAN NOT NULL DEFAULT true,
    "esiApplicable" BOOLEAN NOT NULL DEFAULT false,
    "joinDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "salaryStructureId" TEXT,
    "structureEffectiveFrom" DATETIME,
    CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employees_salaryLedgerId_fkey" FOREIGN KEY ("salaryLedgerId") REFERENCES "ledgers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "employees_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "salary_structures" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cost_centres" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cost_centres_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "partyLedgerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL NOT NULL,
    "narration" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "orders_partyLedgerId_fkey" FOREIGN KEY ("partyLedgerId") REFERENCES "ledgers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "godownId" TEXT,
    "qty" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "receivedQty" DECIMAL NOT NULL DEFAULT 0,
    "dispatchedQty" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stock_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "godowns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "components" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "salary_structures_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "presentDays" DECIMAL NOT NULL,
    "absentDays" DECIMAL NOT NULL,
    "halfDays" INTEGER NOT NULL DEFAULT 0,
    "leaveDays" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "attendance_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pay_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalGross" DECIMAL,
    "totalNet" DECIMAL,
    "errorMessage" TEXT,
    "completedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pay_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pay_slips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "grossEarnings" DECIMAL NOT NULL,
    "totalDeductions" DECIMAL NOT NULL,
    "netPay" DECIMAL NOT NULL,
    "pfEmployee" DECIMAL NOT NULL,
    "pfEmployer" DECIMAL NOT NULL,
    "esiEmployee" DECIMAL NOT NULL,
    "esiEmployer" DECIMAL NOT NULL,
    "professionalTax" DECIMAL NOT NULL,
    "computedData" TEXT NOT NULL,
    "pdfKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "pay_slips_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pay_slips_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "pay_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pay_slips_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "fromDate" DATETIME NOT NULL,
    "toDate" DATETIME NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    CONSTRAINT "bank_statements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bank_statements_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "txDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "debitAmount" DECIMAL,
    "creditAmount" DECIMAL,
    "balance" DECIMAL,
    "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchedVoucherId" TEXT,
    "confidence" TEXT,
    CONSTRAINT "bank_transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bank_transactions_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "bank_statements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bank_transactions_matchedVoucherId_fkey" FOREIGN KEY ("matchedVoucherId") REFERENCES "vouchers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "einvoice_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMsg" TEXT,
    "requestJson" TEXT,
    "responseJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "einvoice_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "einvoice_logs_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientEmail" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_companyId_email_key" ON "users"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_companyId_name_key" ON "roles"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "account_groups_companyId_name_key" ON "account_groups"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ledgers_companyId_name_key" ON "ledgers"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_groups_companyId_name_key" ON "stock_groups"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_companyId_name_key" ON "stock_items"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_companyId_symbol_key" ON "units_of_measure"("companyId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "godowns_companyId_name_key" ON "godowns"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_sequences_companyId_voucherType_financialYear_key" ON "voucher_sequences"("companyId", "voucherType", "financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "order_sequences_companyId_orderType_financialYear_key" ON "order_sequences"("companyId", "orderType", "financialYear");

-- CreateIndex
CREATE INDEX "vouchers_companyId_date_idx" ON "vouchers"("companyId", "date");

-- CreateIndex
CREATE INDEX "vouchers_companyId_status_idx" ON "vouchers"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_companyId_voucherType_voucherNo_key" ON "vouchers"("companyId", "voucherType", "voucherNo");

-- CreateIndex
CREATE INDEX "voucher_entries_voucherId_idx" ON "voucher_entries"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_voucherItemId_key" ON "stock_batches"("voucherItemId");

-- CreateIndex
CREATE INDEX "stock_batches_companyId_itemId_godownId_purchaseDate_idx" ON "stock_batches"("companyId", "itemId", "godownId", "purchaseDate");

-- CreateIndex
CREATE INDEX "stock_batches_companyId_isActive_idx" ON "stock_batches"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "stock_consumptions_companyId_voucherId_idx" ON "stock_consumptions"("companyId", "voucherId");

-- CreateIndex
CREATE INDEX "stock_consumptions_stockBatchId_idx" ON "stock_consumptions"("stockBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "gst_returns_companyId_returnType_returnPeriod_key" ON "gst_returns"("companyId", "returnType", "returnPeriod");

-- CreateIndex
CREATE INDEX "gstr2a_imports_companyId_returnPeriod_idx" ON "gstr2a_imports"("companyId", "returnPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "gstr2a_imports_companyId_returnPeriod_supplierGstin_invoiceNo_key" ON "gstr2a_imports"("companyId", "returnPeriod", "supplierGstin", "invoiceNo");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_entity_createdAt_idx" ON "audit_logs"("companyId", "entity", "createdAt");

-- CreateIndex
CREATE INDEX "bill_refs_companyId_settled_idx" ON "bill_refs"("companyId", "settled");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_employeeCode_key" ON "employees"("companyId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centres_companyId_name_key" ON "cost_centres"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "orders_companyId_orderType_orderNo_key" ON "orders"("companyId", "orderType", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_companyId_name_key" ON "salary_structures"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_companyId_employeeId_month_key" ON "attendance_records"("companyId", "employeeId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "pay_runs_companyId_month_key" ON "pay_runs"("companyId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "pay_slips_payRunId_employeeId_key" ON "pay_slips"("payRunId", "employeeId");

-- CreateIndex
CREATE INDEX "bank_statements_companyId_ledgerId_idx" ON "bank_statements"("companyId", "ledgerId");

-- CreateIndex
CREATE INDEX "bank_transactions_companyId_statementId_idx" ON "bank_transactions"("companyId", "statementId");

-- CreateIndex
CREATE INDEX "bank_transactions_companyId_matchStatus_idx" ON "bank_transactions"("companyId", "matchStatus");

-- CreateIndex
CREATE INDEX "einvoice_logs_companyId_voucherId_idx" ON "einvoice_logs"("companyId", "voucherId");

-- CreateIndex
CREATE INDEX "notifications_companyId_type_sentAt_idx" ON "notifications"("companyId", "type", "sentAt");
