-- Public Music Identity / Provider Identity convergence:
-- prospective Discography Track semantic-slug writer + strong-evidence resolver.
--
-- Canonical filename minted with Supabase CLI 2.107.0:
--   20261007181711_public_music_identity_track_semantic_writer_convergence_v1.sql
--
-- This migration changes prospective reviewed Discography policy only.
-- It does not rewrite any existing Track, credit, Chart, Community, redirect,
-- review, or canonical write-event row.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'public-music-identity-track-semantic-writer-convergence-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.registry_discography_resolve_track_v1(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_track_artist_desired_v1(uuid,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.freeze_registry_discography_review_plan_v1(uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_identity_canonical_isrc_v1(text)'
     ) is null
     or to_regprocedure(
       'public.resolve_registry_identity_lineage_v1(text,uuid,integer)'
     ) is null
     or to_regclass(
       'public.registry_external_identifier_assertions'
     ) is null
     or to_regclass(
       'public.registry_track_provider_links'
     ) is null
  then
    raise exception
      'Track semantic writer convergence preflight failed: accepted Registry/Provider Identity authority is missing.';
  end if;

  if to_regprocedure(
       'platform_private.registry_track_semantic_title_v1(text,text[])'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_discography_track_semantic_slug_v1(uuid,uuid,jsonb)'
     ) is not null
  then
    raise exception
      'Track semantic writer convergence helpers already exist; audit before reapplying.';
  end if;
end
$preflight$;

create function
platform_private.registry_track_semantic_title_v1(
  p_title text,
  p_featured_artist_names text[]
)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_title text;
  v_fragment text;
  v_fragment_slug text;
  v_featured_slugs text[]:='{}'::text[];
  v_name text;
  v_slug text;
begin
  v_title:=
    platform_private.registry_identity_normalize_text_v1(p_title);

  if nullif(btrim(v_title),'') is null then
    return null;
  end if;

  foreach v_name in array coalesce(p_featured_artist_names,'{}'::text[])
  loop
    v_slug:=public.wk_slugify_text(
      platform_private.registry_identity_normalize_text_v1(v_name)
    );

    if nullif(v_slug,'') is not null
       and array_position(v_featured_slugs,v_slug) is null
    then
      v_featured_slugs:=array_append(v_featured_slugs,v_slug);
    end if;
  end loop;

  if cardinality(v_featured_slugs)=0 then
    return v_title;
  end if;

  for v_fragment in
    select rm[1]
    from regexp_matches(
      v_title,
      '(\([^)]*\y(feat(uring)?|ft)\.?[[:space:]]+[^)]*\)|\[[^]]*\y(feat(uring)?|ft)\.?[[:space:]]+[^]]*\]|\{[^}]*\y(feat(uring)?|ft)\.?[[:space:]]+[^}]*\})',
      'gi'
    ) rm
  loop
    v_fragment_slug:=public.wk_slugify_text(v_fragment);

    if exists (
      select 1
      from unnest(v_featured_slugs) featured_slug
      where position(
        '-'||featured_slug||'-'
        in '-'||v_fragment_slug||'-'
      )>0
    ) then
      v_title:=replace(v_title,v_fragment,' ');
    end if;
  end loop;

  v_title:=btrim(
    regexp_replace(v_title,'[[:space:]]+',' ','g')
  );

  v_fragment:=null;
  select rm[1]
  into v_fragment
  from regexp_matches(
    v_title,
    '([[:space:]]+(-|:)?[[:space:]]*\y(feat(uring)?|ft)\.?[[:space:]]+.+)$',
    'i'
  ) rm
  limit 1;

  if v_fragment is not null
     and v_fragment !~ '[()[\]{}]'
  then
    v_fragment_slug:=public.wk_slugify_text(v_fragment);

    if exists (
      select 1
      from unnest(v_featured_slugs) featured_slug
      where position(
        '-'||featured_slug||'-'
        in '-'||v_fragment_slug||'-'
      )>0
    ) then
      v_title:=btrim(
        left(v_title,length(v_title)-length(v_fragment))
      );
    end if;
  end if;

  return nullif(
    btrim(
      regexp_replace(v_title,'[[:space:]]+',' ','g')
    ),
    ''
  );
end
$$;

revoke all on function
  platform_private.registry_track_semantic_title_v1(text,text[])
