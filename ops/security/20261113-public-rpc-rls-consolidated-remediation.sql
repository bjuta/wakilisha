-- WAKILISHA 2026-11-13 consolidated public privilege and write-safety remediation.
-- Audited SQL functions captured by exact pg_get_functiondef MD5.
-- Atomic and drift-guarded; no Registry mutation, no analytics/history deletion.
-- Preserves all function identities, grants, definer flags, Admin and MIZIZI read authorities.
BEGIN;
SET LOCAL lock_timeout='1000ms';
SET LOCAL statement_timeout='12000ms';
DO $wk_guard$
DECLARE
 expected jsonb := $wk_defs$[{"sig":"community_create_guest_follow_intent(uuid[])","hash":"1213f98076aaeeac65ca643466a6e23a"},{"sig":"community_get_comment_replies(uuid,integer)","hash":"7faada82edc6c080687d3f113d154604"},{"sig":"community_get_digest(integer)","hash":"69db68ce4dc31553d7f7d1458a64885c"},{"sig":"community_get_user_stats(uuid)","hash":"ad7bbd50af948656110145f40fa7739f"},{"sig":"get_release_artists_for_anon_v2(text)","hash":"01b5e2a124bec3d8a17931859eec54d5"},{"sig":"get_release_artists_for_anon(text)","hash":"888aebe05230baf059d172d4e069e822"},{"sig":"get_release_tracks_by_ids(uuid[])","hash":"70109d232e866cc626ab8077169873cf"},{"sig":"get_releases_by_ids_v2(uuid[])","hash":"4d428fa704dd8f64d04e99c32246d2e1"},{"sig":"get_releases_by_ids(uuid[])","hash":"2e3f197006e8defb0918b86e4b1ebb1b"},{"sig":"get_tracks_by_ids(uuid[])","hash":"8768cfed71bce0e31d648220163ad033"},{"sig":"increment_share_count(text,text,text,text)","hash":"3f6046a89ffb76ecb7f99f9c71bf379d"},{"sig":"increment_share_count(text,text)","hash":"8b6c68068ee96355aaa58083601ba1b5"},{"sig":"track_analytics_event(text,text,text,text,text,jsonb,text,uuid,text)","hash":"aee0b0fe8e891058d0cafc16cf6d7029"}]$wk_defs$::jsonb;
 policies jsonb := $wk_policies$[{"schemaname":"public","tablename":"registry_release_artists","policyname":"Public users can read release artist links","cmd":"SELECT","permissive":"PERMISSIVE","roles":"{anon,authenticated}","qual":"true","with_check":null},{"schemaname":"public","tablename":"registry_release_tracks","policyname":"Public users can read tracks for active releases","cmd":"SELECT","permissive":"PERMISSIVE","roles":"{anon,authenticated}","qual":"(EXISTS ( SELECT 1\n   FROM registry_releases r\n  WHERE ((r.id = registry_release_tracks.release_id) AND (r.status = 'active'::text))))","with_check":null},{"schemaname":"public","tablename":"registry_releases","policyname":"Public users can read releases","cmd":"SELECT","permissive":"PERMISSIVE","roles":"{anon,authenticated}","qual":"true","with_check":null},{"schemaname":"public","tablename":"registry_track_artists","policyname":"Public users can read track artist links","cmd":"SELECT","permissive":"PERMISSIVE","roles":"{public}","qual":"true","with_check":null},{"schemaname":"public","tablename":"registry_tracks","policyname":"Public users can read tracks linked to active releases","cmd":"SELECT","permissive":"PERMISSIVE","roles":"{public}","qual":"(EXISTS ( SELECT 1\n   FROM (registry_release_tracks rt\n     JOIN registry_releases r ON ((r.id = rt.release_id)))\n  WHERE ((rt.track_id = registry_tracks.id) AND (r.status = 'active'::text))))","with_check":null}]$wk_policies$::jsonb;
 z record; actual record; p record;
