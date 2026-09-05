-- Chart Source Soak V3 scheduler.
-- Arms a credential-free seven-day cloud soak using pg_cron when available.
-- The first scheduled six-hour slot becomes Attempt 3 start authority.
-- A slot at the exact seven-day boundary is refused, yielding 28 intended
-- scheduled observations across [start, start + 7 days).
-- Collector runs five minutes after each enqueue slot and self-unschedules
-- both jobs once the boundary is reached and no pending run remains.

create unique index chart_source_soak_v3_runs_soak_slot_uq
on private.chart_source_soak_v3_runs (scheduled_for_utc)
where mode = 'soak' and scheduled_for_utc is not null;

create table private.chart_source_soak_v3_scheduler_control (
  control_id boolean primary key default true check (control_id),
  state text not null default 'armed'
    check (state in ('armed', 'running', 'closed')),
  started_at_utc timestamptz,
  ends_at_utc timestamptz,
  first_run_id uuid
    references private.chart_source_soak_v3_runs(run_id)
    on delete restrict,
  last_run_id uuid
    references private.chart_source_soak_v3_runs(run_id)
    on delete restrict,
  last_scheduled_for_utc timestamptz,
  enqueue_job_id bigint,
  collect_job_id bigint,
  created_at_utc timestamptz not null default clock_timestamp(),
  updated_at_utc timestamptz not null default clock_timestamp(),
  closed_at_utc timestamptz,
  check (
    (started_at_utc is null and ends_at_utc is null)
    or ends_at_utc = started_at_utc + interval '7 days'
  )
);

insert into private.chart_source_soak_v3_scheduler_control(control_id)
values (true);

revoke all
on table private.chart_source_soak_v3_scheduler_control
from public, anon, authenticated;

create or replace function private.chart_source_soak_v3_slot_utc(
  p_now timestamptz
)
returns timestamptz
language sql
immutable
set search_path = pg_catalog
as $$
  select (
    date_trunc('day', p_now at time zone 'UTC')
    + make_interval(
        hours => (
          extract(hour from p_now at time zone 'UTC')::integer / 6
        ) * 6
      )
  ) at time zone 'UTC';
$$;

create or replace function private.chart_source_soak_v3_scheduled_enqueue()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_slot timestamptz :=
    private.chart_source_soak_v3_slot_utc(clock_timestamp());
  v_started timestamptz;
  v_ends timestamptz;
  v_existing_run uuid;
  v_run_id uuid;
begin
  perform pg_advisory_xact_lock(
    hashtext('wakilisha-chart-source-soak-v3-scheduled-enqueue')
  );

  select started_at_utc, ends_at_utc
    into v_started, v_ends
  from private.chart_source_soak_v3_scheduler_control
  where control_id
  for update;

  if v_started is null then
    v_started := v_slot;
    v_ends := v_slot + interval '7 days';

    update private.chart_source_soak_v3_scheduler_control
    set
      state = 'running',
      started_at_utc = v_started,
      ends_at_utc = v_ends,
      updated_at_utc = clock_timestamp()
    where control_id;
  end if;

  if v_slot >= v_ends then
    update private.chart_source_soak_v3_scheduler_control
    set
      state = 'closed',
      closed_at_utc = coalesce(closed_at_utc, clock_timestamp()),
      updated_at_utc = clock_timestamp()
    where control_id;

    return jsonb_build_object(
      'enqueued', false,
      'reason', 'seven_day_boundary_reached',
      'scheduled_for_utc', v_slot,
      'started_at_utc', v_started,
      'ends_at_utc', v_ends
    );
  end if;

  select run_id
    into v_existing_run
  from private.chart_source_soak_v3_runs
  where mode = 'soak'
    and scheduled_for_utc = v_slot;

  if v_existing_run is not null then
    return jsonb_build_object(
      'enqueued', false,
      'reason', 'slot_already_exists',
      'run_id', v_existing_run,
      'scheduled_for_utc', v_slot,
      'started_at_utc', v_started,
      'ends_at_utc', v_ends
    );
  end if;

  v_run_id := private.chart_source_soak_v3_enqueue('soak', v_slot);

  update private.chart_source_soak_v3_scheduler_control
  set
    first_run_id = coalesce(first_run_id, v_run_id),
    last_run_id = v_run_id,
    last_scheduled_for_utc = v_slot,
    updated_at_utc = clock_timestamp()
  where control_id;

  return jsonb_build_object(
    'enqueued', true,
    'run_id', v_run_id,
    'scheduled_for_utc', v_slot,
    'started_at_utc', v_started,
    'ends_at_utc', v_ends
  );
