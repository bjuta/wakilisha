-- Phase 7A K4C-P3: Playlist pointer compatibility retirement.
--
-- Retire the Playlist half of K1 lifecycle-position duplication only after
-- K4C-P1/K4C-P2 moved Playlist event and pointer-write authority to
-- editorial.resources. Audio typed pointer compatibility remains intact.

begin;

create temporary table phase_7a_k4c_p3_data_baseline
on commit drop
as
select
  (
    select md5(
      coalesce(
        string_agg(
          (
            to_jsonb(binding)
            - 'current_working_version_id'
            - 'current_submitted_version_id'
            - 'current_approved_version_id'
            - 'current_published_version_id'
          )::text,
          E'\n'
          order by binding.resource_id::text
        ),
        ''
      )
    )
    from editorial.playlist_resources binding
  ) as playlist_nonpointer_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          to_jsonb(binding)::text,
          E'\n'
          order by binding.resource_id::text
        ),
        ''
      )
    )
    from editorial.audio_publication_resources binding
  ) as audio_binding_fingerprint,
  md5(
    pg_get_functiondef(
      'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
    )
  ) as typed_to_resource_function_md5,
  md5(
    pg_get_functiondef(
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    )
  ) as resource_to_typed_function_md5;

create temporary table phase_7a_k4c_p3_function_baseline (
  signature text primary key,
  accepted_definition_md5 text not null,
  procedure_oid oid not null,
  owner_oid oid not null,
  security_definer boolean not null,
  function_config text not null,
  function_acl text not null
)
on commit drop;

insert into phase_7a_k4c_p3_function_baseline (
  signature,
  accepted_definition_md5,
  procedure_oid,
  owner_oid,
  security_definer,
  function_config,
  function_acl
)
select
  accepted.signature,
  accepted.definition_md5,
  procedure_row.oid,
  procedure_row.proowner,
  procedure_row.prosecdef,
  coalesce(procedure_row.proconfig::text, ''),
  coalesce(procedure_row.proacl::text, '')
from (
  values
    (
      'editorial.copy_playlist_working_trust_to_working_successor(uuid,uuid,uuid)',
      'c1806c1a61abe58f05dc2e856fa3d88f'
    ),
    (
      'editorial.list_current_public_person_work(uuid)',
      '4e893ce13a4b8361dfe82d9de9858343'
    ),
    (
      'editorial.playlist_working_trust_target(uuid,uuid)',
      '1886108b098b1e1759e781f6c280a078'
    ),
    (
      'editorial.require_exact_working_snapshot_for_curated_submission()',
      'b6e06974f9a058f6ff8e119c2d5ce3ab'
    ),
    (
      'private.community_get_reaction_state_for_public_targets_legacy_m7(jsonb)',
      '2c1ddd36a30c7abdbfba9b9efc51c65f'
    ),
    (
      'private.community_resolve_save_target(text,text,text,text)',
      '294dac9abbfe193d1682a4911476878a'
    ),
    (
      'public.archive_playlist(uuid,bigint,text,text,uuid)',
      'dda5d2734fb802a3bf4f6ba3e011649e'
    ),
    (
      'public.create_playlist_preview_link(uuid,uuid,timestamp with time zone)',
      'de9e0dc6de77e48dd2ff56afceb949ee'
    ),
    (
      'public.create_public_playlist_missing_track_submission(uuid,uuid,text,text,text[],text,jsonb,text)',
      '560889d863813a0fa57c938aa2d02cb8'
    ),
    (
      'public.get_public_playlist(text)',
      '93769e592b34a18e93d39d9bd4e98836'
    ),
    (
      'public.list_public_playlists(integer,timestamp with time zone,uuid)',
      '7ff4df26af1094194abaf822d33e137d'
    ),
    (
      'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)',
      'dcd8dc87b8f68e921c0e7f7cc9dd0770'
    ),
    (
      'public.restore_playlist_from_archive(uuid,bigint,text,text,uuid)',
      '8ab6da9668dcaafcc6489f7ab435090d'
    ),
    (
      'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)',
      'a7b334c355e15655ddfc211ff9432ce2'
    ),
    (
      'public.schedule_playlist_publication(uuid,bigint,uuid,timestamp with time zone,text,text,uuid)',
      '0db43b3437134e7f8fd479cdf271e80f'
    ),
    (
      'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)',
      '86c1b60c77f60ea6ee46ec2439907bf5'
    ),
    (
      'public.unpublish_playlist(uuid,bigint,text,text,uuid)',
      '2ebb4f06179eb4046b641daf07493d66'
    ),
    (
      'editorial.sync_typed_lifecycle_from_resource()',
      '4f52dd85356906f9f6fb2e9dcd24551a'
    )
) as accepted(signature, definition_md5)
join pg_proc procedure_row
  on procedure_row.oid =
       to_regprocedure(accepted.signature);

