-- Phase 7A K4C-A2: Audio remaining pointer convergence.
--
-- Move the remaining Audio business readers/writers from typed lifecycle
-- pointer compatibility onto canonical editorial.resources lifecycle pointers.
-- Retain the four typed Audio pointer columns and K1 bidirectional sync until A3.

begin;

create temporary table phase_7a_k4c_a2_data_baseline
on commit drop
as
select
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
  (
    select count(*)
    from editorial.audio_publication_resources
  ) as audio_binding_count;

create temporary table phase_7a_k4c_a2_function_baseline (
  signature text primary key,
  accepted_definition_md5 text not null,
  procedure_oid oid not null,
  owner_oid oid not null,
  security_definer boolean not null,
  function_config text not null,
  function_acl text not null
)
on commit drop;

insert into phase_7a_k4c_a2_function_baseline (
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
      'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
      '4d66642551908e34fee14c8f5dc709f2'
    ),
    (
      'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
      '7eb80477d168c3baa58af00a395f2dff'
    ),
    (
      'audio.publication_content_fingerprint(uuid)',
      '28b9f02ef5b09eecee72330dd3d4c22c'
    ),
    (
      'public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)',
      '4ad28c9f8609871075ff22b567b80881'
    ),
    (
      'public.get_public_audio_publication_m1(text)',
      '05c0a68d6dee6ea06260f72644879814'
    ),
    (
      'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
      '25c171998487d7fbaddd4e32ce2e76df'
    ),
    (
      'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
      '7ef8f08db43561e63e97c915c742d873'
    ),
    (
      'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)',
      'baca316abc5270256b057a791b2451b8'
    ),
    (
      'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)',
      'ef5792734ba2c7a981695dc0cb9e64b1'
    ),
    (
      'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)',
      '694a3b1c0495aaa6f60ad18423ab46dd'
    )
) accepted(signature, definition_md5)
join pg_proc procedure_row
  on procedure_row.oid = to_regprocedure(accepted.signature);

do $phase_7a_k4c_a2_preflight$
declare
  v_count bigint;
begin
  if (
    select count(*)
    from phase_7a_k4c_a2_function_baseline
  ) <> 10 then
    raise exception
      'STOP: K4C-A2 expected 10 accepted Audio function definitions';
  end if;

  if exists (
    select 1
    from phase_7a_k4c_a2_function_baseline baseline
    where md5(
      pg_get_functiondef(baseline.procedure_oid)
    ) <> baseline.accepted_definition_md5
  ) then
    raise exception
      'STOP: K4C-A2 accepted function definition drift exists';
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
      'STOP: K4C-A2 requires all four Audio compatibility pointer columns';
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
      'STOP: K4C-A2 Audio pointer parity drift is %',
      v_count;
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
      'STOP: K4C-A2 requires Audio typed-to-Resource compatibility trigger';
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
      'STOP: K4C-A2 requires Resource-to-typed Audio compatibility trigger';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
    )
  ) <> '1a9a366b7a26d023aa589767a2024651' then
    raise exception
      'STOP: K4C-A2 typed-to-Resource compatibility helper drifted';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    )
  ) <> '619a2bd22f9066594f84dada7a119902' then
    raise exception
      'STOP: K4C-A2 Resource-to-typed compatibility helper drifted';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and (
      pg_get_functiondef(procedure_row.oid)
        ~* 'update[[:space:]]+editorial[.]audio_publication_resources[[:space:][:print:]]{0,200}set[[:space:][:print:]]{0,200}current_(working|submitted|approved|published)_version_id'
      or pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]audio_publication_resources[[:space:]]*[(][^)]*current_(working|submitted|approved|published)_version_id'
    );

  if v_count <> 5 then
    raise exception
      'STOP: K4C-A2 expected four governed Audio typed-pointer writers plus K1 compatibility, found %',
      v_count;
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+audio[.]publication_(review|lifecycle)_events'
  ) then
    raise exception
      'STOP: K4C-A2 A1 typed Audio event-writer retirement regressed';
  end if;
end;
$phase_7a_k4c_a2_preflight$;

