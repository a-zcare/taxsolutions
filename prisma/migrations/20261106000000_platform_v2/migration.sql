BEGIN;
-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'ADMIN', 'ACCOUNTANT');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "blockedEnd" TIMESTAMPTZ(3),
ADD COLUMN     "blockedStart" TIMESTAMPTZ(3),
ADD COLUMN     "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "resourceId" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Outbox" ADD COLUMN     "dedupKey" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'ACCOUNTANT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "acceptsBookings" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT NOT NULL,
    "totpCiphertext" TEXT NOT NULL,
    "lastTotpCounter" BIGINT NOT NULL DEFAULT -1,
    "capacityMinutes" INTEGER NOT NULL DEFAULT 2400,
    "specializations" TEXT[] DEFAULT ARRAY['general']::TEXT[],
    "schedule" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'lv',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'lv',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "category" TEXT NOT NULL DEFAULT 'general',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "hardDeadline" BOOLEAN NOT NULL DEFAULT true,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE',
    "recurrenceParentId" TEXT,
    "recurrenceSpawnedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "overdueSentAt" TIMESTAMP(3),
    "assignedId" TEXT,
    "createdById" TEXT,
    "clientId" TEXT,
    "bookingId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqEntry" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "translations" JSONB NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConnection" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthFlow" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "verifierCiphertext" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoMeeting" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "joinUrlCiphertext" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoJob" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "externalAttemptAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE INDEX "Client_ownerId_status_idx" ON "Client"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Task_recurrenceParentId_key" ON "Task"("recurrenceParentId");

-- CreateIndex
CREATE INDEX "Task_assignedId_status_dueAt_idx" ON "Task"("assignedId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConnection_staffId_provider_key" ON "OAuthConnection"("staffId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "VideoMeeting_bookingId_key" ON "VideoMeeting"("bookingId");

-- CreateIndex
CREATE INDEX "VideoJob_status_nextAttempt_idx" ON "VideoJob"("status", "nextAttempt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoJob_bookingId_version_action_key" ON "VideoJob"("bookingId", "version", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Outbox_dedupKey_key" ON "Outbox"("dedupKey");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedId_fkey" FOREIGN KEY ("assignedId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConnection" ADD CONSTRAINT "OAuthConnection_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthFlow" ADD CONSTRAINT "OAuthFlow_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoMeeting" ADD CONSTRAINT "VideoMeeting_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoJob" ADD CONSTRAINT "VideoJob_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve every existing appointment before tightening the new range fields.
UPDATE "Booking" SET "blockedStart"="start", "blockedEnd"="end";
ALTER TABLE "Booking" ALTER COLUMN "blockedStart" SET NOT NULL, ALTER COLUMN "blockedEnd" SET NOT NULL;
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_no_overlap";
CREATE FUNCTION booking_blocked_range() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW."blockedStart" := NEW."start" - make_interval(mins => NEW."bufferMinutes");
 NEW."blockedEnd" := NEW."end" + make_interval(mins => NEW."bufferMinutes");
 IF NEW."resourceId" <> (CASE WHEN NEW."staffId" IS NULL THEN 'default' ELSE 'staff:' || NEW."staffId" END) THEN RAISE EXCEPTION 'invalid booking resource'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER booking_range BEFORE INSERT OR UPDATE ON "Booking" FOR EACH ROW EXECUTE FUNCTION booking_blocked_range();
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_buffer" CHECK ("bufferMinutes" BETWEEN 0 AND 120);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_format" CHECK ("format" IN ('IN_PERSON','ONLINE'));
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_overlap" EXCLUDE USING gist ("resourceId" WITH =, tstzrange("blockedStart","blockedEnd",'[)') WITH &&) WHERE ("status" IN ('PENDING','CONFIRMED'));
ALTER TABLE "Task" ADD CONSTRAINT task_status CHECK (status IN ('TODO','IN_PROGRESS','DONE','CANCELLED'));
ALTER TABLE "Task" ADD CONSTRAINT task_priority CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT'));
ALTER TABLE "Task" ADD CONSTRAINT task_recurrence CHECK (recurrence IN ('NONE','DAILY','WEEKLY','MONTHLY'));
CREATE FUNCTION audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit events are append only'; END; $$;
CREATE TRIGGER audit_no_mutation BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION audit_append_only();

ALTER TABLE "Booking" ADD COLUMN "manageTokenCiphertext" TEXT;
ALTER TABLE "Staff" ADD COLUMN "enrolTokenHash" TEXT, ADD COLUMN "enrolExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Staff_enrolTokenHash_key" ON "Staff"("enrolTokenHash");
CREATE TABLE "Inquiry" (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,message TEXT NOT NULL,locale TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'NEW',"assignedId" TEXT REFERENCES "Staff"(id) ON DELETE SET NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT now());
CREATE INDEX "Inquiry_assignedId_status_idx" ON "Inquiry"("assignedId",status);
ALTER TABLE "OAuthFlow" ADD COLUMN "browserHash" TEXT NOT NULL;
-- Hold legacy unsent messages for operator review; do not send old free-text comments.
UPDATE "Outbox" SET "failedAt"=now() WHERE "sentAt" IS NULL AND "dedupKey" IS NULL;
ALTER TABLE "Booking" ADD COLUMN "pendingSince" TIMESTAMP(3) NOT NULL DEFAULT now();
COMMIT;
