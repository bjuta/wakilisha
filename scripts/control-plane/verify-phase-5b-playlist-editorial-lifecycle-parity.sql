-- Phase 5B M232 live verification.
-- Read-only. Any failed invariant raises and stops verification.

do $verify_phase_5b_m232$
declare
  v_command_count bigint;
  v_rls_count bigint;
  v_top50_credit_count bigint;
  v_public_curator_count bigint;
  v_lifecycle_count bigint;
  v_version_constraint text;
  v_trust_copy_definition text;
  v_due_definition text;
  v_immutable_credit_guard_count bigint;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlists'
      and column_name = 'curator_credit_id'
  ) then
    raise exception
      'FAIL: wk_playlists.curator_credit_id is missing';
  end if;

  if to_regclass(
       'editorial.playlist_scheduled_publications'
     ) is null
     or to_regclass(
       'editorial.playlist_lifecycle_events'
     ) is null
     or to_regclass(
       'public.wk_playlist_preview_links'
     ) is null
  then
    raise exception
      'FAIL: M232 lifecycle or Preview tables are missing';
  end if;

  select count(*)
  into v_command_count
  from platform_private.command_types
  where command_type in (
    'playlist.curator.set',
    'playlist.schedule',
    'playlist.unschedule',
    'playlist.unpublish',
    'playlist.archive',
    'playlist.restore'
  )
    and enabled;

  if v_command_count <> 6 then
    raise exception
      'FAIL: Expected six enabled M232 command types, found %',
      v_command_count;
  end if;

  if to_regprocedure(
       'editorial.resolve_playlist_curator_credit(uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'editorial.enforce_playlist_curator_attachment_authority()'
     ) is null
     or to_regprocedure(
       'editorial.attach_playlist_curator_to_working_snapshot()'
     ) is null
     or to_regprocedure(
       'editorial.require_exact_working_snapshot_for_curated_submission()'
     ) is null
     or to_regprocedure(
       'public.set_playlist_curator(uuid,bigint,uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.schedule_playlist_publication(uuid,bigint,uuid,timestamp with time zone,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.publish_due_playlist_publications(integer)'
     ) is null
     or to_regprocedure(
       'public.unpublish_playlist(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.archive_playlist(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.restore_playlist_from_archive(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.create_playlist_preview_link(uuid,uuid,timestamp with time zone)'
     ) is null
     or to_regprocedure(
       'public.resolve_playlist_preview_nonce(text)'
     ) is null
  then
    raise exception
      'FAIL: One or more M232 functions are missing';
  end if;

  if position(
       'profile.is_public'
       in lower(
         pg_get_functiondef(
           'editorial.resolve_playlist_curator_credit(uuid,uuid,uuid)'::regprocedure
         )
       )
     ) = 0
  then
    raise exception
      'FAIL: Private user profiles can be promoted to public Curator Credits';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'resource_credits'
      and trigger_row.tgname =
            'resource_credits_playlist_curator_authority'
      and not trigger_row.tgisinternal
      and position(
            'DELETE'
            in pg_get_triggerdef(
              trigger_row.oid,
              true
            )
          ) > 0
  ) then
    raise exception
      'FAIL: Playlist Curator attachment/delete authority trigger is incomplete';
  end if;

  if position(
       'v_version.version_kind <> ''working'''
       in pg_get_functiondef(
         'editorial.attach_playlist_curator_to_working_snapshot()'::regprocedure
       )
     ) = 0
     or position(
       'current_working_version_id'
       in pg_get_functiondef(
         'editorial.require_exact_working_snapshot_for_curated_submission()'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Curator is not anchored to the exact working snapshot before immutable Review submission';
  end if;

  if position(
       'return null'
       in lower(
         pg_get_functiondef(
           'editorial.enforce_playlist_curator_attachment_authority()'::regprocedure
         )
       )
     ) = 0
     or position(
       'new.display_order := new.display_order + 1'
       in pg_get_functiondef(
         'editorial.enforce_playlist_curator_attachment_authority()'::regprocedure
       )
     ) = 0
     or position(
       'v_version_kind = ''working'''
       in pg_get_functiondef(
         'editorial.enforce_playlist_curator_attachment_authority()'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: Generic working Credit replacement does not preserve Curator order zero';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where namespace.nspname = 'editorial'
      and procedure_row.proname =
            'attach_playlist_curator_to_submitted_snapshot'
  ) then
    raise exception
      'FAIL: Direct submitted-version Curator materialization still exists';
  end if;

  select count(*)
  into v_immutable_credit_guard_count
  from pg_trigger trigger_row
  join pg_class relation
    on relation.oid = trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'editorial'
    and relation.relname = 'resource_credits'
    and not trigger_row.tgisinternal
    and trigger_row.tgfoid =
      'editorial.prevent_immutable_playlist_trust_mutation()'::regprocedure
    and trigger_row.tgenabled <> 'D';

  if v_immutable_credit_guard_count <> 1 then
    raise exception
      'FAIL: Immutable Playlist Trust guard is not enabled after M232';
  end if;

  select pg_get_constraintdef(constraint_row.oid)
  into v_version_constraint
  from pg_constraint constraint_row
  join pg_class relation
    on relation.oid =
         constraint_row.conrelid
  join pg_namespace namespace
    on namespace.oid =
         relation.relnamespace
  where namespace.nspname = 'editorial'
    and relation.relname = 'playlist_versions'
    and constraint_row.conname =
          'playlist_versions_kind_check';

  if position(
       '''scheduled''' in
       coalesce(v_version_constraint, '')
     ) = 0
  then
    raise exception
      'FAIL: Playlist version kind does not include scheduled';
  end if;

  select pg_get_functiondef(
    'platform_private.begin_playlist_trust_copy_authorization(uuid,uuid)'::regprocedure
  )
  into v_trust_copy_definition;

  if position(
       'v_source.version_kind = ''approved'''
       in v_trust_copy_definition
     ) = 0
     or position(
       'v_target.version_kind = ''scheduled'''
       in v_trust_copy_definition
     ) = 0
     or position(
       'v_source.version_kind = ''scheduled'''
       in v_trust_copy_definition
     ) = 0
     or position(
       'v_target.version_kind = ''published'''
       in v_trust_copy_definition
     ) = 0
  then
    raise exception
      'FAIL: Scheduled Trust-copy transitions are missing';
  end if;

  select pg_get_functiondef(
    'public.publish_due_playlist_publications(integer)'::regprocedure
  )
  into v_due_definition;

  if position(
       'update editorial.playlist_resources as binding'
       in lower(v_due_definition)
     ) = 0
     or position(
       'where binding.playlist_id = due_schedule.playlist_id'
       in regexp_replace(
         lower(v_due_definition),
         '[[:space:]]+',
         ' ',
         'g'
       )
     ) = 0
     or position(
       'current_published_version_id'
       in lower(v_due_definition)
     ) = 0
  then
    raise exception
      'FAIL: Playlist-specific due-publication pointer update is missing or ambiguous';
  end if;


  if exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where namespace.nspname = 'public'
      and procedure_row.proname in (
        'unschedule_playlist_publication',
        'publish_due_playlist_publications',
        'unpublish_playlist',
        'archive_playlist',
        'restore_playlist_from_archive'
      )
      and regexp_replace(
            lower(
              pg_get_functiondef(procedure_row.oid)
            ),
            '[[:space:]]+',
            ' ',
            'g'
          ) ~ '(where|and|or|on) (playlist_id|resource_id|version_id|authority_revision|status|published_at|schedule_id|command_receipt_id|receipt_status|lifecycle_status|result_payload|idempotent_replay) ='
  ) then
    raise exception
      'FAIL: Playlist lifecycle SQL contains an unqualified identifier that can collide with a RETURNS TABLE output variable';
  end if;

  if position(
       'update editorial.resources resource'
       in lower(v_due_definition)
     ) = 0
  then
    raise exception
      'FAIL: Resource lifecycle update is missing from due publication';
  end if;

  if lower(v_due_definition) ~
       'update editorial\\.resources[[:space:][:print:]]*current_published_version_id'
  then
    raise exception
      'FAIL: Due Playlist publication writes the generic Article-only version pointer';
  end if;

  select count(*)
  into v_rls_count
  from pg_class relation
  join pg_namespace namespace
    on namespace.oid =
         relation.relnamespace
  where (
    namespace.nspname,
    relation.relname
  ) in (
    ('editorial','article_lifecycle_events'),
    ('editorial','article_scheduled_publications'),
    ('editorial','playlist_item_resources'),
    ('editorial','playlist_versions'),
    ('editorial','playlist_version_items'),
    ('editorial','playlist_version_trust_revisions')
  )
    and relation.relrowsecurity;

  if v_rls_count <> 6 then
    raise exception
      'FAIL: Expected six hardened lifecycle/version tables, found %',
      v_rls_count;
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'article_lifecycle_events',
        'article_scheduled_publications',
        'playlist_item_resources',
        'playlist_versions',
        'playlist_version_items',
        'playlist_version_trust_revisions'
      )
      and grant_row.grantee = 'anon'
      and grant_row.privilege_type in (
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE'
      )
  ) then
    raise exception
      'FAIL: anon acquired direct lifecycle/version table access';
  end if;

  if not exists (
    select 1
    from public.wk_playlists playlist
    join editorial.credits credit
      on credit.id =
           playlist.curator_credit_id
    join editorial.credit_governance governance
      on governance.credit_id =
           credit.id
    join public.registry_authors author_record
      on author_record.id =
           credit.registry_author_id
    where playlist.id =
            '574c2f20-d4c3-4fb1-a6b3-6ff7d85ea297'::uuid
      and playlist.slug =
            'top-50-kenyan-songs-of-2025'
      and playlist.status = 'published'
      and playlist.authority_revision = 54
      and playlist.curator_label =
            'Hafare Segelan'
      and credit.credit_role = 'curator'
      and credit.display_name_snapshot =
            'Hafare Segelan'
      and credit.registry_author_slug_snapshot =
            'hafare-segelan'
      and governance.credit_state = 'active'
      and governance.public_safe
      and author_record.id =
        'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
  ) then
    raise exception
      'FAIL: Top 50 durable Curator authority is incorrect';
  end if;

  select count(*)
  into v_top50_credit_count
  from editorial.resource_credits attachment
  join editorial.playlist_versions version
    on version.id =
         attachment.target_version_id
  join editorial.credits credit
    on credit.id =
         attachment.credit_id
  where version.playlist_id =
          '574c2f20-d4c3-4fb1-a6b3-6ff7d85ea297'::uuid
    and version.version_kind in (
      'submitted',
      'approved',
      'published'
    )
    and version.content_fingerprint =
      '59e4c0e4320357750ca71981e27ecfa89e3a7aef4074efe5f3453d63d0f548b7'
    and attachment.target_version_type =
          'playlist_version'
    and attachment.resource_kind = 'playlist'
    and attachment.public_safe
    and attachment.is_primary
    and attachment.display_order = 0
    and credit.credit_role = 'curator'
    and credit.registry_author_slug_snapshot =
          'hafare-segelan';

  if v_top50_credit_count <> 3 then
    raise exception
      'FAIL: Expected three Top 50 Curator version attachments, found %',
      v_top50_credit_count;
  end if;

  select count(*)
  into v_public_curator_count
  from jsonb_array_elements(
    coalesce(
      public.get_public_playlist(
        'top-50-kenyan-songs-of-2025'
      ) -> 'credits',
      '[]'::jsonb
    )
  ) credit
  where credit ->> 'role' = 'curator'
    and credit ->> 'display_name' =
          'Hafare Segelan'
    and credit ->> 'author_slug' =
          'hafare-segelan';

  if v_public_curator_count <> 1 then
    raise exception
      'FAIL: Public Top 50 Curator Credit is not linkable';
  end if;

  if not exists (
    select 1
    from public.wk_playlists playlist
    join editorial.playlist_resources binding
      on binding.playlist_id =
           playlist.id
    join editorial.playlist_versions version
      on version.id =
           binding.current_published_version_id
    where playlist.id =
            '574c2f20-d4c3-4fb1-a6b3-6ff7d85ea297'::uuid
      and playlist.status = 'published'
      and playlist.authority_revision = 54
      and version.id =
        'b2550076-a006-4deb-88a8-cfc2620dae3d'::uuid
      and version.version_kind = 'published'
      and version.content_fingerprint =
        '59e4c0e4320357750ca71981e27ecfa89e3a7aef4074efe5f3453d63d0f548b7'
      and version.item_count = 50
  ) then
    raise exception
      'FAIL: Top 50 publication identity changed during M232';
  end if;

  select count(*)
  into v_lifecycle_count
  from editorial.playlist_lifecycle_events event
  where event.playlist_id =
          '574c2f20-d4c3-4fb1-a6b3-6ff7d85ea297'::uuid
    and event.action = 'published'
    and event.resulting_status = 'published';

  if v_lifecycle_count <> 1 then
    raise exception
      'FAIL: Expected one backfilled Top 50 publication lifecycle event, found %',
      v_lifecycle_count;
  end if;
