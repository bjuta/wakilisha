-- Mlinzi Registry Steward durable machine-memory verifier.
-- Read-only.

do $mlinzi_verify$
declare
  v_bad_privileges bigint;
  v_bad_findings bigint;
  v_bad_checkpoints bigint;
begin
  if to_regclass('platform_private.registry_steward_findings') is null
     or to_regclass('platform_private.registry_steward_checkpoints') is null
  then
    raise exception 'MLINZI FAIL: private steward state tables are missing';
  end if;

  select
    (
      case when has_table_privilege(
        'anon',
        'platform_private.registry_steward_findings',
        'select'
      ) then 1 else 0 end
      +
      case when has_table_privilege(
        'authenticated',
        'platform_private.registry_steward_findings',
        'select'
      ) then 1 else 0 end
      +
      case when has_table_privilege(
        'anon',
        'platform_private.registry_steward_checkpoints',
        'select'
      ) then 1 else 0 end
      +
      case when has_table_privilege(
        'authenticated',
        'platform_private.registry_steward_checkpoints',
        'select'
      ) then 1 else 0 end
    )
  into v_bad_privileges;

  if v_bad_privileges <> 0 then
    raise exception
      'MLINZI FAIL: browser roles can read private steward state';
  end if;

  if not has_table_privilege(
       'service_role',
       'platform_private.registry_steward_findings',
       'select,insert,update,delete'
     )
     or not has_table_privilege(
       'service_role',
       'platform_private.registry_steward_checkpoints',
       'select,insert,update,delete'
     )
  then
    raise exception
      'MLINZI FAIL: service_role cannot operate private steward state';
  end if;

  select count(*)
  into v_bad_findings
  from platform_private.registry_steward_findings finding
  where finding.retry_count < 0
     or jsonb_typeof(finding.context) <> 'object'
     or (
       finding.disposition = 'human_required'
       and finding.human_required_at is null
     )
     or (
       finding.disposition = 'resolved'
       and finding.resolved_at is null
     )
     or (
       finding.disposition <> 'resolved'
       and finding.resolved_at is not null
     );

  if v_bad_findings <> 0 then
    raise exception
      'MLINZI FAIL: invalid durable findings = %',
      v_bad_findings;
  end if;

  select count(*)
  into v_bad_checkpoints
  from platform_private.registry_steward_checkpoints checkpoint
  where checkpoint.rows_scanned < 0
     or jsonb_typeof(checkpoint.context) <> 'object';

  if v_bad_checkpoints <> 0 then
    raise exception
      'MLINZI FAIL: invalid checkpoints = %',
      v_bad_checkpoints;
  end if;

  raise notice
    'MLINZI PASS: private findings %, checkpoints %, browser exposure 0',
    (
      select count(*)
      from platform_private.registry_steward_findings
    ),
    (
      select count(*)
      from platform_private.registry_steward_checkpoints
    );
end;
$mlinzi_verify$;
