-- WAKILISHA / MIZIZI Slice 3 / #962
-- Stage A: inert narrow Production executor foundation.
--
-- This migration deliberately does NOT:
--   * switch the active MIZIZI executor away from postgres;
--   * seed a standing MIZIZI capability grant;
--   * seed an exact execution grant;
--   * enable a new Registry mutation operation;
--   * mutate canonical Registry/Chart data.
--
-- It installs the role/schema/typed-operation boundary required for a later
-- separately accepted runtime cutover.

begin;

do $preflight$
begin
  if not exists (
    select 1
    from platform_private.system_actors
    where actor_key='mizizi'
      and status='active'
  ) then
    raise exception 'STOP: active MIZIZI System Actor is missing';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='active'
  ) then
    raise exception 'STOP: audited active MIZIZI postgres executor binding is missing';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from <= now()
      and expires_at > now()
  ) then
    raise exception 'STOP: Stage A requires zero active MIZIZI standing grants';
  end if;

  if exists (
    select 1
    from pg_roles
    where rolname='mizizi_executor'
  ) then
    raise exception 'STOP: mizizi_executor role already exists before Stage A';
  end if;
end
$preflight$;

revoke execute on function
  public.increment_share_count(text,text),
  public.increment_share_count(text,text,text,text),
  public.track_analytics_event(text,text,text,text,text,jsonb,text,uuid,text)
from public;

grant execute on function
  public.increment_share_count(text,text),
  public.increment_share_count(text,text,text,text),
  public.track_analytics_event(text,text,text,text,text,jsonb,text,uuid,text)
to anon, authenticated, service_role;

create role mizizi_executor
  login
  noinherit
  nosuperuser
  nocreatedb
  nocreaterole
  noreplication
  nobypassrls;

comment on role mizizi_executor is
  'WAKILISHA MIZIZI narrow JIT executor. No direct table authority; exact private broker execution only.';

create schema mizizi_private authorization postgres;
revoke all on schema mizizi_private from public, anon, authenticated, service_role;
grant usage on schema mizizi_private to mizizi_executor;

alter default privileges for role postgres in schema mizizi_private
  revoke execute on functions from public;

insert into platform_private.system_actor_executor_bindings (
  actor_key,
  executor_kind,
  executor_key,
  status
)
values (
  'mizizi',
  'database_role',
  'mizizi_executor',
  'disabled'
);

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'repair_registry_release_taxonomy',
    'Repair Registry Release taxonomy',
    'Allow MIZIZI to apply one server-derived Release taxonomy correction from the exact active Track membership count.',
    'registry'
  ),
  (
    'synchronize_chart_track_slug',
    'Synchronize Chart Track slug',
    'Allow MIZIZI to synchronize one Chart projection Track slug from its exact canonical Registry Track identity.',
    'registry'
  );

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
    'registry.release_taxonomy.repair',
    1,
    'repair_registry_release_taxonomy',
    'low',
    array['release']::text[],
    true,
    1,
    1,
    300,
    false,
    true,
    false,
    'Repair one active Release taxonomy value from the exact count of active Tracks in canonical Release membership.'
  ),
  (
    'registry.chart_track_slug.synchronize',
    1,
    'synchronize_chart_track_slug',
    'low',
    array['track']::text[],
    true,
    1,
    1,
    300,
    false,
    true,
    false,
    'Synchronize one Chart projection Track slug to the slug of its exact canonical Registry Track.'
  );

create function mizizi_private.assert_executor_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $$
begin
  if session_user <> 'mizizi_executor' then
    raise exception
      using errcode='42501',
            message='mizizi_executor session is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='mizizi'
      and actor.status='active'
  ) then
    raise exception
      using errcode='42501',
            message='MIZIZI System Actor is not active.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='mizizi'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception
      using errcode='42501',
            message='Current executor is not the active MIZIZI binding.';
  end if;
end
$$;

