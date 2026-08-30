-- Phase 7A K4C-AR3: Article cross-system reader convergence and
-- typed-event retirement.
--
-- Move the final two live Article lifecycle readers from
-- editorial.article_lifecycle_events to canonical shared Resource lifecycle
-- history. Keep the typed table physically present, immutable compatibility
-- history with the exact accepted 35-row fingerprint.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7a-k4c-ar3-article-cross-system-reader-convergence-typed-event-retirement',
    0
  )
);

create temporary table phase_7a_k4c_ar3_baseline
on commit drop
as
select
  (select count(*) from editorial.article_lifecycle_events)
    as typed_count,
  (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from editorial.article_lifecycle_events e
  ) as typed_fingerprint,
  (
    select count(*)
    from editorial.resource_lifecycle_events event_row
    join editorial.resources resource_row
      on resource_row.id = event_row.resource_id
    where resource_row.resource_kind = 'article'
  ) as shared_article_count;


do $phase_7a_k4c_ar3_preflight$
declare
  v_count bigint;
  v_names text[];
begin
  if to_regclass('editorial.article_lifecycle_events') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regprocedure(
       'editorial.correction_article_publication_proof(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.derive_publishing_editorial_state(uuid)'
     ) is null
  then
    raise exception
      'STOP: Phase 7A K4C-AR3 requires accepted 63/AR2 Article authority';
  end if;

  if (
    select typed_count
    from phase_7a_k4c_ar3_baseline
  ) <> 35
     or (
       select typed_fingerprint
       from phase_7a_k4c_ar3_baseline
     ) <> 'dd7ac00209d19f3f369fb0d9b3e1e6a1'
  then
    raise exception
      'STOP: K4C-AR3 typed Article historical compatibility baseline drifted';
  end if;

  if (
    select shared_article_count
    from phase_7a_k4c_ar3_baseline
  ) < 35
  then
    raise exception
      'STOP: K4C-AR3 shared Article lifecycle history is incomplete';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.correction_article_publication_proof(uuid)'::regprocedure
       )
     ) <> '3bdd9467a857da7a8f6373a50e237295'
     or md5(
       pg_get_functiondef(
         'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
       )
     ) <> 'f89b6060e68ae2e1154f689a741dc831'
  then
    raise exception
      'STOP: K4C-AR3 target reader authority drifted';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority = 'article_lifecycle'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.version_id is not distinct from source.version_id
     and shared.action = source.action
     and shared.prior_status is not distinct from source.prior_status
     and shared.resulting_status is not distinct from source.resulting_status
     and shared.note is not distinct from source.note
     and shared.metadata = coalesce(source.metadata, '{}'::jsonb)
     and shared.actor_id is not distinct from source.actor_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'STOP: K4C-AR3 typed Article history is not fully represented in shared history';
  end if;

  select
    count(*),
    array_agg(
      namespace_row.nspname || '.' || procedure_row.proname
      order by namespace_row.nspname, procedure_row.proname
    )
  into
    v_count,
    v_names
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~ 'editorial[.]article_lifecycle_events';

  if v_count <> 2
     or v_names is distinct from array[
       'editorial.correction_article_publication_proof',
       'editorial.derive_publishing_editorial_state'
     ]::text[]
  then
    raise exception
      'STOP: K4C-AR3 final typed Article dependency scan is not exactly two readers: % / %',
      v_count,
      v_names;
  end if;

  if exists (
    select 1
    from information_schema.views view_row
    where view_row.view_definition ilike
      '%editorial.article_lifecycle_events%'
  ) or exists (
    select 1
    from pg_matviews matview_row
    where matview_row.definition ilike
      '%editorial.article_lifecycle_events%'
  ) or exists (
    select 1
    from pg_policies policy_row
    where coalesce(policy_row.qual, '') ilike
        '%article_lifecycle_events%'
       or coalesce(policy_row.with_check, '') ilike
        '%article_lifecycle_events%'
  ) then
    raise exception
      'STOP: K4C-AR3 found a non-function live dependency on typed Article history';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
       )
     ) <> 'd84d503da70733c010a93025bca7cda7'
  then
    raise exception
      'STOP: K4C-AR3 shared lifecycle helper authority drifted';
  end if;

  if md5(
       pg_get_functiondef(
         'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> 'b2d6c14458a6a1b9824565c715237ef9'
     or md5(
       pg_get_functiondef(
         'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> 'c7a5df4d7de4d740fb680f4dc52dfc46'
     or md5(
       pg_get_functiondef(
         'public.publish_due_article_publications(integer)'::regprocedure
       )
     ) <> '12311085f7d61e044468e6c6cabbfd9e'
     or md5(
       pg_get_functiondef(
         'public.unpublish_article(uuid,text)'::regprocedure
       )
     ) <> 'e4904cf58a152dffe23345c9c077ece3'
     or md5(
       pg_get_functiondef(
         'public.archive_article(uuid,text)'::regprocedure
       )
     ) <> 'e5575e7ac122b98128e341898a0052c7'
     or md5(
       pg_get_functiondef(
         'public.restore_article_from_archive(uuid,text)'::regprocedure
       )
     ) <> '82d29071e92b4e09825c76f1b2b6a883'
  then
    raise exception
      'STOP: K4C-AR3 AR2 Article publication authority drifted';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.assert_correction_public_note_integrity()'::regprocedure
       )
     ) <> '9fcaaee0694f103fc7b64e9f3b01549f'
     or md5(
       pg_get_functiondef(
         'editorial.validate_correction_case_history(uuid)'::regprocedure
       )
     ) <> 'ffa4fbba0c8cb7a19f015a39d3864adf'
     or md5(
       pg_get_functiondef(
         'public.close_correction_case(uuid,bigint,text,text,uuid,text,text,text,text)'::regprocedure
       )
     ) <> '933345920e74c08a217d4c02d00271ec'
     or md5(
       pg_get_functiondef(
         'public.public_get_article_correction_notes(text)'::regprocedure
       )
     ) <> 'f4495500ba9e1ecd6a7b95c8769d3e8d'
     or md5(
       pg_get_functiondef(
         'public.publish_correction_note(uuid,bigint,uuid,uuid,text,uuid,text,text,text,uuid)'::regprocedure
       )
     ) <> '9bd8f5d6b14da2c98bb95b46f8e482c6'
  then
    raise exception
      'STOP: K4C-AR3 Corrections caller authority drifted';
  end if;

  if not (
    select class_row.relrowsecurity
    from pg_class class_row
    join pg_namespace namespace_row
      on namespace_row.oid = class_row.relnamespace
    where namespace_row.nspname = 'editorial'
      and class_row.relname = 'article_lifecycle_events'
  ) then
    raise exception
      'STOP: K4C-AR3 historical typed table lost RLS';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'service_role',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
  then
    raise exception
      'STOP: K4C-AR3 typed Article historical table app-role perimeter drifted';
  end if;
end;
$phase_7a_k4c_ar3_preflight$;


create or replace function editorial.correction_article_publication_proof(
  p_application_id uuid
)
returns table(
  case_resource_id uuid,
  application_id uuid,
  affected_resource_id uuid,
  article_id uuid,
  challenged_version_id uuid,
  application_resulting_version_id uuid,
  corrected_version_id uuid,
  content_fingerprint text,
  article_slug text
)
language sql
stable
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  select
    application.case_resource_id,
    application.id,
    application.target_resource_id,
    application_version.article_id,
    application.challenged_version_id,
    application.resulting_version_id,
    published_version.id,
    published_version.content_fingerprint,
    article.slug
  from editorial.correction_applications application
  join editorial.article_versions application_version
    on application_version.id =
      application.resulting_version_id
   and application_version.resource_id =
      application.target_resource_id
   and application_version.version_kind =
      'correction'
  join editorial.resources resource
    on resource.id =
      application.target_resource_id
   and resource.resource_kind = 'article'
  join editorial.article_versions published_version
    on published_version.id =
      resource.current_published_version_id
   and published_version.resource_id =
      application.target_resource_id
   and published_version.article_id =
      application_version.article_id
   and published_version.version_kind =
      'published'
   and published_version.content_fingerprint =
      application_version.content_fingerprint
  join editorial.article_resources binding
    on binding.resource_id =
      application.target_resource_id
   and binding.resource_kind = 'article'
   and binding.article_id =
      application_version.article_id
  join public.wk_articles article
    on article.id =
      application_version.article_id
  join public.wk_article_publication_snapshots snapshot
    on snapshot.article_id =
      application_version.article_id
   and snapshot.resource_id =
      application.target_resource_id
   and snapshot.version_id =
      published_version.id
   and snapshot.is_active
  where application.id =
      p_application_id
    and exists (
      select 1
      from editorial.resource_lifecycle_events lifecycle_event
      where lifecycle_event.resource_id =
          application.target_resource_id
        and lifecycle_event.version_id =
          published_version.id
        and lifecycle_event.action =
          'published'
    )
    and editorial.article_snapshot_fingerprint(
      article.title,
      article.slug,
      article.excerpt,
      article.content_html,
      article.author,
      article.hero_image_id,
      article.hero_image_url,
      article.seo,
      article.wp_status,
      article.published_at,
      article.categories,
      article.tags
    ) = published_version.content_fingerprint;
$function$;


create or replace function editorial.derive_publishing_editorial_state(
  p_resource_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_resource editorial.resources%rowtype;
  v_latest_article_action text;
begin
  if p_resource_id is null then
    return 'not_linked';
  end if;

  if not exists (
    select 1
    from editorial.publishing_items item
    where item.resource_id = p_resource_id
      and editorial.current_user_can_view_publishing_item(
        item.id
      )
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = p_resource_id;

  if not found then
    return 'not_linked';
  end if;

  if v_resource.resource_kind = 'article' then
    select event.action
    into v_latest_article_action
    from editorial.resource_lifecycle_events event
    where event.resource_id = p_resource_id
      and event.action in (
        'submitted',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'unpublished',
        'archived',
        'restored'
      )
    order by
      event.created_at desc,
      event.id desc
    limit 1;

    if v_latest_article_action =
       'changes_requested'
    then
      return 'changes_requested';
    end if;
  end if;

  if v_resource.lifecycle_state = 'published'
     and (
       v_resource.resource_kind <> 'article'
       or v_resource.current_published_version_id
          is not null
     )
  then
    return 'published';
  end if;

  if v_resource.current_approved_version_id
     is not null
  then
    return 'approved';
  end if;

  if v_resource.current_submitted_version_id
     is not null
  then
    return 'submitted';
  end if;

  return 'draft';
end;
$function$;


-- Preserve the accepted execution perimeter explicitly after replacement.
revoke execute
on function editorial.correction_article_publication_proof(uuid)
from public, anon, authenticated, service_role;

grant execute
on function editorial.correction_article_publication_proof(uuid)
to service_role;

revoke execute
on function editorial.derive_publishing_editorial_state(uuid)
from public, anon;

grant execute
on function editorial.derive_publishing_editorial_state(uuid)
to authenticated, service_role;


do $phase_7a_k4c_ar3_postflight$
declare
  v_count bigint;
  v_names text[];
  v_definition text;
begin
  if (
    select count(*)
    from editorial.article_lifecycle_events
  ) <> (
    select typed_count
    from phase_7a_k4c_ar3_baseline
  ) or (
    select md5(
      coalesce(
        string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
        ''
      )
    )
    from editorial.article_lifecycle_events e
  ) is distinct from (
    select typed_fingerprint
    from phase_7a_k4c_ar3_baseline
  ) then
    raise exception
      'STOP: K4C-AR3 changed typed Article historical compatibility rows';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority = 'article_lifecycle'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.version_id is not distinct from source.version_id
     and shared.action = source.action
     and shared.prior_status is not distinct from source.prior_status
     and shared.resulting_status is not distinct from source.resulting_status
     and shared.note is not distinct from source.note
     and shared.metadata = coalesce(source.metadata, '{}'::jsonb)
     and shared.actor_id is not distinct from source.actor_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'STOP: K4C-AR3 historical Article compatibility mapping regressed';
  end if;

  select
    count(*),
    array_agg(
      namespace_row.nspname || '.' || procedure_row.proname
      order by namespace_row.nspname, procedure_row.proname
    )
  into
    v_count,
    v_names
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~ 'editorial[.]article_lifecycle_events';

  if v_count <> 0 then
    raise exception
      'STOP: K4C-AR3 left live typed Article lifecycle dependencies: % / %',
      v_count,
      v_names;
  end if;

  if exists (
    select 1
    from information_schema.views view_row
    where view_row.view_definition ilike
      '%editorial.article_lifecycle_events%'
  ) or exists (
    select 1
    from pg_matviews matview_row
    where matview_row.definition ilike
      '%editorial.article_lifecycle_events%'
  ) or exists (
    select 1
    from pg_policies policy_row
    where coalesce(policy_row.qual, '') ilike
        '%article_lifecycle_events%'
       or coalesce(policy_row.with_check, '') ilike
        '%article_lifecycle_events%'
  ) then
    raise exception
      'STOP: K4C-AR3 left a non-function live typed Article dependency';
  end if;

  select pg_get_functiondef(
    'editorial.correction_article_publication_proof(uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('editorial.article_lifecycle_events' in v_definition) <> 0
     or position('published_version.id' in v_definition) = 0
     or position('snapshot.is_active' in v_definition) = 0
     or position('editorial.article_snapshot_fingerprint' in v_definition) = 0
  then
    raise exception
      'STOP: K4C-AR3 Corrections publication proof did not converge equivalently';
  end if;

  select pg_get_functiondef(
    'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('editorial.article_lifecycle_events' in v_definition) <> 0
     or position('changes_requested' in v_definition) = 0
     or position('current_approved_version_id' in v_definition) = 0
     or position('current_submitted_version_id' in v_definition) = 0
     or position('current_published_version_id' in v_definition) = 0
  then
    raise exception
      'STOP: K4C-AR3 Publishing editorial-state derivation drifted';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.assert_correction_public_note_integrity()'::regprocedure
       )
     ) <> '9fcaaee0694f103fc7b64e9f3b01549f'
     or md5(
       pg_get_functiondef(
         'editorial.validate_correction_case_history(uuid)'::regprocedure
       )
     ) <> 'ffa4fbba0c8cb7a19f015a39d3864adf'
     or md5(
       pg_get_functiondef(
         'public.close_correction_case(uuid,bigint,text,text,uuid,text,text,text,text)'::regprocedure
       )
     ) <> '933345920e74c08a217d4c02d00271ec'
     or md5(
       pg_get_functiondef(
         'public.public_get_article_correction_notes(text)'::regprocedure
       )
     ) <> 'f4495500ba9e1ecd6a7b95c8769d3e8d'
     or md5(
       pg_get_functiondef(
         'public.publish_correction_note(uuid,bigint,uuid,uuid,text,uuid,text,text,text,uuid)'::regprocedure
       )
     ) <> '9bd8f5d6b14da2c98bb95b46f8e482c6'
  then
    raise exception
      'STOP: K4C-AR3 rewrote Corrections caller authority';
  end if;

  if md5(
       pg_get_functiondef(
         'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> 'b2d6c14458a6a1b9824565c715237ef9'
     or md5(
       pg_get_functiondef(
         'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> 'c7a5df4d7de4d740fb680f4dc52dfc46'
     or md5(
       pg_get_functiondef(
         'public.publish_due_article_publications(integer)'::regprocedure
       )
     ) <> '12311085f7d61e044468e6c6cabbfd9e'
     or md5(
       pg_get_functiondef(
         'public.unpublish_article(uuid,text)'::regprocedure
       )
     ) <> 'e4904cf58a152dffe23345c9c077ece3'
     or md5(
       pg_get_functiondef(
         'public.archive_article(uuid,text)'::regprocedure
       )
     ) <> 'e5575e7ac122b98128e341898a0052c7'
     or md5(
       pg_get_functiondef(
         'public.restore_article_from_archive(uuid,text)'::regprocedure
       )
     ) <> '82d29071e92b4e09825c76f1b2b6a883'
  then
    raise exception
      'STOP: K4C-AR3 AR2 publication authority changed';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
      and procedure_row.prosecdef
      and coalesce(procedure_row.proconfig, '{}'::text[]) @>
        array['search_path=pg_catalog, editorial']::text[]
  ) then
    raise exception
      'STOP: K4C-AR3 Publishing reader security metadata drifted';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.correction_article_publication_proof(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.correction_article_publication_proof(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'editorial.correction_article_publication_proof(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: K4C-AR3 Corrections proof execution perimeter drifted';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.derive_publishing_editorial_state(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'editorial.derive_publishing_editorial_state(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'editorial.derive_publishing_editorial_state(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: K4C-AR3 Publishing reader execution perimeter drifted';
  end if;

  if (
    select count(*)
    from editorial.article_lifecycle_events
  ) <> 35
     or (
       select md5(
         coalesce(
           string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
           ''
         )
       )
       from editorial.article_lifecycle_events e
     ) <> 'dd7ac00209d19f3f369fb0d9b3e1e6a1'
  then
    raise exception
      'STOP: K4C-AR3 typed Article historical compatibility identity changed';
  end if;

  if not (
    select class_row.relrowsecurity
    from pg_class class_row
    join pg_namespace namespace_row
      on namespace_row.oid = class_row.relnamespace
    where namespace_row.nspname = 'editorial'
      and class_row.relname = 'article_lifecycle_events'
  ) then
    raise exception
      'STOP: K4C-AR3 typed Article historical table lost RLS';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'service_role',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
  then
    raise exception
      'STOP: K4C-AR3 historical typed table app-role perimeter changed';
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'editorial'
      and column_row.table_name in (
        'playlist_resources',
        'audio_publication_resources'
      )
      and column_row.column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: K4C-AR3 Playlist/Audio pointer compatibility debt regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4C-AR3 typed Video event authority exists';
  end if;
end;
$phase_7a_k4c_ar3_postflight$;

commit;
