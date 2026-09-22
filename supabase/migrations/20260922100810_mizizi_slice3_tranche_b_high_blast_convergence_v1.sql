-- MIZIZI Slice 3 Tranche B — Artist High-Blast Authority Convergence V1
--
-- Completes the remaining Tranche B high-blast containment as one rollback
-- boundary: Artist decouple exact reviewed authority, safe Artist merge exact
-- reviewed authority, and retirement of the destructive legacy manual merge.
--
-- The mature decouple and safe-merge algorithms are moved byte-for-byte into
-- platform_private. The existing Registry evidence -> shared review -> exact
-- grant -> operation journal -> independent verifier kernel is reused.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-tranche-b-high-blast-convergence-v1',
    0
  )
);

do $preflight$
declare
  v_dependency_count integer;
begin
  if to_regprocedure('public.admin_apply_artist_decouple_decision(uuid)') is null
     or to_regprocedure('public.admin_decouple_registry_artist(uuid,jsonb,text,boolean,uuid)') is null
     or to_regprocedure('public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)') is null
     or to_regprocedure('public.admin_merge_registry_artists(uuid,uuid,text,boolean)') is null
     or to_regprocedure('public.admin_get_registry_artist_merge_preview(uuid,uuid)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_execution_target_set_fingerprint(uuid)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_artist_aliases') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_release_artists') is null
     or to_regclass('public.registry_artist_decouple_decisions') is null
     or to_regclass('public.registry_artist_resolution_events') is null
     or to_regclass('public.registry_audit_log') is null
     or to_regclass('public.registry_identity_lineage') is null
     or to_regclass('public.wk_chart_entries_v2') is null
     or to_regclass('public.chart_entries') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('platform_private.registry_review_cases') is null
     or to_regclass('platform_private.registry_review_events') is null
  then
    raise exception 'STOP: accepted Artist / Registry governance authority is incomplete';
  end if;

  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key='manage_registry'
  ) then
    raise exception 'STOP: manage_registry capability authority is missing';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='admin_apply_artist_decouple_decision'
      and pg_get_function_identity_arguments(p.oid)='p_decision_id uuid'
  )<>'73e3aab71dbac4ba2ac89dd6f6fc8d8876b4f8633cda691282efa0d67be4fce8'
  then
    raise exception 'STOP: Artist decouple reviewed wrapper drifted before convergence';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='admin_decouple_registry_artist'
      and pg_get_function_identity_arguments(p.oid)=
          'p_source_artist_id uuid, p_replacements jsonb, p_note text, p_archive_source boolean, p_chart_primary_artist_id uuid'
  )<>'bf2e8410e11af4207d064a800b7405045098ea0442742941a4fe5f55d026463e'
  then
    raise exception 'STOP: mature Artist decouple engine drifted before internalization';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='admin_safe_merge_registry_artists'
      and pg_get_function_identity_arguments(p.oid)=
          'p_source_artist_id uuid, p_canonical_artist_id uuid, p_note text, p_archive_source boolean, p_merge_reason text'
  )<>'c5a595d6cd76da5df7d92d7e54449a270a3423cfffc8d8b0ce67eb85af3fd075'
  then
    raise exception 'STOP: mature safe Artist merge engine drifted before internalization';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='admin_merge_registry_artists'
      and pg_get_function_identity_arguments(p.oid)=
          'p_source_artist_id uuid, p_canonical_artist_id uuid, p_note text, p_archive_source boolean'
  )<>'880f3fe1419b4ed9676ee0cbc14ca4b6193f0ef52475d25117df6a2325a151bd'
  then
    raise exception 'STOP: old manual Artist merge body drifted before retirement';
  end if;

  select count(*)::integer
  into v_dependency_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where p.prokind in ('f','p')
    and p.oid<>'public.admin_merge_registry_artists(uuid,uuid,text,boolean)'::regprocedure
    and pg_get_functiondef(p.oid) ilike '%admin_merge_registry_artists%';

  v_dependency_count:=v_dependency_count + (
    select count(*)::integer
    from pg_views v
    where v.definition ilike '%admin_merge_registry_artists%'
  ) + (
    select count(*)::integer
    from pg_trigger t
    where not t.tgisinternal
      and pg_get_triggerdef(t.oid) ilike '%admin_merge_registry_artists%'
  );

  if v_dependency_count<>0 then
    raise exception 'STOP: old manual Artist merge still has live database dependencies';
  end if;

  if exists (
       select 1 from public.capability_definitions
       where capability_key in ('decouple_registry_artist','merge_registry_artist')
     )
     or exists (
       select 1 from platform_private.system_actors
       where actor_key in ('registry_artist_decouple_admin','registry_artist_merge_admin')
     )
     or exists (
       select 1 from platform_private.registry_operation_types
       where (operation_key,operation_version) in (
         ('registry.artist.decouple',1),
         ('registry.artist.merge',1)
       )
     )
     or to_regprocedure('platform_private.registry_exact_target_set_fingerprint_v1(text[],uuid[])') is not null
     or to_regprocedure('platform_private.registry_artist_decouple_admin_current_user_v1()') is not null
     or to_regprocedure('platform_private.registry_artist_merge_admin_current_user_v1()') is not null
     or to_regprocedure('platform_private.registry_artist_decouple_state_fingerprint_v1(uuid)') is not null
     or to_regprocedure('platform_private.registry_artist_merge_state_fingerprint_v1(uuid,uuid)') is not null
     or to_regprocedure('platform_private.record_registry_artist_decouple_evidence_v1(uuid)') is not null
     or to_regprocedure('platform_private.record_registry_artist_merge_evidence_v1(uuid,uuid,text,boolean,text)') is not null
     or to_regprocedure('platform_private.issue_registry_artist_decouple_grant_v1(uuid)') is not null
     or to_regprocedure('platform_private.issue_registry_artist_merge_grant_v1(uuid)') is not null
     or to_regprocedure('platform_private.execute_registry_artist_decouple_v1(uuid)') is not null
     or to_regprocedure('platform_private.execute_registry_artist_merge_v1(uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_artist_decouple_v1(uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_artist_merge_v1(uuid)') is not null
     or to_regprocedure('platform_private.apply_registry_artist_decouple_engine_v1(uuid,jsonb,text,boolean,uuid)') is not null
     or to_regprocedure('platform_private.apply_registry_artist_merge_engine_v1(uuid,uuid,text,boolean,text)') is not null
  then
    raise exception 'STOP: Tranche B Artist high-blast namespace is already occupied';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,label,description,domain
)
values
(
  'decouple_registry_artist',
  'Decouple Registry Artist',
  'Apply one reviewed exact Artist split decision through the mature credit-decouple engine and independent verification.',
  'registry'
),
(
  'merge_registry_artist',
  'Merge Registry Artist',
  'Apply one reviewed exact safe Artist merge through the mature archive-preserving engine and independent verification.',
  'registry'
);

insert into platform_private.system_actors (
  actor_key,label,actor_kind,status,capability_profile
)
values
(
  'registry_artist_decouple_admin',
  'Registry Artist Decouple Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',jsonb_build_array('registry.artist.decouple/v1')
  )
),
(
  'registry_artist_merge_admin',
  'Registry Artist Merge Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',jsonb_build_array('registry.artist.merge/v1')
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,executor_kind,executor_key,status
)
values
('registry_artist_decouple_admin','database_role','authenticator','active'),
('registry_artist_merge_admin','database_role','authenticator','active');

insert into platform_private.registry_operation_types (
  operation_key,
  operation_version,
  capability_key,
  risk_class,
  allowed_subject_types,
  requires_existing_target,
  max_targets,
  max_rows_ceiling,
  max_grant_ttl_seconds,
  requires_human_approval,
  requires_verifier,
  enabled,
  description
)
values
(
  'registry.artist.decouple',
  1,
  'decouple_registry_artist',
  'critical',
  array['artist']::text[],
  true,
  32,
  10000,
  300,
  true,
  true,
  true,
  'Apply one reviewed Artist decouple decision. Exact authority freezes the source/replacement Artists, domain decision, affected credit/projection state, and a candidate-specific row budget.'
),
(
  'registry.artist.merge',
  1,
  'merge_registry_artist',
  'critical',
  array['artist']::text[],
  true,
  2,
  1024,
  300,
  true,
  true,
  true,
  'Apply one safe Artist merge. Exact authority freezes source/canonical Artists, affected aliases/credits/projection state, and a candidate-specific row budget.'
);

