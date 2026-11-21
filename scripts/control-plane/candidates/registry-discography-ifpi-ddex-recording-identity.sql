-- WAKILISHA IFPI/DDEX recording identity correction.
-- This is an exact source candidate, NOT yet a Supabase CLI-minted migration.
-- Only the native CLI should mint the authoritative timestamped migration path.
-- Candidate derived from validated isolated Registry Preview functions.
-- Production unchanged; do not execute this file against Production before release approval.
do $wk_preflight$
begin
  if to_regprocedure('platform_private.registry_discography_track_variant_slug_v1(text,uuid,text)') is not null then raise exception 'Unexpected pre-existing Discography variant helper: platform_private.registry_discography_track_variant_slug_v1(text,uuid,text)'; end if;
  if to_regprocedure('platform_private.registry_discography_variant_creation_collision_state_v1(uuid,text,uuid,text,text)') is not null then raise exception 'Unexpected pre-existing Discography variant helper: platform_private.registry_discography_variant_creation_collision_state_v1(uuid,text,uuid,text,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_resolve_track_v1(uuid,jsonb)')) is distinct from 'e85c9f9057f1d99135708437f6b972fa' then raise exception 'Discography frozen baseline differs: platform_private.registry_discography_resolve_track_v1(uuid,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_build_frozen_plan_core_v1(uuid,uuid,uuid,jsonb)')) is distinct from '2039b9d5ea04186838ef47c200b98f89' then raise exception 'Discography frozen baseline differs: platform_private.registry_discography_build_frozen_plan_core_v1(uuid,uuid,uuid,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)')) is distinct from '50d2e0b324233bfa572b4569d491878a' then raise exception 'Discography frozen baseline differs: platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)')) is distinct from 'bd325b01ef4cbf8d0740e02b749b53db' then raise exception 'Discography frozen baseline differs: platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.execute_registry_materialization_core_v1(text,uuid)')) is distinct from 'd284e0408fde554db9f91a4bad199901' then raise exception 'Discography frozen baseline differs: platform_private.execute_registry_materialization_core_v1(text,uuid)'; end if;
end
$wk_preflight$;

