-- CreateTable
CREATE TABLE "order_sequences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "financialYear" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "godownId" TEXT,
    "voucherItemId" TEXT,
    "purchaseDate" DATE NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "remainingQty" DECIMAL(12,3) NOT NULL,
    "costRate" DECIMAL(12,4) NOT NULL,
    "batchNo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_consumptions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "stockBatchId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_sequences_companyId_orderType_financialYear_key" ON "order_sequences"("companyId", "orderType", "financialYear");

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

-- AddForeignKey
ALTER TABLE "order_sequences" ADD CONSTRAINT "order_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "godowns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_voucherItemId_fkey" FOREIGN KEY ("voucherItemId") REFERENCES "voucher_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_consumptions" ADD CONSTRAINT "stock_consumptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_consumptions" ADD CONSTRAINT "stock_consumptions_stockBatchId_fkey" FOREIGN KEY ("stockBatchId") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_consumptions" ADD CONSTRAINT "stock_consumptions_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
