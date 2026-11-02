-- WK100 private native-HTML researcher evidence: FORWARD SQL CANDIDATE ONLY.
-- DO NOT APPLY / DEPLOY. Supabase CLI must mint final timestamp and execute
-- exact historic schema replay, RLS and signed-user acceptance first.
-- This does not amend prior Shazam-only research ledger or governed publisher.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

CREATE TABLE platform_private.wk100_html_research_reservations_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_eat date NOT NULL CHECK(extract(isodow FROM week_start_eat)=1),
  source_key text NOT NULL CHECK(source_key IN ('mdundo_ke','apple_ke_public_playlist')),
  source_url text NOT NULL,
  observed_at timestamptz NOT NULL,
  acquisition_mode text NOT NULL,
  raw_sha256 text NOT NULL CHECK(raw_sha256 ~ '^[a-f0-9]{64}$'),
  byte_length integer NOT NULL CHECK(byte_length BETWEEN 1 AND 4194304),
  observed_depth integer NOT NULL CHECK(observed_depth=100),
  native_period_authority text NOT NULL DEFAULT 'unknown' CHECK(native_period_authority='unknown'),
  source_admitted boolean NOT NULL DEFAULT false CHECK(source_admitted=false),
  can_score boolean NOT NULL DEFAULT false CHECK(can_score=false),
  can_publish boolean NOT NULL DEFAULT false CHECK(can_publish=false),
  object_bucket text NOT NULL DEFAULT 'wk-chart-raw-evidence-v1'
    CHECK(object_bucket='wk-chart-raw-evidence-v1'),
  object_key text NOT NULL,
  reserved_by uuid NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (source_key='mdundo_ke' AND
     source_url='https://play.mdundo.com/top-charts/ke' AND
     acquisition_mode='researcher_directed_public_html') OR
    (source_key='apple_ke_public_playlist' AND
     source_url='https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172' AND
     acquisition_mode='researcher_directed_public_browser_html')
  ),
  CHECK (object_key='research/v1/html/'||source_key||'/'||
    left(raw_sha256,2)||'/'||raw_sha256||'.html'),
  UNIQUE(week_start_eat,source_key,observed_at,raw_sha256,reserved_by)
);
ALTER TABLE platform_private.wk100_html_research_reservations_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.wk100_html_research_reservations_v1
  FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE platform_private.wk100_html_research_rows_v1 (
  reservation_id uuid NOT NULL REFERENCES platform_private.wk100_html_research_reservations_v1(id),
  source_rank integer NOT NULL CHECK(source_rank BETWEEN 1 AND 100),
  row_ref text NOT NULL,
  provider_track_id text NOT NULL CHECK(length(provider_track_id) BETWEEN 1 AND 180),
  title_observed text NOT NULL CHECK(length(title_observed) BETWEEN 1 AND 500),
  artist_observed text CHECK(artist_observed IS NULL OR length(artist_observed) BETWEEN 1 AND 500),
  provider_url text,
  duration_native text,
  PRIMARY KEY(reservation_id,source_rank),
  UNIQUE(reservation_id,provider_track_id)
);
ALTER TABLE platform_private.wk100_html_research_rows_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.wk100_html_research_rows_v1
  FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE platform_private.wk100_html_research_verified_v1 (
  reservation_id uuid PRIMARY KEY REFERENCES platform_private.wk100_html_research_reservations_v1(id),
  rows_sha256 text NOT NULL CHECK(rows_sha256 ~ '^[a-f0-9]{64}$'),
  verified_byte_sha256 text NOT NULL CHECK(verified_byte_sha256 ~ '^[a-f0-9]{64}$'),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE platform_private.wk100_html_research_verified_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.wk100_html_research_verified_v1
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION platform_private.wk100_html_research_immutable_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $block$
BEGIN
  RAISE EXCEPTION 'WK100 HTML originals and receipts are append-only' USING ERRCODE='42501';
END;
$block$;
REVOKE ALL ON FUNCTION platform_private.wk100_html_research_immutable_v1()
  FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER wk100_html_reservation_no_modify
BEFORE UPDATE OR DELETE ON platform_private.wk100_html_research_reservations_v1
FOR EACH ROW EXECUTE FUNCTION platform_private.wk100_html_research_immutable_v1();
CREATE TRIGGER wk100_html_rows_no_modify
BEFORE UPDATE OR DELETE ON platform_private.wk100_html_research_rows_v1
FOR EACH ROW EXECUTE FUNCTION platform_private.wk100_html_research_immutable_v1();
CREATE TRIGGER wk100_html_verified_no_modify
BEFORE UPDATE OR DELETE ON platform_private.wk100_html_research_verified_v1
FOR EACH ROW EXECUTE FUNCTION platform_private.wk100_html_research_immutable_v1();
CREATE TRIGGER wk100_html_reservation_no_truncate
BEFORE TRUNCATE ON platform_private.wk100_html_research_reservations_v1
FOR EACH STATEMENT EXECUTE FUNCTION platform_private.wk100_html_research_immutable_v1();
CREATE TRIGGER wk100_html_rows_no_truncate
BEFORE TRUNCATE ON platform_private.wk100_html_research_rows_v1
FOR EACH STATEMENT EXECUTE FUNCTION platform_private.wk100_html_research_immutable_v1();
CREATE TRIGGER wk100_html_verified_no_truncate
BEFORE TRUNCATE ON platform_private.wk100_html_research_verified_v1
FOR EACH STATEMENT EXECUTE FUNCTION platform_private.wk100_html_research_immutable_v1();

-- Uses the *human* authenticated caller, and validates live capabilities
-- at reservation time. No unsigned user ID or service_role may reserve.
CREATE FUNCTION public.wk100_reserve_html_research_observation_v1(
  p_week date,p_source_key text,p_source_url text,p_observed_at timestamptz,
  p_acquisition_mode text,p_raw_sha256 text,p_byte_length integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $reserve$
DECLARE
  v_actor uuid:=auth.uid();
  v_row platform_private.wk100_html_research_reservations_v1%ROWTYPE;
  v_key text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR
     v_actor IS NULL OR
     NOT coalesce(public.current_user_has_capability('manage_charts'),false) OR
     NOT coalesce(public.current_user_has_capability('manage_ingest'),false) THEN
    RAISE EXCEPTION 'WK100 HTML research requires chart and ingest stewardship' USING ERRCODE='42501';
  END IF;
  IF p_week IS NULL OR extract(isodow FROM p_week)<>1 OR
     p_observed_at IS NULL OR p_observed_at>clock_timestamp()+interval '10 minutes' OR
     date_trunc('week',p_observed_at AT TIME ZONE 'Africa/Nairobi')::date<>p_week OR
     p_raw_sha256 IS NULL OR p_raw_sha256 !~ '^[a-f0-9]{64}$' OR
     p_byte_length NOT BETWEEN 1 AND 4194304 OR
     NOT (
       (p_source_key='mdundo_ke' AND
        p_source_url='https://play.mdundo.com/top-charts/ke' AND
        p_acquisition_mode='researcher_directed_public_html') OR
       (p_source_key='apple_ke_public_playlist' AND
        p_source_url='https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172' AND
        p_acquisition_mode='researcher_directed_public_browser_html')
     ) THEN
    RAISE EXCEPTION 'WK100 HTML research reservation invalid' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM platform_private.wk100_governed_editorial_approvals_v1
    WHERE week_start_eat=p_week) OR
    EXISTS(SELECT 1 FROM platform_private.wk100_governed_staged_editions_v1
    WHERE week_start_eat=p_week) THEN
    RAISE EXCEPTION 'WK100 approved/staged week is frozen' USING ERRCODE='42501';
  END IF;
  v_key:='research/v1/html/'||p_source_key||'/'||
    left(p_raw_sha256,2)||'/'||p_raw_sha256||'.html';
  INSERT INTO platform_private.wk100_html_research_reservations_v1 (
    week_start_eat,source_key,source_url,observed_at,acquisition_mode,
    raw_sha256,byte_length,observed_depth,object_key,reserved_by
  ) VALUES (
    p_week,p_source_key,p_source_url,p_observed_at,p_acquisition_mode,
    p_raw_sha256,p_byte_length,100,v_key,v_actor
  )
  ON CONFLICT(week_start_eat,source_key,observed_at,raw_sha256,reserved_by)
  DO NOTHING RETURNING * INTO v_row;
  IF NOT FOUND THEN
    SELECT * INTO STRICT v_row
      FROM platform_private.wk100_html_research_reservations_v1
      WHERE week_start_eat=p_week AND source_key=p_source_key AND
        observed_at=p_observed_at AND raw_sha256=p_raw_sha256 AND reserved_by=v_actor;
    IF v_row.source_url IS DISTINCT FROM p_source_url OR
       v_row.byte_length IS DISTINCT FROM p_byte_length OR
       v_row.acquisition_mode IS DISTINCT FROM p_acquisition_mode THEN
      RAISE EXCEPTION 'WK100 HTML research immutable reservation conflict'
        USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN jsonb_build_object('reservation_id',v_row.id,'object_key',v_row.object_key,
    'status','reserved_or_previously_verified');
END;
$reserve$;
REVOKE ALL ON FUNCTION public.wk100_reserve_html_research_observation_v1(
  date,text,text,timestamptz,text,text,integer)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.wk100_reserve_html_research_observation_v1(
  date,text,text,timestamptz,text,text,integer) TO authenticated;

-- Service-only FINALIZER. All rank/ID content comes from a server-side exact
-- original-byte replay, not a browser-submitted rows or a client-provided ISRC.
CREATE FUNCTION public.wk100_finalize_html_research_observation_v1(
  p_reservation_id uuid,p_sha256 text,p_rows jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $final$
DECLARE
  v_res platform_private.wk100_html_research_reservations_v1%ROWTYPE;
  v_existing platform_private.wk100_html_research_verified_v1%ROWTYPE;
  v_r jsonb;
  v_rank integer:=0;
  v_id text;
  v_title text;
  v_artist text;
  v_url text;
  v_duration text;
  v_rows_sha text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'WK100 HTML finalization server-only' USING ERRCODE='42501';
  END IF;
  IF p_reservation_id IS NULL OR p_sha256 IS NULL OR
     p_sha256 !~ '^[a-f0-9]{64}$' OR p_rows IS NULL OR
     jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)<>100 THEN
    RAISE EXCEPTION 'WK100 HTML finalize invalid' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT v_res
    FROM platform_private.wk100_html_research_reservations_v1
    WHERE id=p_reservation_id FOR UPDATE;
  IF v_res.raw_sha256<>p_sha256 OR v_res.observed_depth<>100 THEN
    RAISE EXCEPTION 'WK100 HTML reservation mismatch' USING ERRCODE='22023';
  END IF;
  FOR v_r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_rank:=v_rank+1;
    IF jsonb_typeof(v_r)<>'object' OR
       jsonb_typeof(v_r->'source_rank')<>'number' OR
       v_r->>'source_rank' IS DISTINCT FROM v_rank::text OR
       jsonb_typeof(v_r->'provider_track_id')<>'string' OR
       jsonb_typeof(v_r->'title_observed')<>'string' THEN
      RAISE EXCEPTION 'WK100 HTML row rank/ID invalid' USING ERRCODE='22023';
    END IF;
    v_id:=v_r->>'provider_track_id';
    v_title:=v_r->>'title_observed';
    v_artist:=v_r->>'artist_observed';
    v_url:=v_r->>'provider_url';
    v_duration:=v_r->>'duration_native';
    IF v_id IS NULL OR length(v_id) NOT BETWEEN 1 AND 180 OR
       v_id !~ '^[A-Za-z0-9_./-]+$' OR
       length(v_title) NOT BETWEEN 1 AND 500 OR
       (v_r->'canonical_track_id')<>'null'::jsonb OR
       (v_r->'source_native_count')<>'null'::jsonb OR
       (v_res.source_key='mdundo_ke' AND (
         v_artist IS NULL OR length(v_artist) NOT BETWEEN 1 AND 500 OR
         v_url IS NOT NULL OR v_duration IS NOT NULL)) OR
       (v_res.source_key='apple_ke_public_playlist' AND (
         v_artist IS NOT NULL OR v_id !~ '^[0-9]+$' OR
         v_url IS NULL OR
         v_url !~ '^https://music[.]apple[.]com/ke/song/([^/?#]+/)?[0-9]+$' OR
         substring(v_url from '/([0-9]+)$')<>v_id OR
         v_duration IS NULL OR v_duration='PT' OR
         v_duration !~ '^PT([0-9]+H)?([0-9]+M)?([0-9]+([.][0-9]+)?S)?$')) OR
       v_r IS DISTINCT FROM jsonb_build_object(
         'source_rank',v_rank,'row_ref',v_res.raw_sha256||':'||v_rank,
         'provider_track_id',v_id,'title_observed',v_title,
         'artist_observed',v_artist,'provider_url',v_url,
         'duration_native',v_duration,'canonical_track_id',NULL,
         'source_native_count',NULL) THEN
      RAISE EXCEPTION 'WK100 HTML unverified row authority' USING ERRCODE='22023';
    END IF;
  END LOOP;
  v_rows_sha:=encode(extensions.digest(p_rows::text,'sha256'),'hex');
  SELECT * INTO v_existing FROM platform_private.wk100_html_research_verified_v1
    WHERE reservation_id=v_res.id;
  IF FOUND THEN
    IF v_existing.rows_sha256<>v_rows_sha OR
       v_existing.verified_byte_sha256<>p_sha256 THEN
      RAISE EXCEPTION 'WK100 HTML receipt immutable conflict' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('reservation_id',v_res.id,'status','verified','reused',true);
  END IF;
  INSERT INTO platform_private.wk100_html_research_rows_v1 (
    reservation_id,source_rank,row_ref,provider_track_id,
    title_observed,artist_observed,provider_url,duration_native
  ) SELECT v_res.id,(r.value->>'source_rank')::integer,r.value->>'row_ref',
    r.value->>'provider_track_id',r.value->>'title_observed',
    r.value->>'artist_observed',r.value->>'provider_url',
    r.value->>'duration_native'
  FROM jsonb_array_elements(p_rows) AS r(value);
  INSERT INTO platform_private.wk100_html_research_verified_v1 (
    reservation_id,rows_sha256,verified_byte_sha256
  ) VALUES(v_res.id,v_rows_sha,p_sha256);
  RETURN jsonb_build_object('reservation_id',v_res.id,'status','verified','reused',false);
END;
$final$;
REVOKE ALL ON FUNCTION public.wk100_finalize_html_research_observation_v1(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.wk100_finalize_html_research_observation_v1(uuid,text,jsonb)
  TO service_role;
COMMIT;