from public,anon,authenticated,service_role;

create function
platform_private.registry_discography_track_semantic_slug_v1(
  p_track_id uuid,
  p_current_artist_id uuid,
  p_track jsonb
)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_desired_credits jsonb;
  v_featured_names text[];
  v_semantic_title text;
begin
  if p_track_id is null
     or p_current_artist_id is null
     or p_track is null
     or jsonb_typeof(p_track)<>'object'
     or nullif(btrim(p_track->>'title'),'') is null
  then
    raise exception using errcode='22023',
      message='Discography semantic Track slug requires Track, Artist, and provider Track evidence.';
  end if;

  v_desired_credits:=
    platform_private.registry_discography_track_artist_desired_v1(
      p_track_id,
      p_current_artist_id,
      null,
      p_track
    );

  select coalesce(
    array_agg(
      distinct credit->>'artist_name_text'
      order by credit->>'artist_name_text'
    ) filter (
      where coalesce((credit->>'is_featured')::boolean,false)
        and nullif(btrim(credit->>'artist_name_text'),'') is not null
    ),
    '{}'::text[]
  )
  into v_featured_names
  from jsonb_array_elements(
    coalesce(v_desired_credits,'[]'::jsonb)
  ) credit;

  v_semantic_title:=
    platform_private.registry_track_semantic_title_v1(
      p_track->>'title',
      v_featured_names
    );

  if v_semantic_title is null then
    return null;
  end if;

  return public.wk_slugify_text(v_semantic_title);
end
$$;

revoke all on function
  platform_private.registry_discography_track_semantic_slug_v1(uuid,uuid,jsonb)
from public,anon,authenticated,service_role;

