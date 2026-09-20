-- MIZIZI Slice 3 Stage C: narrow-executor transport cutover.
-- Stage B already owns canonical mutation semantics through typed exact-grant
-- brokers. Stage C changes only database transport identity and its exact
-- read/delegation surface.

do $preflight$
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version='20260918173446'
      and name='mizizi_stage_b_broker_convergence_v1'
  ) then
    raise exception 'STOP: Stage B typed broker convergence is required before Stage C';
  end if;

  if exists (
    select 1 from platform_private.system_actor_capability_grants
    where actor_key='mizizi' and status='active'
      and valid_from<=now() and expires_at>now() and revoked_at is null
  ) then
    raise exception 'STOP: Stage C requires zero active MIZIZI standing grants';
  end if;

  if exists (
    select 1 from platform_private.registry_execution_grants
    where actor_key='mizizi' and status='active'
      and expires_at>now() and revoked_at is null and consumed_at is null
  ) then
    raise exception 'STOP: Stage C requires zero active MIZIZI exact grants';
  end if;

  if (
    select count(*) from platform_private.registry_operation_types
    where operation_version=1
      and operation_key in (
        'registry.track_slug.canonicalize',
        'registry.release_taxonomy.repair',
        'registry.release_slug.canonicalize',
        'registry.chart_track_slug.synchronize'
      ) and enabled=false
  )<>4 then
    raise exception 'STOP: Stage C requires all Stage B stewardship operations disabled';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_executor_bindings
    where actor_key='mizizi' and executor_kind='database_role'
      and executor_key='postgres' and status='active'
  ) then
    raise exception 'STOP: Stage C entry requires the current postgres binding active';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_executor_bindings
    where actor_key='mizizi' and executor_kind='database_role'
      and executor_key='mizizi_executor' and status='disabled'
  ) then
    raise exception 'STOP: Stage C entry requires the future mizizi_executor binding disabled';
  end if;

  if has_schema_privilege('mizizi_executor','platform_private','USAGE') then
    raise exception 'STOP: Stage C refuses pre-existing platform_private namespace authority';
  end if;
end
$preflight$;

revoke all privileges on table
  public.registry_tracks,
  public.registry_track_artists,
  public.registry_releases,
  public.registry_release_tracks,
  public.registry_release_artists,
  public.wk_chart_entries_v2,
  public.registry_artists
from mizizi_executor;

grant select (id,slug,title,status,updated_at)
  on public.registry_tracks to mizizi_executor;
grant select (id,track_id,artist_slug,artist_name_text,status,is_primary,is_featured,credit_order,created_at)
  on public.registry_track_artists to mizizi_executor;
grant select (id,slug,title,release_type,release_date,status,updated_at)
  on public.registry_releases to mizizi_executor;
grant select (id,release_id,track_id,status,disc_number,track_number)
  on public.registry_release_tracks to mizizi_executor;
grant select (id,release_id,artist_id,artist_slug,status,is_primary,credit_order,created_at)
  on public.registry_release_artists to mizizi_executor;
grant select (id,track_slug,artist_slug,canonical_track_id,updated_at)
  on public.wk_chart_entries_v2 to mizizi_executor;
grant select (id,slug,display_name,status,origin_iso2,origin_confidence,metadata)
  on public.registry_artists to mizizi_executor;

drop policy if exists mizizi_executor_registry_tracks_read on public.registry_tracks;
create policy mizizi_executor_registry_tracks_read on public.registry_tracks
  for select to mizizi_executor using (status='active');
drop policy if exists mizizi_executor_registry_track_artists_read on public.registry_track_artists;
create policy mizizi_executor_registry_track_artists_read on public.registry_track_artists
  for select to mizizi_executor using (status='active');
drop policy if exists mizizi_executor_registry_releases_read on public.registry_releases;
create policy mizizi_executor_registry_releases_read on public.registry_releases
  for select to mizizi_executor using (status='active');
drop policy if exists mizizi_executor_registry_release_tracks_read on public.registry_release_tracks;
create policy mizizi_executor_registry_release_tracks_read on public.registry_release_tracks
  for select to mizizi_executor using (status='active');
