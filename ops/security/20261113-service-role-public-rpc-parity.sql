-- Restore verified internal service-role draft parity while retaining anonymous fences.
-- Guard all six functions and preserve grants, signature, owner, RLS and body.
BEGIN;
SET LOCAL lock_timeout='1000ms';
SET LOCAL statement_timeout='7000ms';
DO $g$
DECLARE e jsonb := $snap$[{"sig":"get_release_artists_for_anon(text)","hash":"fd573c82a39e44c371dcf7fd4f279621"},{"sig":"get_release_artists_for_anon_v2(text)","hash":"9d41b6c2fe2f3b55a0e1510f41846643"},{"sig":"get_release_tracks_by_ids(uuid[])","hash":"b3498c0be04952ae9a89cbb9a4ebaf15"},{"sig":"get_releases_by_ids(uuid[])","hash":"95b5525893df8db06d3494eac89b7f7f"},{"sig":"get_releases_by_ids_v2(uuid[])","hash":"9dddaf1c0ddce980578138a0e41ec856"},{"sig":"get_tracks_by_ids(uuid[])","hash":"3808daf51e20bedb7752fe1e2cb66ce7"}]$snap$::jsonb;
  x record;
BEGIN
 IF jsonb_array_length(e)<>6 THEN RAISE EXCEPTION 'Expected six'; END IF;
 FOR x IN SELECT * FROM jsonb_to_recordset(e) AS t(sig text,hash text) LOOP
  IF md5(pg_get_functiondef(('public.'||x.sig)::regprocedure))<>x.hash THEN
   RAISE EXCEPTION 'STOP: service-role scope drift on %',x.sig;
  END IF;
 END LOOP;