do $phase_7a_k4c_p3_preflight$
declare
  v_count bigint;
begin
  if (
    select count(*)
    from phase_7a_k4c_p3_function_baseline
  ) <> 18 then
    raise exception
      'STOP: K4C-P3 expected 18 accepted function definitions';
  end if;

  if exists (
    select 1
    from phase_7a_k4c_p3_function_baseline baseline
    where md5(
      pg_get_functiondef(baseline.procedure_oid)
    ) <> baseline.accepted_definition_md5
  ) then
    raise exception
      'STOP: K4C-P3 accepted function definition drift exists';
  end if;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'playlist_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 4 then
    raise exception
      'STOP: K4C-P3 expected four Playlist typed pointer columns, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'audio_publication_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 4 then
    raise exception
      'STOP: K4C-P3 requires all four Audio compatibility pointer columns';
  end if;

  select count(*)
  into v_count
  from editorial.playlist_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource.current_working_version_id,
    resource.current_submitted_version_id,
    resource.current_approved_version_id,
    resource.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: K4C-P3 Playlist pointer parity drift is %',
      v_count;
  end if;

  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource.current_working_version_id,
    resource.current_submitted_version_id,
    resource.current_approved_version_id,
    resource.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: K4C-P3 Audio pointer parity drift is %',
      v_count;
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.playlist_resources'::regclass
      and trigger_row.tgname =
            'playlist_resources_sync_shared_lifecycle'
      and trigger_row.tgfoid =
            'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-P3 requires Playlist typed-to-Resource compatibility trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.audio_publication_resources'::regclass
      and trigger_row.tgname =
            'audio_publication_resources_sync_shared_lifecycle'
      and trigger_row.tgfoid =
            'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-P3 requires Audio typed-to-Resource compatibility trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.resources'::regclass
      and trigger_row.tgname =
            'resources_sync_typed_lifecycle_compatibility'
      and trigger_row.tgfoid =
            'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-P3 requires shared Resource-to-typed compatibility trigger';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
    )
  ) <> '1a9a366b7a26d023aa589767a2024651' then
    raise exception
      'STOP: K4C-P3 typed-to-Resource compatibility helper drifted';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    )
  ) <> '4f52dd85356906f9f6fb2e9dcd24551a' then
    raise exception
      'STOP: K4C-P3 Resource-to-typed compatibility helper drifted';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where procedure_row.prokind in ('f', 'p')
    and namespace_row.nspname in ('public', 'editorial')
    and pg_get_functiondef(procedure_row.oid)
      ~* '(update|insert[[:space:]]+into)[[:space:]]+editorial[.]playlist_resources[[:space:][:print:]]*current_(working|submitted|approved|published)_version_id';

  if v_count <> 1 then
    raise exception
      'STOP: K4C-P3 expected only the K1 Resource-to-typed Playlist writer, found %',
      v_count;
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]playlist_(review|lifecycle)_events'
  ) then
    raise exception
      'STOP: K4C-P3 typed Playlist event authority regressed';
  end if;
end;
$phase_7a_k4c_p3_preflight$;

