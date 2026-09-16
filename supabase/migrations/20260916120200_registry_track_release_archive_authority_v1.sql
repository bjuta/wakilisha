-- MIZIZI Slice 2 Track/Release Soft Archive Authority V1
--
-- Preserves the existing Admin editor archive semantics while retiring direct
-- browser canonical DML. The generic admin-router DELETE route is deliberately
-- not used here because it is a draft-only hard-delete boundary.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-track-release-soft-archive-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_audit_log') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'STOP: Registry Track/Release archive foundation is missing';
  end if;

  if to_regprocedure(
       'public.admin_archive_registry_music_entity_v1(text,uuid,timestamp with time zone)'
     ) is not null
  then
    raise exception 'STOP: Track/Release Soft Archive Authority V1 already exists';
  end if;
end
$preflight$;

create function public.admin_archive_registry_music_entity_v1(
  p_entity_type text,
  p_entity_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_entity_type text := lower(btrim(coalesce(p_entity_type,'')));
  v_track_before public.registry_tracks%rowtype;
  v_track_after public.registry_tracks%rowtype;
  v_release_before public.registry_releases%rowtype;
  v_release_after public.registry_releases%rowtype;
  v_before_status text;
  v_after_row jsonb;
  v_target_path text;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'), false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if v_entity_type not in ('track','release')
     or p_entity_id is null
     or p_expected_updated_at is null
  then
    raise exception using errcode='22023',
      message='Valid Track/Release type, id, and expected updated_at are required.';
  end if;

  if v_entity_type = 'track' then
    select track.*
    into v_track_before
    from public.registry_tracks track
    where track.id = p_entity_id
    for update;

    if not found then
      raise exception using errcode='P0002', message='Registry Track not found.';
    end if;

    if v_track_before.updated_at is distinct from p_expected_updated_at then
      raise exception using errcode='40001',
        message='Registry Track changed after this editor loaded it.';
    end if;

    if v_track_before.status = 'archived' then
      return to_jsonb(v_track_before);
    end if;

    v_before_status := v_track_before.status;

    update public.registry_tracks
    set status = 'archived',
        updated_at = now()
    where id = p_entity_id
    returning * into v_track_after;

    v_after_row := to_jsonb(v_track_after);
    v_target_path := 'public.registry_tracks.status';
  else
    select release.*
    into v_release_before
    from public.registry_releases release
    where release.id = p_entity_id
    for update;

    if not found then
      raise exception using errcode='P0002', message='Registry Release not found.';
    end if;

    if v_release_before.updated_at is distinct from p_expected_updated_at then
      raise exception using errcode='40001',
        message='Registry Release changed after this editor loaded it.';
    end if;

    if v_release_before.status = 'archived' then
      return to_jsonb(v_release_before);
    end if;

    v_before_status := v_release_before.status;

    update public.registry_releases
    set status = 'archived',
        updated_at = now()
    where id = p_entity_id
    returning * into v_release_after;

    v_after_row := to_jsonb(v_release_after);
    v_target_path := 'public.registry_releases.status';
  end if;

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
    'archive',
    v_entity_type,
    p_entity_id,
    jsonb_build_object('status', v_before_status),
    jsonb_build_object('status', 'archived'),
    jsonb_build_object(
      'authority', 'admin_archive_registry_music_entity_v1',
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
    v_entity_type,
    p_entity_id::text,
    null,
    'public.admin_archive_registry_music_entity_v1',
    'status',
    v_target_path,
    jsonb_build_object('value', v_before_status),
    jsonb_build_object('value', 'archived'),
    'archive',
    'succeeded',
    'user:' || v_user_id::text
  );

  return v_after_row;
end
$$;

revoke all on function public.admin_archive_registry_music_entity_v1(
  text,uuid,timestamptz
) from public, anon;
grant execute on function public.admin_archive_registry_music_entity_v1(
  text,uuid,timestamptz
) to authenticated;

comment on function public.admin_archive_registry_music_entity_v1(
  text,uuid,timestamptz
) is
  'Caller-bound manage_registry soft-archive authority for Track and Release editors. Uses optimistic concurrency and records audit/canonical write evidence; it never hard-deletes the entity.';

commit;
