-- Phase 7A K4C-P2: Playlist pointer-writer convergence.
--
-- Move every remaining governed Playlist lifecycle pointer write onto
-- editorial.resources while retaining K1 typed compatibility mirrors and
-- both synchronization triggers for reader compatibility until K4C-P3.

begin;

create temporary table phase_7a_k4c_p2_data_baseline
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
    from editorial.playlist_resources binding
  ) as playlist_binding_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          to_jsonb(resource_row)::text,
          E'\n'
          order by resource_row.id::text
        ),
        ''
      )
    )
    from editorial.resources resource_row
    where resource_row.resource_kind = 'playlist'
  ) as playlist_resource_fingerprint;

create temporary table phase_7a_k4c_p2_acl_baseline
on commit drop
as
select
  procedure_row.oid,
  procedure_row.oid::regprocedure::text as signature,
  procedure_row.proowner,
  procedure_row.prosecdef,
  procedure_row.proconfig::text as proconfig
from pg_proc procedure_row
where procedure_row.oid in (
  'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'::regprocedure,
  'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure,
  'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure,
  'public.publish_due_playlist_publications(integer)'::regprocedure,
  'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'::regprocedure,
  'public.unpublish_playlist(uuid,bigint,text,text,uuid)'::regprocedure,
  'public.archive_playlist(uuid,bigint,text,text,uuid)'::regprocedure
);

do $phase_7a_k4c_p2_preflight$
declare
  v_count bigint;
begin
  if to_regprocedure(
       'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.sync_resource_lifecycle_from_typed_binding()'
     ) is null
     or to_regprocedure(
       'editorial.sync_typed_lifecycle_from_resource()'
     ) is null
  then
    raise exception
      'STOP: K4C-P2 requires accepted K1 and production-sealed K4C-P1 authority';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.playlist_resources'::regclass
      and trigger_row.tgname = 'playlist_resources_sync_shared_lifecycle'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.resources'::regclass
      and trigger_row.tgname = 'resources_sync_typed_lifecycle_compatibility'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-P2 requires both K1 Playlist pointer synchronization triggers';
  end if;

  select count(*)
  into v_count
  from editorial.playlist_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: % Playlist pointer mirror divergence(s) exist before K4C-P2',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.oid in (
    'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'::regprocedure,
    'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure,
    'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure,
    'public.publish_due_playlist_publications(integer)'::regprocedure,
    'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'::regprocedure,
    'public.unpublish_playlist(uuid,bigint,text,text,uuid)'::regprocedure,
    'public.archive_playlist(uuid,bigint,text,text,uuid)'::regprocedure
  )
    and pg_get_functiondef(procedure_row.oid)
      ~* 'update[[:space:]]+editorial[.]playlist_resources'
    and pg_get_functiondef(procedure_row.oid)
      ~* 'current_(working|submitted|approved|published)_version_id';

  if v_count <> 7 then
    raise exception
      'STOP: Expected exactly 7 governed Playlist typed-pointer writers before K4C-P2, found %',
      v_count;
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'update[[:space:]]+editorial[.]playlist_resources'
      and pg_get_functiondef(procedure_row.oid)
        ~* 'current_(working|submitted|approved|published)_version_id'
      and procedure_row.oid not in (
        'editorial.sync_typed_lifecycle_from_resource()'::regprocedure,
        'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'::regprocedure,
        'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure,
        'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure,
        'public.publish_due_playlist_publications(integer)'::regprocedure,
        'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'::regprocedure,
        'public.unpublish_playlist(uuid,bigint,text,text,uuid)'::regprocedure,
        'public.archive_playlist(uuid,bigint,text,text,uuid)'::regprocedure
      )
  ) then
    raise exception
      'STOP: An unexpected direct Playlist typed-pointer writer exists before K4C-P2';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]playlist_(review|lifecycle)_events'
  ) then
    raise exception
      'STOP: K4C-P1 typed Playlist event-writer retirement has regressed';
  end if;
end;
$phase_7a_k4c_p2_preflight$;

create temporary table phase_7a_k4c_p2_rewrites (
  rewrite_order integer primary key,
  signature text not null,
  old_fragment text not null,
  new_fragment text not null
)
on commit drop;

