begin;

select pg_advisory_xact_lock(
  hashtextextended('wakilisha:track-lyrics-review-provenance', 0)
);

-- Candidate only. Final repo migration must be created with `supabase migration new`
-- and must preserve these bytes from the generated migration body onward.
--
-- Track Lyrics review provenance convergence:
-- 1. correct Lyrics capabilities away from public bookmark `save_content`;
-- 2. make contributions immutable in their submitted payload;
-- 3. distinguish initial submissions from corrections at submission time;
-- 4. support accept-as-submitted vs accept-with-revisions;
-- 5. preserve structural contributor/revision provenance on immutable Lyrics versions;
-- 6. expose a global admin Lyrics inbox and artist-aware Track search;
-- 7. expose only public-safe published provenance.

begin;

-- ---------------------------------------------------------------------------
-- Schema provenance
-- ---------------------------------------------------------------------------

alter table editorial.track_lyrics_contributions
  add column if not exists contribution_kind text not null default 'submission',
  add column if not exists acceptance_mode text;

alter table editorial.track_lyrics_contributions
  drop constraint if exists track_lyrics_contributions_kind_check;

alter table editorial.track_lyrics_contributions
  add constraint track_lyrics_contributions_kind_check
  check (contribution_kind in ('submission', 'correction'));

alter table editorial.track_lyrics_contributions
  drop constraint if exists track_lyrics_contributions_acceptance_mode_check;

alter table editorial.track_lyrics_contributions
  add constraint track_lyrics_contributions_acceptance_mode_check
  check (
    acceptance_mode is null
    or acceptance_mode in ('as_submitted', 'with_revisions')
  );

alter table editorial.track_lyrics_contributions
  drop constraint if exists track_lyrics_contributions_review_state_check;

alter table editorial.track_lyrics_contributions
  add constraint track_lyrics_contributions_review_state_check
  check (
    (
      status = 'submitted'
      and reviewed_at is null
      and reviewed_by is null
      and accepted_version_id is null
      and acceptance_mode is null
    )
    or (
      status = 'promoted'
      and reviewed_at is not null
      and reviewed_by is not null
      and accepted_version_id is not null
      and acceptance_mode in ('as_submitted', 'with_revisions')
    )
    or (
      status = 'rejected'
      and reviewed_at is not null
      and reviewed_by is not null
      and accepted_version_id is null
      and acceptance_mode is null
    )
  );

alter table editorial.track_lyrics_versions
  add column if not exists source_contribution_id uuid,
  add column if not exists source_contributor_id uuid,
  add column if not exists source_contributor_label text,
  add column if not exists community_revision_mode text;

alter table editorial.track_lyrics_versions
  drop constraint if exists track_lyrics_versions_source_contribution_fkey;

alter table editorial.track_lyrics_versions
  add constraint track_lyrics_versions_source_contribution_fkey
  foreign key (source_contribution_id)
  references editorial.track_lyrics_contributions(id)
  on update cascade
  on delete restrict;

alter table editorial.track_lyrics_versions
  drop constraint if exists track_lyrics_versions_source_contributor_fkey;

alter table editorial.track_lyrics_versions
  drop constraint if exists track_lyrics_versions_community_revision_check;

alter table editorial.track_lyrics_versions
  add constraint track_lyrics_versions_community_revision_check
  check (
    community_revision_mode is null
    or community_revision_mode in ('as_submitted', 'with_revisions')
  );

create index if not exists track_lyrics_contributions_status_created_idx
  on editorial.track_lyrics_contributions (status, created_at desc, id);

create index if not exists track_lyrics_versions_source_contribution_idx
  on editorial.track_lyrics_versions (source_contribution_id)
  where source_contribution_id is not null;

-- ---------------------------------------------------------------------------
-- Immutable contribution payload
-- ---------------------------------------------------------------------------

create or replace function editorial.protect_track_lyrics_contribution_payload()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
begin
  if old.track_id is distinct from new.track_id
     or old.contributor_id is distinct from new.contributor_id
     or old.language_code is distinct from new.language_code
     or old.timing_mode is distinct from new.timing_mode
     or old.lines is distinct from new.lines
     or old.plain_text is distinct from new.plain_text
     or old.source_description is distinct from new.source_description
     or old.contribution_kind is distinct from new.contribution_kind
  then
    raise exception 'Submitted Lyrics contribution payload is immutable';
  end if;

  return new;
