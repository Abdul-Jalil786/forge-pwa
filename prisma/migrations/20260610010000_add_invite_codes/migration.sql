-- Phase 43.5: one-time invite codes (owner-generated invite links)
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "usedBy" TEXT,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");