-- Generic exact-fragment rewrite helper:
-- every rewrite is guarded by the exact accepted old-fragment count.
create temporary table phase_7a_k4c_a2_rewrites (
  rewrite_order integer primary key,
  signature text not null,
  old_fragment text not null,
  new_fragment text not null,
  expected_occurrences integer not null default 1
)
on commit drop;

-- Create: only the working-pointer write changes.
insert into phase_7a_k4c_a2_rewrites values
(
  10,
  'public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)',
  E'  update editorial.audio_publication_resources binding\n'
  || E'  set current_working_version_id =\n'
  || E'        v_snapshot.version_id\n'
  || E'  where binding.publication_id =\n'
  || E'        v_resource_id;',
  E'  update editorial.resources resource_update\n'
  || E'  set current_working_version_id =\n'
  || E'        v_snapshot.version_id\n'
  || E'  where resource_update.id =\n'
  || E'        v_resource_id;',
  1
);

-- Snapshot: jointly lock binding + canonical Resource; all pointer reads/writes use Resource.
insert into phase_7a_k4c_a2_rewrites values
(
  20,
  'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)',
  '  v_binding editorial.audio_publication_resources%rowtype;',
  E'  v_binding editorial.audio_publication_resources%rowtype;\n'
  || E'  v_resource editorial.resources%rowtype;\n'
  || '  v_pair record;',
  1
),
(
  21,
  'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)',
  E'  select binding.*\n'
  || E'  into v_binding\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  where binding.publication_id =\n'
  || E'        p_publication_id\n'
  || E'  for update;',
  E'  select binding as binding_row, resource as resource_row\n'
  || E'  into v_pair\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  join editorial.resources resource\n'
  || E'    on resource.id = binding.resource_id\n'
  || E'  where binding.publication_id =\n'
  || E'        p_publication_id\n'
  || E'  for update of binding, resource;\n'
  || E'\n'
  || E'  v_binding := v_pair.binding_row;\n'
  || '  v_resource := v_pair.resource_row;',
  1
),
(
  22,
  'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)',
  'v_binding.current_working_version_id',
  'v_resource.current_working_version_id',
  2
),
(
  23,
  'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)',
  E'      update editorial.audio_publication_resources binding\n'
  || E'      set current_working_version_id =\n'
  || E'            v_snapshot.version_id\n'
  || E'      where binding.publication_id =\n'
  || E'            p_publication_id;',
  E'      update editorial.resources resource_update\n'
  || E'      set current_working_version_id =\n'
  || E'            v_snapshot.version_id\n'
  || E'      where resource_update.id =\n'
  || E'            v_binding.resource_id;',
  1
);

-- Archive: jointly lock Resource, move target selection and published clear.
insert into phase_7a_k4c_a2_rewrites values
(
  30,
  'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
  '  v_binding editorial.audio_publication_resources%rowtype;',
  E'  v_binding editorial.audio_publication_resources%rowtype;\n'
  || E'  v_resource editorial.resources%rowtype;\n'
  || '  v_pair record;',
  1
),
(
  31,
  'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
  E'  select binding.*\n'
  || E'  into v_binding\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  where binding.publication_id = p_publication_id\n'
  || E'  for update;',
  E'  select binding as binding_row, resource as resource_row\n'
  || E'  into v_pair\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  join editorial.resources resource\n'
  || E'    on resource.id = binding.resource_id\n'
  || E'  where binding.publication_id = p_publication_id\n'
  || E'  for update of binding, resource;\n'
  || E'\n'
  || E'  v_binding := v_pair.binding_row;\n'
  || '  v_resource := v_pair.resource_row;',
  1
),
(
  32,
  'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
  'v_binding.current_',
  'v_resource.current_',
  4
),
(
  33,
  'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
  E'    update editorial.audio_publication_resources binding\n'
  || E'    set current_published_version_id = null\n'
  || E'    where binding.publication_id = p_publication_id;',
  E'    update editorial.resources resource_pointer\n'
  || E'    set current_published_version_id = null\n'
  || E'    where resource_pointer.id = v_binding.resource_id;',
  1
);

