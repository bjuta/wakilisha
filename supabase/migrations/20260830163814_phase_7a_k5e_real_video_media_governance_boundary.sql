begin;

-- Phase 7A K5E real Video Media governance boundary.
--
-- Real production use exposed that K5A conflated two different decisions:
-- 1. whether an exact Media revision may participate in a working Video draft
-- 2. whether that immutable Video version is cleared for public publication
--
-- Working composition needs exact verified Media identity.
-- Public governance remains enforced by the existing K4B publish boundary.

create or replace function video.assert_exact_media_revision(
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_expected_asset_kind text
)
returns void
language plpgsql
stable
security definer
set search_path to 'pg_catalog','media'
as $f$
declare
  v_kind text;
  v_lifecycle text;
  v_verified text;
begin
  if p_asset_id is null
     or p_asset_revision_id is null
     or nullif(btrim(p_expected_asset_kind),'') is null
  then
    raise exception using
      errcode='22023',
      message='Exact Video Media identity is required.';
  end if;

  select
    a.asset_kind,
    a.lifecycle_state,
    f.verification_state
  into
    v_kind,
    v_lifecycle,
    v_verified
  from media.assets a
  join media.asset_revisions r
    on r.asset_id=a.id
   and r.id=p_asset_revision_id
  join media.file_objects f
    on f.id=r.original_file_object_id
  where a.id=p_asset_id;

  if not found then
    raise exception using
      errcode='P0002',
      message='Exact Video Media revision does not exist.';
  end if;

  if v_kind <> p_expected_asset_kind
     or v_lifecycle <> 'active'
     or v_verified <> 'verified'
  then
    raise exception using
      errcode='55000',
      message='Video Media kind/lifecycle/verification is not eligible.';
  end if;
end;
$f$;

-- The canonical governance write already exists as
-- public.create_media_governance_version(...).
-- K5E adds only the missing browser-safe current-governance read required
-- to review real uploaded Media without direct private-schema access.

create or replace function public.get_media_asset_governance_admin(
  p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','media','auth'
as $f$
declare
  v_actor uuid;
  v_result jsonb;
begin
  v_actor := media.require_command_actor('review_media_governance');

  select jsonb_build_object(
    'asset_id', a.id,
    'authority_revision', a.authority_revision,
    'current_revision_id', a.current_revision_id,
    'current_governance_version_id', a.current_governance_version_id,
    'version_number', g.version_number,
    'rights_status', g.rights_status,
    'rights_basis', g.rights_basis,
    'rights_holder', g.rights_holder,
    'licence_identifier', g.licence_identifier,
    'licence_terms', g.licence_terms,
    'consent_status', g.consent_status,
    'consent_scope', g.consent_scope,
    'sensitivity', g.sensitivity,
    'embargo_state', g.embargo_state,
    'embargo_until', g.embargo_until,
    'source_protection_class', g.source_protection_class,
    'preservation_state', g.preservation_state,
    'retention_state', g.retention_state,
    'public_safety_state', g.public_safety_state,
    'internal_reason', g.internal_reason,
    'approved_by', g.approved_by,
    'created_by', g.created_by,
    'created_at', g.created_at
  )
  into v_result
  from media.assets a
  join media.asset_governance_versions g
    on g.id=a.current_governance_version_id
   and g.asset_id=a.id
  where a.id=p_asset_id;

  if v_result is null then
    raise exception using
      errcode='P0002',
      message='Current Media governance does not exist.';
  end if;

  return v_result;
end;
$f$;

revoke all
  on function public.get_media_asset_governance_admin(uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function public.get_media_asset_governance_admin(uuid)
  to authenticated;

commit;
