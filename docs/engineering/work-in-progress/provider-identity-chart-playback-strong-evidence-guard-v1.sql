-- WAKILISHA Provider Identity / Chart Playback strong-evidence admission guard.
-- Candidate only. The canonical forward migration MUST be minted with:
--   supabase migration new provider_identity_chart_playback_strong_evidence_guard_v1
-- and this body copied byte-for-byte after the generated header/path is created.
--
-- Authority:
-- - #1163 Provider Identity Control Plane
-- - #1167 Provider Identity Slice 2
-- - #1168 implementation PR
--
-- Purpose:
-- Close the canonical-admission bypass where a manage_charts user could
-- manually mark similarity-only Apple enrichment evidence as accepted and then
-- invoke chart_admit_track_provider_link_v1.
--
-- Historical accepted similarity rows and existing canonical provider links are
-- preserved. This guard is prospective.

begin;

do $preflight$
begin
  if to_regclass('public.wk_chart_playback_enrichment_items') is null
     or to_regprocedure('public.chart_admit_track_provider_link_v1(uuid)') is null
     or to_regprocedure(
       'platform_private.record_registry_chart_playback_provider_evidence_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_chart_playback_provider_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_chart_playback_provider_v1(uuid)'
     ) is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception
      'STOP: accepted Chart Playback provider authority is missing';
  end if;

  if to_regprocedure(
    'platform_private.require_registry_chart_playback_provider_strong_identity_v1(uuid)'
  ) is not null
  then
    raise exception
      'STOP: strong-evidence admission guard already exists';
  end if;
end
$preflight$;

create function
  platform_private.require_registry_chart_playback_provider_strong_identity_v1(
    p_item_id uuid
  )
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_item public.wk_chart_playback_enrichment_items%rowtype;
  v_input_isrc text;
  v_provider_isrc text;
begin
  if p_item_id is null then
    raise exception using
      errcode='22023',
      message='Chart playback enrichment item is required.';
  end if;

  select item.*
  into v_item
  from public.wk_chart_playback_enrichment_items item
  where item.id=p_item_id;

  if not found then
    raise exception using
      errcode='P0002',
      message='Chart playback enrichment item not found.';
  end if;

  v_input_isrc :=
    upper(
      regexp_replace(
        coalesce(v_item.isrc,''),
        '[^A-Za-z0-9]',
        '',
        'g'
      )
    );

  v_provider_isrc :=
    upper(
      regexp_replace(
        coalesce(
          v_item.raw_match_payload #>> '{attributes,isrc}',
          ''
        ),
        '[^A-Za-z0-9]',
        '',
        'g'
      )
    );

  if v_item.provider<>'apple_music'
     or v_item.status<>'accepted'
     or not coalesce(v_item.auto_accept,false)
     or lower(coalesce(v_item.match_method,''))<>'isrc'
     or v_input_isrc !~ '^[A-Z0-9]{12}$'
     or v_provider_isrc !~ '^[A-Z0-9]{12}$'
     or v_input_isrc<>v_provider_isrc
  then
    raise exception using
      errcode='42501',
      message=
        'Canonical provider admission requires one exact 12-character ISRC match.';
  end if;
end;
$$;

revoke all on function
  platform_private.require_registry_chart_playback_provider_strong_identity_v1(uuid)
from public, anon, authenticated, service_role;

create or replace function public.chart_admit_track_provider_link_v1(
  p_enrichment_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_evidence_id uuid;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
begin
  if auth.uid() is null
     or not coalesce(
       public.current_user_has_capability('manage_charts'),
       false
     )
  then
    raise exception using
      errcode='42501',
      message='manage_charts is required.';
  end if;

  perform
    platform_private.require_registry_chart_playback_provider_strong_identity_v1(
      p_enrichment_item_id
    );

  v_evidence_id :=
    platform_private.record_registry_chart_playback_provider_evidence_v1(
      p_enrichment_item_id
    );

  v_grant_id :=
    platform_private.issue_registry_chart_playback_provider_grant_v1(
      v_evidence_id,
      p_enrichment_item_id
    );

  select *
  into v_exec
  from platform_private.execute_registry_chart_playback_provider_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_chart_playback_provider_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using
      errcode='40001',
      message='Chart playback provider verifier failed.';
  end if;

  return jsonb_build_object(
    'operation_id',v_exec.operation_id,
    'operation_status',v_exec.operation_status,
    'verifier_status',v_verify.verifier_status,
    'idempotent_replay',v_exec.idempotent_replay,
    'evidence_assertion_id',v_evidence_id,
    'execution_grant_id',v_grant_id
  );
end;
$$;

revoke all on function
  public.chart_admit_track_provider_link_v1(uuid)
from public, anon, service_role;

grant execute on function
  public.chart_admit_track_provider_link_v1(uuid)
to authenticated;

comment on function
  platform_private.require_registry_chart_playback_provider_strong_identity_v1(uuid)
is
  'Fail-closed Chart Playback provider admission guard. Requires accepted Apple Music evidence with auto_accept=true, match_method=isrc, and equal normalized 12-character source/provider ISRC values. Similarity-only evidence is review evidence and cannot begin canonical provider-link admission.';

comment on function
  public.chart_admit_track_provider_link_v1(uuid)
is
  'Authenticated manage_charts broker for one governed Track provider-link admission. Provider Identity V1 requires strong ISRC evidence before evidence/grant/execution/verifier stages begin.';

commit;