-- Restore: jointly lock Resource and resolve target from canonical pointers.
insert into phase_7a_k4c_a2_rewrites values
(
  40,
  'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)',
  '  v_binding editorial.audio_publication_resources%rowtype;',
  E'  v_binding editorial.audio_publication_resources%rowtype;\n'
  || E'  v_resource editorial.resources%rowtype;\n'
  || '  v_pair record;',
  1
),
(
  41,
  'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)',
  E'  select binding.*\n'
  || E'  into v_binding\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  where binding.publication_id = p_publication_id\n'
  || E'  for update;',
  E'  select binding as binding_row, resource as resource_row\n'
  || E'  into v_pair\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  join editorial.resources resource\n'
  || E'    on resource.id = binding.resource_id\n'
  || E'  where binding.publication_id = p_publication_id\n'
  || E'  for update of binding, resource;\n'
  || E'\n'
  || E'  v_binding := v_pair.binding_row;\n'
  || '  v_resource := v_pair.resource_row;',
  1
),
(
  42,
  'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)',
  'v_binding.current_',
  'v_resource.current_',
  4
);

-- Snapshot helper: preserve binding identity; source Trust from canonical working position.
insert into phase_7a_k4c_a2_rewrites values
(
  50,
  'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
  '  v_binding editorial.audio_publication_resources%rowtype;',
  E'  v_binding editorial.audio_publication_resources%rowtype;\n'
  || E'  v_resource editorial.resources%rowtype;\n'
  || '  v_pair record;',
  1
),
(
  51,
  'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
  E'  select binding.* into v_binding\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  where binding.publication_id = p_publication_id;',
  E'  select binding as binding_row, resource as resource_row into v_pair\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  join editorial.resources resource\n'
  || E'    on resource.id = binding.resource_id\n'
  || E'  where binding.publication_id = p_publication_id;\n'
  || E'\n'
  || E'  v_binding := v_pair.binding_row;\n'
  || '  v_resource := v_pair.resource_row;',
  1
),
(
  52,
  'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
  'v_binding.current_working_version_id',
  'v_resource.current_working_version_id',
  1
);

-- Fingerprint helper: Discovery fingerprint resolves canonical working position.
insert into phase_7a_k4c_a2_rewrites values
(
  60,
  'audio.publication_content_fingerprint(uuid)',
  'binding.current_working_version_id',
  'resource.current_working_version_id',
  1
),
(
  61,
  'audio.publication_content_fingerprint(uuid)',
  E'  join editorial.audio_publication_resources binding\n'
  || E'    on binding.publication_id = publication.id',
  E'  join editorial.audio_publication_resources binding\n'
  || E'    on binding.publication_id = publication.id\n'
  || E'  join editorial.resources resource\n'
  || E'    on resource.id = binding.resource_id',
  1
);

-- Public read: retain binding identity, consume canonical published pointer.
insert into phase_7a_k4c_a2_rewrites values
(
  70,
  'public.get_public_audio_publication_m1(text)',
  '  v_binding editorial.audio_publication_resources%rowtype;',
  E'  v_binding editorial.audio_publication_resources%rowtype;\n'
  || E'  v_resource editorial.resources%rowtype;\n'
  || '  v_pair record;',
  1
),
(
  71,
  'public.get_public_audio_publication_m1(text)',
  E'  select binding.*\n'
  || E'  into v_binding\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  join editorial.resources resource_row\n'
  || E'    on resource_row.id = binding.resource_id\n'
  || E'   and resource_row.resource_kind = binding.resource_kind\n'
  || E'   and resource_row.lifecycle_state = ''published''\n'
  || E'   and resource_row.visibility = ''public''\n'
  || E'  where binding.publication_id = v_publication.id\n'
  || E'    and binding.current_published_version_id is not null;',
  E'  select binding as binding_row, resource_row as resource_row\n'
  || E'  into v_pair\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  join editorial.resources resource_row\n'
  || E'    on resource_row.id = binding.resource_id\n'
  || E'   and resource_row.resource_kind = binding.resource_kind\n'
  || E'   and resource_row.lifecycle_state = ''published''\n'
  || E'   and resource_row.visibility = ''public''\n'
  || E'  where binding.publication_id = v_publication.id\n'
  || E'    and resource_row.current_published_version_id is not null;\n'
  || E'\n'
  || E'  v_binding := v_pair.binding_row;\n'
  || '  v_resource := v_pair.resource_row;',
  1
),
(
  72,
  'public.get_public_audio_publication_m1(text)',
  'v_binding.current_published_version_id',
  'v_resource.current_published_version_id',
  1
);

