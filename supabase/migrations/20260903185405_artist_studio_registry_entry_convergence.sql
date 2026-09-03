-- WAKILISHA Artist Studio Registry Entry Convergence
-- Extends existing Artist Claims, MIZIZI identity resolution, and representation authority.
-- Does not create a second intake queue and does not enter the Resource lifecycle.

set check_function_bodies = on;

-- -----------------------------------------------------------------------------
-- 1. Preflight: accepted authority must exist before this migration mutates it.
-- -----------------------------------------------------------------------------
do $artist_studio_preflight$
begin
  if to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_artist_aliases') is null
     or to_regclass('public.artist_claim_requests') is null
     or to_regclass('public.artist_claim_evidence') is null
     or to_regclass('public.artist_representations') is null
     or to_regclass('public.artist_profile_presentations') is null
  then
    raise exception
      'ARTIST_STUDIO_PREFLIGHT_FAIL: required Registry or Artist Claim tables are missing';
  end if;

  if to_regprocedure('public.community_submit_artist_claim(uuid,text,text,jsonb)') is null
     or to_regprocedure('public.community_get_artist_representation_state(uuid)') is null
     or to_regprocedure('public.community_admin_get_artist_claims(text,integer)') is null
     or to_regprocedure('public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)') is null
     or to_regprocedure('public.admin_search_registry_artists(text,integer)') is null
     or to_regprocedure('public.wk_slugify_text(text)') is null
     or to_regprocedure('editorial.artist_representation_defaults(text)') is null
     or to_regprocedure('editorial.current_user_can_review_artist_claims()') is null
     or to_regprocedure('editorial.record_artist_representation_event(uuid,text,uuid,uuid,uuid,jsonb)') is null
     or to_regprocedure('editorial.sync_artist_portal_roles(uuid)') is null
  then
    raise exception
      'ARTIST_STUDIO_PREFLIGHT_FAIL: accepted Artist Claim or Registry functions are missing';
  end if;

  if to_regprocedure('public.get_artist_studio_registry_candidates(text,integer)') is not null
     or to_regprocedure('public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)') is not null
     or to_regprocedure('public.community_get_artist_management_workspace(text)') is not null
     or to_regprocedure('public.community_admin_resolve_artist_claim_existing(uuid,uuid,text,boolean,boolean,boolean,boolean)') is not null
     or to_regclass('public.artist_claim_proposed_identities') is not null
  then
    raise exception
      'ARTIST_STUDIO_PREFLIGHT_FAIL: convergence authority already exists';
  end if;
end;
$artist_studio_preflight$;

-- -----------------------------------------------------------------------------
-- 2. Extend Artist Claims with a typed proposed-identity facet.
-- -----------------------------------------------------------------------------
alter table public.artist_claim_requests
  add column claim_kind text not null default 'existing_artist';

alter table public.artist_claim_requests
  alter column artist_id drop not null;

alter table public.artist_claim_requests
  add constraint artist_claim_requests_claim_kind_check
  check (claim_kind in ('existing_artist', 'proposed_artist'));

alter table public.artist_claim_requests
  add constraint artist_claim_requests_identity_shape_check
  check (
    (claim_kind = 'existing_artist' and artist_id is not null)
    or claim_kind = 'proposed_artist'
  );

create unique index artist_claim_requests_pending_existing_identity_uidx
  on public.artist_claim_requests (claimant_user_id, artist_id)
  where status = 'pending'
    and claim_kind = 'existing_artist'
    and claimant_user_id is not null
    and artist_id is not null;

create table public.artist_claim_proposed_identities (
  claim_id uuid primary key
    references public.artist_claim_requests(id)
    on delete cascade,
  display_name text not null,
  normalized_name text not null,
  artist_type text null,
  origin_iso2 text null,
  alternate_names text[] not null default '{}'::text[],
  mizizi_fingerprint text not null,
  mizizi_assessment jsonb not null default '{}'::jsonb,
  accepted_artist_id uuid null
    references public.registry_artists(id)
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artist_claim_proposed_identity_display_name_check
    check (char_length(trim(display_name)) between 2 and 200),
  constraint artist_claim_proposed_identity_normalized_name_check
    check (char_length(trim(normalized_name)) between 2 and 200),
  constraint artist_claim_proposed_identity_artist_type_check
    check (
      artist_type is null
      or artist_type in ('solo', 'band', 'group', 'collective', 'unknown')
    ),
  constraint artist_claim_proposed_identity_origin_check
    check (
      origin_iso2 is null
      or origin_iso2 ~ '^[A-Z]{2}$'
    ),
  constraint artist_claim_proposed_identity_alternate_names_check
    check (cardinality(alternate_names) <= 20),
  constraint artist_claim_proposed_identity_fingerprint_check
    check (mizizi_fingerprint ~ '^[a-f0-9]{64}$')
);

create index artist_claim_proposed_identities_fingerprint_idx
  on public.artist_claim_proposed_identities (mizizi_fingerprint);

create index artist_claim_proposed_identities_accepted_artist_id_idx
  on public.artist_claim_proposed_identities (accepted_artist_id)
  where accepted_artist_id is not null;

alter table public.artist_claim_proposed_identities
  enable row level security;

revoke all on table public.artist_claim_proposed_identities
  from public, anon, authenticated, service_role;

