begin;

-- Production migration-history parity record.
--
-- The accepted K5E native-source migration at 20260830173011 was already
-- promoted through the Supabase preview merge. A subsequent direct
-- apply_migration call repeated the same idempotent CREATE OR REPLACE FUNCTION
-- body and recorded a second production migration timestamp at 20260830173552.
--
-- Production schema authority was unchanged by that second application.
-- This repository migration is intentionally a no-op so fresh replay matches
-- the authoritative production migration history without replaying authority.

commit;
