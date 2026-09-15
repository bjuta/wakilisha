-- WAKILISHA / MIZIZI Slice 2 / #939
-- Boundary B1 repair: converge execution-grant target subject vocabulary
-- with accepted relation-admission subjects.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'wk939-registry-execution-grant-relation-subjects-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('platform_private.registry_execution_grant_targets') is null then
    raise exception
      'STOP: Registry execution grant target authority is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='platform_private.registry_execution_grant_targets'::regclass
      and conname='registry_execution_grant_targets_subject_type_check'
  ) then
    raise exception
      'STOP: Registry execution target subject constraint is missing';
  end if;
end
$preflight$;

alter table platform_private.registry_execution_grant_targets
  drop constraint registry_execution_grant_targets_subject_type_check;

alter table platform_private.registry_execution_grant_targets
  add constraint registry_execution_grant_targets_subject_type_check
  check (
    subject_type = any(
      array[
        'artist',
        'track',
        'release',
        'registry_relationship',
        'track_artist_credit',
        'release_track_membership',
        'release_artist_credit'
      ]::text[]
    )
  );

do $proof$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid)
  into v_def
  from pg_constraint
  where conrelid='platform_private.registry_execution_grant_targets'::regclass
    and conname='registry_execution_grant_targets_subject_type_check';

  if v_def not like '%track_artist_credit%'
     or v_def not like '%release_track_membership%'
     or v_def not like '%release_artist_credit%'
  then
    raise exception
      'STOP: Registry execution target subject vocabulary did not converge';
  end if;
end
$proof$;

commit;
