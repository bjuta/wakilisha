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
        'apple_music_id','9901416007',
        'upc','9990000000001',
        'title','Ten Year Test - EP',
        'release_type','ep',
        'release_date','2026-10-04',
        'genre_names',jsonb_build_array('African'),
        'record_label','WAKILISHA Acceptance',
        'album_artist_name','Review Spine Artist',
        'related_artists',jsonb_build_array(jsonb_build_object(
          'name','Review Spine Artist','apple_music_artist_id','9901416098'
        )),
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','9901416011',
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
            'apple_music_id','9901416012',
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
        'apple_music_id','9901416008',
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
            'apple_music_id','9901416013',
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

  -- A real selected subset is valid; invented IDs and duplicates remain invalid.
  if jsonb_array_length(platform_private.registry_discography_normalize_reviewed_selections_v1(
    v_artist_id,v_observation,jsonb_build_array(jsonb_build_object(
      'apple_music_id','9901416007','action','canonicalize'
    ))
  ))<>1 then raise exception 'Selected-only normalization changed the selected set'; end if;
  begin
    perform platform_private.registry_discography_normalize_reviewed_selections_v1(
      v_artist_id,v_observation,jsonb_build_array(jsonb_build_object(
        'apple_music_id','9901416996','action','canonicalize'
      ))
    );
    raise exception 'Invented album unexpectedly accepted';
  exception when sqlstate '22023' then null;
  end;

  v_result:=
    public.admin_execute_registry_discography_evidence_v1(
      v_artist_id,
      v_evidence_id,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','9901416007',
          'action','canonicalize'
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
  where release.metadata->>'apple_music_album_id'='9901416007';

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
    where release.metadata->>'apple_music_album_id'='9901416008'
       or release.upc='9990000000002'
  ) then
    raise exception 'Unselected album escaped into canonical Release truth';
  end if;

  if not exists (
    select 1 from public.registry_release_artists credit
    where credit.release_id=v_release_id and credit.artist_id=v_artist_id
      and credit.status='active' and credit.is_primary
  ) or (select count(*) from public.registry_release_artists credit
        where credit.release_id=v_release_id and credit.status='active')<>1
  or exists (select 1 from public.registry_artists artist
             where artist.id=v_artist_id and artist.metadata ? 'apple_music_id')
  or exists (select 1 from public.registry_external_identifier_assertions assertion
             where assertion.artist_id=v_artist_id and assertion.scheme_key='apple_music')
  then
    raise exception 'Release-scoped Artist review failed or leaked global provider identity authority';
  end if;

  -- Same-named provider ID already bound to another current Artist MUST block.
  insert into public.registry_artists (id,slug,display_name,normalized_name,status,metadata,living_memory_status)
  values ('33333333-4444-4555-8666-777777777777','review-spine-other-artist','Review Spine Other Artist',
    platform_private.registry_identity_normalize_text_v1('Review Spine Other Artist'),'active',
    jsonb_build_object('apple_music_id','9901416097'),'draft');
  begin
    perform platform_private.registry_discography_release_artist_desired_v1(
      v_release_id,v_artist_id,
      jsonb_set(v_observation->'albums'->0,'{related_artists}',jsonb_build_array(jsonb_build_object(
        'name','Review Spine Artist','apple_music_artist_id','9901416097'
      ))),'[]'::jsonb
    );
    raise exception 'Contradictory global provider binding unexpectedly accepted';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_error=message_text;
    if position('linked to a different Registry Artist' in v_error)=0 then raise; end if;
  end;

  select track.id
  into v_track_one_id
  from public.registry_tracks track
  where track.metadata->>'apple_music_track_id'='9901416011';

  select track.id
  into v_track_two_id
  from public.registry_tracks track
  where track.metadata->>'apple_music_track_id'='9901416012';

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
    where track.metadata->>'apple_music_track_id'='9901416013'
       or track.isrc='KEWAK2600099'
  ) then
    raise exception 'Unselected album escaped into canonical Track truth';
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
     or v_sentry->>'left'<>'0'
     or v_sentry->>'observed'<>'2'
     or v_sentry->>'reviewed'<>'1'
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
        'apple_music_id','9901416009',
        'upc','9990000000003',
        'title','Nothing Admitted - Single',
        'release_type','single',
        'release_date','2026-10-04',
        'genre_names',jsonb_build_array('African'),
        'album_artist_name','Review Spine Artist',
        'related_artists','[]'::jsonb,
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','9901416010',
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
          'apple_music_id','9901416009',
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
  v_recovery_observation jsonb;
  v_recovery_fingerprint text;
  v_recovery_evidence_id uuid;
  v_recovery_plan_id uuid;
  v_recovery_plan jsonb;
  v_recovery_result jsonb;
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
        'apple_music_id','9901416003',
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
            'apple_music_id','9901416005',
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
        'apple_music_id','9901416004',
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
            'apple_music_id','9901416006',
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
          'apple_music_id','9901416003',
          'action','canonicalize'
        ),
        jsonb_build_object(
          'apple_music_id','9901416004',
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
       where release.metadata->>'apple_music_album_id'='9901416003'
         and release.status='active'
         and release.slug='sibling-identity'
     )
     or not exists (
       select 1
       from public.registry_releases release
       where release.metadata->>'apple_music_album_id'='9901416004'
         and release.status='active'
         and release.slug='sibling-identity-single'
     )
  then
    raise exception
      'collision-aware Release slug allocation did not preserve distinct sibling identities';
  end if;

  -- Reproduce the Production recovery shape: the distinct Single already owns
  -- the clean base while the Album is active on a dirty legacy slug. A fresh
  -- reviewed plan must preserve the Single and reconcile the Album to a
  -- structural disambiguator without changing either lifecycle state.
  update public.registry_releases
  set slug='sibling-identity-review-spine-artist',updated_at=now()
  where metadata->>'apple_music_album_id'='9901416003';

  update public.registry_releases
  set slug='sibling-identity',updated_at=now()
  where metadata->>'apple_music_album_id'='9901416004';

  v_recovery_observation:=
    jsonb_set(
      v_collision_observation,
      '{acquired_at}',
      to_jsonb(clock_timestamp()+interval '1 second'),
      true
    );

  v_recovery_fingerprint:=encode(
    extensions.digest(v_recovery_observation::text,'sha256'),
    'hex'
  );

  v_recovery_evidence_id:=
    public.admin_prepare_registry_discography_evidence_v1(
      v_artist_id,v_recovery_observation,v_recovery_fingerprint
    );

  v_recovery_plan_id:=
    platform_private.freeze_registry_discography_review_plan_v1(
      v_artist_id,
      v_recovery_evidence_id,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','9901416003',
          'action','canonicalize'
        ),
        jsonb_build_object(
          'apple_music_id','9901416004',
          'action','canonicalize'
        )
      )
    );

  select review.frozen_plan
  into v_recovery_plan
  from platform_private.registry_discography_review_plans review
  where review.id=v_recovery_plan_id;

  if not exists (
       select 1
       from jsonb_array_elements(v_recovery_plan->'operations') operation
       where operation->>'operation_key'=
             'registry.release.identity.reconcile'
         and operation->>'subject_type'='release'
         and operation#>>'{payload,current_slug}'=
             'sibling-identity-review-spine-artist'
         and operation#>>'{payload,canonical_slug}'=
             'sibling-identity-album'
     )
  then
    raise exception
      'active dirty Release recovery was not frozen as exact typed identity reconciliation: %',
      v_recovery_plan;
  end if;

  v_recovery_result:=
    public.admin_execute_registry_discography_evidence_v1(
      v_artist_id,
      v_recovery_evidence_id,
      jsonb_build_array(
        jsonb_build_object(
          'apple_music_id','9901416003',
          'action','canonicalize'
        ),
        jsonb_build_object(
          'apple_music_id','9901416004',
          'action','canonicalize'
        )
      )
    );

  if jsonb_array_length(
       coalesce(v_recovery_result#>'{summary,errors}','[]'::jsonb)
     )<>0
     or not exists (
       select 1
       from public.registry_releases release
       where release.metadata->>'apple_music_album_id'='9901416003'
         and release.status='active'
         and release.slug='sibling-identity-album'
     )
     or not exists (
       select 1
       from public.registry_releases release
       where release.metadata->>'apple_music_album_id'='9901416004'
         and release.status='active'
         and release.slug='sibling-identity'
     )
     or not exists (
       select 1
       from platform_private.registry_mutation_operations operation
       join platform_private.registry_execution_grants grant_row
         on grant_row.id=operation.execution_grant_id
       where operation.operation_key='registry.release.identity.reconcile'
         and operation.status='succeeded'
         and operation.verifier_status='passed'
         and grant_row.plan_payload->>'review_plan_id'=
             v_recovery_plan_id::text
     )
  then
    raise exception
      'active dirty Release identity did not recover through typed reviewed authority: %',
      v_recovery_result;
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
        'apple_music_id','9901416001',
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
            'apple_music_id','9901416002',
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
          'apple_music_id','9901416001',
          'action','canonicalize'
        )
      )
    );

  select review.frozen_plan
  into v_atomic_plan
  from platform_private.registry_discography_review_plans review
  where review.id=v_atomic_plan_id;

  if v_atomic_plan->>'plan_version'<>'4'
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
          'apple_music_id','9901416001',
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
       where release.metadata->>'apple_music_album_id'='9901416001'
          or release.upc='9990000000021'
     )
     or exists (
       select 1
       from public.registry_tracks track
       where track.metadata->>'apple_music_track_id'='9901416002'
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


-- IFPI/DDEX: one recording can appear in multiple Releases, while distinct
-- valid ISRC masters retain independent Track identities and stable slugs.
do $ifpi_ddex_release_membership$
declare
  u uuid:='44444444-2222-4333-8444-555555555555';
  a uuid:='44444444-3333-4444-8555-666666666666';
  original_release uuid:='44444444-5555-4666-8777-888888888881';
  earlier_master uuid:='44444444-5555-4666-8777-888888888882';
  earlier_finale uuid:='44444444-5555-4666-8777-888888888883';
  shared_recording uuid:='44444444-5555-4666-8777-888888888884';
  v_observation jsonb;
  v_evidence uuid;
  v_result jsonb;
  v_album_release uuid;
  v_new_master uuid;
  v_new_finale uuid;
  v_plan uuid;
  v_sentry jsonb;
begin
  insert into auth.users(id,is_sso_user,is_anonymous) values(u,false,false);
  insert into public.user_role_assignments(user_id,role_key,status,notes)
  values(u,'registry_editor','active','Rollback-only IFPI/DDEX Release membership proof');
  insert into platform_private.system_actor_executor_bindings(
    actor_key,executor_kind,executor_key,status)
  values('registry_discography_admin','database_role',session_user,'active')
  on conflict do nothing;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',u::text,'role','authenticated')::text,true);
  if auth.uid() is distinct from u
     or not public.current_user_has_capability('manage_registry')
  then raise exception 'IFPI/DDEX fixture caller denied';end if;

  insert into public.registry_artists(
    id,slug,display_name,normalized_name,status,metadata,living_memory_status)
  values(a,'ifpi-ddex-fixture-artist','IFPI DDEX Fixture Artist',
    platform_private.registry_identity_normalize_text_v1('IFPI DDEX Fixture Artist'),
    'active','{}'::jsonb,'draft');

  insert into public.registry_releases(
    id,slug,title,normalized_title,release_type,status,metadata)
  values(original_release,'ifpi-ddex-advance-single','Advance Singles - EP',
    platform_private.registry_identity_normalize_text_v1('Advance Singles - EP'),
    'ep','active','{"apple_music_album_id":"9901416101"}'::jsonb);
  insert into public.registry_release_artists(
    release_id,artist_id,artist_slug,artist_name_text,role,
    is_primary,is_featured,credit_order,source,confidence,status,metadata)
  values(original_release,a,'ifpi-ddex-fixture-artist','IFPI DDEX Fixture Artist',
    'primary',true,false,1,'fixture',100,'active','{}'::jsonb);

  insert into public.registry_tracks(
    id,slug,title,normalized_title,isrc,status,metadata)
  values
    (earlier_master,'all-my-enemies-are-suffering','All My Enemies Are Suffering',
     platform_private.registry_identity_normalize_text_v1('All My Enemies Are Suffering'),
     'KEWAK2614170','active',
     '{"apple_music_track_id":"9901416121","apple_music_album_id":"9901416101"}'::jsonb),
    (earlier_finale,'finale','Finale',
     platform_private.registry_identity_normalize_text_v1('Finale'),
     'KEWAK2614172','active',
     '{"apple_music_track_id":"9901416122","apple_music_album_id":"9901416101"}'::jsonb),
    (shared_recording,'stable-single','Stable Single',
     platform_private.registry_identity_normalize_text_v1('Stable Single'),
     'KEWAK2614174','active',
     '{"apple_music_track_id":"9901416123","apple_music_album_id":"9901416101"}'::jsonb);
  insert into public.registry_track_artists(
    track_id,artist_id,artist_slug,artist_name_text,role,is_primary,
    is_featured,credit_order,source,confidence,status,metadata)
  select id,a,'ifpi-ddex-fixture-artist','IFPI DDEX Fixture Artist',
    'primary',true,false,1,'fixture',100,'active','{}'::jsonb
  from public.registry_tracks where id in (earlier_master,earlier_finale,shared_recording);
  insert into public.registry_release_tracks(
    release_id,track_id,disc_number,track_number,source,confidence,status,metadata)
  values
    (original_release,earlier_master,1,1,'fixture',100,'active','{}'::jsonb),
    (original_release,earlier_finale,1,2,'fixture',100,'active','{}'::jsonb),
    (original_release,shared_recording,1,3,'fixture',100,'active','{}'::jsonb);

  v_observation:=jsonb_build_object(
    'provider','apple_music','storefront','ke','acquired_at',now(),
    'artist',jsonb_build_object('id',a,'slug','ifpi-ddex-fixture-artist',
      'display_name','IFPI DDEX Fixture Artist'),
    'failed_album_ids','[]'::jsonb,
    'albums',jsonb_build_array(
      jsonb_build_object(
        'apple_music_id','9901416111','upc','9990000008888',
        'title','Alusa Continua','release_type','album','release_date','2026-11-10',
        'genre_names',jsonb_build_array('African'),
        'record_label','Rollback-only IFPI DDEX Acceptance',
        'album_artist_name','IFPI DDEX Fixture Artist',
        'related_artists','[]'::jsonb,
        'tracks',jsonb_build_array(
          jsonb_build_object(
            'apple_music_id','9901416131',
            'title','All My Enemies Are Suffering','isrc','KEWAK2614171',
            'artist_name','IFPI DDEX Fixture Artist',
            'disc_number',1,'track_number',1,'duration_ms',60000,'explicit',false,
            'genre_names',jsonb_build_array('African')),
          jsonb_build_object(
            'apple_music_id','9901416132','title','Finale','isrc','KEWAK2614173',
            'artist_name','IFPI DDEX Fixture Artist',
            'disc_number',1,'track_number',2,'duration_ms',61000,'explicit',false,
            'genre_names',jsonb_build_array('African')),
          jsonb_build_object(
            'apple_music_id','9901416123','title','Stable Single','isrc','KEWAK2614174',
            'artist_name','IFPI DDEX Fixture Artist',
            'disc_number',1,'track_number',3,'duration_ms',62000,'explicit',false,
            'genre_names',jsonb_build_array('African')),
          jsonb_build_object(
            'apple_music_id','9901416134','title','New Album Cut','isrc','KEWAK2614175',
            'artist_name','IFPI DDEX Fixture Artist',
            'disc_number',1,'track_number',4,'duration_ms',63000,'explicit',false,
            'genre_names',jsonb_build_array('African'))
        )),
      jsonb_build_object(
        'apple_music_id','9901416199','title','Untouched Other Album',
        'release_type','single','release_date','2026-11-11',
        'genre_names','[]'::jsonb,'related_artists','[]'::jsonb,
        'album_artist_name','IFPI DDEX Fixture Artist',
        'tracks','[]'::jsonb)
    )
  );
  v_evidence:=public.admin_prepare_registry_discography_evidence_v1(
    a,v_observation,
    encode(extensions.digest(v_observation::text,'sha256'),'hex')
  );
  v_result:=public.admin_execute_registry_discography_evidence_v1(
    a,v_evidence,
    '[{"apple_music_id":"9901416111","action":"canonicalize"}]'::jsonb
  );
  if jsonb_array_length(coalesce(v_result#>'{summary,errors}','[]'::jsonb))<>0
  then
    raise exception 'IFPI/DDEX admitted operations failed: %',
      v_result#>'{summary,errors}';
  end if;

  select id into v_album_release from public.registry_releases
  where metadata->>'apple_music_album_id'='9901416111';
  select id into v_new_master from public.registry_tracks where isrc='KEWAK2614171';
  select id into v_new_finale from public.registry_tracks where isrc='KEWAK2614173';
  if v_album_release is null or v_new_master is null or v_new_finale is null
     or v_new_master=earlier_master or v_new_finale=earlier_finale
  then raise exception 'Alusa Continua variants did not remain distinct';end if;
  if (select slug from public.registry_tracks where id=v_new_master)
         <>'all-my-enemies-are-suffering-kewak2614171'
     or (select slug from public.registry_tracks where id=v_new_finale)
         <>'finale-kewak2614173'
  then raise exception 'Distinct master route was not stable';end if;
  if (select count(*) from public.registry_release_tracks
      where release_id=v_album_release and status='active')<>4
     or not exists(
       select 1 from public.registry_release_tracks
       where release_id=v_album_release and track_id=shared_recording and status='active')
     or (select count(*) from public.registry_release_tracks
      where release_id=original_release and status='active')<>3
  then raise exception 'IFPI/DDEX multi-Release recording membership drifted';end if;
  if (select metadata->>'apple_music_album_id'
      from public.registry_tracks where id=shared_recording)<>'9901416101'
     or (select isrc from public.registry_tracks where id=earlier_master)<>'KEWAK2614170'
  then raise exception 'Original Single recording was overwritten';end if;
  if exists(select 1 from public.registry_releases
      where metadata->>'apple_music_album_id'='9901416199')
  then raise exception 'Unselected Album unexpectedly admitted';end if;

  select id into v_plan from platform_private.registry_discography_review_plans
  where artist_id=a and evidence_assertion_id=v_evidence;
  select op.result_payload->'mizizi_terminal_sentry' into v_sentry
  from platform_private.registry_mutation_operations op
  where op.operation_key='registry.discography.apply'
    and op.result_payload#>>'{mizizi_terminal_sentry,review_plan_id}'=v_plan::text
  order by op.created_at desc limit 1;
  if v_sentry->>'status'<>'pass'
     or v_sentry->>'observed'<>'2'
     or v_sentry->>'reviewed'<>'1'
     or v_sentry->>'accepted'<>'1'
     or v_sentry->>'left'<>'0'
  then raise exception 'IFPI/DDEX terminal sentry failed: %',v_sentry;end if;
end
$ifpi_ddex_release_membership$;

rollback;

select
  'REGISTRY_DISCOGRAPHY_REVIEWED_ADMISSION_BEHAVIOR_ROLLED_BACK_CLEAN'
  as status;
