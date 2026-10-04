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

do $collision_and_atomic$
declare
  v_user_id uuid:='11111111-2222-4333-8444-555555555555'::uuid;
  v_artist_id uuid:='22222222-3333-4444-8555-666666666666'::uuid;
  v_collision_observation jsonb;
  v_collision_fingerprint text;
  v_collision_evidence_id uuid;
  v_collision_result jsonb;
  v_atomic_observation jsonb;
  v_atomic_fingerprint text;
  v_atomic_evidence_id uuid;
  v_atomic_plan_id uuid;
  v_atomic_plan jsonb;
  v_atomic_result jsonb;
  v_conflict_release_id uuid:='33333333-4444-4555-8666-777777777777'::uuid;
  v_operation_count integer;
begin
  -- Two genuine sibling Releases that normalize to one clean base must retain
  -- deterministic Artist-scoped route identities without reintroducing Artist
  -- suffix noise. The un-packaged Album owns the clean base in a new group;
  -- the structural Single suffix is used only to disambiguate the sibling.
  v_collision_observation:=jsonb_build_object(
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
        'apple_music_id','wk-collision-album-001',
        'upc','9990000000011',
        'title','Sibling Identity',
        'release_type','album',
        'release_date','2026-10-04',
        'genre_names',jsonb_build_array('African'),
        'record_label','WAKILISHA Acceptance',
        'album_artist_name','Review Spine Artist',
        'related_artists','[]'::jsonb,
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','wk-collision-track-album-001',
            'title','Sibling Album Cut',
            'isrc','KEWAK2600111',
            'explicit',false,
            'artist_name','Review Spine Artist',
            'disc_number',1,
            'track_number',1,
            'duration_ms',64000,
            'genre_names',jsonb_build_array('African')
          )
        )
      ),
      jsonb_build_object(
        'apple_music_id','wk-collision-single-001',
        'upc','9990000000012',
        'title','Sibling Identity - Single',
        'release_type','single',
        'release_date','2026-10-04',
        'genre_names',jsonb_build_array('African'),
        'record_label','WAKILISHA Acceptance',
        'album_artist_name','Review Spine Artist',
        'related_artists','[]'::jsonb,
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','wk-collision-track-single-001',
            'title','Sibling Single Cut',
            'isrc','KEWAK2600112',
            'explicit',false,
            'artist_name','Review Spine Artist',
            'disc_number',1,
            'track_number',1,
            'duration_ms',65000,
            'genre_names',jsonb_build_array('African')
          )
        )
      )
    )
  );

  v_collision_fingerprint:=encode(
    extensions.digest(v_collision_observation::text,'sha256'),
    'hex'
  );

  v_collision_evidence_id:=
    public.admin_prepare_registry_discography_evidence_v1(
      v_artist_id,v_collision_observation,v_collision_fingerprint
    );

  v_collision_result:=
    public.admin_execute_registry_discography_evidence_v1(
      v_artist_id,
      v_collision_evidence_id,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','wk-collision-album-001',
          'action','canonicalize'
        ),
        jsonb_build_object(
          'apple_music_id','wk-collision-single-001',
          'action','canonicalize'
        )
      )
    );

  if jsonb_array_length(
       coalesce(v_collision_result#>'{summary,errors}','[]'::jsonb)
     )<>0
  then
    raise exception
      'collision-aware reviewed admission returned errors: %',
      v_collision_result#>'{summary,errors}';
  end if;

  if not exists (
       select 1
       from public.registry_releases release
       where release.metadata->>'apple_music_album_id'='wk-collision-album-001'
         and release.status='active'
         and release.slug='sibling-identity'
     )
     or not exists (
       select 1
       from public.registry_releases release
       where release.metadata->>'apple_music_album_id'='wk-collision-single-001'
         and release.status='active'
         and release.slug='sibling-identity-single'
     )
  then
    raise exception
      'collision-aware Release slug allocation did not preserve distinct sibling identities';
  end if;

  -- Freeze a clean reviewed plan first, then introduce a same-Artist route
  -- collision before execution. The late identity child must fail, and the
  -- canonical Apply savepoint must roll back every earlier child mutation.
  v_atomic_observation:=jsonb_build_object(
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
        'apple_music_id','wk-atomic-album-001',
        'upc','9990000000021',
        'title','Atomic Boundary - EP',
        'release_type','ep',
        'release_date','2026-10-04',
        'genre_names',jsonb_build_array('African'),
        'record_label','WAKILISHA Acceptance',
        'album_artist_name','Review Spine Artist',
        'related_artists','[]'::jsonb,
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','wk-atomic-track-001',
            'title','Atomic Child',
            'isrc','KEWAK2600121',
            'explicit',false,
            'artist_name','Review Spine Artist',
            'disc_number',1,
            'track_number',1,
            'duration_ms',66000,
            'genre_names',jsonb_build_array('African')
          )
        )
      )
    )
  );

  v_atomic_fingerprint:=encode(
    extensions.digest(v_atomic_observation::text,'sha256'),
    'hex'
  );

  v_atomic_evidence_id:=
    public.admin_prepare_registry_discography_evidence_v1(
      v_artist_id,v_atomic_observation,v_atomic_fingerprint
    );

  v_atomic_plan_id:=
    platform_private.freeze_registry_discography_review_plan_v1(
      v_artist_id,
      v_atomic_evidence_id,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','wk-atomic-album-001',
          'action','canonicalize'
        )
      )
    );

  select review.frozen_plan
  into v_atomic_plan
  from platform_private.registry_discography_review_plans review
  where review.id=v_atomic_plan_id;

  if v_atomic_plan->>'plan_version'<>'3'
     or v_atomic_plan->>'terminal_policy'<>'active_ingest_v2'
     or not exists (
       select 1
       from jsonb_array_elements(v_atomic_plan->'operations') operation
       where operation->>'operation_key'='registry.draft_identity.reconcile'
         and operation#>>'{payload,canonical_slug}'='atomic-boundary'
     )
  then
    raise exception
      'atomic rollback fixture did not freeze the expected V3 reviewed plan: %',
      v_atomic_plan;
  end if;

  insert into public.registry_releases (
    id,slug,title,normalized_title,release_type,upc,release_date,status,metadata
  )
  values (
    v_conflict_release_id,
    'atomic-boundary',
    'Atomic Boundary Existing',
    platform_private.registry_identity_normalize_text_v1(
      'Atomic Boundary Existing'
    ),
    'album',
    '9990000000099',
    '2025-01-01',
    'active',
    '{}'::jsonb
  );

  insert into public.registry_release_artists (
    release_id,artist_id,artist_slug,artist_name_text,
    role,is_primary,is_featured,credit_order,
    source,confidence,status,metadata
  )
  values (
    v_conflict_release_id,
    v_artist_id,
    'review-spine-artist',
    'Review Spine Artist',
    'primary_artist',
    true,
    false,
    1,
    'reviewed_admission_rollback_acceptance',
    100,
    'active',
    '{}'::jsonb
  );

  v_atomic_result:=
    public.admin_execute_registry_discography_evidence_v1(
      v_artist_id,
      v_atomic_evidence_id,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','wk-atomic-album-001',
          'action','canonicalize'
        )
      )
    );

  if jsonb_array_length(
       coalesce(v_atomic_result#>'{summary,errors}','[]'::jsonb)
     )<>1
  then
    raise exception
      'atomic reviewed admission did not return exactly one terminal child error: %',
      v_atomic_result;
  end if;

  if exists (
       select 1
       from public.registry_releases release
       where release.metadata->>'apple_music_album_id'='wk-atomic-album-001'
          or release.upc='9990000000021'
     )
     or exists (
       select 1
       from public.registry_tracks track
       where track.metadata->>'apple_music_track_id'='wk-atomic-track-001'
          or track.isrc='KEWAK2600121'
     )
  then
    raise exception
      'failed reviewed admission leaked partial canonical Release/Track state';
  end if;

  select count(*)::integer
  into v_operation_count
  from platform_private.registry_mutation_operations operation
  join platform_private.registry_execution_grants grant_row
    on grant_row.id=operation.execution_grant_id
  where grant_row.plan_payload->>'review_plan_id'=v_atomic_plan_id::text;

  if v_operation_count<>0 then
    raise exception
      'failed reviewed admission leaked mutation-operation receipts: %',
      v_operation_count;
  end if;

  if not exists (
       select 1
       from platform_private.registry_discography_review_plans review
       where review.id=v_atomic_plan_id
         and review.frozen_plan_fingerprint=
             platform_private.registry_discography_observation_fingerprint_v1(
               review.frozen_plan
             )
     )
  then
    raise exception
      'failed reviewed admission did not preserve immutable reviewed authority';
  end if;
end
$collision_and_atomic$;

rollback;

select
  'REGISTRY_DISCOGRAPHY_REVIEWED_ADMISSION_BEHAVIOR_ROLLED_BACK_CLEAN'
  as status;