create or replace function
platform_private.registry_discography_resolve_track_v1(
  p_artist_id uuid,
  p_track jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_apple_id text:=nullif(btrim(p_track->>'apple_music_id'),'');
  v_isrc text;
  v_source_ids uuid[]:='{}'::uuid[];
  v_current_ids uuid[]:='{}'::uuid[];
  v_source_id uuid;
  v_current_id uuid;
  v_lineage jsonb;
  v_lineage_status text;
  v_source_has_current boolean;
begin
  if p_artist_id is null
     or p_track is null
     or jsonb_typeof(p_track)<>'object'
     or v_apple_id is null
     or nullif(btrim(p_track->>'title'),'') is null
  then
    raise exception using errcode='22023',
      message='Track resolution requires exact Artist and provider Track identity.';
  end if;

  perform 1
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status<>'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Discography Track resolution Artist is missing or archived.';
  end if;

  v_isrc:=
    platform_private.registry_identity_canonical_isrc_v1(
      nullif(p_track->>'isrc','')
    );

  select coalesce(
    array_agg(candidate.track_id order by candidate.track_id),
    '{}'::uuid[]
  )
  into v_source_ids
  from (
    select distinct link.track_id
    from public.registry_track_provider_links link
    where link.provider_key='apple_music'
      and link.provider_track_id=v_apple_id
      and link.match_status='matched'

    union

    select distinct track.id
    from public.registry_tracks track
    where nullif(
            btrim(track.metadata->>'apple_music_track_id'),
            ''
          )=v_apple_id

    union

    select distinct track.id
    from public.registry_tracks track
    where v_isrc is not null
      and track.isrc=v_isrc

    union

    select distinct assertion.track_id
    from public.registry_external_identifier_assertions assertion
    where assertion.track_id is not null
      and assertion.assertion_status='accepted'
      and assertion.valid_to is null
      and assertion.issuer_namespace is null
      and (
        (
          assertion.scheme_key='apple_music'
          and assertion.comparison_value=v_apple_id
        )
        or (
          v_isrc is not null
          and assertion.scheme_key='isrc'
          and upper(
                regexp_replace(
                  btrim(assertion.comparison_value),
                  '[^A-Za-z0-9]+',
                  '',
                  'g'
                )
              )=v_isrc
        )
      )
  ) candidate;

  if cardinality(v_source_ids)=0 then
    return null;
  end if;

  foreach v_source_id in array v_source_ids
  loop
    v_lineage:=public.resolve_registry_identity_lineage_v1(
      'track',
      v_source_id,
      16
    );
    v_lineage_status:=v_lineage->>'resolution_status';

    if v_lineage_status not in ('current','successor') then
      raise exception using errcode='40001',
        message=
          'Strong Track identity is not one unambiguous current Registry Track; review is required.';
    end if;

    v_source_has_current:=false;

    for v_current_id in
      select value::uuid
      from jsonb_array_elements_text(
        coalesce(v_lineage->'current_entity_ids','[]'::jsonb)
      ) value
      order by value
    loop
      perform 1
      from public.registry_tracks track
      where track.id=v_current_id
        and track.status<>'archived';

      if found then
        v_source_has_current:=true;

        if array_position(v_current_ids,v_current_id) is null then
          v_current_ids:=array_append(v_current_ids,v_current_id);
        end if;
      end if;
    end loop;

    if not v_source_has_current then
      raise exception using errcode='40001',
        message=
          'Strong Track identity resolves only to archived or missing Registry state; review is required.';
    end if;
  end loop;

  if cardinality(v_current_ids)<>1 then
    raise exception using errcode='40001',
      message=
        'Strong Track identity resolves to multiple current Registry Tracks; review is required.';
  end if;

  return v_current_ids[1];
end
$$;

revoke all on function
  platform_private.registry_discography_resolve_track_v1(uuid,jsonb)
from public,anon,authenticated,service_role;

create or replace function
platform_private.registry_discography_build_frozen_plan_v1(
  p_artist_id uuid,
  p_evidence_assertion_id uuid,
  p_snapshot_id uuid,
  p_reviewed_selections jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_snapshot platform_private.registry_discography_provider_snapshots%rowtype;
  v_plan jsonb;
  v_operations jsonb:='[]'::jsonb;
  v_operation jsonb;
  v_existing_album_ids jsonb;
  v_new_album_ids jsonb;
  v_union_album_ids jsonb;
  v_track_reconciliations jsonb:='{}'::jsonb;
  v_subject_id uuid;
  v_track_apple_id text;
  v_track jsonb;
  v_create jsonb;
  v_current_status text;
  v_current_slug text;
  v_canonical_slug text;
  v_inserted_track_reconciliations integer:=0;
  v_identity_reconciliation_count integer:=0;
begin
  select snapshot.*
  into v_snapshot
  from platform_private.registry_discography_provider_snapshots snapshot
  where snapshot.id=p_snapshot_id
    and snapshot.artist_id=p_artist_id;

  if not found then
    raise exception using errcode='P0002',
      message='Immutable Discography snapshot is missing.';
  end if;

  select coalesce(
    artist.metadata->'apple_music_album_ids',
    '[]'::jsonb
  )
  into v_existing_album_ids
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status<>'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Discography Artist is missing.';
  end if;

  if jsonb_typeof(v_existing_album_ids)<>'array' then
    raise exception using errcode='22023',
      message='Artist Apple Music album identity ledger is not an array.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_existing_album_ids) existing_id
    where nullif(btrim(existing_id),'') is null
       or existing_id !~ '^[0-9]+$'
  ) then
    raise exception using errcode='22023',
      message='Artist Apple Music album identity ledger contains an invalid provider id.';
  end if;

  v_plan:=
    platform_private.registry_discography_build_frozen_plan_pre_selective_v1(
      p_artist_id,
      p_evidence_assertion_id,
      p_snapshot_id,
      p_reviewed_selections
    );

  for v_operation in
    select value
    from jsonb_array_elements(coalesce(v_plan->'operations','[]'::jsonb))
    where value->>'operation_key'='registry.track.provider_profile.admit'
    order by value->>'subject_id'
  loop
    v_subject_id:=(v_operation->>'subject_id')::uuid;
    v_track_apple_id:=v_operation#>>'{payload,apple_music_track_id}';

    select track_payload
    into v_track
    from jsonb_array_elements(v_snapshot.observation->'albums') album
    cross join lateral jsonb_array_elements(album->'tracks') track_payload
    where track_payload->>'apple_music_id'=v_track_apple_id
    limit 1;

    if v_track is null then
      raise exception using errcode='40001',
        message='Accepted Track disappeared from immutable provider evidence.';
    end if;

    v_canonical_slug:=
      platform_private.registry_discography_track_semantic_slug_v1(
        v_subject_id,
        p_artist_id,
        v_track
      );

    if nullif(v_canonical_slug,'') is null then
      raise exception using errcode='40001',
        message='Reviewed provider Track has no semantic route identity.';
    end if;

    select track.status,track.slug
    into v_current_status,v_current_slug
    from public.registry_tracks track
    where track.id=v_subject_id;

    if not found then
      select value
      into v_create
      from jsonb_array_elements(coalesce(v_plan->'operations','[]'::jsonb))
      where value->>'operation_key'='registry.track.create'
        and (value->>'subject_id')::uuid=v_subject_id;

      if v_create is null then
        raise exception using errcode='40001',
          message='Future accepted Track has no frozen materialization operation.';
      end if;

      v_current_status:='draft';
      v_current_slug:=v_create#>>'{payload,slug}';
    end if;

    if v_current_status not in ('draft','active') then
      raise exception using errcode='23514',
        message='Active Discography ingest only accepts active or draft Track targets.';
    end if;

    if v_current_status='draft'
       and v_current_slug is distinct from v_canonical_slug
    then
      v_track_reconciliations:=jsonb_set(
        v_track_reconciliations,
        array[v_subject_id::text],
        jsonb_build_object(
          'ref','track.identity_reconcile:'||v_subject_id::text,
          'kind','identity_reconciliation',
          'operation_key','registry.draft_identity.reconcile',
          'subject_type','track',
          'subject_id',v_subject_id,
          'payload',jsonb_build_object(
            'current_slug',v_current_slug,
            'canonical_slug',v_canonical_slug,
            'identity_artist_id',p_artist_id,
            'reason','reviewed_provider_track_semantic_identity'
          )
        ),
        true
      );
    end if;
  end loop;

  for v_operation in
    select value
    from jsonb_array_elements(coalesce(v_plan->'operations','[]'::jsonb))
    with ordinality as operation(value,ordinality)
    order by ordinality
  loop
    if v_operation->>'kind'='identity_reconciliation'
       and v_operation->>'operation_key'='registry.draft_identity.reconcile'
       and v_operation->>'subject_type'='track'
    then
      continue;
    end if;

    if v_operation->>'operation_key'=
       'registry.artist.discography_summary.admit'
    then
      v_new_album_ids:=coalesce(
        v_operation#>'{payload,apple_music_album_ids}',
        '[]'::jsonb
      );

      if jsonb_typeof(v_new_album_ids)<>'array' then
        raise exception using errcode='22023',
          message='Reviewed Artist Discography summary album ids are not an array.';
      end if;

      if exists (
        select 1
        from jsonb_array_elements_text(v_new_album_ids) new_id
        where nullif(btrim(new_id),'') is null
           or new_id !~ '^[0-9]+$'
      ) then
        raise exception using errcode='22023',
          message='Reviewed Artist Discography summary contains an invalid provider id.';
      end if;

      select coalesce(
        jsonb_agg(to_jsonb(album_id) order by album_id),
        '[]'::jsonb
      )
      into v_union_album_ids
      from (
        select distinct album_id
        from (
          select value as album_id
          from jsonb_array_elements_text(v_existing_album_ids)
          union all
          select value as album_id
          from jsonb_array_elements_text(v_new_album_ids)
        ) ids
      ) deduped;

      v_operation:=jsonb_set(
        v_operation,
        '{payload,apple_music_album_ids}',
        v_union_album_ids,
        true
      );
    end if;

    if v_operation->>'operation_key'='registry.track.activate'
       and v_track_reconciliations ? (v_operation->>'subject_id')
    then
      v_operations:=
        v_operations||
        jsonb_build_array(
          v_track_reconciliations->(v_operation->>'subject_id')
        );
      v_inserted_track_reconciliations:=
        v_inserted_track_reconciliations+1;
    end if;

    v_operations:=v_operations||jsonb_build_array(v_operation);
  end loop;

  if v_inserted_track_reconciliations<>
     jsonb_object_length(v_track_reconciliations)
  then
    raise exception using errcode='40001',
      message='Semantic Track reconciliation could not be ordered before activation.';
  end if;

  select count(*)::integer
  into v_identity_reconciliation_count
  from jsonb_array_elements(v_operations) operation_row
  where operation_row->>'kind'='identity_reconciliation';

  return
    (v_plan-'operations'-'summary'-'plan_version')
    || jsonb_build_object(
      'plan_version',4,
      'operations',v_operations,
      'summary',
        coalesce(v_plan->'summary','{}'::jsonb)
        || jsonb_build_object(
          'identity_reconciliations',
          v_identity_reconciliation_count
        )
    );
end
$$;

create or replace function
platform_private.freeze_registry_discography_review_plan_v1(
  p_artist_id uuid,
  p_evidence_assertion_id uuid,
  p_reviewed_selections jsonb
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_snapshot platform_private.registry_discography_provider_snapshots%rowtype;
  v_normalized jsonb;
  v_selection_fingerprint text;
  v_frozen_plan jsonb;
  v_plan_fingerprint text;
  v_review_plan_id uuid;
begin
  v_user_id:=platform_private.registry_discography_current_admin_v1();

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.subject_id<>p_artist_id
     or v_evidence.claim_key<>'registry.artist.discography.provider_snapshot'
     or v_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
     or v_evidence.observed_at<now()-interval '30 days'
     or v_evidence.observed_at>now()+interval '5 minutes'
  then
    raise exception using errcode='42501',
      message='Reviewed Discography evidence is missing, stale, or belongs to another principal/Artist.';
  end if;

  select snapshot.*
  into v_snapshot
  from platform_private.registry_discography_provider_snapshots snapshot
  where snapshot.id=(v_evidence.claim_payload->>'snapshot_id')::uuid
    and snapshot.artist_id=p_artist_id
    and snapshot.recorded_by_user_id=v_user_id
    and snapshot.source_payload_fingerprint=
        v_evidence.source_payload_fingerprint
    and snapshot.observation_fingerprint=
        v_evidence.claim_payload->>'observation_fingerprint';

  if not found
     or platform_private.registry_discography_observation_fingerprint_v1(
          v_snapshot.observation
        )<>v_snapshot.observation_fingerprint
  then
    raise exception using errcode='42501',
      message='Immutable Discography provider snapshot no longer satisfies reviewed evidence.';
  end if;

  v_normalized:=
    platform_private.registry_discography_normalize_reviewed_selections_v1(
      p_artist_id,
      v_snapshot.observation,
      p_reviewed_selections
    );

  v_selection_fingerprint:=
    platform_private.registry_discography_set_fingerprint_v1(
      jsonb_build_object(
        'reviewed_selections',v_normalized,
        'planner_version',4,
        'terminal_policy','active_ingest_v2'
      )
    );

  select review.id
  into v_review_plan_id
  from platform_private.registry_discography_review_plans review
  where review.reviewed_by_user_id=v_user_id
    and review.evidence_assertion_id=p_evidence_assertion_id
    and review.selection_fingerprint=v_selection_fingerprint;

  if found then
    return v_review_plan_id;
  end if;

  v_frozen_plan:=
    platform_private.registry_discography_build_frozen_plan_v1(
      p_artist_id,
      p_evidence_assertion_id,
      v_snapshot.id,
      v_normalized
    );

  v_plan_fingerprint:=
    platform_private.registry_discography_observation_fingerprint_v1(
      v_frozen_plan
    );

  insert into platform_private.registry_discography_review_plans (
    artist_id,evidence_assertion_id,snapshot_id,reviewed_by_user_id,
    reviewed_selections,selection_fingerprint,
    frozen_plan,frozen_plan_fingerprint
  )
  values (
    p_artist_id,p_evidence_assertion_id,v_snapshot.id,v_user_id,
    v_normalized,v_selection_fingerprint,
    v_frozen_plan,v_plan_fingerprint
  )
  on conflict (
    reviewed_by_user_id,evidence_assertion_id,selection_fingerprint
  ) do nothing
  returning id into v_review_plan_id;

  if v_review_plan_id is null then
    select review.id
    into v_review_plan_id
    from platform_private.registry_discography_review_plans review
    where review.reviewed_by_user_id=v_user_id
      and review.evidence_assertion_id=p_evidence_assertion_id
      and review.selection_fingerprint=v_selection_fingerprint;
  end if;

  return v_review_plan_id;
end
$$;

do $verify$
declare
  v_definition text;
  v_role text;
begin
  if public.wk_slugify_text(
       platform_private.registry_track_semantic_title_v1(
         'FICHA WHITE (feat. Jovie Jovv, Shappaman & KXOBIE)',
         array['Jovie Jovv','Shappaman','KXOBIE']::text[]
       )
     )<>'ficha-white'
     or public.wk_slugify_text(
          platform_private.registry_track_semantic_title_v1(
            'Song ft. Artist B',
            array['Artist B']::text[]
          )
        )<>'song'
     or public.wk_slugify_text(
          platform_private.registry_track_semantic_title_v1(
            'Song ft. Artist B',
            '{}'::text[]
          )
        )<>'song-ft-artist-b'
     or public.wk_slugify_text(
          platform_private.registry_track_semantic_title_v1(
            'Road to Ft. Lauderdale',
            array['Someone Else']::text[]
          )
        )<>'road-to-ft-lauderdale'
     or public.wk_slugify_text(
          platform_private.registry_track_semantic_title_v1(
            'Song feat. Artist B (Remix)',
            array['Artist B']::text[]
          )
        )<>'song-feat-artist-b-remix'
     or public.wk_slugify_text(
          platform_private.registry_track_semantic_title_v1(
            'Nana (feat. Joeboy, King Promise & Bien) [Remix]',
            array['Joeboy','King Promise','Bien']::text[]
          )
        )<>'nana-remix'
  then
    raise exception
      'Track semantic title authority failed adversarial structural-credit fixtures.';
  end if;

  select lower(
    pg_get_functiondef(
      'platform_private.registry_discography_track_semantic_slug_v1(uuid,uuid,jsonb)'::regprocedure
    )
  )
  into v_definition;

  if position('registry_discography_track_artist_desired_v1' in v_definition)=0
     or position('is_featured' in v_definition)=0
     or position('registry_track_semantic_title_v1' in v_definition)=0
  then
    raise exception
      'Discography semantic Track slug is not bound to frozen credit semantics.';
  end if;

  select lower(
    pg_get_functiondef(
      'platform_private.registry_discography_resolve_track_v1(uuid,jsonb)'::regprocedure
    )
  )
  into v_definition;

  if position('registry_track_provider_links' in v_definition)=0
     or position('match_status=''matched''' in v_definition)=0
     or position('apple_music_track_id' in v_definition)=0
     or position('registry_identity_canonical_isrc_v1' in v_definition)=0
     or position('registry_external_identifier_assertions' in v_definition)=0
     or position('resolve_registry_identity_lineage_v1' in v_definition)=0
     or position('assertion_status=''accepted''' in v_definition)=0
  then
    raise exception
      'Discography Track resolver lost required strong-evidence authority.';
  end if;

  if position('track.slug' in v_definition)>0
     or position('track.normalized_title' in v_definition)>0
     or position('registry_track_creation_slug_v1' in v_definition)>0
  then
    raise exception
      'Discography Track resolver still contains weak slug/title canonical resolution.';
  end if;

  select lower(
    pg_get_functiondef(
      'platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)'::regprocedure
    )
  )
  into v_definition;

  if position('registry_discography_track_semantic_slug_v1' in v_definition)=0
     or position('reviewed_provider_track_semantic_identity' in v_definition)=0
     or position('''plan_version'',4' in v_definition)=0
  then
    raise exception
      'Reviewed Discography planner is not bound to prospective semantic Track identity V4.';
  end if;

  select lower(
    pg_get_functiondef(
      'platform_private.freeze_registry_discography_review_plan_v1(uuid,uuid,jsonb)'::regprocedure
    )
  )
  into v_definition;

  if position('''planner_version'',4' in v_definition)=0
     or position('active_ingest_v2' in v_definition)=0
  then
    raise exception
      'Discography review fingerprint did not advance to semantic Track planner V4.';
  end if;

  foreach v_role in array array[
    'public','anon','authenticated','service_role'
  ]
  loop
    if has_function_privilege(
         v_role,
         'platform_private.registry_track_semantic_title_v1(text,text[])',
         'EXECUTE'
       )
       or has_function_privilege(
         v_role,
         'platform_private.registry_discography_track_semantic_slug_v1(uuid,uuid,jsonb)',
         'EXECUTE'
       )
       or has_function_privilege(
         v_role,
         'platform_private.registry_discography_resolve_track_v1(uuid,jsonb)',
         'EXECUTE'
       )
    then
      raise exception
        'Track semantic/strong-evidence private authority leaked EXECUTE to role %.',
        v_role;
    end if;
  end loop;
end
$verify$;

commit;
