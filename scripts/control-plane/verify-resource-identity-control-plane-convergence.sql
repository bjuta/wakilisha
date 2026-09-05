-- Resource identity + replay ACL control-plane convergence verifier.
-- Runtime fixture work is transactionally rolled back.

begin;

do $verify_structure$
declare
  v_binding_definition text;
  v_registry_function oid;
  v_relation_fp text;
  v_function_fp text;
  v_sequence_fp text;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 92
     or (select max(version) from supabase_migrations.schema_migrations)
        <> '20260905134500'
  then
    raise exception
      'STOP: expected exact 92 / 20260905134500 migration authority';
  end if;

  v_binding_definition :=
    pg_get_functiondef(
      'editorial.assert_resource_binding_integrity()'::regprocedure
    );

  if position('when ''playlist_item''' in v_binding_definition) = 0
     or position('from editorial.playlist_item_resources' in v_binding_definition) = 0
  then
    raise exception
      'STOP: playlist_item Resource binding branch is missing';
  end if;

  if not (
    select p.prosecdef
    from pg_proc p
    where p.oid =
      'editorial.assert_resource_binding_integrity()'::regprocedure
  ) then
    raise exception
      'STOP: Resource binding integrity lost SECURITY DEFINER';
  end if;

  if (
    select p.proconfig
    from pg_proc p
    where p.oid =
      'editorial.assert_resource_binding_integrity()'::regprocedure
  ) is distinct from
    array['search_path=pg_catalog, editorial, audio']::text[]
  then
    raise exception
      'STOP: Resource binding integrity search_path drifted';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid =
      'editorial.playlist_item_resources'::regclass
      and t.tgname =
        'playlist_item_resources_binding_integrity'
      and t.tgdeferrable
      and t.tginitdeferred
      and not t.tgisinternal
  ) then
    raise exception
      'STOP: playlist_item typed binding constraint trigger is missing';
  end if;

  select p.oid
  into v_registry_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'editorial'
    and p.proname = 'ensure_registry_artist_resource_identity'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_registry_function is null then
    raise exception
      'STOP: Registry Artist Resource provisioning function is missing';
  end if;

  if not (
    select p.prosecdef
    from pg_proc p
    where p.oid = v_registry_function
  ) then
    raise exception
      'STOP: Registry Artist Resource provisioning is not SECURITY DEFINER';
  end if;

  if (
    select p.proconfig
    from pg_proc p
    where p.oid = v_registry_function
  ) is distinct from
    array['search_path=pg_catalog, public, editorial']::text[]
  then
    raise exception
      'STOP: Registry Artist Resource provisioning search_path drifted';
  end if;

  if has_function_privilege(
       'anon',
       v_registry_function,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       v_registry_function,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       v_registry_function,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Registry Artist Resource trigger helper is directly executable';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    where t.tgrelid = 'public.registry_artists'::regclass
      and t.tgname = 'registry_artists_resource_identity_sync'
      and not t.tgisinternal
  ) then
    raise exception
      'STOP: future Registry Artist Resource synchronization trigger is missing';
  end if;

  if exists (
    select 1
    from public.registry_artists artist
    left join editorial.registry_artist_resources binding
      on binding.artist_id = artist.id
    left join editorial.resources resource_row
      on resource_row.id = binding.resource_id
      and resource_row.resource_kind = 'registry_artist'
    where binding.artist_id is null
       or resource_row.id is null
  ) then
    raise exception
      'STOP: one or more Registry Artists lack canonical Resource identity';
  end if;

  if (
    select count(*)
    from editorial.registry_artist_resources
  ) <> (
    select count(*)
    from public.registry_artists
  ) then
    raise exception
      'STOP: Registry Artist Resource cardinality is not one-to-one';
  end if;

  if exists (
    select 1
    from public.registry_artists artist
    join editorial.registry_artist_resources binding
      on binding.artist_id = artist.id
    join editorial.resources resource_row
      on resource_row.id = binding.resource_id
    where resource_row.visibility is distinct from
      case
        when artist.status = 'active' then 'public'
        else 'internal'
      end
       or resource_row.lifecycle_state is distinct from
      case
        when artist.status = 'draft' then 'draft'
        when artist.status = 'archived' then 'archived'
        else 'active'
      end
  ) then
    raise exception
      'STOP: Registry Artist Resource lifecycle mapping drifted';
  end if;

  with rels as (
    select
      c.oid,
      n.nspname,
      c.relname,
      c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p','v','m','f')
  ),
  matrix as (
    select
      nspname || '.' || relname || '|' ||
      relkind::text || '|' || role_name || '|' || priv as item,
      has_table_privilege(role_name, oid, priv) as allowed
    from rels
    cross join (
      values ('anon'), ('authenticated'), ('service_role')
    ) roles(role_name)
    cross join (
      values
        ('SELECT'),
        ('INSERT'),
        ('UPDATE'),
        ('DELETE'),
        ('TRUNCATE'),
        ('REFERENCES'),
        ('TRIGGER'),
        ('MAINTAIN')
    ) privileges(priv)
  )
  select md5(
    string_agg(
      item || '|' || allowed::text,
      E'\n'
      order by item
    )
  )
  into v_relation_fp
  from matrix;

  if v_relation_fp <> 'd63c327fbab82ece6250d15d93cdb905' then
    raise exception
      'STOP: full public relation ACL fingerprint drifted: %',
      v_relation_fp;
  end if;

  with funcs as (
    select
      p.oid::regprocedure::text as identity,
      p.prosecdef,
      exists(
        select 1
        from aclexplode(
          coalesce(
            p.proacl,
            acldefault('f', p.proowner)
          )
        ) x
        where x.grantee = 0
          and x.privilege_type = 'EXECUTE'
      ) as public_execute,
      has_function_privilege(
        'anon', p.oid, 'EXECUTE'
      ) as anon_execute,
      has_function_privilege(
        'authenticated', p.oid, 'EXECUTE'
      ) as auth_execute,
      has_function_privilege(
        'service_role', p.oid, 'EXECUTE'
      ) as service_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  )
  select md5(
    string_agg(
      identity || '|' ||
      prosecdef::text || '|' ||
      public_execute::text || '|' ||
      anon_execute::text || '|' ||
      auth_execute::text || '|' ||
      service_execute::text,
      E'\n'
      order by identity
    )
  )
  into v_function_fp
  from funcs;

  if v_function_fp <> '7ed97824e39cde87cef32beb1f685f82' then
    raise exception
      'STOP: public function ACL fingerprint drifted: %',
      v_function_fp;
  end if;

  with seqs as (
    select
      c.oid::regclass::text as identity,
      has_sequence_privilege(
        'anon', c.oid, 'USAGE'
      ) as anon_usage,
      has_sequence_privilege(
        'anon', c.oid, 'SELECT'
      ) as anon_select,
      has_sequence_privilege(
        'anon', c.oid, 'UPDATE'
      ) as anon_update,
      has_sequence_privilege(
        'authenticated', c.oid, 'USAGE'
      ) as auth_usage,
      has_sequence_privilege(
        'authenticated', c.oid, 'SELECT'
      ) as auth_select,
      has_sequence_privilege(
        'authenticated', c.oid, 'UPDATE'
      ) as auth_update,
      has_sequence_privilege(
        'service_role', c.oid, 'USAGE'
      ) as service_usage,
      has_sequence_privilege(
        'service_role', c.oid, 'SELECT'
      ) as service_select,
      has_sequence_privilege(
        'service_role', c.oid, 'UPDATE'
      ) as service_update
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
  )
  select md5(
    string_agg(
      identity || '|' ||
      anon_usage::text || '|' ||
      anon_select::text || '|' ||
      anon_update::text || '|' ||
      auth_usage::text || '|' ||
      auth_select::text || '|' ||
      auth_update::text || '|' ||
      service_usage::text || '|' ||
      service_select::text || '|' ||
      service_update::text,
      E'\n'
      order by identity
    )
  )
  into v_sequence_fp
  from seqs;

  if v_sequence_fp <> '2f117bfe6b718acfb9b21e70c95c9eaf' then
    raise exception
      'STOP: public sequence ACL fingerprint drifted: %',
      v_sequence_fp;
  end if;
