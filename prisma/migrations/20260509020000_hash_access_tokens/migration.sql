-- AlterTable: drop plaintext token, add hashed tokenHash + prefix
ALTER TABLE "AccessToken" DROP COLUMN "token";
ALTER TABLE "AccessToken" ADD COLUMN "tokenHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AccessToken" ADD COLUMN "prefix" TEXT;

-- Create unique index on tokenHash
CREATE UNIQUE INDEX "AccessToken_tokenHash_key" ON "AccessToken"("tokenHash");

-- Remove the default after migration (existing rows get empty hash, will be invalid)
ALTER TABLE "AccessToken" ALTER COLUMN "tokenHash" DROP DEFAULT;
