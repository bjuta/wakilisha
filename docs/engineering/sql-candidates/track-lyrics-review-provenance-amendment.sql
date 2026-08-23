-- Candidate amendment for the Track Lyrics review provenance milestone.
-- This is appended after track-lyrics-review-provenance.sql when the final
-- repository migration is created through the Supabase CLI workflow.

begin;

-- Keep the contributor account UUID as a historical snapshot without a live
-- FK that could attempt to mutate an immutable Lyrics version on auth-user
-- deletion. Public attribution uses the public-safe label snapshot.
alter table editorial.track_lyrics_versions
  drop constraint if exists track_lyrics_versions_source_contributor_fkey;

create index if not exists track_lyrics_versions_source_contributor_idx
  on editorial.track_lyrics_versions (source_contributor_id)
  where source_contributor_id is not null;

-- One governed read for the Lyrics Record view. Contribution decisions and
-- immutable Lyrics versions remain separate authorities but are presented in
-- a single chronological workspace.
create or replace function public.get_admin_track_lyrics_history(
  p_track_id uuid default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('view_audio'), false)
    or coalesce(public.current_user_has_capability('edit_own_audio'), false)
    or coalesce(public.current_user_has_capability('edit_others_audio'), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false)
    or coalesce(public.current_user_has_capability('publish_audio'), false)
  ) then
    raise exception 'Audio editorial permission is required';
  end if;

  return jsonb_build_object(
    'contributions',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', row.id,
          'track_id', row.track_id,
          'track_title', row.track_title,
          'track_slug', row.track_slug,
          'artists', row.artists,
          'contributor_label', row.contributor_label,
          'contribution_kind', row.contribution_kind,
          'status', row.status,
          'acceptance_mode', row.acceptance_mode,
          'accepted_version_id', row.accepted_version_id,
          'review_note', row.review_note,
          'reviewed_at', row.reviewed_at,
          'created_at', row.created_at
        )
        order by coalesce(row.reviewed_at, row.created_at) desc, row.id desc
      )
      from (
        select
          contribution.id,
          contribution.track_id,
          track.title as track_title,
          track.slug as track_slug,
          coalesce(artist_data.artists, '[]'::jsonb) as artists,
          case
            when profile.is_public = true and profile.status = 'active'
              then coalesce(
                nullif(btrim(profile.display_name), ''),
                case
                  when nullif(btrim(profile.username), '') is not null
                    then '@' || btrim(profile.username)
                  else null
                end,
                'WAKILISHA contributor'
              )
            else 'WAKILISHA contributor'
          end as contributor_label,
          contribution.contribution_kind,
          contribution.status,
          contribution.acceptance_mode,
          contribution.accepted_version_id,
          contribution.review_note,
          contribution.reviewed_at,
          contribution.created_at
        from editorial.track_lyrics_contributions contribution
        join public.registry_tracks track
          on track.id = contribution.track_id
        left join public.user_profiles profile
          on profile.user_id = contribution.contributor_id
        left join lateral (
          select coalesce(
            jsonb_agg(artist_name order by credit_order, artist_name),
            '[]'::jsonb
          ) as artists
          from (
            select distinct on (
              coalesce(
                artist.id::text,
                track_artist.artist_name_text,
                track_artist.artist_slug
              )
            )
              coalesce(
                nullif(btrim(artist.display_name), ''),
                nullif(btrim(track_artist.artist_name_text), ''),
                nullif(btrim(track_artist.display_credit), ''),
                nullif(btrim(track_artist.artist_slug), '')
              ) as artist_name,
              coalesce(track_artist.credit_order, 0) as credit_order
            from public.registry_track_artists track_artist
            left join public.registry_artists artist
              on artist.id = track_artist.artist_id
             and artist.status = 'active'
            where track_artist.track_id = contribution.track_id
              and track_artist.status = 'active'
            order by
              coalesce(
                artist.id::text,
                track_artist.artist_name_text,
                track_artist.artist_slug
              ),
              coalesce(track_artist.credit_order, 0)
          ) names
          where artist_name is not null
        ) artist_data on true
        where (p_track_id is null or contribution.track_id = p_track_id)
        order by coalesce(contribution.reviewed_at, contribution.created_at) desc,
                 contribution.id desc
        limit v_limit
      ) row
    ), '[]'::jsonb),
    'versions',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', row.id,
          'track_id', row.track_id,
          'track_title', row.track_title,
          'track_slug', row.track_slug,
          'artists', row.artists,
          'version_number', row.version_number,
          'language_code', row.language_code,
          'timing_mode', row.timing_mode,
          'source_kind', row.source_kind,
          'source_contribution_id', row.source_contribution_id,
          'source_contributor_label', row.source_contributor_label,
          'community_revision_mode', row.community_revision_mode,
          'is_working', row.is_working,
          'is_published', row.is_published,
          'created_at', row.created_at
        )
        order by row.created_at desc, row.id desc
      )
      from (
        select
          version.id,
          version.track_id,
          track.title as track_title,
          track.slug as track_slug,
          coalesce(artist_data.artists, '[]'::jsonb) as artists,
          version.version_number,
          version.language_code,
          version.timing_mode,
          version.source_kind,
          version.source_contribution_id,
          version.source_contributor_label,
          version.community_revision_mode,
          document.current_working_version_id = version.id as is_working,
          document.current_published_version_id = version.id as is_published,
          version.created_at
        from editorial.track_lyrics_versions version
        join public.registry_tracks track
          on track.id = version.track_id
        left join editorial.track_lyrics_documents document
          on document.track_id = version.track_id
        left join lateral (
          select coalesce(
            jsonb_agg(artist_name order by credit_order, artist_name),
            '[]'::jsonb
          ) as artists
          from (
            select distinct on (
              coalesce(
                artist.id::text,
                track_artist.artist_name_text,
                track_artist.artist_slug
              )
            )
              coalesce(
                nullif(btrim(artist.display_name), ''),
                nullif(btrim(track_artist.artist_name_text), ''),
                nullif(btrim(track_artist.display_credit), ''),
                nullif(btrim(track_artist.artist_slug), '')
              ) as artist_name,
              coalesce(track_artist.credit_order, 0) as credit_order
            from public.registry_track_artists track_artist
            left join public.registry_artists artist
              on artist.id = track_artist.artist_id
             and artist.status = 'active'
            where track_artist.track_id = version.track_id
              and track_artist.status = 'active'
            order by
              coalesce(
                artist.id::text,
                track_artist.artist_name_text,
                track_artist.artist_slug
              ),
              coalesce(track_artist.credit_order, 0)
          ) names
          where artist_name is not null
        ) artist_data on true
        where (p_track_id is null or version.track_id = p_track_id)
        order by version.created_at desc, version.id desc
        limit v_limit
      ) row
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_admin_track_lyrics_history(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_admin_track_lyrics_history(uuid, integer)
  to authenticated, service_role;

commit;
