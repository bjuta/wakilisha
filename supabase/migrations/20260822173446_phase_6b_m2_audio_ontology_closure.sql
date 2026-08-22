-- Phase 6B M2 ontology closure.
--
-- This migration closes implementation leaks found during live browser acceptance:
-- - Show Episode public identity stays Show-scoped and independent of Audio lookup identity.
-- - Audio publication slugs become immutable after creation.
-- - the plain public Audio resolver returns Standalone Audio only.
-- - Show Episode and enclosure delivery compose the internalized M1 Audio safety resolver.
-- - Audio Trust attachment pickers read bounded semantic candidates instead of typed UUIDs.
--
-- Production had zero Audio Shows, Seasons, and Episodes when this correction was designed.
-- The preflight keeps this migration fail-closed if that window has changed.

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-6b-m2-ontology-closure',
    0
  )
);

do $phase_6b_m2_ontology_preflight$
begin
  if to_regclass('audio.publications') is null
     or to_regclass('editorial.shows') is null
     or to_regclass('editorial.show_episodes') is null
     or to_regclass('editorial.audio_episode_shared_links') is null
     or to_regprocedure('public.get_public_audio_publication_m1(text)') is null
     or to_regprocedure('public.get_public_audio_publication(text)') is null
     or to_regprocedure('public.get_public_show_episode(text,text)') is null
     or to_regprocedure('public.get_public_audio_enclosure(uuid)') is null
     or to_regprocedure('editorial.ensure_audio_episode_shared_identity(uuid)') is null
  then
    raise exception
      'STOP: Phase 6B M2 authority is incomplete.';
  end if;

  if exists (
    select 1
    from audio.publications publication
    where publication.publication_kind = 'episode'
  ) or exists (
    select 1
    from editorial.show_episodes
  ) then
    raise exception
      'STOP: Show Episode identity now exists. Reconcile it explicitly before applying the ontology closure.';
  end if;
end;
$phase_6b_m2_ontology_preflight$;

-- ---------------------------------------------------------------------------
-- Audio lookup identity is infrastructure, not editor-authored metadata.
--
-- Standalone Audio keeps its canonical public slug in audio.publications.slug.
-- Episode rows use an internal Audio lookup key:
--
--   ep-<audio_show_uuid>-<show_scoped_episode_slug>
--
-- The Show-scoped public slug is projected into editorial.show_episodes.slug.
-- Keeping the existing global unique Audio key preserves the exact M1 safety
-- resolver while allowing different Shows to use the same public Episode slug.
-- ---------------------------------------------------------------------------

create or replace function audio.enforce_publication_slug_identity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'audio'
as $function$
declare
  v_prefix text;
  v_episode_slug text;
begin
  if tg_op = 'UPDATE'
     and new.slug is distinct from old.slug
  then
    raise exception
      using
        errcode = '22023',
        message =
          'Audio URL identity is system-managed. Use a governed rename flow when redirect support exists.';
  end if;

  if new.publication_kind = 'episode' then
    if new.show_id is null then
      raise exception
        using
          errcode = '22023',
          message =
            'A Show Episode requires a Show before Audio identity can be created.';
    end if;

    v_prefix :=
      'ep-' || new.show_id::text || '-';

    -- Existing callers provide the Show-scoped candidate. Store an Audio-only
    -- lookup key without exposing that key to the editorial UI.
    if tg_op = 'INSERT'
       and left(new.slug, length(v_prefix)) <> v_prefix
    then
      new.slug :=
        v_prefix || new.slug;
    end if;

    if left(new.slug, length(v_prefix)) <> v_prefix then
      raise exception
        using
          errcode = '22023',
          message =
            'Audio Episode lookup identity does not match its Show.';
    end if;

    v_episode_slug :=
      substring(
        new.slug
        from length(v_prefix) + 1
      );

    if v_episode_slug is null
       or length(v_episode_slug) < 1
       or length(v_episode_slug) > 120
       or v_episode_slug !~
            '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    then
      raise exception
        using
          errcode = '22023',
          message =
            'Show Episode identity could not be derived from its title.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists
  audio_publication_slug_identity_guard
  on audio.publications;

