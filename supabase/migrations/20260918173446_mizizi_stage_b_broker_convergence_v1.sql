-- MIZIZI Slice 3 Stage B: typed stewardship broker convergence.
-- Generated migration identity: 20260918173446_mizizi_stage_b_broker_convergence_v1.sql
--
-- Stage B deliberately preserves the current JIT postgres transport and active
-- System Actor binding. It removes caller-side mutation authority from run.ts by
-- completing the typed exact-grant broker for the four remaining stewardship
-- operation classes. Transport cutover to mizizi_executor is Stage C.

do $preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260918120331'
      and name='mizizi_executor_foundation_v1'
  ) then
    raise exception 'STOP: Stage A executor foundation is required before Stage B';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from <= now()
      and expires_at > now()
      and revoked_at is null
  ) then
    raise exception 'STOP: Stage B requires zero active MIZIZI standing grants';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at > now()
      and revoked_at is null
      and consumed_at is null
  ) then
    raise exception 'STOP: Stage B requires zero active MIZIZI exact grants';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='active'
  ) then
    raise exception 'STOP: Stage B requires the current postgres binding to remain active';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='mizizi_executor'
      and status='disabled'
  ) then
    raise exception 'STOP: Stage B requires the future mizizi_executor binding to remain disabled';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.release_taxonomy.repair',
      'registry.chart_track_slug.synchronize'
    )
      and operation_version=1
      and enabled
  ) then
    raise exception 'STOP: Stage A stewardship operations must be disabled at Stage B entry';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'canonicalize_registry_track_slug',
    'Canonicalize Registry Track slug',
    'Allow MIZIZI to canonicalize one Track slug and repair its exact current projection pointers through a typed operation.',
    'registry'
  ),
  (
    'canonicalize_registry_release_slug',
    'Canonicalize Registry Release slug',
    'Allow MIZIZI to canonicalize one Release slug and repair its exact current projection pointers through a typed operation.',
    'registry'
  );

insert into platform_private.registry_operation_types (
  operation_key,
  operation_version,
  capability_key,
  risk_class,
  allowed_subject_types,
  requires_existing_target,
  max_targets,
  max_rows_ceiling,
  max_grant_ttl_seconds,
  requires_human_approval,
  requires_verifier,
  enabled,
  description
)
values
  (
    'registry.track_slug.canonicalize',
    1,
    'canonicalize_registry_track_slug',
    'medium',
    array['track']::text[],
    true,
    1,
    1,
    300,
    false,
    true,
    false,
    'Canonicalize one active Track slug and repair exact current Track projection pointers atomically.'
  ),
  (
    'registry.release_slug.canonicalize',
    1,
    'canonicalize_registry_release_slug',
    'medium',
    array['release']::text[],
    true,
    1,
    1,
    300,
    false,
    true,
    false,
    'Canonicalize one active Release slug and repair exact current Release projection pointers atomically.'
  );

create or replace function mizizi_private.assert_executor_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $$
begin
  if session_user not in ('postgres','mizizi_executor') then
    raise exception
      using errcode='42501',
            message='Approved MIZIZI database executor session is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='mizizi'
      and actor.status='active'
  ) then
    raise exception
      using errcode='42501',
            message='MIZIZI System Actor is not active.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='mizizi'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception
      using errcode='42501',
            message='Current executor is not the active MIZIZI binding.';
  end if;
end
$$;

create function mizizi_private.normalize_identity_text_v1(
  p_value text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          normalize(coalesce(p_value,''), NFKD),
          U&'[\0300-\036F]',
          '',
          'g'
        ),
        '&amp;',
        '&',
        'gi'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  )
$$;

