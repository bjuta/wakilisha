-- Verify WAKILISHA M4 Artist Updates -> Following authority.

do $verify_m4_artist_updates_following$
declare
  v_event_constraint text;
  v_save_constraint text;
  v_publish_definition text;
  v_edit_definition text;
  v_withdraw_definition text;
  v_reader_definition text;
  v_manage_reader_definition text;
  v_feed_definition text;
  v_save_definition text;
  v_reaction_reader_definition text;
  v_reaction_writer_definition text;
begin
  if to_regclass('public.artist_updates') is null then
    raise exception 'M4_VERIFY: artist_updates is missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'artist_updates'
      and c.relrowsecurity = true
  ) then
    raise exception 'M4_VERIFY: artist_updates RLS is not enabled';
  end if;

  if has_table_privilege('anon', 'public.artist_updates', 'select')
     or has_table_privilege('authenticated', 'public.artist_updates', 'select')
     or has_table_privilege('authenticated', 'public.artist_updates', 'insert')
     or has_table_privilege('authenticated', 'public.artist_updates', 'update')
     or has_table_privilege('authenticated', 'public.artist_updates', 'delete')
  then
    raise exception 'M4_VERIFY: direct Artist Update table privilege leaked';
  end if;

  if to_regprocedure('public.community_publish_artist_update(uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_edit_artist_update(uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_withdraw_artist_update(uuid,text)') is null
     or to_regprocedure('public.community_get_artist_update(uuid)') is null
     or to_regprocedure('public.community_get_artist_manage_updates(uuid,integer)') is null
  then
    raise exception 'M4_VERIFY: one or more Artist Update functions are missing';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_publish_artist_update(uuid,text,text,text,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_edit_artist_update(uuid,text,text,text,text)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_withdraw_artist_update(uuid,text)',
       'execute'
     )
     or not has_function_privilege(
       'anon',
       'public.community_get_artist_update(uuid)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_artist_update(uuid)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_artist_manage_updates(uuid,integer)',
       'execute'
     )
  then
    raise exception 'M4_VERIFY: required Artist Update function grants are missing';
  end if;

  select pg_get_constraintdef(oid)
  into v_event_constraint
  from pg_constraint
  where conrelid = 'public.artist_representation_events'::regclass
    and conname = 'artist_representation_events_event_type_check';

  if v_event_constraint is null
     or position('artist_update_published' in v_event_constraint) = 0
     or position('artist_update_edited' in v_event_constraint) = 0
     or position('artist_update_withdrawn' in v_event_constraint) = 0
  then
    raise exception 'M4_VERIFY: representation event ledger is incomplete';
  end if;

  select pg_get_constraintdef(oid)
  into v_save_constraint
  from pg_constraint
  where conrelid = 'public.community_saves'::regclass
    and conname = 'community_saves_entity_type_capability_check';

  if v_save_constraint is null
     or position('artist_update' in v_save_constraint) = 0
  then
    raise exception 'M4_VERIFY: Save capability excludes Artist Updates';
  end if;

  select pg_get_functiondef(
    'public.community_publish_artist_update(uuid,text,text,text,text)'::regprocedure
  ) into v_publish_definition;

  select pg_get_functiondef(
    'public.community_edit_artist_update(uuid,text,text,text,text)'::regprocedure
  ) into v_edit_definition;

  select pg_get_functiondef(
    'public.community_withdraw_artist_update(uuid,text)'::regprocedure
  ) into v_withdraw_definition;

  select pg_get_functiondef(
    'public.community_get_artist_update(uuid)'::regprocedure
  ) into v_reader_definition;

  select pg_get_functiondef(
    'public.community_get_artist_manage_updates(uuid,integer)'::regprocedure
  ) into v_manage_reader_definition;

  select pg_get_functiondef(
    'public.community_get_following_feed(integer,timestamp with time zone,text)'::regprocedure
  ) into v_feed_definition;

  select pg_get_functiondef(
    'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)'::regprocedure
  ) into v_save_definition;

  select pg_get_functiondef(
    'public.community_get_reaction_state_for_public_targets(jsonb)'::regprocedure
  ) into v_reaction_reader_definition;

  select pg_get_functiondef(
    'public.community_react_to_target(text,uuid,text)'::regprocedure
  ) into v_reaction_writer_definition;

  if position('can_post_updates' in v_publish_definition) = 0
     or position('can_post_updates' in v_edit_definition) = 0
     or position('can_post_updates' in v_withdraw_definition) = 0
     or position('can_post_updates' in v_manage_reader_definition) = 0
  then
    raise exception 'M4_VERIFY: can_post_updates is not the complete update authority';
  end if;

  if position('artist_updates' in v_feed_definition) = 0
     or position('registry_release_artists' in v_feed_definition) = 0
     or position('artist_raw_outputs' in v_feed_definition) = 0
     or position('partition by candidate.reason_target_id' in lower(v_feed_definition)) = 0
  then
    raise exception 'M4_VERIFY: Following does not share one Artist output limit across Releases and Updates';
  end if;

  if position('artist_update' in v_save_definition) = 0
     or position('artist_update' in v_reaction_reader_definition) = 0
     or position('artist_update' in v_reaction_writer_definition) = 0
  then
    raise exception 'M4_VERIFY: Save or Reaction capability is incomplete';
  end if;

  if position('status = ''published''' in v_reader_definition) = 0 then
    raise exception 'M4_VERIFY: public Artist Update reader is not publication-bound';
  end if;

  if v_publish_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.]registry_artists'
     or v_edit_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.]registry_artists'
     or v_withdraw_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.]registry_artists'
  then
    raise exception 'M4_VERIFY: Artist Update command can mutate canonical Registry Artist rows';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'community_publish_artist_update(uuid,text,text,text,text)'
      and access_class = 'authenticated_command'
  )
     or not exists (
       select 1
       from private.phase_0a_rpc_classification
       where function_signature =
             'community_get_artist_update(uuid)'
         and access_class = 'public_read'
     )
  then
    raise exception 'M4_VERIFY: RPC classification is incomplete';
  end if;
end;
$verify_m4_artist_updates_following$;

select jsonb_build_object(
  'verification', 'PASS',
  'updates_table', to_regclass('public.artist_updates')::text,
  'publisher', to_regprocedure('public.community_publish_artist_update(uuid,text,text,text,text)')::text,
  'editor', to_regprocedure('public.community_edit_artist_update(uuid,text,text,text,text)')::text,
  'withdrawer', to_regprocedure('public.community_withdraw_artist_update(uuid,text)')::text,
  'public_reader', to_regprocedure('public.community_get_artist_update(uuid)')::text,
  'manage_reader', to_regprocedure('public.community_get_artist_manage_updates(uuid,integer)')::text,
  'following_reader', to_regprocedure('public.community_get_following_feed(integer,timestamp with time zone,text)')::text
) as m4_artist_updates_following;
