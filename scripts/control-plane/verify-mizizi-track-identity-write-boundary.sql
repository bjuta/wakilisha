do $mizizi_track_identity_write_boundary_verify$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is null
  then
    raise exception
      'FAIL: MIZIZI Track Intake creation authority is missing.';
  end if;

  select pg_get_functiondef(
    'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'::regprocedure
  )
  into v_definition;

  if v_definition like '%v_primary_artist_slug%||%''--''%||%v_title_slug%' then
    raise exception
      'FAIL: MIZIZI Track Intake still prefixes Track route identity with Artist identity.';
  end if;

  if v_definition like '%left(replace(v_track_id::text, ''-'', ''''), 8)%' then
    raise exception
      'FAIL: MIZIZI Track Intake still manufactures random collision suffixes.';
  end if;

  if position(
       'v_slug := v_title_slug'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: MIZIZI Track Intake does not use minimal reviewed Track route identity.';
  end if;

  if position(
       'v_featured_artist_names'
       in v_definition
     ) = 0
     or position(
       'artist_credit.credit_role = ''featured'''
       in v_definition
     ) = 0
     or position(
       'unnest(v_featured_artist_names)'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: MIZIZI Track Intake feature cleanup is not tied to reviewed featured-Artist evidence.';
  end if;

  if position(
       'track_artist.is_primary is true'
       in lower(v_definition)
     ) = 0
  then
    raise exception
      'FAIL: MIZIZI Track Intake collision guard is not scoped to the reviewed primary Artist.';
  end if;

  if position(
       'reviewed route identity and primary artist already exists'
       in lower(v_definition)
     ) = 0
  then
    raise exception
      'FAIL: MIZIZI Track Intake does not fail closed on artist-scoped route collisions.';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: anonymous callers can execute MIZIZI Track Intake creation authority.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: authenticated Registry reviewers lost Track Intake creation authority.';
  end if;

  raise notice
    'PASS: MIZIZI Track Intake write boundary is structurally sealed.';
end;
$mizizi_track_identity_write_boundary_verify$;
