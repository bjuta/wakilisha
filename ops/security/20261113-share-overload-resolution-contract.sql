-- Restore deterministic SQL/PostgREST resolution between explicit 2-arg
-- and 4-arg share-count RPC overloads. Frontend passes 4 args.
-- No grants, function body, SQL output or share event data changed.
BEGIN;
SET LOCAL lock_timeout='1000ms';
SET LOCAL statement_timeout='8000ms';
DO $wk$
BEGIN
 IF md5(pg_get_functiondef('public.increment_share_count(text,text,text,text)'::regprocedure)) <> 'b4224a4d955f79a41f3be148f81be669'
 THEN RAISE EXCEPTION 'STOP: share RPC changed'; END IF;
END $wk$;
CREATE OR REPLACE FUNCTION public.increment_share_count(p_page_url text, p_platform text, p_article_slug text, p_article_title text)
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
    OR p_platform NOT IN ('copy','x','whatsapp','facebook','telegram','linkedin','reddit','pinterest','messenger','email')
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
DO $verify$
BEGIN
 IF (SELECT pg_get_function_arguments('public.increment_share_count(text,text,text,text)'::regprocedure))
 LIKE '%DEFAULT%' THEN RAISE EXCEPTION 'STOP: ambiguous 4-arg defaults remain'; END IF;
 IF to_regprocedure('public.increment_share_count(text,text)') IS NULL
 THEN RAISE EXCEPTION 'STOP: 2-arg compatibility overload absent'; END IF;
END $verify$;
COMMIT;