create function mizizi_private.slugify_identity_v1(
  p_value text
)
returns text
language sql
immutable
set search_path = pg_catalog, mizizi_private
as $$
  select trim(
    both '-' from
    regexp_replace(
      regexp_replace(
        lower(
          mizizi_private.normalize_identity_text_v1(p_value)
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-+',
      '-',
      'g'
    )
  )
$$;

create function mizizi_private.track_slug_candidate_v1(
  p_track_id uuid
)
returns table (
  track_id uuid,
  current_slug text,
  proposed_slug text,
  primary_artist_slug text,
  strong_noise boolean,
  expected_state_fingerprint text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_track public.registry_tracks%rowtype;
  v_primary_artist_slug text;
  v_identity_title text;
  v_fragment text;
  v_fragment_slug text;
  v_proposed text;
  v_strong_noise boolean := false;
begin
  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id
    and track.status='active';

  if not found then
    raise exception using errcode='P0002',
      message='Active Registry Track not found.';
  end if;

  select credit.artist_slug
  into v_primary_artist_slug
  from public.registry_track_artists credit
  where credit.track_id=v_track.id
    and credit.status='active'
    and credit.is_primary is true
    and nullif(btrim(credit.artist_slug),'') is not null
  order by
    credit.credit_order nulls last,
    credit.created_at,
    credit.id
  limit 1;

  v_identity_title :=
    mizizi_private.normalize_identity_text_v1(v_track.title);

  for v_fragment in
    select rm[1]
    from regexp_matches(
      v_identity_title,
      '(\([^)]*\y(feat(uring)?|ft)\.?[[:space:]]+[^)]*\)|\[[^]]*\y(feat(uring)?|ft)\.?[[:space:]]+[^]]*\]|\{[^}]*\y(feat(uring)?|ft)\.?[[:space:]]+[^}]*\})',
      'gi'
    ) as rm
  loop
    v_fragment_slug :=
      mizizi_private.slugify_identity_v1(v_fragment);

    if exists (
      select 1
      from public.registry_track_artists featured
      cross join lateral (
        select mizizi_private.slugify_identity_v1(
          coalesce(
            nullif(btrim(featured.artist_name_text),''),
            featured.artist_slug,
            ''
          )
        ) as featured_slug
      ) normalized
      where featured.track_id=v_track.id
        and featured.status='active'
        and featured.is_featured is true
        and nullif(normalized.featured_slug,'') is not null
        and position(
          '-' || normalized.featured_slug || '-'
          in '-' || v_fragment_slug || '-'
        ) > 0
    ) then
      v_identity_title :=
        replace(v_identity_title,v_fragment,' ');
    end if;
  end loop;

  v_identity_title :=
    regexp_replace(
      v_identity_title,
      '[[:space:]]+',
      ' ',
      'g'
    );

  v_fragment := null;
  select rm[1]
  into v_fragment
  from regexp_matches(
    v_identity_title,
    '([[:space:]]+(-|:)?[[:space:]]*\y(feat(uring)?|ft)\.?[[:space:]]+.+)$',
    'i'
  ) as rm
  limit 1;

  if v_fragment is not null
     and v_fragment !~ '[()[\]{}]'
  then
    v_fragment_slug :=
      mizizi_private.slugify_identity_v1(v_fragment);

    if exists (
      select 1
      from public.registry_track_artists featured
      cross join lateral (
        select mizizi_private.slugify_identity_v1(
          coalesce(
            nullif(btrim(featured.artist_name_text),''),
            featured.artist_slug,
            ''
          )
        ) as featured_slug
      ) normalized
      where featured.track_id=v_track.id
        and featured.status='active'
        and featured.is_featured is true
        and nullif(normalized.featured_slug,'') is not null
        and position(
          '-' || normalized.featured_slug || '-'
          in '-' || v_fragment_slug || '-'
        ) > 0
    ) then
      v_identity_title :=
        btrim(
          left(
            v_identity_title,
            length(v_identity_title)-length(v_fragment)
          )
        );
    end if;
  end if;

  v_identity_title :=
    regexp_replace(
      v_identity_title,
      '[[:space:]]+',
      ' ',
      'g'
    );

  v_proposed :=
    coalesce(
      nullif(
        mizizi_private.slugify_identity_v1(v_identity_title),
        ''
      ),
      'untitled'
    );

  v_strong_noise :=
    v_track.slug ~* '(^|-)(feat|featuring|ft)(-|$)';

  if not v_strong_noise
     and nullif(
       mizizi_private.slugify_identity_v1(v_primary_artist_slug),
       ''
     ) is not null
     and lower(v_track.slug) like
       mizizi_private.slugify_identity_v1(v_primary_artist_slug) || '--%'
  then
    v_strong_noise := true;
  end if;

  if not v_strong_noise
     and exists (
       select 1
       from public.registry_track_artists featured
       cross join lateral (
         select mizizi_private.slugify_identity_v1(
           coalesce(
             nullif(btrim(featured.artist_slug),''),
             featured.artist_name_text,
             ''
           )
         ) as featured_slug
       ) normalized
       where featured.track_id=v_track.id
         and featured.status='active'
         and featured.is_featured is true
         and nullif(normalized.featured_slug,'') is not null
         and position(
           '-' || normalized.featured_slug || '-'
           in '-' || lower(v_track.slug) || '-'
         ) > 0
     )
  then
    v_strong_noise := true;
  end if;

  track_id := v_track.id;
  current_slug := v_track.slug;
  proposed_slug := v_proposed;
  primary_artist_slug := v_primary_artist_slug;
  strong_noise := v_strong_noise;
  expected_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_track.id
    );
  return next;
end
$$;

create function mizizi_private.track_slug_plan_v1(
  p_track_id uuid
)
returns table (
  track_id uuid,
  current_slug text,
  proposed_slug text,
  primary_artist_slug text,
  expected_state_fingerprint text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_candidate record;
begin
  perform mizizi_private.assert_executor_v1();

  select *
  into v_candidate
  from mizizi_private.track_slug_candidate_v1(p_track_id);

  if not found
     or not v_candidate.strong_noise
     or nullif(v_candidate.proposed_slug,'') is null
     or v_candidate.current_slug=v_candidate.proposed_slug
  then
    raise exception using errcode='42501',
      message='Track is not an eligible MIZIZI slug canonicalization target.';
  end if;

  if nullif(v_candidate.primary_artist_slug,'') is not null
     and exists (
       select 1
       from public.registry_track_artists credit
       join public.registry_tracks other
         on other.id=credit.track_id
        and other.status='active'
       where credit.status='active'
         and credit.is_primary is true
         and credit.artist_slug=v_candidate.primary_artist_slug
         and other.id<>p_track_id
         and other.slug=v_candidate.proposed_slug
     )
  then
    raise exception using errcode='40001',
      message='Track slug target collides inside the current primary-Artist scope.';
  end if;

  if exists (
    select 1
    from public.registry_release_tracks target
    join public.registry_release_tracks sibling
      on sibling.release_id=target.release_id
     and sibling.status='active'
    join public.registry_tracks other
      on other.id=sibling.track_id
     and other.status='active'
    where target.track_id=p_track_id
      and target.status='active'
      and other.id<>p_track_id
      and other.slug=v_candidate.proposed_slug
  ) then
    raise exception using errcode='40001',
      message='Track slug target collides inside a current Release scope.';
  end if;

  track_id := v_candidate.track_id;
  current_slug := v_candidate.current_slug;
  proposed_slug := v_candidate.proposed_slug;
  primary_artist_slug := v_candidate.primary_artist_slug;
  expected_state_fingerprint :=
    v_candidate.expected_state_fingerprint;
  return next;
end
$$;

create function mizizi_private.release_slug_plan_v1(
  p_release_id uuid
)
returns table (
  release_id uuid,
  artist_id uuid,
  artist_slug text,
  current_slug text,
  base_slug text,
  proposed_slug text,
  uses_date_fallback boolean,
  expected_state_fingerprint text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_release public.registry_releases%rowtype;
  v_artist_id uuid;
  v_artist_slug text;
  v_packaging_type text;
  v_base_slug text;
  v_candidate_count integer;
  v_existing_clean_conflict boolean;
  v_planned_slug text;
  v_uses_date_fallback boolean;
begin
  perform mizizi_private.assert_executor_v1();

  select release.*
  into v_release
  from public.registry_releases release
  where release.id=p_release_id
    and release.status='active';

  if not found then
    raise exception using errcode='P0002',
      message='Active Registry Release not found.';
  end if;

  v_packaging_type :=
    lower(
      coalesce(
        substring(
          v_release.slug
          from '-(single|ep|album)$'
        ),
        ''
      )
    );

  if v_packaging_type=''
     or not (
       mizizi_private.normalize_identity_text_v1(v_release.title)
       ~* (
         '[[:space:]]+-[[:space:]]+' ||
         v_packaging_type ||
         '$'
       )
     )
  then
    raise exception using errcode='42501',
      message='Release is not an eligible provider-packaging slug target.';
  end if;

  v_base_slug :=
    regexp_replace(
      v_release.slug,
      '-(single|ep|album)$',
      '',
      'i'
    );

  select credit.artist_id,credit.artist_slug
  into v_artist_id,v_artist_slug
  from public.registry_release_artists credit
  where credit.release_id=v_release.id
    and credit.status='active'
    and credit.is_primary is true
    and credit.artist_id is not null
    and nullif(btrim(credit.artist_slug),'') is not null
  order by
    credit.credit_order nulls last,
    credit.created_at,
    credit.id
  limit 1;

  if v_artist_id is null
     or nullif(v_artist_slug,'') is null
     or nullif(v_base_slug,'') is null
  then
    raise exception using errcode='42501',
      message='Release slug plan is missing exact primary-Artist scope.';
  end if;

  select count(*)::integer
  into v_candidate_count
  from public.registry_releases candidate
  join public.registry_release_artists candidate_credit
    on candidate_credit.release_id=candidate.id
   and candidate_credit.status='active'
   and candidate_credit.is_primary is true
  where candidate.status='active'
    and candidate_credit.artist_id=v_artist_id
    and regexp_replace(
      candidate.slug,
      '-(single|ep|album)$',
      '',
      'i'
    )=v_base_slug
    and (
      (
        candidate.slug ~* '-single$'
        and candidate.title ~*
          '[[:space:]]+-[[:space:]]+single$'
      )
      or (
        candidate.slug ~* '-ep$'
        and candidate.title ~*
          '[[:space:]]+-[[:space:]]+ep$'
      )
      or (
        candidate.slug ~* '-album$'
        and candidate.title ~*
          '[[:space:]]+-[[:space:]]+album$'
      )
    );

  select exists (
    select 1
    from public.registry_releases other
    join public.registry_release_artists other_credit
      on other_credit.release_id=other.id
     and other_credit.status='active'
     and other_credit.is_primary is true
    where other.status='active'
      and other.id<>v_release.id
      and other_credit.artist_id=v_artist_id
      and other.slug=v_base_slug
  )
  into v_existing_clean_conflict;

  v_uses_date_fallback :=
    v_candidate_count>1
    or v_existing_clean_conflict;

  if not v_uses_date_fallback then
    v_planned_slug := v_base_slug;
  elsif v_release.release_date is not null then
    v_planned_slug :=
      v_base_slug ||
      '-' ||
      to_char(v_release.release_date,'YYYY-MM-DD');
  else
    raise exception using errcode='40001',
      message='Release slug collision requires a Release date fallback.';
  end if;

  if exists (
    select 1
    from public.registry_releases other
    join public.registry_release_artists other_credit
      on other_credit.release_id=other.id
     and other_credit.status='active'
     and other_credit.is_primary is true
    where other.status='active'
      and other.id<>v_release.id
      and other_credit.artist_id=v_artist_id
      and other.slug=v_planned_slug
  ) then
    raise exception using errcode='40001',
      message='Release slug plan collides with a current Release slug.';
  end if;

  if v_uses_date_fallback
     and exists (
       select 1
       from public.registry_releases other
       join public.registry_release_artists other_credit
         on other_credit.release_id=other.id
        and other_credit.status='active'
        and other_credit.is_primary is true
       where other.status='active'
         and other.id<>v_release.id
         and other_credit.artist_id=v_artist_id
         and other.release_date=v_release.release_date
         and regexp_replace(
           other.slug,
           '-(single|ep|album)$',
           '',
           'i'
         )=v_base_slug
         and (
           (
             other.slug ~* '-single$'
             and other.title ~*
               '[[:space:]]+-[[:space:]]+single$'
           )
           or (
             other.slug ~* '-ep$'
             and other.title ~*
               '[[:space:]]+-[[:space:]]+ep$'
           )
           or (
             other.slug ~* '-album$'
             and other.title ~*
               '[[:space:]]+-[[:space:]]+album$'
           )
         )
     )
  then
    raise exception using errcode='40001',
      message='Release slug date fallback is not unique inside the Artist scope.';
  end if;

  release_id := v_release.id;
  artist_id := v_artist_id;
  artist_slug := v_artist_slug;
  current_slug := v_release.slug;
  base_slug := v_base_slug;
  proposed_slug := v_planned_slug;
  uses_date_fallback := v_uses_date_fallback;
  expected_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'release',
      v_release.id
    );
  return next;
end
$$;

create function mizizi_private.issue_stewardship_execution_grant_v1(
  p_operation_key text,
  p_target_ref text,
  p_idempotency_key text
)
returns table (
  execution_grant_id uuid,
  plan_payload jsonb,
  plan_fingerprint text,
  target_set_fingerprint text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private, extensions
as $$
declare
  v_existing platform_private.registry_execution_grants%rowtype;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_standing platform_private.system_actor_capability_grants%rowtype;
  v_standing_count integer;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_expected_state_fingerprint text;
  v_subject_type text;
  v_subject_id uuid;
  v_capability_key text;
  v_execution_grant_id uuid;
  v_expires_at timestamptz;
  v_track_plan record;
  v_release_taxonomy_plan record;
  v_release_slug_plan record;
  v_chart_plan record;
begin
  perform mizizi_private.assert_executor_v1();

  if p_operation_key not in (
       'registry.track_slug.canonicalize',
       'registry.release_taxonomy.repair',
       'registry.release_slug.canonicalize',
       'registry.chart_track_slug.synchronize'
     )
     or nullif(btrim(p_target_ref),'') is null
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception using errcode='22023',
      message='Invalid bounded MIZIZI stewardship grant request.';
  end if;

  select grant_row.*
  into v_existing
  from platform_private.registry_execution_grants grant_row
  where grant_row.actor_key='mizizi'
    and grant_row.operation_key=p_operation_key
    and grant_row.operation_version=1
    and grant_row.idempotency_key=p_idempotency_key;

  if found then
    if v_existing.plan_payload->>'target_ref'
       is distinct from p_target_ref
    then
      raise exception using errcode='23505',
        message='Idempotency key is already bound to another stewardship target.';
    end if;

    execution_grant_id := v_existing.id;
    plan_payload := v_existing.plan_payload;
    plan_fingerprint := v_existing.plan_fingerprint;
    target_set_fingerprint := v_existing.target_set_fingerprint;
    expires_at := v_existing.expires_at;
    return next;
    return;
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=p_operation_key
    and operation_type.operation_version=1;

  if not found
     or not v_operation_type.enabled
  then
    raise exception using errcode='42501',
      message='Requested MIZIZI stewardship operation is disabled.';
  end if;

  v_capability_key := v_operation_type.capability_key;

  if p_operation_key='registry.track_slug.canonicalize' then
    begin
      v_subject_id := p_target_ref::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Track stewardship target must be a UUID.';
    end;

    select *
    into v_track_plan
    from mizizi_private.track_slug_plan_v1(v_subject_id);

    v_subject_type := 'track';
    v_expected_state_fingerprint :=
      v_track_plan.expected_state_fingerprint;
    v_plan := jsonb_build_object(
      'operation_key',p_operation_key,
      'operation_version',1,
      'target_ref',p_target_ref,
      'track_id',v_subject_id::text,
      'current_slug',v_track_plan.current_slug,
      'proposed_slug',v_track_plan.proposed_slug,
      'primary_artist_slug',coalesce(v_track_plan.primary_artist_slug,''),
      'expected_state_fingerprint',v_expected_state_fingerprint,
      'rule_id','track_slug_identity_noise',
      'rule_version','1.2.0',
      'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0'
    );

  elsif p_operation_key='registry.release_taxonomy.repair' then
    begin
      v_subject_id := p_target_ref::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Release stewardship target must be a UUID.';
    end;

    select *
    into v_release_taxonomy_plan
    from mizizi_private.release_taxonomy_plan_v1(v_subject_id);

    if nullif(v_release_taxonomy_plan.proposed_release_type,'') is null
       or lower(
         coalesce(v_release_taxonomy_plan.current_release_type,'')
       )=v_release_taxonomy_plan.proposed_release_type
    then
      raise exception using errcode='42501',
        message='Release has no deterministic taxonomy repair.';
    end if;

    v_subject_type := 'release';
    v_expected_state_fingerprint :=
      v_release_taxonomy_plan.expected_state_fingerprint;
    v_plan := jsonb_build_object(
      'operation_key',p_operation_key,
      'operation_version',1,
      'target_ref',p_target_ref,
      'release_id',v_subject_id::text,
      'current_release_type',
        coalesce(v_release_taxonomy_plan.current_release_type,''),
      'active_track_count',
        v_release_taxonomy_plan.active_track_count,
      'proposed_release_type',
        v_release_taxonomy_plan.proposed_release_type,
      'expected_state_fingerprint',v_expected_state_fingerprint,
      'rule_id','release_taxonomy_drift',
      'rule_version','1.2.0',
      'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0'
    );

  elsif p_operation_key='registry.release_slug.canonicalize' then
    begin
      v_subject_id := p_target_ref::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Release stewardship target must be a UUID.';
    end;

    select *
    into v_release_slug_plan
    from mizizi_private.release_slug_plan_v1(v_subject_id);

    v_subject_type := 'release';
    v_expected_state_fingerprint :=
      v_release_slug_plan.expected_state_fingerprint;
    v_plan := jsonb_build_object(
      'operation_key',p_operation_key,
      'operation_version',1,
      'target_ref',p_target_ref,
      'release_id',v_subject_id::text,
      'artist_id',v_release_slug_plan.artist_id::text,
      'artist_slug',v_release_slug_plan.artist_slug,
      'current_slug',v_release_slug_plan.current_slug,
      'base_slug',v_release_slug_plan.base_slug,
      'proposed_slug',v_release_slug_plan.proposed_slug,
      'uses_date_fallback',v_release_slug_plan.uses_date_fallback,
      'expected_state_fingerprint',v_expected_state_fingerprint,
      'rule_id','release_slug_provider_packaging',
      'rule_version','1.2.0',
      'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0'
    );

  else
    select *
    into v_chart_plan
    from mizizi_private.chart_track_slug_plan_v1(p_target_ref);

    v_subject_type := 'track';
    v_subject_id := v_chart_plan.canonical_track_id;
    v_expected_state_fingerprint :=
      v_chart_plan.expected_track_state_fingerprint;
    v_plan := jsonb_build_object(
      'operation_key',p_operation_key,
      'operation_version',1,
      'target_ref',p_target_ref,
      'chart_entry_id',v_chart_plan.chart_entry_id,
      'canonical_track_id',v_chart_plan.canonical_track_id::text,
      'current_track_slug',v_chart_plan.current_track_slug,
      'canonical_track_slug',v_chart_plan.canonical_track_slug,
      'expected_state_fingerprint',v_expected_state_fingerprint,
      'rule_id','chart_track_slug_drift',
      'rule_version','1.2.0',
      'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0'
    );
  end if;

  select count(*)::integer
  into v_standing_count
  from platform_private.system_actor_capability_grants standing
  where standing.actor_key='mizizi'
    and standing.capability_key=v_capability_key
    and standing.status='active'
    and standing.valid_from <= now()
    and standing.expires_at > now()
    and standing.revoked_at is null;

  if v_standing_count<>1 then
    raise exception using errcode='42501',
      message='Exactly one active standing MIZIZI stewardship capability grant is required.';
  end if;

  select standing.*
  into v_standing
  from platform_private.system_actor_capability_grants standing
  where standing.actor_key='mizizi'
    and standing.capability_key=v_capability_key
    and standing.status='active'
    and standing.valid_from <= now()
    and standing.expires_at > now()
    and standing.revoked_at is null
  limit 1;

  if not (
    v_standing.scope @>
      jsonb_build_object(
        'operation_key',p_operation_key,
        'operation_version',1,
        'subject_type',v_subject_type,
        'max_rows',1
      )
  ) then
    raise exception using errcode='42501',
      message='Standing capability scope does not authorize this exact stewardship operation.';
  end if;

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type',v_subject_type,
          'subject_id',v_subject_id::text,
          'expected_state_fingerprint',v_expected_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  v_expires_at :=
    least(
      now()+interval '5 minutes',
      v_standing.expires_at
    );

  insert into platform_private.registry_execution_grants (
    actor_key,
    capability_key,
    system_actor_capability_grant_id,
    operation_key,
    operation_version,
    plan_payload,
    plan_fingerprint,
    target_set_fingerprint,
    max_rows,
    idempotency_key,
    status,
    issued_by_user_id,
    issued_by_principal_key,
    policy_ruleset_version,
    issued_at,
    expires_at
  )
  values (
    'mizizi',
    v_capability_key,
    v_standing.id,
    p_operation_key,
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    p_idempotency_key,
    'active',
    null,
    'policy:mizizi-cultural-data-steward-1.2.0',
    'mizizi-cultural-data-steward-1.2.0',
    now(),
    v_expires_at
  )
  returning id into v_execution_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,
    subject_type,
    subject_id,
    expected_state_fingerprint
  )
  values (
    v_execution_grant_id,
    v_subject_type,
    v_subject_id,
    v_expected_state_fingerprint
  );

  execution_grant_id := v_execution_grant_id;
  plan_payload := v_plan;
  plan_fingerprint := v_plan_fingerprint;
  target_set_fingerprint := v_target_fingerprint;
  expires_at := v_expires_at;
  return next;
end
$$;


create function mizizi_private.execute_stewardship_operation_v1(
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean,
  result_payload jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_plan jsonb;
  v_event_id uuid;
  v_rows integer;
  v_track_plan record;
  v_release_taxonomy_plan record;
  v_release_slug_plan record;
  v_chart_plan record;
  v_track_id uuid;
  v_release_id uuid;
  v_old_slug text;
  v_new_slug text;
  v_primary_artist_slug text;
  v_paths jsonb := '[]'::jsonb;
  v_path jsonb;
  v_release_path record;
  v_thread record;
  v_matched_path jsonb;
  v_chart_rows integer := 0;
  v_save_rows integer := 0;
  v_save_url_rows integer := 0;
  v_thread_rows integer := 0;
  v_interest_rows integer := 0;
  v_activity_rows integer := 0;
  v_contribution_rows integer := 0;
  v_notification_rows integer := 0;
  v_opportunity_rows integer := 0;
  v_old_path text;
  v_new_path text;
  v_result jsonb;
begin
  perform mizizi_private.assert_executor_v1();

  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'mizizi',
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay
     and v_operation.status='succeeded'
  then
    operation_id := v_operation.id;
    operation_status := v_operation.status;
    verifier_status := v_operation.verifier_status;
    idempotent_replay := true;
    result_payload := v_operation.result_payload;
    return next;
    return;
  end if;

  if v_operation.status<>'authorized' then
    raise exception using errcode='42501',
      message='Stewardship operation is not in an executable state.';
  end if;

  select grant_row.*
  into v_grant
  from platform_private.registry_execution_grants grant_row
  where grant_row.id=p_execution_grant_id;

  if not found
     or v_grant.actor_key<>'mizizi'
     or v_grant.operation_version<>1
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>
       'mizizi-cultural-data-steward-1.2.0'
     or v_grant.operation_key not in (
       'registry.track_slug.canonicalize',
       'registry.release_taxonomy.repair',
       'registry.release_slug.canonicalize',
       'registry.chart_track_slug.synchronize'
     )
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Stage B MIZIZI stewardship grant.';
  end if;

  v_plan := v_grant.plan_payload;

  update platform_private.registry_mutation_operations
  set
    status='executing',
    started_at=coalesce(started_at,now()),
    updated_at=now()
  where id=v_operation.id;

  if v_grant.operation_key='registry.track_slug.canonicalize' then
    if (
      v_plan - array[
        'operation_key','operation_version','target_ref','track_id',
        'current_slug','proposed_slug','primary_artist_slug',
        'expected_state_fingerprint','rule_id','rule_version',
        'policy_ruleset_version'
      ]::text[]
    )<>'{}'::jsonb
    then
      raise exception using errcode='42501',
        message='Track slug plan contains fields outside V1.';
    end if;

    begin
      v_track_id := (v_plan->>'track_id')::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Track slug plan contains malformed typed values.';
    end;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'mizizi:track-scope:' ||
        coalesce(v_plan->>'primary_artist_slug',''),
        0
      )
    );

    select *
    into v_track_plan
    from mizizi_private.track_slug_plan_v1(v_track_id);

    if v_plan->>'operation_key'<>'registry.track_slug.canonicalize'
       or (v_plan->>'operation_version')::integer<>1
       or v_plan->>'rule_id'<>'track_slug_identity_noise'
       or v_plan->>'rule_version'<>'1.2.0'
       or v_plan->>'policy_ruleset_version'<>
          'mizizi-cultural-data-steward-1.2.0'
       or v_plan->>'current_slug'
          is distinct from v_track_plan.current_slug
       or v_plan->>'proposed_slug'
          is distinct from v_track_plan.proposed_slug
       or v_plan->>'expected_state_fingerprint'
          is distinct from v_track_plan.expected_state_fingerprint
    then
      raise exception using errcode='42501',
        message='Track slug execution plan drifted from current deterministic policy.';
    end if;

    v_old_slug := v_track_plan.current_slug;
    v_new_slug := v_track_plan.proposed_slug;
    v_primary_artist_slug :=
      coalesce(v_track_plan.primary_artist_slug,'');

    if nullif(v_primary_artist_slug,'') is not null then
      v_paths := v_paths || jsonb_build_array(
        jsonb_build_object(
          'scope_slug',v_primary_artist_slug,
          'old_path',
            '/tracks/' || v_primary_artist_slug || '/' || v_old_slug,
          'new_path',
            '/tracks/' || v_primary_artist_slug || '/' || v_new_slug
        )
      );
    end if;

    for v_release_path in
      select
        release.slug as release_slug,
        coalesce(
          (
            select credit.artist_slug
            from public.registry_release_artists credit
            where credit.release_id=release.id
              and credit.status='active'
              and credit.is_primary is true
              and nullif(btrim(credit.artist_slug),'') is not null
            order by
              credit.credit_order nulls last,
              credit.id
            limit 1
          ),
          v_primary_artist_slug
        ) as artist_slug,
        (
          select count(*)::integer
          from public.registry_release_tracks member
          where member.release_id=release.id
            and member.status='active'
        ) as active_track_count
      from public.registry_release_tracks membership
      join public.registry_releases release
        on release.id=membership.release_id
      where membership.track_id=v_track_id
        and membership.status='active'
        and release.status='active'
      order by release.id
    loop
      if nullif(v_release_path.artist_slug,'') is not null
         and nullif(v_release_path.release_slug,'') is not null
      then
        v_old_path :=
          '/releases/' ||
          v_release_path.artist_slug ||
          '/' ||
          v_release_path.release_slug ||
          '/' ||
          v_old_slug;

        v_new_path :=
          case
            when v_release_path.active_track_count>1
              then
                '/releases/' ||
                v_release_path.artist_slug ||
                '/' ||
                v_release_path.release_slug ||
                '/' ||
                v_new_slug
            else
              '/tracks/' ||
              v_release_path.artist_slug ||
              '/' ||
              v_new_slug
          end;

        v_paths := v_paths || jsonb_build_array(
          jsonb_build_object(
            'scope_slug',v_release_path.artist_slug,
            'old_path',v_old_path,
            'new_path',v_new_path
          )
        );
      end if;
    end loop;

    select
      thread.id,
      thread.entity_id,
      thread.entity_slug,
      thread.entity_url
    into v_thread
    from public.community_threads thread
    where thread.entity_type='track'
      and thread.entity_slug=v_old_slug
    order by thread.id
    limit 1;

    if found then
      v_matched_path := null;

      for v_path in
        select value
        from jsonb_array_elements(v_paths)
      loop
        if position(
          v_path->>'old_path'
          in coalesce(v_thread.entity_url,'')
        )>0
        then
          v_matched_path := v_path;
          exit;
        end if;
      end loop;

      if v_matched_path is null then
        raise exception using errcode='40001',
          message='Track current-pointer ownership is ambiguous.';
      end if;
    end if;

    update public.registry_tracks
    set
      slug=v_new_slug,
      updated_at=now()
    where id=v_track_id
      and status='active'
      and slug=v_old_slug;

    get diagnostics v_rows=row_count;
    if v_rows<>1 then
      raise exception using errcode='40001',
        message='Track slug compare-and-set lost its one-row boundary.';
    end if;

    update public.wk_chart_entries_v2
    set
      track_slug=v_new_slug,
      updated_at=now()
    where canonical_track_id=v_track_id::text
      and track_slug is distinct from v_new_slug;
    get diagnostics v_chart_rows=row_count;

    update public.community_saves
    set entity_slug=v_new_slug
    where entity_type='track'
      and entity_id=v_track_id::text
      and entity_slug is distinct from v_new_slug;
    get diagnostics v_save_rows=row_count;

    for v_path in
      select value
      from jsonb_array_elements(v_paths)
    loop
      update public.community_saves
      set entity_url=
        replace(
          entity_url,
          v_path->>'old_path',
          v_path->>'new_path'
        )
      where entity_type='track'
        and entity_id=v_track_id::text
        and entity_url is not null
        and position(
          v_path->>'old_path'
          in entity_url
        )>0;

      get diagnostics v_rows=row_count;
      v_save_url_rows := v_save_url_rows+v_rows;
    end loop;

    if v_thread.id is not null then
      update public.community_threads
      set
        entity_id=case
          when entity_id=v_old_slug
            then v_new_slug
          else entity_id
        end,
        entity_slug=v_new_slug,
        entity_url=case
          when entity_url is null
            then entity_url
          else replace(
            entity_url,
            v_matched_path->>'old_path',
            v_matched_path->>'new_path'
          )
        end,
        updated_at=now()
      where id=v_thread.id
        and entity_type='track'
        and entity_slug=v_old_slug;

      get diagnostics v_thread_rows=row_count;
    end if;

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
      'track',
      v_track_id::text,
      v_grant.idempotency_key,
      'mizizi_private.track_slug_plan_v1',
      'slug',
      'public.registry_tracks.slug',
      jsonb_build_object('value',v_old_slug),
      jsonb_build_object(
        'value',v_new_slug,
        'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0',
        'downstream_impact',jsonb_build_object(
          'chart_entries_updated',v_chart_rows,
          'community_saves_updated',v_save_rows,
          'community_save_urls_updated',v_save_url_rows,
          'community_threads_updated',v_thread_rows
        )
      ),
      'canonicalize_track_slug',
      'succeeded',
      'system:mizizi'
    )
    returning id into v_event_id;

    v_result := jsonb_build_object(
      'track_id',v_track_id,
      'old_slug',v_old_slug,
      'new_slug',v_new_slug,
      'chart_entries_updated',v_chart_rows,
      'community_saves_updated',v_save_rows,
      'community_save_urls_updated',v_save_url_rows,
      'community_threads_updated',v_thread_rows,
      'paths',v_paths,
      'canonical_write_event_id',v_event_id
    );

  elsif v_grant.operation_key='registry.release_taxonomy.repair' then
    begin
      v_release_id := (v_plan->>'release_id')::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Release taxonomy plan contains malformed typed values.';
    end;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'mizizi:release-taxonomy:' || v_release_id::text,
        0
      )
    );

    select *
    into v_release_taxonomy_plan
    from mizizi_private.release_taxonomy_plan_v1(v_release_id);

    if v_plan->>'rule_id'<>'release_taxonomy_drift'
       or v_plan->>'rule_version'<>'1.2.0'
       or v_plan->>'current_release_type'
          is distinct from
          coalesce(v_release_taxonomy_plan.current_release_type,'')
       or v_plan->>'proposed_release_type'
          is distinct from
          v_release_taxonomy_plan.proposed_release_type
       or (v_plan->>'active_track_count')::integer
          is distinct from
          v_release_taxonomy_plan.active_track_count
       or v_plan->>'expected_state_fingerprint'
          is distinct from
          v_release_taxonomy_plan.expected_state_fingerprint
    then
      raise exception using errcode='42501',
        message='Release taxonomy execution plan drifted from current deterministic policy.';
    end if;

    update public.registry_releases
    set
      release_type=v_release_taxonomy_plan.proposed_release_type,
      updated_at=now()
    where id=v_release_id
      and status='active'
      and coalesce(btrim(release_type),'')=
          coalesce(v_release_taxonomy_plan.current_release_type,'');

    get diagnostics v_rows=row_count;
    if v_rows<>1 then
      raise exception using errcode='40001',
        message='Release taxonomy compare-and-set lost its one-row boundary.';
    end if;

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
      'release',
      v_release_id::text,
      v_grant.idempotency_key,
      'mizizi_private.release_taxonomy_plan_v1',
      'release_type',
      'public.registry_releases.release_type',
      jsonb_build_object(
        'value',
        v_release_taxonomy_plan.current_release_type
      ),
      jsonb_build_object(
        'value',
        v_release_taxonomy_plan.proposed_release_type,
        'resolvable_active_track_count',
        v_release_taxonomy_plan.active_track_count,
        'policy_ruleset_version',
        'mizizi-cultural-data-steward-1.2.0'
      ),
      'repair_release_taxonomy',
      'succeeded',
      'system:mizizi'
    )
    returning id into v_event_id;

    v_result := jsonb_build_object(
      'release_id',v_release_id,
      'old_release_type',
        v_release_taxonomy_plan.current_release_type,
      'new_release_type',
        v_release_taxonomy_plan.proposed_release_type,
      'resolvable_active_track_count',
        v_release_taxonomy_plan.active_track_count,
      'canonical_write_event_id',v_event_id
    );

  elsif v_grant.operation_key='registry.release_slug.canonicalize' then
    begin
      v_release_id := (v_plan->>'release_id')::uuid;
    exception when others then
      raise exception using errcode='22023',
        message='Release slug plan contains malformed typed values.';
    end;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'mizizi:release-slug:' ||
        coalesce(v_plan->>'artist_id',''),
        0
      )
    );

    select *
    into v_release_slug_plan
    from mizizi_private.release_slug_plan_v1(v_release_id);

    if v_plan->>'rule_id'<>'release_slug_provider_packaging'
       or v_plan->>'rule_version'<>'1.2.0'
       or v_plan->>'current_slug'
          is distinct from v_release_slug_plan.current_slug
       or v_plan->>'proposed_slug'
          is distinct from v_release_slug_plan.proposed_slug
       or v_plan->>'artist_id'
          is distinct from v_release_slug_plan.artist_id::text
       or v_plan->>'artist_slug'
          is distinct from v_release_slug_plan.artist_slug
       or v_plan->>'expected_state_fingerprint'
          is distinct from v_release_slug_plan.expected_state_fingerprint
    then
      raise exception using errcode='42501',
        message='Release slug execution plan drifted from current deterministic policy.';
    end if;

    v_old_slug := v_release_slug_plan.current_slug;
    v_new_slug := v_release_slug_plan.proposed_slug;
    v_old_path :=
      '/releases/' ||
      v_release_slug_plan.artist_slug ||
      '/' ||
      v_old_slug;
    v_new_path :=
      '/releases/' ||
      v_release_slug_plan.artist_slug ||
      '/' ||
      v_new_slug;

    update public.registry_releases
    set
      slug=v_new_slug,
      updated_at=now()
    where id=v_release_id
      and status='active'
      and slug=v_old_slug;
    get diagnostics v_rows=row_count;

    if v_rows<>1 then
      raise exception using errcode='40001',
        message='Release slug compare-and-set lost its one-row boundary.';
    end if;

    update public.community_saves
    set
      entity_slug=v_new_slug,
      entity_url='https://wakilisha.africa' || v_new_path
    where entity_type='release'
      and entity_id=v_release_id::text;
    get diagnostics v_save_rows=row_count;

    update public.community_threads
    set
      entity_id=v_release_id::text,
      entity_slug=v_new_slug,
      entity_url='https://wakilisha.africa' || v_new_path,
      updated_at=now()
    where entity_type='release'
      and (
        entity_id=v_release_id::text
        or (
          entity_slug=v_old_slug
          and entity_url is not null
          and position(v_old_path in entity_url)>0
        )
        or (
          entity_slug=v_old_slug
          and entity_id=v_old_slug
          and entity_url is not null
          and position('/releases/' in entity_url)>0
          and not exists (
            select 1
            from public.registry_releases other
            where other.status='active'
              and other.id<>v_release_id
              and other.slug=v_old_slug
          )
        )
      );
    get diagnostics v_thread_rows=row_count;

    update public.audience_interests
    set
      entity_slug=v_new_slug,
      updated_at=now()
    where entity_type='release'
      and entity_id=v_release_id;
    get diagnostics v_interest_rows=row_count;

    update public.community_activity
    set entity_slug=v_new_slug
    where entity_type='release'
      and entity_id=v_release_id::text;
    get diagnostics v_activity_rows=row_count;

    update public.community_contributions
    set
      entity_slug=v_new_slug,
      updated_at=now()
    where entity_type='release'
      and entity_id=v_release_id::text;
    get diagnostics v_contribution_rows=row_count;

    update public.community_notifications
    set entity_slug=v_new_slug
    where entity_type='release'
      and entity_id=v_release_id::text;
    get diagnostics v_notification_rows=row_count;

    update public.signal_os_content_opportunities
    set
      entity_slug=v_new_slug,
      page_path=v_new_path,
      updated_at=now()
    where entity_type='release'
      and entity_slug=v_old_slug
      and (
        (
          page_path is not null
          and position(v_old_path in page_path)>0
        )
        or not exists (
          select 1
          from public.registry_releases other
          where other.status='active'
            and other.id<>v_release_id
            and other.slug=v_old_slug
        )
      );
    get diagnostics v_opportunity_rows=row_count;

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
      'release',
      v_release_id::text,
      v_grant.idempotency_key,
      'mizizi_private.release_slug_plan_v1',
      'slug',
      'public.registry_releases.slug',
      jsonb_build_object('value',v_old_slug),
      jsonb_build_object(
        'value',v_new_slug,
        'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0',
        'downstream_impact',jsonb_build_object(
          'community_saves_updated',v_save_rows,
          'community_threads_updated',v_thread_rows,
          'audience_interests_updated',v_interest_rows,
          'community_activity_updated',v_activity_rows,
          'community_contributions_updated',v_contribution_rows,
          'community_notifications_updated',v_notification_rows,
          'signal_opportunities_updated',v_opportunity_rows
        )
      ),
      'canonicalize_release_slug',
      'succeeded',
      'system:mizizi'
    )
    returning id into v_event_id;

    v_result := jsonb_build_object(
      'release_id',v_release_id,
      'old_slug',v_old_slug,
      'new_slug',v_new_slug,
      'old_path',v_old_path,
      'new_path',v_new_path,
      'community_saves_updated',v_save_rows,
      'community_threads_updated',v_thread_rows,
      'audience_interests_updated',v_interest_rows,
      'community_activity_updated',v_activity_rows,
      'community_contributions_updated',v_contribution_rows,
      'community_notifications_updated',v_notification_rows,
      'signal_opportunities_updated',v_opportunity_rows,
      'canonical_write_event_id',v_event_id
    );

  else
    perform pg_advisory_xact_lock(
      hashtextextended(
        'mizizi:chart-track-slug:' ||
        coalesce(v_plan->>'chart_entry_id',''),
        0
      )
    );

    select *
    into v_chart_plan
    from mizizi_private.chart_track_slug_plan_v1(
      v_plan->>'chart_entry_id'
    );

    if v_plan->>'rule_id'<>'chart_track_slug_drift'
       or v_plan->>'rule_version'<>'1.2.0'
       or v_plan->>'current_track_slug'
          is distinct from v_chart_plan.current_track_slug
       or v_plan->>'canonical_track_slug'
          is distinct from v_chart_plan.canonical_track_slug
       or v_plan->>'canonical_track_id'
          is distinct from v_chart_plan.canonical_track_id::text
       or v_plan->>'expected_state_fingerprint'
          is distinct from v_chart_plan.expected_track_state_fingerprint
    then
      raise exception using errcode='42501',
        message='Chart Track-slug execution plan drifted from current deterministic policy.';
    end if;

    update public.wk_chart_entries_v2
    set
      track_slug=v_chart_plan.canonical_track_slug,
      updated_at=now()
    where id=v_chart_plan.chart_entry_id
      and track_slug=v_chart_plan.current_track_slug
      and canonical_track_id=
        v_chart_plan.canonical_track_id::text;
    get diagnostics v_rows=row_count;

    if v_rows<>1 then
      raise exception using errcode='40001',
        message='Chart Track-slug compare-and-set lost its one-row boundary.';
    end if;

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
      'chart_entry',
      v_chart_plan.chart_entry_id,
      v_grant.idempotency_key,
      'mizizi_private.chart_track_slug_plan_v1',
      'track_slug',
      'public.wk_chart_entries_v2.track_slug',
      jsonb_build_object(
        'value',v_chart_plan.current_track_slug
      ),
      jsonb_build_object(
        'value',v_chart_plan.canonical_track_slug,
        'canonical_track_id',v_chart_plan.canonical_track_id,
        'policy_ruleset_version','mizizi-cultural-data-steward-1.2.0'
      ),
      'synchronize_chart_track_slug',
      'succeeded',
      'system:mizizi'
    )
    returning id into v_event_id;

    v_result := jsonb_build_object(
      'chart_entry_id',v_chart_plan.chart_entry_id,
      'canonical_track_id',v_chart_plan.canonical_track_id,
      'old_track_slug',v_chart_plan.current_track_slug,
      'new_track_slug',v_chart_plan.canonical_track_slug,
      'canonical_write_event_id',v_event_id
    );
  end if;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values (
    v_operation.id,
    v_event_id
  );

  update platform_private.registry_mutation_operations
  set
    affected_rows=1,
    status='succeeded',
    verifier_status='pending',
    result_payload=v_result,
    completed_at=now(),
    updated_at=now()
  where id=v_operation.id;

  operation_id := v_operation.id;
  operation_status := 'succeeded';
  verifier_status := 'pending';
  idempotent_replay := v_begin.idempotent_replay;
  result_payload := v_result;
  return next;
