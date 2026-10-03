begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

do $fixture$
declare
  v_user_id uuid:='11111111-2222-4333-8444-555555555555'::uuid;
  v_artist_id uuid:='22222222-3333-4444-8555-666666666666'::uuid;
  v_observation jsonb;
  v_leave_observation jsonb;
  v_fingerprint text;
  v_leave_fingerprint text;
  v_evidence_id uuid;
  v_leave_evidence_id uuid;
  v_result jsonb;
  v_leave_plan_id uuid;
  v_leave_plan jsonb;
  v_release_id uuid;
  v_track_one_id uuid;
  v_track_two_id uuid;
  v_parent_operation_id uuid;
  v_sentry jsonb;
  v_error text;
begin
  insert into auth.users (id,is_sso_user,is_anonymous)
  values (v_user_id,false,false);

  insert into public.user_role_assignments (user_id,role_key,status,notes)
  values (
    v_user_id,
    'registry_editor',
    'active',
    'rollback-only reviewed Discography behavioral acceptance'
  );

  insert into platform_private.system_actor_executor_bindings (
    actor_key,executor_kind,executor_key,status
  )
  values (
    'registry_discography_admin',
    'database_role',
    session_user,
    'active'
  );

  perform set_config('request.jwt.claim.sub',v_user_id::text,true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub',v_user_id::text,
      'role','authenticated'
    )::text,
    true
  );

  if auth.uid() is distinct from v_user_id
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception 'fixture admin identity did not acquire manage_registry';
  end if;

  insert into public.registry_artists (
    id,slug,display_name,normalized_name,status,metadata,living_memory_status
  )
  values (
    v_artist_id,
    'review-spine-artist',
    'Review Spine Artist',
    platform_private.registry_identity_normalize_text_v1('Review Spine Artist'),
    'active',
    '{}'::jsonb,
    'draft'
  );

  v_observation:=jsonb_build_object(
    'provider','apple_music',
    'storefront','ke',
    'acquired_at',now(),
    'artist',jsonb_build_object(
      'id',v_artist_id,
      'slug','review-spine-artist',
      'display_name','Review Spine Artist'
    ),
    'failed_album_ids','[]'::jsonb,
    'albums',jsonb_build_array(
      jsonb_build_object(
        'apple_music_id','wk-review-album-add-001',
        'upc','9990000000001',
        'title','Ten Year Test - EP',
        'release_type','ep',
        'release_date','2026-10-04',
        'genre_names',jsonb_build_array('African'),
        'record_label','WAKILISHA Acceptance',
        'album_artist_name','Review Spine Artist',
        'related_artists','[]'::jsonb,
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','wk-review-track-001',
            'title','One Minute',
            'isrc','KEWAK2600001',
            'explicit',false,
            'artist_name','Review Spine Artist',
            'disc_number',1,
            'track_number',1,
            'duration_ms',60000,
            'genre_names',jsonb_build_array('African')
          ),
          jsonb_build_object(
            'apple_music_id','wk-review-track-002',
            'title','Second Cut',
            'isrc','KEWAK2600002',
            'explicit',false,
            'artist_name','Review Spine Artist',
            'disc_number',1,
            'track_number',2,
            'duration_ms',61000,
            'genre_names',jsonb_build_array('African')
          )
        )
      ),
      jsonb_build_object(
        'apple_music_id','wk-review-album-leave-001',
        'upc','9990000000002',
        'title','Leave This Out - Single',
        'release_type','single',
        'release_date','2026-10-04',
        'genre_names',jsonb_build_array('African'),
        'record_label','WAKILISHA Acceptance',
        'album_artist_name','Review Spine Artist',
        'related_artists','[]'::jsonb,
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','wk-review-track-leave-001',
            'title','Leave This Track',
            'isrc','KEWAK2600099',
            'explicit',false,
            'artist_name','Review Spine Artist',
            'disc_number',1,
            'track_number',1,
            'duration_ms',62000,
            'genre_names',jsonb_build_array('African')
          )
        )
      )
    )
  );

  v_fingerprint:=encode(extensions.digest(v_observation::text,'sha256'),'hex');

  v_evidence_id:=
    public.admin_prepare_registry_discography_evidence_v1(
      v_artist_id,v_observation,v_fingerprint
    );

  begin
    perform platform_private.registry_discography_normalize_reviewed_selections_v1(
      v_artist_id,
      v_observation,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','wk-review-album-add-001',
          'action','canonicalize'
        )
      )
    );
    raise exception 'incomplete reviewed set unexpectedly succeeded';
  exception
    when sqlstate '22023' then
      get stacked diagnostics v_error=message_text;
      if position(
        'Every observed Release requires one explicit Discography review decision.'
        in v_error
      )=0 then
        raise;
      end if;
  end;

  v_result:=
    public.admin_execute_registry_discography_evidence_v1(
      v_artist_id,
      v_evidence_id,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','wk-review-album-add-001',
          'action','canonicalize'
        ),
        jsonb_build_object(
          'apple_music_id','wk-review-album-leave-001',
          'action','ignore'
        )
      )
    );

  if jsonb_array_length(coalesce(v_result#>'{summary,errors}','[]'::jsonb))<>0
  then
    raise exception
      'reviewed Discography execution returned errors: %',
      v_result#>'{summary,errors}';
  end if;

  select release.id
  into v_release_id
  from public.registry_releases release
  where release.metadata->>'apple_music_album_id'='wk-review-album-add-001';

  if v_release_id is null
     or not exists (
       select 1
       from public.registry_releases release
       where release.id=v_release_id
         and release.status='active'
         and release.slug='ten-year-test'
         and release.title='Ten Year Test - EP'
         and release.release_type='ep'
         and release.upc='9990000000001'
     )
  then
    raise exception
      'accepted Release did not converge to active clean artist-scoped identity';
  end if;

  if exists (
    select 1
    from public.registry_releases release
    where release.metadata->>'apple_music_album_id'='wk-review-album-leave-001'
       or release.upc='9990000000002'
  ) then
    raise exception 'Leave decision escaped into canonical Release truth';
  end if;

  select track.id
  into v_track_one_id
  from public.registry_tracks track
  where track.metadata->>'apple_music_track_id'='wk-review-track-001';

  select track.id
  into v_track_two_id
  from public.registry_tracks track
  where track.metadata->>'apple_music_track_id'='wk-review-track-002';

  if v_track_one_id is null
     or v_track_two_id is null
     or not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_track_one_id
         and track.status='active'
         and track.slug='one-minute'
         and track.isrc='KEWAK2600001'
     )
     or not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_track_two_id
         and track.status='active'
         and track.slug='second-cut'
         and track.isrc='KEWAK2600002'
     )
  then
    raise exception
      'accepted Tracks did not converge to active clean artist-scoped identity';
  end if;

  if exists (
    select 1
    from public.registry_tracks track
    where track.metadata->>'apple_music_track_id'='wk-review-track-leave-001'
       or track.isrc='KEWAK2600099'
  ) then
    raise exception 'Leave decision escaped into canonical Track truth';
  end if;

  if (
       select count(*)
       from public.registry_release_tracks membership
       where membership.release_id=v_release_id
         and membership.status='active'
     )<>2
  then
    raise exception 'accepted Release membership did not converge exactly';
  end if;

  if not exists (
       select 1
       from public.registry_releases release
       where release.id=v_release_id
         and release.status='active'
         and release.title ilike '%Ten Year Test%'
     )
     or not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_track_one_id
         and track.status='active'
         and (
           track.title ilike '%One Minute%'
           or track.isrc='KEWAK2600001'
         )
     )
  then
    raise exception
      'active reviewed identities are not discoverable under editorial search predicates';
  end if;

  select operation.id
  into v_parent_operation_id
  from platform_private.registry_mutation_operations operation
  join platform_private.registry_execution_grants grant_row
    on grant_row.id=operation.execution_grant_id
  where operation.actor_key='registry_discography_admin'
    and operation.operation_key='registry.discography.apply'
    and grant_row.plan_payload->>'review_plan_id' is not null
  order by operation.created_at desc
  limit 1;

  select operation.result_payload->'mizizi_terminal_sentry'
  into v_sentry
  from platform_private.registry_mutation_operations operation
  where operation.id=v_parent_operation_id
    and operation.status='succeeded'
    and operation.verifier_status='passed';

  if v_sentry->>'status'<>'pass'
     or v_sentry->>'accepted'<>'1'
     or v_sentry->>'left'<>'1'
     or v_sentry->>'active_releases'<>'1'
     or v_sentry->>'active_tracks'<>'2'
  then
    raise exception
      'Discography parent did not finalize with exact MIZIZI terminal sentry pass: %',
      v_sentry;
  end if;

  v_leave_observation:=jsonb_build_object(
    'provider','apple_music',
    'storefront','ke',
    'acquired_at',now(),
    'artist',jsonb_build_object(
      'id',v_artist_id,
      'slug','review-spine-artist',
      'display_name','Review Spine Artist'
    ),
    'failed_album_ids','[]'::jsonb,
    'albums',jsonb_build_array(
      jsonb_build_object(
        'apple_music_id','wk-review-leave-all-001',
        'upc','9990000000003',
        'title','Nothing Admitted - Single',
        'release_type','single',
        'release_date','2026-10-04',
        'genre_names',jsonb_build_array('African'),
        'album_artist_name','Review Spine Artist',
        'related_artists','[]'::jsonb,
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','wk-review-leave-all-track-001',
            'title','Nothing Admitted',
            'isrc','KEWAK2600100',
            'explicit',false,
            'artist_name','Review Spine Artist',
            'disc_number',1,
            'track_number',1,
            'duration_ms',63000,
            'genre_names',jsonb_build_array('African')
          )
        )
      )
    )
  );

  v_leave_fingerprint:=encode(
    extensions.digest(v_leave_observation::text,'sha256'),
    'hex'
  );

  v_leave_evidence_id:=
    public.admin_prepare_registry_discography_evidence_v1(
      v_artist_id,v_leave_observation,v_leave_fingerprint
    );

  v_leave_plan_id:=
    platform_private.freeze_registry_discography_review_plan_v1(
      v_artist_id,
      v_leave_evidence_id,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','wk-review-leave-all-001',
          'action','ignore'
        )
      )
    );

  select review.frozen_plan
  into v_leave_plan
  from platform_private.registry_discography_review_plans review
  where review.id=v_leave_plan_id;

  if jsonb_array_length(v_leave_plan->'operations')<>0
     or v_leave_plan#>>'{summary,reviewed}'<>'1'
     or v_leave_plan#>>'{summary,accepted}'<>'0'
     or v_leave_plan#>>'{summary,left}'<>'1'
     or exists (
       select 1
       from public.registry_releases release
       where release.upc='9990000000003'
     )
     or exists (
       select 1
       from public.registry_tracks track
       where track.isrc='KEWAK2600100'
     )
  then
    raise exception
      'Leave-all review did not freeze as zero-mutation reviewed authority: %',
      v_leave_plan;
  end if;
end
$fixture$;

rollback;

select
  'REGISTRY_DISCOGRAPHY_REVIEWED_ADMISSION_BEHAVIOR_ROLLED_BACK_CLEAN'
  as status;