-- Trust mutation RPCs: lock binding + canonical Resource together.
insert into phase_7a_k4c_a2_rewrites values
(
  80,
  'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
  '  v_binding editorial.audio_publication_resources%rowtype;',
  E'  v_binding editorial.audio_publication_resources%rowtype;\n'
  || E'  v_resource editorial.resources%rowtype;\n'
  || '  v_pair record;',
  1
),
(
  81,
  'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
  '  select * into v_binding from editorial.audio_publication_resources where resource_id=v_version.resource_id and publication_id=v_version.publication_id for update;',
  E'  select binding as binding_row, resource as resource_row into v_pair\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  join editorial.resources resource on resource.id=binding.resource_id\n'
  || E'  where binding.resource_id=v_version.resource_id and binding.publication_id=v_version.publication_id\n'
  || E'  for update of binding, resource;\n'
  || E'  v_binding := v_pair.binding_row;\n'
  || '  v_resource := v_pair.resource_row;',
  1
),
(
  82,
  'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
  'v_binding.current_working_version_id',
  'v_resource.current_working_version_id',
  1
),
(
  90,
  'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
  '  v_binding editorial.audio_publication_resources%rowtype;',
  E'  v_binding editorial.audio_publication_resources%rowtype;\n'
  || E'  v_resource editorial.resources%rowtype;\n'
  || '  v_pair record;',
  1
),
(
  91,
  'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
  '  select * into v_binding from editorial.audio_publication_resources where resource_id=v_version.resource_id and publication_id=v_version.publication_id for update;',
  E'  select binding as binding_row, resource as resource_row into v_pair\n'
  || E'  from editorial.audio_publication_resources binding\n'
  || E'  join editorial.resources resource on resource.id=binding.resource_id\n'
  || E'  where binding.resource_id=v_version.resource_id and binding.publication_id=v_version.publication_id\n'
  || E'  for update of binding, resource;\n'
  || E'  v_binding := v_pair.binding_row;\n'
  || '  v_resource := v_pair.resource_row;',
  1
),
(
  92,
  'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
  'v_binding.current_working_version_id',
  'v_resource.current_working_version_id',
  1
);

-- Shared Discovery metadata: Audio reads/writes same canonical Resource pointer as Playlist.
insert into phase_7a_k4c_a2_rewrites values
(
  100,
  'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)',
  E'    select binding.current_working_version_id into v_current_working_version_id\n'
  || E'    from editorial.audio_publication_resources binding\n'
  || E'    where binding.resource_id = v_identity.resource_id\n'
  || E'    for update;',
  E'    select resource.current_working_version_id into v_current_working_version_id\n'
  || E'    from editorial.resources resource\n'
  || E'    where resource.id = v_identity.resource_id\n'
  || E'    for update;',
  1
),
(
  101,
  'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)',
  E'      update editorial.audio_publication_resources binding\n'
  || E'      set current_working_version_id = v_new_version_id\n'
  || E'      where binding.resource_id = v_identity.resource_id;',
  E'      update editorial.resources resource_update\n'
  || E'      set current_working_version_id = v_new_version_id\n'
  || E'      where resource_update.id = v_identity.resource_id;',
  1
);

do $phase_7a_k4c_a2_apply_rewrites$
declare
  rewrite_row record;
  v_definition text;
  v_occurrences bigint;
  v_current_signature text := null;
