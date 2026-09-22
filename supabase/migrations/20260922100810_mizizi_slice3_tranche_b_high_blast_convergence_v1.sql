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
  16384,
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

  if v_row_budget<1 or v_row_budget>16384 then
    raise exception using errcode='54000',
      message='Artist decouple exceeds the 16384-row exact operation ceiling.';
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
     or v_operation_type.max_rows_ceiling<>16384
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
     or coalesce((v_claim->>'expected_row_budget')::integer,0) not between 1 and 16384
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
