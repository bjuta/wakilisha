begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $verify_historical_event_account_retirement_compatibility$
declare
  v_count bigint;
  v_definition text;
begin
  select count(*)
  into v_count
  from pg_constraint constraint_row
  where constraint_row.contype = 'f'
    and constraint_row.confrelid = 'auth.users'::regclass
    and constraint_row.confdeltype = 'n'
    and constraint_row.conname in (
      'article_lifecycle_events_actor_id_fkey',
      'playlist_lifecycle_events_actor_fkey',
      'playlist_review_events_actor_fkey',
      'publication_lifecycle_events_actor_id_fkey',
      'publication_review_events_actor_id_fkey'
    );

  if v_count <> 5 then
    raise exception
      'HISTORICAL_EVENT_ACCOUNT_RETIREMENT_COMPATIBILITY_FAIL: expected 5 actor ON DELETE SET NULL constraints, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_trigger trigger_row
  where not trigger_row.tgisinternal
    and trigger_row.tgname in (
      'article_lifecycle_events_historical_freeze',
      'playlist_lifecycle_events_historical_freeze',
      'playlist_review_events_historical_freeze',
      'audio_publication_lifecycle_events_historical_freeze',
      'audio_publication_review_events_historical_freeze'
    )
    and pg_get_triggerdef(trigger_row.oid, true) ilike '%FOR EACH ROW%';

  if v_count <> 5 then
    raise exception
      'HISTORICAL_EVENT_ACCOUNT_RETIREMENT_COMPATIBILITY_FAIL: expected 5 row-scoped freeze triggers, found %',
      v_count;
  end if;

  v_definition := pg_get_functiondef(
    'platform_private.reject_frozen_historical_event_mutation()'::regprocedure
  );

  if position('pg_trigger_depth() > 1' in v_definition) = 0
     or position('old.actor_id is not null' in v_definition) = 0
     or position('new.actor_id is null' in v_definition) = 0
     or position('to_jsonb(old) - ''actor_id''' in v_definition) = 0
     or position('to_jsonb(new) - ''actor_id''' in v_definition) = 0
  then
    raise exception
      'HISTORICAL_EVENT_ACCOUNT_RETIREMENT_COMPATIBILITY_FAIL: actor-null maintenance guard is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.reject_frozen_historical_event_mutation()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.reject_frozen_historical_event_mutation()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.reject_frozen_historical_event_mutation()',
       'EXECUTE'
     )
  then
    raise exception
      'HISTORICAL_EVENT_ACCOUNT_RETIREMENT_COMPATIBILITY_FAIL: freeze helper leaked EXECUTE';
  end if;
end;
$verify_historical_event_account_retirement_compatibility$;

select
  'HISTORICAL_EVENT_ACCOUNT_RETIREMENT_COMPATIBILITY_PASS'
    as verification_result;

rollback;