begin
  for rewrite_row in
    select *
    from phase_7a_k4c_a2_rewrites
    order by rewrite_order
  loop
    if v_current_signature is distinct from rewrite_row.signature then
      if v_current_signature is not null then
        execute v_definition;
      end if;

      v_current_signature := rewrite_row.signature;
      select pg_get_functiondef(
        to_regprocedure(v_current_signature)
      )
      into v_definition;

      if v_definition is null then
        raise exception
          'STOP: K4C-A2 rewrite target missing: %',
          v_current_signature;
      end if;
    end if;

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
      ) / nullif(length(rewrite_row.old_fragment), 0);

    if v_occurrences <> rewrite_row.expected_occurrences then
      raise exception
        'STOP: K4C-A2 exact old-fragment count drifted in % at rewrite % (expected %, found %)',
        rewrite_row.signature,
        rewrite_row.rewrite_order,
        rewrite_row.expected_occurrences,
        v_occurrences;
    end if;

    v_definition :=
      replace(
        v_definition,
        rewrite_row.old_fragment,
        rewrite_row.new_fragment
      );
  end loop;

  if v_current_signature is not null then
    execute v_definition;
  end if;
end;
$phase_7a_k4c_a2_apply_rewrites$;

-- CREATE OR REPLACE preserves existing function ownership and ACLs. A2 does not
-- normalize grants; postflight requires the exact accepted ACL/config perimeter.

do $phase_7a_k4c_a2_postflight$
declare
  v_count bigint;
begin
  -- No business function may still write typed Audio pointers.
  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and (
      pg_get_functiondef(procedure_row.oid)
        ~* 'update[[:space:]]+editorial[.]audio_publication_resources[[:space:][:print:]]{0,200}set[[:space:][:print:]]{0,200}current_(working|submitted|approved|published)_version_id'
      or pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]audio_publication_resources[[:space:]]*[(][^)]*current_(working|submitted|approved|published)_version_id'
    );

  if v_count <> 1 then
    raise exception
      'STOP: K4C-A2 expected only K1 Resource-to-typed compatibility writer after convergence, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
      and pg_get_functiondef(procedure_row.oid)
        ~ 'editorial[.]audio_publication_resources'
  ) then
    raise exception
      'STOP: K4C-A2 accidentally removed the K1 Audio compatibility writer';
  end if;

  -- No live business reader may consume typed Audio pointers after A2.
  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and procedure_row.oid <>
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    and pg_get_functiondef(procedure_row.oid)
      ~ 'editorial[.]audio_publication_resources'
    and pg_get_functiondef(procedure_row.oid)
      ~ '(v_binding|binding|audio_binding)[.]current_(working|submitted|approved|published)_version_id';

  if v_count <> 0 then
    raise exception
      'STOP: K4C-A2 % live business function(s) still read typed Audio pointers',
      v_count;
  end if;

  -- Typed mirror stays parity-safe until A3.
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
      'STOP: K4C-A2 Audio pointer mirror divergence(s) exist: %',
      v_count;
  end if;

  -- Function-only convergence must not mutate existing binding data.
  if (
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
  ) is distinct from (
    select audio_binding_fingerprint
    from phase_7a_k4c_a2_data_baseline
  ) then
    raise exception
      'STOP: K4C-A2 function convergence mutated Audio binding lifecycle data';
  end if;

  if exists (
    select 1
    from phase_7a_k4c_a2_function_baseline baseline
    join pg_proc procedure_row
      on procedure_row.oid = baseline.procedure_oid
    where procedure_row.proowner <> baseline.owner_oid
       or procedure_row.prosecdef <> baseline.security_definer
       or coalesce(procedure_row.proconfig::text,'') <> baseline.function_config
       or coalesce(procedure_row.proacl::text,'') <> baseline.function_acl
  ) then
    raise exception
      'STOP: K4C-A2 changed target function owner, SECURITY DEFINER, search_path, or ACL';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+audio[.]publication_(review|lifecycle)_events'
  ) then
    raise exception
      'STOP: K4C-A2 renewed typed Audio event authority';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='editorial'
      and table_name='playlist_resources'
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: K4C-A2 regressed Playlist P3 pointer retirement';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4C-A2 renewed typed Video event authority';
  end if;
end;
$phase_7a_k4c_a2_postflight$;

commit;
