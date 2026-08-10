-- Live presence heartbeats.
CREATE TABLE "Presence" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "activity" TEXT NOT NULL DEFAULT 'browsing',
    "bookTitle" TEXT,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Presence_token_key" ON "Presence"("token");
CREATE INDEX "Presence_lastSeen_idx" ON "Presence"("lastSeen");