CREATE OR REPLACE FUNCTION platform_private.registry_discography_track_variant_slug_v1(p_title text, p_artist_id uuid, p_isrc text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
declare
  v_base text;
  v_isrc text;
begin
  v_isrc:=platform_private.registry_identity_canonical_isrc_v1(p_isrc);
  v_base:=platform_private.registry_track_creation_slug_v1(p_title,p_artist_id);
  if nullif(v_base,'') is null or v_isrc is null then
    raise exception using errcode='22023',
      message='Distinct recording route requires current Artist, title and valid recording ISRC.';
  end if;
  return v_base||'-'||lower(v_isrc);
end
$function$;

CREATE OR REPLACE FUNCTION platform_private.registry_discography_variant_creation_collision_state_v1(p_future_track_id uuid, p_title text, p_artist_id uuid, p_isrc text, p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
declare
  v_state jsonb;
  v_isrc text;
begin
  v_isrc:=platform_private.registry_identity_canonical_isrc_v1(p_isrc);
  if p_future_track_id is null
    or p_slug is distinct from platform_private.registry_discography_track_variant_slug_v1(p_title,p_artist_id,v_isrc)
  then
    raise exception using errcode='22023',
      message='Distinct recording route is not consistent with Artist and valid ISRC.';
  end if;
  -- Different verified ISRCs support distinct recording identities. A live
  -- same-title Track with no ISRC is unknown, not evidence of a new master.
  -- Unpublished needs_review placeholders are retained without being merged.
  select coalesce(jsonb_agg(c order by c->>'registry_entity_id',c->>'reason'),'[]'::jsonb)
  into v_state
  from jsonb_array_elements(
    platform_private.registry_track_creation_collision_state_v1(
      p_future_track_id,p_title,p_artist_id,v_isrc
    )
  ) c
  left join public.registry_tracks other
    on other.id=(c->>'registry_entity_id')::uuid
  where c->>'reason' in ('future_id','isrc')
     or (
       c->>'reason' in ('slug','title_artist')
       and other.status<>'needs_review'
       and other.isrc is null
     );

  select v_state||coalesce(jsonb_agg(jsonb_build_object(
    'registry_entity_id',track.id,'reason','variant_slug'
  ) order by track.id),'[]'::jsonb)
  into v_state
  from public.registry_tracks track
  where track.status<>'archived'
    and track.id<>p_future_track_id
    and track.slug=p_slug
    and exists (
      select 1 from public.registry_track_artists credit
      where credit.track_id=track.id and credit.artist_id=p_artist_id
        and credit.status<>'archived'
    );
  return v_state;
end
$function$;

CREATE OR REPLACE FUNCTION platform_private.registry_discography_resolve_track_v1(p_artist_id uuid, p_track jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
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
      raise exception using errcode='PT409',
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
      raise exception using errcode='PT409',
        message=
          'Strong Track identity resolves only to archived or missing Registry state; review is required.';
    end if;
  end loop;

  if cardinality(v_current_ids)<>1 then
    raise exception using errcode='PT409',
      message=
        'Strong Track identity resolves to multiple current Registry Tracks; review is required.';
  end if;

  if v_isrc is not null
    and exists (
      select 1 from public.registry_tracks existing
      where existing.id=v_current_ids[1]
        and existing.isrc is not null
        and existing.isrc<>v_isrc
    )
  then
    raise exception using errcode='PT409',
      message='Strong Apple Music Track identity contradicts existing recording ISRC; review required.';
  end if;

  return v_current_ids[1];
end
$function$;

CREATE OR REPLACE FUNCTION platform_private.registry_discography_build_frozen_plan_core_v1(p_artist_id uuid, p_evidence_assertion_id uuid, p_snapshot_id uuid, p_reviewed_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
declare
  v_snapshot platform_private.registry_discography_provider_snapshots%rowtype;
  v_artist public.registry_artists%rowtype;
  v_selection jsonb;
  v_album jsonb;
  v_track jsonb;
  v_release_id uuid;
  v_track_id uuid;
  v_release_is_new boolean;
  v_track_is_new boolean;
  v_release_key text;
  v_track_key text;
  v_release_identity_key text;
  v_track_identity_key text;
  v_release_identity_map jsonb := '{}'::jsonb;
  v_track_identity_map jsonb := '{}'::jsonb;
  v_release_buckets jsonb := '{}'::jsonb;
  v_track_buckets jsonb := '{}'::jsonb;
  v_bucket jsonb;
  v_desired jsonb;
  v_current jsonb;
  v_final jsonb;
  v_delta jsonb;
  v_operations jsonb := '[]'::jsonb;
  v_pair record;
  v_profile jsonb;
  v_collision_state jsonb;
  v_collision_fingerprint text;
  v_upc text;
  v_isrc text;
  v_slug text;
  v_all_album_ids jsonb;
  v_ignored integer := 0;
  v_merged integer := 0;
  v_canonicalized integer := 0;
  v_track_occurrences integer := 0;
  v_featured_links integer := 0;
  v_count integer;
begin
  select snapshot.*
  into v_snapshot
  from platform_private.registry_discography_provider_snapshots snapshot
  where snapshot.id=p_snapshot_id
    and snapshot.artist_id=p_artist_id;

  if not found then
    raise exception using errcode='P0002', message='Immutable Discography snapshot is missing.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status <> 'archived';

  if not found then
    raise exception using errcode='P0002', message='Discography Artist is missing.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(selection->>'apple_music_id') order by selection->>'apple_music_id'),'[]'::jsonb)
  into v_all_album_ids
  from jsonb_array_elements(p_reviewed_selections) selection;

  for v_selection in
    select value
    from jsonb_array_elements(p_reviewed_selections)
    order by value->>'apple_music_id'
  loop
    if v_selection->>'action'='ignore' then
      v_ignored := v_ignored+1;
      continue;
    end if;

    select value
    into v_album
    from jsonb_array_elements(v_snapshot.observation->'albums')
    where value->>'apple_music_id'=v_selection->>'apple_music_id';

    if v_album is null then
      raise exception using errcode='40001',
        message='Reviewed Album disappeared from immutable provider snapshot.';
    end if;

    v_upc := platform_private.registry_identity_canonical_upc_v1(nullif(v_album->>'upc',''));
    v_slug := platform_private.registry_release_creation_slug_v1(v_album->>'title',p_artist_id);
    v_release_identity_key := case
      when v_upc is not null then 'upc:'||v_upc
      else 'slug:'||v_slug
    end;

    if v_release_identity_map ? v_release_identity_key then
      v_release_id := (v_release_identity_map->>v_release_identity_key)::uuid;
      v_release_is_new := coalesce((v_release_buckets->v_release_id::text->>'is_new')::boolean,false);
    else
      v_release_id := platform_private.registry_discography_resolve_release_v1(p_artist_id,v_album);
      v_release_is_new := v_release_id is null;
      if v_release_is_new then
        v_release_id := platform_private.registry_discography_deterministic_uuid_v1(
          'release.apple_music',
          v_album->>'apple_music_id'
        );
      end if;
      v_release_identity_map := jsonb_set(
        v_release_identity_map,
        array[v_release_identity_key],
        to_jsonb(v_release_id::text),
        true
      );
    end if;

    v_release_key := v_release_id::text;
    if v_release_buckets ? v_release_key then
      raise exception using errcode='22023',
        message='Two reviewed provider Albums converge onto the same Registry Release; review them separately in V1.';
    end if;

    if v_release_is_new then
      v_canonicalized := v_canonicalized+1;
    else
      v_merged := v_merged+1;
    end if;

    v_profile := jsonb_build_object(
      'release_type',v_album->>'release_type',
      'release_date',nullif(v_album->>'release_date',''),
      'artwork_url',nullif(v_album->>'artwork_url',''),
      'apple_music_album_id',v_album->>'apple_music_id',
      'apple_music_url',nullif(v_album->>'apple_music_url',''),
      'genre_names',coalesce(v_album->'genre_names','[]'::jsonb),
      'record_label',nullif(v_album->>'record_label',''),
      'source','apple_music_ingest'
    );

    v_bucket := jsonb_build_object(
      'release_id',v_release_id,
      'is_new',v_release_is_new,
      'action',v_selection->>'action',
      'title',v_album->>'title',
      'normalized_title',platform_private.registry_identity_normalize_text_v1(v_album->>'title'),
      'slug',v_slug,
      'upc',v_upc,
      'profile',v_profile,
      'desired_artist_rows',platform_private.registry_discography_release_artist_desired_v1(
        v_release_id,
        p_artist_id,
        v_album,
        v_selection->'additional_primary_artists'
      ),
      'desired_track_rows','[]'::jsonb
    );

    for v_track in
      select value
      from jsonb_array_elements(v_album->'tracks')
      order by coalesce((value->>'disc_number')::integer,1),
               coalesce((value->>'track_number')::integer,2147483647),
               value->>'apple_music_id'
    loop
      v_track_occurrences := v_track_occurrences+1;
      v_isrc := platform_private.registry_identity_canonical_isrc_v1(nullif(v_track->>'isrc',''));
      v_slug := platform_private.registry_track_creation_slug_v1(v_track->>'title',p_artist_id);
      v_track_identity_key := case
        when v_isrc is not null then 'isrc:'||v_isrc
        else 'slug:'||v_slug
      end;

      if v_track_identity_map ? v_track_identity_key then
        v_track_id := (v_track_identity_map->>v_track_identity_key)::uuid;
        v_track_is_new := coalesce((v_track_buckets->v_track_id::text->>'is_new')::boolean,false);
      else
        v_track_id := platform_private.registry_discography_resolve_track_v1(p_artist_id,v_track);
        v_track_is_new := v_track_id is null;
        if v_track_is_new then
          v_track_id := platform_private.registry_discography_deterministic_uuid_v1(
            'track.apple_music',
            v_track->>'apple_music_id'
          );
        end if;
        v_track_identity_map := jsonb_set(
          v_track_identity_map,
          array[v_track_identity_key],
          to_jsonb(v_track_id::text),
          true
        );
      end if;

      -- ISRC is a recording identity; an earlier Single's title is not
      -- authority to merge a distinct, strongly identified Album master.
      if v_track_is_new then
        v_collision_state := platform_private.registry_track_creation_collision_state_v1(
          v_track_id,v_track->>'title',p_artist_id,v_isrc
        );
        if v_collision_state <> '[]'::jsonb then
          if v_isrc is null
             or exists (
               select 1 from jsonb_array_elements(v_collision_state) collision
               where collision->>'reason' in ('future_id','isrc')
             ) then
            raise exception using errcode='PT409',
              message='Discography Track identity needs review: album='
                ||(v_album->>'apple_music_id')||', track='
                ||(v_track->>'apple_music_id')||', title='
                ||(v_track->>'title')||'.';
          end if;
          v_slug:=platform_private.registry_discography_track_variant_slug_v1(
            v_track->>'title',p_artist_id,v_isrc
          );
        end if;
      end if;

      if exists (
        select 1
        from jsonb_array_elements(v_bucket->'desired_track_rows') row_payload
        where row_payload->>'track_id'=v_track_id::text
          and (
            coalesce((row_payload->>'disc_number')::integer,1) is distinct from coalesce((v_track->>'disc_number')::integer,1)
            or (row_payload->>'track_number')::integer is distinct from (v_track->>'track_number')::integer
          )
      ) then
        raise exception using errcode='22023',
          message='Provider Album maps two positions onto one canonical Track; V1 refuses ambiguous sequencing.';
      end if;

      if not exists (
        select 1
        from jsonb_array_elements(v_bucket->'desired_track_rows') row_payload
        where row_payload->>'track_id'=v_track_id::text
      ) then
        v_bucket := jsonb_set(
          v_bucket,
          '{desired_track_rows}',
          (v_bucket->'desired_track_rows') || jsonb_build_array(
            jsonb_build_object(
              'release_id',v_release_id,
              'track_id',v_track_id,
              'disc_number',coalesce((v_track->>'disc_number')::integer,1),
              'track_number',case when v_track->>'track_number' is null then null else (v_track->>'track_number')::integer end,
              'source','apple_music_ingest',
              'confidence',90,
              'status','active',
              'metadata',jsonb_build_object(
                'apple_music_track_id',v_track->>'apple_music_id',
                'apple_music_album_id',v_album->>'apple_music_id'
              )
            )
          ),
          true
        );
      end if;

      v_desired := platform_private.registry_discography_track_artist_desired_v1(
        v_track_id,
        p_artist_id,
        v_album->>'apple_music_id',
        v_track
      );
      v_track_key := v_track_id::text;

      v_profile := jsonb_build_object(
        'duration_ms',case when v_track->>'duration_ms' is null then null else (v_track->>'duration_ms')::integer end,
        'explicit',coalesce((v_track->>'explicit')::boolean,false),
        'track_number',case when v_track->>'track_number' is null then null else (v_track->>'track_number')::integer end,
        'disc_number',coalesce((v_track->>'disc_number')::integer,1),
        'artwork_url',coalesce(nullif(v_track->>'artwork_url',''),nullif(v_album->>'artwork_url','')),
        'preview_url',nullif(v_track->>'preview_url',''),
        'apple_music_track_id',v_track->>'apple_music_id',
        'apple_music_album_id',v_album->>'apple_music_id',
        'genre_names',coalesce(v_track->'genre_names','[]'::jsonb),
        'source','apple_music_ingest'
      );
      if v_track_buckets ? v_track_key then
        if (v_track_buckets->v_track_key->'profile') is distinct from v_profile then
          raise exception using errcode='22023',
            message='Selected provider Albums resolve to one canonical Track with conflicting provider profile facts.';
        end if;
        v_bucket := jsonb_set(
          v_track_buckets->v_track_key,
          '{desired_credit_rows}',
          (v_track_buckets->v_track_key->'desired_credit_rows') || v_desired,
          true
        );
        v_track_buckets := jsonb_set(v_track_buckets,array[v_track_key],v_bucket,true);
      else
        v_track_buckets := jsonb_set(
          v_track_buckets,
          array[v_track_key],
          jsonb_build_object(
            'track_id',v_track_id,
            'is_new',v_track_is_new,
            'title',v_track->>'title',
            'normalized_title',platform_private.registry_identity_normalize_text_v1(v_track->>'title'),
            'slug',v_slug,
            'isrc',v_isrc,
            'profile',v_profile,
            'desired_credit_rows',v_desired
          ),
          true
        );
      end if;
    end loop;

    v_release_buckets := jsonb_set(v_release_buckets,array[v_release_key],v_bucket,true);
  end loop;

  -- Freeze all identity operations before provider facts or relationship sets.
  for v_pair in select key,value from jsonb_each(v_release_buckets) order by key
  loop
    if coalesce((v_pair.value->>'is_new')::boolean,false) then
      v_collision_state := platform_private.registry_release_creation_collision_state_v1(
        (v_pair.value->>'release_id')::uuid,
        v_pair.value->>'title',
        p_artist_id,
        nullif(v_pair.value->>'upc','')
      );
      if v_collision_state <> '[]'::jsonb then
        raise exception using errcode='40001',
          message='New Release identity collides with Registry state before reviewed plan freeze.';
      end if;
      v_collision_fingerprint := platform_private.registry_identity_creation_collision_fingerprint_v1(v_collision_state);
      v_operations := v_operations || jsonb_build_array(
        jsonb_build_object(
          'ref','release.create:'||v_pair.key,
          'kind','materialization',
          'operation_key','registry.release.create',
          'subject_type','release',
          'subject_id',v_pair.value->>'release_id',
          'payload',jsonb_build_object(
            'release_id',v_pair.value->>'release_id',
            'title',v_pair.value->>'title',
            'normalized_title',v_pair.value->>'normalized_title',
            'slug',v_pair.value->>'slug',
            'upc',nullif(v_pair.value->>'upc',''),
            'identity_artist_id',p_artist_id,
            'collision_state_fingerprint',v_collision_fingerprint
          )
        )
      );
    end if;
  end loop;

  for v_pair in select key,value from jsonb_each(v_track_buckets) order by key
  loop
    if coalesce((v_pair.value->>'is_new')::boolean,false) then
      if v_pair.value->>'slug' is distinct from
         platform_private.registry_track_creation_slug_v1(
           v_pair.value->>'title',p_artist_id
         )
      then
        v_collision_state :=
          platform_private.registry_discography_variant_creation_collision_state_v1(
            (v_pair.value->>'track_id')::uuid,
            v_pair.value->>'title',
            p_artist_id,
            nullif(v_pair.value->>'isrc',''),
            v_pair.value->>'slug'
          );
      else
        v_collision_state := platform_private.registry_track_creation_collision_state_v1(
          (v_pair.value->>'track_id')::uuid,
          v_pair.value->>'title',
          p_artist_id,
          nullif(v_pair.value->>'isrc','')
        );
      end if;
      if v_collision_state <> '[]'::jsonb then
        raise exception using errcode='PT409',
          message='Reviewed Discography Track identity requires resolution: '
            ||(v_pair.value->>'title')||'.';
      end if;
      v_collision_fingerprint := platform_private.registry_identity_creation_collision_fingerprint_v1(v_collision_state);
      v_operations := v_operations || jsonb_build_array(
        jsonb_build_object(
          'ref','track.create:'||v_pair.key,
          'kind','materialization',
          'operation_key','registry.track.create',
          'subject_type','track',
          'subject_id',v_pair.value->>'track_id',
          'payload',jsonb_build_object(
            'track_id',v_pair.value->>'track_id',
            'title',v_pair.value->>'title',
            'normalized_title',v_pair.value->>'normalized_title',
            'slug',v_pair.value->>'slug',
            'isrc',nullif(v_pair.value->>'isrc',''),
            'identity_artist_id',p_artist_id,
            'collision_state_fingerprint',v_collision_fingerprint
          )
        )
      );
    end if;
  end loop;

  for v_pair in select key,value from jsonb_each(v_release_buckets) order by key
  loop
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','release.profile:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.release.provider_profile.admit',
        'subject_type','release',
        'subject_id',v_pair.value->>'release_id',
        'payload',v_pair.value->'profile'
      )
    );
  end loop;

  for v_pair in select key,value from jsonb_each(v_track_buckets) order by key
  loop
    if not coalesce((v_pair.value->>'is_new')::boolean,false)
       and exists (
         select 1 from public.registry_tracks existing
         where existing.id=(v_pair.value->>'track_id')::uuid
           and existing.status='active'
       )
    then
      continue;
    end if;
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','track.profile:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.track.provider_profile.admit',
        'subject_type','track',
        'subject_id',v_pair.value->>'track_id',
        'payload',v_pair.value->'profile'
      )
    );
  end loop;

  for v_pair in select key,value from jsonb_each(v_release_buckets) order by key
  loop
    v_current := platform_private.registry_release_artist_set_v1((v_pair.value->>'release_id')::uuid);
    v_final := platform_private.registry_discography_preserve_set_ids_v1(
      v_current,
      v_pair.value->'desired_artist_rows',
      'release_artist_set:'||v_pair.key
    );
    v_delta := platform_private.registry_discography_set_delta_v1(v_current,v_final);
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','release.artist_set:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.release_artist_set.replace',
        'subject_type','release',
        'subject_id',v_pair.value->>'release_id',
        'payload',jsonb_build_object(
          'current_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_current),
          'final_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_final),
          'removed_rows',(v_delta->>'removed_rows')::integer,
          'inserted_rows',(v_delta->>'inserted_rows')::integer,
          'total_rows',(v_delta->>'total_rows')::integer,
          'final_set',v_final
        )
      )
    );
  end loop;

  for v_pair in select key,value from jsonb_each(v_track_buckets) order by key
  loop
    if not coalesce((v_pair.value->>'is_new')::boolean,false)
       and exists (
         select 1 from public.registry_tracks existing
         where existing.id=(v_pair.value->>'track_id')::uuid
           and existing.status='active'
       )
    then
      continue;
    end if;
    v_desired := platform_private.registry_discography_dedupe_track_credit_rows_v1(
      v_pair.value->'desired_credit_rows'
    );
    select count(*)::integer
    into v_count
    from jsonb_array_elements(v_desired) row_payload
    where coalesce((row_payload->>'is_featured')::boolean,false);
    v_featured_links := v_featured_links+v_count;

    v_current := platform_private.registry_track_artist_credit_set_v1((v_pair.value->>'track_id')::uuid);
    v_final := platform_private.registry_discography_preserve_set_ids_v1(
      v_current,
      v_desired,
      'track_artist_set:'||v_pair.key
    );
    v_delta := platform_private.registry_discography_set_delta_v1(v_current,v_final);
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','track.artist_set:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.track_artist_credit_set.replace',
        'subject_type','track',
        'subject_id',v_pair.value->>'track_id',
        'payload',jsonb_build_object(
          'current_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_current),
          'final_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_final),
          'removed_rows',(v_delta->>'removed_rows')::integer,
          'inserted_rows',(v_delta->>'inserted_rows')::integer,
          'total_rows',(v_delta->>'total_rows')::integer,
          'final_set',v_final
        )
      )
    );
  end loop;

  for v_pair in select key,value from jsonb_each(v_release_buckets) order by key
  loop
    v_current := platform_private.registry_release_track_set_v1((v_pair.value->>'release_id')::uuid);
    v_final := platform_private.registry_discography_preserve_set_ids_v1(
      v_current,
      v_pair.value->'desired_track_rows',
      'release_track_set:'||v_pair.key
    );
    v_delta := platform_private.registry_discography_set_delta_v1(v_current,v_final);
    v_operations := v_operations || jsonb_build_array(
      jsonb_build_object(
        'ref','release.track_set:'||v_pair.key,
        'kind','discography',
        'operation_key','registry.release_track_set.replace',
        'subject_type','release',
        'subject_id',v_pair.value->>'release_id',
        'payload',jsonb_build_object(
          'current_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_current),
          'final_set_fingerprint',platform_private.registry_discography_set_fingerprint_v1(v_final),
          'removed_rows',(v_delta->>'removed_rows')::integer,
          'inserted_rows',(v_delta->>'inserted_rows')::integer,
          'total_rows',(v_delta->>'total_rows')::integer,
          'final_set',v_final
        )
      )
    );
  end loop;

  v_operations := v_operations || jsonb_build_array(
    jsonb_build_object(
      'ref','artist.discography_summary:'||p_artist_id::text,
      'kind','discography',
      'operation_key','registry.artist.discography_summary.admit',
      'subject_type','artist',
      'subject_id',p_artist_id,
      'payload',jsonb_build_object(
        'apple_music_album_ids',v_all_album_ids,
        'apple_music_discography_ingested_at',v_snapshot.acquired_at
      )
    )
  );

  return jsonb_build_object(
    'plan_version',1,
    'artist_id',p_artist_id,
    'evidence_assertion_id',p_evidence_assertion_id,
    'snapshot_id',p_snapshot_id,
    'source_payload_fingerprint',v_snapshot.source_payload_fingerprint,
    'observation_fingerprint',v_snapshot.observation_fingerprint,
    'provider_acquired_at',v_snapshot.acquired_at,
    'operations',v_operations,
    'summary',jsonb_build_object(
      'merged',v_merged,
      'canonicalized',v_canonicalized,
      'ignored',v_ignored,
      'tracks_created',v_track_occurrences,
      'featured_artist_links',v_featured_links
    )
  );
