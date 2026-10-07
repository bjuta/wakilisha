-- Provider Identity Slice 4A candidate.
-- Canonical migration filename MUST be minted with:
--   supabase migration new provider_identity_release_strong_evidence_resolver_v1
--
-- Replaces only Discography Release identity resolution policy.
-- No historical data rewrite.

begin;
set local statement_timeout='180s';

do $preflight$
begin
  if to_regprocedure(
       'platform_private.registry_discography_resolve_release_v1(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_identity_canonical_upc_v1(text)'
     ) is null
     or to_regprocedure(
       'public.resolve_registry_identity_lineage_v1(text,uuid,integer)'
     ) is null
     or to_regclass('public.registry_external_identifier_assertions') is null
  then
    raise exception
      'Provider Identity Release resolver preflight failed: required authority is missing.';
  end if;
end
$preflight$;

create or replace function
platform_private.registry_discography_resolve_release_v1(
  p_artist_id uuid,
  p_album jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_apple_id text:=nullif(btrim(p_album->>'apple_music_id'),'');
  v_upc text;
  v_source_ids uuid[]:='{}'::uuid[];
  v_current_ids uuid[]:='{}'::uuid[];
  v_source_id uuid;
  v_current_id uuid;
  v_lineage jsonb;
  v_lineage_status text;
  v_source_has_current boolean;
begin
  if p_artist_id is null
     or p_album is null
     or jsonb_typeof(p_album)<>'object'
     or v_apple_id is null
     or nullif(btrim(p_album->>'title'),'') is null
  then
    raise exception using errcode='22023',
      message='Release resolution requires exact Artist and provider Album identity.';
  end if;

  perform 1
  from public.registry_artists artist
  where artist.id=p_artist_id
    and artist.status<>'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Discography Release resolution Artist is missing or archived.';
  end if;

  v_upc:=platform_private.registry_identity_canonical_upc_v1(
    nullif(p_album->>'upc','')
  );

  select coalesce(
    array_agg(candidate.release_id order by candidate.release_id),
    '{}'::uuid[]
  )
  into v_source_ids
  from (
    select distinct release.id as release_id
    from public.registry_releases release
    where nullif(
            btrim(release.metadata->>'apple_music_album_id'),
            ''
          )=v_apple_id

    union

    select distinct release.id
    from public.registry_releases release
    where v_upc is not null
      and release.upc=v_upc

    union

    select distinct assertion.release_id
    from public.registry_external_identifier_assertions assertion
    where assertion.release_id is not null
      and assertion.assertion_status='accepted'
      and assertion.valid_to is null
      and assertion.issuer_namespace is null
      and (
        (
          assertion.scheme_key='apple_music'
          and assertion.comparison_value=v_apple_id
        )
        or (
          v_upc is not null
          and assertion.scheme_key in ('upc','ean')
          and regexp_replace(
                btrim(assertion.comparison_value),
                '[-[:space:]]+',
                '',
                'g'
              )=v_upc
          and regexp_replace(
                btrim(assertion.comparison_value),
                '[-[:space:]]+',
                '',
                'g'
              ) ~ '^[0-9]{8,14}$'
        )
      )
  ) candidate;

  if cardinality(v_source_ids)=0 then
    return null;
  end if;

  foreach v_source_id in array v_source_ids
  loop
    v_lineage:=public.resolve_registry_identity_lineage_v1(
      'release',
      v_source_id,
      16
    );
    v_lineage_status:=v_lineage->>'resolution_status';

    if v_lineage_status not in ('current','successor') then
      raise exception using errcode='40001',
        message=
          'Strong Release identity is not one unambiguous current Registry Release; review is required.';
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
      from public.registry_releases release
      where release.id=v_current_id
        and release.status<>'archived';

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
          'Strong Release identity resolves only to archived or missing Registry state; review is required.';
    end if;
  end loop;

  if cardinality(v_current_ids)<>1 then
    raise exception using errcode='40001',
      message=
        'Strong Release identity resolves to multiple current Registry Releases; review is required.';
  end if;

  return v_current_ids[1];
end
$$;

do $verify$
declare
  v_definition text;
begin
  select lower(
    pg_get_functiondef(
      'platform_private.registry_discography_resolve_release_v1(uuid,jsonb)'::regprocedure
    )
  )
  into v_definition;

  if position('apple_music_album_id' in v_definition)=0
     or position('registry_identity_canonical_upc_v1' in v_definition)=0
     or position('registry_external_identifier_assertions' in v_definition)=0
     or position('resolve_registry_identity_lineage_v1' in v_definition)=0
     or position('assertion_status=''accepted''' in v_definition)=0
  then
    raise exception
      'Provider Identity Release resolver lost required strong-evidence authority.';
  end if;

  if position('release.slug' in v_definition)>0
     or position('release.normalized_title' in v_definition)>0
     or position('registry_release_creation_slug_v1' in v_definition)>0
  then
    raise exception
      'Provider Identity Release resolver still contains weak slug/title canonical resolution.';
  end if;
end
$verify$;

commit;