create trigger artist_claim_proposed_identities_updated_at
before update on public.artist_claim_proposed_identities
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. MIZIZI Artist identity resolver.
--    Registry authority is read-only here. Provider/user assertions do not win.
-- -----------------------------------------------------------------------------
create or replace function platform_private.mizizi_resolve_artist_identity_candidates(
  p_query text,
  p_artist_type text default null,
  p_origin_iso2 text default null,
  p_limit integer default 8
)
returns table (
  artist_id uuid,
  slug text,
  display_name text,
  artist_type text,
  origin_iso2 text,
  registry_state text,
  image_url text,
  match_tier text,
  match_score numeric
)
language sql
stable
security definer
set search_path to pg_catalog, public, editorial, platform_private
as $function$
  with input as (
    select
      lower(
        regexp_replace(
          trim(coalesce(p_query, '')),
          '[[:space:]]+',
          ' ',
          'g'
        )
      ) as query_name,
      public.wk_slugify_text(p_query) as query_slug,
      nullif(lower(trim(coalesce(p_artist_type, ''))), '') as artist_type,
      nullif(upper(trim(coalesce(p_origin_iso2, ''))), '') as origin_iso2,
      least(greatest(coalesce(p_limit, 8), 1), 20) as result_limit
  ),
  alias_scores as (
    select
      alias.canonical_artist_id as artist_id,
      bool_or(
        alias.alias_slug = input.query_slug
        or lower(trim(coalesce(alias.alias_display_name, ''))) = input.query_name
      ) as exact_alias,
      max(
        greatest(
          public.similarity(
            lower(trim(coalesce(alias.alias_display_name, ''))),
            input.query_name
          ),
          public.similarity(
            alias.alias_slug,
            input.query_slug
          )
        )
      )::numeric as alias_score
    from public.registry_artist_aliases alias
    cross join input
    where coalesce(alias.status, 'active') = 'active'
      and char_length(input.query_name) >= 2
    group by alias.canonical_artist_id
  ),
  scored as (
    select
      artist.id as artist_id,
      artist.slug,
      artist.display_name,
      artist.artist_type,
      artist.origin_iso2,
      artist.status as registry_state,
      coalesce(
        presentation.profile_image_url,
        artist.public_image_url
      ) as image_url,
      (
        artist.normalized_name = input.query_name
        or artist.slug = input.query_slug
        or coalesce(alias_score.exact_alias, false)
      ) as is_exact,
      greatest(
        case
          when artist.normalized_name = input.query_name then 1.0
          when artist.slug = input.query_slug then 1.0
          else 0.0
        end,
        public.similarity(
          artist.normalized_name,
          input.query_name
        ),
        public.similarity(
          artist.slug,
          input.query_slug
        ),
        coalesce(alias_score.alias_score, 0.0)
      )::numeric as base_score,
      input.artist_type as wanted_artist_type,
      input.origin_iso2 as wanted_origin_iso2
    from public.registry_artists artist
    cross join input
    left join alias_scores alias_score
      on alias_score.artist_id = artist.id
    left join public.artist_profile_presentations presentation
      on presentation.artist_id = artist.id
    where artist.status in ('active', 'draft', 'needs_review')
      and char_length(input.query_name) >= 2
  ),
  ranked as (
    select
      scored.*,
      least(
        1.0,
        scored.base_score
        + case
            when scored.wanted_artist_type is not null
             and lower(coalesce(scored.artist_type, '')) = scored.wanted_artist_type
              then 0.04
            else 0.0
          end
        + case
            when scored.wanted_origin_iso2 is not null
             and upper(coalesce(scored.origin_iso2, '')) = scored.wanted_origin_iso2
              then 0.04
            else 0.0
          end
      )::numeric as adjusted_score
    from scored
    where scored.is_exact
       or scored.base_score >= 0.18
       or lower(scored.display_name) like '%' || (
         select query_name from input
       ) || '%'
  )
  select
    ranked.artist_id,
    ranked.slug,
    ranked.display_name,
    ranked.artist_type,
    ranked.origin_iso2,
    ranked.registry_state,
    ranked.image_url,
    case
      when ranked.is_exact then 'exact'
      when ranked.adjusted_score >= 0.72 then 'strong'
      else 'possible'
    end as match_tier,
    round(ranked.adjusted_score, 4) as match_score
  from ranked
  order by
    case
      when ranked.is_exact then 0
      when ranked.adjusted_score >= 0.72 then 1
      else 2
    end,
    ranked.adjusted_score desc,
    ranked.display_name,
    ranked.artist_id
  limit (
    select result_limit from input
  );
$function$;

revoke all on function platform_private.mizizi_resolve_artist_identity_candidates(text,text,text,integer)
  from public, anon, authenticated, service_role;

create or replace function public.get_artist_studio_registry_candidates(
  p_query text,
  p_limit integer default 8
)
returns table (
  artist_id uuid,
  slug text,
  display_name text,
  artist_type text,
  origin_iso2 text,
  registry_state text,
  public_path text,
  image_url text,
  match_tier text,
  match_score numeric
)
language sql
stable
security definer
set search_path to pg_catalog, public, editorial, platform_private
as $function$
  select
    candidate.artist_id,
    candidate.slug,
    candidate.display_name,
    candidate.artist_type,
    candidate.origin_iso2,
    candidate.registry_state,
    case
      when candidate.registry_state = 'active'
        then '/artists/' || candidate.slug
      else null
    end as public_path,
    case
      when candidate.registry_state = 'active'
        then candidate.image_url
      else null
    end as image_url,
    candidate.match_tier,
    candidate.match_score
  from platform_private.mizizi_resolve_artist_identity_candidates(
    p_query,
    null,
    null,
    least(greatest(coalesce(p_limit, 8), 1), 8)
  ) candidate
  where candidate.registry_state in ('active', 'draft', 'needs_review');
$function$;

revoke all on function public.get_artist_studio_registry_candidates(text,integer)
  from public;