end;
$verify_phase_5b_m232$;

select jsonb_build_object(
  'verification',
    'PASS',
  'playlist_schedule_table',
    to_regclass(
      'editorial.playlist_scheduled_publications'
    ) is not null,
  'playlist_lifecycle_table',
    to_regclass(
      'editorial.playlist_lifecycle_events'
    ) is not null,
  'playlist_preview_table',
    to_regclass(
      'public.wk_playlist_preview_links'
    ) is not null,
  'top50_status',
    (
      select status
      from public.wk_playlists
      where id =
        '574c2f20-d4c3-4fb1-a6b3-6ff7d85ea297'::uuid
    ),
  'top50_authority_revision',
    (
      select authority_revision
      from public.wk_playlists
      where id =
        '574c2f20-d4c3-4fb1-a6b3-6ff7d85ea297'::uuid
    ),
  'top50_curator',
    (
      select jsonb_build_object(
        'display_name',
          credit.display_name_snapshot,
        'role',
          credit.credit_role,
        'author_slug',
          credit.registry_author_slug_snapshot
      )
      from public.wk_playlists playlist
      join editorial.credits credit
        on credit.id =
             playlist.curator_credit_id
      where playlist.id =
        '574c2f20-d4c3-4fb1-a6b3-6ff7d85ea297'::uuid
    ),
  'writes_performed_by_verifier',
    false
) as phase_5b_m232_verification;
