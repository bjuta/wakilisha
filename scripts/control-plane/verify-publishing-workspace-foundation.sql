do $publishing_workspace_foundation_verifier$
declare
  v_missing text[] := '{}';
  v_authenticated_writes integer;
  v_rls_disabled integer;
begin
  if to_regclass(
    'editorial.publishing_content_kinds'
  ) is null then
    v_missing := array_append(
      v_missing,
      'editorial.publishing_content_kinds'
    );
  end if;

  if to_regclass(
    'editorial.publishing_channels'
  ) is null then
    v_missing := array_append(
      v_missing,
      'editorial.publishing_channels'
    );
  end if;

  if to_regclass(
    'editorial.publishing_items'
  ) is null then
    v_missing := array_append(
      v_missing,
      'editorial.publishing_items'
    );
  end if;

  if to_regclass(
    'editorial.publishing_item_assignees'
  ) is null then
    v_missing := array_append(
      v_missing,
      'editorial.publishing_item_assignees'
    );
  end if;

  if to_regclass(
    'editorial.publishing_item_channels'
  ) is null then
    v_missing := array_append(
      v_missing,
      'editorial.publishing_item_channels'
    );
  end if;

  if to_regclass(
    'editorial.publishing_item_events'
  ) is null then
    v_missing := array_append(
      v_missing,
      'editorial.publishing_item_events'
    );
  end if;

  if to_regclass(
    'public.wk_publishing_workspace_items'
  ) is null then
    v_missing := array_append(
      v_missing,
      'public.wk_publishing_workspace_items'
    );
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception
      'Missing Publishing objects: %',
      array_to_string(v_missing, ', ');
  end if;

  if to_regprocedure(
    'editorial.current_user_can_manage_publishing()'
  ) is null then
    raise exception
      'Missing Publishing management authority';
  end if;

  if to_regprocedure(
    'editorial.current_user_can_view_publishing_item(uuid)'
  ) is null then
    raise exception
      'Missing Publishing read authority';
  end if;

  if to_regprocedure(
    'editorial.derive_publishing_editorial_state(uuid)'
  ) is null then
    raise exception
      'Missing Publishing editorial-state derivation';
  end if;

  if to_regprocedure(
    'editorial.derive_publishing_publication_state(uuid)'
  ) is null then
    raise exception
      'Missing Publishing publication-state derivation';
  end if;

  if position(
    'current_user_can_view_publishing_item'
    in pg_get_functiondef(
      to_regprocedure(
        'editorial.derive_publishing_editorial_state(uuid)'
      )
    )
  ) = 0 then
    raise exception
      'Publishing editorial-state derivation lacks item-level authority';
  end if;

  if position(
    'current_user_can_view_publishing_item'
    in pg_get_functiondef(
      to_regprocedure(
        'editorial.derive_publishing_publication_state(uuid)'
      )
    )
  ) = 0 then
    raise exception
      'Publishing publication-state derivation lacks item-level authority';
  end if;

  if to_regprocedure(
    'public.create_publishing_item(text,text,uuid,uuid,text,text,text,timestamptz,timestamptz,text)'
  ) is null then
    raise exception
      'Missing create_publishing_item RPC';
  end if;

  if to_regprocedure(
    'public.update_publishing_item(uuid,bigint,text,text,uuid,text,text,text,text,timestamptz,timestamptz,text)'
  ) is null then
    raise exception
      'Missing update_publishing_item RPC';
  end if;

  if to_regprocedure(
    'public.link_publishing_item_resource(uuid,bigint,uuid,text)'
  ) is null then
    raise exception
      'Missing link_publishing_item_resource RPC';
  end if;

  if to_regprocedure(
    'public.add_publishing_item_assignee(uuid,bigint,uuid,text,text)'
  ) is null then
    raise exception
      'Missing add_publishing_item_assignee RPC';
  end if;

  if to_regprocedure(
    'public.remove_publishing_item_assignee(uuid,bigint,uuid,text,text)'
  ) is null then
    raise exception
      'Missing remove_publishing_item_assignee RPC';
  end if;

  if to_regprocedure(
    'public.add_publishing_item_channel(uuid,bigint,text,boolean,text)'
  ) is null then
    raise exception
      'Missing add_publishing_item_channel RPC';
  end if;

  if to_regprocedure(
    'public.remove_publishing_item_channel(uuid,bigint,text,text)'
  ) is null then
    raise exception
      'Missing remove_publishing_item_channel RPC';
  end if;

  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key =
      'manage_publishing'
  ) then
    raise exception
      'manage_publishing capability is missing';
  end if;

  if (
    select count(*)
    from public.role_capabilities role_capability
    where role_capability.capability_key =
      'manage_publishing'
      and role_capability.role_key in (
        'administrator',
        'editor'
      )
  ) <> 2 then
    raise exception
      'Publishing management role grants are incomplete';
  end if;

  if (
    select count(*)
    from editorial.publishing_content_kinds
    where enabled = true
  ) < 14 then
    raise exception
      'Publishing content-kind seeds are incomplete';
  end if;

  if (
    select count(*)
    from editorial.publishing_channels
    where enabled = true
  ) < 10 then
    raise exception
      'Publishing channel seeds are incomplete';
  end if;

  select count(*)
  into v_rls_disabled
  from pg_class relation
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'editorial'
    and relation.relname in (
      'publishing_content_kinds',
      'publishing_channels',
      'publishing_items',
      'publishing_item_assignees',
      'publishing_item_channels',
      'publishing_item_events'
    )
    and relation.relrowsecurity = false;

  if v_rls_disabled <> 0 then
    raise exception
      'One or more Publishing tables do not have RLS enabled';
  end if;

  select count(*)
  into v_authenticated_writes
  from information_schema.role_table_grants grant_row
  where grant_row.grantee = 'authenticated'
    and grant_row.table_schema = 'editorial'
    and grant_row.table_name in (
      'publishing_content_kinds',
      'publishing_channels',
      'publishing_items',
      'publishing_item_assignees',
      'publishing_item_channels',
      'publishing_item_events'
    )
    and grant_row.privilege_type in (
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    );

  if v_authenticated_writes <> 0 then
    raise exception
      'Authenticated clients have direct Publishing mutation privileges';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname =
        'publishing_item_events'
      and trigger_row.tgname =
        'publishing_item_events_append_only'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'Publishing event append-only trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes index_row
    where index_row.schemaname = 'editorial'
      and index_row.indexname =
        'publishing_items_one_open_resource_idx'
      and index_row.indexdef ilike
        '%where ((resource_id is not null) and (planning_state <> ''archived''::text))%'
  ) then
    raise exception
      'Publishing canonical-resource uniqueness index is missing';
  end if;

  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname =
        'wk_publishing_workspace_items'
      and relation.relkind = 'v'
      and coalesce(
        relation.reloptions,
        '{}'::text[]
      ) @> array[
        'security_invoker=true',
        'security_barrier=true'
      ]
  ) then
    raise exception
      'Publishing workspace view does not use the required security options';
  end if;
end;
$publishing_workspace_foundation_verifier$;

select
  'PASS: Publishing workspace foundation verified.'
  as result;
