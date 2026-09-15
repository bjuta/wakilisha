begin;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

-- Account retirement must remain compatible with the Phase 7A historical
-- typed-event freeze. The retained typed event tables are immutable evidence,
-- but their actor_id foreign keys intentionally follow the canonical shared
-- Resource-event contract: auth.users(id) ON DELETE SET NULL.
--
-- The Phase 7A freeze was installed as a statement-level BEFORE UPDATE trigger.
-- PostgreSQL fires that trigger for the FK-maintenance UPDATE issued by
-- ON DELETE SET NULL even when no historical rows match the retiring user.
-- This made every governed Auth-account deletion fail closed.
--
-- Repair:
--   * retain all five historical tables;
--   * retain all five actor_id -> auth.users ON DELETE SET NULL FKs;
--   * retain the same closed application ACLs;
--   * move the freeze to FOR EACH ROW so zero-row FK maintenance is harmless;
--   * allow only a nested actor_id UUID -> NULL transition with every other
--     column byte-for-byte unchanged. This is the FK-maintenance transition
--     required by governed account retirement. All inserts, deletes, direct
--     updates, and other row changes remain rejected.

do $historical_event_actor_retirement_preflight$
declare
  v_count bigint;
begin
  select count(*)
  into v_count
  from pg_trigger
  where not tgisinternal
    and tgname in (
      'article_lifecycle_events_historical_freeze',
      'playlist_lifecycle_events_historical_freeze',
      'playlist_review_events_historical_freeze',
      'audio_publication_lifecycle_events_historical_freeze',
      'audio_publication_review_events_historical_freeze'
    );

  if v_count <> 5 then
    raise exception
      'STOP: expected five historical event freeze triggers before retirement compatibility repair, found %',
      v_count;
  end if;

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
      'STOP: historical actor ON DELETE SET NULL authority drifted before repair; expected 5, found %',
      v_count;
  end if;
end;
$historical_event_actor_retirement_preflight$;

create or replace function
platform_private.reject_frozen_historical_event_mutation()
returns trigger
language plpgsql
set search_path = 'pg_catalog'
as $function$
begin
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and old.actor_id is not null
     and new.actor_id is null
     and (to_jsonb(old) - 'actor_id') =
         (to_jsonb(new) - 'actor_id')
  then
    return new;
  end if;

  raise exception
    using
      errcode = '55000',
      message = 'Historical typed event tables are frozen evidence. Use shared Resource event authority.';
end;
$function$;

revoke all privileges
on function platform_private.reject_frozen_historical_event_mutation()
from public, anon, authenticated, service_role;

drop trigger if exists article_lifecycle_events_historical_freeze
on editorial.article_lifecycle_events;
create trigger article_lifecycle_events_historical_freeze
before insert or update or delete on editorial.article_lifecycle_events
for each row
execute function platform_private.reject_frozen_historical_event_mutation();

drop trigger if exists playlist_lifecycle_events_historical_freeze
on editorial.playlist_lifecycle_events;
create trigger playlist_lifecycle_events_historical_freeze
before insert or update or delete on editorial.playlist_lifecycle_events
for each row
execute function platform_private.reject_frozen_historical_event_mutation();

drop trigger if exists playlist_review_events_historical_freeze
on editorial.playlist_review_events;
create trigger playlist_review_events_historical_freeze
before insert or update or delete on editorial.playlist_review_events
for each row
execute function platform_private.reject_frozen_historical_event_mutation();

drop trigger if exists audio_publication_lifecycle_events_historical_freeze
on audio.publication_lifecycle_events;
create trigger audio_publication_lifecycle_events_historical_freeze
before insert or update or delete on audio.publication_lifecycle_events
for each row
execute function platform_private.reject_frozen_historical_event_mutation();

drop trigger if exists audio_publication_review_events_historical_freeze
on audio.publication_review_events;
create trigger audio_publication_review_events_historical_freeze
before insert or update or delete on audio.publication_review_events
for each row
execute function platform_private.reject_frozen_historical_event_mutation();

do $historical_event_actor_retirement_postflight$
declare
  v_count bigint;
  v_definition text;
begin
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
      'STOP: historical event freeze triggers are not all row-scoped after repair; found %',
      v_count;
  end if;

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
      'STOP: historical actor ON DELETE SET NULL authority changed during repair; expected 5, found %',
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
      'STOP: historical event retirement-maintenance guard is incomplete';
  end if;
end;
$historical_event_actor_retirement_postflight$;

comment on function platform_private.reject_frozen_historical_event_mutation()
is 'Rejects all retired typed-event mutation except nested auth-user retirement maintenance that only nulls actor_id while preserving every other historical field.';

commit;
