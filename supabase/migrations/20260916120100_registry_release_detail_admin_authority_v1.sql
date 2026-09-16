-- MIZIZI Slice 2 Release Detail Admin Authority V1
--
-- Retires the remaining browser-side canonical Release update road without
-- rewriting the legacy minified admin-router bundle. The exact Release-detail
-- field family is caller-bound, capability-checked, compare-and-set, audited,
-- and emitted into the canonical write ledger in one atomic database call.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-release-detail-admin-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_audit_log') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'STOP: Registry Release admin foundation is missing';
  end if;

  if to_regprocedure(
       'public.admin_patch_registry_release_detail_v1(uuid,text,text,text,date,text,uuid,text,text,text,timestamp with time zone)'
     ) is not null
  then
    raise exception 'STOP: Release Detail Admin Authority V1 already exists';
  end if;
end
$preflight$;

create function public.admin_patch_registry_release_detail_v1(
  p_release_id uuid,
  p_title text,
  p_release_type text,
  p_upc text,
  p_release_date date,
  p_release_date_precision text,
  p_label_id uuid,
  p_description text,
  p_artwork_url text,
  p_status text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before public.registry_releases%rowtype;
  v_after public.registry_releases%rowtype;
  v_before_payload jsonb;
  v_after_payload jsonb;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_release_id is null
     or nullif(btrim(coalesce(p_title,'')), '') is null
     or p_expected_updated_at is null
  then
    raise exception using errcode='22023',
      message='Release id, title, and expected updated_at are required.';
  end if;

  select release.*
  into v_before
  from public.registry_releases release
  where release.id = p_release_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Registry Release not found.';
  end if;

  if v_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode='40001',
      message='Registry Release changed after this editor loaded it.';
  end if;

  v_before_payload := jsonb_build_object(
    'title', v_before.title,
    'release_type', v_before.release_type,
    'upc', v_before.upc,
    'release_date', v_before.release_date,
    'release_date_precision', v_before.release_date_precision,
    'label_id', v_before.label_id,
    'description', v_before.description,
    'artwork_url', v_before.artwork_url,
    'status', v_before.status
  );

  update public.registry_releases
  set
    title = btrim(p_title),
    release_type = nullif(btrim(coalesce(p_release_type,'')), ''),
    upc = nullif(btrim(coalesce(p_upc,'')), ''),
    release_date = p_release_date,
    release_date_precision = nullif(btrim(coalesce(p_release_date_precision,'')), ''),
    label_id = p_label_id,
    description = nullif(btrim(coalesce(p_description,'')), ''),
    artwork_url = nullif(btrim(coalesce(p_artwork_url,'')), ''),
    status = p_status,
    updated_at = now()
  where id = p_release_id
  returning * into v_after;

  v_after_payload := jsonb_build_object(
    'title', v_after.title,
    'release_type', v_after.release_type,
    'upc', v_after.upc,
    'release_date', v_after.release_date,
    'release_date_precision', v_after.release_date_precision,
    'label_id', v_after.label_id,
    'description', v_after.description,
    'artwork_url', v_after.artwork_url,
    'status', v_after.status
  );

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    metadata
  ) values (
    v_user_id,
    'registry_admin',
    'update_release_detail',
    'release',
    p_release_id,
    v_before_payload,
    v_after_payload,
    jsonb_build_object(
      'authority', 'admin_patch_registry_release_detail_v1',
      'expected_updated_at', p_expected_updated_at
    )
  );

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    actor
  ) values (
    'release',
    p_release_id::text,
    null,
    'public.admin_patch_registry_release_detail_v1',
    'detail_fields',
    'public.registry_releases',
    jsonb_build_object('value', v_before_payload),
    jsonb_build_object('value', v_after_payload),
    'admin_patch_release_detail',
    'succeeded',
    'user:' || v_user_id::text
  );

  return to_jsonb(v_after);
end
$$;

revoke all on function public.admin_patch_registry_release_detail_v1(
  uuid,text,text,text,date,text,uuid,text,text,text,timestamptz
) from public, anon;
grant execute on function public.admin_patch_registry_release_detail_v1(
  uuid,text,text,text,date,text,uuid,text,text,text,timestamptz
) to authenticated;

comment on function public.admin_patch_registry_release_detail_v1(
  uuid,text,text,text,date,text,uuid,text,text,text,timestamptz
) is
  'Caller-bound manage_registry Release-detail compare-and-set authority. Replaces direct browser canonical Release updates and preserves release date precision and label binding atomically.';

commit;