end;
$$;

create or replace function private.chart_source_soak_v3_collect_due()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_run record;
  v_result jsonb;
  v_collected integer := 0;
  v_pending integer := 0;
  v_ends timestamptz;
  v_unscheduled boolean := false;
begin
  perform pg_advisory_xact_lock(
    hashtext('wakilisha-chart-source-soak-v3-collect-due')
  );

  for v_run in
    select run_id
    from private.chart_source_soak_v3_runs
    where mode = 'soak'
      and status in ('pending', 'partial')
      and enqueued_at_utc <= clock_timestamp() - interval '2 minutes'
    order by scheduled_for_utc, enqueued_at_utc
  loop
    v_result := private.chart_source_soak_v3_collect(v_run.run_id);
    v_collected := v_collected + 1;
  end loop;

  select ends_at_utc
    into v_ends
  from private.chart_source_soak_v3_scheduler_control
  where control_id
  for update;

  select count(*)
    into v_pending
  from private.chart_source_soak_v3_runs
  where mode = 'soak'
    and status in ('pending', 'partial');

  if v_ends is not null
     and clock_timestamp() >= v_ends
     and v_pending = 0
  then
    update private.chart_source_soak_v3_scheduler_control
    set
      state = 'closed',
      closed_at_utc = coalesce(closed_at_utc, clock_timestamp()),
      updated_at_utc = clock_timestamp()
    where control_id;

    if to_regprocedure('cron.unschedule(text)') is not null then
      execute 'select cron.unschedule($1)'
        using 'wakilisha-chart-source-soak-v3-enqueue';
      execute 'select cron.unschedule($1)'
        using 'wakilisha-chart-source-soak-v3-collect';
      v_unscheduled := true;
    end if;
  end if;

  return jsonb_build_object(
    'collected_run_count', v_collected,
    'pending_run_count', v_pending,
    'ends_at_utc', v_ends,
    'jobs_unscheduled', v_unscheduled
  );
end;
$$;

revoke all
on function private.chart_source_soak_v3_slot_utc(timestamptz)
from public, anon, authenticated;

revoke all
on function private.chart_source_soak_v3_scheduled_enqueue()
from public, anon, authenticated;

revoke all
on function private.chart_source_soak_v3_collect_due()
from public, anon, authenticated;

comment on table private.chart_source_soak_v3_scheduler_control is
  'Attempt 3 scheduler authority. First scheduled six-hour slot defines start; exact seven-day boundary is excluded.';

comment on function private.chart_source_soak_v3_scheduled_enqueue() is
  'Enqueues at most one soak run for each canonical six-hour UTC slot in [start, start + 7 days).';

comment on function private.chart_source_soak_v3_collect_due() is
  'Collects pending soak runs after pg_net response settlement and self-unschedules Attempt 3 jobs after the seven-day boundary.';

do $scheduler$
declare
  v_enqueue_job_id bigint;
  v_collect_job_id bigint;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    if to_regprocedure('cron.unschedule(text)') is not null then
      begin
        execute 'select cron.unschedule($1)'
          using 'wakilisha-chart-source-soak-v3-enqueue';
      exception
        when others then null;
      end;

      begin
        execute 'select cron.unschedule($1)'
          using 'wakilisha-chart-source-soak-v3-collect';
      exception
        when others then null;
      end;
    end if;

    execute
      'select cron.schedule($1, $2, $3)'
      into v_enqueue_job_id
      using
        'wakilisha-chart-source-soak-v3-enqueue',
        '0 */6 * * *',
        'select private.chart_source_soak_v3_scheduled_enqueue();';

    execute
      'select cron.schedule($1, $2, $3)'
      into v_collect_job_id
      using
        'wakilisha-chart-source-soak-v3-collect',
        '5 */6 * * *',
        'select private.chart_source_soak_v3_collect_due();';

    update private.chart_source_soak_v3_scheduler_control
    set
      enqueue_job_id = v_enqueue_job_id,
      collect_job_id = v_collect_job_id,
      updated_at_utc = clock_timestamp()
    where control_id;
  end if;
end;
$scheduler$;
