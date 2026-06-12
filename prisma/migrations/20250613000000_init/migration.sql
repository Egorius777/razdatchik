-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Distributor', 'Tutor');
CREATE TYPE "MembershipStatus" AS ENUM ('Active', 'Invited', 'Removed');
CREATE TYPE "CommissionType" AS ENUM ('Percent', 'Fixed');
CREATE TYPE "StudentStatus" AS ENUM ('Trial', 'Active', 'Paused', 'Archived');
CREATE TYPE "LessonStatus" AS ENUM ('Planned', 'Done', 'Cancelled', 'NoShow');
CREATE TYPE "PaymentStatus" AS ENUM ('Reported', 'Confirmed', 'Disputed');
CREATE TYPE "PayoutStatus" AS ENUM ('Pending', 'Paid');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "cardDetails" TEXT,
    "settlementWeekday" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "username" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "notes" TEXT,
    "defaultPrice" DECIMAL(12,0) NOT NULL,
    "commissionType" "CommissionType" NOT NULL,
    "commissionValue" DECIMAL(12,0) NOT NULL,
    "status" "StudentStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'Planned',
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(12,0) NOT NULL,
    "commissionType" "CommissionType" NOT NULL,
    "commissionValue" DECIMAL(12,0) NOT NULL,
    "commissionAmount" DECIMAL(12,0) NOT NULL,
    "tutorAmount" DECIMAL(12,0) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "amount" DECIMAL(12,0) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'Reported',
    "receiptFileId" TEXT,
    "reportedById" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "note" TEXT,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentLesson" (
    "paymentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    CONSTRAINT "PaymentLesson_pkey" PRIMARY KEY ("paymentId","lessonId")
);

CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "gross" DECIMAL(12,0) NOT NULL,
    "commissionTotal" DECIMAL(12,0) NOT NULL,
    "netAmount" DECIMAL(12,0) NOT NULL,
    "lessonCount" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'Pending',
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReceiptFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceiptFile_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");
CREATE INDEX "Student_workspaceId_tutorId_idx" ON "Student"("workspaceId", "tutorId");
CREATE INDEX "Lesson_workspaceId_tutorId_scheduledAt_idx" ON "Lesson"("workspaceId", "tutorId", "scheduledAt");
CREATE INDEX "Lesson_studentId_idx" ON "Lesson"("studentId");
CREATE INDEX "Payment_workspaceId_status_idx" ON "Payment"("workspaceId", "status");
CREATE INDEX "Payment_tutorId_idx" ON "Payment"("tutorId");
CREATE UNIQUE INDEX "Payout_workspaceId_tutorId_periodStart_key" ON "Payout"("workspaceId", "tutorId", "periodStart");
CREATE INDEX "Payout_workspaceId_periodStart_idx" ON "Payout"("workspaceId", "periodStart");

-- Foreign Keys
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receiptFileId_fkey" FOREIGN KEY ("receiptFileId") REFERENCES "ReceiptFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLesson" ADD CONSTRAINT "PaymentLesson_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentLesson" ADD CONSTRAINT "PaymentLesson_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