end
$function$;

CREATE OR REPLACE FUNCTION platform_private.registry_discography_build_frozen_plan_pre_selective_v1(p_artist_id uuid, p_evidence_assertion_id uuid, p_snapshot_id uuid, p_reviewed_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
declare
  v_snapshot platform_private.registry_discography_provider_snapshots%rowtype;
  v_plan jsonb;
  v_operations jsonb:='[]'::jsonb;
  v_reconciliations jsonb:='[]'::jsonb;
  v_active_release_reconciliations jsonb:='[]'::jsonb;
  v_track_activations jsonb:='[]'::jsonb;
  v_release_activations jsonb:='[]'::jsonb;
  v_operation jsonb;
  v_album jsonb;
  v_track jsonb;
  v_create jsonb;
  v_subject_id uuid;
  v_current_status text;
  v_current_slug text;
  v_canonical_slug text;
  v_album_id text;
  v_track_apple_id text;
  v_accepted_album_ids jsonb;
  v_reviewed_count integer;
  v_accepted_count integer;
  v_left_count integer;
  v_reconcile_count integer:=0;
  v_active_release_reconcile_count integer:=0;
  v_track_activation_count integer:=0;
  v_release_activation_count integer:=0;
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

  v_plan:=
    platform_private.registry_discography_build_frozen_plan_core_v1(
      p_artist_id,
      p_evidence_assertion_id,
      p_snapshot_id,
      p_reviewed_selections
    );

  select
    count(*)::integer,
    count(*) filter (where selection->>'action'<>'ignore')::integer,
    count(*) filter (where selection->>'action'='ignore')::integer,
    coalesce(
      jsonb_agg(
        to_jsonb(selection->>'apple_music_id')
        order by selection->>'apple_music_id'
      ) filter (where selection->>'action'<>'ignore'),
      '[]'::jsonb
    )
  into
    v_reviewed_count,
    v_accepted_count,
    v_left_count,
    v_accepted_album_ids
  from jsonb_array_elements(p_reviewed_selections) selection;

  -- Preserve existing domain operations, but the Artist provider summary may
  -- contain only explicitly admitted Album IDs. Leave-all performs no summary
  -- mutation and still retains the immutable observation/review receipt.
  for v_operation in
    select value
    from jsonb_array_elements(v_plan->'operations')
    with ordinality as operation(value,ordinality)
    order by ordinality
  loop
    if v_operation->>'operation_key'=
       'registry.artist.discography_summary.admit'
    then
      if v_accepted_count>0 then
        v_operation:=jsonb_set(
          v_operation,
          '{payload,apple_music_album_ids}',
          v_accepted_album_ids,
          true
        );
        v_operations:=v_operations||jsonb_build_array(v_operation);
      end if;
    else
      v_operations:=v_operations||jsonb_build_array(v_operation);
    end if;
  end loop;

  -- Draft Release identity reconciliation. Provider packaging is structural
  -- evidence available here, so it is removed before first activation.
  for v_operation in
    select value
    from jsonb_array_elements(v_plan->'operations')
    where value->>'operation_key'='registry.release.provider_profile.admit'
    order by value->>'subject_id'
  loop
    v_subject_id:=(v_operation->>'subject_id')::uuid;
    v_album_id:=v_operation#>>'{payload,apple_music_album_id}';

    select value
    into v_album
    from jsonb_array_elements(v_snapshot.observation->'albums')
    where value->>'apple_music_id'=v_album_id;

    if v_album is null then
      raise exception using errcode='40001',
        message='Accepted Release disappeared from immutable provider evidence.';
    end if;

    v_canonical_slug:=
      platform_private.registry_reviewed_release_slug_v2(
        v_album->>'title',
        v_album->>'release_type',
        nullif(v_album->>'release_date','')::date,
        v_album->>'apple_music_id',
        p_artist_id,
        v_subject_id,
        v_snapshot.observation,
        v_accepted_album_ids
      );

    select release.status,release.slug
    into v_current_status,v_current_slug
    from public.registry_releases release
    where release.id=v_subject_id;

    if not found then
      select value
      into v_create
      from jsonb_array_elements(v_plan->'operations')
      where value->>'operation_key'='registry.release.create'
        and (value->>'subject_id')::uuid=v_subject_id;

      if v_create is null then
        raise exception using errcode='40001',
          message='Future accepted Release has no frozen materialization operation.';
      end if;

      v_current_status:='draft';
      v_current_slug:=v_create#>>'{payload,slug}';
    end if;

    if v_current_status not in ('draft','active') then
      raise exception using errcode='23514',
        message='Active Discography ingest only accepts active or draft Release targets.';
    end if;

    if v_current_status='draft'
       and v_current_slug is distinct from v_canonical_slug
    then
      v_reconciliations:=v_reconciliations||jsonb_build_array(
        jsonb_build_object(
          'ref','release.identity_reconcile:'||v_subject_id::text,
          'kind','identity_reconciliation',
          'operation_key','registry.draft_identity.reconcile',
          'subject_type','release',
          'subject_id',v_subject_id,
          'payload',jsonb_build_object(
            'current_slug',v_current_slug,
            'canonical_slug',v_canonical_slug,
            'identity_artist_id',p_artist_id,
            'reason','reviewed_provider_release_identity'
          )
        )
      );
      v_reconcile_count:=v_reconcile_count+1;
    elsif v_current_status='active'
       and v_current_slug is distinct from v_canonical_slug
    then
      v_active_release_reconciliations:=
        v_active_release_reconciliations||jsonb_build_array(
          jsonb_build_object(
            'ref','release.active_identity_reconcile:'||v_subject_id::text,
            'kind','release_identity_reconciliation',
            'operation_key','registry.release.identity.reconcile',
            'subject_type','release',
            'subject_id',v_subject_id,
            'payload',jsonb_build_object(
              'current_slug',v_current_slug,
              'canonical_slug',v_canonical_slug,
              'identity_artist_id',p_artist_id,
              'reason','reviewed_active_release_identity_recovery'
            )
          )
        );
      v_active_release_reconcile_count:=
        v_active_release_reconcile_count+1;
    end if;

    if v_current_status='draft' then
      v_release_activations:=v_release_activations||jsonb_build_array(
        jsonb_build_object(
          'ref','release.activate:'||v_subject_id::text,
          'kind','lifecycle',
          'operation_key','registry.release.activate',
          'subject_type','release',
          'subject_id',v_subject_id,
          'payload',jsonb_build_object(
            'from_status','draft',
            'to_status','active',
            'terminal_policy','active_ingest_v1'
          )
        )
      );
      v_release_activation_count:=v_release_activation_count+1;
    end if;
  end loop;

  -- Draft Track identity reconciliation. Track slugs are Artist-scoped title
  -- identity; old pre-convergence shells are repaired before first activation.
  for v_operation in
    select value
    from jsonb_array_elements(v_plan->'operations')
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
      platform_private.registry_track_creation_slug_v1(
        v_track->>'title',p_artist_id
      );

    select track_row.status,track_row.slug
    into v_current_status,v_current_slug
    from public.registry_tracks track_row
    where track_row.id=v_subject_id;

    if not found then
      select value
      into v_create
      from jsonb_array_elements(v_plan->'operations')
      where value->>'operation_key'='registry.track.create'
        and (value->>'subject_id')::uuid=v_subject_id;

      if v_create is null then
        raise exception using errcode='40001',
          message='Future accepted Track has no frozen materialization operation.';
      end if;

      v_current_status:='draft';
      v_current_slug:=v_create#>>'{payload,slug}';
      -- Do not normalize a recording-variant route back to a title-only URL.
      if v_current_slug is distinct from
          platform_private.registry_track_creation_slug_v1(
            v_track->>'title',p_artist_id
          )
      then
        v_canonical_slug:=v_current_slug;
      end if;
    end if;

    if v_current_status not in ('draft','active') then
      raise exception using errcode='23514',
        message='Active Discography ingest only accepts active or draft Track targets.';
    end if;

    if v_current_status='draft'
       and v_current_slug is distinct from v_canonical_slug
    then
      v_reconciliations:=v_reconciliations||jsonb_build_array(
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
            'reason','artist_scoped_track_identity'
          )
        )
      );
      v_reconcile_count:=v_reconcile_count+1;
    end if;

    if v_current_status='draft' then
      v_track_activations:=v_track_activations||jsonb_build_array(
        jsonb_build_object(
          'ref','track.activate:'||v_subject_id::text,
          'kind','lifecycle',
          'operation_key','registry.track.activate',
          'subject_type','track',
          'subject_id',v_subject_id,
          'payload',jsonb_build_object(
            'from_status','draft',
            'to_status','active',
            'terminal_policy','active_ingest_v1'
          )
        )
      );
      v_track_activation_count:=v_track_activation_count+1;
    end if;
  end loop;

  -- Relationships/provider facts land before lifecycle transition. Tracks
  -- activate before Releases, so Release activation can enforce active members.
  v_operations:=
    v_operations||
    v_reconciliations||
    v_active_release_reconciliations||
    v_track_activations||
    v_release_activations;

  return
    (v_plan-'operations'-'summary'-'plan_version')
    || jsonb_build_object(
      'plan_version',3,
      'terminal_policy','active_ingest_v2',
      'operations',v_operations,
      'summary',
        coalesce(v_plan->'summary','{}'::jsonb)
        || jsonb_build_object(
          'reviewed',v_reviewed_count,
          'accepted',v_accepted_count,
          'left',v_left_count,
          'identity_reconciliations',v_reconcile_count,
          'active_release_identity_reconciliations',
            v_active_release_reconcile_count,
          'track_activations',v_track_activation_count,
          'release_activations',v_release_activation_count
        )
    );