insert into phase_7a_k4c_p2_rewrites (
  rewrite_order,
  signature,
  old_fragment,
  new_fragment
)
values
(
  10,
  'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)',
  E'      update editorial.playlist_resources binding_update\n'
    || E'      set current_working_version_id =\n'
    || E'            v_snapshot.version_id\n'
    || E'      where binding_update.playlist_id = p_playlist_id;',
  E'      update editorial.resources resource_update\n'
    || E'      set current_working_version_id =\n'
    || E'            v_snapshot.version_id\n'
    || E'      where resource_update.id = v_binding.resource_id;'
),
(
  20,
  'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)',
  E'      update editorial.playlist_resources binding\n'
    || E'      set current_working_version_id = v_new_version_id\n'
    || E'      where binding.resource_id = v_identity.resource_id;',
  E'      update editorial.resources resource_update\n'
    || E'      set current_working_version_id = v_new_version_id\n'
    || E'      where resource_update.id = v_identity.resource_id;'
),
(
  30,
  'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)',
  E'      update editorial.playlist_resources binding_update\n'
    || E'      set current_published_version_id =\n'
    || E'            v_published.version_id\n'
    || E'      where binding_update.playlist_id =\n'
    || E'              p_playlist_id;',
  E'      update editorial.resources resource_pointer\n'
    || E'      set current_published_version_id =\n'
    || E'            v_published.version_id\n'
    || E'      where resource_pointer.id =\n'
    || E'              v_binding.resource_id;'
),
(
  40,
  'public.publish_due_playlist_publications(integer)',
  E'    update editorial.playlist_resources as binding\n'
    || E'    set current_published_version_id =\n'
    || E'          v_published.version_id\n'
    || E'    where binding.playlist_id =\n'
    || E'            due_schedule.playlist_id;',
  E'    update editorial.resources resource_pointer\n'
    || E'    set current_published_version_id =\n'
    || E'          v_published.version_id\n'
    || E'    where resource_pointer.id =\n'
    || E'            v_binding.resource_id;'
),
(
  50,
  'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)',
  E'        update editorial.playlist_resources as binding\n'
    || E'        set current_approved_version_id = null\n'
    || E'        where binding.playlist_id = p_playlist_id;',
  E'        update editorial.resources resource_pointer\n'
    || E'        set current_approved_version_id = null\n'
    || E'        where resource_pointer.id = v_binding.resource_id;'
),
(
  60,
  'public.unpublish_playlist(uuid,bigint,text,text,uuid)',
  E'      update editorial.playlist_resources as binding\n'
    || E'      set current_approved_version_id = null\n'
    || E'      where binding.playlist_id = p_playlist_id;',
  E'      update editorial.resources resource_pointer\n'
    || E'      set current_approved_version_id = null\n'
    || E'      where resource_pointer.id = v_binding.resource_id;'
),
(
  70,
  'public.unpublish_playlist(uuid,bigint,text,text,uuid)',
  E'    update editorial.playlist_resources as binding\n'
    || E'    set current_published_version_id = null\n'
    || E'    where binding.playlist_id = p_playlist_id;',
  E'    update editorial.resources resource_pointer\n'
    || E'    set current_published_version_id = null\n'
    || E'    where resource_pointer.id = v_binding.resource_id;'
),
(
  80,
  'public.archive_playlist(uuid,bigint,text,text,uuid)',
  E'    update editorial.playlist_resources as binding\n'
    || E'    set current_published_version_id = null\n'
    || E'    where binding.playlist_id = p_playlist_id;',
  E'    update editorial.resources resource_pointer\n'
    || E'    set current_published_version_id = null\n'
    || E'    where resource_pointer.id = v_binding.resource_id;'
);

do $phase_7a_k4c_p2_rewrite$
declare
  rewrite_row record;
  v_regprocedure regprocedure;
  v_definition text;
  v_occurrences integer;
begin
  for rewrite_row in
    select *
    from phase_7a_k4c_p2_rewrites
    order by rewrite_order
  loop
    v_regprocedure :=
      to_regprocedure(rewrite_row.signature);

    if v_regprocedure is null then
      raise exception
        'STOP: K4C-P2 target function % does not exist',
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

    if v_occurrences <> 1 then
      raise exception
        'STOP: K4C-P2 expected exactly one old pointer-writer fragment in %, found %',
        rewrite_row.signature,
        v_occurrences;
    end if;

    if position(
      rewrite_row.new_fragment
      in v_definition
    ) <> 0 then
      raise exception
        'STOP: K4C-P2 canonical pointer-writer fragment already exists in %',
        rewrite_row.signature;
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
$phase_7a_k4c_p2_rewrite$;

-- Replay baselines can inherit historical default EXECUTE grants that are
-- already closed in production. Normalize these replaced public RPCs back to
-- the accepted production perimeter explicitly.
revoke execute
on function public.snapshot_playlist_working_version(
  uuid,bigint,text,uuid
)
from public, anon;

grant execute
on function public.snapshot_playlist_working_version(
  uuid,bigint,text,uuid
)
to authenticated, service_role;

revoke execute
on function public.save_resource_version_editorial_metadata(
  text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid
)
from public, anon;

grant execute
on function public.save_resource_version_editorial_metadata(
  text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid
)
to authenticated, service_role;

revoke execute
on function public.publish_playlist_version(
  uuid,bigint,uuid,text,text,uuid
)
from public, anon;

grant execute
on function public.publish_playlist_version(
  uuid,bigint,uuid,text,text,uuid
)
to authenticated, service_role;

revoke execute
on function public.publish_due_playlist_publications(integer)
from public, anon;

grant execute
on function public.publish_due_playlist_publications(integer)
to authenticated, service_role;

revoke execute
on function public.unschedule_playlist_publication(
  uuid,bigint,text,text,uuid
)
from public, anon;

