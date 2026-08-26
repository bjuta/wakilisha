-- Phase 7A K0 follow-up: preserve immutable Resource Version actor provenance
-- without creating a mutable dependency on live Auth identity.
--
-- This migration is intentionally tiny and should be squashed into the K0
-- candidate before preview promotion. It exists only to keep the branch
-- executable while the exact K0 candidate is being sealed.

begin;

set local statement_timeout = '120s';
set local lock_timeout = '5s';

alter table editorial.resource_versions
  drop constraint if exists resource_versions_created_by_fkey;

commit;