end
$function$;

CREATE OR REPLACE FUNCTION platform_private.registry_discography_build_frozen_plan_v1(p_artist_id uuid, p_evidence_assertion_id uuid, p_snapshot_id uuid, p_reviewed_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
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
      if v_current_slug is distinct from
         platform_private.registry_track_creation_slug_v1(
           v_track->>'title',p_artist_id
         )
      then
        v_canonical_slug:=v_current_slug;
      end if;
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
     (select count(*) from jsonb_object_keys(v_track_reconciliations))
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
$function$;

CREATE OR REPLACE FUNCTION platform_private.execute_registry_materialization_core_v1(p_actor_key text, p_execution_grant_id uuid)
 RETURNS TABLE(operation_id uuid, operation_status text, verifier_status text, idempotent_replay boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private'
AS $function$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_event_id uuid;
  v_collision_state jsonb;
  v_collision_fingerprint text;
  v_rows integer;
  v_artist public.registry_artists%rowtype;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    p_actor_key,
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
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  if v_operation.status <> 'authorized' then
    raise exception using errcode='42501',
      message='Registry materialization operation is not executable.';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if not found
     or v_grant.actor_key <> p_actor_key
     or v_grant.operation_version <> 1
     or v_grant.max_rows <> 1
     or v_grant.policy_ruleset_version <>
        'registry-materialization-v1'
     or v_grant.operation_key not in (
       'registry.artist.create',
       'registry.track.create',
       'registry.track_artist_credit.admit'
     )
  then
    raise exception using errcode='42501',
      message='Execution grant is not a Registry materialization V1 grant.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     ) <> 1
     or v_target.expected_state_fingerprint is not null
  then
    raise exception using errcode='42501',
      message='Materialization V1 requires one exact future target.';
  end if;

  v_plan:=v_grant.plan_payload;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.id::text is distinct from
        v_plan->>'evidence_assertion_id'
     or v_evidence.assertion_fingerprint is distinct from
        v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.subject_type <> v_target.subject_type
     or v_evidence.subject_id <> v_target.subject_id
  then
    raise exception using errcode='42501',
      message='Materialization evidence no longer satisfies the exact grant.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  if v_grant.operation_key='registry.artist.create' then
    if v_target.subject_type <> 'artist'
       or (v_plan - array[
         'operation_key','operation_version','artist_id',
         'display_name','normalized_name','slug',
         'collision_state_fingerprint',
         'evidence_assertion_id',
         'evidence_assertion_fingerprint',
         'trust_class','policy_ruleset_version'
       ]::text[]) <> '{}'::jsonb
       or (v_plan->>'artist_id')::uuid <> v_target.subject_id
       or nullif(btrim(v_plan->>'display_name'),'') is null
       or nullif(btrim(v_plan->>'normalized_name'),'') is null
       or nullif(btrim(v_plan->>'slug'),'') is null
    then
      raise exception using errcode='42501',
        message='Artist Create V1 plan is malformed.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'registry.artist.create:' ||
        (v_plan->>'normalized_name'),
        0
      )
    );

    v_collision_state :=
      platform_private.registry_artist_creation_collision_state_v1(
        v_target.subject_id,
        v_plan->>'display_name'
      );
    v_collision_fingerprint :=
      platform_private.registry_identity_creation_collision_fingerprint_v1(
        v_collision_state
      );

    if v_collision_state <> '[]'::jsonb
       or v_collision_fingerprint is distinct from
          v_plan->>'collision_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='Artist identity collision state changed before execution.';
    end if;

    insert into public.registry_artists (
      id,slug,display_name,normalized_name,sort_name,
      status,metadata
    )
    values (
      v_target.subject_id,
      v_plan->>'slug',
      v_plan->>'display_name',
      v_plan->>'normalized_name',
      v_plan->>'display_name',
      'draft',
      '{}'::jsonb
    );

    get diagnostics v_rows=row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,
      source_suggestion_id,source_table,
      field_name,target_path,before_value,after_value,
      action,status,actor
    )
    values (
      'artist',v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'identity','public.registry_artists',
      null,
      jsonb_build_object(
        'id',v_target.subject_id,
        'slug',v_plan->>'slug',
        'display_name',v_plan->>'display_name',
        'normalized_name',v_plan->>'normalized_name',
        'status','draft'
      ),
      'create_identity','succeeded',
      'system:'||p_actor_key
    )
    returning id into v_event_id;

  elsif v_grant.operation_key='registry.track.create' then
    if v_target.subject_type <> 'track'
       or (v_plan - array[
         'operation_key','operation_version','track_id',
         'title','normalized_title','slug','isrc',
         'identity_artist_id','collision_state_fingerprint',
         'evidence_assertion_id',
         'evidence_assertion_fingerprint',
         'trust_class','policy_ruleset_version'
       ]::text[]) <> '{}'::jsonb
       or (v_plan->>'track_id')::uuid <> v_target.subject_id
       or nullif(btrim(v_plan->>'title'),'') is null
       or nullif(btrim(v_plan->>'normalized_title'),'') is null
       or nullif(btrim(v_plan->>'slug'),'') is null
       or not exists (
         select 1 from public.registry_artists artist
         where artist.id=(v_plan->>'identity_artist_id')::uuid
           and artist.status <> 'archived'
       )
    then
      raise exception using errcode='42501',
        message='Track Create V1 plan is malformed.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'registry.track.create:' ||
        coalesce(
          nullif(v_plan->>'isrc',''),
          (v_plan->>'normalized_title') || ':' ||
          (v_plan->>'identity_artist_id')
        ),
        0
      )
    );

    if p_actor_key='registry_discography_admin'
       and nullif(v_plan->>'isrc','') is not null
       and v_plan->>'slug' is distinct from
           platform_private.registry_track_creation_slug_v1(
             v_plan->>'title',
             (v_plan->>'identity_artist_id')::uuid
           )
    then
      v_collision_state :=
        platform_private.registry_discography_variant_creation_collision_state_v1(
          v_target.subject_id,
          v_plan->>'title',
          (v_plan->>'identity_artist_id')::uuid,
          v_plan->>'isrc',
          v_plan->>'slug'
        );
    else
      v_collision_state :=
        platform_private.registry_track_creation_collision_state_v1(
          v_target.subject_id,
          v_plan->>'title',
          (v_plan->>'identity_artist_id')::uuid,
          nullif(v_plan->>'isrc','')
        );
    end if;
    v_collision_fingerprint :=
      platform_private.registry_identity_creation_collision_fingerprint_v1(
        v_collision_state
      );

    if v_collision_state <> '[]'::jsonb
       or v_collision_fingerprint is distinct from
          v_plan->>'collision_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='Track identity collision state changed before execution.';
    end if;

    insert into public.registry_tracks (
      id,slug,title,normalized_title,isrc,status,metadata
    )
    values (
      v_target.subject_id,
      v_plan->>'slug',
      v_plan->>'title',
      v_plan->>'normalized_title',
      nullif(v_plan->>'isrc',''),
      'draft',
      '{}'::jsonb
    );

    get diagnostics v_rows=row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,
      source_suggestion_id,source_table,
      field_name,target_path,before_value,after_value,
      action,status,actor
    )
    values (
      'track',v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'identity','public.registry_tracks',
      null,
      jsonb_build_object(
        'id',v_target.subject_id,
        'slug',v_plan->>'slug',
        'title',v_plan->>'title',
        'normalized_title',v_plan->>'normalized_title',
        'isrc',nullif(v_plan->>'isrc',''),
        'status','draft'
      ),
      'create_identity','succeeded',
      'system:'||p_actor_key
    )
    returning id into v_event_id;

  elsif v_grant.operation_key=
        'registry.track_artist_credit.admit'
  then
    if v_target.subject_type <> 'track_artist_credit'
       or (v_plan - array[
         'operation_key','operation_version','credit_id',
         'track_id','artist_id','role','credit_order',
         'display_credit','confidence',
         'collision_state_fingerprint',
         'evidence_assertion_id',
         'evidence_assertion_fingerprint',
         'trust_class','policy_ruleset_version'
       ]::text[]) <> '{}'::jsonb
       or (v_plan->>'credit_id')::uuid <> v_target.subject_id
       or platform_private.registry_credit_role_v1(
            v_plan->>'role'
          ) is distinct from v_plan->>'role'
       or platform_private.registry_credit_order_v1(
            (v_plan->>'credit_order')::integer
          ) is distinct from
          (v_plan->>'credit_order')::integer
       or platform_private.registry_relation_confidence_v1(
            (v_plan->>'confidence')::integer
          ) is distinct from
          (v_plan->>'confidence')::integer
    then
      raise exception using errcode='42501',
        message='Track Artist Credit V1 plan is malformed.';
    end if;

    select artist.*
    into v_artist
    from public.registry_artists artist
    where artist.id=(v_plan->>'artist_id')::uuid
      and artist.status <> 'archived';

    if not found
       or not exists (
         select 1 from public.registry_tracks track
         where track.id=(v_plan->>'track_id')::uuid
           and track.status <> 'archived'
       )
    then
      raise exception using errcode='42501',
        message='Track Artist Credit V1 canonical endpoints are missing.';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'registry.track_artist_credit.admit:' ||
        (v_plan->>'track_id') || ':' ||
        (v_plan->>'artist_id'),
        0
      )
    );

    v_collision_state :=
      platform_private.registry_track_artist_credit_collision_state_v1(
        v_target.subject_id,
        (v_plan->>'track_id')::uuid,
        (v_plan->>'artist_id')::uuid
      );
    v_collision_fingerprint :=
      platform_private.registry_relation_collision_fingerprint_v1(
        v_collision_state
      );

    if v_collision_state <> '[]'::jsonb
       or v_collision_fingerprint is distinct from
          v_plan->>'collision_state_fingerprint'
    then
      raise exception using errcode='40001',
        message='Track Artist credit collision state changed before execution.';
    end if;

    insert into public.registry_track_artists (
      id,track_id,artist_id,artist_slug,
      artist_name_text,role,is_primary,is_featured,
      credit_order,display_credit,source,confidence,
      status,metadata
    )
    values (
      v_target.subject_id,
      (v_plan->>'track_id')::uuid,
      (v_plan->>'artist_id')::uuid,
      v_artist.slug,
      v_artist.display_name,
      v_plan->>'role',
      (v_plan->>'role')='primary_artist',
      (v_plan->>'role')='featured_artist',
      (v_plan->>'credit_order')::integer,
      v_plan->>'display_credit',
      'chart_admission',
      (v_plan->>'confidence')::integer,
      'active',
      '{}'::jsonb
    );

    get diagnostics v_rows=row_count;

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,
      source_suggestion_id,source_table,
      field_name,target_path,before_value,after_value,
      action,status,actor
    )
    values (
      'track_artist_credit',v_target.subject_id::text,
      v_evidence.id::text,
      'platform_private.registry_evidence_assertions',
      'relationship','public.registry_track_artists',
      null,
      jsonb_build_object(
        'id',v_target.subject_id,
        'track_id',(v_plan->>'track_id')::uuid,
        'artist_id',(v_plan->>'artist_id')::uuid,
        'role',v_plan->>'role',
        'credit_order',(v_plan->>'credit_order')::integer,
        'display_credit',v_plan->>'display_credit',
        'confidence',(v_plan->>'confidence')::integer,
        'status','active'
      ),
      'admit_relationship','succeeded',
      'system:'||p_actor_key
    )
    returning id into v_event_id;
  end if;

  if v_rows <> 1 or v_event_id is null then
    raise exception using errcode='40001',
      message='Registry materialization lost its exact one-row boundary.';
  end if;

  insert into platform_private.registry_operation_write_events (
    operation_id,canonical_write_event_id
  )
  values (v_operation.id,v_event_id);

  update platform_private.registry_mutation_operations
  set affected_rows=1,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'subject_type',v_target.subject_type,
        'subject_id',v_target.subject_id,
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_id',v_event_id
      ),
      completed_at=now(),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  return next;