end;
$function$;

revoke all on function editorial.protect_track_lyrics_contribution_payload()
  from public, anon, authenticated;

drop trigger if exists track_lyrics_contributions_payload_immutable
  on editorial.track_lyrics_contributions;

create trigger track_lyrics_contributions_payload_immutable
before update on editorial.track_lyrics_contributions
for each row
execute function editorial.protect_track_lyrics_contribution_payload();

-- ---------------------------------------------------------------------------
-- Shared Lyrics payload validation inside private authority
-- ---------------------------------------------------------------------------

create or replace function editorial.normalize_track_lyrics_payload(
  p_timing_mode text,
  p_lines jsonb
)
returns jsonb
language plpgsql
set search_path to 'pg_catalog'
as $function$
declare
  v_line jsonb;
  v_start numeric;
  v_plain_text text;
begin
  if p_timing_mode not in ('plain', 'line') then
    raise exception 'Lyrics timing mode must be plain or line';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one Lyrics line';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) <> 'object'
       or btrim(coalesce(v_line ->> 'text', '')) = '' then
      raise exception 'Every Lyrics line requires text';
    end if;

    if p_timing_mode = 'line' then
      begin
        v_start := (v_line ->> 'start_seconds')::numeric;
      exception when others then
        raise exception 'Timed Lyrics lines require numeric start_seconds';
      end;

      if v_start < 0 then
        raise exception 'Lyrics start_seconds cannot be negative';
      end if;
    end if;
  end loop;

  select string_agg(
    btrim(value ->> 'text'),
    E'\n'
    order by ordinality
  )
  into v_plain_text
  from jsonb_array_elements(p_lines)
       with ordinality as line(value, ordinality);

  return jsonb_build_object(
    'lines', p_lines,
    'plain_text', v_plain_text
  );
end;
$function$;