BEGIN
 IF jsonb_array_length(expected)<>13 OR jsonb_array_length(policies)<>5 THEN RAISE EXCEPTION 'Missing snapshot items'; END IF;
 FOR z IN SELECT * FROM jsonb_to_recordset(expected) AS x(sig text,hash text) LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_proc pr WHERE pr.oid=('public.'||z.sig)::regprocedure
  AND md5(pg_get_functiondef(pr.oid))=z.hash) THEN
    RAISE EXCEPTION 'STOP: Production function drift at %', z.sig;
  END IF;
 END LOOP;
 FOR z IN SELECT * FROM jsonb_to_recordset(policies) AS x(schemaname text, tablename text, policyname text,cmd text,permissive text,roles text,qual text,with_check text) LOOP
  SELECT pol.cmd,pol.permissive,pol.roles::text roles,pol.qual,pol.with_check INTO actual FROM pg_policies pol
  WHERE pol.schemaname=z.schemaname AND pol.tablename=z.tablename AND pol.policyname=z.policyname;
  IF NOT FOUND OR actual.cmd IS DISTINCT FROM z.cmd OR actual.permissive IS DISTINCT FROM z.permissive
   OR actual.roles IS DISTINCT FROM z.roles OR actual.qual IS DISTINCT FROM z.qual
   OR actual.with_check IS DISTINCT FROM z.with_check THEN
    RAISE EXCEPTION 'STOP: Production RLS drift at %.%',z.tablename,z.policyname;
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='wk_guest_follow_expiry_v1') THEN
   RAISE EXCEPTION 'STOP: guest cleanup job already exists';
 END IF;
END
$wk_guard$;

-- Preserve existing Admin/MIZIZI policies and all function execution grants.
ALTER POLICY "Public users can read releases" ON public.registry_releases
  USING (status='active');
ALTER POLICY "Public users can read tracks linked to active releases" ON public.registry_tracks
  USING (status='active');
ALTER POLICY "Public users can read release artist links" ON public.registry_release_artists
  USING (status='active' AND EXISTS (
    SELECT 1 FROM public.registry_releases r
    WHERE r.id=registry_release_artists.release_id AND r.status='active'));
ALTER POLICY "Public users can read tracks for active releases" ON public.registry_release_tracks
  USING (status='active'
    AND EXISTS (SELECT 1 FROM public.registry_releases r WHERE r.id=registry_release_tracks.release_id AND r.status='active')
    AND EXISTS (SELECT 1 FROM public.registry_tracks t WHERE t.id=registry_release_tracks.track_id AND t.status='active'));
ALTER POLICY "Public users can read track artist links" ON public.registry_track_artists
  USING (status='active' AND EXISTS (
    SELECT 1 FROM public.registry_tracks t
    WHERE t.id=registry_track_artists.track_id AND t.status='active'));

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
  SELECT r.id, r.slug, r.title, r.release_type, r.release_date, r.artwork_url, r.status, r.metadata
  FROM public.registry_releases r
  WHERE r.id = ANY(p_release_ids)
    AND (v_can_review OR r.status='active');
END;
$function$


CREATE OR REPLACE FUNCTION public.get_releases_by_ids_v2(p_release_ids uuid[])
 RETURNS TABLE(id uuid, slug text, title text, release_type text, release_date date, artwork_url text, status text, metadata jsonb)
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
  SELECT r.id, r.slug, r.title, r.release_type, r.release_date, r.artwork_url, r.status, r.metadata
  FROM public.registry_releases r
  WHERE r.id = ANY(p_release_ids)
    AND (v_can_review OR r.status='active');
END;
$function$


CREATE OR REPLACE FUNCTION public.get_tracks_by_ids(p_track_ids uuid[])
 RETURNS TABLE(id uuid, title text, slug text, duration_ms integer, track_number integer, disc_number integer, artwork_url text)
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
  IF cardinality(coalesce(p_track_ids, ARRAY[]::uuid[])) > 1024 THEN
    RAISE EXCEPTION 'Too many Tracks requested' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT t.id, t.title, t.slug, t.duration_ms, t.track_number, t.disc_number, t.artwork_url
  FROM public.registry_tracks t
  WHERE t.id = ANY(p_track_ids)
    AND (v_can_review OR t.status='active');
END;
$function$


CREATE OR REPLACE FUNCTION public.get_release_tracks_by_ids(p_release_ids uuid[])
 RETURNS TABLE(release_id uuid, track_id uuid, track_number integer, disc_number integer)
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
  SELECT rrt.release_id, rrt.track_id, rrt.track_number, rrt.disc_number
  FROM public.registry_release_tracks rrt
  JOIN public.registry_releases r ON r.id=rrt.release_id
  JOIN public.registry_tracks t ON t.id=rrt.track_id
  WHERE rrt.release_id = ANY(p_release_ids)
    AND (v_can_review OR (rrt.status='active' AND r.status='active' AND t.status='active'));
END;
$function$