-- Seven Playlist functions hold the Playlist binding as v_binding and still
-- consume typed lifecycle pointers from that row. Move those reads onto a
-- jointly locked/read canonical Resource row without re-authoring business
-- logic.
do $phase_7a_k4c_p3_row_readers$
declare
  target record;
  v_definition text;
  v_declaration text :=
    '  v_binding editorial.playlist_resources%rowtype;';
  v_declaration_replacement text :=
    E'  v_binding editorial.playlist_resources%rowtype;\n'
    || E'  v_resource editorial.resources%rowtype;\n'
    || '  v_pair record;';
  v_locked_select text :=
    E'  select binding.*\n'
    || E'  into v_binding\n'
    || E'  from editorial.playlist_resources binding\n'
    || E'  where binding.playlist_id = p_playlist_id\n'
    || E'  for update;';
  v_locked_select_replacement text :=
    E'  select binding as binding_row, resource as resource_row\n'
    || E'  into v_pair\n'
    || E'  from editorial.playlist_resources binding\n'
    || E'  join editorial.resources resource\n'
    || E'    on resource.id = binding.resource_id\n'
    || E'  where binding.playlist_id = p_playlist_id\n'
    || E'  for update of binding, resource;\n'
    || E'\n'
    || E'  v_binding := v_pair.binding_row;\n'
    || E'  v_resource := v_pair.resource_row;';
  v_read_select text :=
    E'  select binding.*\n'
    || E'  into v_binding\n'
    || E'  from editorial.playlist_resources binding\n'
    || E'  where binding.playlist_id = p_playlist_id;';
  v_read_select_replacement text :=
    E'  select binding as binding_row, resource as resource_row\n'
    || E'  into v_pair\n'
    || E'  from editorial.playlist_resources binding\n'
    || E'  join editorial.resources resource\n'
    || E'    on resource.id = binding.resource_id\n'
    || E'  where binding.playlist_id = p_playlist_id;\n'
    || E'\n'
    || E'  v_binding := v_pair.binding_row;\n'
    || E'  v_resource := v_pair.resource_row;';
  v_ref_count bigint;
  v_fragment_count bigint;
begin
  for target in
    select *
    from (
      values
        (
          'public.archive_playlist(uuid,bigint,text,text,uuid)',
          4,
          true
        ),
        (
          'public.create_playlist_preview_link(uuid,uuid,timestamp with time zone)',
          4,
          false
        ),
        (
          'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)',
          3,
          true
        ),
        (
          'public.restore_playlist_from_archive(uuid,bigint,text,text,uuid)',
          4,
          true
        ),
        (
          'public.schedule_playlist_publication(uuid,bigint,uuid,timestamp with time zone,text,text,uuid)',
          3,
          true
        ),
        (
          'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)',
          2,
          true
        ),
        (
          'public.unpublish_playlist(uuid,bigint,text,text,uuid)',
          6,
          true
        )
    ) as row_target(signature, expected_pointer_refs, lock_resource)
  loop
    select pg_get_functiondef(
      to_regprocedure(target.signature)
    )
    into v_definition;

    if v_definition is null then
      raise exception
        'STOP: K4C-P3 row-reader target missing: %',
        target.signature;
    end if;

    v_fragment_count :=
      (
        length(v_definition)
        - length(
            replace(
              v_definition,
              v_declaration,
              ''
            )
          )
      ) / length(v_declaration);

    if v_fragment_count <> 1
       or position(
         '  v_resource editorial.resources%rowtype;'
         in v_definition
       ) <> 0
    then
      raise exception
        'STOP: K4C-P3 row-reader declaration shape drifted in %',
        target.signature;
    end if;

    v_definition :=
      replace(
        v_definition,
        v_declaration,
        v_declaration_replacement
      );

    if target.lock_resource then
      v_fragment_count :=
        (
          length(v_definition)
          - length(
              replace(
                v_definition,
                v_locked_select,
                ''
              )
            )
        ) / length(v_locked_select);

      if v_fragment_count <> 1 then
        raise exception
          'STOP: K4C-P3 canonical lock fragment drifted in %',
          target.signature;
      end if;

      v_definition :=
        replace(
          v_definition,
          v_locked_select,
          v_locked_select_replacement
        );
    else
      v_fragment_count :=
        (
          length(v_definition)
          - length(
              replace(
                v_definition,
                v_read_select,
                ''
              )
            )
        ) / length(v_read_select);

      if v_fragment_count <> 1 then
        raise exception
          'STOP: K4C-P3 canonical read fragment drifted in %',
          target.signature;
      end if;

      v_definition :=
        replace(
          v_definition,
          v_read_select,
          v_read_select_replacement
        );
    end if;

    select count(*)
    into v_ref_count
    from regexp_matches(
      v_definition,
      '\mv_binding\.current_(working|submitted|approved|published)_version_id\M',
      'gi'
    );

    if v_ref_count <> target.expected_pointer_refs then
      raise exception
        'STOP: K4C-P3 expected % typed v_binding pointer read(s) in %, found %',
        target.expected_pointer_refs,
        target.signature,
        v_ref_count;
    end if;

    v_definition :=
      replace(
        v_definition,
        'v_binding.current_working_version_id',
        'v_resource.current_working_version_id'
      );
    v_definition :=
      replace(
        v_definition,
        'v_binding.current_submitted_version_id',
        'v_resource.current_submitted_version_id'
      );
    v_definition :=
      replace(
        v_definition,
        'v_binding.current_approved_version_id',
        'v_resource.current_approved_version_id'
      );
    v_definition :=
      replace(
        v_definition,
        'v_binding.current_published_version_id',
        'v_resource.current_published_version_id'
      );

    execute v_definition;
  end loop;