create trigger
  audio_publication_slug_identity_guard
before insert or update of
  slug,
  show_id,
  publication_kind
on audio.publications
for each row
execute function
  audio.enforce_publication_slug_identity();

comment on column audio.publications.slug is
  'System-managed Audio lookup identity. Standalone Audio stores its canonical public slug. Episode rows store an internal ep-<audio_show_uuid>-<show_scoped_episode_slug> key; canonical Episode identity lives in editorial.show_episodes.slug.';

-- ---------------------------------------------------------------------------
-- Shared Show Episode identity owns the public Episode slug.
-- ---------------------------------------------------------------------------

create or replace function editorial.ensure_audio_episode_shared_identity(
  p_audio_publication_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'audio',
  'extensions'
as $function$
declare
  v_publication audio.publications%rowtype;
  v_audio_resource editorial.resources%rowtype;
  v_show_resource_id uuid;
  v_episode_resource_id uuid;
  v_shared_resource editorial.resources%rowtype;
  v_shared_episode editorial.show_episodes%rowtype;
  v_internal_prefix text;
  v_episode_slug text;
begin
  if p_audio_publication_id is null then
    raise exception 'Audio publication id is required.';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_audio_publication_id;

  if not found then
    raise exception 'Audio publication does not exist.';
  end if;

  if v_publication.publication_kind <> 'episode' then
    return null;
  end if;

  if v_publication.show_id is null then
    raise exception 'Audio Episode requires a Show.';
  end if;

  v_internal_prefix :=
    'ep-' || v_publication.show_id::text || '-';

  if left(
       v_publication.slug,
       length(v_internal_prefix)
     ) <> v_internal_prefix
  then
    raise exception
      'Audio Episode lookup identity is not compatible with shared Show Episode identity.';
  end if;

  v_episode_slug :=
    substring(
      v_publication.slug
      from length(v_internal_prefix) + 1
    );

  if v_episode_slug is null
     or length(v_episode_slug) < 1
     or length(v_episode_slug) > 120
     or v_episode_slug !~
          '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception
      'Shared Show Episode slug is invalid.';
  end if;

  select resource_row.*
  into v_audio_resource
  from editorial.resources resource_row
  where resource_row.id = p_audio_publication_id
    and resource_row.resource_kind = 'audio_episode';

  if not found then
    raise exception 'Audio Episode Resource identity is missing.';
  end if;

  v_show_resource_id :=
    editorial.ensure_audio_show_shared_identity(
      v_publication.show_id
    );

  select link.show_episode_resource_id
  into v_episode_resource_id
  from editorial.audio_episode_shared_links link
  where link.audio_publication_id = p_audio_publication_id;

  if not found then
    if exists (
      select 1
      from editorial.show_episodes episode_row
      where episode_row.show_resource_id =
              v_show_resource_id
        and episode_row.slug =
              v_episode_slug
    ) then
      raise exception
        'This Show already has an Episode with that public identity.';
    end if;

    v_episode_resource_id :=
      extensions.gen_random_uuid();

    insert into editorial.resources (
      id,
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_episode_resource_id,
      'show_episode',
      v_audio_resource.owner_id,
      v_audio_resource.visibility,
      'active',
      coalesce(
        v_publication.created_by,
        v_audio_resource.created_by
      ),
      v_publication.created_at,
      v_publication.updated_at
    );

    insert into editorial.show_episodes (
      resource_id,
      resource_kind,
      show_resource_id,
      slug,
      title,
      summary,
      episode_number,
      authority_revision,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_episode_resource_id,
      'show_episode',
      v_show_resource_id,
      v_episode_slug,
      v_publication.title,
      v_publication.summary,
      v_publication.episode_number,
      v_publication.authority_revision,
      v_publication.created_by,
      v_publication.updated_by,
      v_publication.created_at,
      v_publication.updated_at
    );

    insert into editorial.audio_episode_shared_links (
      audio_publication_id,
      show_episode_resource_id
    )
    values (
      p_audio_publication_id,
      v_episode_resource_id
    );

    return v_episode_resource_id;
  end if;

  select resource_row.*
  into v_shared_resource
  from editorial.resources resource_row
  where resource_row.id =
          v_episode_resource_id
    and resource_row.resource_kind =
          'show_episode';

  select episode_row.*
  into v_shared_episode
  from editorial.show_episodes episode_row
  where episode_row.resource_id =
          v_episode_resource_id;

  if v_shared_resource.id is null
     or v_shared_episode.resource_id is null
     or v_shared_episode.show_resource_id <>
          v_show_resource_id
  then
    raise exception
      'Shared Show Episode identity binding is incomplete.';
  end if;

  -- Canonical identity is immutable here. Metadata edits may update shared
  -- presentation fields, but they never rewrite the public Episode path.
  update editorial.show_episodes episode_row
  set
    title = v_publication.title,
    summary = v_publication.summary,
    episode_number =
      v_publication.episode_number,
    authority_revision =
      v_publication.authority_revision,
    updated_by =
      v_publication.updated_by,
    updated_at =
      v_publication.updated_at
  where episode_row.resource_id =
          v_episode_resource_id;

  update editorial.resources resource_row
  set
    owner_id =
      v_audio_resource.owner_id,
    visibility =
      v_audio_resource.visibility,
    updated_at = greatest(
      resource_row.updated_at,
      v_audio_resource.updated_at
    )
  where resource_row.id =
          v_episode_resource_id;

  return v_episode_resource_id;
end;
$function$;

revoke execute
  on function editorial.ensure_audio_episode_shared_identity(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public identity boundaries.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_audio_publication(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'audio'
as $function$
declare
  v_payload jsonb;
begin
  v_payload :=
    public.get_public_audio_publication_m1(
      p_slug
    );

  if v_payload is null
     or v_payload ->> 'publication_kind'
          <> 'standalone'
  then
    return null;
  end if;

  return jsonb_set(
    v_payload,
    '{canonical_path}',
    to_jsonb(
      '/audio/' ||
      (v_payload ->> 'slug')
    ),
    true
  );
end;
$function$;

revoke all
  on function public.get_public_audio_publication(text)
  from public;

grant execute
  on function public.get_public_audio_publication(text)
  to anon, authenticated;

comment on function public.get_public_audio_publication(text) is
  'Public Standalone Audio resolver. Show Episode identity is resolved only through /shows/:showSlug/:episodeSlug.';

create or replace function public.get_public_show_episode(
  p_show_slug text,
  p_episode_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'audio'
as $function$
declare
  v_show_slug text :=
    nullif(btrim(p_show_slug), '');
  v_episode_slug text :=
    nullif(btrim(p_episode_slug), '');
  v_show editorial.shows%rowtype;
  v_episode editorial.show_episodes%rowtype;
  v_audio_publication audio.publications%rowtype;
  v_audio jsonb;
  v_canonical_path text;
begin
  if v_show_slug is null
     or v_episode_slug is null
  then
    return null;
  end if;

  select show_row.*
  into v_show
  from editorial.shows show_row
  join editorial.resources show_resource
    on show_resource.id =
         show_row.resource_id
   and show_resource.resource_kind =
         'show'
   and show_resource.lifecycle_state =
         'active'
   and show_resource.visibility =
         'public'
  where show_row.slug = v_show_slug
  limit 1;

  if not found then
    return null;
  end if;

  select episode_row.*
  into v_episode
  from editorial.show_episodes episode_row
  join editorial.resources episode_resource
    on episode_resource.id =
         episode_row.resource_id
   and episode_resource.resource_kind =
         'show_episode'
   and episode_resource.lifecycle_state =
         'active'
   and episode_resource.visibility =
         'public'
  where episode_row.show_resource_id =
          v_show.resource_id
    and episode_row.slug =
          v_episode_slug
  limit 1;

  if not found then
    return null;
  end if;

  select publication.*
  into v_audio_publication
  from editorial.audio_episode_shared_links episode_link
  join audio.publications publication
    on publication.id =
         episode_link.audio_publication_id
   and publication.publication_kind =
         'episode'
   and publication.status =
         'published'
  join editorial.audio_show_shared_links show_link
    on show_link.audio_show_id =
         publication.show_id
   and show_link.show_resource_id =
         v_show.resource_id
  where episode_link.show_episode_resource_id =
          v_episode.resource_id
  limit 1;

  if not found then
    return null;
  end if;

  v_audio :=
    public.get_public_audio_publication_m1(
      v_audio_publication.slug
    );

  if v_audio is null
     or v_audio ->> 'publication_kind'
          <> 'episode'
     or v_audio ->> 'publication_id'
          <> v_audio_publication.id::text
  then
    return null;
  end if;

  v_canonical_path :=
    '/shows/' ||
    v_show.slug ||
    '/' ||
    v_episode.slug;

  v_audio :=
    jsonb_set(
      v_audio,
      '{canonical_path}',
      to_jsonb(v_canonical_path),
      true
    );

  v_audio :=
    jsonb_set(
      v_audio,
      '{slug}',
      to_jsonb(v_episode.slug),
      true
    );

  v_audio :=
    jsonb_set(
      v_audio,
      '{show}',
      jsonb_build_object(
        'id', v_show.resource_id,
        'resource_id',
          v_show.resource_id,
        'slug', v_show.slug,
        'title', v_show.title,
        'description',
          v_show.description
      ),
      true
    );

  return jsonb_build_object(
    'episode',
    jsonb_build_object(
      'resource_id',
        v_episode.resource_id,
      'show_resource_id',
        v_show.resource_id,
      'slug',
        v_episode.slug,
      'canonical_path',
        v_canonical_path,
      'title',
        v_episode.title,
      'summary',
        v_episode.summary,
      'episode_number',
        v_episode.episode_number
    ),
    'audio',
      v_audio
  );
end;
$function$;

revoke all
  on function public.get_public_show_episode(text,text)
  from public;

grant execute
  on function public.get_public_show_episode(text,text)
  to anon, authenticated;

comment on function public.get_public_show_episode(text,text) is
  'Public shared Show Episode resolver. Shared identity supplies the public slug and presentation; the internalized M1 resolver supplies the current safe Audio rendition.';

create or replace function public.get_public_audio_enclosure(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'audio'
as $function$
declare
  v_slug text;
  v_payload jsonb;
begin
  if p_publication_id is null then
    return null;
  end if;

  select publication.slug
  into v_slug
  from audio.publications publication
  where publication.id =
          p_publication_id
    and publication.status =
          'published'
  limit 1;

  if not found then
    return null;
  end if;

  v_payload :=
    public.get_public_audio_publication_m1(
      v_slug
    );

  if v_payload is null
     or v_payload ->> 'publication_id'
          is distinct from
          p_publication_id::text
  then
    return null;
  end if;

  return jsonb_build_object(
    'publication_id',
      p_publication_id,
    'guid',
      v_payload #>>
        '{feed,guid}',
    'enclosure_url',
      v_payload #>>
        '{feed,enclosure_url}',
    'source_url',
      v_payload #>>
        '{delivery,url}',
    'mime_type',
      v_payload #>>
        '{delivery,mime_type}',
    'byte_size',
      nullif(
        v_payload #>>
          '{delivery,byte_size}',
        ''
      )::bigint,
    'sha256',
      v_payload #>>
        '{delivery,sha256}',
    'duration_seconds',
      nullif(
        v_payload #>>
          '{delivery,duration_seconds}',
        ''
      )::numeric
  );
end;
$function$;

revoke all
  on function public.get_public_audio_enclosure(uuid)
  from public;

grant execute
  on function public.get_public_audio_enclosure(uuid)
  to anon, authenticated;

comment on function public.get_public_audio_enclosure(uuid) is
  'Stable Audio enclosure resolver by publication identity. It composes the internal M1 safety resolver so both Standalone Audio and Show Episode renditions remain eligible.';

-- ---------------------------------------------------------------------------
-- Bounded semantic Trust candidates for the Audio workbench.
-- IDs remain transport values behind the selector primitive.
-- ---------------------------------------------------------------------------

create or replace function public.list_audio_trust_attachment_candidates()
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_credits jsonb;
  v_citations jsonb;
begin
  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability(
      'edit_own_audio'
    )
    or public.current_user_has_capability(
      'edit_others_audio'
    )
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'Audio edit permission is required.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          candidate.id,
        'display_name',
          candidate.display_name,
        'credit_role',
          candidate.credit_role,
        'role_label',
          candidate.role_label
      )
      order by
        candidate.display_name,
        candidate.id
    ),
    '[]'::jsonb
  )
  into v_credits
  from (
    select
      credit.id,
      credit.display_name_snapshot
        as display_name,
      credit.credit_role,
      credit.role_label_snapshot
        as role_label
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id =
           credit.id
    where governance.credit_state =
            'active'
      and nullif(
            btrim(
              credit.display_name_snapshot
            ),
            ''
          ) is not null
  ) candidate;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
          candidate.id,
        'label',
          candidate.label,
        'source_title',
          candidate.source_title,
        'locator_label',
          candidate.locator_label
      )
      order by
        candidate.label,
        candidate.id
    ),
    '[]'::jsonb
  )
  into v_citations
  from (
    select
      citation.id,
      coalesce(
        nullif(
          btrim(citation.public_label),
          ''
        ),
        source_version.title
      ) as label,
      source_version.title
        as source_title,
      case
        when citation.locator_type =
               'whole_source'
          then 'Whole Source'
        when citation.locator_type =
               'timestamp'
          then 'Timestamp'
        when citation.locator_type =
               'timestamp_range'
          then 'Time Range'
        when citation.locator_type =
               'transcript_range'
          then 'Transcript Range'
        when citation.locator_type =
               'page'
          then 'Page'
        when citation.locator_type =
               'page_range'
          then 'Page Range'
        when citation.locator_type =
               'paragraph'
          then 'Paragraph'
        when citation.locator_type =
               'chapter'
          then 'Chapter'
        else initcap(
          replace(
            citation.locator_type,
            '_',
            ' '
          )
        )
      end as locator_label
    from editorial.citations citation
    join editorial.sources source
      on source.id =
           citation.source_id
    join editorial.source_versions source_version
      on source_version.id =
           citation.source_version_id
     and source_version.source_id =
           source.id
    where citation.citation_state =
            'active'
      and source.source_state =
            'active'
      and source.withdrawn_at is null
      and source.current_approved_version_id =
            citation.source_version_id
      and nullif(
            btrim(source_version.title),
            ''
          ) is not null
  ) candidate;

  return jsonb_build_object(
    'credits',
      v_credits,
    'citations',
      v_citations
  );
end;
$function$;

revoke all
  on function public.list_audio_trust_attachment_candidates()
  from public, anon;

grant execute
  on function public.list_audio_trust_attachment_candidates()
  to authenticated;

comment on function public.list_audio_trust_attachment_candidates() is
  'Bounded semantic Credit and Citation candidates for authenticated Audio editors. Raw identity values remain internal attachment transport and private Trust notes are excluded.';

commit;
