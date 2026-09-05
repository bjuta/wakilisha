-- Charts Public-Source Accessibility Soak V3 scheduler replay verifier.
-- Structural only: no external HTTP requests and no cron job execution.

begin;

do $verify$
declare
  v_sched_oid oid;
  v_collect_oid oid;
  v_slot_oid oid;
  v_sched_def text;
  v_collect_def text;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 94
     or (select max(version) from supabase_migrations.schema_migrations)
        <> '20260905173000'
  then
    raise exception
      'STOP: expected exact 94 / 20260905173000 migration authority';
  end if;

  if to_regclass('private.chart_source_soak_v3_scheduler_control') is null then
    raise exception
      'STOP: scheduler control table missing';
  end if;

  if (
    select count(*)
    from private.chart_source_soak_v3_scheduler_control
  ) <> 1
  then
    raise exception
      'STOP: scheduler control must contain exactly one row';
  end if;

  if (
    select state
    from private.chart_source_soak_v3_scheduler_control
    where control_id
  ) <> 'armed'
  then
    raise exception
      'STOP: replay preview scheduler must remain armed';
  end if;

  if exists (
    select 1
    from private.chart_source_soak_v3_runs
    where mode = 'soak'
  ) then
    raise exception
      'STOP: replay verification must not create soak observations';
  end if;

  select p.oid
  into v_slot_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'chart_source_soak_v3_slot_utc'
    and pg_get_function_identity_arguments(p.oid) =
      'p_now timestamp with time zone';

  select p.oid
  into v_sched_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'chart_source_soak_v3_scheduled_enqueue'
    and pg_get_function_identity_arguments(p.oid) = '';

  select p.oid
  into v_collect_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'chart_source_soak_v3_collect_due'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_slot_oid is null or v_sched_oid is null or v_collect_oid is null then
    raise exception
      'STOP: one or more scheduler functions missing';
  end if;

  if not (select prosecdef from pg_proc where oid = v_sched_oid)
     or not (select prosecdef from pg_proc where oid = v_collect_oid)
  then
    raise exception
      'STOP: scheduler functions lost SECURITY DEFINER';
  end if;

  if (
    select private.chart_source_soak_v3_slot_utc(
      '2026-09-05 17:59:59+00'::timestamptz
    )
  ) <> '2026-09-05 12:00:00+00'::timestamptz
     or (
       select private.chart_source_soak_v3_slot_utc(
         '2026-09-05 18:00:00+00'::timestamptz
       )
     ) <> '2026-09-05 18:00:00+00'::timestamptz
  then
    raise exception
      'STOP: canonical six-hour UTC slot mapping drifted';
  end if;

  v_sched_def := pg_get_functiondef(v_sched_oid);
  v_collect_def := pg_get_functiondef(v_collect_oid);

  if position(
       'v_ends := v_slot + interval ''7 days'''
       in v_sched_def
     ) = 0
     or position('if v_slot >= v_ends then' in lower(v_sched_def)) = 0
     or position('slot_already_exists' in v_sched_def) = 0
  then
    raise exception
      'STOP: seven-day boundary or duplicate-slot guard drifted';
  end if;

  if position(
       'clock_timestamp() - interval ''2 minutes'''
       in v_collect_def
     ) = 0
     or position('cron.unschedule' in v_collect_def) = 0
  then
    raise exception
      'STOP: collector settlement or self-unschedule contract drifted';
  end if;

  if to_regprocedure('cron.schedule(text,text,text)') is null then
    if (
      select enqueue_job_id is not null or collect_job_id is not null
      from private.chart_source_soak_v3_scheduler_control
      where control_id
    ) then
      raise exception
        'STOP: preview without pg_cron unexpectedly recorded scheduler jobs';
    end if;
  end if;

  if has_function_privilege('anon', v_sched_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_sched_oid, 'EXECUTE')
     or has_function_privilege('anon', v_collect_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_collect_oid, 'EXECUTE')
  then
    raise exception
      'STOP: scheduler functions are publicly executable';
  end if;

  if has_table_privilege(
       'anon',
       'private.chart_source_soak_v3_scheduler_control',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'private.chart_source_soak_v3_scheduler_control',
       'SELECT'
     )
  then
    raise exception
      'STOP: scheduler control is publicly readable';
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'migration_count',
    (select count(*) from supabase_migrations.schema_migrations),
  'migration_head',
    (select max(version) from supabase_migrations.schema_migrations),
  'scheduler_state',
    (
      select state
      from private.chart_source_soak_v3_scheduler_control
      where control_id
    ),
  'pg_cron_available',
    to_regprocedure('cron.schedule(text,text,text)') is not null,
  'soak_runs_created',
    (
      select count(*)
      from private.chart_source_soak_v3_runs
      where mode = 'soak'
    ),
  'slot_175959',
    private.chart_source_soak_v3_slot_utc(
      '2026-09-05 17:59:59+00'::timestamptz
    ),
  'slot_180000',
    private.chart_source_soak_v3_slot_utc(
      '2026-09-05 18:00:00+00'::timestamptz
    )
) as chart_source_soak_v3_scheduler_acceptance;

rollback;