drop policy if exists mizizi_executor_registry_release_artists_read on public.registry_release_artists;
create policy mizizi_executor_registry_release_artists_read on public.registry_release_artists
  for select to mizizi_executor using (status='active');
drop policy if exists mizizi_executor_wk_chart_entries_v2_read on public.wk_chart_entries_v2;
create policy mizizi_executor_wk_chart_entries_v2_read on public.wk_chart_entries_v2
  for select to mizizi_executor using (true);
drop policy if exists mizizi_executor_registry_artists_read on public.registry_artists;
create policy mizizi_executor_registry_artists_read on public.registry_artists
  for select to mizizi_executor using (status in ('active','draft'));

create or replace function mizizi_private.record_artist_origin_evidence_v1(
  p_actor_key text,
  p_artist_id uuid,
  p_origin_iso2 text,
  p_confidence numeric,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, platform_private, mizizi_private
as $$
begin
  perform mizizi_private.assert_executor_v1();
  if p_actor_key is distinct from 'mizizi' then
    raise exception using errcode='42501', message='Artist-origin wrapper is bound to MIZIZI.';
  end if;
  return platform_private.record_registry_artist_origin_evidence(
    'mizizi',p_artist_id,p_origin_iso2,p_confidence,p_source_kind,
    p_source_ref,p_source_payload_fingerprint,p_observed_at
  );
end
$$;

create or replace function mizizi_private.issue_artist_origin_execution_grant_v1(
  p_actor_key text,
  p_evidence_assertion_id uuid,
  p_idempotency_key text
)
returns table (
  execution_grant_id uuid,
  plan_fingerprint text,
  target_set_fingerprint text,
  expected_state_fingerprint text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, platform_private, mizizi_private
as $$
begin
  perform mizizi_private.assert_executor_v1();
  if p_actor_key is distinct from 'mizizi' then
    raise exception using errcode='42501', message='Artist-origin wrapper is bound to MIZIZI.';
  end if;
  return query select * from platform_private.issue_registry_artist_origin_execution_grant(
    'mizizi',p_evidence_assertion_id,p_idempotency_key
  );
end
$$;

create or replace function mizizi_private.execute_artist_origin_admission_v1(
  p_actor_key text,
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
set search_path = pg_catalog, platform_private, mizizi_private
as $$
begin
  perform mizizi_private.assert_executor_v1();
  if p_actor_key is distinct from 'mizizi' then
    raise exception using errcode='42501', message='Artist-origin wrapper is bound to MIZIZI.';
  end if;
  return query select * from platform_private.execute_registry_artist_origin_admission(
    'mizizi',p_execution_grant_id
  );
end
$$;

create or replace function mizizi_private.verify_artist_origin_admission_v1(
  p_operation_id uuid
)
returns table (operation_id uuid, verifier_status text)
language plpgsql
security definer
set search_path = pg_catalog, platform_private, mizizi_private
as $$
begin
  perform mizizi_private.assert_executor_v1();
  return query select * from platform_private.verify_registry_artist_origin_admission(p_operation_id);
end
$$;

create or replace function mizizi_private.send_operational_standup_v1(
  p_body text,
  p_idempotency_key text
)
returns table (
  command_receipt_id uuid,
  receipt_status text,
  conversation_id uuid,
  message_id uuid,
  mailbox_folder text,
  first_contact_state text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, platform_private, mizizi_private
as $$
declare
  v_recipients uuid[];
  v_recipient uuid;
begin
  perform mizizi_private.assert_executor_v1();

  select array_agg(distinct link.person_resource_id order by link.person_resource_id)
  into v_recipients
  from public.user_role_assignments role
  join editorial.person_identity_links link
    on link.user_id=role.user_id and link.link_state='active'
  where role.role_key='super_admin'
    and role.status='active'
    and (role.expires_at is null or role.expires_at>now());

  if coalesce(cardinality(v_recipients),0)<>1 then
    raise exception using errcode='42501',
      message='MIZIZI standup requires exactly one active Super Admin Person recipient.';
  end if;

  v_recipient := v_recipients[1];
  return query select * from platform_private.send_system_message(
    'mizizi',v_recipient,'operational_update',p_body,'[]'::jsonb,
    p_idempotency_key,null,null
  );
end
$$;

revoke all on function
  mizizi_private.record_artist_origin_evidence_v1(text,uuid,text,numeric,text,text,text,timestamptz),
  mizizi_private.issue_artist_origin_execution_grant_v1(text,uuid,text),
  mizizi_private.execute_artist_origin_admission_v1(text,uuid),
  mizizi_private.verify_artist_origin_admission_v1(uuid),
  mizizi_private.send_operational_standup_v1(text,text)
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.record_artist_origin_evidence_v1(text,uuid,text,numeric,text,text,text,timestamptz),
  mizizi_private.issue_artist_origin_execution_grant_v1(text,uuid,text),
  mizizi_private.execute_artist_origin_admission_v1(text,uuid),
  mizizi_private.verify_artist_origin_admission_v1(uuid),
  mizizi_private.send_operational_standup_v1(text,text)
to mizizi_executor;

do $binding_cutover$
begin
  update platform_private.system_actor_executor_bindings
  set status='disabled', updated_at=now()
  where actor_key='mizizi' and executor_kind='database_role'
    and executor_key='postgres' and status='active';
  if not found then
    raise exception 'STOP: Stage C did not disable the current postgres binding';
  end if;

  update platform_private.system_actor_executor_bindings
  set status='active', updated_at=now()
  where actor_key='mizizi' and executor_kind='database_role'
    and executor_key='mizizi_executor' and status='disabled';
  if not found then
    raise exception 'STOP: Stage C did not activate the mizizi_executor binding';
  end if;
end
$binding_cutover$;

do $postflight$
declare
  v_role record;
begin
  select rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit
  into v_role from pg_roles where rolname='mizizi_executor';

  if not found or not v_role.rolcanlogin or v_role.rolsuper or v_role.rolcreatedb
     or v_role.rolcreaterole or v_role.rolreplication or v_role.rolbypassrls or v_role.rolinherit then
    raise exception 'STOP: mizizi_executor role privilege shape is unsafe';
  end if;

  if has_schema_privilege('mizizi_executor','platform_private','USAGE') then
    raise exception 'STOP: mizizi_executor received ambient platform_private namespace access';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_executor_bindings
    where actor_key='mizizi' and executor_kind='database_role'
      and executor_key='mizizi_executor' and status='active'
  ) or not exists (
    select 1 from platform_private.system_actor_executor_bindings
    where actor_key='mizizi' and executor_kind='database_role'
      and executor_key='postgres' and status='disabled'
  ) then
    raise exception 'STOP: Stage C executor binding cutover is incomplete';
  end if;

  if exists (
    select 1 from platform_private.system_actor_capability_grants
    where actor_key='mizizi' and status='active'
      and valid_from<=now() and expires_at>now() and revoked_at is null
  ) then
    raise exception 'STOP: Stage C created active standing authority';
  end if;

  if exists (
    select 1 from platform_private.registry_execution_grants
    where actor_key='mizizi' and status='active'
      and expires_at>now() and revoked_at is null and consumed_at is null
  ) then
    raise exception 'STOP: Stage C created active exact authority';
  end if;

  if (
    select count(*) from platform_private.registry_operation_types
    where operation_version=1
      and operation_key in (
        'registry.track_slug.canonicalize',
        'registry.release_taxonomy.repair',
        'registry.release_slug.canonicalize',
        'registry.chart_track_slug.synchronize'
      ) and enabled=false
  )<>4 then
    raise exception 'STOP: Stage C changed Stage B operation activation state';
  end if;

  if has_table_privilege('mizizi_executor','public.registry_tracks','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_releases','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_artists','UPDATE')
     or has_table_privilege('mizizi_executor','public.wk_chart_entries_v2','UPDATE') then
    raise exception 'STOP: Stage C granted direct canonical mutation authority';
  end if;

  if has_table_privilege('mizizi_executor','public.user_role_assignments','SELECT')
     or has_schema_privilege('mizizi_executor','editorial','USAGE') then
    raise exception 'STOP: Stage C exposed admin identity reads directly';
  end if;
end
$postflight$;
