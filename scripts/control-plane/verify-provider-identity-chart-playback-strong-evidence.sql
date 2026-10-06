-- Permanent verifier for Provider Identity / Chart Playback strong-evidence guard.
-- Read-only. Expected terminal marker:
-- PROVIDER_IDENTITY_CHART_PLAYBACK_STRONG_EVIDENCE_GUARD=PASS

do $verify$
declare
  v_guard_def text;
  v_broker_def text;
begin
  if to_regprocedure(
       'platform_private.require_registry_chart_playback_provider_strong_identity_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.chart_admit_track_provider_link_v1(uuid)'
     ) is null
  then
    raise exception
      'FAIL: strong-evidence helper or public Chart Playback broker is missing';
  end if;

  select lower(pg_get_functiondef(p.oid))
  into v_guard_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='platform_private'
    and p.proname=
      'require_registry_chart_playback_provider_strong_identity_v1'
    and pg_get_function_identity_arguments(p.oid)='p_item_id uuid';

  select lower(pg_get_functiondef(p.oid))
  into v_broker_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='chart_admit_track_provider_link_v1'
    and pg_get_function_identity_arguments(p.oid)=
      'p_enrichment_item_id uuid';

  if v_guard_def is null
     or position('match_method' in v_guard_def)=0
     or position('auto_accept' in v_guard_def)=0
     or position('''isrc''' in v_guard_def)=0
     or position('^[a-z0-9]{12}$' in v_guard_def)=0
     or position('raw_match_payload' in v_guard_def)=0
  then
    raise exception
      'FAIL: strong-evidence helper lost required ISRC admission checks';
  end if;

  if v_broker_def is null
     or position(
       'require_registry_chart_playback_provider_strong_identity_v1'
       in v_broker_def
     )=0
  then
    raise exception
      'FAIL: public Chart Playback broker does not invoke strong-evidence guard';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.require_registry_chart_playback_provider_strong_identity_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.require_registry_chart_playback_provider_strong_identity_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.require_registry_chart_playback_provider_strong_identity_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: private strong-evidence helper is directly executable by application roles';
  end if;

  if has_function_privilege(
       'anon',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: public Chart Playback broker execution authority drifted';
  end if;

  if exists (
    select 1
    from (
      values
        ('record_registry_chart_playback_provider_evidence_v1'),
        ('issue_registry_chart_playback_provider_grant_v1'),
        ('execute_registry_chart_playback_provider_v1'),
        ('verify_registry_chart_playback_provider_v1')
    ) as required(proname)
    join pg_proc p on p.proname=required.proname
    join pg_namespace n
      on n.oid=p.pronamespace
     and n.nspname='platform_private'
    where has_function_privilege('anon',p.oid,'EXECUTE')
       or has_function_privilege('authenticated',p.oid,'EXECUTE')
       or has_function_privilege('service_role',p.oid,'EXECUTE')
  ) then
    raise exception
      'FAIL: a private Chart Playback provider stage became directly executable';
  end if;
end
$verify$;

select
  'PROVIDER_IDENTITY_CHART_PLAYBACK_STRONG_EVIDENCE_GUARD=PASS'
  as result;
