-- Phase 6B M2 compatibility adapter for the M1 public Audio safety resolver.
--
-- The exact M1 resolver body remains the one Audio publication-safety authority.
-- M2 renames it internally and restores the public RPC name as a thin identity
-- adapter so callers never receive an Episode canonicalized under /audio/.
--
-- Standalone Audio: /audio/:slug
-- Show Episode:     /shows/:showSlug/:episodeSlug

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-6b-m2-audio-canonical-show-paths',
    0
  )
);

alter function public.get_public_audio_publication(text)
  rename to get_public_audio_publication_m1;

revoke all
  on function public.get_public_audio_publication_m1(text)
  from public, anon, authenticated, service_role;

create or replace function public.get_public_audio_publication(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial', 'audio'
as $function$
declare
  v_payload jsonb;
  v_publication_id uuid;
  v_publication_kind text;
  v_show editorial.shows%rowtype;
  v_episode editorial.show_episodes%rowtype;
  v_canonical_path text;
begin
  v_payload := public.get_public_audio_publication_m1(p_slug);

  if v_payload is null then
    return null;
  end if;

  v_publication_kind := v_payload ->> 'publication_kind';

  if v_publication_kind = 'standalone' then
    return jsonb_set(
      v_payload,
      '{canonical_path}',
      to_jsonb('/audio/' || (v_payload ->> 'slug')),
      true
    );
  end if;

  if v_publication_kind <> 'episode' then
    return null;
  end if;

  begin
    v_publication_id := (v_payload ->> 'publication_id')::uuid;
  exception
    when others then
      return null;
  end;

  select
    show_row.*,
    episode_row.*
  into
    v_show,
    v_episode
  from editorial.audio_episode_shared_links audio_link
  join editorial.show_episodes episode_row
    on episode_row.resource_id = audio_link.show_episode_resource_id
  join editorial.resources episode_resource
    on episode_resource.id = episode_row.resource_id
   and episode_resource.resource_kind = 'show_episode'
   and episode_resource.lifecycle_state = 'active'
   and episode_resource.visibility = 'public'
  join editorial.shows show_row
    on show_row.resource_id = episode_row.show_resource_id
  join editorial.resources show_resource
    on show_resource.id = show_row.resource_id
   and show_resource.resource_kind = 'show'
   and show_resource.lifecycle_state = 'active'
   and show_resource.visibility = 'public'
  where audio_link.audio_publication_id = v_publication_id
  limit 1;

  if not found then
    return null;
  end if;

  v_canonical_path :=
    '/shows/' || v_show.slug || '/' || v_episode.slug;

  v_payload := jsonb_set(
    v_payload,
    '{canonical_path}',
    to_jsonb(v_canonical_path),
    true
  );

  v_payload := jsonb_set(
    v_payload,
    '{show}',
    jsonb_build_object(
      'id', v_show.resource_id,
      'resource_id', v_show.resource_id,
      'slug', v_show.slug,
      'title', v_show.title,
      'description', v_show.description
    ),
    true
  );

  return v_payload;
end;
$function$;

revoke all
  on function public.get_public_audio_publication(text)
  from public;

grant execute
  on function public.get_public_audio_publication(text)
  to anon, authenticated;

comment on function public.get_public_audio_publication_m1(text) is
  'Internalized Phase 6B M1 exact-version Audio safety resolver. M2 public identity wrappers compose this function rather than duplicate its Media and Trust authority.';

comment on function public.get_public_audio_publication(text) is
  'Public Audio rendition resolver. Standalone Audio remains /audio/:slug; episodic Audio is canonicalized through shared /shows/:showSlug/:episodeSlug identity.';

commit;