end
$$;

create function mizizi_private.verify_stewardship_operation_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, mizizi_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_event public.registry_canonical_write_events%rowtype;
  v_plan jsonb;
  v_track_id uuid;
  v_release_id uuid;
  v_expected_entity_type text;
  v_expected_entity_id text;
  v_expected_field text;
  v_expected_target_path text;
  v_expected_action text;
  v_expected_value text;
  v_link_count integer;
  v_failure text;
  v_path jsonb;
begin
  perform mizizi_private.assert_executor_v1();

  if p_operation_id is null then
    raise exception using errcode='22023',
      message='Operation id is required.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'mizizi'
     or v_operation.operation_version<>1
     or v_operation.operation_key not in (
       'registry.track_slug.canonicalize',
       'registry.release_taxonomy.repair',
       'registry.release_slug.canonicalize',
       'registry.chart_track_slug.synchronize'
     )
  then
    raise exception using errcode='P0002',
      message='Stage B stewardship operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id := v_operation.id;
    verifier_status := 'passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows<>1
  then
    v_failure := 'operation_not_succeeded_exactly_once';
  end if;

  select grant_row.*
  into v_grant
  from platform_private.registry_execution_grants grant_row
  where grant_row.id=v_operation.execution_grant_id;

  if v_failure is null and not found then
    v_failure := 'execution_grant_missing';
  end if;

  if v_failure is null then
    v_plan := v_grant.plan_payload;

    if v_operation.operation_key='registry.track_slug.canonicalize' then
      begin
        v_track_id := (v_plan->>'track_id')::uuid;
      exception when others then
        v_failure := 'track_plan_malformed';
      end;

      if v_failure is null
         and not exists (
           select 1
           from public.registry_tracks track
           where track.id=v_track_id
             and track.slug=v_plan->>'proposed_slug'
         )
      then
        v_failure := 'canonical_track_slug_mismatch';
      end if;

      if v_failure is null
         and exists (
           select 1
           from public.wk_chart_entries_v2 entry
           where entry.canonical_track_id=v_track_id::text
             and entry.track_slug is distinct from
               v_plan->>'proposed_slug'
         )
      then
        v_failure := 'chart_projection_track_slug_mismatch';
      end if;

      if v_failure is null
         and exists (
           select 1
           from public.community_saves save
           where save.entity_type='track'
             and save.entity_id=v_track_id::text
             and save.entity_slug is distinct from
               v_plan->>'proposed_slug'
         )
      then
        v_failure := 'community_save_track_slug_mismatch';
      end if;

      if v_failure is null then
        for v_path in
          select value
          from jsonb_array_elements(
            coalesce(
              v_operation.result_payload->'paths',
              '[]'::jsonb
            )
          )
        loop
          if exists (
            select 1
            from public.community_saves save
            where save.entity_type='track'
              and save.entity_id=v_track_id::text
              and save.entity_url is not null
              and position(
                v_path->>'old_path'
                in save.entity_url
              )>0
          ) then
            v_failure := 'community_save_track_url_mismatch';
            exit;
          end if;
        end loop;
      end if;

      v_expected_entity_type := 'track';
      v_expected_entity_id := v_track_id::text;
      v_expected_field := 'slug';
      v_expected_target_path := 'public.registry_tracks.slug';
      v_expected_action := 'canonicalize_track_slug';
      v_expected_value := v_plan->>'proposed_slug';

    elsif v_operation.operation_key='registry.release_taxonomy.repair' then
      begin
        v_release_id := (v_plan->>'release_id')::uuid;
      exception when others then
        v_failure := 'release_taxonomy_plan_malformed';
      end;

      if v_failure is null
         and not exists (
           select 1
           from public.registry_releases release
           where release.id=v_release_id
             and lower(coalesce(release.release_type,''))=
               v_plan->>'proposed_release_type'
         )
      then
        v_failure := 'release_taxonomy_state_mismatch';
      end if;

      v_expected_entity_type := 'release';
      v_expected_entity_id := v_release_id::text;
      v_expected_field := 'release_type';
      v_expected_target_path :=
        'public.registry_releases.release_type';
      v_expected_action := 'repair_release_taxonomy';
      v_expected_value := v_plan->>'proposed_release_type';

    elsif v_operation.operation_key='registry.release_slug.canonicalize' then
      begin
        v_release_id := (v_plan->>'release_id')::uuid;
      exception when others then
        v_failure := 'release_slug_plan_malformed';
      end;

      if v_failure is null
         and not exists (
           select 1
           from public.registry_releases release
           where release.id=v_release_id
             and release.slug=v_plan->>'proposed_slug'
         )
      then
        v_failure := 'canonical_release_slug_mismatch';
      end if;

      if v_failure is null
         and exists (
           select 1
           from public.community_saves save
           where save.entity_type='release'
             and save.entity_id=v_release_id::text
             and save.entity_slug is distinct from
               v_plan->>'proposed_slug'
         )
      then
        v_failure := 'community_save_release_slug_mismatch';
      end if;

      if v_failure is null
         and exists (
           select 1
           from public.audience_interests interest
           where interest.entity_type='release'
             and interest.entity_id=v_release_id
             and interest.entity_slug is distinct from
               v_plan->>'proposed_slug'
         )
      then
        v_failure := 'audience_interest_release_slug_mismatch';
      end if;

      v_expected_entity_type := 'release';
      v_expected_entity_id := v_release_id::text;
      v_expected_field := 'slug';
      v_expected_target_path := 'public.registry_releases.slug';
      v_expected_action := 'canonicalize_release_slug';
      v_expected_value := v_plan->>'proposed_slug';

    else
      if not exists (
        select 1
        from public.wk_chart_entries_v2 entry
        where entry.id=v_plan->>'chart_entry_id'
          and entry.canonical_track_id=
            v_plan->>'canonical_track_id'
          and entry.track_slug=
            v_plan->>'canonical_track_slug'
      ) then
        v_failure := 'chart_track_slug_state_mismatch';
      end if;

      v_expected_entity_type := 'chart_entry';
      v_expected_entity_id := v_plan->>'chart_entry_id';
      v_expected_field := 'track_slug';
      v_expected_target_path :=
        'public.wk_chart_entries_v2.track_slug';
      v_expected_action := 'synchronize_chart_track_slug';
      v_expected_value := v_plan->>'canonical_track_slug';
    end if;
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_link_count
    from platform_private.registry_operation_write_events link
    where link.operation_id=v_operation.id;

    if v_link_count<>1 then
      v_failure := 'canonical_write_event_link_count_mismatch';
    end if;
  end if;

  if v_failure is null then
    select event.*
    into v_event
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
    limit 1;

    if not found
       or v_event.registry_entity_type<>
          v_expected_entity_type
       or v_event.registry_entity_id<>
          v_expected_entity_id
       or v_event.field_name<>
          v_expected_field
       or v_event.target_path<>
          v_expected_target_path
       or v_event.action<>
          v_expected_action
       or v_event.status<>'succeeded'
       or v_event.actor<>'system:mizizi'
       or v_event.after_value->>'value'
          is distinct from v_expected_value
    then
      v_failure := 'canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set
      verifier_status='passed',
      result_payload=
        result_payload ||
        jsonb_build_object(
          'verification',
          jsonb_build_object(
            'status','passed',
            'verified_at',now()
          )
        ),
      updated_at=now()
    where id=v_operation.id;

    operation_id := v_operation.id;
    verifier_status := 'passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set
    verifier_status='failed',
    error_code='mizizi_stage_b_verification_failed',
    error_message=v_failure,
    result_payload=
      result_payload ||
      jsonb_build_object(
        'verification',
        jsonb_build_object(
          'status','failed',
          'reason',v_failure,
          'verified_at',now()
        )
      ),
    updated_at=now()
  where id=v_operation.id;

  operation_id := v_operation.id;
  verifier_status := 'failed';
  return next;