-- Earned kernel primitive: compute the immutable target-set fingerprint before
-- grant insertion using the same canonical representation as
-- registry_execution_target_set_fingerprint(uuid).
create function platform_private.registry_exact_target_set_fingerprint_v1(
  p_subject_types text[],
  p_subject_ids uuid[]
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_payload jsonb;
begin
  if coalesce(cardinality(p_subject_types),0)<1
     or cardinality(p_subject_types)<>cardinality(p_subject_ids)
     or exists (
       select 1
       from generate_subscripts(p_subject_ids,1) i
       where p_subject_types[i] is null
          or p_subject_ids[i] is null
     )
     or exists (
       select 1
       from (
         select p_subject_types[i] subject_type,p_subject_ids[i] subject_id,count(*) c
         from generate_subscripts(p_subject_ids,1) i
         group by 1,2
         having count(*)>1
       ) duplicate
     )
  then
    raise exception using errcode='22023',
      message='Exact Registry target arrays must be non-empty, aligned, non-null, and unique.';
  end if;

  select jsonb_agg(
           jsonb_build_object(
             'subject_type',target.subject_type,
             'subject_id',target.subject_id::text,
             'expected_state_fingerprint',target.expected_state_fingerprint
           )
           order by target.subject_type,target.subject_id::text
         )
  into v_payload
  from (
    select
      p_subject_types[i] subject_type,
      p_subject_ids[i] subject_id,
      platform_private.registry_subject_state_fingerprint(
        p_subject_types[i],
        p_subject_ids[i]
      ) expected_state_fingerprint
    from generate_subscripts(p_subject_ids,1) i
  ) target;

  if exists (
    select 1
    from generate_subscripts(p_subject_ids,1) i
    where platform_private.registry_subject_state_fingerprint(
            p_subject_types[i],
            p_subject_ids[i]
          ) is null
  ) then
    raise exception using errcode='P0002',
      message='One or more exact Registry target state fingerprints are unavailable.';
  end if;

  return encode(
    extensions.digest(coalesce(v_payload,'[]'::jsonb)::text,'sha256'),
    'hex'
  );
end
$$;

create function platform_private.registry_artist_decouple_admin_current_user_v1()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception using errcode='42501',message='manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_artist_decouple_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry Artist decouple broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_artist_merge_admin_current_user_v1()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid:=auth.uid();
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception using errcode='42501',message='manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_artist_merge_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry Artist merge broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_artist_decouple_state_fingerprint_v1(
  p_decision_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_decision public.registry_artist_decouple_decisions%rowtype;
  v_source public.registry_artists%rowtype;
  v_replacement_ids uuid[];
  v_target_ids uuid[];
  v_target_slugs text[];
  v_track_ids uuid[];
  v_release_ids uuid[];
  v_payload jsonb;
begin
  select decision.*
  into v_decision
  from public.registry_artist_decouple_decisions decision
  where decision.id=p_decision_id;

  if not found or v_decision.source_artist_id is null then
    raise exception using errcode='P0002',
      message='Artist decouple decision/source is unavailable for state fingerprinting.';
  end if;

  select array_agg(distinct (item.value->>'artist_id')::uuid order by (item.value->>'artist_id')::uuid)
  into v_replacement_ids
  from jsonb_array_elements(coalesce(v_decision.selected_artists,'[]'::jsonb)) item(value)
  where nullif(item.value->>'artist_id','') is not null;

  if coalesce(cardinality(v_replacement_ids),0)<2 then
    raise exception using errcode='22023',
      message='Artist decouple decision has fewer than two replacement Artists.';
  end if;

  v_target_ids:=array(
    select distinct target_id
    from unnest(array[v_decision.source_artist_id]||v_replacement_ids) target(target_id)
    order by target_id
  );

  select artist.*
  into v_source
  from public.registry_artists artist
  where artist.id=v_decision.source_artist_id;

  if not found then
    raise exception using errcode='P0002',
      message='Artist decouple source Artist is unavailable.';
  end if;

  select array_agg(lower(artist.slug) order by artist.id)
  into v_target_slugs
  from public.registry_artists artist
  where artist.id=any(v_target_ids);

  if coalesce(cardinality(v_target_slugs),0)<>cardinality(v_target_ids) then
    raise exception using errcode='P0002',
      message='One or more Artist decouple exact targets are unavailable.';
  end if;

  select coalesce(array_agg(distinct credit.track_id order by credit.track_id),'{}'::uuid[])
  into v_track_ids
  from public.registry_track_artists credit
  where (
      credit.artist_id=v_source.id
      or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
    )
    and coalesce(credit.status,'shadow') in ('shadow','active','needs_review')
    and credit.track_id is not null;

  select coalesce(array_agg(distinct credit.release_id order by credit.release_id),'{}'::uuid[])
  into v_release_ids
  from public.registry_release_artists credit
  where (
      credit.artist_id=v_source.id
      or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
    )
    and coalesce(credit.status,'shadow') in ('shadow','active','needs_review')
    and credit.release_id is not null;

  select jsonb_build_object(
    'decision',to_jsonb(v_decision),
    'artists',coalesce((
      select jsonb_agg(to_jsonb(artist) order by artist.id::text)
      from public.registry_artists artist
      where artist.id=any(v_target_ids)
    ),'[]'::jsonb),
    'track_artist_scope',coalesce((
      select jsonb_agg(to_jsonb(credit) order by credit.id::text)
      from public.registry_track_artists credit
      where credit.track_id=any(v_track_ids)
        and (
          credit.artist_id=any(v_target_ids)
          or lower(coalesce(credit.artist_slug,''))=any(v_target_slugs)
        )
    ),'[]'::jsonb),
    'release_artist_scope',coalesce((
      select jsonb_agg(to_jsonb(credit) order by credit.id::text)
      from public.registry_release_artists credit
      where credit.release_id=any(v_release_ids)
        and (
          credit.artist_id=any(v_target_ids)
          or lower(coalesce(credit.artist_slug,''))=any(v_target_slugs)
        )
    ),'[]'::jsonb),
    'track_metadata_scope',coalesce((
      select jsonb_agg(to_jsonb(track) order by track.id::text)
      from public.registry_tracks track
      where track.id=any(v_track_ids)
    ),'[]'::jsonb),
    'source_alias_scope',coalesce((
      select jsonb_agg(to_jsonb(alias_row) order by alias_row.id::text)
      from public.registry_artist_aliases alias_row
      where lower(alias_row.alias_slug)=lower(v_source.slug)
    ),'[]'::jsonb),
    'chart_v2_scope',coalesce((
      select jsonb_agg(to_jsonb(chart_row) order by chart_row.id)
      from public.wk_chart_entries_v2 chart_row
      where public.wk_slugify_text(coalesce(chart_row.artist_slug,''))=
              public.wk_slugify_text(v_source.slug)
         or public.wk_slugify_text(coalesce(chart_row.artist_name,''))=
              public.wk_slugify_text(v_source.display_name)
    ),'[]'::jsonb),
    'chart_runtime_scope',coalesce((
      select jsonb_agg(to_jsonb(chart_row) order by chart_row.id::text)
      from public.chart_entries chart_row
      where public.wk_slugify_text(coalesce(chart_row.artist_slug,''))=
              public.wk_slugify_text(v_source.slug)
         or public.wk_slugify_text(coalesce(chart_row.artist_name,''))=
              public.wk_slugify_text(v_source.display_name)
    ),'[]'::jsonb)
  )
  into v_payload;

  return encode(extensions.digest(v_payload::text,'sha256'),'hex');
end
$$;

create function platform_private.registry_artist_merge_state_fingerprint_v1(
  p_source_artist_id uuid,
  p_canonical_artist_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_source public.registry_artists%rowtype;
  v_preview jsonb;
  v_payload jsonb;
begin
  if p_source_artist_id is null
     or p_canonical_artist_id is null
     or p_source_artist_id=p_canonical_artist_id
  then
    raise exception using errcode='22023',
      message='Distinct source/canonical Artists are required for merge state fingerprinting.';
  end if;

  select artist.*
  into v_source
  from public.registry_artists artist
  where artist.id=p_source_artist_id;

  if not found then
    raise exception using errcode='P0002',message='Safe merge source Artist is unavailable.';
  end if;

  if not exists (
    select 1 from public.registry_artists artist
    where artist.id=p_canonical_artist_id
  ) then
    raise exception using errcode='P0002',message='Safe merge canonical Artist is unavailable.';
  end if;

  v_preview:=public.admin_get_registry_artist_merge_preview(
    p_source_artist_id,
    p_canonical_artist_id
  );

  select jsonb_build_object(
    'preview',v_preview,
    'artists',coalesce((
      select jsonb_agg(to_jsonb(artist) order by artist.id::text)
      from public.registry_artists artist
      where artist.id=any(array[p_source_artist_id,p_canonical_artist_id])
    ),'[]'::jsonb),
    'track_metadata_scope',coalesce((
      select jsonb_agg(to_jsonb(track) order by track.id::text)
      from public.registry_tracks track
      where track.metadata->>'primary_artist_slug'=v_source.slug
         or track.metadata->>'artist_slug'=v_source.slug
    ),'[]'::jsonb),
    'aliases',coalesce((
      select jsonb_agg(to_jsonb(alias_row) order by alias_row.id::text)
      from public.registry_artist_aliases alias_row
      where lower(alias_row.alias_slug)=lower(v_source.slug)
         or alias_row.canonical_artist_id=p_source_artist_id
    ),'[]'::jsonb)
  )
  into v_payload;

  return encode(extensions.digest(v_payload::text,'sha256'),'hex');
end
$$;

create function platform_private.record_registry_artist_decouple_evidence_v1(
  p_decision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_decision public.registry_artist_decouple_decisions%rowtype;
  v_source public.registry_artists%rowtype;
  v_replacement_ids uuid[];
  v_replacement_count integer;
  v_target_ids uuid[];
  v_track_ids uuid[];
  v_release_ids uuid[];
  v_chart_v2_ids text[];
  v_chart_runtime_ids uuid[];
  v_track_metadata_ids uuid[];
  v_source_alias_ids uuid[];
  v_track_count integer;
  v_release_count integer;
  v_chart_v2_count integer;
  v_chart_runtime_count integer;
  v_track_metadata_count integer;
  v_alias_count integer;
  v_row_budget integer;
  v_state_fingerprint text;
  v_claim jsonb;
  v_source_payload_fingerprint text;
  v_source_ref text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  v_user_id:=platform_private.registry_artist_decouple_admin_current_user_v1();

  select decision.*
  into v_decision
  from public.registry_artist_decouple_decisions decision
  where decision.id=p_decision_id;

  if not found
     or v_decision.decision_status<>'ready'
     or v_decision.decision_type not in ('split_combined_artist','split_raw_credit')
     or v_decision.source_artist_id is null
     or jsonb_typeof(coalesce(v_decision.selected_artists,'[]'::jsonb))<>'array'
  then
    raise exception using errcode='42501',
      message='Artist decouple decision is not ready exact authority.';
  end if;

  if octet_length(coalesce(v_decision.note,''))>4000 then
    raise exception using errcode='22023',message='Artist decouple note exceeds 4000 bytes.';
  end if;

  select array_agg(distinct (item.value->>'artist_id')::uuid order by (item.value->>'artist_id')::uuid)
  into v_replacement_ids
  from jsonb_array_elements(v_decision.selected_artists) item(value)
  where nullif(item.value->>'artist_id','') is not null;

  v_replacement_count:=coalesce(cardinality(v_replacement_ids),0);

  if v_replacement_count<2 or v_replacement_count>31
     or v_decision.source_artist_id=any(v_replacement_ids)
  then
    raise exception using errcode='54000',
      message='Artist decouple requires 2-31 distinct replacement Artists.';
  end if;

  v_target_ids:=array(
    select target_id
    from unnest(array[v_decision.source_artist_id]||v_replacement_ids) target(target_id)
    order by target_id
  );

  select artist.*
  into v_source
  from public.registry_artists artist
  where artist.id=v_decision.source_artist_id
    and artist.status in ('active','draft','needs_review','archived');

  if not found
     or (
       select count(*)
       from public.registry_artists artist
       where artist.id=any(v_replacement_ids)
         and artist.status in ('active','draft','needs_review')
     )<>v_replacement_count
  then
    raise exception using errcode='P0002',
      message='Artist decouple exact source/replacement set is unavailable.';
  end if;

  if v_decision.chart_primary_artist_id is not null
     and not (v_decision.chart_primary_artist_id=any(v_replacement_ids))
  then
    raise exception using errcode='42501',
      message='Artist decouple chart primary Artist is not a replacement target.';
  end if;

  select coalesce(array_agg(distinct credit.track_id order by credit.track_id),'{}'::uuid[])
  into v_track_ids
  from public.registry_track_artists credit
  where (
      credit.artist_id=v_source.id
      or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
    )
    and coalesce(credit.status,'shadow') in ('shadow','active','needs_review')
    and credit.track_id is not null;

  select coalesce(array_agg(distinct credit.release_id order by credit.release_id),'{}'::uuid[])
  into v_release_ids
  from public.registry_release_artists credit
  where (
      credit.artist_id=v_source.id
      or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
    )
    and coalesce(credit.status,'shadow') in ('shadow','active','needs_review')
    and credit.release_id is not null;

  select count(*)::integer
  into v_track_count
  from public.registry_track_artists credit
  where (
      credit.artist_id=v_source.id
      or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
    )
    and coalesce(credit.status,'shadow') in ('shadow','active','needs_review');

  select count(*)::integer
  into v_release_count
  from public.registry_release_artists credit
  where (
      credit.artist_id=v_source.id
      or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
    )
    and coalesce(credit.status,'shadow') in ('shadow','active','needs_review');

  select coalesce(array_agg(chart_row.id order by chart_row.id),'{}'::text[])
  into v_chart_v2_ids
  from public.wk_chart_entries_v2 chart_row
  where public.wk_slugify_text(coalesce(chart_row.artist_slug,''))=
          public.wk_slugify_text(v_source.slug)
     or public.wk_slugify_text(coalesce(chart_row.artist_name,''))=
          public.wk_slugify_text(v_source.display_name);

  v_chart_v2_count:=coalesce(cardinality(v_chart_v2_ids),0);

  select coalesce(array_agg(chart_row.id order by chart_row.id),'{}'::uuid[])
  into v_chart_runtime_ids
  from public.chart_entries chart_row
  where public.wk_slugify_text(coalesce(chart_row.artist_slug,''))=
          public.wk_slugify_text(v_source.slug)
     or public.wk_slugify_text(coalesce(chart_row.artist_name,''))=
          public.wk_slugify_text(v_source.display_name);

  v_chart_runtime_count:=coalesce(cardinality(v_chart_runtime_ids),0);

  select coalesce(array_agg(track.id order by track.id),'{}'::uuid[])
  into v_track_metadata_ids
  from public.registry_tracks track
  where track.id=any(v_track_ids)
    and (
      public.wk_slugify_text(coalesce(track.metadata->>'primary_artist_slug',''))=
        public.wk_slugify_text(v_source.slug)
      or public.wk_slugify_text(coalesce(track.metadata->>'artist_slug',''))=
        public.wk_slugify_text(v_source.slug)
    );

  v_track_metadata_count:=coalesce(cardinality(v_track_metadata_ids),0);

  select coalesce(array_agg(alias_row.id order by alias_row.id),'{}'::uuid[])
  into v_source_alias_ids
  from public.registry_artist_aliases alias_row
  where lower(alias_row.alias_slug)=lower(v_source.slug)
    and coalesce(alias_row.status,'active')='active';

  v_alias_count:=coalesce(cardinality(v_source_alias_ids),0);

  v_row_budget:=
      v_track_count*v_replacement_count
    + v_track_count
    + v_release_count*v_replacement_count
    + v_release_count
    + v_chart_v2_count
    + v_chart_runtime_count
    + v_track_metadata_count
    + v_alias_count
    + v_replacement_count
    + 2;

  if v_row_budget<1 or v_row_budget>10000 then
    raise exception using errcode='54000',
      message='Artist decouple exceeds the 10000-row exact operation ceiling.';
  end if;

  v_state_fingerprint:=
    platform_private.registry_artist_decouple_state_fingerprint_v1(p_decision_id);

  v_claim:=jsonb_build_object(
    'operation_key','registry.artist.decouple',
    'operation_version',1,
    'decision_id',v_decision.id::text,
    'source_artist_id',v_decision.source_artist_id::text,
    'replacement_artist_ids',to_jsonb(v_replacement_ids),
    'selected_artists',v_decision.selected_artists,
    'chart_primary_artist_id',case when v_decision.chart_primary_artist_id is null then null else to_jsonb(v_decision.chart_primary_artist_id::text) end,
    'note',v_decision.note,
    'archive_source',true,
    'source_track_ids',to_jsonb(v_track_ids),
    'source_release_ids',to_jsonb(v_release_ids),
    'chart_v2_ids',to_jsonb(v_chart_v2_ids),
    'chart_runtime_ids',to_jsonb(v_chart_runtime_ids),
    'track_metadata_ids',to_jsonb(v_track_metadata_ids),
    'source_alias_ids',to_jsonb(v_source_alias_ids),
    'artist_decouple_state_fingerprint',v_state_fingerprint,
    'expected_row_budget',v_row_budget,
    'policy_ruleset_version','registry-artist-decouple-v1'
  );

  v_source_payload_fingerprint:=platform_private.registry_plan_fingerprint(v_claim);
  v_source_ref:='registry-artist-decouple:'||v_decision.id::text||':'||
    substr(v_source_payload_fingerprint,1,32);

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist',
        'subject_id',v_decision.source_artist_id::text,
        'claim_key','registry.artist.decouple',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','registry_artist_decouple_admin',
        'source_ref',v_source_ref,
        'source_payload_fingerprint',v_source_payload_fingerprint,
        'recorded_by_principal_key','user:'||v_user_id::text
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,subject_id,claim_key,claim_payload,trust_class,source_kind,
    source_ref,source_payload_fingerprint,observed_at,recorded_by_principal_key,
    assertion_fingerprint
  )
  values (
    'artist',v_decision.source_artist_id,'registry.artist.decouple',v_claim,
    'INTERNAL_FACT','registry_artist_decouple_admin',v_source_ref,
    v_source_payload_fingerprint,now(),'user:'||v_user_id::text,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint) do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id
    into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint
      and assertion.recorded_by_principal_key='user:'||v_user_id::text;
  end if;

  if v_assertion_id is null then
    raise exception using errcode='23505',
      message='Artist decouple evidence identity conflicts with different authority.';
  end if;

  return v_assertion_id;
end
$$;

create function platform_private.record_registry_artist_merge_evidence_v1(
  p_source_artist_id uuid,
  p_canonical_artist_id uuid,
  p_note text default null,
  p_archive_source boolean default true,
  p_merge_reason text default 'same_person'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_source public.registry_artists%rowtype;
  v_canonical public.registry_artists%rowtype;
  v_reason text;
  v_preview jsonb;
  v_preview_fingerprint text;
  v_state_fingerprint text;
  v_track_metadata_ids uuid[];
  v_source_alias_match_count integer;
  v_source_alias_target_count integer;
  v_row_budget integer;
  v_claim jsonb;
  v_source_payload_fingerprint text;
  v_source_ref text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  v_user_id:=platform_private.registry_artist_merge_admin_current_user_v1();

  if p_source_artist_id is null
     or p_canonical_artist_id is null
     or p_source_artist_id=p_canonical_artist_id
  then
    raise exception using errcode='22023',
      message='Distinct source/canonical Artists are required.';
  end if;

  if octet_length(coalesce(p_note,''))>4000 then
    raise exception using errcode='22023',message='Artist merge note exceeds 4000 bytes.';
  end if;

  v_reason:=coalesce(nullif(btrim(p_merge_reason),''),'same_person');

  if v_reason not in (
    'same_person','name_change','stage_name_change','duplicate_record','manual_correction'
  ) then
    raise exception using errcode='22023',message='Invalid Artist merge reason.';
  end if;

  select artist.* into v_source
  from public.registry_artists artist
  where artist.id=p_source_artist_id
    and artist.status in ('active','draft','needs_review','archived');

  select artist.* into v_canonical
  from public.registry_artists artist
  where artist.id=p_canonical_artist_id
    and artist.status in ('active','draft','needs_review');

  if v_source.id is null or v_canonical.id is null then
    raise exception using errcode='P0002',
      message='Safe Artist merge source/canonical target is unavailable.';
  end if;

  v_preview:=public.admin_get_registry_artist_merge_preview(
    p_source_artist_id,p_canonical_artist_id
  );
  v_preview_fingerprint:=platform_private.registry_plan_fingerprint(v_preview);
  v_state_fingerprint:=platform_private.registry_artist_merge_state_fingerprint_v1(
    p_source_artist_id,p_canonical_artist_id
  );

  select coalesce(array_agg(track.id order by track.id),'{}'::uuid[])
  into v_track_metadata_ids
  from public.registry_tracks track
  where track.metadata->>'primary_artist_slug'=v_source.slug
     or track.metadata->>'artist_slug'=v_source.slug;

  select count(*)::integer
  into v_source_alias_match_count
  from public.registry_artist_aliases alias_row
  where lower(alias_row.alias_slug)=lower(v_source.slug);

  select count(*)::integer
  into v_source_alias_target_count
  from public.registry_artist_aliases alias_row
  where alias_row.canonical_artist_id=v_source.id;

  v_row_budget:=
      greatest(v_source_alias_match_count,1)
    + v_source_alias_target_count
    + jsonb_array_length(coalesce(v_preview->'trackCredits','[]'::jsonb))
    + jsonb_array_length(coalesce(v_preview->'releaseCredits','[]'::jsonb))
    + jsonb_array_length(coalesce(v_preview->'chartEntries','[]'::jsonb))
    + coalesce(cardinality(v_track_metadata_ids),0)
    + 3;

  if v_row_budget<1 or v_row_budget>1024 then
    raise exception using errcode='54000',
      message='Safe Artist merge exceeds the 1024-row exact operation ceiling.';
  end if;

  v_claim:=jsonb_build_object(
    'operation_key','registry.artist.merge',
    'operation_version',1,
    'source_artist_id',v_source.id::text,
    'canonical_artist_id',v_canonical.id::text,
    'note',nullif(p_note,''),
    'archive_source',coalesce(p_archive_source,true),
    'merge_reason',v_reason,
    'preview_fingerprint',v_preview_fingerprint,
    'track_metadata_ids',to_jsonb(v_track_metadata_ids),
    'artist_merge_state_fingerprint',v_state_fingerprint,
    'expected_row_budget',v_row_budget,
    'policy_ruleset_version','registry-artist-merge-v1'
  );

  v_source_payload_fingerprint:=platform_private.registry_plan_fingerprint(v_claim);
  v_source_ref:='registry-artist-merge:'||v_source.id::text||':'||
    v_canonical.id::text||':'||substr(v_source_payload_fingerprint,1,32);

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist',
        'subject_id',v_source.id::text,
        'claim_key','registry.artist.merge',
        'claim_payload',v_claim,
        'trust_class','INTERNAL_FACT',
        'source_kind','registry_artist_merge_admin',
        'source_ref',v_source_ref,
        'source_payload_fingerprint',v_source_payload_fingerprint,
        'recorded_by_principal_key','user:'||v_user_id::text
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,subject_id,claim_key,claim_payload,trust_class,source_kind,
    source_ref,source_payload_fingerprint,observed_at,recorded_by_principal_key,
    assertion_fingerprint
  )
  values (
    'artist',v_source.id,'registry.artist.merge',v_claim,'INTERNAL_FACT',
    'registry_artist_merge_admin',v_source_ref,v_source_payload_fingerprint,
    now(),'user:'||v_user_id::text,v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint) do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id
    into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint
      and assertion.recorded_by_principal_key='user:'||v_user_id::text;
  end if;

  if v_assertion_id is null then
    raise exception using errcode='23505',
      message='Artist merge evidence identity conflicts with different authority.';
  end if;

  return v_assertion_id;
end
$$;

create function platform_private.issue_registry_artist_decouple_grant_v1(
  p_evidence_assertion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_claim jsonb;
  v_source_artist_id uuid;
  v_replacement_ids uuid[];
  v_target_ids uuid[];
  v_subject_types text[];
  v_target_fingerprint text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
  v_target_id uuid;
  v_target_state text;
begin
  v_user_id:=platform_private.registry_artist_decouple_admin_current_user_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.artist.decouple'
    and operation_type.operation_version=1
    and operation_type.capability_key='decouple_registry_artist'
    and operation_type.enabled;

  if not found
     or v_operation_type.risk_class<>'critical'
     or v_operation_type.allowed_subject_types<>array['artist']::text[]
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>32
     or v_operation_type.max_rows_ceiling<>10000
     or v_operation_type.max_grant_ttl_seconds<>300
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Artist decouple typed operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.claim_key<>'registry.artist.decouple'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'registry_artist_decouple_admin'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound Artist decouple authority.';
  end if;

  v_claim:=v_evidence.claim_payload;
  v_source_artist_id:=(v_claim->>'source_artist_id')::uuid;

  select array_agg(item.value::uuid order by item.value)
  into v_replacement_ids
  from jsonb_array_elements_text(v_claim->'replacement_artist_ids') item(value);

  if v_claim->>'operation_key'<>'registry.artist.decouple'
     or (v_claim->>'operation_version')::integer<>1
     or v_claim->>'policy_ruleset_version'<>'registry-artist-decouple-v1'
     or v_evidence.subject_id<>v_source_artist_id
     or coalesce((v_claim->>'expected_row_budget')::integer,0) not between 1 and 10000
     or coalesce(cardinality(v_replacement_ids),0) not between 2 and 31
     or v_source_artist_id=any(v_replacement_ids)
     or platform_private.registry_artist_decouple_state_fingerprint_v1(
          (v_claim->>'decision_id')::uuid
        )<>v_claim->>'artist_decouple_state_fingerprint'
  then
    raise exception using errcode='40001',
      message='WK_STALE_ARTIST_DECOUPLE: reviewed Artist split state changed before exact grant issuance.';
  end if;

  v_target_ids:=array(
    select target_id
    from unnest(array[v_source_artist_id]||v_replacement_ids) target(target_id)
    order by target_id
  );
  v_subject_types:=array_fill('artist'::text,array[cardinality(v_target_ids)]);
  v_target_fingerprint:=platform_private.registry_exact_target_set_fingerprint_v1(
    v_subject_types,v_target_ids
  );

  v_plan:=v_claim||jsonb_build_object(
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'target_artist_ids',to_jsonb(v_target_ids)
  );
  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(v_plan);
  v_idempotency_key:='registry-artist-decouple:'||v_evidence.assertion_fingerprint;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_artist_decouple_admin'
    and execution_grant.operation_key='registry.artist.decouple'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.required_user_capability_key<>'manage_registry'
    then
      raise exception using errcode='23505',
        message='Artist decouple idempotency key is bound to different authority.';
    end if;
    return v_existing.id;
  end if;

  insert into platform_private.registry_execution_grants (
    actor_key,capability_key,system_actor_capability_grant_id,operation_key,
    operation_version,plan_payload,plan_fingerprint,target_set_fingerprint,
    max_rows,idempotency_key,status,issued_by_user_id,issued_by_principal_key,
    policy_ruleset_version,required_user_capability_key,issued_at,expires_at
  )
  values (
    'registry_artist_decouple_admin','decouple_registry_artist',null,
    'registry.artist.decouple',1,v_plan,v_plan_fingerprint,v_target_fingerprint,
    (v_claim->>'expected_row_budget')::integer,v_idempotency_key,'active',
    v_user_id,'user:'||v_user_id::text,'registry-artist-decouple-v1',
    'manage_registry',now(),now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  foreach v_target_id in array v_target_ids
  loop
    v_target_state:=platform_private.registry_subject_state_fingerprint(
      'artist',v_target_id
    );
    if v_target_state is null then
      raise exception using errcode='P0002',
        message='Exact Artist decouple target fingerprint is unavailable.';
    end if;

    insert into platform_private.registry_execution_grant_targets (
      execution_grant_id,subject_type,subject_id,expected_state_fingerprint
    )
    values (v_grant_id,'artist',v_target_id,v_target_state);
  end loop;

  if platform_private.registry_execution_target_set_fingerprint(v_grant_id)
     <>v_target_fingerprint
  then
    raise exception using errcode='23514',
      message='Artist decouple pre-insertion target fingerprint did not converge after sealing.';
  end if;

  return v_grant_id;
end
$$;

create function platform_private.issue_registry_artist_merge_grant_v1(
  p_evidence_assertion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_claim jsonb;
  v_source_artist_id uuid;
  v_canonical_artist_id uuid;
  v_target_ids uuid[];
  v_subject_types text[];
  v_target_fingerprint text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
  v_target_id uuid;
  v_target_state text;
begin
  v_user_id:=platform_private.registry_artist_merge_admin_current_user_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.artist.merge'
    and operation_type.operation_version=1
    and operation_type.capability_key='merge_registry_artist'
    and operation_type.enabled;

  if not found
     or v_operation_type.risk_class<>'critical'
     or v_operation_type.allowed_subject_types<>array['artist']::text[]
     or not v_operation_type.requires_existing_target
     or v_operation_type.max_targets<>2
     or v_operation_type.max_rows_ceiling<>1024
     or v_operation_type.max_grant_ttl_seconds<>300
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Artist merge typed operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.claim_key<>'registry.artist.merge'
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>'registry_artist_merge_admin'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound Artist merge authority.';
  end if;

  v_claim:=v_evidence.claim_payload;
  v_source_artist_id:=(v_claim->>'source_artist_id')::uuid;
  v_canonical_artist_id:=(v_claim->>'canonical_artist_id')::uuid;

  if v_claim->>'operation_key'<>'registry.artist.merge'
     or (v_claim->>'operation_version')::integer<>1
     or v_claim->>'policy_ruleset_version'<>'registry-artist-merge-v1'
     or v_evidence.subject_id<>v_source_artist_id
     or v_source_artist_id=v_canonical_artist_id
     or coalesce((v_claim->>'expected_row_budget')::integer,0) not between 1 and 1024
     or platform_private.registry_artist_merge_state_fingerprint_v1(
          v_source_artist_id,v_canonical_artist_id
        )<>v_claim->>'artist_merge_state_fingerprint'
     or platform_private.registry_plan_fingerprint(
          public.admin_get_registry_artist_merge_preview(
            v_source_artist_id,v_canonical_artist_id
          )
        )<>v_claim->>'preview_fingerprint'
  then
    raise exception using errcode='40001',
      message='WK_STALE_ARTIST_MERGE: safe Artist merge state changed before exact grant issuance.';
  end if;

  v_target_ids:=array(
    select target_id
    from unnest(array[v_source_artist_id,v_canonical_artist_id]) target(target_id)
    order by target_id
  );
  v_subject_types:=array_fill('artist'::text,array[2]);
  v_target_fingerprint:=platform_private.registry_exact_target_set_fingerprint_v1(
    v_subject_types,v_target_ids
  );

  v_plan:=v_claim||jsonb_build_object(
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'target_artist_ids',to_jsonb(v_target_ids)
  );
  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(v_plan);
  v_idempotency_key:='registry-artist-merge:'||v_evidence.assertion_fingerprint;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_artist_merge_admin'
    and execution_grant.operation_key='registry.artist.merge'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
       or v_existing.required_user_capability_key<>'manage_registry'
    then
      raise exception using errcode='23505',
        message='Artist merge idempotency key is bound to different authority.';
    end if;
    return v_existing.id;
  end if;

  insert into platform_private.registry_execution_grants (
    actor_key,capability_key,system_actor_capability_grant_id,operation_key,
    operation_version,plan_payload,plan_fingerprint,target_set_fingerprint,
    max_rows,idempotency_key,status,issued_by_user_id,issued_by_principal_key,
    policy_ruleset_version,required_user_capability_key,issued_at,expires_at
  )
  values (
    'registry_artist_merge_admin','merge_registry_artist',null,
    'registry.artist.merge',1,v_plan,v_plan_fingerprint,v_target_fingerprint,
    (v_claim->>'expected_row_budget')::integer,v_idempotency_key,'active',
    v_user_id,'user:'||v_user_id::text,'registry-artist-merge-v1',
    'manage_registry',now(),now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  foreach v_target_id in array v_target_ids
  loop
    v_target_state:=platform_private.registry_subject_state_fingerprint(
      'artist',v_target_id
    );
    if v_target_state is null then
      raise exception using errcode='P0002',
        message='Exact Artist merge target fingerprint is unavailable.';
    end if;

    insert into platform_private.registry_execution_grant_targets (
      execution_grant_id,subject_type,subject_id,expected_state_fingerprint
    )
    values (v_grant_id,'artist',v_target_id,v_target_state);
  end loop;

  if platform_private.registry_execution_target_set_fingerprint(v_grant_id)
     <>v_target_fingerprint
  then
    raise exception using errcode='23514',
      message='Artist merge pre-insertion target fingerprint did not converge after sealing.';
  end if;

  return v_grant_id;
end
$$;


-- Preserve both mature high-blast algorithms byte-for-byte at the function
-- body level by moving existing functions instead of recreating them.
alter function public.admin_decouple_registry_artist(
  uuid,jsonb,text,boolean,uuid
)
set schema platform_private;

alter function platform_private.admin_decouple_registry_artist(
  uuid,jsonb,text,boolean,uuid
)
rename to apply_registry_artist_decouple_engine_v1;

alter function public.admin_safe_merge_registry_artists(
  uuid,uuid,text,boolean,text
)
set schema platform_private;

alter function platform_private.admin_safe_merge_registry_artists(
  uuid,uuid,text,boolean,text
)
rename to apply_registry_artist_merge_engine_v1;

revoke all on function
  platform_private.apply_registry_artist_decouple_engine_v1(
    uuid,jsonb,text,boolean,uuid
  ),
  platform_private.apply_registry_artist_merge_engine_v1(
    uuid,uuid,text,boolean,text
  )
from public,anon,authenticated,service_role;

comment on function
  platform_private.apply_registry_artist_decouple_engine_v1(
    uuid,jsonb,text,boolean,uuid
  )
is
  'Owner-internal mature Artist credit-decouple engine. Product execution must use the reviewed exact-operation public decision command.';

comment on function
  platform_private.apply_registry_artist_merge_engine_v1(
    uuid,uuid,text,boolean,text
  )
is
  'Owner-internal mature archive-preserving safe Artist merge engine. Product execution must use the reviewed exact-operation public merge command.';

-- The old manual merge is destructive (duplicate credits are deleted) and has
-- no current repository/database dependency. Its retained migration remains
-- rollback source; the executable public road is retired here.
drop function public.admin_merge_registry_artists(uuid,uuid,text,boolean);

create function platform_private.execute_registry_artist_decouple_v1(
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_decision public.registry_artist_decouple_decisions%rowtype;
  v_source public.registry_artists%rowtype;
  v_source_artist_id uuid;
  v_replacement_ids uuid[];
  v_target_ids uuid[];
  v_target_slugs text[];
  v_track_ids uuid[];
  v_release_ids uuid[];
  v_state_fingerprint text;
  v_result jsonb;
  v_rows integer;
  v_existing_audit_ids uuid[];
  v_audit_id uuid;
  v_write_event_id uuid;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_artist_decouple_admin',
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay and v_operation.status='succeeded' then
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if not found
     or v_operation.status<>'authorized'
     or v_grant.actor_key<>'registry_artist_decouple_admin'
     or v_grant.capability_key<>'decouple_registry_artist'
     or v_grant.operation_key<>'registry.artist.decouple'
     or v_grant.operation_version<>1
     or v_grant.max_rows not between 1 and 10000
     or v_grant.policy_ruleset_version<>'registry-artist-decouple-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not Registry Artist Decouple V1 authority.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_source_artist_id:=(v_plan->>'source_artist_id')::uuid;

  select array_agg(item.value::uuid order by item.value)
  into v_replacement_ids
  from jsonb_array_elements_text(v_plan->'replacement_artist_ids') item(value);

  select array_agg(item.value::uuid order by item.value)
  into v_target_ids
  from jsonb_array_elements_text(v_plan->'target_artist_ids') item(value);

  select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
  into v_track_ids
  from jsonb_array_elements_text(coalesce(v_plan->'source_track_ids','[]'::jsonb)) item(value);

  select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
  into v_release_ids
  from jsonb_array_elements_text(coalesce(v_plan->'source_release_ids','[]'::jsonb)) item(value);

  if coalesce(cardinality(v_replacement_ids),0) not between 2 and 31
     or coalesce(cardinality(v_target_ids),0)<>cardinality(v_replacement_ids)+1
     or not (v_source_artist_id=any(v_target_ids))
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target
       where target.execution_grant_id=v_grant.id
     )<>cardinality(v_target_ids)
     or exists (
       select 1
       from unnest(v_target_ids) target_id
       where not exists (
         select 1
         from platform_private.registry_execution_grant_targets target
         where target.execution_grant_id=v_grant.id
           and target.subject_type='artist'
           and target.subject_id=target_id
           and target.expected_state_fingerprint is not null
       )
     )
  then
    raise exception using errcode='42501',
      message='Registry Artist Decouple V1 exact target authority drifted.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
    and assertion.subject_type='artist'
    and assertion.subject_id=v_source_artist_id
    and assertion.claim_key='registry.artist.decouple'
    and assertion.trust_class='INTERNAL_FACT'
    and assertion.source_kind='registry_artist_decouple_admin'
    and assertion.assertion_fingerprint=v_plan->>'evidence_assertion_fingerprint';

  if not found
     or v_evidence.recorded_by_principal_key<>v_grant.issued_by_principal_key
     or v_evidence.claim_payload->>'artist_decouple_state_fingerprint'<>
          v_plan->>'artist_decouple_state_fingerprint'
  then
    raise exception using errcode='42501',
      message='Bound Artist decouple evidence no longer satisfies the exact plan.';
  end if;

  select decision.*
  into v_decision
  from public.registry_artist_decouple_decisions decision
  where decision.id=(v_plan->>'decision_id')::uuid
  for update;

  if not found
     or v_decision.decision_status<>'ready'
     or v_decision.source_artist_id<>v_source_artist_id
  then
    raise exception using errcode='40001',
      message='WK_STALE_ARTIST_DECOUPLE: reviewed decision changed before execution.';
  end if;

  perform 1
  from public.registry_artists artist
  where artist.id=any(v_target_ids)
  order by artist.id
  for update;

  select artist.*
  into v_source
  from public.registry_artists artist
  where artist.id=v_source_artist_id;

  select array_agg(lower(artist.slug) order by artist.id)
  into v_target_slugs
  from public.registry_artists artist
  where artist.id=any(v_target_ids);

  perform 1
  from public.registry_track_artists credit
  where credit.track_id=any(v_track_ids)
    and (
      credit.artist_id=any(v_target_ids)
      or lower(coalesce(credit.artist_slug,''))=any(v_target_slugs)
    )
  order by credit.id
  for update;

  perform 1
  from public.registry_release_artists credit
  where credit.release_id=any(v_release_ids)
    and (
      credit.artist_id=any(v_target_ids)
      or lower(coalesce(credit.artist_slug,''))=any(v_target_slugs)
    )
  order by credit.id
  for update;

  perform 1
  from public.registry_tracks track
  where track.id=any(v_track_ids)
  order by track.id
  for update;

  perform 1
  from public.registry_artist_aliases alias_row
  where lower(alias_row.alias_slug)=lower(v_source.slug)
  order by alias_row.id
  for update;

  perform 1
  from public.wk_chart_entries_v2 chart_row
  where public.wk_slugify_text(coalesce(chart_row.artist_slug,''))=
          public.wk_slugify_text(v_source.slug)
     or public.wk_slugify_text(coalesce(chart_row.artist_name,''))=
          public.wk_slugify_text(v_source.display_name)
  order by chart_row.id
  for update;

  perform 1
  from public.chart_entries chart_row
  where public.wk_slugify_text(coalesce(chart_row.artist_slug,''))=
          public.wk_slugify_text(v_source.slug)
     or public.wk_slugify_text(coalesce(chart_row.artist_name,''))=
          public.wk_slugify_text(v_source.display_name)
  order by chart_row.id
  for update;

  v_state_fingerprint:=
    platform_private.registry_artist_decouple_state_fingerprint_v1(
      (v_plan->>'decision_id')::uuid
    );

  if v_state_fingerprint<>v_plan->>'artist_decouple_state_fingerprint' then
    raise exception using errcode='40001',
      message='WK_STALE_ARTIST_DECOUPLE: exact Artist split state changed after grant issuance.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  select coalesce(array_agg(audit.id order by audit.id),'{}'::uuid[])
  into v_existing_audit_ids
  from public.registry_audit_log audit
  where audit.action='artist_credit_decoupled'
    and audit.entity_type='registry_artist'
    and audit.entity_id=v_source_artist_id;

  v_result:=platform_private.apply_registry_artist_decouple_engine_v1(
    v_source_artist_id,
    v_plan->'selected_artists',
    nullif(v_plan->>'note',''),
    true,
    nullif(v_plan->>'chart_primary_artist_id','')::uuid
  );

  v_rows:=
      coalesce((v_result->>'trackCreditsInserted')::integer,0)
    + coalesce((v_result->>'trackCreditsArchived')::integer,0)
    + coalesce((v_result->>'releaseCreditsInserted')::integer,0)
    + coalesce((v_result->>'releaseCreditsArchived')::integer,0)
    + coalesce((v_result->>'chartEntriesV2Updated')::integer,0)
    + coalesce((v_result->>'chartEntriesRuntimeUpdated')::integer,0)
    + coalesce((v_result->>'trackMetadataRowsUpdated')::integer,0)
    + coalesce((v_result->>'aliasRowsBlocked')::integer,0)
    + cardinality(v_replacement_ids)
    + 2;

  if v_rows>v_grant.max_rows then
    raise exception using errcode='54000',
      message='Artist decouple exceeded its exact row budget.';
  end if;

  select audit.id
  into v_audit_id
  from public.registry_audit_log audit
  where audit.action='artist_credit_decoupled'
    and audit.entity_type='registry_artist'
    and audit.entity_id=v_source_artist_id
    and not (audit.id=any(v_existing_audit_ids))
  order by audit.created_at desc,audit.id desc
  limit 1;

  if v_audit_id is null then
    raise exception using errcode='23514',
      message='Mature Artist decouple engine did not emit its accepted audit event.';
  end if;

  insert into public.registry_canonical_write_events (
    registry_entity_type,registry_entity_id,source_suggestion_id,source_table,
    field_name,target_path,before_value,after_value,action,status,actor
  )
  values (
    'artist',v_source_artist_id::text,v_evidence.id::text,
    'platform_private.registry_evidence_assertions','artist_decouple',
    'public.registry_artists+registry_artist_aliases+registry_tracks+registry_track_artists+registry_release_artists+wk_chart_entries_v2+chart_entries',
    jsonb_build_object(
      'decision_id',v_plan->>'decision_id',
      'artist_decouple_state_fingerprint',v_plan->>'artist_decouple_state_fingerprint',
      'expected_row_budget',v_grant.max_rows,
      'replacement_artist_ids',v_plan->'replacement_artist_ids'
    ),
    v_result,
    'artist_decouple',
    'succeeded',
    'system:registry_artist_decouple_admin'
  )
  returning id into v_write_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  )
  values (v_operation.id,v_write_event_id);

  update platform_private.registry_mutation_operations
  set affected_rows=v_rows,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'evidence_assertion_id',v_evidence.id,
        'audit_event_id',v_audit_id,
        'canonical_write_event_id',v_write_event_id,
        'result',v_result
      ),
      completed_at=now(),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  return next;
end
$$;

create function platform_private.execute_registry_artist_merge_v1(
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_source public.registry_artists%rowtype;
  v_source_artist_id uuid;
  v_canonical_artist_id uuid;
  v_target_ids uuid[];
  v_track_ids uuid[];
  v_release_ids uuid[];
  v_track_metadata_ids uuid[];
  v_state_fingerprint text;
  v_result jsonb;
  v_rows integer;
  v_existing_event_ids uuid[];
  v_event_id uuid;
  v_write_event_id uuid;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_artist_merge_admin',
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay and v_operation.status='succeeded' then
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if not found
     or v_operation.status<>'authorized'
     or v_grant.actor_key<>'registry_artist_merge_admin'
     or v_grant.capability_key<>'merge_registry_artist'
     or v_grant.operation_key<>'registry.artist.merge'
     or v_grant.operation_version<>1
     or v_grant.max_rows not between 1 and 1024
     or v_grant.policy_ruleset_version<>'registry-artist-merge-v1'
     or v_grant.required_user_capability_key<>'manage_registry'
  then
    raise exception using errcode='42501',
      message='Execution grant is not Registry Artist Merge V1 authority.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_source_artist_id:=(v_plan->>'source_artist_id')::uuid;
  v_canonical_artist_id:=(v_plan->>'canonical_artist_id')::uuid;

  select array_agg(item.value::uuid order by item.value)
  into v_target_ids
  from jsonb_array_elements_text(v_plan->'target_artist_ids') item(value);

  select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
  into v_track_metadata_ids
  from jsonb_array_elements_text(coalesce(v_plan->'track_metadata_ids','[]'::jsonb)) item(value);

  if coalesce(cardinality(v_target_ids),0)<>2
     or not (v_source_artist_id=any(v_target_ids))
     or not (v_canonical_artist_id=any(v_target_ids))
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target
       where target.execution_grant_id=v_grant.id
     )<>2
  then
    raise exception using errcode='42501',
      message='Registry Artist Merge V1 exact target authority drifted.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
    and assertion.subject_type='artist'
    and assertion.subject_id=v_source_artist_id
    and assertion.claim_key='registry.artist.merge'
    and assertion.trust_class='INTERNAL_FACT'
    and assertion.source_kind='registry_artist_merge_admin'
    and assertion.assertion_fingerprint=v_plan->>'evidence_assertion_fingerprint';

  if not found
     or v_evidence.recorded_by_principal_key<>v_grant.issued_by_principal_key
     or v_evidence.claim_payload->>'artist_merge_state_fingerprint'<>
          v_plan->>'artist_merge_state_fingerprint'
  then
    raise exception using errcode='42501',
      message='Bound Artist merge evidence no longer satisfies the exact plan.';
  end if;

  perform 1
  from public.registry_artists artist
  where artist.id=any(v_target_ids)
  order by artist.id
  for update;

  select artist.*
  into v_source
  from public.registry_artists artist
  where artist.id=v_source_artist_id;

  select coalesce(array_agg(distinct credit.track_id order by credit.track_id),'{}'::uuid[])
  into v_track_ids
  from public.registry_track_artists credit
  where (
      credit.artist_id=v_source_artist_id
      or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
    )
    and coalesce(credit.status,'active')<>'archived'
    and credit.track_id is not null;

  select coalesce(array_agg(distinct credit.release_id order by credit.release_id),'{}'::uuid[])
  into v_release_ids
  from public.registry_release_artists credit
  where (
      credit.artist_id=v_source_artist_id
      or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
    )
    and coalesce(credit.status,'active')<>'archived'
    and credit.release_id is not null;

  perform 1
  from public.registry_artist_aliases alias_row
  where lower(alias_row.alias_slug)=lower(v_source.slug)
     or alias_row.canonical_artist_id=v_source_artist_id
  order by alias_row.id
  for update;

  perform 1
  from public.registry_track_artists credit
  where credit.track_id=any(v_track_ids)
    and (
      credit.artist_id=any(v_target_ids)
      or lower(coalesce(credit.artist_slug,'')) in (
        lower(v_source.slug),
        lower((select artist.slug from public.registry_artists artist where artist.id=v_canonical_artist_id))
      )
    )
  order by credit.id
  for update;

  perform 1
  from public.registry_release_artists credit
  where credit.release_id=any(v_release_ids)
    and (
      credit.artist_id=any(v_target_ids)
      or lower(coalesce(credit.artist_slug,'')) in (
        lower(v_source.slug),
        lower((select artist.slug from public.registry_artists artist where artist.id=v_canonical_artist_id))
      )
    )
  order by credit.id
  for update;

  perform 1
  from public.wk_chart_entries_v2 chart_row
  where chart_row.canonical_artist_id=v_source_artist_id::text
     or public.wk_slugify_text(coalesce(chart_row.artist_slug,''))=
          public.wk_slugify_text(v_source.slug)
     or public.wk_slugify_text(coalesce(chart_row.artist_name,''))=
          public.wk_slugify_text(v_source.display_name)
  order by chart_row.id
  for update;

  perform 1
  from public.registry_tracks track
  where track.id=any(v_track_metadata_ids)
  order by track.id
  for update;

  v_state_fingerprint:=
    platform_private.registry_artist_merge_state_fingerprint_v1(
      v_source_artist_id,v_canonical_artist_id
    );

  if v_state_fingerprint<>v_plan->>'artist_merge_state_fingerprint'
     or platform_private.registry_plan_fingerprint(
          public.admin_get_registry_artist_merge_preview(
            v_source_artist_id,v_canonical_artist_id
          )
        )<>v_plan->>'preview_fingerprint'
  then
    raise exception using errcode='40001',
      message='WK_STALE_ARTIST_MERGE: exact safe merge state changed after grant issuance.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  select coalesce(array_agg(event.id order by event.id),'{}'::uuid[])
  into v_existing_event_ids
  from public.registry_artist_resolution_events event
  where event.action='artist_merge'
    and event.source_artist_id=v_source_artist_id;

  v_result:=platform_private.apply_registry_artist_merge_engine_v1(
    v_source_artist_id,
    v_canonical_artist_id,
    nullif(v_plan->>'note',''),
    coalesce((v_plan->>'archive_source')::boolean,true),
    v_plan->>'merge_reason'
  );

  v_rows:=
      coalesce((v_result->>'aliasRowsTouched')::integer,0)
    + coalesce((v_result->>'existingAliasesRetargeted')::integer,0)
    + coalesce((v_result->>'trackArtistRowsMoved')::integer,0)
    + coalesce((v_result->>'trackArtistRowsArchived')::integer,0)
    + coalesce((v_result->>'releaseArtistRowsMoved')::integer,0)
    + coalesce((v_result->>'releaseArtistRowsArchived')::integer,0)
    + coalesce((v_result->>'chartEntriesUpdated')::integer,0)
    + coalesce((v_result->>'trackMetadataRowsUpdated')::integer,0)
    + 3;

  if v_rows>v_grant.max_rows then
    raise exception using errcode='54000',
      message='Safe Artist merge exceeded its exact row budget.';
  end if;

  select event.id
  into v_event_id
  from public.registry_artist_resolution_events event
  where event.action='artist_merge'
    and event.status='success'
    and event.source_artist_id=v_source_artist_id
    and not (event.id=any(v_existing_event_ids))
    and event.result->>'canonicalArtistId'=v_canonical_artist_id::text
  order by event.created_at desc,event.id desc
  limit 1;

  if v_event_id is null then
    raise exception using errcode='23514',
      message='Mature safe Artist merge engine did not emit its accepted resolution event.';
  end if;

  insert into public.registry_canonical_write_events (
    registry_entity_type,registry_entity_id,source_suggestion_id,source_table,
    field_name,target_path,before_value,after_value,action,status,actor
  )
  values (
    'artist',v_source_artist_id::text,v_evidence.id::text,
    'platform_private.registry_evidence_assertions','artist_merge',
    'public.registry_artists+registry_artist_aliases+registry_tracks+registry_track_artists+registry_release_artists+wk_chart_entries_v2',
    jsonb_build_object(
      'canonical_artist_id',v_canonical_artist_id::text,
      'artist_merge_state_fingerprint',v_plan->>'artist_merge_state_fingerprint',
      'preview_fingerprint',v_plan->>'preview_fingerprint',
      'expected_row_budget',v_grant.max_rows
    ),
    v_result,
    'artist_merge',
    'succeeded',
    'system:registry_artist_merge_admin'
  )
  returning id into v_write_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  )
  values (v_operation.id,v_write_event_id);

  update platform_private.registry_mutation_operations
  set affected_rows=v_rows,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'evidence_assertion_id',v_evidence.id,
        'resolution_event_id',v_event_id,
        'canonical_write_event_id',v_write_event_id,
        'result',v_result
      ),
      completed_at=now(),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  return next;
end
$$;

create function platform_private.verify_registry_artist_decouple_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_source public.registry_artists%rowtype;
  v_chart_primary public.registry_artists%rowtype;
  v_source_artist_id uuid;
  v_replacement_ids uuid[];
  v_track_ids uuid[];
  v_release_ids uuid[];
  v_chart_v2_ids text[];
  v_chart_runtime_ids uuid[];
  v_track_metadata_ids uuid[];
  v_source_alias_ids uuid[];
  v_audit_id uuid;
  v_event_count integer;
  v_valid_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_artist_decouple_admin'
     or v_operation.capability_key<>'decouple_registry_artist'
     or v_operation.operation_key<>'registry.artist.decouple'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Registry Artist Decouple V1 operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows<1
     or v_operation.affected_rows>v_operation.max_rows
  then
    v_failure:='operation_status_or_row_budget_mismatch';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null
     and (
       not found
       or v_grant.actor_key<>'registry_artist_decouple_admin'
       or v_grant.capability_key<>'decouple_registry_artist'
       or v_grant.operation_key<>'registry.artist.decouple'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>'registry-artist-decouple-v1'
       or v_grant.required_user_capability_key<>'manage_registry'
     )
  then
    v_failure:='execution_grant_missing_or_wrong_authority';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_source_artist_id:=(v_plan->>'source_artist_id')::uuid;

    select array_agg(item.value::uuid order by item.value)
    into v_replacement_ids
    from jsonb_array_elements_text(v_plan->'replacement_artist_ids') item(value);

    select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
    into v_track_ids
    from jsonb_array_elements_text(coalesce(v_plan->'source_track_ids','[]'::jsonb)) item(value);

    select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
    into v_release_ids
    from jsonb_array_elements_text(coalesce(v_plan->'source_release_ids','[]'::jsonb)) item(value);

    select coalesce(array_agg(item.value order by item.value),'{}'::text[])
    into v_chart_v2_ids
    from jsonb_array_elements_text(coalesce(v_plan->'chart_v2_ids','[]'::jsonb)) item(value);

    select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
    into v_chart_runtime_ids
    from jsonb_array_elements_text(coalesce(v_plan->'chart_runtime_ids','[]'::jsonb)) item(value);

    select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
    into v_track_metadata_ids
    from jsonb_array_elements_text(coalesce(v_plan->'track_metadata_ids','[]'::jsonb)) item(value);

    select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
    into v_source_alias_ids
    from jsonb_array_elements_text(coalesce(v_plan->'source_alias_ids','[]'::jsonb)) item(value);
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
      and assertion.subject_type='artist'
      and assertion.subject_id=v_source_artist_id
      and assertion.claim_key='registry.artist.decouple'
      and assertion.trust_class='INTERNAL_FACT'
      and assertion.source_kind='registry_artist_decouple_admin'
      and assertion.assertion_fingerprint=v_plan->>'evidence_assertion_fingerprint';

    if not found then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null then
    select artist.* into v_source
    from public.registry_artists artist
    where artist.id=v_source_artist_id;

    select artist.* into v_chart_primary
    from public.registry_artists artist
    where artist.id=nullif(
      v_operation.result_payload->'result'->>'chartPrimaryArtistId',
      ''
    )::uuid;

    if v_source.id is null or v_chart_primary.id is null then
      v_failure:='source_or_chart_primary_artist_missing';
    end if;
  end if;

  if v_failure is null
     and (
       v_source.status<>'archived'
       or coalesce(v_source.metadata->>'archived_by_artist_decouple','false')<>'true'
     )
  then
    v_failure:='source_artist_lifecycle_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_track_artists credit
       where (
           credit.artist_id=v_source_artist_id
           or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
         )
         and coalesce(credit.status,'shadow') in ('shadow','active','needs_review')
     )
  then
    v_failure:='live_source_track_credit_remains';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_release_artists credit
       where (
           credit.artist_id=v_source_artist_id
           or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
         )
         and coalesce(credit.status,'shadow') in ('shadow','active','needs_review')
     )
  then
    v_failure:='live_source_release_credit_remains';
  end if;

  if v_failure is null
     and exists (
       select 1
       from unnest(v_track_ids) track_id
       cross join lateral (
         select distinct on ((item.value->>'artist_id')::uuid)
           (item.value->>'artist_id')::uuid artist_id,
           coalesce(
             nullif(item.value->>'role',''),
             case
               when lower(coalesce(item.value->>'is_featured','false')) in ('true','1','yes')
               then 'featured_artist'
               else 'primary_artist'
             end
           ) role,
           coalesce(nullif(item.value->>'credit_order','')::integer,item.ordinality::integer) credit_order
         from jsonb_array_elements(v_plan->'selected_artists') with ordinality item(value,ordinality)
         where nullif(item.value->>'artist_id','') is not null
         order by (item.value->>'artist_id')::uuid,item.ordinality
       ) replacement
       where not exists (
         select 1
         from public.registry_track_artists credit
         where credit.track_id=track_id
           and credit.artist_id=replacement.artist_id
           and credit.role=replacement.role
           and credit.credit_order=replacement.credit_order
           and coalesce(credit.status,'shadow') in ('shadow','active','needs_review')
       )
     )
  then
    v_failure:='replacement_track_credit_missing';
  end if;

  if v_failure is null
     and exists (
       select 1
       from unnest(v_release_ids) release_id
       cross join lateral (
         select distinct on ((item.value->>'artist_id')::uuid)
           (item.value->>'artist_id')::uuid artist_id,
           coalesce(
             nullif(item.value->>'role',''),
             case
               when lower(coalesce(item.value->>'is_featured','false')) in ('true','1','yes')
               then 'featured_artist'
               else 'primary_artist'
             end
           ) role,
           coalesce(nullif(item.value->>'credit_order','')::integer,item.ordinality::integer) credit_order
         from jsonb_array_elements(v_plan->'selected_artists') with ordinality item(value,ordinality)
         where nullif(item.value->>'artist_id','') is not null
         order by (item.value->>'artist_id')::uuid,item.ordinality
       ) replacement
       where not exists (
         select 1
         from public.registry_release_artists credit
         where credit.release_id=release_id
           and credit.artist_id=replacement.artist_id
           and credit.role=replacement.role
           and credit.credit_order=replacement.credit_order
           and coalesce(credit.status,'shadow') in ('shadow','active','needs_review')
       )
     )
  then
    v_failure:='replacement_release_credit_missing';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.wk_chart_entries_v2 chart_row
       where chart_row.id=any(v_chart_v2_ids)
         and (
           chart_row.artist_slug is distinct from v_chart_primary.slug
           or chart_row.artist_name is distinct from v_chart_primary.display_name
         )
     )
  then
    v_failure:='chart_v2_projection_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.chart_entries chart_row
       where chart_row.id=any(v_chart_runtime_ids)
         and (
           chart_row.artist_slug is distinct from v_chart_primary.slug
           or chart_row.artist_name is distinct from v_chart_primary.display_name
         )
     )
  then
    v_failure:='runtime_chart_projection_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_tracks track
       where track.id=any(v_track_metadata_ids)
         and track.metadata->>'primary_artist_slug' is distinct from v_chart_primary.slug
     )
  then
    v_failure:='track_metadata_projection_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_artist_aliases alias_row
       where alias_row.id=any(v_source_alias_ids)
         and alias_row.status is distinct from 'blocked'
     )
  then
    v_failure:='source_alias_not_blocked';
  end if;

  if v_failure is null
     and exists (
       select 1
       from unnest(v_replacement_ids) replacement_id
       where not exists (
         select 1
         from public.registry_artists artist
         where artist.id=replacement_id
           and artist.metadata->>'decoupled_from_combined_artist_id'=v_source_artist_id::text
       )
     )
  then
    v_failure:='replacement_artist_metadata_mismatch';
  end if;

  if v_failure is null then
    v_audit_id:=nullif(v_operation.result_payload->>'audit_event_id','')::uuid;

    if not exists (
      select 1
      from public.registry_audit_log audit
      where audit.id=v_audit_id
        and audit.action='artist_credit_decoupled'
        and audit.entity_type='registry_artist'
        and audit.entity_id=v_source_artist_id
    ) then
      v_failure:='artist_decouple_audit_event_missing';
    end if;
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_identity_lineage lineage
       where lineage.entity_type='artist'
         and lineage.source_entity_id=v_source_artist_id
         and lineage.transition_type='split'
         and lineage.successor_entity_ids @> v_replacement_ids
         and lineage.source_authority='registry_audit_log:artist_credit_decoupled'
         and lineage.source_record_id=v_audit_id::text
     )
  then
    v_failure:='artist_split_lineage_missing';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    where link.operation_id=v_operation.id;

    select count(*)::integer
    into v_valid_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='artist'
      and event.registry_entity_id=v_source_artist_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name='artist_decouple'
      and event.action='artist_decouple'
      and event.status='succeeded'
      and event.actor='system:registry_artist_decouple_admin';

    if v_event_count<>1 or v_valid_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=result_payload||jsonb_build_object(
          'verification',jsonb_build_object(
            'status','passed','verified_at',now(),'audit_event_id',v_audit_id
          )
        ),
        updated_at=now()
    where id=v_operation.id;

    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set verifier_status='failed',
      error_code='registry_artist_decouple_verification_failed',
      error_message=v_failure,
      result_payload=result_payload||jsonb_build_object(
        'verification',jsonb_build_object(
          'status','failed','reason',v_failure,'verified_at',now()
        )
      ),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;