end
$function$;

-- These helpers have no direct client execution authority.
revoke all on function platform_private.registry_discography_track_variant_slug_v1(text,uuid,text) from public,anon,authenticated;
revoke all on function platform_private.registry_discography_variant_creation_collision_state_v1(uuid,text,uuid,text,text) from public,anon,authenticated;

do $wk_postflight$
begin
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_track_variant_slug_v1(text,uuid,text)')) is distinct from 'a9ac6d179b22fa17b98786edbb15c72d' then raise exception 'Discography postflight function body drifted: platform_private.registry_discography_track_variant_slug_v1(text,uuid,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_variant_creation_collision_state_v1(uuid,text,uuid,text,text)')) is distinct from 'ab478b92b3b0f3d1ddcb56ba8a31f09c' then raise exception 'Discography postflight function body drifted: platform_private.registry_discography_variant_creation_collision_state_v1(uuid,text,uuid,text,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_resolve_track_v1(uuid,jsonb)')) is distinct from '9ba362d6ad58f30774772a6c08b47601' then raise exception 'Discography postflight function body drifted: platform_private.registry_discography_resolve_track_v1(uuid,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_build_frozen_plan_core_v1(uuid,uuid,uuid,jsonb)')) is distinct from '23cc69fabec1bb5fcb473908bded56b6' then raise exception 'Discography postflight function body drifted: platform_private.registry_discography_build_frozen_plan_core_v1(uuid,uuid,uuid,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)')) is distinct from 'a4a95651afe5b5c1a8484cd7e3fa22f5' then raise exception 'Discography postflight function body drifted: platform_private.registry_discography_build_frozen_plan_pre_selective_v1(uuid,uuid,uuid,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)')) is distinct from '3aca6b164920cc8764f0e3b4d7e212e0' then raise exception 'Discography postflight function body drifted: platform_private.registry_discography_build_frozen_plan_v1(uuid,uuid,uuid,jsonb)'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('platform_private.execute_registry_materialization_core_v1(text,uuid)')) is distinct from '6dbb57df0d2a4cac0b2277a7fb0064f0' then raise exception 'Discography postflight function body drifted: platform_private.execute_registry_materialization_core_v1(text,uuid)'; end if;
end
$wk_postflight$;