end
$$;


create or replace function public.admin_issue_mizizi_stewardship_capability_grant_v1(
  p_capability_key text,
  p_expires_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation_key text;
  v_subject_type text;
  v_grant_id uuid;
begin
  if v_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  select
    operation_type.operation_key,
    operation_type.allowed_subject_types[1]
  into
    v_operation_key,
    v_subject_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_version=1
    and operation_type.capability_key=p_capability_key
    and operation_type.operation_key in (
      'registry.track_slug.canonicalize',
      'registry.release_taxonomy.repair',
      'registry.release_slug.canonicalize',
      'registry.chart_track_slug.synchronize'
    );

  if v_operation_key is null
     or v_subject_type is null
     or p_expires_at < now()+interval '5 minutes'
     or p_expires_at > now()+interval '30 days'
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason)>1000
  then
    raise exception using errcode='22023',
      message='Invalid bounded MIZIZI stewardship grant request.';
  end if;

  update platform_private.system_actor_capability_grants
  set
    status='expired',
    updated_at=now()
  where actor_key='mizizi'
    and capability_key=p_capability_key
    and status='active'
    and expires_at<=now();

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and capability_key=p_capability_key
      and status='active'
      and valid_from<=now()
      and expires_at>now()
  ) then
    raise exception using errcode='23505',
      message='An active MIZIZI grant already exists for this capability.';
  end if;

  insert into platform_private.system_actor_capability_grants (
    actor_key,
    capability_key,
    scope,
    status,
    valid_from,
    expires_at,
    granted_by_user_id,
    grant_reason
  )
  values (
    'mizizi',
    p_capability_key,
    jsonb_build_object(
      'operation_key',v_operation_key,
      'operation_version',1,
      'subject_type',v_subject_type,
      'max_rows',1
    ),
    'active',
    now(),
    p_expires_at,
    v_user_id,
    btrim(p_reason)
  )
  returning id into v_grant_id;

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    after_value,
    metadata
  )
  values (
    v_user_id,
    'registry_admin',
    'issue_mizizi_stewardship_capability_grant',
    'system_actor_capability_grant',
    v_grant_id,
    jsonb_build_object(
      'actor_key','mizizi',
      'capability_key',p_capability_key,
      'expires_at',p_expires_at
    ),
    jsonb_build_object(
      'operation_key',v_operation_key,
      'operation_version',1,
      'subject_type',v_subject_type,
      'reason',btrim(p_reason)
    )
  );

  return v_grant_id;