end;
$phase_7a_k4c_p3_row_readers$;

create temporary table phase_7a_k4c_p3_exact_rewrites (
  rewrite_order integer primary key,
  signature text not null,
  old_fragment text not null,
  new_fragment text not null,
  expected_occurrences integer not null
)
on commit drop;

insert into phase_7a_k4c_p3_exact_rewrites (
  rewrite_order,
  signature,
  old_fragment,
  new_fragment,
  expected_occurrences
)
values
(
  10,
  'public.create_public_playlist_missing_track_submission(uuid,uuid,text,text,text[],text,jsonb,text)',
  E'  join editorial.playlist_resources binding\n'
    || E'    on binding.resource_id =\n'
    || E'         snapshot.resource_id\n'
    || E'   and binding.playlist_id =\n'
    || E'         snapshot.playlist_id\n'
    || E'   and binding.current_published_version_id =\n'
    || E'         snapshot.version_id',
  E'  join editorial.playlist_resources binding\n'
    || E'    on binding.resource_id =\n'
    || E'         snapshot.resource_id\n'
    || E'   and binding.playlist_id =\n'
    || E'         snapshot.playlist_id\n'
    || E'  join editorial.resources resource\n'
    || E'    on resource.id = binding.resource_id\n'
    || E'   and resource.current_published_version_id =\n'
    || E'         snapshot.version_id',
  1
),
(
  20,
  'editorial.copy_playlist_working_trust_to_working_successor(uuid,uuid,uuid)',
  E'    from editorial.playlist_resources binding\n'
    || E'    where binding.resource_id = p_resource_id\n'
    || E'      and binding.playlist_id = v_source.playlist_id\n'
    || E'      and binding.current_working_version_id = p_source_working_version_id',
  E'    from editorial.playlist_resources binding\n'
    || E'    join editorial.resources resource\n'
    || E'      on resource.id = binding.resource_id\n'
    || E'    where binding.resource_id = p_resource_id\n'
    || E'      and binding.playlist_id = v_source.playlist_id\n'
    || E'      and resource.current_working_version_id = p_source_working_version_id',
  1
),
(
  30,
  'editorial.playlist_working_trust_target(uuid,uuid)',
  E'    from editorial.playlist_resources binding\n'
    || E'    where binding.resource_id = v_version.resource_id\n'
    || E'      and binding.playlist_id = v_version.playlist_id\n'
    || E'      and binding.current_working_version_id =\n'
    || E'            p_playlist_version_id',
  E'    from editorial.playlist_resources binding\n'
    || E'    join editorial.resources resource\n'
    || E'      on resource.id = binding.resource_id\n'
    || E'    where binding.resource_id = v_version.resource_id\n'
    || E'      and binding.playlist_id = v_version.playlist_id\n'
    || E'      and resource.current_working_version_id =\n'
    || E'            p_playlist_version_id',
  1
),
(
  40,
  'editorial.require_exact_working_snapshot_for_curated_submission()',
  E'    from editorial.playlist_resources binding\n'
    || E'    join editorial.playlist_versions working\n'
    || E'      on working.id = binding.current_working_version_id',
  E'    from editorial.playlist_resources binding\n'
    || E'    join editorial.resources resource\n'
    || E'      on resource.id = binding.resource_id\n'
    || E'    join editorial.playlist_versions working\n'
    || E'      on working.id = resource.current_working_version_id',
  1
),
(
  50,
  'public.get_public_playlist(text)',
  E'    join editorial.playlist_resources binding\n'
    || E'      on binding.resource_id = snapshot.resource_id\n'
    || E'     and binding.playlist_id = snapshot.playlist_id\n'
    || E'     and binding.current_published_version_id =\n'
    || E'           snapshot.version_id',
  E'    join editorial.playlist_resources binding\n'
    || E'      on binding.resource_id = snapshot.resource_id\n'
    || E'     and binding.playlist_id = snapshot.playlist_id\n'
    || E'    join editorial.resources resource\n'
    || E'      on resource.id = binding.resource_id\n'
    || E'     and resource.current_published_version_id =\n'
    || E'           snapshot.version_id',
  1
),
(
  60,
  'public.list_public_playlists(integer,timestamp with time zone,uuid)',
  E'  join editorial.playlist_resources binding\n'
    || E'    on binding.resource_id = snapshot.resource_id\n'
    || E'   and binding.playlist_id = snapshot.playlist_id\n'
    || E'   and binding.current_published_version_id =\n'
    || E'         snapshot.version_id',
  E'  join editorial.playlist_resources binding\n'
    || E'    on binding.resource_id = snapshot.resource_id\n'
    || E'   and binding.playlist_id = snapshot.playlist_id\n'
    || E'  join editorial.resources resource\n'
    || E'    on resource.id = binding.resource_id\n'
    || E'   and resource.current_published_version_id =\n'
    || E'         snapshot.version_id',
  1
),
(
  70,
  'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)',
  E'    select binding.current_working_version_id into v_current_working_version_id\n'
    || E'    from editorial.playlist_resources binding\n'
    || E'    where binding.resource_id = v_identity.resource_id\n'
    || E'    for update;',
  E'    select resource.current_working_version_id into v_current_working_version_id\n'
    || E'    from editorial.resources resource\n'
    || E'    where resource.id = v_identity.resource_id\n'
    || E'    for update;',
  1
),
(
  80,
  'editorial.list_current_public_person_work(uuid)',
  'binding.current_published_version_id',
  'resource.current_published_version_id',
  2
),
(
  90,
  'private.community_get_reaction_state_for_public_targets_legacy_m7(jsonb)',
  'playlist_resource.current_published_version_id',
  'resource.current_published_version_id',
  1
),
(
  100,
  'private.community_resolve_save_target(text,text,text,text)',
  'playlist_resource.current_published_version_id',
  'resource.current_published_version_id',
  1
);

