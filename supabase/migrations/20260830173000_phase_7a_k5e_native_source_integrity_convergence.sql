begin;

-- Phase 7A K5E follow-through: native source integrity convergence.
--
-- The first real rendered retry after K5E proved one older K2 trigger still
-- duplicated public-use governance at Video source registration time.
--
-- Native source identity belongs to working composition and therefore needs
-- only an active Video asset plus one exact verified immutable Media revision.
-- Public-use governance remains enforced by the existing K4B publication gate.

create or replace function video.enforce_source_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'video', 'media'
as $function$
declare
  v_asset_kind text;
  v_asset_state text;
  v_revision_asset_id uuid;
  v_verification_state text;
begin
  if new.source_kind = 'external_provider' then
    if not exists (
      select 1
      from video.source_providers provider
      where provider.provider_key = new.provider_key
        and provider.enabled
    ) then
      raise exception
        'Video provider source requires an enabled provider.';
    end if;

    return new;
  end if;

  select
    asset.asset_kind,
    asset.lifecycle_state
  into
    v_asset_kind,
    v_asset_state
  from media.assets asset
  where asset.id = new.media_asset_id;

  if not found
     or v_asset_kind <> 'video'
     or v_asset_state <> 'active'
  then
    raise exception
      'Native Video source requires one active Video Media asset.';
  end if;

  select
    revision.asset_id,
    file_row.verification_state
  into
    v_revision_asset_id,
    v_verification_state
  from media.asset_revisions revision
  join media.file_objects file_row
    on file_row.id = revision.original_file_object_id
  where revision.id = new.media_asset_revision_id;

  if not found
     or v_revision_asset_id <> new.media_asset_id
     or v_verification_state <> 'verified'
  then
    raise exception
      'Native Video source requires one exact verified revision of the same Video asset.';
  end if;

  return new;
end;
$function$;

revoke execute
  on function video.enforce_source_integrity()
  from public, anon, authenticated, service_role;

commit;