end
$$;

create or replace function public.admin_revoke_mizizi_stewardship_capability_grant_v1(
  p_grant_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows integer;
begin
  if v_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_grant_id is null
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason)>1000
  then
    raise exception using errcode='22023',
      message='Grant id and bounded revoke reason are required.';
  end if;

  update platform_private.system_actor_capability_grants
  set
    status='revoked',
    revoked_at=now(),
    revoked_by_user_id=v_user_id,
    revoke_reason=btrim(p_reason),
    updated_at=now()
  where id=p_grant_id
    and actor_key='mizizi'
    and capability_key in (
      'canonicalize_registry_track_slug',
      'repair_registry_release_taxonomy',
      'canonicalize_registry_release_slug',
      'synchronize_chart_track_slug'
    )
    and status='active';

  get diagnostics v_rows=row_count;

  if v_rows<>1 then
    raise exception using errcode='P0002',
      message='Active MIZIZI stewardship grant not found.';
  end if;

  return true;
end
$$;

create or replace function public.admin_set_mizizi_stewardship_operation_enabled_v1(
  p_operation_key text,
  p_enabled boolean,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_before boolean;
begin
  if v_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_operation_key not in (
       'registry.track_slug.canonicalize',
       'registry.release_taxonomy.repair',
       'registry.release_slug.canonicalize',
       'registry.chart_track_slug.synchronize'
     )
     or p_enabled is null
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason)>1000
  then
    raise exception using errcode='22023',
      message='Invalid bounded MIZIZI operation toggle.';
  end if;

  select enabled
  into v_before
  from platform_private.registry_operation_types
  where operation_key=p_operation_key
    and operation_version=1
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='MIZIZI stewardship operation type is missing.';
  end if;

  update platform_private.registry_operation_types
  set
    enabled=p_enabled,
    updated_at=now()
  where operation_key=p_operation_key
    and operation_version=1;

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    before_value,
    after_value,
    metadata
  )
  values (
    v_user_id,
    'registry_admin',
    'set_mizizi_stewardship_operation_enabled',
    'registry_operation_type',
    jsonb_build_object('enabled',v_before),
    jsonb_build_object('enabled',p_enabled),
    jsonb_build_object(
      'operation_key',p_operation_key,
      'operation_version',1,
      'reason',btrim(p_reason)
    )
  );

  return true;
