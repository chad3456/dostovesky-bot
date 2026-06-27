-- Add passwordless cross-device "Sync Code" to User.
ALTER TABLE "User" ADD COLUMN "syncCode" TEXT;
CREATE UNIQUE INDEX "User_syncCode_key" ON "User"("syncCode");
