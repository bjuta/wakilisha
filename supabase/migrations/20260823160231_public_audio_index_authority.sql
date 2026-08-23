create or replace function public.get_public_audio_index(
  p_limit integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial', 'audio'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 60));
  v_standalone jsonb := '[]'::jsonb;
  v_shows jsonb := '[]'::jsonb;
begin
  select coalesce(
    jsonb_agg(
      candidate.payload
      order by
        coalesce(
          nullif(candidate.payload #>> '{provenance,published_at}', '')::timestamptz,
          '-infinity'::timestamptz
        ) desc,
        candidate.payload ->> 'slug'
    ),
    '[]'::jsonb
  )
  into v_standalone
  from (
    select resolved.payload
    from audio.publications publication
    cross join lateral (
      select public.get_public_audio_publication(publication.slug) as payload
    ) resolved
    where publication.status = 'published'
      and publication.publication_kind = 'standalone'
      and resolved.payload is not null
    order by
      coalesce(
        nullif(resolved.payload #>> '{provenance,published_at}', '')::timestamptz,
        '-infinity'::timestamptz
      ) desc,
      publication.slug
    limit v_limit
  ) candidate;

  select coalesce(
    jsonb_agg(
      candidate.payload
      order by
        coalesce(
          nullif(candidate.payload #>> '{episodes,0,audio,provenance,published_at}', '')::timestamptz,
          '-infinity'::timestamptz
        ) desc,
        candidate.payload #>> '{show,slug}'
    ),
    '[]'::jsonb
  )
  into v_shows
  from (
    select resolved.payload
    from editorial.shows show_row
    cross join lateral (
      select public.get_public_show(show_row.slug) as payload
    ) resolved
    where resolved.payload is not null
    order by
      coalesce(
        nullif(resolved.payload #>> '{episodes,0,audio,provenance,published_at}', '')::timestamptz,
        '-infinity'::timestamptz
      ) desc,
      show_row.slug
    limit v_limit
  ) candidate;

  return jsonb_build_object(
    'standalone', v_standalone,
    'shows', v_shows
  );
end;
$function$;

revoke all on function public.get_public_audio_index(integer) from public;
grant execute on function public.get_public_audio_index(integer) to anon, authenticated;
