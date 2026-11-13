-- Follow-up to consolidated public Registry remediation. Fix historic SQL return contract.
-- No ACL, publication status, RLS, field list, argument or Registry record change.
BEGIN;
SET LOCAL lock_timeout='1000ms';
SET LOCAL statement_timeout='7000ms';
DO $guard$
BEGIN
 IF md5(pg_get_functiondef('public.get_releases_by_ids(uuid[])'::regprocedure)) <> '5467395d8e43592bc78b73f52d9013f3'
 THEN RAISE EXCEPTION 'STOP: release getter changed since reviewed preflight'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.get_releases_by_ids(p_release_ids uuid[])
 RETURNS TABLE(id uuid, slug text, title text, release_type text, release_date text, artwork_url text, status text, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_can_review boolean := auth.uid() IS NOT NULL
    AND (
      public.current_user_has_capability('view_registry')
      OR public.current_user_has_capability('manage_registry')
      OR public.current_user_is_administrator()
    );
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
DO $verify$
BEGIN
 IF position('r.release_date::text' IN pg_get_functiondef('public.get_releases_by_ids(uuid[])'::regprocedure)) = 0
 THEN RAISE EXCEPTION 'STOP: date return cast absent'; END IF;
END $verify$;
COMMIT;
