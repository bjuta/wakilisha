-- WK100 private researcher-directed evidence ledger, additive to the installed publisher.
-- CLI-minted migration. Source-only candidate; never manually apply to Production.
-- A research receipt is not a capture-contract attempt, source admission, scoring,
-- private ranking replay, editorial approval or publication.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

CREATE TABLE platform_private.wk100_research_observation_reservations_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_eat date NOT NULL CHECK (extract(isodow FROM week_start_eat)=1),
  source_key text NOT NULL CHECK (source_key='shazam_ke'),
  source_url text NOT NULL CHECK (source_url IN (
    'https://www.shazam.com/charts/top-200/kenya',
    'https://www.shazam.com/services/charts/csv/top-200/kenya')),
  observation_time_utc timestamptz NOT NULL,
  acquisition_mode text NOT NULL DEFAULT 'researcher_directed_public_csv'
    CHECK (acquisition_mode='researcher_directed_public_csv'),
  raw_sha256 text NOT NULL CHECK (raw_sha256 ~ '^[a-f0-9]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 1 AND 4194304),
  observed_depth integer NOT NULL CHECK (observed_depth BETWEEN 1 AND 200),
  operator_ref text NOT NULL CHECK (operator_ref ~ '^[A-Za-z0-9][A-Za-z0-9_./:-]{7,239}$'),
  object_bucket text NOT NULL DEFAULT 'wk-chart-raw-evidence-v1'
    CHECK (object_bucket='wk-chart-raw-evidence-v1'),
  object_key text NOT NULL,
  source_native_period_authority text NOT NULL DEFAULT 'unknown'
    CHECK (source_native_period_authority='unknown'),
  source_admitted boolean NOT NULL DEFAULT false CHECK (source_admitted=false),
  can_score boolean NOT NULL DEFAULT false CHECK (can_score=false),
  can_publish boolean NOT NULL DEFAULT false CHECK (can_publish=false),
  reserved_by uuid NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (week_start_eat,source_key,observation_time_utc,raw_sha256,reserved_by),
  CHECK (object_key='research/v1/shazam_ke/'||left(raw_sha256,2)||'/'||raw_sha256||'.csv')
);
ALTER TABLE platform_private.wk100_research_observation_reservations_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.wk100_research_observation_reservations_v1 FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE platform_private.wk100_research_observation_rows_v1 (
  reservation_id uuid NOT NULL REFERENCES platform_private.wk100_research_observation_reservations_v1(id),
  source_rank integer NOT NULL CHECK (source_rank BETWEEN 1 AND 200),
  row_ref text NOT NULL,
  title_observed text NOT NULL CHECK (length(title_observed) BETWEEN 1 AND 500),
  artist_observed text NOT NULL CHECK (length(artist_observed) BETWEEN 1 AND 500),
  PRIMARY KEY (reservation_id,source_rank)
);
ALTER TABLE platform_private.wk100_research_observation_rows_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.wk100_research_observation_rows_v1 FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE platform_private.wk100_research_observation_verified_v1 (
  reservation_id uuid PRIMARY KEY REFERENCES platform_private.wk100_research_observation_reservations_v1(id),
  rows_sha256 text NOT NULL CHECK (rows_sha256 ~ '^[a-f0-9]{64}$'),
  verified_byte_sha256 text NOT NULL CHECK (verified_byte_sha256 ~ '^[a-f0-9]{64}$'),
  verified_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE platform_private.wk100_research_observation_verified_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.wk100_research_observation_verified_v1 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION platform_private.wk100_research_block_ledger_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'WK100 original research evidence is append-only' USING ERRCODE='42501';
END;
$$;
REVOKE ALL ON FUNCTION platform_private.wk100_research_block_ledger_mutation_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE TRIGGER wk100_research_reservation_immutable
BEFORE UPDATE OR DELETE ON platform_private.wk100_research_observation_reservations_v1
FOR EACH ROW EXECUTE FUNCTION platform_private.wk100_research_block_ledger_mutation_v1();
CREATE TRIGGER wk100_research_rows_immutable
BEFORE UPDATE OR DELETE ON platform_private.wk100_research_observation_rows_v1
FOR EACH ROW EXECUTE FUNCTION platform_private.wk100_research_block_ledger_mutation_v1();
CREATE TRIGGER wk100_research_verified_immutable
BEFORE UPDATE OR DELETE ON platform_private.wk100_research_observation_verified_v1
FOR EACH ROW EXECUTE FUNCTION platform_private.wk100_research_block_ledger_mutation_v1();
CREATE TRIGGER wk100_research_reservation_no_truncate
BEFORE TRUNCATE ON platform_private.wk100_research_observation_reservations_v1
FOR EACH STATEMENT EXECUTE FUNCTION platform_private.wk100_research_block_ledger_mutation_v1();
CREATE TRIGGER wk100_research_rows_no_truncate
BEFORE TRUNCATE ON platform_private.wk100_research_observation_rows_v1
FOR EACH STATEMENT EXECUTE FUNCTION platform_private.wk100_research_block_ledger_mutation_v1();
CREATE TRIGGER wk100_research_verified_no_truncate
BEFORE TRUNCATE ON platform_private.wk100_research_observation_verified_v1
FOR EACH STATEMENT EXECUTE FUNCTION platform_private.wk100_research_block_ledger_mutation_v1();

-- Human JWT reserve: both capabilities must be valid at the time of receipt.
-- Reserving deliberately does not certify bytes or Registry identity.
CREATE FUNCTION public.wk100_reserve_research_observation_v1(
  p_week date,p_source_url text,p_observed_at timestamptz,p_raw_sha256 text,
  p_byte_length integer,p_depth integer,p_operator_ref text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $reserve$
DECLARE
  v_actor uuid:=auth.uid();
  v_row platform_private.wk100_research_observation_reservations_v1%ROWTYPE;
  v_key text;
BEGIN
  IF v_actor IS NULL OR NOT coalesce(public.current_user_has_capability('manage_charts'),false)
     OR NOT coalesce(public.current_user_has_capability('manage_ingest'),false) THEN
    RAISE EXCEPTION 'WK100 research intake requires chart and ingest stewardship' USING ERRCODE='42501';
  END IF;
  IF p_week IS NULL OR extract(isodow FROM p_week)<>1 OR
     p_source_url NOT IN ('https://www.shazam.com/charts/top-200/kenya',
       'https://www.shazam.com/services/charts/csv/top-200/kenya') OR
     p_observed_at IS NULL OR p_observed_at>clock_timestamp()+interval '10 minutes' OR
     p_raw_sha256 IS NULL OR p_raw_sha256 !~ '^[a-f0-9]{64}$' OR
     p_byte_length NOT BETWEEN 1 AND 4194304 OR p_depth NOT BETWEEN 1 AND 200 OR
     p_operator_ref IS NULL OR p_operator_ref !~ '^[A-Za-z0-9][A-Za-z0-9_./:-]{7,239}$' THEN
    RAISE EXCEPTION 'WK100 research reservation metadata invalid' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM platform_private.wk100_governed_editorial_approvals_v1 WHERE week_start_eat=p_week)
  OR EXISTS(SELECT 1 FROM platform_private.wk100_governed_staged_editions_v1 WHERE week_start_eat=p_week) THEN
    RAISE EXCEPTION 'WK100 approved/staged week is frozen' USING ERRCODE='42501';
  END IF;
  v_key:='research/v1/shazam_ke/'||left(p_raw_sha256,2)||'/'||p_raw_sha256||'.csv';
  INSERT INTO platform_private.wk100_research_observation_reservations_v1
    (week_start_eat,source_key,source_url,observation_time_utc,raw_sha256,
     byte_length,observed_depth,operator_ref,object_key,reserved_by)
  VALUES(p_week,'shazam_ke',p_source_url,p_observed_at,p_raw_sha256,
         p_byte_length,p_depth,p_operator_ref,v_key,v_actor)
  ON CONFLICT(week_start_eat,source_key,observation_time_utc,raw_sha256,reserved_by)
  DO NOTHING RETURNING * INTO v_row;
  IF NOT FOUND THEN
    SELECT * INTO STRICT v_row FROM platform_private.wk100_research_observation_reservations_v1
    WHERE week_start_eat=p_week AND source_key='shazam_ke' AND
      observation_time_utc=p_observed_at AND raw_sha256=p_raw_sha256 AND reserved_by=v_actor;
    IF v_row.source_url IS DISTINCT FROM p_source_url OR
       v_row.byte_length IS DISTINCT FROM p_byte_length OR
       v_row.observed_depth IS DISTINCT FROM p_depth OR
       v_row.operator_ref IS DISTINCT FROM p_operator_ref THEN
      RAISE EXCEPTION 'WK100 conflicting immutable reservation' USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN jsonb_build_object('reservation_id',v_row.id,'object_key',v_row.object_key,
    'status','reserved_or_previously_verified');
END;
$reserve$;
REVOKE ALL ON FUNCTION public.wk100_reserve_research_observation_v1(date,text,timestamptz,text,integer,integer,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.wk100_reserve_research_observation_v1(date,text,timestamptz,text,integer,integer,text)
  TO authenticated;

-- Restricted service-only finalization, called only AFTER real private Storage
-- byte-for-byte readback and server-side native parser verification.
-- The RPC itself cannot attest provider origin, canonical Track or source rights.
CREATE FUNCTION public.wk100_finalize_research_observation_v1(
  p_reservation_id uuid,p_sha256 text,p_rows jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $finalize$
DECLARE
  v_res platform_private.wk100_research_observation_reservations_v1%ROWTYPE;
  v_done platform_private.wk100_research_observation_verified_v1%ROWTYPE;
  v_rows_sha text;
  v_row jsonb;
  v_rank integer:=0;
  v_title text;
  v_artist text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'WK100 research finalization is server-only' USING ERRCODE='42501';
  END IF;
  IF p_reservation_id IS NULL OR p_sha256 IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$' OR
     p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' THEN
    RAISE EXCEPTION 'WK100 finalize payload invalid' USING ERRCODE='22023';
  END IF;
  SELECT * INTO STRICT v_res FROM platform_private.wk100_research_observation_reservations_v1
    WHERE id=p_reservation_id FOR UPDATE;
  IF v_res.raw_sha256<>p_sha256 OR jsonb_array_length(p_rows)<>v_res.observed_depth THEN
    RAISE EXCEPTION 'WK100 finalize evidence differs from reservation' USING ERRCODE='22023';
  END IF;
  -- Validate an exact, gapless native-rank projection. Text similarity or null
  -- source provider ID is NEVER canonical Track proof.
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_rank:=v_rank+1;
    IF jsonb_typeof(v_row)<>'object' OR jsonb_typeof(v_row->'source_rank')<>'number' OR
       (v_row->>'source_rank') IS DISTINCT FROM v_rank::text OR
       jsonb_typeof(v_row->'title_observed')<>'string' OR
       jsonb_typeof(v_row->'artist_observed')<>'string' THEN
      RAISE EXCEPTION 'WK100 source rank or row shape invalid' USING ERRCODE='22023';
    END IF;
    v_title:=v_row->>'title_observed';v_artist:=v_row->>'artist_observed';
    IF length(v_title) NOT BETWEEN 1 AND 500 OR length(v_artist) NOT BETWEEN 1 AND 500 OR
       v_row IS DISTINCT FROM jsonb_build_object(
         'source_rank',v_rank,'row_ref',v_res.raw_sha256||':'||v_rank,
         'title_observed',v_title,'artist_observed',v_artist,
         'provider_track_id',NULL,'canonical_track_id',NULL,'source_native_count',NULL) THEN
      RAISE EXCEPTION 'WK100 source row contains unverified authority' USING ERRCODE='22023';
    END IF;
  END LOOP;
  v_rows_sha:=encode(extensions.digest(p_rows::text,'sha256'),'hex');
  SELECT * INTO v_done FROM platform_private.wk100_research_observation_verified_v1
    WHERE reservation_id=v_res.id;
  IF FOUND THEN
    IF v_done.rows_sha256<>v_rows_sha OR v_done.verified_byte_sha256<>p_sha256 THEN
      RAISE EXCEPTION 'WK100 verified receipt immutable conflict' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('reservation_id',v_res.id,'status','verified','reused',true);
  END IF;
  INSERT INTO platform_private.wk100_research_observation_rows_v1
    (reservation_id,source_rank,row_ref,title_observed,artist_observed)
  SELECT v_res.id,(r.value->>'source_rank')::integer,r.value->>'row_ref',
    r.value->>'title_observed',r.value->>'artist_observed'
  FROM jsonb_array_elements(p_rows) AS r(value);
  INSERT INTO platform_private.wk100_research_observation_verified_v1
    (reservation_id,rows_sha256,verified_byte_sha256)
  VALUES(v_res.id,v_rows_sha,p_sha256);
  RETURN jsonb_build_object('reservation_id',v_res.id,'status','verified','reused',false);
END;
$finalize$;
REVOKE ALL ON FUNCTION public.wk100_finalize_research_observation_v1(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.wk100_finalize_research_observation_v1(uuid,text,jsonb)
  TO service_role;
COMMIT;
