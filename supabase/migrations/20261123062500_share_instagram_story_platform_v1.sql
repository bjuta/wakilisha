-- Forward-only compatibility: Instagram Story is a first-class share destination.
-- Fix only one value in the exact, preexisting four-argument share counter allowlist.
-- No table changes, events backfill, broadening to unreviewed platforms, or new write authority.
-- The historic two-argument overload is deliberately untouched.
BEGIN;

DO $preflight$
BEGIN
  IF md5(pg_get_functiondef('public.increment_share_count(text,text,text,text)'::regprocedure))
       <> 'b4224a4d955f79a41f3be148f81be669' THEN
    RAISE EXCEPTION 'STOP: share counter authority drift (preimage changed)';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.increment_share_count(p_page_url text, p_platform text, p_article_slug text DEFAULT NULL::text, p_article_title text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  new_count BIGINT;
BEGIN
  IF p_page_url IS NULL OR octet_length(p_page_url)>2048 OR p_page_url !~ '^https?://'
    OR p_platform IS NULL
    OR p_platform NOT IN ('copy','instagram_story','x','whatsapp','facebook','telegram','linkedin','reddit','pinterest','messenger','email')
    OR octet_length(coalesce(p_article_slug,''))>256
    OR octet_length(coalesce(p_article_title,''))>512
  THEN
    RAISE EXCEPTION 'Invalid share event' USING ERRCODE='22023';
  END IF;
  -- Upsert the aggregate counter
  INSERT INTO share_counts (page_url, platform, count)
  VALUES (p_page_url, p_platform, 1)
  ON CONFLICT (page_url, platform)
  DO UPDATE SET count = share_counts.count + 1, updated_at = now()
  RETURNING count INTO new_count;

  -- Log the individual event for daily trend analytics
  INSERT INTO share_events (page_url, platform, article_slug, article_title)
  VALUES (p_page_url, p_platform, p_article_slug, p_article_title);

  RETURN new_count;
END;
$function$;

DO $postflight$
DECLARE
  definition text := pg_get_functiondef('public.increment_share_count(text,text,text,text)'::regprocedure);
BEGIN
  IF position($allowed$p_platform NOT IN ('copy','instagram_story','x','whatsapp','facebook','telegram','linkedin','reddit','pinterest','messenger','email')$allowed$ in definition) = 0 THEN
    RAISE EXCEPTION 'STOP: Instagram share counter platform not installed';
  END IF;
  IF position($old$p_platform NOT IN ('copy','x','whatsapp','facebook','telegram','linkedin','reddit','pinterest','messenger','email')$old$ in definition) > 0 THEN
    RAISE EXCEPTION 'STOP: old share counter allowlist still installed';
  END IF;
  IF NOT (
    SELECT p.prosecdef
       AND p.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
      FROM pg_proc p WHERE p.oid='public.increment_share_count(text,text,text,text)'::regprocedure
  ) THEN
    RAISE EXCEPTION 'STOP: share counter security definer or search path changed';
  END IF;
END;
$postflight$;

COMMIT;
