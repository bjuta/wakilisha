-- WAKILISHA / MIZIZI Slice 2 / #939
-- Boundary B1 repair: preserve UUID RPC contracts while chart ingest IDs remain text.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'wk939-registry-chart-candidate-id-bridge-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.chart_create_artist_origin_shell_v1(text,text,uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: accepted Boundary B1 chart RPC family is missing';
  end if;

  if not exists (
       select 1
       from information_schema.columns
       where table_schema='public'
         and table_name='chart_ingest_candidates'
         and column_name='id'
         and data_type='text'
     )
     or not exists (
       select 1
       from information_schema.columns
       where table_schema='public'
         and table_name='chart_ingest_candidates'
         and column_name='run_id'
         and data_type='text'
     )
  then
    raise exception
      'STOP: chart ingest candidate identity storage contract drifted';
  end if;
end
$preflight$;

create or replace function
public.chart_materialize_candidate_registry_v1(
  p_run_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  v_candidate public.chart_ingest_candidates%rowtype;
  v_artist_names text[];
  v_artist_name text;
  v_artist record;
  v_track record;
  v_credit record;
  v_artist_ids uuid[]:=array[]::uuid[];
  v_artist_slugs text[]:=array[]::text[];
  v_artist_results jsonb:='[]'::jsonb;
  v_credit_results jsonb:='[]'::jsonb;
  v_source_payload jsonb;
  v_i integer;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('publish_charts'),
       false
     )
  then
    raise exception using errcode='42501',
      message='publish_charts is required.';
  end if;

  select candidate.*
  into v_candidate
  from public.chart_ingest_candidates candidate
  where candidate.id=p_candidate_id::text
    and candidate.run_id=p_run_id::text
  for share;

  if not found
     or v_candidate.status <> 'eligible'
     or nullif(btrim(v_candidate.title),'') is null
     or nullif(btrim(v_candidate.artist_display),'') is null
  then
    raise exception using errcode='42501',
      message='Exact eligible chart candidate is required.';
  end if;

  v_artist_names :=
    platform_private.registry_chart_artist_names_v1(
      v_candidate.artist_display
    );

  if coalesce(cardinality(v_artist_names),0)=0 then
    raise exception using errcode='22023',
      message='Chart candidate has no materializable Artist identity.';
  end if;

  v_source_payload:=to_jsonb(v_candidate);

  for v_i in 1..cardinality(v_artist_names) loop
    v_artist_name:=v_artist_names[v_i];

    select *
    into v_artist
    from platform_private.ensure_registry_chart_artist_v1(
      p_run_id,
      p_candidate_id,
      v_artist_name,
      v_source_payload,
      'publish_charts'
    );

    v_artist_ids:=array_append(v_artist_ids,v_artist.artist_id);
    v_artist_slugs:=array_append(v_artist_slugs,v_artist.artist_slug);
    v_artist_results:=v_artist_results || jsonb_build_array(
      jsonb_build_object(
        'artist_id',v_artist.artist_id,
        'artist_slug',v_artist.artist_slug,
        'artist_name',v_artist_name,
        'created',v_artist.created,
        'operation_id',v_artist.operation_id
      )
    );
  end loop;

  select *
  into v_track
  from platform_private.ensure_registry_chart_track_v1(
    p_run_id,
    p_candidate_id,
    v_candidate.title,
    v_artist_ids[1],
    v_candidate.isrc,
    v_source_payload
  );

  for v_i in 1..cardinality(v_artist_ids) loop
    select *
    into v_credit
    from platform_private.ensure_registry_chart_track_credit_v1(
      p_run_id,
      p_candidate_id,
      v_track.track_id,
      v_artist_ids[v_i],
      v_artist_names[v_i],
      case when v_i=1 then 'primary_artist' else 'featured_artist' end,
      v_i,
      case when v_i=1 then 100 else 80 end,
      v_source_payload
    );

    v_credit_results:=v_credit_results || jsonb_build_array(
      jsonb_build_object(
        'credit_id',v_credit.credit_id,
        'artist_id',v_artist_ids[v_i],
        'created',v_credit.created,
        'operation_id',v_credit.operation_id
      )
    );
  end loop;

  return jsonb_build_object(
    'run_id',p_run_id,
    'candidate_id',p_candidate_id,
    'track_id',v_track.track_id,
    'track_slug',v_track.track_slug,
    'track_created',v_track.created,
    'track_operation_id',v_track.operation_id,
    'primary_artist_id',v_artist_ids[1],
    'primary_artist_slug',v_artist_slugs[1],
    'artists',v_artist_results,
    'credits',v_credit_results
  );
end
$$;

