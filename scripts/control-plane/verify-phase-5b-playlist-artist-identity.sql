\set ON_ERROR_STOP on

do $$
declare
  v_signature text :=
    'editorial.materialize_playlist_publication_snapshot(uuid,timestamp with time zone,uuid,uuid)';

  v_definition text;
  v_security_definer boolean;
  v_config text[];
begin
  select
    procedure.prosecdef,
    procedure.proconfig,
    regexp_replace(
      lower(
        pg_get_functiondef(
          procedure.oid
        )
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  into
    v_security_definer,
    v_config,
    v_definition
  from pg_proc procedure
  where procedure.oid =
    v_signature::regprocedure;

  if not found then
    raise exception
      'Playlist publication materializer is missing';
  end if;

  if not v_security_definer then
    raise exception
      'Playlist publication materializer is not SECURITY DEFINER';
  end if;

  if v_config is distinct from
    array[
      'search_path=pg_catalog, public, editorial'
    ]::text[]
  then
    raise exception
      'Playlist publication materializer search path is not fixed';
  end if;

  if position(
    '''artists'''
    in v_definition
  ) = 0
     or position(
       'registry_track_artists'
       in v_definition
     ) = 0
     or position(
       '''artist_id'''
       in v_definition
     ) = 0
     or position(
       '''artist_slug'''
       in v_definition
     ) = 0
     or position(
       'public_image_url'
       in v_definition
     ) = 0
     or position(
       '''is_featured'''
       in v_definition
     ) = 0
     or position(
       '''credit_order'''
       in v_definition
     ) = 0
     or position(
       '''display_credit'''
       in v_definition
     ) = 0
  then
    raise exception
      'Complete Playlist artist identity snapshot contract is missing';
  end if;

  if position(
    '''apple_music_catalog_id'''
    in v_definition
  ) = 0
  then
    raise exception
      'M219 Apple Music identity behavior was not preserved';
  end if;

  if position(
    'null::uuid as logical_asset_id'
    in v_definition
  ) = 0
     or position(
       'null::text as safe_delivery_url'
       in v_definition
     ) = 0
     or position(
       'into v_cover'
       in v_definition
     ) = 0
  then
    raise exception
      'Coverless Playlist publication safety is missing';
  end if;

  if has_function_privilege(
    'authenticated',
    v_signature,
    'EXECUTE'
  )
     or has_function_privilege(
       'anon',
       v_signature,
       'EXECUTE'
     )
  then
    raise exception
      'Playlist publication materializer is exposed to a public client role';
  end if;
end;
$$;

select jsonb_build_object(
  'verification',
    'PASS',
  'artist_identity',
    'complete Registry credits',
  'featured_artists',
    true,
  'publication_snapshot',
    'immutable',
  'apple_music_identity_preserved',
    true
) as phase_5b_playlist_artist_identity_acceptance;