grant execute
on function public.unschedule_playlist_publication(
  uuid,bigint,text,text,uuid
)
to authenticated, service_role;

revoke execute
on function public.unpublish_playlist(
  uuid,bigint,text,text,uuid
)
from public, anon;

grant execute
on function public.unpublish_playlist(
  uuid,bigint,text,text,uuid
)
to authenticated, service_role;

revoke execute
on function public.archive_playlist(
  uuid,bigint,text,text,uuid
)
from public, anon;

grant execute
on function public.archive_playlist(
  uuid,bigint,text,text,uuid
)
to authenticated, service_role;

do $phase_7a_k4c_p2_postconditions$
declare
  rewrite_row record;
  v_definition text;
  v_count bigint;
  v_data_baseline record;
begin
  for rewrite_row in
    select *
    from phase_7a_k4c_p2_rewrites
    order by rewrite_order
  loop
    select pg_get_functiondef(
      to_regprocedure(rewrite_row.signature)
    )
    into v_definition;

    if position(
         rewrite_row.old_fragment
         in v_definition
       ) <> 0
       or position(
         rewrite_row.new_fragment
         in v_definition
       ) = 0
    then
      raise exception
        'STOP: K4C-P2 pointer-writer rewrite did not seal for %',
        rewrite_row.signature;
    end if;
  end loop;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'update[[:space:]]+editorial[.]playlist_resources'
    and pg_get_functiondef(procedure_row.oid)
      ~* 'current_(working|submitted|approved|published)_version_id'
    and procedure_row.oid
      <> 'editorial.sync_typed_lifecycle_from_resource()'::regprocedure;

  if v_count <> 0 then
    raise exception
      'STOP: % governed/direct Playlist typed-pointer writer(s) remain after K4C-P2',
      v_count;
  end if;

  select pg_get_functiondef(
    'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
  )
  into v_definition;

  if v_definition not ilike '%update editorial.playlist_resources%'
     or v_definition not ilike '%current_working_version_id%'
     or v_definition not ilike '%current_submitted_version_id%'
     or v_definition not ilike '%current_approved_version_id%'
     or v_definition not ilike '%current_published_version_id%'
  then
    raise exception
      'STOP: K4C-P2 accidentally removed the K1 Resource-to-typed compatibility writer';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.playlist_resources'::regclass
      and trigger_row.tgname = 'playlist_resources_sync_shared_lifecycle'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.resources'::regclass
      and trigger_row.tgname = 'resources_sync_typed_lifecycle_compatibility'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-P2 removed a K1 pointer compatibility trigger';
  end if;

  select count(*)
  into v_count
  from editorial.playlist_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: K4C-P2 left % Playlist pointer mirror divergence(s)',
      v_count;
  end if;

  select *
  into v_data_baseline
  from phase_7a_k4c_p2_data_baseline;

  if v_data_baseline.playlist_binding_fingerprint
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
         from editorial.playlist_resources binding
       )
     or v_data_baseline.playlist_resource_fingerprint
       is distinct from (
         select md5(
           coalesce(
             string_agg(
               to_jsonb(resource_row)::text,
               E'\n'
               order by resource_row.id::text
             ),
             ''
           )
         )
         from editorial.resources resource_row
         where resource_row.resource_kind = 'playlist'
       )
  then
    raise exception
      'STOP: K4C-P2 function convergence mutated Playlist lifecycle data';
  end if;

  if exists (
    select 1
    from phase_7a_k4c_p2_acl_baseline baseline
    join pg_proc procedure_row
      on procedure_row.oid = baseline.oid
    where procedure_row.proowner
            is distinct from baseline.proowner
       or procedure_row.prosecdef
            is distinct from baseline.prosecdef
       or procedure_row.proconfig::text
            is distinct from baseline.proconfig
  ) then
    raise exception
      'STOP: K4C-P2 changed target function owner, SECURITY DEFINER, or search_path';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid in (
      'public.snapshot_playlist_working_version(uuid,bigint,text,uuid)'::regprocedure,
      'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure,
      'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure,
      'public.publish_due_playlist_publications(integer)'::regprocedure,
      'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'::regprocedure,
      'public.unpublish_playlist(uuid,bigint,text,text,uuid)'::regprocedure,
      'public.archive_playlist(uuid,bigint,text,text,uuid)'::regprocedure
    )
      and (
        has_function_privilege('public', procedure_row.oid, 'EXECUTE')
        or has_function_privilege('anon', procedure_row.oid, 'EXECUTE')
        or not has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')
        or not has_function_privilege('service_role', procedure_row.oid, 'EXECUTE')
      )
  ) then
    raise exception
      'STOP: K4C-P2 did not preserve the accepted Playlist RPC execution perimeter';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]playlist_(review|lifecycle)_events'
  ) then
    raise exception
      'STOP: K4C-P2 renewed Playlist typed event authority';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4C-P2 renewed typed Video event authority';
  end if;
end;
$phase_7a_k4c_p2_postconditions$;

commit;
