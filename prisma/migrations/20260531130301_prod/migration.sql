/*
  Warnings:

  - You are about to alter the column `newValue` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `oldValue` on the `audit_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `requestJson` on the `einvoice_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `responseJson` on the `einvoice_logs` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `jsonData` on the `gst_returns` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `metadata` on the `notifications` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `computedData` on the `pay_slips` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `permissions` on the `roles` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `components` on the `salary_structures` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_audit_logs" (
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
INSERT INTO "new_audit_logs" ("action", "companyId", "createdAt", "entity", "entityId", "id", "ipAddress", "newValue", "oldValue", "userId") SELECT "action", "companyId", "createdAt", "entity", "entityId", "id", "ipAddress", "newValue", "oldValue", "userId" FROM "audit_logs";
DROP TABLE "audit_logs";
ALTER TABLE "new_audit_logs" RENAME TO "audit_logs";
CREATE INDEX "audit_logs_companyId_entity_createdAt_idx" ON "audit_logs"("companyId", "entity", "createdAt");
CREATE TABLE "new_einvoice_logs" (
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
INSERT INTO "new_einvoice_logs" ("attempt", "companyId", "createdAt", "errorCode", "errorMsg", "id", "requestJson", "responseJson", "status", "voucherId") SELECT "attempt", "companyId", "createdAt", "errorCode", "errorMsg", "id", "requestJson", "responseJson", "status", "voucherId" FROM "einvoice_logs";
DROP TABLE "einvoice_logs";
ALTER TABLE "new_einvoice_logs" RENAME TO "einvoice_logs";
CREATE INDEX "einvoice_logs_companyId_voucherId_idx" ON "einvoice_logs"("companyId", "voucherId");
CREATE TABLE "new_gst_returns" (
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
INSERT INTO "new_gst_returns" ("arn", "companyId", "createdAt", "id", "jsonData", "returnPeriod", "returnType", "status", "updatedAt") SELECT "arn", "companyId", "createdAt", "id", "jsonData", "returnPeriod", "returnType", "status", "updatedAt" FROM "gst_returns";
DROP TABLE "gst_returns";
ALTER TABLE "new_gst_returns" RENAME TO "gst_returns";
CREATE UNIQUE INDEX "gst_returns_companyId_returnType_returnPeriod_key" ON "gst_returns"("companyId", "returnType", "returnPeriod");
CREATE TABLE "new_notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientEmail" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notifications" ("companyId", "entityId", "id", "metadata", "recipientEmail", "sentAt", "type") SELECT "companyId", "entityId", "id", "metadata", "recipientEmail", "sentAt", "type" FROM "notifications";
DROP TABLE "notifications";
ALTER TABLE "new_notifications" RENAME TO "notifications";
CREATE INDEX "notifications_companyId_type_sentAt_idx" ON "notifications"("companyId", "type", "sentAt");
CREATE TABLE "new_pay_slips" (
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
INSERT INTO "new_pay_slips" ("companyId", "computedData", "createdAt", "employeeId", "esiEmployee", "esiEmployer", "grossEarnings", "id", "month", "netPay", "payRunId", "pdfKey", "pfEmployee", "pfEmployer", "professionalTax", "totalDeductions", "updatedAt") SELECT "companyId", "computedData", "createdAt", "employeeId", "esiEmployee", "esiEmployer", "grossEarnings", "id", "month", "netPay", "payRunId", "pdfKey", "pfEmployee", "pfEmployer", "professionalTax", "totalDeductions", "updatedAt" FROM "pay_slips";
DROP TABLE "pay_slips";
ALTER TABLE "new_pay_slips" RENAME TO "pay_slips";
CREATE UNIQUE INDEX "pay_slips_payRunId_employeeId_key" ON "pay_slips"("payRunId", "employeeId");
CREATE TABLE "new_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_roles" ("companyId", "createdAt", "id", "name", "permissions") SELECT "companyId", "createdAt", "id", "name", "permissions" FROM "roles";
DROP TABLE "roles";
ALTER TABLE "new_roles" RENAME TO "roles";
CREATE UNIQUE INDEX "roles_companyId_name_key" ON "roles"("companyId", "name");
CREATE TABLE "new_salary_structures" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "components" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "salary_structures_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_salary_structures" ("companyId", "components", "createdAt", "id", "isActive", "name", "updatedAt") SELECT "companyId", "components", "createdAt", "id", "isActive", "name", "updatedAt" FROM "salary_structures";
DROP TABLE "salary_structures";
ALTER TABLE "new_salary_structures" RENAME TO "salary_structures";
CREATE UNIQUE INDEX "salary_structures_companyId_name_key" ON "salary_structures"("companyId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