do $phase_7a_k4c_p3_exact_rewrite$
declare
  rewrite_row record;
  v_regprocedure regprocedure;
  v_definition text;
  v_occurrences integer;
begin
  for rewrite_row in
    select *
    from phase_7a_k4c_p3_exact_rewrites
    order by rewrite_order
  loop
    v_regprocedure :=
      to_regprocedure(rewrite_row.signature);

    if v_regprocedure is null then
      raise exception
        'STOP: K4C-P3 exact-reader target missing: %',
        rewrite_row.signature;
    end if;

    select pg_get_functiondef(v_regprocedure)
    into v_definition;

    v_occurrences :=
      (
        length(v_definition)
        - length(
            replace(
              v_definition,
              rewrite_row.old_fragment,
              ''
            )
          )
      ) / length(rewrite_row.old_fragment);

    if v_occurrences <> rewrite_row.expected_occurrences then
      raise exception
        'STOP: K4C-P3 expected % old fragment occurrence(s) in %, found %',
        rewrite_row.expected_occurrences,
        rewrite_row.signature,
        v_occurrences;
    end if;

    v_definition :=
      replace(
        v_definition,
        rewrite_row.old_fragment,
        rewrite_row.new_fragment
      );

    execute v_definition;
  end loop;
end;
$phase_7a_k4c_p3_exact_rewrite$;