end
$$;

revoke all on all functions in schema mizizi_private
  from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.assert_executor_v1(),
  mizizi_private.track_slug_plan_v1(uuid),
  mizizi_private.release_taxonomy_plan_v1(uuid),
  mizizi_private.release_slug_plan_v1(uuid),
  mizizi_private.chart_track_slug_plan_v1(text),
  mizizi_private.queue_registry_review_v1(
    text,text,text,text,text,text,text,text,numeric,text,text,jsonb
  ),
  mizizi_private.issue_stewardship_execution_grant_v1(text,text,text),
  mizizi_private.execute_stewardship_operation_v1(uuid),
  mizizi_private.verify_stewardship_operation_v1(uuid)
to mizizi_executor;

revoke all on function
  public.admin_issue_mizizi_stewardship_capability_grant_v1(text,timestamptz,text),
  public.admin_revoke_mizizi_stewardship_capability_grant_v1(uuid,text),
  public.admin_set_mizizi_stewardship_operation_enabled_v1(text,boolean,text)
from public, anon, service_role;

grant execute on function
  public.admin_issue_mizizi_stewardship_capability_grant_v1(text,timestamptz,text),
  public.admin_revoke_mizizi_stewardship_capability_grant_v1(uuid,text),
  public.admin_set_mizizi_stewardship_operation_enabled_v1(text,boolean,text)