revoke all on function editorial.normalize_track_lyrics_payload(text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contributor submission authority
-- ---------------------------------------------------------------------------

create or replace function public.submit_track_lyrics_contribution(
  p_track_id uuid,
  p_language_code text,
  p_timing_mode text,
  p_lines jsonb,
  p_source_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial', 'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_contribution_id uuid;
  v_created_at timestamptz;
  v_payload jsonb;
  v_kind text;
begin
  if v_actor is null then
    raise exception 'Sign in to contribute Lyrics';
  end if;

  if not exists (
    select 1
    from public.registry_tracks track
    where track.id = p_track_id
      and track.status = 'active'
  ) then
    raise exception 'Active Registry Track does not exist';
  end if;

  if btrim(coalesce(p_language_code, '')) = '' then
    raise exception 'Lyrics language code is required';
  end if;

  v_payload := editorial.normalize_track_lyrics_payload(
    p_timing_mode,
    p_lines
  );

  select case
    when document.current_published_version_id is not null
      then 'correction'
    else 'submission'
  end
  into v_kind
  from (
    select p_track_id as track_id
  ) target
  left join editorial.track_lyrics_documents document
    on document.track_id = target.track_id;

  insert into editorial.track_lyrics_contributions (
    track_id,
    contributor_id,
    language_code,
    timing_mode,
    lines,
    plain_text,
    source_description,
    contribution_kind
  )
  values (
    p_track_id,
    v_actor,
    lower(btrim(p_language_code)),
    p_timing_mode,
    v_payload -> 'lines',
    v_payload ->> 'plain_text',
    nullif(btrim(coalesce(p_source_description, '')), ''),
    coalesce(v_kind, 'submission')
  )
  returning id, created_at
  into v_contribution_id, v_created_at;

  return jsonb_build_object(
    'contribution_id', v_contribution_id,
    'track_id', p_track_id,
    'status', 'submitted',
    'contribution_kind', coalesce(v_kind, 'submission'),
    'created_at', v_created_at
  );
end;
$function$;

revoke all on function public.submit_track_lyrics_contribution(uuid, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_track_lyrics_contribution(uuid, text, text, jsonb, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Capability-correct admin workspace reads
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_track_lyrics_workspace(
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_document editorial.track_lyrics_documents%rowtype;
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
  ) then
    raise exception 'Audio editorial permission is required';
  end if;

  select document.*
  into v_document
  from editorial.track_lyrics_documents document
  where document.track_id = p_track_id;

  return jsonb_build_object(
    'track_id', p_track_id,
    'authority_revision', coalesce(v_document.authority_revision, 1),
    'current_working_version_id', v_document.current_working_version_id,
    'current_published_version_id', v_document.current_published_version_id,
    'working', (
      select jsonb_build_object(
        'id', version.id,
        'version_number', version.version_number,
        'language_code', version.language_code,
        'timing_mode', version.timing_mode,
        'lines', version.lines,
        'plain_text', version.plain_text,
        'source_kind', version.source_kind,
        'rights_note', version.rights_note,
        'source_contribution_id', version.source_contribution_id,
        'source_contributor_label', version.source_contributor_label,
        'community_revision_mode', version.community_revision_mode,
        'created_at', version.created_at
      )
      from editorial.track_lyrics_versions version
      where version.id = v_document.current_working_version_id
    ),
    'published', (
      select jsonb_build_object(
        'id', version.id,
        'version_number', version.version_number,
        'language_code', version.language_code,
        'timing_mode', version.timing_mode,
        'lines', version.lines,
        'plain_text', version.plain_text,
        'source_kind', version.source_kind,
        'rights_note', version.rights_note,
        'source_contribution_id', version.source_contribution_id,
        'source_contributor_label', version.source_contributor_label,
        'community_revision_mode', version.community_revision_mode,
        'created_at', version.created_at
      )
      from editorial.track_lyrics_versions version
      where version.id = v_document.current_published_version_id
    ),
    'can_edit', (
      coalesce(public.current_user_is_administrator(), false)
      or coalesce(public.current_user_has_capability('edit_own_audio'), false)
      or coalesce(public.current_user_has_capability('edit_others_audio'), false)
    ),
    'can_manage_review', (
      coalesce(public.current_user_is_administrator(), false)
      or coalesce(public.current_user_has_capability('manage_review_queue'), false)
    ),
    'can_publish', (
      coalesce(public.current_user_is_administrator(), false)
      or coalesce(public.current_user_has_capability('publish_audio'), false)
    )
  );
end;
$function$;

revoke all on function public.get_admin_track_lyrics_workspace(uuid)
  from public, anon, authenticated;
grant execute on function public.get_admin_track_lyrics_workspace(uuid)
  to authenticated, service_role;

create or replace function public.get_admin_track_lyrics_contributions(
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
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
  ) then
    raise exception 'Audio editorial permission is required';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', contribution.id,
        'track_id', contribution.track_id,
        'contributor_id', contribution.contributor_id,
        'contributor_label', case
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
        end,
        'contributor_username', case
          when profile.is_public = true and profile.status = 'active'
            then nullif(btrim(profile.username), '')
          else null
        end,
        'contribution_kind', contribution.contribution_kind,
        'language_code', contribution.language_code,
        'timing_mode', contribution.timing_mode,
        'lines', contribution.lines,
        'plain_text', contribution.plain_text,
        'source_description', contribution.source_description,
        'status', contribution.status,
        'acceptance_mode', contribution.acceptance_mode,
        'accepted_version_id', contribution.accepted_version_id,
        'reviewed_by', contribution.reviewed_by,
        'reviewed_at', contribution.reviewed_at,
        'review_note', contribution.review_note,
        'created_at', contribution.created_at
      )
      order by contribution.created_at desc, contribution.id desc
    )
    from (
      select row.*
      from editorial.track_lyrics_contributions row
      where row.track_id = p_track_id
      order by row.created_at desc, row.id desc
      limit 100
    ) contribution
    left join public.user_profiles profile
      on profile.user_id = contribution.contributor_id
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_admin_track_lyrics_contributions(uuid)
  from public, anon, authenticated;
grant execute on function public.get_admin_track_lyrics_contributions(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Global Lyrics inbox and governed Registry Track search
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_track_lyrics_contribution_inbox(
  p_search text default null,
  p_status text default 'submitted',
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 250));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('view_audio'), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false)
  ) then
    raise exception 'Lyrics review permission is required';
  end if;

  if p_status is not null and p_status not in ('submitted', 'promoted', 'rejected') then
    raise exception 'Unsupported Lyrics contribution status';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', row.id,
        'track_id', row.track_id,
        'track_title', row.track_title,
        'track_slug', row.track_slug,
        'artwork_url', row.artwork_url,
        'artists', row.artists,
        'contributor_id', row.contributor_id,
        'contributor_label', row.contributor_label,
        'contributor_username', row.contributor_username,
        'contribution_kind', row.contribution_kind,
        'language_code', row.language_code,
        'timing_mode', row.timing_mode,
        'lines', row.lines,
        'plain_text', row.plain_text,
        'source_description', row.source_description,
        'status', row.status,
        'acceptance_mode', row.acceptance_mode,
        'accepted_version_id', row.accepted_version_id,
        'reviewed_by', row.reviewed_by,
        'reviewed_at', row.reviewed_at,
        'review_note', row.review_note,
        'created_at', row.created_at
      )
      order by row.created_at desc, row.id desc
    )
    from (
      select
        contribution.*,
        track.title as track_title,
        track.slug as track_slug,
        track.artwork_url,
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
        case
          when profile.is_public = true and profile.status = 'active'
            then nullif(btrim(profile.username), '')
          else null
        end as contributor_username
      from editorial.track_lyrics_contributions contribution
      join public.registry_tracks track
        on track.id = contribution.track_id
      left join public.user_profiles profile
        on profile.user_id = contribution.contributor_id
      left join lateral (
        select coalesce(
          jsonb_agg(artist_name order by credit_order, artist_name),
          '[]'::jsonb
        ) as artists,
        string_agg(artist_name, ' ' order by credit_order, artist_name) as artist_search
        from (
          select distinct on (coalesce(artist.id::text, track_artist.artist_name_text, track_artist.artist_slug))
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
            coalesce(artist.id::text, track_artist.artist_name_text, track_artist.artist_slug),
            coalesce(track_artist.credit_order, 0)
        ) names
        where artist_name is not null
      ) artist_data on true
      where (p_status is null or contribution.status = p_status)
        and (
          v_search is null
          or track.title ilike '%' || v_search || '%'
          or track.slug ilike '%' || v_search || '%'
          or coalesce(artist_data.artist_search, '') ilike '%' || v_search || '%'
          or case
               when profile.is_public = true and profile.status = 'active'
                 then coalesce(profile.display_name, profile.username, '')
               else ''
             end ilike '%' || v_search || '%'
        )
      order by contribution.created_at desc, contribution.id desc
      limit v_limit
      offset v_offset
    ) row
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_admin_track_lyrics_contribution_inbox(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_admin_track_lyrics_contribution_inbox(text, text, integer, integer)
  to authenticated, service_role;

create or replace function public.search_admin_track_lyrics_tracks(
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
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
  ) then
    raise exception 'Audio editorial permission is required';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', row.id,
        'slug', row.slug,
        'title', row.title,
        'artwork_url', row.artwork_url,
        'artists', row.artists,
        'has_published_lyrics', row.has_published_lyrics,
        'pending_contribution_count', row.pending_contribution_count
      )
      order by row.title, row.slug, row.id
    )
    from (
      select
        track.id,
        track.slug,
        track.title,
        track.artwork_url,
        coalesce(artist_data.artists, '[]'::jsonb) as artists,
        document.current_published_version_id is not null as has_published_lyrics,
        coalesce(pending.pending_count, 0)::integer as pending_contribution_count
      from public.registry_tracks track
      left join editorial.track_lyrics_documents document
        on document.track_id = track.id
      left join lateral (
        select coalesce(
          jsonb_agg(artist_name order by credit_order, artist_name),
          '[]'::jsonb
        ) as artists,
        string_agg(artist_name, ' ' order by credit_order, artist_name) as artist_search
        from (
          select distinct on (coalesce(artist.id::text, track_artist.artist_name_text, track_artist.artist_slug))
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
          where track_artist.track_id = track.id
            and track_artist.status = 'active'
          order by
            coalesce(artist.id::text, track_artist.artist_name_text, track_artist.artist_slug),
            coalesce(track_artist.credit_order, 0)
        ) names
        where artist_name is not null
      ) artist_data on true
      left join lateral (
        select count(*) as pending_count
        from editorial.track_lyrics_contributions contribution
        where contribution.track_id = track.id
          and contribution.status = 'submitted'
      ) pending on true
      where track.status = 'active'
        and (
          v_query is null
          or track.title ilike '%' || v_query || '%'
          or track.slug ilike '%' || v_query || '%'
          or coalesce(artist_data.artist_search, '') ilike '%' || v_query || '%'
        )
      order by
        case when coalesce(pending.pending_count, 0) > 0 then 0 else 1 end,
        track.title,
        track.slug,
        track.id
      limit v_limit
    ) row
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.search_admin_track_lyrics_tracks(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_admin_track_lyrics_tracks(text, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Capability-correct manual Lyrics draft authority
-- ---------------------------------------------------------------------------

create or replace function public.save_track_lyrics_draft(
  p_track_id uuid,
  p_expected_authority_revision bigint,
  p_language_code text,
  p_timing_mode text,
  p_lines jsonb,
  p_source_kind text default 'editorial',
  p_rights_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial', 'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_document editorial.track_lyrics_documents%rowtype;
  v_version_id uuid;
  v_version_number bigint;
  v_payload jsonb;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('edit_own_audio'), false)
    or coalesce(public.current_user_has_capability('edit_others_audio'), false)
  ) then
    raise exception 'Audio edit permission is required';
  end if;

  if not exists (
    select 1
    from public.registry_tracks track
    where track.id = p_track_id
      and track.status = 'active'
  ) then
    raise exception 'Active Registry Track does not exist';
  end if;

  if p_expected_authority_revision is null or p_expected_authority_revision < 1 then
    raise exception 'Expected Lyrics authority revision is required';
  end if;

  if btrim(coalesce(p_language_code, '')) = '' then
    raise exception 'Lyrics language code is required';
  end if;

  if coalesce(nullif(btrim(p_source_kind), ''), 'editorial') not in ('editorial', 'licensed') then
    raise exception 'Manual Lyrics drafts must use editorial or licensed source kind';
  end if;

  v_payload := editorial.normalize_track_lyrics_payload(
    p_timing_mode,
    p_lines
  );

  insert into editorial.track_lyrics_documents (
    track_id,
    authority_revision,
    updated_by
  )
  values (
    p_track_id,
    1,
    v_actor
  )
  on conflict (track_id) do nothing;

  select document.*
  into v_document
  from editorial.track_lyrics_documents document
  where document.track_id = p_track_id
  for update;

  if v_document.authority_revision <> p_expected_authority_revision then
    raise exception 'Lyrics changed somewhere else. Reload and try again.';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into v_version_number
  from editorial.track_lyrics_versions version
  where version.track_id = p_track_id;

  insert into editorial.track_lyrics_versions (
    track_id,
    version_number,
    language_code,
    timing_mode,
    lines,
    plain_text,
    source_kind,
    rights_note,
    created_by,
    source_contribution_id,
    source_contributor_id,
    source_contributor_label,
    community_revision_mode
  )
  values (
    p_track_id,
    v_version_number,
    lower(btrim(p_language_code)),
    p_timing_mode,
    v_payload -> 'lines',
    v_payload ->> 'plain_text',
    coalesce(nullif(btrim(p_source_kind), ''), 'editorial'),
    nullif(btrim(p_rights_note), ''),
    v_actor,
    null,
    null,
    null,
    null
  )
  returning id into v_version_id;

  update editorial.track_lyrics_documents document
  set
    current_working_version_id = v_version_id,
    authority_revision = document.authority_revision + 1,
    updated_by = v_actor,
    updated_at = now()
  where document.track_id = p_track_id
  returning document.* into v_document;

  return jsonb_build_object(
    'track_id', p_track_id,
    'version_id', v_version_id,
    'version_number', v_version_number,
    'authority_revision', v_document.authority_revision
  );
end;
$function$;

revoke all on function public.save_track_lyrics_draft(uuid, bigint, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.save_track_lyrics_draft(uuid, bigint, text, text, jsonb, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Contribution review authority
-- ---------------------------------------------------------------------------

create or replace function public.review_track_lyrics_contribution(
  p_contribution_id uuid,
  p_expected_authority_revision bigint,
  p_language_code text,
  p_timing_mode text,
  p_lines jsonb,
  p_acceptance_mode text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial', 'extensions'
as $function$
declare
  v_actor uuid := auth.uid();
  v_contribution editorial.track_lyrics_contributions%rowtype;
  v_document editorial.track_lyrics_documents%rowtype;
  v_version_id uuid;
  v_version_number bigint;
  v_payload jsonb;
  v_public_label text;
  v_lines jsonb;
  v_language text;
  v_timing text;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false)
  ) then
    raise exception 'Review permission is required';
  end if;

  if p_acceptance_mode not in ('as_submitted', 'with_revisions') then
    raise exception 'Lyrics acceptance mode must be as_submitted or with_revisions';
  end if;

  if p_expected_authority_revision is null or p_expected_authority_revision < 1 then
    raise exception 'Expected Lyrics authority revision is required';
  end if;

  select contribution.*
  into v_contribution
  from editorial.track_lyrics_contributions contribution
  where contribution.id = p_contribution_id
  for update;

  if not found then
    raise exception 'Lyrics contribution does not exist';
  end if;

  if v_contribution.status <> 'submitted' then
    raise exception 'Lyrics contribution has already been reviewed';
  end if;

  if p_acceptance_mode = 'with_revisions'
     and not (
       coalesce(public.current_user_is_administrator(), false)
       or coalesce(public.current_user_has_capability('edit_own_audio'), false)
       or coalesce(public.current_user_has_capability('edit_others_audio'), false)
     )
  then
    raise exception 'Audio edit permission is required to revise submitted Lyrics';
  end if;

  if p_acceptance_mode = 'as_submitted' then
    v_language := v_contribution.language_code;
    v_timing := v_contribution.timing_mode;
    v_lines := v_contribution.lines;
  else
    if btrim(coalesce(p_language_code, '')) = '' then
      raise exception 'Lyrics language code is required';
    end if;

    v_language := lower(btrim(p_language_code));
    v_timing := p_timing_mode;
    v_lines := p_lines;
  end if;

  v_payload := editorial.normalize_track_lyrics_payload(
    v_timing,
    v_lines
  );

  if p_acceptance_mode = 'with_revisions'
     and v_payload ->> 'plain_text' = v_contribution.plain_text
     and v_timing = v_contribution.timing_mode
     and v_language = v_contribution.language_code
  then
    raise exception 'No Lyrics revision was detected. Accept this contribution as submitted instead.';
  end if;

  insert into editorial.track_lyrics_documents (
    track_id,
    authority_revision,
    updated_by
  )
  values (
    v_contribution.track_id,
    1,
    v_actor
  )
  on conflict (track_id) do nothing;

  select document.*
  into v_document
  from editorial.track_lyrics_documents document
  where document.track_id = v_contribution.track_id
  for update;

  if v_document.authority_revision <> p_expected_authority_revision then
    raise exception 'Lyrics changed somewhere else. Reload and try again.';
  end if;

  select case
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
  end
  into v_public_label
  from (select v_contribution.contributor_id as user_id) contributor
  left join public.user_profiles profile
    on profile.user_id = contributor.user_id;

  select coalesce(max(version.version_number), 0) + 1
  into v_version_number
  from editorial.track_lyrics_versions version
  where version.track_id = v_contribution.track_id;

  insert into editorial.track_lyrics_versions (
    track_id,
    version_number,
    language_code,
    timing_mode,
    lines,
    plain_text,
    source_kind,
    rights_note,
    created_by,
    source_contribution_id,
    source_contributor_id,
    source_contributor_label,
    community_revision_mode
  )
  values (
    v_contribution.track_id,
    v_version_number,
    v_language,
    v_timing,
    v_payload -> 'lines',
    v_payload ->> 'plain_text',
    'contributor',
    v_contribution.source_description,
    v_actor,
    v_contribution.id,
    v_contribution.contributor_id,
    coalesce(v_public_label, 'WAKILISHA contributor'),
    p_acceptance_mode
  )
  returning id into v_version_id;

  update editorial.track_lyrics_documents document
  set
    current_working_version_id = v_version_id,
    authority_revision = document.authority_revision + 1,
    updated_by = v_actor,
    updated_at = now()
  where document.track_id = v_contribution.track_id
  returning document.* into v_document;

  update editorial.track_lyrics_contributions contribution
  set
    status = 'promoted',
    acceptance_mode = p_acceptance_mode,
    accepted_version_id = v_version_id,
    reviewed_by = v_actor,
    reviewed_at = now(),
    review_note = nullif(btrim(coalesce(p_review_note, '')), '')
  where contribution.id = v_contribution.id;

  return jsonb_build_object(
    'contribution_id', v_contribution.id,
    'track_id', v_contribution.track_id,
    'version_id', v_version_id,
    'version_number', v_version_number,
    'authority_revision', v_document.authority_revision,
    'status', 'promoted',
    'acceptance_mode', p_acceptance_mode
  );
end;
$function$;

revoke all on function public.review_track_lyrics_contribution(uuid, bigint, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.review_track_lyrics_contribution(uuid, bigint, text, text, jsonb, text, text)
  to authenticated, service_role;

-- Backward-compatible command. Existing clients that still call Promote receive
-- an as-submitted acceptance with the same optimistic revision contract.
create or replace function public.promote_track_lyrics_contribution_to_draft(
  p_contribution_id uuid,
  p_expected_authority_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  return public.review_track_lyrics_contribution(
    p_contribution_id,
    p_expected_authority_revision,
    'und',
    'plain',
    '[]'::jsonb,
    'as_submitted',
    null
  );
end;
$function$;

revoke all on function public.promote_track_lyrics_contribution_to_draft(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.promote_track_lyrics_contribution_to_draft(uuid, bigint)
  to authenticated, service_role;

create or replace function public.reject_track_lyrics_contribution(
  p_contribution_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_track_id uuid;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false)
  ) then
    raise exception 'Review permission is required';
  end if;

  if v_note is null then
    raise exception 'Add a decision note before rejecting this Lyrics contribution';
  end if;

  update editorial.track_lyrics_contributions contribution
  set
    status = 'rejected',
    acceptance_mode = null,
    reviewed_by = v_actor,
    reviewed_at = now(),
    review_note = v_note
  where contribution.id = p_contribution_id
    and contribution.status = 'submitted'
  returning contribution.track_id into v_track_id;

  if v_track_id is null then
    raise exception 'Lyrics contribution does not exist or has already been reviewed';
  end if;

  return jsonb_build_object(
    'contribution_id', p_contribution_id,
    'track_id', v_track_id,
    'status', 'rejected'
  );
end;
$function$;

revoke all on function public.reject_track_lyrics_contribution(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reject_track_lyrics_contribution(uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Capability-correct publish authority
-- ---------------------------------------------------------------------------

create or replace function public.publish_track_lyrics_version(
  p_track_id uuid,
  p_version_id uuid,
  p_expected_authority_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
  v_document editorial.track_lyrics_documents%rowtype;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('publish_audio'), false)
  ) then
    raise exception 'Audio publish permission is required';
  end if;

  select document.*
  into v_document
  from editorial.track_lyrics_documents document
  where document.track_id = p_track_id
  for update;

  if not found then
    raise exception 'Lyrics document does not exist';
  end if;

  if v_document.authority_revision <> p_expected_authority_revision then
    raise exception 'Lyrics changed somewhere else. Reload and try again.';
  end if;

  if not exists (
    select 1
    from editorial.track_lyrics_versions version
    where version.id = p_version_id
      and version.track_id = p_track_id
  ) then
    raise exception 'Lyrics version does not belong to this Track';
  end if;

  update editorial.track_lyrics_documents document
  set
    current_published_version_id = p_version_id,
    authority_revision = document.authority_revision + 1,
    updated_by = v_actor,
    updated_at = now()
  where document.track_id = p_track_id
  returning document.* into v_document;

  return jsonb_build_object(
    'track_id', p_track_id,
    'version_id', p_version_id,
    'authority_revision', v_document.authority_revision,
    'published', true
  );
end;
$function$;

revoke all on function public.publish_track_lyrics_version(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.publish_track_lyrics_version(uuid, uuid, bigint)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public-safe published Lyrics provenance
-- ---------------------------------------------------------------------------

create or replace function public.get_public_track_lyrics(
  p_track_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select case
    when version.id is null then null
    else jsonb_build_object(
      'track_id', document.track_id,
      'version_id', version.id,
      'version_number', version.version_number,
      'language_code', version.language_code,
      'timing_mode', version.timing_mode,
      'lines', version.lines,
      'plain_text', version.plain_text,
      'source_kind', version.source_kind,
      'provenance', case
        when version.source_kind = 'contributor'
             and version.source_contribution_id is not null
          then jsonb_build_object(
            'kind', 'community_contribution',
            'contributor_label', coalesce(
              nullif(btrim(version.source_contributor_label), ''),
              'WAKILISHA contributor'
            ),
            'revision_mode', version.community_revision_mode
          )
        else null
      end
    )
  end
  from editorial.track_lyrics_documents document
  left join editorial.track_lyrics_versions version
    on version.id = document.current_published_version_id
   and version.track_id = document.track_id
  where document.track_id = p_track_id;
$function$;

revoke all on function public.get_public_track_lyrics(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_track_lyrics(uuid)
  to anon, authenticated, service_role;

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

-- Candidate only. Final repository migration is created through the Supabase
-- CLI workflow. Historical generic lyrics_correction rows remain readable.
-- New Lyrics work must use the governed Track Lyrics contribution authority.

begin;

create or replace function public.community_create_contribution(
  p_source_comment_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_entity_slug text,
  p_contribution_type text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_entity_type text := nullif(trim(coalesce(p_entity_type, '')), '');
  v_entity_id text := nullif(trim(coalesce(p_entity_id, '')), '');
  v_entity_slug text := nullif(trim(coalesce(p_entity_slug, '')), '');
  v_contribution_type text := nullif(trim(coalesce(p_contribution_type, '')), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_contribution jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if v_entity_type is null then
    raise exception 'Entity type is required' using errcode = '22023';
  end if;

  if v_entity_id is null and v_entity_slug is null then
    raise exception 'Entity identity is required' using errcode = '22023';
  end if;

  if v_contribution_type is null then
    raise exception 'Contribution type is required' using errcode = '22023';
  end if;

  if v_contribution_type = 'lyrics_correction' then
    raise exception
      'Lyrics corrections use the governed Track Lyrics contribution flow'
      using errcode = '22023';
  end if;

  if p_source_comment_id is not null
     and not exists (
       select 1
       from public.community_comments comment
       where comment.id = p_source_comment_id
     )
  then
    raise exception 'Source comment not found' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|contribution|'
      || coalesce(p_source_comment_id::text, '')
      || '|'
      || v_entity_type
      || '|'
      || coalesce(v_entity_id, '')
      || '|'
      || coalesce(v_entity_slug, '')
      || '|'
      || v_contribution_type
      || '|'
      || v_payload::text,
      0
    )
  );

  select to_jsonb(contribution.*)
  into v_contribution
  from public.community_contributions contribution
  where contribution.user_id = v_user_id
    and contribution.source_comment_id is not distinct from p_source_comment_id
    and contribution.entity_type = v_entity_type
    and contribution.entity_id is not distinct from v_entity_id
    and contribution.entity_slug is not distinct from v_entity_slug
    and contribution.contribution_type = v_contribution_type
    and contribution.payload = v_payload
    and contribution.status = 'pending'
  order by contribution.created_at desc
  limit 1;

  if v_contribution is not null then
    return jsonb_build_object(
      'contribution', v_contribution,
      'created', false
    );
  end if;

  insert into public.community_contributions (
    user_id,
    source_comment_id,
    entity_type,
    entity_id,
    entity_slug,
    contribution_type,
    payload
  )
  values (
    v_user_id,
    p_source_comment_id,
    v_entity_type,
    v_entity_id,
    v_entity_slug,
    v_contribution_type,
    v_payload
  )
  returning to_jsonb(community_contributions.*)
  into v_contribution;

  return jsonb_build_object(
    'contribution', v_contribution,
    'created', true
  );
end;
$function$;

revoke all on function public.community_create_contribution(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.community_create_contribution(uuid, text, text, text, text, jsonb)
  to authenticated, service_role;

commit;
