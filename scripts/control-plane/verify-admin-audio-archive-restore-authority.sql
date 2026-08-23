-- Permanent verifier: governed Audio archive/restore authority and shared Admin action support.
-- Safe to run repeatedly against preview or production after the migration lands.

do $verify_admin_audio_archive_restore$
declare
  v_archive_definition text;
  v_restore_definition text;
  v_workspace_definition text;
  v_public_read_definition text;
begin
  if to_regclass('audio.publication_lifecycle_events') is null then
    raise exception 'STOP: audio.publication_lifecycle_events is missing';
  end if;

  if not exists (
    select 1
    from pg_class relation
    where relation.oid = 'audio.publication_lifecycle_events'::regclass
      and relation.relrowsecurity
  ) then
    raise exception 'STOP: Audio lifecycle events must have RLS enabled';
  end if;

  if has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'SELECT')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'INSERT')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'UPDATE')
     or has_table_privilege('authenticated', 'audio.publication_lifecycle_events', 'DELETE')
     or has_table_privilege('anon', 'audio.publication_lifecycle_events', 'SELECT')
  then
    raise exception 'STOP: Audio lifecycle event authority leaked direct table privileges';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'audio.publication_lifecycle_events'::regclass
      and constraint_row.contype = 'f'
      and pg_get_constraintdef(constraint_row.oid) like
        'FOREIGN KEY (resource_id, publication_id) REFERENCES editorial.audio_publication_resources(resource_id, publication_id)%'
  ) then
    raise exception 'STOP: Audio lifecycle events are not bound to canonical Audio Resource identity';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'audio.publication_lifecycle_events'::regclass
      and constraint_row.contype = 'f'
      and pg_get_constraintdef(constraint_row.oid) like
        'FOREIGN KEY (command_receipt_id) REFERENCES platform_private.command_receipts(id)%'
  ) then
    raise exception 'STOP: Audio lifecycle events are not bound to command receipts';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'audio.publication_lifecycle_events'::regclass
      and trigger_row.tgname = 'audio_publication_lifecycle_events_append_only'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'D'
  ) then
    raise exception 'STOP: Audio lifecycle event append-only protection is missing';
  end if;

  if not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = 'audio.publication.archive'
      and command_type.enabled
  ) or not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = 'audio.publication.restore'
      and command_type.enabled
  ) then
    raise exception 'STOP: Audio archive/restore command types are not enabled';
  end if;

  if to_regprocedure(
    'public.archive_audio_publication(uuid,bigint,text,text,uuid)'
  ) is null
     or to_regprocedure(
       'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)'
     ) is null
  then
    raise exception 'STOP: Audio archive/restore RPC authority is incomplete';
  end if;

  if not has_function_privilege(
        'authenticated',
        'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
        'EXECUTE'
      )
     or not has_function_privilege(
        'authenticated',
        'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)',
        'EXECUTE'
      )
     or has_function_privilege(
        'anon',
        'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
        'EXECUTE'
      )
     or has_function_privilege(
        'anon',
        'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)',
        'EXECUTE'
      )
  then
    raise exception 'STOP: Audio archive/restore RPC grants are incorrect';
  end if;

  v_archive_definition := pg_get_functiondef(
    'public.archive_audio_publication(uuid,bigint,text,text,uuid)'::regprocedure
  );
  v_restore_definition := pg_get_functiondef(
    'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)'::regprocedure
  );
  v_workspace_definition := pg_get_functiondef(
    'public.get_admin_audio_publication_workspace(uuid)'::regprocedure
  );
  v_public_read_definition := pg_get_functiondef(
    'public.get_public_audio_publication_m1(text)'::regprocedure
  );

  if position('delete_audio' in v_archive_definition) = 0
     or position('current_published_version_id = null' in lower(v_archive_definition)) = 0
     or position('lifecycle_state = ''archived''' in lower(v_archive_definition)) = 0
     or position('visibility = ''private''' in lower(v_archive_definition)) = 0
     or position('append_publication_lifecycle_event' in v_archive_definition) = 0
  then
    raise exception 'STOP: Audio archive command no longer performs reversible governed retirement';
  end if;

  if position('current_user_can_edit_audio' in v_restore_definition) = 0
     or position('status <> ''archived''' in lower(v_restore_definition)) = 0
     or position('lifecycle_state = ''draft''' in lower(v_restore_definition)) = 0
     or position('visibility = ''internal''' in lower(v_restore_definition)) = 0
     or position('append_publication_lifecycle_event' in v_restore_definition) = 0
  then
    raise exception 'STOP: Audio restore command no longer returns archived Audio to governed draft authority';
  end if;

  if position('lifecycle_events' in v_workspace_definition) = 0
     or position('can_archive' in v_workspace_definition) = 0
     or position('delete_audio' in v_workspace_definition) = 0
  then
    raise exception 'STOP: Admin Audio read model does not project lifecycle history and archive capability';
  end if;

  -- Public Audio already fails closed unless exact published authority remains.
  -- Keep that invariant explicit so archive cannot accidentally leave a live route.
  if position('publication.status = ''published''' in lower(v_public_read_definition)) = 0
     or position('resource_row.lifecycle_state = ''published''' in lower(v_public_read_definition)) = 0
     or position('resource_row.visibility = ''public''' in lower(v_public_read_definition)) = 0
     or position('current_published_version_id is not null' in lower(v_public_read_definition)) = 0
  then
    raise exception 'STOP: public Audio read authority no longer fails closed for archived records';
  end if;
end;
$verify_admin_audio_archive_restore$;

select 'ADMIN_AUDIO_ARCHIVE_RESTORE_AUTHORITY_PASS' as result;