create function platform_private.verify_registry_artist_merge_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_source public.registry_artists%rowtype;
  v_canonical public.registry_artists%rowtype;
  v_source_artist_id uuid;
  v_canonical_artist_id uuid;
  v_track_metadata_ids uuid[];
  v_event_id uuid;
  v_event public.registry_artist_resolution_events%rowtype;
  v_event_count integer;
  v_valid_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_artist_merge_admin'
     or v_operation.capability_key<>'merge_registry_artist'
     or v_operation.operation_key<>'registry.artist.merge'
     or v_operation.operation_version<>1
  then
    raise exception using errcode='P0002',
      message='Registry Artist Merge V1 operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows<1
     or v_operation.affected_rows>v_operation.max_rows
  then
    v_failure:='operation_status_or_row_budget_mismatch';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null
     and (
       not found
       or v_grant.actor_key<>'registry_artist_merge_admin'
       or v_grant.capability_key<>'merge_registry_artist'
       or v_grant.operation_key<>'registry.artist.merge'
       or v_grant.operation_version<>1
       or v_grant.policy_ruleset_version<>'registry-artist-merge-v1'
       or v_grant.required_user_capability_key<>'manage_registry'
     )
  then
    v_failure:='execution_grant_missing_or_wrong_authority';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_source_artist_id:=(v_plan->>'source_artist_id')::uuid;
    v_canonical_artist_id:=(v_plan->>'canonical_artist_id')::uuid;

    select coalesce(array_agg(item.value::uuid order by item.value),'{}'::uuid[])
    into v_track_metadata_ids
    from jsonb_array_elements_text(coalesce(v_plan->'track_metadata_ids','[]'::jsonb)) item(value);
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
      and assertion.subject_type='artist'
      and assertion.subject_id=v_source_artist_id
      and assertion.claim_key='registry.artist.merge'
      and assertion.trust_class='INTERNAL_FACT'
      and assertion.source_kind='registry_artist_merge_admin'
      and assertion.assertion_fingerprint=v_plan->>'evidence_assertion_fingerprint';

    if not found then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null then
    select artist.* into v_source
    from public.registry_artists artist
    where artist.id=v_source_artist_id;

    select artist.* into v_canonical
    from public.registry_artists artist
    where artist.id=v_canonical_artist_id;

    if v_source.id is null or v_canonical.id is null then
      v_failure:='source_or_canonical_artist_missing';
    end if;
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_artist_aliases alias_row
       where lower(alias_row.alias_slug)=lower(v_source.slug)
         and alias_row.canonical_artist_id is distinct from v_canonical_artist_id
     )
  then
    v_failure:='source_alias_not_canonicalized';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_artist_aliases alias_row
       where alias_row.canonical_artist_id=v_source_artist_id
     )
  then
    v_failure:='alias_still_targets_source_artist';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_track_artists credit
       where (
           credit.artist_id=v_source_artist_id
           or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
         )
         and coalesce(credit.status,'active')<>'archived'
     )
  then
    v_failure:='live_source_track_credit_remains';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_release_artists credit
       where (
           credit.artist_id=v_source_artist_id
           or lower(coalesce(credit.artist_slug,''))=lower(v_source.slug)
         )
         and coalesce(credit.status,'active')<>'archived'
     )
  then
    v_failure:='live_source_release_credit_remains';
  end if;

  if v_failure is null then
    v_event_id:=nullif(v_operation.result_payload->>'resolution_event_id','')::uuid;

    select event.*
    into v_event
    from public.registry_artist_resolution_events event
    where event.id=v_event_id
      and event.action='artist_merge'
      and event.status='success'
      and event.source_artist_id=v_source_artist_id
      and event.result->>'canonicalArtistId'=v_canonical_artist_id::text;

    if not found then
      v_failure:='artist_merge_resolution_event_mismatch';
    end if;
  end if;

  if v_failure is null
     and exists (
       select 1
       from jsonb_array_elements(coalesce(v_event.track_links,'[]'::jsonb)) link(value)
       where nullif(link.value->>'credit_id','') is not null
         and (
           (
             coalesce((link.value->>'will_archive_duplicate')::boolean,false)
             and not exists (
               select 1 from public.registry_track_artists credit
               where credit.id=(link.value->>'credit_id')::uuid
                 and credit.status='archived'
             )
           )
           or
           (
             not coalesce((link.value->>'will_archive_duplicate')::boolean,false)
             and not exists (
               select 1 from public.registry_track_artists credit
               where credit.id=(link.value->>'credit_id')::uuid
                 and credit.artist_id=v_canonical_artist_id
                 and coalesce(credit.status,'active')<>'archived'
             )
           )
         )
     )
  then
    v_failure:='track_credit_merge_postcondition_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from jsonb_array_elements(coalesce(v_event.release_links,'[]'::jsonb)) link(value)
       where nullif(link.value->>'credit_id','') is not null
         and (
           (
             coalesce((link.value->>'will_archive_duplicate')::boolean,false)
             and not exists (
               select 1 from public.registry_release_artists credit
               where credit.id=(link.value->>'credit_id')::uuid
                 and credit.status='archived'
             )
           )
           or
           (
             not coalesce((link.value->>'will_archive_duplicate')::boolean,false)
             and not exists (
               select 1 from public.registry_release_artists credit
               where credit.id=(link.value->>'credit_id')::uuid
                 and credit.artist_id=v_canonical_artist_id
                 and coalesce(credit.status,'active')<>'archived'
             )
           )
         )
     )
  then
    v_failure:='release_credit_merge_postcondition_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from jsonb_array_elements(coalesce(v_event.chart_entries,'[]'::jsonb)) item(value)
       where nullif(item.value->>'entry_id','') is not null
         and not exists (
           select 1
           from public.wk_chart_entries_v2 chart_row
           where chart_row.id=item.value->>'entry_id'
             and chart_row.canonical_artist_id=v_canonical_artist_id::text
             and chart_row.artist_slug=v_canonical.slug
             and chart_row.artist_name=v_canonical.display_name
         )
     )
  then
    v_failure:='chart_projection_merge_postcondition_mismatch';
  end if;

  if v_failure is null
     and exists (
       select 1
       from public.registry_tracks track
       where track.id=any(v_track_metadata_ids)
         and track.metadata->>'primary_artist_slug' is distinct from v_canonical.slug
     )
  then
    v_failure:='track_metadata_merge_projection_mismatch';
  end if;

  if v_failure is null
     and coalesce((v_plan->>'archive_source')::boolean,true)
     and (
       v_source.status<>'archived'
       or coalesce(v_source.metadata->>'archived_by_safe_artist_merge','false')<>'true'
     )
  then
    v_failure:='source_artist_archive_postcondition_mismatch';
  end if;

  if v_failure is null
     and v_canonical.metadata->>'safe_merge_source_artist_id' is distinct from
         v_source_artist_id::text
  then
    v_failure:='canonical_artist_merge_metadata_mismatch';
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_identity_lineage lineage
       where lineage.entity_type='artist'
         and lineage.source_entity_id=v_source_artist_id
         and lineage.transition_type='merge'
         and lineage.successor_entity_ids @> array[v_canonical_artist_id]::uuid[]
         and lineage.source_authority='registry_artist_resolution_events'
         and lineage.source_record_id=v_event_id::text
     )
  then
    v_failure:='artist_merge_lineage_missing';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
    from platform_private.registry_operation_write_events link
    where link.operation_id=v_operation.id;

    select count(*)::integer
    into v_valid_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='artist'
      and event.registry_entity_id=v_source_artist_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.field_name='artist_merge'
      and event.action='artist_merge'
      and event.status='succeeded'
      and event.actor='system:registry_artist_merge_admin';

    if v_event_count<>1 or v_valid_event_count<>1 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=result_payload||jsonb_build_object(
          'verification',jsonb_build_object(
            'status','passed','verified_at',now(),'resolution_event_id',v_event_id
          )
        ),
        updated_at=now()
    where id=v_operation.id;

    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set verifier_status='failed',
      error_code='registry_artist_merge_verification_failed',
      error_message=v_failure,
      result_payload=result_payload||jsonb_build_object(
        'verification',jsonb_build_object(
          'status','failed','reason',v_failure,'verified_at',now()
        )
      ),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end