grant execute on function public.get_artist_studio_registry_candidates(text,integer)
  to anon, authenticated, service_role;

-- Legacy similarity search leaked broader Registry states through an accidental API boundary.
revoke execute on function public.find_similar_artists(text,text,real,integer)
  from public, anon, authenticated;
revoke execute on function public.find_similar_artists(text,text,numeric,integer)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Existing Artist claims: allow bounded non-public identity claims and make
--    retries idempotent rather than manufacturing duplicate review work.
-- -----------------------------------------------------------------------------
create or replace function public.community_submit_artist_claim(
  p_artist_id uuid,
  p_claimant_role text,
  p_statement text,
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text := lower(trim(coalesce(p_claimant_role, '')));
  v_statement text := trim(coalesce(p_statement, ''));
  v_claim_id uuid;
  v_evidence jsonb;
  v_type text;
  v_reference text;
  v_note text;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id = p_artist_id
      and artist.status in ('active', 'draft', 'needs_review')
  ) then
    raise exception 'artist_not_claimable';
  end if;

  if v_role not in ('artist', 'manager', 'label', 'publicist', 'team_member', 'other') then
    raise exception 'invalid_claimant_role';
  end if;

  if char_length(v_statement) < 10
     or char_length(v_statement) > 4000
  then
    raise exception 'invalid_claim_statement';
  end if;

  if coalesce(jsonb_typeof(p_evidence), 'null') <> 'array' then
    raise exception 'claim_evidence_must_be_array';
  end if;

  if jsonb_array_length(p_evidence) > 10 then
    raise exception 'too_many_claim_evidence_items';
  end if;

  if exists (
    select 1
    from public.artist_representations representation
    where representation.artist_id = p_artist_id
      and representation.user_id = v_actor
      and representation.status in ('pending', 'active')
  ) then
    raise exception 'representation_already_exists';
  end if;

  select claim.id
  into v_claim_id
  from public.artist_claim_requests claim
  where claim.artist_id = p_artist_id
    and claim.claimant_user_id = v_actor
    and claim.status = 'pending'
  order by claim.submitted_at desc
  limit 1;

  if v_claim_id is not null then
    return jsonb_build_object(
      'claim_id', v_claim_id,
      'artist_id', p_artist_id,
      'status', 'pending',
      'claimant_role', v_role,
      'idempotent_replay', true
    );
  end if;

  insert into public.artist_claim_requests (
    artist_id,
    claimant_user_id,
    claimant_role,
    statement,
    claim_kind
  )
  values (
    p_artist_id,
    v_actor,
    v_role,
    v_statement,
    'existing_artist'
  )
  returning id into v_claim_id;

  for v_evidence in
    select value
    from jsonb_array_elements(p_evidence)
  loop
    v_type := lower(trim(coalesce(v_evidence->>'type', '')));
    v_reference := nullif(trim(coalesce(v_evidence->>'reference', '')), '');
    v_note := nullif(trim(coalesce(v_evidence->>'note', '')), '');

    if v_type not in (
      'official_website',
      'official_social',
      'business_email',
      'label_or_distributor',
      'public_announcement',
      'other'
    ) then
      raise exception 'invalid_claim_evidence_type';
    end if;

    if v_reference is null and v_note is null then
      raise exception 'claim_evidence_requires_content';
    end if;

    if v_reference is not null and char_length(v_reference) > 2048 then
      raise exception 'claim_evidence_reference_too_long';
    end if;

    if v_note is not null and char_length(v_note) > 2000 then
      raise exception 'claim_evidence_note_too_long';
    end if;

    insert into public.artist_claim_evidence (
      claim_id,
      evidence_type,
      reference,
      note
    )
    values (
      v_claim_id,
      v_type,
      v_reference,
      v_note
    );
  end loop;

  perform editorial.record_artist_representation_event(
    p_artist_id,
    'claim_submitted',
    v_claim_id,
    null,
    v_actor,
    jsonb_build_object('claimant_role', v_role)
  );

  perform editorial.sync_artist_portal_roles(v_actor);

  return jsonb_build_object(
    'claim_id', v_claim_id,
    'artist_id', p_artist_id,
    'status', 'pending',
    'claimant_role', v_role,
    'idempotent_replay', false
  );
end;
$function$;