-- Narrow the shared Resource-to-typed compatibility function to Audio only.
-- The Audio update block is retained byte-for-byte; only the Playlist branch
-- and the resulting elsif keyword are removed.
do $phase_7a_k4c_p3_narrow_reverse_sync$
declare
  v_definition text;
  v_old_fragment text :=
    E'  if new.resource_kind = ''playlist'' then\n'
    || E'    update editorial.playlist_resources binding\n'
    || E'    set\n'
    || E'      current_working_version_id = new.current_working_version_id,\n'
    || E'      current_submitted_version_id = new.current_submitted_version_id,\n'
    || E'      current_approved_version_id = new.current_approved_version_id,\n'
    || E'      current_published_version_id = new.current_published_version_id\n'
    || E'    where binding.resource_id = new.id\n'
    || E'      and (\n'
    || E'        binding.current_working_version_id,\n'
    || E'        binding.current_submitted_version_id,\n'
    || E'        binding.current_approved_version_id,\n'
    || E'        binding.current_published_version_id\n'
    || E'      ) is distinct from (\n'
    || E'        new.current_working_version_id,\n'
    || E'        new.current_submitted_version_id,\n'
    || E'        new.current_approved_version_id,\n'
    || E'        new.current_published_version_id\n'
    || E'      );\n'
    || E'\n'
    || E'  elsif new.resource_kind in (';
  v_new_fragment text :=
    E'  if new.resource_kind in (';
  v_occurrences integer;
begin
  select pg_get_functiondef(
    'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
  )
  into v_definition;

  v_occurrences :=
    (
      length(v_definition)
      - length(
          replace(
            v_definition,
            v_old_fragment,
            ''
          )
        )
    ) / length(v_old_fragment);

  if v_occurrences <> 1 then
    raise exception
      'STOP: K4C-P3 Resource-to-typed Playlist branch shape drifted';
  end if;

  v_definition :=
    replace(
      v_definition,
      v_old_fragment,
      v_new_fragment
    );

  execute v_definition;
end;
$phase_7a_k4c_p3_narrow_reverse_sync$;

-- The shared typed-to-Resource helper remains because Audio still uses it.
-- Retire only the Playlist trigger before dropping the typed columns.
drop trigger
  playlist_resources_sync_shared_lifecycle
on editorial.playlist_resources;

alter table editorial.playlist_resources
  drop constraint playlist_resources_working_version_fkey,
  drop constraint playlist_resources_submitted_version_fkey,
  drop constraint playlist_resources_approved_version_fkey,
  drop constraint playlist_resources_published_version_fkey;

alter table editorial.playlist_resources
  drop column current_working_version_id,
  drop column current_submitted_version_id,
  drop column current_approved_version_id,
  drop column current_published_version_id;

do $phase_7a_k4c_p3_postconditions$
declare
  v_count bigint;
  v_baseline record;
  v_definition text;