$$;

create or replace function public.admin_apply_artist_decouple_decision(
  p_decision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_decision public.registry_artist_decouple_decisions%rowtype;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_result jsonb;
begin
  v_user_id:=platform_private.registry_artist_decouple_admin_current_user_v1();

  select decision.*
  into v_decision
  from public.registry_artist_decouple_decisions decision
  where decision.id=p_decision_id
  for update;

  if not found then
    raise exception 'decouple_decision_not_found';
  end if;

  if v_decision.decision_status='applied' then
    return coalesce(v_decision.apply_result_json,'{}'::jsonb);
  end if;

  v_evidence_id:=
    platform_private.record_registry_artist_decouple_evidence_v1(p_decision_id);

  v_grant_id:=
    platform_private.issue_registry_artist_decouple_grant_v1(v_evidence_id);

  select *
  into v_execution
  from platform_private.execute_registry_artist_decouple_v1(v_grant_id);

  select *
  into v_verification
  from platform_private.verify_registry_artist_decouple_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='P0001',
      message='WK_ARTIST_DECOUPLE_VERIFIER_FAILED: independent verification failed.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_execution.operation_id;

  v_result:=coalesce(v_operation.result_payload->'result','{}'::jsonb);

  update public.registry_artist_decouple_decisions
  set decision_status='applied',
      applied_at=now(),
      apply_result_json=v_result,
      updated_at=now()
  where id=p_decision_id
    and decision_status='ready';

  if not found then
    raise exception using errcode='40001',
      message='WK_STALE_ARTIST_DECOUPLE: decision changed before final apply seal.';
  end if;

  return v_result;
end
$$;

create function public.admin_safe_merge_registry_artists(
  p_source_artist_id uuid,
  p_canonical_artist_id uuid,
  p_note text default null,
  p_archive_source boolean default true,
  p_merge_reason text default 'same_person'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_result jsonb;
begin
  v_user_id:=platform_private.registry_artist_merge_admin_current_user_v1();

  v_evidence_id:=
    platform_private.record_registry_artist_merge_evidence_v1(
      p_source_artist_id,
      p_canonical_artist_id,
      p_note,
      p_archive_source,
      p_merge_reason
    );

  v_grant_id:=
    platform_private.issue_registry_artist_merge_grant_v1(v_evidence_id);

  select *
  into v_execution
  from platform_private.execute_registry_artist_merge_v1(v_grant_id);

  select *
  into v_verification
  from platform_private.verify_registry_artist_merge_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='P0001',
      message='WK_ARTIST_MERGE_VERIFIER_FAILED: independent verification failed.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_execution.operation_id;

  v_result:=coalesce(v_operation.result_payload->'result','{}'::jsonb);
  return v_result;
end
$$;

revoke all on function
  platform_private.registry_exact_target_set_fingerprint_v1(text[],uuid[]),
  platform_private.registry_artist_decouple_admin_current_user_v1(),
  platform_private.registry_artist_merge_admin_current_user_v1(),
  platform_private.registry_artist_decouple_state_fingerprint_v1(uuid),
  platform_private.registry_artist_merge_state_fingerprint_v1(uuid,uuid),
  platform_private.record_registry_artist_decouple_evidence_v1(uuid),
  platform_private.record_registry_artist_merge_evidence_v1(uuid,uuid,text,boolean,text),
  platform_private.issue_registry_artist_decouple_grant_v1(uuid),
  platform_private.issue_registry_artist_merge_grant_v1(uuid),
  platform_private.execute_registry_artist_decouple_v1(uuid),
  platform_private.execute_registry_artist_merge_v1(uuid),
  platform_private.verify_registry_artist_decouple_v1(uuid),
  platform_private.verify_registry_artist_merge_v1(uuid),
  platform_private.apply_registry_artist_decouple_engine_v1(uuid,jsonb,text,boolean,uuid),
  platform_private.apply_registry_artist_merge_engine_v1(uuid,uuid,text,boolean,text)
from public,anon,authenticated,service_role;

revoke all on function
  public.admin_apply_artist_decouple_decision(uuid),
  public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)
from public,anon,service_role;

grant execute on function
  public.admin_apply_artist_decouple_decision(uuid),
  public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)