-- -----------------------------------------------------------------------------
-- 5. Proposed new Artist claims. Submission does not create Registry truth.
-- -----------------------------------------------------------------------------
create or replace function public.community_submit_new_artist_claim(
  p_display_name text,
  p_artist_type text,
  p_origin_iso2 text,
  p_alternate_names text[],
  p_claimant_role text,
  p_statement text,
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial, platform_private, extensions
as $function$
declare
  v_actor uuid := auth.uid();
  v_display_name text := regexp_replace(trim(coalesce(p_display_name, '')), '[[:space:]]+', ' ', 'g');
  v_normalized_name text;
  v_artist_type text := nullif(lower(trim(coalesce(p_artist_type, ''))), '');
  v_origin_iso2 text := nullif(upper(trim(coalesce(p_origin_iso2, ''))), '');
  v_role text := lower(trim(coalesce(p_claimant_role, '')));
  v_statement text := trim(coalesce(p_statement, ''));
  v_alternate_names text[] := '{}'::text[];
  v_alt text;
  v_fingerprint text;
  v_claim_id uuid;
  v_evidence jsonb;
  v_type text;
  v_reference text;
  v_note text;
  v_candidate_count integer := 0;
  v_strong_match_count integer := 0;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if char_length(v_display_name) < 2
     or char_length(v_display_name) > 200
  then
    raise exception 'invalid_artist_display_name';
  end if;

  v_normalized_name := lower(v_display_name);

  if v_artist_type is not null
     and v_artist_type not in ('solo', 'band', 'group', 'collective', 'unknown')
  then
    raise exception 'invalid_artist_type';
  end if;

  if v_origin_iso2 is not null
     and v_origin_iso2 !~ '^[A-Z]{2}$'
  then
    raise exception 'invalid_artist_origin';
  end if;

  if v_role not in ('artist', 'manager', 'label', 'publicist', 'team_member', 'other') then
    raise exception 'invalid_claimant_role';
  end if;

  if char_length(v_statement) < 10
     or char_length(v_statement) > 4000
  then
    raise exception 'invalid_claim_statement';
  end if;

  if coalesce(jsonb_typeof(p_evidence), 'null') <> 'array' then
    raise exception 'claim_evidence_must_be_array';
  end if;

  if jsonb_array_length(p_evidence) > 10 then
    raise exception 'too_many_claim_evidence_items';
  end if;

  if cardinality(coalesce(p_alternate_names, '{}'::text[])) > 20 then
    raise exception 'too_many_artist_alternate_names';
  end if;

  foreach v_alt in array coalesce(p_alternate_names, '{}'::text[])
  loop
    v_alt := regexp_replace(trim(coalesce(v_alt, '')), '[[:space:]]+', ' ', 'g');
    if char_length(v_alt) > 200 then
      raise exception 'artist_alternate_name_too_long';
    end if;
    if char_length(v_alt) >= 2
       and lower(v_alt) <> v_normalized_name
       and not exists (
         select 1
         from unnest(v_alternate_names) existing(value)
         where lower(existing.value) = lower(v_alt)
       )
    then
      v_alternate_names := array_append(v_alternate_names, v_alt);
    end if;
  end loop;

  select
    count(*)::integer,
    count(*) filter (
      where candidate.match_tier in ('exact', 'strong')
    )::integer
  into
    v_candidate_count,
    v_strong_match_count
  from platform_private.mizizi_resolve_artist_identity_candidates(
    v_display_name,
    v_artist_type,
    v_origin_iso2,
    8
  ) candidate;

  if v_strong_match_count > 0 then
    raise exception 'artist_registry_match_found';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        v_normalized_name,
        coalesce(v_artist_type, ''),
        coalesce(v_origin_iso2, ''),
        array_to_string(
          array(
            select lower(value)
            from unnest(v_alternate_names) value
            order by lower(value)
          ),
          ','
        )
      ),
      'sha256'
    ),
    'hex'
  );

  select claim.id
  into v_claim_id
  from public.artist_claim_requests claim
  join public.artist_claim_proposed_identities proposal
    on proposal.claim_id = claim.id
  where claim.claimant_user_id = v_actor
    and claim.claim_kind = 'proposed_artist'
    and claim.status = 'pending'
    and proposal.mizizi_fingerprint = v_fingerprint
  order by claim.submitted_at desc
  limit 1;

  if v_claim_id is not null then
    return jsonb_build_object(
      'claim_id', v_claim_id,
      'status', 'pending',
      'claim_kind', 'proposed_artist',
      'idempotent_replay', true
    );
  end if;

  insert into public.artist_claim_requests (
    artist_id,
    claimant_user_id,
    claimant_role,
    statement,
    claim_kind
  )
  values (
    null,
    v_actor,
    v_role,
    v_statement,
    'proposed_artist'
  )
  returning id into v_claim_id;

  insert into public.artist_claim_proposed_identities (
    claim_id,
    display_name,
    normalized_name,
    artist_type,
    origin_iso2,
    alternate_names,
    mizizi_fingerprint,
    mizizi_assessment
  )
  values (
    v_claim_id,
    v_display_name,
    v_normalized_name,
    v_artist_type,
    v_origin_iso2,
    v_alternate_names,
    v_fingerprint,
    jsonb_build_object(
      'rule_version', 'artist_identity_v1',
      'candidate_count', v_candidate_count,
      'strong_match_count', v_strong_match_count,
      'resolved_at', now()
    )
  );

  for v_evidence in
    select value
    from jsonb_array_elements(p_evidence)
  loop
    v_type := lower(trim(coalesce(v_evidence->>'type', '')));
    v_reference := nullif(trim(coalesce(v_evidence->>'reference', '')), '');
    v_note := nullif(trim(coalesce(v_evidence->>'note', '')), '');

    if v_type not in (
      'official_website',
      'official_social',
      'business_email',
      'label_or_distributor',
      'public_announcement',
      'other'
    ) then
      raise exception 'invalid_claim_evidence_type';
    end if;

    if v_reference is null and v_note is null then
      raise exception 'claim_evidence_requires_content';
    end if;

    if v_reference is not null and char_length(v_reference) > 2048 then
      raise exception 'claim_evidence_reference_too_long';
    end if;

    if v_note is not null and char_length(v_note) > 2000 then
      raise exception 'claim_evidence_note_too_long';
    end if;

    insert into public.artist_claim_evidence (
      claim_id,
      evidence_type,
      reference,
      note
    )
    values (
      v_claim_id,
      v_type,
      v_reference,
      v_note
    );
  end loop;

  return jsonb_build_object(
    'claim_id', v_claim_id,
    'status', 'pending',
    'claim_kind', 'proposed_artist',
    'idempotent_replay', false,
    'mizizi_fingerprint', v_fingerprint
  );
end;
$function$;

revoke all on function public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)
  from public, anon;
