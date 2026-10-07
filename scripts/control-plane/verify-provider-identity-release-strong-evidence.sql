-- Permanent verifier: Provider Identity Release strong-evidence resolver.
-- Read-only.
-- Expected marker:
-- PROVIDER_IDENTITY_RELEASE_STRONG_EVIDENCE_RESOLVER=PASS

do $verify$
declare
  v_resolver regprocedure :=
    to_regprocedure(
      'platform_private.registry_discography_resolve_release_v1(uuid,jsonb)'
    );
  v_definition text;
begin
  if v_resolver is null then
    raise exception
      'FAIL: Discography Release resolver is missing';
  end if;

  select lower(pg_get_functiondef(v_resolver))
  into v_definition;

  if position('apple_music_album_id' in v_definition)=0
     or position('registry_identity_canonical_upc_v1' in v_definition)=0
     or position('registry_external_identifier_assertions' in v_definition)=0
     or position('resolve_registry_identity_lineage_v1' in v_definition)=0
     or position('assertion_status=''accepted''' in v_definition)=0
     or position('release.status' in v_definition)=0
     or position('archived' in v_definition)=0
  then
    raise exception
      'FAIL: Release resolver lost required strong-evidence or lineage checks';
  end if;

  if position('release.slug' in v_definition)>0
     or position('release.normalized_title' in v_definition)>0
     or position('registry_release_creation_slug_v1' in v_definition)>0
  then
    raise exception
      'FAIL: Release resolver regained weak slug/title canonical resolution';
  end if;

  if to_regprocedure(
       'platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)'
     ) is null
  then
    raise exception
      'FAIL: existing Release creation collision authority is missing';
  end if;
end
$verify$;

select
  'PROVIDER_IDENTITY_RELEASE_STRONG_EVIDENCE_RESOLVER=PASS'
  as result;