to authenticated;

do $postflight$
declare
  v_role record;
begin
  if (
    select count(*)
    from platform_private.registry_operation_types
    where operation_version=1
      and operation_key in (
        'registry.track_slug.canonicalize',
        'registry.release_taxonomy.repair',
        'registry.release_slug.canonicalize',
        'registry.chart_track_slug.synchronize'
      )
      and enabled=false
      and max_targets=1
      and max_rows_ceiling=1
      and max_grant_ttl_seconds=300
      and requires_verifier=true
      and requires_existing_target=true
  )<>4 then
    raise exception 'STOP: Stage B operation registry shape is incomplete or unexpectedly enabled';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
      and revoked_at is null
  ) then
    raise exception 'STOP: Stage B created active MIZIZI standing authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='mizizi'
      and status='active'
      and expires_at>now()
      and revoked_at is null
      and consumed_at is null
  ) then
    raise exception 'STOP: Stage B created active MIZIZI exact authority';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='active'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings
       where actor_key='mizizi'
         and executor_kind='database_role'
         and executor_key='mizizi_executor'
         and status='disabled'
     )
  then
    raise exception 'STOP: Stage B changed executor binding activation state';
  end if;

  select
    rolcanlogin,
    rolsuper,
    rolcreatedb,
    rolcreaterole,
    rolreplication,
    rolbypassrls,
    rolinherit
  into v_role
  from pg_roles
  where rolname='mizizi_executor';

  if not found
     or not v_role.rolcanlogin
     or v_role.rolsuper
     or v_role.rolcreatedb
     or v_role.rolcreaterole
     or v_role.rolreplication
     or v_role.rolbypassrls
     or v_role.rolinherit
  then
    raise exception 'STOP: mizizi_executor role privilege shape is unsafe';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'DELETE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_releases',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_releases',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_releases',
       'DELETE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.wk_chart_entries_v2',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.wk_chart_entries_v2',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.wk_chart_entries_v2',
       'DELETE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'DELETE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_canonical_write_events',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_execution_grants',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_mutation_operations',
       'INSERT'
     )
  then
    raise exception 'STOP: mizizi_executor received direct governed mutation authority';
  end if;
end
$postflight$;