grant execute on function public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Representation state now supports active, draft, and needs-review Artist
--    identities without making those Registry rows public.
-- -----------------------------------------------------------------------------
create or replace function public.community_get_artist_representation_state(
  p_artist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public, editorial
as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select jsonb_build_object(
    'artist',
      jsonb_build_object(
        'id', artist.id,
        'slug', artist.slug,
        'display_name', artist.display_name,
        'status', artist.status
      ),
    'latest_claim',
      (
        select jsonb_build_object(
          'id', claim.id,
          'claimant_role', claim.claimant_role,
          'status', claim.status,
          'statement', claim.statement,
          'submitted_at', claim.submitted_at,
          'decided_at', claim.decided_at,
          'decision_reason', claim.decision_reason,
          'evidence',
            (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', evidence.id,
                    'type', evidence.evidence_type,
                    'reference', evidence.reference,
                    'note', evidence.note
                  )
                  order by evidence.created_at
                ),
                '[]'::jsonb
              )
              from public.artist_claim_evidence evidence
              where evidence.claim_id = claim.id
            )
        )
        from public.artist_claim_requests claim
        where claim.artist_id = artist.id
          and claim.claimant_user_id = v_actor
        order by claim.submitted_at desc
        limit 1
      ),
    'representation',
      (
        select jsonb_build_object(
          'id', representation.id,
          'role', representation.representation_role,
          'status', representation.status,
          'permissions',
            jsonb_build_object(
              'profile', representation.can_manage_profile,
              'releases', representation.can_submit_releases,
              'updates', representation.can_post_updates,
              'team', representation.can_manage_team
            ),
          'invited_at', representation.invited_at,
          'accepted_at', representation.accepted_at,
          'verified_at', representation.verified_at
        )
        from public.artist_representations representation
        where representation.artist_id = artist.id
          and representation.user_id = v_actor
          and representation.status in ('pending', 'active')
        order by representation.created_at desc
        limit 1
      ),
    'can_claim',
      (
        artist.status in ('active', 'draft', 'needs_review')
        and not exists (
          select 1
          from public.artist_representations representation
          where representation.artist_id = artist.id
            and representation.user_id = v_actor
            and representation.status in ('pending', 'active')
        )
        and not exists (
          select 1
          from public.artist_claim_requests claim
          where claim.artist_id = artist.id
            and claim.claimant_user_id = v_actor
            and claim.status = 'pending'
        )
      )
  )
  into v_result
  from public.registry_artists artist
  where artist.id = p_artist_id
    and artist.status in ('active', 'draft', 'needs_review');

  if v_result is null then
    raise exception 'artist_not_found';
  end if;

  return v_result;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 7. Management workspace: identity visibility is representation-scoped.
-- -----------------------------------------------------------------------------
create or replace function public.community_get_artist_management_workspace(
  p_artist_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public, editorial
as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select jsonb_build_object(
    'artist',
      jsonb_build_object(
        'id', artist.id,
        'slug', artist.slug,
        'name', artist.display_name,
        'status', artist.status,
        'image_url',
          case
            when artist.status = 'active'
              then coalesce(presentation.profile_image_url, artist.public_image_url)
            else presentation.profile_image_url
          end
      ),
    'presentation',
      case
        when presentation.artist_id is null then null
        else jsonb_build_object(
          'bio', presentation.bio,
          'profile_image_url', presentation.profile_image_url,
          'hero_image_url', presentation.hero_image_url,
          'website_url', presentation.website_url,
          'public_email', presentation.public_email,
          'social_links', presentation.social_links,
          'updated_at', presentation.updated_at
        )
      end,
    'representation',
      jsonb_build_object(
        'id', representation.id,
        'role', representation.representation_role,
        'status', representation.status,
        'permissions',
          jsonb_build_object(
            'profile', representation.can_manage_profile,
            'releases', representation.can_submit_releases,
            'updates', representation.can_post_updates,
            'team', representation.can_manage_team
          ),
        'invited_at', representation.invited_at,
        'accepted_at', representation.accepted_at,
        'verified_at', representation.verified_at
      )
  )
  into v_result
  from public.registry_artists artist
  join public.artist_representations representation
    on representation.artist_id = artist.id
   and representation.user_id = v_actor
   and representation.status = 'active'
  left join public.artist_profile_presentations presentation
    on presentation.artist_id = artist.id
  where artist.slug = trim(coalesce(p_artist_slug, ''))
    and artist.status in ('active', 'draft', 'needs_review')
    and (
      representation.can_manage_profile
      or representation.can_submit_releases
      or representation.can_post_updates
      or representation.can_manage_team
    )
  order by representation.created_at desc
  limit 1;

  if v_result is null then
    raise exception 'artist_management_not_authorized';
  end if;

  return v_result;
end;
$function$;

revoke all on function public.community_get_artist_management_workspace(text)
  from public, anon;
grant execute on function public.community_get_artist_management_workspace(text)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. Artist Claim review reads both existing identities and proposed identities.
-- -----------------------------------------------------------------------------
create or replace function public.community_admin_get_artist_claims(
  p_status text default 'pending',
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path to pg_catalog, public, editorial
as $function$
declare
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_result jsonb;
begin
  if not editorial.current_user_can_review_artist_claims() then
    raise exception 'insufficient_privilege';
  end if;

  if v_status is not null
     and v_status not in ('pending', 'verified', 'rejected', 'withdrawn', 'revoked')
  then
    raise exception 'invalid_claim_status';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', claim.id,
        'claim_kind', claim.claim_kind,
        'status', claim.status,
        'claimant_role', claim.claimant_role,
        'statement', claim.statement,
        'submitted_at', claim.submitted_at,
        'decided_at', claim.decided_at,
        'decision_reason', claim.decision_reason,
        'artist',
          case
            when artist.id is null then null
            else jsonb_build_object(
              'id', artist.id,
              'slug', artist.slug,
              'display_name', artist.display_name
            )
          end,
        'proposed_identity',
          case
            when proposal.claim_id is null then null
            else jsonb_build_object(
              'display_name', proposal.display_name,
              'artist_type', proposal.artist_type,
              'origin_iso2', proposal.origin_iso2,
              'alternate_names', proposal.alternate_names,
              'mizizi_fingerprint', proposal.mizizi_fingerprint,
              'mizizi_assessment', proposal.mizizi_assessment,
              'accepted_artist_id', proposal.accepted_artist_id
            )
          end,
        'claimant',
          jsonb_build_object(
            'user_id', claim.claimant_user_id,
            'username', profile.username,
            'display_name', profile.display_name
          ),
        'evidence',
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', evidence.id,
                  'type', evidence.evidence_type,
                  'reference', evidence.reference,
                  'note', evidence.note
                )
                order by evidence.created_at
              ),
              '[]'::jsonb
            )
            from public.artist_claim_evidence evidence
            where evidence.claim_id = claim.id
          )
      )
      order by claim.submitted_at asc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select *
    from public.artist_claim_requests claim
    where v_status is null
       or claim.status = v_status
    order by claim.submitted_at asc
    limit v_limit
  ) claim
  left join public.registry_artists artist
    on artist.id = claim.artist_id
  left join public.artist_claim_proposed_identities proposal
    on proposal.claim_id = claim.id
  left join public.user_profiles profile
    on profile.user_id = claim.claimant_user_id;

  return v_result;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 9. Review decision. Proposed identity becomes Registry truth only here.
