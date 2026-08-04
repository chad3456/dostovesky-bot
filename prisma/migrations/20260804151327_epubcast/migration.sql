-- EpubCast: podcasts and per-chapter episodes.
CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "cover" TEXT,
    "filePath" TEXT NOT NULL,
    "totalChapters" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Podcast_createdAt_idx" ON "Podcast"("createdAt");

CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "chapterIndex" INTEGER NOT NULL,
    "chapterTitle" TEXT NOT NULL,
    "chapterText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "listened" BOOLEAN NOT NULL DEFAULT false,
    "segmentsDone" INTEGER NOT NULL DEFAULT 0,
    "segmentsTotal" INTEGER NOT NULL DEFAULT 4,
    "research" TEXT,
    "script" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Episode_podcastId_chapterIndex_key" ON "Episode"("podcastId", "chapterIndex");
CREATE INDEX "Episode_podcastId_idx" ON "Episode"("podcastId");
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