create function mizizi_private.release_taxonomy_plan_v1(
  p_release_id uuid
)
returns table (
  release_id uuid,
  current_release_type text,
  active_track_count integer,
  proposed_release_type text,
  expected_state_fingerprint text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_release public.registry_releases%rowtype;
  v_count integer;
  v_proposed text;
begin
  perform mizizi_private.assert_executor_v1();

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=p_release_id
    and release.status='active';

  if not found then
    raise exception using errcode='P0002',
      message='Active Registry Release not found.';
  end if;

  select count(*)::integer
  into v_count
  from public.registry_release_tracks membership
  join public.registry_tracks track
    on track.id=membership.track_id
   and track.status='active'
  where membership.release_id=v_release.id
    and membership.status='active';

  v_proposed := case
    when v_count < 1 then null
    when v_count = 1 then 'single'
    when v_count <= 6 then 'ep'
    else 'album'
  end;

  release_id := v_release.id;
  current_release_type := v_release.release_type;
  active_track_count := v_count;
  proposed_release_type := v_proposed;
  expected_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint('release',v_release.id);
  return next;
end
$$;

create function mizizi_private.chart_track_slug_plan_v1(
  p_chart_entry_id text
)
returns table (
  chart_entry_id text,
  canonical_track_id uuid,
  current_track_slug text,
  canonical_track_slug text,
  expected_track_state_fingerprint text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_entry record;
  v_track public.registry_tracks%rowtype;
begin
  perform mizizi_private.assert_executor_v1();

  select entry.id,entry.track_slug,entry.canonical_track_id
  into v_entry
  from public.wk_chart_entries_v2 entry
  where entry.id=p_chart_entry_id;

  if not found
     or nullif(btrim(v_entry.canonical_track_id),'') is null
     or v_entry.canonical_track_id !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then
    raise exception using errcode='42501',
      message='Chart entry has no exact canonical Track identity.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=v_entry.canonical_track_id::uuid
    and track.status='active';

  if not found then
    raise exception using errcode='42501',
      message='Chart entry canonical Track is not active.';
  end if;

  chart_entry_id := v_entry.id;
  canonical_track_id := v_track.id;
  current_track_slug := v_entry.track_slug;
  canonical_track_slug := v_track.slug;
  expected_track_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint('track',v_track.id);
  return next;
end
$$;

create function mizizi_private.finding_fingerprint_v1(
  p_rule_id text,
  p_rule_version text,
  p_entity_type text,
  p_entity_id text,
  p_field_name text,
  p_current_value text,
  p_proposed_value text
)
returns text
language sql
immutable
strict
set search_path = pg_catalog, extensions
as $$
  select encode(
    extensions.digest(
      (
        '{"agent":' || to_json('mizizi'::text)::text ||
        ',"ruleId":' || to_json(p_rule_id)::text ||
        ',"ruleVersion":' || to_json(p_rule_version)::text ||
        ',"entityType":' || to_json(p_entity_type)::text ||
        ',"entityId":' || to_json(p_entity_id)::text ||
        ',"fieldName":' || to_json(p_field_name)::text ||
        ',"currentValue":' || to_json(p_current_value)::text ||
        ',"proposedValue":' || to_json(p_proposed_value)::text ||
        '}'
      )::bytea,
      'sha256'
    ),
    'hex'
  )
$$;

create function mizizi_private.queue_registry_review_v1(
  p_entity_type text,
  p_entity_id text,
  p_fingerprint text,
  p_rule_id text,
  p_rule_version text,
  p_field_name text,
  p_current_value text,
  p_proposed_value text,
  p_confidence numeric,
  p_severity text,
  p_reason text,
  p_evidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, mizizi_private
as $$
declare
  v_review_id uuid;
  v_source_table text;
  v_title text;
  v_live_current text;
  v_expected_fingerprint text;
begin
  perform mizizi_private.assert_executor_v1();

  if p_entity_id !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_rule_version <> '1.2.0'
     or not (
       (
         p_entity_type='track'
         and p_rule_id='track_slug_identity_noise'
         and p_field_name='slug'
       )
       or
       (
         p_entity_type='release'
         and p_rule_id='release_slug_provider_packaging'
         and p_field_name='slug'
       )
     )
     or nullif(btrim(p_current_value),'') is null
     or nullif(btrim(p_proposed_value),'') is null
     or p_current_value=p_proposed_value
     or p_proposed_value !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or octet_length(p_proposed_value) > 240
     or p_confidence < 0 or p_confidence > 1
     or p_severity <> 'high'
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason) > 2000
     or jsonb_typeof(coalesce(p_evidence,'{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_evidence,'{}'::jsonb)::text) > 16384
  then
    raise exception using errcode='22023',
      message='Invalid bounded MIZIZI slug review payload.';
  end if;

  if p_entity_type='track' then
    select track.slug
    into v_live_current
    from public.registry_tracks track
    where track.id=p_entity_id::uuid
      and track.status='active';

    v_source_table := 'registry_tracks';
    v_title := 'MIZIZI found Track data that needs review';
  else
    select release.slug
    into v_live_current
    from public.registry_releases release
    where release.id=p_entity_id::uuid
      and release.status='active';

    v_source_table := 'registry_releases';
    v_title := 'MIZIZI found Release data that needs review';
  end if;

  if not found or v_live_current is distinct from p_current_value then
    raise exception using errcode='40001',
      message='MIZIZI review target changed since analysis.';
  end if;

  v_expected_fingerprint :=
    mizizi_private.finding_fingerprint_v1(
      p_rule_id,
      p_rule_version,
      p_entity_type,
      p_entity_id,
      p_field_name,
      p_current_value,
      p_proposed_value
    );

  if v_expected_fingerprint <> p_fingerprint then
    raise exception using errcode='42501',
      message='MIZIZI review fingerprint does not match deterministic finding identity.';
  end if;

  select review.id
  into v_review_id
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.status <> 'resolved'
    and review.entity_type=p_entity_type
    and review.source_id=p_entity_id
    and review.source_payload->>'ruleId'=p_rule_id
  order by review.created_at,review.id
  limit 1
  for update;

  if found then
    return v_review_id;
  end if;

  insert into public.registry_review_items (
    review_key,
    entity_type,
    entity_id,
    review_type,
    priority,
    status,
    title,
    summary,
    source_table,
    source_id,
    source_payload,
    candidate_payload,
    created_at,
    updated_at
  )
  values (
    'mizizi:' || p_fingerprint,
    p_entity_type,
    p_entity_id::uuid,
    'mizizi_data_hygiene',
    'high',
    'open',
    v_title,
    btrim(p_reason),
    v_source_table,
    p_entity_id,
    jsonb_build_object(
      'agent','mizizi',
      'ruleId',p_rule_id,
      'ruleVersion',p_rule_version,
      'fieldName',p_field_name,
      'currentValue',p_current_value,
      'confidence',p_confidence,
      'evidence',coalesce(p_evidence,'{}'::jsonb)
    ),
    jsonb_build_object(
      'proposedValue',p_proposed_value,
      'disposition','review'
    ),
    now(),
    now()
  )
  on conflict (review_key)
  do nothing
  returning id into v_review_id;

  if v_review_id is null then
    select id into v_review_id
    from public.registry_review_items
    where review_key='mizizi:' || p_fingerprint;
  end if;

  return v_review_id;
end
$$;

create function public.admin_issue_mizizi_stewardship_capability_grant_v1(
  p_capability_key text,
  p_expires_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation_key text;
  v_grant_id uuid;
begin
  if v_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  v_operation_key := case p_capability_key
    when 'repair_registry_release_taxonomy'
      then 'registry.release_taxonomy.repair'
    when 'synchronize_chart_track_slug'
      then 'registry.chart_track_slug.synchronize'
    else null
  end;

  if v_operation_key is null
     or p_expires_at < now() + interval '5 minutes'
     or p_expires_at > now() + interval '30 days'
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason) > 1000
  then
    raise exception using errcode='22023',
      message='Invalid bounded MIZIZI stewardship grant request.';
  end if;

  update platform_private.system_actor_capability_grants
  set status='expired',updated_at=now()
  where actor_key='mizizi'
    and capability_key=p_capability_key
    and status='active'
    and expires_at <= now();

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and capability_key=p_capability_key
      and status='active'
      and valid_from <= now()
      and expires_at > now()
  ) then
    raise exception using errcode='23505',
      message='An active MIZIZI grant already exists for this capability.';
  end if;

  insert into platform_private.system_actor_capability_grants (
    actor_key,capability_key,scope,status,valid_from,expires_at,
    granted_by_user_id,grant_reason
  )
  values (
    'mizizi',
    p_capability_key,
    jsonb_build_object(
      'operation_key',v_operation_key,
      'operation_version',1,
      'max_rows',1
    ),
    'active',
    now(),
    p_expires_at,
    v_user_id,
    btrim(p_reason)
  )
  returning id into v_grant_id;

  insert into public.registry_audit_log (
    actor_id,actor_label,action,entity_type,entity_id,after_value,metadata
  )
  values (
    v_user_id,
    'registry_admin',
    'issue_mizizi_stewardship_capability_grant',
    'system_actor_capability_grant',
    v_grant_id,
    jsonb_build_object(
      'actor_key','mizizi',
      'capability_key',p_capability_key,
      'expires_at',p_expires_at
    ),
    jsonb_build_object(
      'operation_key',v_operation_key,
      'operation_version',1,
      'reason',btrim(p_reason)
    )
  );

  return v_grant_id;
end
$$;

create function public.admin_revoke_mizizi_stewardship_capability_grant_v1(
  p_grant_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows integer;
begin
  if v_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_grant_id is null
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason) > 1000
  then
    raise exception using errcode='22023',
      message='Grant id and bounded revoke reason are required.';
  end if;

  update platform_private.system_actor_capability_grants
  set
    status='revoked',
    revoked_at=now(),
    revoked_by_user_id=v_user_id,
    revoke_reason=btrim(p_reason),
    updated_at=now()
  where id=p_grant_id
    and actor_key='mizizi'
    and capability_key in (
      'repair_registry_release_taxonomy',
      'synchronize_chart_track_slug'
    )
    and status='active';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception using errcode='P0002',
      message='Active MIZIZI stewardship grant not found.';
  end if;

  return true;
end
$$;

create function public.admin_set_mizizi_stewardship_operation_enabled_v1(
  p_operation_key text,
  p_enabled boolean,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before boolean;
begin
  if v_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_operation_key not in (
       'registry.release_taxonomy.repair',
       'registry.chart_track_slug.synchronize'
     )
     or p_enabled is null
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason) > 1000
  then
    raise exception using errcode='22023',
      message='Invalid bounded MIZIZI operation toggle.';
  end if;

  select enabled into v_before
  from platform_private.registry_operation_types
  where operation_key=p_operation_key
    and operation_version=1
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='MIZIZI stewardship operation type is missing.';
  end if;

  update platform_private.registry_operation_types
  set enabled=p_enabled,updated_at=now()
  where operation_key=p_operation_key
    and operation_version=1;

  insert into public.registry_audit_log (
    actor_id,actor_label,action,entity_type,before_value,after_value,metadata
  )
  values (
    v_user_id,
    'registry_admin',
    'set_mizizi_stewardship_operation_enabled',
    'registry_operation_type',
    jsonb_build_object('enabled',v_before),
    jsonb_build_object('enabled',p_enabled),
    jsonb_build_object(
      'operation_key',p_operation_key,
      'operation_version',1,
      'reason',btrim(p_reason)
    )
  );

  return true;
end
$$;

revoke all on all functions in schema mizizi_private
  from public, anon, authenticated, service_role;
grant execute on function
  mizizi_private.assert_executor_v1(),
  mizizi_private.release_taxonomy_plan_v1(uuid),
  mizizi_private.chart_track_slug_plan_v1(text),
  mizizi_private.queue_registry_review_v1(
    text,text,text,text,text,text,text,text,numeric,text,text,jsonb
  )
to mizizi_executor;

revoke all on function
  public.admin_issue_mizizi_stewardship_capability_grant_v1(text,timestamptz,text),
  public.admin_revoke_mizizi_stewardship_capability_grant_v1(uuid,text),
  public.admin_set_mizizi_stewardship_operation_enabled_v1(text,boolean,text)
from public, anon, service_role;

grant execute on function
  public.admin_issue_mizizi_stewardship_capability_grant_v1(text,timestamptz,text),
  public.admin_revoke_mizizi_stewardship_capability_grant_v1(uuid,text),
  public.admin_set_mizizi_stewardship_operation_enabled_v1(text,boolean,text)
to authenticated;

do $postflight$
declare
  v_role record;
begin
  select rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit
  into v_role
  from pg_roles
  where rolname='mizizi_executor';

  if not found
     or not v_role.rolcanlogin
     or v_role.rolsuper
     or v_role.rolcreatedb
     or v_role.rolcreaterole
     or v_role.rolreplication
     or v_role.rolbypassrls
     or v_role.rolinherit
  then
    raise exception 'STOP: mizizi_executor role privilege shape is unsafe';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from <= now()
      and expires_at > now()
  ) then
    raise exception 'STOP: Stage A created active MIZIZI standing authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at > now()
  ) then
    raise exception 'STOP: Stage A created active MIZIZI exact authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.release_taxonomy.repair',
      'registry.chart_track_slug.synchronize'
    )
      and enabled
  ) then
    raise exception 'STOP: Stage A unexpectedly enabled MIZIZI mutation operations';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='active'
  ) then
    raise exception 'STOP: Stage A changed the active postgres binding';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='mizizi_executor'
      and status='disabled'
  ) then
    raise exception 'STOP: disabled future MIZIZI executor binding is missing';
  end if;

  if has_table_privilege('mizizi_executor','public.registry_tracks','insert')
     or has_table_privilege('mizizi_executor','public.registry_tracks','update')
     or has_table_privilege('mizizi_executor','public.registry_tracks','delete')
     or has_table_privilege('mizizi_executor','public.registry_releases','insert')
     or has_table_privilege('mizizi_executor','public.registry_releases','update')
     or has_table_privilege('mizizi_executor','public.registry_releases','delete')
     or has_table_privilege('mizizi_executor','public.wk_chart_entries_v2','insert')
     or has_table_privilege('mizizi_executor','public.wk_chart_entries_v2','update')
     or has_table_privilege('mizizi_executor','public.wk_chart_entries_v2','delete')
     or has_table_privilege('mizizi_executor','public.registry_review_items','insert')
     or has_table_privilege('mizizi_executor','public.registry_review_items','update')
     or has_table_privilege('mizizi_executor','public.registry_review_items','delete')
  then
    raise exception 'STOP: mizizi_executor gained direct mutation table authority';
  end if;

  if has_function_privilege(
       'mizizi_executor',
       'public.increment_share_count(text,text,text,text)',
       'execute'
     )
     or has_function_privilege(
       'mizizi_executor',
       'public.track_analytics_event(text,text,text,text,text,jsonb,text,uuid,text)',
       'execute'
     )
  then
    raise exception 'STOP: mizizi_executor inherited unrelated public bounded-write authority';
  end if;
end
$postflight$;

commit;