begin
  select *
  into v_baseline
  from phase_7a_k4c_p3_data_baseline;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'playlist_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 0 then
    raise exception
      'STOP: K4C-P3 Playlist typed pointer columns remain';
  end if;

  if exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.playlist_resources'::regclass
      and trigger_row.tgname =
            'playlist_resources_sync_shared_lifecycle'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-P3 Playlist typed-to-Resource trigger remains';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.audio_publication_resources'::regclass
      and trigger_row.tgname =
            'audio_publication_resources_sync_shared_lifecycle'
      and trigger_row.tgfoid =
            'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-P3 changed Audio typed-to-Resource compatibility trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.resources'::regclass
      and trigger_row.tgname =
            'resources_sync_typed_lifecycle_compatibility'
      and trigger_row.tgfoid =
            'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-P3 removed the shared Resource-to-typed Audio compatibility trigger';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
    )
  ) <> '1a9a366b7a26d023aa589767a2024651' then
    raise exception
      'STOP: K4C-P3 changed the shared typed-to-Resource Audio helper';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    )
  ) <> '619a2bd22f9066594f84dada7a119902' then
    raise exception
      'STOP: K4C-P3 Audio-only Resource-to-typed helper does not match the sealed definition';
  end if;

  select pg_get_functiondef(
    'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
  )
  into v_definition;

  if v_definition ilike '%editorial.playlist_resources%'
     or v_definition ilike '%resource_kind = ''playlist''%'
     or v_definition not ilike '%editorial.audio_publication_resources%'
     or v_definition not ilike '%''audio_episode''%'
     or v_definition not ilike '%''standalone_audio''%'
  then
    raise exception
      'STOP: K4C-P3 did not narrow Resource-to-typed compatibility to Audio only';
  end if;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'audio_publication_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 4 then
    raise exception
      'STOP: K4C-P3 changed Audio typed pointer columns';
  end if;

  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource.current_working_version_id,
    resource.current_submitted_version_id,
    resource.current_approved_version_id,
    resource.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: K4C-P3 left Audio pointer parity drift';
  end if;

  if v_baseline.audio_binding_fingerprint
       is distinct from (
         select md5(
           coalesce(
             string_agg(
               to_jsonb(binding)::text,
               E'\n'
               order by binding.resource_id::text
             ),
             ''
           )
         )
         from editorial.audio_publication_resources binding
       )
  then
    raise exception
      'STOP: K4C-P3 mutated Audio compatibility data';
  end if;

  if v_baseline.playlist_nonpointer_fingerprint
       is distinct from (
         select md5(
           coalesce(
             string_agg(
               (
                 to_jsonb(binding)
                 - 'current_working_version_id'
                 - 'current_submitted_version_id'
                 - 'current_approved_version_id'
                 - 'current_published_version_id'
               )::text,
               E'\n'
               order by binding.resource_id::text
             ),
             ''
           )
         )
         from editorial.playlist_resources binding
       )
  then
    raise exception
      'STOP: K4C-P3 mutated non-pointer Playlist binding data';
  end if;

  if exists (
    select 1
    from phase_7a_k4c_p3_function_baseline baseline
    join pg_proc procedure_row
      on procedure_row.oid = baseline.procedure_oid
    where procedure_row.proowner
            is distinct from baseline.owner_oid
       or procedure_row.prosecdef
            is distinct from baseline.security_definer
       or coalesce(procedure_row.proconfig::text, '')
            is distinct from baseline.function_config
       or coalesce(procedure_row.proacl::text, '')
            is distinct from baseline.function_acl
  ) then
    raise exception
      'STOP: K4C-P3 changed function owner, SECURITY DEFINER, search_path, or ACL';
  end if;

  -- No Playlist function may keep the old row-variable pointer reads.
  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ilike '%editorial.playlist_resources%'
      and pg_get_functiondef(procedure_row.oid)
        ~* '\mv_binding\.current_(working|submitted|approved|published)_version_id\M'
  ) then
    raise exception
      'STOP: K4C-P3 left a v_binding Playlist typed pointer reader';
  end if;

  -- save_resource_version_editorial_metadata intentionally keeps the Audio
  -- binding.current_working_version_id read. Its Playlist branch must now
  -- read editorial.resources.
  select pg_get_functiondef(
    'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       E'    select binding.current_working_version_id into v_current_working_version_id\n'
       || E'    from editorial.playlist_resources binding\n'
       in v_definition
     ) <> 0
     or position(
       E'    select resource.current_working_version_id into v_current_working_version_id\n'
       || E'    from editorial.resources resource\n'
       in v_definition
     ) = 0
     or position(
       E'    select binding.current_working_version_id into v_current_working_version_id\n'
       || E'    from editorial.audio_publication_resources binding\n'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: K4C-P3 Playlist/Audio shared metadata reader boundary is incorrect';
  end if;

  if exists (
    with function_definitions as (
      select
        procedure_row.oid,
        procedure_row.oid::regprocedure::text as signature,
        pg_get_functiondef(procedure_row.oid) as definition
      from pg_proc procedure_row
      join pg_namespace namespace_row
        on namespace_row.oid = procedure_row.pronamespace
      where procedure_row.prokind in ('f', 'p')
        and namespace_row.nspname not in (
          'pg_catalog',
          'information_schema'
        )
        and procedure_row.oid <>
          'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure
    ),
    playlist_aliases as (
      select
        function_definitions.oid,
        function_definitions.signature,
        function_definitions.definition,
        lower(alias_match[1]) as alias_name
      from function_definitions
      cross join lateral regexp_matches(
        function_definitions.definition,
        '(?:from|join)[[:space:]]+editorial[.]playlist_resources(?:[[:space:]]+(?:as[[:space:]]+)?)?([a-zA-Z_][a-zA-Z0-9_]*)',
        'gi'
      ) alias_match
    )
    select 1
    from playlist_aliases
    where definition ~* (
      '\m'
      || alias_name
      || '\.current_(working|submitted|approved|published)_version_id\M'
    )
  ) then
    raise exception
      'STOP: K4C-P3 left a direct Playlist typed pointer alias reader';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]playlist_(review|lifecycle)_events'
  ) then
    raise exception
      'STOP: K4C-P3 renewed typed Playlist event authority';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4C-P3 renewed typed Video event authority';
  end if;
end;
$phase_7a_k4c_p3_postconditions$;

commit;