create or replace function
public.chart_admit_artist_origin_v1(
  p_artist_id uuid,
  p_origin_iso2 text,
  p_run_id uuid,
  p_candidate_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_candidate public.chart_ingest_candidates%rowtype;
  v_artist public.registry_artists%rowtype;
  v_iso2 text;
  v_state_fp text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  select candidate.*
  into v_candidate
  from public.chart_ingest_candidates candidate
  where candidate.id=p_candidate_id::text
    and candidate.run_id=p_run_id::text
  for share;

  if not found then
    raise exception using errcode='P0002',
      message='Chart origin evidence candidate was not found.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id;

  if not found
     or v_artist.status not in ('active','draft')
     or nullif(btrim(v_artist.origin_iso2),'') is not null
     or v_artist.origin_confidence is not null
  then
    raise exception using errcode='42501',
      message='Artist is not eligible for missing-origin admission.';
  end if;

  v_iso2:=upper(btrim(p_origin_iso2));
  if not platform_private.registry_is_valid_iso2(v_iso2) then
    raise exception using errcode='22023',
      message='Canonical ISO-3166-1 alpha-2 origin is required.';
  end if;

  v_evidence_id :=
    platform_private.record_registry_chart_user_evidence_v1(
      'artist',
      p_artist_id,
      'registry.artist.origin',
      jsonb_build_object(
        'origin_iso2',v_iso2,
        'origin_confidence',1.0
      ),
      'INTERNAL_FACT',
      'chart_origin_review',
      'chart-run:'||p_run_id::text||':candidate:'||p_candidate_id::text,
      jsonb_build_object(
        'candidate',to_jsonb(v_candidate),
        'origin_iso2',v_iso2,
        'note',coalesce(p_note,'')
      ),
      'manage_registry'
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_state_fp := platform_private.registry_subject_state_fingerprint(
    'artist',p_artist_id
  );

  v_plan:=jsonb_build_object(
    'operation_key','registry.artist_origin.admit',
    'operation_version',1,
    'artist_id',p_artist_id::text,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'proposed_origin_iso2',v_iso2,
    'proposed_origin_confidence',1.0,
    'expected_state_fingerprint',v_state_fp,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-artist-origin-admission-v1'
  );

  v_grant_id := platform_private.issue_registry_chart_user_execution_grant_v1(
    v_evidence.id,
    'registry.artist_origin.admit',
    'artist',
    p_artist_id,
    v_plan,
    'manage_registry',
    'chart-origin:'||substr(v_evidence.assertion_fingerprint,1,40),
    v_state_fp
  );

  select * into v_exec
  from platform_private.execute_registry_artist_origin_admission(
    'registry_chart_admission',v_grant_id
  );

  select * into v_verify
  from platform_private.verify_registry_artist_origin_admission(
    v_exec.operation_id
  );

  if v_verify.verifier_status <> 'passed' then
    raise exception using errcode='40001',
      message='Chart Artist-origin verifier failed.';
  end if;

  return jsonb_build_object(
    'artist_id',p_artist_id,
    'origin_iso2',v_iso2,
    'origin_confidence',1.0,
    'operation_id',v_exec.operation_id,
    'verifier_status',v_verify.verifier_status
  );
end
$$;

create or replace function
public.chart_create_artist_origin_shell_v1(
  p_artist_name text,
  p_origin_iso2 text,
  p_run_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_candidate public.chart_ingest_candidates%rowtype;
  v_names text[];
  v_name text;
  v_match boolean:=false;
  v_artist record;
  v_origin jsonb;
begin
  if v_user_id is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  select candidate.*
  into v_candidate
  from public.chart_ingest_candidates candidate
  where candidate.id=p_candidate_id::text
    and candidate.run_id=p_run_id::text
  for share;

  if not found then
    raise exception using errcode='P0002',
      message='Chart origin evidence candidate was not found.';
  end if;

  v_names := platform_private.registry_chart_artist_names_v1(
    v_candidate.artist_display
  );

  foreach v_name in array v_names loop
    if platform_private.registry_identity_comparison_key_v1(v_name) =
       platform_private.registry_identity_comparison_key_v1(p_artist_name)
    then
      v_match:=true;
      exit;
    end if;
  end loop;

  if not v_match then
    raise exception using errcode='42501',
      message='Requested Artist is not an exact identity from the chart candidate.';
  end if;

  select *
  into v_artist
  from platform_private.ensure_registry_chart_artist_v1(
    p_run_id,
    p_candidate_id,
    p_artist_name,
    to_jsonb(v_candidate),
    'manage_registry'
  );

  v_origin := public.chart_admit_artist_origin_v1(
    v_artist.artist_id,
    p_origin_iso2,
    p_run_id,
    p_candidate_id,
    'Created as draft identity from chart origin review.'
  );

  return jsonb_build_object(
    'artist_id',v_artist.artist_id,
    'artist_slug',v_artist.artist_slug,
    'artist_created',v_artist.created,
    'artist_operation_id',v_artist.operation_id,
    'origin',v_origin
  );
end
$$;

do $proof$
declare
  v_materialize text;
  v_origin text;
  v_shell text;
begin
  select pg_get_functiondef(
    'public.chart_materialize_candidate_registry_v1(uuid,uuid)'::regprocedure
  ) into v_materialize;
  select pg_get_functiondef(
    'public.chart_admit_artist_origin_v1(uuid,text,uuid,uuid,text)'::regprocedure
  ) into v_origin;
  select pg_get_functiondef(
    'public.chart_create_artist_origin_shell_v1(text,text,uuid,uuid)'::regprocedure
  ) into v_shell;

  if position('p_candidate_id::text' in v_materialize)=0
     or position('p_run_id::text' in v_materialize)=0
     or position('p_candidate_id::text' in v_origin)=0
     or position('p_run_id::text' in v_origin)=0
     or position('p_candidate_id::text' in v_shell)=0
     or position('p_run_id::text' in v_shell)=0
  then
    raise exception
      'STOP: chart candidate UUID/text bridge did not converge';
  end if;
end
$proof$;

commit;
