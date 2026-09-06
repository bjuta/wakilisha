-- Phase 8B.2 Messages User Commands + Reads replay verifier.
-- Read-only structural verification; transaction is rolled back.

begin;

do $verify$
declare
  v_expected_commands text[] := array[
    'messages.conversation.start',
    'messages.mailbox.move',
    'messages.message.send',
    'messages.preferences.update',
    'messages.request.accept',
    'messages.request.decline',
    'messages.sender_approval.revoke'
  ];
  v_actual_commands text[];
  v_rpc text;
  v_oid oid;
  v_rpc_count bigint;
  v_core jsonb;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 96
     or (select max(version) from supabase_migrations.schema_migrations)
        <> '20260906154236'
  then
    raise exception
      'STOP: expected exact 96 / 20260906154236 migration authority';
  end if;

  v_core := messaging.verify_core_foundation();

  if coalesce((v_core->>'ok')::boolean, false) is not true then
    raise exception
      'STOP: Candidate A Messages core verifier is not green';
  end if;

  select array_agg(command_type order by command_type)
    into v_actual_commands
  from platform_private.command_types
  where command_type like 'messages.%';

  if v_actual_commands is distinct from v_expected_commands then
    raise exception
      'STOP: Messages command type contract drifted: %',
      v_actual_commands;
  end if;

  select count(*) into v_rpc_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'start_message_conversation',
      'send_message',
      'accept_message_request',
      'decline_message_request',
      'move_message_conversation',
      'revoke_message_sender_approval',
      'update_my_message_sender_policy',
      'mark_my_message_conversation_read',
      'get_my_message_preferences',
      'get_my_message_unread_counts',
      'list_my_message_conversations',
      'get_my_message_conversation'
    );

  if v_rpc_count <> 12 then
    raise exception
      'STOP: expected exactly 12 public Messages RPCs, found %',
      v_rpc_count;
  end if;

  foreach v_rpc in array array[
    'public.start_message_conversation(uuid,text,jsonb,text,uuid,timestamptz)',
    'public.send_message(uuid,text,jsonb,text,uuid,timestamptz)',
    'public.accept_message_request(uuid,text,uuid)',
    'public.decline_message_request(uuid,text,uuid)',
    'public.move_message_conversation(uuid,text,text,uuid)',
    'public.revoke_message_sender_approval(uuid,text,uuid)',
    'public.update_my_message_sender_policy(text,bigint,text,boolean,boolean,boolean,boolean,text,uuid)',
    'public.mark_my_message_conversation_read(uuid,uuid)',
    'public.get_my_message_preferences()',
    'public.get_my_message_unread_counts()',
    'public.list_my_message_conversations(text,timestamptz,uuid,integer)',
    'public.get_my_message_conversation(uuid,timestamptz,uuid,integer)'
  ] loop
    v_oid := to_regprocedure(v_rpc);

    if v_oid is null then
      raise exception
        'STOP: required Messages RPC is missing: %',
        v_rpc;
    end if;

    if not (select prosecdef from pg_proc where oid=v_oid) then
      raise exception
        'STOP: Messages RPC is not SECURITY DEFINER: %',
        v_rpc;
    end if;

    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception
        'STOP: anon can execute Messages RPC: %',
        v_rpc;
    end if;

    if not has_function_privilege(
      'authenticated',
      v_oid,
      'EXECUTE'
    ) then
      raise exception
        'STOP: authenticated cannot execute Messages RPC: %',
        v_rpc;
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema='messaging'
      and grantee in ('anon','authenticated')
  ) then
    raise exception
      'STOP: browser role has direct Messages table privilege';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid='messaging.messages'::regclass
      and conname='messages_command_receipt_fkey'
      and pg_get_constraintdef(oid)=
        'FOREIGN KEY (command_receipt_id) REFERENCES platform_private.command_receipts(id) ON UPDATE RESTRICT ON DELETE RESTRICT'
  ) then
    raise exception
      'STOP: Messages command receipt foreign key contract drifted';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='messaging'
      and tablename='messages'
      and indexname='messages_command_receipt_idx'
      and indexdef ilike '%(command_receipt_id)%'
      and indexdef ilike '%where (command_receipt_id is not null)%'
  ) then
    raise exception
      'STOP: Messages command receipt index contract drifted';
  end if;

  if (select count(*) from messaging.runtime_policy) <> 1
     or not exists (
       select 1
       from messaging.runtime_policy
       where singleton
         and audience_mode='internal'
         and revision=1
     )
  then
    raise exception
      'STOP: Messages runtime policy changed during Candidate B';
  end if;

  if (
    select count(*)
    from public.user_role_assignments
    where role_key='super_admin'
  ) <> 0
  then
    raise exception
      'STOP: Candidate B unexpectedly assigned super_admin';
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification',
    'PASS',
  'migration_count',
    (select count(*) from supabase_migrations.schema_migrations),
  'migration_head',
    (select max(version) from supabase_migrations.schema_migrations),
  'command_types',
    (
      select count(*)
      from platform_private.command_types
      where command_type like 'messages.%'
    ),
  'authenticated_rpcs',
    (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in (
          'start_message_conversation',
          'send_message',
          'accept_message_request',
          'decline_message_request',
          'move_message_conversation',
          'revoke_message_sender_approval',
          'update_my_message_sender_policy',
          'mark_my_message_conversation_read',
          'get_my_message_preferences',
          'get_my_message_unread_counts',
          'list_my_message_conversations',
          'get_my_message_conversation'
        )
    ),
  'anon_rpc_access',
    (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname in (
          'start_message_conversation',
          'send_message',
          'accept_message_request',
          'decline_message_request',
          'move_message_conversation',
          'revoke_message_sender_approval',
          'update_my_message_sender_policy',
          'mark_my_message_conversation_read',
          'get_my_message_preferences',
          'get_my_message_unread_counts',
          'list_my_message_conversations',
          'get_my_message_conversation'
        )
        and has_function_privilege(
          'anon',
          p.oid,
          'EXECUTE'
        )
    ),
  'audience_mode',
    (
      select audience_mode
      from messaging.runtime_policy
      where singleton
    ),
  'super_admin_assignments',
    (
      select count(*)
      from public.user_role_assignments
      where role_key='super_admin'
    ),
  'candidate_a_verifier',
    messaging.verify_core_foundation()
) as phase_8b_messages_user_commands_reads_acceptance;

rollback;