end;
$verify_structure$;

do $verify_playlist_item_negative$
declare
  v_probe uuid :=
    '00000000-0000-4000-8000-00000000d401';
  v_message text;
begin
  begin
    insert into editorial.resources (
      id,
      resource_kind,
      visibility,
      lifecycle_state
    )
    values (
      v_probe,
      'playlist_item',
      'internal',
      'active'
    );

    set constraints all immediate;

    raise exception
      'STOP: unbound playlist_item Resource unexpectedly passed';
  exception
    when others then
      get stacked diagnostics
        v_message = message_text;

      if position(
           'must have exactly one typed binding'
           in v_message
         ) = 0
      then
        raise exception
          'STOP: playlist_item invariant produced unexpected result: %',
          v_message;
      end if;
  end;

  set constraints all deferred;
end;
$verify_playlist_item_negative$;

do $verify_registry_fixture$
declare
  v_artist uuid :=
    '00000000-0000-4000-8000-00000000d402';
  v_resource uuid;
begin
  if exists (
    select 1
    from public.registry_artists
    where id = v_artist
  ) then
    raise exception
      'STOP: Registry Artist verifier fixture residue exists';
  end if;

  insert into public.registry_artists (
    id,
    slug,
    display_name,
    normalized_name,
    status,
    metadata
  )
  values (
    v_artist,
    'resource-control-plane-verifier',
    'Resource Control Plane Verifier',
    'resource control plane verifier',
    'active',
    '{"fixture":"resource_control_plane_convergence"}'::jsonb
  );

  select binding.resource_id
  into v_resource
  from editorial.registry_artist_resources binding
  where binding.artist_id = v_artist;

  if v_resource is null then
    raise exception
      'STOP: fresh Registry Artist did not receive Resource identity';
  end if;

  if not exists (
    select 1
    from editorial.resources resource_row
    where resource_row.id = v_resource
      and resource_row.resource_kind = 'registry_artist'
      and resource_row.visibility = 'public'
      and resource_row.lifecycle_state = 'active'
  ) then
    raise exception
      'STOP: fresh active Registry Artist Resource mapping is wrong';
  end if;

  update public.registry_artists
  set status = 'archived'
  where id = v_artist;

  if not exists (
    select 1
    from editorial.resources resource_row
    where resource_row.id = v_resource
      and resource_row.resource_kind = 'registry_artist'
      and resource_row.visibility = 'internal'
      and resource_row.lifecycle_state = 'archived'
  ) then
    raise exception
      'STOP: Registry Artist status change did not synchronize Resource lifecycle';
  end if;
end;
$verify_registry_fixture$;

select jsonb_build_object(
  'verification', 'PASS',
  'migration_count',
    (select count(*) from supabase_migrations.schema_migrations),
  'migration_head',
    (select max(version) from supabase_migrations.schema_migrations),
  'registry_artists',
    (select count(*) from public.registry_artists),
  'registry_artist_bindings',
    (select count(*) from editorial.registry_artist_resources),
  'full_relation_acl_fp',
    'd63c327fbab82ece6250d15d93cdb905',
  'public_function_acl_fp',
    '7ed97824e39cde87cef32beb1f685f82',
  'public_sequence_acl_fp',
    '2f117bfe6b718acfb9b21e70c95c9eaf'
) as resource_identity_control_plane_acceptance;

rollback;