to authenticated;

comment on function public.admin_apply_artist_decouple_decision(uuid)
is
  'Governed human Artist decouple decision command. Preserves the reviewed domain decision, freezes exact Artist/current-state authority, executes the private mature engine, and requires independent verification.';

comment on function public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)
is
  'Governed human safe Artist merge command. Freezes exact source/canonical state, executes the private mature archive-preserving merge engine, and requires independent verification.';

do $proof$
declare
  v_wrapper text;
begin
  if to_regprocedure('public.admin_merge_registry_artists(uuid,uuid,text,boolean)') is not null then
    raise exception 'Old destructive manual Artist merge executable authority was not retired';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='platform_private'
      and p.proname='apply_registry_artist_decouple_engine_v1'
      and pg_get_function_identity_arguments(p.oid)=
          'p_source_artist_id uuid, p_replacements jsonb, p_note text, p_archive_source boolean, p_chart_primary_artist_id uuid'
  )<>'bf2e8410e11af4207d064a800b7405045098ea0442742941a4fe5f55d026463e'
  then
    raise exception 'Mature Artist decouple engine body hash changed during internalization';
  end if;

  if (
    select encode(extensions.digest(p.prosrc,'sha256'),'hex')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='platform_private'
      and p.proname='apply_registry_artist_merge_engine_v1'
      and pg_get_function_identity_arguments(p.oid)=
          'p_source_artist_id uuid, p_canonical_artist_id uuid, p_note text, p_archive_source boolean, p_merge_reason text'
  )<>'c5a595d6cd76da5df7d92d7e54449a270a3423cfffc8d8b0ce67eb85af3fd075'
  then
    raise exception 'Mature safe Artist merge engine body hash changed during internalization';
  end if;

  if not exists (
    select 1 from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.artist.decouple'
      and operation_type.operation_version=1
      and operation_type.capability_key='decouple_registry_artist'
      and operation_type.risk_class='critical'
      and operation_type.max_targets=32
      and operation_type.max_rows_ceiling=10000
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) or not exists (
    select 1 from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.artist.merge'
      and operation_type.operation_version=1
      and operation_type.capability_key='merge_registry_artist'
      and operation_type.risk_class='critical'
      and operation_type.max_targets=2
      and operation_type.max_rows_ceiling=1024
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Tranche B Artist typed operation contract drifted';
  end if;

  if has_function_privilege(
       'anon','public.admin_apply_artist_decouple_decision(uuid)','EXECUTE'
     )
     or has_function_privilege(
       'service_role','public.admin_apply_artist_decouple_decision(uuid)','EXECUTE'
     )
     or not has_function_privilege(
       'authenticated','public.admin_apply_artist_decouple_decision(uuid)','EXECUTE'
     )
     or has_function_privilege(
       'anon','public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)','EXECUTE'
     )
     or has_function_privilege(
       'service_role','public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)','EXECUTE'
     )
     or not has_function_privilege(
       'authenticated','public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)','EXECUTE'
     )
  then
    raise exception 'Tranche B Artist public command grant boundary drifted';
  end if;

  if has_function_privilege(
       'anon','platform_private.apply_registry_artist_decouple_engine_v1(uuid,jsonb,text,boolean,uuid)','EXECUTE'
     )
     or has_function_privilege(
       'authenticated','platform_private.apply_registry_artist_decouple_engine_v1(uuid,jsonb,text,boolean,uuid)','EXECUTE'
     )
     or has_function_privilege(
       'service_role','platform_private.apply_registry_artist_decouple_engine_v1(uuid,jsonb,text,boolean,uuid)','EXECUTE'
     )
     or has_function_privilege(
       'anon','platform_private.apply_registry_artist_merge_engine_v1(uuid,uuid,text,boolean,text)','EXECUTE'
     )
     or has_function_privilege(
       'authenticated','platform_private.apply_registry_artist_merge_engine_v1(uuid,uuid,text,boolean,text)','EXECUTE'
     )
     or has_function_privilege(
       'service_role','platform_private.apply_registry_artist_merge_engine_v1(uuid,uuid,text,boolean,text)','EXECUTE'
     )
  then
    raise exception 'Tranche B private mature engine leaked client/service execution';
  end if;

  select lower(pg_get_functiondef(
    'public.admin_apply_artist_decouple_decision(uuid)'::regprocedure
  )) into v_wrapper;

  if v_wrapper ~
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_(artists|artist_aliases|tracks|track_artists|release_artists)|wk_chart_entries_v2|chart_entries)'
     or position('record_registry_artist_decouple_evidence_v1' in v_wrapper)=0
     or position('issue_registry_artist_decouple_grant_v1' in v_wrapper)=0
     or position('execute_registry_artist_decouple_v1' in v_wrapper)=0
     or position('verify_registry_artist_decouple_v1' in v_wrapper)=0
  then
    raise exception 'Artist decouple public command bypasses exact reviewed authority';
  end if;

  select lower(pg_get_functiondef(
    'public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)'::regprocedure
  )) into v_wrapper;

  if v_wrapper ~
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[[:space:]]+public[.](registry_(artists|artist_aliases|tracks|track_artists|release_artists)|wk_chart_entries_v2|chart_entries)'
     or position('record_registry_artist_merge_evidence_v1' in v_wrapper)=0
     or position('issue_registry_artist_merge_grant_v1' in v_wrapper)=0
     or position('execute_registry_artist_merge_v1' in v_wrapper)=0
     or position('verify_registry_artist_merge_v1' in v_wrapper)=0
  then
    raise exception 'Safe Artist merge public command bypasses exact reviewed authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key in (
      'registry_artist_decouple_admin','registry_artist_merge_admin'
    )
  ) or exists (
    select 1
    from platform_private.registry_mutation_operations operation_row
    where operation_row.actor_key in (
      'registry_artist_decouple_admin','registry_artist_merge_admin'
    )
  ) then
    raise exception 'Tranche B Artist migration activated durable execution residue';
  end if;
end
$proof$;

commit;