END $g$;
CREATE OR REPLACE FUNCTION public.get_release_artists_for_anon(p_artist_slug text)
 RETURNS TABLE(release_id uuid, role text, is_primary boolean, source text, confidence numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_can_review boolean := auth.role()='service_role'
    OR (auth.uid() IS NOT NULL
    AND (
      public.current_user_has_capability('view_registry')
      OR public.current_user_has_capability('manage_registry')
      OR public.current_user_is_administrator()
    ));
BEGIN
  IF p_artist_slug IS NULL OR length(p_artist_slug)>256 THEN
    RAISE EXCEPTION 'Invalid Artist lookup' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT rra.release_id, rra.role, rra.is_primary, rra.source, rra.confidence
  FROM public.registry_release_artists rra
  JOIN public.registry_releases r ON r.id=rra.release_id
  WHERE rra.artist_slug = p_artist_slug
    AND (v_can_review OR (rra.status='active' AND r.status='active'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_release_artists_for_anon_v2(p_artist_slug text)
 RETURNS TABLE(release_id uuid, role text, is_primary boolean, source text, confidence integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_can_review boolean := auth.role()='service_role'
    OR (auth.uid() IS NOT NULL
    AND (
      public.current_user_has_capability('view_registry')
      OR public.current_user_has_capability('manage_registry')
      OR public.current_user_is_administrator()
    ));
BEGIN
  IF p_artist_slug IS NULL OR length(p_artist_slug)>256 THEN
    RAISE EXCEPTION 'Invalid Artist lookup' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  -- Direct release-artist links (primary and featured from ingest)
  SELECT rra.release_id, rra.role, rra.is_primary, rra.source, rra.confidence
  FROM public.registry_release_artists rra
  JOIN public.registry_releases r ON r.id=rra.release_id
  WHERE rra.artist_slug = p_artist_slug
    AND (v_can_review OR (rra.status='active' AND r.status='active'))
  
  UNION
  
  -- Featured appearances from track-level data
  SELECT 
    rrt.release_id,
    'featured_artist'::text AS role,
    false AS is_primary,
    'apple_music_ingest'::text AS source,
    85::integer AS confidence
  FROM public.registry_track_artists rta
  JOIN public.registry_release_tracks rrt ON rrt.track_id = rta.track_id
  JOIN public.registry_releases r ON r.id=rrt.release_id
  JOIN public.registry_tracks t ON t.id=rta.track_id
  WHERE rta.artist_slug = p_artist_slug
    AND rta.is_primary = false
    AND rta.status = 'active'
    AND (v_can_review OR (r.status='active' AND t.status='active' AND rrt.status='active'))
    -- Don't duplicate releases that already have direct release-artist entries
    AND rrt.release_id NOT IN (
      SELECT rra2.release_id 
      FROM public.registry_release_artists rra2 
      WHERE rra2.artist_slug = p_artist_slug
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_release_tracks_by_ids(p_release_ids uuid[])
 RETURNS TABLE(release_id uuid, track_id uuid, track_number integer, disc_number integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_can_review boolean := auth.role()='service_role'
    OR (auth.uid() IS NOT NULL
    AND (
      public.current_user_has_capability('view_registry')
      OR public.current_user_has_capability('manage_registry')
      OR public.current_user_is_administrator()
    ));
BEGIN
  IF cardinality(coalesce(p_release_ids, ARRAY[]::uuid[])) > 512 THEN
    RAISE EXCEPTION 'Too many Releases requested' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT rrt.release_id, rrt.track_id, rrt.track_number, rrt.disc_number
  FROM public.registry_release_tracks rrt
  JOIN public.registry_releases r ON r.id=rrt.release_id
  JOIN public.registry_tracks t ON t.id=rrt.track_id
  WHERE rrt.release_id = ANY(p_release_ids)
    AND (v_can_review OR (rrt.status='active' AND r.status='active' AND t.status='active'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_releases_by_ids(p_release_ids uuid[])
 RETURNS TABLE(id uuid, slug text, title text, release_type text, release_date text, artwork_url text, status text, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_can_review boolean := auth.role()='service_role'
    OR (auth.uid() IS NOT NULL
    AND (
      public.current_user_has_capability('view_registry')
      OR public.current_user_has_capability('manage_registry')
      OR public.current_user_is_administrator()
    ));
BEGIN
  IF cardinality(coalesce(p_release_ids, ARRAY[]::uuid[])) > 512 THEN
    RAISE EXCEPTION 'Too many Releases requested' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT r.id, r.slug, r.title, r.release_type, r.release_date::text, r.artwork_url, r.status, r.metadata
  FROM public.registry_releases r
  WHERE r.id = ANY(p_release_ids)
    AND (v_can_review OR r.status='active');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_releases_by_ids_v2(p_release_ids uuid[])
 RETURNS TABLE(id uuid, slug text, title text, release_type text, release_date date, artwork_url text, status text, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_can_review boolean := auth.role()='service_role'
    OR (auth.uid() IS NOT NULL
    AND (
      public.current_user_has_capability('view_registry')
      OR public.current_user_has_capability('manage_registry')
      OR public.current_user_is_administrator()
    ));
BEGIN
  IF cardinality(coalesce(p_release_ids, ARRAY[]::uuid[])) > 512 THEN
    RAISE EXCEPTION 'Too many Releases requested' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT r.id, r.slug, r.title, r.release_type, r.release_date, r.artwork_url, r.status, r.metadata
  FROM public.registry_releases r
  WHERE r.id = ANY(p_release_ids)
    AND (v_can_review OR r.status='active');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tracks_by_ids(p_track_ids uuid[])
 RETURNS TABLE(id uuid, title text, slug text, duration_ms integer, track_number integer, disc_number integer, artwork_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_can_review boolean := auth.role()='service_role'
    OR (auth.uid() IS NOT NULL
    AND (
      public.current_user_has_capability('view_registry')
      OR public.current_user_has_capability('manage_registry')
      OR public.current_user_is_administrator()
    ));
BEGIN
  IF cardinality(coalesce(p_track_ids, ARRAY[]::uuid[])) > 1024 THEN
    RAISE EXCEPTION 'Too many Tracks requested' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT t.id, t.title, t.slug, t.duration_ms, t.track_number, t.disc_number, t.artwork_url
  FROM public.registry_tracks t
  WHERE t.id = ANY(p_track_ids)
    AND (v_can_review OR t.status='active');
END;
$function$;
DO $v$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
 WHERE s.nspname='public'
 AND p.proname IN ('get_releases_by_ids','get_releases_by_ids_v2','get_tracks_by_ids','get_release_tracks_by_ids','get_release_artists_for_anon','get_release_artists_for_anon_v2')
 AND p.prosrc LIKE '%auth.role()=%service_role%';
 IF n<>6 THEN RAISE EXCEPTION 'STOP: expected six service-role guards, got %',n; END IF;
END $v$;
COMMIT;
