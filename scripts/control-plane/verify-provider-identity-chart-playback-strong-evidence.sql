-- Permanent verifier: Provider Identity Chart Playback strong-evidence guard.
-- Read-only.
-- Expected marker:
-- PROVIDER_IDENTITY_CHART_PLAYBACK_STRONG_EVIDENCE_GUARD=PASS

do $verify$
declare
  v_guard regprocedure :=
    to_regprocedure(
      'platform_private.require_registry_chart_playback_provider_strong_identity_v1(uuid)'
    );
  v_broker regprocedure :=
    to_regprocedure('public.chart_admit_track_provider_link_v1(uuid)');
  v_guard_def text;
  v_broker_def text;
begin
  if v_guard is null or v_broker is null then
    raise exception
      'FAIL: strong-evidence helper or public Chart Playback broker is missing';
  end if;

  select lower(pg_get_functiondef(v_guard))
  into v_guard_def;

  select lower(pg_get_functiondef(v_broker))
  into v_broker_def;

  if position('match_method' in v_guard_def)=0
     or position('auto_accept' in v_guard_def)=0
     or position('''isrc''' in v_guard_def)=0
     or position('^[a-z0-9]{12}$' in v_guard_def)=0
     or position('raw_match_payload' in v_guard_def)=0
     or position('v_input_isrc<>v_provider_isrc' in v_guard_def)=0
  then
    raise exception
      'FAIL: strong-evidence helper lost required ISRC admission checks';
  end if;

  if position(
       'require_registry_chart_playback_provider_strong_identity_v1'
       in v_broker_def
     )=0
  then
    raise exception
      'FAIL: public Chart Playback broker does not invoke strong-evidence guard';
  end if;

  if has_function_privilege('anon',v_guard,'EXECUTE')
     or has_function_privilege('authenticated',v_guard,'EXECUTE')
     or has_function_privilege('service_role',v_guard,'EXECUTE')
  then
    raise exception
      'FAIL: private strong-evidence helper is directly executable by application roles';
  end if;

  if has_function_privilege('anon',v_broker,'EXECUTE')
     or not has_function_privilege('authenticated',v_broker,'EXECUTE')
     or has_function_privilege('service_role',v_broker,'EXECUTE')
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
      'FAIL: private Chart Playback provider stage became directly executable';
  end if;
end
$verify$;

select
  'PROVIDER_IDENTITY_CHART_PLAYBACK_STRONG_EVIDENCE_GUARD=PASS'
  as result;
