-- Phase 8B.4 Candidate C: exact-version Playlist review projection through Messages.
-- Adds only the missing user-id review participation and safe read projection.
-- Playlist review mutation authority remains public.review_playlist(...).

do $guard$
begin
  if to_regprocedure('public.review_playlist(uuid,bigint,uuid,text,text,text,uuid)') is null
     or to_regprocedure('editorial.current_user_can_participate_playlist_review(uuid)') is null
     or to_regprocedure('editorial.user_has_capability_v1(uuid,text)') is null
     or to_regprocedure('messaging.can_user_reference_resource(uuid,uuid,uuid)') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('editorial.playlist_versions') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('public.wk_playlists') is null then
    raise exception 'STOP: accepted Playlist review or Messages authority is incomplete';
  end if;
end
$guard$;

create or replace function editorial.user_can_participate_playlist_review_v1(
  p_user_id uuid,
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    p_user_id is not null
    and exists (
      select 1
      from editorial.playlist_resources binding
      where binding.resource_id = p_resource_id
    )
    and (
      exists (
        select 1
        from public.user_role_assignments assignment
        where assignment.user_id = p_user_id
          and assignment.role_key = 'administrator'
          and assignment.status = 'active'
          and (
            assignment.expires_at is null
            or assignment.expires_at > now()
          )
      )
      or editorial.user_has_capability_v1(
        p_user_id,
        'edit_others_playlists'
      )
      or (
        editorial.user_has_capability_v1(
          p_user_id,
          'edit_own_playlists'
        )
        and exists (
          select 1
          from editorial.resources resource_row
          where resource_row.id = p_resource_id
            and resource_row.resource_kind = 'playlist'
            and resource_row.owner_id = p_user_id
        )
      )
      or editorial.user_has_capability_v1(
        p_user_id,
        'view_review_queue'
      )
      or editorial.user_has_capability_v1(
        p_user_id,
        'manage_review_queue'
      )
    );
$function$;

revoke all
on function editorial.user_can_participate_playlist_review_v1(uuid,uuid)
from public, anon, authenticated, service_role;

create or replace function editorial.current_user_can_participate_playlist_review(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select editorial.user_can_participate_playlist_review_v1(
    auth.uid(),
    p_resource_id
  );
$function$;

revoke all
on function editorial.current_user_can_participate_playlist_review(uuid)
from public, anon, authenticated, service_role;

grant execute
on function editorial.current_user_can_participate_playlist_review(uuid)
to authenticated;

create or replace function messaging.can_user_reference_resource(
  p_user_id uuid,
  p_resource_id uuid,
  p_resource_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
  select exists(
    select 1
    from editorial.resources resource_row
    where resource_row.id = p_resource_id
      and resource_row.lifecycle_state <> 'archived'
      and (
        resource_row.visibility = 'public'
        or resource_row.owner_id = p_user_id
        or resource_row.created_by = p_user_id
        or (
          resource_row.resource_kind = 'field_submission'
          and editorial.user_has_capability_v1(
            p_user_id,
            'view_field_intake'
          )
        )
        or (
          resource_row.resource_kind = 'playlist'
          and p_resource_version_id is not null
          and editorial.user_can_participate_playlist_review_v1(
            p_user_id,
            resource_row.id
          )
        )
      )
      and (
        p_resource_version_id is null
        or exists (
          select 1
          from editorial.resource_versions version_row
          where version_row.resource_id = resource_row.id
            and version_row.id = p_resource_version_id
        )
      )
  );
$function$;

revoke all
on function messaging.can_user_reference_resource(uuid,uuid,uuid)
from public, anon, authenticated, service_role;

create or replace function public.get_message_playlist_review_projection_v1(
  p_resource_id uuid,
  p_resource_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_resource editorial.resources%rowtype;
  v_version editorial.playlist_versions%rowtype;
  v_playlist_id uuid;
  v_can_manage boolean := false;
  v_is_current_submitted boolean := false;
  v_allowed_actions jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_resource_id is null or p_resource_version_id is null then
    raise exception using
      errcode = '22023',
      message = 'Exact Playlist Resource and version are required.';
  end if;

  if not editorial.user_can_participate_playlist_review_v1(
    v_user_id,
    p_resource_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Playlist Review participation permission is required.';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = p_resource_id
    and resource_row.resource_kind = 'playlist';

  if not found then
    raise exception 'Playlist Resource does not exist';
  end if;

  select binding.playlist_id
  into v_playlist_id
  from editorial.playlist_resources binding
  where binding.resource_id = p_resource_id;

  if not found then
    raise exception 'Playlist Resource binding does not exist';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = v_playlist_id;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select version_row.*
  into v_version
  from editorial.playlist_versions version_row
  where version_row.id = p_resource_version_id
    and version_row.resource_id = p_resource_id
    and version_row.playlist_id = v_playlist_id;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Playlist Review version is unavailable.';
  end if;

  v_can_manage :=
    exists (
      select 1
      from public.user_role_assignments assignment
      where assignment.user_id = v_user_id
        and assignment.role_key = 'administrator'
        and assignment.status = 'active'
        and (
          assignment.expires_at is null
          or assignment.expires_at > now()
        )
    )
    or editorial.user_has_capability_v1(
      v_user_id,
      'manage_review_queue'
    );

  v_is_current_submitted :=
    v_resource.current_submitted_version_id = p_resource_version_id;

  if v_can_manage and v_is_current_submitted then
    if v_playlist.status = 'ready_for_review' then
      v_allowed_actions := jsonb_build_array('start_review');
    elsif v_playlist.status = 'in_review' then
      v_allowed_actions := jsonb_build_array(
        'request_changes',
        'approve'
      );
    end if;
  end if;

  return jsonb_build_object(
    'resource_id', p_resource_id,
    'resource_version_id', p_resource_version_id,
    'playlist_id', v_playlist.id,
    'title', v_playlist.title,
    'slug', v_playlist.slug,
    'version_number', v_version.version_number,
    'version_kind', v_version.version_kind,
    'playlist_status', v_playlist.status,
    'authority_revision', v_playlist.authority_revision,
    'current_submitted_version_id',
      v_resource.current_submitted_version_id,
    'is_current_submitted', v_is_current_submitted,
    'can_participate_review', true,
    'can_manage_review', v_can_manage,
    'allowed_review_actions', v_allowed_actions
  );
end;
$function$;

revoke all
on function public.get_message_playlist_review_projection_v1(uuid,uuid)
from public, anon, service_role;

grant execute
on function public.get_message_playlist_review_projection_v1(uuid,uuid)
to authenticated;

comment on function editorial.user_can_participate_playlist_review_v1(uuid,uuid)
is 'User-id Playlist Review participation authority for exact-version cross-product projections.';

comment on function public.get_message_playlist_review_projection_v1(uuid,uuid)
is 'Minimal authenticated exact-version Playlist Review projection for canonical Messages cards. Mutation authority remains public.review_playlist.';