-- -----------------------------------------------------------------------------
create or replace function public.community_admin_decide_artist_claim(
  p_claim_id uuid,
  p_decision text,
  p_reason text,
  p_can_manage_profile boolean default null,
  p_can_submit_releases boolean default null,
  p_can_post_updates boolean default null,
  p_can_manage_team boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial, platform_private
as $function$
declare
  v_actor uuid := auth.uid();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_claim public.artist_claim_requests%rowtype;
  v_proposal public.artist_claim_proposed_identities%rowtype;
  v_defaults record;
  v_representation_id uuid;
  v_profile boolean;
  v_releases boolean;
  v_updates boolean;
  v_team boolean;
  v_artist_id uuid;
  v_artist_slug text;
  v_match_count integer := 0;
  v_alt text;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not editorial.current_user_can_review_artist_claims() then
    raise exception 'insufficient_privilege';
  end if;

  if v_decision not in ('verified', 'rejected') then
    raise exception 'invalid_claim_decision';
  end if;

  if char_length(v_reason) < 3
     or char_length(v_reason) > 4000
  then
    raise exception 'invalid_claim_decision_reason';
  end if;

  select *
  into v_claim
  from public.artist_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim_not_found';
  end if;

  if v_claim.status <> 'pending' then
    raise exception 'claim_not_pending';
  end if;

  if v_claim.claimant_user_id is null then
    raise exception 'claimant_account_missing';
  end if;

  if v_decision = 'rejected' then
    update public.artist_claim_requests
    set
      status = 'rejected',
      decided_at = now(),
      decided_by = v_actor,
      decision_reason = v_reason,
      updated_at = now()
    where id = v_claim.id;

    if v_claim.artist_id is not null then
      perform editorial.record_artist_representation_event(
        v_claim.artist_id,
        'claim_rejected',
        v_claim.id,
        null,
        v_claim.claimant_user_id,
        jsonb_build_object('reason', v_reason)
      );
    end if;

    insert into public.admin_audit_events (
      actor_user_id,
      target_user_id,
      event_type,
      target_table,
      target_record_id,
      message,
      metadata
    )
    values (
      v_actor,
      v_claim.claimant_user_id,
      'artist_claim_rejected',
      'artist_claim_requests',
      v_claim.id::text,
      v_reason,
      jsonb_build_object(
        'artist_id', v_claim.artist_id,
        'claim_kind', v_claim.claim_kind
      )
    );

    perform editorial.sync_artist_portal_roles(v_claim.claimant_user_id);

    return jsonb_build_object(
      'claim_id', v_claim.id,
      'status', 'rejected',
      'claim_kind', v_claim.claim_kind
    );
  end if;

  if v_claim.claim_kind = 'proposed_artist'
     and v_claim.artist_id is null
  then
    select *
    into v_proposal
    from public.artist_claim_proposed_identities proposal
    where proposal.claim_id = v_claim.id
    for update;

    if not found then
      raise exception 'proposed_artist_identity_missing';
    end if;

    select count(*)::integer
    into v_match_count
    from platform_private.mizizi_resolve_artist_identity_candidates(
      v_proposal.display_name,
      v_proposal.artist_type,
      v_proposal.origin_iso2,
      8
    ) candidate
    where candidate.match_tier in ('exact', 'strong');

    if v_match_count > 0 then
      raise exception 'artist_identity_resolution_required';
    end if;

    v_artist_slug := public.wk_slugify_text(v_proposal.display_name);

    if char_length(v_artist_slug) < 2 then
      raise exception 'artist_slug_invalid';
    end if;

    if exists (
      select 1
      from public.registry_artists artist
      where artist.slug = v_artist_slug
    )
       or exists (
         select 1
         from public.registry_artist_aliases alias
         where alias.alias_slug = v_artist_slug
           and coalesce(alias.status, 'active') = 'active'
       )
    then
      raise exception 'artist_slug_conflict';
    end if;

    insert into public.registry_artists (
      slug,
      display_name,
      normalized_name,
      artist_type,
      origin_iso2,
      origin_confidence,
      status,
      metadata
    )
    values (
      v_artist_slug,
      v_proposal.display_name,
      v_proposal.normalized_name,
      v_proposal.artist_type,
      v_proposal.origin_iso2,
      case when v_proposal.origin_iso2 is null then null else 1.0 end,
      'active',
      jsonb_build_object(
        'source', 'artist_claim',
        'claim_id', v_claim.id,
        'approved_by', v_actor
      )
    )
    returning id into v_artist_id;

    foreach v_alt in array v_proposal.alternate_names
    loop
      if char_length(public.wk_slugify_text(v_alt)) >= 2 then
        insert into public.registry_artist_aliases (
          alias_slug,
          canonical_artist_id,
          alias_display_name,
          confidence,
          source,
          created_by,
          notes,
          status
        )
        values (
          public.wk_slugify_text(v_alt),
          v_artist_id,
          v_alt,
          100,
          'manual',
          v_actor::text,
          'Accepted from reviewed Artist claim ' || v_claim.id::text,
          'active'
        )
        on conflict (alias_slug, canonical_artist_id)
        do nothing;
      end if;
    end loop;

    update public.artist_claim_proposed_identities
    set
      accepted_artist_id = v_artist_id,
      updated_at = now()
    where claim_id = v_claim.id;

    update public.artist_claim_requests
    set
      artist_id = v_artist_id,
      updated_at = now()
    where id = v_claim.id;

    v_claim.artist_id := v_artist_id;

    insert into public.registry_canonical_write_events (
      registry_entity_type,
      registry_entity_id,
      source_suggestion_id,
      source_table,
      field_name,
      target_path,
      before_value,
      after_value,
      action,
      status,
      actor
    )
    values (
      'artist',
      v_artist_id::text,
      v_claim.id::text,
      'artist_claim_proposed_identities',
      'identity',
      'registry_artists',
      null,
      jsonb_build_object(
        'id', v_artist_id,
        'slug', v_artist_slug,
        'display_name', v_proposal.display_name,
        'artist_type', v_proposal.artist_type,
        'origin_iso2', v_proposal.origin_iso2,
        'status', 'active'
      ),
      'create_from_artist_claim',
      'applied',
      v_actor::text
    );
  end if;

  if v_claim.artist_id is null then
    raise exception 'artist_identity_resolution_required';
  end if;

  select *
  into v_defaults
  from editorial.artist_representation_defaults(v_claim.claimant_role);

  v_profile := coalesce(p_can_manage_profile, v_defaults.can_manage_profile);
  v_releases := coalesce(p_can_submit_releases, v_defaults.can_submit_releases);
  v_updates := coalesce(p_can_post_updates, v_defaults.can_post_updates);
  v_team := coalesce(p_can_manage_team, v_defaults.can_manage_team);

  select representation.id
  into v_representation_id
  from public.artist_representations representation
  where representation.artist_id = v_claim.artist_id
    and representation.user_id = v_claim.claimant_user_id
    and representation.status in ('pending', 'active')
  order by representation.created_at desc
  limit 1
  for update;

  if v_representation_id is null then
    insert into public.artist_representations (
      artist_id,
      user_id,
      representation_role,
      status,
      source_claim_id,
      can_manage_profile,
      can_submit_releases,
      can_post_updates,
      can_manage_team,
      accepted_at,
      verified_by,
      verified_at
    )
    values (
      v_claim.artist_id,
      v_claim.claimant_user_id,
      v_claim.claimant_role,
      'active',
      v_claim.id,
      v_profile,
      v_releases,
      v_updates,
      v_team,
      now(),
      v_actor,
      now()
    )
    returning id into v_representation_id;
  else
    update public.artist_representations
    set
      representation_role = v_claim.claimant_role,
      status = 'active',
      source_claim_id = v_claim.id,
      can_manage_profile = v_profile,
      can_submit_releases = v_releases,
      can_post_updates = v_updates,
      can_manage_team = v_team,
      accepted_at = coalesce(accepted_at, now()),
      verified_by = v_actor,
      verified_at = now(),
      revoked_by = null,
      revoked_at = null,
      revocation_reason = null,
      updated_at = now()
    where id = v_representation_id;
  end if;

  update public.artist_claim_requests
  set
    status = 'verified',
    decided_at = now(),
    decided_by = v_actor,
    decision_reason = v_reason,
    updated_at = now()
  where id = v_claim.id;

  perform editorial.record_artist_representation_event(
    v_claim.artist_id,
    'claim_verified',
    v_claim.id,
    v_representation_id,
    v_claim.claimant_user_id,
    jsonb_build_object(
      'reason', v_reason,
      'role', v_claim.claimant_role,
      'permissions', jsonb_build_object(
        'profile', v_profile,
        'releases', v_releases,
        'updates', v_updates,
        'team', v_team
      )
    )
  );

  insert into public.admin_audit_events (
    actor_user_id,
    target_user_id,
    event_type,
    target_table,
    target_record_id,
    message,
    metadata
  )
  values (
    v_actor,
    v_claim.claimant_user_id,
    'artist_claim_verified',
    'artist_claim_requests',
    v_claim.id::text,
    v_reason,
    jsonb_build_object(
      'artist_id', v_claim.artist_id,
      'claim_kind', v_claim.claim_kind,
      'representation_id', v_representation_id,
      'role', v_claim.claimant_role,
      'permissions', jsonb_build_object(
        'profile', v_profile,
        'releases', v_releases,
        'updates', v_updates,
        'team', v_team
      )
    )
  );

  perform editorial.sync_artist_portal_roles(v_claim.claimant_user_id);

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'status', 'verified',
    'claim_kind', v_claim.claim_kind,
    'artist_id', v_claim.artist_id,
    'artist_status', (
      select artist.status
      from public.registry_artists artist
      where artist.id = v_claim.artist_id
    ),
    'representation_id', v_representation_id,
    'permissions', jsonb_build_object(
      'profile', v_profile,
      'releases', v_releases,
      'updates', v_updates,
      'team', v_team
    )
  );
