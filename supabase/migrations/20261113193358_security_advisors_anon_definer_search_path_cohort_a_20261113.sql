-- Cohort A: harden the 16 anonymous PUBLIC SECURITY DEFINER routines
-- that were unpinned on 2026-11-13. No change to code, grants, owners or RLS.
-- pg_temp explicitly comes LAST; untrusted roles have no CREATE on public.
-- This file is an audited forward operation; do not blindly replay it.
BEGIN;
SET LOCAL lock_timeout = '1500ms';
SET LOCAL statement_timeout = '8000ms';
DO $guard$
DECLARE
  expected regprocedure[] := ARRAY[
    ('public.community_get_comment_replies(uuid,integer)'::regprocedure),
    ('public.community_get_digest(integer)'::regprocedure),
    ('public.community_get_entity_contributions(text,text,text)'::regprocedure),
    ('public.community_get_most_discussed(integer)'::regprocedure),
    ('public.community_get_user_stats(uuid)'::regprocedure),
    ('public.get_chart_programs()'::regprocedure),
    ('public.get_release_artists_for_anon(text)'::regprocedure),
    ('public.get_release_artists_for_anon_v2(text)'::regprocedure),
    ('public.get_release_tracks_by_ids(uuid[])'::regprocedure),
    ('public.get_releases_by_ids(uuid[])'::regprocedure),
    ('public.get_releases_by_ids_v2(uuid[])'::regprocedure),
    ('public.get_taxonomy_terms(text,text,integer,integer)'::regprocedure),
    ('public.get_tracks_by_ids(uuid[])'::regprocedure),
    ('public.increment_share_count(text,text,text,text)'::regprocedure),
    ('public.public_get_taxonomy_term(text,text)'::regprocedure),
    ('public.rpc_get_chart_programs()'::regprocedure)
  ];
  actual integer;
BEGIN
  IF array_length(expected,1) <> 16 THEN RAISE EXCEPTION 'Expected exactly 16 functions'; END IF;
  IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN
    RAISE EXCEPTION 'STOP: untrusted role can CREATE in public';
  END IF;
  SELECT count(*) INTO actual
  FROM pg_proc p
  WHERE p.oid = ANY(expected) AND p.prosecdef AND p.proconfig IS NULL
    AND has_function_privilege('anon',p.oid,'EXECUTE');
  IF actual <> 16 THEN RAISE EXCEPTION 'STOP: expected 16 unpinned anon SECURITY DEFINER functions, found %',actual; END IF;
END
$guard$;

ALTER FUNCTION public.community_get_comment_replies(uuid,integer) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.community_get_digest(integer) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.community_get_entity_contributions(text,text,text) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.community_get_most_discussed(integer) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.community_get_user_stats(uuid) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_chart_programs() SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_release_artists_for_anon(text) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_release_artists_for_anon_v2(text) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_release_tracks_by_ids(uuid[]) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_releases_by_ids(uuid[]) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_releases_by_ids_v2(uuid[]) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_taxonomy_terms(text,text,integer,integer) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.get_tracks_by_ids(uuid[]) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.increment_share_count(text,text,text,text) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.public_get_taxonomy_term(text,text) SET search_path TO pg_catalog, public, pg_temp;
ALTER FUNCTION public.rpc_get_chart_programs() SET search_path TO pg_catalog, public, pg_temp;

DO $verify$
DECLARE
  expected regprocedure[] := ARRAY[
    ('public.community_get_comment_replies(uuid,integer)'::regprocedure),
    ('public.community_get_digest(integer)'::regprocedure),
    ('public.community_get_entity_contributions(text,text,text)'::regprocedure),
    ('public.community_get_most_discussed(integer)'::regprocedure),
    ('public.community_get_user_stats(uuid)'::regprocedure),
    ('public.get_chart_programs()'::regprocedure),
    ('public.get_release_artists_for_anon(text)'::regprocedure),
    ('public.get_release_artists_for_anon_v2(text)'::regprocedure),
    ('public.get_release_tracks_by_ids(uuid[])'::regprocedure),
    ('public.get_releases_by_ids(uuid[])'::regprocedure),
    ('public.get_releases_by_ids_v2(uuid[])'::regprocedure),
    ('public.get_taxonomy_terms(text,text,integer,integer)'::regprocedure),
    ('public.get_tracks_by_ids(uuid[])'::regprocedure),
    ('public.increment_share_count(text,text,text,text)'::regprocedure),
    ('public.public_get_taxonomy_term(text,text)'::regprocedure),
    ('public.rpc_get_chart_programs()'::regprocedure)
  ];
  actual integer;
BEGIN
  SELECT count(*) INTO actual FROM pg_proc p WHERE p.oid=ANY(expected)
    AND p.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
    AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE');
  IF actual <> 16 THEN RAISE EXCEPTION 'STOP: search_path/privilege postcondition did not match expected cohort'; END IF;
END
$verify$;
COMMIT;
-- Read-only verification is separate, after commit.
