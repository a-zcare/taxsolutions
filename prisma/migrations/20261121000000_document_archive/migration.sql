CREATE TABLE "AccountingDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "period" TEXT NOT NULL CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    "encryptedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "contentHash" TEXT NOT NULL,
    "invoiceHash" TEXT,
    "data" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'CONFIRMED')),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountingDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountingDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountingDocument_clientId_contentHash_key" ON "AccountingDocument"("clientId", "contentHash");
CREATE INDEX "AccountingDocument_clientId_period_status_createdAt_id_idx" ON "AccountingDocument"("clientId", "period", "status", "createdAt", "id");
CREATE INDEX "AccountingDocument_clientId_invoiceHash_idx" ON "AccountingDocument"("clientId", "invoiceHash");