end;
$function$;

create or replace function public.community_admin_resolve_artist_claim_existing(
  p_claim_id uuid,
  p_artist_id uuid,
  p_reason text,
  p_can_manage_profile boolean default null,
  p_can_submit_releases boolean default null,
  p_can_post_updates boolean default null,
  p_can_manage_team boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial
as $function$
declare
  v_actor uuid := auth.uid();
  v_claim public.artist_claim_requests%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not editorial.current_user_can_review_artist_claims() then
    raise exception 'insufficient_privilege';
  end if;

  if char_length(v_reason) < 3
     or char_length(v_reason) > 4000
  then
    raise exception 'invalid_claim_decision_reason';
  end if;

  select *
  into v_claim
  from public.artist_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim_not_found';
  end if;

  if v_claim.status <> 'pending'
     or v_claim.claim_kind <> 'proposed_artist'
  then
    raise exception 'claim_not_resolvable';
  end if;

  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id = p_artist_id
      and artist.status in ('active', 'draft', 'needs_review')
  ) then
    raise exception 'artist_not_resolvable';
  end if;

  update public.artist_claim_requests
  set
    artist_id = p_artist_id,
    updated_at = now()
  where id = v_claim.id;

  update public.artist_claim_proposed_identities
  set
    accepted_artist_id = p_artist_id,
    updated_at = now()
  where claim_id = v_claim.id;

  v_result := public.community_admin_decide_artist_claim(
    v_claim.id,
    'verified',
    v_reason,
    p_can_manage_profile,
    p_can_submit_releases,
    p_can_post_updates,
    p_can_manage_team
  );

  return v_result || jsonb_build_object(
    'resolution', 'existing_artist',
    'artist_id', p_artist_id
  );
