begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

select pg_advisory_xact_lock(
  hashtextextended('wakilisha:chart-evidence-identity-convergence-v1', 0)
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.ensure_registry_chart_artist_v1(uuid,uuid,text,jsonb,text)'
     ) is null
     or to_regprocedure(
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)'
     ) is null
  then
    raise exception
      'Chart evidence identity convergence requires the accepted materialization runtime.';
  end if;

  if to_regclass('public.registry_artist_aliases') is null then
    raise exception
      'Chart evidence identity convergence requires registry_artist_aliases.';
  end if;
end
$preflight$;

create or replace function
platform_private.ensure_registry_chart_artist_v1(
  p_run_id uuid,
  p_candidate_id uuid,
  p_artist_name text,
  p_source_payload jsonb,
  p_required_user_capability_key text
)
returns table (
  artist_id uuid,
  artist_slug text,
  created boolean,
  operation_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $function$
declare
  v_normalized text;
  v_slug text;
  v_existing_ids uuid[];
  v_future_id uuid;
  v_collision jsonb;
  v_collision_fp text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_source_ref text;
begin
  if p_run_id is null
     or p_candidate_id is null
     or nullif(btrim(p_artist_name),'') is null
  then
    raise exception using errcode='22023',
      message='Chart Artist materialization requires run, candidate, and name.';
  end if;

  v_normalized :=
    platform_private.registry_identity_normalize_text_v1(
      p_artist_name
    );
  v_slug :=
    platform_private.registry_artist_creation_slug_v1(
      p_artist_name
    );

  with resolved_artist_ids as (
    select artist.id as artist_id
    from public.registry_artists artist
    where artist.status <> 'archived'
      and (
        artist.slug=v_slug
        or artist.normalized_name=v_normalized
        or platform_private.registry_identity_comparison_key_v1(
             artist.display_name
           ) =
           platform_private.registry_identity_comparison_key_v1(
             p_artist_name
           )
      )

    union

    select alias.canonical_artist_id
    from public.registry_artist_aliases alias
    join public.registry_artists artist
      on artist.id=alias.canonical_artist_id
    where alias.status='active'
      and artist.status <> 'archived'
      and (
        alias.alias_slug=v_slug
        or (
          nullif(btrim(alias.alias_display_name),'') is not null
          and platform_private.registry_identity_comparison_key_v1(
                alias.alias_display_name
              ) =
              platform_private.registry_identity_comparison_key_v1(
                p_artist_name
              )
        )
      )
  )
  select array_agg(
           distinct resolved.artist_id
           order by resolved.artist_id
         )
  into v_existing_ids
  from resolved_artist_ids resolved;

  if coalesce(cardinality(v_existing_ids),0) > 1 then
    raise exception using errcode='23505',
      message='Chart Artist identity is ambiguous in the Registry.';
  end if;

  if cardinality(v_existing_ids)=1 then
    select artist.id,artist.slug
    into artist_id,artist_slug
    from public.registry_artists artist
    where artist.id=v_existing_ids[1];

    created:=false;
    operation_id:=null;
    return next;
    return;
  end if;

  v_future_id:=gen_random_uuid();
  v_collision :=
    platform_private.registry_artist_creation_collision_state_v1(
      v_future_id,
      p_artist_name
    );
  if v_collision <> '[]'::jsonb then
    raise exception using errcode='23505',
      message='Chart Artist identity collided during resolution.';
  end if;

  v_collision_fp :=
    platform_private.registry_identity_creation_collision_fingerprint_v1(
      v_collision
    );
  v_source_ref :=
    'chart-run:'||p_run_id::text||
    ':candidate:'||p_candidate_id::text;

  v_evidence_id :=
    platform_private.record_registry_chart_user_evidence_v1(
      'artist',
      v_future_id,
      'registry.artist.identity.create',
      jsonb_build_object(
        'display_name',btrim(p_artist_name),
        'normalized_name',v_normalized,
        'slug',v_slug
      ),
      'EXTERNAL_EVIDENCE',
      'chart_ingest_candidate',
      v_source_ref,
      p_source_payload,
      p_required_user_capability_key
    );

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  v_plan:=jsonb_build_object(
    'operation_key','registry.artist.create',
    'operation_version',1,
    'artist_id',v_future_id::text,
    'display_name',btrim(p_artist_name),
    'normalized_name',v_normalized,
    'slug',v_slug,
    'collision_state_fingerprint',v_collision_fp,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',
      v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-materialization-v1'
  );

  v_grant_id :=
    platform_private.issue_registry_chart_user_execution_grant_v1(
      v_evidence.id,
      'registry.artist.create',
      'artist',
      v_future_id,
      v_plan,
      p_required_user_capability_key,
      'chart-artist:'||
        substr(v_evidence.assertion_fingerprint,1,40),
      null
    );

  select *
  into v_exec
  from platform_private.execute_registry_materialization_v1(
    'registry_chart_admission',
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_materialization_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status <> 'passed' then
    raise exception using errcode='40001',
      message='Chart Artist materialization verifier failed.';
  end if;

  artist_id:=v_future_id;
  artist_slug:=v_slug;
  created:=true;
  operation_id:=v_exec.operation_id;
  return next;
end
$function$;

create or replace function
public.chart_materialize_candidate_registry_v1(
  p_run_id uuid,
  p_candidate_id uuid,
  p_artist_credits jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $function$
declare
  v_user_id uuid:=auth.uid();
  v_candidate public.chart_ingest_candidates%rowtype;
  v_credit_item jsonb;
  v_artist_names text[]:=array[]::text[];
  v_display_credits text[]:=array[]::text[];
  v_artist_roles text[]:=array[]::text[];
  v_seen_keys text[]:=array[]::text[];
  v_artist_name text;
  v_display_credit text;
  v_artist_role text;
  v_artist_key text;
  v_credit_order integer;
  v_expected_order integer:=1;
  v_seen_featured boolean:=false;
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

  if not found
     or v_candidate.status not in (
       'pending',
       'needs_review',
       'eligible'
     )
     or nullif(btrim(v_candidate.title),'') is null
     or nullif(btrim(v_candidate.artist_display),'') is null
  then
    raise exception using errcode='42501',
      message='Exact eligible chart candidate is required.';
  end if;

  if p_artist_credits is null
     or jsonb_typeof(p_artist_credits) <> 'array'
     or jsonb_array_length(p_artist_credits)=0
  then
    raise exception using errcode='22023',
      message='Structured Chart Artist credits are required.';
  end if;

  for v_credit_item in
    select value
    from jsonb_array_elements(p_artist_credits)
  loop
    if jsonb_typeof(v_credit_item) <> 'object' then
      raise exception using errcode='22023',
        message='Structured Chart Artist credit must be an object.';
    end if;

    v_artist_name:=nullif(btrim(v_credit_item->>'display_name'),'');
    v_display_credit:=nullif(
      btrim(
        coalesce(
          v_credit_item->>'display_credit',
          v_credit_item->>'display_name'
        )
      ),
      ''
    );
    v_artist_role:=nullif(btrim(v_credit_item->>'role'),'');

    if v_artist_name is null
       or v_display_credit is null
       or v_artist_role not in (
         'primary_artist',
         'featured_artist'
       )
       or not (v_credit_item ? 'credit_order')
       or coalesce(v_credit_item->>'credit_order','') !~ '^[1-9][0-9]*$'
    then
      raise exception using errcode='22023',
        message='Structured Chart Artist credit is invalid.';
    end if;

    v_credit_order:=(v_credit_item->>'credit_order')::integer;

    if v_credit_order <> v_expected_order then
      raise exception using errcode='22023',
        message='Structured Chart Artist credit order must be contiguous.';
    end if;

    if v_expected_order=1
       and v_artist_role <> 'primary_artist'
    then
      raise exception using errcode='22023',
        message='Structured Chart Artist credits must begin with a primary Artist.';
    end if;

    if v_artist_role='featured_artist' then
      v_seen_featured:=true;
    elsif v_seen_featured then
      raise exception using errcode='23505',
        message='Structured Chart Artist roles are ambiguous.';
    end if;

    v_artist_key:=
      platform_private.registry_identity_comparison_key_v1(
        v_artist_name
      );

    if nullif(v_artist_key,'') is null
       or array_position(v_seen_keys,v_artist_key) is not null
    then
      raise exception using errcode='23505',
        message='Structured Chart Artist identity is duplicated or ambiguous.';
    end if;

    v_seen_keys:=array_append(v_seen_keys,v_artist_key);
    v_artist_names:=array_append(v_artist_names,v_artist_name);
    v_display_credits:=array_append(
      v_display_credits,
      v_display_credit
    );
    v_artist_roles:=array_append(v_artist_roles,v_artist_role);
    v_expected_order:=v_expected_order+1;
  end loop;

  if cardinality(v_artist_names)=0
     or v_artist_roles[1] <> 'primary_artist'
  then
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
      'manage_registry'
    );

    v_artist_ids:=array_append(
      v_artist_ids,
      v_artist.artist_id
    );
    v_artist_slugs:=array_append(
      v_artist_slugs,
      v_artist.artist_slug
    );
    v_artist_results:=
      v_artist_results ||
      jsonb_build_array(
        jsonb_build_object(
          'artist_id',v_artist.artist_id,
          'artist_slug',v_artist.artist_slug,
          'artist_name',v_artist_name,
          'display_credit',v_display_credits[v_i],
          'role',v_artist_roles[v_i],
          'credit_order',v_i,
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
      v_display_credits[v_i],
      v_artist_roles[v_i],
      v_i,
      case
        when v_artist_roles[v_i]='primary_artist' then 100
        else 80
      end,
      v_source_payload
    );

    v_credit_results:=
      v_credit_results ||
      jsonb_build_array(
        jsonb_build_object(
          'credit_id',v_credit.credit_id,
          'artist_id',v_artist_ids[v_i],
          'display_credit',v_display_credits[v_i],
          'role',v_artist_roles[v_i],
          'credit_order',v_i,
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
    'provider_artist_display',v_candidate.artist_display,
    'artists',v_artist_results,
    'credits',v_credit_results
  );
end
$function$;

revoke all on function
public.chart_materialize_candidate_registry_v1(uuid,uuid,jsonb)
from public, anon, authenticated, service_role;

grant execute on function
public.chart_materialize_candidate_registry_v1(uuid,uuid,jsonb)
to authenticated;

revoke all on function
public.chart_materialize_candidate_registry_v1(uuid,uuid)
from public, anon, authenticated, service_role;

drop function
public.chart_materialize_candidate_registry_v1(uuid,uuid);

do $postcheck$
declare
  v_artist_definition text;
  v_materialize_definition text;
begin
  select pg_get_functiondef(
    'platform_private.ensure_registry_chart_artist_v1(uuid,uuid,text,jsonb,text)'::regprocedure
  )
  into v_artist_definition;

  if to_regprocedure(
       'public.chart_materialize_candidate_registry_v1(uuid,uuid)'
     ) is not null
  then
    raise exception
      'Superseded unstructured Chart materialization signature remains live.';
  end if;

  select pg_get_functiondef(
    'public.chart_materialize_candidate_registry_v1(uuid,uuid,jsonb)'::regprocedure
  )
  into v_materialize_definition;

  if position(
       'registry_artist_aliases'
       in v_artist_definition
     )=0
     or position(
          'alias.status=''active'''
          in replace(v_artist_definition,' ','')
        )=0
     or position(
          'canonical_artist_id'
          in v_artist_definition
        )=0
  then
    raise exception
      'Chart Artist resolution did not retain active alias authority.';
  end if;

  if position(
       'manage_registry'
       in v_materialize_definition
     )=0
     or position(
          'publish_charts'
          in v_materialize_definition
        )>0
     or position(
          'featured_artist'
          in v_materialize_definition
        )=0
     or position(
          'primary_artist'
          in v_materialize_definition
        )=0
     or position(
          'p_artist_credits'
          in v_materialize_definition
        )=0
     or position(
          'jsonb_array_elements'
          in v_materialize_definition
        )=0
     or position(
          'regexp_split_to_array'
          in v_materialize_definition
        )>0
     or position(
          'when v_i=1 then ''primary_artist'' else ''featured_artist'''
          in v_materialize_definition
        )>0
  then
    raise exception
      'Chart credit-role convergence postcondition failed.';
  end if;
end
$postcheck$;

commit;