CREATE OR REPLACE FUNCTION public.get_release_artists_for_anon(p_artist_slug text)
 RETURNS TABLE(release_id uuid, role text, is_primary boolean, source text, confidence numeric)
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
$function$


CREATE OR REPLACE FUNCTION public.get_release_artists_for_anon_v2(p_artist_slug text)
 RETURNS TABLE(release_id uuid, role text, is_primary boolean, source text, confidence integer)
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
$function$


CREATE OR REPLACE FUNCTION public.track_analytics_event(p_event_name text, p_page_url text, p_page_type text DEFAULT NULL::text, p_entity_slug text DEFAULT NULL::text, p_entity_type text DEFAULT NULL::text, p_context jsonb DEFAULT '{}'::jsonb, p_session_id text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid, p_referrer text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id BIGINT;
BEGIN
  -- Never trust the caller-supplied p_user_id, including service callers.
  IF p_event_name IS NULL OR btrim(p_event_name)='' OR octet_length(p_event_name)>128
    OR p_page_url IS NULL OR octet_length(p_page_url)>2048
    OR p_page_url !~ '^https?://'
    OR octet_length(coalesce(p_page_type,''))>80
    OR octet_length(coalesce(p_entity_type,''))>80
    OR octet_length(coalesce(p_entity_slug,''))>256
    OR octet_length(coalesce(p_session_id,''))>128
    OR octet_length(coalesce(p_referrer,''))>2048
    OR jsonb_typeof(coalesce(p_context,'{}'::jsonb))<>'object'
    OR octet_length(coalesce(p_context,'{}'::jsonb)::text)>8192
  THEN
    RAISE EXCEPTION 'Invalid analytics event' USING ERRCODE='22023';
  END IF;
  INSERT INTO analytics_events (
    event_name, page_url, page_type, entity_slug, entity_type,
    context, session_id, user_id, referrer
  ) VALUES (
    p_event_name, p_page_url, p_page_type, p_entity_slug, p_entity_type,
    coalesce(p_context,'{}'::jsonb), p_session_id, auth.uid(), p_referrer
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.increment_share_count(p_page_url text, p_platform text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN public.increment_share_count(p_page_url, p_platform, NULL, NULL);
END;
$function$


CREATE OR REPLACE FUNCTION public.community_create_guest_follow_intent(p_artist_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_artist_ids uuid[];
  v_artist_count integer;
  v_resolved_count integer;
  v_intent private.guest_follow_intents%rowtype;
begin
  -- Bound raw input before unnest/dedup; prevent oversized anonymous work.
  IF p_artist_ids IS NULL OR cardinality(p_artist_ids)>48 THEN
    RAISE EXCEPTION 'Choose between 1 and 24 Artists' USING ERRCODE='22023';
  END IF;
  select
    array_agg(
      dedup.artist_id
      order by dedup.first_ordinality
    )
  into
    v_artist_ids
  from (
    select
      requested.artist_id,
      min(requested.ordinality) as first_ordinality
    from unnest(
      coalesce(
        p_artist_ids,
        array[]::uuid[]
      )
    ) with ordinality
      requested(
        artist_id,
        ordinality
      )
    where requested.artist_id is not null
    group by requested.artist_id
  ) dedup;

  v_artist_count :=
    cardinality(
      coalesce(
        v_artist_ids,
        array[]::uuid[]
      )
    );

  if v_artist_count < 1
     or v_artist_count > 24
  then
    raise exception
      'Choose between 1 and 24 Artists'
      using errcode = '22023';
  end if;

  select
    count(*)
  into
    v_resolved_count
  from public.registry_artists
    artist
  where artist.id = any(v_artist_ids)
    and artist.status = 'active'
    and nullif(
          btrim(
            coalesce(
              artist.slug,
              ''
            )
          ),
          ''
        ) is not null;

  if v_resolved_count <> v_artist_count
  then
    raise exception
      'Every choice must resolve to an active Registry Artist'
      using errcode = '22023';
  end if;

  -- Expired intent cleanup runs by existing pg_cron, not per guest request.

  insert into private.guest_follow_intents (
    artist_ids
  )
  values (
    v_artist_ids
  )
  returning *
  into v_intent;

  return jsonb_build_object(
    'token',
      v_intent.intent_token::text,
    'artist_count',
      v_artist_count,
    'expires_at',
      v_intent.expires_at
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.community_get_digest(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'activity_type', a.activity_type,
      'entity_type', a.entity_type,
      'entity_id', a.entity_id,
      'entity_slug', a.entity_slug,
      'entity_url', (a.metadata->>'entity_url'),
      'entity_title', (a.metadata->>'entity_title'),
      'comment_id', a.comment_id,
      'metadata', a.metadata,
      'visibility', a.visibility,
      'created_at', a.created_at
    ) ORDER BY a.created_at DESC
  ) INTO result
  FROM (
    SELECT * FROM public.community_activity
    WHERE visibility='public'
    ORDER BY created_at DESC
    LIMIT least(greatest(coalesce(p_limit,20),1),50)
  ) a;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$


CREATE OR REPLACE FUNCTION public.community_get_comment_replies(p_parent_id uuid, p_limit integer DEFAULT 3)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'thread_id', c.thread_id,
      'parent_id', c.parent_id,
      'root_id', c.root_id,
      'author_id', c.author_id,
      'body_markdown', c.body_markdown,
      'body_plain', c.body_plain,
      'body_html', c.body_html,
      'depth', c.depth,
      'path', c.path,
      'status', c.status,
      'is_pinned', c.is_pinned,
      'is_editor_pick', c.is_editor_pick,
      'upvote_count', c.upvote_count,
      'downvote_count', c.downvote_count,
      'reply_count', c.reply_count,
      'reaction_count', c.reaction_count,
      'report_count', c.report_count,
      'score', c.score,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'edited_at', c.edited_at,
      'deleted_at', c.deleted_at
    ) ORDER BY c.created_at ASC
  ) INTO result
  FROM (
    SELECT * FROM public.community_comments
    WHERE parent_id=p_parent_id AND status='visible'
    ORDER BY created_at ASC
    LIMIT least(greatest(coalesce(p_limit,3),1),50)
  ) c;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$


CREATE OR REPLACE FUNCTION public.community_get_user_stats(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  comment_count integer;
  save_count integer;
  follow_count integer;
BEGIN
  -- Hidden profiles do not expose private engagement aggregates to strangers.
  IF p_user_id IS NULL
    OR NOT (
      auth.uid()=p_user_id
      OR public.current_user_is_administrator()
      OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.user_id=p_user_id AND coalesce(up.is_public,true)=true
      )
    )
  THEN
    RETURN jsonb_build_object('comment_count',0,'save_count',0,'follow_count',0);
  END IF;
  SELECT COUNT(*) INTO comment_count
  FROM community_comments
  WHERE author_id = p_user_id AND status = 'visible';

  SELECT COUNT(*) INTO save_count
  FROM community_saves
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO follow_count
  FROM community_follows
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'comment_count', comment_count,
    'save_count', save_count,
    'follow_count', follow_count
  );
END;
$function$

SELECT cron.schedule('wk_guest_follow_expiry_v1','10 3 * * *',
  $cleanup$DELETE FROM private.guest_follow_intents WHERE ctid IN (
    SELECT ctid FROM private.guest_follow_intents
    WHERE expires_at < now()-interval '30 days' ORDER BY expires_at LIMIT 500
  )$cleanup$);

DO $wk_verify$
DECLARE c integer;
BEGIN
 SELECT count(*) INTO c FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace
 WHERE n.nspname='public' AND pr.prosecdef AND
 pr.proname IN ('track_analytics_event','increment_share_count','community_create_guest_follow_intent','community_get_digest','community_get_comment_replies','community_get_user_stats','get_releases_by_ids','get_releases_by_ids_v2','get_release_tracks_by_ids','get_tracks_by_ids','get_release_artists_for_anon','get_release_artists_for_anon_v2');
 IF c<>13 THEN RAISE EXCEPTION 'STOP: function identity unexpectedly changed (%)',c; END IF;
 SELECT count(*) INTO c FROM pg_policies WHERE schemaname='public'
 AND ((tablename='registry_releases' AND policyname='Public users can read releases' AND qual='(status = ''active''::text)')
 OR (tablename='registry_tracks' AND policyname='Public users can read tracks linked to active releases' AND qual='(status = ''active''::text)')
 OR (tablename IN ('registry_release_artists','registry_release_tracks','registry_track_artists') AND qual LIKE '%status = ''active''%'));
 IF c<>5 THEN RAISE EXCEPTION 'STOP: policy postcondition failed (%)',c; END IF;
 IF (SELECT count(*) FROM cron.job WHERE jobname='wk_guest_follow_expiry_v1' AND active)<>1 THEN RAISE EXCEPTION 'STOP: missing guest cleanup job'; END IF;
END
$wk_verify$;

COMMIT;