end;
$function$;

revoke all on function public.community_admin_resolve_artist_claim_existing(uuid,uuid,text,boolean,boolean,boolean,boolean)
  from public, anon;
grant execute on function public.community_admin_resolve_artist_claim_existing(uuid,uuid,text,boolean,boolean,boolean,boolean)
  to authenticated, service_role;

-- Existing Admin claim functions keep their explicit reviewer capability checks.
revoke all on function public.community_admin_get_artist_claims(text,integer)
  from public, anon;
grant execute on function public.community_admin_get_artist_claims(text,integer)
  to authenticated, service_role;

revoke all on function public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)
  from public, anon;
grant execute on function public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)
  to authenticated, service_role;

-- Existing claim submission and representation state stay authenticated-only.
revoke all on function public.community_submit_artist_claim(uuid,text,text,jsonb)
  from public, anon;
grant execute on function public.community_submit_artist_claim(uuid,text,text,jsonb)
  to authenticated, service_role;

revoke all on function public.community_get_artist_representation_state(uuid)
  from public, anon;
grant execute on function public.community_get_artist_representation_state(uuid)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. Migration-local proof.
-- -----------------------------------------------------------------------------
do $artist_studio_convergence_proof$
declare
  v_definition text;
begin
  if to_regclass('public.artist_claim_proposed_identities') is null
     or to_regprocedure('platform_private.mizizi_resolve_artist_identity_candidates(text,text,text,integer)') is null
     or to_regprocedure('public.get_artist_studio_registry_candidates(text,integer)') is null
     or to_regprocedure('public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)') is null
     or to_regprocedure('public.community_get_artist_management_workspace(text)') is null
     or to_regprocedure('public.community_admin_resolve_artist_claim_existing(uuid,uuid,text,boolean,boolean,boolean,boolean)') is null
  then
    raise exception
      'ARTIST_STUDIO_MIGRATION_PROOF_FAIL: convergence authority is incomplete';
  end if;

  if not has_function_privilege(
       'anon',
       'public.get_artist_studio_registry_candidates(text,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_artist_studio_registry_candidates(text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'ARTIST_STUDIO_MIGRATION_PROOF_FAIL: public discovery or authenticated commit grants are wrong';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.mizizi_resolve_artist_identity_candidates(text,text,text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.mizizi_resolve_artist_identity_candidates(text,text,text,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'ARTIST_STUDIO_MIGRATION_PROOF_FAIL: private MIZIZI resolver leaked through API roles';
  end if;

  select pg_get_functiondef(
    'public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)'::regprocedure
  ) into v_definition;

  if v_definition ~* 'insert[[:space:]]+into[[:space:]]+public\\.registry_artists'
     or v_definition ~* 'insert[[:space:]]+into[[:space:]]+public\\.registry_review_items'
  then
    raise exception
      'ARTIST_STUDIO_MIGRATION_PROOF_FAIL: submission mutates Registry truth or generic review queue';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and (
        table_name like 'artist_registration%'
        or table_name like 'artist_intake%'
      )
  ) then
    raise exception
      'ARTIST_STUDIO_MIGRATION_PROOF_FAIL: second Artist intake queue introduced';
  end if;

  raise notice 'ARTIST_STUDIO_REGISTRY_ENTRY_CONVERGENCE_MIGRATION_PASS';
end;
$artist_studio_convergence_proof$;
