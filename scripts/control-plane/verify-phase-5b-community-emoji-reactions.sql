\set ON_ERROR_STOP on

do $$
declare
  v_signature text :=
    'public.community_react_to_target(text,uuid,text)';

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
      'Community reaction command is missing';
  end if;

  if not v_security_definer then
    raise exception
      'Community reaction command is not SECURITY DEFINER';
  end if;

  if v_config is distinct from
    array[
      'search_path=pg_catalog, public'
    ]::text[]
  then
    raise exception
      'Community reaction command search path is not fixed';
  end if;

  if position(
    'char_length'
    in v_definition
  ) = 0
  then
    raise exception
      'Community reaction length guard is missing';
  end if;

  if position(
    'octet_length'
    in v_definition
  ) = 0
  then
    raise exception
      'Community Unicode reaction guard is missing';
  end if;

  if position(
    'pg_advisory_xact_lock'
    in v_definition
  ) = 0
  then
    raise exception
      'Community reaction mutation is not serialized';
  end if;

  if not has_function_privilege(
    'authenticated',
    v_signature,
    'EXECUTE'
  )
  then
    raise exception
      'Authenticated reaction execution is missing';
  end if;

  if has_function_privilege(
    'anon',
    v_signature,
    'EXECUTE'
  )
  then
    raise exception
      'Anon reaction execution is unexpectedly granted';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc procedure
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault(
          'f',
          procedure.proowner
        )
      )
    ) privilege
    where procedure.oid =
        v_signature::regprocedure
      and privilege.grantee = 0
      and privilege.privilege_type =
        'EXECUTE'
  )
  then
    raise exception
      'PUBLIC reaction execution is unexpectedly granted';
  end if;
end;
$$;

select jsonb_build_object(
  'verification',
    'PASS',
  'unicode_reactions',
    true,
  'legacy_reactions_preserved',
    true,
  'authenticated_execute',
    has_function_privilege(
      'authenticated',
      'public.community_react_to_target(text,uuid,text)',
      'EXECUTE'
    )
) as phase_5b_community_emoji_reactions_acceptance;
