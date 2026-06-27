-- Durable EPUB file storage in Postgres.
CREATE TABLE "BookBlob" (
    "id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookBlob_pkey" PRIMARY KEY ("id")
);
