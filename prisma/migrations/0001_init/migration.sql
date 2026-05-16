-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "DrCr" AS ENUM ('DR', 'CR');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountNature" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "GstRegType" AS ENUM ('REGULAR', 'COMPOSITION', 'UNREGISTERED', 'CONSUMER');

-- CreateEnum
CREATE TYPE "SupplyType" AS ENUM ('B2B', 'B2C', 'EXPORT', 'SEZ');

-- CreateEnum
CREATE TYPE "GstrStatus" AS ENUM ('PENDING', 'UPLOADED', 'FILED');

-- CreateEnum
CREATE TYPE "GstReturnStatus" AS ENUM ('NOT_FILED', 'EXPORTED', 'UPLOADED', 'FILED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('PURCHASE_ORDER', 'SALES_ORDER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'APPROVED', 'PARTIALLY_FULFILLED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'CANCEL', 'POST');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "stateCode" VARCHAR(2) NOT NULL,
    "address" TEXT,
    "fyStart" INTEGER NOT NULL DEFAULT 4,
    "logoUrl" TEXT,
    "annualTurnover" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT,
    "uiMode" TEXT NOT NULL DEFAULT 'simple',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_groups" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "nature" "AccountNature" NOT NULL,
    "affectsGP" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledgers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "drCr" "DrCr" NOT NULL DEFAULT 'DR',
    "gstRegType" "GstRegType" NOT NULL DEFAULT 'UNREGISTERED',
    "creditLimit" DECIMAL(15,2),
    "creditDays" INTEGER,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "stateCode" VARCHAR(2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_groups" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "stock_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "hsnCode" VARCHAR(8) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL,
    "gstApplicable" BOOLEAN NOT NULL DEFAULT true,
    "openingQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "openingRate" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "reorderQty" DECIMAL(12,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "godowns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "godowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_sequences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "voucherType" "VoucherType" NOT NULL,
    "financialYear" VARCHAR(7) NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "voucher_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "voucherType" "VoucherType" NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "narration" TEXT,
    "partyLedgerId" TEXT,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "cgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "roundOff" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "irn" TEXT,
    "eWayBillNo" TEXT,
    "linkedVoucherId" TEXT,
    "createdBy" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_entries" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "drCr" "DrCr" NOT NULL,
    "narration" TEXT,
    "billRef" TEXT,

    CONSTRAINT "voucher_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_items" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "godownId" TEXT,
    "qty" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "discountPct" DECIMAL(5,2),
    "discountAmt" DECIMAL(15,2),
    "cgstRate" DECIMAL(5,2),
    "cgstAmt" DECIMAL(15,2),
    "sgstRate" DECIMAL(5,2),
    "sgstAmt" DECIMAL(15,2),
    "igstRate" DECIMAL(5,2),
    "igstAmt" DECIMAL(15,2),
    "hsnCode" VARCHAR(8),
    "batchNo" TEXT,
    "itcEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voucher_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_transactions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "gstinSupplier" VARCHAR(15),
    "gstinRecipient" VARCHAR(15),
    "supplyType" "SupplyType" NOT NULL,
    "returnPeriod" VARCHAR(7) NOT NULL,
    "taxableValue" DECIMAL(15,2) NOT NULL,
    "cgst" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "placeOfSupply" VARCHAR(2) NOT NULL,
    "reverseCharge" BOOLEAN NOT NULL DEFAULT false,
    "gstr1Status" "GstrStatus" NOT NULL DEFAULT 'PENDING',
    "gstr3bStatus" "GstrStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gst_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_returns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "returnType" TEXT NOT NULL,
    "returnPeriod" VARCHAR(7) NOT NULL,
    "status" "GstReturnStatus" NOT NULL DEFAULT 'NOT_FILED',
    "arn" TEXT,
    "jsonData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_refs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "billDate" DATE NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "outstandingAmount" DECIMAL(15,2) NOT NULL,
    "drCr" "DrCr" NOT NULL,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bill_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "designation" TEXT,
    "department" TEXT,
    "salaryLedgerId" TEXT,
    "pfApplicable" BOOLEAN NOT NULL DEFAULT true,
    "esiApplicable" BOOLEAN NOT NULL DEFAULT false,
    "joinDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "orderNo" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "partyLedgerId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "narration" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "godownId" TEXT,
    "qty" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "receivedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "dispatchedQty" DECIMAL(12,3) NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "vouchers_companyId_date_idx" ON "vouchers"("companyId", "date");

-- CreateIndex
CREATE INDEX "vouchers_companyId_status_idx" ON "vouchers"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_companyId_voucherType_voucherNo_key" ON "vouchers"("companyId", "voucherType", "voucherNo");

-- CreateIndex
CREATE UNIQUE INDEX "gst_returns_companyId_returnType_returnPeriod_key" ON "gst_returns"("companyId", "returnType", "returnPeriod");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_entity_createdAt_idx" ON "audit_logs"("companyId", "entity", "createdAt");

-- CreateIndex
CREATE INDEX "bill_refs_companyId_settled_idx" ON "bill_refs"("companyId", "settled");

-- CreateIndex
CREATE UNIQUE INDEX "employees_companyId_employeeCode_key" ON "employees"("companyId", "employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "orders_companyId_orderType_orderNo_key" ON "orders"("companyId", "orderType", "orderNo");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "account_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "account_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_groups" ADD CONSTRAINT "stock_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_groups" ADD CONSTRAINT "stock_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "stock_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "stock_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "godowns" ADD CONSTRAINT "godowns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_sequences" ADD CONSTRAINT "voucher_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_partyLedgerId_fkey" FOREIGN KEY ("partyLedgerId") REFERENCES "ledgers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_entries" ADD CONSTRAINT "voucher_entries_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_items" ADD CONSTRAINT "voucher_items_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_items" ADD CONSTRAINT "voucher_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_items" ADD CONSTRAINT "voucher_items_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "godowns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_transactions" ADD CONSTRAINT "gst_transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_transactions" ADD CONSTRAINT "gst_transactions_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_returns" ADD CONSTRAINT "gst_returns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_refs" ADD CONSTRAINT "bill_refs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_refs" ADD CONSTRAINT "bill_refs_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_refs" ADD CONSTRAINT "bill_refs_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_salaryLedgerId_fkey" FOREIGN KEY ("salaryLedgerId") REFERENCES "ledgers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "godowns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
