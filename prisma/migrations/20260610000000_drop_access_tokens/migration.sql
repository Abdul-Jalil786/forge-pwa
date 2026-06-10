-- Phase 43: drop the unused AccessToken table. The Cowork PAT system it
-- backed was removed in Phase 34; the table has been dormant since.
DROP TABLE IF EXISTS "AccessToken";
