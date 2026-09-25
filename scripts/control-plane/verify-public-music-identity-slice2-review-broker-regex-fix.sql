-- Public Music Identity Slice 2 review-broker regex hotfix verifier.
-- Read-only. Production expectation at acceptance: 44 conflict groups / 91 Tracks.

do $verify$
declare
  v_head text;
  v_conflict_groups integer;
  v_conflict_tracks integer;
  v_definition text;
begin
  select max(version)
  into v_head
  from supabase_migrations.schema_migrations;

  if v_head <> '20260925050859' then
    raise exception
      'VERIFY FAIL: expected hotfix migration head 20260925050859, got %',
      v_head;
  end if;

  select pg_get_functiondef(
    'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
  )
  into v_definition;

  if position($needle$\y(feat$needle$ in v_definition) = 0 then
    raise exception
      'VERIFY FAIL: corrected single-backslash feature regex is missing';
  end if;

  if position($needle$\\y(feat$needle$ in v_definition) > 0 then
    raise exception
      'VERIFY FAIL: doubled-backslash feature regex remains in broker definition';
  end if;

  with track_primary as (
    select distinct
      t.id,
      t.title,
      ta.artist_id
    from public.registry_tracks t
    join public.registry_track_artists ta
      on ta.track_id=t.id
     and ta.status='active'
     and ta.is_primary is true
     and ta.artist_id is not null
    where t.status='active'
  ),
  cleaned as (
    select
      id,
      artist_id,
      mizizi_private.slugify_identity_v1(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                mizizi_private.normalize_identity_text_v1(title),
                $regex$\([^)]*\y(feat(uring)?|ft)\.?[[:space:]]+[^)]*\)$regex$,
                ' ',
                'gi'
              ),
              $regex$\[[^]]*\y(feat(uring)?|ft)\.?[[:space:]]+[^]]*\]$regex$,
              ' ',
              'gi'
            ),
            $regex$\{[^}]*\y(feat(uring)?|ft)\.?[[:space:]]+[^}]*\}$regex$,
            ' ',
            'gi'
          ),
          $regex$[[:space:]]+(-|:)?[[:space:]]*\y(feat(uring)?|ft)\.?[[:space:]]+.*$$regex$,
          '',
          'i'
        )
      ) as clean_slug
    from track_primary
  ),
  groups as (
    select artist_id, clean_slug, count(distinct id)::integer as n
    from cleaned
    where clean_slug <> ''
    group by artist_id, clean_slug
    having count(distinct id) > 1
  )
  select count(*)::integer, coalesce(sum(n),0)::integer
  into v_conflict_groups, v_conflict_tracks
  from groups;

  if v_conflict_groups <> 44 or v_conflict_tracks <> 91 then
    raise exception
      'VERIFY FAIL: expected 44 recording-conflict groups / 91 Tracks, got % / %',
      v_conflict_groups,
      v_conflict_tracks;
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'VERIFY FAIL: review broker EXECUTE boundary is not exact';
  end if;

  if has_table_privilege('mizizi_executor','public.registry_review_items','INSERT')
     or has_table_privilege('mizizi_executor','public.registry_tracks','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_track_artists','UPDATE')
     or has_table_privilege('mizizi_executor','public.wk_slug_redirects','INSERT')
  then
    raise exception
      'VERIFY FAIL: review broker hotfix broadened direct mutation authority';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
      and revoked_at is null
  ) or exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at>now()
      and revoked_at is null
      and consumed_at is null
  ) then
    raise exception
      'VERIFY FAIL: MIZIZI authority is not zero-at-rest';
  end if;
end
$verify$;

select
  'PUBLIC_MUSIC_IDENTITY_SLICE2_REVIEW_BROKER_REGEX_FIX_PASS' as result;
