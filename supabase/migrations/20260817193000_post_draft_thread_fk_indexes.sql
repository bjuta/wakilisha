-- WAKILISHA M8C.3-M5: Draft and Thread foreign-key index hardening.
-- Cover every new FK path introduced by M8C.3 so deletes, integrity checks, and
-- relationship lookups do not require unnecessary scans of Draft or Thread rows.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c3_fk_index_preflight$
begin
  if to_regclass('private.community_post_drafts') is null
     or to_regclass('public.community_post_threads') is null then
    raise exception 'STOP: M8C.3 Draft and Thread authority must exist before FK index hardening';
  end if;
end;
$m8c3_fk_index_preflight$;

create index community_post_drafts_artist_id_idx
on private.community_post_drafts (artist_id);

create index community_post_drafts_person_resource_id_idx
on private.community_post_drafts (person_resource_id);

create index community_post_drafts_quoted_post_id_idx
on private.community_post_drafts (quoted_post_id);

create index community_post_drafts_registry_track_id_idx
on private.community_post_drafts (registry_track_id);

create index community_post_threads_artist_id_idx
on public.community_post_threads (artist_id);

create index community_post_threads_person_resource_id_idx
on public.community_post_threads (person_resource_id);

commit;
